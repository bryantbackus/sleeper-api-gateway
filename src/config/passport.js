const passport = require('passport')
const OAuth2Strategy = require('passport-oauth2')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const jwt = require('jsonwebtoken')

// OAuth 2.0 Strategy (placeholder - customize based on your OAuth provider)
passport.use('oauth2', new OAuth2Strategy({
  authorizationURL: process.env.OAUTH_AUTHORIZATION_URL || 'https://example.com/oauth/authorize',
  tokenURL: process.env.OAUTH_TOKEN_URL || 'https://example.com/oauth/token',
  clientID: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  callbackURL: process.env.OAUTH_REDIRECT_URI
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Here you would typically save or look up the user in your database
    // For now, we'll create a simple user object
    const user = {
      id: profile.id || 'default-user',
      username: profile.username || 'default-user',
      accessToken,
      refreshToken
    }
    return done(null, user)
  } catch (error) {
    return done(error, null)
  }
}))

// JWT Strategy for API authentication
passport.use('jwt', new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'default-secret'
}, async (payload, done) => {
  try {
    // Validate the user from the JWT payload
    return done(null, payload)
  } catch (error) {
    return done(error, false)
  }
}))

// Serialize/deserialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser((id, done) => {
  // In a real app, you'd look up the user in your database
  done(null, { id })
})

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username 
    },
    process.env.JWT_SECRET || 'default-secret',
    { 
      expiresIn: '24h',
      issuer: 'sleeper-api-middleware'
    }
  )
}

module.exports = {
  passport,
  generateToken
}
