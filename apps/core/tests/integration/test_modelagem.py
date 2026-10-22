"""A modelagem aplicada num banco vazio dá o banco do `init-db`, e o fluxo de quem a usa funciona:
criar o banco pelos arquivos, carregar com o `load`, conferir e, depois, atualizar com o `init-db`.

Dois bancos à parte no mesmo PostGIS do `DATABASE_URL`, criados e apagados aqui: um recebe o
`init-db` (sem peças), o outro os arquivos da modelagem, na ordem. O catálogo dos dois tem de ser
o mesmo: tabelas, colunas, views, índices, restrições, funções, permissões, os registros das
migrações e das views e os dados de referência. As peças vêm de um GeoPackage sintético
(`gpkg_sintetico`).
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

from planaveg_core import banco
from planaveg_core.banco.conexao import executar
from planaveg_core.cli.principal import main
from planaveg_core.config import Settings
from planaveg_core.contrato import Contrato
from planaveg_core.publicacao import TABELAS_DE_REFERENCIA

pytestmark = pytest.mark.integration

# As peças sintéticas são todas de um nível: os outros níveis presentes ficam sem peças, o que
# esta invariante reprova. Aqui, ela vai aceita.
HIERARQUIA = "hierarquia_coberta_pelo_contrato"

# O catálogo do schema public, sem o que o PostGIS instala.
_CONSULTAS = {
    "relacoes": """
        SELECT c.relname, c.relkind, c.relispopulated
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'i')
          AND c.relname NOT IN ('spatial_ref_sys', 'spatial_ref_sys_pkey', 'geometry_columns',
                                'geography_columns')
        ORDER BY 1
    """,
    "colunas": """
        SELECT c.relname, a.attnum, a.attname, format_type(a.atttypid, a.atttypmod),
               a.attnotnull
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm') AND a.attnum > 0
          AND NOT a.attisdropped AND c.relname <> 'spatial_ref_sys'
        ORDER BY 1, 2
    """,
    "views": """
        SELECT c.relname, pg_get_viewdef(c.oid)
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
          AND c.relname NOT IN ('geometry_columns', 'geography_columns')
        ORDER BY 1
    """,
    "indices": """
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename <> 'spatial_ref_sys'
        ORDER BY 1
    """,
    "restricoes": """
        SELECT c.relname, r.conname, pg_get_constraintdef(r.oid)
        FROM pg_constraint r JOIN pg_class c ON c.oid = r.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname <> 'spatial_ref_sys'
        ORDER BY 1, 2
    """,
    "funcoes": """
        SELECT p.proname, pg_get_functiondef(p.oid)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('geom_de_origem', 'normalizar_busca', 'condicao_atendida')
        ORDER BY 1
    """,
    "leitura": """
        SELECT c.relname, has_table_privilege('geoserver_leitura', c.oid, 'SELECT')
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
        ORDER BY 1
    """,
    "chaves": "SELECT * FROM gt_pk_metadata ORDER BY table_name",
    "migracoes": "SELECT numero, nome, sha256 FROM migracao ORDER BY numero",
    "geradas": "SELECT * FROM objeto_gerado ORDER BY ordem",
}


def _catalogo(conninfo: str) -> dict[str, list[tuple[object, ...]]]:
    with psycopg.connect(conninfo, autocommit=True) as con:
        retrato = {nome: con.execute(consulta).fetchall() for nome, consulta in _CONSULTAS.items()}
        for tabela in TABELAS_DE_REFERENCIA:
            retrato[tabela] = con.execute(
                sql.SQL("SELECT * FROM {} t ORDER BY t::text").format(sql.Identifier(tabela))
            ).fetchall()
    return retrato


def _base(tmp_path: Path, contrato: Contrato) -> Path:
    """Uma peça de 1 ha em cada ano, longe uma da outra, com o cômputo igual à área."""
    pecas = {
        camada.origem: [Quadrado(i, 1000.0 * i, 0.0, 100.0, {"computo_recebido_ha": 1.0})]
        for i, camada in enumerate(contrato.camadas, 1)
    }
    return gpkg_sintetico.gerar(tmp_path / "base.gpkg", contrato, pecas)


@pytest.fixture
def bancos(settings: Settings) -> Iterator[tuple[str, str]]:
    try:
        admin = psycopg.connect(settings.database_url, autocommit=True, connect_timeout=3)
    except psycopg.OperationalError:
        pytest.skip("banco do planaveg_core indisponível")
    nomes = [f"planaveg_teste_{os.getpid()}_{sufixo}" for sufixo in ("init", "modelo")]
    apagar = [
        sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(n)) for n in nomes
    ]
    with admin:
        for nome, comando in zip(nomes, apagar, strict=True):
            admin.execute(comando)
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nome)))
    try:
        init, modelo = (make_conninfo(settings.database_url, dbname=n) for n in nomes)
        yield init, modelo
    finally:
        with psycopg.connect(settings.database_url, autocommit=True) as admin:
            for comando in apagar:
                admin.execute(comando)


def test_banco_criado_pela_modelagem_e_o_do_init_db_e_recebe_a_carga(
    bancos: tuple[str, str],
    settings: Settings,
    contrato: Contrato,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    init, modelo = bancos
    # A senha é a do ambiente: o papel é do servidor inteiro, e o GeoServer local a usa.
    with psycopg.connect(init) as con:
        banco.preparar(con)
        banco.aplicar_estrutura(con, contrato, settings.geoserver_pg_password, recriar=False)
    with psycopg.connect(modelo) as con:
        for _, texto in sorted(banco.modelagem(contrato).items()):
            executar(con, texto)

    do_init, do_modelo = _catalogo(init), _catalogo(modelo)
    for parte in [*_CONSULTAS, *TABELAS_DE_REFERENCIA]:
        assert do_init[parte] == do_modelo[parte], parte
    # O `init-db --recreate` descarta a carga (e refaz as views): a estrutura sai a mesma.
    with psycopg.connect(init) as con:
        banco.aplicar_estrutura(con, contrato, settings.geoserver_pg_password, recriar=True)
    recriado = _catalogo(init)
    for parte in [*_CONSULTAS, *TABELAS_DE_REFERENCIA]:
        assert recriado[parte] == do_modelo[parte], parte
    # Os dados de referência estão lá, e as materializadas calculadas.
    assert do_modelo["contrato_filtro"]
    assert all(r[2] for r in do_modelo["relacoes"] if r[1] == "m")

    # O fluxo de quem cria o banco pelos arquivos: o `load` carrega as peças, o `verify` confere,
    # e um `init-db` depois atualiza o banco sem tentar criar de novo o que os arquivos criaram.
    monkeypatch.setenv("DATABASE_URL", modelo)
    monkeypatch.setenv("GPKG_PATH", str(_base(tmp_path, contrato)))
    monkeypatch.setenv("VERSOES_VIGENTES", str(tmp_path / "vigentes"))
    assert main(["load"]) == 0
    assert main(["verify", "--rapido", "--aceitar", HIERARQUIA]) == 0
    with psycopg.connect(modelo, autocommit=True) as con:
        assert con.execute("SELECT count(*) FROM peca_recebida").fetchone() == (
            len(contrato.camadas),
        )
    assert main(["init-db"]) == 0
    atualizado = _catalogo(modelo)
    for parte in [*_CONSULTAS, *TABELAS_DE_REFERENCIA]:
        assert atualizado[parte] == do_modelo[parte], parte
