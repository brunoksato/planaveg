"""Contrato do planaveg_core (`contracts/categorias.v1.json`).

A fonte da estrutura do GeoPackage Planaveg 2026 (camadas, ano de VS de cada uma,
colunas e tipos), da hierarquia de tiers e dos seus grupos, dos filtros espaciais e
quantitativos do relatório, dos arranjos de implementação e das fontes ausentes. As regras e os
catálogos não se repetem: o `init-db` grava o contrato em tabelas (`contrato_*`, montadas na
`publicacao`), as views as leem, e os estilos saem das cores daqui. As colunas do GeoPackage que
não são marcas são as do modelo (`ATRIBUTOS`): o SQL as escreve pelo nome, e o contrato que traz
outra não carrega. As marcas são linhas (`contrato_marca`, `peca_marca`): uma nova muda só o
contrato. `Grupo` e `FonteAusente` ficam em `modelo`: quem usa lê os campos do `Contrato`, sem
importar as classes.

Predicados (filtros e arranjos) são expressões JSON pequenas sobre a peça:
`{"marca": [...]}` (alguma marca verdadeira), `{"nivel": [...]}` (código do nível),
`{"arranjo": [...]}`, `{"ou": [...]}`, `{"e": [...]}` e `{"nao": expr}`. Nas tabelas, cada
predicado vai em forma normal disjuntiva (`alternativas`): uma linha por condição e uma por valor
(a marca, o nível ou o arranjo que ela cita, com chave estrangeira).

Módulos: `modelo` (as dataclasses), `leitura` (o JSON conferido) e `predicados` (as
alternativas e o CQL).
"""

from planaveg_core.contrato.leitura import carregar_contrato
from planaveg_core.contrato.modelo import (
    ATRIBUTOS,
    Arranjo,
    Atributo,
    Camada,
    Coluna,
    Contrato,
    Dimensao,
    Filtro,
    Nivel,
)
from planaveg_core.contrato.predicados import alternativas, cql, literal_cql

__all__ = [
    "ATRIBUTOS",
    "Arranjo",
    "Atributo",
    "Camada",
    "Coluna",
    "Contrato",
    "Dimensao",
    "Filtro",
    "Nivel",
    "alternativas",
    "carregar_contrato",
    "cql",
    "literal_cql",
]
