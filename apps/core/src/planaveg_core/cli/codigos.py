"""Os códigos de saída da CLI e o tipo de um comando."""

from __future__ import annotations

import argparse
from collections.abc import Callable

from planaveg_core.config import Settings

EXIT_OK = 0
EXIT_VERIFY_FAILED = 1
"""Só o verify reprovado (uma reprovação que não foi aceita com `--aceitar`)."""
EXIT_ERRO = 2
"""Qualquer erro: com código (`PlanavegError`), do banco ou inesperado (com traceback no log)."""
EXIT_INTERROMPIDO = 130
"""Ctrl+C ou o fim do container (SIGTERM), como no shell."""

Comando = Callable[[Settings, argparse.Namespace], int]
