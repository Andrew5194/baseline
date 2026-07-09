.PHONY: setup local remote down logs ps dev build install migrate clean lint type-check help

# === Stack (Coder workspace) ===
#
# Compose services run as SIBLING containers (the Docker daemon is the host, not
# this workspace), so their ports land on the daemon host, not this workspace's
# localhost — which is what the Coder proxy forwards. `remote` joins the compose
# network and starts socat forwarders (see coder-connect.sh); `local` skips that,
# for hosts where Docker already publishes ports to localhost.

NETWORK := baseline_baseline

setup: ## Create .env and generate AUTH_SECRET if it isn't set
	@test -f .env || cp .env.example .env
	@if grep -qE '^AUTH_SECRET=.+' .env; then \
		echo "✓ AUTH_SECRET already set in .env"; \
	else \
		secret=$$(openssl rand -base64 32); \
		awk -v s="$$secret" '/^AUTH_SECRET=/{print "AUTH_SECRET=" s; next} {print}' .env > .env.tmp && mv .env.tmp .env; \
		echo "✓ Generated AUTH_SECRET in .env"; \
	fi

local: setup ## Start the published stack (localhost access)
	docker compose pull
	docker compose up -d

remote: setup ## Start the published stack + Coder port forwarders
	docker compose pull
	docker compose up -d
	./coder-connect.sh

down: ## Stop the stack and tear down the forwarders
	-pkill -x socat
	-docker network disconnect $(NETWORK) "$$(grep '/containers/' /proc/self/mountinfo | grep -oE '[0-9a-f]{64}' | head -1)"
	docker compose down

logs: ## Tail all service logs
	docker compose logs -f

ps: ## Show service status
	docker compose ps

# === Local development ===

dev: ## Start all apps via Turborepo
	@pnpm dev

build: ## Production build (all apps and packages)
	@pnpm build

install: ## Install dependencies
	@pnpm install

migrate: ## Create/update database tables (Drizzle)
	@pnpm --filter @baseline/db migrate

clean: ## Remove build artifacts
	@pnpm clean

lint: ## Run ESLint
	@pnpm lint

type-check: ## Run TypeScript checks
	@pnpm type-check

help: ## Show this help
	@echo "Baseline — make targets"
	@echo ""
	@echo "  Stack (Coder workspace)"
	@echo "    make local       Start the stack (localhost)"
	@echo "    make remote      Start the stack + Coder forwarders"
	@echo "    make down        Stop the stack + forwarders"
	@echo "    make logs        Tail all logs"
	@echo "    make ps          Service status"
	@echo ""
	@echo "  Local development"
	@echo "    make install / dev / migrate / build / lint / type-check / clean"
