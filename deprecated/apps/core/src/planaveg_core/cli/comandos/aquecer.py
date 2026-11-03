"""`aquecer`: semeia os filtros comuns e os mais pedidos."""

from __future__ import annotations

import argparse
import sys

from deprecated.apps.core.src.planaveg_core import banco
from deprecated.apps.core.src.planaveg_core.cache import aquecimento
from deprecated.apps.core.src.planaveg_core.cli.codigos import EXIT_OK
from deprecated.apps.core.src.planaveg_core.cli.comandos.semear import executar_semeadura
from deprecated.apps.core.src.planaveg_core.config import Settings
from deprecated.apps.core.src.planaveg_core.contrato import carregar_contrato
from deprecated.apps.core.src.planaveg_core.errors import PlanavegError
from deprecated.apps.core.src.planaveg_core.publicacao import nome_peca_recente, views


def cmd_aquecer(settings: Settings, args: argparse.Namespace) -> int:
    """Semeia os filtros mais prováveis (os comuns e os usados), até o zoom da vista regional."""
    contrato = carregar_contrato(settings.contract_path)
    lista = views(contrato)
    comuns: list[str] = []
    if args.comuns:
        with banco.conectar(settings) as con:
            estados, biomas = aquecimento.valores_do_banco(con)
        comuns = aquecimento.filtros_comuns(contrato, estados, biomas)
    usados: list[tuple[str, str, str]] = []
    if args.usados is not None:
        if args.usados == "-":
            usados = aquecimento.ler_usados(sys.stdin, lista)
        else:
            try:
                with open(args.usados, encoding="utf-8") as arquivo:
                    usados = aquecimento.ler_usados(arquivo, lista)
            except OSError as exc:
                raise PlanavegError("arquivo_de_usados_ilegivel", args.usados) from exc
    tarefas = aquecimento.plano(
        lista, comuns, usados, recente=nome_peca_recente(contrato), zoom_fim=args.zoom
    )
    print(f"aquecer: {len(comuns)} filtros comuns, {len(usados)} usados, {len(tarefas)} tarefas")
    executar_semeadura(settings, tarefas, args.threads, args.intervalo)
    return EXIT_OK
