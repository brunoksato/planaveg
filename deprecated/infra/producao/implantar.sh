#!/usr/bin/env bash
# Envia o código ao servidor, constrói as imagens lá e sobe PostGIS, GeoServer e nginx. Na
# primeira vez, gera as senhas (/opt/planaveg/.env, sem mostrá-las) e um certificado
# provisório até chegar o de origem da Cloudflare. Uso, da raiz do repositório:
#   SERVIDOR=root@IP [DOMINIO=portal.exemplo.gov.br] [SSH_CHAVE=~/.ssh/chave] infra/producao/implantar.sh
set -euo pipefail

SERVIDOR=${SERVIDOR:?informe SERVIDOR=root@IP}
DOMINIO=${DOMINIO:-}
ssh_opcoes=(-o BatchMode=yes -o ServerAliveInterval=30)
if [ -n "${SSH_CHAVE:-}" ]; then
  ssh_opcoes+=(-i "$SSH_CHAVE" -o IdentitiesOnly=yes)
fi
remoto() { ssh "${ssh_opcoes[@]}" "$SERVIDOR" "$@"; }

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain -- apps packages infra)" ]; then
  echo "aviso: vão mudanças ainda não commitadas em apps, packages ou infra:" >&2
  git status --short -- apps packages infra >&2
fi

# Só o que os builds usam. Vai o que o Git rastreia e o que é novo sem estar ignorado: nunca
# .env, GeoPackages, node_modules ou documentos locais.
echo "enviando o código"
# Sem os metadados do macOS (._*, atributos estendidos): o tar do macOS (bsdtar) pede
# --no-mac-metadata; o do Linux (GNU tar) não o conhece, e --no-xattrs basta.
opcoes_tar=(--no-xattrs)
if tar --version 2>/dev/null | grep -q bsdtar; then
  opcoes_tar+=(--no-mac-metadata)
fi
git ls-files -z --cached --others --exclude-standard -- apps packages infra \
  package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .oxfmtrc.json oxlint.json \
  .dockerignore \
  | COPYFILE_DISABLE=1 tar --null -T - "${opcoes_tar[@]}" -czf - \
  | remoto 'set -e
      rm -rf /opt/planaveg/app.nova && mkdir -p /opt/planaveg/app.nova
      tar -xzf - -C /opt/planaveg/app.nova
      rm -rf /opt/planaveg/app && mv /opt/planaveg/app.nova /opt/planaveg/app'

# Vai com outro nome: um DOMINIO vazio no ambiente passaria por cima do .env no compose.
remoto "NOVO_DOMINIO='$DOMINIO' bash -s" <<'REMOTO'
set -euo pipefail
umask 077
mkdir -p /opt/planaveg/tls /opt/planaveg/logs /srv/planaveg/gpkg
# As versões vigentes: o core grava (root), e o nginx, que roda os workers com outro usuário,
# precisa atravessar o diretório (o umask acima o deixaria 700).
install -d -m 755 /opt/planaveg/vigentes
if [ ! -f /opt/planaveg/.env ]; then
  [ -n "$NOVO_DOMINIO" ] || { echo "primeira implantação: informe DOMINIO" >&2; exit 1; }
  {
    echo "DOMINIO=$NOVO_DOMINIO"
    for nome in POSTGRES_PASSWORD GEOSERVER_ADMIN_PASSWORD GEOSERVER_PG_PASSWORD; do
      echo "$nome=$(openssl rand -hex 24)"
    done
  } > /opt/planaveg/.env
  echo "senhas geradas em /opt/planaveg/.env"
elif [ -n "$NOVO_DOMINIO" ]; then
  sed -i "s|^DOMINIO=.*|DOMINIO=$NOVO_DOMINIO|" /opt/planaveg/.env
fi
if [ ! -f /opt/planaveg/tls/origem.pem ]; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 30 \
    -subj "/CN=planaveg-provisorio" -keyout /opt/planaveg/tls/origem.key \
    -out /opt/planaveg/tls/origem.pem 2>/dev/null
  echo "certificado provisório (30 dias) em /opt/planaveg/tls"
fi

cd /opt/planaveg/app
compose=(docker compose -f infra/producao/compose.yaml --env-file /opt/planaveg/.env)
# Sem atestados de proveniência (que levam a hora do build): no armazém de imagens do containerd,
# eles mudam o ID a cada build, e o compose recriaria o GeoServer em toda implantação, mesmo sem
# mudança nele (um minuto sem dados e a semeadura em andamento perdida).
export BUILDX_NO_DEFAULT_ATTESTATIONS=1
"${compose[@]}" build --pull geoserver web core
"${compose[@]}" up -d --wait --remove-orphans db geoserver web
"${compose[@]}" ps
REMOTO
