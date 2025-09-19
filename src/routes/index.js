const express = require('express')
const logger = require('../config/logger')
const cacheService = require('../services/cacheService')

const router = express.Router()

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    }

    // Try to get cache status to verify services are working
    try {
      const cacheStatus = await cacheService.getCacheStatus()
      health.cache = {
        status: 'healthy',
        lastRefresh: cacheStatus.lastRefresh,
        isRefreshing: cacheStatus.isRefreshing
      }
    } catch (error) {
      health.cache = {
        status: 'unhealthy',
        error: error.message
      }
      health.status = 'degraded'
    }

    const statusCode = health.status === 'healthy' ? 200 : 503
    res.status(statusCode).json(health)
  } catch (error) {
    logger.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// API information endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Sleeper API Middleware',
    version: '1.0.0',
    description: 'API middleware server for Sleeper fantasy football API with caching and authentication',
    documentation: {
      auth: '/auth - API key management and authentication',
      profile: '/profile - User profile management for multi-user support',
      sleeper: '/sleeper - Proxied Sleeper API endpoints with authentication',
      players: '/players - Player search and cached data endpoints',
      cache: '/cache - Cache management and statistics'
    },
    endpoints: {
      health: '/health',
      auth: {
        validate: '/auth/validate',
        createKey: '/auth/create-key',
        listKeys: '/auth/keys',
        revokeKey: '/auth/keys/:keyPrefix',
        devKey: '/auth/dev-key',
        cleanup: '/auth/cleanup'
      },
      profile: {
        get: '/profile',
        update: '/profile',
        delete: '/profile',
        verify: '/profile/verify-sleeper',
        status: '/profile/status'
      },
      sleeper: {
        user: '/sleeper/user/:identifier',
        leagues: '/sleeper/leagues/:sport/:season',
        league: '/sleeper/league/:leagueId',
        rosters: '/sleeper/league/:leagueId/rosters',
        users: '/sleeper/league/:leagueId/users',
        matchups: '/sleeper/league/:leagueId/matchups/:week',
        transactions: '/sleeper/league/:leagueId/transactions/:week',
        tradedPicks: '/sleeper/league/:leagueId/traded_picks',
        nflState: '/sleeper/state/nfl'
      },
      players: {
        all: '/players/nfl',
        trending: '/players/nfl/trending/:type',
        searchById: '/players/search/id/:playerId',
        searchByName: '/players/search/name?q=:searchTerm',
        searchByPosition: '/players/search/position/:position',
        searchByTeam: '/players/search/team/:team',
        active: '/players/active',
        cacheStatus: '/players/cache/status',
        cacheRefresh: '/players/cache/refresh'
      },
      cache: {
        stats: '/cache/stats',
        clear: '/cache/clear'
      }
    },
    support: {
      repository: 'https://github.com/yourusername/sleeper-api-middleware',
      documentation: 'https://docs.sleeper.com/'
    }
  })
})

// Catch-all for undefined routes
router.use('*', (req, res) => {
  logger.warn('Route not found:', { 
    method: req.method, 
    path: req.originalUrl,
    ip: req.ip 
  })
  
  res.status(404).json({
    error: 'Route not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    suggestion: 'Check the API documentation at the root endpoint /'
  })
})

module.exports = router
