const express = require('express')
const { passport, generateToken } = require('../config/passport')
const { authLimiter } = require('../middleware/rateLimiter')
const logger = require('../config/logger')

const router = express.Router()

// OAuth 2.0 login initiation
router.get('/login', authLimiter, passport.authenticate('oauth2'))

// OAuth 2.0 callback
router.get('/callback', authLimiter, 
  passport.authenticate('oauth2', { failureRedirect: '/auth/login' }),
  (req, res) => {
    try {
      // Generate JWT token for the authenticated user
      const token = generateToken(req.user)
      
      logger.info('User authenticated successfully:', { userId: req.user.id })
      
      // Return token (in production, you might want to set it as an httpOnly cookie)
      res.json({
        success: true,
        message: 'Authentication successful',
        token,
        user: {
          id: req.user.id,
          username: req.user.username
        }
      })
    } catch (error) {
      logger.error('Error in auth callback:', error)
      res.status(500).json({
        error: 'Authentication failed',
        message: 'An error occurred during authentication'
      })
    }
  }
)

// Token validation endpoint
router.get('/validate', 
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.json({
      valid: true,
      user: req.user
    })
  }
)

// Logout endpoint
router.post('/logout', (req, res) => {
  // For JWT, we can't really "logout" server-side unless we maintain a blacklist
  // Client should simply discard the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  })
})

// Development-only endpoint for generating test tokens
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-token', authLimiter, (req, res) => {
    try {
      const { userId = 'dev-user', username = 'dev-user' } = req.body
      
      const testUser = { id: userId, username }
      const token = generateToken(testUser)
      
      logger.warn('Development token generated:', { userId, username })
      
      res.json({
        success: true,
        message: 'Development token generated',
        token,
        user: testUser,
        warning: 'This endpoint is only available in development mode'
      })
    } catch (error) {
      logger.error('Error generating dev token:', error)
      res.status(500).json({
        error: 'Token generation failed',
        message: 'Failed to generate development token'
      })
    }
  })
}

module.exports = router
