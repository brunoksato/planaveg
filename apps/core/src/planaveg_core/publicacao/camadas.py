"""`catalogo_camada`: cada camada publicada, com o estilo, o número de feições, os hectares e a
extensão. As camadas vêm de `camada_publicada`, que o `init-db` preenche da lista das views.
"""

from __future__ import annotations

from psycopg import sql

from planaveg_core.contrato import Contrato
from planaveg_core.publicacao.nomes import View, nome_espacial, nome_peca_ano


def catalogo_camada() -> View:
    """Uma linha por camada de mapa, com o filtro, o ano, o estilo e a extensão medida."""
    corpo = sql.SQL(
        """
        WITH pecas AS MATERIALIZED (
            SELECT ano_vs, temas, area_ha, Box2D(geom) AS caixa FROM peca_desenhada
        ),
        extensao AS (
            -- As peças de todos os anos, as de cada ano e as que atendem cada filtro espacial.
            SELECT c.camada, ST_Extent(p.caixa::geometry) AS e, count(*) AS n_feicoes,
                   sum(p.area_ha) AS area_ha
            FROM camada_publicada c
            JOIN pecas p ON (c.ano_vs IS NULL OR p.ano_vs = c.ano_vs)
                        AND (c.filtro IS NULL OR c.filtro = ANY (p.temas))
            WHERE c.tipo IN ('peca', 'espacial')
            GROUP BY c.camada
            UNION ALL
            SELECT 'municipio', ST_Extent(geom), count(*), NULL FROM municipio
        )
        SELECT c.ordem, c.camada, c.tipo, c.filtro, c.ano_vs, c.titulo, f.grupo, f.status,
               f.nota, f.cor, c.estilo,
               nullif(array_to_string(c.estilos_alternativos, ','), '') AS estilos_alternativos,
               coalesce(x.n_feicoes, 0) AS n_feicoes, x.area_ha,
               ST_XMin(x.e) AS minx, ST_YMin(x.e) AS miny, ST_XMax(x.e) AS maxx,
               ST_YMax(x.e) AS maxy
        FROM camada_publicada c
        LEFT JOIN contrato_filtro f ON f.filtro = c.filtro
        LEFT JOIN extensao x ON x.camada = c.camada
        """
    )
    return View(
        "catalogo_camada",
        corpo,
        "Catálogo de camadas de mapa | Cada camada publicada (peças por ano, filtros "
        "espaciais por ano, municípios), com filtro, ano de VS, estilo padrão, estilos "
        "alternativos, número de feições, hectares e extensão em EPSG:4674.",
        materializada=True,
        publicada=True,
        chave=("camada",),
    )


def camadas_publicadas(contrato: Contrato, geradas: list[View]) -> list[tuple[object, ...]]:
    """As linhas de `camada_publicada`: (camada, ordem, tipo, filtro, ano_vs, titulo, estilo,
    estilos_alternativos) de cada camada de mapa, na ordem de criação. A consulta com parâmetros
    (`peca_parte`) não é desenhada e fica de fora."""
    anos = [c.ano_vs for c in contrato.camadas]
    # O nome de cada camada gerada → (tipo, filtro, ano_vs).
    tipos: dict[str, tuple[str, str | None, int | None]] = {
        "peca": ("peca", None, None),
        "municipio": ("municipio", None, None),
        **{nome_peca_ano(ano): ("peca", None, ano) for ano in anos},
        **{
            nome_espacial(f, ano): ("espacial", f.codigo, ano)
            for f in contrato.filtros
            if f.espacial
            for ano in anos
        },
    }
    camadas = [v for v in geradas if v.camada_de_mapa]
    return [
        (
            view.nome,
            ordem,
            *tipos[view.nome],
            view.titulo,
            view.estilos[0],
            list(view.estilos[1:]),
        )
        for ordem, view in enumerate(camadas, 1)
    ]
