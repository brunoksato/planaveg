"""A carga: uma entrega pronta, as contagens que fecham e uma carga que terminou bem."""

from __future__ import annotations

from uuid import UUID

from planaveg_core import etapas
from planaveg_core.banco import contagens_da_carga
from planaveg_core.conferencia.base import Contexto, Verificacao


def entrega_unica(ctx: Contexto) -> Verificacao:
    prontas = [
        UUID(str(r[0]))
        for r in ctx.con.execute("SELECT id FROM entrega WHERE estado = 'pronta'").fetchall()
    ]
    ok = prontas == [ctx.entrega_id]
    return Verificacao("entrega_unica_pronta", ok, f"prontas={len(prontas)}")


def contagens(ctx: Contexto) -> Verificacao:
    """O arquivo, a carga e a tabela contam o mesmo.

    Por camada (`entrega_camada`): as feições do arquivo (contadas à parte da leitura) são as
    gravadas mais as rejeitadas; as gravadas são as que estão em peca_recebida, cada uma com o
    desenho em peca_geometria; e nenhuma foi rejeitada.
    """
    carga = contagens_da_carga(ctx.con, ctx.entrega_id)
    if carga is None:
        return Verificacao("contagens_reconciliadas", False, "sem contagens da carga; rode load")
    divergentes: list[str] = []
    for camada in ctx.contrato.camadas:
        dito = carga.get(camada.origem)
        if dito is None:
            divergentes.append(f"{camada.origem}:fora_da_carga")
            continue
        if dito["gpkg"] != dito["carregados"] + dito["rejeitados"]:
            divergentes.append(f"{camada.origem}:arquivo={dito['gpkg']}")
            continue
        contagem = ctx.con.execute(
            "SELECT count(*) FROM peca_recebida WHERE entrega_id = %s AND ano_vs = %s",
            (ctx.entrega_id, camada.ano_vs),
        ).fetchone()
        if contagem is None or int(contagem[0]) != dito["carregados"]:
            divergentes.append(f"{camada.origem}:tabela")
        desenhos = ctx.con.execute(
            "SELECT count(*) FROM peca_geometria WHERE entrega_id = %s AND ano_vs = %s",
            (ctx.entrega_id, camada.ano_vs),
        ).fetchone()
        if desenhos is None or int(desenhos[0]) != dito["carregados"]:
            divergentes.append(f"{camada.origem}:desenho")
        if dito["rejeitados"]:
            divergentes.append(f"{camada.origem}:rejeitados={dito['rejeitados']}")
    return Verificacao(
        "contagens_reconciliadas",
        not divergentes,
        "ok" if not divergentes else f"divergentes={divergentes[:5]}",
    )


def execucoes(ctx: Contexto) -> Verificacao:
    """A entrega pronta tem uma carga que terminou bem.

    Uma carga que falha é desfeita (a base fica a da última que terminou bem): as recargas que
    falharam, antes ou depois dela, só aparecem no detalhe.
    """
    linha = ctx.con.execute(
        """
        SELECT count(*) FILTER (WHERE ok), count(*) FILTER (WHERE ok IS NOT TRUE)
        FROM execucao
        WHERE entrega_id = %s AND etapa = %s
        """,
        (ctx.entrega_id, etapas.LOAD),
    ).fetchone()
    boas, falhas = (0, 0) if linha is None else (int(linha[0]), int(linha[1]))
    return Verificacao(
        "carga_executada_com_sucesso", boas > 0, f"cargas_ok={boas} falhas_desfeitas={falhas}"
    )
