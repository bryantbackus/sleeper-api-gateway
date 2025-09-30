/**
 * MCP Server for Sleeper API
 * Using official MCP SDK with StreamableHTTPServerTransport
 * Following official MCP patterns from https://github.com/modelcontextprotocol/typescript-sdk
 */
// ### MCP Imports ###
import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"

// Configuration
import { CONFIG } from './config.js'

// Shared utils
import { cache, log, TRANSPORTS, USER_SESSIONS, TOOL_HANDLES } from './shared_utils.js'

// ### MCP Tools ###
import { registerAuthTool, registerAuthToolNoToolRegistration } from './authenticate-api.js'
import { registerNoAuthTools } from './tools-no-auth.js'
import { registerAuthenticatedTools } from './tools-auth.js'

// ### Server Imports ###
import cors from 'cors'

console.log('=== MCP SERVER STARTING ===')

// ### Express App ###
// Initialize Express app
const app = express()
const responseLimit = `${CONFIG.RESPONSE_LIMIT}mb`
app.use(express.json({limit: responseLimit}))

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

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id']
  let transport;

  if (sessionId && TRANSPORTS[sessionId]) {
    // Reuse existing transport
    log('debug', 'Reusing existing transport', { sessionId })
    transport = TRANSPORTS[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    log('info', 'New MCP session initialization')
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        TRANSPORTS[sessionId] = transport;
        USER_SESSIONS[sessionId] = { 
          authenticated: false,
          apiKey: null,
          username: null,
          userId: null
         }
      },
      // DNS rebinding protection
      enableDnsRebindingProtection: CONFIG.ENABLE_DNS_REBINDING,
      allowedHosts: CONFIG.ENABLE_DNS_REBINDING ? ['127.0.0.1', `localhost:${CONFIG.HTTP_PORT}`] : undefined
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete TRANSPORTS[transport.sessionId];
        delete USER_SESSIONS[transport.sessionId];
        delete TOOL_HANDLES[transport.sessionId]
        log('info', 'Session closed', { sessionId: transport.sessionId })
      }
    };
    const server = new McpServer({
      name: "example-server",
      version: "1.0.0"
    });

    // ... set up server resources, tools, and prompts ...
    // Register auth tool
    registerAuthToolNoToolRegistration(server, sessionId)

    // Register no auth tools
    registerNoAuthTools(server, sessionId)

    // Register authenticated tools
    registerAuthenticatedTools(server, sessionId)

    // Connect to the MCP server
    await server.connect(transport);
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req, res) => {
  const sessionId = req.headers['mcp-session-id']
  if (!sessionId || !TRANSPORTS[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = TRANSPORTS[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

// Health check endpoint
app.get('/mcp/health', (req, res) => {
  const stats = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses
    },
    sessions: {
      active: Object.keys(TRANSPORTS).length,
      authenticated: Object.values(USER_SESSIONS).filter(s => s.authenticated).length
    }
  }
  res.json(stats)
})

// Info endpoint
app.get('/mcp/info', (req, res) => {
  res.json({
    name: 'Sleeper API MCP Server',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    transport: 'StreamableHTTP',
    authentication: 'Session-based with API key',
    endpoints: {
      mcp: `http://0.0.0.0:${CONFIG.HTTP_PORT}/mcp`,
      health: `http://0.0.0.0:${CONFIG.HTTP_PORT}/mcp/health`,
      info: `http://0.0.0.0:${CONFIG.HTTP_PORT}/mcp/info`
    },
    sessionTTL: CONFIG.SESSION_TTL,
    environment: CONFIG.NODE_ENV
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'POST /mcp - MCP protocol endpoint',
      'GET /mcp - SSE notifications',
      'DELETE /mcp - Session termination',
      'GET /mcp/health - Health check',
      'GET /mcp/info - Server information'
    ]
  })
})

// Error handling middleware
app.use((error, req, res, next) => {
  log('error', 'Unhandled error', { error: error.message, stack: error.stack })
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully')
  process.exit(0)
})

// ### Start Server ###
// Start server
app.listen(CONFIG.HTTP_PORT, '0.0.0.0', () => {
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
    }
  })
})