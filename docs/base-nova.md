# Base nova: do GeoPackage recebido ao portal

Este é o passo a passo para trocar a base do SINAVEG por um GeoPackage novo. Quando o arquivo tem a
mesma estrutura do anterior, a troca é a carga de sempre. Quando a estrutura muda, o contrato (e às
vezes o código) muda antes, e a [segunda parte](#quando-a-estrutura-muda) diz o que fazer em cada
caso. A [terceira](#quando-as-regras-ou-os-textos-mudam) trata do que muda sem arquivo novo: um
filtro, um arranjo, um título. O [sumário](#sumário-das-mudanças) lista todos os casos.

A carga troca a base inteira numa transação só. Até ela terminar, o portal mostra a base anterior;
se ela falhar, nada muda.

Os comandos `uv run planaveg-core` e `make` rodam em `apps/core`, com o banco do
[`compose.yaml`](../compose.yaml) no ar (`make up`, em `apps/core`, sobe o banco). Os que citam
`docs/gpkg/` rodam na raiz do repositório. Os tempos são os da base nacional num Mac.

## O caminho

1. [Guardar o arquivo](#1-guardar-o-arquivo).
2. [Descobrir o que mudou](#2-descobrir-o-que-mudou).
3. [Atualizar o contrato](#3-atualizar-o-contrato), sempre, e mais se a estrutura mudou.
4. [Carregar e conferir](#4-carregar-e-conferir).
5. [Comparar com a base anterior](#5-comparar-com-a-base-anterior).
6. [Publicar no seu computador e olhar o portal](#6-publicar-no-seu-computador).
7. [Registrar no Git](#7-registrar-no-git).
8. [Levar para a produção](#8-levar-para-a-produção).

## Sumário das mudanças

Cada linha é um tipo de mudança: quem avisa, o que mudar e o que rodar. O `run-all` é o do
[passo 4](#4-carregar-e-conferir). "Volta ao produtor" quer dizer pedir um arquivo corrigido a quem
o gerou.

**Dados novos, mesma estrutura**

| Mudança | Quem avisa | O que mudar | O que rodar | Caso |
| --- | --- | --- | --- | --- |
| Só os números mudaram | ninguém: o `inspect` passa | o `sha256` | `run-all` | [passo 5](#5-comparar-com-a-base-anterior) |
| Um cômputo ou uma área que não fecha | a carga ou o `verify` | nada: o arquivo volta ao produtor | — | [passo 4](#4-carregar-e-conferir) |

**No arquivo: camadas, colunas e formato**

| Mudança | Quem avisa | O que mudar | O que rodar | Caso |
| --- | --- | --- | --- | --- |
| Camada renomeada | `inspect` | `camadas` | `run-all` | [A](#a-camada-renomeada) |
| Ano novo | `inspect` | `camadas` | `run-all` | [B](#b-ano-novo) |
| Ano que saiu | `inspect` | `camadas` | `run-all` | [C](#c-ano-que-saiu) |
| Coluna renomeada | `inspect` | `colunas` | `run-all` | [D](#d-coluna-renomeada) |
| Marca nova | `inspect` | `colunas` e o portal | `run-all` | [I](#i-marca-nova) |
| Marca que saiu | `inspect` | `colunas`, as regras e o portal | `run-all --recreate` | [J](#j-marca-que-saiu) |
| Coluna de outro tipo | `inspect` | nada: o arquivo volta ao produtor | — | [K](#k-coluna-de-outro-tipo) |
| Coluna a mais, que não interessa | `inspect` | nada, ou o código | — | [R](#r-coluna-a-mais-que-não-interessa) |
| Atributo novo que o portal usa | `inspect` | o código, uma migração e o portal | `run-all` | [S](#s-atributo-novo-que-precisa-entrar) |
| Outra versão do GeoPackage | `inspect` | `recipiente` | `run-all` | [P](#p-versão-do-geopackage) |
| Polígono no lugar de multipolígono | `inspect` | `recipiente` | `run-all` | [Q](#q-outro-sistema-de-coordenadas-ou-outra-geometria) |
| Outro sistema de coordenadas | `inspect` | o código e uma migração | `run-all` | [Q](#q-outro-sistema-de-coordenadas-ou-outra-geometria) |

**Nos valores: rótulos, marcas e lugares**

| Mudança | Quem avisa | O que mudar | O que rodar | Caso |
| --- | --- | --- | --- | --- |
| Rótulo renomeado | a carga | `hierarquia` | `run-all` | [E](#e-rótulo-novo-ou-renomeado-na-hierarquia) |
| Rótulo com outro tier ou outra condição | a carga | `hierarquia` | `run-all`, às vezes com `--recreate` | [E](#e-rótulo-novo-ou-renomeado-na-hierarquia) |
| Nível novo | a carga | `hierarquia`, as regras e o portal | `run-all` | [F](#f-nível-novo) |
| Nível ausente que passa a vir | a carga | `hierarquia` e `fontes_ausentes` | `run-all` | [F](#f-nível-novo) |
| Nível que deixa de vir | o `verify` | `hierarquia` | `init-db` e `verify` | [F](#f-nível-novo) |
| Condição do CAR nova | a carga | `hierarquia`, as marcas, as regras e o portal | `run-all` | [G](#g-condição-do-car-nova) |
| Texto de uma marca | a carga | `colunas` | `run-all` | [H](#h-o-texto-de-uma-marca-mudou) |
| Sigla nova ou outra ordem na `Sobreposicao` | o `verify` | `sobreposicao` e o portal | `run-all` | [L](#l-sobreposicao-sigla-nova-sigla-que-saiu-ou-outra-ordem) |
| Município novo | a carga | a lista do IBGE | `run-all` | [M](#m-município-novo) |
| UF ou bioma novo | a carga | uma migração e o portal | `run-all` | [N](#n-uf-ou-bioma-novo) |
| Mesobacia em duas regiões | a carga | nada: o arquivo volta ao produtor | — | [O](#o-bacias) |

**Só no contrato: regras e textos, com ou sem arquivo novo**

| Mudança | Quem avisa | O que mudar | O que rodar | Caso |
| --- | --- | --- | --- | --- |
| Regra que cita um código que saiu | o contrato, em qualquer comando | a regra | — | [T](#t-regras-que-citam-o-que-mudou) |
| Filtro novo, no mapa ou só nos números | ninguém: é uma decisão | `filtros` | `init-db` e `geoserver` | [U](#u-filtro-novo) |
| Filtro que muda ou sai | ninguém | `filtros` | `init-db` e `geoserver` | [V](#v-filtro-que-muda-ou-sai) |
| Arranjo com regra nova, ou arranjo novo | ninguém | `arranjos`, `filtros` e o portal | `init-db` e `geoserver`; com marca nova, `run-all` | [W](#w-arranjo-que-muda-ou-arranjo-novo) |
| Título, cor, texto ou meta | ninguém | o campo, e o glossário do portal | `init-db` e `geoserver` | [X](#x-títulos-cores-textos-e-metas) |
| Grupo novo, ou nível que muda de grupo | ninguém | `grupos`, `hierarquia` e o portal | `init-db` e `geoserver` | [Y](#y-grupo-novo-ou-nível-que-muda-de-grupo) |
| Fonte ausente nova | ninguém | `fontes_ausentes` | `init-db` e `geoserver` | [Z](#z-fonte-ausente-e-recorte-novo) |
| Recorte novo, como uma fitofisionomia | ninguém | o código, uma migração e o portal | `run-all` | [Z](#z-fonte-ausente-e-recorte-novo) |

Depois do `geoserver`, o `semear` refaz o cache de tiles quando o desenho do mapa mudou: uma regra,
uma cor, um título. A [terceira parte](#quando-as-regras-ou-os-textos-mudam) tem os comandos, no seu
computador e na produção.

## 1. Guardar o arquivo

O core procura o GeoPackage em `docs/gpkg/`, com o nome que o contrato diz
(`recipiente.arquivo_referencia`): `Planaveg_2026_Categorias_Visualizacao.gpkg`. A variável
`GPKG_PATH` aponta para outro caminho, se for preciso.

Renomeie o arquivo atual com a data dele e ponha o novo no lugar. Mova, não copie: cada base tem
uns 7,5 GB.

```bash
mv docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg docs/gpkg/Planaveg_2026_Categorias_Visualizacao_2026-10-16.gpkg
mv ~/Downloads/<arquivo recebido>.gpkg docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg
```

Anote o SHA-256 e o tamanho do arquivo novo. Eles vão para o contrato e para o
[README da pasta](./gpkg/README.md):

```bash
shasum -a 256 docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg
stat -f %z docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg
```

## 2. Descobrir o que mudou

### O `inspect`

Ele confere o arquivo contra o contrato, sem banco, em segundos: a versão do GeoPackage, as
camadas, o sistema de coordenadas e o nome e o tipo de cada coluna.

```bash
uv run planaveg-core inspect
```

Se ele passa, a estrutura é a mesma: siga para o [passo 3](#3-atualizar-o-contrato). Se ele para, o
código do erro diz o caso:

| Erro | O que quer dizer | Caso |
| --- | --- | --- |
| `gpkg_camadas_divergentes` | uma camada sumiu ou apareceu (o detalhe lista `ausentes` e `extras`) | [A](#a-camada-renomeada), [B](#b-ano-novo), [C](#c-ano-que-saiu) |
| `gpkg_colunas_divergentes` | numa camada, uma coluna sumiu, apareceu ou mudou de tipo (`ausentes`, `extras`, `tipos`) | [D](#d-coluna-renomeada), [I](#i-marca-nova), [J](#j-marca-que-saiu), [K](#k-coluna-de-outro-tipo), [R](#r-coluna-a-mais-que-não-interessa), [S](#s-atributo-novo-que-precisa-entrar) |
| `gpkg_user_version_divergente`, `gpkg_application_id_divergente` | o arquivo foi gravado por outra ferramenta ou versão | [P](#p-versão-do-geopackage) |
| `gpkg_srid_divergente_do_contrato`, `gpkg_srs_parametros_divergentes`, `gpkg_geometria_inesperada` | outro sistema de coordenadas ou outro tipo de geometria | [Q](#q-outro-sistema-de-coordenadas-ou-outra-geometria) |
| `gpkg_nao_encontrado`, `gpkg_invalido` | o arquivo não está onde o core procura, ou não é um GeoPackage | [passo 1](#1-guardar-o-arquivo) |

O `inspect` não lê valores. Um rótulo novo na hierarquia, um município novo ou o texto de uma marca
que mudou só aparecem na carga. Para ver antes, olhe dentro do arquivo.

### Olhar dentro do arquivo

O GeoPackage é um banco SQLite, e o `sqlite3` do Mac o lê. Com `-readonly`, nada é gravado. Os
exemplos usam a camada de 2024; a de 2022 se chama `Planaveg_2026_Visualizacao_vs22q`.

```bash
G=docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg
CAMADA=Planaveg_2026_Visualizacao_vs2224q
```

A versão do arquivo e as camadas, com o sistema de coordenadas de cada uma:

```bash
sqlite3 -readonly $G "PRAGMA application_id;" "PRAGMA user_version;" \
  "SELECT table_name, srs_id FROM gpkg_contents WHERE data_type = 'features';"
```

As colunas de uma camada, comparadas com as do arquivo anterior (a linha com `<` saiu, a com `>`
entrou):

```bash
ANTIGO=docs/gpkg/Planaveg_2026_Categorias_Visualizacao_2026-10-16.gpkg
diff <(sqlite3 -readonly $ANTIGO "SELECT name, type FROM pragma_table_info('$CAMADA')") \
     <(sqlite3 -readonly $G "SELECT name, type FROM pragma_table_info('$CAMADA')")
```

Entre a base de 05/10 e a de 16/10/2026, por exemplo, ele mostra as duas marcas que entraram:
`GEF_Terrestre` e `Restauracao_Ecologica`.

Os rótulos da hierarquia, com o tier e a condição do CAR de cada um. Cada combinação tem de estar em
`hierarquia` no contrato, com o mesmo texto:

```bash
sqlite3 -readonly -header -column $G \
  "SELECT hierarquia_planaveg, tier, categoria, count(*) AS pecas FROM $CAMADA GROUP BY 1, 2, 3 ORDER BY 2, 3;"
```

Os valores de uma marca. Só podem aparecer o vazio e o texto do `marcado` dela no contrato:

```bash
sqlite3 -readonly -header -column $G "SELECT CAR_Habilitado AS valor, count(*) AS pecas FROM $CAMADA GROUP BY 1;"
```

As siglas da `Sobreposicao`, das mais comuns para as mais raras:

```bash
sqlite3 -readonly -header -column $G \
  "SELECT Sobreposicao, count(*) AS pecas FROM $CAMADA GROUP BY 1 ORDER BY 2 DESC;"
```

A UF e o bioma (os valores têm de estar nas listas do banco, mais o marcador `FORA`):

```bash
sqlite3 -readonly $G "SELECT DISTINCT UF FROM $CAMADA ORDER BY 1;" "SELECT DISTINCT Bioma FROM $CAMADA ORDER BY 1;"
```

Os municípios do arquivo que não estão na lista do IBGE do pacote (sem saída, nenhum):

```bash
comm -23 <(sqlite3 -readonly $G "SELECT DISTINCT cod_municipio FROM $CAMADA;" | LC_ALL=C sort) \
         <(tail -n +2 apps/core/src/planaveg_core/referencia/municipios.csv | cut -d, -f1 | LC_ALL=C sort)
```

## 3. Atualizar o contrato

O contrato é [`categorias.v1.json`](../apps/core/src/planaveg_core/contracts/categorias.v1.json).

**Sempre:** troque o `sha256` em `recipiente` pelo do arquivo novo. Sem isso a carga funciona, mas
fica registrada com `fingerprint_ok=false`. Troque também a data, o SHA-256 e o tamanho em
[`docs/gpkg/README.md`](./gpkg/README.md).

**Se a estrutura mudou:** faça o que o caso pede, na [segunda parte](#quando-a-estrutura-muda).

**Depois, sempre**, em `apps/core`:

```bash
make modelagem
make check
uv run pytest -m "not integration"
```

O `make modelagem` refaz os arquivos de `modelagem/`, que levam o contrato. Ele e os testes leem o
contrato e param num contrato que não fecha: uma marca citada numa regra e ausente das colunas, uma
sigla sem marca, um código que é palavra reservada do PostgreSQL. O erro tem um nome claro e sai
antes de chegar ao banco. O `make check` confere o código Python.

## 4. Carregar e conferir

O `run-all` confere o arquivo e roda `init-db`, `load` e `verify`, nesta ordem. Leva cerca de 1h30
(a carga, uns 50 minutos; a conferência, uns 40):

```bash
uv run planaveg-core run-all --aceitar pecas_sem_sobreposicao
```

Se o `init-db` parar com `contrato_tira_o_que_a_carga_usa`, o contrato tirou algo que a base atual
usa (uma marca, um nível, um rótulo, um município). Rode de novo com `--recreate`: ele descarta a
base atual antes de carregar a nova.

Se a carga parar, o código do erro diz o caso. Nada muda no banco até ela terminar bem.

| Erro na carga | O que quer dizer | Caso |
| --- | --- | --- |
| `hierarquia_fora_do_contrato` | um rótulo da hierarquia que o contrato não tem | [E](#e-rótulo-novo-ou-renomeado-na-hierarquia), [F](#f-nível-novo), [G](#g-condição-do-car-nova) |
| `hierarquia_diverge_do_tier` | um rótulo conhecido com outro tier ou outra condição do CAR | [E](#e-rótulo-novo-ou-renomeado-na-hierarquia) |
| `marca_com_valor_inesperado` | uma marca com um texto diferente do `marcado` do contrato | [H](#h-o-texto-de-uma-marca-mudou) |
| `municipio_fora_do_ibge` | um código de município fora da lista do IBGE do pacote | [M](#m-município-novo) |
| `uf_fora_da_lista`, `bioma_fora_da_lista` | uma UF ou um bioma que o banco não conhece | [N](#n-uf-ou-bioma-novo) |
| `mesobacia_em_duas_regioes` | a mesma mesobacia em duas regiões hidrográficas | [O](#o-bacias) |
| `computo_recebido_diverge` | o cômputo de um nível muda de uma peça para outra no mesmo ano | pergunta ao produtor do arquivo |
| `valor_obrigatorio_ausente`, `valor_incompativel`, `valor_nao_finito` | uma coluna obrigatória vazia, ou um valor que não converte para o tipo | [K](#k-coluna-de-outro-tipo), ou pergunta ao produtor |

Por exemplo, num arquivo de teste com duas peças de "Outros projetos" no mesmo ano, uma com cômputo
1,0 e outra com 2,0, a carga parou com
`computo_recebido_diverge: Outros projetos (MMA, ICMBio e demais órgãos)`. O cômputo é um número só
por nível e por ano, e a diferença é do arquivo.

O `verify` confere 16 invariantes. Na base final, só `pecas_sem_sobreposicao` pode reprovar, e vai
aceita pelo nome: é uma área pequena que o próprio arquivo conta duas vezes. Leia a linha dela no
log: na base de 16/10/2026 eram 19,1 ha em 2022 e 26,8 ha em 2024. Qualquer outra reprovação para
o processo:

- `area_recebida_igual_geometria`, `computo_recebido_fecha`: os números do arquivo não fecham com o
  desenho. É pergunta para o produtor.
- `sobreposicao_igual_as_marcas`: a `Sobreposicao` deixou de ser a junção das siglas das marcas.
  Veja o caso [L](#l-sobreposicao-sigla-nova-sigla-que-saiu-ou-outra-ordem).
- `hierarquia_coberta_pelo_contrato`: um nível do contrato ficou sem peças num ano. Se for de
  propósito, o nível vira ausente (caso [F](#f-nível-novo)).

## 5. Comparar com a base anterior

Antes de publicar, compare os números. O `status` mostra a entrega e as contagens:

```bash
uv run planaveg-core status
```

O banco guarda os números de cada publicação. A consulta abaixo põe a área de cada nível em 2024 ao
lado da última publicação, que ainda é a da base anterior. Rode-a antes do `geoserver` do passo 6,
que grava a publicação nova:

```bash
docker compose -f ../../compose.yaml exec db psql -U planaveg -d planaveg -c "
SELECT n.tier, n.categoria, round(r.area_ha) AS antes_ha, round(n.area_ha) AS agora_ha,
       round(n.area_ha - coalesce(r.area_ha, 0)) AS diferenca_ha
FROM quantitativo_nivel n
LEFT JOIN resultado_nivel r
  ON r.publicacao_id = (SELECT max(id) FROM publicacao)
 AND r.ano_vs = n.ano_vs AND r.tier = n.tier AND r.categoria IS NOT DISTINCT FROM n.categoria
WHERE n.ano_vs = 2024
ORDER BY n.tier, n.categoria"
```

Num banco sem publicação anterior, a coluna `antes_ha` sai vazia. Como referência, a base de
16/10/2026 tinha, em 2024, 70.739 peças e 8,81 milhões de ha. Uma mudança grande num nível ou num
arranjo é pergunta para o produtor antes de publicar.

**Exemplo real:** da base de 05/10 para a de 16/10/2026, além das duas marcas novas (caso
[I](#i-marca-nova)), os números de 2024 mudaram assim:

- as peças caíram de 80.932 para 70.739: 7.519 peças de APP, AUR e RL vinham sem a marca do CAR,
  passaram a tê-la e se juntaram às vizinhas iguais;
- a área total foi de 8.803.112,70 para 8.811.323,42 ha;
- o tier 4 (Projetos de Cooperação MMA) ganhou 37.263 ha, e o tier 5 (Observatório) perdeu
  28.202 ha: áreas do Observatório passaram para as fontes novas do tier 4;
- nenhum rótulo mudou.

Cada diferença tinha uma explicação, e a base foi publicada.

Na produção, o script de atualização publica logo depois da carga. Para comparar lá, use a
penúltima publicação no lugar da última:

```sql
ON r.publicacao_id = (SELECT id FROM publicacao ORDER BY id DESC OFFSET 1 LIMIT 1)
```

## 6. Publicar no seu computador

Em `apps/core`, publique no GeoServer local. As versões mudam com a base, e o cache de tiles
esvazia:

```bash
make geoserver
```

Para ver o mapa já com os tiles prontos, rode também o `semear`, que leva bastante tempo
(`uv run planaveg-core semear`). Depois suba o portal, na raiz do repositório:

```bash
docker compose up --build -d --wait web
```

Em <http://localhost:4173>, confira:

- a visão geral, com o total e os arranjos;
- o mapa, com um tipo de área marcado e um clique numa peça;
- o painel de um estado.

## 7. Registrar no Git

Faça o commit do contrato, da `modelagem/`, do `docs/gpkg/README.md` e do código, se mudou. O
GeoPackage não vai para o Git: a pasta `docs/gpkg/` o ignora.

## 8. Levar para a produção

A produção tem o mesmo core, num `compose` próprio ([`infra/producao/`](../infra/producao/)). O
GeoPackage fica em `/srv/planaveg/gpkg/`, e o script de atualização roda a mesma sequência:
`run-all`, `geoserver`, `semear` e o aquecimento dos filtros comuns. Quando só o contrato mudou, sem
arquivo novo, o caminho é mais curto: veja a [terceira parte](#quando-as-regras-ou-os-textos-mudam).

**1. Se o código ou o contrato mudou, implante antes.** Rode da raiz de um checkout limpo, no commit
do passo 7, porque o script envia também os arquivos modificados e os novos:

```bash
SERVIDOR=root@<servidor> SSH_CHAVE=<chave ssh> infra/producao/implantar.sh
```

Se o portal passou a pedir uma coluna nova (uma marca no clique, por exemplo), rode a atualização
da base, abaixo, logo depois do deploy: até o `init-db` recriar as views, o clique falha.

**2. Mande o arquivo.** O `cat` pelo ssh leva uns 3 minutos; o `rsync` do Mac leva bem mais com um
arquivo desse tamanho.

```bash
cat docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg \
  | ssh -i <chave ssh> root@<servidor> 'cat > /srv/planaveg/gpkg/.Planaveg_2026_Categorias_Visualizacao.gpkg.novo'
```

No servidor, confira o SHA-256 contra o do passo 1, guarde o anterior com a data e ponha o novo no
lugar:

```bash
cd /srv/planaveg/gpkg
sha256sum .Planaveg_2026_Categorias_Visualizacao.gpkg.novo
mv Planaveg_2026_Categorias_Visualizacao.gpkg Planaveg_2026_Categorias_Visualizacao_2026-10-16.gpkg
mv .Planaveg_2026_Categorias_Visualizacao.gpkg.novo Planaveg_2026_Categorias_Visualizacao.gpkg
```

**3. Atualize a base.** Toda base nova muda a versão do mapa: o cache de tiles esvazia, e o script
o refaz. O comando volta na hora, e o log mostra o andamento. Leva de 2 a 3 horas: a
carga e a conferência, uns 30 minutos cada; o `semear`, uns 20; o aquecimento, mais de uma hora.

```bash
ssh -i <chave ssh> root@<servidor> 'cd /opt/planaveg/app && setsid nohup bash -c "infra/producao/atualizar-base.sh; echo FIM saida=\$?" > /opt/planaveg/carga.log 2>&1 < /dev/null & disown'
ssh -i <chave ssh> root@<servidor> 'tail -f /opt/planaveg/carga.log'
```

Se no seu computador foi preciso `--recreate`, ponha-o depois de `atualizar-base.sh`. Nesse caso o
portal fica sem peças até a carga terminar, uns 30 minutos.

**4. Confira o portal** como no passo 6, já no endereço público. A Cloudflare guarda a versão por 60
segundos: logo depois da publicação, ela ainda pode mostrar a anterior.

### Desfazer

A carga apaga as peças anteriores do banco; o que fica é o arquivo anterior, guardado com a data.
Para voltar, ponha o arquivo anterior no lugar do novo e rode a atualização de novo. Se o contrato
mudou, volte também o código ao commit anterior e implante antes.

---

## Quando a estrutura muda

Cada caso diz como ele aparece, o que mudar, o que muda no portal e na produção, e traz um exemplo.
Os exemplos de teste foram provocados de propósito num GeoPackage pequeno, com três peças por ano, e
mostram a resposta do core. Os reais aconteceram em bases recebidas. No terminal, a mensagem vem
depois da hora, do nível `ERROR` e do módulo; os exemplos mostram só o código e o detalhe.

O contrato e o arquivo têm de ter as mesmas camadas e as mesmas colunas, com os mesmos tipos: uma
diferença para o `inspect`. As colunas são de dois tipos:

- **As 13 do modelo**, com lugar fixo no banco: o rótulo do nível (`hierarquia_planaveg`), `tier`,
  `categoria`, `computo`, `Area_ha`, `UF`, `Bioma`, `Municipio`, `cod_municipio`, `Bacia`,
  `Bacia_meso`, `Regiao_Hidrografica` e `Sobreposicao`. A lista está em `ATRIBUTOS`
  ([`contrato/modelo.py`](../apps/core/src/planaveg_core/contrato/modelo.py)).
- **As marcas**, todas as outras: colunas de sim ou não. O vazio é "não", e o texto do `marcado` é
  "sim". Uma marca nova muda só o contrato.

Depois de cada caso, siga o caminho a partir do [passo 3](#3-atualizar-o-contrato). Mudou algo que
uma regra cita? Veja também o caso [T](#t-regras-que-citam-o-que-mudou).

O que é **mantido** pelo `init-db` (níveis, rótulos, condições do CAR, marcas, grupos e municípios)
não pode perder uma linha que a base atual usa: tirar uma delas pede `--recreate`. O que é
**refeito** (anos, arranjos, filtros, recortes e camadas) sai e entra a cada `init-db`, sem isso.

**Quando o contrato pede carga.** Todo contrato novo passa pelo `init-db` antes da carga; sem isso,
a carga para com `contrato_mudou`. O `run-all` já roda nessa ordem. Uma mudança no que a carga lê
pede também uma carga nova: o `recipiente`, as `camadas` (menos o `rotulo`), as `colunas` (menos a
`descricao`) e a `sobreposicao`. Sem a carga, o `verify` e o `geoserver` param com
`contrato_diverge_da_carga`. O resto do contrato só pede `init-db` e `geoserver`.

### A. Camada renomeada

**Como aparece:** o `inspect` para com `gpkg_camadas_divergentes`, com o nome antigo em `ausentes` e
o novo em `extras`, para o mesmo ano.

**O que mudar:** o `origem` do ano em `camadas`.

**Portal e produção:** nada além do caminho normal.

**Exemplo de teste:** a camada de 2024 chegou como `Planaveg_2026_Visualizacao_vs24q`.

```text
gpkg_camadas_divergentes: ausentes=['Planaveg_2026_Visualizacao_vs2224q'] extras=['Planaveg_2026_Visualizacao_vs24q']
```

Com o nome novo no `origem` de 2024, o `inspect` passou, com `-> ano_vs=2024 (VS 2024)` na linha da
camada.

### B. Ano novo

**Como aparece:** o `inspect` para com a camada nova em `extras`.

**O que mudar:** uma entrada nova em `camadas`, na ordem dos anos:

```json
{"origem": "Planaveg_2027_Visualizacao_vs26q", "ano_vs": 2026, "rotulo": "VS 2026"}
```

**O que acontece sozinho:** o `init-db` cria `peca_2026` e uma camada `espacial_<filtro>_2026` por
filtro espacial. O `geoserver` as publica. O portal mostra sempre o ano mais recente do catálogo, e
o `semear` e o `aquecer` fazem o detalhe dele. Os anos anteriores continuam no banco, no WFS e no
QGIS.

**Revise:** os textos que citam os anos pelo número, como o
[README da pasta do GeoPackage](./gpkg/README.md).

**Produção:** o caminho normal, sem `--recreate`.

**Exemplo de teste:** com a camada de 2026 no arquivo, o `inspect` parou com
`ausentes=[] extras=['Planaveg_2027_Visualizacao_vs26q']`. Com a entrada acima em `camadas`, o
`init-db` criou 14 views de 2026, uma por filtro espacial e a `peca_2026`. A carga trouxe as peças
dos três anos, e 2026 passou a ser o ano mais recente do catálogo, o que o portal mostra.

### C. Ano que saiu

**Como aparece:** o `inspect` para com a camada em `ausentes`.

**O que mudar:** tirar a entrada do ano de `camadas`.

**O que acontece:** as views e as camadas daquele ano somem no `init-db`, e a `serie` perde o ano.
Os anos são refeitos a cada `init-db`, então não precisa de `--recreate`.

**Portal:** se o ano que saiu era o mais recente, o portal passa a mostrar o anterior.

**Exemplo de teste:** sem a camada de 2022, o `inspect` parou com
`ausentes=['Planaveg_2026_Visualizacao_vs22q'] extras=[]`. Com só 2024 em `camadas`, o `init-db`
tirou todas as views de 2022, sem `--recreate`, e a carga trouxe só 2024.

### D. Coluna renomeada

**Como aparece:** o `inspect` para com `gpkg_colunas_divergentes`, com o nome antigo em `ausentes` e
o novo em `extras`, e os valores são os mesmos.

**O que mudar:** só o `origem` da coluna em `colunas`. O `destino`, o nome no banco, fica. Nada
muda no banco, nas views nem no portal.

**Exemplo de teste:** a área chegou como `Area_Hectares`.

```text
gpkg_colunas_divergentes: Planaveg_2026_Visualizacao_vs2224q: ausentes=['Area_ha'] extras=['Area_Hectares'] tipos=[]
```

Com `"origem": "Area_Hectares"` e o `destino` de sempre, `area_ha`, o `inspect` passou.

### E. Rótulo novo ou renomeado na hierarquia

O rótulo é o texto da coluna `hierarquia_planaveg`, que diz o nível da peça. O contrato liga cada
rótulo a um tier e, nos níveis do CAR, a uma condição.

**Como aparece:** a carga para com `hierarquia_fora_do_contrato`, com o rótulo. A consulta dos
rótulos do [passo 2](#olhar-dentro-do-arquivo) mostra todos de uma vez.

**Rótulo renomeado** (mesmo tier e mesma condição): troque o `rotulo` da linha em `hierarquia`. O
`init-db` acha a linha pelo tier e pela condição, renomeia o rótulo, e as peças da base atual vão
junto. Como é uma troca, e não uma linha que sai, não precisa de `--recreate`. Nada muda no
portal.

**Rótulo com outro tier ou outra condição** (`hierarquia_diverge_do_tier`): confirme com o produtor
se a regra mudou. Se mudou, acerte o `tier` e a `categoria` da linha. Se a mudança tira da base
atual uma combinação que as peças usam, rode com `--recreate`.

**Rótulo de um nível que não existe:** é o caso [F](#f-nível-novo). **De uma condição nova do
CAR:** é o caso [G](#g-condição-do-car-nova).

**Exemplo de teste:** o rótulo do tier 4 chegou com "Embrapa".

```text
hierarquia_fora_do_contrato: Outros projetos (MMA, ICMBio, Embrapa e demais órgãos)
```

Com o rótulo novo na linha do tier 4, o `init-db` trocou o rótulo também nas peças da base atual,
antes da carga e sem `--recreate`. Depois, a carga passou.

### F. Nível novo

Um nível é uma linha da hierarquia do Anexo 1: um tier, com um código, um grupo, um título e uma
cor.

**Como aparece:** a carga para com `hierarquia_fora_do_contrato`, e a consulta dos rótulos mostra um
tier que o contrato não tem.

**O que mudar:**

1. Uma linha nova em `hierarquia`, na ordem dos tiers:

   ```json
   {"tier": 12, "codigo": "novo_nivel", "grupo": "projetos",
    "rotulo": "<o texto exato do arquivo>", "titulo": "<o nome que o portal mostra>",
    "cor": "#3182bd"}
   ```

   - O `codigo` é minúsculo, sem acento nem espaço, e não pode ser palavra reservada do
     PostgreSQL.
   - Um nível com condições do CAR tem uma linha por condição, cada uma com `categoria` e
     `situacao` (caso [G](#g-condição-do-car-nova)).
   - Um nível do relatório que o arquivo ainda não traz leva `ausente`, com o motivo, em vez de
     `rotulo`.
2. Um grupo novo entra em `grupos`, com `codigo` e `titulo`.
3. As regras: um nível novo não entra em arranjo nem em filtro sozinho. Sem uma regra que o cite, as
   peças dele caem no arranjo complementar ("Demais áreas de projetos"). Veja o caso
   [T](#t-regras-que-citam-o-que-mudou).

**Se o produtor renumerou os tiers** (um nível novo no meio da lista), acerte o `tier` de todas as
linhas. Os níveis são mantidos pelo tier, então rode com `--recreate`.

**O que acontece sozinho:** o estilo do mapa ganha a cor do nível. A legenda, as listas do portal e
`quantitativo_nivel` leem o catálogo.

**Portal** ([`apps/web/src`](../apps/web/src)):

- o nome curto e a explicação do nível vão em `NIVEIS`, em `shared/utils/glossario.ts`; sem eles, o
  portal usa o título do contrato;
- um grupo novo precisa de um critério em `CRITERIO_DO_GRUPO`, no mesmo arquivo; sem ele, o nível
  cai em "governança";
- um nível de projeto com processo (embargo, reparação de danos, licenciamento) entra em
  `processoDoProjeto`, em `modules/filtros/utils/facetas.ts`; sem isso, conta como "outros";
- um nível com condições do CAR entra em `NIVEIS_CAR`, em `modules/painel/utils/constantes.ts`.

**Exemplo de teste:** um tier 12 com o rótulo `VS em Assentamentos Rurais (INCRA)`. A carga parou
com `hierarquia_fora_do_contrato: VS em Assentamentos Rurais (INCRA)`. Com esta linha em
`hierarquia`, o `init-db` e a carga passaram:

```json
{"tier": 12, "codigo": "assentamento_incra", "grupo": "vs_protegida",
 "rotulo": "VS em Assentamentos Rurais (INCRA)", "titulo": "Assentamentos Rurais",
 "cor": "#8c6d31"}
```

O `quantitativo_nivel` ganhou o nível nos dois anos. A peça de teste, sem marcas, caiu em
`demais_areas`, porque nenhuma regra cita o nível novo.

**Nível ausente que passa a vir.** O MonitoRAD (tier 2) está no contrato como ausente: a linha tem
`ausente`, com o motivo, e não tem `rotulo`. Ele também está em `fontes_ausentes`, com o código
`monitorad`. Quando o arquivo trouxer as peças, troque o `ausente` pelo `rotulo`, com o texto do
arquivo, e tire a entrada `monitorad` de `fontes_ausentes`.

**Exemplo de teste:** com peças de rótulo `MonitoRAD (MMA)`, a carga parou com
`hierarquia_fora_do_contrato: MonitoRAD (MMA)`. Depois da troca, o `init-db` e a carga passaram, e o
nível apareceu como presente no catálogo, com peças nos dois anos.

**Nível que deixa de vir.** A carga passa, e o `verify` reprova `hierarquia_coberta_pelo_contrato`,
com o ano e o rótulo em `sem_pecas` (o detalhe mostra os três primeiros). Confirme com o produtor.
Se for de propósito, troque o `rotulo` da linha por `ausente`, com o motivo. Depois rode de novo o
`init-db` e o `verify --aceitar pecas_sem_sobreposicao`, e siga para o passo 5.

**Exemplo de teste:** sem as peças do tier 4, o `verify` reprovou, com
`'2022:Outros projetos (MMA, ICMBio e demais órgãos)'` em `sem_pecas`. Com `ausente` na linha do
tier 4, o `init-db` passou sem `--recreate`, porque a base carregada já não tinha peças do nível. No
`verify` seguinte, o rótulo tinha saído de `sem_pecas`.

**Produção:** lá, o `init-db` roda antes da carga, com a base anterior, que ainda tem peças do
nível. Se ele parar com `contrato_tira_o_que_a_carga_usa`, rode a atualização com `--recreate`.

### G. Condição do CAR nova

As condições do CAR (Habilitados, Analisados, Nao_Analisados) dividem os níveis de APP, AUR e RL.
Cada uma pertence a uma situação da planilha de nomenclatura.

**Como aparece:** rótulos novos como `VS em APP (SICAR) - <condição>`, com uma `categoria` nova, e a
carga para com `hierarquia_fora_do_contrato`.

**O que mudar:**

1. Uma linha em `hierarquia` para cada nível do CAR (APP, AUR e RL) com a condição nova:
   `rotulo`, `tier`, `codigo`, `categoria` (o texto da coluna `categoria` do arquivo) e `situacao`.
2. Se a condição tem marcas próprias (como `APP_Habilitado`), as marcas novas (caso
   [I](#i-marca-nova)).
3. A regra do arranjo de APP, RL e AUR cita as marcas por condição: ponha nela as marcas novas
   (caso [T](#t-regras-que-citam-o-que-mudou)).

**Portal:** `CONDICOES_CAR`, em `shared/utils/glossario.ts`, liga cada situação da planilha às
condições da base. A condição nova tem de entrar numa delas; sem isso, o filtro de situação a
ignora. O aquecimento do cache, no core, agrupa as condições pela `situacao` do contrato: os dois
lados têm de concordar.

**Exemplo de teste:** peças de APP com a condição `Pendentes`. A carga parou com
`hierarquia_fora_do_contrato: VS em APP (SICAR) - Pendentes`. A linha nova, logo depois das outras
de APP, é uma cópia delas com o rótulo, a `categoria` e a `situacao` novos:

```json
{"tier": 9, "codigo": "app", "grupo": "vs_protegida",
 "rotulo": "VS em APP (SICAR) - Pendentes", "categoria": "Pendentes",
 "situacao": "Não analisado, ou em análise, ou aguardando retificação",
 "titulo": "Área de Preservação Permanente", "cor": "#08519c"}
```

Depois do `init-db` e da carga, `contrato_condicao_car` ganhou `Pendentes` na ordem 4, na mesma
situação de `Analisados` e `Nao_Analisados`. O `quantitativo_nivel` passou a ter uma linha de APP
para cada uma das quatro condições. Num arquivo real, AUR e RL viriam com a mesma condição, cada um
com a sua linha. No portal, a condição entraria em `nao_analisado`, em `CONDICOES_CAR`:

```ts
categorias: ["Analisados", "Nao_Analisados", "Pendentes"],
```

### H. O texto de uma marca mudou

**Como aparece:** a carga para com `marca_com_valor_inesperado` e o nome da marca. A consulta dos
valores de uma marca mostra o texto novo.

**O que mudar:** o `marcado` da coluna. Nada muda no portal.

**Exemplo de teste:** a marca `CAR_Habilitado` chegou com `Sim` no lugar de `Habilitado`. A carga
parou com `marca_com_valor_inesperado: car_habilitado`, o `destino` da marca. Com
`"marcado": "Sim"`, a carga parou de novo, agora por outro motivo:

```text
contrato_mudou: o contrato configurado não é o do último init-db: rode init-db
```

Todo contrato novo passa pelo `init-db` antes da carga. Depois dele, a carga passou. O `run-all` já
roda nessa ordem.

### I. Marca nova

**Como aparece:** o `inspect` para com a coluna em `extras`, e os valores dela são o vazio e um
texto só.

**O que mudar:**

1. Uma entrada em `colunas`, perto das marcas da mesma família:

   ```json
   {"origem": "QL", "destino": "quilombola", "tipo": "marca", "marcado": "QL",
    "descricao": "Em território quilombola."}
   ```

   O `destino` é o nome da coluna no banco: minúsculo, sem acento, e não pode ser palavra reservada
   do PostgreSQL.
2. Se a marca aparece na `Sobreposicao`, a sigla dela em `sobreposicao` (caso
   [L](#l-sobreposicao-sigla-nova-sigla-que-saiu-ou-outra-ordem)).
3. Se ela deve contar num arranjo ou virar um tema do relatório, a regra (caso
   [T](#t-regras-que-citam-o-que-mudou)).

**O que acontece sozinho:** não precisa de migração. A marca vira uma linha em `contrato_marca` e
uma coluna nas views (`peca`, `peca_<ano>`, `espacial_*`), no WFS e no QGIS.

**Portal:** a marca só aparece no clique se entrar em `PROPRIEDADES_PECA`
(`modules/mapa/utils/constantes.ts`) e no tipo `AtributosPeca`
([`packages/web-contracts`](../packages/web-contracts/)). O CSV do mapa segue a mesma lista. Uma
fonte de projeto também entra em `FONTES_DE_PROJETO`, e uma sigla da `Sobreposicao` em `SIGLAS`,
os dois em `modules/mapa/utils/peca.ts`.

**Produção:** se o portal pede a marca no clique, implante e atualize a base em seguida (o
[passo 8](#8-levar-para-a-produção) explica por quê).

#### Exemplo real: GEF Terrestre e Restauração Ecológica

A base de 16/10/2026 trouxe duas colunas novas, logo depois de `Embargo_PANGIA`: `GEF_Terrestre` e
`Restauracao_Ecologica`. São duas fontes de "Outros projetos" que o arquivo passou a identificar.
Foi assim:

1. **O `inspect` parou**, nas duas camadas, com as duas colunas em `extras`:

   ```text
   gpkg_colunas_divergentes: Planaveg_2026_Visualizacao_vs2224q: ausentes=[] extras=['GEF_Terrestre', 'Restauracao_Ecologica'] tipos=[]
   ```

2. **Os valores mostraram que eram marcas.** Cada coluna só tem o vazio e um texto, e nenhuma peça
   tem as duas:

   ```bash
   sqlite3 -readonly -header -column $G \
     "SELECT GEF_Terrestre, Restauracao_Ecologica, count(*) AS pecas, round(sum(Area_ha), 2) AS area_ha
      FROM $CAMADA WHERE GEF_Terrestre <> '' OR Restauracao_Ecologica <> '' GROUP BY 1, 2;"
   ```

   | Coluna | Texto que liga a marca | Peças | Área |
   | --- | --- | --- | --- |
   | `GEF_Terrestre` | `GEF Terrestre` | 115 | 4.588,50 ha |
   | `Restauracao_Ecologica` | `Restauração Ecológica` | 599 | 33.430,62 ha |

   Os números são os mesmos nos dois anos. Em 2024, 686 dessas 714 peças estão no nível "Outros
   projetos" (tier 4).

3. **A decisão:** as duas ficaram como marcas dentro de "Outros projetos", sem tema próprio no
   relatório e sem regra de arranjo. Como nenhuma regra as cita, a classificação das peças não
   mudou.

4. **O contrato** ganhou duas entradas em `colunas`, logo depois de `Embargo_PANGIA`, onde o arquivo
   as põe:

   ```json
   {"origem": "GEF_Terrestre", "destino": "gef_terrestre", "tipo": "marca",
    "marcado": "GEF Terrestre",
    "descricao": "Em área do projeto GEF Terrestre, uma das fontes de Outros projetos."},
   {"origem": "Restauracao_Ecologica", "destino": "restauracao_ecologica", "tipo": "marca",
    "marcado": "Restauração Ecológica",
    "descricao": "Em área de Restauração Ecológica, uma das fontes de Outros projetos."},
   ```

   Elas não aparecem na `Sobreposicao`, então a lista `sobreposicao` ficou como estava. O `sha256`
   em `recipiente` passou a ser o do arquivo novo.

5. **O portal** passou a mostrar as duas no clique, na linha das fontes de projeto. Elas entraram em
   `PROPRIEDADES_PECA` (`modules/mapa/utils/constantes.ts`), no tipo `AtributosPeca`
   (`packages/web-contracts/src/index.ts`) e em `FONTES_DE_PROJETO` (`modules/mapa/utils/peca.ts`),
   com os nomes "GEF Terrestre" e "Restauração Ecológica".

6. **Os comandos**, em `apps/core`: `make modelagem`, `make check` e os testes; depois o `run-all`
   (`init-db`, `load` e `verify`) e o `make geoserver`.

7. **O resultado:** 141.320 peças nos dois anos, nenhuma rejeitada. O `verify` passou 15 das 16
   invariantes, com a sobreposição aceita (19,1 ha em 2022 e 26,8 ha em 2024). No navegador, o
   clique numa peça do GEF mostrou a fonte.

8. **Na produção**, a base entrou em 16 e 17/10/2026. Como o portal novo pede as duas colunas no
   clique, a base foi atualizada junto com o deploy.

Na época, o banco ainda guardava uma coluna por marca na tabela da peça. Por isso a mudança também
passou pelo SQL da carga e das views, e pediu `init-db --recreate`. Hoje as marcas são linhas
(`peca_marca`), e os passos acima bastam, sem `--recreate`.

A mesma base trouxe outras mudanças, tratadas à parte: a sigla `MANG` entrou na `Sobreposicao`
(caso [L](#l-sobreposicao-sigla-nova-sigla-que-saiu-ou-outra-ordem)), a coluna `UC` passou a marcar
também APA e RPPN, e peças vizinhas com os mesmos atributos se juntaram (80.932 → 70.739 peças em
2024).

### J. Marca que saiu

**Como aparece:** o `inspect` para com a coluna em `ausentes`.

**O que mudar:** tirar a coluna de `colunas`, a sigla de `sobreposicao` e o código das regras que o
citam. O contrato recusa uma regra com marca desconhecida.

**Banco:** as marcas são mantidas, e as peças da base atual usam esta. Rode com `--recreate`.

**Portal:** tire a marca de `PROPRIEDADES_PECA`, `AtributosPeca`, `FONTES_DE_PROJETO` e `SIGLAS`, se
estiver lá. Quem lê as views pelo WFS perde a coluna.

Uma coluna do modelo não pode sair: o contrato para com `coluna_obrigatoria_ausente`. Peça ao
produtor para devolvê-la.

**Exemplo de teste:** sem a coluna `Embargo_PANGIA`, o `inspect` parou com
`ausentes=['Embargo_PANGIA']`. Sem ela em `colunas`, o `init-db` parou:

```text
contrato_tira_o_que_a_carga_usa: contrato_marca: Key (marca)=(embargo_pangia) is still referenced from table "peca_marca".; rode init-db --recreate (apaga a carga) e depois load
```

Com `--recreate`, a base anterior saiu, e a carga passou. Nenhuma regra cita `embargo_pangia` desde
a revisão do MMA, então o contrato não reclamou. Uma marca citada numa regra para antes, no próprio
contrato (caso [T](#t-regras-que-citam-o-que-mudou)). E sem a coluna `Bioma`, do modelo, o contrato
para com `coluna_obrigatoria_ausente: bioma`.

### K. Coluna de outro tipo

**Como aparece:** o `inspect` para com a coluna em `tipos`. Por exemplo, `tier` como `TEXT`, ou
`Area_ha` como `TEXT`.

**O que fazer:** o tipo de cada coluna do modelo é fixo (`ATRIBUTOS`), e as marcas são texto. Peça
ao produtor o tipo de antes. Aceitar o tipo novo é mudar o código da carga.

**Exemplo de teste:** o `tier` gravado como `TEXT`. O `inspect` parou com
`ausentes=[] extras=[] tipos=['tier']`. Trocar o tipo no contrato não resolve: o `inspect` para com
`coluna_com_tipo_do_modelo_diferente: tier`.

### L. Sobreposicao: sigla nova, sigla que saiu ou outra ordem

A `Sobreposicao` junta as siglas das marcas fundiárias de cada peça, numa ordem fixa
(`PROJ CAR APA RPPN UC MANG TI AS QL` na base de 16/10/2026). A marca UC é lida dela.

**Como aparece:** o `verify` reprova `sobreposicao_igual_as_marcas`. A consulta das siglas do
[passo 2](#olhar-dentro-do-arquivo) mostra o que mudou.

**O que mudar:** a lista `sobreposicao` do contrato, com marca e sigla, na ordem em que o arquivo as
junta. A marca tem de existir em `colunas`. A sigla de uma marca lida da `Sobreposicao` não pode
conter outra sigla nem estar contida nela.

**Portal:** o texto que o clique mostra para cada sigla fica em `SIGLAS`, em
`modules/mapa/utils/peca.ts`.

**Carga:** a marca UC sai da `Sobreposicao` na carga. Por isso a lista `sobreposicao` está no que a
carga lê, e mudá-la pede uma carga nova. Com um arquivo novo, o `run-all` já a faz.

**Exemplo de teste:** uma peça com as marcas PROJ e CAR e a `Sobreposicao` `CARPROJ`, fora da
ordem do contrato, em que `PROJ` vem antes. A carga passou, e o `verify` reprovou, com uma peça em
cada ano:

```text
FALHA  sobreposicao_igual_as_marcas         divergentes=2
```

**Exemplo real:** a base de 16/10/2026 trouxe a sigla `MANG`, entre `UC` e `TI`. A lista ganhou
`{"marca": "manguezal", "sigla": "MANG"}` nessa posição, e o portal ganhou o texto de `MANG` em
`SIGLAS`. A mesma base mudou o sentido da coluna `UC`, que passou a marcar também APA e RPPN. Para a
marca `uc` manter o sentido de antes, ela passou a ser lida da `Sobreposicao`, com
`"fonte": "sobreposicao"` na coluna `UC` do contrato.

### M. Município novo

**Como aparece:** a carga para com `municipio_fora_do_ibge` e os códigos. A consulta dos municípios
do [passo 2](#olhar-dentro-do-arquivo) mostra todos de uma vez.

**O que mudar:** a lista do IBGE do pacote,
[`referencia/municipios.csv`](../apps/core/src/planaveg_core/referencia/municipios.csv), com
código, nome e código da UF. Para refazê-la da API de localidades do IBGE:

```bash
curl -s https://servicodados.ibge.gov.br/api/v1/localidades/municipios | python3 -c '
import csv, json, sys
saida = csv.writer(sys.stdout, lineterminator="\n")
saida.writerow(["codigo", "nome", "uf"])
for m in sorted(json.load(sys.stdin), key=lambda m: m["id"]):
    saida.writerow([m["id"], m["nome"], str(m["id"])[:2]])
' > apps/core/src/planaveg_core/referencia/municipios.csv
```

Confira o `git diff` do arquivo antes de seguir. Um município que saiu da lista e que a base atual
usa pede `--recreate`.

**Exemplo de teste:** uma peça com o código `5299999`, que o IBGE não tem. A carga parou com
`municipio_fora_do_ibge: 5299999`. Um código assim é erro do arquivo e volta ao produtor. Só um
município criado depois da lista do pacote entra pela atualização acima.

### N. UF ou bioma novo

**Como aparece:** a carga para com `uf_fora_da_lista` ou `bioma_fora_da_lista`.

**Antes de mudar:** confira se não é o mesmo nome escrito de outro jeito (`Amazonia` sem acento,
por exemplo). Nesse caso, peça ao produtor para corrigir o arquivo.

**O que mudar:** as UFs e os biomas ficam na primeira migração. Um valor novo é uma migração nova,
`apps/core/src/planaveg_core/sql/migracoes/0002_<nome>.sql`, com o `INSERT`. Nunca edite a `0001`:
um banco que já a rodou para com `migracao_alterada`.

**Portal:** um bioma novo precisa de cor em `BIOMAS` (`modules/painel/utils/constantes.ts`); sem
ela, ele sai com a cor neutra.

**Exemplo de teste:** uma peça no bioma `Sistema Costeiro-Marinho`. A carga parou com
`bioma_fora_da_lista: Sistema Costeiro-Marinho`. Se o bioma tiver de entrar, a migração nova é uma
linha:

```sql
INSERT INTO lugar_bioma (nome) VALUES ('Sistema Costeiro-Marinho');
```

**O marcador `FORA`**, que diz que a peça cai fora dos limites oficiais, fica no campo `fora` das
colunas `UF` e `Bioma` do contrato. Se o produtor trocar o texto, troque o campo.

### O. Bacias

A carga cria as regiões hidrográficas, as mesobacias e as bacias a partir do próprio arquivo:
nomes novos não pedem nada. Só para a carga a mesma mesobacia em duas regiões
(`mesobacia_em_duas_regioes`). É pergunta para o produtor.

**Exemplo de teste:** a mesobacia `Tocantins` numa peça da região Tocantins-Araguaia e noutra da
Atlântico Nordeste Ocidental. A carga parou com `mesobacia_em_duas_regioes: Tocantins`.

### P. Versão do GeoPackage

**`gpkg_user_version_divergente`:** o arquivo foi gravado noutra versão do formato. Veja qual com o
`PRAGMA user_version` do [passo 2](#olhar-dentro-do-arquivo) e acrescente o número em
`recipiente.user_versions`, se o resto do arquivo confere.

**`gpkg_application_id_divergente`:** o arquivo não se declara GeoPackage. Peça ao produtor um
GeoPackage de verdade.

**Exemplo de teste:** um arquivo com `user_version` 10300. O `inspect` parou com
`gpkg_user_version_divergente`, sem detalhe. Com `"user_versions": [10400, 10300]` no contrato, ele
passou e mostrou `user_version=10300`.

### Q. Outro sistema de coordenadas ou outra geometria

**Geometria:** se o arquivo declara `POLYGON` em vez de `MULTIPOLYGON`, troque
`recipiente.geometria` no contrato: a carga já transforma tudo em multipolígono. Pontos ou linhas
não são uma base de peças.

**Sistema de coordenadas:** o Albers do IBGE (SRS 100000) está em vários lugares: no contrato
(`srid` e `proj4`), em `sql/000_extensions.sql`, no tipo das colunas de geometria (migração) e no
SQL da carga. Peça ao produtor o mesmo sistema. Se não der, a mudança é de código, com uma migração
nova.

**Exemplo de teste:** com `POLYGON`, o `inspect` parou com
`gpkg_geometria_inesperada: Planaveg_2026_Visualizacao_vs2224q: geom POLYGON`. Com
`"geometria": "POLYGON"`, o `inspect`, o `init-db` e a carga passaram. Com as camadas em SIRGAS
2000, o EPSG 4674, ele parou com
`gpkg_srid_divergente_do_contrato: Planaveg_2026_Visualizacao_vs2224q: 4674`.

### R. Coluna a mais, que não interessa

O `inspect` recusa qualquer coluna a mais, mesmo uma que o SINAVEG não usa. A carga lê só as colunas
do contrato. Há dois caminhos:

- pedir ao produtor um arquivo sem a coluna;
- ensinar o `inspect` a ignorar colunas listadas no contrato. É uma mudança pequena de código, em
  `gpkg.py` e na leitura do contrato, com um teste.

**Exemplo de teste:** uma coluna de texto `Observacao`. O `inspect` parou com
`ausentes=[] extras=['Observacao'] tipos=[]`.

### S. Atributo novo que precisa entrar

Uma coluna nova que não é sim ou não (um texto, um número) e que o portal deve usar é uma mudança do
modelo. Ela passa por:

1. `ATRIBUTOS`, em `contrato/modelo.py`;
2. a tabela de pouso e o `INSERT` da carga, em `banco/pecas.py`;
3. uma migração nova, com a coluna em `peca_recebida`;
4. as views que a mostram, em `publicacao/`;
5. os tipos de `packages/web-contracts` e o portal;
6. os testes (`test_colunas_do_contrato.py`) e `make modelagem`.

Se o atributo é um recorte de lugar, como uma fitofisionomia, veja também o caso
[Z](#z-fonte-ausente-e-recorte-novo).

---

## Quando as regras ou os textos mudam

Estes casos não dependem da estrutura do arquivo. São decisões sobre como contar e mostrar as
peças: um filtro novo, a regra de um arranjo, um título. Alguns chegam com uma base nova, como um
tema para uma marca nova. Outros chegam sozinhos, como os nomes de uma revisão do MMA.

Com uma base nova, siga o caminho de sempre: o `run-all` já roda o `init-db`. Sem arquivo novo, o
caminho é mais curto, porque as peças ficam onde estão. Em `apps/core`:

```bash
make modelagem
make check
uv run pytest -m "not integration"
uv run planaveg-core init-db
make geoserver
uv run planaveg-core semear
```

O `init-db` refaz as regras, as views e os catálogos em poucos minutos, sem recarregar as peças. O
`geoserver` publica as camadas e recalcula as versões. Se o desenho do mapa mudou (uma regra, uma
cor, um título), o cache de tiles esvazia, e o `semear` o refaz. Confira o portal como no
[passo 6](#6-publicar-no-seu-computador) e faça o commit.

Uma regra que passa a citar uma marca nova é outra história: a marca vem do arquivo, e o caminho é o
de sempre, com a carga.

**Na produção**, implante o código (o item 1 do [passo 8](#8-levar-para-a-produção)) e entre no
servidor com `ssh -i <chave ssh> root@<servidor>`. Lá, rode o mesmo caminho curto. O `init-db` e o
`geoserver` levam poucos minutos. O último comando volta na hora e deixa o `semear` e o aquecimento
rodando, por mais de uma hora:

```bash
cd /opt/planaveg/app
compose="docker compose -f infra/producao/compose.yaml --env-file /opt/planaveg/.env"
$compose run --rm core init-db
$compose run --rm core geoserver
setsid nohup bash -c "$compose run --rm core semear && infra/producao/aquecer-cache.sh --comuns; echo FIM saida=\$?" > /opt/planaveg/cache.log 2>&1 < /dev/null & disown
```

O andamento fica em `/opt/planaveg/cache.log`. Em 19/10/2026, uma troca de títulos levou 2 minutos
no `init-db`.

### T. Regras que citam o que mudou

Os arranjos e os filtros têm regras (predicados) que citam marcas, níveis e arranjos pelo código. O
[resumo do código](./resumo-do-codigo.md#o-contrato-manda-em-tudo) explica a forma delas.

- O contrato recusa uma regra que cita um código que não existe mais, em qualquer comando, antes de
  chegar ao banco.
- Um código novo não entra em regra nenhuma sozinho: decida onde ele conta.
- Depois do `init-db`, compare a área de cada arranjo com a da base anterior (`quantitativo_arranjo`
  e `resultado_*`). Uma peça que mudou de arranjo muda a meta que ela ajuda a cumprir.

**Exemplo de teste:** a coluna da marca de assentamentos é `AS_`, com o `destino` `assentamento`.
Sem ela em `colunas` e sem a sigla dela em `sobreposicao`, o contrato parou:

```text
predicado_marca_desconhecido: assentamento
```

A regra do arranjo de áreas públicas e a do filtro `assentamento` a citam: as duas mudam junto com a
coluna. Um filtro que cita um nível que não existe para do mesmo jeito, com
`predicado_nivel_desconhecido: assentamento_incra`.

### U. Filtro novo

Um filtro é um recorte do relatório: as peças que uma regra escolhe. A receita, com os campos e a
forma da regra, está no
[resumo do código](./resumo-do-codigo.md#um-filtro-novo-ou-um-agrupamento). Aqui fica o que ele
muda.

**O que acontece sozinho:** com `"tipo": "espacial"` ou `"ambos"`, o filtro ganha uma view por ano
(`espacial_<codigo>_<ano>`), uma camada no GeoServer e um estilo com a `cor`. Ele vira um tema do
portal, a menos que a regra só cite arranjos: o tema aparece nas listas do mapa e do painel, com o
`titulo` do contrato, e o aquecimento do cache o semeia. Com `"tipo": "quantitativo"`, ele só tem
números. Os dois tipos entram no catálogo, na tabela de filtros de Acesso aos dados e no download
"Área por tema do relatório" (`quantitativo_filtro`).

**Portal:** nada é obrigatório. O grupo pode ganhar um nome mais curto em `GRUPOS_DE_FILTRO`
(`shared/utils/glossario.ts`); sem ele, o portal usa o `grupo` do contrato.

**Exemplo de teste:** um tema para as duas marcas que entraram na base de 16/10/2026.

```json
{"codigo": "projetos_gef_re", "grupo": "Projetos de Recuperação da Vegetação Nativa",
 "titulo": "Projetos GEF Terrestre e Restauração Ecológica", "tipo": "ambos",
 "status": "presente", "cor": "#1b9e77",
 "predicado": {"marca": ["gef_terrestre", "restauracao_ecologica"]}}
```

Só com o `init-db`, sem carga, vieram as views `espacial_projetos_gef_re_2022` e
`espacial_projetos_gef_re_2024` e o filtro no catálogo como tema, com o CQL
`(gef_terrestre = true OR restauracao_ecologica = true)`. As duas camadas ficaram prontas para o
`geoserver`, com o estilo `planaveg_filtro_projetos_gef_re`. Na base de 16/10/2026, a decisão foi
outra: as duas marcas ficaram sem tema (caso [I](#i-marca-nova)).

**Exemplo de teste, só com números:** um filtro de áreas protegidas, com `"tipo": "quantitativo"` e
esta regra:

```json
{"ou": [{"marca": ["uc", "apa", "rppn", "terra_indigena"]}, {"nivel": ["manguezal"]}]}
```

O `init-db` não criou view nem camada, e `quantitativo_filtro` ganhou os números dele em cada ano.

### V. Filtro que muda ou sai

**Regra, título, cor, status ou nota:** troque o campo. O `init-db` refaz a view e o catálogo, e o
`geoserver` atualiza a camada e o estilo. Uma regra ou uma cor nova muda o desenho do mapa, e o
cache de tiles recomeça.

**Filtro que sai:** tire a entrada. O `init-db` tira as views dele, e o `geoserver` tira as camadas,
com esta linha no log:

```text
camada geoserver espacial_<codigo>_<ano> removida: a view saiu do contrato
```

Quem lia a camada pelo WFS ou no QGIS a perde. Trocar o código é tirar um filtro e pôr outro.

**Exemplo real:** na revisão do MMA de 16/10/2026, o tema `embargo_pangia` saiu, e nenhuma regra
cita mais o PANGIA. A marca `embargo_pangia` ficou, porque o arquivo ainda traz a coluna. Em
19/10/2026, os temas ganharam os títulos do relatório (caso [X](#x-títulos-cores-textos-e-metas)).

### W. Arranjo que muda ou arranjo novo

Os arranjos repartem as peças. Cada peça cai no primeiro arranjo, na ordem do contrato, cuja regra
ela cumpre. O último, o complementar, não tem regra e recebe o resto. Um arranjo com `ausente` não
tem regra e fica com 0 ha.

**O contrato confere:**

- o complementar, sem `predicado` e sem `ausente`, é o último; fora disso, para com
  `arranjo_complementar_deve_ser_o_ultimo`;
- um arranjo `ausente` não tem `predicado`; com os dois, para com `arranjo_ausente_com_predicado`;
- a regra de um arranjo cita marcas e níveis, nunca outro arranjo.

**Um arranjo do plano é também um filtro**, `arranjo_<codigo>`, com a regra
`{"arranjo": ["<codigo>"]}`. É ele que põe o arranjo entre os filtros do relatório, com camada
própria no GeoServer. Os dois têm de concordar: quando o arranjo ganha regra, o filtro passa de
`"status": "vazio"` para `presente` e perde a `nota`.

**A meta:** a meta nacional é a soma das `meta_ha`. No portal, só um arranjo com meta ganha caixa e
lugar nas listas. Um sem meta, como as demais áreas de projetos, ganha só uma nota.

**Portal:** o nome, a explicação e o texto "em ..." de cada arranjo ficam em `ARRANJOS`, em
`shared/utils/glossario.ts`. Sem eles, o portal usa o `titulo` do contrato.

**Depois do `init-db`**, a classificação é refeita, e uma peça pode mudar de arranjo. Compare a área
de cada um com a anterior (caso [T](#t-regras-que-citam-o-que-mudou)).

**Exemplo de teste:** o arranjo `baixa_produtividade`, dos sistemas integrados de produção, está
ausente, porque a base não traz as técnicas de restauração com fins econômicos. Se o arquivo trouxer
uma marca para elas, como uma coluna `Restauracao_Produtiva`, a mudança é:

1. a marca nova em `colunas` (caso [I](#i-marca-nova));
2. no arranjo, tirar o `ausente` e pôr `"predicado": {"marca": ["restauracao_produtiva"]}`;
3. no filtro `arranjo_baixa_produtividade`, pôr `"status": "presente"` e tirar a `nota`.

Como a marca é nova, o caminho passa pela carga. No teste, a peça marcada saiu de `demais_areas` e
entrou em `baixa_produtividade`, e o catálogo deixou de mostrar o motivo da ausência.

**Arranjo novo:** uma entrada em `arranjos`, antes do complementar, na ordem de prioridade, com
`codigo`, `titulo`, `criterio`, `cor`, `predicado` e, se tiver meta, `meta_ha` e `meta_ano`. Se ele
é do plano, entram também o filtro `arranjo_<codigo>` e o nome em `ARRANJOS`. Um arranjo novo tira
dos que vêm depois dele as peças que cumprem as duas regras.

**Exemplo real:** na revisão do MMA de 16/10/2026,

- o nível `manguezal` e a marca `rppn` entraram na regra de `areas_publicas`;
- `baixa_produtividade` virou ausente, com o motivo;
- `demais_areas` entrou como o complementar, sem meta, com a cor `#9e9e9e`.

Depois do `init-db` local da época, a área de 2024 ficou assim: áreas públicas, 2.570.400 ha; APP,
RL e AUR, 5.766.277 ha; sistemas integrados, 0; demais áreas, 474.647 ha.

### X. Títulos, cores, textos e metas

São os campos de apresentação: o `titulo` e a `cor` dos níveis, dos arranjos e dos filtros; o
`subtitulo`, a `nota` e o `criterio`; o `rotulo` das camadas e a `descricao` das colunas; a
`meta_ha` e a `meta_ano` dos arranjos. Nenhum pede carga.

**O que acontece:** o `init-db` grava os campos no catálogo, e o `geoserver` refaz os estilos e os
títulos das camadas. A cor e o título entram no desenho do mapa: o cache de tiles esvazia, e o
`semear` o refaz. A meta aparece sozinha na visão geral e no painel.

**Portal:** o portal usa o nome do contrato só quando não tem um seu. Os nomes curtos e as
explicações ficam em `shared/utils/glossario.ts`: `NIVEIS`, `ARRANJOS`, `CONDICOES_CAR` e
`GRUPOS_DE_FILTRO`. Onde o glossário tem um nome para o código, um título novo no contrato não muda
o portal: troque lá também.

**Exemplo de teste:** o título do tier 4 virou "Projetos de Cooperação do MMA", a cor virou
`#e6550d`, e a meta das áreas públicas virou 4,5 milhões de ha. Só com o `init-db`, o catálogo dos
níveis mostrou o título e a cor novos, e o dos arranjos, a meta nova.

**Exemplo real:** na revisão do MMA de 16/10/2026, os títulos dos níveis passaram a ser os da
planilha de nomenclatura do SINAVEG. Em 19/10/2026, os arranjos e os temas ganharam os nomes do
relatório, no contrato e, para os arranjos, também no glossário do portal. Na produção, o `init-db`
levou 2 minutos, e o título novo esvaziou o cache de tiles.

### Y. Grupo novo ou nível que muda de grupo

Os grupos juntam os níveis no portal e no catálogo. Ficam em `grupos`, com `codigo` e `titulo`, e
cada linha da hierarquia diz o seu no campo `grupo`.

**O que mudar:** o grupo novo em `grupos` e o `grupo` das linhas em `hierarquia`. Num nível do CAR,
mude as três linhas: com grupos diferentes no mesmo tier, o contrato para com
`tier_com_niveis_diferentes`.

**Portal:** cada grupo tem um critério em `CRITERIO_DO_GRUPO` (`shared/utils/glossario.ts`): a
intencionalidade, dos projetos, ou a governança, da vegetação protegida. Um grupo sem critério cai
na governança.

**Exemplo de teste:** o tier 4 num grupo `cooperacao`, que não estava em `grupos`. O contrato parou
com `nivel_com_grupo_desconhecido: cooperacao`.

**Exemplo real:** na revisão do MMA de 16/10/2026, os grupos passaram a ser os dois da planilha,
`projetos` e `vs_protegida`, e os níveis do CAR, os tiers 9 a 11, foram para `vs_protegida`.

### Z. Fonte ausente e recorte novo

**Fonte ausente:** `fontes_ausentes` lista o que o relatório pede e a base não traz, com `codigo`,
`grupo` e `descricao`. A lista vai para `fonte_ausente`, publicada no GeoServer; o portal a carrega
com o catálogo, mas hoje não a mostra em nenhuma tela. Uma entrada nova só pede `init-db` e
`geoserver`. Quando a fonte passa a vir, a entrada sai, como a do MonitoRAD no caso
[F](#f-nível-novo).

**Exemplo de teste:** esta entrada apareceu em `fonte_ausente` depois do `init-db`:

```json
{"codigo": "fundo_amazonia", "grupo": "Cômputo Planaveg",
 "descricao": "Projetos do Fundo Amazônia: sem fonte no arquivo."}
```

**Recorte novo:** os recortes de lugar (estado, município, as três bacias e o bioma) estão em
`dimensoes`. A chave e o nome de cada valor, porém, estão no SQL de `peca_lugar`, em
[`publicacao/pecas.py`](../apps/core/src/planaveg_core/publicacao/pecas.py). Um recorte novo, como
uma fitofisionomia, é uma mudança de código: o atributo novo (caso
[S](#s-atributo-novo-que-precisa-entrar)), o SQL de `peca_lugar`, a entrada em `dimensoes` e o
portal. O código do recorte não pode ser `total`, `nivel`, `arranjo` nem `filtro`, nomes que a
`serie` já usa.
