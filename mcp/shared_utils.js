import axios from 'axios'
import NodeCache from 'node-cache'
import { CONFIG } from './config.js'

// Map to store transports by session ID
const TRANSPORTS = {};

// Map to store user sessions (API keys and profiles)
const USER_SESSIONS = {}

// shared_utils.js
export const TOOL_HANDLES = {} // { [sessionId]: { [toolName]: handle } }

// Initialize caches
const cache = new NodeCache({ stdTTL: CONFIG.CACHE_TTL })

// function to log messages
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
    }
    
    console.log(JSON.stringify(logData))
  }
  
  // Call Sleeper API function
  async function callSleeperAPI(endpoint, method = 'GET', data = null, apiKey = null, useCache = false, passThrouhResponse = false) {
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
        timeout: CONFIG.REQUEST_TIMEOUT,
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
      
      if (passThrouhResponse) {
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

  export { cache, log, callSleeperAPI, TRANSPORTS, USER_SESSIONS }