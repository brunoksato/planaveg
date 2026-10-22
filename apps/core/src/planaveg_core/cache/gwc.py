"""Cache de tiles das camadas de mapa no GeoWebCache embutido no GeoServer.

O portal pede os tiles por WMTS (`/gwc/service/wmts/rest/...`), não por WMS: um tile em cache
sai em milissegundos, e só a primeira visita (ou a semeadura) desenha a partir do banco. O
cache é EPSG:900913 (o Web Mercator do Leaflet), PNG de 24 bits com transparência e blocos de
4×4 tiles (uma consulta ao banco para 16 tiles). O PNG de 8 bits reduzia as bordas suavizadas
e as partes pequenas da vista nacional a uma paleta de 256 cores; o de 24 bits sai cerca de
2,8 vezes maior (3,4 vezes na vista nacional, 2,3 nos zooms de detalhe).

Os tiles só mudam quando muda a entrega, a definição das views desenhadas ou um estilo. A
versão do mapa (`versao_mapa`) resume os três: o portal a põe na URL dos tiles, então o
navegador pode guardá-los sem nunca mostrar um tile velho (o GeoWebCache manda guardar por uma
semana, `VALIDADE_NAVEGADOR`; na produção, o nginx manda um ano à URL com a versão vigente), e a
publicação esvazia o cache quando a versão muda. A publicação (`geoserver/recursos.py`) só
regrava um estilo quando o SLD muda, porque o GeoServer apaga os tiles das camadas de um
estilo a cada gravação dele.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Iterable, Mapping
from xml.sax.saxutils import escape  # nosec B406 - só escapa texto, não lê XML

from planaveg_core.config import Settings
from planaveg_core.publicacao import View
from planaveg_core.rest import WORKSPACE, corpo_xml, pedido, texto

FORMATO = "image/png"
"""O único formato do cache, o que o portal pede e a semeadura gera: PNG de 24 bits, com
transparência."""
GRADE = "EPSG:900913"
META = 4
VALIDADE_NAVEGADOR = 7 * 24 * 3600


FILTRO_CQL = r"(?U)[\w ,'()=]{0,4000}"
"""O que o cache aceita em `CQL_FILTER` nas peças de cada ano: o que os filtros do portal geram
(nomes, valores entre aspas, `IN`, `AND`, `OR`, `= true`), com tamanho limitado, para quem chega
de fora não criar entradas de cache e desenhos à vontade. Cada filtro diferente é uma entrada
própria no cache; sem filtro, o tile é o semeado."""

_RAIO = 6_378_137.0
_LATITUDE_MAXIMA = 85.051_128_78

Caixa = tuple[float, float, float, float]
"""(xmin, ymin, xmax, ymax): a extensão de uma camada, em EPSG:4674 ou, depois de `mercator`, no
Web Mercator. A publicação (`geoserver/recursos.py`) usa esta mesma."""


def qualificado(nome: str) -> str:
    """Uma camada ou um estilo do workspace pelo nome qualificado, como o GeoServer e o
    GeoWebCache os conhecem."""
    return f"{WORKSPACE}:{nome}"


def versao_mapa(sha_entrega: str, corpos: Mapping[str, str], slds: Mapping[str, str]) -> str:
    """Resumo do que muda um tile: a entrega, o SQL das views desenhadas e os estilos."""
    # Os estilos com `sld:` na frente, para não se confundirem com uma view de mesmo nome, e
    # tudo em ordem de nome, para o resumo não depender da ordem das listas.
    partes = dict(corpos)
    partes.update({f"sld:{nome}": sld for nome, sld in slds.items()})
    resumo = hashlib.sha256()
    resumo.update(f"{sha_entrega}|{FORMATO}|{GRADE}|{META}".encode())
    for nome, conteudo in sorted(partes.items()):
        resumo.update(f"\n{nome}\n{conteudo}".encode())
    return resumo.hexdigest()[:16]


def mercator(caixa: Caixa) -> Caixa:
    """Caixa em graus (EPSG:4674 ≈ 4326) para metros do Web Mercator, como a grade do cache."""

    def y(latitude: float) -> float:
        lat = math.radians(max(-_LATITUDE_MAXIMA, min(_LATITUDE_MAXIMA, latitude)))
        return _RAIO * math.log(math.tan(math.pi / 4 + lat / 2))

    minx, miny, maxx, maxy = caixa
    return (_RAIO * math.radians(minx), y(miny), _RAIO * math.radians(maxx), y(maxy))


def _xml_camada(view: View, caixa: Caixa, identificador: str | None) -> str:
    extensao = "".join(f"<double>{v:.3f}</double>" for v in mercator(caixa))
    estilos = "".join(f"<string>{escape(qualificado(e))}</string>" for e in view.estilos)
    ident = f"<id>{escape(identificador)}</id>" if identificador else ""
    filtro_cql = (
        "<regexParameterFilter><key>CQL_FILTER</key><defaultValue></defaultValue>"
        f"<regex>{escape(FILTRO_CQL)}</regex></regexParameterFilter>"
        if view.filtravel
        else ""
    )
    return (
        f"<GeoServerLayer>{ident}<enabled>true</enabled><inMemoryCached>true</inMemoryCached>"
        f"<name>{escape(qualificado(view.nome))}</name>"
        f"<mimeFormats><string>{FORMATO}</string></mimeFormats>"
        f"<gridSubsets><gridSubset><gridSetName>{GRADE}</gridSetName>"
        f"<extent><coords>{extensao}</coords></extent></gridSubset></gridSubsets>"
        f"<metaWidthHeight><int>{META}</int><int>{META}</int></metaWidthHeight>"
        f"<expireCache>0</expireCache><expireClients>{VALIDADE_NAVEGADOR}</expireClients>"
        "<parameterFilters><styleParameterFilter><key>STYLES</key><defaultValue></defaultValue>"
        f"<allowedStyles>{estilos}</allowedStyles></styleParameterFilter>{filtro_cql}"
        "</parameterFilters>"
        "<gutter>0</gutter></GeoServerLayer>"
    )


def configurar(settings: Settings, view: View, caixa: Caixa) -> None:
    """Formato, grade, blocos, validade no navegador e estilos aceitos do cache da camada."""
    caminho = f"/gwc/rest/layers/{qualificado(view.nome)}.xml"
    atual = texto(settings, caminho) or ""
    identificador = re.search(r"<id>([^<]+)</id>", atual)
    corpo = _xml_camada(view, caixa, identificador.group(1) if identificador else None)
    pedido(settings, "PUT", caminho, corpo_xml(corpo))


def _xml_cota(gib: int) -> str:
    # Descarte dos tiles usados há mais tempo, conferido a cada 10 minutos.
    return (
        "<gwcQuotaConfiguration><enabled>true</enabled>"
        "<cacheCleanUpFrequency>10</cacheCleanUpFrequency>"
        "<cacheCleanUpUnits>MINUTES</cacheCleanUpUnits>"
        "<maxConcurrentCleanUps>2</maxConcurrentCleanUps>"
        "<globalExpirationPolicyName>LRU</globalExpirationPolicyName>"
        f"<globalQuota><value>{int(gib)}</value><units>GiB</units></globalQuota>"
        "</gwcQuotaConfiguration>"
    )


def cota(settings: Settings, gib: int) -> None:
    """Teto de disco do cache inteiro. Cada filtro novo do mapa vira uma entrada no cache; acima
    do teto, saem os tiles usados há mais tempo, e eles voltam a ser desenhados se pedidos."""
    pedido(settings, "PUT", "/gwc/rest/diskquota.xml", corpo_xml(_xml_cota(gib)))


def esvaziar(settings: Settings, views: Iterable[str]) -> None:
    """Apaga os tiles das camadas (todas as grades, formatos e estilos)."""
    for view in views:
        corpo = f"<truncateLayer><layerName>{escape(qualificado(view))}</layerName></truncateLayer>"
        pedido(settings, "POST", "/gwc/rest/masstruncate", corpo_xml(corpo))
