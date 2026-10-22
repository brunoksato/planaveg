# planaveg_core

Linha de comando que recebe a base final do Planaveg
(`Planaveg_2026_Categorias_Visualizacao.gpkg`), carrega no PostGIS e publica no GeoServer. Os mapas
saem por WMTS e WMS, com estilos SLD gerados do contrato. Os dados saem por WFS, inclusive as
tabelas sem geometria que o portal lê.

O arquivo já é o resultado da metodologia: cada peça vem com o nível da hierarquia, a condição do
CAR e as marcas de onde cai. O core não recalcula o cômputo. Ele carrega, classifica pelo contrato
(`src/planaveg_core/contracts/categorias.v1.json`), confere os números e publica.

## Rodar

Você precisa de Docker, Python 3.13 e [uv](https://docs.astral.sh/uv/). O GeoPackage não vai para
o Git. Por padrão, ele fica em `docs/gpkg/`, na raiz do monorepo (veja `docs/gpkg/README.md`).

```bash
cd apps/core
uv sync --extra dev
make up                        # PostGIS em 127.0.0.1:55434
uv run planaveg-core inspect   # confere o arquivo contra o contrato, sem banco
uv run planaveg-core run-all   # init-db + load + verify
make geoserver                 # GeoServer em 127.0.0.1:8085 e publicação
make semear                    # tiles no cache (dezenas de minutos)
uv run planaveg-core status
```

```text
PostGIS    host=127.0.0.1  port=55434  db=planaveg  user=planaveg  password=planaveg
GeoServer  http://127.0.0.1:8085/geoserver  admin / planaveg  workspace planaveg
```

Na base final, o `verify` reprova `pecas_sem_sobreposicao`, porque o próprio arquivo conta uma área
pequena duas vezes. É uma reprovação conhecida: `run-all --aceitar pecas_sem_sobreposicao` a
registra como aceita e segue. Qualquer outra reprovação para. As invariantes estão no
[resumo do código](../../docs/resumo-do-codigo.md#a-conferência).

`make check` roda o ruff (lint, formato e complexidade), o mypy, o `import-linter`, que confere as
camadas dos pacotes, e o vulture, que procura código sem uso em `src`. `make test` roda o pytest.
Os testes de integração usam o banco local e são pulados quando ele não está de pé.

## Comandos

| Comando `planaveg-core` | O que faz | Onde |
| --- | --- | --- |
| `inspect` | Confere o arquivo sem alterar nada: `application_id`, versão, as camadas do contrato, o CRS e o nome e o tipo de cada coluna | `gpkg.py` |
| `init-db [--recreate]` | Aplica as migrações que faltam (`sql/migracoes/`), guarda a versão do contrato, acerta as regras e os municípios do IBGE no lugar e refaz as funções, as views do contrato, as chaves e as permissões. Pode rodar de novo sem perder a carga. Se o contrato tira algo que a carga usa, para com `contrato_tira_o_que_a_carga_usa`. `--recreate` descarta a carga | `banco/`, `publicacao/`, `sql/` |
| `load` | Copia as peças do GeoPackage em lotes (`COPY`), confere cada lote (rótulo, município, UF, bioma, bacias, cômputo) e grava `peca_recebida`, `peca_marca` e `peca_geometria`, esta com a geometria recebida, a cópia em 4674, a simplificada do mapa e o centroide. Recalcula as views materializadas. É uma transação só: até o fim, quem lê vê a base anterior, e se algo falha nada muda. O VACUUM roda depois do commit e, se falhar, só avisa | `carga/` |
| `verify [--rapido] [--aceitar INVARIANTE]` | Confere 16 invariantes e sai com 1 se alguma reprova sem ter sido aceita. `--rapido` pula a sobreposição entre peças, a única que leva dezenas de minutos. Pulada, ela não aprova nem reprova | `conferencia/` |
| `geoserver` | Publica workspace, datastore, estilos e uma camada por view, e remove as camadas e os estilos que saíram do contrato. Configura o cache de tiles e o esvazia quando a versão muda. Se os dados mudaram, guarda a publicação e os números dela (`publicacao`, `resultado_*`) | `geoserver/`, `estilos.py`, `cache/gwc.py` |
| `semear [--zoom-pecas 11] [--zoom-filtros 8] [--threads 4] [--desde-zoom N] [--so pecas\|filtros]` | Gera no cache os tiles que faltam: todas as camadas e estilos até o zoom 8 e depois o detalhe, só nos estilos que o portal usa e, nas peças, só no ano mais recente. `--desde-zoom` e `--so` completam uma semeadura interrompida. Se for interrompido (Ctrl+C ou o fim do container), pede ao GeoWebCache para parar a tarefa, com 5 s de prazo | `cache/semeadura.py` |
| `aquecer [--comuns] [--usados ARQ] [--zoom 8] [--threads 2]` | Gera os tiles dos filtros mais prováveis: os de uma opção só, na camada do ano mais recente (`--comuns`), e os de um arquivo `camada<TAB>estilo<TAB>cql` (`--usados`; `-` lê da entrada padrão) | `cache/aquecimento.py` |
| `status` | Mostra a entrega, as contagens, o cômputo por nível, os arranjos, os filtros, a série, as execuções e as fontes ausentes | `cli/comandos/status.py` |
| `modelagem PASTA` | Escreve o banco em SQL puro, sem abrir o banco, um arquivo por assunto: `1_tabelas.sql`, `2_funcoes.sql`, `3_views.sql` e `4_dados.sql`. Aplicados num PostGIS vazio, dão o banco do `init-db`, pronto para o `load`. `make modelagem` escreve em `modelagem/`, na raiz, e um teste falha se ela ficar para trás | `banco/modelagem.py` |
| `run-all [--recreate] [--geoserver] [--rapido] [--aceitar INVARIANTE]` | Confere o arquivo e roda `init-db`, `load` e `verify`. Com `--geoserver`, publica, mas só se o `verify` passar inteiro, e nunca com `--rapido` | `cli/comandos/run_all.py` |

`init-db`, `load`, `verify` e `geoserver` gravam uma linha em `execucao`, com início, fim, `ok`,
código do erro e um `detalhe` com parâmetros, contagens e hectares. `inspect`, `semear`, `aquecer`,
`status` e `modelagem` não gravam.

Códigos de saída: 0 quando dá certo, 1 quando o `verify` reprova, 2 em qualquer outro erro e 130
quando é interrompido.

## Onde ler mais

- [Resumo do código](../../docs/resumo-do-codigo.md): a modelagem do banco, os pacotes e as
  regras de import, o contrato, as etapas, o que o GeoServer publica, o cache e as versões.
- [`CONTEXT.md`](../../CONTEXT.md): os termos do domínio.
- As variáveis de ambiente estão em [`config.py`](src/planaveg_core/config.py).
