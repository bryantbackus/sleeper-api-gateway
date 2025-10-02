const request = require('supertest')
const express = require('express')

// Mock the cacheService BEFORE importing any modules that use it
const mockGetCacheStatus = jest.fn()
jest.mock('../../src/services/cacheService', () => ({
  getCacheStatus: mockGetCacheStatus
}))

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}))

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

jest.mock('../../src/middleware/requestCache', () => ({
  smartCache: (req, res, next) => next(),
  cacheStats: (req, res, next) => next(),
  clearCache: (req, res, next) => next()
}))

describe('Smoke tests for core endpoints', () => {
  let app

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
    // Set up the mock
    mockGetCacheStatus.mockResolvedValue({
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
    console.log('Mock called:', mockGetCacheStatus.mock.calls.length)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'healthy',
      cache: {
        status: 'healthy',
        lastRefresh: '2024-01-01T00:00:00.000Z',
        isRefreshing: false
      }
    })
    expect(mockGetCacheStatus).toHaveBeenCalledTimes(1)
  })

  test('GET /sleeper/state/nfl proxies state from Sleeper service', async () => {
    const mockState = {
      season: '2024',
      week: 1,
      season_type: 'regular'
    }

    const sleeperService = require('../../src/services/sleeperService')
    sleeperService.getNFLState.mockResolvedValue({ data: mockState })

    const response = await request(app).get('/sleeper/state/nfl')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: mockState })
    expect(sleeperService.getNFLState).toHaveBeenCalledTimes(1)
  })
})
