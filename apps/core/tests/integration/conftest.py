"""Testes de integração: correm só se o banco do planaveg_core estiver acessível e carregado.

Marcados como `integration`; `uv run pytest -m integration` para rodá-los
isoladamente. Sem banco (ou sem entrega pronta) são pulados, não falham.
"""

from __future__ import annotations

from collections.abc import Iterator
from uuid import UUID

import psycopg
import pytest

from planaveg_core.config import Settings


@pytest.fixture(scope="session")
def settings() -> Settings:
    return Settings.from_env()


@pytest.fixture(scope="session")
def con(settings: Settings) -> Iterator[psycopg.Connection]:
    try:
        conexao = psycopg.connect(settings.database_url, autocommit=True, connect_timeout=3)
    except psycopg.OperationalError:
        pytest.skip("banco do planaveg_core indisponível")
    try:
        yield conexao
    finally:
        conexao.close()


@pytest.fixture(scope="session")
def entrega_id(con: psycopg.Connection) -> UUID:
    existe = con.execute("SELECT to_regclass('entrega')").fetchone()
    if existe is None or existe[0] is None:
        pytest.skip("banco sem init-db")
    linha = con.execute("SELECT id FROM entrega WHERE estado = 'pronta'").fetchone()
    if linha is None:
        pytest.skip("nenhuma entrega pronta; rode planaveg-core load")
    return UUID(str(linha[0]))
