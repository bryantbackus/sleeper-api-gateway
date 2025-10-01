import axios from 'axios'
import NodeCache from 'node-cache'
import { CONFIG } from './config.js'

// Map to store transports by session ID
const TRANSPORTS = {};

// Map to store user sessions (API keys and profiles)
const USER_SESSIONS = {}

// shared_utils.js
export const TOOL_HANDLES = {} // { [sessionId]: { [toolName]: handle } }

export const SESSION_RATE_LIMITS = {} // { [sessionId]: { count: 0, windowStart: timestamp } }

// Initialize caches
const cache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL })

// function to log messages
function log(level, message, data = {}) {
    // Define log level hierarchy
    const logLevels = {
        'error': 0,
        'warn': 1,
        'info': 2,
        'debug': 3
    }
    
    // Get current log level from config
    const currentLogLevel = logLevels[CONFIG.LOG_LEVEL.toLowerCase()] || logLevels.debug
    const messageLogLevel = logLevels[level.toLowerCase()] || logLevels.debug
    
    // Only log if message level is <= current log level
    if (messageLogLevel > currentLogLevel) {
        return
    }
    
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
    }
    
    console.log(JSON.stringify(logData))
}
  
  // Call Sleeper API function
  async function callSleeperAPI(endpoint, method = 'GET', data = null, apiKey = null, useCache = false, passThroughResponse = false, timeout = CONFIG.REQUEST_TIMEOUT) {
    const cacheKey = `${method}:${endpoint}:${apiKey ? 'auth' : 'no-auth'}`
    
    // Check cache for GET requests
    if (useCache && method === 'GET') {
      const cached = cache.get(cacheKey)
      if (cached) {
        log('debug', 'Cache hit', { endpoint, cacheKey })
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(cached, null, 2)
          }],
          success: true,
          cached: true
        }
      }
    }
    
    try {
      const config = {
        method,
        url: `${CONFIG.API_BASE_URL}${endpoint}`,
        timeout: timeout,
        maxContentLength: CONFIG.RESPONSE_LIMIT * 1024 * 1024,
        maxBodyLength: CONFIG.RESPONSE_LIMIT * 1024 * 1024,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Sleeper-API-Middleware/1.0.0'
        }
      }
      
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey
      }
      
      if (data) {
        config.data = data
      }
      
      log('debug', 'API request', { endpoint, method, hasApiKey: !!apiKey })
      
      const response = await axios(config)
      
      // Cache successful GET responses
      if (useCache && method === 'GET' && response.status === 200) {
        cache.set(cacheKey, response.data)
        log('debug', 'Response cached', { endpoint, cacheKey })
      }
      
      if (passThroughResponse) {
        return response.data
      } else {   
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data, null, 2)
          }],
          success: true,
          cached: false
        }
      }
    } catch (error) {
      log('error', 'API call failed', { 
        endpoint, 
        method, 
        error: error.message,
        status: error.response?.status
      })
      
      throw new Error(`API call failed: ${error.message}`)
    }
  }

  /**
 * Check if a session has exceeded its rate limit
 * @param {string} sessionId - The session ID to check
 * @returns {Object} { allowed: boolean, remaining: number, resetIn?: number }
 */
function checkMcpRateLimit(sessionId) {
  const now = Date.now()
  const session = USER_SESSIONS[sessionId]
  const isAuthenticated = session?.authenticated || false
  
  // Determine limits based on authentication status
  const maxRequests = isAuthenticated 
    ? CONFIG.MCP_AUTHENTICATED_LIMIT 
    : CONFIG.MCP_UNAUTHENTICATED_LIMIT
  const windowMs = CONFIG.MCP_RATE_LIMIT_WINDOW
  
  // Initialize rate limit tracking for new sessions
  if (!SESSION_RATE_LIMITS[sessionId]) {
    SESSION_RATE_LIMITS[sessionId] = {
      count: 1,
      windowStart: now
    }
    return { 
      allowed: true, 
      remaining: maxRequests - 1,
      limit: maxRequests
    }
  }
  
  const limitData = SESSION_RATE_LIMITS[sessionId]
  
  // Reset window if expired
  if (now - limitData.windowStart > windowMs) {
    limitData.count = 1
    limitData.windowStart = now
    return { 
      allowed: true, 
      remaining: maxRequests - 1,
      limit: maxRequests
    }
  }
  
  // Check if over limit
  if (limitData.count >= maxRequests) {
    const resetIn = windowMs - (now - limitData.windowStart)
    log('warn', 'MCP rate limit exceeded', {
      sessionId,
      authenticated: isAuthenticated,
      count: limitData.count,
      limit: maxRequests,
      resetIn
    })
    return { 
      allowed: false, 
      remaining: 0,
      limit: maxRequests,
      resetIn
    }
  }
  
  // Increment count
  limitData.count++
  return { 
    allowed: true, 
    remaining: maxRequests - limitData.count,
    limit: maxRequests
  }
}

/**
 * Reset rate limit for a session (e.g., after successful authentication)
 * @param {string} sessionId - The session ID to reset
 */
function resetMcpRateLimit(sessionId) {
  delete SESSION_RATE_LIMITS[sessionId]
  log('info', 'MCP rate limit reset', { sessionId })
}

  export { cache, log, callSleeperAPI, checkMcpRateLimit, resetMcpRateLimit, TRANSPORTS, USER_SESSIONS }