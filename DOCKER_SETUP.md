# 🐳 Docker Setup Guide

This guide provides comprehensive instructions for setting up the Pakistani Tax Advisor application using Docker for both development and production environments.

## 📋 Prerequisites

- Docker Engine 20.10.0 or later
- Docker Compose 2.0.0 or later
- Git
- Make (optional, for convenience commands)

## 🏗️ Project Structure

```
pakistani-tax-advisor/
├── backend/                 # FastAPI backend
│   ├── Dockerfile          # Multi-stage backend Dockerfile
│   ├── .dockerignore       # Backend Docker ignore file
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── Dockerfile          # Multi-stage frontend Dockerfile
│   ├── .dockerignore       # Frontend Docker ignore file
│   ├── nginx.conf          # Nginx config for frontend
│   └── package.json        # Node.js dependencies
├── nginx/                  # Nginx configurations
│   ├── nginx.conf          # Main nginx configuration
│   ├── dev.conf           # Development proxy config
│   └── prod.conf          # Production proxy config
├── docker-compose.yml      # Development environment
├── docker-compose.prod.yml # Production environment
└── env.template           # Environment variables template
```

## 🛠️ Development Setup

### 1. Environment Configuration

Copy the environment template and configure for development:

```bash
cp env.template .env.development
```

Edit `.env.development` with your development settings:

```env
ENV=development
DEBUG=true
API_BASE_URL=http://localhost:8000
REACT_APP_API_BASE_URL=http://localhost:8000
POSTGRES_PASSWORD=postgres
# ... other settings
```

### 2. Start Development Environment

**Option A: Basic Development (Backend + Frontend)**
```bash
docker-compose up -d backend frontend
```

**Option B: Full Development Stack (with Database + Redis)**
```bash
docker-compose up -d
```

**Option C: With Nginx Proxy**
```bash
docker-compose --profile proxy up -d
```

### 3. Development URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Nginx Proxy**: http://localhost:80 (if using proxy profile)

### 4. Development Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart backend frontend

# Stop all services
docker-compose down

# Remove volumes (reset database)
docker-compose down -v
```

## 🚀 Production Setup

### 1. Environment Configuration

Create production environment file:

```bash
cp env.template .env.production
```

Configure `.env.production` for production:

```env
ENV=production
DEBUG=false
API_BASE_URL=https://api.yourdomain.com
REACT_APP_API_BASE_URL=https://api.yourdomain.com
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
GRAFANA_PASSWORD=your-grafana-password
# ... other production settings
```

### 2. SSL Certificates

For production, you'll need SSL certificates. Create the ssl directory and add your certificates:

```bash
mkdir -p ssl
# Add your SSL certificates
cp your-fullchain.pem ssl/fullchain.pem
cp your-privkey.pem ssl/privkey.pem
```

### 3. Start Production Environment

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# With monitoring (Prometheus + Grafana)
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

### 4. Production URLs

- **Frontend**: https://yourdomain.com
- **Backend API**: https://api.yourdomain.com
- **API Documentation**: https://api.yourdomain.com/docs
- **Grafana**: https://yourdomain.com:3000 (if monitoring enabled)

## 🔧 Advanced Configuration

### Custom Builds

Build specific services:

```bash
# Build backend only
docker-compose build backend

# Build frontend only
docker-compose build frontend

# Build without cache
docker-compose build --no-cache
```

### Scaling Services

Scale backend services in production:

```bash
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

### Database Initialization

Create database initialization script:

```bash
mkdir -p database
cat > database/init.sql << 'EOF'
-- Database initialization script
CREATE DATABASE IF NOT EXISTS pakistani_tax_advisor;
-- Add any initial data or schema here
EOF
```

### Monitoring Setup

Create monitoring configurations:

```bash
mkdir -p monitoring
cat > monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8000']
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
EOF
```

## 🔍 Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Check individual service health
docker inspect --format='{{.State.Health.Status}}' pakistani-tax-backend-dev
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using the port
   lsof -i :8000
   
   # Use different ports
   docker-compose -f docker-compose.yml up -d -p 8001:8000
   ```

2. **Permission Issues**
   ```bash
   # Fix volume permissions
   sudo chown -R $USER:$USER ./backend ./frontend
   ```

3. **Database Connection Issues**
   ```bash
   # Check database logs
   docker-compose logs database
   
   # Connect to database
   docker-compose exec database psql -U postgres -d pakistani_tax_advisor
   ```

4. **Frontend Build Issues**
   ```bash
   # Clear node_modules and rebuild
   docker-compose build --no-cache frontend
   ```

### Debug Commands

```bash
# Access container shell
docker-compose exec backend bash
docker-compose exec frontend sh

# Check container logs
docker-compose logs -f --tail=100 backend

# Check docker network
docker network ls
docker network inspect pakistani-tax-network
```

## 📊 Performance Optimization

### Production Optimizations

1. **Resource Limits**: Services have CPU and memory limits
2. **Multi-stage Builds**: Optimized Docker images
3. **Nginx Caching**: Static assets cached for 1 year
4. **Gzip Compression**: Enabled for all text content
5. **Health Checks**: Automatic service health monitoring

### Monitoring

Enable monitoring stack:

```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

Access Grafana at your domain:3000 with configured credentials.

## 🔒 Security

### Production Security Features

1. **Non-root Users**: All containers run as non-root
2. **SSL/TLS**: HTTPS with modern TLS configuration
3. **Security Headers**: Comprehensive security headers
4. **Rate Limiting**: API and general rate limiting
5. **CORS**: Properly configured CORS policies

### Security Checklist

- [ ] Change default passwords
- [ ] Configure SSL certificates
- [ ] Update domain names in configurations
- [ ] Enable monitoring
- [ ] Configure backup strategies
- [ ] Set up log rotation

## 🔄 Backup and Recovery

### Database Backup

```bash
# Create backup
docker-compose exec database pg_dump -U postgres pakistani_tax_advisor > backup.sql

# Restore backup
docker-compose exec -T database psql -U postgres -d pakistani_tax_advisor < backup.sql
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v pakistani-tax-advisor_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v pakistani-tax-advisor_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ENV` | Environment (development/production) | development | Yes |
| `DEBUG` | Enable debug mode | true | Yes |
| `API_BASE_URL` | Backend API base URL | http://localhost:8000 | Yes |
| `REACT_APP_API_BASE_URL` | Frontend API URL | http://localhost:8000 | Yes |
| `POSTGRES_PASSWORD` | Database password | postgres | Yes |
| `JWT_SECRET` | JWT secret key | - | Yes |
| `CORS_ORIGINS` | Allowed CORS origins | localhost:3000 | Yes |
| `GRAFANA_PASSWORD` | Grafana admin password | - | No |

## 🚀 Quick Start Commands

```bash
# Development
git clone <repository>
cd pakistani-tax-advisor
cp env.template .env.development
docker-compose up -d

# Production
cp env.template .env.production
# Edit .env.production with your settings
docker-compose -f docker-compose.prod.yml up -d
```

## 📞 Support

For issues and questions:

1. Check the troubleshooting section
2. Review container logs
3. Create an issue in the repository
4. Check Docker and Docker Compose documentation

---

**Note**: Remember to replace `yourdomain.com` with your actual domain name in all configuration files before deploying to production. 