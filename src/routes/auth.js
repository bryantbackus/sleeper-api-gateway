const express = require('express')
const { body, validationResult } = require('express-validator')
const { 
  generateAPIKey, 
  requireMasterKey, 
  maskAPIKey, 
  validateAPIKeyFormat 
} = require('../middleware/simpleAuth')
const database = require('../config/database')
const { authLimiter } = require('../middleware/rateLimiter')
const logger = require('../config/logger')

const router = express.Router()

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

// Create new API key (protected by master key)
router.post('/create-key', 
  authLimiter,
  requireMasterKey,
  body('userId').notEmpty().withMessage('User ID is required'),
  body('description').optional().isLength({ max: 255 }).withMessage('Description too long'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId, description } = req.body
      const apiKey = generateAPIKey()

      await database.createAPIKey(apiKey, userId, description)

      logger.info('API key created:', {
        userId,
        keyPrefix: maskAPIKey(apiKey),
        description: description || 'No description'
      })

      res.json({
        success: true,
        message: 'API key created successfully',
        apiKey,
        userId,
        description,
        usage: {
          header: 'X-API-Key: ' + apiKey,
          query: '?api_key=' + apiKey
        },
        warning: 'Save this key securely - it cannot be retrieved again'
      })
    } catch (error) {
      logger.error('Error creating API key:', error)
      res.status(500).json({
        error: 'Failed to create API key',
        message: error.message
      })
    }
  }
)

// List all active API keys (masked)
router.get('/keys', 
  requireMasterKey,
  async (req, res) => {
    try {
      const keys = await database.getAllAPIKeys()
      
      const maskedKeys = keys.map(key => ({
        keyPrefix: maskAPIKey(key.key),
        userId: key.user_id,
        description: key.description,
        createdAt: key.created_at,
        lastUsed: key.last_used,
        active: key.active === 1
      }))

      res.json({
        success: true,
        keys: maskedKeys,
        total: maskedKeys.length,
        active: maskedKeys.filter(k => k.active).length
      })
    } catch (error) {
      logger.error('Error listing API keys:', error)
      res.status(500).json({
        error: 'Failed to list API keys',
        message: error.message
      })
    }
  }
)

// Revoke an API key by prefix
router.delete('/keys/:keyPrefix', 
  requireMasterKey,
  async (req, res) => {
    try {
      const { keyPrefix } = req.params

      if (!keyPrefix || keyPrefix.length < 8) {
        return res.status(400).json({
          error: 'Invalid key prefix',
          message: 'Provide at least 8 characters of the key'
        })
      }

      const result = await database.revokeAPIKey(keyPrefix)

      if (result.changes === 0) {
        return res.status(404).json({
          error: 'Key not found',
          message: 'No active API key found with that prefix'
        })
      }

      logger.info('API key revoked:', {
        keyPrefix: keyPrefix + '...',
        changes: result.changes
      })

      res.json({
        success: true,
        message: 'API key revoked successfully',
        keyPrefix: keyPrefix + '...',
        keysRevoked: result.changes
      })
    } catch (error) {
      logger.error('Error revoking API key:', error)
      res.status(500).json({
        error: 'Failed to revoke API key',
        message: error.message
      })
    }
  }
)

// Validate API key endpoint
router.get('/validate', 
  async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.api_key

      if (!apiKey) {
        return res.status(400).json({
          valid: false,
          error: 'No API key provided'
        })
      }

      if (!validateAPIKeyFormat(apiKey)) {
        return res.status(400).json({
          valid: false,
          error: 'Invalid API key format'
        })
      }

      const keyRecord = await database.getAPIKey(apiKey)

      if (!keyRecord) {
        return res.status(401).json({
          valid: false,
          error: 'Invalid or revoked API key'
        })
      }

      res.json({
        valid: true,
        userId: keyRecord.user_id,
        description: keyRecord.description,
        createdAt: keyRecord.created_at,
        lastUsed: keyRecord.last_used
      })
    } catch (error) {
      logger.error('Error validating API key:', error)
      res.status(500).json({
        error: 'Validation service error',
        message: error.message
      })
    }
  }
)

// Clean up old revoked keys (master key required)
router.post('/cleanup', 
  requireMasterKey,
  async (req, res) => {
    try {
      const daysOld = parseInt(req.body.daysOld) || 90
      const result = await database.cleanupInactiveKeys(daysOld)

      logger.info('API keys cleaned up:', {
        daysOld,
        keysDeleted: result.changes
      })

      res.json({
        success: true,
        message: 'Old revoked keys cleaned up',
        keysDeleted: result.changes,
        daysOld
      })
    } catch (error) {
      logger.error('Error cleaning up API keys:', error)
      res.status(500).json({
        error: 'Failed to cleanup keys',
        message: error.message
      })
    }
  }
)

// Development endpoint for creating test API keys
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-key', authLimiter, async (req, res) => {
    try {
      const { userId = 'dev-user', description = 'Development key' } = req.body
      const apiKey = generateAPIKey()

      await database.createAPIKey(apiKey, userId, description)

      logger.warn('Development API key created:', { 
        userId, 
        keyPrefix: maskAPIKey(apiKey) 
      })

      res.json({
        success: true,
        message: 'Development API key created',
        apiKey,
        userId,
        description,
        usage: {
          header: 'X-API-Key: ' + apiKey,
          query: '?api_key=' + apiKey
        },
        warning: 'This endpoint is only available in development mode'
      })
    } catch (error) {
      logger.error('Error creating dev API key:', error)
      res.status(500).json({
        error: 'Failed to create development key',
        message: error.message
      })
    }
  })
}

module.exports = router
