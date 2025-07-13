# 🇵🇰 Pakistani Tax Advisor

A modern, full-stack web application for calculating and managing Pakistani income taxes.

## 🚀 Quick Start

```bash
# Setup and start development
make setup
make dev
📱 Demo Accounts

Admin: admin@tax.pk / admin123
User: user@demo.pk / user123

🔗 Access Points

Frontend: http://localhost:5173
Backend: http://localhost:8000
API Docs: http://localhost:8000/docs

🧮 Features

Pakistani tax slabs 2024-25
Real-time tax calculations
User authentication
Admin dashboard
Mobile responsive design
Docker deployment ready


Built with ❤️ for Pakistani taxpayers

#### Create `Makefile`
1. **New file**: `Makefile`
2. **Content**:
```makefile
.PHONY: help setup dev prod stop test clean

help:
	@echo "🇵🇰 Pakistani Tax Advisor Commands"
	@echo ""
	@echo "  setup  - Install dependencies and setup environment"
	@echo "  dev    - Start development environment"
	@echo "  prod   - Start production environment"
	@echo "  stop   - Stop all services"
	@echo "  test   - Run all tests"
	@echo "  clean  - Clean up containers and volumes"

setup:
	@echo "Setting up Pakistani Tax Advisor..."
	cp .env.example .env
	@echo "✅ Setup complete! Run 'make dev' to start."

dev:
	@echo "🚀 Starting development environment..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Development started!"
	@echo "   Frontend: http://localhost:5173"
	@echo "   Backend:  http://localhost:8000"

prod:
	@echo "🚀 Starting production environment..."
	docker-compose up -d

stop:
	@echo "🛑 Stopping all services..."
	docker-compose down
	docker-compose -f docker-compose.dev.yml down

test:
	@echo "🧪 Running tests..."
	@echo "Tests will be available after full setup."

clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	docker system prune -f