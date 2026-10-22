"""As duas versões e o que entra em cada uma: o desenho do mapa, tudo o que é publicado e a
identidade da carga.

O desenho de um grupo de camadas é o SQL delas e de tudo o que elas leem, até o fim: as views
geradas e os dados das tabelas de referência (o contrato e os municípios do IBGE em linhas),
achados pelo nome no SQL. As funções que as views chamam e as migrações entram nas duas.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID

import psycopg

from planaveg_core import banco, etapas
from planaveg_core.cache import gwc
from planaveg_core.contrato import Contrato
from planaveg_core.errors import PlanavegError
from planaveg_core.estilos import estilos
from planaveg_core.publicacao import TABELAS_DE_REFERENCIA, View, dados_de_referencia, views


@dataclass(frozen=True)
class Versoes:
    """A do mapa (os tiles das peças e dos filtros) e a dos dados (o WFS e o WMS sem cache)."""

    mapa: str
    dados: str


def desenho_do_mapa(lista: list[View], slds: Mapping[str, str]) -> tuple[list[str], dict[str, str]]:
    """O que muda um tile das peças e dos filtros: as views em cache, o que elas leem (a
    classificação, `peca` e as tabelas de referência) e os estilos delas. Os estilos de camadas
    sem cache (o contorno do município) ficam de fora: mudá-los não esvazia o cache das peças."""
    desenhadas = [v for v in lista if v.tiles]
    usados = {estilo for v in desenhadas for estilo in v.estilos}
    return (
        lidos(lista, desenhadas),
        {nome: sld for nome, sld in slds.items() if nome in usados},
    )


def lidos(lista: list[View], inicio: list[View]) -> list[str]:
    """As views de `inicio` e tudo o que elas leem, até o fim: as views da `lista` e as tabelas
    de referência que o SQL lê (depois de FROM ou JOIN). Um nome a mais só muda a versão mais
    vezes."""
    corpos = {v.nome: v.corpo.as_string() for v in lista}
    candidatos = {*corpos, *TABELAS_DE_REFERENCIA}
    achados: list[str] = []
    pendentes = [v.nome for v in inicio]
    while pendentes:
        nome = pendentes.pop(0)
        if nome in achados:
            continue
        achados.append(nome)
        lidas = re.findall(r'(?:FROM|JOIN)\s+"?(\w+)"?', corpos.get(nome, ""))
        pendentes.extend(n for n in lidas if n in candidatos)
    return achados


def _identidade_dos_dados(con: psycopg.Connection, entrega_id: UUID) -> str:
    """O arquivo da entrega pronta e a última carga dele (recarregar muda as simplificadas)."""
    linha = con.execute(
        """
        SELECT e.sha256,
               (SELECT max(x.id) FROM execucao x
                 WHERE x.entrega_id = e.id AND x.etapa = %s AND x.ok)
        FROM entrega e
        WHERE e.id = %s
        """,
        (etapas.LOAD, entrega_id),
    ).fetchone()
    if linha is None:
        raise PlanavegError("entrega_inexistente", str(entrega_id))
    return f"{linha[0]}|carga {linha[1]}"


def calcular_versoes(con: psycopg.Connection, contrato: Contrato) -> Versoes:
    """As duas versões, da carga, das views, dos dados de referência e dos estilos."""
    entrega_id = banco.entrega_pronta(con)
    identidade = _identidade_dos_dados(con, entrega_id)
    lista = views(contrato)
    slds = estilos(contrato)
    fixos = banco.textos_fixos()
    # O texto de cada nome que uma versão pode levar: o SQL das views, o INSERT de cada tabela de
    # referência e os textos fixos (as funções e as migrações).
    textos = {view.nome: view.corpo.as_string(con) for view in lista}
    for tabela, insercao in dados_de_referencia(contrato, lista).items():
        textos[tabela] = insercao.as_string(con)
    textos.update(fixos)

    def desenho(nomes: list[str]) -> dict[str, str]:
        """Os textos dos nomes e os fixos, que entram nas duas versões. Um nome sem texto próprio
        (uma tabela de referência sem linhas, ou a `lugar_uf`, que vem das migrações) entra
        vazio."""
        return {nome: textos.get(nome, "") for nome in [*nomes, *fixos]}

    do_mapa, estilos_do_mapa = desenho_do_mapa(lista, slds)
    versao = gwc.versao_mapa(identidade, desenho(do_mapa), estilos_do_mapa)
    versao_dados = gwc.versao_mapa(
        identidade, desenho(lidos(lista, lista)), _estilos_sem_cache(lista, slds)
    )
    return Versoes(mapa=versao, dados=versao_dados)


def _estilos_sem_cache(lista: list[View], slds: Mapping[str, str]) -> dict[str, str]:
    """Os estilos das camadas publicadas sem cache de tiles, servidas pelo WMS com a versão dos
    dados: o contorno do município, que o portal pede, e os de `peca` (todos os anos), do QGIS.

    O que a versão dos dados cobre muda com a carga, qualquer view e estes estilos: com ela na
    URL, uma resposta nunca fica velha, e a CDN pode guardá-la sem precisar de limpeza.
    """
    usados = {estilo for v in lista if v.publicada and not v.tiles for estilo in v.estilos}
    return {nome: sld for nome, sld in slds.items() if nome in usados}
