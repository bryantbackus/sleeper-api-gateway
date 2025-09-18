require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const session = require('express-session')
const { passport } = require('./config/passport')
const database = require('./config/database')
const cacheService = require('./services/cacheService')
const logger = require('./config/logger')

// Import routes
const authRoutes = require('./routes/auth')
const sleeperRoutes = require('./routes/sleeper')
const playersRoutes = require('./routes/players')
const indexRoutes = require('./routes/index')

// Import middleware
const { generalLimiter } = require('./middleware/rateLimiter')

const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy (important for rate limiting and logging when behind nginx)
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.DOMAIN, `https://${process.env.DOMAIN}`, `https://api.${process.env.DOMAIN}`]
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
  credentials: true,
  optionsSuccessStatus: 200
}))

// Compression middleware
app.use(compression())

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Session configuration (for OAuth flow)
app.use(session({
  secret: process.env.JWT_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// Apply rate limiting
app.use(generalLimiter)

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })
  next()
})

// Routes
app.use('/auth', authRoutes)
app.use('/sleeper', sleeperRoutes)
app.use('/players', playersRoutes)
app.use('/', indexRoutes)

// Global error handler
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  })

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    ...(isDevelopment && { stack: error.stack })
  })
})

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown`)
  
  try {
    // Close database connection
    await database.close()
    logger.info('Database connection closed')
    
    process.exit(0)
  } catch (error) {
    logger.error('Error during graceful shutdown:', error)
    process.exit(1)
  }
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Initialize and start server
async function startServer() {
  try {
    // Connect to database
    await database.connect()
    logger.info('Database connected successfully')
    
    // Initialize cache service
    await cacheService.initialize()
    logger.info('Cache service initialized')
    
    // Start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`)
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`Health check available at: http://localhost:${PORT}/health`)
    })

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`)
      } else {
        logger.error('Server error:', error)
      }
      process.exit(1)
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()
