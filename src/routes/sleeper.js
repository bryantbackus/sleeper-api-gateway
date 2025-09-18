const express = require('express')
const { body, param, query, validationResult } = require('express-validator')
const sleeperService = require('../services/sleeperService')
const { requireAPIKey, optionalAPIKey } = require('../middleware/simpleAuth')
const { sleeperApiLimiter } = require('../middleware/rateLimiter')
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

// Helper function to get default user ID
const getDefaultUserId = () => {
  return process.env.DEFAULT_USER_ID || 'default-user'
}

// User endpoints
router.get('/user/:identifier', 
  requireAPIKey,
  sleeperApiLimiter,
  param('identifier').notEmpty().withMessage('User identifier is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { identifier } = req.params
      const user = await sleeperService.getUser(identifier)
      
      logger.info('User data retrieved:', { identifier, userId: req.user.id })
      res.json(user)
    } catch (error) {
      logger.error('Error fetching user:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch user',
        message: error.message
      })
    }
  }
)

// League endpoints
router.get('/user/:userId/leagues/:sport/:season',
  requireAPIKey,
  sleeperApiLimiter,
  param('userId').notEmpty().withMessage('User ID is required'),
  param('sport').isIn(['nfl']).withMessage('Sport must be nfl'),
  param('season').isInt({ min: 2017, max: new Date().getFullYear() + 1 }).withMessage('Invalid season'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId, sport, season } = req.params
      const leagues = await sleeperService.getUserLeagues(userId, sport, season)
      
      logger.info('User leagues retrieved:', { userId, sport, season, count: leagues.length })
      res.json(leagues)
    } catch (error) {
      logger.error('Error fetching user leagues:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch user leagues',
        message: error.message
      })
    }
  }
)

// Get leagues for default user (convenience endpoint)
router.get('/leagues/:sport/:season',
  requireAPIKey,
  sleeperApiLimiter,
  param('sport').isIn(['nfl']).withMessage('Sport must be nfl'),
  param('season').isInt({ min: 2017, max: new Date().getFullYear() + 1 }).withMessage('Invalid season'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { sport, season } = req.params
      const userId = getDefaultUserId()
      const leagues = await sleeperService.getUserLeagues(userId, sport, season)
      
      logger.info('Default user leagues retrieved:', { userId, sport, season, count: leagues.length })
      res.json(leagues)
    } catch (error) {
      logger.error('Error fetching default user leagues:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch leagues',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId } = req.params
      const league = await sleeperService.getLeague(leagueId)
      
      logger.info('League data retrieved:', { leagueId })
      res.json(league)
    } catch (error) {
      logger.error('Error fetching league:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/rosters',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId } = req.params
      const rosters = await sleeperService.getLeagueRosters(leagueId)
      
      logger.info('League rosters retrieved:', { leagueId, count: rosters.length })
      res.json(rosters)
    } catch (error) {
      logger.error('Error fetching league rosters:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league rosters',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/users',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId } = req.params
      const users = await sleeperService.getLeagueUsers(leagueId)
      
      logger.info('League users retrieved:', { leagueId, count: users.length })
      res.json(users)
    } catch (error) {
      logger.error('Error fetching league users:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league users',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/matchups/:week',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  param('week').isInt({ min: 1, max: 18 }).withMessage('Week must be between 1 and 18'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId, week } = req.params
      const matchups = await sleeperService.getLeagueMatchups(leagueId, week)
      
      logger.info('League matchups retrieved:', { leagueId, week, count: matchups.length })
      res.json(matchups)
    } catch (error) {
      logger.error('Error fetching league matchups:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league matchups',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/winners_bracket',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId } = req.params
      const bracket = await sleeperService.getLeaguePlayoffBracket(leagueId)
      
      logger.info('Playoff bracket retrieved:', { leagueId })
      res.json(bracket)
    } catch (error) {
      logger.error('Error fetching playoff bracket:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch playoff bracket',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/transactions/:round?',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  param('round').optional().isInt({ min: 1 }).withMessage('Round must be a positive integer'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId, round } = req.params
      const transactions = await sleeperService.getLeagueTransactions(leagueId, round)
      
      logger.info('League transactions retrieved:', { leagueId, round, count: transactions.length })
      res.json(transactions)
    } catch (error) {
      logger.error('Error fetching league transactions:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league transactions',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/traded_picks',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId } = req.params
      const tradedPicks = await sleeperService.getLeagueTradedPicks(leagueId)
      
      logger.info('League traded picks retrieved:', { leagueId, count: tradedPicks.length })
      res.json(tradedPicks)
    } catch (error) {
      logger.error('Error fetching league traded picks:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league traded picks',
        message: error.message
      })
    }
  }
)

// Draft endpoints
router.get('/user/:userId/drafts/:sport/:season',
  requireAPIKey,
  sleeperApiLimiter,
  param('userId').notEmpty().withMessage('User ID is required'),
  param('sport').isIn(['nfl']).withMessage('Sport must be nfl'),
  param('season').isInt({ min: 2017, max: new Date().getFullYear() + 1 }).withMessage('Invalid season'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId, sport, season } = req.params
      const drafts = await sleeperService.getUserDrafts(userId, sport, season)
      
      logger.info('User drafts retrieved:', { userId, sport, season, count: drafts.length })
      res.json(drafts)
    } catch (error) {
      logger.error('Error fetching user drafts:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch user drafts',
        message: error.message
      })
    }
  }
)

router.get('/league/:leagueId/drafts',
  requireAPIKey,
  sleeperApiLimiter,
  param('leagueId').notEmpty().withMessage('League ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { leagueId } = req.params
      const drafts = await sleeperService.getLeagueDrafts(leagueId)
      
      logger.info('League drafts retrieved:', { leagueId, count: drafts.length })
      res.json(drafts)
    } catch (error) {
      logger.error('Error fetching league drafts:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch league drafts',
        message: error.message
      })
    }
  }
)

router.get('/draft/:draftId',
  requireAPIKey,
  sleeperApiLimiter,
  param('draftId').notEmpty().withMessage('Draft ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { draftId } = req.params
      const draft = await sleeperService.getDraft(draftId)
      
      logger.info('Draft data retrieved:', { draftId })
      res.json(draft)
    } catch (error) {
      logger.error('Error fetching draft:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch draft',
        message: error.message
      })
    }
  }
)

router.get('/draft/:draftId/picks',
  requireAPIKey,
  sleeperApiLimiter,
  param('draftId').notEmpty().withMessage('Draft ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { draftId } = req.params
      const picks = await sleeperService.getDraftPicks(draftId)
      
      logger.info('Draft picks retrieved:', { draftId, count: picks.length })
      res.json(picks)
    } catch (error) {
      logger.error('Error fetching draft picks:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch draft picks',
        message: error.message
      })
    }
  }
)

router.get('/draft/:draftId/traded_picks',
  requireAPIKey,
  sleeperApiLimiter,
  param('draftId').notEmpty().withMessage('Draft ID is required'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { draftId } = req.params
      const tradedPicks = await sleeperService.getDraftTradedPicks(draftId)
      
      logger.info('Draft traded picks retrieved:', { draftId, count: tradedPicks.length })
      res.json(tradedPicks)
    } catch (error) {
      logger.error('Error fetching draft traded picks:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch draft traded picks',
        message: error.message
      })
    }
  }
)

// NFL State endpoint
router.get('/state/nfl',
  optionalAPIKey, // NFL state doesn't require auth
  sleeperApiLimiter,
  async (req, res) => {
    try {
      const nflState = await sleeperService.getNFLState()
      
      logger.info('NFL state retrieved')
      res.json(nflState)
    } catch (error) {
      logger.error('Error fetching NFL state:', error)
      res.status(error.status || 500).json({
        error: 'Failed to fetch NFL state',
        message: error.message
      })
    }
  }
)

module.exports = router
