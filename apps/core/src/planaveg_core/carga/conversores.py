"""A conversão de cada valor do arquivo para o tipo do contrato: texto, inteiro, número ou marca."""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Callable
from typing import Any

from planaveg_core.contrato import ATRIBUTOS, Coluna, Contrato
from planaveg_core.errors import PlanavegError


class ValorInvalido(Exception):
    """Valor da origem que não converte para o tipo canônico da coluna.

    Interno à carga. Em coluna anulável o valor vira NULL e é contado em
    `execucao.detalhe.camadas.<camada>.anulados`; em coluna obrigatória a carga falha
    com `valor_incompativel`. Nunca é silencioso.
    """


class ValorNaoFinito(Exception):
    """NaN ou infinito em coluna numérica: dado corrompido, falha sempre."""


Conversor = Callable[[object], object]


def _ausente(valor: object) -> bool:
    return valor is None or (isinstance(valor, str) and valor.strip() == "")


_INTEGER = (-(2**31), 2**31 - 1)
"""O `integer` do PostgreSQL (32 bits): o tipo das colunas inteiras do contrato."""
_BIGINT = (-(2**63), 2**63 - 1)
"""O `bigint`: o do `fid` das peças (`origem_id`)."""


def _texto_nao_finito(valor: str) -> bool:
    """ "nan", "inf" ou "-infinity" escritos como texto: o mesmo dado corrompido de um float."""
    try:
        return not math.isfinite(float(valor))
    except ValueError:
        return False


def _inteiro(valor: object, limites: tuple[int, int]) -> int:
    """Um inteiro que cabe na coluna. NaN e infinito, como número ou como texto, são dado
    corrompido, como numa coluna `double`; fora dos limites, o `COPY` falharia sem dizer qual
    coluna: é valor inválido."""
    if isinstance(valor, bool) or not isinstance(valor, int | float | str):
        raise ValorInvalido
    if isinstance(valor, str) and _texto_nao_finito(valor):
        raise ValorNaoFinito
    if isinstance(valor, float):
        if not math.isfinite(valor):
            raise ValorNaoFinito
        if not valor.is_integer():
            raise ValorInvalido
    try:
        numero = int(valor)
    except ValueError as exc:
        raise ValorInvalido from exc
    if not limites[0] <= numero <= limites[1]:
        raise ValorInvalido
    return numero


def _para_inteiro(valor: object) -> int:
    return _inteiro(valor, _INTEGER)


def para_bigint(valor: object) -> int:
    return _inteiro(valor, _BIGINT)


def _para_double(valor: object) -> float:
    if isinstance(valor, bool) or not isinstance(valor, int | float | str):
        raise ValorInvalido
    try:
        numero = float(valor)
    except ValueError as exc:
        raise ValorInvalido from exc
    if not math.isfinite(numero):
        raise ValorNaoFinito
    return numero


def _para_texto(valor: object) -> str:
    if isinstance(valor, bytes):
        raise ValorInvalido
    return str(valor)


_CONVERSORES: dict[str, Conversor] = {"integer": _para_inteiro, "double": _para_double}


def _conversor_marca(coluna: Coluna) -> Conversor:
    """Marca: vazio é `false`, o literal do contrato é `true`; qualquer outro valor falha."""
    marcado = coluna.marcado
    destino = coluna.destino

    def converter(valor: object) -> object:
        if _ausente(valor):
            return False
        if valor == marcado:
            return True
        raise PlanavegError("marca_com_valor_inesperado", destino)

    return converter


def conversor_para(coluna: Coluna) -> Conversor:
    """Resolve uma vez, por coluna, o conversor do tipo do contrato.

    A função devolvida trata ausência (NULL ou texto em branco) conforme `anulavel` e
    delega o resto ao conversor do tipo; `ValorInvalido` sobe para quem chama decidir
    entre anular e falhar.
    """
    if coluna.marca:
        return _conversor_marca(coluna)
    base = _CONVERSORES.get(coluna.tipo, _para_texto)
    destino = coluna.destino
    anulavel = coluna.anulavel

    fora = coluna.fora

    def converter(valor: object) -> object:
        if _ausente(valor):
            if not anulavel:
                raise PlanavegError("valor_obrigatorio_ausente", destino)
            return None
        if fora is not None and valor == fora:
            return None  # fora dos limites oficiais: o banco guarda NULL
        try:
            return base(valor)
        except ValorNaoFinito as exc:
            raise PlanavegError("valor_nao_finito", destino) from exc

    return converter


def converter_linha(
    linha: tuple[Any, ...],
    conversores: list[tuple[Coluna, Conversor]],
    anulados: Counter[str],
) -> list[Any]:
    registro: list[Any] = []
    for (coluna, converter), valor in zip(conversores, linha, strict=True):
        try:
            registro.append(converter(valor))
        except ValorInvalido as exc:
            if not coluna.anulavel:
                raise PlanavegError("valor_incompativel", coluna.destino) from exc
            anulados[coluna.destino] += 1
            registro.append(None)
    return registro


class Leitor:
    """Lê uma linha do arquivo (as colunas do contrato, na ordem dele) como o pouso da carga a
    recebe: as colunas do modelo (`ATRIBUTOS`), na ordem delas, e a lista das marcas ligadas.

    A marca lida da Sobreposicao (`fonte`) liga quando a sigla dela está no texto: a coluna dela só
    é conferida. O contrato garante que nenhuma outra sigla contém a dela.
    """

    def __init__(self, contrato: Contrato) -> None:
        self._conversores = [(coluna, conversor_para(coluna)) for coluna in contrato.colunas]
        indice = {c.destino: i for i, c in enumerate(contrato.colunas)}
        self._atributos = [indice[destino] for destino in ATRIBUTOS]
        self._marcas = [
            (i, c.destino) for i, c in enumerate(contrato.colunas) if c.marca and c.fonte is None
        ]
        siglas = dict(contrato.sobreposicao)
        self._da_sobreposicao = [
            (c.destino, siglas[c.destino]) for c in contrato.colunas if c.fonte == "sobreposicao"
        ]
        self._sobreposicao = indice["sobreposicao"]

    def ler(self, linha: tuple[Any, ...], anulados: Counter[str]) -> tuple[list[Any], list[str]]:
        valores = converter_linha(linha, self._conversores, anulados)
        texto = valores[self._sobreposicao] or ""
        marcas = [destino for i, destino in self._marcas if valores[i]]
        marcas += [destino for destino, sigla in self._da_sobreposicao if sigla in texto]
        return [valores[i] for i in self._atributos], marcas
