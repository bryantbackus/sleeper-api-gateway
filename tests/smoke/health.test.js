const request = require('supertest')
const express = require('express')

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}))

jest.mock('../../src/services/cacheService', () => {
  const mockGetCacheStatus = jest.fn()
  return {
    getCacheStatus: mockGetCacheStatus
  }
})

jest.mock('../../src/services/sleeperService', () => ({
  getNFLState: jest.fn()
}))

jest.mock('../../src/middleware/simpleAuth', () => ({
  requireAPIKey: (req, res, next) => {
    req.user = req.user || { id: 'test-user' }
    next()
  },
  optionalAPIKey: (req, res, next) => next()
}))

jest.mock('../../src/middleware/authAwareRateLimit', () => ({
  authAwareRateLimiters: {
    playerEndpoints: (req, res, next) => next(),
    generalEndpoints: (req, res, next) => next(),
    searchEndpoints: (req, res, next) => next(),
    nflStateEndpoint: (req, res, next) => next()
  }
}))

jest.mock('../../src/middleware/userProfile', () => ({
  loadUserProfile: (req, res, next) => {
    req.userProfile = req.userProfile || {}
    next()
  },
  getEffectiveSleeperUserId: () => null
}))

describe('Smoke tests for core endpoints', () => {
  let app
  const cacheService = require('../../src/services/cacheService')
  const sleeperService = require('../../src/services/sleeperService')

  beforeEach(() => {
    jest.clearAllMocks()

    const indexRoutes = require('../../src/routes/index')
    const sleeperRoutes = require('../../src/routes/sleeper')

    app = express()
    app.use(express.json())
    app.use('/sleeper', sleeperRoutes)
    app.use('/', indexRoutes)
  })

  test('GET /health returns health status with cache information', async () => {
    // Clear any previous calls
    cacheService.getCacheStatus.mockClear()
    
    // Set up the mock
    cacheService.getCacheStatus.mockResolvedValue({
      lastRefresh: '2024-01-01T00:00:00.000Z',
      isRefreshing: false,
      playersDataSize: 100,
      trendingAddDataSize: 10,
      trendingDropDataSize: 5,
      nextRefreshTime: '2024-01-02T06:00:00.000Z',
      minutesSinceLastSuccess: 0,
      isStale: false,
      failureMoreRecentThanSuccess: false
    })

    const response = await request(app).get('/health')

    // Debug: log the actual response
    console.log('Response body:', JSON.stringify(response.body, null, 2))
    console.log('Mock called:', cacheService.getCacheStatus.mock.calls.length)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'healthy',
      cache: {
        status: 'healthy',
        lastRefresh: '2024-01-01T00:00:00.000Z',
        isRefreshing: false
      }
    })
    expect(cacheService.getCacheStatus).toHaveBeenCalledTimes(1)
  })

  test('GET /sleeper/state/nfl proxies state from Sleeper service', async () => {
    const statePayload = { week: 7, season: '2024', leagueSeason: '2024' }
    sleeperService.getNFLState.mockResolvedValue(statePayload)

    const response = await request(app).get('/sleeper/state/nfl')

    expect(response.status).toBe(200)
    expect(response.body).toEqual(statePayload)
    expect(sleeperService.getNFLState).toHaveBeenCalledTimes(1)
  })
})
