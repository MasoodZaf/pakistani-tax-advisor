# 🚀 Pakistani Tax Advisor - Deployment Guide

Complete deployment guide for tax consultants and system administrators.

## 📋 Prerequisites

Before deploying the Pakistani Tax Advisor system, ensure you have:

### System Requirements
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: 5GB free space
- **Network**: Internet connection for initial setup

### Software Requirements
- **Node.js**: Version 18.x or higher ([Download](https://nodejs.org/))
- **PostgreSQL**: Version 12 or higher ([Download](https://www.postgresql.org/))
- **Git**: For cloning the repository ([Download](https://git-scm.com/))

### Optional (for Docker deployment)
- **Docker**: Version 20.x+ ([Download](https://www.docker.com/))
- **Docker Compose**: Usually included with Docker Desktop

## 🎯 Deployment Options

Choose the deployment method that best fits your needs:

### Option 1: Automated Setup (Recommended)
**Best for**: Quick setup, testing, and small-scale deployment

```bash
git clone https://github.com/MasoodZaf/pakistani-tax-advisor.git
cd pakistani-tax-advisor
chmod +x setup.sh
./setup.sh
```

### Option 2: Docker Deployment  
**Best for**: Production, isolated environments, and scaling

```bash
git clone https://github.com/MasoodZaf/pakistani-tax-advisor.git
cd pakistani-tax-advisor
docker-compose up -d
```

### Option 3: Manual Setup
**Best for**: Custom configurations and advanced users

See detailed manual setup instructions below.

## 🛠️ Manual Setup Instructions

### Step 1: Clone Repository
```bash
git clone https://github.com/MasoodZaf/pakistani-tax-advisor.git
cd pakistani-tax-advisor
```

### Step 2: Database Setup

#### Install PostgreSQL
**macOS (with Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Create Database
```bash
# Create database
createdb tax_advisor

# Run migrations
psql -d tax_advisor -f database/migrate-2025-26.sql
```

### Step 3: Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your settings:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=tax_advisor
# DB_USER=postgres
# DB_PASSWORD=your_password
# JWT_SECRET=your-random-secret-key

# Start backend
npm start
```

### Step 4: Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start frontend
npm start
```

## 🐳 Docker Deployment (Production Ready)

### Prerequisites
- Docker and Docker Compose installed
- 8GB+ RAM recommended for production

### Quick Start
```bash
# Clone repository
git clone https://github.com/MasoodZaf/pakistani-tax-advisor.git
cd pakistani-tax-advisor

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Docker Services
- **Database**: PostgreSQL 14 with automatic migrations
- **Backend**: Node.js API server with health checks
- **Frontend**: Nginx-served React app with optimized configuration

### Docker Management Commands
```bash
# Stop all services
docker-compose down

# Restart specific service
docker-compose restart backend

# Update and restart
git pull
docker-compose build
docker-compose up -d

# Backup database
docker exec tax_advisor_db pg_dump -U postgres tax_advisor > backup_$(date +%Y%m%d).sql

# Restore database
docker exec -i tax_advisor_db psql -U postgres tax_advisor < backup_20240101.sql
```

## 🌐 Production Deployment

### Environment Configuration

#### Backend Environment (.env)
```env
# Database Configuration  
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tax_advisor
DB_USER=postgres
DB_PASSWORD=secure_password_here
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000

# Application Configuration
NODE_ENV=production
JWT_SECRET=your-super-secure-random-jwt-secret-key-minimum-32-characters
PORT=3001

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Security
SESSION_TIMEOUT=24h
MAX_LOGIN_ATTEMPTS=5
```

#### Frontend Configuration
- Automatically configured to connect to backend
- Built-in axios baseURL configuration
- Optimized production build with code splitting

### SSL/HTTPS Setup

#### Using Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Using Cloudflare or Load Balancer
- Configure DNS to point to your server
- Enable SSL/TLS encryption
- Set up automatic certificate renewal

### Database Optimization

#### PostgreSQL Configuration
```sql
-- For production performance
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Restart PostgreSQL after changes
```

#### Regular Maintenance
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres tax_advisor > /backups/tax_advisor_$DATE.sql
find /backups -name "tax_advisor_*.sql" -mtime +7 -delete

# Weekly VACUUM and ANALYZE
psql -d tax_advisor -c "VACUUM ANALYZE;"
```

## 📊 Monitoring & Maintenance

### Health Checks
- **Backend Health**: http://localhost:3001/api/health
- **Database**: `pg_isready -h localhost -p 5432`
- **Frontend**: http://localhost:3000

### Log Files
- **Backend**: `backend/logs/app.log`
- **PostgreSQL**: Check system logs (`/var/log/postgresql/`)
- **Docker**: `docker-compose logs`

### Performance Monitoring
```bash
# Monitor system resources
htop

# Monitor database connections
psql -d tax_advisor -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor application logs
tail -f backend/logs/app.log

# Docker monitoring
docker stats
```

## 🔒 Security Considerations

### Essential Security Measures
1. **Strong Passwords**: Use complex passwords for database and admin accounts
2. **JWT Secret**: Use a strong, random JWT secret (32+ characters)
3. **Database Access**: Restrict database access to localhost only
4. **SSL/TLS**: Use HTTPS in production
5. **Firewall**: Configure firewall to block unnecessary ports
6. **Updates**: Keep all dependencies updated regularly

### Security Checklist
- [ ] Changed default database password
- [ ] Generated strong JWT secret
- [ ] Enabled HTTPS/SSL
- [ ] Configured firewall rules
- [ ] Set up regular backups
- [ ] Limited database user permissions
- [ ] Enabled audit logging
- [ ] Regular security updates

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Error
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U postgres -d tax_advisor

# Reset password if needed
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'newpassword';"
```

#### Port Already in Use
```bash
# Find process using port
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:5432 | xargs kill -9  # PostgreSQL
```

#### Frontend Build Errors
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

#### Docker Issues
```bash
# Reset Docker environment
docker-compose down -v
docker system prune -a
docker-compose up -d

# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs database
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- **Daily**: Check system health and logs
- **Weekly**: Database backup and cleanup
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Full system backup and disaster recovery test

### Getting Help
1. **Check Logs**: Always check application and system logs first
2. **GitHub Issues**: Create detailed issue reports
3. **Documentation**: Review API documentation and user guides
4. **Community**: Join the discussion on GitHub

### Professional Support
For production deployments and professional support:
- Contact: [Your Support Email]
- Documentation: Available in `/docs` folder
- Emergency Support: [Your Emergency Contact]

---

**🎯 Production-Ready Pakistani Tax Advisor System**  
**🔒 Secure, Scalable, and Professional**  
**🇵🇰 Built for Pakistani Tax Consultants**