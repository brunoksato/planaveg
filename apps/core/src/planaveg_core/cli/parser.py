"""O parser da CLI: um subcomando por etapa, cada um com as suas opções."""

from __future__ import annotations

import argparse

from planaveg_core.cache import semeadura
from planaveg_core.cli.codigos import Comando
from planaveg_core.cli.comandos.aquecer import cmd_aquecer
from planaveg_core.cli.comandos.geoserver import cmd_geoserver
from planaveg_core.cli.comandos.init_db import cmd_init_db
from planaveg_core.cli.comandos.inspect import cmd_inspect
from planaveg_core.cli.comandos.load import cmd_load
from planaveg_core.cli.comandos.modelagem import cmd_modelagem
from planaveg_core.cli.comandos.run_all import cmd_run_all
from planaveg_core.cli.comandos.semear import cmd_semear
from planaveg_core.cli.comandos.status import cmd_status
from planaveg_core.cli.comandos.verify import cmd_verify
from planaveg_core.conferencia import INVARIANTES


def _aceitar(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--aceitar",
        action="append",
        choices=INVARIANTES,
        metavar="INVARIANTE",
        help="Reprovação conhecida que não falha a etapa (repetível): fica no registro como "
        "aceita. Ex.: --aceitar pecas_sem_sobreposicao.",
    )


def criar_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="planaveg-core",
        description=(
            "planaveg_core: recebe o GeoPackage Planaveg, modela no PostGIS e publica no GeoServer."
        ),
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def comando(nome: str, funcao: Comando, ajuda: str) -> argparse.ArgumentParser:
        sub_parser = sub.add_parser(nome, help=ajuda)
        sub_parser.set_defaults(funcao=funcao)
        return sub_parser

    comando("inspect", cmd_inspect, "Lê o GeoPackage e confere camadas, CRS e colunas.")
    comando(
        "init-db",
        cmd_init_db,
        "Extensões, tabelas, funções e views geradas do contrato. Preserva a carga.",
    ).add_argument(
        "--recreate", action="store_true", help="Descarta a carga: esvazia as tabelas das peças."
    )
    comando(
        "load", cmd_load, "Copia o GeoPackage para as tabelas das peças (idempotente por conteúdo)."
    )
    verify = comando(
        "verify",
        cmd_verify,
        "Confere os invariantes do banco; exit 1 se algum reprovar sem ser aceito.",
    )
    verify.add_argument(
        "--rapido", action="store_true", help="Pula a sobreposição entre peças (a etapa longa)."
    )
    _aceitar(verify)
    comando("geoserver", cmd_geoserver, "Publica as views de publicacao num GeoServer.")
    semear = comando(
        "semear",
        cmd_semear,
        "Gera os tiles das camadas no cache do GeoServer (vista nacional primeiro).",
    )
    # Um nível acima do que a vista mostra: a tela de alta densidade pede os tiles do seguinte.
    semear.add_argument("--zoom-pecas", type=int, default=11, help="Último zoom das peças.")
    # Os filtros espaciais só o QGIS pede: a vista nacional basta, o resto entra na primeira visita.
    semear.add_argument("--zoom-filtros", type=int, default=8, help="Último zoom dos filtros.")
    semear.add_argument("--threads", type=int, default=4, help="Threads do GeoWebCache.")
    semear.add_argument(
        "--desde-zoom", type=int, default=0, help="Pula os zooms abaixo (já semeados)."
    )
    semear.add_argument(
        "--so",
        choices=("pecas", "filtros"),
        help="Só as peças ou só os filtros.",
    )
    semear.add_argument(
        "--intervalo", type=float, default=10.0, help="Segundos entre as consultas de andamento."
    )
    aquecer = comando(
        "aquecer",
        cmd_aquecer,
        "Semeia no cache os filtros mais prováveis: os comuns e os usados (do log do nginx).",
    )
    aquecer.add_argument(
        "--comuns", action="store_true", help="Os filtros de uma opção só, em cada ano."
    )
    aquecer.add_argument(
        "--usados", help="Arquivo com camada<TAB>estilo<TAB>cql por linha ('-' = entrada)."
    )
    aquecer.add_argument("--zoom", type=int, default=semeadura.ZOOM_TODAS, help="Último zoom.")
    aquecer.add_argument("--threads", type=int, default=2, help="Threads do GeoWebCache.")
    aquecer.add_argument(
        "--intervalo", type=float, default=5.0, help="Segundos entre as consultas de andamento."
    )
    comando("status", cmd_status, "Mostra a entrega, contagens, quantitativos, série e execuções.")
    comando(
        "modelagem",
        cmd_modelagem,
        "Escreve a modelagem do banco em SQL puro, um arquivo por assunto: as tabelas, as "
        "funções, as views e os dados de referência. Não abre o banco.",
    ).add_argument("pasta", help="Onde escrever (no repositório: modelagem/, na raiz).")
    run = comando("run-all", cmd_run_all, "init-db + load + verify.")
    run.add_argument("--geoserver", action="store_true", help="Publica no GeoServer ao final.")
    run.add_argument(
        "--recreate", action="store_true", help="Descarta a carga anterior antes de carregar."
    )
    run.add_argument(
        "--rapido",
        action="store_true",
        help="verify sem a sobreposição entre peças (aí não publica: o verify fica incompleto).",
    )
    _aceitar(run)
    return parser
