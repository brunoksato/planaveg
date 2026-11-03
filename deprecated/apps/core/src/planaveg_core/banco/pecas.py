"""O SQL da carga das peças: a tabela de pouso, que recebe cada lote lido do GeoPackage, as
conferências do lote, os lugares e o cômputo que ele traz e o INSERT da peça, das marcas e do
desenho, com as geometrias do mapa.

O pouso tem as colunas do arquivo que o modelo guarda em lugar próprio (`ATRIBUTOS`, do
contrato), na ordem delas, as marcas da peça numa lista e o WKB. Uma marca nova no contrato não
muda nada aqui.
"""

from __future__ import annotations

from psycopg import sql

TOLERANCIA_ALTA = 0.0001
"""A tolerância da geometria simplificada do mapa (graus de EPSG:4674): ~11 m, abaixo do pixel
até o zoom 13. Sem remover partes, as faixas finas de APP ficam em todo zoom."""

TOLERANCIA_HA = 0.01
"""A folga das comparações de hectares: na carga, quanto o cômputo de um nível pode variar entre
as peças dele (o arquivo o repete em cada uma, e o banco guarda um só, `computo_recebido`); no
`verify`, as somas e as áreas."""

POUSO = sql.SQL(
    """CREATE TEMP TABLE pouso (
    origem_id bigint,
    hierarquia text,
    tier integer,
    categoria text,
    computo_recebido_ha double precision,
    area_ha double precision,
    uf text,
    bioma text,
    municipio text,
    cod_municipio text,
    bacia text,
    bacia_meso text,
    regiao_hidrografica text,
    sobreposicao text,
    marcas text[],
    geom_wkb bytea
)"""
)
"""A tabela temporária onde a carga copia (`COPY`) cada lote: o fid de origem, as colunas do
modelo, as marcas que a peça tem e a geometria em WKB, nesta ordem. A UF e o bioma chegam NULL
quando o arquivo diz que a peça cai fora dos limites oficiais."""

CONFERENCIAS = (
    (
        "hierarquia_fora_do_contrato",
        """
        SELECT DISTINCT p.hierarquia FROM pg_temp.pouso p
        WHERE NOT EXISTS (SELECT 1 FROM contrato_hierarquia h WHERE h.hierarquia = p.hierarquia)
        LIMIT 3
        """,
    ),
    (
        "hierarquia_diverge_do_tier",
        """
        SELECT DISTINCT p.hierarquia || ': tier ' || p.tier || ', categoria '
               || coalesce(p.categoria, '-')
        FROM pg_temp.pouso p
        JOIN contrato_hierarquia h ON h.hierarquia = p.hierarquia
        WHERE (h.tier, h.categoria) IS DISTINCT FROM (p.tier, p.categoria)
        LIMIT 3
        """,
    ),
    (
        "municipio_fora_do_ibge",
        """
        SELECT DISTINCT p.cod_municipio FROM pg_temp.pouso p
        WHERE NOT EXISTS (SELECT 1 FROM lugar_municipio m WHERE m.codigo = p.cod_municipio)
        LIMIT 3
        """,
    ),
    (
        "uf_fora_da_lista",
        """
        SELECT DISTINCT p.uf FROM pg_temp.pouso p
        WHERE p.uf IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM lugar_uf u WHERE u.sigla = p.uf)
        LIMIT 3
        """,
    ),
    (
        "bioma_fora_da_lista",
        """
        SELECT DISTINCT p.bioma FROM pg_temp.pouso p
        WHERE p.bioma IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM lugar_bioma b WHERE b.nome = p.bioma)
        LIMIT 3
        """,
    ),
    (
        "mesobacia_em_duas_regioes",
        """
        SELECT bacia_meso FROM pg_temp.pouso
        GROUP BY bacia_meso HAVING count(DISTINCT regiao_hidrografica) > 1
        LIMIT 3
        """,
    ),
)
"""O que faz a carga parar, com o código do erro e a consulta que acha os casos (até três). As
chaves estrangeiras também os recusariam: a conferência antes diz qual."""

LUGARES = (
    """
    INSERT INTO lugar_regiao_hidrografica (nome)
    SELECT DISTINCT regiao_hidrografica FROM pg_temp.pouso
    ON CONFLICT DO NOTHING
    """,
    """
    INSERT INTO lugar_mesobacia (nome, regiao_hidrografica)
    SELECT DISTINCT bacia_meso, regiao_hidrografica FROM pg_temp.pouso
    ON CONFLICT DO NOTHING
    """,
    """
    INSERT INTO lugar_bacia (mesobacia, nome)
    SELECT DISTINCT bacia_meso, bacia FROM pg_temp.pouso
    ON CONFLICT DO NOTHING
    """,
)
"""As bacias do lote, como o arquivo as nomeia. Uma mesobacia que um lote anterior pôs noutra
região é achada logo depois (`MESOBACIA_EM_OUTRA_REGIAO`)."""

MESOBACIA_EM_OUTRA_REGIAO = """
SELECT DISTINCT p.bacia_meso FROM pg_temp.pouso p
JOIN lugar_mesobacia m ON m.nome = p.bacia_meso
WHERE m.regiao_hidrografica <> p.regiao_hidrografica
LIMIT 3
"""

_COMPUTO = """
INSERT INTO computo_recebido (entrega_id, ano_vs, hierarquia, area_ha)
SELECT DISTINCT ON (hierarquia) {entrega}, {ano}, hierarquia, computo_recebido_ha
FROM pg_temp.pouso
ORDER BY hierarquia, computo_recebido_ha
ON CONFLICT DO NOTHING
"""

_COMPUTO_DIVERGENTE = """
SELECT DISTINCT p.hierarquia FROM pg_temp.pouso p
JOIN computo_recebido c
  ON c.entrega_id = {entrega} AND c.ano_vs = {ano} AND c.hierarquia = p.hierarquia
WHERE abs(c.area_ha - p.computo_recebido_ha) > {tolerancia}
LIMIT 3
"""

NOMES_DE_MUNICIPIO = """
SELECT DISTINCT p.cod_municipio, p.municipio, m.nome FROM pg_temp.pouso p
JOIN lugar_municipio m ON m.codigo = p.cod_municipio
WHERE p.municipio IS DISTINCT FROM m.nome
"""
"""Os municípios cujo nome no arquivo não é o do IBGE: só um aviso. O nome publicado é o do
IBGE."""

_INSERIR_PECAS = """WITH lida AS (
    SELECT p.*, g
    FROM pg_temp.pouso p
    CROSS JOIN LATERAL geom_de_origem(p.geom_wkb, 100000) AS g
    WHERE g IS NOT NULL
),
recebida AS (
    INSERT INTO peca_recebida (
        entrega_id, ano_vs, origem_id, hierarquia, area_ha, uf, bioma, cod_municipio,
        bacia_meso, bacia, sobreposicao
    )
    SELECT {entrega}, {ano}, origem_id, hierarquia, area_ha, uf, bioma, cod_municipio,
           bacia_meso, bacia, sobreposicao
    FROM lida
),
marcada AS (
    INSERT INTO peca_marca (entrega_id, ano_vs, origem_id, marca)
    SELECT {entrega}, {ano}, l.origem_id, m.marca
    FROM lida l
    CROSS JOIN unnest(l.marcas) AS m(marca)
)
INSERT INTO peca_geometria (
    entrega_id, ano_vs, origem_id, geom_albers, geom, geom_alta, ponto, area_calculada_ha, partes
)
SELECT {entrega}, {ano}, origem_id, g, m.g4674,
    CASE WHEN ST_IsEmpty(s.alta) THEN NULL ELSE s.alta END,
    ST_Transform(ST_Centroid(g), 4674),
    round((ST_Area(g) / 10000.0)::numeric, 8),
    ST_NumGeometries(g)
FROM lida
CROSS JOIN LATERAL (SELECT ST_Transform(g, 4674) AS g4674) AS m
CROSS JOIN LATERAL (SELECT ST_Multi(ST_Simplify(m.g4674, {simplificacao}, true)) AS alta) AS s"""

TABELAS_DA_CARGA = (
    "peca_marca",
    "peca_geometria",
    "computo_recebido",
    "peca_recebida",
    "lugar_bacia",
    "lugar_mesobacia",
    "lugar_regiao_hidrografica",
)
"""O que a carga refaz do arquivo, das que apontam para as outras às apontadas. A carga as esvazia
com DELETE, e não TRUNCATE: quem lê continua vendo a base anterior até o commit."""


def lista_da_carga() -> sql.Composed:
    """As tabelas da carga separadas por vírgula, para o ANALYZE, o VACUUM e o TRUNCATE do
    `init-db --recreate`."""
    return sql.SQL(", ").join(sql.Identifier(t) for t in TABELAS_DA_CARGA)


def computo(entrega: sql.Composable, ano: sql.Composable) -> sql.Composed:
    """Guarda o cômputo de cada linha da hierarquia que o lote traz (o primeiro lote que a traz
    decide); `computo_divergente` acha as que vêm com outro valor."""
    return sql.SQL(_COMPUTO).format(entrega=entrega, ano=ano)


def computo_divergente(entrega: sql.Composable, ano: sql.Composable) -> sql.Composed:
    return sql.SQL(_COMPUTO_DIVERGENTE).format(
        entrega=entrega, ano=ano, tolerancia=sql.Literal(TOLERANCIA_HA)
    )


def insercao_das_pecas(entrega: sql.Composable, ano: sql.Composable) -> sql.Composed:
    """O INSERT de um lote do pouso nas três tabelas da peça, numa sentença só: a geometria
    recebida é lida uma vez (`lida`), a peça vai a `peca_recebida`, cada marca a `peca_marca` e o
    desenho a `peca_geometria`, com a cópia em EPSG:4674, a simplificada do mapa, o centroide, a
    área e os polígonos. Nada é reparado, e a geometria vazia não entra em tabela nenhuma. A
    entrega e o ano são os parâmetros: marcadores do psycopg na carga e `$1` e `$2` na
    modelagem."""
    return sql.SQL(_INSERIR_PECAS).format(
        entrega=entrega, ano=ano, simplificacao=sql.Literal(TOLERANCIA_ALTA)
    )
