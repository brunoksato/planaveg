#!/usr/bin/env bash
# Prepara um Ubuntu (24.04 ou mais novo) para o Planaveg: pacotes, Docker, swap, rede, SSH só
# com chave e firewall. Pode rodar de novo. Uso, da raiz do repositório:
#   ssh root@SERVIDOR 'bash -s' < infra/producao/preparar-servidor.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confold upgrade
apt-get -y -q install docker.io docker-compose-v2 docker-buildx fail2ban ufw rsync jq curl
systemctl enable --now docker

# Logs dos containers com rotação, para não encherem o disco.
install -d /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{"log-driver": "json-file", "log-opts": {"max-size": "50m", "max-file": "5"}}
JSON
systemctl restart docker

# 4 GB de swap, só para aperto: o PostgreSQL e o GeoServer cabem na memória.
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  [ -f /swapfile ] || fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
cat > /etc/sysctl.d/90-planaveg.conf <<'CONF'
vm.swappiness = 10
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
CONF
sysctl -q --system

# SSH só com chave. Vale o primeiro valor lido, e este arquivo vem antes do 50-cloud-init.conf.
cat > /etc/ssh/sshd_config.d/10-planaveg.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
sshd -t
systemctl reload ssh 2>/dev/null || systemctl restart ssh

# Firewall: SSH aberto; HTTPS (o nginx, na rede do host) só para os endereços da Cloudflare,
# acrescentados por firewall-cloudflare.sh. O banco e o GeoServer só escutam em 127.0.0.1 (o
# acesso de fora é pela tailnet).
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment ssh >/dev/null
ufw --force enable >/dev/null
ufw status verbose
