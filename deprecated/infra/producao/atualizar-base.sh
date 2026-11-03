#!/usr/bin/env bash
# Publica uma base nova no servidor: carga e conferência (run-all), GeoServer, semeadura e o
# aquecimento dos filtros comuns e usados. Roda no servidor, em /opt/planaveg/app; leva algumas
# horas. A Cloudflare não precisa de limpeza: tiles e consultas levam a versão na URL, e a versão
# muda com a base.
# O GeoPackage vai antes para /srv/planaveg/gpkg (GPKG_ARQUIVO no .env, se o nome mudar). Os
# argumentos vão ao run-all: com --recreate, a carga anterior é descartada antes (um contrato que
# tira o que ela usa pede isso), e o portal fica sem peças até a carga terminar.
#   nohup infra/producao/atualizar-base.sh [--recreate] > /opt/planaveg/carga.log 2>&1 &
set -euo pipefail

cd "$(dirname "$0")/../.."
compose=(docker compose -f infra/producao/compose.yaml --env-file /opt/planaveg/.env)

# Qualquer falha para o script: um init-db, uma carga ou uma reprovação do verify. A base final
# tem uma reprovação conhecida (sobreposições pequenas que o próprio arquivo traz): ela vai
# aceita, registrada como tal, e só ela. Leia o verify no log antes de dar a base por boa.
"${compose[@]}" run --rm core run-all --aceitar pecas_sem_sobreposicao "$@"
"${compose[@]}" run --rm core geoserver
"${compose[@]}" run --rm core semear
infra/producao/aquecer-cache.sh --comuns
