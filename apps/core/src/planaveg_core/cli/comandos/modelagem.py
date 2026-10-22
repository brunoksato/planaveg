"""`modelagem`: escreve a modelagem do banco em SQL puro, sem abrir o banco."""

from __future__ import annotations

import argparse
from pathlib import Path

from planaveg_core import banco
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato


def cmd_modelagem(settings: Settings, args: argparse.Namespace) -> int:
    """Os quatro arquivos da modelagem (as tabelas, as funções, as views e os dados), na pasta
    dada. Só eles são reescritos: o README e as consultas da pasta, escritos à mão, ficam."""
    contrato = carregar_contrato(settings.contract_path)
    pasta = Path(args.pasta)
    pasta.mkdir(parents=True, exist_ok=True)
    for nome, texto in banco.modelagem(contrato).items():
        (pasta / nome).write_text(texto, encoding="utf-8")
        print(pasta / nome)
    return EXIT_OK
