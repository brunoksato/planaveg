"""As geometrias: as inválidas medem igual depois do reparo, a área de cada peça bate com a
geometria, e nenhuma peça cobre outra.
"""

from __future__ import annotations

from typing import Any, NamedTuple

from planaveg_core.banco import TOLERANCIA_HA
from planaveg_core.conferencia.base import Contexto, Verificacao

_GRADE_M = 0.0001  # 0,1 mm no Albers: snapping das interseções de fragmentos


class _Par(NamedTuple):
    """Duas peças do mesmo ano (pelo `origem_id`) e a área do interior comum delas."""

    fid_a: int
    fid_b: int
    area_ha: float


def geometrias(ctx: Contexto) -> Verificacao:
    """A geometria recebida (Albers) mede o que diz: inválida só passa se o reparo não muda a área.

    Área e sobreposição são medidas na geometria recebida, sem reparo. Uma peça inválida cujo
    `ST_MakeValid` dá a mesma área (± 0,01 ha) não muda número nenhum; aparece no detalhe,
    com ano, fid e motivo, para voltar ao produtor do arquivo. O tipo e o SRID de cada geometria
    a tabela garante, e a recebida tem ao menos uma parte (`partes > 0`); a simplificada
    (`geom_alta`) a carga deixa nula se não sobrar nada dela, e aí reprova. A cópia cartográfica
    em 4674 não é reparada e pode ter autointerseção de arredondamento: não entra na validade.
    """
    linha = ctx.con.execute(
        "SELECT count(*) FROM peca_geometria WHERE entrega_id = %s AND geom_alta IS NULL",
        (ctx.entrega_id,),
    ).fetchone()
    sem_simplificada = 0 if linha is None else int(linha[0])
    invalidas = ctx.con.execute(
        """
        SELECT ano_vs, origem_id, split_part(ST_IsValidReason(geom_albers), '[', 1),
               abs(ST_Area(geom_albers) - ST_Area(ST_MakeValid(geom_albers))) / 10000.0
        FROM peca_geometria
        WHERE entrega_id = %s AND NOT ST_IsValid(geom_albers)
        ORDER BY 1, 2
        """,
        (ctx.entrega_id,),
    ).fetchall()
    alteram = [dif for _ano, _fid, _motivo, dif in invalidas if float(dif) > TOLERANCIA_HA]
    pecas = [f"{ano}:{fid} {motivo} dif_ha={float(dif):.6f}" for ano, fid, motivo, dif in invalidas]
    return Verificacao(
        "geometria_recebida_mensuravel",
        sem_simplificada == 0 and not alteram,
        f"invalidas={len(invalidas)} reparo_altera_area={len(alteram)} "
        f"sem_simplificada={sem_simplificada}" + (f" pecas={pecas[:5]}" if pecas else ""),
    )


def area_recebida(ctx: Contexto) -> Verificacao:
    """`Area_ha` de cada peça é a área da geometria recebida no Albers IBGE."""
    linha = ctx.con.execute(
        """
        SELECT count(*) FILTER (WHERE abs(r.area_ha - g.area_calculada_ha) > %s),
               coalesce(max(abs(r.area_ha - g.area_calculada_ha)), 0),
               coalesce(sum(r.area_ha), 0), coalesce(sum(g.area_calculada_ha), 0)
        FROM peca_recebida r
        JOIN peca_geometria g
          ON g.entrega_id = r.entrega_id AND g.ano_vs = r.ano_vs AND g.origem_id = r.origem_id
        WHERE r.entrega_id = %s
        """,
        (TOLERANCIA_HA, ctx.entrega_id),
    ).fetchone()
    if linha is None:
        return Verificacao("area_recebida_igual_geometria", False, "sem resposta")
    divergentes, pior, recebida, medida = int(linha[0]), float(linha[1]), linha[2], linha[3]
    return Verificacao(
        "area_recebida_igual_geometria",
        divergentes == 0,
        f"divergentes={divergentes} pior_ha={pior:.6f} recebida={float(recebida):.2f} "
        f"medida={float(medida):.2f}",
    )


def pecas_sem_sobreposicao(ctx: Contexto) -> Verificacao:
    """Interior comum entre peças do mesmo ano, na geometria recebida, por par de peças.

    Peças de até um milhão de vértices tornariam o par a par direto impraticável;
    fragmentos de até 256 vértices mantêm cada ST_Relate barato, e a área de cada par de
    peças é a soma das interseções dos seus fragmentos. A peça recebida inválida é
    fragmentada já reparada (`geometria_recebida_mensuravel` prova que o reparo não muda a
    área). Reprova se a área sobreposta de um ano passar de 0,01 ha. Os pares de pelo
    menos 0,01 ha vão para `dados`, para voltar ao produtor do arquivo. A tabela temporária
    é removida a cada ano porque os anos todos correm na mesma transação (a de `_rodar`).
    """
    if not ctx.geometrica:
        return Verificacao("pecas_sem_sobreposicao", False, "pulada (--rapido)", pulada=True)
    con = ctx.con
    detalhes: list[str] = []
    materiais: dict[str, Any] = {}
    pior = 0.0
    for ano in ctx.anos:
        con.execute("DROP TABLE IF EXISTS _verif_frag")
        con.execute(
            """
            CREATE TEMP TABLE _verif_frag AS
            SELECT origem_id AS peca,
                   ST_Subdivide(
                       CASE WHEN ST_IsValid(geom_albers) THEN geom_albers
                            ELSE ST_MakeValid(geom_albers) END,
                       256
                   ) AS geom
            FROM peca_geometria WHERE entrega_id = %s AND ano_vs = %s
            """,
            (ctx.entrega_id, ano),
        )
        con.execute("CREATE INDEX ON _verif_frag USING gist (geom)")
        con.execute("ANALYZE _verif_frag")
        pares = [
            _Par(int(a), int(b), float(ha))
            for a, b, ha in con.execute(
                """
                SELECT a.peca, b.peca,
                       sum(ST_Area(ST_Intersection(a.geom, b.geom, %s))) / 10000.0
                FROM _verif_frag a
                JOIN _verif_frag b
                  ON b.peca > a.peca
                 AND a.geom && b.geom
                 AND ST_Relate(a.geom, b.geom, 'T********')
                GROUP BY 1, 2
                """,
                (_GRADE_M,),
            ).fetchall()
        ]
        con.execute("DROP TABLE IF EXISTS _verif_frag")
        total = con.execute(
            "SELECT coalesce(sum(area_ha), 0) FROM peca_recebida "
            "WHERE entrega_id = %s AND ano_vs = %s",
            (ctx.entrega_id, ano),
        ).fetchone()
        area_ano = 0.0 if total is None else float(total[0])
        area = sum(par.area_ha for par in pares)
        pior = max(pior, area)
        # Os pares de 0,01 ha para cima, do maior para o menor.
        relevantes = sorted(
            (par for par in pares if par.area_ha >= TOLERANCIA_HA),
            key=lambda par: par.area_ha,
            reverse=True,
        )
        materiais[str(ano)] = [{"fid_a": a, "fid_b": b, "area_ha": ha} for a, b, ha in relevantes]
        maior = ""
        if relevantes:
            fid_a, fid_b, area_ha = relevantes[0]
            maior = f" maior_par={fid_a}x{fid_b}:{area_ha:.4f}ha"
        ppm = area / area_ano * 1e6 if area_ano else 0.0
        detalhes.append(
            f"{ano}: pares={len(pares)} pares_abaixo_tolerancia={len(pares) - len(relevantes)} "
            f"pares_materiais={len(relevantes)} area_ha={area:.4f} ppm={ppm:.2f}{maior}"
        )
    return Verificacao(
        "pecas_sem_sobreposicao",
        bool(ctx.anos) and pior <= TOLERANCIA_HA,
        "; ".join(detalhes),
        {"pares_materiais": materiais},
    )
