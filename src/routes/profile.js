const express = require('express')
const { body, validationResult } = require('express-validator')
const { requireAPIKey } = require('../middleware/simpleAuth')
const { loadUserProfile, validateSleeperUserId, validateSleeperUsername } = require('../middleware/userProfile')
const { authLimiter } = require('../middleware/rateLimiter')
const database = require('../config/database')
const sleeperService = require('../services/sleeperService')
const logger = require('../config/logger')

const router = express.Router()

// Apply authentication to all profile routes
router.use(requireAPIKey)
router.use(loadUserProfile)

// Validation middleware
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

// GET /profile - Get current user's profile
router.get('/', authLimiter, async (req, res) => {
  try {
    const profile = req.userProfile
    
    // Don't expose internal database fields
    const publicProfile = {
      sleeper_user_id: profile.sleeper_user_id,
      sleeper_username: profile.sleeper_username,
      display_name: profile.display_name,
      preferences: profile.preferences || {},
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      is_default: profile.user_id === 'default'
    }

    logger.info('Profile retrieved:', { userId: req.user.id })
    res.json({
      success: true,
      profile: publicProfile
    })
  } catch (error) {
    logger.error('Error getting profile:', error)
    res.status(500).json({
      error: 'Failed to get profile',
      message: error.message
    })
  }
})

// PUT /profile - Update user's profile
router.put('/',
  authLimiter,
  body('sleeper_user_id').optional().custom((value) => {
    if (value && !validateSleeperUserId(value)) {
      throw new Error('Invalid Sleeper user ID format (must be 8-20 digits)')
    }
    return true
  }),
  body('sleeper_username').optional().custom((value) => {
    if (value && !validateSleeperUsername(value)) {
      throw new Error('Invalid Sleeper username format (1-20 chars, alphanumeric, underscores, hyphens)')
    }
    return true
  }),
  body('display_name').optional().isLength({ min: 1, max: 50 }).withMessage('Display name must be 1-50 characters'),
  body('preferences').optional().isObject().withMessage('Preferences must be an object'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sleeper_user_id, sleeper_username, display_name, preferences } = req.body
      
      // If Sleeper user ID provided, verify it exists
      if (sleeper_user_id) {
        try {
          const sleeperUser = await sleeperService.getUser(sleeper_user_id)
          if (!sleeperUser) {
            return res.status(400).json({
              error: 'Invalid Sleeper user',
              message: 'Sleeper user ID not found'
            })
          }
          
          // Auto-populate username if not provided
          if (!sleeper_username && sleeperUser.username) {
            req.body.sleeper_username = sleeperUser.username
          }
          
          // Auto-populate display name if not provided
          if (!display_name && sleeperUser.display_name) {
            req.body.display_name = sleeperUser.display_name
          }
        } catch (error) {
          return res.status(400).json({
            error: 'Invalid Sleeper user',
            message: 'Could not verify Sleeper user ID'
          })
        }
      }

      const profileData = {
        sleeper_user_id: req.body.sleeper_user_id,
        sleeper_username: req.body.sleeper_username,
        display_name: req.body.display_name,
        preferences: preferences || {}
      }

      await database.createUserProfile(req.user.id, profileData)
      
      logger.info('Profile updated:', { 
        userId: req.user.id, 
        sleeper_user_id: profileData.sleeper_user_id,
        sleeper_username: profileData.sleeper_username 
      })
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        profile: profileData
      })
    } catch (error) {
      logger.error('Error updating profile:', error)
      res.status(500).json({
        error: 'Failed to update profile',
        message: error.message
      })
    }
  }
)

// DELETE /profile - Delete user's profile (reset to defaults)
router.delete('/', authLimiter, async (req, res) => {
  try {
    await database.deleteUserProfile(req.user.id)
    
    logger.info('Profile deleted:', { userId: req.user.id })
    res.json({
      success: true,
      message: 'Profile deleted successfully. You will now use default settings.'
    })
  } catch (error) {
    logger.error('Error deleting profile:', error)
    res.status(500).json({
      error: 'Failed to delete profile',
      message: error.message
    })
  }
})

// POST /profile/verify-sleeper - Verify Sleeper credentials
router.post('/verify-sleeper',
  authLimiter,
  body('sleeper_user_id').notEmpty().withMessage('Sleeper user ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sleeper_user_id } = req.body
      
      if (!validateSleeperUserId(sleeper_user_id)) {
        return res.status(400).json({
          error: 'Invalid format',
          message: 'Sleeper user ID must be 8-20 digits'
        })
      }
      
      const sleeperUser = await sleeperService.getUser(sleeper_user_id)
      
      if (!sleeperUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Sleeper user not found'
        })
      }

      logger.info('Sleeper user verified:', { userId: req.user.id, sleeper_user_id })
      res.json({
        success: true,
        message: 'Sleeper user verified successfully',
        sleeper_user: {
          user_id: sleeperUser.user_id,
          username: sleeperUser.username,
          display_name: sleeperUser.display_name,
          avatar: sleeperUser.avatar
        }
      })
    } catch (error) {
      logger.error('Error verifying Sleeper user:', error)
      res.status(500).json({
        error: 'Failed to verify Sleeper user',
        message: error.message
      })
    }
  }
)

// GET /profile/status - Get profile status and recommendations
router.get('/status', authLimiter, async (req, res) => {
  try {
    const profile = req.userProfile
    const isDefault = profile.user_id === 'default'
    const hasSleeperUser = !!profile.sleeper_user_id
    
    const status = {
      configured: hasSleeperUser,
      using_defaults: isDefault,
      sleeper_user_id: profile.sleeper_user_id,
      sleeper_username: profile.sleeper_username,
      display_name: profile.display_name
    }
    
    const recommendations = []
    
    if (isDefault || !hasSleeperUser) {
      recommendations.push({
        action: 'set_sleeper_user_id',
        message: 'Set your Sleeper user ID to get personalized data',
        endpoint: 'PUT /profile',
        priority: 'high'
      })
    }
    
    if (hasSleeperUser && !profile.sleeper_username) {
      recommendations.push({
        action: 'set_sleeper_username',
        message: 'Add your Sleeper username for better identification',
        endpoint: 'PUT /profile',
        priority: 'medium'
      })
    }
    
    logger.info('Profile status checked:', { userId: req.user.id, configured: hasSleeperUser })
    res.json({
      success: true,
      status,
      recommendations
    })
  } catch (error) {
    logger.error('Error getting profile status:', error)
    res.status(500).json({
      error: 'Failed to get profile status',
      message: error.message
    })
  }
})

module.exports = router
