# Sleeper API Middleware

A fast, secure, and intelligent API middleware server for the Sleeper fantasy football API. Features simple API key authentication, smart caching, automatic retries, and enhanced player search. Perfect for building AI-powered fantasy football analysis tools.

## ✨ Features

- **🔑 Simple API Key Authentication** - No complex OAuth setup required
- **📊 Complete Sleeper API Proxy** - Full access to all Sleeper endpoints with retry logic
- **⚡ Smart Request Caching** - Automatic caching with configurable TTLs to reduce API calls
- **🔄 Automatic Retries** - Exponential backoff for failed requests
- **🔍 Enhanced Player Search** - Search by name, ID, position, team, or status
- **🚀 Production Ready** - Dockerized with Nginx reverse proxy and security hardening
- **📈 Rate Limiting** - Multiple layers protecting both your server and Sleeper's API
- **📝 Comprehensive Logging** - Winston-based logging with request tracking
- **🏥 Health Monitoring** - Built-in health checks and cache statistics
- **⚡ 2-Minute Setup** - Interactive setup script handles everything automatically

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │───▶│   Express API   │───▶│  Sleeper API    │
│  (Rate Limiting)│    │   (Middleware)  │    │   (External)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   SQLite Cache  │
                       │ (Player Data)   │
                       └─────────────────┘
```

## 🚀 Super Quick Start

### Prerequisites

- Node.js 18+
- Your Sleeper username/user ID (find it at sleeper.app in your profile URL)

### Option 1: Instant Setup (Recommended)

```bash
git clone <your-repo-url>
cd sleeper-api-middleware
npm run quick-start
```

This single command will:
1. Run the interactive setup (< 2 minutes)
2. Install all dependencies  
3. Start the server
4. Generate your API key
5. Show you how to test everything

### Option 2: Step by Step

```bash
git clone <your-repo-url>
cd sleeper-api-middleware
npm install
npm run setup    # Interactive configuration
npm start        # Start the server
```

### 🧪 Test Your Setup

```bash
# Health check (no auth required)
curl http://localhost:3000/health

# Test with your API key (replace YOUR_API_KEY)
curl -H "X-API-Key: YOUR_API_KEY" \
  http://localhost:3000/sleeper/state/nfl

# Search for a player
curl -H "X-API-Key: YOUR_API_KEY" \
  "http://localhost:3000/players/search/name?q=mahomes"
```

## 📚 API Documentation

### Authentication

Most endpoints require authentication via API key. Provide your API key using either:

- **Header:** `X-API-Key: your-api-key-here`
- **Query parameter:** `?api_key=your-api-key-here`

#### Getting Your API Key

Your first API key is generated during setup. To create additional keys:

```bash
# Create new API key (requires master key)
curl -X POST \
  -H "X-Master-Key: YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-sleeper-id", "description": "My AI app key"}' \
  http://localhost:3000/auth/create-key

# Development: Create test key
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "description": "Test key"}' \
  http://localhost:3000/auth/dev-key
```

### Core Endpoints

#### Health Check
```bash
GET /health
```

#### API Information
```bash
GET /
```

### Sleeper API Proxy

All Sleeper API endpoints are available with the same paths under `/sleeper`:

#### User Data
```bash
GET /sleeper/user/:identifier
GET /sleeper/leagues/nfl/2024
GET /sleeper/user/:userId/leagues/nfl/2024
```

#### League Data
```bash
GET /sleeper/league/:leagueId
GET /sleeper/league/:leagueId/rosters
GET /sleeper/league/:leagueId/users
GET /sleeper/league/:leagueId/matchups/:week
GET /sleeper/league/:leagueId/winners_bracket
GET /sleeper/league/:leagueId/transactions
GET /sleeper/league/:leagueId/traded_picks
```

#### Draft Data
```bash
GET /sleeper/league/:leagueId/drafts
GET /sleeper/draft/:draftId
GET /sleeper/draft/:draftId/picks
GET /sleeper/draft/:draftId/traded_picks
```

#### NFL State
```bash
GET /sleeper/state/nfl
```

### Enhanced Player Endpoints

#### Get All Players (Cached)
```bash
GET /players/nfl
```

#### Trending Players (Cached)
```bash
GET /players/nfl/trending/add?limit=25
GET /players/nfl/trending/drop?limit=25
```

#### Player Search
```bash
# Search by player ID
GET /players/search/id/4046

# Search by name
GET /players/search/name?q=mahomes&limit=10

# Search by position
GET /players/search/position/QB?limit=50

# Search by team
GET /players/search/team/KC?limit=50

# Get active players only
GET /players/active?limit=100
```

#### Cache Management
```bash
# Get cache status
GET /players/cache/status

# Force cache refresh
POST /players/cache/refresh
```

### Smart Caching & Performance

The middleware includes intelligent caching to minimize API calls and improve performance:

```bash
# Check cache statistics
curl http://localhost:3000/cache/stats

# Clear all cache
curl -X POST http://localhost:3000/cache/clear

# Clear specific cache pattern
curl -X POST "http://localhost:3000/cache/clear?pattern=players"

# View cache headers in responses
curl -I -H "X-API-Key: YOUR_KEY" \
  http://localhost:3000/players/search/name?q=mahomes
```

**Cache TTLs:**
- Player data: 30 minutes
- League data: 10 minutes  
- Matchups/transactions: 2 minutes
- NFL state: 1 minute

**Cache Features:**
- Automatic expiration and cleanup
- LRU eviction when full (1000 items max)
- Smart cache keys including user context
- Cache hit/miss headers for debugging
- Retry logic with exponential backoff

## 🔧 Configuration

### Environment Variables

The setup script creates your `.env` file automatically, but you can also copy `env.example` to `.env` and configure manually:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Security Keys (auto-generated during setup)
MASTER_KEY=your-auto-generated-master-key
JWT_SECRET=your-auto-generated-jwt-secret

# Your Sleeper Account
DEFAULT_USER_ID=your_sleeper_user_id
DEFAULT_USERNAME=your_sleeper_username

# Database & Cache
DATABASE_PATH=./data/database.sqlite
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=info

# Optional: Disable caching for testing
# DISABLE_CACHE=false
```

### Finding Your Sleeper User ID

1. Go to [sleeper.app](https://sleeper.app)
2. Navigate to your profile
3. Your user ID is in the URL: `sleeper.app/profile/[USER_ID]`

## 🐳 Docker Deployment (Recommended)

### 🚀 **One-Command Deploy**
```bash
# Automated Docker setup (handles everything)
npm run deploy
```

This command:
- ✅ Checks Docker installation
- ✅ Creates secure configuration (.env)
- ✅ Generates encryption keys  
- ✅ Builds Docker images
- ✅ Starts all services (API + Nginx)
- ✅ Creates initial API key
- ✅ Shows connection details

### 🔧 **Manual Docker Commands**
```bash
# Build and start services
npm run docker:up

# View logs
npm run docker:logs

# Stop services  
npm run docker:down

# Restart services
npm run docker:restart

# Clean up (removes volumes)
npm run docker:clean

# SSL certificate management
npm run ssl:generate  # Generate SSL certificates
npm run ssl:status    # Check certificate status
npm run ssl:renew     # Renew certificates
npm run ssl:enable    # Enable SSL
npm run ssl:disable   # Disable SSL
```

### 🛠️ **Development with Docker**
```bash
# Start with hot reload
docker-compose -f docker-compose.dev.yml up -d
```

### 📖 **Detailed Docker Guide**
See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for comprehensive Docker deployment documentation including:
- SSL/HTTPS setup
- Production configuration
- Scaling and load balancing
- Monitoring and troubleshooting
- Backup and recovery

## 🔒 Security Features

- **Rate Limiting**: Multiple layers of rate limiting
- **CORS Protection**: Configurable CORS policies
- **Security Headers**: Helmet.js security headers
- **Input Validation**: Express-validator for all inputs
- **JWT Authentication**: Secure token-based authentication
- **Environment Isolation**: Separate dev/prod configurations

## 📊 Monitoring & Logging

### Health Checks
- Application health: `/health`
- Docker health checks built-in
- Database connectivity monitoring
- Cache status monitoring

### Logging
- Winston-based structured logging
- Different log levels (error, warn, info, debug)
- Request/response logging
- Error tracking with stack traces

### Log Files
- `data/error.log` - Error-level logs only
- `data/combined.log` - All log levels
- Console output in development

## ⚡ Performance Features

### Caching Strategy
- **Player Data**: Cached daily at 6 AM EST
- **Trending Players**: Cached daily (add/drop separately)
- **Smart Refresh**: Auto-refresh on startup if data is stale
- **Background Updates**: Non-blocking cache refreshes

### Rate Limiting
- **General API**: 100 requests per 15 minutes
- **Sleeper Proxy**: 50 requests per minute
- **Auth Endpoints**: 10 requests per 15 minutes
- **Nginx Layer**: Additional protection

## 🛠️ Development

### Scripts
```bash
npm run dev          # Development with hot reload
npm run start        # Production start
npm run setup        # Interactive setup
npm run lint         # ESLint
npm run lint:fix     # ESLint with fixes
npm test             # Run tests
```

### Project Structure
```
src/
├── config/          # Database, logging, passport configuration
├── controllers/     # Route controllers (future expansion)
├── middleware/      # Authentication, rate limiting middleware
├── models/          # Data models (future expansion)
├── routes/          # Express routes
├── services/        # Business logic services
├── utils/           # Utility functions
└── server.js        # Main application entry

nginx/               # Nginx configuration
docker/              # Docker configurations
scripts/             # Deployment and setup scripts
```

## 🔄 Cache Management

The system automatically manages player data caching:

- **Automatic Refresh**: Every day at 6 AM EST
- **Startup Check**: Refreshes if data is stale on startup
- **Manual Refresh**: Via API endpoint for administrators
- **Background Processing**: Non-blocking cache updates

### Cache Status
Check cache status and force refresh:
```bash
# Get status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/players/cache/status

# Force refresh
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/players/cache/refresh
```

## 🌐 Production Deployment

### 🔒 SSL/HTTPS Setup

The deployment script automatically handles SSL configuration. When you deploy with a custom domain, you'll be prompted for SSL setup.

#### **Automatic SSL (Recommended)**
```bash
# During deployment, when prompted:
Domain name: yourdomain.com
Enable SSL/HTTPS with Let's Encrypt? (y/n): y
Email for SSL certificate: your-email@domain.com
```

#### **Manual SSL Management**
```bash
# Generate SSL certificates
npm run ssl:generate

# Check certificate status
npm run ssl:status

# Renew certificates (auto-renewal via cron recommended)
npm run ssl:renew

# Enable/disable SSL
npm run ssl:enable
npm run ssl:disable
```

#### **SSL Requirements**
- ✅ **Valid domain** (not localhost)
- ✅ **Domain points to your server** (DNS configured)
- ✅ **Ports 80 & 443 open** (firewall configured)
- ✅ **Valid email address** (for Let's Encrypt)

#### **Custom Certificates**
For custom SSL certificates, place them in `nginx/ssl/live/yourdomain.com/`:
- `cert.pem` - Certificate file
- `privkey.pem` - Private key file
- `chain.pem` - Certificate chain
- `fullchain.pem` - Full certificate chain

### Domain Configuration

Update your DNS to point to your server:
- `yourdomain.com` → Your server IP
- `api.yourdomain.com` → Your server IP

## 🤝 Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios')

const api = axios.create({
  baseURL: 'http://localhost:3000',  // or your domain
  headers: {
    'X-API-Key': 'YOUR_API_KEY_HERE'
  }
})

// Get your leagues
const leagues = await api.get('/sleeper/leagues/nfl/2024')

// Search for a player
const players = await api.get('/players/search/name?q=mahomes')

// Get trending players
const trending = await api.get('/players/nfl/trending/add')

// Check cache statistics
const cacheStats = await api.get('/cache/stats')
```

### Python
```python
import requests

headers = {'X-API-Key': 'YOUR_API_KEY_HERE'}
base_url = 'http://localhost:3000'  # or your domain

# Get league data
response = requests.get(f'{base_url}/sleeper/leagues/nfl/2024', headers=headers)
leagues = response.json()

# Search players
response = requests.get(f'{base_url}/players/search/name?q=mahomes', headers=headers)
players = response.json()

# Get cached player data
response = requests.get(f'{base_url}/players/nfl', headers=headers)
all_players = response.json()
```

## 🚨 Troubleshooting

### Common Issues

1. **503 Service Unavailable**
   ```bash
   # Check container status
   docker-compose ps
   
   # Check logs
   docker-compose logs sleeper-api
   ```

2. **Rate Limiting Errors**
   ```bash
   # Check nginx logs
   docker-compose logs nginx
   
   # Adjust rate limits in nginx/nginx.conf
   ```

3. **Invalid API Key Errors**
   ```bash
   # Validate your API key
   curl -H "X-API-Key: YOUR_KEY" \
     http://localhost:3000/auth/validate
   
   # Check if key format is correct (64 hex characters)
   echo "YOUR_KEY" | wc -c  # Should be 65 (64 + newline)
   ```

4. **Cache Not Updating**
   ```bash
   # Check cache status
   curl http://localhost:3000/cache/stats
   
   # Force cache refresh
   curl -X POST http://localhost:3000/cache/clear
   ```

5. **Database Issues**
   ```bash
   # Check data volume
   docker volume ls
   
   # Recreate database
   docker-compose down -v
   docker-compose up -d
   ```

### Log Analysis
```bash
# Follow logs in real-time
docker-compose logs -f

# Search logs for errors
docker-compose logs | grep ERROR

# Check specific service
docker-compose logs sleeper-api
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review logs for error details

---

Built with ❤️ for fantasy football enthusiasts and AI developers.
