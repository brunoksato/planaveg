# Modelagem nova

Quatro tabelas e onze views. O GeoPackage do Planaveg entra na tabela `area_mapeada`, e o
PostgreSQL calcula sozinho o arranjo de cada área. As tabelas `nivel`, `arranjo` e `tema` dizem o
que é cada nível, arranjo e tema. As onze views juntam as duas coisas e dão os números do
relatório. O GeoServer publica `area_mapeada` como mapa e o resto como tabelas.

```
1_tabelas.sql ──▶ nivel, arranjo, tema   (as referências: 11 níveis, 4 arranjos, 15 temas)
              └─▶ area_mapeada           (vazia)

GeoPackage ── 3_carga.py ──▶ area_mapeada   (as áreas do arquivo; o arranjo, a coluna calcula)

2_views.sql ──▶ 11 views        (area_mapeada + referências = os números do relatório)

GeoServer ──▶ area_mapeada como mapa; as views, nivel, arranjo e tema como tabelas
```

Os desenhos estão em [diagramas.md](diagramas.md): o diagrama lógico das tabelas, de onde cada
view lê, os fluxogramas de montar o banco e da carga, e a regra do arranjo.

## Os arquivos

| Arquivo | O que faz | Quando roda |
| --- | --- | --- |
| `1_tabelas.sql` | cria as tabelas `nivel`, `arranjo`, `tema` e `area_mapeada` | uma vez, num banco vazio |
| `2_views.sql` | cria as onze views com os números do relatório | uma vez, depois do 1 |
| `3_carga.py` | troca o conteúdo de `area_mapeada` pelo GeoPackage | a cada GeoPackage novo |

## O que fica no banco

| Objeto | O que é |
| --- | --- |
| `area_mapeada` | uma linha por área do GeoPackage, nos dois anos (2022 e 2024): as colunas do arquivo, com nomes claros, o arranjo e o desenho |
| `nivel` | os 11 níveis da hierarquia: `id` (o número, de 1 a 11), `nome` e `grupo` |
| `arranjo` | os 4 arranjos de implementação: `slug` (o código, como `areas_publicas`), `ordem` (a prioridade), `nome` e `meta_ha` (a meta até 2030) |
| `tema` | os 15 temas (filtros) do relatório: `slug` (o código, como `car`), `ordem`, `grupo` e `nome` |
| `computo_por_nivel` | o cômputo por linha da hierarquia (Anexo 1) |
| `computo_por_arranjo` | o cômputo por arranjo, com a meta (Anexo 2) |
| `computo_por_tema` | as áreas de cada um dos 15 filtros do relatório |
| `computo_por_uf`, `computo_por_municipio`, `computo_por_bioma`, `computo_por_regiao_hidrografica`, `computo_por_mesobacia`, `computo_por_bacia` | o cômputo de cada lugar, aberto por nível e arranjo: para o total de um lugar, some as linhas dele |
| `computo_por_esfera_uc` | as áreas em UC federal, estadual, municipal e em qualquer UC; as esferas se sobrepõem, não some |
| `comparacao_entre_anos` | o cômputo de cada ano ao lado do anterior, com a diferença: o total, cada nível, cada arranjo e cada tema |

`nivel`, `arranjo` e `tema` são tabelas de referência: guardam uma vez o que é cada nível, cada
arranjo e cada tema. A chave de cada uma é o `id` (o número do nível) ou o `slug` (um código curto
em texto, sem acento nem espaço). `area_mapeada` aponta para elas pela coluna `nivel` (o `id` do
nível) e pela coluna `arranjo` (o `slug` do arranjo). A regra de quem entra em cada um fica no
código: o nível vem do arquivo; o arranjo é uma coluna gerada de `area_mapeada`, que o PostgreSQL
calcula ao gravar cada área (`GENERATED ALWAYS AS (CASE ...) STORED`, no `1_tabelas.sql`); e o
tema é calculado pela view `computo_por_tema`.

As views não guardam nada: somam `area_mapeada` na hora, então não há nada para recalcular depois
de uma carga.

## As palavras

- **Vegetação secundária (VS):** vegetação nativa que voltou a crescer onde já houve desmatamento,
  mapeada em 2022 e em 2024. Cada ano é uma camada do arquivo; os anos não se somam.
- **Área:** uma linha do arquivo. Junta num multipolígono os polígonos que têm tudo igual (mesmo
  nível, município, bacia, bioma e sobreposições). Em 2024 são 70.739.
- **Nível:** a mesma área pode estar numa Terra Indígena, num imóvel do CAR e num projeto. Para não
  contá-la três vezes, ela conta só no primeiro de 11 níveis que se aplica (1 Recooperar ... 11
  Reserva Legal). A **linha da hierarquia** é o nível com a situação do CAR, em APP, AUR e RL.
- **Cômputo:** quanto conta para a meta do Planaveg (12 milhões de ha até 2030): a soma das áreas.
- **Marca (`in_`):** `in_` = "está em". `in_car = true` quer dizer que a área está em imóvel do CAR.
  O nível diz onde a área conta; as marcas, onde mais ela está.
- **Arranjo:** as formas de cumprir a meta: áreas públicas (2 milhões de ha), APP, RL e AUR (9
  milhões) e áreas rurais produtivas (1 milhão). O que não cai em nenhum fica em "demais áreas".
- **Tema:** um recorte do relatório, como "tudo em UC" ou "tudo no CAR".

**Nível e arranjo somam** (cada área está em um só). **Marcas e temas nunca somam** (uma área está
em vários).

## Como rodar

Precisa de PostgreSQL com PostGIS e do [uv](https://docs.astral.sh/uv/), que instala sozinho o
`psycopg`, a única dependência do script.

```bash
export DATABASE_URL=postgresql://usuario:senha@servidor:5432/planaveg
createdb planaveg
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 1_tabelas.sql -f 2_views.sql
uv run 3_carga.py /caminho/Planaveg_2026_Categorias_Visualizacao.gpkg
```

O usuário precisa poder gravar em `spatial_ref_sys` (o dono do banco serve): o `1_tabelas.sql`
registra lá o Albers do IBGE, o sistema de coordenadas do arquivo, para o PostGIS saber convertê-lo
para o 4674.

A carga roda numa transação só: **ou entra a base inteira, ou nada muda.** Se der erro no meio, a
tabela continua com a carga anterior.

**A carga não corrige dados.** O que vem no arquivo entra como está; o que não encaixa no modelo
(coluna nova, nível desconhecido, desenho que não é polígono) faz a carga parar, e quem corrige é
quem gera o arquivo.

Para testar rápido, use a amostra do Espírito Santo, `../docs/gpkg/amostra_es.gpkg` (2.918 áreas,
poucos segundos).

## Conferir

```sql
-- Áreas e hectares por ano. Na base de 16/10: 70.581 (2022) e 70.739 (2024).
SELECT ano_mapeamento, count(*), round(sum(area_ha)) FROM area_mapeada GROUP BY 1 ORDER BY 1;

-- O cômputo de 2024 por nível: area_ha tem de bater com total_no_arquivo_ha em todas as linhas.
SELECT nivel, nivel_nome, situacao_car, round(area_ha), round(total_no_arquivo_ha)
FROM computo_por_nivel WHERE ano_mapeamento = 2024 ORDER BY nivel, situacao_car;

-- O cômputo de 2024 por arranjo, com a meta.
SELECT nome, round(area_ha), meta_ha FROM computo_por_arranjo WHERE ano_mapeamento = 2024 ORDER BY ordem;
```

## No GeoServer

1. Crie um datastore PostGIS apontado para o banco, com **"Expose primary keys" ligado**. Sem isso,
   o GeoServer esconde `ano_mapeamento` e `id_no_arquivo` (a chave da tabela), e o filtro pelo ano
   não funciona.
2. Publique `area_mapeada` como camada de mapa (SRS EPSG:4674), e as onze views, `nivel`,
   `arranjo` e `tema` como tabelas (o WFS devolve em JSON ou CSV).
3. Filtre com `CQL_FILTER`, por exemplo `ano_mapeamento=2024 AND in_car=true` ou
   `ano_mapeamento=2024 AND arranjo='areas_publicas'`.

O mapa de um estado sai em poucos segundos; o do Brasil inteiro passa de um minuto, porque o
desenho é o completo. O cache de tiles do GeoServer resolve isso depois da primeira vez. Depois de
cada carga, esvazie o cache da camada:

```bash
curl -u admin:SENHA -X POST "$GEOSERVER_URL/gwc/rest/masstruncate" -H "Content-Type: text/xml" \
  -d "<truncateLayer><layerName>planaveg:area_mapeada</layerName></truncateLayer>"
```

## Onde mudar cada coisa

| Para mudar | Onde |
| --- | --- |
| o nome ou o grupo de um nível, o nome ou a meta de um arranjo, o nome, o grupo ou a ordem de um tema | uma linha nas tabelas `nivel`, `arranjo` ou `tema` (`UPDATE`) e no `1_tabelas.sql` |
| a regra do arranjo | a coluna `arranjo` de `area_mapeada`, no `1_tabelas.sql`; num banco que já existe, `ALTER TABLE area_mapeada ALTER COLUMN arranjo SET EXPRESSION AS (CASE ... END)`, que recalcula todas as áreas sem recarregar |
| quais áreas entram num tema | o `CASE` em `computo_por_tema` (`2_views.sql`), uma linha por tema |
| um tema novo | uma linha na tabela `tema` e uma no `CASE` de `computo_por_tema`; sem a linha no `CASE`, ele fica com zero |
| a condição do CAR | o `CASE` em `computo_por_nivel` (`2_views.sql`) |
| qual coluna do arquivo vai em qual coluna da tabela | o dicionário `COLUNAS` do `3_carga.py` |
| qual camada do arquivo vira qual ano | o dicionário `CAMADAS` do `3_carga.py` |

Uma view se muda com `CREATE OR REPLACE VIEW` (ou apagando e rodando o `2_views.sql` de novo), sem
recarregar nada.

## Quando chegar um GeoPackage novo

- **Mesmas camadas e colunas:** é só rodar o `3_carga.py` com o arquivo novo.
- **Camada com outro nome:** troque em `CAMADAS`.
- **Coluna nova:** a carga para e diz qual é. Crie a coluna na tabela (`ALTER TABLE area_mapeada
  ADD COLUMN ...`, e no `1_tabelas.sql`) e ponha a dupla em `COLUNAS`. Se for uma marca, o nome
  começa com `in_` e o tipo é `boolean`.
- **Coluna que saiu:** a carga roda, e a coluna fica vazia (NULL).
- **Desenho que não é polígono** (ponto, linha): a carga para; a coluna `geom` só aceita polígonos.
- **Nível novo:** a carga para com erro de chave estrangeira. Acrescente o nível na tabela `nivel`
  (`INSERT INTO nivel(id, nome, grupo) VALUES (12, 'Nome', 'Grupo');`, e no `1_tabelas.sql`) e
  rode de novo.
- **Outro sistema de coordenadas:** confira com `sqlite3 arquivo.gpkg "SELECT * FROM
  gpkg_spatial_ref_sys"`. Se não for mais o Albers do IBGE (100000), mude o registro no
  `1_tabelas.sql` e o número no `INSERT` do `3_carga.py`.

## Cuidados que estão nas regras

- **UC no arranjo e UC no tema não são a mesma coisa.** O tema "Unidades de Conservação" conta toda
  UC, APA e RPPN incluídas (`in_uc`). O arranjo de áreas públicas conta só a UC que não é APA, a
  sigla `UC` de `siglas_sobreposicao`, porque nas APAs só as áreas públicas entram.
- **A UF de uma área é a do recorte.** Na divisa, o limite de UF e o de município não coincidem, e
  sobram lascas com o município de um estado e a UF do vizinho (3 áreas de Vila Rica, MT, vêm com
  UF PA). Por isso `computo_por_municipio` identifica o município pelo código do IBGE, e não pela
  UF. A bacia vem com a mesobacia, porque há um nome de bacia em duas mesobacias.
