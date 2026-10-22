"""A `fonte_vigente` só dá versão ao portal quando a última publicação vale para os dados.

Cria a view do código (não a do banco) como temporária, sobre cópias vazias de `entrega`,
`entrega_camada`, `execucao` e `contrato_versao` em tabelas temporárias, que o PostgreSQL procura
antes das de public, numa transação desfeita no fim: nada do banco muda, e o resultado não
depende do que está carregado.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.types.json import Jsonb

from planaveg_core import etapas
from planaveg_core.contrato import Contrato
from planaveg_core.publicacao import views

pytestmark = pytest.mark.integration

INICIO = datetime(2026, 10, 1, 3, tzinfo=UTC)
VERSOES = {"versao_mapa": "mapa-1", "versao_dados": "dados-1"}
SEM_VERSAO = (None, None)


@dataclass(frozen=True)
class Execucao:
    """Uma linha de `execucao` que começou `minuto` minutos depois de INICIO."""

    etapa: str
    entrega: UUID | None
    minuto: int
    duracao: int | None = 1
    """None: ainda roda (ou o processo morreu antes de registrar o fim)."""
    ok: bool = True
    detalhe: dict[str, Any] = field(default_factory=dict)


@pytest.fixture
def banco(con: psycopg.Connection, contrato: Contrato) -> Iterator[psycopg.Connection]:
    existe = con.execute("SELECT to_regclass('public.execucao')").fetchone()
    if existe is None or existe[0] is None:
        pytest.skip("banco sem init-db")
    fonte = next(v for v in views(contrato) if v.nome == "fonte_vigente")
    with con.transaction(force_rollback=True):
        con.execute("CREATE TEMP TABLE contrato_versao (LIKE public.contrato_versao)")
        con.execute(
            "INSERT INTO contrato_versao (id, impressao, versao, impressao_carga, conteudo, "
            "registrada_em, vigente) VALUES (1, repeat('a', 64), '1.0.0', repeat('b', 64), "
            "'{}', now(), true)"
        )
        con.execute("CREATE TEMP TABLE entrega (LIKE public.entrega)")
        con.execute("CREATE TEMP TABLE entrega_camada (LIKE public.entrega_camada)")
        con.execute("CREATE TEMP TABLE execucao (LIKE public.execucao)")
        # Como o init-db a cria, mas temporária: lê as cópias, e não as tabelas do banco.
        con.execute(sql.SQL("CREATE TEMP VIEW {} AS {}").format(fonte.alvo, fonte.corpo))
        yield con


def _entrega(con: psycopg.Connection, estado: str = "pronta") -> UUID:
    entrega = uuid4()
    con.execute(
        """
        INSERT INTO entrega (id, nome_arquivo, sha256, tamanho_bytes, application_id,
                             user_version, contrato_versao_id, iniciada_em, concluida_em, estado)
        VALUES (%s, 'base.gpkg', %s, 1, 1196444487, 10400, 1, %s, %s, %s)
        """,
        (entrega, entrega.hex * 2, INICIO, INICIO, estado),
    )
    return entrega


def _registrar(con: psycopg.Connection, *execucoes: Execucao) -> None:
    for x in execucoes:
        inicio = INICIO + timedelta(minutes=x.minuto)
        fim = None if x.duracao is None else inicio + timedelta(minutes=x.duracao)
        con.execute(
            """
            INSERT INTO execucao (id, entrega_id, etapa, iniciada_em, concluida_em, ok, detalhe)
            VALUES ((SELECT coalesce(max(id), 0) + 1 FROM execucao), %s, %s, %s, %s, %s, %s)
            """,
            (x.entrega, x.etapa, inicio, fim, None if fim is None else x.ok, Jsonb(x.detalhe)),
        )


def _publicada(entrega: UUID) -> list[Execucao]:
    """Uma base carregada e publicada no GeoServer."""
    return [
        Execucao("init-db", None, 0),
        Execucao("load", entrega, 2, duracao=80, detalhe={"registros_carregados": 10}),
        Execucao("verify", entrega, 83),
        Execucao("geoserver", entrega, 90, detalhe=VERSOES),
    ]


def _fonte(con: psycopg.Connection) -> list[tuple[Any, ...]]:
    return con.execute("SELECT arquivo, versao_mapa, versao_dados FROM fonte_vigente").fetchall()


def _versoes(con: psycopg.Connection) -> tuple[Any, ...]:
    [(arquivo, *versoes)] = _fonte(con)
    assert arquivo == "base.gpkg"  # a linha da base continua, com ou sem versão
    return tuple(versoes)


def test_base_publicada_traz_as_versoes(banco: psycopg.Connection) -> None:
    entrega = _entrega(banco)
    _registrar(
        banco,
        *_publicada(entrega),
        # O que vem depois e não mexe nos dados (conferir) não muda nada.
        Execucao("verify", entrega, 160),
    )

    assert _versoes(banco) == tuple(VERSOES.values())


_DEPOIS_DA_PUBLICACAO = [
    pytest.param(etapa, duracao, ok, id=f"{etapa}-{nome}")
    for etapa in etapas.QUE_MEXEM_NOS_DADOS
    for nome, duracao, ok in (
        ("terminou", 30, True),
        ("falhou", 30, False),
        ("rodando", None, True),
    )
    # Um geoserver que terminou bem depois é a publicação nova (o teste seguinte), não uma etapa
    # que tira as versões da anterior.
    if not (etapa == etapas.GEOSERVER and nome == "terminou")
]


@pytest.mark.parametrize(("etapa", "duracao", "ok"), _DEPOIS_DA_PUBLICACAO)
def test_etapa_que_mexe_nos_dados_depois_da_publicacao_tira_as_versoes(
    banco: psycopg.Connection, etapa: str, duracao: int | None, ok: bool
) -> None:
    entrega = _entrega(banco)
    # O init-db corre sem entrega; o load, na entrega (recarregar o mesmo arquivo a reutiliza).
    depois = Execucao(etapa, None if etapa == "init-db" else entrega, 200, duracao=duracao, ok=ok)
    _registrar(banco, *_publicada(entrega), depois)

    assert _versoes(banco) == SEM_VERSAO


def test_durante_a_carga_nao_ha_base_vigente(banco: psycopg.Connection) -> None:
    _registrar(banco, *_publicada(_entrega(banco, estado="substituida")))
    carregando = _entrega(banco, estado="carregando")
    _registrar(banco, Execucao("load", carregando, 200, duracao=None))

    assert _fonte(banco) == []
