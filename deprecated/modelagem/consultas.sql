-- Escrito à mão, não gerado: as consultas que o portal faz ao GeoServer, em SQL, para ler e rodar.
-- Não é um passo da modelagem: não cria nem muda nada. Vêm dos serviços do portal
-- (apps/web/src/**/services/*.service.ts), das camadas do mapa (mapa/utils/camadas.ts) e dos
-- links de download (DownloadsDoMapa, VisaoBaixar, VisaoCamadas). O portal não tem API: cada
-- consulta é um GetFeature do WFS, em que CQL_FILTER vira WHERE, propertyName as colunas,
-- sortBy o ORDER BY e count o LIMIT. Os valores são exemplos; as do clique e dos tiles são
-- equivalentes aproximados (o GeoServer monta o SQL delas a partir do pixel e do tile).
-- Mudou um serviço do portal? Mude a consulta aqui também.


-- ============================================================================================
-- Catálogo: todas as telas o leem antes de tudo (shared/services/catalogo.service.ts).
-- ============================================================================================

-- A versão dos dados, sem `v=` na URL (um minuto na CDN). Vai em `v=` em todas as seguintes.
SELECT versao_dados FROM fonte_vigente;

-- As oito tabelas do catálogo, num pedido WFS só (uma consulta por tabela). O portal ordena
-- cada uma no navegador, pela coluna do ORDER BY.
SELECT * FROM catalogo_ano ORDER BY ano_vs;
SELECT * FROM catalogo_camada ORDER BY ordem;
SELECT * FROM catalogo_nivel ORDER BY tier;
SELECT * FROM catalogo_arranjo ORDER BY prioridade;
SELECT * FROM catalogo_filtro ORDER BY ordem;
SELECT * FROM catalogo_dimensao ORDER BY ordem;
SELECT * FROM fonte_ausente;
SELECT * FROM fonte_vigente;


-- ============================================================================================
-- Visão geral (visao-geral/services/quantitativos.service.ts).
-- ============================================================================================

-- A área de cada nível da hierarquia em cada ano.
SELECT * FROM quantitativo_nivel ORDER BY ano_vs, tier, categoria;

-- O total de cada arranjo em cada ano: as linhas sem nível.
SELECT * FROM quantitativo_arranjo WHERE nivel IS NULL ORDER BY ano_vs, prioridade;


-- ============================================================================================
-- Filtros: os números do mapa e do painel (filtros/services/facetas.service.ts).
-- ============================================================================================

-- As facetas de um ano no Brasil (cerca de 4,7 mil linhas). O navegador as soma para os
-- números de qualquer filtro, sem outra consulta.
SELECT * FROM quantitativo_faceta WHERE ano_vs = 2024;

-- A forma do filtro que vai nas camadas de peças (cqlDosFiltros, filtros/utils/cql.ts):
-- uma condição por dimensão escolhida, os valores em ordem, e os temas do relatório com o
-- `cql` de cada um em catalogo_filtro, ligados por OR. Aqui, sobre a camada de 2024:
SELECT count(*) AS n_pecas, sum(area_ha) AS area_ha
FROM peca_2024
WHERE nivel IN ('app', 'rl')                         -- categorias
  AND categoria IN ('Analisados', 'Nao_Analisados')  -- situação no CAR: as da base que ela junta
  AND arranjo IN ('app_rl_aur')                      -- caminhos
  AND uf IN ('MT', 'PA')                             -- estados
  AND bioma IN ('Amazônia')                          -- biomas
  AND ((car = true) OR (embargo = true));            -- temas: catalogo_filtro.cql


-- ============================================================================================
-- Painel: um lugar (painel/services/lugar.service.ts).
-- ============================================================================================

-- O ranking: os totais de cada valor de uma dimensão num ano (uf, municipio, bacia,
-- bacia_meso, regiao_hidrografica, bioma). Municípios são ~5 mil linhas: só quatro colunas.
SELECT chave, rotulo, area_ha, n_poligonos
FROM quantitativo_dimensao
WHERE dimensao = 'municipio' AND ano_vs = 2024 AND nivel IS NULL AND arranjo IS NULL
ORDER BY area_ha DESC;

-- As facetas de um lugar no ano. O navegador as soma como as do Brasil, com os filtros do
-- painel.
SELECT ano_vs, nivel, categoria, arranjo, uf, bioma, temas, esferas_uc, tipos_uc,
       n_pecas, n_poligonos, area_ha
FROM quantitativo_faceta_lugar
WHERE dimensao = 'municipio' AND chave = '1500602' AND ano_vs = 2024;

-- O nome de um lugar, mesmo sem área no ano escolhido.
SELECT rotulo
FROM quantitativo_dimensao
WHERE dimensao = 'municipio' AND chave = '1500602' AND nivel IS NULL AND arranjo IS NULL
LIMIT 1;

-- A busca de municípios e bacias no painel: o texto em minúsculas e sem acento, contra a
-- coluna `busca`.
SELECT chave, rotulo
FROM quantitativo_dimensao
WHERE dimensao = 'municipio' AND nivel IS NULL AND arranjo IS NULL
  AND busca LIKE '%sao paulo%'
LIMIT 40;


-- ============================================================================================
-- Mapa: a busca de município e o zoom aos estados (mapa/services/municipios.service.ts).
-- ============================================================================================

-- Um município pelo código do IBGE, com o retângulo das áreas dele: o mapa vai até ele.
SELECT * FROM municipio WHERE cod_municipio = '1500602' LIMIT 1;

-- As sugestões da busca, em ordem alfabética.
SELECT * FROM municipio WHERE busca LIKE '%sao%' ORDER BY rotulo LIMIT 8;

-- Os estados escolhidos no filtro: os retângulos dos municípios deles, que o navegador junta
-- numa caixa só, para o mapa ir até eles.
SELECT uf, geom FROM municipio WHERE uf IN ('MT', 'PA');


-- ============================================================================================
-- Mapa: o clique (mapa/services/identificacao.service.ts). Equivalente aproximado: o
-- GetFeatureInfo do WMS acha as feições sob o pixel; aqui, sob o ponto clicado.
-- ============================================================================================

-- As peças sob o clique, com o filtro do mapa: até cinco, sem a geometria.
SELECT fid, ano_vs, origem_id, nivel, categoria, arranjo, hierarquia, area_ha, uf,
       municipio, bioma, bacia, sobreposicao, licenciamento, reparacao_danos, embargo,
       outras_areas, observatorio, gef_terrestre, restauracao_ecologica, uc_federal,
       uc_estadual, uc_municipal, apa, rppn, uc
FROM peca_2024
WHERE ST_Intersects(geom, ST_SetSRID(ST_Point(-52.21, -3.20), 4674))
  AND uf IN ('PA')
LIMIT 5;

-- O polígono clicado de uma peça. É a única consulta com parâmetros (`viewparams`): o
-- GeoServer põe `ano_vs = %ano_vs% AND origem_id = %origem_id%` na SQL view, só com algarismos.
SELECT parte, partes, area_ha, geom
FROM (SELECT * FROM peca_parte WHERE ano_vs = 2024 AND origem_id = 1) AS peca
WHERE ST_Intersects(geom, ST_SetSRID(ST_Point(-52.21, -3.20), 4674))
LIMIT 1;

-- Sem o polígono, o contorno da peça inteira: a geometria simplificada, pelo ano e pelo
-- origem_id (geometriaDaPeca). Só nesse caso: a de uma peça grande passa de 5 MB.
SELECT geom_alta FROM peca_2024 WHERE ano_vs = 2024 AND origem_id = 1 LIMIT 1;


-- ============================================================================================
-- Mapa: os tiles e o contorno (mapa/utils/camadas.ts). Equivalente aproximado: o GeoServer
-- lê, para cada tile, as feições dentro dele, com o filtro do mapa no WHERE. Até o zoom 13
-- desenha `geom_alta` (e `ponto` para as peças pequenas demais); do 14 em diante, `geom`.
-- ============================================================================================

-- As peças do ano mais recente (peca_<ano>, estilo planaveg_nivel). Com a legenda noutra ordem,
-- uma camada por categoria (`nivel IN ('app')`, e assim por diante).
SELECT nivel, area_ha, geom_alta, ponto
FROM peca_2024
WHERE geom_alta && ST_MakeEnvelope(-56.25, -5.62, -50.62, 0.0, 4674)
  AND uf IN ('PA');

-- O contorno do município escolhido, desenhado na hora pelo WMS.
SELECT geom FROM municipio WHERE cod_municipio = '1500602';


-- ============================================================================================
-- Downloads: os links de CSV e JSON. A mesma consulta do WFS, em outro formato.
-- ============================================================================================

-- Mapa (mapa/components/DownloadsDoMapa.tsx): as áreas filtradas de um ano, sem a geometria,
-- com a situação do cadastro da planilha no lugar da condição do CAR (ATRIBUTOS_CSV)...
SELECT fid, ano_vs, nivel, situacao_cadastro, arranjo, area_ha, uf, municipio, bioma, bacia,
       sobreposicao, licenciamento, reparacao_danos, embargo, outras_areas, observatorio,
       gef_terrestre, restauracao_ecologica, uc_federal, uc_estadual, uc_municipal, apa, rppn, uc
FROM peca_2024
WHERE uf IN ('PA');

-- ...e as do município escolhido, com o filtro junto (comMunicipio, mapa/utils/cql.ts).
SELECT fid, ano_vs, nivel, situacao_cadastro, arranjo, area_ha, uf, municipio, bioma, bacia,
       sobreposicao, licenciamento, reparacao_danos, embargo, outras_areas, observatorio,
       gef_terrestre, restauracao_ecologica, uc_federal, uc_estadual, uc_municipal, apa, rppn, uc
FROM peca_2024
WHERE cod_municipio = '1500602' AND uf IN ('PA');

-- Dados (dados/components/VisaoBaixar.tsx, a lista em dados/utils/tabelas.ts): as tabelas de
-- números inteiras, em CSV e em JSON.
SELECT * FROM quantitativo_categoria;
SELECT * FROM quantitativo_arranjo;
SELECT * FROM quantitativo_filtro;
SELECT * FROM quantitativo_dimensao;

-- As áreas de cada camada de peças (peca, peca_<ano>, espacial_<filtro>_<ano>), sem a
-- geometria (VisaoBaixar e VisaoCamadas, ATRIBUTOS_DAS_AREAS).
SELECT fid, ano_vs, nivel, situacao_cadastro, arranjo, area_ha, uf, cod_municipio, municipio,
       bioma, bacia, sobreposicao
FROM peca_2024;
