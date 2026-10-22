"""`semear`: gera os tiles que faltam no cache, com o andamento."""

from __future__ import annotations

import argparse
import time

from planaveg_core.cache import semeadura
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato
from planaveg_core.errors import PlanavegError
from planaveg_core.publicacao import nome_peca_recente, views


def cmd_semear(settings: Settings, args: argparse.Namespace) -> int:
    """Gera no GeoWebCache os tiles que faltam, camada por camada, e acompanha o andamento."""
    contrato = carregar_contrato(settings.contract_path)
    tarefas = semeadura.plano(
        views(contrato),
        semeadura.Profundidade(args.zoom_pecas, args.zoom_filtros),
        recente=nome_peca_recente(contrato),
        desde_zoom=args.desde_zoom,
        so=args.so,
    )
    executar_semeadura(settings, tarefas, args.threads, args.intervalo)
    return EXIT_OK


def executar_semeadura(
    settings: Settings, tarefas: list[semeadura.Semeadura], threads: int, intervalo: float
) -> None:
    """Uma tarefa por vez no GeoWebCache, acompanhando o andamento de cada uma."""
    inicio = time.monotonic()
    for numero, tarefa in enumerate(tarefas, start=1):
        filtro = "" if tarefa.cql is None else f" [{tarefa.cql}]"
        rotulo = (
            f"[{numero}/{len(tarefas)}] {tarefa.view} {tarefa.estilo}{filtro} "
            f"z{tarefa.zoom_inicio}-{tarefa.zoom_fim}"
        )
        try:
            semeadura.semear(settings, tarefa, threads)
            while ativas := semeadura.andamento(settings, tarefa.view):
                feitos = sum(f for f, _ in ativas)
                previstos = sum(t for _, t in ativas)
                print(f"{rotulo}: {feitos}/{previstos} tiles", flush=True)
                time.sleep(intervalo)
        except KeyboardInterrupt:
            # Ctrl+C, ou o fim do container: a tarefa não pode seguir dentro do GeoServer. Se o
            # pedido de parar falhar, a saída continua sendo a da interrupção (130).
            print(f"{rotulo}: interrompido; parando a semeadura no GeoWebCache", flush=True)
            try:
                semeadura.parar(settings, tarefa.view)
            except PlanavegError as exc:
                print(f"{rotulo}: a semeadura não foi parada no GeoWebCache ({exc})", flush=True)
            raise
        print(f"{rotulo}: pronto ({time.monotonic() - inicio:.0f} s desde o início)", flush=True)
