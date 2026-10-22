# SINAVEG / Planaveg

Portal público que mostra a recuperação da vegetação nativa no Brasil, com mapa, painel de números
e dados abertos. Tudo sai da base final do Planaveg, o GeoPackage
`Planaveg_2026_Categorias_Visualizacao.gpkg`.

Os números do portal são uma **Estimativa Técnica**. Eles só viram **Resultado Oficial Planaveg**
quando entram num relatório aprovado pelo Plenário da Conaveg e publicado pelo MMA, ou quando são
reconhecidos formalmente de outro jeito.

## Como está organizado

```text
GeoPackage final ─► planaveg_core (apps/core) ─► PostGIS ─► GeoServer ─► portal (apps/web)
                    load · verify · geoserver ·              WMTS (tiles em cache)
                    semear                                   WMS (clique, município)
                                                             WFS (tabelas, downloads)
```

- `apps/core`: o planaveg_core, em Python. Lê o GeoPackage, confere contra o contrato
  `categorias.v1.json`, carrega no PostGIS, publica camadas, estilos e tabelas no GeoServer e gera
  o cache de tiles. Tem projeto `uv` próprio e um [README](./apps/core/README.md).
- `apps/web`: o portal em React, com Visão geral, Mapa, Painel e Acesso aos dados. Não tem API
  própria e lê tudo do GeoServer.
- `packages/`: `ui` (o design system), `cartography` (o mapa em Leaflet) e `web-contracts` (os
  tipos das views publicadas).
- `modelagem/`: o banco em SQL puro, gerado pelo core, em quatro arquivos na ordem de aplicar: as
  tabelas, as funções, as views e os dados de referência. O [README de lá](./modelagem/README.md)
  ensina a criar o banco com eles e a carregar o GeoPackage.

## Rodar localmente

Você precisa de Docker com Compose, Python 3.13, uv, Node.js 26 e pnpm 11.9. O GeoPackage não vai
para o Git e fica em `docs/gpkg/` (veja o [README de lá](./docs/gpkg/README.md)). O
[`compose.yaml`](./compose.yaml) tem o ambiente inteiro: o banco, o GeoServer e o portal.

```bash
pnpm install --frozen-lockfile
(cd apps/core && uv sync --extra dev && make run)   # PostGIS, carga e conferência
make up                                             # GeoServer, publicação e portal
make -C apps/core semear                            # tiles em cache (dezenas de minutos)
```

Com a base final, o `make run` termina com erro. É esperado: o `verify` reprova uma sobreposição
que vem do próprio arquivo, e o `make up` publica mesmo assim. A explicação está no
[resumo do código](./docs/resumo-do-codigo.md#rodar-localmente).

Endereços:

- portal: <http://localhost:4173> (ou `pnpm --filter @sinaveg/web dev`, na mesma porta)
- GeoServer: <http://127.0.0.1:8085/geoserver> (admin / planaveg, workspace `planaveg`)
- PostGIS do core: `127.0.0.1:55434`, banco `planaveg`

Para apontar o portal para outro GeoServer, copie `apps/web/.env.example` para `apps/web/.env`.

`make check` roda lint, formatação e tipos do core e do portal. `make test` roda os testes do core
e do portal. `make down` para tudo sem apagar os volumes.

## Recriar o banco do zero, à mão

É o caminho do cliente: o banco sai dos arquivos da `modelagem/`, e não do `init-db`. O passo 1
apaga os volumes do compose: o banco, com os outros bancos do mesmo servidor (como o
`planaveg_debug`), e o cache de tiles. Leva umas duas horas, quase tudo na carga e na
conferência. Até o passo 4, os comandos rodam na raiz do repositório.

1. Apague os containers e os volumes, e suba só o banco. Se o GeoServer não parar ("cannot stop
   container"), espere uns segundos e rode o `down` de novo.

   ```bash
   docker compose down -v
   docker compose up -d --wait db
   ```

2. Troque o banco que a imagem do PostGIS cria, que já vem com extensões a mais (topology e
   tiger), por um vazio:

   ```bash
   docker compose exec db dropdb -U planaveg planaveg
   docker compose exec db createdb -U planaveg planaveg
   ```

3. Aplique os quatro arquivos, numa transação só. Sem `ERROR` na saída, deu certo; com erro, nada
   fica aplicado.

   ```bash
   PGPASSWORD=planaveg psql -h 127.0.0.1 -p 55434 -U planaveg -d planaveg -q -v ON_ERROR_STOP=1 --single-transaction -f modelagem/1_tabelas.sql -f modelagem/2_funcoes.sql -f modelagem/3_views.sql -f modelagem/4_dados.sql
   ```

   Para conferir, a consulta abaixo deve dar 50 views, 5571 municípios e o contrato 1.0.0:

   ```bash
   docker compose exec db psql -U planaveg -d planaveg -c "SELECT (SELECT count(*) FROM objeto_gerado) AS views, (SELECT count(*) FROM lugar_municipio) AS municipios, (SELECT versao FROM contrato_versao WHERE vigente) AS contrato"
   ```

4. Dê uma senha ao papel do GeoServer. Os arquivos o criam sem senha, e o core local usa
   `geoserver_leitura` (`GEOSERVER_PG_PASSWORD`):

   ```bash
   docker compose exec db psql -U planaveg -d planaveg -c "ALTER ROLE geoserver_leitura PASSWORD 'geoserver_leitura'"
   ```

5. Em `apps/core`, carregue e confira. A carga lê
   `docs/gpkg/Planaveg_2026_Categorias_Visualizacao.gpkg` e leva uns 50 minutos; se falhar no
   meio, nada muda no banco. A conferência completa leva uns 40 minutos, e `--rapido` pula a
   sobreposição e termina em poucos minutos.

   ```bash
   cd apps/core
   uv run planaveg-core load
   uv run planaveg-core verify --aceitar pecas_sem_sobreposicao
   ```

6. Ainda em `apps/core`, publique no GeoServer e veja o que ficou no ar:

   ```bash
   make geoserver
   uv run planaveg-core status
   ```

7. Opcional: os tiles em cache (`uv run planaveg-core semear`, em `apps/core`) e o portal
   (`docker compose up --build -d --wait web`, na raiz).

Para manter o `planaveg_debug` e o cache de tiles, pule o passo 1 e use `dropdb --force` no
passo 2: ele derruba as conexões abertas, como as do GeoServer. O
[README da modelagem](./modelagem/README.md) traz o mesmo caminho para outro servidor.

## Documentação

- [Resumo do código](./docs/resumo-do-codigo.md): a modelagem do banco e a base de código, com o
  que não quebrar.
- [README do core](./apps/core/README.md): os comandos do `planaveg_core`.
- [`CONTEXT.md`](./CONTEXT.md): os termos do domínio.
