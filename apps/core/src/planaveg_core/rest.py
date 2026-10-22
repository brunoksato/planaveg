"""Chamadas à API REST do GeoServer (e do GeoWebCache embutido nele), com autenticação básica.

Erros de rede (inclusive um tempo esgotado ou uma conexão derrubada no meio da resposta), de
autorização e de formato viram `PlanavegError`; quem chama decide quais códigos HTTP são
esperados (`tolerados`) e trata o 404 de leitura como "não existe".
"""

from __future__ import annotations

import base64
import json
from http import HTTPStatus
from http.client import HTTPException
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from planaveg_core.config import Settings
from planaveg_core.errors import PlanavegError

_TIMEOUT = 300
WORKSPACE = "planaveg"
"""Workspace do GeoServer onde o planaveg_core publica camadas, estilos e cache."""

Corpo = tuple[bytes, str]
"""(bytes, Content-Type) de uma requisição REST."""


def corpo_json(payload: dict[str, Any]) -> Corpo:
    return json.dumps(payload).encode(), "application/json"


def corpo_sld(texto: str) -> Corpo:
    return texto.encode("utf-8"), "application/vnd.ogc.sld+xml"


def corpo_xml(texto: str) -> Corpo:
    return texto.encode("utf-8"), "text/xml"


def corpo_form(campos: dict[str, str]) -> Corpo:
    return urlencode(campos).encode(), "application/x-www-form-urlencoded"


# A rede pode falhar antes da resposta (URLError, que embrulha OSError) ou durante ela: o
# urllib deixa a leitura da resposta fora do URLError, e um tempo esgotado ali é TimeoutError
# (um OSError), uma conexão derrubada é ConnectionError ou HTTPException.
_FALHAS_DE_REDE = (URLError, OSError, HTTPException)


def _requisicao(
    settings: Settings,
    method: str,
    path: str,
    corpo: Corpo | None = None,
    *,
    aceita: str = "application/json",
) -> Request:
    url = settings.geoserver_url.rstrip("/") + path
    if not url.startswith(("http://", "https://")):
        raise PlanavegError("geoserver_url_invalida", url)
    dados, tipo = corpo if corpo is not None else (None, "application/json")
    request = Request(url, data=dados, method=method)  # noqa: S310
    request.add_header("Content-Type", tipo)
    request.add_header("Accept", aceita)
    token = base64.b64encode(
        f"{settings.geoserver_user}:{settings.geoserver_password}".encode()
    ).decode()
    request.add_header("Authorization", f"Basic {token}")
    return request


def _responder(  # noqa: PLR0913 (as opções vão por nome)
    settings: Settings,
    method: str,
    path: str,
    corpo: Corpo | None = None,
    *,
    aceita: str = "application/json",
    tolerados: frozenset[int] = frozenset(),
    tempo: float = _TIMEOUT,
) -> tuple[int, bytes | None]:
    """O status e o corpo da resposta. Um código em `tolerados` volta sem exceção e sem corpo;
    o resto vira um erro com código. `tempo` é a espera máxima pela resposta, em segundos."""
    try:
        with urlopen(  # noqa: S310  # nosec B310
            _requisicao(settings, method, path, corpo, aceita=aceita), timeout=tempo
        ) as resp:
            return int(resp.status), resp.read()
    except HTTPError as exc:
        if exc.code in {401, 403}:
            raise PlanavegError("geoserver_nao_autorizado") from exc
        if exc.code in tolerados:
            return exc.code, None
        raise PlanavegError("geoserver_http", f"{method} {path} {exc.code}") from exc
    except _FALHAS_DE_REDE as exc:
        raise PlanavegError("geoserver_indisponivel", f"{method} {path}") from exc


def pedido(  # noqa: PLR0913 (as duas opções vão por nome)
    settings: Settings,
    method: str,
    path: str,
    corpo: Corpo | None = None,
    *,
    tolerados: frozenset[int] = frozenset(),
    tempo: float = _TIMEOUT,
) -> int:
    """Status da resposta. Os códigos em `tolerados` voltam como status, sem exceção."""
    status, _ = _responder(settings, method, path, corpo, tolerados=tolerados, tempo=tempo)
    return status


def texto(settings: Settings, path: str, aceita: str = "application/xml") -> str | None:
    """Corpo de um GET como texto; `None` quando o recurso não existe (404)."""
    _, corpo = _responder(
        settings, "GET", path, aceita=aceita, tolerados=frozenset({HTTPStatus.NOT_FOUND})
    )
    return None if corpo is None else corpo.decode("utf-8")


def criar_ou_atualizar(
    settings: Settings, colecao: str, nome: str, corpo: Corpo, *, existe: bool | None = None
) -> bool:
    """Grava o recurso `nome` da coleção: o PUT, se ele já existe, ou o POST, se não. Sem
    `existe`, pergunta ao GeoServer. Devolve se criou."""
    if existe is None:
        existe = texto(settings, f"{colecao}/{nome}.json", aceita="application/json") is not None
    if existe:
        pedido(settings, "PUT", f"{colecao}/{nome}", corpo)
    else:
        pedido(settings, "POST", colecao, corpo)
    return not existe


def consulta(settings: Settings, path: str) -> dict[str, Any]:
    """GET em JSON; `{}` quando o recurso não existe. Uma resposta que não é JSON é erro."""
    try:
        resposta = json.loads(texto(settings, path, aceita="application/json") or "{}")
    except json.JSONDecodeError as exc:
        raise PlanavegError("geoserver_resposta_invalida", f"GET {path}") from exc
    return resposta if isinstance(resposta, dict) else {}
