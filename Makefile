.PHONY: dev build start install clean lint type-check help docker-install docker-build docker-start docker-stop docker-restart docker-logs docker-logs-web docker-logs-db docker-status docker-clean docker-backup docker-restore docker-update docker-shell-web docker-shell-db docker-shell-redis docker-health

# === Local Development Commands ===

# Development server (all apps via Turborepo)
dev:
	@echo "🚀 Starting all apps..."
	@pnpm dev

# Production build (all apps and packages)
build:
	@echo "🔨 Building for production..."
	@pnpm build

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@pnpm install

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@pnpm clean
	@echo "✅ Clean complete"

# Run linter
lint:
	@echo "🔍 Running ESLint..."
	@pnpm lint

# Type check
type-check:
	@echo "🔍 Running type checks..."
	@pnpm type-check

# === Docker Self-Hosting Commands ===

docker-install: ## Initial setup - copy env file
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✓ Created .env file. Please edit it with your configuration."; \
	else \
		echo "✗ .env file already exists. Skipping."; \
	fi

docker-build: ## Build Docker images
	@echo "🔨 Building Docker images..."
	docker compose build

docker-start: ## Start all services
	@echo "🚀 Starting Baseline services..."
	docker compose up -d
	@echo "✓ Baseline is starting..."
	@echo "  Web:      http://localhost:3000"
	@echo "  Postgres: localhost:5432"
	@echo "  Redis:    localhost:6379"

docker-stop: ## Stop all services
	@echo "⏸️  Stopping services..."
	docker compose stop
	@echo "✓ All services stopped"

docker-restart: ## Restart all services
	@echo "🔄 Restarting services..."
	docker compose restart
	@echo "✓ All services restarted"

docker-logs: ## View logs (all services)
	docker compose logs -f

docker-logs-web: ## View web application logs
	docker compose logs -f web

docker-logs-db: ## View database logs
	docker compose logs -f postgres

docker-status: ## Check service status
	docker compose ps

docker-clean: ## Remove all containers and volumes (WARNING: deletes data)
	@echo "⚠️  This will delete all data. Are you sure? [y/N] " && read ans && [ $${ans:-N} = y ]
	docker compose down -v
	@echo "✓ All containers and volumes removed"

docker-backup: ## Backup database
	@mkdir -p backups
	@echo "Creating backup..."
	@docker compose exec -T postgres pg_dump -U $${POSTGRES_USER:-aml} $${POSTGRES_DB:-aml} > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✓ Backup created in backups/"

docker-restore: ## Restore database (specify file with FILE=path/to/backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Please specify backup file: make docker-restore FILE=backups/backup_20250124.sql"; \
		exit 1; \
	fi
	@echo "Restoring from $(FILE)..."
	@cat $(FILE) | docker compose exec -T postgres psql -U $${POSTGRES_USER:-aml} $${POSTGRES_DB:-aml}
	@echo "✓ Database restored"

docker-update: ## Update to latest version
	@echo "Updating Baseline..."
	git pull origin main
	docker compose down
	docker compose build --no-cache
	docker compose up -d
	@echo "✓ Baseline updated and restarted"

docker-shell-web: ## Open shell in web container
	docker compose exec web sh

docker-shell-db: ## Open PostgreSQL shell
	docker compose exec postgres psql -U $${POSTGRES_USER:-aml} $${POSTGRES_DB:-aml}

docker-shell-redis: ## Open Redis CLI
	docker compose exec redis redis-cli -a $${REDIS_PASSWORD:-changeme}

docker-health: ## Check application health
	@curl -f http://localhost:3000/api/health || echo "❌ Health check failed"

# Help command
help:
	@echo "Baseline - Makefile Commands"
	@echo ""
	@echo "=== Local Development ==="
	@echo "  make dev              - Start all apps (marketing:3000, api:3001, web:3002)"
	@echo "  make build            - Build all apps and packages"
	@echo "  make install          - Install dependencies (pnpm)"
	@echo "  make lint             - Run ESLint across all workspaces"
	@echo "  make type-check       - Run TypeScript type checks"
	@echo "  make clean            - Remove build artifacts"
	@echo ""
	@echo "=== Docker Self-Hosting ==="
	@echo "  make docker-install   - Initial setup (create .env file)"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make docker-start     - Start all services"
	@echo "  make docker-stop      - Stop all services"
	@echo "  make docker-restart   - Restart all services"
	@echo "  make docker-logs      - View all service logs"
	@echo "  make docker-logs-web  - View web application logs"
	@echo "  make docker-logs-db   - View database logs"
	@echo "  make docker-status    - Check service status"
	@echo "  make docker-backup    - Backup database"
	@echo "  make docker-restore   - Restore database (FILE=path/to/backup.sql)"
	@echo "  make docker-update    - Update to latest version"
	@echo "  make docker-clean     - Remove all containers and volumes (⚠️  deletes data)"
	@echo "  make docker-health    - Check application health"
	@echo ""
	@echo "  make help             - Show this help message"
