"""Aquecimento do cache de tiles: os filtros mais prováveis prontos antes de alguém pedir.

Todas as combinações de filtros não cabem em cache nenhum (passam de 10²⁰), e o que demora é o
GeoServer desenhar um filtro novo pela primeira vez (de 2 a 5 s por bloco na vista nacional).
Por isso a etapa `aquecer` semeia, até o zoom 8 (a vista nacional e a regional, as caras):

- os filtros comuns, de uma opção só, na camada do ano mais recente, a única que o portal
  desenha: cada tipo de área sozinho e todos menos um, cada condição do cadastro, caminho, tema
  do relatório, estado e bioma;
- os filtros usados de fato, lidos do log do nginx (`infra/producao/filtros-usados.sh`), no
  formato `camada<TAB>estilo<TAB>cql`.

O texto do filtro é a chave do cache: tem de sair igual ao que o portal manda
(`cqlDosFiltros`, em `apps/web/src/modules/filtros/utils/cql.ts`): `coluna IN ('a', 'b')`
com os valores em ordem, e o CQL do tema como está em `catalogo_filtro`.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Sequence

import psycopg

from planaveg_core.cache.gwc import FILTRO_CQL, qualificado
from planaveg_core.cache.semeadura import ZOOM_TODAS, Semeadura
from planaveg_core.contrato import Contrato, cql, literal_cql
from planaveg_core.publicacao import View

_LOG = logging.getLogger("planaveg_core.aquecimento")

_FILTRO = re.compile(FILTRO_CQL.removeprefix("(?U)"))


def _em(coluna: str, valores: Iterable[str]) -> str:
    """`coluna IN ('a', 'b')`, com os valores em ordem, como o portal escreve: o texto é a chave
    do cache, e um espaço ou uma ordem diferente cairia noutra entrada."""
    lista = ", ".join(literal_cql(valor) for valor in sorted(valores))
    return f"{coluna} IN ({lista})"


def filtros_comuns(contrato: Contrato, estados: Sequence[str], biomas: Sequence[str]) -> list[str]:
    """Os filtros de uma opção só, como o portal os escreve."""
    # Os códigos dos níveis, sem repetir (os do CAR têm uma linha por condição), na ordem da
    # hierarquia: `dict.fromkeys` guarda o primeiro de cada um.
    niveis = list(dict.fromkeys(n.codigo for n in contrato.niveis_presentes()))
    filtros = [_em("nivel", [nivel]) for nivel in niveis]
    # Todos os tipos menos um: quem marca todos na lista e tira um.
    for nivel in niveis:
        outros = [outro for outro in niveis if outro != nivel]
        filtros.append(_em("nivel", outros))
    # As situações do cadastro da planilha, cada uma com as condições da base que ela junta
    # (`situacao` no contrato), como o portal as escreve (`CONDICOES_CAR`, no glossário dele).
    por_situacao: dict[str, set[str]] = {}
    for n in contrato.hierarquia:
        if n.categoria is not None and n.situacao is not None:
            por_situacao.setdefault(n.situacao, set()).add(n.categoria)
    filtros += [_em("categoria", categorias) for categorias in por_situacao.values()]
    # Os três arranjos do plano, os que têm meta: as demais áreas de projetos ficam fora da
    # lista do portal.
    filtros += [_em("arranjo", [a.codigo]) for a in contrato.arranjos if a.meta_ha is not None]
    # Os temas que o portal oferece (`Filtro.tema`, publicado em `catalogo_filtro.tema`).
    filtros += [cql(f.predicado) for f in contrato.filtros if f.tema]
    filtros += [_em("uf", [uf]) for uf in estados]
    filtros += [_em("bioma", [bioma]) for bioma in biomas]
    # Sem repetir, na ordem acima (o primeiro de cada um fica).
    return list(dict.fromkeys(filtros))


def valores_do_banco(con: psycopg.Connection) -> tuple[list[str], list[str]]:
    """Os estados e os biomas que as peças trazem (as opções das listas do portal)."""
    estados = [
        str(r[0])
        for r in con.execute(
            "SELECT DISTINCT uf FROM peca_classificada WHERE uf IS NOT NULL ORDER BY 1"
        ).fetchall()
    ]
    biomas = [
        str(r[0])
        for r in con.execute(
            "SELECT DISTINCT bioma FROM peca_classificada WHERE bioma IS NOT NULL ORDER BY 1"
        ).fetchall()
    ]
    return estados, biomas


def ler_usados(linhas: Iterable[str], views: Sequence[View]) -> list[tuple[str, str, str]]:
    """As linhas `camada<TAB>estilo<TAB>cql` que valem: camada em cache, estilo dela e filtro
    que o cache aceita. O resto é descartado (o log vem de pedidos de fora)."""
    em_cache = _filtraveis(views)
    prefixo = qualificado("")  # `planaveg:`, que o WMTS põe na frente da camada e do estilo
    usados: list[tuple[str, str, str]] = []
    for linha in linhas:
        try:
            camada, estilo, filtro = [campo.strip() for campo in linha.rstrip("\n").split("\t")]
        except ValueError:
            continue  # não tem os três campos
        view = em_cache.get(camada.removeprefix(prefixo))
        estilo = estilo.removeprefix(prefixo)
        if view is None or estilo not in view.estilos or not _FILTRO.fullmatch(filtro):
            _LOG.info("filtro usado descartado: %s %s", camada, estilo)
            continue
        usados.append((view.nome, estilo, filtro))
    return usados


def plano(
    views: Sequence[View],
    comuns: Sequence[str],
    usados: Sequence[tuple[str, str, str]] = (),
    *,
    recente: str,
    zoom_fim: int = ZOOM_TODAS,
) -> list[Semeadura]:
    """Uma semeadura por camada, estilo e filtro, do zoom 0 a `zoom_fim`: os comuns na camada
    do ano mais recente (`recente`), nos estilos que o portal pede, e os usados como foram
    pedidos. Sem repetir."""
    por_nome = _filtraveis(views)
    tarefas: dict[tuple[str, str, str], Semeadura] = {}

    def acrescentar(view: View, estilo: str, filtro: str) -> None:
        chave = (view.nome, estilo, filtro)
        if chave not in tarefas:
            tarefas[chave] = Semeadura.da_view(view, estilo, 0, zoom_fim, cql=filtro)

    atual = por_nome[recente]
    # Os estilos que o portal pede, como na semeadura.
    for estilo in atual.estilos_do_portal or atual.estilos[:1]:
        for filtro in comuns:
            acrescentar(atual, estilo, filtro)
    for nome, estilo, filtro in usados:
        acrescentar(por_nome[nome], estilo, filtro)
    return list(tarefas.values())


def _filtraveis(views: Sequence[View]) -> dict[str, View]:
    """As camadas em cache que aceitam filtro, pelo nome: as das peças de cada ano."""
    return {v.nome: v for v in views if v.filtravel}
