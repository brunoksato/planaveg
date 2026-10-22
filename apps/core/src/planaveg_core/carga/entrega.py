"""A entrega: o SHA-256 do arquivo e o registro que o reutiliza ou substitui a pronta."""

from __future__ import annotations

import hashlib
from pathlib import Path
from uuid import UUID

import psycopg

from planaveg_core import gpkg
from planaveg_core.errors import PlanavegError


def sha256_arquivo(caminho: Path) -> tuple[str, int]:
    with caminho.open("rb") as fh:
        digest = hashlib.file_digest(fh, "sha256").hexdigest()
    return digest, caminho.stat().st_size


def registrar_entrega(
    con: psycopg.Connection,
    contrato_versao_id: int,
    recipiente: gpkg.Recipiente,
    sha256: str,
    tamanho: int,
) -> UUID:
    """Reutiliza a entrega do mesmo arquivo lido com a mesma versão do contrato, ou cria uma nova;
    a pronta vira `substituida`."""
    linha = con.execute(
        """
        INSERT INTO entrega (
            id, nome_arquivo, sha256, tamanho_bytes, application_id, user_version,
            contrato_versao_id, estado
        ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, 'carregando')
        ON CONFLICT (sha256, contrato_versao_id) DO UPDATE
           SET nome_arquivo = EXCLUDED.nome_arquivo, tamanho_bytes = EXCLUDED.tamanho_bytes,
               application_id = EXCLUDED.application_id, user_version = EXCLUDED.user_version,
               iniciada_em = now(), concluida_em = NULL, estado = 'carregando'
        RETURNING id
        """,
        (
            recipiente.caminho.name,
            sha256,
            tamanho,
            recipiente.application_id,
            recipiente.user_version,
            contrato_versao_id,
        ),
    ).fetchone()
    if linha is None:
        raise PlanavegError("entrega_nao_registrada")
    entrega_id = UUID(str(linha[0]))
    con.execute(
        "UPDATE entrega SET estado = 'substituida' WHERE id <> %s AND estado = 'pronta'",
        (entrega_id,),
    )
    return entrega_id
