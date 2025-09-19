const database = require('../config/database')
const logger = require('../config/logger')

/**
 * User Profile Management - Handles per-user Sleeper credentials and preferences
 */

/**
 * Middleware to load user profile information and attach to request
 * This should be used after authentication middleware
 */
const loadUserProfile = async (req, res, next) => {
  try {
    // Only load profile for authenticated users
    if (!req.user || !req.user.id) {
      req.userProfile = getDefaultProfile()
      return next()
    }

    const profile = await database.getUserProfile(req.user.id)
    req.userProfile = profile || getDefaultProfile()
    
    logger.debug('User profile loaded:', { 
      userId: req.user.id, 
      hasSleeperUser: !!profile?.sleeper_user_id,
      sleeperUsername: profile?.sleeper_username 
    })
    
    next()
  } catch (error) {
    logger.error('Error loading user profile:', error)
    // Don't fail the request, just use defaults
    req.userProfile = getDefaultProfile()
    next()
  }
}

/**
 * Get default profile (falls back to environment variables)
 */
const getDefaultProfile = () => {
  return {
    user_id: 'default',
    sleeper_user_id: process.env.DEFAULT_USER_ID || null,
    sleeper_username: process.env.DEFAULT_USERNAME || null,
    display_name: 'Default User',
    preferences: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Get effective Sleeper user ID for a request
 * Priority: user profile > environment default > null
 */
const getEffectiveSleeperUserId = (req) => {
  return req.userProfile?.sleeper_user_id || 
         process.env.DEFAULT_USER_ID || 
         null
}

/**
 * Get effective Sleeper username for a request
 */
const getEffectiveSleeperUsername = (req) => {
  return req.userProfile?.sleeper_username || 
         process.env.DEFAULT_USERNAME || 
         null
}

/**
 * Validate Sleeper user ID format
 * Sleeper user IDs are typically 8-20 digit numeric strings
 */
const validateSleeperUserId = (sleeperUserId) => {
  if (!sleeperUserId) return false
  return /^\d{8,20}$/.test(sleeperUserId)
}

/**
 * Validate Sleeper username format
 * Sleeper usernames: 1-20 chars, alphanumeric, underscores, hyphens
 */
const validateSleeperUsername = (username) => {
  if (!username) return false
  return /^[a-zA-Z0-9_-]{1,20}$/.test(username)
}

/**
 * Check if user has a valid Sleeper profile configured
 */
const hasValidSleeperProfile = (req) => {
  const sleeperUserId = getEffectiveSleeperUserId(req)
  return sleeperUserId && validateSleeperUserId(sleeperUserId)
}

/**
 * Middleware to require a valid Sleeper profile
 */
const requireSleeperProfile = (req, res, next) => {
  if (!hasValidSleeperProfile(req)) {
    return res.status(400).json({
      error: 'No Sleeper user configured',
      message: 'Please set your Sleeper user ID in your profile first',
      hint: 'Use PUT /profile to set your sleeper_user_id'
    })
  }
  next()
}

module.exports = {
  loadUserProfile,
  getDefaultProfile,
  getEffectiveSleeperUserId,
  getEffectiveSleeperUsername,
  validateSleeperUserId,
  validateSleeperUsername,
  hasValidSleeperProfile,
  requireSleeperProfile
}
