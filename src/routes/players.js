const express = require('express')
const { query, param, validationResult } = require('express-validator')
const cacheService = require('../services/cacheService')
const playerSearchService = require('../services/playerSearchService')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const { generalLimiter } = require('../middleware/rateLimiter')
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

// Get all players (cached)
router.get('/nfl',
  optionalAuth, // Players data doesn't require auth
  generalLimiter,
  async (req, res) => {
    try {
      const players = await cacheService.getAllPlayers()
      const playerCount = Object.keys(players).length
      
      logger.info('All players retrieved from cache:', { count: playerCount })
      res.json(players)
    } catch (error) {
      logger.error('Error fetching all players:', error)
      res.status(500).json({
        error: 'Failed to fetch players',
        message: error.message
      })
    }
  }
)

// Get trending players (cached)
router.get('/nfl/trending/:type',
  optionalAuth,
  generalLimiter,
  param('type').isIn(['add', 'drop']).withMessage('Type must be add or drop'),
  query('lookback_hours').optional().isInt({ min: 1, max: 168 }).withMessage('Lookback hours must be between 1 and 168'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { type } = req.params
      const trendingPlayers = await cacheService.getTrendingPlayers(type)
      
      logger.info('Trending players retrieved from cache:', { type, count: trendingPlayers.length })
      
      // Apply limit if specified
      const limit = parseInt(req.query.limit) || trendingPlayers.length
      const limitedResults = trendingPlayers.slice(0, limit)
      
      res.json(limitedResults)
    } catch (error) {
      logger.error('Error fetching trending players:', error)
      res.status(500).json({
        error: 'Failed to fetch trending players',
        message: error.message
      })
    }
  }
)

// Search players by ID
router.get('/search/id/:playerId',
  optionalAuth,
  generalLimiter,
  param('playerId').notEmpty().withMessage('Player ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { playerId } = req.params
      const player = await playerSearchService.searchPlayerById(playerId)
      
      if (!player) {
        logger.info('Player not found:', { playerId })
        return res.status(404).json({
          error: 'Player not found',
          message: `No player found with ID: ${playerId}`
        })
      }
      
      logger.info('Player retrieved by ID:', { playerId })
      res.json(player)
    } catch (error) {
      logger.error('Error searching player by ID:', error)
      res.status(500).json({
        error: 'Failed to search player',
        message: error.message
      })
    }
  }
)

// Search players by name
router.get('/search/name',
  optionalAuth,
  generalLimiter,
  query('q').notEmpty().withMessage('Search query is required'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { q: searchTerm } = req.query
      const limit = parseInt(req.query.limit) || 10
      
      const players = await playerSearchService.searchPlayersByName(searchTerm, limit)
      
      logger.info('Players search by name:', { searchTerm, count: players.length })
      res.json({
        search_term: searchTerm,
        total_results: players.length,
        players
      })
    } catch (error) {
      logger.error('Error searching players by name:', error)
      res.status(500).json({
        error: 'Failed to search players',
        message: error.message
      })
    }
  }
)

// Search players by position
router.get('/search/position/:position',
  optionalAuth,
  generalLimiter,
  param('position').isIn(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']).withMessage('Invalid position'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { position } = req.params
      const limit = parseInt(req.query.limit) || 50
      
      const players = await playerSearchService.searchPlayersByPosition(position, limit)
      
      logger.info('Players search by position:', { position, count: players.length })
      res.json({
        position,
        total_results: players.length,
        players
      })
    } catch (error) {
      logger.error('Error searching players by position:', error)
      res.status(500).json({
        error: 'Failed to search players',
        message: error.message
      })
    }
  }
)

// Search players by team
router.get('/search/team/:team',
  optionalAuth,
  generalLimiter,
  param('team').isLength({ min: 2, max: 3 }).withMessage('Team must be 2-3 characters'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { team } = req.params
      const limit = parseInt(req.query.limit) || 50
      
      const players = await playerSearchService.searchPlayersByTeam(team, limit)
      
      logger.info('Players search by team:', { team, count: players.length })
      res.json({
        team: team.toUpperCase(),
        total_results: players.length,
        players
      })
    } catch (error) {
      logger.error('Error searching players by team:', error)
      res.status(500).json({
        error: 'Failed to search players',
        message: error.message
      })
    }
  }
)

// Get active players only
router.get('/active',
  optionalAuth,
  generalLimiter,
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100
      
      const players = await playerSearchService.getActivePlayersOnly(limit)
      
      logger.info('Active players retrieved:', { count: players.length })
      res.json({
        total_results: players.length,
        players
      })
    } catch (error) {
      logger.error('Error fetching active players:', error)
      res.status(500).json({
        error: 'Failed to fetch active players',
        message: error.message
      })
    }
  }
)

// Cache management endpoints (require auth)
router.get('/cache/status',
  requireAuth,
  async (req, res) => {
    try {
      const status = await cacheService.getCacheStatus()
      
      logger.info('Cache status retrieved')
      res.json(status)
    } catch (error) {
      logger.error('Error getting cache status:', error)
      res.status(500).json({
        error: 'Failed to get cache status',
        message: error.message
      })
    }
  }
)

router.post('/cache/refresh',
  requireAuth,
  async (req, res) => {
    try {
      // Don't wait for the refresh to complete, just trigger it
      cacheService.forceRefresh().catch(error => {
        logger.error('Error in background cache refresh:', error)
      })
      
      logger.info('Cache refresh triggered by user:', { userId: req.user.id })
      res.json({
        success: true,
        message: 'Cache refresh initiated in background'
      })
    } catch (error) {
      logger.error('Error triggering cache refresh:', error)
      res.status(500).json({
        error: 'Failed to trigger cache refresh',
        message: error.message
      })
    }
  }
)

module.exports = router
