"""O que toda verificação usa: o resultado (`Verificacao`) e o contexto da conferência. A
tolerância em hectares é a da carga (`banco.TOLERANCIA_HA`)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any
from uuid import UUID

from planaveg_core.publicacao import View

if TYPE_CHECKING:
    import psycopg

    from planaveg_core.contrato import Contrato


@dataclass(frozen=True)
class Verificacao:
    codigo: str
    ok: bool
    detalhe: str
    dados: dict[str, Any] = field(default_factory=dict)
    """O que não cabe numa linha (pares sobrepostos, por exemplo): vai para execucao.detalhe."""
    pulada: bool = False
    """Não rodou (`--rapido`): não é aprovada nem reprovada, e o verify fica incompleto."""
    erro: bool = False
    """Não terminou: o banco deu erro no meio. Reprova sempre, mesmo com `--aceitar`, que aceita
    o resultado conhecido de uma conferência, não a falta dele."""


@dataclass(frozen=True)
class Contexto:
    """O que cada verificação precisa: banco, entrega, anos carregados e contrato."""

    con: psycopg.Connection
    entrega_id: UUID
    anos: tuple[int, ...]
    contrato: Contrato
    geometrica: bool
    """False pula a sobreposição entre peças, a única verificação de dezenas de minutos."""
    geradas: tuple[View, ...]
    """As views que o contrato gera: o que deve existir, o que é publicado."""
