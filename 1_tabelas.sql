CREATE EXTENSION IF NOT EXISTS postgis;

INSERT INTO spatial_ref_sys(srid, auth_name, auth_srid, srtext)
    VALUES (100000, 'IBGE', 100000, 'PROJCS["IBGE_South_America_Albers_Equal_Area_Conic",
        GEOGCS["SIRGAS 2000",
            DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",
                SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],
                AUTHORITY["EPSG","6674"]],
            PRIMEM["Greenwich",0],
            UNIT["Degree",0.0174532925199433]],
        PROJECTION["Albers_Conic_Equal_Area"],
        PARAMETER["latitude_of_center",-12],
        PARAMETER["longitude_of_center",-54],
        PARAMETER["standard_parallel_1",-2],
        PARAMETER["standard_parallel_2",-22],
        PARAMETER["false_easting",0],
        PARAMETER["false_northing",0],
        UNIT["metre",1,AUTHORITY["EPSG","9001"]],
        AXIS["Easting",EAST],
        AXIS["Northing",NORTH]]')
ON CONFLICT (srid)
    DO NOTHING;

-- Os níveis da hierarquia do Planaveg (Anexo 1 do relatório), na ordem de priori dade. Cada área
-- conta em um nível só, o primeiro que se aplica a ela, para não ser contada duas vezes.
CREATE TABLE nivel(
    id integer PRIMARY KEY, -- o número do nível, de 1 a 11 (no arquivo, tier)
    nome text NOT NULL, -- como na planilha de nomenclatura do SINAVEG
    grupo text NOT NULL -- o grupo de saída do relatório (seção 4)
);

INSERT INTO nivel(id, nome, grupo)
VALUES
    (1, 'Recooperar', 'Projetos de Recuperação da Vegetação Nativa'),
(2, 'MonitoRAD', 'Projetos de Recuperação da Vegetação Nativa'),
(3, 'PRADA', 'Projetos de Recuperação da Vegetação Nativa'),
(4, 'Projetos de Cooperação MMA', 'Projetos de Recuperação da Vegetação Nativa'),
(5, 'Observatório da Restauração e Recuperação', 'Projetos de Recuperação da Vegetação Nativa'),
(6, 'Terras Indígenas', 'Vegetação Secundária em Áreas Legalmente Protegidas'),
(7, 'Unidades de Conservação', 'Vegetação Secundária em Áreas Legalmente Protegidas'),
(8, 'Sistemas Costeiros', 'Vegetação Secundária em Áreas Legalmente Protegidas'),
(9, 'Área de Preservação Permanente', 'Vegetação Secundária em Áreas Legalmente Protegidas'),
(10, 'Área de Uso Restrito', 'Vegetação Secundária em Áreas Legalmente Protegidas'),
(11, 'Reserva Legal', 'Vegetação Secundária em Áreas Legalmente Protegidas');

-- Os arranjos de implementação (Anexo 2 do relatório), na ordem de prioridade, com a meta até 2030.
-- Cada área cai em um arranjo só; a regra está na coluna arranjo de area_mapeada.
CREATE TABLE arranjo(
    slug text PRIMARY KEY, -- o código, que vai na coluna arranjo de area_mapeada
    ordem integer NOT NULL, -- a prioridade: a área cai no primeiro que atende
    nome text NOT NULL,
    meta_ha numeric -- a meta até 2030, em hectares; vazia nas demais áreas, que não têm meta
);

INSERT INTO arranjo(slug, ordem, nome, meta_ha)
VALUES
    ('areas_publicas', 1, 'Recuperação da vegetação nativa em áreas públicas', 2000000),
('app_rl_aur', 2, 'Recuperação da vegetação nativa em APP, RL e AUR', 9000000),
('baixa_produtividade', 3, 'Recuperação da vegetação em áreas rurais consolidadas com sistemas integrados de produção', 1000000),
('demais_areas', 4, 'Demais áreas de projetos (sem meta própria)', NULL);

-- Os temas (filtros) do relatório, na ordem em que ele os apresenta. Diferente do nível e do
-- arranjo, os temas se sobrepõem: uma área pode estar em vários. A regra de quem entra em cada tema
-- está na view computo_por_tema (2_views.sql).
CREATE TABLE tema(
    slug text PRIMARY KEY, -- o código, usado na regra da view computo_por_tema
    ordem integer NOT NULL, -- a ordem no relatório
    grupo text NOT NULL, -- o grupo do relatório em que o tema aparece
    nome text NOT NULL
);

INSERT INTO tema(slug, ordem, grupo, nome)
VALUES
    ('embargo_recooperar', 1, 'Projetos de Recuperação da Vegetação Nativa', 'Áreas em recuperação por processos de Embargo (Recooperar)'),
('reparacao_danos', 2, 'Projetos de Recuperação da Vegetação Nativa', 'Áreas em recuperação por processos de Reparação por Danos'),
('licenciamento', 3, 'Projetos de Recuperação da Vegetação Nativa', 'Áreas em recuperação por processos de Licenciamento Ambiental'),
('outras_areas_projetos', 4, 'Projetos de Recuperação da Vegetação Nativa', 'Outras áreas de projetos não incluídas nas demais categorias'),
('unidade_conservacao', 5, 'Vegetação Secundária em Áreas Legalmente Protegidas', 'Unidades de Conservação'),
('terra_indigena', 6, 'Vegetação Secundária em Áreas Legalmente Protegidas', 'Terras Indígenas'),
('arranjo_app_rl_aur', 7, 'Arranjos de Implementação do Planaveg', 'Recuperação da vegetação nativa em APP, RL e AUR'),
('arranjo_baixa_produtividade', 8, 'Arranjos de Implementação do Planaveg', 'Recuperação da vegetação em áreas rurais consolidadas com sistemas integrados de produção'),
('arranjo_areas_publicas', 9, 'Arranjos de Implementação do Planaveg', 'Recuperação da vegetação nativa em áreas públicas'),
('manguezal', 10, 'Limites Ecológicos provenientes de dados oficiais', 'Ecossistemas: Manguezais (Pró-Manguezal)'),
('assentamento', 11, 'Categorias Fundiárias', 'Assentamentos Rurais'),
('quilombola', 12, 'Categorias Fundiárias', 'Territórios Quilombolas'),
('fundiario_terra_indigena', 13, 'Categorias Fundiárias', 'Terras Indígenas'),
('fundiario_uc', 14, 'Categorias Fundiárias', 'Unidades de Conservação'),
('car', 15, 'Categorias Fundiárias', 'Cadastro Ambiental Rural');

-- As colunas do arquivo têm um nome que diz o que elas são; a lista de qual coluna do arquivo vai
-- em qual está no 3_carga.py (COLUNAS). O arranjo vem no fim, antes do desenho.
CREATE TABLE area_mapeada(
    -- qual área é: o ano do mapeamento (a camada do arquivo) e o número dela na camada (fid)
    ano_mapeamento smallint NOT NULL, -- 2022 (camada vs22q) ou 2024 (camada vs2224q)
    id_no_arquivo bigint NOT NULL, -- fid no geopackage
    -- Onde a área conta. Cada área conta em um nível só da hierarquia do Planaveg (1 Recooperar
    -- ... 11 Reserva Legal), o primeiro que se aplica a ela, para não ser contada duas vezes.
    nivel integer REFERENCES nivel, -- o número do nível, de 1 a 11 (no arquivo, tier)
    linha_hierarquia text, -- o nível por extenso, com a situação do CAR quando é
    -- APP, AUR ou RL (no arquivo, hierarquia_planaveg)
    situacao_car text, -- Habilitados, Analisados ou Nao_Analisados; vazio fora de
    -- APP, AUR e RL (no arquivo, categoria)
    total_linha_hierarquia_ha double precision, -- o cômputo da linha da hierarquia inteira no ano,
    -- repetido em cada área dela (no arquivo, computo)
    area_ha double precision, -- a área desta, em hectares
    -- onde a área está
    uf text, -- a UF do recorte (na divisa, pode não ser a do município)
    bioma text,
    municipio text,
    codigo_ibge_municipio text,
    bacia text,
    mesobacia text,
    regiao_hidrografica text,
    -- No arquivo, cada uma é uma coluna com a sigla quando a área tem a marca e vazia quando não tem.
    -- in_ = “está em”: a coluna diz sim ou não se a área fica dentro daquele lugar (in_car = a área está em imóvel do CAR).
    in_car boolean, -- em imóvel do CAR, em qualquer situação
    in_car_habilitado boolean,
    in_car_analisado boolean,
    in_car_nao_analisado boolean,
    in_car_regularizacao boolean, -- área a recuperar de imóvel analisado, em regularização
    in_app_car_habilitado boolean, -- em APP (Área de Preservação Permanente) de imóvel habilitado
    in_app_car_analisado boolean,
    in_app_car_nao_analisado boolean,
    in_rl_car_habilitado boolean, -- em RL (Reserva Legal)
    in_rl_car_analisado boolean,
    in_rl_car_nao_analisado boolean,
    in_aur_car_habilitado boolean, -- em AUR (Área de Uso Restrito)
    in_aur_car_analisado boolean,
    in_aur_car_nao_analisado boolean,
    in_projeto_recuperacao boolean, -- em projeto de recuperação, de qualquer fonte (PROJ)
    in_licenciamento_ambiental boolean, -- Recooperar: recuperação por licenciamento
    in_reparacao_danos boolean, -- Recooperar: reparação de danos
    in_area_embargada boolean, -- Recooperar: processo de embargo
    in_outras_areas_recooperar boolean, -- Recooperar: outras áreas
    in_embargo_pangia boolean, -- embargo do PANGIA (sanções do IBAMA)
    in_gef_terrestre boolean, -- projeto GEF Terrestre
    in_restauracao_ecologica boolean,
    in_observatorio_restauracao boolean, -- Observatório da Restauração e Reflorestamento (ORR)
    in_manguezal boolean, -- manguezal do Pró-Manguezal
    in_apa boolean, -- Área de Proteção Ambiental
    in_rppn boolean, -- Reserva Particular do Patrimônio Natural
    in_uc boolean, -- Unidade de Conservação de qualquer tipo, APA e RPPN incluídas
    in_uc_federal boolean,
    in_uc_estadual boolean,
    in_uc_municipal boolean,
    in_terra_indigena boolean, -- (TI)
    in_assentamento boolean, -- assentamento rural (AS)
    in_territorio_quilombola boolean, -- (QL)
    siglas_sobreposicao text, -- as siglas fundiárias juntas, como PROJCARAS (PROJ, CAR, AS)
    -- O arranjo em que a área cai. Não vem do arquivo: o PostgreSQL calcula sozinho, a partir das
    -- colunas acima, quando cada área é gravada. É o primeiro arranjo que a área atende, na ordem de
    -- prioridade da tabela arranjo. A UC daqui é a que não é APA nem RPPN (a sigla UC de
    -- siglas_sobreposicao): nas APAs, só as áreas públicas, que já vêm no nível 7, entram. O de baixa
    -- produtividade não tem regra: a base não traz o que o define. Para mudar a regra num banco que
    -- já existe: ALTER TABLE area_mapeada ALTER COLUMN arranjo SET EXPRESSION AS (CASE ... END).
    -- poderia ser movido para campo calculado em um codigo.
   arranjo text GENERATED ALWAYS AS (
        CASE
            WHEN nivel IN (6, 7, 8)
                OR position('UC' IN siglas_sobreposicao) > 0 OR in_rppn
                OR in_terra_indigena OR in_assentamento OR in_territorio_quilombola
                THEN 'areas_publicas'
            WHEN nivel IN (3, 9, 10, 11)
                OR in_app_car_habilitado OR in_app_car_analisado OR in_app_car_nao_analisado
                OR in_rl_car_habilitado OR in_rl_car_analisado OR in_rl_car_nao_analisado
                OR in_aur_car_habilitado OR in_aur_car_analisado OR in_aur_car_nao_analisado
                OR in_car_regularizacao
                THEN 'app_rl_aur'
            ELSE 'demais_areas'
        END
    ) STORED REFERENCES arranjo,    -- o desenho, em SIRGAS 2000 (lat/long); a carga converte do Albers do arquivo
    geom geometry(MultiPolygon, 4674) NOT NULL,
    PRIMARY KEY (ano_mapeamento, id_no_arquivo)
);

-- Índice espacial: é o que deixa rápido achar as áreas de um pedaço do mapa.
CREATE INDEX area_mapeada_geom ON area_mapeada USING gist(geom);

