"""Os números e a classificação: a hierarquia, o cômputo recebido, as marcas, os arranjos e as
facetas do Brasil e de cada lugar.
"""

from __future__ import annotations

from planaveg_core.banco import TOLERANCIA_HA
from planaveg_core.conferencia.base import Contexto, Verificacao


def hierarquia(ctx: Contexto) -> Verificacao:
    """Todo nível que o contrato dá como presente tem peças em cada ano. O rótulo de cada peça
    está no contrato, com o tier e a condição do CAR dele: a chave estrangeira e a carga já o
    garantem, e aqui só se confere que nada ficou de fora."""
    esperados = {n.rotulo for n in ctx.contrato.niveis_presentes() if n.rotulo}
    vistos = {
        (int(r[0]), str(r[1]))
        for r in ctx.con.execute(
            """
            SELECT r.ano_vs, r.hierarquia FROM peca_recebida r
            JOIN contrato_hierarquia h ON h.hierarquia = r.hierarquia
            WHERE r.entrega_id = %s
            GROUP BY 1, 2
            """,
            (ctx.entrega_id,),
        ).fetchall()
    }
    fora = sorted({rotulo for _, rotulo in vistos if rotulo not in esperados})
    faltando = sorted(
        f"{ano}:{rotulo}" for ano in ctx.anos for rotulo in esperados if (ano, rotulo) not in vistos
    )
    ok = bool(vistos) and not fora and not faltando
    return Verificacao(
        "hierarquia_coberta_pelo_contrato",
        ok,
        f"rotulos={len(esperados)} anos={list(ctx.anos)}"
        if ok
        else f"fora={fora[:3]} sem_pecas={faltando[:3]}",
    )


def computo_recebido(ctx: Contexto) -> Verificacao:
    """O cômputo que o arquivo diz para cada linha da hierarquia em cada ano
    (`computo_recebido`, um valor só) é a soma das peças dela."""
    rows = ctx.con.execute(
        """
        SELECT p.ano_vs, p.hierarquia, c.area_ha, p.soma
        FROM (
            SELECT ano_vs, hierarquia, sum(area_ha) AS soma
            FROM peca_recebida WHERE entrega_id = %(entrega)s
            GROUP BY 1, 2
        ) p
        FULL JOIN (
            SELECT ano_vs, hierarquia, area_ha FROM computo_recebido
            WHERE entrega_id = %(entrega)s
        ) c USING (ano_vs, hierarquia)
        """,
        {"entrega": ctx.entrega_id},
    ).fetchall()
    ruins = [
        f"{ano}:{hier}"
        for ano, hier, computo, soma in rows
        if computo is None or soma is None or abs(float(computo) - float(soma)) > TOLERANCIA_HA
    ]
    return Verificacao(
        "computo_recebido_fecha",
        bool(rows) and not ruins,
        f"niveis_ano={len(rows)}" if not ruins else f"divergentes={ruins[:3]}",
    )


# A coluna Sobreposicao: a sigla de cada marca fundiária da peça, na ordem do contrato
# (`contrato_marca.sigla` e `ordem_sigla`).
_SOBREPOSICAO = """
SELECT count(*) FILTER (WHERE coalesce(r.sobreposicao, '') <> coalesce(s.texto, '')), count(*)
FROM peca_recebida r
LEFT JOIN LATERAL (
    SELECT string_agg(m.sigla, '' ORDER BY m.ordem_sigla) AS texto
    FROM peca_marca pm
    JOIN contrato_marca m ON m.marca = pm.marca
    WHERE pm.entrega_id = r.entrega_id AND pm.ano_vs = r.ano_vs AND pm.origem_id = r.origem_id
      AND m.sigla IS NOT NULL
) s ON true
WHERE r.entrega_id = %s
"""


def sobreposicao_coerente(ctx: Contexto) -> Verificacao:
    """A coluna Sobreposicao é a concatenação das siglas das marcas, na ordem do contrato."""
    linha = ctx.con.execute(_SOBREPOSICAO, (ctx.entrega_id,)).fetchone()
    divergentes = 0 if linha is None else int(linha[0])
    return Verificacao(
        "sobreposicao_igual_as_marcas",
        divergentes == 0,
        f"divergentes={divergentes}",
    )


def classificacao(ctx: Contexto) -> Verificacao:
    """Toda peça tem nível e arranjo, e os arranjos somam o cômputo de cada ano."""
    linha = ctx.con.execute(
        """
        SELECT count(*) FILTER (WHERE nivel IS NULL), count(*) FILTER (WHERE arranjo IS NULL),
               (SELECT count(*) FROM (
                    SELECT n.ano_vs FROM
                      (SELECT ano_vs, sum(area_ha) AS t FROM quantitativo_nivel
                        GROUP BY 1) n
                      JOIN (SELECT ano_vs, sum(area_ha) AS t FROM quantitativo_arranjo
                             WHERE nivel IS NULL GROUP BY 1) a USING (ano_vs)
                    WHERE abs(n.t - a.t) > %s) d)
        FROM peca_classificada
        """,
        (TOLERANCIA_HA,),
    ).fetchone()
    if linha is None:
        return Verificacao("classificacao_particiona_pecas", False, "sem resposta")
    sem_nivel, sem_arranjo, anos_divergentes = (int(v) for v in linha)
    return Verificacao(
        "classificacao_particiona_pecas",
        sem_nivel == 0 and sem_arranjo == 0 and anos_divergentes == 0,
        f"sem_nivel={sem_nivel} sem_arranjo={sem_arranjo} anos_divergentes={anos_divergentes}",
    )


def facetas(ctx: Contexto) -> Verificacao:
    """As facetas dos filtros do mapa somam, em cada ano, as peças e o cômputo do painel."""
    linha = ctx.con.execute(
        """
        SELECT count(*) FROM (
            SELECT ano_vs, sum(n_pecas) AS n, sum(area_ha) AS t
            FROM quantitativo_faceta GROUP BY 1
        ) f
        FULL JOIN (
            SELECT n.ano_vs, n.t, p.n FROM
              (SELECT ano_vs, sum(area_ha) AS t FROM quantitativo_nivel GROUP BY 1) n
              JOIN (SELECT ano_vs, count(*) AS n FROM peca_classificada GROUP BY 1) p
              USING (ano_vs)
        ) q USING (ano_vs)
        WHERE f.n IS DISTINCT FROM q.n OR abs(coalesce(f.t, 0) - coalesce(q.t, 0)) > %s
        """,
        (TOLERANCIA_HA,),
    ).fetchone()
    divergentes = int(linha[0]) if linha is not None else -1
    return Verificacao(
        "facetas_somam_o_computo", divergentes == 0, f"anos_divergentes={divergentes}"
    )


def facetas_por_lugar(ctx: Contexto) -> Verificacao:
    """As facetas de cada lugar somam, em cada ano, as peças e a área do recorte dele."""
    linha = ctx.con.execute(
        """
        SELECT count(*) FROM (
            SELECT ano_vs, dimensao, chave, sum(n_pecas) AS n, sum(area_ha) AS t
            FROM quantitativo_faceta_lugar GROUP BY 1, 2, 3
        ) f
        FULL JOIN (
            SELECT ano_vs, dimensao, chave, n_pecas AS n, area_ha AS t
            FROM quantitativo_dimensao WHERE nivel IS NULL AND arranjo IS NULL
        ) d ON d.ano_vs = f.ano_vs AND d.dimensao = f.dimensao
           AND d.chave IS NOT DISTINCT FROM f.chave
        WHERE f.n IS DISTINCT FROM d.n OR abs(coalesce(f.t, 0) - coalesce(d.t, 0)) > %s
        """,
        (TOLERANCIA_HA,),
    ).fetchone()
    divergentes = int(linha[0]) if linha is not None else -1
    return Verificacao(
        "facetas_por_lugar_somam_os_recortes",
        divergentes == 0,
        f"lugares_divergentes={divergentes}",
    )
