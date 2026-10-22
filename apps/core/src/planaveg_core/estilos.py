"""Estilos SLD das camadas publicadas, gerados do contrato (cores de nível, arranjo e filtro).

Cada estilo desenha a peça com a geometria mais fiel que o desenho aguenta, e há uma simplificada
só, para o WMS só ler a geometria inteira quando o mapa mostra poucos quilômetros:

- até 1:50.000 (zoom até 13, da vista nacional ao detalhe): `geom_alta`, simplificada a ~11 m,
  abaixo do pixel, com todas as partes;
- a partir de 1:50.000 (zoom 14 em diante): `geom`, a geometria inteira.

A peça menor que 2×2 pixels na escala do pedido aparece também como um ponto em `ponto`: sem ele,
o GeoServer a desenharia quase sem se ver. O ponto tem o lado que a peça teria na tela, com um
piso de 1,5 pixel (o de 1 pixel some nas telas de alta densidade): é o único exagero que resta no
mapa, e uma peça pequena nunca cobre uma grande. A escala vem do pedido (`wms_scale_denominator`),
então a mesma regra vale em todo zoom, no tile comum e no das telas de alta densidade. O GeoServer
só lê as colunas das regras ativas na escala pedida.

De longe (até o zoom 7), os pontos e as formas de peças vizinhas se cruzam, e quem é desenhado
por último leva o pixel. Por isso, ali, os estilos de mais de uma cor (níveis e arranjos)
desenham todas as peças numa passada só, das menores às maiores: cada pixel fica com a peça de
mais hectares, e nenhum tipo de área parece maior só por vir por cima. De perto, onde as peças
quase não se cruzam, os níveis voltam a uma passada cada, na ordem da legenda. Por isso as faixas
de escala são três, duas delas na mesma geometria: entre elas, muda só a ordem do desenho.
"""

from __future__ import annotations

from collections.abc import Iterable
from xml.sax.saxutils import escape  # nosec B406 - só escapa texto do SLD, não lê XML

from planaveg_core.contrato import Contrato

ESTILO_NIVEL = "planaveg_nivel"
ESTILO_ARRANJO = "planaveg_arranjo"
ESTILO_MUNICIPIO = "planaveg_municipio"

ESCALA_REGIONAL = 4_000_000
"""Acima desta escala (zoom até 7), a vista nacional e a regional: as peças maiores por cima."""
ESCALA_ALTA = 50_000
"""Abaixo desta escala (zoom 14 em diante), o mapa lê a geometria inteira."""

Faixa = tuple[str, str, int | None, int | None]
"""(nome, coluna da geometria, escala mínima, escala máxima); None = sem limite."""
_FAIXAS: tuple[Faixa, ...] = (
    ("longe", "geom_alta", ESCALA_REGIONAL, None),
    ("perto", "geom_alta", ESCALA_ALTA, ESCALA_REGIONAL),
    ("detalhe", "geom", None, ESCALA_ALTA),
)
_LONGE = _FAIXAS[:1]
"""A vista nacional e a regional (até o zoom 7), onde quase toda peça é ponto."""
_PERTO = _FAIXAS[1:]
# A ordem do desenho dentro de uma passada (`sortBy` do GeoServer). De longe, as peças menores
# primeiro e as maiores por último, por cima.
_MAIORES_POR_CIMA = "area_ha A"
_OPACIDADE = "0.75"
_CONTORNO = "0.5"
PISO_DO_PONTO_PX = 1.5
"""O menor ponto, em pixels: a peça que na escala do pedido teria menos que isto fica com isto.
Com 1, a vista nacional ficava pálida demais nas telas de alta densidade, que pedem o zoom
seguinte e mostram cada pixel pela metade."""
# Área (ha) de 2×2 pixels por escala²: pixel de 0,28 mm (padrão OGC), (2 × 0,00028 m)² / 10.000.
_HA_POR_ESCALA2 = "3.136E-11"
# O lado de um quadrado de area_ha hectares, em pixels, na escala do pedido:
# 100 m × sqrt(area_ha) / (escala × 0,00028 m) = 357143 × sqrt(area_ha) / escala.
_PX_POR_RAIZ_DE_HA = "357143"


def estilo_filtro(codigo: str) -> str:
    return f"planaveg_filtro_{codigo}"


def _escuro(cor: str) -> str:
    """A mesma cor 35% mais escura, para o contorno."""
    r, g, b = (int(cor[i : i + 2], 16) for i in (1, 3, 5))
    return "#{:02x}{:02x}{:02x}".format(*(int(c * 0.65) for c in (r, g, b)))


def _igual(campo: str, valor: str) -> str:
    return (
        "<ogc:PropertyIsEqualTo>"
        f"<ogc:PropertyName>{escape(campo)}</ogc:PropertyName>"
        f"<ogc:Literal>{escape(valor)}</ogc:Literal>"
        "</ogc:PropertyIsEqualTo>"
    )


def _escala() -> str:
    """A escala do pedido (o denominador), que o GeoServer põe no ambiente do desenho."""
    return (
        '<ogc:Function name="env"><ogc:Literal>wms_scale_denominator</ogc:Literal></ogc:Function>'
    )


def _tamanho_do_ponto() -> str:
    """O lado que a peça (`area_ha`) teria na tela, em pixels, com o piso: o ponto é do tamanho
    da peça, nunca maior, e nunca menor que `PISO_DO_PONTO_PX`."""
    return (
        f'<Size><ogc:Function name="max"><ogc:Literal>{PISO_DO_PONTO_PX}</ogc:Literal>'
        f"<ogc:Div><ogc:Mul><ogc:Literal>{_PX_POR_RAIZ_DE_HA}</ogc:Literal>"
        '<ogc:Function name="sqrt"><ogc:PropertyName>area_ha</ogc:PropertyName></ogc:Function>'
        f"</ogc:Mul>{_escala()}</ogc:Div></ogc:Function></Size>"
    )


def _pequena() -> str:
    """A peça (`area_ha`) ocupa menos de 2×2 pixels na escala do pedido."""
    escala = _escala()
    return (
        "<ogc:PropertyIsLessThan><ogc:PropertyName>area_ha</ogc:PropertyName>"
        f"<ogc:Mul><ogc:Mul>{escala}{escala}</ogc:Mul>"
        f"<ogc:Literal>{_HA_POR_ESCALA2}</ogc:Literal></ogc:Mul>"
        "</ogc:PropertyIsLessThan>"
    )


def _filtro(*condicoes: str) -> str:
    validas = [c for c in condicoes if c]
    if not validas:
        return ""
    corpo = validas[0] if len(validas) == 1 else "<ogc:And>" + "".join(validas) + "</ogc:And>"
    return f"<ogc:Filter>{corpo}</ogc:Filter>"


def _escalas(minima: int | None, maxima: int | None) -> str:
    texto = ""
    if minima is not None:
        texto += f"<MinScaleDenominator>{minima}</MinScaleDenominator>"
    if maxima is not None:
        texto += f"<MaxScaleDenominator>{maxima}</MaxScaleDenominator>"
    return texto


def _regras_categoria(
    nome: str, titulo: str, cor: str, condicao: str, faixas: tuple[Faixa, ...] = _FAIXAS
) -> list[str]:
    """As regras de uma categoria nas faixas dadas: polígono em cada uma e ponto onde a peça
    fica menor que 2×2 pixels."""
    regras: list[str] = []
    for faixa, coluna, minima, maxima in faixas:
        regras.append(
            f"<Rule><Name>{escape(nome)}_{faixa}</Name><Title>{escape(titulo)}</Title>"
            f"{_filtro(condicao)}{_escalas(minima, maxima)}"
            f"<PolygonSymbolizer><Geometry><ogc:PropertyName>{coluna}</ogc:PropertyName>"
            f'</Geometry><Fill><CssParameter name="fill">{cor}</CssParameter>'
            f'<CssParameter name="fill-opacity">{_OPACIDADE}</CssParameter></Fill>'
            f'<Stroke><CssParameter name="stroke">{_escuro(cor)}</CssParameter>'
            f'<CssParameter name="stroke-width">{_CONTORNO}</CssParameter></Stroke>'
            "</PolygonSymbolizer></Rule>"
        )
        regras.append(
            f"<Rule><Name>{escape(nome)}_{faixa}_ponto</Name><Title>{escape(titulo)}</Title>"
            f"{_filtro(condicao, _pequena())}{_escalas(minima, maxima)}"
            "<PointSymbolizer><Geometry><ogc:PropertyName>ponto</ogc:PropertyName></Geometry>"
            "<Graphic><Mark><WellKnownName>circle</WellKnownName>"
            f'<Fill><CssParameter name="fill">{cor}</CssParameter></Fill></Mark>'
            f"{_tamanho_do_ponto()}</Graphic></PointSymbolizer></Rule>"
        )
    return regras


def _passada(regras: Iterable[str], ordem: str = "") -> str:
    """Um `FeatureTypeStyle`: o GeoServer desenha cada passada por cima da anterior. `ordem` é
    a do desenho dentro dela (`sortBy`), como `_MAIORES_POR_CIMA`; sem ela, a ordem do banco."""
    opcao = f'<VendorOption name="sortBy">{ordem}</VendorOption>' if ordem else ""
    return f"<FeatureTypeStyle>{''.join(regras)}{opcao}</FeatureTypeStyle>"


def _sld(nome: str, titulo: str, *passadas: str) -> str:
    """O estilo, com as passadas na ordem do desenho."""
    corpo = "".join(passadas)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" '
        'xmlns:ogc="http://www.opengis.net/ogc" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:schemaLocation="http://www.opengis.net/sld '
        'http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">'
        f"<NamedLayer><Name>{escape(nome)}</Name><UserStyle><Name>{escape(nome)}</Name>"
        f"<Title>{escape(titulo)}</Title>{corpo}"
        "</UserStyle></NamedLayer></StyledLayerDescriptor>"
    )


def _estilo_nivel(contrato: Contrato) -> str:
    """De longe, todos os níveis numa passada, as peças maiores por cima. De perto, um nível por
    passada, do último da hierarquia ao primeiro: os projetos ficam por cima e a Reserva Legal
    embaixo, na mesma ordem da legenda do portal (de cima para baixo)."""
    niveis: dict[str, tuple[str, str]] = {}
    for nivel in contrato.hierarquia:
        niveis.setdefault(nivel.codigo, (nivel.titulo, nivel.cor))
    longe = _passada(
        (
            regra
            for codigo, (titulo, cor) in niveis.items()
            for regra in _regras_categoria(codigo, titulo, cor, _igual("nivel", codigo), _LONGE)
        ),
        _MAIORES_POR_CIMA,
    )
    perto = (
        _passada(_regras_categoria(codigo, titulo, cor, _igual("nivel", codigo), _PERTO))
        for codigo, (titulo, cor) in reversed(niveis.items())
    )
    return _sld(ESTILO_NIVEL, "Peças por nível da hierarquia", longe, *perto)


def _estilo_arranjo(contrato: Contrato) -> str:
    """De longe, as peças maiores por cima, como no dos níveis; de perto, como vêm do banco."""

    def regras(faixas: tuple[Faixa, ...]) -> list[str]:
        return [
            regra
            for arranjo in contrato.arranjos
            for regra in _regras_categoria(
                arranjo.codigo,
                arranjo.titulo,
                arranjo.cor,
                _igual("arranjo", arranjo.codigo),
                faixas,
            )
        ]

    return _sld(
        ESTILO_ARRANJO,
        "Peças por arranjo de implementação",
        _passada(regras(_LONGE), _MAIORES_POR_CIMA),
        _passada(regras(_PERTO)),
    )


def estilos(contrato: Contrato) -> dict[str, str]:
    """Nome do estilo GeoServer → SLD. Os nomes são os que o pacote `publicacao` dá às camadas."""
    resultado = {
        ESTILO_NIVEL: _estilo_nivel(contrato),
        ESTILO_ARRANJO: _estilo_arranjo(contrato),
    }
    # Uma cor só: a ordem do desenho não muda nada.
    for filtro in contrato.filtros:
        if filtro.espacial:
            nome = estilo_filtro(filtro.codigo)
            resultado[nome] = _sld(
                nome,
                filtro.titulo,
                _passada(_regras_categoria(filtro.codigo, filtro.titulo, filtro.cor, "")),
            )
    resultado[ESTILO_MUNICIPIO] = _sld(
        ESTILO_MUNICIPIO,
        "Extensão dos municípios",
        _passada(
            [
                (
                    "<Rule><Name>municipio</Name><Title>Município</Title>"
                    '<PolygonSymbolizer><Stroke><CssParameter name="stroke">#525252</CssParameter>'
                    '<CssParameter name="stroke-width">1</CssParameter>'
                    '<CssParameter name="stroke-dasharray">4 2</CssParameter></Stroke>'
                    "</PolygonSymbolizer></Rule>"
                )
            ]
        ),
    )
    return resultado
