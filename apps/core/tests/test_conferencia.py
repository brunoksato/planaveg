"""A conferência sem banco: o registro das dezesseis e o que cada uma devolve."""

from __future__ import annotations

from uuid import uuid4

import psycopg

from planaveg_core.cli.comandos.verify import _placar, _resumo, _situacao
from planaveg_core.conferencia.base import Contexto, Verificacao
from planaveg_core.conferencia.geometrias import pecas_sem_sobreposicao
from planaveg_core.conferencia.todas import _rodar


class _Transacao:
    def __enter__(self) -> None:
        return None

    def __exit__(self, *_: object) -> None:
        return None


class _ConexaoQuebrada:
    def transaction(self) -> _Transacao:
        return _Transacao()

    def execute(self, consulta: str, *_: object) -> None:
        if "work_mem" not in consulta:
            raise psycopg.errors.UndefinedTable("relation does not exist")


def _contexto(con: object, *, geometrica: bool = True) -> Contexto:
    return Contexto(con, uuid4(), (2022, 2024), None, geometrica, ())  # type: ignore[arg-type]


def test_erro_do_banco_vira_a_reprovacao_daquela_conferencia() -> None:
    def consultar(ctx: Contexto) -> Verificacao:
        ctx.con.execute("SELECT 1 FROM tabela_que_falta")
        return Verificacao("x", True, "ok")

    resultado = _rodar(_contexto(_ConexaoQuebrada()), "fid_unico_por_camada", consultar)
    assert (resultado.codigo, resultado.ok) == ("fid_unico_por_camada", False)
    assert resultado.detalhe == "erro do banco: UndefinedTable"
    assert resultado.erro


def test_sobreposicao_pulada_nao_e_aprovada_nem_reprovada() -> None:
    resultado = pecas_sem_sobreposicao(_contexto(None, geometrica=False))
    assert (resultado.ok, resultado.pulada) == (False, True)


def test_erro_do_banco_nunca_e_aceito() -> None:
    resultados = [
        Verificacao("a", True, "ok"),
        Verificacao("sobreposicao", False, "0,25 ha"),
        Verificacao("hierarquia", False, "erro do banco: QueryCanceled", erro=True),
        Verificacao("lenta", False, "pulada (--rapido)", pulada=True),
    ]
    placar = _placar(resultados, {"sobreposicao", "hierarquia"})

    assert placar.reprovadas == ["sobreposicao", "hierarquia"]
    assert placar.aceitas == ["sobreposicao"]  # a com erro não tem resultado para aceitar
    assert placar.erros == ["hierarquia"]
    assert placar.nao_aceitas == ["hierarquia"]
    assert placar.puladas == ["lenta"]
    assert _resumo(placar, 4) == (
        "verify: 1/4 invariantes ok, 1 reprovação aceita, 1 com erro do banco, "
        "1 pulada (incompleto)"
    )
    assert [_situacao(r, {"sobreposicao", "hierarquia"}) for r in resultados] == [
        "ok    ",
        "ACEITA",
        "ERRO  ",
        "PULADA",
    ]
