# 🐳 Docker Deployment Guide

Complete guide for deploying the Sleeper API Middleware using Docker and Docker Compose.

## 🚀 Quick Start

```bash
# Clone and deploy in one command
git clone <your-repo-url>
cd sleeper-api-middleware
npm run deploy
```

**What this does:**
- ✅ Checks Docker installation
- ✅ Creates secure configuration
- ✅ Generates encryption keys
- ✅ Builds Docker images
- ✅ Starts services with smart SSL detection
- ✅ Creates initial API key
- ✅ Offers automated SSL setup (if domain provided)

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

## 🔧 Manual Setup (Alternative)

If you prefer manual control:

```bash
# 1. Create environment file
cp env.example .env
# Edit .env with your configuration

# 2. Build and start services
npm run docker:up

# 3. Create API key manually
curl -X POST http://localhost/auth/dev-key
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

# Sleeper Configuration
SLEEPER_BASE_URL=https://api.sleeper.app/v1

# Database
DATABASE_PATH=/app/data/database.sqlite

# Caching
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=info

# SSL Configuration
ENABLE_SSL=true
SSL_EMAIL=your-email@domain.com
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

## 🔒 SSL/HTTPS Setup

### **Automatic SSL (Recommended)**
The deployment script includes integrated SSL setup:

```bash
# During deployment, when prompted:
Domain name: yourdomain.com
Enable SSL/HTTPS with Let's Encrypt? (y/n): y
Email for SSL certificate: your-email@domain.com
Run SSL certificate setup now? (y/n): y
```

### **Manual SSL Management**
```bash
# Run full SSL setup
npm run ssl:setup

# Individual SSL commands
npm run ssl:generate   # Generate certificates
npm run ssl:status     # Check status
npm run ssl:renew      # Renew certificates
npm run ssl:enable     # Enable SSL
npm run ssl:disable    # Disable SSL
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

## 📊 Monitoring

### **Health & Logs**
```bash
# Check application health
curl http://localhost/health

# View logs
npm run docker:logs
docker-compose logs -f sleeper-api

# Check resource usage
docker stats
```

## 🚀 Production Checklist

**Before deploying:**
- [ ] Domain DNS pointing to server
- [ ] Firewall configured (ports 80, 443)
- [ ] SSL email configured

**Deploy:**
```bash
# Clone and deploy
git clone <repo> /opt/sleeper-api-middleware
cd /opt/sleeper-api-middleware
npm run deploy

# Verify
curl https://your-domain.com/health
```

## 🔄 Backup

```bash
# Backup database
docker-compose exec sleeper-api cp /app/data/database.sqlite /app/data/backup-$(date +%Y%m%d).sqlite

# Backup configuration
tar czf config-backup-$(date +%Y%m%d).tar.gz .env docker-compose.yml nginx/
```

## 🐛 Troubleshooting

### **Common Issues**

**Port conflicts:**
```bash
# Check what's using ports
sudo lsof -i :80
sudo lsof -i :443
```

**Container issues:**
```bash
# Check logs
docker-compose logs sleeper-api

# Rebuild and restart
npm run docker:build
npm run docker:restart
```

**Database issues:**
```bash
# Reset database
docker-compose down -v
npm run docker:up
```

## 📞 Support

**Need help?**
- Check logs: `npm run docker:logs`
- Review the [main README](../README.md)
- Check container status: `docker-compose ps`

---

**🎯 Ready for production deployment!**
