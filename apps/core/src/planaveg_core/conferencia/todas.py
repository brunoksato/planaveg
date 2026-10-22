"""As dezesseis verificações, na ordem em que rodam, e `verificar`, que roda todas."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING
from uuid import UUID

import psycopg

from planaveg_core.conferencia.base import Contexto, Verificacao
from planaveg_core.conferencia.carga import contagens, entrega_unica, execucoes
from planaveg_core.conferencia.classificacao import (
    classificacao,
    computo_recebido,
    facetas,
    facetas_por_lugar,
    hierarquia,
    sobreposicao_coerente,
)
from planaveg_core.conferencia.geometrias import (
    area_recebida,
    geometrias,
    pecas_sem_sobreposicao,
)
from planaveg_core.conferencia.publicacao import (
    fid_unico,
    gt_pk_metadata,
    papel_leitura,
    views_espaciais,
)
from planaveg_core.publicacao import views

if TYPE_CHECKING:
    from planaveg_core.contrato import Contrato


_LOG = logging.getLogger("planaveg_core.postgres")

_VERIFICACOES: tuple[tuple[str, Callable[[Contexto], Verificacao]], ...] = (
    ("entrega_unica_pronta", entrega_unica),
    ("contagens_reconciliadas", contagens),
    ("geometria_recebida_mensuravel", geometrias),
    ("hierarquia_coberta_pelo_contrato", hierarquia),
    ("area_recebida_igual_geometria", area_recebida),
    ("computo_recebido_fecha", computo_recebido),
    ("sobreposicao_igual_as_marcas", sobreposicao_coerente),
    ("classificacao_particiona_pecas", classificacao),
    ("facetas_somam_o_computo", facetas),
    ("facetas_por_lugar_somam_os_recortes", facetas_por_lugar),
    ("pecas_sem_sobreposicao", pecas_sem_sobreposicao),
    ("papel_leitura_so_publicado", papel_leitura),
    ("fid_unico_por_camada", fid_unico),
    ("filtros_espaciais_publicados", views_espaciais),
    ("gt_pk_metadata_cobre_camadas", gt_pk_metadata),
    ("carga_executada_com_sucesso", execucoes),
)
"""O código de cada uma e a função que a confere: o código vale também quando ela falha."""

INVARIANTES = tuple(codigo for codigo, _ in _VERIFICACOES)
"""Os códigos das dezesseis, na ordem em que rodam (o `--aceitar` do verify escolhe entre eles)."""


def _rodar(ctx: Contexto, codigo: str, conferir: Callable[[Contexto], Verificacao]) -> Verificacao:
    """Uma conferência na sua transação (ou num ponto de salvamento, se quem chama já tem uma),
    com memória para ordenar e agrupar (`SET LOCAL`: vale até o fim da transação, e não fica na
    sessão). Um erro do banco vira um erro dela (`erro=True`), que nunca é aceito; as outras
    rodam assim mesmo."""
    try:
        with ctx.con.transaction():
            ctx.con.execute("SET LOCAL work_mem = '256MB'")
            return conferir(ctx)
    except psycopg.Error as exc:
        _LOG.exception("verificação %s falhou com erro do banco", codigo)
        return Verificacao(codigo, False, f"erro do banco: {type(exc).__name__}", erro=True)


def verificar(
    con: psycopg.Connection, entrega_id: UUID, contrato: Contrato, *, geometrica: bool = True
) -> list[Verificacao]:
    anos = tuple(
        int(r[0])
        for r in con.execute(
            "SELECT DISTINCT ano_vs FROM peca_recebida WHERE entrega_id = %s ORDER BY 1",
            (entrega_id,),
        ).fetchall()
    )
    ctx = Contexto(con, entrega_id, anos, contrato, geometrica, tuple(views(contrato)))
    return [_rodar(ctx, codigo, conferir) for codigo, conferir in _VERIFICACOES]
