"""O aquecimento do cache: os filtros comuns como o portal os escreve, o plano e os usados."""

from __future__ import annotations

from planaveg_core.cache import aquecimento, semeadura
from planaveg_core.contrato import Contrato, cql


def test_filtros_comuns_saem_como_o_portal_os_manda(contrato: Contrato) -> None:
    filtros = aquecimento.filtros_comuns(contrato, ["MT", "PA"], ["Amazônia", "Mata Atlântica"])

    # Uma opção por lista, com aspas simples e os valores em ordem, como `cqlDosFiltros`.
    assert "nivel IN ('rl')" in filtros
    # As duas situações do cadastro, cada uma com as condições da base que ela junta.
    assert "categoria IN ('Habilitados')" in filtros
    assert "categoria IN ('Analisados', 'Nao_Analisados')" in filtros
    assert "categoria IN ('Nao_Analisados')" not in filtros
    # Os três arranjos do plano, sem as demais áreas de projetos, que o portal não oferece.
    assert "arranjo IN ('app_rl_aur')" in filtros
    assert "arranjo IN ('demais_areas')" not in filtros
    assert "uf IN ('PA')" in filtros
    assert "bioma IN ('Mata Atlântica')" in filtros
    # O tema vai com o CQL do catálogo, e todos os temas (`Filtro.tema`) entram.
    assert "(embargo = true)" in filtros
    assert {cql(f.predicado) for f in contrato.filtros if f.tema} <= set(filtros)
    # Todos os tipos menos um, em ordem: quem marca todos e tira um.
    niveis = sorted({n.codigo for n in contrato.niveis_presentes()})
    sem_rl = "nivel IN ({})".format(", ".join(f"'{n}'" for n in niveis if n != "rl"))
    assert sem_rl in filtros
    assert len(filtros) == len(set(filtros))


def test_pedido_de_semeadura_leva_o_filtro_e_o_estilo_na_chave() -> None:
    tarefa = semeadura.Semeadura(
        "peca_2024", "planaveg_arranjo", 0, 8, padrao=False, cql="uf IN ('PA')"
    )
    pedido = semeadura.pedido_de_semeadura(tarefa, 2)["seedRequest"]

    assert isinstance(pedido, dict)
    assert pedido["name"] == "planaveg:peca_2024"
    assert pedido["parameters"] == {
        "entry": [
            {"string": ["STYLES", "planaveg:planaveg_arranjo"]},
            {"string": ["CQL_FILTER", "uf IN ('PA')"]},
        ]
    }
    padrao = semeadura.pedido_de_semeadura(
        semeadura.Semeadura("peca_2024", "planaveg_nivel", 0, 8, padrao=True), 2
    )["seedRequest"]
    assert isinstance(padrao, dict)
    assert "parameters" not in padrao
