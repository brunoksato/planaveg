"""O registro de cada entrega e de cada etapa (`entrega`, `execucao`)."""

from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from time import perf_counter
from typing import Any
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from planaveg_core import __version__
from planaveg_core.banco.migracoes import conferir_migracoes
from planaveg_core.banco.regras import conferir_contrato_vigente
from planaveg_core.banco.vigentes import sincronizar
from planaveg_core.contrato import Contrato
from planaveg_core.errors import PlanavegError

_LOG = logging.getLogger("planaveg_core.postgres")


def ultimo_detalhe(con: psycopg.Connection, etapa: str, chave: str) -> str | None:
    """Um campo do `detalhe` da última execução bem-sucedida da etapa."""
    linha = con.execute(
        """
        SELECT detalhe->>%s FROM execucao
        WHERE etapa = %s AND ok
        ORDER BY iniciada_em DESC LIMIT 1
        """,
        (chave, etapa),
    ).fetchone()
    return None if linha is None or linha[0] is None else str(linha[0])


def _sincronizar_no_fim(con: psycopg.Connection, vigentes: Path | None) -> None:
    """Refaz o diretório das versões vigentes depois do fechamento. Uma falha aqui fica no log,
    e a etapa já terminou: o diretório fica como a abertura o deixou, vazio numa etapa que mexe
    no que o GeoServer responde (inclusive a publicação), e o nginx só guarda por pouco tempo, o
    lado seguro."""
    if vigentes is None:
        return
    try:
        sincronizar(con, vigentes)
    except (OSError, psycopg.Error):
        _LOG.exception("as versões vigentes não foram gravadas em %s", vigentes)


def _entrega(entrega_id: UUID | None, info: dict[str, Any]) -> UUID | None:
    """A entrega da etapa: a dada, ou a que o `load` pôs no detalhe ao começar."""
    if entrega_id is None and isinstance(info.get("entrega_id"), str):
        return UUID(info["entrega_id"])
    return entrega_id


@contextmanager
def registrar(
    con: psycopg.Connection,
    etapa: str,
    entrega_id: UUID | None = None,
    detalhe: dict[str, Any] | None = None,
    vigentes: Path | None = None,
) -> Generator[dict[str, Any]]:
    """Abre uma linha em `execucao` antes da etapa e a fecha com ok/erro depois.

    O dicionário devolvido é gravado em `detalhe` ao final; a etapa acrescenta
    contagens e hectares nele. A linha de abertura é confirmada de imediato para
    sobreviver a uma falha posterior; o fechamento faz rollback do trabalho
    parcial da etapa antes de gravar `ok = false`. Os instantes usam
    `clock_timestamp()`, porque `now()` é o início da transação. Com `vigentes`, o diretório
    das versões vigentes é refeito depois da abertura e depois do fechamento.

    A etapa que termina sem exceção mas não deu certo (o `verify` reprovado) põe
    `info["ok"] = False`. A entrega vai na linha também na falha, se ela existir: o `load` só a
    conhece depois de começar e a põe em `info["entrega_id"]`.
    """
    info: dict[str, Any] = dict(detalhe or {})
    inicio = perf_counter()
    linha = con.execute(
        """
        INSERT INTO execucao (entrega_id, etapa, versao_lab, detalhe, iniciada_em)
        VALUES (%s, %s, %s, %s, clock_timestamp())
        RETURNING id
        """,
        (entrega_id, etapa, __version__, Jsonb(info)),
    ).fetchone()
    if linha is None:
        raise PlanavegError("execucao_nao_registrada", etapa)
    execucao_id = int(linha[0])
    con.commit()
    try:
        if vigentes is not None:
            # Antes de a etapa mexer em algo: se as versões não saem do diretório, ela não roda.
            sincronizar(con, vigentes)
        yield info
    except BaseException as exc:
        con.rollback()
        erro = exc.codigo if isinstance(exc, PlanavegError) else type(exc).__name__
        info.pop("ok", None)
        info["duracao_s"] = round(perf_counter() - inicio, 3)
        # A entrega de uma carga desfeita pode não existir mais: só vai se existir.
        con.execute(
            """
            UPDATE execucao
               SET concluida_em = clock_timestamp(), ok = false, erro = %s, detalhe = %s,
                   entrega_id = (SELECT id FROM entrega WHERE id = %s)
             WHERE id = %s
            """,
            (erro, Jsonb(info), _entrega(entrega_id, info), execucao_id),
        )
        con.commit()
        _sincronizar_no_fim(con, vigentes)
        raise
    ok = bool(info.pop("ok", True))
    info["duracao_s"] = round(perf_counter() - inicio, 3)
    con.execute(
        """
        UPDATE execucao
           SET concluida_em = clock_timestamp(), ok = %s, detalhe = %s, entrega_id = %s
         WHERE id = %s
        """,
        (ok, Jsonb(info), _entrega(entrega_id, info), execucao_id),
    )
    con.commit()
    _sincronizar_no_fim(con, vigentes)


def entrega_pronta(con: psycopg.Connection) -> UUID:
    """A única entrega em estado `pronta`. Falha fechado se não houver."""
    linha = con.execute(
        "SELECT id FROM entrega WHERE estado = 'pronta' ORDER BY concluida_em DESC LIMIT 1"
    ).fetchone()
    if linha is None:
        raise PlanavegError("entrega_inexistente", "rode planaveg-core load")
    return UUID(str(linha[0]))


def conferir_contrato(con: psycopg.Connection, entrega_id: UUID, contrato: Contrato) -> int:
    """O banco tem a estrutura deste core, e o contrato configurado tem de ser o vigente (o das
    tabelas das regras) e ler o arquivo como a carga da entrega o leu. Falha fechado. Devolve o id
    da versão vigente do contrato.

    O que a carga lê do contrato (o arquivo, as camadas, as colunas e as siglas da Sobreposicao,
    `Contrato.impressao_da_carga`) não pode mudar sem uma carga nova: calcular, conferir ou
    publicar uma entrega assim trocaria nomes de camada e de coluna sem aviso. O resto (a
    hierarquia, os filtros, as cores) pode mudar: pede só `init-db` e `geoserver`.
    """
    conferir_migracoes(con)
    versao_id = conferir_contrato_vigente(con, contrato)
    linha = con.execute(
        """
        SELECT v.impressao_carga FROM entrega e
        JOIN contrato_versao v ON v.id = e.contrato_versao_id
        WHERE e.id = %s
        """,
        (entrega_id,),
    ).fetchone()
    if linha is None or linha[0] != contrato.impressao_da_carga():
        raise PlanavegError(
            "contrato_diverge_da_carga",
            "o contrato mudou o arquivo, as camadas, as colunas ou as siglas: rode load de novo",
        )
    return versao_id


def contagens_da_carga(con: psycopg.Connection, entrega_id: UUID) -> dict[str, Any] | None:
    """O que a carga contou em cada camada da entrega (`entrega_camada`), pela camada: o que o
    `verify` reconcilia com as tabelas e o `status` mostra. None = entrega sem carga."""
    linhas = con.execute(
        """
        SELECT camada, ano_vs, feicoes, lidas, carregadas, vazias, anuladas, area_ha
        FROM entrega_camada WHERE entrega_id = %s ORDER BY ano_vs
        """,
        (entrega_id,),
    ).fetchall()
    if not linhas:
        return None
    return {
        str(camada): {
            "ano_vs": int(ano),
            "gpkg": int(feicoes),
            "lidas": int(lidas),
            "carregados": int(carregadas),
            "rejeitados": int(lidas) - int(carregadas),
            "vazias": int(vazias),
            "anulados": dict(anuladas),
            "area_ha": float(area),
        }
        for camada, ano, feicoes, lidas, carregadas, vazias, anuladas, area in linhas
    }
