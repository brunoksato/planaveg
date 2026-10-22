"""O contrato do laboratório: estrutura do GeoPackage, hierarquia, filtros e arranjos."""

from __future__ import annotations

import copy
import json
import random
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import pytest
from regras import vale

from planaveg_core.contrato import Contrato, alternativas, carregar_contrato, cql
from planaveg_core.contrato.predicados import Condicao
from planaveg_core.errors import PlanavegError


def _bruto(caminho: Path) -> dict[str, Any]:
    dado: dict[str, Any] = json.loads(caminho.read_text(encoding="utf-8"))
    return dado


def _gravar(tmp_path: Path, dado: dict[str, Any]) -> Path:
    caminho = tmp_path / "contrato.json"
    caminho.write_text(json.dumps(dado), encoding="utf-8")
    return caminho


def test_predicado_vira_alternativas_de_condicoes() -> None:
    """O `ou` junta alternativas, o `e` as combina, e o `nao` desce até a condição."""
    expr = {
        "ou": [
            {"marca": ["uc", "apa"]},
            {"e": [{"nivel": ["uc"]}, {"nao": {"ou": [{"arranjo": ["x"]}, {"marca": ["rppn"]}]}}]},
        ]
    }
    assert alternativas(expr) == [
        [Condicao("marca", ("uc", "apa"))],
        [
            Condicao("nivel", ("uc",)),
            Condicao("arranjo", ("x",), negada=True),
            Condicao("marca", ("rppn",), negada=True),
        ],
    ]
    # Negado, o `e` vira `ou`: duas alternativas.
    assert alternativas({"nao": {"e": [{"nivel": ["a"]}, {"marca": ["b"]}]}}) == [
        [Condicao("nivel", ("a",), negada=True)],
        [Condicao("marca", ("b",), negada=True)],
    ]


def _vale_alternativas(expr: Mapping[str, Any], peca: dict[str, Any]) -> bool:
    """As alternativas avaliadas como `peca_classificada` as avalia (`condicao_atendida`)."""

    def atende(c: Condicao) -> bool:
        if c.campo == "marca":
            return bool(set(c.valores) & peca["marcas"]) != c.negada
        return (peca[c.campo] in c.valores) != c.negada

    return any(all(atende(c) for c in alternativa) for alternativa in alternativas(expr))


def test_alternativas_valem_o_mesmo_que_o_predicado(contrato: Contrato) -> None:
    """Para toda regra do contrato e mais algumas com `nao` e `e` aninhados, em peças sorteadas
    com as marcas, os níveis e os arranjos do contrato."""
    marcas = list(contrato.marcas())
    niveis = [n.codigo for n in contrato.hierarquia]
    arranjos = [a.codigo for a in contrato.arranjos]
    regras = [f.predicado for f in contrato.filtros]
    regras += [a.predicado for a in contrato.arranjos if a.predicado]
    regras += [
        {"nao": {"e": [{"ou": [{"marca": marcas[:2]}, {"nivel": niveis[:3]}]}, {"marca": ["uc"]}]}},
        {
            "e": [
                {"ou": [{"marca": ["uc"]}, {"nivel": ["uc"]}]},
                {"nao": {"nao": {"marca": ["apa"]}}},
            ]
        },
        {"ou": [{"e": [{"nao": {"arranjo": arranjos[:1]}}, {"marca": marcas[5:9]}]}]},
    ]
    sorteio = random.Random(20261011)  # noqa: S311 (sorteio de teste, não segredo)
    for _ in range(3000):
        peca = {
            "marcas": set(sorteio.sample(marcas, sorteio.randint(0, 4))),
            "nivel": sorteio.choice(niveis),
            "arranjo": sorteio.choice(arranjos),
        }
        for regra in regras:
            assert vale(regra, peca) == _vale_alternativas(regra, peca), (regra, peca)


def test_predicado_vira_cql_sobre_as_colunas_publicadas() -> None:
    expr = {"ou": [{"marca": ["uc", "apa"]}, {"nivel": ["uc"]}, {"nao": {"arranjo": ["x'y"]}}]}
    assert (
        cql(expr) == "((uc = true OR apa = true) OR nivel IN ('uc') OR (NOT arranjo IN ('x''y')))"
    )


def test_cql_de_todo_filtro_so_cita_colunas_das_pecas(contrato: Contrato) -> None:
    colunas = {c.destino for c in contrato.colunas} | {"nivel", "arranjo"}
    for filtro in contrato.filtros:
        texto = cql(filtro.predicado)
        sem_literais = re.sub(r"'(?:[^']|'')*'", "", texto)
        nomes = set(re.findall(r"[a-z_]+", sem_literais)) - {"true"}
        assert nomes <= colunas, (filtro.codigo, nomes - colunas)


@pytest.mark.parametrize(
    ("mutacao", "codigo"),
    [
        (
            lambda d: d["filtros"][0].update(predicado={"marca": ["inexistente"]}),
            "predicado_marca_desconhecido",
        ),
        (
            lambda d: d["filtros"][0].update(predicado={"nivel": ["inexistente"]}),
            "predicado_nivel_desconhecido",
        ),
        (
            lambda d: d["filtros"][0].update(predicado={"talvez": ["uc"]}),
            "predicado_operador_desconhecido",
        ),
        (lambda d: d["filtros"][0].update(predicado={"ou": []}), "predicado_lista_vazia"),
        (lambda d: d["filtros"][0].update(tipo="mapa"), "filtro_tipo_desconhecido"),
        (lambda d: d["filtros"].append(copy.deepcopy(d["filtros"][0])), "filtro_repetido"),
        (lambda d: d["arranjos"].reverse(), "arranjo_complementar_deve_ser_o_ultimo"),
        (lambda d: d["arranjos"].pop(), "arranjo_complementar_deve_ser_o_ultimo"),
        (lambda d: d["arranjos"][2].pop("ausente"), "arranjo_complementar_deve_ser_o_ultimo"),
        (
            lambda d: d["arranjos"][2].update(predicado={"nivel": ["uc"]}),
            "arranjo_ausente_com_predicado",
        ),
        (
            lambda d: d["arranjos"][0].update(predicado={"arranjo": ["app_rl_aur"]}),
            "predicado_arranjo_desconhecido",
        ),
        (lambda d: d["camadas"][1].update(ano_vs=2022), "camadas_com_ano_repetido"),
        (lambda d: d["colunas"][-1].update(tipo="data"), "tipo_de_coluna_desconhecido"),
        (lambda d: d["colunas"][12].pop("marcado"), "marca_sem_literal"),
        (lambda d: d["hierarquia"].reverse(), "hierarquia_fora_de_ordem"),
        (lambda d: d["hierarquia"][1].update(ausente=None), "nivel_sem_rotulo_nem_ausencia"),
        (lambda d: d["dimensoes"].append(copy.deepcopy(d["dimensoes"][0])), "dimensao_repetida"),
        (lambda d: d["dimensoes"][0].update(codigo="nivel"), "dimensao_com_nome_de_recorte"),
        (
            lambda d: d["sobreposicao"][0].update(marca="xyz"),
            "sobreposicao_cita_marca_desconhecida",
        ),
        (lambda d: d["colunas"][0].update(fonte="sobreposicao"), "fonte_de_coluna_invalida"),
        (lambda d: d["colunas"][12].update(fonte="outra"), "fonte_de_coluna_invalida"),
        (lambda d: d["sobreposicao"].pop(4), "marca_da_sobreposicao_sem_sigla"),
        (lambda d: d.pop("grupos"), "contrato_campo_ausente"),
        (lambda d: d["recipiente"].pop("srid"), "contrato_campo_ausente"),
        (lambda d: d["camadas"][0].pop("ano_vs"), "contrato_campo_ausente"),
        (lambda d: d["filtros"][0].pop("predicado"), "contrato_campo_ausente"),
        (lambda d: d["recipiente"].update(sha256="abc"), "contrato_campo_invalido"),
        (lambda d: d["colunas"][-1].update(destino="order"), "identificador_reservado"),
        (lambda d: d["colunas"][-1].update(destino="left"), "identificador_reservado"),
        (lambda d: d["colunas"][0].update(anulavel="false"), "contrato_campo_invalido"),
        (lambda d: d["filtros"][0].update(codigo="x" * 50), "filtro_codigo_longo"),
        (lambda d: d["hierarquia"][0].update(grupo="outro"), "nivel_com_grupo_desconhecido"),
        (lambda d: d["hierarquia"][16].update(categoria="Analisados"), "nivel_repetido"),
        (lambda d: d["hierarquia"][16].pop("situacao"), "situacao_sem_condicao_do_car"),
        (lambda d: d["hierarquia"][0].update(situacao="Analisado"), "situacao_sem_condicao_do_car"),
        (lambda d: d["hierarquia"][7].update(codigo="uc"), "codigo_de_nivel_repetido"),
        (lambda d: d["hierarquia"][0].update(cor="verde"), "cor_invalida"),
    ],
)
def test_contrato_invalido_falha_fechado(
    tmp_path: Path, caminho_contrato: Path, mutacao: Any, codigo: str
) -> None:
    dado = _bruto(caminho_contrato)
    mutacao(dado)
    with pytest.raises(PlanavegError) as info:
        carregar_contrato(_gravar(tmp_path, dado))
    assert info.value.codigo == codigo


def test_contrato_inexistente(tmp_path: Path) -> None:
    with pytest.raises(PlanavegError) as info:
        carregar_contrato(tmp_path / "nada.json")
    assert info.value.codigo == "contrato_nao_encontrado"


def test_impressao_da_carga_so_muda_com_o_que_a_carga_le(
    tmp_path: Path, caminho_contrato: Path, contrato: Contrato
) -> None:
    impressao = contrato.impressao_da_carga()
    cores = _bruto(caminho_contrato)
    cores["hierarquia"][0]["cor"] = "#000000"
    cores["arranjos"][0]["titulo"] = "Outro título"
    cores["camadas"][0]["rotulo"] = "VS de 2022"  # os textos viram títulos e comentários
    cores["colunas"][0]["descricao"] = "Outra descrição."
    assert carregar_contrato(_gravar(tmp_path, cores)).impressao_da_carga() == impressao
    camada = _bruto(caminho_contrato)
    camada["camadas"][0]["origem"] = "outra_camada"
    assert carregar_contrato(_gravar(tmp_path, camada)).impressao_da_carga() != impressao
