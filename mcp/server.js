#!/usr/bin/env node

/**
 * MCP Server for Sleeper API
 * Provides standardized MCP interface to Sleeper API middleware
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const NodeCache = require('node-cache')

const app = express()

// Configuration validation and setup
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://sleeper-api:3000',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  HTTP_PORT: parseInt(process.env.HTTP_PORT) || 3001,
  MCP_PORT: parseInt(process.env.MCP_PORT) || 3002,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 600, // 10 minutes
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 10000
}

// Validate critical configuration
function validateConfig() {
  const errors = []
  
  if (!CONFIG.API_BASE_URL.startsWith('http')) {
    errors.push('API_BASE_URL must be a valid HTTP URL')
  }
  
  if (CONFIG.HTTP_PORT < 1 || CONFIG.HTTP_PORT > 65535) {
    errors.push('HTTP_PORT must be between 1 and 65535')
  }
  
  if (CONFIG.MCP_PORT < 1 || CONFIG.MCP_PORT > 65535) {
    errors.push('MCP_PORT must be between 1 and 65535')
  }
  
  if (errors.length > 0) {
    log('error', 'Configuration validation failed', { errors })
    process.exit(1)
  }
  
  log('info', 'Configuration validated successfully', {
    apiBaseUrl: CONFIG.API_BASE_URL,
    httpPort: CONFIG.HTTP_PORT,
    mcpPort: CONFIG.MCP_PORT,
    nodeEnv: CONFIG.NODE_ENV
  })
}

// Initialize cache
const cache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL })

// CORS configuration for browser access
app.use(cors({
  origin: CONFIG.CORS_ORIGINS,
  credentials: true,
  optionsSuccessStatus: 200
}))

app.use(express.json())

// Enhanced logging function
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...data
  }
  
  // Filter sensitive data in production
  if (CONFIG.NODE_ENV === 'production') {
    delete logData.apiKey
    delete logData.apiKeyPrefix
  }
  
  console.log(JSON.stringify(logData))
}

// Input validation schemas
const VALIDATION_SCHEMAS = {
  get_trending_players: {
    type: { required: true, enum: ['add', 'drop'] },
    lookback_hours: { min: 1, max: 168 },
    limit: { min: 1, max: 100 }
  },
  search_players_by_name: {
    query: { required: true, minLength: 1 },
    limit: { min: 1, max: 50 }
  },
  search_players_by_position: {
    position: { required: true, enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] },
    limit: { min: 1, max: 100 }
  },
  get_league_matchups: {
    leagueId: { required: true },
    week: { required: true, min: 1, max: 18 }
  }
}

// Input validation function
function validateArgs(toolName, args) {
  const schema = VALIDATION_SCHEMAS[toolName]
  if (!schema) return { valid: true }
  
  const errors = []
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = args[field]
    
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`)
      continue
    }
    
    if (value !== undefined) {
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`)
      }
      
      if (rules.min && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`)
      }
      
      if (rules.max && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`)
      }
      
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`)
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// Standardized response formatters
function formatToolResponse(data, metadata = {}) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          success: true,
          ...metadata
        }
      }, null, 2)
    }],
    isError: false
  }
}

function formatError(error, toolName, metadata = {}) {
  const errorResponse = {
    error: CONFIG.NODE_ENV === 'production' ? 'Operation failed' : error.message,
    tool: toolName,
    timestamp: new Date().toISOString(),
    ...metadata
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(errorResponse, null, 2)
    }],
    isError: true
  }
}

// Enhanced API call function
async function callSleeperAPI(endpoint, method = 'GET', data = null, apiKey = null, useCache = false) {
  try {
    // Require API key - no fallback
    if (!apiKey) {
      throw new Error('API key is required. Please provide an API key via X-API-Key header or apiKey parameter.')
    }

    // Check cache for GET requests
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(data || {})}`
    if (useCache && method === 'GET') {
      const cached = cache.get(cacheKey)
      if (cached) {
        log('debug', `Cache hit for: ${endpoint}`, { endpoint })
        return {
          success: true,
          data: cached,
          status: 200,
          cached: true
        }
      }
    }

    const config = {
      method,
      url: `${CONFIG.API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: CONFIG.REQUEST_TIMEOUT
    }

    if (data) {
      config.data = data
    }

    log('debug', `Calling Sleeper API: ${method} ${endpoint}`, {
      endpoint,
      method,
      hasData: !!data,
      apiKeyProvided: !!apiKey
    })
    
    const response = await axios(config)
    
    log('debug', `Sleeper API response: ${response.status}`, {
      endpoint,
      status: response.status,
      dataSize: JSON.stringify(response.data).length
    })

    // Cache successful GET responses
    if (useCache && method === 'GET' && response.status === 200) {
      cache.set(cacheKey, response.data)
    }

    return {
      success: true,
      data: response.data,
      status: response.status,
      cached: false
    }
  } catch (error) {
    const errorDetails = {
      endpoint,
      method,
      status: error.response?.status,
      apiKeyProvided: !!apiKey
    }
    
    // Don't log sensitive error details in production
    if (CONFIG.NODE_ENV !== 'production') {
      errorDetails.errorData = error.response?.data
    }
    
    log('error', `Sleeper API call failed: ${endpoint}`, errorDetails)

    return {
      success: false,
      error: error.message,
      status: error.response?.status || 500,
      data: error.response?.data
    }
  }
}

// MCP Server configuration
const mcpServer = new Server(
  {
    name: 'sleeper-api-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
)

// MCP Tools definition (unchanged for brevity, but could be moved to separate file)
const MCP_TOOLS = [
  // Player Tools
  {
    name: 'get_all_players',
    description: 'Get all NFL players (cached data)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (default: 100)',
          minimum: 1,
          maximum: 1000
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },
  {
    name: 'get_trending_players',
    description: 'Get trending players (most added or dropped)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['add', 'drop'], 
          description: 'Trending type: "add" for most added, "drop" for most dropped' 
        },
        lookback_hours: { 
          type: 'number', 
          description: 'Hours to look back for trending data (1-168)',
          minimum: 1,
          maximum: 168
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-100)',
          minimum: 1,
          maximum: 100
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['type']
    }
  },
  {
    name: 'search_players_by_id',
    description: 'Search for a specific NFL player by their Sleeper ID',
    inputSchema: {
      type: 'object',
      properties: {
        playerId: { 
          type: 'string', 
          description: 'Sleeper player ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['playerId']
    }
  },
  {
    name: 'search_players_by_name',
    description: 'Search for NFL players by name',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search term (player name)' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-50)',
          minimum: 1,
          maximum: 50
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_players_by_position',
    description: 'Search for NFL players by position',
    inputSchema: {
      type: 'object',
      properties: {
        position: { 
          type: 'string', 
          description: 'Player position',
          enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-100)',
          minimum: 1,
          maximum: 100
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['position']
    }
  },
  {
    name: 'search_players_by_team',
    description: 'Search for NFL players by team',
    inputSchema: {
      type: 'object',
      properties: {
        team: { 
          type: 'string', 
          description: 'Team abbreviation (e.g., "KC", "SF")' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-100)',
          minimum: 1,
          maximum: 100
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['team']
    }
  },
  {
    name: 'get_active_players',
    description: 'Get only active NFL players',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-200)',
          minimum: 1,
          maximum: 200
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },

  // User Tools
  {
    name: 'get_user_info',
    description: 'Get information about a Sleeper user',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { 
          type: 'string', 
          description: 'Sleeper user ID or username' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['identifier']
    }
  },
  {
    name: 'get_user_leagues',
    description: 'Get fantasy football leagues for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { 
          type: 'string', 
          description: 'Sleeper user ID' 
        },
        sport: { 
          type: 'string', 
          description: 'Sport (currently only "nfl" supported)',
          enum: ['nfl'],
          default: 'nfl'
        },
        season: { 
          type: 'string', 
          description: 'Fantasy season year (e.g., "2024")',
          default: '2024'
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_my_leagues',
    description: 'Get fantasy football leagues for the authenticated user (uses their profile)',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { 
          type: 'string', 
          description: 'Sport (currently only "nfl" supported)',
          enum: ['nfl'],
          default: 'nfl'
        },
        season: { 
          type: 'string', 
          description: 'Fantasy season year (e.g., "2024")',
          default: '2024'
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },

  // League Tools
  {
    name: 'get_league_info',
    description: 'Get detailed information about a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_rosters',
    description: 'Get all rosters for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_users',
    description: 'Get all users in a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_matchups',
    description: 'Get matchups for a specific league and week',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        week: { 
          type: 'number', 
          description: 'Week number (1-18)',
          minimum: 1,
          maximum: 18
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId', 'week']
    }
  },
  {
    name: 'get_league_playoff_bracket',
    description: 'Get playoff bracket for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_transactions',
    description: 'Get transactions for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        round: { 
          type: 'number', 
          description: 'Transaction round (optional)' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_traded_picks',
    description: 'Get traded picks for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },

  // Draft Tools
  {
    name: 'get_user_drafts',
    description: 'Get drafts for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { 
          type: 'string', 
          description: 'Sleeper user ID' 
        },
        sport: { 
          type: 'string', 
          description: 'Sport (currently only "nfl" supported)',
          enum: ['nfl'],
          default: 'nfl'
        },
        season: { 
          type: 'string', 
          description: 'Fantasy season year (e.g., "2024")',
          default: '2024'
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_league_drafts',
    description: 'Get drafts for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_draft_info',
    description: 'Get detailed information about a specific draft',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { 
          type: 'string', 
          description: 'Sleeper draft ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['draftId']
    }
  },
  {
    name: 'get_draft_picks',
    description: 'Get all picks for a specific draft',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { 
          type: 'string', 
          description: 'Sleeper draft ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['draftId']
    }
  },
  {
    name: 'get_draft_traded_picks',
    description: 'Get traded picks for a specific draft',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { 
          type: 'string', 
          description: 'Sleeper draft ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['draftId']
    }
  },

  // Profile Tools
  {
    name: 'get_my_profile',
    description: 'Get the authenticated user\'s profile information',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },
  {
    name: 'update_my_profile',
    description: 'Update the authenticated user\'s profile information',
    inputSchema: {
      type: 'object',
      properties: {
        sleeper_user_id: { 
          type: 'string', 
          description: 'Sleeper user ID (8-20 digits)' 
        },
        sleeper_username: { 
          type: 'string', 
          description: 'Sleeper username (1-20 chars, alphanumeric, underscores, hyphens)' 
        },
        display_name: { 
          type: 'string', 
          description: 'Display name (1-50 characters)' 
        },
        preferences: { 
          type: 'object', 
          description: 'User preferences object' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },
  {
    name: 'verify_sleeper_user',
    description: 'Verify a Sleeper user ID exists and get their information',
    inputSchema: {
      type: 'object',
      properties: {
        sleeper_user_id: { 
          type: 'string', 
          description: 'Sleeper user ID to verify' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['sleeper_user_id']
    }
  },
  {
    name: 'get_profile_status',
    description: 'Get profile status and recommendations for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },

  // System Tools
  {
    name: 'get_nfl_state',
    description: 'Get current NFL state information (season, week, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  }
]

// Extracted tool handlers to eliminate duplication
const toolHandlers = {
  async get_all_players(args, apiKey) {
    const limit = args.limit || 100
    return await callSleeperAPI(`/players/nfl?limit=${limit}`, 'GET', null, apiKey, true)
  },

  async get_trending_players(args, apiKey) {
    if (!args.type || !['add', 'drop'].includes(args.type)) {
      throw new Error('type must be "add" or "drop"')
    }
    let trendingUrl = `/players/nfl/trending/${args.type}`
    if (args.lookback_hours) trendingUrl += `?lookback_hours=${args.lookback_hours}`
    if (args.limit) trendingUrl += `${args.lookback_hours ? '&' : '?'}limit=${args.limit}`
    return await callSleeperAPI(trendingUrl, 'GET', null, apiKey, true)
  },

  async search_players_by_id(args, apiKey) {
    if (!args.playerId) {
      throw new Error('playerId is required')
    }
    return await callSleeperAPI(`/players/search/id/${args.playerId}`, 'GET', null, apiKey, true)
  },

  async search_players_by_name(args, apiKey) {
    if (!args.query) {
      throw new Error('query is required')
    }
    let nameUrl = `/players/search/name?q=${encodeURIComponent(args.query)}`
    if (args.limit) nameUrl += `&limit=${args.limit}`
    return await callSleeperAPI(nameUrl, 'GET', null, apiKey, true)
  },

  async search_players_by_position(args, apiKey) {
    if (!args.position) {
      throw new Error('position is required')
    }
    let positionUrl = `/players/search/position/${args.position}`
    if (args.limit) positionUrl += `?limit=${args.limit}`
    return await callSleeperAPI(positionUrl, 'GET', null, apiKey, true)
  },

  async search_players_by_team(args, apiKey) {
    if (!args.team) {
      throw new Error('team is required')
    }
    let teamUrl = `/players/search/team/${args.team}`
    if (args.limit) teamUrl += `?limit=${args.limit}`
    return await callSleeperAPI(teamUrl, 'GET', null, apiKey, true)
  },

  async get_active_players(args, apiKey) {
    let activeUrl = '/players/active'
    if (args.limit) activeUrl += `?limit=${args.limit}`
    return await callSleeperAPI(activeUrl, 'GET', null, apiKey, true)
  },

  async get_user_info(args, apiKey) {
    if (!args.identifier) {
      throw new Error('identifier is required')
    }
    return await callSleeperAPI(`/sleeper/user/${args.identifier}`, 'GET', null, apiKey, true)
  },

  async get_user_leagues(args, apiKey) {
    if (!args.userId) {
      throw new Error('userId is required')
    }
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/sleeper/user/${args.userId}/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_my_leagues(args, apiKey) {
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/sleeper/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_league_info(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}`, 'GET', null, apiKey, true)
  },

  async get_league_rosters(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/rosters`, 'GET', null, apiKey, true)
  },

  async get_league_users(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/users`, 'GET', null, apiKey, true)
  },

  async get_league_matchups(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    if (!args.week) {
      throw new Error('week is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/matchups/${args.week}`, 'GET', null, apiKey, true)
  },

  async get_league_playoff_bracket(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/winners_bracket`, 'GET', null, apiKey, true)
  },

  async get_league_transactions(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    let transactionsUrl = `/sleeper/league/${args.leagueId}/transactions`
    if (args.round) transactionsUrl += `/${args.round}`
    return await callSleeperAPI(transactionsUrl, 'GET', null, apiKey, false)
  },

  async get_league_traded_picks(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/traded_picks`, 'GET', null, apiKey, true)
  },

  async get_user_drafts(args, apiKey) {
    if (!args.userId) {
      throw new Error('userId is required')
    }
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/sleeper/user/${args.userId}/drafts/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_league_drafts(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/drafts`, 'GET', null, apiKey, true)
  },

  async get_draft_info(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/sleeper/draft/${args.draftId}`, 'GET', null, apiKey, true)
  },

  async get_draft_picks(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/sleeper/draft/${args.draftId}/picks`, 'GET', null, apiKey, true)
  },

  async get_draft_traded_picks(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/sleeper/draft/${args.draftId}/traded_picks`, 'GET', null, apiKey, true)
  },

  async get_my_profile(args, apiKey) {
    return await callSleeperAPI('/profile', 'GET', null, apiKey, false)
  },

  async update_my_profile(args, apiKey) {
    const profileData = {}
    if (args.sleeper_user_id) profileData.sleeper_user_id = args.sleeper_user_id
    if (args.sleeper_username) profileData.sleeper_username = args.sleeper_username
    if (args.display_name) profileData.display_name = args.display_name
    if (args.preferences) profileData.preferences = args.preferences
    return await callSleeperAPI('/profile', 'PUT', profileData, apiKey, false)
  },

  async delete_my_profile(args, apiKey) {
    return await callSleeperAPI('/profile', 'DELETE', null, apiKey, false)
  },

  async verify_sleeper_user(args, apiKey) {
    if (!args.sleeper_user_id) {
      throw new Error('sleeper_user_id is required')
    }
    return await callSleeperAPI('/profile/verify-sleeper', 'POST', { sleeper_user_id: args.sleeper_user_id }, apiKey, false)
  },

  async get_profile_status(args, apiKey) {
    return await callSleeperAPI('/profile/status', 'GET', null, apiKey, false)
  },

  async get_nfl_state(args, apiKey) {
    return await callSleeperAPI('/sleeper/state/nfl', 'GET', null, apiKey, true)
  }
}

// Unified tool execution function
async function executeTool(toolName, args, apiKey) {
  // Validate input arguments
  const validation = validateArgs(toolName, args)
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
  }

  // Get tool handler
  const handler = toolHandlers[toolName]
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`)
  }

  // Execute tool
  const result = await handler(args, apiKey)
  
  if (!result.success) {
    throw new Error(`API call failed: ${result.error}`)
  }

  return result
}

// MCP Request Handlers

// List available tools
mcpServer.setRequestHandler('tools/list', async () => {
  log('info', 'Listing MCP tools', { count: MCP_TOOLS.length })
  return {
    tools: MCP_TOOLS
  }
})

// Call a tool
mcpServer.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params
  
  // Extract API key from request headers or arguments
  const apiKey = request.meta?.headers?.['x-api-key'] || 
                 request.meta?.headers?.['X-API-Key'] || 
                 args?.apiKey || 
                 null
  
  log('info', `MCP tool called: ${name}`, { 
    arguments: Object.keys(args || {}),
    hasApiKey: !!apiKey
  })

  try {
    const result = await executeTool(name, args, apiKey)
    
    const response = formatToolResponse(result.data, {
      tool: name,
      cached: result.cached,
      executionTime: Date.now()
    })

    log('info', `MCP tool completed: ${name}`, { 
      success: true,
      cached: result.cached 
    })
    
    return response

  } catch (error) {
    log('error', `MCP tool failed: ${name}`, { error: error.message })
    return formatError(error, name)
  }
})

// List available resources (if any)
mcpServer.setRequestHandler('resources/list', async () => {
  return {
    resources: []
  }
})

// Read a resource (if any)
mcpServer.setRequestHandler('resources/read', async (request) => {
  throw new Error('No resources available')
})

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'sleeper-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      apiBaseUrl: CONFIG.API_BASE_URL,
      nodeEnv: CONFIG.NODE_ENV,
      httpPort: CONFIG.HTTP_PORT,
      mcpPort: CONFIG.MCP_PORT
    },
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  }

  // Optional health check for dependent services
  try {
    const response = await axios.get(`${CONFIG.API_BASE_URL}/health`, { timeout: 5000 })
    health.dependencies = {
      sleeperAPI: {
        status: 'ok',
        responseTime: response.headers['x-response-time'] || 'unknown'
      }
    }
  } catch (error) {
    health.dependencies = {
      sleeperAPI: {
        status: 'error',
        error: error.message
      }
    }
    health.status = 'degraded'
  }

  res.status(health.status === 'ok' ? 200 : 503).json(health)
})

// MCP info endpoint
app.get('/mcp', (req, res) => {
  res.json({
    name: 'sleeper-api-mcp',
    version: '1.0.0',
    description: 'MCP server for Sleeper API access',
    capabilities: {
      tools: {},
      resources: {}
    },
    endpoints: {
      health: '/health',
      mcp: '/mcp',
      tools: '/mcp/tools/list',
      call: '/mcp/tools/call',
    },
    authentication: {
      methods: ['header', 'parameter'],
      header: 'X-API-Key',
      parameter: 'apiKey',
      required: true,
      description: 'API key is required. Provide via X-API-Key header or apiKey parameter'
    },
    features: {
      caching: true,
      validation: true,
      monitoring: true
    }
  })
})

// HTTP tool list endpoint (for testing)
app.post('/mcp/tools/list', (req, res) => {
  res.json({
    tools: MCP_TOOLS
  })
})

// HTTP tool call endpoint (for testing)
app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'] || args?.apiKey || null
    
    log('info', `HTTP tool called: ${name}`, { 
      arguments: Object.keys(args || {}),
      hasApiKey: !!apiKey
    })

    const result = await executeTool(name, args, apiKey)
    
    const response = formatToolResponse(result.data, {
      tool: name,
      cached: result.cached,
      executionTime: Date.now()
    })

    res.json(response)

  } catch (error) {
    log('error', `HTTP tool failed: ${req.body.name}`, { error: error.message })
    res.status(500).json(formatError(error, req.body.name))
  }
})

// Error handling middleware
app.use((error, req, res, next) => {
  log('error', 'Express error', { 
    error: error.message, 
    path: req.path,
    method: req.method
  })
  
  res.status(500).json({
    error: 'Internal server error',
    message: CONFIG.NODE_ENV === 'production' ? 'An error occurred' : error.message,
    timestamp: new Date().toISOString()
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  })
})

// Validate configuration before starting
validateConfig()

// Start HTTP server for health checks
app.listen(CONFIG.HTTP_PORT, () => {
  log('info', `HTTP server started on port ${CONFIG.HTTP_PORT}`)
})

// Start MCP server with SSE transport
const transport = new SSEServerTransport('/mcp', app)

mcpServer.connect(transport).then(() => {
  log('info', `MCP server started on port ${CONFIG.MCP_PORT}`, {
    apiBaseUrl: CONFIG.API_BASE_URL,
    tools: MCP_TOOLS.length,
    cacheEnabled: true,
    nodeEnv: CONFIG.NODE_ENV
  })
}).catch((error) => {
  log('error', 'Failed to start MCP server', { error: error.message })
  process.exit(1)
})

// Graceful shutdown
function gracefulShutdown(signal) {
  log('info', `${signal} received, shutting down gracefully`)
  
  // Close cache
  cache.close()
  
  // Close HTTP server
  app.close(() => {
    log('info', 'HTTP server closed')
    process.exit(0)
  })
  
  // Force exit after 10 seconds
  setTimeout(() => {
    log('error', 'Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', { 
    error: error.message, 
    stack: CONFIG.NODE_ENV !== 'production' ? error.stack : undefined
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', { 
    reason: reason?.message || reason,
    promise: promise?.toString()
  })
  process.exit(1)
})