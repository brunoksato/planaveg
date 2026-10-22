"""A leitura do `categorias.v1.json`: confere cada parte e falha fechado, com um erro que diz o
quê.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from planaveg_core.contrato.modelo import (
    ATRIBUTOS,
    PG,
    Arranjo,
    Camada,
    Coluna,
    Contrato,
    Dimensao,
    Filtro,
    FonteAusente,
    Grupo,
    Nivel,
)
from planaveg_core.errors import PlanavegError

_IDENT = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
# As palavras do PostgreSQL 17 que não podem ser nome de coluna sem aspas (`pg_get_keywords()`,
# `catcode` 'R' e 'T'; as 'C' podem): os nomes de coluna entram sem aspas no DDL de
# `peca_recebida`, e uma delas quebraria o `init-db`.
_PALAVRAS_RESERVADAS = """
all analyse analyze and any array as asc asymmetric both case cast check collate column
constraint create current_catalog current_date current_role current_time current_timestamp
current_user default deferrable desc distinct do else end except false fetch for foreign from
grant group having in initially intersect into lateral leading limit localtime localtimestamp
not null offset on only or order placing primary references returning select session_user
some symmetric system_user table then to trailing true union unique user using variadic when
where window with
authorization binary collation concurrently cross current_schema freeze full ilike inner is
isnull join left like natural notnull outer overlaps right similar tablesample verbose
"""
_RESERVADAS = frozenset(_PALAVRAS_RESERVADAS.split())
# O código de um filtro espacial entra no nome da camada, `espacial_<codigo>_<ano>`, e o
# PostgreSQL corta nomes acima de 63 bytes: 63 - len("espacial_") - len("_2024") = 49.
_FILTRO_CODIGO_MAX = 49
_COR = re.compile(r"^#[0-9a-f]{6}$")
TIPOS_FILTRO = frozenset({"espacial", "quantitativo", "ambos"})
STATUS_FILTRO = frozenset({"presente", "parcial", "vazio"})
_OPERADORES = frozenset({"marca", "nivel", "arranjo", "ou", "e", "nao"})


def _chave(dado: Mapping[str, Any], chave: str) -> Any:
    """O valor de uma chave obrigatória: sem ela, um erro com código, não um `KeyError`."""
    if not isinstance(dado, Mapping) or chave not in dado:
        raise PlanavegError("contrato_campo_ausente", chave)
    return dado[chave]


def _objeto(dado: Mapping[str, Any], chave: str) -> Mapping[str, Any]:
    valor = _chave(dado, chave)
    if not isinstance(valor, Mapping):
        raise PlanavegError("contrato_campo_invalido", chave)
    return valor


def _lista(dado: Mapping[str, Any], chave: str) -> list[Mapping[str, Any]]:
    """Uma lista de objetos (camadas, colunas, níveis...)."""
    valor = _chave(dado, chave)
    if not isinstance(valor, list) or not all(isinstance(item, Mapping) for item in valor):
        raise PlanavegError("contrato_campo_invalido", chave)
    return valor


def _inteiro(dado: Mapping[str, Any], chave: str) -> int:
    valor = _chave(dado, chave)
    if isinstance(valor, bool) or not isinstance(valor, int):
        raise PlanavegError("contrato_campo_invalido", chave)
    return valor


def _texto(dado: Mapping[str, Any], chave: str) -> str:
    valor = dado.get(chave)
    if not isinstance(valor, str) or not valor.strip():
        raise PlanavegError("contrato_campo_invalido", chave)
    return valor


def _opcional(dado: Mapping[str, Any], chave: str) -> str | None:
    valor = dado.get(chave)
    if valor is None:
        return None
    if not isinstance(valor, str):
        raise PlanavegError("contrato_campo_invalido", chave)
    return valor


def _meta(dado: Mapping[str, Any]) -> tuple[float | None, int | None]:
    """A meta de um arranjo: hectares positivos e o ano, os dois ou nenhum."""
    hectares, ano = dado.get("meta_ha"), dado.get("meta_ano")
    if hectares is None and ano is None:
        return None, None
    if (
        isinstance(hectares, bool)
        or not isinstance(hectares, int | float)
        or hectares <= 0
        or isinstance(ano, bool)
        or not isinstance(ano, int)
    ):
        raise PlanavegError("contrato_campo_invalido", "meta_ha/meta_ano")
    return float(hectares), ano


def _ident(valor: str) -> str:
    if _IDENT.fullmatch(valor) is None:
        raise PlanavegError("identificador_invalido", valor)
    if valor in _RESERVADAS:
        raise PlanavegError("identificador_reservado", valor)
    return valor


def _cor(dado: Mapping[str, Any]) -> str:
    """Cor de mapa e de gráfico, `#rrggbb` em minúsculas: vira estilo SLD e legenda do portal."""
    valor = _texto(dado, "cor")
    if _COR.fullmatch(valor) is None:
        raise PlanavegError("cor_invalida", valor)
    return valor


def _coluna(dado: Mapping[str, Any]) -> Coluna:
    tipo = _texto(dado, "tipo")
    if tipo not in PG:
        raise PlanavegError("tipo_de_coluna_desconhecido", tipo)
    marcado = _opcional(dado, "marcado")
    if (tipo == "marca") != (marcado is not None):
        raise PlanavegError("marca_sem_literal", _texto(dado, "origem"))
    anulavel = dado.get("anulavel", True)
    if not isinstance(anulavel, bool):
        raise PlanavegError("contrato_campo_invalido", "anulavel")  # "false" seria verdadeiro
    fonte = _opcional(dado, "fonte")
    if fonte is not None and (fonte != "sobreposicao" or tipo != "marca"):
        raise PlanavegError("fonte_de_coluna_invalida", _texto(dado, "origem"))
    fora = _opcional(dado, "fora")
    if fora is not None and (tipo != "text" or not fora.strip()):
        raise PlanavegError("fora_em_coluna_invalida", _texto(dado, "origem"))
    return Coluna(
        origem=_texto(dado, "origem"),
        destino=_ident(_texto(dado, "destino")),
        tipo=tipo,
        # Marca ausente é `false`, nunca NULL.
        anulavel=False if tipo == "marca" else anulavel,
        descricao=_texto(dado, "descricao"),
        marcado=marcado,
        fonte=fonte,
        fora=fora,
    )


def _nivel(dado: Mapping[str, Any]) -> Nivel:
    tier = _inteiro(dado, "tier")
    rotulo = _opcional(dado, "rotulo")
    ausente = _opcional(dado, "ausente")
    if (rotulo is None) == (ausente is None):
        raise PlanavegError("nivel_sem_rotulo_nem_ausencia", str(tier))
    categoria = _opcional(dado, "categoria")
    situacao = _opcional(dado, "situacao")
    # Toda condição do CAR da base cai numa situação da planilha, e só elas têm situação.
    if (categoria is None) != (situacao is None):
        raise PlanavegError("situacao_sem_condicao_do_car", str(tier))
    return Nivel(
        tier=tier,
        codigo=_ident(_texto(dado, "codigo")),
        grupo=_texto(dado, "grupo"),
        rotulo=rotulo,
        titulo=_texto(dado, "titulo"),
        categoria=categoria,
        ausente=ausente,
        cor=_cor(dado),
        situacao=situacao,
    )


def _conferir_predicado(
    expr: object, marcas: frozenset[str], niveis: frozenset[str], arranjos: frozenset[str]
) -> None:
    """Falha fechado se a expressão citar operador, marca, nível ou arranjo desconhecido."""
    if not isinstance(expr, Mapping) or len(expr) != 1:
        raise PlanavegError("predicado_invalido", json.dumps(expr, ensure_ascii=False))
    ((operador, valor),) = expr.items()
    if operador not in _OPERADORES:
        raise PlanavegError("predicado_operador_desconhecido", str(operador))
    if operador == "nao":
        _conferir_predicado(valor, marcas, niveis, arranjos)
        return
    if not isinstance(valor, list) or not valor:
        raise PlanavegError("predicado_lista_vazia", str(operador))
    if operador in {"ou", "e"}:
        for item in valor:
            _conferir_predicado(item, marcas, niveis, arranjos)
        return
    validos = {"marca": marcas, "nivel": niveis, "arranjo": arranjos}[operador]
    desconhecidos = sorted(str(v) for v in valor if v not in validos)
    if desconhecidos:
        raise PlanavegError(f"predicado_{operador}_desconhecido", ", ".join(desconhecidos))


def _hierarquia(bruto: list[Mapping[str, Any]], grupos: tuple[Grupo, ...]) -> tuple[Nivel, ...]:
    hierarquia = tuple(_nivel(n) for n in bruto)
    codigos = {g.codigo for g in grupos}
    fora = sorted({n.grupo for n in hierarquia if n.grupo not in codigos})
    if fora:
        raise PlanavegError("nivel_com_grupo_desconhecido", ", ".join(fora))
    rotulos = [n.rotulo for n in hierarquia if n.rotulo is not None]
    if len(set(rotulos)) != len(rotulos):
        raise PlanavegError("rotulo_de_nivel_repetido")
    # Uma linha por tier e condição do CAR: é a chave de `quantitativo_nivel`.
    linhas = [(n.tier, n.categoria) for n in hierarquia]
    if len(set(linhas)) != len(linhas):
        raise PlanavegError("nivel_repetido")
    tiers = [n.tier for n in hierarquia]
    if tiers != sorted(tiers):
        raise PlanavegError("hierarquia_fora_de_ordem")
    for tier in set(tiers):
        # As condições do CAR repartem um nível: mesmo código, grupo, título e cor.
        if len({(n.codigo, n.grupo, n.titulo, n.cor) for n in hierarquia if n.tier == tier}) != 1:
            raise PlanavegError("tier_com_niveis_diferentes", str(tier))
    # E um código é de um tier só: a série (`serie`) soma os níveis pelo código, e dois tiers com
    # o mesmo código dariam duas linhas com a mesma chave (o `init-db` quebraria no índice).
    if len({n.codigo for n in hierarquia}) != len(set(tiers)):
        raise PlanavegError("codigo_de_nivel_repetido")
    # A situação do cadastro é da condição do CAR, a mesma em APP, AUR e RL
    # (`contrato_condicao_car`).
    situacoes = {(n.categoria, n.situacao) for n in hierarquia if n.categoria is not None}
    if len(situacoes) != len({c for c, _ in situacoes}):
        raise PlanavegError("condicao_do_car_com_duas_situacoes")
    return hierarquia


def _arranjo(dado: Mapping[str, Any]) -> Arranjo:
    # Os campos na ordem em que aparecem: com mais de um errado, o erro é o do primeiro.
    codigo = _ident(_texto(dado, "codigo"))
    titulo = _texto(dado, "titulo")
    criterio = _texto(dado, "criterio")
    cor = _cor(dado)
    meta_ha, meta_ano = _meta(dado)
    return Arranjo(
        codigo=codigo,
        titulo=titulo,
        criterio=criterio,
        predicado=dado.get("predicado"),  # sem ele: o complementar ou um ausente, abaixo
        cor=cor,
        meta_ha=meta_ha,
        meta_ano=meta_ano,
        ausente=_opcional(dado, "ausente"),
    )


def _arranjos(
    bruto: list[Mapping[str, Any]], marcas: frozenset[str], niveis: frozenset[str]
) -> tuple[Arranjo, ...]:
    arranjos = tuple(_arranjo(a) for a in bruto)
    # Um ausente não tem predicado e não recebe nada; só o último é complementar, e ele existe.
    if any(a.ausente is not None and a.predicado is not None for a in arranjos):
        raise PlanavegError("arranjo_ausente_com_predicado")
    if not arranjos or not arranjos[-1].complementar:
        raise PlanavegError("arranjo_complementar_deve_ser_o_ultimo")
    if any(a.predicado is None and a.ausente is None for a in arranjos[:-1]):
        raise PlanavegError("arranjo_complementar_deve_ser_o_ultimo")
    for arranjo in arranjos[:-1]:
        if arranjo.predicado is not None:
            # Arranjo não pode depender de arranjo: é ele que define a coluna.
            _conferir_predicado(arranjo.predicado, marcas, niveis, frozenset())
    return arranjos


def _filtros(
    bruto: list[Mapping[str, Any]],
    marcas: frozenset[str],
    niveis: frozenset[str],
    arranjos: frozenset[str],
) -> tuple[Filtro, ...]:
    filtros = tuple(
        Filtro(
            codigo=_ident(_texto(f, "codigo")),
            grupo=_texto(f, "grupo"),
            titulo=_texto(f, "titulo"),
            subtitulo=_opcional(f, "subtitulo"),
            tipo=_texto(f, "tipo"),
            predicado=_objeto(f, "predicado"),
            status=_texto(f, "status"),
            nota=_opcional(f, "nota"),
            cor=_cor(f),
        )
        for f in bruto
    )
    codigos = [f.codigo for f in filtros]
    if len(set(codigos)) != len(codigos):
        raise PlanavegError("filtro_repetido")
    longos = [c for c in codigos if len(c) > _FILTRO_CODIGO_MAX]
    if longos:
        raise PlanavegError("filtro_codigo_longo", ", ".join(longos))
    for filtro in filtros:
        if filtro.tipo not in TIPOS_FILTRO:
            raise PlanavegError("filtro_tipo_desconhecido", filtro.codigo)
        if filtro.status not in STATUS_FILTRO:
            raise PlanavegError("filtro_status_desconhecido", filtro.codigo)
        _conferir_predicado(filtro.predicado, marcas, niveis, arranjos)
    return filtros


def _dimensoes(bruto: list[Mapping[str, Any]]) -> tuple[Dimensao, ...]:
    dimensoes = tuple(
        Dimensao(
            codigo=_ident(_texto(d, "codigo")),
            grupo=_texto(d, "grupo"),
            titulo=_texto(d, "titulo"),
        )
        for d in bruto
    )
    codigos = [d.codigo for d in dimensoes]
    if len(set(codigos)) != len(codigos):
        raise PlanavegError("dimensao_repetida")
    # A `serie` junta os recortes numa coluna só, com estes nomes ao lado dos das dimensões.
    reservados = sorted(set(codigos) & {"total", "nivel", "arranjo", "filtro"})
    if reservados:
        raise PlanavegError("dimensao_com_nome_de_recorte", ", ".join(reservados))
    return dimensoes


def _grupos(bruto: list[Mapping[str, Any]]) -> tuple[Grupo, ...]:
    grupos = tuple(Grupo(_ident(_texto(g, "codigo")), _texto(g, "titulo")) for g in bruto)
    if len({g.codigo for g in grupos}) != len(grupos):
        raise PlanavegError("grupo_repetido")
    return grupos


def _fontes_ausentes(bruto: list[Mapping[str, Any]]) -> tuple[FonteAusente, ...]:
    return tuple(
        FonteAusente(_ident(_texto(f, "codigo")), _texto(f, "grupo"), _texto(f, "descricao"))
        for f in bruto
    )


def _colunas(bruto: list[Mapping[str, Any]]) -> tuple[Coluna, ...]:
    """As colunas do arquivo: as do modelo (`ATRIBUTOS`), cada uma com o tipo e a
    obrigatoriedade dele, e as marcas. Uma coluna que não é marca nem do modelo não tem onde
    ficar no banco: o contrato não carrega, e o modelo tem de mudar antes."""
    colunas = tuple(_coluna(c) for c in bruto)
    destinos = [c.destino for c in colunas]
    if len(set(destinos)) != len(destinos):
        raise PlanavegError("coluna_destino_repetida")
    origens = [c.origem for c in colunas]
    if len(set(origens)) != len(origens):
        raise PlanavegError("coluna_origem_repetida")
    for destino in ATRIBUTOS:
        if destino not in destinos:
            raise PlanavegError("coluna_obrigatoria_ausente", destino)
    for coluna in colunas:
        if not coluna.marca:
            _conferir_atributo(coluna)
    return colunas


def _conferir_atributo(coluna: Coluna) -> None:
    """Uma coluna que não é marca tem de ser do modelo, com o tipo e a obrigatoriedade dele."""
    atributo = ATRIBUTOS.get(coluna.destino)
    if atributo is None:
        raise PlanavegError("coluna_sem_lugar_no_modelo", coluna.destino)
    if coluna.tipo != atributo.tipo:
        raise PlanavegError("coluna_com_tipo_do_modelo_diferente", coluna.destino)
    if atributo.obrigatorio and coluna.anulavel:
        raise PlanavegError("coluna_obrigatoria_no_modelo", coluna.destino)
    if coluna.fora is not None and not atributo.aceita_fora:
        raise PlanavegError("fora_em_coluna_invalida", coluna.destino)


def _sobreposicao(
    bruto: list[Mapping[str, Any]], colunas: tuple[Coluna, ...]
) -> tuple[tuple[str, str], ...]:
    """(marca, sigla), na ordem em que a Sobreposicao as junta. A marca lida dela (`fonte`) é
    achada pela sigla dentro do texto: nenhuma outra sigla pode contê-la, nem estar contida
    nela."""
    marcas = frozenset(c.destino for c in colunas if c.marca)
    sobreposicao = tuple((_texto(s, "marca"), _texto(s, "sigla")) for s in bruto)
    fora = sorted(m for m, _ in sobreposicao if m not in marcas)
    if fora:
        raise PlanavegError("sobreposicao_cita_marca_desconhecida", ", ".join(fora))
    if len({m for m, _ in sobreposicao}) != len(sobreposicao):
        raise PlanavegError("sobreposicao_com_marca_repetida")
    siglas = dict(sobreposicao)
    for coluna in colunas:
        if coluna.fonte != "sobreposicao":
            continue
        sigla = siglas.get(coluna.destino)
        if sigla is None:
            raise PlanavegError("marca_da_sobreposicao_sem_sigla", coluna.destino)
        ambiguas = sorted(s for s in siglas.values() if s != sigla and (sigla in s or s in sigla))
        if ambiguas:
            raise PlanavegError("sigla_ambigua_na_sobreposicao", f"{sigla}: {', '.join(ambiguas)}")
    return sobreposicao


def carregar_contrato(caminho: Path) -> Contrato:
    try:
        bruto = json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PlanavegError("contrato_nao_encontrado", str(caminho)) from exc
    except json.JSONDecodeError as exc:
        raise PlanavegError("contrato_json_invalido", str(caminho)) from exc

    if not isinstance(bruto, Mapping):
        raise PlanavegError("contrato_json_invalido", str(caminho))
    recipiente = _objeto(bruto, "recipiente")
    sha256 = _opcional(recipiente, "sha256")
    if sha256 is not None and _SHA256.fullmatch(sha256) is None:
        raise PlanavegError("contrato_campo_invalido", "sha256")
    user_versions = _chave(recipiente, "user_versions")
    if not isinstance(user_versions, list) or not all(
        isinstance(v, int) and not isinstance(v, bool) for v in user_versions
    ):
        raise PlanavegError("contrato_campo_invalido", "user_versions")
    camadas = tuple(
        Camada(origem=_texto(c, "origem"), ano_vs=_inteiro(c, "ano_vs"), rotulo=_texto(c, "rotulo"))
        for c in _lista(bruto, "camadas")
    )
    anos = [c.ano_vs for c in camadas]
    if not camadas or len(set(anos)) != len(anos):
        raise PlanavegError("camadas_com_ano_repetido", str(anos))

    colunas = _colunas(_lista(bruto, "colunas"))
    marcas = frozenset(c.destino for c in colunas if c.marca)
    sobreposicao = _sobreposicao(_lista(bruto, "sobreposicao"), colunas)

    grupos = _grupos(_lista(bruto, "grupos"))
    hierarquia = _hierarquia(_lista(bruto, "hierarquia"), grupos)
    niveis = frozenset(n.codigo for n in hierarquia)
    arranjos = _arranjos(_lista(bruto, "arranjos"), marcas, niveis)
    filtros = _filtros(
        _lista(bruto, "filtros"), marcas, niveis, frozenset(a.codigo for a in arranjos)
    )

    return Contrato(
        schema_version=_texto(bruto, "schema_version"),
        application_id=_inteiro(recipiente, "application_id"),
        user_versions=tuple(user_versions),
        sha256=sha256,
        srid=_inteiro(recipiente, "srid"),
        tipo_srs=_texto(recipiente, "tipo_srs"),
        proj4=_texto(recipiente, "proj4"),
        coluna_geom=_texto(recipiente, "coluna_geom"),
        coluna_pk=_texto(recipiente, "coluna_pk"),
        camadas=camadas,
        colunas=colunas,
        sobreposicao=sobreposicao,
        hierarquia=hierarquia,
        arranjos=arranjos,
        filtros=filtros,
        dimensoes=_dimensoes(_lista(bruto, "dimensoes")),
        bruto=bruto,
        arquivo_referencia=_texto(recipiente, "arquivo_referencia"),
        geometria=_texto(recipiente, "geometria"),
        grupos=grupos,
        fontes_ausentes=_fontes_ausentes(_lista(bruto, "fontes_ausentes")),
    )
