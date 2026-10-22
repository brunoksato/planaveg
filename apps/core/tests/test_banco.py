"""O banco sem banco: o verificador SCRAM da senha do papel de leitura, o espelho das versões
vigentes e o registro das migrações. O login com o verificador é testado contra o PostgreSQL na
integração."""

from __future__ import annotations

import base64
import hashlib
import hmac
from pathlib import Path
from typing import Any

import pytest

from planaveg_core.banco import conferir_migracoes
from planaveg_core.banco.migracoes import migracoes, pendentes
from planaveg_core.banco.papel import verificador_scram
from planaveg_core.banco.registro import registrar
from planaveg_core.banco.vigentes import sincronizar
from planaveg_core.errors import PlanavegError


def test_verificador_scram_no_formato_do_postgresql() -> None:
    sal = bytes(range(16))
    texto = verificador_scram("geoserver_leitura", sal=sal)
    metodo, resto = texto.split("$", 1)
    iteracoes_sal, chaves = resto.split("$")
    iteracoes, sal_b64 = iteracoes_sal.split(":")
    guardada, do_servidor = chaves.split(":")
    assert (metodo, iteracoes) == ("SCRAM-SHA-256", "4096")
    assert base64.b64decode(sal_b64) == sal
    # A RFC 5802: a chave do cliente sai do PBKDF2 da senha; o servidor guarda o hash dela.
    salgada = hashlib.pbkdf2_hmac("sha256", b"geoserver_leitura", sal, 4096)
    do_cliente = hmac.new(salgada, b"Client Key", hashlib.sha256).digest()
    assert base64.b64decode(guardada) == hashlib.sha256(do_cliente).digest()
    assert (
        base64.b64decode(do_servidor) == hmac.new(salgada, b"Server Key", hashlib.sha256).digest()
    )
    # Sem a senha no texto, e um sal novo a cada vez.
    assert "geoserver_leitura" not in texto
    assert verificador_scram("x") != verificador_scram("x")


class _Linha:
    def __init__(self, linha: tuple[Any, ...] | None) -> None:
        self.linha = linha

    def fetchone(self) -> tuple[Any, ...] | None:
        return self.linha


class _Conexao:
    def __init__(self, linha: tuple[Any, ...] | Exception | None) -> None:
        self.linha = linha
        self.desfeita = False

    def execute(self, _consulta: str) -> _Linha:
        if isinstance(self.linha, Exception):
            raise self.linha
        return _Linha(self.linha)

    def rollback(self) -> None:
        self.desfeita = True


def test_vigentes_espelha_a_fonte_vigente(tmp_path: Path) -> None:
    (tmp_path / "0123456789abcdef").touch()  # de uma publicação anterior
    (tmp_path / "LEIAME").touch()  # não é uma versão: não é do core
    publicadas = ("e89b80d6de62c726", "47d8ec0a7f238e3d", "3c2304472ba1fb13")

    assert sincronizar(_Conexao(publicadas), tmp_path) == set(publicadas)  # type: ignore[arg-type]
    assert sorted(p.name for p in tmp_path.iterdir()) == sorted([*publicadas, "LEIAME"])

    # Durante uma atualização, a fonte_vigente não tem versão: nenhuma fica.
    assert sincronizar(_Conexao((None, None, None)), tmp_path) == set()  # type: ignore[arg-type]
    assert [p.name for p in tmp_path.iterdir()] == ["LEIAME"]


class _ConexaoDeRegistro:
    """Anota os comandos do registro; o INSERT devolve o id 1."""

    def __init__(self) -> None:
        self.comandos: list[str] = []

    def execute(self, consulta: str, _parametros: object = None) -> _Linha:
        self.comandos.append(" ".join(consulta.split()))
        return _Linha((1,))

    def commit(self) -> None:
        self.comandos.append("COMMIT")

    def rollback(self) -> None:
        self.comandos.append("ROLLBACK")


def test_etapa_nao_roda_se_as_versoes_nao_saem_do_diretorio(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def falhar(*_: object) -> set[str]:
        raise OSError("somente leitura")

    monkeypatch.setattr("planaveg_core.banco.registro.sincronizar", falhar)
    con = _ConexaoDeRegistro()
    rodou = False
    with pytest.raises(OSError), registrar(con, "load", vigentes=tmp_path):  # type: ignore[arg-type]
        rodou = True

    assert not rodou  # a etapa não mexeu em nada
    assert any(c.startswith("UPDATE execucao") and "ok = false" in c for c in con.comandos)


class _ConexaoDasMigracoes:
    """Responde como um banco com o registro das migrações dado (None = sem a tabela)."""

    def __init__(self, aplicadas: dict[int, str] | None) -> None:
        self.aplicadas = aplicadas
        self.resposta: list[tuple[Any, ...]] = []

    def execute(self, consulta: str, _parametros: object = None) -> _ConexaoDasMigracoes:
        if "to_regclass" in consulta:
            self.resposta = [(self.aplicadas is None,)]
        else:
            self.resposta = list((self.aplicadas or {}).items())
        return self

    def fetchone(self) -> tuple[Any, ...] | None:
        return self.resposta[0] if self.resposta else None

    def fetchall(self) -> list[tuple[Any, ...]]:
        return self.resposta


def test_migracoes_numeradas_desde_um() -> None:
    lista = migracoes()
    assert [m.numero for m in lista] == list(range(1, len(lista) + 1))
    assert lista[0].nome == "modelo"
    assert all(len(m.sha256) == 64 for m in lista)


def test_pendentes_pelo_registro_das_migracoes() -> None:
    todas = migracoes()
    # Um banco vazio, sem o registro: todas faltam.
    assert pendentes(_ConexaoDasMigracoes(None)) == todas  # type: ignore[arg-type]
    # Todas aplicadas, com o mesmo arquivo: nada falta.
    aplicadas = {m.numero: m.sha256 for m in todas}
    assert pendentes(_ConexaoDasMigracoes(aplicadas)) == []  # type: ignore[arg-type]
    with pytest.raises(PlanavegError) as info:
        conferir_migracoes(_ConexaoDasMigracoes({}))  # type: ignore[arg-type]
    assert info.value.codigo == "banco_desatualizado"
    assert "rode init-db" in str(info.value)


def test_migracao_aplicada_nao_muda_e_banco_mais_novo_para() -> None:
    todas = migracoes()
    alterada = {m.numero: "0" * 64 for m in todas}
    with pytest.raises(PlanavegError) as info:
        pendentes(_ConexaoDasMigracoes(alterada))  # type: ignore[arg-type]
    assert info.value.codigo == "migracao_alterada"
    mais_nova = {**{m.numero: m.sha256 for m in todas}, len(todas) + 1: "f" * 64}
    with pytest.raises(PlanavegError) as info:
        pendentes(_ConexaoDasMigracoes(mais_nova))  # type: ignore[arg-type]
    assert info.value.codigo == "banco_de_versao_mais_nova"
