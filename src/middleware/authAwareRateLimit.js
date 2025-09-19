const rateLimit = require('express-rate-limit')
const logger = require('../config/logger')

/**
 * Creates an auth-aware rate limiter that provides different limits based on authentication status
 * @param {Object} options - Configuration options
 * @param {number} options.unauthenticatedMax - Max requests for unauthenticated users
 * @param {number} options.authenticatedMax - Max requests for authenticated users
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.name - Name for logging purposes
 * @returns {Function} Express rate limiting middleware
 */
const createAuthAwareRateLimit = (options = {}) => {
  const {
    unauthenticatedMax = 20,
    authenticatedMax = 200,
    windowMs = 15 * 60 * 1000, // 15 minutes
    name = 'auth-aware'
  } = options

  return rateLimit({
    windowMs,
    max: (req) => {
      const limit = req.user ? authenticatedMax : unauthenticatedMax
      logger.debug(`Rate limit check for ${name}:`, {
        authenticated: !!req.user,
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        limit
      })
      return limit
    },
    keyGenerator: (req) => {
      // Use user ID for authenticated users, IP for unauthenticated
      const key = req.user ? `user_${req.user.id}` : `ip_${req.ip}`
      return `${name}_${key}`
    },
    message: (req) => {
      const isAuth = !!req.user
      const limit = isAuth ? authenticatedMax : unauthenticatedMax
      const windowMinutes = Math.round(windowMs / 60000)
      
      return {
        error: 'Rate limit exceeded',
        message: isAuth 
          ? `Authenticated rate limit exceeded (${limit} requests per ${windowMinutes} minutes)`
          : `Unauthenticated rate limit exceeded (${limit} requests per ${windowMinutes} minutes)`,
        suggestion: isAuth ? null : 'Get an API key for higher rate limits',
        limits: {
          current: limit,
          window: `${windowMinutes} minutes`,
          authenticated: isAuth,
          upgradeAvailable: !isAuth
        }
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const isAuth = !!req.user
      const limit = isAuth ? authenticatedMax : unauthenticatedMax
      
      logger.warn(`${name} rate limit exceeded:`, {
        authenticated: isAuth,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        limit,
        windowMs
      })

      const windowMinutes = Math.round(windowMs / 60000)
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: isAuth 
          ? `Authenticated rate limit exceeded (${limit} requests per ${windowMinutes} minutes)`
          : `Unauthenticated rate limit exceeded (${limit} requests per ${windowMinutes} minutes)`,
        suggestion: isAuth ? null : 'Get an API key for 10x higher rate limits',
        limits: {
          current: limit,
          window: `${windowMinutes} minutes`,
          authenticated: isAuth,
          upgradeAvailable: !isAuth
        },
        retryAfter: Math.round(windowMs / 1000)
      })
    }
  })
}

/**
 * Predefined auth-aware rate limiters for common use cases
 */
const authAwareRateLimiters = {
  // For public player endpoints (generous for auth, restrictive for public)
  playerEndpoints: createAuthAwareRateLimit({
    unauthenticatedMax: 25,
    authenticatedMax: 500,
    windowMs: 15 * 60 * 1000,
    name: 'player-endpoints'
  }),

  // For general API endpoints
  generalEndpoints: createAuthAwareRateLimit({
    unauthenticatedMax: 20,
    authenticatedMax: 200,
    windowMs: 15 * 60 * 1000,
    name: 'general-endpoints'
  }),

  // For search endpoints (more restrictive due to processing overhead)
  searchEndpoints: createAuthAwareRateLimit({
    unauthenticatedMax: 10,
    authenticatedMax: 100,
    windowMs: 15 * 60 * 1000,
    name: 'search-endpoints'
  }),

  // For NFL state endpoint (very permissive since it's low-impact)
  nflStateEndpoint: createAuthAwareRateLimit({
    unauthenticatedMax: 50,
    authenticatedMax: 500,
    windowMs: 15 * 60 * 1000,
    name: 'nfl-state'
  })
}

module.exports = {
  createAuthAwareRateLimit,
  authAwareRateLimiters
}
