# Pakistani Tax Advisor - Docker Commands
# Run 'make help' for available commands

.PHONY: help build start stop restart logs clean dev prod test backup

# Default target
help:
	@echo "🇵🇰 Pakistani Tax Advisor - Docker Commands"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev              - Start development environment"
	@echo "  make dev-build        - Build and start development environment"
	@echo "  make dev-logs         - View development logs"
	@echo "  make dev-stop         - Stop development environment"
	@echo ""
	@echo "Production Commands:"
	@echo "  make prod             - Start production environment"
	@echo "  make prod-build       - Build and start production environment"
	@echo "  make prod-logs        - View production logs"
	@echo "  make prod-stop        - Stop production environment"
	@echo "  make prod-monitor     - Start production with monitoring"
	@echo ""
	@echo "Build Commands:"
	@echo "  make build            - Build all services"
	@echo "  make build-backend    - Build backend only"
	@echo "  make build-frontend   - Build frontend only"
	@echo "  make build-clean      - Build without cache"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make logs             - View all logs"
	@echo "  make clean            - Clean up containers and volumes"
	@echo "  make test             - Run tests"
	@echo "  make backup           - Backup database"
	@echo "  make restore          - Restore database"
	@echo "  make shell-backend    - Access backend shell"
	@echo "  make shell-frontend   - Access frontend shell"
	@echo "  make shell-db         - Access database shell"
	@echo ""
	@echo "Database Commands:"
	@echo "  make db-init          - Initialize database with schema"
	@echo "  make db-reset         - Reset database (WARNING: deletes all data)"
	@echo "  make db-stats         - Show database statistics"
	@echo "  make db-performance   - Show database performance metrics"
	@echo "  make db-cleanup       - Clean up expired sessions and old logs"
	@echo "  make db-connections   - Show active database connections"
	@echo ""
	@echo "Load Testing Commands:"
	@echo "  make load-test        - Run basic load test (1K requests)"
	@echo "  make load-test-heavy  - Run heavy load test (10K requests)"
	@echo ""

# Development Commands
dev:
	@echo "🚀 Starting development environment..."
	docker-compose up -d backend frontend

dev-build:
	@echo "🔨 Building and starting development environment..."
	docker-compose up -d --build backend frontend

dev-logs:
	@echo "📋 Viewing development logs..."
	docker-compose logs -f backend frontend

dev-stop:
	@echo "🛑 Stopping development environment..."
	docker-compose down

dev-full:
	@echo "🚀 Starting full development stack..."
	docker-compose up -d

dev-proxy:
	@echo "🚀 Starting development with proxy..."
	docker-compose --profile proxy up -d

# Production Commands
prod:
	@echo "🚀 Starting production environment..."
	docker-compose -f docker-compose.prod.yml up -d

prod-build:
	@echo "🔨 Building and starting production environment..."
	docker-compose -f docker-compose.prod.yml up -d --build

prod-logs:
	@echo "📋 Viewing production logs..."
	docker-compose -f docker-compose.prod.yml logs -f

prod-stop:
	@echo "🛑 Stopping production environment..."
	docker-compose -f docker-compose.prod.yml down

prod-monitor:
	@echo "📊 Starting production with monitoring..."
	docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Build Commands
build:
	@echo "🔨 Building all services..."
	docker-compose build

build-backend:
	@echo "🔨 Building backend..."
	docker-compose build backend

build-frontend:
	@echo "🔨 Building frontend..."
	docker-compose build frontend

build-clean:
	@echo "🔨 Building without cache..."
	docker-compose build --no-cache

# Utility Commands
logs:
	@echo "📋 Viewing all logs..."
	docker-compose logs -f

clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v
	docker system prune -f

test:
	@echo "🧪 Running tests..."
	docker-compose exec backend python -m pytest
	docker-compose exec frontend npm test

backup:
	@echo "💾 Creating database backup..."
	docker-compose exec database pg_dump -U postgres pakistani_tax_advisor > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created: backup_$(shell date +%Y%m%d_%H%M%S).sql"

restore:
	@echo "🔄 Restoring database..."
	@read -p "Enter backup file name: " backup_file; \
	docker-compose exec -T database psql -U postgres -d pakistani_tax_advisor < $$backup_file
	@echo "✅ Database restored"

shell-backend:
	@echo "🐚 Accessing backend shell..."
	docker-compose exec backend bash

shell-frontend:
	@echo "🐚 Accessing frontend shell..."
	docker-compose exec frontend sh

shell-db:
	@echo "🐚 Accessing database shell..."
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor

# Environment Setup
setup-env:
	@echo "⚙️ Setting up environment..."
	@if [ ! -f .env.development ]; then \
		cp env.template .env.development; \
		echo "✅ Created .env.development"; \
	else \
		echo "⚠️ .env.development already exists"; \
	fi

setup-prod-env:
	@echo "⚙️ Setting up production environment..."
	@if [ ! -f .env.production ]; then \
		cp env.template .env.production; \
		echo "✅ Created .env.production"; \
		echo "⚠️ Please edit .env.production with your production settings"; \
	else \
		echo "⚠️ .env.production already exists"; \
	fi

# Health Checks
health:
	@echo "🏥 Checking service health..."
	docker-compose ps

# Database Commands
db-init:
	@echo "🗃️ Initializing database..."
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -f /docker-entrypoint-initdb.d/init.sql

db-reset:
	@echo "🔄 Resetting database..."
	docker-compose down -v
	docker-compose up -d database
	sleep 10
	make db-init

db-stats:
	@echo "📊 Database statistics..."
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -c "SELECT * FROM user_stats;"
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -c "SELECT * FROM calculation_stats;"

db-performance:
	@echo "⚡ Database performance metrics..."
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

db-cleanup:
	@echo "🧹 Cleaning up database..."
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -c "SELECT cleanup_expired_sessions();"
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -c "SELECT cleanup_old_audit_logs();"

db-connections:
	@echo "🔗 Database connections..."
	docker-compose exec database psql -U postgres -d pakistani_tax_advisor -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"

# Load Testing
load-test:
	@echo "🧪 Running load tests..."
	@echo "Testing tax calculation endpoint..."
	ab -n 1000 -c 50 http://localhost:8000/api/tax/calculate/salaried

load-test-heavy:
	@echo "🔥 Running heavy load tests..."
	@echo "Testing with 10K requests..."
	ab -n 10000 -c 100 http://localhost:8000/api/tax/calculate/salaried

# Quick Start
quickstart: setup-env dev
	@echo "🎉 Development environment is ready!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend: http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"

# Production Quick Start
quickstart-prod: setup-prod-env prod
	@echo "🚀 Production environment is ready!"
	@echo "Frontend: https://yourdomain.com"
	@echo "Backend: https://api.yourdomain.com"
	@echo "⚠️  Remember to update domain settings in configuration files" 