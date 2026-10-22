"""A conexão com o PostGIS, os avisos do GEOS no log e a execução de um script inteiro."""

from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager

import psycopg
from psycopg import ClientCursor
from psycopg.errors import Diagnostic

from planaveg_core.config import Settings

_LOG = logging.getLogger("planaveg_core.postgres")


# Avisos do GEOS emitidos por ST_IsValid quando a conferência (`verify`) acha uma peça
# inválida: esperados, um por peça, só com --verbose. Nada é reparado: a geometria é a recebida.
_AVISOS_GEOS = (
    "Self-intersection",
    "Ring Self-intersection",
    "Too few points",
    "Hole lies outside shell",
    "Interior is disconnected",
    "Nested shells",
    "Nested holes",
    "Duplicate Rings",
)


def _aviso(diag: Diagnostic) -> None:
    """Avisos do PostgreSQL viram log. Os `IF [NOT] EXISTS ... skipping` dos scripts
    reaplicáveis e os de validade do GEOS na conferência só aparecem com `--verbose`."""
    mensagem = diag.message_primary or ""
    esperado = mensagem.endswith(", skipping") or mensagem.startswith(_AVISOS_GEOS)
    _LOG.log(logging.DEBUG if esperado else logging.INFO, "%s", mensagem)


@contextmanager
def conectar(settings: Settings) -> Generator[psycopg.Connection]:
    with psycopg.connect(settings.database_url, autocommit=False) as con:
        con.add_notice_handler(_aviso)
        con.execute("SET timezone TO 'UTC'")
        con.execute("SET statement_timeout = 0")
        con.execute("SET jit = off")
        yield con
        con.commit()


def executar(con: psycopg.Connection, texto: str) -> None:
    # Protocolo simples: um script pode ter várias sentenças e blocos $$ .
    with ClientCursor(con) as cur:
        cur.execute(texto)
