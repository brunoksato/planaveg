"""O papel de leitura do GeoServer: só lê o que é publicado, nunca o insumo, a classificação nem a
operação.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

import psycopg
from psycopg import sql

from planaveg_core.publicacao import View

PAPEL_LEITURA = "geoserver_leitura"


def concessoes(geradas: list[View]) -> list[sql.Composed]:
    """O papel de leitura lê só o publicado: SELECT objeto por objeto, nunca no schema todo.

    `spatial_ref_sys` e `geometry_columns` continuam legíveis por PUBLIC, como o PostGIS
    instala: sem eles o GeoServer não descobre geometria nem SRID.
    """
    papel = sql.Identifier(PAPEL_LEITURA)
    publicados = [*(v.nome for v in geradas if v.publicada), "gt_pk_metadata"]
    return [
        sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {}").format(papel),
        sql.SQL("GRANT SELECT ON\n    {}\nTO {}").format(
            sql.SQL(",\n    ").join(sql.Identifier(nome) for nome in publicados), papel
        ),
    ]


def verificador_scram(senha: str, *, sal: bytes | None = None, iteracoes: int = 4096) -> str:
    """O que o PostgreSQL guarda de uma senha SCRAM-SHA-256 (RFC 5802), calculado aqui.

    Com ele no `ALTER ROLE`, a senha em si nunca passa pelo SQL: nem um `log_statement`
    ligado nem um erro na sentença a escrevem no log do PostgreSQL.
    """
    sal = sal if sal is not None else secrets.token_bytes(16)
    salgada = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), sal, iteracoes)
    do_cliente = hmac.new(salgada, b"Client Key", hashlib.sha256).digest()
    do_servidor = hmac.new(salgada, b"Server Key", hashlib.sha256).digest()
    guardada = hashlib.sha256(do_cliente).digest()

    def b64(dado: bytes) -> str:
        return base64.b64encode(dado).decode("ascii")

    return f"SCRAM-SHA-256${iteracoes}:{b64(sal)}${b64(guardada)}:{b64(do_servidor)}"


def papel_sem_senha() -> sql.Composed:
    """O papel do GeoServer, se ainda não existe, e a conexão ao banco atual. A senha não vai
    aqui: `garantir_papel_leitura` a grava depois."""
    return sql.SQL(
        """DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {nome}) THEN
        CREATE ROLE {papel} LOGIN;
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO {papel}', current_database());
END
$$"""
    ).format(nome=sql.Literal(PAPEL_LEITURA), papel=sql.Identifier(PAPEL_LEITURA))


def garantir_papel_leitura(con: psycopg.Connection, senha: str) -> None:
    """Papel do GeoServer, com a senha das configurações (nunca do SQL versionado), gravada
    como verificador SCRAM (`verificador_scram`)."""
    con.execute(papel_sem_senha())
    con.execute(
        sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {}").format(
            sql.Identifier(PAPEL_LEITURA), sql.Literal(verificador_scram(senha))
        )
    )
