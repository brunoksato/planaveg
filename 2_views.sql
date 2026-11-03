-- ============================================================================================
-- Os números do relatório
-- ============================================================================================
-- O cômputo por linha da hierarquia (Anexo 1). Os níveis não se sobrepõem: dá para somar. O
-- total_no_arquivo_ha é o cômputo que o próprio arquivo traz para a linha; tem de dar igual a
-- area_ha. O nível 2 (MonitoRAD) não tem áreas no arquivo e não aparece.
CREATE VIEW computo_por_nivel AS
SELECT
    a.ano_mapeamento,
    n.grupo,
    a.nivel,
    n.nome AS nivel_nome,
    a.linha_hierarquia,
    a.situacao_car,
    -- As três situações do CAR no arquivo viram as duas condições do relatório (só em APP, AUR
    -- e RL).
    CASE a.situacao_car
    WHEN 'Habilitados' THEN
        'Analisado, em conformidade com a Lei nº 12.651/2012, com ativos e em regularização'
    WHEN 'Analisados' THEN
        'Não analisado, em análise ou aguardando retificação'
    WHEN 'Nao_Analisados' THEN
        'Não analisado, em análise ou aguardando retificação'
    END AS condicao_car,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha,
    max(a.total_linha_hierarquia_ha) AS total_no_arquivo_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    n.grupo,
    a.nivel,
    n.nome,
    a.linha_hierarquia,
    a.situacao_car;

-- O cômputo por arranjo de implementação (Anexo 2), com a meta até 2030. Os arranjos não se
-- sobrepõem: dá para somar. Partir da tabela arranjo garante a linha do arranjo sem áreas (baixa
-- produtividade).
CREATE VIEW computo_por_arranjo AS
WITH ano AS (
    SELECT DISTINCT
        ano_mapeamento
    FROM
        area_mapeada
)
SELECT
    y.ano_mapeamento,
    r.ordem,
    r.slug AS arranjo,
    r.nome,
    r.meta_ha,
    count(c.arranjo) AS areas,
    coalesce(sum(c.area_ha), 0) AS area_ha
FROM
    ano y
    CROSS JOIN arranjo r
    LEFT JOIN area_mapeada c ON c.ano_mapeamento = y.ano_mapeamento
        AND c.arranjo = r.slug
GROUP BY
    y.ano_mapeamento,
    r.ordem,
    r.slug,
    r.nome,
    r.meta_ha;

-- As áreas de cada tema (filtro) do relatório, por ano. O nome, o grupo e a ordem de cada tema estão
-- na tabela tema; aqui fica só a regra de quem entra nele: o CASE abaixo, uma linha por tema, quase
-- sempre uma marca. Os temas se sobrepõem (uma área pode estar em vários): NUNCA some as linhas
-- desta view. Terras Indígenas e Unidades de Conservação aparecem em dois grupos do relatório, com
-- a mesma regra; a UC aqui é toda UC, APA e RPPN incluídas (in_uc). Partir da tabela tema garante a
-- linha do tema sem áreas (baixa produtividade); um tema da tabela sem linha no CASE fica com zero.
CREATE VIEW computo_por_tema AS
WITH ano AS (
    SELECT DISTINCT
        ano_mapeamento
    FROM
        area_mapeada
)
SELECT
    y.ano_mapeamento,
    t.ordem,
    t.grupo,
    t.slug AS tema,
    t.nome,
    count(a.ano_mapeamento) AS areas,
    coalesce(sum(a.area_ha), 0) AS area_ha
FROM
    ano y
    CROSS JOIN tema t
    LEFT JOIN area_mapeada a ON a.ano_mapeamento = y.ano_mapeamento
        AND CASE t.slug
        WHEN 'embargo_recooperar' THEN
            a.in_area_embargada
        WHEN 'reparacao_danos' THEN
            a.in_reparacao_danos
        WHEN 'licenciamento' THEN
            a.in_licenciamento_ambiental
        WHEN 'outras_areas_projetos' THEN
            a.in_outras_areas_recooperar
            OR a.in_observatorio_restauracao
            OR a.in_car_regularizacao
            OR a.nivel IN (3, 4, 5)
        WHEN 'unidade_conservacao' THEN
            a.in_uc
        WHEN 'terra_indigena' THEN
            a.in_terra_indigena
        WHEN 'arranjo_app_rl_aur' THEN
            a.arranjo = 'app_rl_aur'
        WHEN 'arranjo_baixa_produtividade' THEN
            a.arranjo = 'baixa_produtividade'
        WHEN 'arranjo_areas_publicas' THEN
            a.arranjo = 'areas_publicas'
        WHEN 'manguezal' THEN
            a.in_manguezal
        WHEN 'assentamento' THEN
            a.in_assentamento
        WHEN 'quilombola' THEN
            a.in_territorio_quilombola
        WHEN 'fundiario_terra_indigena' THEN
            a.in_terra_indigena
        WHEN 'fundiario_uc' THEN
            a.in_uc
        WHEN 'car' THEN
            a.in_car
        END
GROUP BY
    y.ano_mapeamento,
    t.ordem,
    t.grupo,
    t.slug,
    t.nome;

-- O cômputo por lugar: uma view para cada recorte do relatório (UF, município, bioma, região
-- hidrográfica, mesobacia e bacia). Todas abrem o número por nível e arranjo, que não se sobrepõem:
-- para o total de um lugar, some area_ha das linhas dele.
-- Por UF. É a UF do recorte da área: na divisa, o limite de UF e o de município não coincidem, e
-- sobram lascas com o município de um estado e a UF do vizinho.
CREATE VIEW computo_por_uf AS
SELECT
    a.ano_mapeamento,
    a.uf,
    a.nivel,
    n.nome AS nivel_nome,
    a.arranjo,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    a.uf,
    a.nivel,
    n.nome,
    a.arranjo;

-- Por município, identificado pelo código do IBGE: há nomes repetidos em estados diferentes.
CREATE VIEW computo_por_municipio AS
SELECT
    a.ano_mapeamento,
    a.codigo_ibge_municipio,
    a.municipio,
    a.nivel,
    n.nome AS nivel_nome,
    a.arranjo,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    a.codigo_ibge_municipio,
    a.municipio,
    a.nivel,
    n.nome,
    a.arranjo;

-- Por bioma.
CREATE VIEW computo_por_bioma AS
SELECT
    a.ano_mapeamento,
    a.bioma,
    a.nivel,
    n.nome AS nivel_nome,
    a.arranjo,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    a.bioma,
    a.nivel,
    n.nome,
    a.arranjo;

-- Por região hidrográfica, o maior dos três recortes de bacia.
CREATE VIEW computo_por_regiao_hidrografica AS
SELECT
    a.ano_mapeamento,
    a.regiao_hidrografica,
    a.nivel,
    n.nome AS nivel_nome,
    a.arranjo,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    a.regiao_hidrografica,
    a.nivel,
    n.nome,
    a.arranjo;

-- Por mesobacia, com a região hidrográfica dela.
CREATE VIEW computo_por_mesobacia AS
SELECT
    a.ano_mapeamento,
    a.mesobacia,
    a.regiao_hidrografica,
    a.nivel,
    n.nome AS nivel_nome,
    a.arranjo,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    a.mesobacia,
    a.regiao_hidrografica,
    a.nivel,
    n.nome,
    a.arranjo;

-- Por bacia, a menor das três, identificada pelo nome com a mesobacia: há um nome de bacia em duas
-- mesobacias.
CREATE VIEW computo_por_bacia AS
SELECT
    a.ano_mapeamento,
    a.bacia,
    a.mesobacia,
    a.nivel,
    n.nome AS nivel_nome,
    a.arranjo,
    count(*) AS areas,
    sum(a.area_ha) AS area_ha
FROM
    area_mapeada a
    LEFT JOIN nivel n ON n.id = a.nivel
GROUP BY
    a.ano_mapeamento,
    a.bacia,
    a.mesobacia,
    a.nivel,
    n.nome,
    a.arranjo;


-- A comparação entre os anos: o cômputo de cada ano ao lado do ano anterior, com a diferença. Uma
-- linha por recorte (o total, cada nível, cada arranjo e cada tema) e ano; o primeiro ano não tem
-- anterior, então ano_anterior, area_ha_anterior e diferenca_ha ficam vazios nele. Cada bloco do
-- UNION ALL junta um recorte; o lag() pega o valor do ano anterior do mesmo recorte.
CREATE VIEW comparacao_entre_anos AS
WITH computo AS (
    SELECT
        'total' AS recorte,
        'total' AS codigo,
        'Cômputo Planaveg' AS nome,
        ano_mapeamento,
        sum(area_ha) AS area_ha
    FROM
        area_mapeada
    GROUP BY
        ano_mapeamento
    UNION ALL
    SELECT
        'nivel',
        n.id::text,
        n.nome,
        a.ano_mapeamento,
        sum(a.area_ha)
    FROM
        area_mapeada a
        JOIN nivel n ON n.id = a.nivel
    GROUP BY
        n.id,
        n.nome,
        a.ano_mapeamento
    UNION ALL
    SELECT
        'arranjo',
        arranjo,
        nome,
        ano_mapeamento,
        area_ha
    FROM
        computo_por_arranjo
    UNION ALL
    SELECT
        'tema',
        tema,
        nome,
        ano_mapeamento,
        area_ha
    FROM
        computo_por_tema
)
SELECT
    recorte,
    codigo,
    nome,
    ano_mapeamento,
    area_ha,
    lag(ano_mapeamento) OVER anterior AS ano_anterior,
    lag(area_ha) OVER anterior AS area_ha_anterior,
    area_ha - lag(area_ha) OVER anterior AS diferenca_ha
FROM
    computo
WINDOW anterior AS (PARTITION BY recorte, codigo ORDER BY ano_mapeamento);

-- As áreas em Unidade de Conservação por esfera (federal, estadual e municipal), e em qualquer UC.
-- As esferas se sobrepõem (uma área pode estar numa UC federal e numa estadual ao mesmo tempo):
-- NUNCA some as linhas desta view; o total de UC é a linha "qualquer esfera". APA e RPPN entram.
CREATE VIEW computo_por_esfera_uc AS
SELECT
    ano_mapeamento,
    1 AS ordem,
    'federal' AS esfera,
    count(*) FILTER (WHERE in_uc_federal) AS areas,
    coalesce(sum(area_ha) FILTER (WHERE in_uc_federal), 0) AS area_ha
FROM
    area_mapeada
GROUP BY
    ano_mapeamento
UNION ALL
SELECT
    ano_mapeamento,
    2,
    'estadual',
    count(*) FILTER (WHERE in_uc_estadual),
    coalesce(sum(area_ha) FILTER (WHERE in_uc_estadual), 0)
FROM
    area_mapeada
GROUP BY
    ano_mapeamento
UNION ALL
SELECT
    ano_mapeamento,
    3,
    'municipal',
    count(*) FILTER (WHERE in_uc_municipal),
    coalesce(sum(area_ha) FILTER (WHERE in_uc_municipal), 0)
FROM
    area_mapeada
GROUP BY
    ano_mapeamento
UNION ALL
SELECT
    ano_mapeamento,
    4,
    'qualquer esfera',
    count(*) FILTER (WHERE in_uc),
    coalesce(sum(area_ha) FILTER (WHERE in_uc), 0)
FROM
    area_mapeada
GROUP BY
    ano_mapeamento;
