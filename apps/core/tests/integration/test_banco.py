from __future__ import annotations

from uuid import UUID

import psycopg
import pytest
from regras import vale

from planaveg_core.conferencia import verificar
from planaveg_core.contrato import Contrato

pytestmark = pytest.mark.integration


def test_invariantes_do_banco(
    con: psycopg.Connection, entrega_id: UUID, contrato: Contrato
) -> None:
    # A sobreposição entre peças leva minutos e roda no `planaveg-core verify`.
    resultados = verificar(con, entrega_id, contrato, geometrica=False)
    reprovadas = [f"{r.codigo}: {r.detalhe}" for r in resultados if not r.ok and not r.pulada]
    assert not reprovadas, reprovadas


@pytest.mark.usefixtures("entrega_id")  # sem entrega pronta, pula
def test_classificacao_e_a_do_contrato(con: psycopg.Connection, contrato: Contrato) -> None:
    """Peça a peça, o nível, o arranjo e os filtros de `peca_classificada` (das regras em linhas)
    são os do contrato avaliado direto, em Python, sobre o rótulo e as marcas recebidos."""
    niveis = {n.rotulo: n.codigo for n in contrato.hierarquia if n.rotulo}
    linhas = con.execute(
        """
        SELECT r.hierarquia, c.nivel, c.arranjo, c.temas,
               coalesce((SELECT array_agg(pm.marca) FROM peca_marca pm
                          WHERE pm.entrega_id = r.entrega_id AND pm.ano_vs = r.ano_vs
                            AND pm.origem_id = r.origem_id), ARRAY[]::text[])
        FROM peca_recebida r
        JOIN peca_classificada c
          ON c.entrega_id = r.entrega_id AND c.ano_vs = r.ano_vs AND c.origem_id = r.origem_id
        """
    ).fetchall()
    assert linhas
    divergentes = []
    for hierarquia, nivel, arranjo, temas, marcas in linhas:
        peca = {"nivel": niveis.get(hierarquia), "marcas": set(marcas)}
        # O primeiro arranjo cuja regra vale, senão o complementar; o ausente não pega nada.
        peca["arranjo"] = next(
            a.codigo
            for a in contrato.arranjos
            if a.complementar or (a.predicado is not None and vale(a.predicado, peca))
        )
        filtros = [f.codigo for f in contrato.filtros if vale(f.predicado, peca)]
        esperado = (peca["nivel"], peca["arranjo"], filtros)
        if (nivel, arranjo, temas) != esperado:
            divergentes.append((hierarquia, nivel, arranjo, temas, esperado))
    assert not divergentes, divergentes[:3]


def test_cada_ano_fecha_em_tres_eixos(con: psycopg.Connection) -> None:
    """Em cada ano, soma por nível = soma por arranjo = soma por UF."""
    rows = con.execute(
        """
        SELECT n.ano_vs, n.t, a.t, u.t
        FROM (SELECT ano_vs, sum(area_ha) t FROM quantitativo_nivel GROUP BY 1) n
        JOIN (SELECT ano_vs, sum(area_ha) t FROM quantitativo_arranjo
               WHERE nivel IS NULL GROUP BY 1) a USING (ano_vs)
        JOIN (SELECT ano_vs, sum(area_ha) t FROM quantitativo_dimensao
               WHERE dimensao = 'uf' AND nivel IS NULL AND arranjo IS NULL GROUP BY 1) u
          USING (ano_vs)
        """
    ).fetchall()
    assert rows
    for ano, por_nivel, por_arranjo, por_uf in rows:
        assert abs(float(por_nivel) - float(por_arranjo)) < 0.05, ano
        assert abs(float(por_nivel) - float(por_uf)) < 0.05, ano


def test_simplificada_cobre_toda_a_area(con: psycopg.Connection) -> None:
    """Toda peça tem ponto e geom_alta, que não apaga partes: a área dela é a da peça."""
    linha = con.execute(
        """
        SELECT count(*) FILTER (WHERE ponto IS NULL),
               count(*) FILTER (WHERE geom_alta IS NULL),
               sum(ST_Area(geom_alta)) / sum(ST_Area(geom))
        FROM peca_geometria
        """
    ).fetchone()
    assert linha is not None
    assert linha[0] == 0
    assert linha[1] == 0
    assert float(linha[2]) > 0.95


def test_papel_leitura_nao_le_as_pecas_recebidas(con: psycopg.Connection) -> None:
    linha = con.execute(
        "SELECT has_table_privilege('geoserver_leitura', 'peca_recebida', 'SELECT') "
        "OR has_table_privilege('geoserver_leitura', 'peca_geometria', 'SELECT'), "
        "has_table_privilege('geoserver_leitura', 'peca_2024', 'SELECT')"
    ).fetchone()
    assert linha is not None
    assert linha[0] is False
    assert linha[1] is True
