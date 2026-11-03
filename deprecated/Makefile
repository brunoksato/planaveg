.PHONY: build check down test up

CORE := apps/core

# O banco, o GeoServer (com a publicação das camadas) e o portal, todos do compose.yaml. A base
# vem antes, com `make run` em apps/core.
up:
	$(MAKE) -C $(CORE) geoserver
	docker compose up --build -d --wait web

# Para os três, sem apagar os volumes.
down:
	docker compose down

test:
	$(MAKE) -C $(CORE) test
	pnpm test:web

check:
	$(MAKE) -C $(CORE) check
	pnpm format:web:check
	pnpm lint:web
	pnpm typecheck:web

build:
	pnpm build:web
