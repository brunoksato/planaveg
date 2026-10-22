"""A estrutura do banco (`init-db`): os scripts fixos, as migrações, as regras e os lugares de
referência, as views geradas do contrato, o papel de leitura, as chaves do GeoServer e o cálculo
das materializadas.
"""

from __future__ import annotations

from collections.abc import Sequence
from importlib.resources import files

import psycopg
from psycopg import sql

from planaveg_core.banco.conexao import executar
from planaveg_core.banco.migracoes import aplicar_migracoes, migracoes
from planaveg_core.banco.papel import concessoes, garantir_papel_leitura
from planaveg_core.banco.pecas import lista_da_carga
from planaveg_core.banco.regras import gravar_regras, registrar_contrato
from planaveg_core.contrato import Contrato
from planaveg_core.errors import PlanavegError
from planaveg_core.publicacao import View, views

SCRIPTS_BASE = ("000_extensions.sql", "010_registro.sql")
SCRIPT_FUNCOES = "030_funcoes.sql"


def script(nome: str) -> str:
    """O texto de um dos scripts fixos (`sql/`)."""
    return files("planaveg_core").joinpath("sql", nome).read_text("utf-8")


def textos_fixos() -> dict[str, str]:
    """O que as views usam além delas mesmas e das regras: as funções que elas chamam (a busca e
    as regras) e as migrações (a forma das tabelas, as UFs e os biomas). Entram nas versões."""
    return {
        SCRIPT_FUNCOES: script(SCRIPT_FUNCOES),
        **{f"{m.numero:04d}_{m.nome}.sql": m.texto for m in migracoes()},
    }


def preparar(con: psycopg.Connection) -> list[str]:
    """O que vem antes de abrir a etapa do `init-db`, para `execucao` existir: a extensão e o
    SRS, os registros, as migrações que faltam e as funções. Devolve as migrações aplicadas."""
    for nome in SCRIPTS_BASE:
        executar(con, script(nome))
    aplicadas = aplicar_migracoes(con)
    executar(con, script(SCRIPT_FUNCOES))
    return aplicadas


def aplicar_estrutura(
    con: psycopg.Connection, contrato: Contrato, senha_leitura: str, *, recriar: bool
) -> int:
    """O resto do `init-db`: o contrato vigente, as regras e os municípios, as views geradas, o
    papel de leitura, as chaves e as permissões. Devolve o id da versão do contrato. A
    `modelagem` escreve os mesmos comandos em SQL puro, sem as conferências, o descarte do que o
    init-db anterior gerou e a senha.

    `recriar` descarta a carga: a entrega pronta deixa de ser (fica `substituida`), e as etapas
    seguintes param sem entrega pronta até um `load`, em vez de conferir ou publicar tabelas
    vazias. Sem `recriar`, um contrato que tira uma regra que a carga usa faz o `init-db` parar.
    """
    _conferir_srs(con, contrato)
    versao_id = registrar_contrato(con, contrato)
    if recriar:
        descartar_carga(con)
    geradas = views(contrato)
    _descartar_geradas(con, geradas)
    gravar_regras(con, contrato, geradas)
    for view in geradas:
        _executar_todos(con, view.criar())
    _registrar_geradas(con, geradas)
    garantir_papel_leitura(con, senha_leitura)
    _executar_todos(con, concessoes(geradas))
    con.execute("DELETE FROM gt_pk_metadata WHERE table_schema = 'public'")
    _executar_todos(con, chaves(geradas))
    _executar_todos(con, [v.preencher() for v in geradas if v.materializada])
    return versao_id


def descartar_carga(con: psycopg.Connection) -> None:
    """A entrega pronta deixa de ser, e o que a carga trouxe do arquivo sai. As entregas, as
    camadas delas, as execuções e as publicações ficam."""
    con.execute("UPDATE entrega SET estado = 'substituida' WHERE estado = 'pronta'")
    con.execute(sql.SQL("TRUNCATE {}").format(lista_da_carga()))


def _executar_todos(con: psycopg.Connection, comandos: Sequence[sql.SQL | sql.Composed]) -> None:
    for comando in comandos:
        con.execute(comando)


def _descartar_geradas(con: psycopg.Connection, geradas: list[View]) -> None:
    """Derruba as views do registro (`objeto_gerado`) e as da lista atual, cada uma pelo tipo.

    Só o que o init-db gerou sai: no schema public moram também as views do PostGIS
    (geometry_columns, geography_columns), que nunca podem ser derrubadas. O registro guarda
    as de um filtro renomeado ou removido do contrato. CASCADE leva as dependentes; as do
    contrato são recriadas logo depois.
    """
    nomes = [
        str(r[0])
        for r in con.execute("SELECT nome FROM objeto_gerado ORDER BY ordem DESC").fetchall()
    ]
    nomes += [v.nome for v in reversed(geradas) if v.nome not in nomes]
    for nome in nomes:
        linha = con.execute(
            """
            SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = %s AND c.relkind IN ('v', 'm')
            """,
            (nome,),
        ).fetchone()
        if linha is None:
            continue
        tipo = "MATERIALIZED VIEW" if linha[0] == "m" else "VIEW"
        con.execute(
            sql.SQL("DROP {} IF EXISTS {} CASCADE").format(sql.SQL(tipo), sql.Identifier(nome))
        )


def _registrar_geradas(con: psycopg.Connection, geradas: list[View]) -> None:
    con.execute("DELETE FROM objeto_gerado")
    con.execute(registro_das_geradas(geradas))


def registro_das_geradas(geradas: list[View]) -> sql.Composed:
    """As linhas de `objeto_gerado`, na ordem de criação. O `init-db` as grava depois de criar as
    views, e a `modelagem` as escreve no fim de `3_views.sql`: o próximo `init-db` sabe o que
    derrubar."""
    return sql.SQL(
        "INSERT INTO objeto_gerado (nome, tipo, ordem, publicada, espacial) VALUES\n    {}"
    ).format(
        sql.SQL(",\n    ").join(
            sql.SQL("({}, {}, {}, {}, {})").format(
                sql.Literal(v.nome),
                sql.Literal(v.tipo),
                sql.Literal(i),
                sql.Literal(v.publicada),
                sql.Literal(v.espacial),
            )
            for i, v in enumerate(geradas, 1)
        )
    )


def chaves(geradas: list[View]) -> list[sql.Composed]:
    """`fid` como chave de cada camada de mapa publicada, para o GeoServer: o INSERT em
    `gt_pk_metadata`, que o `init-db` esvazia antes. A das consultas com parâmetros vai na
    definição delas no GeoServer (`keyColumn`)."""
    camadas = [v.nome for v in geradas if v.camada_de_mapa]
    if not camadas:
        return []
    return [
        sql.SQL(
            "INSERT INTO gt_pk_metadata "
            "(table_schema, table_name, pk_column, pk_column_idx, pk_policy, pk_sequence) "
            "VALUES\n    {}"
        ).format(
            sql.SQL(",\n    ").join(
                sql.SQL("('public', {}, 'fid', NULL, 'assigned', NULL)").format(sql.Literal(nome))
                for nome in camadas
            )
        ),
    ]


def atualizar_quantitativos(con: psycopg.Connection, contrato: Contrato) -> list[str]:
    """Recalcula as views materializadas, na ordem de criação (a classificação primeiro, e a
    série lê as outras)."""
    atualizadas: list[str] = []
    for view in views(contrato):
        if view.materializada:
            con.execute(view.atualizar())
            atualizadas.append(view.nome)
    return atualizadas


def _conferir_srs(con: psycopg.Connection, contrato: Contrato) -> None:
    """O SRS que o `000` registra tem de ser o do contrato (número e proj4). Falha fechado."""
    linha = con.execute(
        "SELECT proj4text FROM spatial_ref_sys WHERE srid = %s", (contrato.srid,)
    ).fetchone()
    if linha is None or str(linha[0]).split() != contrato.proj4.split():
        raise PlanavegError("srs_do_contrato_nao_registrado", str(contrato.srid))
