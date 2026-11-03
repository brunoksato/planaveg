#!/usr/bin/env bash
# Limpa o cache da Cloudflare (Purge Everything). Só numa emergência: uma base nova não pede
# limpeza nenhuma, porque as URLs levam a versão e ela muda com a base. Lê
# /opt/planaveg/cloudflare.env (chmod 600, fora do Git), com CF_ZONE_ID e CF_API_TOKEN: um token
# só com a permissão Zone > Cache Purge > Purge desta zona. Sem o arquivo, avisa e não faz nada.
set -euo pipefail

arquivo=/opt/planaveg/cloudflare.env
if [ ! -r "$arquivo" ]; then
  echo "sem $arquivo: limpe o cache no painel da Cloudflare (Purge Everything)" >&2
  exit 0
fi
# shellcheck disable=SC1090
. "$arquivo"
resposta=$(curl -fsS --max-time 30 -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID:?}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN:?}" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')
if jq -e '.success' >/dev/null <<<"$resposta"; then
  echo "cache da Cloudflare limpo"
else
  echo "a Cloudflare recusou a limpeza: $(jq -c '.errors' <<<"$resposta")" >&2
  exit 1
fi
