"""O modelo contra o contrato (`contracts/categorias.v1.json`): as colunas do arquivo que não são
marcas são as do modelo (`ATRIBUTOS`), e o SQL as escreve pelo nome, na tabela da peça, no pouso
da carga e nas views. As marcas são linhas: as listas delas nas saídas saem do contrato, na
ordem dele."""

from __future__ import annotations

import re

from psycopg import sql

from planaveg_core.banco import POUSO, TOLERANCIA_ALTA, insercao_das_pecas
from planaveg_core.banco.migracoes import migracoes
from planaveg_core.contrato import ATRIBUTOS, Contrato
from planaveg_core.contrato.modelo import PG
from planaveg_core.publicacao import dados_de_referencia, views
from planaveg_core.publicacao.pecas import colunas_de_peca

GEOMETRIAS = ["geom", "geom_alta", "ponto"]


def _nomes(lista: str) -> list[str]:
    """Os nomes de uma lista de colunas: o apelido, ou o nome sem a tabela e sem aspas."""
    return [
        c.strip().split(" AS ")[-1].split(".")[-1].strip('"') for c in lista.split(",") if c.strip()
    ]


def _corpos(contrato: Contrato) -> dict[str, str]:
    return {v.nome: v.corpo.as_string() for v in views(contrato)}


def _colunas_da_tabela(tabela: str) -> list[str]:
    """Os nomes das colunas do CREATE TABLE da tabela, nas migrações."""
    texto = "\n".join(m.texto for m in migracoes())
    corpo = texto.split(f"CREATE TABLE {tabela} (")[1].split("\n);")[0]
    nomes = []
    for linha in corpo.splitlines():
        palavra = linha.strip().split(" ")[0]
        if (
            palavra
            and not palavra.startswith("--")
            and palavra.isidentifier()
            and palavra.islower()
        ):
            nomes.append(palavra)
    return nomes


def test_contrato_traz_as_colunas_do_modelo(contrato: Contrato) -> None:
    """Cada coluna do modelo vem do arquivo, com o tipo dele; o resto são marcas."""
    do_arquivo = {c.destino: c for c in contrato.colunas if not c.marca}
    assert list(do_arquivo) == list(ATRIBUTOS)
    assert all(do_arquivo[d].tipo == a.tipo for d, a in ATRIBUTOS.items())


def test_tabela_da_peca_guarda_o_que_nao_tem_outro_lugar() -> None:
    """A peça guarda o rótulo do nível (o tier e a condição vêm dele), a área, os lugares pelas
    chaves deles e a Sobreposicao recebida. O cômputo, o nome do município e a região
    hidrográfica ficam nas tabelas deles."""
    assert _colunas_da_tabela("peca_recebida") == [
        "entrega_id",
        "ano_vs",
        "origem_id",
        "hierarquia",
        "area_ha",
        "uf",
        "bioma",
        "cod_municipio",
        "bacia_meso",
        "bacia",
        "sobreposicao",
    ]
    assert _colunas_da_tabela("peca_marca") == ["entrega_id", "ano_vs", "origem_id", "marca"]
    assert _colunas_da_tabela("peca_geometria") == [
        "entrega_id",
        "ano_vs",
        "origem_id",
        "geom_albers",
        *GEOMETRIAS,
        "area_calculada_ha",
        "partes",
    ]


def test_carga_tem_as_colunas_do_modelo() -> None:
    # O pouso, na ordem em que a carga copia: o fid, as do modelo, as marcas e o WKB.
    pouso = POUSO.as_string().split("(", 1)[1].rsplit(")", 1)[0]
    assert [linha.strip().rstrip(",") for linha in pouso.splitlines() if linha.strip()] == [
        "origem_id bigint",
        *(f"{destino} {PG[a.tipo]}" for destino, a in ATRIBUTOS.items()),
        "marcas text[]",
        "geom_wkb bytea",
    ]
    # Uma sentença só: a geometria lida uma vez (`lida`), a peça, as marcas e o desenho, sem a
    # geometria vazia.
    inserir = insercao_das_pecas(sql.SQL("$1"), sql.SQL("$2")).as_string()
    assert inserir.startswith("WITH lida AS (")
    assert (
        "CROSS JOIN LATERAL geom_de_origem(p.geom_wkb, 100000) AS g\n    WHERE g IS NOT NULL"
        in inserir
    )
    recebida = inserir.split("INSERT INTO peca_recebida (", 1)[1]
    colunas = _nomes(recebida.split(")", 1)[0])
    assert colunas == _colunas_da_tabela("peca_recebida")
    selecionadas = recebida.split("SELECT", 1)[1].split("FROM lida", 1)[0]
    assert _nomes(selecionadas) == ["$1", "$2", *colunas[2:]]
    assert "CROSS JOIN unnest(l.marcas) AS m(marca)" in inserir
    geometria = inserir.split("INSERT INTO peca_geometria (", 1)[1]
    assert _nomes(geometria.split(")", 1)[0]) == _colunas_da_tabela("peca_geometria")
    assert "SELECT $1, $2, origem_id, g, m.g4674," in geometria
    # A tolerância da simplificada é a do código, e ela não apaga partes.
    assert f"ST_Simplify(m.g4674, {TOLERANCIA_ALTA}, true)" in inserir
    assert "RemoveSmallParts" not in inserir


def test_views_tem_uma_coluna_por_marca(contrato: Contrato) -> None:
    fixas = [
        "hierarquia",
        "tier",
        "categoria",
        "area_ha",
        "uf",
        "bioma",
        "municipio",
        "cod_municipio",
        "bacia",
        "bacia_meso",
        "regiao_hidrografica",
    ]
    publicas = [
        "fid",
        "ano_vs",
        "origem_id",
        "nivel",
        "grupo",
        "arranjo",
        "situacao_cadastro",
        *fixas,
        *contrato.marcas(),
        "sobreposicao",
        *GEOMETRIAS,
    ]
    assert _nomes(colunas_de_peca(contrato).as_string()) == publicas


def test_classificacao_tem_as_marcas_do_contrato(contrato: Contrato) -> None:
    corpo = _corpos(contrato)["peca_classificada"]
    pares = re.findall(r"'(\w+)' = ANY \(p\.marcas\) AS \"?(\w+)\"?", corpo)
    assert [coluna for _, coluna in pares] == list(contrato.marcas())
    assert all(marca == coluna for marca, coluna in pares)


def test_lugares_sao_as_dimensoes_do_contrato(contrato: Contrato) -> None:
    """Cada dimensão do contrato uma vez, na ordem dele, com a coluna dela como chave e rótulo.
    O município tem o código como chave e o rótulo Bonito (MS); a bacia, o rótulo com a
    mesobacia como as duas coisas."""
    corpo = _corpos(contrato)["peca_lugar"]
    linhas = re.findall(r"^\s+\('(\w+)', ([\w.]+), (.+?)\),?$", corpo, flags=re.MULTILINE)
    assert [d for d, _, _ in linhas] == [d.codigo for d in contrato.dimensoes]
    esperadas = {d.codigo: (f"p.{d.codigo}", f"p.{d.codigo}") for d in contrato.dimensoes}
    esperadas["municipio"] = ("p.cod_municipio", "p.municipio || ' (' || u.sigla || ')'")
    esperadas["bacia"] = ("b.bacia", "b.bacia")
    assert {d: (chave, rotulo) for d, chave, rotulo in linhas} == esperadas


def test_marcas_levam_as_siglas_da_sobreposicao(contrato: Contrato) -> None:
    """A conferência da Sobreposicao lê as siglas de `contrato_marca`, na ordem do contrato."""
    insercao = dados_de_referencia(contrato, views(contrato))["contrato_marca"].as_string()
    siglas = re.findall(
        r"\('(\w+)', \d+, '[^']*', '[^']*', '(?:[^']|'')*', '(\w+)', (\d+),", insercao
    )
    assert [(m, s) for m, s, _ in sorted(siglas, key=lambda x: int(x[2]))] == list(
        contrato.sobreposicao
    )
