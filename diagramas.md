# Diagramas da modelagem nova

Os diagramas estão em Mermaid: o GitHub e o VS Code (com a extensão de Markdown com Mermaid) os
desenham sozinhos. O texto que explica cada peça está no [README](README.md).

## 1. Diagrama lógico: as tabelas

Quatro tabelas. `area_mapeada` tem uma linha por área do GeoPackage; `nivel`, `arranjo` e `tema`
são as referências, com uma linha por nível, arranjo e tema.

```mermaid
erDiagram
    nivel |o--o{ area_mapeada : "a área conta em um nível"
    arranjo ||--o{ area_mapeada : "a área cai em um arranjo"
    tema }o..o{ area_mapeada : "regra na view computo_por_tema"

    nivel {
        integer id PK "1 a 11"
        text nome "Reserva Legal..."
        text grupo "grupo de saída do relatório"
    }
    arranjo {
        text slug PK "areas_publicas, app_rl_aur..."
        integer ordem "prioridade"
        text nome
        numeric meta_ha "meta até 2030"
    }
    tema {
        text slug PK "car, manguezal..."
        integer ordem "ordem no relatório"
        text grupo
        text nome
    }
    area_mapeada {
        smallint ano_mapeamento PK "2022 ou 2024"
        bigint id_no_arquivo PK "fid do GeoPackage"
        integer nivel FK "id de nivel"
        text linha_hierarquia
        text situacao_car
        double total_linha_hierarquia_ha "cômputo da linha, do arquivo"
        double area_ha
        text uf
        text bioma
        text municipio
        text codigo_ibge_municipio
        text bacia
        text mesobacia
        text regiao_hidrografica
        boolean in_car "e mais 32 marcas in_: sim ou não"
        text siglas_sobreposicao
        text arranjo FK "slug de arranjo; gerada, o PostgreSQL calcula"
        geometry geom "MultiPolygon, SIRGAS 2000 (4674)"
    }
```

- **Linha cheia** é chave estrangeira: o banco só aceita em `area_mapeada.nivel` um `id` que
  exista em `nivel`, e em `area_mapeada.arranjo` um `slug` que exista em `arranjo`.
- **Linha tracejada** (`tema`) não é chave estrangeira: uma área pode estar em vários temas, e quem
  diz em quais é a regra da view `computo_por_tema`.
- **A chave de `area_mapeada`** é o par `(ano_mapeamento, id_no_arquivo)`: o mesmo `fid` existe nas
  duas camadas do arquivo.

## 2. De onde cada view lê

As onze views não guardam nada: leem as tabelas na hora. Todas leem `area_mapeada` (a seta
grossa); as setas finas mostram o que cada uma lê além dela.

```mermaid
flowchart LR
    gpkg[("GeoPackage<br/>2022 e 2024")] -- "3_carga.py" --> area[("area_mapeada")]
    area ==> views

    subgraph referencias ["Referências"]
        nivel[("nivel")]
        arranjo[("arranjo")]
        tema[("tema")]
    end

    subgraph views ["Views (2_views.sql)"]
        v_nivel["computo_por_nivel"]
        v_lugar["computo_por_uf, _municipio, _bioma,<br/>_regiao_hidrografica, _mesobacia, _bacia"]
        v_uc["computo_por_esfera_uc"]
        v_arranjo["computo_por_arranjo"]
        v_tema["computo_por_tema"]
        v_anos["comparacao_entre_anos"]
    end

    nivel --> v_nivel & v_lugar & v_anos
    arranjo --> v_arranjo
    tema --> v_tema
    v_arranjo & v_tema --> v_anos
```

O GeoServer publica `area_mapeada` como mapa (WMS) e as views, `nivel`, `arranjo` e `tema` como
tabelas (WFS).

## 3. Fluxograma: montar o banco (uma vez)

```mermaid
flowchart LR
    a["createdb"] --> b["1_tabelas.sql:<br/>liga o PostGIS<br/>registra o Albers do IBGE (SRID 100000)<br/>cria nivel, arranjo e tema, com as linhas<br/>cria area_mapeada, vazia"]
    b --> c["2_views.sql:<br/>cria as 11 views"]
    c --> d(["pronto para a carga"])
```

## 4. Fluxograma: a carga (a cada GeoPackage novo)

Tudo entre o começo da transação e o `COMMIT` é uma transação só: se der erro em qualquer ponto, o
banco desfaz tudo (`ROLLBACK`) e a tabela fica com a carga anterior.

```mermaid
flowchart TD
    inicio(["uv run 3_carga.py arquivo.gpkg"]) --> ok{"arquivo e<br/>DATABASE_URL?"}
    ok -- "falta" --> para1(["para com uma mensagem"])
    ok -- "ok" --> abre["abre o GeoPackage<br/>só para leitura e<br/>começa a transação"]
    abre --> limpa["TRUNCATE area_mapeada"]
    limpa --> camada["próxima camada:<br/>2022, depois 2024"]
    camada --> conhece{"coluna que<br/>COLUNAS não<br/>conhece?"}
    conhece -- "sim" --> para2(["para: ROLLBACK, nada muda"])
    conhece -- "não" --> prepara["para cada área:<br/>tira o cabeçalho do desenho,<br/>marcas viram sim ou não"]
    prepara --> grava["INSERT em area_mapeada"]
    grava --> postgres["o PostgreSQL, ao gravar:<br/>converte Albers para 4674,<br/>calcula o arranjo,<br/>confere nível, arranjo<br/>e tipo do desenho"]
    postgres --> erro{"erro?"}
    erro -- "sim" --> para3(["para: ROLLBACK,<br/>a tabela fica como estava"])
    erro -- "não" --> falta{"falta<br/>camada?"}
    falta -- "sim" --> camada
    falta -- "não" --> analisa["ANALYZE area_mapeada"]
    analisa --> fim(["COMMIT: a base nova está no ar"])
    fim --> cache["no GeoServer:<br/>esvaziar o cache de tiles<br/>de area_mapeada"]
```

## 5. A regra do arranjo

O arranjo de cada área é o primeiro que ela atende, na ordem de prioridade. É a coluna gerada
`arranjo` de `area_mapeada` (`1_tabelas.sql`).

```mermaid
flowchart LR
    area(["uma área"]) --> publicas{"área<br/>pública?"}
    publicas -- "sim" --> ap["areas_publicas"]
    publicas -- "não" --> app{"APP, RL<br/>ou AUR?"}
    app -- "sim" --> arl["app_rl_aur"]
    app -- "não" --> demais["demais_areas"]
```

- **Área pública:** nível 6, 7 ou 8 (Terras Indígenas, Unidades de Conservação, Sistemas
  Costeiros), ou está em UC, RPPN, Terra Indígena, assentamento ou território quilombola. A UC aqui
  é a sigla `UC` de `siglas_sobreposicao`, que não conta APA; não é a marca `in_uc` (veja
  "Cuidados" no README).
- **APP, RL ou AUR:** nível 3, 9, 10 ou 11 (PRADA, APP, AUR, Reserva Legal), ou está em APP, RL ou
  AUR de imóvel do CAR (habilitado, analisado ou não analisado), ou em imóvel do CAR em
  regularização.

O arranjo `baixa_produtividade` existe na tabela `arranjo`, mas a regra não manda nenhuma área para
ele: nas views, ele aparece com zero.
