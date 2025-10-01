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
- **🤖 MCP Server** - Model Context Protocol server for Claude integration
- **🌐 Web Accessible** - MCP server accessible from browsers and AI tools

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │───▶│   Express API   │───▶│  Sleeper API    │
│  (Rate Limiting)│    │   (Middleware)  │    │   (External)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │   SQLite Cache  │
         │              │ (Player Data)   │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │───▶│   Express API   │
│ (Claude Access) │    │   (Internal)    │
└─────────────────┘    └─────────────────┘
```

## 🚀 Super Quick Start

### Prerequisites

- **Docker and Docker Compose** (for production deployment)
- **Node.js 18+** (for local development)
- Domain name (for SSL) or localhost for testing

### Option 1: Docker Deployment (Recommended)

```bash
git clone <your-repo-url>
cd sleeper-api-middleware
npm run deploy
```

This single command will:
1. Check Docker installation
2. Run interactive setup (< 2 minutes)
3. Create secure configuration
4. Build Docker images
5. Start services with smart SSL detection
6. Generate your API key
7. Offer automated SSL setup (if domain provided)
8. Show connection details

### Option 2: Local Development

```bash
git clone <your-repo-url>
cd sleeper-api-middleware
npm run quick-start
```

This runs local development without Docker:
1. Interactive setup
2. Install dependencies
3. Start the server locally
4. Generate your API key

### 📋 **Which Option Should I Choose?**

**Use `npm run deploy` (Docker) if:**
- ✅ Deploying to production
- ✅ Need SSL/HTTPS support
- ✅ Want containerized deployment
- ✅ Need reverse proxy (Nginx)
- ✅ Planning to scale

**Use `npm run quick-start` (Local) if:**
- ✅ Just testing/developing
- ✅ Don't need SSL
- ✅ Want to run locally without Docker
- ✅ Quick prototyping

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

#### **Cache Management Commands**
> ⚠️ Cache administration endpoints require the `X-Master-Key` header. Patterns containing advanced regular expressions are only accepted when the master key is provided.
```bash
# Check cache statistics
curl -H "X-Master-Key: YOUR_MASTER_KEY" \
  http://localhost:3000/cache/stats

# Clear all cache
curl -H "X-Master-Key: YOUR_MASTER_KEY" \
  -X POST http://localhost:3000/cache/clear

# Clear specific cache pattern
curl -H "X-Master-Key: YOUR_MASTER_KEY" \
  -X POST "http://localhost:3000/cache/clear?pattern=players"

# View cache headers in responses
curl -I -H "X-API-Key: YOUR_KEY" \
  http://localhost:3000/players/search/name?q=mahomes
```

#### **Cache Configuration**
**TTLs by Data Type:**
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

**Automatic Refresh:**
- Daily refresh at 6 AM EST
- Startup check for stale data
- Background processing (non-blocking)
- Manual refresh via API endpoints

## 🔧 Configuration

### Environment Variables

The setup script creates your `.env` file automatically, but you can also copy `env.example` to `.env` and configure manually:

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Security Keys (auto-generated during setup)
MASTER_KEY=your-auto-generated-master-key

# Sleeper Configuration
SLEEPER_BASE_URL=https://api.sleeper.app/v1

# Database & Cache
DATABASE_PATH=./data/database.sqlite
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=info

# SSL/HTTPS Configuration (for production with custom domain)
DOMAIN=localhost
SSL_EMAIL=your-email@domain.com
ENABLE_SSL=false

# Optional: Disable caching for testing
# DISABLE_CACHE=false
```

### Multi-User Configuration

After deployment, each user configures their own Sleeper account:

1. **Create an API key** using the master key
2. **Set your profile** via `/profile` endpoints
3. **Configure your Sleeper credentials** (user ID and username)

See the [API Documentation](#-api-documentation) for profile management endpoints.

## 🤖 **MCP Server Integration**

The MCP (Model Context Protocol) server provides Claude with direct access to your Sleeper API data through a standardized interface.

### **Available MCP Tools**

#### **Player Tools (7 tools)**
- **`get_all_players`** - Get all NFL players (cached data)
- **`get_trending_players`** - Get trending players (most added/dropped)
- **`search_players_by_id`** - Search for a specific NFL player by Sleeper ID
- **`search_players_by_name`** - Search for NFL players by name
- **`search_players_by_position`** - Search for NFL players by position
- **`search_players_by_team`** - Search for NFL players by team
- **`get_active_players`** - Get only active NFL players

#### **User Tools (3 tools)**
- **`get_user_info`** - Get information about a Sleeper user
- **`get_user_leagues`** - Get fantasy football leagues for a specific user
- **`get_my_leagues`** - Get fantasy football leagues for the authenticated user

#### **League Tools (7 tools)**
- **`get_league_info`** - Get detailed information about a specific league
- **`get_league_rosters`** - Get all rosters for a specific league
- **`get_league_users`** - Get all users in a specific league
- **`get_league_matchups`** - Get matchups for a specific league and week
- **`get_league_playoff_bracket`** - Get playoff bracket for a specific league
- **`get_league_transactions`** - Get transactions for a specific league
- **`get_league_traded_picks`** - Get traded picks for a specific league

#### **Draft Tools (5 tools)**
- **`get_user_drafts`** - Get drafts for a specific user
- **`get_league_drafts`** - Get drafts for a specific league
- **`get_draft_info`** - Get detailed information about a specific draft
- **`get_draft_picks`** - Get all picks for a specific draft
- **`get_draft_traded_picks`** - Get traded picks for a specific draft

#### **Profile Tools (5 tools)**
- **`get_my_profile`** - Get the authenticated user's profile information
- **`update_my_profile`** - Update the authenticated user's profile information
- **`delete_my_profile`** - Delete the authenticated user's profile (reset to defaults)
- **`verify_sleeper_user`** - Verify a Sleeper user ID exists and get their information
- **`get_profile_status`** - Get profile status and recommendations for the authenticated user

#### **System Tools (1 tool)**
- **`get_nfl_state`** - Get current NFL state information (season, week, etc.)

**Total: 28 MCP Tools** covering all available API endpoints

### **Claude Integration**

#### **Browser-Based Claude**
```javascript
// Each user provides their own API key
const mcpClient = {
  baseUrl: 'https://yourdomain.com/mcp',
  apiKey: 'your-personal-api-key', // User's own API key
  
  async callTool(toolName, args) {
    const response = await fetch(`${this.baseUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({ name: toolName, arguments: args })
    })
    return await response.json()
  }
}

// Usage - each user uses their own API key
const playerStats = await mcpClient.callTool('get_player_stats', { 
  playerId: '12345', 
  season: '2024' 
})

// Alternative: Pass API key in arguments
const playerStats2 = await mcpClient.callTool('get_player_stats', { 
  playerId: '12345', 
  season: '2024',
  apiKey: 'different-user-api-key'
})
```

#### **MCP Client Library**
```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const transport = new SSEClientTransport('https://yourdomain.com/mcp')
const client = new Client({
  name: 'claude-browser',
  version: '1.0.0'
}, { capabilities: {} })

await client.connect(transport)
const result = await client.callTool('get_player_stats', { playerId: '12345' })
```

### **MCP Server Features**

- ✅ **MCP Compliant** - Follows official MCP specification
- ✅ **Web Accessible** - Can be accessed from browsers via HTTP/HTTPS
- ✅ **Isolated** - Runs in separate container with error isolation
- ✅ **Rate Limited** - Separate rate limiting from main API
- ✅ **CORS Enabled** - Supports cross-origin requests

### **MCP Endpoints**

- **Health Check**: `GET /mcp/health`
- **MCP Info**: `GET /mcp/`
- **List Tools**: `POST /mcp/tools/list`
- **Call Tool**: `POST /mcp/tools/call`

### **User API Key Management**

Each user can use their own API key with the MCP server:

#### **API Key Sources (both required):**
1. **X-API-Key header** - `X-API-Key: your-api-key`
2. **apiKey parameter** - `{ "apiKey": "your-api-key" }`

**Note:** API key is required for all requests. No server default is provided.

#### **Benefits:**
- ✅ **Individual user accounts** - Each user accesses their own data
- ✅ **Rate limiting per user** - Based on individual API keys
- ✅ **User isolation** - Users only see their own leagues and data
- ✅ **Flexible authentication** - Header or parameter-based

## 🔧 **Docker Commands**

### **Manual Docker Commands**
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
npm run ssl:setup      # Run full SSL setup
npm run ssl:generate   # Generate SSL certificates
npm run ssl:status     # Check certificate status
npm run ssl:renew      # Renew certificates
npm run ssl:enable     # Enable SSL
npm run ssl:disable    # Disable SSL
```


### **Detailed Docker Guide**
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
├── config/          # Database and logging configuration
├── middleware/      # Authentication, rate limiting, caching middleware
├── routes/          # Express route handlers
├── services/        # Business logic services
├── utils/           # Utility functions
└── server.js        # Main application entry

nginx/               # Nginx configuration and templates
scripts/             # Deployment and setup scripts
tests/               # Automated and manual testing
├── automated/       # Jest test suites
└── postman/         # Postman collections and guides
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
# Run full SSL setup (recommended)
npm run ssl:setup

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

// Check cache statistics (requires master key)
const cacheStats = await api.get('/cache/stats', {
  headers: { 'X-Master-Key': 'YOUR_MASTER_KEY_HERE' }
})
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
   curl -H "X-Master-Key: YOUR_MASTER_KEY" \
     http://localhost:3000/cache/stats

   # Force cache refresh
   curl -H "X-Master-Key: YOUR_MASTER_KEY" \
     -X POST http://localhost:3000/cache/clear
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
