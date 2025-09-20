# Sleeper API MCP Server

This is a Model Context Protocol (MCP) server that provides Claude with access to the Sleeper API through a standardized interface.

## Features

- **MCP Compliant**: Follows the official MCP specification
- **Web Accessible**: Can be accessed from browsers via HTTP/HTTPS
- **Isolated**: Runs in its own container with error isolation
- **Rate Limited**: Separate rate limiting from the main API
- **CORS Enabled**: Supports cross-origin requests from browsers

## Available Tools

### Player Tools (7 tools)
- `get_all_players` - Get all NFL players (cached data)
- `get_trending_players` - Get trending players (most added/dropped)
- `search_players_by_id` - Search for a specific NFL player by Sleeper ID
- `search_players_by_name` - Search for NFL players by name
- `search_players_by_position` - Search for NFL players by position
- `search_players_by_team` - Search for NFL players by team
- `get_active_players` - Get only active NFL players

### User Tools (3 tools)
- `get_user_info` - Get information about a Sleeper user
- `get_user_leagues` - Get fantasy football leagues for a specific user
- `get_my_leagues` - Get fantasy football leagues for the authenticated user

### League Tools (7 tools)
- `get_league_info` - Get detailed information about a specific league
- `get_league_rosters` - Get all rosters for a specific league
- `get_league_users` - Get all users in a specific league
- `get_league_matchups` - Get matchups for a specific league and week
- `get_league_playoff_bracket` - Get playoff bracket for a specific league
- `get_league_transactions` - Get transactions for a specific league
- `get_league_traded_picks` - Get traded picks for a specific league

### Draft Tools (5 tools)
- `get_user_drafts` - Get drafts for a specific user
- `get_league_drafts` - Get drafts for a specific league
- `get_draft_info` - Get detailed information about a specific draft
- `get_draft_picks` - Get all picks for a specific draft
- `get_draft_traded_picks` - Get traded picks for a specific draft

### Profile Tools (5 tools)
- `get_my_profile` - Get the authenticated user's profile information
- `update_my_profile` - Update the authenticated user's profile information
- `delete_my_profile` - Delete the authenticated user's profile (reset to defaults)
- `verify_sleeper_user` - Verify a Sleeper user ID exists and get their information
- `get_profile_status` - Get profile status and recommendations for the authenticated user

### System Tools (1 tool)
- `get_nfl_state` - Get current NFL state information (season, week, etc.)

**Total: 28 MCP Tools** covering all available API endpoints

## Configuration

### Environment Variables

- `API_BASE_URL` - URL of the main Sleeper API server (default: http://sleeper-api:3000)
- `HTTP_PORT` - Port for health check endpoint (default: 3001)
- `MCP_PORT` - Port for MCP server (default: 3002)
- `LOG_LEVEL` - Logging level (default: info)
- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins (default: *)

**Note:** No server-side API key is required. Users must provide their own API keys for authentication.

### Docker Configuration

The MCP server is configured to:
- **Restart on failure** with exponential backoff
- **Isolate errors** - failures won't affect other containers
- **Health check** - monitors server status
- **Depend on main API** - waits for API to be healthy

## Usage

### Health Check
```bash
curl https://yourdomain.com/mcp/health
```

### MCP Info
```bash
curl https://yourdomain.com/mcp/
```

### Tool List
```bash
curl -X POST https://yourdomain.com/mcp/tools/list
```

### Tool Call with API Key in Header (Required)
```bash
curl -X POST https://yourdomain.com/mcp/tools/call \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-personal-api-key" \
  -d '{
    "name": "get_player_stats",
    "arguments": {
      "playerId": "12345",
      "season": "2024"
    }
  }'
```

### Tool Call with API Key in Parameters (Required)
```bash
curl -X POST https://yourdomain.com/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_player_stats",
    "arguments": {
      "playerId": "12345",
      "season": "2024",
      "apiKey": "your-personal-api-key"
    }
  }'
```

**Important:** API key is required for all tool calls. Requests without an API key will be rejected.

## Claude Integration

### Browser-Based Claude
```javascript
// Direct API integration - each user provides their own API key
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
      body: JSON.stringify({
        name: toolName,
        arguments: args
      })
    })
    return await response.json()
  }
}

// Usage - each user uses their own API key
const playerStats = await mcpClient.callTool('get_player_stats', { 
  playerId: '12345', 
  season: '2024' 
})

// Alternative: Pass API key in arguments for different users
const playerStats2 = await mcpClient.callTool('get_player_stats', { 
  playerId: '12345', 
  season: '2024',
  apiKey: 'different-user-api-key'
})
```

### MCP Client Library
```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const transport = new SSEClientTransport('https://yourdomain.com/mcp')
const client = new Client({
  name: 'claude-browser',
  version: '1.0.0'
}, {
  capabilities: {}
})

await client.connect(transport)
const result = await client.callTool('get_player_stats', { playerId: '12345' })
```

## Error Handling

The MCP server includes comprehensive error handling:
- **API failures** are caught and returned as MCP errors
- **Invalid tool calls** return descriptive error messages
- **Network timeouts** are handled gracefully
- **Container isolation** prevents errors from affecting other services

## Rate Limiting

- **MCP endpoints**: 5 requests/second with burst of 10
- **Separate from main API** rate limiting
- **CORS preflight** requests are not rate limited

## Monitoring

- **Health check** endpoint at `/mcp/health`
- **Structured logging** with timestamps and levels
- **Docker health checks** monitor container status
- **Error tracking** for debugging and monitoring
