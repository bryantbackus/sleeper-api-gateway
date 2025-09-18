const { passport } = require('../config/passport')
const logger = require('../config/logger')

// Middleware to require JWT authentication
const requireAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Authentication error:', err)
      return res.status(500).json({ error: 'Authentication service error' })
    }

    if (!user) {
      logger.warn('Unauthorized access attempt:', { 
        ip: req.ip, 
        userAgent: req.get('User-Agent'),
        path: req.path 
      })
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Valid authentication token required' 
      })
    }

    req.user = user
    next()
  })(req, res, next)
}

// Optional auth middleware - doesn't fail if no token
const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (!err && user) {
      req.user = user
    }
    next()
  })(req, res, next)
}

// Middleware to check if user has access to specific resources
const checkAccess = (req, res, next) => {
  // Add custom access control logic here
  // For now, all authenticated users have access
  next()
}

module.exports = {
  requireAuth,
  optionalAuth,
  checkAccess
}
