const express = require('express')
const logger = require('../config/logger')
const cacheService = require('../services/cacheService')

const router = express.Router()

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const cacheInfo = {
      status: 'unknown',
      lastRefresh: null,
      isRefreshing: false
    }

    let overallStatus = 'healthy'

    try {
      const cacheStatus = await cacheService.getCacheStatus()
      
      const cacheHealth = {
        status: 'healthy',
        lastSuccessfulRefresh: cacheStatus.lastRefresh ?? null,
        lastFailedRefresh: cacheStatus.lastRefreshFailure ?? null,
        isRefreshing: cacheStatus.isRefreshing,
        nextRefreshTime: cacheStatus.nextRefreshTime ?? null,
        minutesSinceLastSuccess: cacheStatus.minutesSinceLastSuccess,
        staleForMinutes: cacheStatus.isStale && typeof cacheStatus.minutesSinceLastSuccess === 'number'
          ? cacheStatus.minutesSinceLastSuccess
          : null,
        isStale: cacheStatus.isStale,
        failureMoreRecentThanSuccess: cacheStatus.failureMoreRecentThanSuccess,
        playersDataSize: cacheStatus.playersDataSize,
        trendingAddDataSize: cacheStatus.trendingAddDataSize,
        trendingDropDataSize: cacheStatus.trendingDropDataSize
      }

      if (cacheStatus.isStale || cacheStatus.failureMoreRecentThanSuccess) {
        cacheHealth.status = cacheStatus.isStale ? 'stale' : 'degraded'
        health.status = 'degraded'
      }

      health.cache = cacheHealth

    } catch (error) {
      cacheInfo.status = 'unhealthy'
      cacheInfo.error = error.message
      overallStatus = 'degraded'
    }

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      cache: cacheInfo
    }

    const statusCodeMap = {
      healthy: 200,
      degraded: 200,
      unhealthy: 503
    }

    const statusCode = statusCodeMap[health.status] ?? 503
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
    name: 'Sleeper API Gateway',
    version: '1.0.0',
    description: 'API gateway for Sleeper fantasy football API with caching and authentication',
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
      repository: 'https://github.com/bryantbackus/sleeper-api-gateway',
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
