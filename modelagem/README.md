# Modelagem do banco

O banco do SINAVEG em SQL puro. Os quatro arquivos numerados criam, num PostgreSQL vazio, o mesmo
banco que o `planaveg-core init-db` cria: as tabelas, as funções, as views, as regras do contrato e
os municípios do IBGE. As peças não vêm aqui: elas saem do GeoPackage, pelo comando de carga.

| Arquivo | O que tem |
| --- | --- |
| `1_tabelas.sql` | a extensão PostGIS, o SRS do GeoPackage e as tabelas, com as chaves, os índices, as UFs, os biomas e o registro da migração |
| `2_funcoes.sql` | as funções que a carga e as views usam |
| `3_views.sql` | as views, o registro delas e o papel `geoserver_leitura`, com o que ele pode ler |
| `4_dados.sql` | o contrato e as regras em linhas, os municípios do IBGE e o primeiro cálculo das views materializadas |
| `consultas.sql` | escrito à mão: as consultas que o portal faz ao GeoServer, em SQL, para ler. Não se aplica |

Os quatro numerados são gerados do código e trazem os comentários que explicam cada tabela: não
edite à mão. Para refazê-los, rode `make modelagem` em `apps/core`. Como o banco é feito está no
[resumo do código](../docs/resumo-do-codigo.md#parte-1-a-modelagem).

## 1. Criar o banco

Precisa de PostgreSQL 17 com PostGIS 3.5. Os arquivos criam a extensão `postgis` e o papel
`geoserver_leitura`, e gravam o SRS do GeoPackage em `spatial_ref_sys`. O mais simples é aplicá-los
com um superusuário. Sem ele, um administrador cria a extensão antes e dá ao usuário `CREATEROLE` e
permissão de gravar em `spatial_ref_sys`.

Use o mesmo usuário aqui e na carga: ela grava nas tabelas e recalcula as views materializadas, e
para isso tem de ser o dono delas.

Aplique os quatro arquivos, nesta ordem, numa transação só:

```bash
createdb planaveg
psql -d planaveg -v ON_ERROR_STOP=1 --single-transaction \
  -f 1_tabelas.sql -f 2_funcoes.sql -f 3_views.sql -f 4_dados.sql
```

Também dá para abrir os quatro, na ordem, no pgAdmin ou noutro cliente. Sai um banco com a
estrutura, as regras do contrato, os municípios e as views, ainda sem peças. O papel
`geoserver_leitura`, que o GeoServer usa, fica criado sem senha.

## 2. Carregar os dados

A carga é o comando `load` do `planaveg_core`, em `apps/core`. Ele lê o GeoPackage, confere cada
lote contra o contrato e grava as peças numa transação só. Com a base nacional, leva cerca de uma
hora. O `verify`, depois, confere os números contra o desenho. O arquivo está descrito em
[`docs/gpkg`](../docs/gpkg/README.md).

Com Python 3.13 e o [uv](https://docs.astral.sh/uv/), na pasta `apps/core`:

```bash
export DATABASE_URL=postgresql://usuario:senha@servidor:5432/planaveg
export GPKG_PATH=/caminho/Planaveg_2026_Categorias_Visualizacao.gpkg
uv run planaveg-core load
uv run planaveg-core verify --aceitar pecas_sem_sobreposicao
```

Sem Python, com Docker, na raiz do repositório:

```bash
docker build -f infra/Dockerfile.core -t planaveg-core .
docker run --rm \
  -e DATABASE_URL=postgresql://usuario:senha@host.docker.internal:5432/planaveg \
  -e GPKG_PATH=/dados/Planaveg_2026_Categorias_Visualizacao.gpkg \
  -v /caminho/da/pasta/do/gpkg:/dados:ro \
  planaveg-core load
```

Para conferir, rode o mesmo `docker run` com `verify --aceitar pecas_sem_sobreposicao` no lugar de
`load`. `host.docker.internal` é o computador onde o Docker roda, no Mac e no Windows. No Linux,
use o endereço do servidor do banco.

Na base final, o `verify` reprova `pecas_sem_sobreposicao`: o próprio arquivo conta duas vezes uma
área pequena. O `--aceitar` registra essa reprovação como conhecida. Qualquer outra para a
conferência.

## Depois

- **Publicar no GeoServer:** dê uma senha ao papel com
  `ALTER ROLE geoserver_leitura PASSWORD '...'` e rode `planaveg-core geoserver`, com a mesma senha
  em `GEOSERVER_PG_PASSWORD`. As outras variáveis estão em
  [`config.py`](../apps/core/src/planaveg_core/config.py). Depois, `planaveg-core semear` prepara o
  cache de tiles.
- **Base nova:** rode o `load` de novo, com o arquivo novo ([passo a passo](../docs/base-nova.md)).
  Ele troca a base inteira numa transação só, e até o fim quem lê vê a anterior.
- **Código novo:** estes arquivos criam o banco do zero. Num banco que já existe, quem atualiza é o
  `planaveg-core init-db`: ele aplica as migrações novas e refaz as funções, as views e as regras,
  sem perder a carga. Não rode os arquivos de novo num banco que já tem a estrutura.
