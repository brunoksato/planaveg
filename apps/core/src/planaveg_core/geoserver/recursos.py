"""Os recursos no GeoServer: o datastore, cada feature type com a caixa medida no banco, e os
estilos (só regravados quando o SLD muda).
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

import psycopg

from planaveg_core.banco import PAPEL_LEITURA
from planaveg_core.cache import gwc
from planaveg_core.config import Settings
from planaveg_core.contrato import Contrato
from planaveg_core.estilos import estilos
from planaveg_core.publicacao import View, views
from planaveg_core.rest import (
    WORKSPACE,
    consulta,
    corpo_json,
    corpo_sld,
    criar_ou_atualizar,
    pedido,
    texto,
)

_LOG = logging.getLogger("planaveg_core.geoserver")
STORE = "planaveg_core"

# Caixa das tabelas sem geometria e das camadas vazias: o território brasileiro.
CAIXA_BRASIL: gwc.Caixa = (-74.0, -34.0, -28.6, 5.4)


def obsoletos(publicados: list[str], views_atuais: list[str]) -> list[str]:
    """Feature types do datastore cuja view saiu do contrato (filtro renomeado ou removido)."""
    return sorted(set(publicados) - set(views_atuais))


def datastore(settings: Settings) -> dict[str, Any]:
    entradas = {
        "host": settings.geoserver_pg_host,
        "port": str(settings.geoserver_pg_port),
        "database": settings.geoserver_pg_database,
        "schema": "public",
        "user": PAPEL_LEITURA,
        "passwd": settings.geoserver_pg_password,
        "dbtype": "postgis",
        "Loose bbox": "true",
        "Estimated extends": "false",
        "validate connections": "true",
        "Expose primary keys": "true",
        "Primary key metadata table": "gt_pk_metadata",
    }
    return {
        "dataStore": {
            "name": STORE,
            "type": "PostGIS",
            "enabled": True,
            "connectionParameters": {
                "entry": [{"@key": chave, "$": valor} for chave, valor in entradas.items()]
            },
        }
    }


def _feature_type(view: View, caixa: gwc.Caixa) -> dict[str, Any]:
    minx, miny, maxx, maxy = caixa
    envelope = {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy}
    feature: dict[str, Any] = {
        "name": view.nome,
        "nativeName": view.nome,
        "title": view.titulo,
        "abstract": view.resumo,
        "srs": "EPSG:4674",
        "projectionPolicy": "FORCE_DECLARED",
        "enabled": True,
        "nativeBoundingBox": {**envelope, "crs": "EPSG:4674"},
        # SIRGAS 2000 e WGS 84 coincidem na precisão de uma caixa.
        "latLonBoundingBox": {**envelope, "crs": "EPSG:4326"},
    }
    if view.parametros:
        feature["metadata"] = {"entry": [_consulta_com_parametros(view)]}
    return {"featureType": feature}


def _consulta_com_parametros(view: View) -> dict[str, Any]:
    """A view como SQL view do GeoServer, com cada parâmetro obrigatório na URL (`viewparams`).

    Sem ele, vale 0, que nenhuma peça tem: a consulta volta vazia em vez de varrer a view. Só
    algarismos passam pelo validador, então nada além de um número chega ao SQL. A geometria é
    a das partes das peças (polígonos), a única consulta assim.
    """
    condicao = " AND ".join(f"{nome} = %{nome}%" for nome in view.parametros)
    # Os nomes vêm do código; o valor de cada %parâmetro%, o GeoServer só aceita em algarismos.
    sql_da_consulta = f"SELECT * FROM {view.nome} WHERE {condicao}"  # noqa: S608  # nosec B608
    return {
        "@key": "JDBC_VIRTUAL_TABLE",
        "virtualTable": {
            "name": view.nome,
            "sql": sql_da_consulta,
            "escapeSql": False,
            "keyColumn": "fid",
            "geometry": {"name": "geom", "type": "Polygon", "srid": 4674},
            "parameter": [
                {"name": nome, "defaultValue": "0", "regexpValidator": r"^\d+$"}
                for nome in view.parametros
            ],
        },
    }


def caixas_das_camadas(con: psycopg.Connection) -> dict[str, gwc.Caixa]:
    """Extensão de cada camada de mapa, medida no banco quando os quantitativos foram gerados."""
    linhas = con.execute(
        "SELECT camada, minx, miny, maxx, maxy FROM catalogo_camada WHERE minx IS NOT NULL"
    ).fetchall()
    return {
        str(nome): (float(minx), float(miny), float(maxx), float(maxy))
        for nome, minx, miny, maxx, maxy in linhas
    }


def publicar_estilos(settings: Settings, contrato: Contrato) -> list[str]:
    """Cria ou atualiza cada estilo SLD do contrato no workspace; devolve os gravados.

    Gravar um estilo apaga do GeoWebCache os tiles das camadas que o usam, mesmo com o SLD
    idêntico: só grava quando o texto guardado difere do gerado. O `raw=true` guarda o SLD
    como enviado (sem ele o GeoServer o reescreve e a comparação nunca bate).
    """
    base = f"/rest/workspaces/{WORKSPACE}/styles"
    gravados: list[str] = []
    for nome, sld in estilos(contrato).items():
        atual = texto(settings, f"{base}/{nome}.sld")
        if atual == sld:
            continue
        # Atualizar um estilo que não existe dá 400, não 404: pergunta antes.
        if atual is None:
            pedido(settings, "POST", f"{base}?name={quote(nome)}&raw=true", corpo_sld(sld))
        else:
            pedido(settings, "PUT", f"{base}/{nome}?raw=true", corpo_sld(sld))
        gravados.append(nome)
        _LOG.info("estilo geoserver %s gravado", nome)
    return gravados


def remover_estilos_obsoletos(settings: Settings, contrato: Contrato) -> list[str]:
    """Apaga do workspace os estilos que saíram do contrato; devolve os apagados.

    Roda depois das camadas, que já não os usam: um estilo ainda usado por uma camada o
    GeoServer recusa apagar.
    """
    base = f"/rest/workspaces/{WORKSPACE}/styles"
    atuais = set(estilos(contrato))
    listados = consulta(settings, f"{base}.json").get("styles") or {}
    nomes = [str(e["name"]) for e in (listados.get("style") or []) if isinstance(e, dict)]
    removidos: list[str] = []
    for nome in sorted(set(nomes) - atuais):
        pedido(settings, "DELETE", f"{base}/{quote(nome)}?purge=true")
        removidos.append(nome)
        _LOG.info("estilo geoserver %s removido: saiu do contrato", nome)
    return removidos


def _aplicar_estilos(settings: Settings, view: View) -> None:
    """Estilo padrão e alternativos da camada (o WMS os aceita em STYLES)."""
    padrao, *alternativos = view.estilos
    pedido(
        settings,
        "PUT",
        f"/rest/layers/{gwc.qualificado(view.nome)}",
        corpo_json(
            {
                "layer": {
                    "defaultStyle": {"name": padrao, "workspace": WORKSPACE},
                    "styles": {
                        "style": [{"name": n, "workspace": WORKSPACE} for n in alternativos]
                    },
                }
            }
        ),
    )


def publicar_camadas(
    settings: Settings, contrato: Contrato, caixas: Mapping[str, gwc.Caixa]
) -> list[str]:
    """Uma camada por view publicada, criada ou atualizada; sai a que deixou o contrato."""
    base = f"/rest/workspaces/{WORKSPACE}/datastores/{STORE}/featuretypes"
    # As que já existem: cada uma é atualizada, e a que saiu do contrato, removida no fim.
    existentes = consulta(settings, f"{base}.json").get("featureTypes") or {}
    nomes = [str(item["name"]) for item in existentes.get("featureType", [])]
    publicadas: list[str] = []
    for view in views(contrato):
        if not view.publicada:
            continue
        feature = _feature_type(view, caixas.get(view.nome, CAIXA_BRASIL))
        criada = criar_ou_atualizar(
            settings, base, view.nome, corpo_json(feature), existe=view.nome in nomes
        )
        if view.espacial and view.estilos:
            _aplicar_estilos(settings, view)
        _LOG.info("camada geoserver %s %s", view.nome, "criada" if criada else "atualizada")
        publicadas.append(view.nome)
    for nome in obsoletos(nomes, publicadas):
        pedido(settings, "DELETE", f"{base}/{nome}?recurse=true")
        _LOG.info("camada geoserver %s removida: a view saiu do contrato", nome)
    return publicadas
