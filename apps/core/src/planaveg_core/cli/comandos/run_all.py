"""`run-all`: `init-db`, `load` e `verify`; publica só se o `verify` passar inteiro."""

from __future__ import annotations

import argparse

from planaveg_core import gpkg
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.cli.comandos.geoserver import cmd_geoserver
from planaveg_core.cli.comandos.init_db import cmd_init_db
from planaveg_core.cli.comandos.load import cmd_load
from planaveg_core.cli.comandos.status import cmd_status
from planaveg_core.cli.comandos.verify import cmd_verify
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato


def cmd_run_all(settings: Settings, args: argparse.Namespace) -> int:
    # O arquivo é conferido contra o contrato antes de tocar no banco: um arquivo errado não
    # pode deixar o `--recreate` apagar as peças sem uma carga para pôr no lugar.
    contrato = carregar_contrato(settings.contract_path)
    gpkg.inspecionar(settings.arquivo_gpkg(contrato.arquivo_referencia), contrato)
    for etapa in (cmd_init_db, cmd_load):
        codigo = etapa(settings, args)
        if codigo != EXIT_OK:
            return codigo
    codigo = cmd_verify(settings, args)
    if codigo == EXIT_OK and args.geoserver:
        if args.rapido:
            print("não publica: o verify --rapido pulou a sobreposição entre peças")
        else:
            codigo = cmd_geoserver(settings, args)
    cmd_status(settings, args)
    return codigo
