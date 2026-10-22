"""Todas as views geradas, na ordem de criação."""

from __future__ import annotations

from planaveg_core.contrato import Contrato
from planaveg_core.publicacao.camadas import catalogo_camada
from planaveg_core.publicacao.catalogos import catalogos
from planaveg_core.publicacao.facetas import quantitativo_faceta, quantitativo_faceta_lugar
from planaveg_core.publicacao.nomes import View
from planaveg_core.publicacao.pecas import (
    classificada,
    desenhada,
    lugar,
    municipio,
    partes,
    views_de_peca,
)
from planaveg_core.publicacao.quantitativos import (
    quantitativo_arranjo,
    quantitativo_categoria,
    quantitativo_dimensao,
    quantitativo_filtro,
    quantitativo_nivel,
    serie,
)


def views(contrato: Contrato) -> list[View]:
    """Todas as views geradas, na ordem de criação (cada uma só depende das anteriores e das
    tabelas). As materializadas são calculadas nesta ordem: a peça classificada primeiro."""
    return [
        classificada(contrato),
        desenhada(),
        lugar(),
        *views_de_peca(contrato),
        municipio(),
        # Fora do catálogo de camadas: não é desenhada, só responde ao clique.
        partes(),
        # As facetas antes dos quantitativos que as somam.
        quantitativo_faceta(),
        quantitativo_faceta_lugar(),
        quantitativo_nivel(),
        quantitativo_categoria(),
        quantitativo_arranjo(),
        quantitativo_filtro(),
        quantitativo_dimensao(),
        serie(),
        catalogo_camada(),
        *catalogos(),
    ]
