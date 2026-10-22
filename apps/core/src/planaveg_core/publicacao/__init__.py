"""Views geradas do contrato: a classificação das peças e tudo o que o GeoServer publica, e o
SQL das regras e dos lugares de referência em linhas.

Tudo fica no schema padrão (public). A separação é pelo nome e pela permissão:

- `peca_recebida`, `peca_marca` e `peca_geometria` (tabelas da migração, pacote `banco`): as
  peças da entrega como recebidas, as marcas delas e o desenho. Não publicadas.
- As regras (`contrato_*` e `camada_publicada`) e os lugares (`lugar_*`): o contrato vigente e as
  referências em linhas, que o `init-db` acerta no lugar (`referencia`). Não publicadas.
- `peca_classificada`: a peça da entrega pronta sem o desenho, com o nível, o arranjo e os
  filtros dela, calculados das regras do contrato; `peca_desenhada`, a classificada com as
  geometrias do mapa; `peca_lugar`, a peça em cada dimensão. Não publicadas.
- Camadas de mapa (WMS e WFS, com estilo SLD): `peca` (todos os anos, para CQL),
  `peca_<ano>` (as peças de um ano, que o portal filtra por CQL), `espacial_<filtro>_<ano>`
  (uma por filtro espacial e ano de VS, para o QGIS) e `municipio` (extensão de cada município,
  para busca e zoom).
- `peca_parte`: cada polígono de uma peça, com a área dele, para o clique do portal. Não é
  desenhada nem entra no catálogo de camadas; o GeoServer a publica como consulta com
  parâmetros (`View.parametros`), que só responde com a peça na URL.
- Tabelas sem geometria (só WFS), que o painel e as telas de dados leem: os quantitativos,
  as facetas, a série e o catálogo.

Cada peça tem um nível e um arranjo, então somar `area_ha` por nível, arranjo ou dimensão
não conta a mesma peça duas vezes. Entre peças, a sobreposição que o arquivo traz (medida
pelo `verify`, na casa de ppm) entra como veio. Filtros e categorias fundiárias são marcas:
uma peça pode ter várias, e filtros diferentes não se somam.

`peca_classificada`, os quantitativos, a série, `municipio` e `catalogo_camada` são views
materializadas: o portal lê o resultado pronto, e o `load` os recalcula ao terminar
(`atualizar_quantitativos`, do `banco`). A descrição de cada view é `Título | descrição`: o
GeoServer a usa como título e resumo, e o catálogo das camadas também.

O SQL de cada view é escrito por inteiro, com as colunas do modelo, e lê as regras das tabelas
do contrato. As colunas das marcas e as camadas que se repetem por ano ou por filtro são montadas
do contrato.

Cada assunto mora num módulo: `nomes` (os nomes e o `View`), `referencia` (as regras e os
lugares em linhas), `pecas`, `quantitativos`, `facetas`, `camadas` (o catálogo das camadas),
`catalogos` e `todas` (a lista completa, na ordem de criação). Tudo aqui só monta
SQL: quem executa é o `banco`.
"""

from planaveg_core.publicacao.nomes import (
    Familia,
    View,
    nome_espacial,
    nome_peca_ano,
    nome_peca_recente,
)
from planaveg_core.publicacao.referencia import (
    MANTIDAS,
    REFEITAS,
    TABELAS_DE_REFERENCIA,
    dados_de_referencia,
    remocoes,
)
from planaveg_core.publicacao.todas import views

__all__ = [
    "MANTIDAS",
    "REFEITAS",
    "TABELAS_DE_REFERENCIA",
    "Familia",
    "View",
    "dados_de_referencia",
    "nome_espacial",
    "nome_peca_ano",
    "nome_peca_recente",
    "remocoes",
    "views",
]
