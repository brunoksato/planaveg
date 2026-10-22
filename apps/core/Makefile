.PHONY: up down reset run geoserver semear modelagem test check audit

# O compose.yaml da raiz: o banco, o GeoServer e o portal.
COMPOSE := docker compose -f ../../compose.yaml

up:
	$(COMPOSE) up -d --wait db

# Para tudo, sem apagar os volumes.
down:
	$(COMPOSE) down

# Apaga os volumes, o do banco e o do cache de tiles: a próxima carga recomeça do zero
# (`make run`).
reset:
	$(COMPOSE) down -v

run: up
	uv run planaveg-core run-all

geoserver:
	$(COMPOSE) up -d --wait db geoserver
	uv run planaveg-core geoserver

# Gera os tiles das camadas no cache do GeoServer (vista nacional primeiro).
semear:
	uv run planaveg-core semear

# A modelagem em SQL puro na raiz do repositório (as tabelas, as funções, as views e os dados de
# referência): refaça a cada mudança no contrato, numa view ou numa migração; um teste falha se
# ela ficar para trás.
modelagem:
	uv run planaveg-core modelagem ../../modelagem

test:
	uv run pytest

check:
	uv run ruff check src tests
	uv run ruff format --check src tests
	uv run mypy
	uv run lint-imports
	uv run vulture

# Segurança: bandit sobre src (config em pyproject) e vulnerabilidades conhecidas nas dependências.
audit:
	uvx bandit -q -c pyproject.toml -r src
	uv run --with pip-audit pip-audit --progress-spinner off
