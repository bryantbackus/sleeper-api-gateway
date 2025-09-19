const rateLimit = require('express-rate-limit')
const logger = require('../config/logger')

// Rate limiter for general API requests
const generalLimiter = rateLimit({
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

// Rate limiter for Sleeper API proxy requests (more restrictive)
const sleeperApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 requests per minute (staying under Sleeper's 1000/min limit)
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many API requests. Please slow down.'
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
      error: 'Rate limit exceeded',
      message: 'Too many API requests. Please slow down.'
    })
  }
})

// Rate limiter for authentication endpoints
const authLimiter = rateLimit({
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

module.exports = {
  generalLimiter,
  sleeperApiLimiter,
  authLimiter
}

// Note: Auth-aware rate limiters are available in authAwareRateLimit.js
// This keeps this file focused on traditional rate limiting
