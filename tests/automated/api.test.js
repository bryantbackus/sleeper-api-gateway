jest.mock('../../src/services/cacheService', () => ({
  getAllPlayers: jest.fn(),
  getTrendingPlayers: jest.fn(),
  getCacheStatus: jest.fn(),
  forceRefresh: jest.fn()
}))

jest.mock('../../src/services/playerSearchService', () => ({
  searchPlayersByName: jest.fn(),
  searchPlayersByPosition: jest.fn(),
  searchPlayersByTeam: jest.fn(),
  getActivePlayersOnly: jest.fn(),
  searchPlayerById: jest.fn(),
  searchPlayersByIds: jest.fn()
}))

jest.mock('../../src/services/sleeperService', () => ({
  getNFLState: jest.fn(),
  getUser: jest.fn(),
  getUserLeagues: jest.fn(),
  getLeague: jest.fn(),
  getLeagueRosters: jest.fn(),
  getLeagueUsers: jest.fn(),
  getLeagueMatchups: jest.fn(),
  getLeagueTransactions: jest.fn(),
  getLeagueTradedPicks: jest.fn()
}))

jest.mock('../../src/config/database', () => {
  const apiKeyStore = new Map()
  const userProfiles = new Map()

  return {
    __reset: () => {
      apiKeyStore.clear()
      userProfiles.clear()
    },
    __setUserProfile: (userId, profile) => {
      userProfiles.set(userId, profile)
    },
    createAPIKey: jest.fn(async (key, userId, description = null) => {
      apiKeyStore.set(key, {
        key,
        user_id: userId,
        description,
        created_at: '2024-01-01T00:00:00.000Z',
        last_used: null,
        active: 1
      })
      return { id: 1, changes: 1 }
    }),
    getAPIKey: jest.fn(async (key) => {
      const record = apiKeyStore.get(key)
      return record && record.active === 1 ? record : null
    }),
    updateAPIKeyLastUsed: jest.fn(async () => ({ id: 1 })),
    getAllAPIKeys: jest.fn(async () => Array.from(apiKeyStore.values())),
    revokeAPIKey: jest.fn(async (prefix) => {
      let changes = 0
      for (const [key, record] of apiKeyStore.entries()) {
        if (key.startsWith(prefix) && record.active === 1) {
          record.active = 0
          changes++
        }
      }
      return { changes }
    }),
    cleanupInactiveKeys: jest.fn(async () => ({ changes: 0 })),
    getUserProfile: jest.fn(async (userId) => userProfiles.get(userId) || null)
  }
})

const request = require('supertest')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const { generateAPIKey } = require('../../src/middleware/simpleAuth')
const database = require('../../src/config/database')
const cacheService = require('../../src/services/cacheService')
const playerSearchService = require('../../src/services/playerSearchService')
const sleeperService = require('../../src/services/sleeperService')
const { buildPlayer, buildLeague, buildNflState } = require('../fixtures/builders')

const { generalLimiter } = require('../../src/middleware/rateLimiter')
const { smartCache, cacheStats, clearCache } = require('../../src/middleware/requestCache')
const authRoutes = require('../../src/routes/auth')
const sleeperRoutes = require('../../src/routes/sleeper')
const playersRoutes = require('../../src/routes/players')
const indexRoutes = require('../../src/routes/index')

describe('Sleeper API middleware integration tests (deterministic)', () => {
  let app
  let apiKey

  beforeAll(() => {
    process.env.NODE_ENV = 'test'
    process.env.MASTER_KEY = 'test-master-key-12345'
    process.env.JWT_SECRET = 'test-jwt-secret-12345'

    app = express()
    app.set('trust proxy', 1)
    app.use(helmet())
    app.use(cors())
    app.use(compression())
    app.use(express.json({ limit: '10mb' }))
    app.use(express.urlencoded({ extended: true, limit: '10mb' }))
    app.use(generalLimiter)

    app.get('/cache/stats', cacheStats)
    app.post('/cache/clear', clearCache)

    app.use('/auth', authRoutes)
    app.use('/sleeper', smartCache, sleeperRoutes)
    app.use('/players', smartCache, playersRoutes)
    app.use('/', indexRoutes)
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    database.__reset()

    apiKey = generateAPIKey()
    await database.createAPIKey(apiKey, 'test-user-123', 'Test API Key')
    database.createAPIKey.mockClear()

    cacheService.getCacheStatus.mockResolvedValue({
      lastRefresh: '2024-01-01T00:00:00.000Z',
      lastRefreshFailure: null,
      isRefreshing: false,
      nextRefreshTime: '2024-01-02T06:00:00.000Z',
      minutesSinceLastSuccess: 10,
      isStale: false,
      failureMoreRecentThanSuccess: false,
      playersDataSize: 10,
      trendingAddDataSize: 2,
      trendingDropDataSize: 1
    })

    const player = buildPlayer()
    cacheService.getAllPlayers.mockResolvedValue({
      [player.player_id]: player
    })

    cacheService.getTrendingPlayers.mockResolvedValue([
      buildPlayer({ player_id: 'player-2' })
    ])

    playerSearchService.searchPlayersByName.mockResolvedValue([
      player
    ])
    playerSearchService.searchPlayersByPosition.mockResolvedValue([
      player
    ])
    playerSearchService.searchPlayersByTeam.mockResolvedValue([
      player
    ])
    playerSearchService.getActivePlayersOnly.mockResolvedValue([
      player
    ])
    playerSearchService.searchPlayerById.mockResolvedValue(player)
    playerSearchService.searchPlayersByIds.mockResolvedValue([
      buildPlayer({ player_id: 'player-1' }),
      { player_id: 'missing-1', error: 'Not Found' }
    ])

    sleeperService.getUser.mockResolvedValue({ user_id: 'user-1', username: 'testuser' })
    sleeperService.getUserLeagues.mockResolvedValue([buildLeague()])
    sleeperService.getLeague.mockResolvedValue(buildLeague())
    sleeperService.getLeagueRosters.mockResolvedValue([])
    sleeperService.getLeagueUsers.mockResolvedValue([])
    sleeperService.getLeagueMatchups.mockResolvedValue([])
    sleeperService.getLeagueTransactions.mockResolvedValue([])
    sleeperService.getLeagueTradedPicks.mockResolvedValue([])

    sleeperService.getNFLState.mockResolvedValue(buildNflState())
  })

  afterAll(() => {
    const { requestCache } = require('../../src/middleware/requestCache')
    if (requestCache && requestCache.destroy) {
      requestCache.destroy()
    }
  })

  test('GET /health reports cache status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body.status).toBe('healthy')
    expect(response.body.cache.status).toBe('healthy')
    expect(response.body.cache.lastRefresh).toBe('2024-01-01T00:00:00.000Z')
  })

  test('GET / returns API documentation', async () => {
    const response = await request(app)
      .get('/')
      .expect(200)

    expect(response.body.name).toBe('Sleeper API Gateway')
    expect(response.body.endpoints).toBeDefined()
  })

  test('GET /auth/validate accepts valid API key', async () => {
    const response = await request(app)
      .get('/auth/validate')
      .set('X-API-Key', apiKey)
      .expect(200)

    expect(response.body.valid).toBe(true)
    expect(response.body.userId).toBe('test-user-123')
  })

  test('POST /auth/create-key creates a key when master key is provided', async () => {
    const response = await request(app)
      .post('/auth/create-key')
      .set('X-Master-Key', process.env.MASTER_KEY)
      .send({
        userId: 'new-user-123',
        description: 'Test created key'
      })
      .expect(200)

    expect(response.body.success).toBe(true)
    expect(response.body.apiKey).toHaveLength(64)
    expect(database.createAPIKey).toHaveBeenCalledTimes(1)
  })

  test('GET /players/search/name returns search results', async () => {
    const response = await request(app)
      .get('/players/search/name?q=mahomes')
      .expect(200)

    expect(response.body.search_term).toBe('mahomes')
    expect(Array.isArray(response.body.players)).toBe(true)
    expect(response.body.players[0].player_id).toBe('player-1')
  })

  test('GET /players/cache/status requires authentication', async () => {
    const response = await request(app)
      .get('/players/cache/status')
      .set('X-API-Key', apiKey)
      .expect(200)

    expect(response.body.playersDataSize).toBe(10)
  })

  test('GET /sleeper/state/nfl proxies NFL state', async () => {
    const response = await request(app)
      .get('/sleeper/state/nfl')
      .expect(200)

    expect(response.body.week).toBe(1)
    expect(response.body.season).toBe('2024')
  })

  describe('Sleeper routes', () => {
    test('GET /sleeper/user/:identifier requires authentication', async () => {
      const response = await request(app)
        .get('/sleeper/user/testuser')
        .expect(401)

      expect(response.body.error).toBe('API key required')
    })

    test('GET /sleeper/user/:identifier returns user data', async () => {
      const response = await request(app)
        .get('/sleeper/user/testuser')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.user_id).toBe('user-1')
      expect(sleeperService.getUser).toHaveBeenCalledWith('testuser')
    })

    test('GET /sleeper/leagues/nfl/2024 returns 400 when no profile configured', async () => {
      const response = await request(app)
        .get('/sleeper/leagues/nfl/2024')
        .set('X-API-Key', apiKey)
        .expect(400)

      expect(response.body.error).toBe('No Sleeper user configured')
    })

    test('GET /sleeper/leagues/nfl/2024 returns leagues when profile is configured', async () => {
      database.__setUserProfile('test-user-123', {
        sleeper_user_id: '12345678',
        sleeper_username: 'testuser',
        display_name: 'Test User',
        preferences: {}
      })

      const response = await request(app)
        .get('/sleeper/leagues/nfl/2024')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body[0].league_id).toBe('league-123')
    })

    test('GET /sleeper/league/:leagueId/matchups/:week validates week', async () => {
      const response = await request(app)
        .get('/sleeper/league/league-123/matchups/0')
        .set('X-API-Key', apiKey)
        .expect(400)

      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('Player routes', () => {
    test('GET /players/search/id/:playerId returns player data', async () => {
      const response = await request(app)
        .get('/players/search/id/player-1')
        .expect(200)

      expect(response.body.player_id).toBe('player-1')
    })

    test('GET /players/search/id/:playerId returns 404 for missing player', async () => {
      playerSearchService.searchPlayerById.mockResolvedValueOnce(null)

      const response = await request(app)
        .get('/players/search/id/missing-1')
        .expect(404)

      expect(response.body.error).toBe('Player not found')
    })

    test('POST /players/search/id returns 400 when body is missing', async () => {
      const response = await request(app)
        .post('/players/search/id')
        .expect(400)

      expect(response.body.error).toBe('Bad request')
    })

    test('POST /players/search/id returns partial results', async () => {
      const response = await request(app)
        .post('/players/search/id')
        .send({ ids: ['player-1', 'missing-1'] })
        .expect(200)

      expect(response.body.total_requested).toBe(2)
      expect(response.body.found).toBe(1)
      expect(response.body.not_found).toBe(1)
    })

    test('POST /players/search/id returns 404 when none found', async () => {
      playerSearchService.searchPlayersByIds.mockResolvedValueOnce([
        { player_id: 'missing-1', error: 'Not Found' }
      ])

      const response = await request(app)
        .post('/players/search/id')
        .send({ ids: ['missing-1'] })
        .expect(404)

      expect(response.body.error).toBe('No players found')
    })

    test('GET /players/search/name validates empty query', async () => {
      const response = await request(app)
        .get('/players/search/name?q=')
        .expect(400)

      expect(response.body.error).toBe('Validation failed')
    })

    test('GET /players/nfl/trending/add returns cached results', async () => {
      const response = await request(app)
        .get('/players/nfl/trending/add')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body[0].player_id).toBe('player-2')
    })
  })

  describe('Cache admin endpoints', () => {
    test('POST /cache/clear returns success', async () => {
      const response = await request(app)
        .post('/cache/clear')
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    test('GET /cache/stats returns cache stats', async () => {
      const response = await request(app)
        .get('/cache/stats')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.cache.size).toBeDefined()
    })
  })
})
