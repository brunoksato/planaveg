"""A carga de ponta a ponta num banco à parte: init-db, load, verify e uma recarga que falha.

O banco é criado e apagado aqui, no mesmo PostGIS do `DATABASE_URL`: a carga troca as peças, e a
base do banco local não pode sumir. Os dados são um GeoPackage sintético (`gpkg_sintetico`).
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

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

ANO_2024 = "Planaveg_2026_Visualizacao_vs2224q"
ANO_2022 = "Planaveg_2026_Visualizacao_vs22q"
# As peças sintéticas são todas de um nível: os outros níveis presentes ficam sem peças, o que
# esta invariante reprova. Nos testes, ela vai aceita.
HIERARQUIA = "hierarquia_coberta_pelo_contrato"
SOBREPOSICAO = "pecas_sem_sobreposicao"


@pytest.fixture
def banco_de_teste(settings: Settings) -> Iterator[str]:
    try:
        admin = psycopg.connect(settings.database_url, autocommit=True, connect_timeout=3)
    except psycopg.OperationalError:
        pytest.skip("banco do planaveg_core indisponível")
    nome = f"planaveg_teste_{os.getpid()}"
    apagar = sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(nome))
    with admin:
        admin.execute(apagar)
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nome)))
    try:
        yield make_conninfo(settings.database_url, dbname=nome)
    finally:
        with psycopg.connect(settings.database_url, autocommit=True) as admin:
            admin.execute(apagar)


def _base(tmp_path: Path, contrato: Contrato, nome: str, **atributos_2024: object) -> Path:
    """Duas peças de 2024 que se cruzam numa faixa de 25 x 100 m (0,25 ha) e uma de 2022. O
    cômputo de cada ano é a soma das peças dele, para só a sobreposição reprovar. Os
    `atributos_2024` vão na segunda peça de 2024."""
    pecas = {
        ANO_2024: [
            Quadrado(1, 0.0, 0.0, 100.0, {"computo_recebido_ha": 2.0}),
            Quadrado(2, 75.0, 0.0, 100.0, {"computo_recebido_ha": 2.0, **atributos_2024}),
        ],
        ANO_2022: [Quadrado(10, 1000.0, 1000.0, 100.0, {"computo_recebido_ha": 1.0})],
    }
    return gpkg_sintetico.gerar(tmp_path / nome, contrato, pecas)


@pytest.fixture
def vigentes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A pasta das versões vigentes do banco de teste: nunca a do ambiente, que as etapas
    refariam a partir da `fonte_vigente` dele."""
    pasta = tmp_path / "vigentes"
    monkeypatch.setenv("VERSOES_VIGENTES", str(pasta))
    return pasta


def _ultima(con: psycopg.Connection, etapa: str) -> tuple[object, ...]:
    linha = con.execute(
        "SELECT ok, erro, entrega_id, detalhe FROM execucao "
        "WHERE etapa = %s ORDER BY id DESC LIMIT 1",
        (etapa,),
    ).fetchone()
    assert linha is not None
    return tuple(linha)


def test_carga_em_uma_transacao_e_verify_que_acha_a_sobreposicao(
    banco_de_teste: str,
    vigentes: Path,
    tmp_path: Path,
    contrato: Contrato,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", banco_de_teste)
    monkeypatch.setenv("GPKG_PATH", str(_base(tmp_path, contrato, "base.gpkg")))

    # --rapido não publica, mesmo com --geoserver (a sobreposição ficou pulada).
    assert main(["run-all", "--rapido", "--geoserver", "--aceitar", HIERARQUIA]) == 0
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        ok, _, entrega, detalhe = _ultima(con, "verify")
        assert ok is True and entrega is not None
        assert isinstance(detalhe, dict)
        assert detalhe["puladas"] == [SOBREPOSICAO]
        assert detalhe["reprovadas"] == detalhe["aceitas"] == [HIERARQUIA]
        assert con.execute(
            "SELECT count(*) FROM execucao WHERE etapa = 'geoserver'"
        ).fetchone() == (0,)
        assert con.execute("SELECT count(*) FROM peca_recebida").fetchone() == (3,)
    # Sem publicação, nenhuma versão vigente para o nginx.
    assert vigentes.is_dir() and not list(vigentes.iterdir())

    # Completo, ele acha o par 1 x 2 de 2024 e reprova (saída 1)...
    assert main(["verify", "--aceitar", HIERARQUIA]) == 1
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        ok, _, _, detalhe = _ultima(con, "verify")
        assert ok is False
        assert isinstance(detalhe, dict)
        assert detalhe["reprovadas"] == [HIERARQUIA, SOBREPOSICAO]
        pares = detalhe["dados"]["pecas_sem_sobreposicao"]["pares_materiais"]["2024"]
        assert [(p["fid_a"], p["fid_b"]) for p in pares] == [(1, 2)]
        assert pares[0]["area_ha"] == pytest.approx(0.25, abs=1e-6)
    # ... e, aceita, a reprovação fica registrada sem falhar a etapa.
    assert main(["verify", "--aceitar", HIERARQUIA, "--aceitar", SOBREPOSICAO]) == 0
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        ok, _, _, detalhe = _ultima(con, "verify")
        assert ok is True
        assert isinstance(detalhe, dict)
        assert detalhe["aceitas"] == [HIERARQUIA, SOBREPOSICAO]


@pytest.mark.usefixtures("vigentes")
def test_recarga_que_falha_no_meio_deixa_a_base_anterior(
    banco_de_teste: str, tmp_path: Path, contrato: Contrato, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", banco_de_teste)
    monkeypatch.setenv("GPKG_PATH", str(_base(tmp_path, contrato, "base.gpkg")))
    assert main(["init-db"]) == 0
    assert main(["load"]) == 0
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        entrega = con.execute("SELECT id FROM entrega WHERE estado = 'pronta'").fetchone()

    # Outro arquivo, com um tier que não converte numa peça de 2024. A carga segue a ordem do
    # contrato (2022, depois 2024): a camada de 2022 já entrou quando a carga falha, e sai junto.
    assert [c.ano_vs for c in contrato.camadas] == [2022, 2024]
    ruim = _base(tmp_path, contrato, "ruim.gpkg", tier="x")
    monkeypatch.setenv("GPKG_PATH", str(ruim))
    assert main(["load"]) == 2
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        ok, erro, entrega_falha, _ = _ultima(con, "load")
        assert (ok, erro) == (False, "valor_incompativel")
        assert entrega_falha is None  # a entrega nova foi desfeita junto
        assert con.execute("SELECT id FROM entrega WHERE estado = 'pronta'").fetchone() == entrega
        assert con.execute("SELECT count(*) FROM entrega").fetchone() == (1,)
        assert con.execute("SELECT count(*) FROM peca_recebida").fetchone() == (3,)
        assert con.execute("SELECT sum(n_pecas) FROM quantitativo_nivel").fetchone() == (3,)

    # Outro, com um código de município que o IBGE não tem: a carga para antes de gravar a peça,
    # e a base anterior fica.
    fora = _base(tmp_path, contrato, "fora_do_ibge.gpkg", cod_municipio="9999999")
    monkeypatch.setenv("GPKG_PATH", str(fora))
    assert main(["load"]) == 2
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        ok, erro, _, _ = _ultima(con, "load")
        assert (ok, erro) == (False, "municipio_fora_do_ibge")
        assert con.execute("SELECT id FROM entrega WHERE estado = 'pronta'").fetchone() == entrega

    # E um com outro nome para o município: só um aviso. O nome publicado é o do IBGE.
    outro_nome = _base(tmp_path, contrato, "outro_nome.gpkg", municipio="Outro nome")
    monkeypatch.setenv("GPKG_PATH", str(outro_nome))
    assert main(["load"]) == 0
    with psycopg.connect(banco_de_teste, autocommit=True) as con:
        ok, _, _, detalhe = _ultima(con, "load")
        assert ok is True and isinstance(detalhe, dict)
        camada = detalhe["camadas"][ANO_2024]
        assert camada["municipios_com_outro_nome"] == {"5218508": ["Outro nome", "Quirinópolis"]}
        assert con.execute("SELECT DISTINCT municipio FROM peca_classificada").fetchall() == [
            ("Quirinópolis",)
        ]
