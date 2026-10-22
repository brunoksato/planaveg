"""Conversão de valores da origem para os tipos canônicos e hash do arquivo."""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import replace
from typing import Any

import pytest

from planaveg_core.carga import ValorInvalido, conversor_para
from planaveg_core.carga.conversores import converter_linha
from planaveg_core.contrato import Coluna
from planaveg_core.errors import PlanavegError


def _coluna(tipo: str, *, anulavel: bool = True, marcado: str | None = None) -> Coluna:
    return Coluna(
        origem="campo",
        destino="campo",
        tipo=tipo,
        anulavel=anulavel,
        descricao="campo de teste",
        marcado=marcado,
    )


@pytest.mark.parametrize("tipo", ["integer", "double", "text"])
@pytest.mark.parametrize("valor", [None, "", "   "])
def test_ausente_vira_null_em_coluna_anulavel(tipo: str, valor: object) -> None:
    assert conversor_para(_coluna(tipo))(valor) is None


@pytest.mark.parametrize("valor", [None, "", "   "])
def test_ausente_falha_em_coluna_obrigatoria(valor: object) -> None:
    with pytest.raises(PlanavegError) as info:
        conversor_para(_coluna("text", anulavel=False))(valor)
    assert info.value.codigo == "valor_obrigatorio_ausente"


@pytest.mark.parametrize(
    ("tipo", "valor", "esperado"),
    [
        ("integer", 12, 12),
        ("integer", 12.0, 12),
        ("integer", "12", 12),
        ("double", 1.5, 1.5),
        ("double", "1.5", 1.5),
        ("double", 2, 2.0),
        ("text", 12, "12"),
        ("text", "abc", "abc"),
        ("text", 1.0, "1.0"),
    ],
)
def test_converte_valores_validos(tipo: str, valor: object, esperado: Any) -> None:
    assert conversor_para(_coluna(tipo))(valor) == esperado


@pytest.mark.parametrize(
    ("tipo", "valor"),
    [
        ("integer", True),
        ("integer", 12.5),
        ("integer", "12.0"),
        ("integer", "abc"),
        ("integer", b"1"),
        ("double", True),
        ("double", "abc"),
        ("double", b"1"),
        ("text", b"bytes"),
    ],
)
def test_valor_invalido_sobe_para_quem_chama_decidir(tipo: str, valor: object) -> None:
    # A carga anula e conta em coluna anulável; falha em coluna obrigatória.
    with pytest.raises(ValorInvalido):
        conversor_para(_coluna(tipo))(valor)
    with pytest.raises(ValorInvalido):
        conversor_para(_coluna(tipo, anulavel=False))(valor)


@pytest.mark.parametrize("valor", [math.nan, math.inf, "inf", "-inf", "nan"])
@pytest.mark.parametrize("anulavel", [True, False])
def test_nao_finito_falha_sempre(valor: object, anulavel: bool) -> None:
    with pytest.raises(PlanavegError) as info:
        conversor_para(_coluna("double", anulavel=anulavel))(valor)
    assert info.value.codigo == "valor_nao_finito"


@pytest.mark.parametrize(
    ("valor", "esperado"), [("APP - Habilitado", True), ("", False), (None, False)]
)
def test_marca_liga_so_com_o_literal_do_contrato(valor: object, esperado: bool) -> None:
    coluna = _coluna("marca", anulavel=False, marcado="APP - Habilitado")
    assert conversor_para(coluna)(valor) is esperado


@pytest.mark.parametrize("valor", ["APP - habilitado", "Sim", 1, "APP"])
def test_marca_com_outro_valor_falha(valor: object) -> None:
    coluna = _coluna("marca", anulavel=False, marcado="APP - Habilitado")
    with pytest.raises(PlanavegError) as info:
        conversor_para(coluna)(valor)
    assert info.value.codigo == "marca_com_valor_inesperado"


@pytest.mark.parametrize("valor", [2**31, -(2**31) - 1, "99999999999"])
def test_inteiro_fora_do_integer_e_valor_invalido(valor: object) -> None:
    # O COPY falharia com um erro do banco sem dizer a coluna; aqui, anula ou falha com código.
    with pytest.raises(ValorInvalido):
        conversor_para(_coluna("integer"))(valor)


def test_linha_anula_e_conta_na_anulavel_e_falha_na_obrigatoria() -> None:
    anulavel = replace(_coluna("integer"), destino="anulavel")
    obrigatoria = replace(_coluna("integer", anulavel=False), destino="obrigatoria")
    conversores = [(c, conversor_para(c)) for c in (anulavel, obrigatoria)]
    anulados: Counter[str] = Counter()

    assert converter_linha(("abc", 7), conversores, anulados) == [None, 7]
    assert anulados == Counter({"anulavel": 1})
    with pytest.raises(PlanavegError) as info:
        converter_linha((1, "abc"), conversores, anulados)
    assert info.value.codigo == "valor_incompativel"
