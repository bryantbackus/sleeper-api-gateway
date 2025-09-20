#!/usr/bin/env node

/**
 * MCP Server for Sleeper API
 * Provides standardized MCP interface to Sleeper API middleware
 * Uses official StreamableHTTP transport for proper MCP compliance
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import cors from 'cors'
import axios from 'axios'
import NodeCache from 'node-cache'
import { randomUUID } from 'crypto'
import { MCP_TOOLS, createToolHandlers } from './tools.js'

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

// Body parsing middleware
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

// Create tool handlers with the callSleeperAPI function
const toolHandlers = createToolHandlers(callSleeperAPI)

// Initialize MCP server with proper capabilities
const mcpServer = new Server(
  {
    name: 'sleeper-api-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {
        listChanged: true  // Support for tools/list_changed notifications
      },
      resources: {}
    },
  }
)

// Unified tool execution function
async function executeTool(toolName, args) {
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

  // Extract API key from arguments (let backend handle auth)
  const apiKey = args?.apiKey || null

  // Execute tool
  const result = await handler(args, apiKey)
  
  if (!result.success) {
    throw new Error(`API call failed: ${result.error}`)
  }

  return result
}

// Set up MCP request handlers
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  log('info', 'Listing MCP tools', { count: MCP_TOOLS.length })
  return {
    tools: MCP_TOOLS
  }
})

mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: []
  }
})

mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  throw new Error('No resources available')
})

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  
  log('info', `MCP tool called: ${name}`, { 
    arguments: Object.keys(args || {}),
    tool: name
  })

  try {
    const result = await executeTool(name, args)
    
    const response = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: result.data,
          metadata: {
            timestamp: new Date().toISOString(),
            success: true,
            tool: name,
            cached: result.cached
          }
        }, null, 2)
      }],
      isError: false
    }

    log('info', `MCP tool completed: ${name}`, { 
      success: true,
      cached: result.cached 
    })
    
    return response

  } catch (error) {
    log('error', `MCP tool failed: ${name}`, { error: error.message })
    
    // Return standardized JSON-RPC 2.0 error format
    throw {
      code: -32603,
      message: CONFIG.NODE_ENV === 'production' ? 'Tool execution failed' : error.message,
      data: {
        tool: name,
        timestamp: new Date().toISOString()
      }
    }
  }
})

// Enhanced health check endpoint
app.get('/mcp/health', async (req, res) => {
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

// Enhanced info endpoint with fixed protocol version
app.get('/mcp/info', (req, res) => {
  res.json({
    name: 'sleeper-api-mcp',
    version: '1.0.0',
    description: 'MCP server for Sleeper API access - No authentication required to connect',
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {
        listChanged: true
      },
      resources: {}
    },
    endpoints: {
      health: '/mcp/health',
      info: '/mcp/info',
      mcp: '/mcp'
    },
    features: {
      caching: true,
      validation: true,
      monitoring: true,
      notifications: true,
      openAccess: true
    },
    transport: 'streamableHTTP',
    protocol: 'mcp/2024-11-05',
    note: 'API keys are only required when tools access the Sleeper API backend, not for MCP connection'
  })
})

// MCP GET endpoint for connection establishment (required by StreamableHTTP)
app.get('/mcp', async (req, res) => {
  try {
    log('debug', 'MCP GET request received', { 
      headers: Object.keys(req.headers),
      query: req.query
    })
    
    // Return server info for GET requests
    res.json({
      name: 'sleeper-api-mcp',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: {}
      },
      transport: 'streamableHTTP',
      description: 'Open access MCP server - no authentication required to connect',
      note: 'API keys only needed for individual tool calls to access Sleeper API'
    })
    
  } catch (error) {
    log('error', 'MCP GET request failed', { error: error.message })
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      }
    })
  }
})

app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, method, params, id } = req.body
    
    log('debug', 'MCP request received', { method, id })
    
    // Validate JSON-RPC format
    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"'
        }
      })
    }
    
    // Handle different MCP methods
    switch (method) {
      case 'initialize':
        log('info', 'MCP initialize request', { clientInfo: params?.clientInfo })
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: true },
              resources: {}
            },
            serverInfo: {
              name: 'sleeper-api-mcp',
              version: '1.0.0'
            }
          }
        })
        break
        
      case 'tools/list':
        log('info', 'MCP tools/list request')
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS
          }
        })
        break
        
      case 'tools/call':
        const { name, arguments: args } = params
        
        log('info', `MCP tool called: ${name}`, { 
          arguments: Object.keys(args || {}),
        })

        try {
          const result = await executeTool(name, args)
          
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  data: result.data,
                  metadata: {
                    timestamp: new Date().toISOString(),
                    success: true,
                    tool: name,
                    cached: result.cached
                  }
                }, null, 2)
              }],
              isError: false
            }
          })

          log('info', `MCP tool completed: ${name}`, { 
            success: true,
            cached: result.cached 
          })
          
        } catch (error) {
          log('error', `MCP tool failed: ${name}`, { error: error.message })
          
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: CONFIG.NODE_ENV === 'production' ? 'Tool execution failed' : error.message,
              data: {
                tool: name,
                timestamp: new Date().toISOString()
              }
            }
          })
        }
        break
        
      case 'resources/list':
        log('info', 'MCP resources/list request')
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            resources: []
          }
        })
        break
        
      default:
        log('warn', `Unknown MCP method: ${method}`)
        res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        })
    }
    
  } catch (error) {
    log('error', 'MCP request failed', { 
      error: error.message,
      stack: CONFIG.NODE_ENV !== 'production' ? error.stack : undefined
    })
    
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: CONFIG.NODE_ENV === 'production' ? undefined : error.message
      }
    })
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
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32603,
      message: 'Internal server error',
      data: {
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    }
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32601,
      message: 'Method not found',
      data: {
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    }
  })
})

// Validate configuration before starting
validateConfig()

// Start HTTP server
const httpServer = app.listen(CONFIG.HTTP_PORT, () => {
  log('info', `MCP HTTP server started on port ${CONFIG.HTTP_PORT}`, {
    endpoints: {
      health: `http://localhost:${CONFIG.HTTP_PORT}/health`,
      mcp: `http://localhost:${CONFIG.HTTP_PORT}/mcp`
    },
    protocol: 'MCP over StreamableHTTP',
    protocolVersion: '2024-11-05',
    tools: MCP_TOOLS.length,
    transport: 'StreamableHTTP',
    cacheEnabled: true,
    nodeEnv: CONFIG.NODE_ENV
  })
})

// Function to send tool list changed notifications
function notifyToolsChanged() {
  try {
    mcpServer.notification({
      method: 'notifications/tools/list_changed'
    })
    log('info', 'Sent tools/list_changed notification')
  } catch (error) {
    log('error', 'Failed to send tools notification', { error: error.message })
  }
}

// Graceful shutdown
function gracefulShutdown(signal) {
  log('info', `${signal} received, shutting down gracefully`)
  
  // Close all active transports
  for (const [sessionId, transport] of transports) {
    try {
      transport.close()
      log('info', `Closed transport for session: ${sessionId}`)
    } catch (error) {
      log('error', `Failed to close transport for session ${sessionId}`, { error: error.message })
    }
  }
  transports.clear()
  
  // Close cache
  cache.close()
  
  // Close HTTP server
  httpServer.close(() => {
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