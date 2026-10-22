"""As regras do contrato avaliadas direto sobre uma peça, como o relatório as escreve: a
referência contra a qual se conferem as alternativas e a classificação do banco."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def vale(expr: Mapping[str, Any], peca: Mapping[str, Any]) -> bool:
    """`peca` tem `marcas` (um conjunto), `nivel` e `arranjo`."""
    ((operador, valor),) = expr.items()
    if operador == "marca":
        return bool(set(valor) & peca["marcas"])
    if operador in {"nivel", "arranjo"}:
        return peca[operador] in valor
    if operador == "ou":
        return any(vale(item, peca) for item in valor)
    if operador == "e":
        return all(vale(item, peca) for item in valor)
    return not vale(valor, peca)
