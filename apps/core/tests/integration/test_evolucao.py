"""O contrato evolui com uma base carregada, num banco à parte: o `init-db` acerta as regras no
lugar e só para quando o contrato tira algo que a carga usa.

O banco é criado e apagado aqui, no mesmo PostGIS do `DATABASE_URL`, com a base sintética de
`test_carga.py`. Cada caso escreve um contrato alterado e roda o `init-db` com ele.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import gpkg_sintetico
import psycopg
import pytest
from gpkg_sintetico import Quadrado
from psycopg import sql
from psycopg.conninfo import make_conninfo

from planaveg_core.cli.principal import main
from planaveg_core.config import Settings
from planaveg_core.contrato import Contrato

pytestmark = pytest.mark.integration

CONTRATO = Path(__file__).resolve().parents[2] / "src/planaveg_core/contracts/categorias.v1.json"


@pytest.fixture
def banco_carregado(
    settings: Settings, tmp_path: Path, contrato: Contrato, monkeypatch: pytest.MonkeyPatch
) -> Iterator[str]:
    """Um banco com a base sintética carregada pelo contrato do pacote."""
    try:
        admin = psycopg.connect(settings.database_url, autocommit=True, connect_timeout=3)
    except psycopg.OperationalError:
        pytest.skip("banco do planaveg_core indisponível")
    nome = f"planaveg_teste_{os.getpid()}_evolucao"
    apagar = sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(nome))
    with admin:
        admin.execute(apagar)
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nome)))
    conninfo = make_conninfo(settings.database_url, dbname=nome)
    pecas = {
        contrato.camadas[1].origem: [Quadrado(1, 0.0, 0.0, 100.0, {"computo_recebido_ha": 1.0})],
        contrato.camadas[0].origem: [Quadrado(10, 0.0, 0.0, 100.0, {"computo_recebido_ha": 1.0})],
    }
    monkeypatch.setenv("DATABASE_URL", conninfo)
    monkeypatch.setenv("GPKG_PATH", str(gpkg_sintetico.gerar(tmp_path / "b.gpkg", contrato, pecas)))
    monkeypatch.setenv("VERSOES_VIGENTES", str(tmp_path / "vigentes"))
    try:
        assert main(["init-db"]) == 0
        assert main(["load"]) == 0
        yield conninfo
    finally:
        with psycopg.connect(settings.database_url, autocommit=True) as admin:
            admin.execute(apagar)


def _com_contrato(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, mudar: Callable[[dict[str, Any]], None]
) -> None:
    """Escreve o contrato do pacote mudado por `mudar` e o põe em `CONTRACT_PATH`."""
    bruto = json.loads(CONTRATO.read_text(encoding="utf-8"))
    mudar(bruto)
    caminho = tmp_path / "contrato.json"
    caminho.write_text(json.dumps(bruto, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("CONTRACT_PATH", str(caminho))


def _ultima(conninfo: str, etapa: str) -> tuple[Any, ...]:
    with psycopg.connect(conninfo, autocommit=True) as con:
        linha = con.execute(
            "SELECT ok, erro FROM execucao WHERE etapa = %s ORDER BY id DESC LIMIT 1", (etapa,)
        ).fetchone()
    assert linha is not None
    return tuple(linha)


def test_marca_nova_no_meio_do_contrato_entra_sem_recriar(
    banco_carregado: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def marca_nova(bruto: dict[str, Any]) -> None:
        colunas = bruto["colunas"]
        i = next(i for i, c in enumerate(colunas) if c["destino"] == "embargo_pangia")
        nova = {"origem": "Nova", "destino": "nova", "tipo": "marca", "marcado": "Nova"}
        colunas.insert(i + 1, {**nova, "descricao": "Uma marca nova no meio."})

    _com_contrato(tmp_path, monkeypatch, marca_nova)
    assert main(["init-db"]) == 0
    with psycopg.connect(banco_carregado, autocommit=True) as con:
        ordem = con.execute(
            "SELECT marca FROM contrato_marca WHERE ordem BETWEEN 20 AND 22 ORDER BY ordem"
        ).fetchall()
        assert ordem == [("embargo_pangia",), ("nova",), ("gef_terrestre",)]
        colunas = [
            str(r[0])
            for r in con.execute(
                "SELECT attname FROM pg_attribute WHERE attrelid = 'peca_2024'::regclass "
                "AND attnum > 0 ORDER BY attnum"
            ).fetchall()
        ]
        assert colunas[colunas.index("embargo_pangia") + 1] == "nova"
        # As peças carregadas seguem lá, e a marca nova está desligada nelas.
        assert con.execute("SELECT count(*), bool_or(nova) FROM peca").fetchone() == (2, False)
    # O contrato lê o arquivo de outro jeito: conferir pede uma carga nova, antes de abrir a etapa.
    assert main(["verify", "--rapido"]) == 2
    assert "contrato_diverge_da_carga" in caplog.text


def test_rotulo_que_muda_leva_as_pecas_junto(
    banco_carregado: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, contrato: Contrato
) -> None:
    antigo = contrato.niveis_presentes()[0].rotulo

    def renomear(bruto: dict[str, Any]) -> None:
        bruto["hierarquia"][0]["rotulo"] = f"{antigo} (renomeado)"

    _com_contrato(tmp_path, monkeypatch, renomear)
    assert main(["init-db"]) == 0
    with psycopg.connect(banco_carregado, autocommit=True) as con:
        assert con.execute("SELECT DISTINCT hierarquia FROM peca_recebida").fetchall() == [
            (f"{antigo} (renomeado)",)
        ]
        assert con.execute("SELECT DISTINCT hierarquia FROM computo_recebido").fetchall() == [
            (f"{antigo} (renomeado)",)
        ]
        assert con.execute(
            "SELECT sum(n_pecas) FROM quantitativo_nivel WHERE tier = 1"
        ).fetchone() == (2,)


def test_nivel_que_a_carga_usa_nao_sai_do_contrato(
    banco_carregado: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def sem_o_nivel(bruto: dict[str, Any]) -> None:
        bruto["hierarquia"][0]["rotulo"] = None
        bruto["hierarquia"][0]["ausente"] = "fora do contrato"

    _com_contrato(tmp_path, monkeypatch, sem_o_nivel)
    assert main(["init-db"]) == 2
    assert _ultima(banco_carregado, "init-db") == (False, "contrato_tira_o_que_a_carga_usa")
    with psycopg.connect(banco_carregado, autocommit=True) as con:
        # Nada mudou: a carga e as regras de antes seguem.
        assert con.execute("SELECT count(*) FROM peca_classificada").fetchone() == (2,)
        assert con.execute(
            "SELECT count(*) FROM contrato_hierarquia WHERE tier = 1"
        ).fetchone() == (1,)
    # Com a carga descartada antes, o contrato novo entra.
    assert main(["init-db", "--recreate"]) == 0
