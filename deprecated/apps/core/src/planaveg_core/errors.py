from __future__ import annotations


class PlanavegError(RuntimeError):
    """Falha fechada do planaveg_core: código estável, detalhe sem PII."""

    def __init__(self, codigo: str, detalhe: str | None = None) -> None:
        super().__init__(codigo if detalhe is None else f"{codigo}: {detalhe}")
        self.codigo = codigo
        self.detalhe = detalhe
