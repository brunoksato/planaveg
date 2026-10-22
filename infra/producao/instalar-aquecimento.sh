#!/usr/bin/env bash
# Instala no servidor o aquecimento diário do cache de tiles (timer planaveg-aquecimento, às
# 05:30 UTC, de madrugada no Brasil) e a rotação do log dos filtros pedidos. Pode rodar de novo.
#   ssh root@SERVIDOR 'bash -s' < infra/producao/instalar-aquecimento.sh
set -euo pipefail

install -d /opt/planaveg/logs

cat > /etc/logrotate.d/planaveg-filtros <<'CONF'
/opt/planaveg/logs/filtros.log {
  weekly
  rotate 5
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
CONF

cat > /etc/systemd/system/planaveg-aquecimento.service <<'UNIT'
[Unit]
Description=Planaveg: semeia no cache de tiles os filtros mais pedidos
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/planaveg/app
ExecStart=/opt/planaveg/app/infra/producao/aquecer-cache.sh
Nice=10
UNIT

cat > /etc/systemd/system/planaveg-aquecimento.timer <<'UNIT'
[Unit]
Description=Planaveg: aquecimento diário do cache de tiles

[Timer]
OnCalendar=*-*-* 05:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now planaveg-aquecimento.timer
systemctl list-timers planaveg-aquecimento.timer --no-pager
