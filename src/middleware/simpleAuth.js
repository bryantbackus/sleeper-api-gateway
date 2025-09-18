const crypto = require('crypto')
const database = require('../config/database')
const logger = require('../config/logger')

// Generate secure API key
const generateAPIKey = () => {
  return crypto.randomBytes(32).toString('hex')
}

// Middleware to require API key authentication
const requireAPIKey = async (req, res, next) => {
  try {
    // Get API key from header or query parameter
    const apiKey = req.headers['x-api-key'] || req.query.api_key

    if (!apiKey) {
      logger.warn('API request without key:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      })
      return res.status(401).json({
        error: 'API key required',
        message: 'Provide API key in X-API-Key header or api_key query parameter'
      })
    }

    // Validate API key
    const keyRecord = await database.getAPIKey(apiKey)
    
    if (!keyRecord) {
      logger.warn('Invalid API key attempt:', {
        keyPrefix: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      })
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been revoked'
      })
    }

    // Update last used timestamp (don't await to avoid blocking request)
    database.updateAPIKeyLastUsed(apiKey).catch(error => {
      logger.error('Error updating API key last used:', error)
    })

    // Add user info to request
    req.user = {
      id: keyRecord.user_id,
      apiKey: apiKey.substring(0, 8) + '...' // For logging purposes
    }

    logger.info('API request authenticated:', {
      userId: req.user.id,
      keyPrefix: req.user.apiKey,
      path: req.path
    })

    next()
  } catch (error) {
    logger.error('API key authentication error:', error)
    res.status(500).json({
      error: 'Authentication service error',
      message: 'An error occurred during authentication'
    })
  }
}

// Middleware for optional API key authentication
const optionalAPIKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key

    if (!apiKey) {
      // No API key provided, continue without authentication
      return next()
    }

    // Try to validate API key
    const keyRecord = await database.getAPIKey(apiKey)
    
    if (keyRecord) {
      // Valid key, add user info
      req.user = {
        id: keyRecord.user_id,
        apiKey: apiKey.substring(0, 8) + '...'
      }

      // Update last used timestamp
      database.updateAPIKeyLastUsed(apiKey).catch(error => {
        logger.error('Error updating API key last used:', error)
      })

      logger.info('Optional API request authenticated:', {
        userId: req.user.id,
        keyPrefix: req.user.apiKey,
        path: req.path
      })
    } else {
      logger.warn('Invalid API key in optional auth:', {
        keyPrefix: apiKey.substring(0, 8) + '...',
        ip: req.ip,
        path: req.path
      })
    }

    next()
  } catch (error) {
    logger.error('Optional API key authentication error:', error)
    // Don't fail the request, just continue without authentication
    next()
  }
}

// Middleware to check master key for admin operations
const requireMasterKey = (req, res, next) => {
  const masterKey = req.headers['x-master-key'] || req.query.master_key
  const expectedMasterKey = process.env.MASTER_KEY

  if (!expectedMasterKey) {
    logger.error('MASTER_KEY not configured')
    return res.status(500).json({
      error: 'Configuration error',
      message: 'Master key not configured on server'
    })
  }

  if (!masterKey || masterKey !== expectedMasterKey) {
    logger.warn('Invalid master key attempt:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    })
    return res.status(401).json({
      error: 'Master key required',
      message: 'Valid master key required for this operation'
    })
  }

  logger.info('Master key authenticated:', {
    ip: req.ip,
    path: req.path
  })

  next()
}

// Utility function to mask API keys for display
const maskAPIKey = (key) => {
  if (!key || key.length < 16) return key
  return key.substring(0, 8) + '...' + key.substring(key.length - 4)
}

// Validate API key format
const validateAPIKeyFormat = (key) => {
  return typeof key === 'string' && 
         key.length === 64 && 
         /^[a-f0-9]+$/.test(key)
}

module.exports = {
  generateAPIKey,
  requireAPIKey,
  optionalAPIKey,
  requireMasterKey,
  maskAPIKey,
  validateAPIKeyFormat
}
