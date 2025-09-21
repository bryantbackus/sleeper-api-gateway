/**
 * MCP Server for Sleeper API
 * Using official MCP SDK with StreamableHTTPServerTransport
 * Following official MCP patterns from https://github.com/modelcontextprotocol/typescript-sdk
 */

import express from 'express'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import cors from 'cors'
import axios from 'axios'
import NodeCache from 'node-cache'
import { MCP_TOOLS_AUTH, createAuthToolHandlers } from './tools-auth.js'
import { MCP_TOOLS_NO_AUTH, createNoAuthToolHandlers } from './tools-no-auth.js'

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://sleeper-api:3000',
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  HTTP_PORT: parseInt(process.env.HTTP_PORT) || 3001,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 600,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
  SESSION_TTL: parseInt(process.env.SESSION_TTL) || 86400, // 24 hours
  ENABLE_DNS_REBINDING: process.env.NODE_ENV === 'production' ? false : true
}

// Initialize Express app
const app = express()
app.use(express.json())

// Configure CORS
app.use(cors({
  origin: CONFIG.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'mcp-session-id',
    'X-API-Key',
    'Authorization',
    'Accept'
  ],
  exposedHeaders: ['mcp-session-id']
}))

// Initialize caches
const cache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL })

// Map to store transports by session ID
const transports = {}

// Map to store user sessions (API keys and profiles)
const userSessions = {}

// Combine all tools (auth + no-auth + session tools)
const ALL_TOOLS = [...MCP_TOOLS_NO_AUTH, ...MCP_TOOLS_AUTH]

// Authentication tool - always available
const AUTH_TOOL = {
  name: 'authenticate',
  description: 'Authenticate with your Sleeper API key to enable all tools',
  inputSchema: {
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        description: 'Your Sleeper API key for authentication'
      }
    },
    required: ['apiKey']
  }
}

// Session status tool - always available
const SESSION_STATUS_TOOL = {
  name: 'get_session_status',
  description: 'Check your current authentication status and available tools',
  inputSchema: {
    type: 'object',
    properties: {}
  }
}

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
    if (logData.headers) {
      delete logData.headers['x-api-key']
    }
  }
  
  console.log(JSON.stringify(logData))
}

// Helper function to call the Sleeper API
async function callSleeperAPI(endpoint, method = 'GET', data = null, apiKey = null, useCache = false) {
  try {
    // Check cache for GET requests
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(data || {})}`
    if (useCache && method === 'GET') {
      const cached = cache.get(cacheKey)
      if (cached) {
        log('debug', 'Cache hit', { endpoint })
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

    log('debug', 'API request', {
      endpoint,
      method,
      hasData: !!data,
      apiKeyProvided: !!apiKey
    })
    
    const response = await axios(config)
    
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
    log('error', 'API request failed', {
      endpoint,
      method,
      status: error.response?.status,
      error: error.message
    })

    return {
      success: false,
      error: error.message,
      status: error.response?.status || 500,
      data: error.response?.data
    }
  }
}

// Map to store MCP servers by session ID
const mcpServers = {}

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id']
  let transport = sessionId ? transports[sessionId] : null

  if (sessionId && transport) {
    // Reuse existing transport
    log('debug', 'Reusing existing transport', { sessionId })
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    log('info', 'New MCP session initialization')
    
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        // Store the transport by session ID
        transports[newSessionId] = transport
        
        // Initialize empty user session
        userSessions[newSessionId] = {
          authenticated: false,
          createdAt: new Date(),
          lastAccessed: new Date()
        }
        
        log('info', 'Session initialized', { sessionId: newSessionId })
      },
      // DNS rebinding protection
      enableDnsRebindingProtection: CONFIG.ENABLE_DNS_REBINDING,
      allowedHosts: CONFIG.ENABLE_DNS_REBINDING ? ['127.0.0.1', 'localhost'] : undefined
    })
    
    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        log('info', 'Session closed', { sessionId: transport.sessionId })
        delete transports[transport.sessionId]
        delete userSessions[transport.sessionId]
        delete mcpServers[transport.sessionId]
      }
    }
    
    // Create MCP server using modern approach
    const mcpServer = new McpServer({
      name: "sleeper-api-mcp",
      version: "1.0.0"
    })

    // Create tool handlers
    const authToolHandlers = createAuthToolHandlers(callSleeperAPI)
    const noAuthToolHandlers = createNoAuthToolHandlers(callSleeperAPI)
    const allToolHandlers = { ...authToolHandlers, ...noAuthToolHandlers }

    // Register authentication tool
    mcpServer.addTool(AUTH_TOOL, async (args) => {
      const sessionId = transport.sessionId
      
      if (!args?.apiKey) {
        throw new Error('API key is required for authentication')
      }
      
      // Try to get user profile with the API key
      const profileResult = await callSleeperAPI('/profile', 'GET', null, args.apiKey)
      
      if (!profileResult.success) {
        throw new Error('Invalid API key or unable to fetch profile')
      }
      
      // Store session data
      userSessions[sessionId] = {
        apiKey: args.apiKey,
        profile: profileResult.data,
        authenticated: true,
        createdAt: new Date(),
        lastAccessed: new Date()
      }
      
      log('info', 'Authentication successful', {
        sessionId,
        userId: profileResult.data.user_id,
        username: profileResult.data.sleeper_username
      })
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Authentication successful! All tools are now available.',
            profile: {
              user_id: profileResult.data.user_id,
              username: profileResult.data.sleeper_username,
              display_name: profileResult.data.display_name
            },
            availableTools: ALL_TOOLS.length + 2
          }, null, 2)
        }]
      }
    })

    // Register session status tool
    mcpServer.addTool(SESSION_STATUS_TOOL, async (args) => {
      const sessionId = transport.sessionId
      const session = userSessions[sessionId]
      
      if (!session?.authenticated) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              authenticated: false,
              message: 'Not authenticated. Use the "authenticate" tool with your API key.',
              availableTools: ['authenticate', 'get_session_status']
            }, null, 2)
          }]
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            authenticated: true,
            profile: {
              user_id: session.profile.user_id,
              username: session.profile.sleeper_username,
              display_name: session.profile.display_name
            },
            sessionAge: Math.floor((Date.now() - session.createdAt) / 1000),
            availableTools: ALL_TOOLS.length + 2
          }, null, 2)
        }]
      }
    })

    // Register no-auth tools (always available)
    MCP_TOOLS_NO_AUTH.forEach(tool => {
      mcpServer.addTool(tool, async (args) => {
        const sessionId = transport.sessionId
        const session = userSessions[sessionId]
        
        log('info', `No-auth tool called: ${tool.name}`, {
          sessionId,
          tool: tool.name
        })

        // Get tool handler
        const handler = noAuthToolHandlers[tool.name]
        if (!handler) {
          throw new Error(`Unknown tool: ${tool.name}`)
        }

        // Execute tool (no API key required)
        const result = await handler(args, null)
        
        if (!result.success) {
          throw new Error(result.error || 'Tool execution failed')
        }

        // Update session access time if authenticated
        if (session?.authenticated) {
          session.lastAccessed = new Date()
        }

        log('info', 'No-auth tool succeeded', {
          tool: tool.name,
          sessionId,
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
                tool: tool.name,
                cached: result.cached || false
              }
            }, null, 2)
          }]
        }
      })
    })

    // Register auth-required tools
    MCP_TOOLS_AUTH.forEach(tool => {
      mcpServer.addTool(tool, async (args) => {
        const sessionId = transport.sessionId
        const session = userSessions[sessionId]
        
        log('info', `Auth tool called: ${tool.name}`, {
          sessionId,
          tool: tool.name,
          authenticated: !!session?.authenticated
        })

        // Require authentication for these tools
        if (!session?.authenticated) {
          throw new Error('Authentication required. Please use the "authenticate" tool with your API key first.')
        }
        
        // Update last accessed time
        session.lastAccessed = new Date()
        
        // Get tool handler
        const handler = authToolHandlers[tool.name]
        if (!handler) {
          throw new Error(`Unknown tool: ${tool.name}`)
        }

        // Execute tool with stored API key
        const result = await handler(args, session.apiKey)
        
        if (!result.success) {
          throw new Error(result.error || 'Tool execution failed')
        }

        log('info', 'Auth tool succeeded', {
          tool: tool.name,
          sessionId,
          userId: session.profile.user_id,
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
                tool: tool.name,
                cached: result.cached || false
              }
            }, null, 2)
          }]
        }
      })
    })

    // Store MCP server
    mcpServers[transport.sessionId] = mcpServer
    
    // Connect to the MCP server
    await mcpServer.connect(transport)
  } else {
    // Invalid request
    log('error', 'Invalid MCP request', {
      hasSessionId: !!sessionId,
      hasTransport: !!transport,
      isInitialize: isInitializeRequest(req.body)
    })
    
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided or not an initialize request'
      },
      id: null
    })
    return
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body)
})

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req, res) => {
  const sessionId = req.headers['mcp-session-id']
  
  if (!sessionId || !transports[sessionId]) {
    log('error', 'Invalid session request', {
      method: req.method,
      hasSessionId: !!sessionId,
      sessionExists: !!transports[sessionId]
    })
    
    res.status(400).send('Invalid or missing session ID')
    return
  }
  
  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
}

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest)

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest)

// Health check endpoint
app.get('/mcp/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'sleeper-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    transport: 'StreamableHTTP',
    sessions: {
      active: Object.keys(transports).length,
      authenticated: Object.values(userSessions).filter(s => s.authenticated).length
    },
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  }

  try {
    const apiHealth = await axios.get(`${CONFIG.API_BASE_URL}/health`, {
      timeout: 5000
    })
    health.dependencies = {
      sleeperAPI: {
        status: 'ok'
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
    description: 'MCP server for Sleeper API with session-based authentication',
    protocolVersion: '2024-11-05',
    transport: 'StreamableHTTP',
    authentication: {
      required: false,
      method: 'Use the "authenticate" tool with your API key to enable auth-required tools',
      session: 'Stateful - authenticate once per session'
    },
    endpoints: {
      mcp: '/mcp',
      health: '/mcp/health',
      info: '/mcp/info'
    },
    tools: {
      noAuth: MCP_TOOLS_NO_AUTH.length + 2,
      authRequired: MCP_TOOLS_AUTH.length,
      total: ALL_TOOLS.length + 2
    },
    sessions: {
      active: Object.keys(transports).length
    }
  })
})

// HEAD request handler for connection checks
app.head('/mcp', (req, res) => {
  res.setHeader('X-MCP-Version', '2024-11-05')
  res.setHeader('X-Transport', 'StreamableHTTP')
  res.status(200).end()
})

// OPTIONS handler for CORS preflight
app.options('/mcp', (req, res) => {
  res.sendStatus(204)
})

// 404 handler
app.use((req, res) => {
  log('warn', '404 Not Found', {
    path: req.path,
    method: req.method
  })
  
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    availableEndpoints: {
      mcp: '/mcp',
      health: '/mcp/health',
      info: '/mcp/info'
    }
  })
})

// Error handler
app.use((err, req, res, next) => {
  log('error', 'Unhandled error', {
    error: err.message,
    stack: CONFIG.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path
  })
  
  res.status(500).json({
    error: 'Internal server error',
    message: CONFIG.NODE_ENV !== 'production' ? err.message : 'An error occurred'
  })
})

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now()
  const ttl = CONFIG.SESSION_TTL * 1000
  
  Object.entries(userSessions).forEach(([sessionId, session]) => {
    if (now - session.lastAccessed > ttl) {
      log('info', 'Session expired', {
        sessionId,
        userId: session.profile?.user_id
      })
      
      // Clean up transport if exists
      if (transports[sessionId]) {
        transports[sessionId].close()
        delete transports[sessionId]
      }
      
      // Clean up MCP server
      if (mcpServers[sessionId]) {
        delete mcpServers[sessionId]
      }
      
      delete userSessions[sessionId]
    }
  })
}, 60000) // Check every minute

// Start the server
const server = app.listen(CONFIG.HTTP_PORT, '0.0.0.0', () => {
  log('info', 'MCP server started', {
    transport: 'StreamableHTTP',
    port: CONFIG.HTTP_PORT,
    endpoints: {
      mcp: `http://0.0.0.0:${CONFIG.HTTP_PORT}/mcp`,
      health: `http://0.0.0.0:${CONFIG.HTTP_PORT}/mcp/health`,
      info: `http://0.0.0.0:${CONFIG.HTTP_PORT}/mcp/info`
    },
    protocolVersion: '2024-11-05',
    authentication: 'Session-based with API key',
    sessionTTL: CONFIG.SESSION_TTL,
    environment: CONFIG.NODE_ENV,
    tools: {
      noAuth: MCP_TOOLS_NO_AUTH.length + 2,
      authRequired: MCP_TOOLS_AUTH.length,
      total: ALL_TOOLS.length + 2
    }
  })
})

// Graceful shutdown
function gracefulShutdown(signal) {
  log('info', 'Shutdown signal received', {
    signal,
    activeSessions: Object.keys(transports).length
  })
  
  // Close all transports
  Object.values(transports).forEach(transport => {
    transport.close()
  })
  
  server.close((err) => {
    if (err) {
      log('error', 'Error during shutdown', { error: err.message })
      process.exit(1)
    }
    
    // Clear all sessions
    Object.keys(transports).forEach(id => delete transports[id])
    Object.keys(userSessions).forEach(id => delete userSessions[id])
    Object.keys(mcpServers).forEach(id => delete mcpServers[id])
    
    // Close cache
    if (cache) {
      cache.close()
    }
    
    log('info', 'Server shut down gracefully')
    process.exit(0)
  })
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    log('error', 'Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', {
    error: error.message,
    stack: error.stack
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', {
    reason: reason?.message || reason
  })
  process.exit(1)
})