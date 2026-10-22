"""Os predicados do contrato (filtros e arranjos) nas duas formas que o core usa: as alternativas,
que viram linhas das tabelas de condição, e o CQL sobre as colunas publicadas.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from itertools import product
from typing import Any

from planaveg_core.errors import PlanavegError


@dataclass(frozen=True)
class Condicao:
    """A peça ter alguma das marcas, um dos níveis ou um dos arranjos de `valores` (`campo`);
    negada, não ter nenhum."""

    campo: str
    valores: tuple[str, ...]
    negada: bool = False


def alternativas(expr: Mapping[str, Any], *, negada: bool = False) -> list[list[Condicao]]:
    """A expressão em forma normal disjuntiva: vale se alguma alternativa vale, e uma alternativa
    vale se todas as condições dela valem.

    `ou` junta as alternativas das partes; `e` combina uma alternativa de cada parte; `nao` passa
    para dentro (De Morgan) até negar a condição. O contrato já conferiu os nomes.
    """
    # Um objeto de uma chave só (o contrato confere): o operador e o argumento dele.
    ((operador, valor),) = expr.items()
    if operador == "nao":
        return alternativas(valor, negada=not negada)
    if operador in {"ou", "e"}:
        partes = [alternativas(item, negada=negada) for item in valor]
        # Negado, o `ou` vira `e` e o `e` vira `ou`.
        efetivo = {"ou": "e", "e": "ou"}[operador] if negada else operador
        if efetivo == "ou":
            # Vale se alguma parte vale: as alternativas de todas as partes, numa lista só.
            return [alternativa for parte in partes for alternativa in parte]
        # Vale se todas valem: cada escolha de uma alternativa por parte (`product`) vira uma
        # alternativa, com as condições das escolhidas.
        return [
            [condicao for alternativa in combinacao for condicao in alternativa]
            for combinacao in product(*partes)
        ]
    if operador in {"marca", "nivel", "arranjo"}:
        return [[Condicao(operador, tuple(valor), negada)]]
    raise PlanavegError("predicado_operador_desconhecido", operador)


def cql(expr: Mapping[str, Any]) -> str:
    """A expressão em CQL sobre as colunas publicadas das peças.

    É o que o portal manda ao GeoServer para filtrar o mapa por um filtro do relatório: a marca
    vira `marca = true`, `nivel` e `arranjo` viram `IN`. O contrato já conferiu os nomes
    (identificadores simples); os valores entram entre aspas, com aspa dobrada.
    """
    ((operador, valor),) = expr.items()
    if operador == "marca":
        marcas = " OR ".join(f"{marca} = true" for marca in valor)
        return f"({marcas})"
    if operador in {"nivel", "arranjo"}:
        lista = ", ".join(literal_cql(codigo) for codigo in valor)
        return f"{operador} IN ({lista})"
    if operador in {"ou", "e"}:
        juncao = " OR " if operador == "ou" else " AND "
        partes = juncao.join(cql(item) for item in valor)
        return f"({partes})"
    if operador == "nao":
        return f"(NOT {cql(valor)})"
    raise PlanavegError("predicado_operador_desconhecido", operador)


def literal_cql(valor: str) -> str:
    """O texto entre aspas simples, com a aspa de dentro dobrada, como o CQL o escreve."""
    return "'{}'".format(valor.replace("'", "''"))
