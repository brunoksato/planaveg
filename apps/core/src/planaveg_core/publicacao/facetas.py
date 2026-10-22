"""As facetas: as somas por combinação de atributos, do Brasil e de cada lugar, que o portal
soma no navegador. Os quantitativos por arranjo, por filtro e por lugar somam as facetas.

Os filtros (`temas`) e a esfera e o tipo das UCs vêm de `peca_classificada` como listas, e as
facetas os publicam em texto, separados por vírgula ('' = nenhum).
"""

from __future__ import annotations

from psycopg import sql

from planaveg_core.publicacao.nomes import View

# Uma linha de faceta: o ano e a combinação de atributos (o GROUP BY das facetas).
CHAVE_FACETA = (
    "ano_vs",
    "nivel",
    "categoria",
    "arranjo",
    "uf",
    "bioma",
    "temas",
    "esferas_uc",
    "tipos_uc",
)


def quantitativo_faceta() -> View:
    corpo = sql.SQL(
        """
        SELECT p.ano_vs, p.nivel, p.categoria, p.arranjo, p.uf, p.bioma,
               array_to_string(p.temas, ',') AS temas,
               array_to_string(p.esferas_uc, ',') AS esferas_uc,
               array_to_string(p.tipos_uc, ',') AS tipos_uc,
               count(*)::integer AS n_pecas, sum(p.partes)::integer AS n_poligonos,
               sum(p.area_ha) AS area_ha
        FROM peca_classificada p
        GROUP BY p.ano_vs, p.nivel, p.categoria, p.arranjo, p.uf, p.bioma, p.temas,
                 p.esferas_uc, p.tipos_uc
        """
    )
    return View(
        "quantitativo_faceta",
        corpo,
        "Facetas das peças | Peças, polígonos e hectares por ano de VS e por combinação de "
        "nível, condição do CAR, arranjo, UF, bioma, filtros do relatório (temas) e esfera e "
        "tipo das Unidades de Conservação onde a peça está (esferas_uc: federal, estadual, "
        "municipal; tipos_uc: apa, rppn, outras), todos em códigos separados por vírgula. Cada "
        "peça junta os polígonos de mesmos atributos no município e na bacia: n_poligonos os "
        "conta. Some as linhas que atendem um filtro para ter os totais de qualquer "
        "combinação, como o portal faz.",
        materializada=True,
        publicada=True,
        chave=CHAVE_FACETA,
    )


def quantitativo_faceta_lugar() -> View:
    # Cada chave tem um rótulo só, então ele entra no agrupamento sem mudar as linhas.
    corpo = sql.SQL(
        """
        SELECT p.ano_vs, l.dimensao, l.chave, l.rotulo, p.nivel, p.categoria, p.arranjo, p.uf,
               p.bioma, array_to_string(p.temas, ',') AS temas,
               array_to_string(p.esferas_uc, ',') AS esferas_uc,
               array_to_string(p.tipos_uc, ',') AS tipos_uc,
               count(*)::integer AS n_pecas, sum(p.partes)::integer AS n_poligonos,
               sum(p.area_ha) AS area_ha
        FROM peca_classificada p
        JOIN peca_lugar l ON l.ano_vs = p.ano_vs AND l.origem_id = p.origem_id
        GROUP BY p.ano_vs, l.dimensao, l.chave, l.rotulo, p.nivel, p.categoria, p.arranjo, p.uf,
                 p.bioma, p.temas, p.esferas_uc, p.tipos_uc
        """
    )
    return View(
        "quantitativo_faceta_lugar",
        corpo,
        "Facetas por lugar | As facetas das peças (nível, condição do CAR, arranjo, UF, bioma, "
        "filtros do relatório e esfera e tipo das UCs, com peças, polígonos e hectares) de cada "
        "valor de dimensão (UF, município, bacias, região hidrográfica, bioma), com o rótulo "
        "dele, por ano de VS. Consulte um lugar por dimensao e chave e some as linhas que "
        "atendem um filtro, como o painel faz.",
        materializada=True,
        publicada=True,
        chave=("ano_vs", "dimensao", "chave", *CHAVE_FACETA[1:]),
    )
