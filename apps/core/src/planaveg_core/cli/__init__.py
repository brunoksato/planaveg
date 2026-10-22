"""CLI `planaveg-core`: um subcomando por etapa.

Ordem canônica: inspect → init-db → load → verify → geoserver → semear → aquecer.
`geoserver` publica as views num GeoServer, `semear` gera o cache de tiles e `aquecer` semeia os
filtros mais prováveis. `run-all` executa `init-db`, `load` e `verify` (e, com `--geoserver`, a
publicação). `init-db`, `load`, `verify` e `geoserver` gravam uma linha em `execucao`; `inspect`,
`semear`, `aquecer` e `status` não gravam (`status` só lê).

Módulos: `principal` (o `main`), `parser`, `codigos` e `comandos/` (um arquivo por comando).
"""

from planaveg_core.cli.principal import main

__all__ = ["main"]
