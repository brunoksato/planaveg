"""`geoserver`: publica as views, os estilos e o cache de tiles."""

from __future__ import annotations

import argparse

from planaveg_core import banco, etapas
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato
from planaveg_core.geoserver import WORKSPACE, publicar_geoserver


def cmd_geoserver(settings: Settings, _args: argparse.Namespace) -> int:
    contrato = carregar_contrato(settings.contract_path)
    with banco.conectar(settings) as con:
        entrega_id = banco.entrega_pronta(con)
        versao_id = banco.conferir_contrato(con, entrega_id, contrato)
        anterior = banco.ultimo_detalhe(con, etapas.GEOSERVER, "versao_mapa")
        with banco.registrar(
            con,
            etapas.GEOSERVER,
            entrega_id,
            detalhe={"url": settings.geoserver_url},
            vigentes=settings.vigentes,
        ) as info:
            publicacao = publicar_geoserver(settings, con, contrato, versao_anterior=anterior)
            info["versao_mapa"] = publicacao.versao_mapa
            info["versao_dados"] = publicacao.versao_dados
            # O histórico: a publicação e os números dela, se os dados mudaram.
            info["publicacao"] = banco.registrar_publicacao(
                con,
                entrega_id,
                versao_id,
                (publicacao.versao_mapa, publicacao.versao_dados),
            )
            info["estilos_gravados"] = publicacao.estilos_gravados
            info["estilos_removidos"] = publicacao.estilos_removidos
            info["cache_esvaziado"] = publicacao.cache_esvaziado
    print(
        f"geoserver workspace {WORKSPACE} em {settings.geoserver_url}: "
        f"{len(publicacao.camadas)} camadas, versão do mapa {publicacao.versao_mapa}"
    )
    if publicacao.estilos_removidos:
        removidos = ", ".join(publicacao.estilos_removidos)
        print(f"estilos que saíram do contrato, apagados: {removidos}")
    if publicacao.cache_esvaziado:
        print("cache de tiles esvaziado (mudou a entrega, uma view ou um estilo): rode semear")
    return EXIT_OK
