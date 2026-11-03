#!/usr/bin/env bash
# Libera a porta 443 só para os endereços da Cloudflare (lista oficial). Só acrescenta: o ufw
# ignora regras repetidas, e uma faixa que saiu da lista continua liberada até ser apagada à mão.
# Roda na preparação do servidor; rode de novo quando a Cloudflare anunciar mudança na lista
# (https://www.cloudflare.com/ips/).
set -euo pipefail

for versao in v4 v6; do
  lista=$(curl -fsS --max-time 20 "https://www.cloudflare.com/ips-$versao")
  # Só faixas CIDR; qualquer outra coisa (página de erro, HTML) para o script.
  if ! grep -qE '^[0-9a-f:.]+/[0-9]+$' <<<"$lista" || grep -vqE '^[0-9a-f:.]+/[0-9]+$' <<<"$lista"; then
    echo "lista $versao da Cloudflare inesperada; nada mudou" >&2
    exit 1
  fi
  while read -r faixa; do
    ufw allow proto tcp from "$faixa" to any port 443 comment cloudflare >/dev/null
  done <<<"$lista"
done
ufw status | grep -c cloudflare | xargs echo "regras da Cloudflare na 443:"
