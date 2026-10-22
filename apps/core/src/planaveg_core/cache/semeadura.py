"""A semeadura: o plano (a vista nacional e regional de tudo primeiro, depois o detalhe), o pedido
de cada tarefa ao GeoWebCache, com a mesma chave que o WMTS lê, o andamento e a parada (`parar`,
quando o `semear` é interrompido).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, replace

from planaveg_core.cache.gwc import FORMATO, GRADE, qualificado
from planaveg_core.config import Settings
from planaveg_core.publicacao import Familia, View
from planaveg_core.rest import consulta, corpo_form, corpo_json, pedido

ZOOM_TODAS = 8
"""Até este zoom a semeadura cobre todas as camadas e todos os estilos; acima, cada família vai
até o seu zoom (`Profundidade`), só com os estilos que o portal pede (`View.estilos_do_portal`)."""


@dataclass(frozen=True)
class Semeadura:
    view: str
    estilo: str
    zoom_inicio: int
    zoom_fim: int
    padrao: bool
    """Estilo padrão da camada: o WMTS o guarda sem parâmetro, e a semeadura tem de fazer igual."""
    cql: str | None = None
    """Um filtro do portal (`CQL_FILTER`), escrito como o portal o manda: é a chave do cache."""
    filtravel: bool = False
    """A camada aceita `CQL_FILTER` no cache (`View.filtravel`)."""

    @classmethod
    def da_view(
        cls, view: View, estilo: str, zoom_inicio: int, zoom_fim: int, cql: str | None = None
    ) -> Semeadura:
        """A tarefa de uma camada, com o que faz a chave sair igual à do WMTS: se o estilo é o
        padrão e se a camada aceita filtro."""
        return cls(
            view.nome,
            estilo,
            zoom_inicio,
            zoom_fim,
            padrao=estilo == view.estilos[0],
            cql=cql,
            filtravel=view.filtravel,
        )


_ORDEM_DO_DETALHE: tuple[Familia, ...] = ("pecas", "filtros")


@dataclass(frozen=True)
class Profundidade:
    """O último zoom semeado de cada família de camadas."""

    pecas: int
    filtros: int


def plano(
    views: Iterable[View],
    profundidade: Profundidade,
    *,
    recente: str,
    desde_zoom: int = 0,
    so: Familia | None = None,
) -> list[Semeadura]:
    """Primeiro a vista nacional e regional de tudo; depois o detalhe de cada família.

    Os zooms baixos são os caros (cada tile cobre milhares de peças) e os mais vistos; os
    altos ficam baratos com os índices e entram no cache na primeira visita. No detalhe, das
    peças só a camada do ano mais recente (`recente`), a única que o portal desenha, e só os
    estilos que ele pede: o resto (os outros anos e `planaveg_arranjo`, para o QGIS) entra no
    cache na primeira visita. `desde_zoom` e `so` recortam o plano para completar um cache já
    semeado: conferir tiles que já existem também custa (cerca de um minuto por camada nos
    zooms até o 8).
    """
    ultimo: dict[Familia, int] = {"pecas": profundidade.pecas, "filtros": profundidade.filtros}
    desenhadas = [v for v in views if v.tiles and (so is None or v.familia == so)]
    # A vista nacional e a regional: cada camada em cache, em todos os estilos.
    tarefas = [
        Semeadura.da_view(view, estilo, 0, min(ZOOM_TODAS, ultimo[view.familia]))
        for view in desenhadas
        for estilo in view.estilos
    ]
    # Detalhe (acima do zoom nacional): as peças primeiro, depois os filtros.
    for familia in _ORDEM_DO_DETALHE:
        if ultimo[familia] <= ZOOM_TODAS:
            continue
        for view in desenhadas:
            if view.familia != familia:
                continue
            if familia == "pecas" and view.nome != recente:
                continue  # das peças, só o ano que o portal desenha
            estilos = view.estilos_do_portal or view.estilos
            tarefas.extend(
                Semeadura.da_view(view, estilo, ZOOM_TODAS + 1, ultimo[familia])
                for estilo in estilos
            )
    # O recorte: sai a tarefa que acaba antes de `desde_zoom`, e a que começa antes começa nele.
    return [
        replace(tarefa, zoom_inicio=max(tarefa.zoom_inicio, desde_zoom))
        for tarefa in tarefas
        if tarefa.zoom_fim >= desde_zoom
    ]


def pedido_de_semeadura(tarefa: Semeadura, threads: int) -> dict[str, object]:
    """O corpo do `seed` do GeoWebCache para a tarefa: camada, zooms e os parâmetros da chave."""
    # A chave tem de sair igual à do WMTS, ou os tiles semeados nunca são lidos. O WMTS tira da
    # chave o estilo padrão; já o filtro vazio (o padrão do `CQL_FILTER`) fica nela quando o
    # estilo não é o padrão, e a semeadura o manda junto.
    entradas: list[dict[str, list[str]]] = []
    if not tarefa.padrao:
        entradas.append({"string": ["STYLES", qualificado(tarefa.estilo)]})
    if tarefa.cql is not None:
        entradas.append({"string": ["CQL_FILTER", tarefa.cql]})
    elif tarefa.filtravel and not tarefa.padrao:
        entradas.append({"string": ["CQL_FILTER", ""]})
    corpo: dict[str, object] = {
        "name": qualificado(tarefa.view),
        "gridSetId": GRADE,
        "zoomStart": tarefa.zoom_inicio,
        "zoomStop": tarefa.zoom_fim,
        "format": FORMATO,
        "type": "seed",
        "threadCount": threads,
    }
    if entradas:
        corpo["parameters"] = {"entry": entradas}
    return {"seedRequest": corpo}


def semear(settings: Settings, tarefa: Semeadura, threads: int) -> None:
    """Pede ao GeoWebCache os tiles que faltam (`seed`) da camada e estilo, nos zooms dados."""
    pedido(
        settings,
        "POST",
        f"/gwc/rest/seed/{qualificado(tarefa.view)}.json",
        corpo_json(pedido_de_semeadura(tarefa, threads)),
    )


_TEMPO_PARA_PARAR = 5.0
"""A espera pelo pedido de parar: ele roda no fim de um container, que o Docker mata em 10 s."""


def parar(settings: Settings, view: str) -> None:
    """Mata as tarefas de semeadura da camada no GeoWebCache, a que roda e as pendentes: sem
    isso, interromper o `semear` deixaria a semeadura rodando dentro do GeoServer."""
    pedido(
        settings,
        "POST",
        f"/gwc/rest/seed/{qualificado(view)}",
        corpo_form({"kill_all": "all"}),
        tempo=_TEMPO_PARA_PARAR,
    )


_ATIVA = {0, 1}
"""Estados de tarefa do GeoWebCache que ainda vão gerar tiles: pendente (0) e rodando (1)."""


def andamento(settings: Settings, view: str) -> list[tuple[int, int]]:
    """(tiles feitos, tiles previstos) de cada tarefa de semeadura ainda ativa na camada.

    O GeoWebCache lista cada tarefa como `[feitos, previstos, segundos restantes, id, estado]`.
    """
    tarefas = consulta(settings, f"/gwc/rest/seed/{qualificado(view)}.json")
    return [
        (int(feitos), int(previstos))
        for feitos, previstos, _restantes, _id, estado in tarefas.get("long-array-array", [])
        if int(estado) in _ATIVA
    ]
