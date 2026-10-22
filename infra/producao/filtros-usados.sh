#!/usr/bin/env bash
# Os filtros mais pedidos pelo mapa nos últimos dias, do log que o nginx grava só com eles
# (/opt/planaveg/logs/filtros.log e os rodados), como `camada<TAB>estilo<TAB>cql`, o formato
# do `planaveg-core aquecer --usados`. Roda no servidor.
#   infra/producao/filtros-usados.sh [dias=7] [quantos=100]
set -euo pipefail

dias="${1:-7}"
quantos="${2:-100}"
shopt -s nullglob
arquivos=(/opt/planaveg/logs/filtros.log*)
[ ${#arquivos[@]} -eq 0 ] && exit 0

for arquivo in "${arquivos[@]}"; do
  case "$arquivo" in
    *.gz) zcat -- "$arquivo" ;;
    *) cat -- "$arquivo" ;;
  esac
done | python3 -c '
import collections, datetime, re, sys
from urllib.parse import unquote

dias, quantos = int(sys.argv[1]), int(sys.argv[2])
desde = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=dias)
# /geoserver/gwc/service/wmts/rest/planaveg:peca_2024/planaveg:planaveg_nivel/EPSG:900913/...
caminho = re.compile(r"/gwc/service/wmts/rest/([^/]+)/([^/]+)/")
contagem = collections.Counter()
for linha in sys.stdin:
    partes = linha.rstrip("\n").split("\t")
    if len(partes) != 4 or partes[1] != "200":
        continue
    try:
        quando = datetime.datetime.fromisoformat(partes[0])
    except ValueError:
        continue
    camada = caminho.search(partes[2])
    if quando < desde or camada is None:
        continue
    contagem[(camada.group(1), camada.group(2), unquote(partes[3]))] += 1
for (camada, estilo, cql), _ in contagem.most_common(quantos):
    print(f"{camada}\t{estilo}\t{cql}")
' "$dias" "$quantos"
