"""`status`: a entrega, as contagens, o cômputo, os arranjos, os filtros e as execuções."""

from __future__ import annotations

import argparse

import psycopg

from planaveg_core import banco, etapas
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato


def _imprimir_quantitativos(con: psycopg.Connection) -> None:
    """Cômputo por nível, arranjos e filtros de cada ano, e a diferença entre os anos."""
    niveis = con.execute(
        """
        SELECT ano_vs, min(tier), nivel, bool_and(presente), sum(n_pecas), sum(area_ha)
        FROM quantitativo_nivel
        GROUP BY ano_vs, nivel ORDER BY ano_vs, 2
        """
    ).fetchall()
    if not niveis:
        print("sem pecas carregadas: rode planaveg-core load")
        return
    ano_atual = None
    for ano, tier, nivel, presente, n, area in niveis:
        if ano != ano_atual:
            print(f"computo por nivel, ano_vs={ano} (ha):")
            ano_atual = ano
        marca = "" if presente else "  (ausente no arquivo)"
        print(f"  {tier:>2} {nivel:22} pecas={n:<7} ha={area:>16.4f}{marca}")
    print("arranjos (ha):")
    for ano, arranjo, n, area in con.execute(
        """
        SELECT ano_vs, arranjo, n_pecas, area_ha FROM quantitativo_arranjo
        WHERE nivel IS NULL ORDER BY ano_vs, prioridade
        """
    ).fetchall():
        print(f"  {ano} {arranjo:22} pecas={n:<7} ha={area:>16.4f}")
    print("filtros (ha; se sobrepoem, nao some):")
    for ano, filtro, status, n, area in con.execute(
        """
        SELECT ano_vs, filtro, status, n_pecas, area_ha FROM quantitativo_filtro
        WHERE nivel IS NULL ORDER BY filtro, ano_vs
        """
    ).fetchall():
        print(f"  {ano} {filtro:28} {status:8} pecas={n:<7} ha={area:>16.4f}")
    print("serie (total por ano de VS, ha):")
    for ano, area, anterior, dif in con.execute(
        """
        SELECT ano_vs, area_ha, ano_vs_anterior, diferenca_ha FROM serie
        WHERE recorte = 'total' ORDER BY ano_vs
        """
    ).fetchall():
        variacao = "" if dif is None else f" dif_vs_{anterior}={dif:+.4f}"
        print(f"  {ano} total={area:.4f}{variacao}")


def cmd_status(settings: Settings, _args: argparse.Namespace) -> int:
    contrato = carregar_contrato(settings.contract_path)
    with banco.conectar(settings) as con:
        entrega = con.execute(
            """
            SELECT id, nome_arquivo, sha256, tamanho_bytes, estado, concluida_em
            FROM entrega
            ORDER BY (estado = 'pronta') DESC, iniciada_em DESC
            LIMIT 1
            """
        ).fetchone()
        if entrega is None:
            print("nenhuma entrega carregada")
            return EXIT_OK
        entrega_id, arquivo, sha256, tamanho, estado, concluida = entrega
        print(f"entrega_id={entrega_id} estado={estado}")
        print(f"arquivo={arquivo} bytes={tamanho}")
        print(f"sha256={sha256}")
        print(f"concluida_em={concluida}")
        for origem, c in sorted((banco.contagens_da_carga(con, entrega_id) or {}).items()):
            anulados = ", ".join(f"{k}: {v}" for k, v in sorted(c["anulados"].items()))
            extra = f" anulados=({anulados})" if anulados else ""
            print(
                f"  {origem:40} ano_vs={c['ano_vs']} gpkg={c['gpkg']} "
                f"carregados={c['carregados']} rejeitados={c['rejeitados']}{extra}"
            )
        _imprimir_quantitativos(con)
        print("execucoes recentes:")
        for etapa, ok, dur, fim in con.execute(
            """
            SELECT DISTINCT ON (etapa) etapa, ok, detalhe->>'duracao_s', concluida_em
            FROM execucao
            WHERE etapa = ANY(%s)
            ORDER BY etapa, iniciada_em DESC
            """,
            (list(etapas.REGISTRADAS),),
        ).fetchall():
            print(f"  {etapa:10} ok={ok!s:5} duracao_s={dur} em {fim}")
    print("fontes ausentes neste geopackage:")
    for fonte in contrato.fontes_ausentes:
        print(f"  {fonte.codigo}: {fonte.descricao}")
    return EXIT_OK
