"""O cache de tiles: plano de semeadura, versão do mapa e configuração das camadas no GWC."""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET

from geoserver_falso import GeoServerFalso, Resposta

from planaveg_core.cache import gwc, semeadura
from planaveg_core.config import Settings
from planaveg_core.contrato import Contrato
from planaveg_core.estilos import estilos
from planaveg_core.geoserver.recursos import remover_estilos_obsoletos
from planaveg_core.publicacao import View, views


def _desenhadas(contrato: Contrato) -> list[View]:
    return [v for v in views(contrato) if v.tiles]


def test_pecas_aceitam_os_filtros_do_portal_no_cache(contrato: Contrato) -> None:
    view = next(v for v in _desenhadas(contrato) if v.nome == "peca_2024")
    # XML gerado pelo próprio pacote, não entrada externa.
    raiz = ET.fromstring(gwc._xml_camada(view, (-74.0, -34.0, -28.6, 5.4), None))  # noqa: S314

    assert raiz.findtext(".//regexParameterFilter/key") == "CQL_FILTER"
    assert [e.text for e in raiz.findall(".//allowedStyles/string")] == [
        "planaveg:planaveg_nivel",
        "planaveg:planaveg_arranjo",
    ]


def test_estilo_padrao_e_semeado_sem_parametro(contrato: Contrato) -> None:
    desenhadas = _desenhadas(contrato)
    tarefas = semeadura.plano(desenhadas, semeadura.Profundidade(8, 8), recente="peca_2024")
    primeiro = {v.nome: v.estilos[0] for v in desenhadas}

    assert all(t.padrao == (t.estilo == primeiro[t.view]) for t in tarefas)
    # Sem zoom acima do nacional, não há tarefa de detalhe.
    assert all(t.zoom_inicio == 0 for t in tarefas)


def test_estilo_alternativo_vai_com_o_filtro_vazio_na_chave(contrato: Contrato) -> None:
    tarefas = semeadura.plano(
        _desenhadas(contrato), semeadura.Profundidade(8, 8), recente="peca_2024", so="pecas"
    )
    arranjo = next(t for t in tarefas if t.view == "peca_2024" and t.estilo == "planaveg_arranjo")
    pedido = semeadura.pedido_de_semeadura(arranjo, 2)["seedRequest"]

    # Fora do estilo padrão, o WMTS guarda na chave o filtro vazio; sem ele, a semeadura
    # gravaria tiles que o portal nunca lê.
    assert isinstance(pedido, dict)
    assert pedido["parameters"] == {
        "entry": [
            {"string": ["STYLES", "planaveg:planaveg_arranjo"]},
            {"string": ["CQL_FILTER", ""]},
        ]
    }
    padrao = semeadura.pedido_de_semeadura(next(t for t in tarefas if t.padrao), 2)["seedRequest"]
    assert isinstance(padrao, dict)
    assert "parameters" not in padrao
    # Camada que não aceita CQL não ganha o filtro.
    sem_cql = semeadura.pedido_de_semeadura(
        semeadura.Semeadura("espacial_car_2024", "outro", 0, 8, padrao=False), 2
    )["seedRequest"]
    assert isinstance(sem_cql, dict)
    assert sem_cql["parameters"] == {"entry": [{"string": ["STYLES", "planaveg:outro"]}]}


def test_versao_do_mapa_muda_com_a_entrega_as_views_e_os_estilos() -> None:
    base = gwc.versao_mapa("a" * 64, {"peca_2024": "SELECT 1"}, {"planaveg_nivel": "<sld/>"})

    assert base == gwc.versao_mapa(
        "a" * 64, {"peca_2024": "SELECT 1"}, {"planaveg_nivel": "<sld/>"}
    )
    assert len(base) == 16
    assert base != gwc.versao_mapa(
        "b" * 64, {"peca_2024": "SELECT 1"}, {"planaveg_nivel": "<sld/>"}
    )
    assert base != gwc.versao_mapa(
        "a" * 64, {"peca_2024": "SELECT 2"}, {"planaveg_nivel": "<sld/>"}
    )
    assert base != gwc.versao_mapa("a" * 64, {"peca_2024": "SELECT 1"}, {"planaveg_nivel": "<x/>"})


def test_filtro_cql_aceita_o_que_o_portal_gera_e_recusa_o_resto() -> None:
    padrao = re.compile(gwc.FILTRO_CQL.removeprefix("(?U)"))
    portal = (
        "nivel IN ('app', 'rl') AND categoria IN ('Nao_Analisados') AND "
        "bioma IN ('Amazônia', 'Mata Atlântica') AND ((embargo = true) OR (terra_indigena = true))"
    )
    assert padrao.fullmatch(portal)
    assert not padrao.fullmatch("nivel = 'rl'; DROP TABLE peca")
    assert not padrao.fullmatch("x" * 4001)


def test_publicacao_apaga_so_os_estilos_que_sairam_do_contrato(
    geoserver: GeoServerFalso, settings_locais: Settings, contrato: Contrato
) -> None:
    nomes = [*estilos(contrato), "planaveg_velho"]
    lista = {"styles": {"style": [{"name": n} for n in nomes]}}
    caminho = "/rest/workspaces/planaveg/styles.json"
    geoserver.respostas[("GET", caminho)] = Resposta(200, json.dumps(lista).encode())

    assert remover_estilos_obsoletos(settings_locais, contrato) == ["planaveg_velho"]
    assert [(p.metodo, p.caminho) for p in geoserver.pedidos[1:]] == [
        ("DELETE", "/rest/workspaces/planaveg/styles/planaveg_velho?purge=true")
    ]
