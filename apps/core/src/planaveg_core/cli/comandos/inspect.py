"""`inspect`: confere o arquivo contra o contrato, sem banco."""

from __future__ import annotations

import argparse

from planaveg_core import gpkg
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato


def cmd_inspect(settings: Settings, _args: argparse.Namespace) -> int:
    contrato = carregar_contrato(settings.contract_path)
    recipiente = gpkg.inspecionar(settings.arquivo_gpkg(contrato.arquivo_referencia), contrato)
    total = sum(c.n_registros for c in recipiente.camadas)
    print(f"arquivo={recipiente.caminho.name}")
    print(f"application_id={recipiente.application_id} user_version={recipiente.user_version}")
    print(f"camadas={len(recipiente.camadas)} pecas={total} contrato={contrato.schema_version}")
    for camada in recipiente.camadas:
        logica = contrato.camada(camada.nome)
        print(
            f"  {camada.nome:40} srid={contrato.srid:<7} {contrato.tipo_srs:10} "
            f"n={camada.n_registros:<8} -> ano_vs={logica.ano_vs} ({logica.rotulo})"
        )
    return EXIT_OK
