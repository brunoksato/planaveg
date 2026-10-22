-- Gerado por `planaveg-core modelagem` do contrato 1.0.0: não edite à mão. Depois de 2_funcoes.sql.

CREATE MATERIALIZED VIEW peca_classificada AS
WITH marcada AS (
    -- As marcas de cada peça numa lista, na ordem do contrato.
    SELECT pm.entrega_id, pm.ano_vs, pm.origem_id,
           array_agg(pm.marca ORDER BY cm.ordem) AS marcas
    FROM peca_marca pm
    JOIN contrato_marca cm ON cm.marca = pm.marca
    GROUP BY pm.entrega_id, pm.ano_vs, pm.origem_id
),
recebida AS (
    -- A peça da entrega pronta, com o nível pelo rótulo, os lugares pelas referências e
    -- a UF e o bioma de quem cai fora dos limites com o valor que o arquivo usa.
    SELECT r.entrega_id, r.ano_vs, r.origem_id, r.hierarquia, h.tier, h.categoria,
           r.area_ha, coalesce(r.uf::text, 'FORA') AS uf,
           coalesce(r.bioma, 'FORA') AS bioma, m.nome AS municipio,
           r.cod_municipio::text AS cod_municipio, r.bacia, r.bacia_meso,
           b.regiao_hidrografica, r.sobreposicao, n.nivel, n.grupo,
           c.situacao AS situacao_cadastro,
           coalesce(k.marcas, ARRAY[]::text[]) AS marcas
    FROM peca_recebida r
    JOIN entrega e ON e.id = r.entrega_id AND e.estado = 'pronta'
    JOIN contrato_hierarquia h ON h.hierarquia = r.hierarquia
    JOIN contrato_nivel n ON n.tier = h.tier
    LEFT JOIN contrato_condicao_car c ON c.categoria = h.categoria
    JOIN lugar_municipio m ON m.codigo = r.cod_municipio
    JOIN lugar_mesobacia b ON b.nome = r.bacia_meso
    LEFT JOIN marcada k
      ON k.entrega_id = r.entrega_id AND k.ano_vs = r.ano_vs
     AND k.origem_id = r.origem_id
),
-- As condições de cada regra, com os valores numa lista.
condicao_arranjo AS (
    SELECT c.arranjo, c.alternativa, c.campo, c.negada, array_agg(v.valor) AS valores
    FROM contrato_arranjo_condicao c
    JOIN contrato_arranjo_valor v
      ON v.arranjo = c.arranjo AND v.alternativa = c.alternativa
     AND v.condicao = c.condicao
    GROUP BY c.arranjo, c.alternativa, c.condicao, c.campo, c.negada
),
condicao_filtro AS (
    SELECT c.filtro, c.alternativa, c.campo, c.negada, array_agg(v.valor) AS valores
    FROM contrato_filtro_condicao c
    JOIN contrato_filtro_valor v
      ON v.filtro = c.filtro AND v.alternativa = c.alternativa
     AND v.condicao = c.condicao
    GROUP BY c.filtro, c.alternativa, c.condicao, c.campo, c.negada
),
-- Uma regra vale para a peça se ela atende todas as condições de alguma alternativa.
arranjo_atendido AS (
    SELECT p.ano_vs, p.origem_id, a.prioridade, a.arranjo
    FROM recebida p
    CROSS JOIN condicao_arranjo c
    JOIN contrato_arranjo a ON a.arranjo = c.arranjo
    GROUP BY p.ano_vs, p.origem_id, a.prioridade, a.arranjo, c.alternativa
    HAVING bool_and(
        condicao_atendida(c.campo, c.valores, c.negada, p.nivel, NULL, p.marcas)
    )
),
-- A peça fica no arranjo de maior prioridade cuja regra ela atende; sem nenhum, no
-- complementar.
primeiro_arranjo AS (
    SELECT DISTINCT ON (ano_vs, origem_id) ano_vs, origem_id, arranjo
    FROM arranjo_atendido
    ORDER BY ano_vs, origem_id, prioridade
),
com_arranjo AS (
    SELECT p.*,
           coalesce(t.arranjo, (SELECT arranjo FROM contrato_arranjo WHERE complementar))
               AS arranjo
    FROM recebida p
    LEFT JOIN primeiro_arranjo t ON t.ano_vs = p.ano_vs AND t.origem_id = p.origem_id
),
filtro_atendido AS (
    SELECT DISTINCT p.ano_vs, p.origem_id, c.filtro
    FROM com_arranjo p
    CROSS JOIN condicao_filtro c
    GROUP BY p.ano_vs, p.origem_id, c.filtro, c.alternativa
    HAVING bool_and(
        condicao_atendida(c.campo, c.valores, c.negada, p.nivel, p.arranjo, p.marcas)
    )
),
-- Os filtros que a peça atende, na ordem do relatório.
temas AS (
    SELECT t.ano_vs, t.origem_id, array_agg(t.filtro ORDER BY f.ordem) AS temas
    FROM filtro_atendido t
    JOIN contrato_filtro f ON f.filtro = t.filtro
    GROUP BY t.ano_vs, t.origem_id
)
-- A peça inteira, menos o desenho: as colunas recebidas, uma por marca, as medidas e a
-- classificação.
SELECT p.entrega_id, p.ano_vs, p.origem_id, p.hierarquia, p.tier, p.categoria,
       p.area_ha, p.uf, p.bioma, p.municipio, p.cod_municipio, p.bacia, p.bacia_meso,
       p.regiao_hidrografica,
       'car' = ANY (p.marcas) AS car,
       'car_habilitado' = ANY (p.marcas) AS car_habilitado,
       'car_analisado' = ANY (p.marcas) AS car_analisado,
       'car_nao_analisado' = ANY (p.marcas) AS car_nao_analisado,
       'car_regularizacao' = ANY (p.marcas) AS car_regularizacao,
       'app_habilitado' = ANY (p.marcas) AS app_habilitado,
       'app_analisado' = ANY (p.marcas) AS app_analisado,
       'app_nao_analisado' = ANY (p.marcas) AS app_nao_analisado,
       'rl_habilitado' = ANY (p.marcas) AS rl_habilitado,
       'rl_analisado' = ANY (p.marcas) AS rl_analisado,
       'rl_nao_analisado' = ANY (p.marcas) AS rl_nao_analisado,
       'aur_habilitado' = ANY (p.marcas) AS aur_habilitado,
       'aur_analisado' = ANY (p.marcas) AS aur_analisado,
       'aur_nao_analisado' = ANY (p.marcas) AS aur_nao_analisado,
       'projeto' = ANY (p.marcas) AS projeto,
       'licenciamento' = ANY (p.marcas) AS licenciamento,
       'reparacao_danos' = ANY (p.marcas) AS reparacao_danos,
       'embargo' = ANY (p.marcas) AS embargo,
       'outras_areas' = ANY (p.marcas) AS outras_areas,
       'embargo_pangia' = ANY (p.marcas) AS embargo_pangia,
       'gef_terrestre' = ANY (p.marcas) AS gef_terrestre,
       'restauracao_ecologica' = ANY (p.marcas) AS restauracao_ecologica,
       'observatorio' = ANY (p.marcas) AS observatorio,
       'manguezal' = ANY (p.marcas) AS manguezal,
       'apa' = ANY (p.marcas) AS apa,
       'rppn' = ANY (p.marcas) AS rppn,
       'uc' = ANY (p.marcas) AS uc,
       'uc_federal' = ANY (p.marcas) AS uc_federal,
       'uc_estadual' = ANY (p.marcas) AS uc_estadual,
       'uc_municipal' = ANY (p.marcas) AS uc_municipal,
       'terra_indigena' = ANY (p.marcas) AS terra_indigena,
       'assentamento' = ANY (p.marcas) AS assentamento,
       'quilombola' = ANY (p.marcas) AS quilombola,
       p.sobreposicao, g.area_calculada_ha, g.partes, p.nivel, p.grupo, p.arranjo,
       p.situacao_cadastro, coalesce(t.temas, ARRAY[]::text[]) AS temas,
       array_remove(ARRAY[
           CASE WHEN 'uc_federal' = ANY (p.marcas) THEN 'federal' END,
           CASE WHEN 'uc_estadual' = ANY (p.marcas) THEN 'estadual' END,
           CASE WHEN 'uc_municipal' = ANY (p.marcas) THEN 'municipal' END
       ], NULL) AS esferas_uc,
       array_remove(ARRAY[
           CASE WHEN 'apa' = ANY (p.marcas) THEN 'apa' END,
           CASE WHEN 'rppn' = ANY (p.marcas) THEN 'rppn' END,
           CASE WHEN 'uc' = ANY (p.marcas) THEN 'outras' END
       ], NULL) AS tipos_uc,
       p.marcas
FROM com_arranjo p
JOIN peca_geometria g
  ON g.entrega_id = p.entrega_id AND g.ano_vs = p.ano_vs AND g.origem_id = p.origem_id
LEFT JOIN temas t ON t.ano_vs = p.ano_vs AND t.origem_id = p.origem_id
WITH NO DATA;

CREATE UNIQUE INDEX "peca_classificada_chave" ON "peca_classificada" ("ano_vs", "origem_id") NULLS NOT DISTINCT;

CREATE VIEW peca_desenhada AS
-- fid: ano_vs × 10⁹ + o fid do GeoPackage, para as peças de anos diferentes não colidirem.
SELECT g.ano_vs::bigint * 1000000000 + g.origem_id AS fid, c.*,
       g.geom, g.geom_alta, g.ponto
FROM peca_geometria g
JOIN peca_classificada c
  ON c.entrega_id = g.entrega_id AND c.ano_vs = g.ano_vs AND c.origem_id = g.origem_id;

CREATE VIEW peca_lugar AS
SELECT p.ano_vs, p.origem_id, l.dimensao, l.chave, l.rotulo
FROM peca_classificada p
JOIN lugar_municipio m ON m.codigo = p.cod_municipio
JOIN lugar_uf u ON u.codigo = m.uf
CROSS JOIN LATERAL (
    SELECT CASE WHEN p.bacia = p.bacia_meso THEN p.bacia
                ELSE p.bacia || ' (' || p.bacia_meso || ')' END AS bacia
) b
CROSS JOIN LATERAL (VALUES
    ('uf', p.uf, p.uf),
    ('municipio', p.cod_municipio, p.municipio || ' (' || u.sigla || ')'),
    ('bacia', b.bacia, b.bacia),
    ('bacia_meso', p.bacia_meso, p.bacia_meso),
    ('regiao_hidrografica', p.regiao_hidrografica, p.regiao_hidrografica),
    ('bioma', p.bioma, p.bioma)
) AS l(dimensao, chave, rotulo);

CREATE VIEW peca AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada;

CREATE VIEW peca_2022 AS
SELECT * FROM peca WHERE ano_vs = 2022;

CREATE VIEW peca_2024 AS
SELECT * FROM peca WHERE ano_vs = 2024;

CREATE VIEW espacial_embargo_recooperar_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'embargo_recooperar' = ANY (temas);

CREATE VIEW espacial_embargo_recooperar_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'embargo_recooperar' = ANY (temas);

CREATE VIEW espacial_reparacao_danos_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'reparacao_danos' = ANY (temas);

CREATE VIEW espacial_reparacao_danos_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'reparacao_danos' = ANY (temas);

CREATE VIEW espacial_licenciamento_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'licenciamento' = ANY (temas);

CREATE VIEW espacial_licenciamento_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'licenciamento' = ANY (temas);

CREATE VIEW espacial_outras_areas_projetos_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'outras_areas_projetos' = ANY (temas);

CREATE VIEW espacial_outras_areas_projetos_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'outras_areas_projetos' = ANY (temas);

CREATE VIEW espacial_unidade_conservacao_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'unidade_conservacao' = ANY (temas);

CREATE VIEW espacial_unidade_conservacao_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'unidade_conservacao' = ANY (temas);

CREATE VIEW espacial_terra_indigena_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'terra_indigena' = ANY (temas);

CREATE VIEW espacial_terra_indigena_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'terra_indigena' = ANY (temas);

CREATE VIEW espacial_arranjo_app_rl_aur_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'arranjo_app_rl_aur' = ANY (temas);

CREATE VIEW espacial_arranjo_app_rl_aur_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'arranjo_app_rl_aur' = ANY (temas);

CREATE VIEW espacial_arranjo_baixa_produtividade_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'arranjo_baixa_produtividade' = ANY (temas);

CREATE VIEW espacial_arranjo_baixa_produtividade_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'arranjo_baixa_produtividade' = ANY (temas);

CREATE VIEW espacial_arranjo_areas_publicas_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'arranjo_areas_publicas' = ANY (temas);

CREATE VIEW espacial_arranjo_areas_publicas_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'arranjo_areas_publicas' = ANY (temas);

CREATE VIEW espacial_manguezal_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'manguezal' = ANY (temas);

CREATE VIEW espacial_manguezal_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'manguezal' = ANY (temas);

CREATE VIEW espacial_assentamento_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'assentamento' = ANY (temas);

CREATE VIEW espacial_assentamento_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'assentamento' = ANY (temas);

CREATE VIEW espacial_quilombola_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'quilombola' = ANY (temas);

CREATE VIEW espacial_quilombola_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'quilombola' = ANY (temas);

CREATE VIEW espacial_car_2022 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2022 AND 'car' = ANY (temas);

CREATE VIEW espacial_car_2024 AS
SELECT fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       car, car_habilitado, car_analisado, car_nao_analisado, car_regularizacao, app_habilitado,
       app_analisado, app_nao_analisado, rl_habilitado, rl_analisado, rl_nao_analisado, aur_habilitado,
       aur_analisado, aur_nao_analisado, projeto, licenciamento, reparacao_danos, embargo,
       outras_areas, embargo_pangia, gef_terrestre, restauracao_ecologica, observatorio, manguezal,
       apa, rppn, uc, uc_federal, uc_estadual, uc_municipal,
       terra_indigena, assentamento, quilombola,
       sobreposicao,
       geom, geom_alta, ponto
FROM peca_desenhada
WHERE ano_vs = 2024 AND 'car' = ANY (temas);

CREATE MATERIALIZED VIEW municipio AS
SELECT m.codigo::bigint AS fid, m.codigo::text AS cod_municipio,
       m.nome AS municipio, u.sigla::text AS uf, m.nome || ' (' || u.sigla || ')' AS rotulo,
       normalizar_busca(m.nome || ' (' || u.sigla || ')') AS busca,
       ST_MakeEnvelope(ST_XMin(p.e), ST_YMin(p.e), ST_XMax(p.e), ST_YMax(p.e), 4674)
           ::geometry(Polygon, 4674) AS geom
FROM lugar_municipio m
JOIN lugar_uf u ON u.codigo = m.uf
JOIN (
    SELECT c.cod_municipio, ST_Extent(g.geom) AS e
    FROM peca_classificada c
    JOIN peca_geometria g
      ON g.entrega_id = c.entrega_id AND g.ano_vs = c.ano_vs
     AND g.origem_id = c.origem_id
    GROUP BY c.cod_municipio
) p ON p.cod_municipio = m.codigo::text
WITH NO DATA;

CREATE UNIQUE INDEX "municipio_chave" ON "municipio" ("cod_municipio") NULLS NOT DISTINCT;

CREATE VIEW peca_parte AS
-- fid: o da peça × 10⁶ + o número da parte (a maior peça tem 16.591 partes).
SELECT (p.ano_vs::bigint * 1000000000 + p.origem_id) * 1000000 + d.caminho[1] AS fid,
       p.ano_vs::bigint * 1000000000 + p.origem_id AS fid_peca, p.ano_vs, p.origem_id,
       d.caminho[1] AS parte, p.partes, ST_Area(d.geom_albers) / 10000.0 AS area_ha,
       d.geom::geometry(Polygon, 4674) AS geom
FROM peca_geometria p
JOIN entrega e ON e.id = p.entrega_id AND e.estado = 'pronta'
CROSS JOIN LATERAL ROWS FROM (ST_Dump(p.geom), ST_Dump(p.geom_albers))
    AS d(caminho, geom, caminho_albers, geom_albers);

CREATE MATERIALIZED VIEW quantitativo_faceta AS
SELECT p.ano_vs, p.nivel, p.categoria, p.arranjo, p.uf, p.bioma,
       array_to_string(p.temas, ',') AS temas,
       array_to_string(p.esferas_uc, ',') AS esferas_uc,
       array_to_string(p.tipos_uc, ',') AS tipos_uc,
       count(*)::integer AS n_pecas, sum(p.partes)::integer AS n_poligonos,
       sum(p.area_ha) AS area_ha
FROM peca_classificada p
GROUP BY p.ano_vs, p.nivel, p.categoria, p.arranjo, p.uf, p.bioma, p.temas,
         p.esferas_uc, p.tipos_uc
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_faceta_chave" ON "quantitativo_faceta" ("ano_vs", "nivel", "categoria", "arranjo", "uf", "bioma", "temas", "esferas_uc", "tipos_uc") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW quantitativo_faceta_lugar AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_faceta_lugar_chave" ON "quantitativo_faceta_lugar" ("ano_vs", "dimensao", "chave", "nivel", "categoria", "arranjo", "uf", "bioma", "temas", "esferas_uc", "tipos_uc") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW quantitativo_nivel AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_nivel_chave" ON "quantitativo_nivel" ("ano_vs", "tier", "categoria") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW quantitativo_categoria AS
SELECT q.ano_vs, q.grupo, g.titulo AS grupo_titulo, q.tier, q.nivel, q.titulo,
       q.situacao_cadastro, q.presente, sum(q.n_pecas) AS n_pecas,
       sum(q.area_ha) AS area_ha
FROM quantitativo_nivel q
JOIN contrato_grupo g ON g.grupo = q.grupo
GROUP BY q.ano_vs, q.grupo, g.titulo, q.tier, q.nivel, q.titulo, q.situacao_cadastro,
         q.presente
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_categoria_chave" ON "quantitativo_categoria" ("ano_vs", "tier", "situacao_cadastro") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW quantitativo_arranjo AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_arranjo_chave" ON "quantitativo_arranjo" ("ano_vs", "arranjo", "nivel") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW quantitativo_filtro AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_filtro_chave" ON "quantitativo_filtro" ("ano_vs", "filtro", "nivel") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW quantitativo_dimensao AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "quantitativo_dimensao_chave" ON "quantitativo_dimensao" ("ano_vs", "dimensao", "chave", "nivel", "arranjo") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW serie AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "serie_chave" ON "serie" ("recorte", "chave", "ano_vs") NULLS NOT DISTINCT;

CREATE MATERIALIZED VIEW catalogo_camada AS
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
WITH NO DATA;

CREATE UNIQUE INDEX "catalogo_camada_chave" ON "catalogo_camada" ("camada") NULLS NOT DISTINCT;

CREATE VIEW catalogo_ano AS
SELECT ano_vs, camada, rotulo FROM contrato_ano ORDER BY ano_vs;

CREATE VIEW catalogo_nivel AS
SELECT n.tier, n.nivel, n.grupo, g.titulo AS grupo_titulo, n.titulo,
       h.hierarquia, h.categoria, n.cor, n.motivo_ausencia IS NULL AS presente,
       n.motivo_ausencia
FROM contrato_nivel n
JOIN contrato_grupo g ON g.grupo = n.grupo
LEFT JOIN contrato_hierarquia h ON h.tier = n.tier
LEFT JOIN contrato_condicao_car c ON c.categoria = h.categoria
ORDER BY n.tier, c.ordem NULLS FIRST;

CREATE VIEW catalogo_arranjo AS
SELECT prioridade, arranjo, titulo, criterio, cor, meta_ha, meta_ano,
       motivo_ausencia
FROM contrato_arranjo
ORDER BY prioridade;

CREATE VIEW catalogo_filtro AS
SELECT ordem, filtro, grupo, titulo, subtitulo, tipo, espacial, status, nota, cor,
       cql, tema
FROM contrato_filtro
ORDER BY ordem;

CREATE VIEW catalogo_dimensao AS
SELECT ordem, dimensao, grupo, titulo FROM contrato_dimensao ORDER BY ordem;

CREATE VIEW fonte_ausente AS
SELECT codigo, grupo, descricao FROM contrato_fonte_ausente ORDER BY ordem;

CREATE VIEW fonte_vigente AS
WITH publicada AS (
    SELECT x.id, x.entrega_id, x.iniciada_em, x.detalhe
    FROM execucao x
    WHERE x.etapa = 'geoserver' AND x.ok
    ORDER BY x.iniciada_em DESC
    LIMIT 1
),
vigente AS (
    SELECT p.entrega_id, p.detalhe
    FROM publicada p
    WHERE NOT EXISTS (
        SELECT 1 FROM execucao y
        WHERE y.etapa IN ('init-db', 'load', 'geoserver')
          AND y.id <> p.id
          AND coalesce(y.concluida_em, y.iniciada_em) > p.iniciada_em
    )
)
SELECT e.nome_arquivo AS arquivo, e.sha256, e.tamanho_bytes,
       c.versao AS contrato, e.concluida_em,
       (SELECT sum(k.carregadas) FROM entrega_camada k
         WHERE k.entrega_id = e.id)::bigint AS pecas,
       v.detalhe->>'versao_mapa' AS versao_mapa,
       v.detalhe->>'versao_dados' AS versao_dados
FROM entrega e
JOIN contrato_versao c ON c.id = e.contrato_versao_id
LEFT JOIN vigente v ON v.entrega_id = e.id
WHERE e.estado = 'pronta';

INSERT INTO objeto_gerado (nome, tipo, ordem, publicada, espacial) VALUES
    ('peca_classificada', 'matview', 1, false, false),
    ('peca_desenhada', 'view', 2, false, false),
    ('peca_lugar', 'view', 3, false, false),
    ('peca', 'view', 4, true, true),
    ('peca_2022', 'view', 5, true, true),
    ('peca_2024', 'view', 6, true, true),
    ('espacial_embargo_recooperar_2022', 'view', 7, true, true),
    ('espacial_embargo_recooperar_2024', 'view', 8, true, true),
    ('espacial_reparacao_danos_2022', 'view', 9, true, true),
    ('espacial_reparacao_danos_2024', 'view', 10, true, true),
    ('espacial_licenciamento_2022', 'view', 11, true, true),
    ('espacial_licenciamento_2024', 'view', 12, true, true),
    ('espacial_outras_areas_projetos_2022', 'view', 13, true, true),
    ('espacial_outras_areas_projetos_2024', 'view', 14, true, true),
    ('espacial_unidade_conservacao_2022', 'view', 15, true, true),
    ('espacial_unidade_conservacao_2024', 'view', 16, true, true),
    ('espacial_terra_indigena_2022', 'view', 17, true, true),
    ('espacial_terra_indigena_2024', 'view', 18, true, true),
    ('espacial_arranjo_app_rl_aur_2022', 'view', 19, true, true),
    ('espacial_arranjo_app_rl_aur_2024', 'view', 20, true, true),
    ('espacial_arranjo_baixa_produtividade_2022', 'view', 21, true, true),
    ('espacial_arranjo_baixa_produtividade_2024', 'view', 22, true, true),
    ('espacial_arranjo_areas_publicas_2022', 'view', 23, true, true),
    ('espacial_arranjo_areas_publicas_2024', 'view', 24, true, true),
    ('espacial_manguezal_2022', 'view', 25, true, true),
    ('espacial_manguezal_2024', 'view', 26, true, true),
    ('espacial_assentamento_2022', 'view', 27, true, true),
    ('espacial_assentamento_2024', 'view', 28, true, true),
    ('espacial_quilombola_2022', 'view', 29, true, true),
    ('espacial_quilombola_2024', 'view', 30, true, true),
    ('espacial_car_2022', 'view', 31, true, true),
    ('espacial_car_2024', 'view', 32, true, true),
    ('municipio', 'matview', 33, true, true),
    ('peca_parte', 'view', 34, true, true),
    ('quantitativo_faceta', 'matview', 35, true, false),
    ('quantitativo_faceta_lugar', 'matview', 36, true, false),
    ('quantitativo_nivel', 'matview', 37, true, false),
    ('quantitativo_categoria', 'matview', 38, true, false),
    ('quantitativo_arranjo', 'matview', 39, true, false),
    ('quantitativo_filtro', 'matview', 40, true, false),
    ('quantitativo_dimensao', 'matview', 41, true, false),
    ('serie', 'matview', 42, true, false),
    ('catalogo_camada', 'matview', 43, true, false),
    ('catalogo_ano', 'view', 44, true, false),
    ('catalogo_nivel', 'view', 45, true, false),
    ('catalogo_arranjo', 'view', 46, true, false),
    ('catalogo_filtro', 'view', 47, true, false),
    ('catalogo_dimensao', 'view', 48, true, false),
    ('fonte_ausente', 'view', 49, true, false),
    ('fonte_vigente', 'view', 50, true, false);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'geoserver_leitura') THEN
        CREATE ROLE "geoserver_leitura" LOGIN;
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO "geoserver_leitura"', current_database());
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "geoserver_leitura";

GRANT SELECT ON
    "peca",
    "peca_2022",
    "peca_2024",
    "espacial_embargo_recooperar_2022",
    "espacial_embargo_recooperar_2024",
    "espacial_reparacao_danos_2022",
    "espacial_reparacao_danos_2024",
    "espacial_licenciamento_2022",
    "espacial_licenciamento_2024",
    "espacial_outras_areas_projetos_2022",
    "espacial_outras_areas_projetos_2024",
    "espacial_unidade_conservacao_2022",
    "espacial_unidade_conservacao_2024",
    "espacial_terra_indigena_2022",
    "espacial_terra_indigena_2024",
    "espacial_arranjo_app_rl_aur_2022",
    "espacial_arranjo_app_rl_aur_2024",
    "espacial_arranjo_baixa_produtividade_2022",
    "espacial_arranjo_baixa_produtividade_2024",
    "espacial_arranjo_areas_publicas_2022",
    "espacial_arranjo_areas_publicas_2024",
    "espacial_manguezal_2022",
    "espacial_manguezal_2024",
    "espacial_assentamento_2022",
    "espacial_assentamento_2024",
    "espacial_quilombola_2022",
    "espacial_quilombola_2024",
    "espacial_car_2022",
    "espacial_car_2024",
    "municipio",
    "peca_parte",
    "quantitativo_faceta",
    "quantitativo_faceta_lugar",
    "quantitativo_nivel",
    "quantitativo_categoria",
    "quantitativo_arranjo",
    "quantitativo_filtro",
    "quantitativo_dimensao",
    "serie",
    "catalogo_camada",
    "catalogo_ano",
    "catalogo_nivel",
    "catalogo_arranjo",
    "catalogo_filtro",
    "catalogo_dimensao",
    "fonte_ausente",
    "fonte_vigente",
    "gt_pk_metadata"
TO "geoserver_leitura";
