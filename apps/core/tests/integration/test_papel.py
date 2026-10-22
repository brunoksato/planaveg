"""A senha do papel de leitura vai ao PostgreSQL como verificador SCRAM, e o login entra."""

from __future__ import annotations

import os
import secrets

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo

from planaveg_core.banco.papel import verificador_scram
from planaveg_core.config import Settings

pytestmark = pytest.mark.integration


def test_login_com_a_senha_do_verificador(settings: Settings, con: psycopg.Connection) -> None:
    papel = f"planaveg_teste_scram_{os.getpid()}"
    senha = secrets.token_hex(12)
    con.execute(
        sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
            sql.Identifier(papel), sql.Literal(verificador_scram(senha))
        )
    )
    try:
        guardado = con.execute(
            "SELECT rolpassword FROM pg_authid WHERE rolname = %s", (papel,)
        ).fetchone()
        assert guardado is not None and str(guardado[0]).startswith("SCRAM-SHA-256$4096:")
        entrar = make_conninfo(settings.database_url, user=papel, password=senha)
        with psycopg.connect(entrar, connect_timeout=5) as dentro:
            assert dentro.execute("SELECT current_user").fetchone() == (papel,)
        errada = make_conninfo(settings.database_url, user=papel, password=senha + "x")
        with pytest.raises(psycopg.OperationalError):
            psycopg.connect(errada, connect_timeout=5).close()
    finally:
        con.execute(sql.SQL("DROP ROLE {}").format(sql.Identifier(papel)))
