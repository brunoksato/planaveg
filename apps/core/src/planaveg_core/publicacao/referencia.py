"""As regras e os lugares de referência em linhas: o contrato vigente nas tabelas `contrato_*` e
`camada_publicada`, e os municípios do IBGE em `lugar_municipio`.

O `init-db` acerta essas tabelas no lugar, sem apagar o que a carga usa:

- `REFEITAS`: nada da carga aponta para elas. Saem inteiras e entram de novo.
- `MANTIDAS`: as peças, as marcas ou o cômputo apontam para elas. Cada linha é
  atualizada pela chave natural, e a que saiu do contrato (ou do arquivo do IBGE) só sai da tabela
  se nada a usa. O rótulo de uma linha da hierarquia muda pela linha (tier e condição do CAR), e as
  peças vão junto.

Aqui só se monta o SQL. Quem o executa, na ordem, é o `banco` (`regras.py`); a `modelagem` o
escreve em `4_dados.sql`, e as versões levam o de cada tabela que as views leem.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from importlib.resources import files
from typing import Any

from psycopg import sql

from planaveg_core.contrato import Contrato, Nivel, alternativas, cql
from planaveg_core.errors import PlanavegError
from planaveg_core.publicacao.camadas import camadas_publicadas
from planaveg_core.publicacao.nomes import View


@dataclass(frozen=True)
class Tabela:
    nome: str
    colunas: tuple[str, ...]
    chave: tuple[str, ...]
    """A chave natural. Nas mantidas, a linha que já existe com ela é atualizada."""
    restricao: str | None = None
    """A restrição única que acha a linha, quando a chave não é a primária."""
    identifica: str | None = None
    """A coluna pela qual uma linha que saiu do contrato é apagada; sem ela, a da chave."""


MANTIDAS = (
    Tabela("contrato_grupo", ("grupo", "titulo"), ("grupo",)),
    Tabela(
        "contrato_nivel",
        ("tier", "nivel", "grupo", "titulo", "cor", "motivo_ausencia"),
        ("tier",),
    ),
    Tabela("contrato_condicao_car", ("categoria", "ordem", "situacao"), ("categoria",)),
    Tabela(
        "contrato_hierarquia",
        ("hierarquia", "tier", "categoria"),
        ("tier", "categoria"),
        restricao="contrato_hierarquia_linha",
        identifica="hierarquia",
    ),
    Tabela(
        "contrato_marca",
        ("marca", "ordem", "coluna", "valor", "descricao", "sigla", "ordem_sigla", "fonte"),
        ("marca",),
    ),
    Tabela("lugar_municipio", ("codigo", "nome", "uf"), ("codigo",)),
)
"""Na ordem de gravar: cada uma só aponta para as anteriores."""

REFEITAS = (
    Tabela("contrato_ano", ("ano_vs", "camada", "rotulo"), ("ano_vs",)),
    Tabela(
        "contrato_arranjo",
        (
            "arranjo",
            "prioridade",
            "titulo",
            "criterio",
            "cor",
            "meta_ha",
            "meta_ano",
            "complementar",
            "motivo_ausencia",
        ),
        ("arranjo",),
    ),
    Tabela(
        "contrato_arranjo_condicao",
        ("arranjo", "alternativa", "condicao", "campo", "negada"),
        ("arranjo", "alternativa", "condicao"),
    ),
    Tabela(
        "contrato_arranjo_valor",
        ("arranjo", "alternativa", "condicao", "campo", "valor"),
        ("arranjo", "alternativa", "condicao", "valor"),
    ),
    Tabela(
        "contrato_filtro",
        (
            "filtro",
            "ordem",
            "grupo",
            "titulo",
            "subtitulo",
            "tipo",
            "status",
            "nota",
            "cor",
            "cql",
            "tema",
        ),
        ("filtro",),
    ),
    Tabela(
        "contrato_filtro_condicao",
        ("filtro", "alternativa", "condicao", "campo", "negada"),
        ("filtro", "alternativa", "condicao"),
    ),
    Tabela(
        "contrato_filtro_valor",
        ("filtro", "alternativa", "condicao", "campo", "valor"),
        ("filtro", "alternativa", "condicao", "valor"),
    ),
    Tabela("contrato_dimensao", ("dimensao", "ordem", "grupo", "titulo"), ("dimensao",)),
    Tabela("contrato_fonte_ausente", ("codigo", "ordem", "grupo", "descricao"), ("codigo",)),
    Tabela(
        "camada_publicada",
        (
            "camada",
            "ordem",
            "tipo",
            "filtro",
            "ano_vs",
            "titulo",
            "estilo",
            "estilos_alternativos",
        ),
        ("camada",),
    ),
)
"""Na ordem de gravar: cada uma só aponta para as anteriores e para as mantidas."""

TABELAS_DE_REFERENCIA = (
    *(t.nome for t in MANTIDAS),
    *(t.nome for t in REFEITAS),
    "lugar_uf",
)
"""As tabelas que as views leem além das peças: as versões levam o conteúdo delas."""

ARQUIVO_MUNICIPIOS = "municipios.csv"
"""Os municípios da API de localidades do IBGE
(`servicodados.ibge.gov.br/api/v1/localidades/municipios`): código, nome e código da UF. Para
atualizar, troque o arquivo e rode `init-db` e `geoserver`."""
_DIGITOS_DO_CODIGO = 7


def municipios() -> list[tuple[str, str, str]]:
    """(código, nome, código da UF) de cada município do arquivo do pacote, conferidos."""
    texto = files("planaveg_core").joinpath("referencia", ARQUIVO_MUNICIPIOS).read_text("utf-8")
    linhas = []
    for linha in csv.DictReader(io.StringIO(texto)):
        codigo, nome, uf = linha["codigo"], linha["nome"].strip(), linha["uf"]
        if (
            len(codigo) != _DIGITOS_DO_CODIGO
            or not codigo.isdigit()
            or codigo[:2] != uf
            or not nome
        ):
            raise PlanavegError("municipio_ibge_invalido", codigo)
        linhas.append((codigo, nome, uf))
    if len({c for c, _, _ in linhas}) != len(linhas):
        raise PlanavegError("municipio_ibge_repetido")
    return linhas


def _linhas_das_mantidas(contrato: Contrato) -> dict[str, list[tuple[object, ...]]]:
    c = contrato
    # Uma linha por tier, a do primeiro nível dele: os níveis do CAR têm uma linha por condição,
    # e o `ausente`, que o contrato não confere entre elas, é o da primeira.
    niveis: dict[int, Nivel] = {}
    for n in c.hierarquia:
        niveis.setdefault(n.tier, n)
    condicoes: dict[str, str] = {}
    for n in c.hierarquia:
        if n.categoria is not None and n.situacao is not None:
            condicoes.setdefault(n.categoria, n.situacao)
    sigla_da_marca = dict(c.sobreposicao)
    ordem_da_sigla = {marca: i for i, (marca, _) in enumerate(c.sobreposicao, 1)}
    marcas = [col for col in c.colunas if col.marca]
    return {
        "contrato_grupo": [(g.codigo, g.titulo) for g in c.grupos],
        "contrato_nivel": [
            (n.tier, n.codigo, n.grupo, n.titulo, n.cor, n.ausente)
            for n in sorted(niveis.values(), key=lambda n: n.tier)
        ],
        "contrato_condicao_car": [
            (categoria, i, situacao) for i, (categoria, situacao) in enumerate(condicoes.items(), 1)
        ],
        "contrato_hierarquia": [
            (n.rotulo, n.tier, n.categoria) for n in c.hierarquia if n.rotulo is not None
        ],
        "contrato_marca": [
            (
                col.destino,
                i,
                col.origem,
                col.marcado,
                col.descricao,
                sigla_da_marca.get(col.destino),
                ordem_da_sigla.get(col.destino),
                col.fonte,
            )
            for i, col in enumerate(marcas, 1)
        ],
        "lugar_municipio": list(municipios()),
    }


def _linhas_das_refeitas(
    contrato: Contrato, geradas: list[View]
) -> dict[str, list[tuple[object, ...]]]:
    c = contrato
    arranjos = [(a.codigo, a.predicado) for a in c.arranjos if a.predicado]
    filtros = [(f.codigo, f.predicado) for f in c.filtros]
    return {
        "contrato_ano": [(a.ano_vs, a.origem, a.rotulo) for a in c.camadas],
        "contrato_arranjo": [
            (
                a.codigo,
                i,
                a.titulo,
                a.criterio,
                a.cor,
                a.meta_ha,
                a.meta_ano,
                a.complementar,
                a.ausente,
            )
            for i, a in enumerate(c.arranjos, 1)
        ],
        "contrato_arranjo_condicao": _condicoes(arranjos),
        "contrato_arranjo_valor": _valores(arranjos),
        "contrato_filtro": [
            (
                f.codigo,
                i,
                f.grupo,
                f.titulo,
                f.subtitulo,
                f.tipo,
                f.status,
                f.nota,
                f.cor,
                cql(f.predicado),
                f.tema,
            )
            for i, f in enumerate(c.filtros, 1)
        ],
        "contrato_filtro_condicao": _condicoes(filtros),
        "contrato_filtro_valor": _valores(filtros),
        "contrato_dimensao": [
            (d.codigo, i, d.grupo, d.titulo) for i, d in enumerate(c.dimensoes, 1)
        ],
        "contrato_fonte_ausente": [
            (f.codigo, i, f.grupo, f.descricao) for i, f in enumerate(c.fontes_ausentes, 1)
        ],
        "camada_publicada": camadas_publicadas(c, geradas),
    }


def _condicoes(regras: Iterable[tuple[str, Mapping[str, Any]]]) -> list[tuple[object, ...]]:
    """Uma linha por condição de cada regra: (dono, alternativa, condição, campo, negada), com
    as alternativas e as condições numeradas a partir de 1."""
    return [
        (dono, i, j, condicao.campo, condicao.negada)
        for dono, expr in regras
        for i, alternativa in enumerate(alternativas(expr), 1)
        for j, condicao in enumerate(alternativa, 1)
    ]


def _valores(regras: Iterable[tuple[str, Mapping[str, Any]]]) -> list[tuple[object, ...]]:
    """Uma linha por valor de cada condição: (dono, alternativa, condição, campo, valor)."""
    return [
        (dono, i, j, condicao.campo, valor)
        for dono, expr in regras
        for i, alternativa in enumerate(alternativas(expr), 1)
        for j, condicao in enumerate(alternativa, 1)
        for valor in dict.fromkeys(condicao.valores)
    ]


def _inserir(
    tabela: Tabela, linhas: Sequence[tuple[object, ...]], *, atualizar: bool
) -> sql.Composed:
    # Os nomes são os das listas daqui e das tabelas da migração: entram como estão.
    inserir = sql.SQL("INSERT INTO {} ({}) VALUES\n    {}").format(
        sql.SQL(tabela.nome),
        sql.SQL(", ").join(sql.SQL(c) for c in tabela.colunas),
        sql.SQL(",\n    ").join(
            sql.SQL("({})").format(sql.SQL(", ").join(sql.Literal(v) for v in linha))
            for linha in linhas
        ),
    )
    if not atualizar:
        return inserir
    alvo = (
        sql.SQL("ON CONSTRAINT {}").format(sql.SQL(tabela.restricao))
        if tabela.restricao
        else sql.SQL("({})").format(sql.SQL(", ").join(sql.SQL(c) for c in tabela.chave))
    )
    resto = [c for c in tabela.colunas if c not in tabela.chave]
    return sql.SQL("{}\nON CONFLICT {} DO UPDATE SET {}").format(
        inserir,
        alvo,
        sql.SQL(", ").join(sql.SQL("{0} = EXCLUDED.{0}").format(sql.SQL(c)) for c in resto),
    )


def dados_de_referencia(contrato: Contrato, geradas: list[View]) -> dict[str, sql.Composed]:
    """O INSERT de cada tabela, na ordem de gravar: as mantidas atualizam a linha que já existe
    (`ON CONFLICT`), e as refeitas, que saem inteiras antes (`banco`), só inserem. Uma tabela
    sem linhas fica de fora."""
    mantidas = _linhas_das_mantidas(contrato)
    refeitas = _linhas_das_refeitas(contrato, geradas)
    return {
        **{
            t.nome: _inserir(t, mantidas[t.nome], atualizar=True)
            for t in MANTIDAS
            if mantidas[t.nome]
        },
        **{
            t.nome: _inserir(t, refeitas[t.nome], atualizar=False)
            for t in REFEITAS
            if refeitas[t.nome]
        },
    }


def remocoes(contrato: Contrato) -> list[tuple[str, sql.Composed]]:
    """O DELETE das linhas das mantidas que saíram do contrato (ou do arquivo do IBGE), da última
    tabela para a primeira, pela coluna que identifica cada linha (`Tabela.identifica`)."""
    mantidas = _linhas_das_mantidas(contrato)
    comandos = []
    for tabela in reversed(MANTIDAS):
        coluna = tabela.identifica or tabela.chave[0]
        indice = tabela.colunas.index(coluna)
        valores = [linha[indice] for linha in mantidas[tabela.nome]]
        alvo = sql.SQL(tabela.nome)
        if not valores:
            comandos.append((tabela.nome, sql.SQL("DELETE FROM {}").format(alvo)))
            continue
        comandos.append(
            (
                tabela.nome,
                sql.SQL("DELETE FROM {} WHERE {} NOT IN ({})").format(
                    alvo,
                    sql.SQL(coluna),
                    sql.SQL(", ").join(sql.Literal(v) for v in valores),
                ),
            )
        )
    return comandos
