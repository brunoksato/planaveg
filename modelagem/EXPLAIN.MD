# Tutorial da modelagem do SINAVEG

A modelagem é o banco do SINAVEG em quatro arquivos de SQL: tabelas, funções, views e dados de referência. Para entendê-la, siga uma peça: ela vem do GeoPackage pela carga, é classificada pelas regras do contrato e somada em views que o GeoServer publica para o portal.

## Visão geral

&#91;embedded content: o banco em blocos · 3 entradas, 5 blocos, 2 saídas\]

Os quatro arquivos da modelagem criam tudo o que está dentro do retângulo, menos as peças, que o `load` põe a partir do GeoPackage. O GeoServer só lê as views, e o portal só fala com o GeoServer.

## Os quatro arquivos

Os quatro arquivos numerados criam, num PostgreSQL 17 com PostGIS 3.5 vazio, o mesmo banco que o `planaveg-core init-db` cria. São gerados do código com `make modelagem` (em `apps/core`) e não se editam à mão. As peças não estão neles: entram depois, pelo `load`, a partir do GeoPackage.

| Arquivo | O que cria |
| --- | --- |
| `1_tabelas.sql` | a extensão PostGIS, o SRS 100000 do GeoPackage (Albers IBGE), as 36 tabelas com chaves e índices, as 27 UFs, os 6 biomas e o registro da migração 1 |
| `2_funcoes.sql` | as 3 funções que a carga e as views chamam |
| `3_views.sql` | as 50 views (11 materializadas), o registro delas em `objeto_gerado` e o papel `geoserver_leitura`, com o que ele pode ler |
| `4_dados.sql` | o contrato vigente em linhas (versão, níveis, marcas, arranjos, filtros, camadas), os 5.571 municípios do IBGE, as chaves do GeoServer e o primeiro cálculo das materializadas |
| `consultas.sql` | escrito à mão: as consultas que o portal faz ao GeoServer, em SQL, para ler e testar. Não se aplica |

Para criar o banco, aplique os quatro na ordem, numa transação só, com o mesmo usuário que vai rodar a carga (ela recalcula as views materializadas e precisa ser dona delas):

```bash
createdb planaveg
psql -d planaveg -v ON_ERROR_STOP=1 --single-transaction -f 1_tabelas.sql -f 2_funcoes.sql -f 3_views.sql -f 4_dados.sql
```

Depois, `planaveg-core load` lê o GeoPackage e grava as peças, e `planaveg-core verify` confere os números contra o desenho. O passo a passo, inclusive com Docker, está no `modelagem/README.md`.

A regra para guardar: os arquivos criam um banco do zero. Num banco que já existe, quem atualiza é o `init-db`, sem perder a carga.

## As peças

A peça é a unidade do banco: um registro de um ano de VS no GeoPackage, que junta os polígonos com os mesmos atributos no mesmo município e na mesma bacia. Em 2024 são 70.739 peças e 4,75 milhões de polígonos. A carga grava cada peça em três tabelas com a mesma chave, `(entrega_id, ano_vs, origem_id)`. O `origem_id` é o `fid` do GeoPackage: único só dentro da camada de um ano, e renumerado a cada entrega.

| Tabela | Uma linha por | O que guarda |
| --- | --- | --- |
| `peca_recebida` | peça | o que o arquivo diz: o rótulo da hierarquia, a área (`Area_ha`), UF, bioma, município do IBGE, mesobacia, bacia e a `Sobreposicao` como veio |
| `peca_marca` | peça e marca | as marcas da peça (em CAR, em TI, em UC, em projeto…), uma por linha, das 33 do contrato |
| `peca_geometria` | peça | o desenho e o que a carga mede nele |
| `computo_recebido` | ano e linha da hierarquia | o total que o arquivo informa para cada linha; o `verify` confere que é a soma das peças |

O desenho tem quatro formas, cada uma com um uso:

| Coluna | Como sai | Para quê |
| --- | --- | --- |
| `geom_albers` | a geometria recebida, no Albers IBGE (SRS 100000) | medir área e sobreposição |
| `geom` | `geom_albers` em SIRGAS 2000 lat/long (EPSG:4674) | o mapa do zoom 14 em diante e os downloads |
| `geom_alta` | `geom` simplificada a 0,0001° (uns 11 m), sem perder partes | o mapa até o zoom 13 |
| `ponto` | o centroide, em EPSG:4674 | a peça menor que 2×2 pixels, desenhada como círculo |

Mais duas colunas medem: `area_calculada_ha`, a área de `geom_albers` em hectares, e `partes`, quantos polígonos a peça tem. Separar o desenho deixa leve tudo o que não desenha: os atributos ocupam uns 50 MB, a geometria uns 14 GB.

Três pontos que costumam confundir:

- **Duas áreas.** `peca_recebida.area_ha` é o que o arquivo diz; `area_calculada_ha` é o que a carga mediu. O `verify` confere que batem, com tolerância de 0,01 ha.
- **UF e bioma podem ser nulos.** O arquivo diz `FORA` quando a peça cai fora dos limites oficiais, e o banco guarda NULL. Numa peça de borda, a UF pode ser outra que a do município.
- **Peça não é polígono.** O arquivo conta peças; o mapa e o painel contam polígonos. Por isso o clique diz "é um de 4 polígonos com estes mesmos dados".

Nada é reparado na carga: uma geometria inválida entra como veio, e o `verify` a aponta.

## Os lugares

Os lugares dão nome e chave aos recortes dos números: estado, município, bioma e as três escalas de bacia. A peça aponta para cada um por chave estrangeira. UF, bioma ou município fora da lista param a carga, em vez de virar um lugar novo em silêncio; as bacias, a carga cria a partir do próprio arquivo.

| Tabela | Chave | Linhas | De onde vem |
| --- | --- | --- | --- |
| `lugar_uf` | código do IBGE (2 dígitos), sigla única | 27 | fixa, no `1_tabelas.sql` |
| `lugar_bioma` | nome, como o arquivo o escreve | 6 | fixa, no `1_tabelas.sql` |
| `lugar_municipio` | código do IBGE (7 dígitos) | 5.571 | a API de localidades do IBGE, no `4_dados.sql`; o `init-db` a refaz |
| `lugar_regiao_hidrografica` | nome | 12 | o GeoPackage; a carga refaz |
| `lugar_mesobacia` | nome | 54 | o GeoPackage; a carga refaz |
| `lugar_bacia` | mesobacia + nome | 301 | o GeoPackage; a carga refaz |

As contagens de bacias são as da base de 16/10/2026, em que 5.258 municípios têm peças.

- **O código do município carrega a UF.** Os dois primeiros dígitos são o código dela, e uma regra (`CHECK`) confere isso.
- **As bacias não têm código no arquivo**, então a chave é o nome. O nome da bacia se repete entre mesobacias (Araguari, no Amapá e em Minas Gerais), por isso a chave da bacia é a mesobacia mais o nome.
- **O banco não tem a malha de nenhum lugar.** O arquivo traz só o atributo da peça, não os polígonos de UF, município, bacia ou bioma. O contorno do município no mapa é o retângulo das peças dele (view `municipio`).

Os recortes que o portal oferece estão em `contrato_dimensao`: Estado, Município, Bacia, Mesobacia, Região Hidrográfica e Bioma.

## O contrato dentro do banco

As regras moram num arquivo só, o contrato (`contracts/categorias.v1.json`), e o banco as guarda em linhas nas tabelas `contrato_*`. As views leem dali: mudar uma regra é mudar o JSON e rodar o `init-db`, sem tocar no SQL das views. Cada versão do JSON fica para sempre em `contrato_versao`, e só uma é a vigente.

| Conceito | Tabela | O que é | No contrato atual |
| --- | --- | --- | --- |
| Ano de VS | `contrato_ano` | cada ano e a camada do GeoPackage que o traz | 2022 e 2024 |
| Nível | `contrato_nivel`, `contrato_grupo` | a linha da hierarquia do Anexo 1 (o tier), em dois grupos: projetos de recuperação e vegetação secundária em áreas protegidas | 11, de Recooperar a Reserva Legal |
| Condição do CAR | `contrato_condicao_car` | habilitado, analisado ou não analisado, com a situação da planilha de nomenclatura | 3 |
| Hierarquia | `contrato_hierarquia` | o rótulo exato que o arquivo escreve, ligado ao nível e à condição | 16 |
| Marca | `contrato_marca` | uma coluna sim/não do arquivo e a sigla dela na `Sobreposicao` | 33 |
| Arranjo | `contrato_arranjo` e suas regras | o Anexo 2: cada peça cai em um só, por prioridade | 4 |
| Filtro (tema) | `contrato_filtro` e suas regras | os recortes do relatório: uma peça atende quantos couber | 15 |
| Recorte | `contrato_dimensao` | os recortes territoriais dos números | 6 |
| Fonte ausente | `contrato_fonte_ausente` | o que o relatório pede e a base não traz | 8 |
| Camada | `camada_publicada` | as camadas de mapa geradas do contrato | 30 |

### Como uma regra vira linhas

Arranjos e filtros têm regras na mesma forma: uma regra vale se **alguma** alternativa vale, e uma alternativa vale se **todas** as condições dela valem. Uma condição testa um campo da peça contra uma lista: ter alguma das marcas, ter um dos níveis ou estar num dos arranjos. Marcada como `negada`, vale o contrário. Cada valor da lista é uma linha, com chave estrangeira para a marca, o nível ou o arranjo que cita.

O arranjo de áreas públicas, por exemplo, fica assim em `contrato_arranjo_condicao` e `contrato_arranjo_valor`:

| Alternativa | Condição | Valores |
| --- | --- | --- |
| 1 | o nível é um destes | Terras Indígenas, Unidades de Conservação, Sistemas Costeiros |
| 2 | a peça tem uma destas marcas | UC, RPPN, TI, assentamento, quilombola |

Lido em voz alta: a peça entra em áreas públicas se for de um desses níveis **ou** tiver uma dessas marcas.

### Arranjo: um só por peça

Os arranjos têm prioridade, e a peça fica no primeiro cuja regra ela atende:

1. **Áreas públicas**: a regra acima. Meta própria.
2. **APP, RL e AUR**: nível PRADA, APP, AUR ou RL, ou uma marca de APP, RL ou AUR em qualquer condição do CAR, ou a de área a recuperar de CAR em regularização. Meta própria.
3. **Baixa produtividade** (sistemas integrados de produção): sem regra, porque a base não traz o dado. Fica com 0 ha, e o `motivo_ausencia` diz por quê.
4. **Demais áreas de projetos**: o complementar. Fica com o que nenhum outro pegou e não tem meta.

Como cada peça cai num arranjo só, os arranjos dividem a área e podem ser somados. O mesmo vale para os níveis: cada peça tem um.

### Filtro: quantos couber

Os filtros não têm prioridade. A peça guarda, na coluna `temas`, todos os que atende: uma peça pode estar em CAR, em assentamento e em áreas públicas ao mesmo tempo. Por isso temas se sobrepõem e **nunca são somados num total**. Um filtro pode citar um arranjo ("está no arranjo APP, RL e AUR"), e cada um traz também a mesma regra escrita em CQL (`contrato_filtro.cql`), que é o texto que o portal manda ao GeoServer.

### O que falta aparece como ausente

Nada é deduzido. O nível MonitoRAD e o arranjo de baixa produtividade têm `motivo_ausencia`, e o portal os mostra como ausentes, com 0 ha. A lista do que o relatório pede e a base não traz fica em `contrato_fonte_ausente`, como as malhas territoriais e os atributos de UC e TI. Ela sai na view `fonte_ausente`; o portal a busca, mas ainda não a mostra.

Uma exceção à regra "tudo no contrato": a esfera e o tipo de UC (federal, estadual, municipal; APA, RPPN, outras) são montados na view a partir dos nomes das marcas.

## As funções

O `2_funcoes.sql` tem três funções, cada uma com um só trabalho. Elas existem para que a carga, as views e o portal façam a mesma conta do mesmo jeito.

| Função | Quem chama | O que faz |
| --- | --- | --- |
| `geom_de_origem(wkb, srid)` | a carga | lê a geometria do GeoPackage: põe o SRS, tira o Z, faz dela um MultiPolygon e devolve nulo se vier vazia. Para se o SRS não estiver registrado |
| `normalizar_busca(texto)` | as views com busca por nome (`municipio`, `quantitativo_dimensao`) | deixa o nome como o portal compara: sem acento, em minúsculas, só letras, dígitos, espaço, hífen e apóstrofo |
| `condicao_atendida(campo, valores, negada, nivel, arranjo, marcas)` | a view `peca_classificada` | testa uma condição de regra numa peça: tem alguma das marcas, tem um dos níveis ou está num dos arranjos; com `negada`, o contrário |

Dois exemplos que ajudam a explicar:

- `normalizar_busca('Pará (PA)')` dá `para pa`. Por isso digitar "para" no portal acha o Pará, e "bonito ms" acha Bonito (MS). O portal normaliza o que a pessoa digita do mesmo jeito (`termoDeBusca`), e a consulta vira um `busca LIKE '%para%'`.
- `condicao_atendida('marca', ARRAY['uc','rppn'], false, 'app', NULL, ARRAY['car','uc'])` dá verdadeiro: a peça tem a marca `uc`, que está na lista. Uma peça sem nível nunca atende uma condição de nível.

O texto de `2_funcoes.sql` entra nas versões do mapa e dos dados: mudar uma função muda a versão, e o cache de tiles é refeito.

## As views

&#91;embedded content: as 50 views em três famílias · desenho, números e catálogos\]

A classificação é calculada uma vez por carga, e tudo o que o mapa e o painel mostram sai dela. Cada view só lê as que vêm antes dela no `3_views.sql`. As 11 materializadas são recalculadas na carga; as outras rodam a cada consulta.

| View | O que traz | Materializada | Quem usa |
| --- | --- | --- | --- |
| `peca_classificada` | a peça com nível, condição do CAR, uma coluna por marca, arranjo e temas | sim | as outras views; não é publicada |
| `peca`, `peca_<ano>` | as peças com o desenho, de todos os anos ou de um | não | o mapa, o clique, os downloads e o QGIS |
| `espacial_<filtro>_<ano>` | as peças de um filtro espacial num ano | não | os downloads e o QGIS |
| `peca_parte` | um polígono por linha, com a área dele | não | o clique, com o ano e a peça em `viewparams` |
| `municipio` | o retângulo das peças de cada município e o nome para a busca | sim | a busca e o contorno do município |
| `quantitativo_faceta` | a área de cada combinação de filtros no Brasil, uns 4,7 mil por ano | sim | o mapa e o painel, que somam no navegador |
| `quantitativo_faceta_lugar` | as mesmas somas, por lugar | sim | o painel de um lugar |
| `quantitativo_nivel` | a área por nível e condição, com o cômputo do arquivo | sim | a visão geral |
| `quantitativo_categoria` | a mesma área, como na planilha de nomenclatura | sim | os downloads |
| `quantitativo_arranjo` | a área por arranjo, e por nível dentro dele | sim | a visão geral e os downloads |
| `quantitativo_filtro` | a área por tema, e por nível dentro dele | sim | os downloads |
| `quantitativo_dimensao` | os totais de cada lugar e o nome para a busca | sim | o ranking e a busca do painel |
| `serie` | cada recorte, ano a ano, com a diferença para o anterior | sim | o comando `status` e o WFS |
| `catalogo_*`, `fonte_ausente` | o contrato e as camadas, para o portal montar as telas | só `catalogo_camada` | todas as telas |
| `fonte_vigente` | o arquivo no ar e as duas versões | não | todas as telas, antes de tudo |

Três views não são publicadas: `peca_classificada`, `peca_desenhada` e `peca_lugar`. Elas só servem às outras.

## Os registros

Os registros respondem "o que está no ar, desde quando e com que regras": qual arquivo foi carregado, com que contrato, quando foi conferido e publicado, e com que números. Entregas, execuções, publicações e versões do contrato ficam para sempre; `objeto_gerado` e `gt_pk_metadata`, o `init-db` refaz a cada vez.

| Tabela | Uma linha por | Para quê |
| --- | --- | --- |
| `migracao` | migração aplicada | número, nome e SHA-256 do arquivo; o `init-db` aplica as que faltam e para se uma já aplicada mudou |
| `objeto_gerado` | view criada pelo `init-db` | saber o que derrubar e recriar no próximo `init-db`, sem tocar nas views do PostGIS |
| `contrato_versao` | versão do JSON do contrato | a impressão (SHA-256), o conteúdo e qual é a vigente, uma só |
| `entrega` | arquivo carregado com um contrato | o estado: `carregando`, `pronta`, `substituida` ou `falhou` |
| `entrega_camada` | ano de VS de uma entrega | as contagens da carga: feições no arquivo, lidas, carregadas, vazias e a área |
| `execucao` | etapa que rodou | `init-db`, `load`, `verify` ou `geoserver`, com início, fim, ok e o detalhe em JSON |
| `publicacao` | publicação que mudou os dados | a entrega, o contrato e as duas versões |
| `resultado_nivel`, `resultado_serie`, `resultado_faceta` | linha publicada | os números que cada publicação pôs no ar, para comparar depois |
| `gt_pk_metadata` | camada de mapa | diz ao GeoServer que `fid` é a chave de cada camada |

### A entrega pronta

Todas as views das peças leem só a entrega com `estado = 'pronta'`, e um índice garante que existe no máximo uma. A carga troca a entrega anterior pela nova numa transação só: até o fim, quem lê vê a base anterior, e o portal nunca mostra uma base pela metade.

### As duas versões

Cada publicação calcula duas versões, códigos de 16 caracteres que resumem tudo o que muda a resposta:

- **`versao_mapa`**: o SQL das views que desenham tiles e de tudo o que elas leem, os estilos, as funções, as migrações e a identidade da carga (o SHA-256 do arquivo e a última carga dele).
- **`versao_dados`**: o mesmo para todas as views, com os estilos das camadas sem cache.

O portal põe a versão nas URLs (`v=...`). Base nova ou regra nova dão URLs novas, e nem o cache de tiles nem a CDN servem um número velho. O preço: a versão resume o **texto** do SQL. Reindentar uma view desenhada já muda a versão do mapa e esvazia o cache.

A view `fonte_vigente` junta tudo numa linha: o arquivo da entrega pronta, o contrato, quantas peças e as duas versões da última publicação. Se um `init-db`, `load` ou `geoserver` rodou depois dela, as versões saem vazias, porque o banco já não é o que foi publicado. É a primeira coisa que o portal lê.

## O caminho de uma peça

Seguir uma peça do arquivo até o clique no mapa passa por todas as partes do banco, nesta ordem:

1. **O arquivo chega.** O GeoPackage traz uma camada por ano de VS (`contrato_ano` diz qual), com a geometria em Albers e os atributos: o rótulo da hierarquia, `Area_ha`, UF, bioma, município, bacias, uma coluna por marca, a `Sobreposicao` e o cômputo de cada nível.
2. **O `load` confere e grava.** Registra a `entrega` pelo SHA-256 do arquivo e pela versão do contrato, apaga a base anterior com `DELETE` e lê o arquivo em lotes de 1.000 peças. Cada lote é conferido (rótulo, município, UF, bioma, bacias, cômputo) e gravado em `peca_recebida`, `peca_marca` e `peca_geometria` numa sentença só. Um valor fora para a carga com um código, como `municipio_fora_do_ibge`.
3. **A entrega vira `pronta`.** A anterior vira `substituida`, as views materializadas são recalculadas e tudo entra no commit de uma vez. Se algo falha antes, nada muda.
4. **A peça é classificada.** Em `peca_classificada`, ela ganha o nível (pelo rótulo), a condição do CAR, uma coluna por marca, o arranjo (o primeiro por prioridade) e os temas (todos os filtros que atende).
5. **O `verify` confere.** São 16 invariantes: as contagens do arquivo, da carga e das tabelas, a área recebida contra a medida, o cômputo contra a soma das peças, a `Sobreposicao` contra as marcas, a sobreposição entre peças e o que o GeoServer pode ler. Na base final, `pecas_sem_sobreposicao` reprova, porque o próprio arquivo conta duas vezes uma área pequena, e vai aceita pelo nome.
6. **O `geoserver` publica.** Cria ou atualiza cada camada e consulta, calcula as duas versões e registra a publicação. O `semear` gera os tiles do cache.
7. **O portal lê.** Primeiro `fonte_vigente` (as versões), depois os catálogos (`catalogo_*`), os números (`quantitativo_faceta`, somado no navegador) e os tiles de `peca_<ano>`, com o filtro da lateral em CQL.
8. **Alguém clica.** Um `GetFeatureInfo` em `peca_<ano>` acha a peça. Outro, em `peca_parte` (uma linha por polígono, com o ano e o `origem_id` em `viewparams`), acha o polígono clicado e a área dele.

