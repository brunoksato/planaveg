# Resumo do código

Um resumo do projeto para quem vai continuar o trabalho. Ele cobre a modelagem do banco e a base
de código: o que cada parte faz, onde ela está e o que não quebrar. O detalhe fino está no próprio
código. Os termos do domínio estão no [`CONTEXT.md`](../CONTEXT.md), e como rodar está no
[`README.md`](../README.md) e no [README do core](../apps/core/README.md).

## O projeto em poucas linhas

A equipe do Planaveg entrega um GeoPackage, a Base Planaveg. Cada registro é uma **peça** de um
ano de vegetação secundária (2022 ou 2024), já classificada: nível da hierarquia, situação do CAR,
marcas de onde cai e lugar. O sistema carrega, confere e publica esse arquivo num portal público,
o SINAVEG, sem recalcular a metodologia.

```text
GeoPackage ─► planaveg_core ─► PostGIS ─► GeoServer ─► portal
              (Python, CLI)               WMTS · WMS · WFS   (React estático)
```

- O `planaveg_core` é o único que escreve no banco e no GeoServer.
- O GeoServer lê só as views publicadas. Serve o mapa em tiles (WMTS), o clique (WMS) e as tabelas
  e downloads (WFS).
- O portal não tem API própria. Pede tudo ao GeoServer.

Duas regras do produto aparecem em todo o código:

- **Não há dupla contagem.** Níveis e arranjos dividem a área sem sobreposição e podem ser somados.
  Os temas (filtros do relatório) se sobrepõem e nunca são somados num total.
- **O que a base não traz aparece como ausente.** Nada é deduzido. O contrato diz por que um
  nível ou um arranjo falta (`motivo_ausencia`), e o portal o mostra como ausente. A lista das
  fontes que faltam sai na view `fonte_ausente`, e o portal a mostra nos metadados de Acesso aos
  dados.

## Mapa do repositório

| Caminho | O que é |
| --- | --- |
| [`apps/core`](../apps/core) | O `planaveg_core`, em Python 3.13, psycopg 3 e uv |
| [`apps/web`](../apps/web) | O portal: React 19, Vite, TanStack Router e Query, zod/mini, Tailwind v4 |
| [`packages/cartography`](../packages/cartography) | O mapa sobre o Leaflet 1.9.4 (`MapaWms`) |
| [`packages/web-contracts`](../packages/web-contracts) | Um tipo TypeScript por view publicada |
| [`packages/ui`](../packages/ui) | O design system, no padrão do shadcn |
| [`modelagem`](../modelagem) | O banco inteiro em SQL puro, gerado pelo core |
| [`infra`](../infra) | As imagens Docker do core e do portal e, em `producao/`, o servidor: compose, nginx e scripts de implantação |

Banco: PostgreSQL 17 com PostGIS 3.5. Serviços: GeoServer 2.26 com GeoWebCache.

## Rodar localmente

Requisitos e comandos estão no [`README.md`](../README.md). O banco, o GeoServer e o portal estão
no [`compose.yaml`](../compose.yaml) da raiz. A ordem importa:

1. `make run`, em `apps/core`: sobe o PostGIS e roda `init-db`, `load` e `verify`.
2. `make up`, na raiz: sobe o GeoServer, publica e sobe o portal. Publica o que já está no banco,
   por isso vem depois da carga.
3. `make -C apps/core semear`: gera os tiles em cache. Sem ele, cada tile é desenhado na primeira
   visita.

Com a base final, o `make run` termina com erro, e isso é esperado. O `verify` reprova
`pecas_sem_sobreposicao`, porque o próprio arquivo conta duas vezes uma área pequena, de algumas
dezenas de hectares. A decisão foi não corrigir no core. Para seguir, rode
`run-all --aceitar pecas_sem_sobreposicao`.

`make check` roda lint, formatação e tipos do core e do portal. `make test` roda os testes dos
dois. Formate o portal com `pnpm format:web` (oxfmt, não Prettier).

---

# Parte 1: a modelagem

## O contrato manda em tudo

As regras moram num arquivo só,
[`categorias.v1.json`](../apps/core/src/planaveg_core/contracts/categorias.v1.json). Dele saem a
conferência do arquivo, as tabelas de regras, as views, os estilos e os catálogos do portal. O
pacote [`contrato/`](../apps/core/src/planaveg_core/contrato/) é esse JSON em Python: `leitura.py`
lê e confere, `modelo.py` tem as dataclasses imutáveis e `predicados.py` traduz as regras.

| Bloco | O que traz |
| --- | --- |
| `recipiente` | o arquivo: nome, versão, SHA-256, SRS e tipo de geometria |
| `camadas` | uma por ano de VS |
| `colunas` | as 46 colunas. 13 são do modelo (`ATRIBUTOS`) e 33 são marcas |
| `sobreposicao` | a ordem das siglas na coluna `Sobreposicao` |
| `hierarquia` e `grupos` | as 17 linhas do Anexo 1, em 11 tiers, e os dois grupos do cômputo |
| `arranjos` | os quatro, em ordem de prioridade, com as metas de 2030 |
| `filtros` | os 15 temas do relatório, cada um com um predicado |
| `dimensoes` e `fontes_ausentes` | os recortes territoriais e o que falta |

**Colunas do modelo e marcas.** As 13 colunas do modelo têm lugar fixo no banco e o SQL as escreve
pelo nome: rótulo do nível, área, lugares, cômputo e `Sobreposicao`. Todas as outras são marcas.
Uma marca nova muda só o contrato: vira uma linha em `contrato_marca` e uma coluna nas views, sem
migração. A marca UC vem da sigla `UC` da `Sobreposicao`, e não da coluna `UC`, que desde a base
de 16/10/2026 marca também APA e RPPN.

**Predicados.** A regra de um arranjo ou filtro é um objeto JSON de uma chave: `marca`, `nivel`,
`arranjo`, ou `ou`, `e` e `nao` para combinar. O mesmo predicado vira duas coisas:

```text
JSON   {"ou": [{"nivel": ["terra_indigena", "uc", "manguezal"]},
               {"marca": ["uc", "rppn", "terra_indigena", "assentamento", "quilombola"]}]}
Linhas alternativa 1: nivel em {...}   alternativa 2: marca em {...}
CQL    (nivel IN ('terra_indigena', 'uc', 'manguezal') OR (uc = true OR rppn = true OR ...))
```

`alternativas()` põe a regra em forma normal disjuntiva, e o `init-db` grava uma linha por
condição em `contrato_arranjo_condicao` ou `contrato_filtro_condicao`. `cql()` escreve o texto que
vai para `catalogo_filtro.cql`, e o portal o manda ao GeoServer sem conhecer as marcas.

Dois arranjos não têm predicado. O último é o complementar: fica com o que nenhum outro pegou (as
demais áreas de projetos, sem meta). O `ausente` não pega nada e leva um `motivo_ausencia`. É o
caso dos sistemas integrados de produção, até a base trazer as técnicas com fins econômicos.

**O contrato falha fechado.** Todo comando começa com `carregar_contrato`, que recusa o que não
reconhece com um `PlanavegError`: marca, nível ou arranjo desconhecido num predicado, palavra
reservada do PostgreSQL como código, código de filtro longo demais para o nome da view, e outros.
Um contrato inválido não chega ao banco.

Uma segunda trava pega o contrato que mudou depois da carga. O `load` grava a impressão do
contrato (o SHA-256 de `recipiente`, `camadas` e `colunas`). Se ela muda, `verify` e `geoserver`
param com `contrato_diverge_da_carga` até um `load` novo. Mudar uma cor pede só
`init-db` e `geoserver`. Mudar o `marcado` de uma marca pede `load`.

## Como o banco é criado

O `init-db` aplica, nesta ordem:

1. `sql/000_extensions.sql`: o PostGIS e o SRS 100000 (Albers do arquivo, conferido pelos
   parâmetros, porque 100000 não é um código EPSG).
2. `sql/010_registro.sql`: os registros `migracao` e `objeto_gerado`.
3. As migrações que faltam, de [`sql/migracoes/`](../apps/core/src/planaveg_core/sql/migracoes/).
   Hoje há uma, `0001_modelo.sql`, com todas as tabelas.
4. `sql/030_funcoes.sql`: as funções.
5. Depois, em [`banco/estrutura.py`](../apps/core/src/planaveg_core/banco/estrutura.py): guarda a
   versão do contrato, derruba e recria as views, acerta as tabelas de regras e os municípios,
   recria o papel de leitura e as permissões e calcula as materializadas.

O `init-db` pode rodar de novo sem perder a carga. Leva minutos porque recalcula as materializadas.
Com `--recreate`, ele descarta as peças (a entrega `pronta` vira `substituida`).

**Migrações.** Cada arquivo `NNNN_nome.sql` roda uma vez e fica em `migracao` com o SHA-256 dele.
Uma migração aplicada não muda mais: se o arquivo mudou, o `init-db` para com `migracao_alterada`.
Mudar uma tabela é escrever a migração seguinte, que preserva o que o arquivo não refaz: versões do
contrato, entregas, execuções e publicações. Views, funções e linhas de regras não são migradas,
porque o `init-db` as refaz a cada vez.

**Regras no lugar.** As peças apontam para as tabelas de regras com chaves estrangeiras, então elas
não podem ser apagadas e recriadas. O SQL sai de
[`publicacao/referencia.py`](../apps/core/src/planaveg_core/publicacao/referencia.py), em dois
grupos:

- **Refeitas** (arranjos, filtros, dimensões, camadas): nada da carga aponta para elas, então saem
  e entram de novo.
- **Mantidas** (níveis, condições do CAR, rótulos da hierarquia, marcas, municípios): atualizadas
  pela chave natural. Renomear um rótulo da hierarquia leva as peças junto (`ON UPDATE CASCADE`).

Se o contrato tira uma linha mantida que as peças usam, o `init-db` para com
`contrato_tira_o_que_a_carga_usa`. A saída é `init-db --recreate` e um `load` com o arquivo novo.

## As tabelas

São 36 tabelas, todas em `public`, criadas em `0001_modelo.sql`. Leia-as em
[`modelagem/1_tabelas.sql`](../modelagem/1_tabelas.sql).

| Grupo | Tabelas | Para que |
| --- | --- | --- |
| Registro | `migracao`, `objeto_gerado`, `execucao` | migrações aplicadas, views geradas, uma linha por etapa rodada |
| Contrato e entregas | `contrato_versao`, `entrega`, `entrega_camada` | cada versão do contrato (JSON e SHA-256, uma vigente), cada arquivo carregado e o que se leu de cada camada |
| Publicações | `publicacao`, `resultado_nivel`, `resultado_serie`, `resultado_faceta` | cada publicação que mudou os dados, com os números que ela pôs no ar |
| Lugares | `lugar_uf`, `lugar_municipio`, `lugar_bioma`, `lugar_regiao_hidrografica`, `lugar_mesobacia`, `lugar_bacia` | as referências territoriais |
| Regras do contrato | `contrato_ano`, `contrato_grupo`, `contrato_nivel`, `contrato_condicao_car`, `contrato_hierarquia`, `contrato_marca`, `contrato_arranjo`, `contrato_arranjo_condicao`, `contrato_arranjo_valor`, `contrato_filtro`, `contrato_filtro_condicao`, `contrato_filtro_valor`, `contrato_dimensao`, `contrato_fonte_ausente` | o JSON em linhas, que as views leem com `JOIN` |
| Peças | `peca_recebida`, `peca_marca`, `peca_geometria`, `computo_recebido` | a base carregada |
| GeoServer | `camada_publicada`, `gt_pk_metadata` | as camadas publicadas e a chave `fid` de cada uma |

O banco guarda as peças de uma entrega só. Guarda para sempre as entregas, as versões do contrato
e os números de cada publicação. Assim dá para dizer o que o portal mostrava em cada data, com
poucos MB por publicação. O desenho de cada base, uns 14 GB, fica no GeoPackage arquivado.

O município é o do IBGE, pelo código e com o nome oficial, de
[`referencia/municipios.csv`](../apps/core/src/planaveg_core/referencia/municipios.csv). Bioma e
bacia ficam pelo nome, porque o arquivo não traz código deles. A UF e o bioma `FORA`, de quem cai
fora dos limites oficiais, ficam NULL no banco e voltam como `FORA` nas saídas.

## A peça em três tabelas

A chave da peça é `(entrega_id, ano_vs, origem_id)`. O `origem_id` é o `fid` do GeoPackage, único
só dentro da camada e renumerado a cada entrega. Três tabelas têm essa chave:

- **`peca_recebida`**: o que o arquivo diz e não tem outro lugar. O rótulo do nível, com chave
  estrangeira para `contrato_hierarquia` (de onde saem tier e condição do CAR), a área, os lugares,
  cada um com chave estrangeira, e a `Sobreposicao` como veio.
- **`peca_marca`**: uma linha por marca, com chave estrangeira para `contrato_marca`.
- **`peca_geometria`**: o desenho e o que a carga mede nele.

| Coluna do desenho | Como sai |
| --- | --- |
| `geom_albers` | a recebida, no SRS 100000 |
| `geom` | `ST_Transform` para EPSG:4674 |
| `geom_alta` | `geom` simplificada a 0,0001° (uns 11 m), sem perder parte. O mapa a lê até o zoom 13 |
| `ponto` | o centroide, em EPSG:4674 |
| `area_calculada_ha` | a área de `geom_albers`, em hectares |
| `partes` | quantos polígonos a peça tem |

O cômputo de cada linha da hierarquia num ano vai uma vez só para `computo_recebido`.

A separação deixa leve tudo o que não desenha. Os atributos têm uns 50 MB. Os 14 GB de geometria
só entram nas camadas do mapa, no clique e na conferência das geometrias. As marcas e o desenho
apontam para a peça com chaves conferidas só no commit, para a carga gravar as três tabelas numa
sentença só.

Nada é reparado: uma geometria inválida entra como veio, e o `verify` a aponta. Cada geometria do
mapa tem índice GiST. A `geom_albers` não tem, porque o `verify` monta tabelas temporárias com
índice próprio.

Em 2024 são 70.739 peças e 4,75 milhões de polígonos, com até 16.591 numa peça só.

## A carga

O `load`, em [`carga/pecas.py`](../apps/core/src/planaveg_core/carga/pecas.py), troca a base
inteira numa transação só:

1. Registra a entrega pelo SHA-256 do arquivo e pela versão do contrato
   ([`carga/entrega.py`](../apps/core/src/planaveg_core/carga/entrega.py)). O mesmo arquivo com o
   mesmo contrato reaproveita a linha. A `pronta` anterior vira `substituida`.
2. Apaga com `DELETE` as peças, as marcas, o cômputo e as bacias da base anterior.
3. Lê cada camada com o `sqlite3` do Python, sem GDAL, em lotes de 1.000 peças. Cada lote vai por
   `COPY` a uma tabela temporária (`pouso`) e é conferido: rótulo, tier e condição, município, UF,
   bioma, bacias e cômputo. Um valor fora para a carga com um código, como
   `municipio_fora_do_ibge`, `hierarquia_fora_do_contrato` ou `computo_recebido_diverge`. Depois o
   lote vai às três tabelas numa sentença só.
4. Marca a entrega como `pronta` e recalcula as materializadas.

O SQL de cada lote está em [`banco/pecas.py`](../apps/core/src/planaveg_core/banco/pecas.py).

Um valor que não converte para o tipo do contrato vira NULL numa coluna anulável, contado em
`anuladas`, e derruba a carga numa obrigatória
([`carga/conversores.py`](../apps/core/src/planaveg_core/carga/conversores.py)). Um nome de
município diferente do IBGE só vira aviso.

Até o commit, quem lê vê a base anterior inteira. Se algo falha, nada muda. Por isso a base
anterior sai com `DELETE`, e não com `TRUNCATE`, que bloquearia a leitura até o fim. O preço:

- As duas bases ocupam o disco durante a carga. Conte com o dobro do tamanho das peças.
- O `VACUUM` roda depois do commit, noutra conexão, e só avisa se falhar.
- Depois de um `--recreate`, não há base anterior para onde voltar.

## As views

As views saem do contrato, montadas em
[`publicacao/`](../apps/core/src/planaveg_core/publicacao/). `views(contrato)`, em `todas.py`,
devolve a lista na ordem das dependências: cada view só lê as anteriores. São 50 em
[`modelagem/3_views.sql`](../modelagem/3_views.sql), 11 delas materializadas.

| Grupo | Views |
| --- | --- |
| Classificação | `peca_classificada` (materializada), `peca_desenhada`, `peca_lugar` |
| Camadas de mapa | `peca`, `peca_<ano>`, `espacial_<filtro>_<ano>`, `municipio` (materializada), `peca_parte` |
| Números | `quantitativo_faceta`, `quantitativo_faceta_lugar`, `quantitativo_nivel`, `quantitativo_categoria`, `quantitativo_arranjo`, `quantitativo_filtro`, `quantitativo_dimensao`, `serie` (todas materializadas) |
| Catálogos | `catalogo_camada` (materializada), `catalogo_ano`, `catalogo_nivel`, `catalogo_arranjo`, `catalogo_filtro`, `catalogo_dimensao`, `fonte_ausente` |
| Estado | `fonte_vigente` |

**A classificação.** `peca_classificada` é a peça sem o desenho, com o nível, o grupo, o arranjo,
a situação do cadastro e os temas que ela atende. A função `condicao_atendida` testa cada condição
contra o nível, o arranjo e as marcas. A peça atende uma regra se atende todas as condições de
alguma alternativa. Ela fica no primeiro arranjo que atende, ou no complementar. Os filtros vêm
depois, porque podem citar o arranjo. É materializada para as regras rodarem uma vez por carga, e
não a cada tile. Mudar uma regra e rodar `init-db` reclassifica tudo sem recarga.

**As camadas.** `peca_desenhada` junta a classificação ao desenho pela chave. `peca` tem as colunas
públicas, e `peca_<ano>` é a camada que o portal desenha e filtra por CQL. O `fid` é
`ano_vs × 10⁹ + fid do GeoPackage`, para os anos não colidirem. `espacial_<filtro>_<ano>` traz as
peças de cada tema e fica para o QGIS.

**`peca_parte`.** Desmonta a peça em polígonos com `ST_Dump`, medindo cada um no Albers. Desmontar
não usa índice, então ela é publicada como SQL view do GeoServer com dois parâmetros obrigatórios:

```sql
SELECT * FROM peca_parte WHERE ano_vs = %ano_vs% AND origem_id = %origem_id%
```

Sem `viewparams`, cada parâmetro vale 0 e a resposta vem vazia. O validador só aceita algarismos.

**Números e facetas.** Cada peça tem um nível, um arranjo e um valor por dimensão, então somar por
esses eixos não repete peça. Os temas se sobrepõem e nunca se somam. `quantitativo_faceta` agrupa
as peças por ano e combinação de atributos, com os temas em texto na coluna `temas`. Cada peça cai
numa linha só. O portal soma as linhas que atendem à seleção, e uma linha com dois temas escolhidos
conta uma vez. `quantitativo_faceta_lugar` faz o mesmo por lugar.

**Materializadas.** Cada uma declara uma `chave`, que vira o índice único `<nome>_chave` com
`NULLS NOT DISTINCT`. Com ele, o recálculo é `CONCURRENTLY`, e o GeoServer segue lendo o conteúdo
anterior até o commit. Uma linha repetida faz o recálculo falhar, em vez de o portal somá-la duas
vezes.

**`fonte_vigente`.** Traz a entrega pronta e as duas versões gravadas no último `geoserver`
bem-sucedido. Anula as versões enquanto uma etapa que mexe nos dados está rodando ou terminou
depois da publicação. O portal lê essa view primeiro.

## O papel de leitura

O GeoServer entra como `geoserver_leitura`
([`banco/papel.py`](../apps/core/src/planaveg_core/banco/papel.py)). Como tudo mora em `public`, a
fronteira é a permissão. A cada `init-db`, o papel perde tudo e ganha `SELECT` só nas views
publicadas e em `gt_pk_metadata`, e o `verify` confere que ele não lê mais nada. Uma tabela ou
view nova fica de fora sem nada a fazer; só a publicada entra.

A senha vem de `GEOSERVER_PG_PASSWORD` e vai ao `ALTER ROLE` como verificador SCRAM-SHA-256,
calculado em Python, para nunca passar pelo log do PostgreSQL.

## A pasta `modelagem/`

O banco inteiro em SQL puro, em quatro arquivos, na ordem de aplicar:

| Arquivo | O que tem |
| --- | --- |
| [`1_tabelas.sql`](../modelagem/1_tabelas.sql) | PostGIS, o SRS, as tabelas, as chaves, os índices, as UFs, os biomas e o registro da migração |
| [`2_funcoes.sql`](../modelagem/2_funcoes.sql) | as funções |
| [`3_views.sql`](../modelagem/3_views.sql) | as views, o registro delas, o papel e as permissões do GeoServer |
| [`4_dados.sql`](../modelagem/4_dados.sql) | a versão do contrato, as regras e os municípios em linhas, as chaves e o cálculo das materializadas |

Cada arquivo junta o que o `init-db` roda, na mesma ordem: os scripts de `sql/` como estão, com os
comentários, e os comandos que o código monta
([`banco/modelagem.py`](../apps/core/src/planaveg_core/banco/modelagem.py)). Num PostGIS vazio,
eles dão o banco do `init-db`, com os mesmos registros, sem peças e sem senha.
Daí, o `load` carrega o GeoPackage, e um `init-db` depois atualiza o banco. O
[README da pasta](../modelagem/README.md) traz os comandos desse caminho, com e sem Python.

Os quatro são gerados: não edite à mão. Mudou o contrato, uma view ou uma migração? Rode
`make modelagem` em `apps/core`. Ao lado deles, escritos à mão, ficam o README e o
`consultas.sql`, com as consultas que o portal faz ao GeoServer, em SQL.

Um teste de integração (`tests/integration/test_modelagem.py`) cria um banco pelos arquivos,
compara com o do `init-db` e roda o caminho inteiro: `load`, `verify` e um `init-db` por cima.

## A conferência

O banco garante sozinho o que as chaves estrangeiras alcançam. O `verify`
([`conferencia/`](../apps/core/src/planaveg_core/conferencia/)) confere o resto: somas, áreas,
geometrias e o que o GeoServer lê. São 16 invariantes, registradas em `todas.py`:

| # | Invariante | O que confere |
| --- | --- | --- |
| 1 | `entrega_unica_pronta` | uma entrega pronta só |
| 2 | `contagens_reconciliadas` | arquivo, carga e tabelas contam o mesmo |
| 3 | `geometria_recebida_mensuravel` | a simplificada não ficou vazia, o reparo não muda a área |
| 4 | `hierarquia_coberta_pelo_contrato` | todo nível presente no contrato tem peças em cada ano |
| 5 | `area_recebida_igual_geometria` | o `Area_ha` de cada peça é a área do desenho |
| 6 | `computo_recebido_fecha` | o cômputo de cada nível é a soma das peças |
| 7 | `sobreposicao_igual_as_marcas` | a `Sobreposicao` é a junção das siglas das marcas |
| 8 | `classificacao_particiona_pecas` | toda peça tem nível e arranjo, e os dois somam o mesmo |
| 9 | `facetas_somam_o_computo` | as facetas somam as peças |
| 10 | `facetas_por_lugar_somam_os_recortes` | as facetas por lugar somam cada recorte |
| 11 | `pecas_sem_sobreposicao` | peças do mesmo ano não se sobrepõem (a única cara, dezenas de minutos) |
| 12 | `papel_leitura_so_publicado` | o papel do GeoServer lê só o publicado |
| 13 | `fid_unico_por_camada` | cada camada existe e tem `fid` único |
| 14 | `filtros_espaciais_publicados` | cada tema espacial tem camada em cada ano |
| 15 | `gt_pk_metadata_cobre_camadas` | toda camada tem `fid` em `gt_pk_metadata` |
| 16 | `carga_executada_com_sucesso` | a entrega pronta tem um `load` que terminou bem |

Cada invariante roda na sua própria transação. Um erro do banco desfaz só ela, que sai `ERRO`, e as
outras seguem. `--rapido` pula a 11ª. `--aceitar <invariante>` aceita uma reprovação conhecida
pelo nome. Uma que deu `ERRO` nunca é aceita. Saída 0 sem reprovação fora do `--aceitar`, 1 com
alguma, 2 em qualquer outro erro.

## Como estender o banco

Tudo o que o banco publica sai do código. Para mudar, mude o contrato ou o código e rode as etapas.
Não crie view nem publique camada à mão: a próxima rodada apaga (o porquê está no fim desta seção).

### Um filtro novo, ou um agrupamento

1. Acrescente o filtro no bloco `filtros` do
   [contrato](../apps/core/src/planaveg_core/contracts/categorias.v1.json):

   ```json
   {
     "codigo": "areas_protegidas",
     "grupo": "Vegetação Secundária em Áreas Legalmente Protegidas",
     "titulo": "Áreas protegidas",
     "tipo": "ambos",
     "status": "presente",
     "cor": "#1b9e77",
     "predicado": {"ou": [{"marca": ["uc", "apa", "rppn", "terra_indigena"]},
                          {"nivel": ["manguezal"]}]}
   }
   ```

   - O predicado junta `marca`, `nivel` e `arranjo`, cada um com uma lista de códigos, por `ou`,
     `e` e `nao`. Agrupar é isso.
   - `tipo`: `espacial` e `ambos` ganham uma camada de mapa por ano; `quantitativo` fica só nos
     números.
   - `status`: `presente`, `parcial` ou `vazio`, o quanto a base traz do que o relatório pede.
   - `subtitulo` e `nota` são opcionais. O `codigo` tem até 49 caracteres e não pode ser palavra
     reservada do PostgreSQL.

2. Rode, em `apps/core`:

   ```bash
   make modelagem
   uv run planaveg-core init-db
   uv run planaveg-core geoserver
   uv run planaveg-core semear
   ```

Não precisa de migração nem de `load`. O `init-db` grava as regras, reclassifica as peças e cria
as views `espacial_<codigo>_<ano>`. O `geoserver` publica as camadas e o estilo. As regras entram na
versão do mapa, então o cache de tiles esvazia, e o `semear` o refaz.

O predicado não alcança:

- **lugar** (UF, município, bioma, bacia): é dimensão, e já está nas facetas e em
  `quantitativo_dimensao`;
- **um atributo que ainda não é marca**: veja a receita seguinte;
- **outra geometria**, como uma malha que o arquivo não traz: pede uma tabela nova e código de
  carga;
- **uma faixa numérica** ou **um filtro feito de outro filtro**: pede um operador novo em
  `contrato/predicados.py`.

### Uma marca nova

A marca é uma coluna do GeoPackage. O arquivo e o contrato têm de ter as mesmas colunas: se a base
traz uma coluna nova, o `inspect` para com `gpkg_colunas_divergentes` até ela entrar no contrato.

1. Acrescente a coluna em `colunas`, com o texto que liga a marca em `marcado`:
   `{"origem": "QL", "destino": "quilombola", "tipo": "marca", "marcado": "QL", "descricao": "..."}`.
2. Se ela aparece na coluna `Sobreposicao`, ponha a sigla em `sobreposicao`, na ordem em que o
   arquivo junta as siglas.
3. Rode `make modelagem`, `init-db`, `load`, `verify`, `geoserver` e `semear`.

Não precisa de migração: a marca vira uma linha em `contrato_marca`, as peças que a têm vão para
`peca_marca`, e a coluna dela nas views sai do contrato. Precisa de `load`, porque a carga lê a
marca do arquivo. Até ele, `verify` e `geoserver` param com `contrato_diverge_da_carga`.

### Uma view nova

Para o que o predicado não expressa, como uma soma nova ou uma camada de outra forma, escreva a
view no código:

1. Num módulo de [`publicacao/`](../apps/core/src/planaveg_core/publicacao/), escreva uma função
   que devolve `View(nome, corpo, "Título | descrição", ...)`. O `quantitativo_filtro`, em
   `quantitativos.py`, é um bom modelo. As opções:
   - `publicada=True`: o GeoServer a lê. Sem isso, o papel de leitura nem a vê.
   - `espacial=True` e `estilos=(...)`: é camada de mapa. Precisa de uma coluna `fid` única, e o
     estilo tem de existir em `estilos.py`.
   - `tiles=True`: entra no cache de tiles.
   - `materializada=True`: precisa de `chave=(...)`, as colunas que identificam uma linha.
2. Ponha a função na lista de `publicacao/todas.py`, depois de tudo o que ela lê.
3. Rode `make modelagem`, `init-db` e `geoserver`.

A view nova ganha, como as outras, o registro, a permissão, a camada no GeoServer, a versão e o
lugar na `modelagem/`. Os testes de `test_publicacao.py` conferem a ordem, a chave e o tamanho do
nome.

### Uma tabela nova

1. Escreva a migração seguinte, `sql/migracoes/0002_<nome>.sql`. Não edite uma migração que já
   rodou num banco que importa: o `init-db` desse banco para com `migracao_alterada`.
2. Se a carga enche a tabela, ela entra em `TABELAS_DA_CARGA` (`banco/pecas.py`), antes das
   tabelas para onde ela aponta. Se guarda regras do contrato, entra em `MANTIDAS` ou `REFEITAS`
   (`publicacao/referencia.py`).
3. Rode `make modelagem` e `init-db`.

O GeoServer não a vê: o papel de leitura só lê as views publicadas.

### Por que não à mão

Uma view criada direto no banco e publicada à mão no GeoServer some na rodada seguinte:

- o `init-db` derruba as views geradas com `CASCADE`, e leva junto a que lê alguma delas;
- o `init-db` tira do papel do GeoServer toda permissão em `public` e só devolve a das views
  geradas, e esvazia o `gt_pk_metadata` de `public`;
- o `geoserver` apaga do datastore `planaveg_core` toda camada sem view gerada e, do workspace
  `planaveg`, todo estilo que o contrato não gera.

Ela também fica fora das versões e da `modelagem/`.

---

# Parte 2: a base de código

## O core: pacotes

Os caminhos são relativos a [`apps/core/src/planaveg_core/`](../apps/core/src/planaveg_core/).

| Pacote ou arquivo | O que faz |
| --- | --- |
| `config.py` | `Settings.from_env()` lê as variáveis de ambiente uma vez por comando |
| `errors.py` | `PlanavegError(codigo, detalhe)`. O código é estável e os testes o conferem |
| `rest.py` | a REST do GeoServer, com `urllib` |
| `etapas.py` | os nomes das etapas, que são também o valor de `execucao.etapa`. Renomear esconde o histórico |
| `gpkg.py` | `inspecionar`: confere o GeoPackage contra o contrato, só para leitura |
| `contrato/`, `contracts/` | o contrato e a leitura dele |
| `sql/`, `banco/` | estrutura, migrações, regras, papel, registro das etapas, publicações, `modelagem` |
| `carga/` | o `load` |
| `conferencia/` | o `verify` |
| `publicacao/` | o SQL de todas as views |
| `estilos.py` | os SLD das camadas, gerados do contrato |
| `geoserver/` | a publicação no GeoServer e as duas versões |
| `cache/` | o GeoWebCache: configuração, semeadura e aquecimento dos filtros |
| `cli/` | a linha de comando |
| `referencia/` | a lista de municípios do IBGE |

**Regras de import.** O `import-linter` confere a ordem das camadas no `make check`.
[`tests/test_arquitetura.py`](../apps/core/tests/test_arquitetura.py) confere mais duas regras:
entre pacotes, só vale o que o `__all__` do `__init__.py` exporta, e um nome com `_` é privado do
arquivo. `from planaveg_core.contrato.modelo import Contrato` é recusado.

## O core: a linha de comando

O script `planaveg-core` aponta para `planaveg_core.cli:main`. Os comandos e as opções estão no
[README do core](../apps/core/README.md).

- [`cli/comandos/`](../apps/core/src/planaveg_core/cli/comandos/) tem um arquivo por comando, com
  uma função `cmd_<nome>(settings, args)` que devolve o código de saída.
- `cli/parser.py` registra cada subcomando. Um comando novo é um arquivo e uma chamada a `comando`.
- `print` só é permitido no `cli`. O log vai para o erro padrão, em DEBUG com `-v`.

**Registro das etapas.** `init-db`, `load`, `verify` e `geoserver` abrem uma linha em `execucao`
com `banco.registrar`
([`banco/registro.py`](../apps/core/src/planaveg_core/banco/registro.py)) e a confirmam antes de
começar. Se a etapa levanta uma exceção, até um Ctrl+C, ele desfaz o trabalho, grava `ok = false`
com o código do erro e relança. Com `VERSOES_VIGENTES` definida, ele também mantém um arquivo
vazio por versão vigente nesse diretório, para o servidor web saber o que pode guardar em cache.

**Saída.** `PlanavegError` sai com 2. Uma tabela ou coluna que falta sai com 2 e a dica
`rode init-db`. Ctrl+C sai com 130. O SIGTERM vira Ctrl+C, porque no container o `planaveg-core`
é o processo 1 e o Linux não lhe entrega um sinal sem tratador.

**A ordem das etapas numa base nova:** `run-all` (`init-db`, `load`, `verify`), depois `geoserver`,
depois `semear` e `aquecer`. O `geoserver` calcula as versões com a carga, então vem depois dela. O
`semear` vem depois do `geoserver`, que esvazia o cache quando a versão muda. O passo a passo, do
arquivo recebido à produção e com cada mudança de estrutura, está em
[`base-nova.md`](./base-nova.md).

## O core: GeoServer, versões e cache

`publicar_geoserver` ([`geoserver/publicar.py`](../apps/core/src/planaveg_core/geoserver/publicar.py))
cria ou atualiza, em ordem: o workspace `planaveg`, o datastore com o papel `geoserver_leitura`, os
estilos (só os que mudaram), uma camada por view publicada, a remoção do que saiu do contrato, o
cache de cada camada com tiles e as duas versões. No fim, se os dados mudaram, grava a publicação e
os números dela em `publicacao` e `resultado_*`.

**As duas versões** ([`geoserver/versoes.py`](../apps/core/src/planaveg_core/geoserver/versoes.py))
são SHA-256 cortados em 16 caracteres:

| Versão | Resume | Vai na URL de |
| --- | --- | --- |
| `versao_mapa` | a carga, o SQL das camadas desenhadas e do que elas leem, as regras e os estilos | os tiles das peças e dos temas |
| `versao_dados` | tudo: todas as views, todas as tabelas de regras e todos os estilos | as consultas WFS e WMS |

Toda URL de dado leva a versão (`v=`). Base nova é URL nova. Mas o `v=` não entra na chave do
GeoWebCache, então o `geoserver` esvazia o cache quando a versão do mapa muda.

**O texto é a versão.** A versão resume o texto do SQL, não o resultado. Reindentar o SQL de uma
view desenhada ou mudar o título de um nível esvazia o cache dos tiles no próximo `geoserver`, e
a semeadura precisa rodar de novo.

**O GeoWebCache** guarda PNG de 24 bits na grade `EPSG:900913`. A chave de cada tile inclui o
`STYLES` e, nas peças de cada ano, o `CQL_FILTER`. O CQL aceito é `(?U)[\w ,'()=]{0,4000}`: um
filtro com `<`, `>`, `-` ou `.` é recusado.

**Semear e aquecer** ([`cache/`](../apps/core/src/planaveg_core/cache/)). `semear` gera os tiles
que faltam: a vista nacional e a regional de todas as camadas primeiro, depois o detalhe. Nas
peças, o detalhe é só do ano mais recente, o único que o portal desenha; os outros anos entram
no cache na primeira visita (pelo QGIS). `aquecer` gera, nessa mesma camada e até o zoom 8, os
tiles dos filtros mais comuns. A parte delicada é mandar os parâmetros como o WMTS os guarda,
senão os tiles semeados nunca são lidos: o WMTS tira da chave o estilo padrão, mas guarda o
`CQL_FILTER` vazio quando o estilo é outro.

**O CQL é a chave do cache, dos dois lados.** O portal escreve cada filtro sempre igual
(`cqlDosFiltros`, em [`cql.ts`](../apps/web/src/modules/filtros/utils/cql.ts)): dimensões numa
ordem fixa, `coluna IN ('a', 'b')` com os valores em ordem, temas por último. O `aquecer` escreve o
mesmo texto (`_em`, em [`aquecimento.py`](../apps/core/src/planaveg_core/cache/aquecimento.py)). Se
um lado mudar o formato, mude o outro. Nenhum teste compara os dois.

**Os estilos** ([`estilos.py`](../apps/core/src/planaveg_core/estilos.py)) têm três faixas de
escala: até o zoom 7 e do 8 ao 13 leem a `geom_alta`, do 14 em diante a geometria inteira. A peça
menor que 2×2 pixels vira um círculo do tamanho que teria na tela, com piso de 1,5 pixel. Até o
zoom 7, as peças maiores vão por cima, numa passada só, para nenhum tipo parecer maior só por vir
por cima. As cores vêm do contrato.

## O portal: estrutura

[`apps/web/src/`](../apps/web/src/):

| Pasta | O que tem |
| --- | --- |
| `main.tsx` | cria o cliente do TanStack Query, o do GeoServer e o roteador |
| `app/` | o roteador, o ambiente (`env.ts`) e a casca |
| `routes/` | uma rota por página. `routeTree.gen.ts` é gerado delas |
| `modules/` | um módulo por página: `visao-geral`, `mapa`, `painel`, `dados`, e `filtros`, usado pelo mapa e pelo painel |
| `shared/` | o cliente do GeoServer, os serviços, os utilitários e os componentes comuns |
| `test/` | os ajudantes dos testes |

As quatro páginas:

| Página | Endereço | O que mostra |
| --- | --- | --- |
| Visão geral | `/` | quanto se atingiu da meta nacional, com a parte de cada arranjo e de cada grupo |
| Mapa | `/mapa` | as áreas da base mais recente, com filtros, busca de município e clique |
| Painel | `/painel` | indicadores, metas de 2030 e cartões por assunto, do Brasil ou de um lugar |
| Acesso aos dados | `/dados` | downloads, metadados e serviços web |

**Regras de import**, no [`oxlint.json`](../oxlint.json):

- Ninguém importa `@/modules/*/*`, o miolo de um módulo. Um módulo entra pelo `index.ts`.
- O `shared` não importa `modules`, `app` nem `routes`. Os módulos não importam `app` nem `routes`.
- Todo import entre pastas usa o atalho `@/`, que é o que as regras reconhecem. `import/no-cycle`
  recusa ciclos.

Se uma função de um módulo serve a outro, exporte-a pelo `index.ts` ou leve-a para o `shared`.

## O portal: dados e estado

**O cliente do GeoServer**
([`shared/api/geoserver.ts`](../apps/web/src/shared/api/geoserver.ts)) monta todas as URLs de WFS,
WMS e WMTS. Ao lado dele, `pedidos.ts` tem os parâmetros de cada pedido, e `respostas.ts` lê as
respostas e os erros. Os `*.service.ts` fazem os pedidos pelo cliente. A versão dos dados mora
dentro do cliente, e só o catálogo a troca.

**O catálogo** ([`catalogo.service.ts`](../apps/web/src/shared/services/catalogo.service.ts)) lê
primeiro `versao_dados` de `fonte_vigente`, sem `v=`, e guarda a versão. Depois pede as tabelas do
catálogo num pedido só. Todo hook de dados passa por `useDados`
([`catalogo.queries.ts`](../apps/web/src/shared/services/catalogo.queries.ts)):

```ts
export function useQuantitativoNivel(api: GeoServerApi) {
  return useDados(api, ["quantitativo_nivel"], (signal) => buscarQuantitativoNivel(api, signal));
}
```

O `useDados` espera o catálogo e põe a versão na chave, logo depois do nome da tabela. Sem isso,
o pedido sairia antes do catálogo e sem versão, e a tela não acompanharia uma base nova.

**A URL é o estado.** Cada página com parâmetros tem um schema zod/mini no `parametros.ts` do
módulo, e o tipo do estado sai dele. Um valor fora do formato vira `undefined` e a página usa o
padrão. As peças estão em
[`shared/utils/parametros.ts`](../apps/web/src/shared/utils/parametros.ts). Mapa e painel navegam
com `replace: true`, passando a busca pelo schema antes da mudança.

**Nomes e números.** [`glossario.ts`](../apps/web/src/shared/utils/glossario.ts) dá nomes simples
aos códigos do catálogo e mostra o nome oficial na dica. Um código novo aparece com o nome oficial
até ganhar verbete. Regra, cor e ordem vêm sempre do catálogo. Os textos que concordam com o
recorte, como "as bacias" e "num estado", pegam as palavras em `palavrasDoGenero`.
[`formatos.ts`](../apps/web/src/shared/utils/formatos.ts) escreve todos os números: área que
arredonda para zero vira "menos de 0,1 ha", e o sinal de menos é "−".

**Tipos.** [`packages/web-contracts`](../packages/web-contracts/src/index.ts) tem um tipo por view
com os nomes das colunas do PostGIS. Renomear uma coluna é mudar o core, este pacote e o portal
juntos.

## O portal: o mapa

[`modules/mapa/`](../apps/web/src/modules/mapa/), [`modules/filtros/`](../apps/web/src/modules/filtros/)
e [`packages/cartography/`](../packages/cartography/).

**Estado.** Tudo o que muda a imagem fica na URL: os seis filtros, a ordem da legenda, opacidade,
mapa base, município e a vista. O mapa mostra só a base mais recente, sem dizer o ano. Ele abre sem
tipos de área marcados. Todos marcados desenham do cache, sem filtro de tipo.

`Mapa` junta sete hooks: estado, números, município, zoom aos estados, clique, destaque e camadas. `montarCamadas` ([`utils/camadas.ts`](../apps/web/src/modules/mapa/utils/camadas.ts))
transforma o estado numa lista de camadas, cada uma com um `id` estável.

**Filtros.** Os nomes da URL não batem com as colunas: `categorias` é `nivel`, `situacoes` é
`categoria` (a condição do CAR), `caminhos` é `arranjo`, `estados` e `biomas` são `uf` e `bioma`, e
`temas` usa o CQL de cada tema. A situação vem na URL pelas duas condições da planilha
(`em_conformidade`, `nao_analisado`), e o CQL as troca pelas três situações da base.

O módulo [`filtros/`](../apps/web/src/modules/filtros/) serve ao mapa e ao painel. Em `utils/`,
`filtros.ts` tem as dimensões e a coluna de cada uma, `facetas.ts` soma as facetas, `cql.ts`
escreve o filtro do GeoServer e `url.ts` põe os filtros na URL.

**Números da lateral.** O mapa baixa as cerca de 4,7 mil linhas de `quantitativo_faceta` do ano e
soma no navegador. Marcar um filtro não faz pedido.

**O clique** ([`identificacao.service.ts`](../apps/web/src/modules/mapa/services/identificacao.service.ts))
faz dois `GetFeatureInfo`: um em `peca_<ano>`, com o filtro da lateral, acha a peça; outro em
`peca_parte`, com `viewparams`, acha o polígono no mesmo pixel. Se o polígono não vem, um WFS
pede o contorno da peça inteira (`geom_alta`). Um clique novo cancela o anterior.

**O pacote de cartografia.** O `MapaWms` não conhece os dados: recebe as camadas e devolve a
vista, o clique e o estado de carga. Três cuidados:

- `sincronizar` ([`gerenciador.ts`](../packages/cartography/src/camadas/gerenciador.ts)) compara
  cada camada pela URL. Com outra URL, cria a nova e mantém a anterior até a nova carregar, para
  não piscar.
- `tirar` chama `removeFrom(mapa)` antes de `off()`. Na ordem inversa, o Leaflet quebra no
  movimento seguinte. `gerenciador.test.ts` guarda essa ordem.
- `comEsperaDeZoom` embrulha o `_update` interno do Leaflet, nas camadas de tiles do cache, para
  não pedir tiles de níveis que ninguém vê. Por isso o Leaflet está fixado em `1.9.4`. O limite de zoom fora do cache
  (`FORA_DO_CACHE`, em `utils/constantes.ts`) copia o `semear`: mude os dois juntos.

## O portal: painel, dados e visão geral

**Painel** ([`modules/painel/`](../apps/web/src/modules/painel/)). Soma as facetas no navegador,
como o mapa: `quantitativo_faceta` no Brasil, `quantitativo_faceta_lugar` num lugar. Conta
polígonos, não peças, porque é o que o mapa desenha. As metas de 2030 vêm do contrato, uma por
arranjo, e o progresso só aparece no Brasil inteiro e sem filtros, porque as metas são nacionais.
Só os três arranjos do plano ganham caixa. As demais áreas de projetos ficam numa nota e seguem no
total. O CSV de cada cartão é montado no navegador, igual ao da tela
([`utils/csv.ts`](../apps/web/src/modules/painel/utils/csv.ts)). O
[`usePainel`](../apps/web/src/modules/painel/hooks/usePainel.ts) junta o que a tela mostra, em
quatro partes: o lugar escolhido, os filtros, os números e o link para o mesmo lugar no mapa.

**Acesso aos dados** ([`modules/dados/`](../apps/web/src/modules/dados/)). Só lê o catálogo. Os
downloads são links WFS do próprio GeoServer, com `v=`. As partes da página ficam em `SECOES`. Nos
metadados, `VisaoFontesAusentes` mostra a `fonte_ausente` por grupo e some quando a lista vem vazia.

**Visão geral** ([`modules/visao-geral/`](../apps/web/src/modules/visao-geral/)). Lê
`quantitativo_nivel` e `quantitativo_arranjo` inteiras.

**Gráficos** ([`shared/components/graficos/`](../apps/web/src/shared/components/graficos/)). HTML
e SVG, sem biblioteca: barras, rosca e barras divididas. O desenho é `aria-hidden`, e todo número
também aparece em texto e numa tabela.

## Testes

| Suíte | Contra o quê | Rode com |
| --- | --- | --- |
| Core, unidade | o contrato real e falsos do banco, do GeoServer e do GeoPackage | `uv run pytest -m "not integration"`, em `apps/core` |
| Core, integração | o PostGIS local, com a base carregada | `uv run pytest -m integration`, em `apps/core` |
| Portal e cartografia | um GeoServer em memória, no jsdom | `pnpm test:web`, na raiz |

Os testes guardam só o que falharia em silêncio ou quebraria o acordo entre as partes: o
contrato que falha fechado, as colunas do modelo contra o JSON, as migrações, o que o GeoServer
pode ler, a conferência, a carga numa transação só, a `modelagem/` em dia, as versões, a chave do
cache, o CQL dos filtros, as somas das facetas, a `fonte_ausente` nos metadados e as armadilhas do
Leaflet. Texto de tela, nomes e cópia do JSON não têm teste.

**Core sem banco.** Usa o contrato de verdade: mudar o JSON muda os testes, de propósito. Os
falsos ficam em [`tests/`](../apps/core/tests/): `geoserver_falso.py` substitui
`planaveg_core.rest.urlopen` e anota cada pedido, e `gpkg_sintetico.py` grava em milissegundos um
GeoPackage com quadrados no Albers (lado de 100 m = 1 ha).

**Core com banco.** Os testes de `tests/integration/` rodam no banco de desenvolvimento e são
pulados sem ele. Os que escrevem usam `con.transaction(force_rollback=True)` ou criam um banco
`planaveg_teste_<pid>` e o apagam no fim. Um teste novo que escreve precisa fazer o mesmo, porque a
conexão está em autocommit. Se o processo morrer no meio, apague as sobras à mão
(`\l planaveg_teste_*` e `\du planaveg_teste_*`).

**Portal.** Os testes ficam ao lado do código (`*.test.ts(x)`). As telas recebem um `GeoServerApi`,
e `geoserverFixture()` ([`test/utils.tsx`](../apps/web/src/test/utils.tsx)) o implementa sobre
tabelas em memória ([`test/fixtures.ts`](../apps/web/src/test/fixtures.ts), com números reais que
fecham entre si). O WFS falso só entende `=`, `IS NULL`, `IN` e `LIKE`, e falha alto no resto.

**Onde está o teste de quê.** No core, um arquivo por pacote, com o nome dele. As exceções:
`test_load.py` prova `carga`, `test_gwc.py` prova `cache/gwc.py` e `cache/semeadura.py`, e o
pacote `geoserver` é provado em `test_publicacao.py` e `test_gwc.py`. O CQL dos filtros tem um
teste de cada lado, `cql.test.ts` no portal e `test_aquecimento.py` no core, e nenhum compara
os dois.

## O que não quebrar

Uma lista curta do que mais pega quem chega:

- **A base final reprova o `verify`.** É a sobreposição do próprio arquivo. Use
  `--aceitar pecas_sem_sobreposicao`, e leia a linha dela no log: a aceitação vale pelo nome,
  qualquer que seja o tamanho.
- **Contrato mudou depois da carga?** `contrato_diverge_da_carga` até um `load`. Cor e título só
  pedem `init-db` e `geoserver`.
- **Tirou do contrato algo que as peças usam?** `contrato_tira_o_que_a_carga_usa`. Saída:
  `init-db --recreate` e `load`.
- **Filtro, marca, view ou tabela nova?** Siga [Como estender o banco](#como-estender-o-banco).
- **Mexeu no contrato, numa view ou na carga?** Rode `make modelagem`.
- **Mexeu no texto do SQL de uma view desenhada?** A versão do mapa muda e o cache esvazia.
- **Mexeu no formato do CQL?** Mude `cqlDosFiltros` no portal e `_em` no core juntos.
- **Renomeou uma coluna publicada?** Mude o core, o `web-contracts` e o portal juntos.
- **Hook de dados novo?** Use `useDados`: ele espera o catálogo e põe a versão na chave.
- **Sem `COMMENT ON` no banco.** Documente com `--` no SQL ou com docstring.

**Ponto em aberto.** As duas situações do cadastro no CAR estão em dois lugares: no contrato
(`situacao` das linhas da hierarquia, que as views e o aquecimento leem) e em `CONDICOES_CAR`, em
[`glossario.ts`](../apps/web/src/shared/utils/glossario.ts), que monta os filtros do portal. Mudar
a divisão num lugar só aquece filtros que ninguém pede. Publicar a situação em `catalogo_nivel` e
montar os filtros de lá deixaria a regra num lugar só.
