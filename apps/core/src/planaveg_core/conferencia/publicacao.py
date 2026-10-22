"""O que o GeoServer lê: o papel de leitura, a chave de cada camada e as camadas espaciais dos
filtros.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from psycopg import sql

from planaveg_core.banco import PAPEL_LEITURA
from planaveg_core.conferencia.base import Contexto, Verificacao
from planaveg_core.publicacao import nome_espacial

if TYPE_CHECKING:
    pass


def papel_leitura(ctx: Contexto) -> Verificacao:
    """O papel do GeoServer lê exatamente o publicado: as views publicadas e a tabela de chaves.
    Tudo mora em public, e a fronteira é a permissão de cada objeto: qualquer outra tabela ou view
    legível reprova, mesmo uma que ninguém lembrou de proteger. Ficam de fora os objetos das
    extensões, como os catálogos do PostGIS, que o PostGIS deixa legíveis a todos."""
    publicadas = {v.nome for v in ctx.geradas if v.publicada}
    esperadas = publicadas | {"gt_pk_metadata"}
    legiveis = {
        str(nome)
        for (nome,) in ctx.con.execute(
            """
            SELECT c.relname FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
            WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
              AND NOT EXISTS (SELECT 1 FROM pg_depend d
                              WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid
                                AND d.deptype = 'e')
              AND has_table_privilege(%s, c.oid, 'SELECT')
            """,
            (PAPEL_LEITURA,),
        ).fetchall()
    }
    sem_leitura = sorted(esperadas - legiveis)
    a_mais = sorted(legiveis - esperadas)
    return Verificacao(
        "papel_leitura_so_publicado",
        bool(publicadas) and not sem_leitura and not a_mais,
        f"publicadas={len(publicadas)} sem_leitura={sem_leitura[:3]} legiveis_a_mais={a_mais}",
    )


def _camadas(ctx: Contexto) -> list[str]:
    return [v.nome for v in ctx.geradas if v.camada_de_mapa]


def fid_unico(ctx: Contexto) -> Verificacao:
    """O `fid` é único em cada camada de mapa. Uma camada que não existe (um filtro espacial
    novo sem `init-db`) é reprovada aqui pelo nome, e não derruba as conferências seguintes."""
    duplicadas: list[str] = []
    faltam: list[str] = []
    camadas = _camadas(ctx)
    for nome in camadas:
        existe = ctx.con.execute("SELECT to_regclass(%s) IS NOT NULL", (nome,)).fetchone()
        if not (existe and existe[0]):
            faltam.append(nome)
            continue
        linha = ctx.con.execute(
            sql.SQL("SELECT count(*) - count(DISTINCT fid) FROM {}").format(sql.Identifier(nome))
        ).fetchone()
        if linha is not None and int(linha[0]) != 0:
            duplicadas.append(nome)
    detalhe = [f"camadas={len(camadas)}"]
    if duplicadas:
        detalhe.append(f"duplicadas={duplicadas}")
    if faltam:
        detalhe.append(f"faltam={faltam[:3]}")
    return Verificacao(
        "fid_unico_por_camada",
        bool(camadas) and not duplicadas and not faltam,
        " ".join(detalhe),
    )


def views_espaciais(ctx: Contexto) -> Verificacao:
    """Cada filtro espacial do contrato tem a sua camada em cada ano de VS."""
    esperadas = {
        nome_espacial(f, c.ano_vs)
        for f in ctx.contrato.filtros
        if f.espacial
        for c in ctx.contrato.camadas
    }
    existentes = {
        str(r[0])
        for r in ctx.con.execute(
            "SELECT f_table_name FROM geometry_columns WHERE f_table_schema = 'public'"
        ).fetchall()
    }
    faltam = sorted(esperadas - existentes)
    return Verificacao(
        "filtros_espaciais_publicados",
        not faltam,
        f"{len(esperadas) - len(faltam)}/{len(esperadas)}"
        + (f" faltam={faltam}" if faltam else ""),
    )


def gt_pk_metadata(ctx: Contexto) -> Verificacao:
    """Toda camada de mapa publicada tem `fid` declarado como chave para o GeoServer."""
    camadas = _camadas(ctx)
    declaradas = {
        str(r[0])
        for r in ctx.con.execute(
            "SELECT table_name FROM gt_pk_metadata "
            "WHERE table_schema = 'public' AND pk_column = 'fid'"
        ).fetchall()
    }
    faltam = sorted(set(camadas) - declaradas)
    return Verificacao(
        "gt_pk_metadata_cobre_camadas",
        bool(camadas) and not faltam,
        f"{len(camadas) - len(faltam)}/{len(camadas)}"
        + (f" faltam={faltam[:3]}" if faltam else ""),
    )
