#!/usr/bin/env bash
# Semeia no cache de tiles os filtros mais pedidos da última semana e, com --comuns, também os
# de uma opção só (cada tipo, situação, caminho, tema, estado e bioma). Só gera os tiles que
# faltam: rodar de novo é barato. Roda no servidor, em /opt/planaveg/app; o timer
# planaveg-aquecimento o chama todo dia (instalar-aquecimento.sh).
#   infra/producao/aquecer-cache.sh [--comuns]
set -euo pipefail

cd "$(dirname "$0")/../.."
compose=(docker compose -f infra/producao/compose.yaml --env-file /opt/planaveg/.env)
infra/producao/filtros-usados.sh 7 100 | "${compose[@]}" run --rm -T core aquecer --usados - "$@"
