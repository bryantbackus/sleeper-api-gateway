const rateLimit = require('express-rate-limit')
const logger = require('../config/logger')

const rateLimitEnabled = !process.env.RATE_LIMIT_ENABLED || 
  process.env.RATE_LIMIT_ENABLED.toLowerCase() !== 'false'
const noopLimiter = (req, res, next) => next()
const createLimiter = (options) => (rateLimitEnabled ? rateLimit(options) : noopLimiter)

// Rate limiter for general API requests
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    })
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    })
  }
})


// Rate limiter for authentication endpoints
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts',
    message: 'Rate limit exceeded for authentication. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    })
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Rate limit exceeded for authentication. Please try again later.'
    })
  }
})

// Rate limiter for Sleeper API endpoints
const sleeperApiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 Sleeper API requests per 15 minutes
  message: {
    error: 'Too many Sleeper API requests',
    message: 'Rate limit exceeded for Sleeper API endpoints. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Sleeper API rate limit exceeded:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    })
    res.status(429).json({
      error: 'Too many Sleeper API requests',
      message: 'Rate limit exceeded for Sleeper API endpoints. Please try again later.'
    })
  }
})

module.exports = {
  generalLimiter,
  authLimiter,
  sleeperApiLimiter,
  rateLimitEnabled
}