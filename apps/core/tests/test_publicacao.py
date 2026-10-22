"""As views geradas do contrato: inventário, títulos, dependências e o que é publicado."""

from __future__ import annotations

import re
from importlib.resources import files

from planaveg_core.contrato import Contrato
from planaveg_core.estilos import ESTILO_ARRANJO, ESTILO_MUNICIPIO, ESTILO_NIVEL, estilos
from planaveg_core.geoserver import desenho_do_mapa, obsoletos
from planaveg_core.geoserver.recursos import CAIXA_BRASIL, _feature_type
from planaveg_core.geoserver.versoes import _estilos_sem_cache, lidos
from planaveg_core.publicacao import (
    TABELAS_DE_REFERENCIA,
    views,
)

# As tabelas das regras e dos lugares que a classificação lê: as versões dos tiles as levam.
DA_CLASSIFICACAO = {
    "contrato_marca",
    "contrato_hierarquia",
    "contrato_nivel",
    "contrato_condicao_car",
    "lugar_municipio",
    "contrato_arranjo",
    "contrato_arranjo_condicao",
    "contrato_arranjo_valor",
    "contrato_filtro",
    "contrato_filtro_condicao",
    "contrato_filtro_valor",
}


def _scripts() -> dict[str, str]:
    """Os scripts fixos e as migrações, pelo nome."""
    pasta = files("planaveg_core") / "sql"
    return {
        **{
            p.name: p.read_text(encoding="utf-8")
            for p in pasta.iterdir()
            if p.name.endswith(".sql")
        },
        **{p.name: p.read_text(encoding="utf-8") for p in (pasta / "migracoes").iterdir()},
    }


def _corpos(contrato: Contrato) -> dict[str, str]:
    return {v.nome: v.corpo.as_string() for v in views(contrato)}


def test_nomes_unicos_e_cabem_no_postgres(contrato: Contrato) -> None:
    nomes = [v.nome for v in views(contrato)]
    assert len(nomes) == len(set(nomes))
    assert all(len(nome) <= 63 for nome in nomes)
    assert "peca_recebida" not in nomes
    assert not set(nomes) & set(TABELAS_DE_REFERENCIA)


def test_cada_view_so_depende_das_anteriores(contrato: Contrato) -> None:
    lista = views(contrato)
    geradas = {v.nome for v in lista}
    criadas: set[str] = {"peca_recebida", "peca_geometria", "entrega", "execucao"}
    for view in lista:
        texto = view.corpo.as_string(None)
        lidas = set(re.findall(r'(?:FROM|JOIN)\s+"?([a-z_0-9]+)"?', texto)) & geradas
        assert lidas - {view.nome} <= criadas, (view.nome, sorted(lidas - criadas))
        criadas.add(view.nome)


def test_lugares_classificacoes_e_estado_ficam_fora_da_publicacao(contrato: Contrato) -> None:
    privadas = [v.nome for v in views(contrato) if not v.publicada]
    assert privadas == [
        "peca_classificada",
        "peca_desenhada",
        "peca_lugar",
    ]


def test_geoserver_remove_so_as_camadas_sem_view() -> None:
    publicados = ["espacial_embargo", "espacial_car_2024", "peca"]
    views_atuais = ["espacial_car_2024", "espacial_embargo_pangia_2024", "peca"]
    assert obsoletos(publicados, views_atuais) == ["espacial_embargo"]


def test_versao_do_mapa_le_so_o_que_desenha_os_tiles(contrato: Contrato) -> None:
    lista = views(contrato)
    slds = estilos(contrato)
    do_mapa, estilos_do_mapa = desenho_do_mapa(lista, slds)
    classificacao = {"peca_classificada", "peca_desenhada", *DA_CLASSIFICACAO}

    # A versão do mapa lê as camadas, `peca`, a classificação e as tabelas das regras; nada dos
    # quantitativos nem dos catálogos.
    assert set(do_mapa) == {
        "peca",
        "peca_2022",
        "peca_2024",
        *(v.nome for v in lista if v.nome.startswith("espacial_")),
        *classificacao,
    }
    # O contorno do município não tem cache: mudá-lo não esvazia o das peças.
    assert set(estilos_do_mapa) == set(slds) - {ESTILO_MUNICIPIO}
    # Os estilos das camadas sem cache (o contorno e a camada de todos os anos, do QGIS) vão com
    # a versão dos dados, a do WMS sem cache; os de filtro, não.
    assert set(_estilos_sem_cache(lista, slds)) == {ESTILO_MUNICIPIO, ESTILO_NIVEL, ESTILO_ARRANJO}


def test_versao_dos_dados_le_tudo(contrato: Contrato) -> None:
    lista = views(contrato)
    assert set(lidos(lista, lista)) == {v.nome for v in lista} | set(TABELAS_DE_REFERENCIA)


def test_partes_vao_ao_geoserver_com_parametros_obrigatorios(contrato: Contrato) -> None:
    lista = views(contrato)
    partes = next(v for v in lista if v.nome == "peca_parte")
    [entrada] = _feature_type(partes, CAIXA_BRASIL)["featureType"]["metadata"]["entry"]
    tabela = entrada["virtualTable"]

    assert entrada["@key"] == "JDBC_VIRTUAL_TABLE"
    assert tabela["sql"] == (
        "SELECT * FROM peca_parte WHERE ano_vs = %ano_vs% AND origem_id = %origem_id%"
    )
    assert tabela["keyColumn"] == "fid"
    assert tabela["geometry"] == {"name": "geom", "type": "Polygon", "srid": 4674}
    # Sem o parâmetro, 0, que nenhuma peça tem; com ele, só algarismos.
    assert [(p["name"], p["defaultValue"]) for p in tabela["parameter"]] == [
        ("ano_vs", "0"),
        ("origem_id", "0"),
    ]
    for parametro in tabela["parameter"]:
        assert re.fullmatch(parametro["regexpValidator"], "14537")
        assert not re.fullmatch(parametro["regexpValidator"], "1 OR 1=1")
    # As camadas de mapa seguem como views comuns.
    peca = next(v for v in lista if v.nome == "peca_2024")
    assert "metadata" not in _feature_type(peca, CAIXA_BRASIL)["featureType"]


def test_toda_materializada_tem_chave_e_recalcula_sem_bloquear(contrato: Contrato) -> None:
    for view in views(contrato):
        if not view.materializada:
            assert not view.chave, view.nome
            continue
        assert view.chave, view.nome
        criar = " ".join(c.as_string() for c in view.criar())
        # Nasce vazia: o init-db a calcula depois dos dados de referência, na ordem.
        assert criar.startswith(f'CREATE MATERIALIZED VIEW "{view.nome}" AS'), view.nome
        assert view.criar()[0].as_string().endswith("WITH NO DATA"), view.nome
        assert f'CREATE UNIQUE INDEX "{view.nome}_chave"' in criar, view.nome
        assert "NULLS NOT DISTINCT" in criar, view.nome
        assert view.preencher().as_string() == f'REFRESH MATERIALIZED VIEW "{view.nome}"'
        assert view.atualizar().as_string().startswith("REFRESH MATERIALIZED VIEW CONCURRENTLY")
        # Toda coluna da chave sai na view.
        corpo = view.corpo.as_string()
        for coluna in view.chave:
            assert re.search(rf"\b{coluna}\b", corpo), (view.nome, coluna)


def test_detalhe_sem_nivel_nao_repete_a_linha_do_total(contrato: Contrato) -> None:
    corpos = _corpos(contrato)
    for nome in ("quantitativo_arranjo", "quantitativo_filtro"):
        assert "HAVING NOT (GROUPING(f.nivel) = 0 AND f.nivel IS NULL)" in corpos[nome], nome
    dimensao = corpos["quantitativo_dimensao"]
    assert "NOT (GROUPING(nivel) = 0 AND nivel IS NULL)" in dimensao
    assert "NOT (GROUPING(arranjo) = 0 AND arranjo IS NULL)" in dimensao


def test_quantitativos_somam_as_facetas(contrato: Contrato) -> None:
    """O por arranjo, o por filtro e o por lugar somam as facetas, e os anos vêm do contrato. O
    por nível lê as peças: o cômputo e a área calculada não estão nas facetas."""
    corpos = _corpos(contrato)
    assert "LEFT JOIN quantitativo_faceta f ON" in corpos["quantitativo_arranjo"]
    assert "FROM quantitativo_faceta q" in corpos["quantitativo_filtro"]
    assert "unnest(string_to_array(q.temas, ','))" in corpos["quantitativo_filtro"]
    assert "FROM quantitativo_faceta_lugar\n" in corpos["quantitativo_dimensao"]
    assert "LEFT JOIN peca_classificada p ON" in corpos["quantitativo_nivel"]
    # O por categoria soma o por nível como a planilha de nomenclatura: a situação do cadastro
    # no lugar das condições da base, que ficam de fora.
    categoria = corpos["quantitativo_categoria"]
    assert "FROM quantitativo_nivel q" in categoria
    assert "q.situacao_cadastro" in categoria
    assert "q.categoria" not in categoria
    assert "q.hierarquia" not in categoria
    for nome in ("quantitativo_nivel", "quantitativo_arranjo", "quantitativo_filtro"):
        assert "FROM contrato_ano a" in corpos[nome], nome
        assert "UNION" not in corpos[nome], nome
