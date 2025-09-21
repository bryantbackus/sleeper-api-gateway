/**
 * MCP Server for Sleeper API
 * Uses official MCP SDK with SSE transport for Claude integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import cors from 'cors'
import axios from 'axios'
import NodeCache from 'node-cache'
import { MCP_TOOLS, createToolHandlers } from './tools.js'

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://sleeper-api:3000',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  HTTP_PORT: parseInt(process.env.HTTP_PORT) || 3001,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 600,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
  TRANSPORT: process.env.TRANSPORT || 'sse' // 'sse' for HTTP or 'stdio' for CLI
}

// Initialize cache
const cache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL })

// Logging function
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
  
  console.error(JSON.stringify(logData)) // Use stderr to avoid stdio conflicts
}

// Validate configuration
function validateConfig() {
  const errors = []
  
  if (!CONFIG.API_BASE_URL.startsWith('http')) {
    errors.push('API_BASE_URL must be a valid HTTP URL')
  }
  
  if (CONFIG.HTTP_PORT < 1 || CONFIG.HTTP_PORT > 65535) {
    errors.push('HTTP_PORT must be between 1 and 65535')
  }
  
  if (errors.length > 0) {
    log('error', 'Configuration validation failed', { errors })
    process.exit(1)
  }
  
  log('info', 'Configuration validated successfully', {
    apiBaseUrl: CONFIG.API_BASE_URL,
    httpPort: CONFIG.HTTP_PORT,
    nodeEnv: CONFIG.NODE_ENV,
    transport: CONFIG.TRANSPORT
  })
}

// API call function
async function callSleeperAPI(endpoint, method = 'GET', data = null, apiKey = null, useCache = false) {
  try {
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
        ...(apiKey && { 'X-API-Key': apiKey })
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

// Create tool handlers
const toolHandlers = createToolHandlers(callSleeperAPI)

// Create MCP server
async function createMCPServer() {
  const server = new Server({
    name: 'sleeper-api-mcp',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  })

  // Register all tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log('info', 'Tools list requested', { toolCount: MCP_TOOLS.length })
    return { tools: MCP_TOOLS }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    
    log('info', `Tool called: ${name}`, { 
      tool: name,
      hasArgs: !!args,
      argKeys: args ? Object.keys(args) : []
    })

    try {
      // Extract API key from arguments
      const apiKey = args?.apiKey || null
      
      // Get tool handler
      const handler = toolHandlers[name]
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`)
      }

      // Execute tool
      const result = await handler(args, apiKey)
      
      if (!result.success) {
        throw new Error(result.error || 'API call failed')
      }

      log('info', `Tool completed: ${name}`, { 
        success: true,
        cached: result.cached 
      })

      return {
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
        }]
      }
    } catch (error) {
      log('error', `Tool failed: ${name}`, { 
        error: error.message,
        tool: name 
      })
      
      // Return error in MCP format
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            metadata: {
              timestamp: new Date().toISOString(),
              success: false,
              tool: name
            }
          }, null, 2)
        }],
        isError: true
      }
    }
  })

  return server
}

// Main startup function
async function startServer() {
  validateConfig()
  
  const mcpServer = await createMCPServer()
  
  if (CONFIG.TRANSPORT === 'stdio') {
    // Use stdio transport for CLI usage
    log('info', 'Starting MCP server with stdio transport')
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
    log('info', 'MCP server connected via stdio')
    
  } else {
    // Use SSE transport for HTTP/browser usage
    const app = express()
    
    // CORS configuration
    app.use(cors({
      origin: CONFIG.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-API-Key', 'MCP-Protocol-Version'],
      optionsSuccessStatus: 200
    }))
    
    // Body parsing
    app.use(express.json())
    
    // Health check endpoint
    app.get('/mcp/health', async (req, res) => {
      const health = {
        status: 'ok',
        service: 'sleeper-mcp-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        transport: 'SSE',
        config: {
          apiBaseUrl: CONFIG.API_BASE_URL,
          nodeEnv: CONFIG.NODE_ENV,
          httpPort: CONFIG.HTTP_PORT
        },
        cache: {
          keys: cache.keys().length,
          stats: cache.getStats()
        }
      }

      // Check API dependency
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
    
    // Info endpoint
    app.get('/mcp/info', (req, res) => {
      res.json({
        name: 'sleeper-api-mcp',
        version: '1.0.0',
        description: 'MCP server for Sleeper API access',
        protocolVersion: '2024-11-05',
        transport: 'SSE',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        endpoints: {
          health: '/mcp/health',
          info: '/mcp/info',
          sse: '/mcp/sse'
        },
        toolCount: MCP_TOOLS.length
      })
    })
    
    // SSE endpoint for MCP communication
    app.get('/mcp/sse', async (req, res) => {
      log('info', 'SSE connection initiated', {
        headers: Object.keys(req.headers),
        protocol: req.headers['mcp-protocol-version']
      })
      
      try {
        const transport = new SSEServerTransport('/', res)
        await mcpServer.connect(transport)
        log('info', 'MCP server connected via SSE')
        
        // Keep connection alive
        transport.on('close', () => {
          log('info', 'SSE connection closed')
        })
        
      } catch (error) {
        log('error', 'SSE connection failed', { error: error.message })
        res.status(500).end()
      }
    })
    
    // Legacy POST endpoint (for backward compatibility)
    app.post('/mcp', async (req, res) => {
      log('warn', 'Legacy POST endpoint used - redirecting to SSE', {
        method: req.body?.method
      })
      
      res.status(400).json({
        error: 'Please use SSE endpoint at /mcp/sse',
        endpoints: {
          sse: '/mcp/sse',
          health: '/mcp/health',
          info: '/mcp/info'
        }
      })
    })
    
    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        endpoints: {
          sse: '/mcp/sse',
          health: '/mcp/health',
          info: '/mcp/info'
        }
      })
    })
    
    // Start HTTP server
    const httpServer = app.listen(CONFIG.HTTP_PORT, () => {
      log('info', `MCP SSE server started on port ${CONFIG.HTTP_PORT}`, {
        endpoints: {
          sse: `http://localhost:${CONFIG.HTTP_PORT}/mcp/sse`,
          health: `http://localhost:${CONFIG.HTTP_PORT}/mcp/health`,
          info: `http://localhost:${CONFIG.HTTP_PORT}/mcp/info`
        },
        transport: 'SSE',
        protocolVersion: '2024-11-05',
        toolCount: MCP_TOOLS.length
      })
    })
    
    // Graceful shutdown
    function gracefulShutdown(signal) {
      log('info', `${signal} received, shutting down gracefully`)
      
      // Close cache
      if (cache && typeof cache.close === 'function') {
        try {
          cache.close()
          log('info', 'Cache closed successfully')
        } catch (error) {
          log('error', 'Error closing cache', { error: error.message })
        }
      }
      
      // Close HTTP server
      httpServer.close((error) => {
        if (error) {
          log('error', 'Error closing HTTP server', { error: error.message })
          process.exit(1)
        } else {
          log('info', 'HTTP server closed successfully')
          process.exit(0)
        }
      })
      
      // Force exit after 10 seconds
      setTimeout(() => {
        log('error', 'Forced shutdown after timeout')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  }
  
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
}

// Start the server
startServer().catch(error => {
  log('error', 'Failed to start server', { error: error.message })
  process.exit(1)
})