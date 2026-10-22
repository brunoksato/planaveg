"""A publicação inteira (`geoserver`): recursos, estilos, cache de tiles e as duas versões."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import psycopg

from planaveg_core.cache import gwc
from planaveg_core.config import Settings
from planaveg_core.contrato import Contrato
from planaveg_core.geoserver.recursos import (
    CAIXA_BRASIL,
    STORE,
    caixas_das_camadas,
    datastore,
    publicar_camadas,
    publicar_estilos,
    remover_estilos_obsoletos,
)
from planaveg_core.geoserver.versoes import calcular_versoes
from planaveg_core.publicacao import views
from planaveg_core.rest import WORKSPACE, corpo_json, criar_ou_atualizar

_LOG = logging.getLogger("planaveg_core.geoserver")


@dataclass(frozen=True)
class Publicacao:
    camadas: list[str]
    estilos_gravados: list[str]
    versao_mapa: str
    cache_esvaziado: bool
    versao_dados: str
    estilos_removidos: list[str]


def publicar_geoserver(
    settings: Settings,
    con: psycopg.Connection,
    contrato: Contrato,
    *,
    versao_anterior: str | None,
) -> Publicacao:
    """Publica tudo e acerta o cache de tiles; a versão anterior do mapa é a do último publish."""
    criar_ou_atualizar(
        settings,
        "/rest/workspaces",
        WORKSPACE,
        corpo_json({"workspace": {"name": WORKSPACE, "isolated": False}}),
    )
    criar_ou_atualizar(
        settings, f"/rest/workspaces/{WORKSPACE}/datastores", STORE, corpo_json(datastore(settings))
    )
    gravados = publicar_estilos(settings, contrato)
    caixas = caixas_das_camadas(con)
    publicadas = publicar_camadas(settings, contrato, caixas)
    removidos = remover_estilos_obsoletos(settings, contrato)
    desenhadas = [v for v in views(contrato) if v.tiles]
    for view in desenhadas:
        gwc.configurar(settings, view, caixas.get(view.nome, CAIXA_BRASIL))
    if settings.gwc_cota_gb is not None:
        gwc.cota(settings, settings.gwc_cota_gb)
        _LOG.info("cota do cache de tiles: %s GiB", settings.gwc_cota_gb)
    versoes = calcular_versoes(con, contrato)
    esvaziar = versoes.mapa != versao_anterior
    if esvaziar:
        gwc.esvaziar(settings, [v.nome for v in desenhadas])
        _LOG.info(
            "cache de tiles esvaziado: versão do mapa %s -> %s", versao_anterior, versoes.mapa
        )
    return Publicacao(
        camadas=publicadas,
        estilos_gravados=gravados,
        versao_mapa=versoes.mapa,
        cache_esvaziado=esvaziar,
        versao_dados=versoes.dados,
        estilos_removidos=removidos,
    )
