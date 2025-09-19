# 🐳 Docker Deployment Guide

Complete guide for deploying the Sleeper API Middleware using Docker and Docker Compose.

## 🚀 Quick Start (Recommended)

### **One-Command Deploy**
```bash
npm run deploy
```

This runs the Docker setup script that:
- ✅ Checks Docker installation
- ✅ Creates secure environment configuration
- ✅ Generates encryption keys
- ✅ Builds Docker images
- ✅ Starts all services
- ✅ Creates initial API key
- ✅ Provides connection details

## 📋 Prerequisites

### **Required Software**
- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** v2.0+
- **Git** (to clone the repository)

### **System Requirements**
- **Memory**: 512MB+ available RAM
- **Disk**: 2GB+ free space
- **Network**: Ports 80, 443 available (or configure alternatives)

### **Installation Check**
```bash
# Verify Docker installation
docker --version
docker-compose --version

# Test Docker functionality
docker run hello-world
```

## 🏗️ Deployment Methods

### **Method 1: Automated Setup (Recommended)**
```bash
# Clone repository
git clone <your-repo-url>
cd sleeper-api-middleware

# Run automated Docker setup
npm run deploy
```

### **Method 2: Manual Setup**
```bash
# 1. Create environment file
cp env.example .env
# Edit .env with your configuration

# 2. Build images
npm run docker:build

# 3. Start services
npm run docker:up

# 4. Create API key manually
curl -X POST http://localhost/auth/dev-key
```

### **Method 3: Development Mode**
```bash
# Use development Docker Compose
docker-compose -f docker-compose.dev.yml up -d
```

## ⚙️ Configuration Options

### **Environment Variables (.env)**
```env
# Core Configuration
NODE_ENV=production
PORT=3000
DOMAIN=your-domain.com

# Security (auto-generated)
MASTER_KEY=your-generated-master-key
JWT_SECRET=your-generated-jwt-secret

# Sleeper Account (optional)
DEFAULT_USER_ID=your-sleeper-user-id
DEFAULT_USERNAME=your-sleeper-username

# Database
DATABASE_PATH=/app/data/database.sqlite

# Caching
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=info
```

### **Docker-Specific (.env.docker)**
```env
# Docker Configuration
COMPOSE_PROJECT_NAME=sleeper-api-middleware
DOCKER_BUILDKIT=1
DOMAIN=your-domain.com
```

## 🔧 Service Management

### **Basic Commands**
```bash
# Start services
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs

# Restart services
npm run docker:restart

# Clean up (removes volumes)
npm run docker:clean
```

### **Advanced Docker Commands**
```bash
# Build without cache
docker-compose build --no-cache

# Scale API service
docker-compose up -d --scale sleeper-api=3

# Execute commands in container
docker-compose exec sleeper-api sh

# View resource usage
docker stats

# Inspect container
docker-compose exec sleeper-api env
```

## 🏃‍♂️ Service Architecture

### **Services Overview**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │───▶│   Express API   │───▶│  Sleeper API    │
│  (Port 80/443)  │    │   (Port 3000)   │    │   (External)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   SSL Certs     │    │   SQLite DB     │
│   (Volume)      │    │   (Volume)      │
└─────────────────┘    └─────────────────┘
```

### **Container Details**

#### **sleeper-api** (Main Application)
- **Image**: Custom Node.js application
- **Port**: 3000 (internal)
- **Volumes**: 
  - `api_data:/app/data` (database)
  - `./logs:/app/logs` (log files)
- **Health Check**: `GET /health`

#### **nginx** (Reverse Proxy)
- **Image**: Custom Nginx with configuration
- **Ports**: 80, 443
- **Volumes**:
  - `./nginx/ssl:/etc/nginx/ssl` (SSL certificates)
  - `./nginx/logs:/var/log/nginx` (nginx logs)
- **Features**: Rate limiting, SSL termination, static file serving

#### **certbot** (SSL Certificates)
- **Image**: `certbot/certbot`
- **Purpose**: Automatic SSL certificate generation (production)
- **Profile**: `production` (optional service)

## 🔒 Security Configuration

### **SSL/HTTPS Setup**

#### **Development (Self-Signed)**
```bash
# Generate self-signed certificates
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Org/CN=localhost"
```

#### **Production (Let's Encrypt)**
```bash
# Update domain in .env
echo "DOMAIN=your-domain.com" >> .env

# Start certbot service
docker-compose --profile production up certbot

# Restart nginx with SSL
npm run docker:restart
```

### **API Key Management**
```bash
# Create API key (inside container)
docker-compose exec sleeper-api node -e "
  const db = require('./src/config/database');
  const crypto = require('crypto');
  (async () => {
    await db.connect();
    const key = crypto.randomBytes(32).toString('hex');
    await db.createAPIKey(key, 'admin', 'Production key');
    console.log('API Key:', key);
  })();
"

# Or use the API endpoint
curl -X POST http://localhost/auth/dev-key \
  -H "Content-Type: application/json" \
  -d '{"userId": "admin", "description": "Production API key"}'
```

## 📊 Monitoring & Logging

### **Health Checks**
```bash
# Application health
curl http://localhost/health

# Container health status
docker-compose ps

# Detailed health information
docker inspect sleeper-api-middleware | grep -A 5 Health
```

### **Log Management**
```bash
# View all logs
npm run docker:logs

# View specific service logs
docker-compose logs -f sleeper-api
docker-compose logs -f nginx

# Log files location
ls -la logs/           # Application logs
ls -la nginx/logs/     # Nginx logs
```

### **Performance Monitoring**
```bash
# Resource usage
docker stats

# Container metrics
docker-compose top

# Database size
docker-compose exec sleeper-api du -sh /app/data/
```

## 🚀 Production Deployment

### **Pre-Deployment Checklist**
- [ ] Domain DNS pointing to server
- [ ] Firewall configured (ports 80, 443)
- [ ] SSL certificates ready or Let's Encrypt configured
- [ ] Environment variables secured
- [ ] Backup strategy in place
- [ ] Monitoring configured

### **Deployment Steps**
```bash
# 1. Clone on production server
git clone <repo> /opt/sleeper-api-middleware
cd /opt/sleeper-api-middleware

# 2. Run production setup
NODE_ENV=production npm run deploy

# 3. Configure SSL (if not using Let's Encrypt)
# Copy SSL certificates to nginx/ssl/

# 4. Start with SSL profile
docker-compose --profile production up -d

# 5. Verify deployment
curl https://your-domain.com/health
```

### **Auto-Updates with Watchtower**
```yaml
# Add to docker-compose.yml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 3600 --cleanup
```

## 🔄 Backup & Recovery

### **Data Backup**
```bash
# Backup database
docker-compose exec sleeper-api cp /app/data/database.sqlite /app/data/backup-$(date +%Y%m%d).sqlite

# Copy backup to host
docker cp sleeper-api-middleware:/app/data/backup-$(date +%Y%m%d).sqlite ./backup/

# Backup entire data volume
docker run --rm -v sleeper-api-middleware_api_data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### **Configuration Backup**
```bash
# Backup configuration files
tar czf config-backup-$(date +%Y%m%d).tar.gz .env .env.docker docker-compose.yml nginx/
```

### **Recovery**
```bash
# Restore data volume
docker run --rm -v sleeper-api-middleware_api_data:/data -v $(pwd):/backup alpine tar xzf /backup/data-backup-YYYYMMDD.tar.gz -C /data

# Restart services
npm run docker:restart
```

## 🐛 Troubleshooting

### **Common Issues**

#### **Port Already in Use**
```bash
# Check what's using port 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2
sudo systemctl stop nginx
```

#### **Permission Denied**
```bash
# Fix Docker permissions (Linux)
sudo usermod -aG docker $USER
newgrp docker

# Fix volume permissions
sudo chown -R $USER:$USER data/ logs/
```

#### **Container Won't Start**
```bash
# Check container logs
docker-compose logs sleeper-api

# Check Docker daemon
sudo systemctl status docker

# Rebuild images
npm run docker:build
```

#### **Database Issues**
```bash
# Reset database
docker-compose down -v
docker volume rm sleeper-api-middleware_api_data
npm run docker:up
```

#### **SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/fullchain.pem -text -noout

# Regenerate self-signed certificates
rm nginx/ssl/*.pem
# Run SSL setup commands above
```

### **Debug Mode**
```bash
# Start with debug logging
docker-compose exec sleeper-api \
  env LOG_LEVEL=debug node src/server.js

# Inspect container filesystem
docker-compose exec sleeper-api sh
```

### **Performance Issues**
```bash
# Check resource usage
docker stats

# Increase container resources (if using Docker Desktop)
# Go to Settings > Resources > Advanced

# Check database performance
docker-compose exec sleeper-api \
  sqlite3 /app/data/database.sqlite "PRAGMA optimize;"
```

## 📈 Scaling & Load Balancing

### **Horizontal Scaling**
```bash
# Scale API service
docker-compose up -d --scale sleeper-api=3

# Nginx will automatically load balance
```

### **External Load Balancer**
```yaml
# docker-compose.yml modification for external LB
services:
  sleeper-api:
    ports:
      - "3000-3002:3000"  # Expose multiple ports
```

## 🔧 Customization

### **Custom Nginx Configuration**
Edit `nginx/nginx.conf` and rebuild:
```bash
npm run docker:build
npm run docker:restart
```

### **Custom Environment**
Create custom Docker Compose file:
```yaml
# docker-compose.custom.yml
version: '3.8'
services:
  sleeper-api:
    environment:
      - CUSTOM_SETTING=value
```

Run with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.custom.yml up -d
```

## 📞 Support

### **Getting Help**
- Check logs: `npm run docker:logs`
- Review this guide
- Check GitHub issues
- Container status: `docker-compose ps`

### **Reporting Issues**
Include this information:
```bash
# System info
docker --version
docker-compose --version
uname -a

# Container status
docker-compose ps
docker-compose logs --tail=50
```

---

**🎯 This Docker deployment provides a production-ready, secure, and scalable API middleware solution!**
