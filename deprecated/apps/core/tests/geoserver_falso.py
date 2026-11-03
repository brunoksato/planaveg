"""Um GeoServer falso para os testes: troca o `urlopen` do `rest.py`, anota cada pedido e responde
o que o teste mandar (por método e caminho), ou levanta a exceção dada.

Assim os testes passam pelo código de verdade até a rede: o corpo, o método, o Content-Type e o
tratamento dos erros.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import TracebackType
from urllib.parse import urlsplit
from urllib.request import Request


@dataclass
class Resposta:
    status: int = 200
    corpo: bytes = b""

    def read(self) -> bytes:
        return self.corpo

    def __enter__(self) -> Resposta:
        return self

    def __exit__(
        self,
        tipo: type[BaseException] | None,
        erro: BaseException | None,
        rastro: TracebackType | None,
    ) -> None:
        return None


@dataclass(frozen=True)
class Pedido:
    metodo: str
    caminho: str
    """Sem o `/geoserver` da URL e com a query, como o core o escreve."""
    corpo: bytes | None
    tipo: str | None
    tempo: float
    """O tempo máximo que o core deu à resposta (nunca sem limite)."""


@dataclass
class GeoServerFalso:
    respostas: dict[tuple[str, str], Resposta | BaseException] = field(default_factory=dict)
    pedidos: list[Pedido] = field(default_factory=list)

    def urlopen(self, request: Request, timeout: float) -> Resposta:
        partes = urlsplit(request.full_url)
        caminho = partes.path.removeprefix("/geoserver") + (
            f"?{partes.query}" if partes.query else ""
        )
        dados = request.data if isinstance(request.data, bytes) else None
        tipo = request.get_header("Content-type")
        pedido = Pedido(request.get_method(), caminho, dados, tipo, timeout)
        self.pedidos.append(pedido)
        resposta = self.respostas.get((pedido.metodo, caminho), Resposta())
        if isinstance(resposta, BaseException):
            raise resposta
        return resposta
