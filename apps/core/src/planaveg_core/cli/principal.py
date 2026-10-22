"""A entrada da CLI: lê os argumentos, roda o comando e traduz os erros em códigos de saída."""

from __future__ import annotations

import logging
import signal
from collections.abc import Sequence
from types import FrameType

import psycopg

from planaveg_core.cli.codigos import EXIT_ERRO, EXIT_INTERROMPIDO
from planaveg_core.cli.parser import criar_parser
from planaveg_core.config import Settings
from planaveg_core.errors import PlanavegError

_LOG = logging.getLogger("planaveg_core")


def _interromper(_sinal: int, _quadro: FrameType | None) -> None:
    """O fim do container (SIGTERM) vira um Ctrl+C: o `semear` e o `aquecer` param as tarefas
    no GeoWebCache antes de sair."""
    raise KeyboardInterrupt


def main(argv: Sequence[str] | None = None) -> int:
    args = criar_parser().parse_args(argv)
    signal.signal(signal.SIGTERM, _interromper)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        return int(args.funcao(Settings.from_env(), args))
    except PlanavegError as exc:
        _LOG.error("%s", exc)
        return EXIT_ERRO
    except (
        psycopg.errors.UndefinedTable,
        psycopg.errors.UndefinedColumn,
        # REFRESH ... CONCURRENTLY numa view materializada sem o índice da chave. É um
        # OperationalError: este except vem antes daquele.
        psycopg.errors.ObjectNotInPrerequisiteState,
    ) as exc:
        _LOG.error(
            "o banco não tem a estrutura desta versão do core (%s): rode init-db",
            type(exc).__name__,
        )
        return EXIT_ERRO
    except psycopg.OperationalError as exc:
        # Inclui conexão recusada e consulta cancelada; a classe diz qual.
        _LOG.error("erro do banco: %s", type(exc).__name__)
        return EXIT_ERRO
    except KeyboardInterrupt:
        _LOG.error("interrompido")
        return EXIT_INTERROMPIDO
    except Exception:
        # Qualquer outra falha também é erro (2): o código 1 fica só para o verify reprovado.
        _LOG.exception("erro inesperado")
        return EXIT_ERRO
