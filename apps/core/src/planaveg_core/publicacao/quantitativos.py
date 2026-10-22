"""Os quantitativos prontos: por nível, por categoria, por arranjo, por filtro, por lugar e a
série.

Os anos vêm de `contrato_ano` e cruzam a tabela do contrato, para o que não tem peça sair com
zero. O por nível lê as peças e o cômputo recebido, porque ele e a área calculada não estão nas
facetas; o por
categoria soma o por nível como a planilha de nomenclatura; os outros somam as facetas
(`facetas.py`), que já têm uma linha por combinação de atributos.
"""

from __future__ import annotations

from psycopg import sql

from planaveg_core.publicacao.nomes import View


def quantitativo_nivel() -> View:
    corpo = sql.SQL(
        """
        SELECT a.ano_vs, n.tier, n.nivel, n.grupo, h.hierarquia, h.categoria,
               c.situacao AS situacao_cadastro, n.titulo,
               n.motivo_ausencia IS NULL AS presente, n.cor, count(p.origem_id) AS n_pecas,
               coalesce(sum(p.area_ha), 0) AS area_ha,
               (SELECT k.area_ha FROM computo_recebido k
                JOIN entrega e ON e.id = k.entrega_id AND e.estado = 'pronta'
                WHERE k.ano_vs = a.ano_vs AND k.hierarquia = h.hierarquia) AS computo_recebido_ha,
               coalesce(sum(p.area_calculada_ha), 0) AS area_calculada_ha
        FROM contrato_ano a
        CROSS JOIN contrato_nivel n
        -- Uma linha por rótulo de hierarquia do nível; o nível ausente fica com uma, sem rótulo.
        LEFT JOIN contrato_hierarquia h ON h.tier = n.tier
        LEFT JOIN contrato_condicao_car c ON c.categoria = h.categoria
        LEFT JOIN peca_classificada p ON p.ano_vs = a.ano_vs AND p.hierarquia = h.hierarquia
        GROUP BY a.ano_vs, n.tier, h.hierarquia, c.categoria
        """
    )
    return View(
        "quantitativo_nivel",
        corpo,
        "Cômputo Planaveg por nível | Hectares por ano de VS e linha da hierarquia (tier, "
        "nível e condição do CAR como a base a nomeia, com a situação do cadastro da planilha "
        "de nomenclatura), com o cômputo recebido e a área medida na geometria. presente = "
        "false: nível que o arquivo não materializa.",
        materializada=True,
        publicada=True,
        chave=("ano_vs", "tier", "categoria"),
    )


def quantitativo_categoria() -> View:
    """O cômputo como a planilha de nomenclatura o organiza: as condições da base nos níveis do
    CAR (`categoria`) juntas nas duas situações do cadastro dela."""
    corpo = sql.SQL(
        """
        SELECT q.ano_vs, q.grupo, g.titulo AS grupo_titulo, q.tier, q.nivel, q.titulo,
               q.situacao_cadastro, q.presente, sum(q.n_pecas) AS n_pecas,
               sum(q.area_ha) AS area_ha
        FROM quantitativo_nivel q
        JOIN contrato_grupo g ON g.grupo = q.grupo
        GROUP BY q.ano_vs, q.grupo, g.titulo, q.tier, q.nivel, q.titulo, q.situacao_cadastro,
                 q.presente
        """
    )
    return View(
        "quantitativo_categoria",
        corpo,
        "Cômputo Planaveg por categoria | Hectares por ano de VS, categoria e situação do "
        "cadastro no CAR, como na planilha de nomenclatura do SINAVEG. situacao_cadastro NULL = "
        "categoria fora do CAR. presente = false: categoria que o arquivo não materializa.",
        materializada=True,
        publicada=True,
        chave=("ano_vs", "tier", "situacao_cadastro"),
    )


def quantitativo_arranjo() -> View:
    corpo = sql.SQL(
        """
        SELECT a.ano_vs, r.prioridade, r.arranjo, r.titulo, r.cor, f.nivel,
               coalesce(sum(f.n_pecas), 0) AS n_pecas, coalesce(sum(f.area_ha), 0) AS area_ha
        FROM contrato_ano a
        CROSS JOIN contrato_arranjo r
        LEFT JOIN quantitativo_faceta f ON f.ano_vs = a.ano_vs AND f.arranjo = r.arranjo
        GROUP BY GROUPING SETS (
            (a.ano_vs, r.prioridade, r.arranjo, r.titulo, r.cor),
            (a.ano_vs, r.prioridade, r.arranjo, r.titulo, r.cor, f.nivel)
        )
        HAVING NOT (GROUPING(f.nivel) = 0 AND f.nivel IS NULL)
        """
    )
    return View(
        "quantitativo_arranjo",
        corpo,
        "Arranjos de implementação | Hectares por ano de VS e arranjo (Anexo 2). nivel NULL "
        "= total do arranjo; preenchido = parte do arranjo vinda daquele nível. Os arranjos "
        "particionam as peças: a soma dos totais é o cômputo do ano.",
        materializada=True,
        publicada=True,
        chave=("ano_vs", "arranjo", "nivel"),
    )


def quantitativo_filtro() -> View:
    corpo = sql.SQL(
        """
        WITH f AS (
            -- Uma linha por faceta e filtro que ela atende.
            SELECT q.ano_vs, t.filtro, q.nivel, q.n_pecas, q.area_ha
            FROM quantitativo_faceta q
            CROSS JOIN unnest(string_to_array(q.temas, ',')) AS t(filtro)
        )
        SELECT a.ano_vs, c.filtro, c.grupo, c.titulo, c.tipo, c.status, c.cor, f.nivel,
               coalesce(sum(f.n_pecas), 0) AS n_pecas, coalesce(sum(f.area_ha), 0) AS area_ha
        FROM contrato_ano a
        CROSS JOIN contrato_filtro c
        LEFT JOIN f ON f.ano_vs = a.ano_vs AND f.filtro = c.filtro
        GROUP BY GROUPING SETS (
            (a.ano_vs, c.filtro, c.grupo, c.titulo, c.tipo, c.status, c.cor),
            (a.ano_vs, c.filtro, c.grupo, c.titulo, c.tipo, c.status, c.cor, f.nivel)
        )
        -- Uma faceta sem nível cairia na linha do total do filtro: fica só no total.
        HAVING NOT (GROUPING(f.nivel) = 0 AND f.nivel IS NULL)
        """
    )
    return View(
        "quantitativo_filtro",
        corpo,
        "Filtros quantitativos | Hectares das peças que atendem cada filtro do relatório, por "
        "ano de VS (nivel NULL = total do filtro; preenchido = parte vinda daquele nível). "
        "Filtros são marcas e se sobrepõem: não some filtros diferentes.",
        materializada=True,
        publicada=True,
        chave=("ano_vs", "filtro", "nivel"),
    )


def quantitativo_dimensao() -> View:
    # Uma faceta sem nível (ou sem arranjo) cairia na linha do total do valor, que também tem
    # nível e arranjo NULL: fica só no total.
    corpo = sql.SQL(
        """
        SELECT ano_vs, dimensao, chave, rotulo, normalizar_busca(rotulo) AS busca, nivel,
               arranjo, sum(n_pecas) AS n_pecas, sum(n_poligonos)::integer AS n_poligonos,
               sum(area_ha) AS area_ha
        FROM quantitativo_faceta_lugar
        GROUP BY GROUPING SETS (
            (ano_vs, dimensao, chave, rotulo),
            (ano_vs, dimensao, chave, rotulo, nivel),
            (ano_vs, dimensao, chave, rotulo, arranjo)
        )
        HAVING NOT (GROUPING(nivel) = 0 AND nivel IS NULL)
           AND NOT (GROUPING(arranjo) = 0 AND arranjo IS NULL)
        """
    )
    return View(
        "quantitativo_dimensao",
        corpo,
        "Limites administrativos e ecológicos | Peças, polígonos e hectares por ano de VS e "
        "valor de cada dimensão (UF, município, bacias, bioma). nivel e arranjo NULL = total do "
        "valor; um deles preenchido = recorte por nível ou por arranjo. chave NULL = peça sem o "
        "atributo. busca é o rótulo como a busca pelo nome o compara: sem acento, em "
        "minúsculas, só com letras, dígitos, espaço, hífen e apóstrofo.",
        materializada=True,
        publicada=True,
        chave=("ano_vs", "dimensao", "chave", "nivel", "arranjo"),
    )


def serie() -> View:
    corpo = sql.SQL(
        """
        WITH n AS MATERIALIZED (SELECT * FROM quantitativo_nivel),
        r AS (
            SELECT 'total'::text AS recorte, 'total'::text AS chave, 'Cômputo Planaveg'::text
                   AS rotulo, ano_vs, sum(area_ha) AS area_ha
            FROM n GROUP BY ano_vs
            UNION ALL
            SELECT 'nivel', nivel, titulo, ano_vs, sum(area_ha)
            FROM n GROUP BY nivel, titulo, ano_vs
            UNION ALL
            SELECT 'arranjo', arranjo, titulo, ano_vs, area_ha
            FROM quantitativo_arranjo WHERE nivel IS NULL
            UNION ALL
            SELECT 'filtro', filtro, titulo, ano_vs, area_ha
            FROM quantitativo_filtro WHERE nivel IS NULL
            UNION ALL
            SELECT dimensao, chave, rotulo, ano_vs, area_ha
            FROM quantitativo_dimensao WHERE nivel IS NULL AND arranjo IS NULL
        )
        SELECT recorte, chave, rotulo, ano_vs, area_ha,
               lag(ano_vs) OVER w AS ano_vs_anterior,
               lag(area_ha) OVER w AS area_ha_anterior,
               area_ha - lag(area_ha) OVER w AS diferenca_ha
        FROM r
        WINDOW w AS (PARTITION BY recorte, chave ORDER BY ano_vs)
        """
    )
    return View(
        "serie",
        corpo,
        "Série por ano de VS | Cada recorte quantitativo (total, nível, arranjo, filtro e "
        "valor de dimensão) em cada ano de VS, com a diferença para o ano anterior. Anos são "
        "retratos: compare, não some.",
        materializada=True,
        publicada=True,
        chave=("recorte", "chave", "ano_vs"),
    )
