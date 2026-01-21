const database = require('../../src/config/database')

// Mock axios before importing services
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    request: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  }))
}))

const axios = require('axios')
const sleeperService = require('../../src/services/sleeperService')
const cacheService = require('../../src/services/cacheService')
const playerSearchService = require('../../src/services/playerSearchService')

describe('Services Tests - Comprehensive Coverage', () => {
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test'
    process.env.SLEEPER_BASE_URL = 'https://api.sleeper.app/v1'
    process.env.DEFAULT_USER_ID = 'test-user-123'
    
    await database.connect()
  })

  afterAll(async () => {
    await database.close()
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SleeperService', () => {
    describe('Retry Logic and Error Handling', () => {
      test('should retry on retryable status codes', async () => {
        // Test the shouldRetry method directly
        expect(sleeperService.shouldRetry(500)).toBe(true)
        expect(sleeperService.shouldRetry(502)).toBe(true)
        expect(sleeperService.shouldRetry(503)).toBe(true)
        expect(sleeperService.shouldRetry(429)).toBe(true)
      })

      test('should not retry on non-retryable status codes', async () => {
        expect(sleeperService.shouldRetry(404)).toBe(false)
        expect(sleeperService.shouldRetry(400)).toBe(false)
        expect(sleeperService.shouldRetry(401)).toBe(false)
      })

      test('should calculate delay correctly', () => {
        // Test the calculateDelay method with tolerance for jitter (up to 25% variance)
        const delay0 = sleeperService.calculateDelay(0)
        const delay1 = sleeperService.calculateDelay(1)
        const delay2 = sleeperService.calculateDelay(2)
        
        expect(delay0).toBeGreaterThanOrEqual(1000)
        expect(delay0).toBeLessThanOrEqual(2000) // Increased tolerance for random jitter
        expect(delay1).toBeGreaterThanOrEqual(2000)
        expect(delay1).toBeLessThanOrEqual(3000) // Increased tolerance for random jitter
        expect(delay2).toBeGreaterThanOrEqual(4000)
        expect(delay2).toBeLessThanOrEqual(6000) // Increased tolerance for random jitter
      })

      test('should handle delay function', async () => {
        const start = Date.now()
        await sleeperService.delay(10) // 10ms delay
        const end = Date.now()
        expect(end - start).toBeGreaterThanOrEqual(5)
      })
    })

    describe('Service Properties', () => {
      test('should have correct base URL', () => {
        expect(sleeperService.baseURL).toBe('https://api.sleeper.app/v1')
      })

      test('should have correct retry settings', () => {
        expect(sleeperService.maxRetries).toBe(3)
        expect(sleeperService.baseDelay).toBe(1000)
      })

      test('should have axios client', () => {
        expect(sleeperService.client).toBeDefined()
      })
    })

    describe('Error Handler Coverage', () => {
      test('should handle 400 status code', () => {
        const error = { response: { status: 400, data: {} } }
        const result = sleeperService.handleError(error, 'Test message')
        expect(result.message).toBe('Invalid request - please check your parameters')
        expect(result.status).toBe(400)
      })

      test('should handle 404 status code', () => {
        const error = { response: { status: 404, data: {} } }
        const result = sleeperService.handleError(error, 'Test message')
        expect(result.message).toBe('The requested resource was not found')
        expect(result.status).toBe(404)
      })

      test('should handle 429 status code', () => {
        const error = { response: { status: 429, data: {} } }
        const result = sleeperService.handleError(error, 'Test message')
        expect(result.message).toBe('Rate limit exceeded - please wait before making more requests')
        expect(result.status).toBe(429)
      })

      test('should handle 500 status code', () => {
        const error = { response: { status: 500, data: {} } }
        const result = sleeperService.handleError(error, 'Test message')
        expect(result.message).toBe('Sleeper API is temporarily unavailable - please try again later')
        expect(result.status).toBe(500)
      })

      test('should handle unknown status codes', () => {
        const error = { response: { status: 418, data: {} } }
        const result = sleeperService.handleError(error, 'Test message')
        expect(result.message).toBe('Test message (Status: 418)')
        expect(result.status).toBe(418)
      })
    })
  })

  describe('CacheService', () => {
    describe('Cache Operations', () => {
      test('should check cache age and refresh if needed', async () => {
        // Mock old cache data
        const mockGet = jest.spyOn(database, 'get')
        mockGet.mockResolvedValueOnce({ 
          value: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
        })

        const refreshSpy = jest.spyOn(cacheService, 'refreshPlayerCache')
        refreshSpy.mockResolvedValue()

        await cacheService.checkAndRefreshIfNeeded()
        
        expect(refreshSpy).toHaveBeenCalled()
        
        mockGet.mockRestore()
        refreshSpy.mockRestore()
      })

      test('should not refresh if cache is fresh', async () => {
        const mockGet = jest.spyOn(database, 'get')
        mockGet.mockResolvedValueOnce({ 
          value: new Date().toISOString() // Current time
        })

        const refreshSpy = jest.spyOn(cacheService, 'refreshPlayerCache')
        refreshSpy.mockResolvedValue()

        await cacheService.checkAndRefreshIfNeeded()
        
        expect(refreshSpy).not.toHaveBeenCalled()
        
        mockGet.mockRestore()
        refreshSpy.mockRestore()
      })

      test('should handle cache refresh errors', async () => {
        const originalRefresh = cacheService.refreshPlayerCache
        cacheService.refreshPlayerCache = jest.fn().mockRejectedValue(new Error('Refresh failed'))
        
        // Should not throw
        await expect(cacheService.checkAndRefreshIfNeeded()).resolves.not.toThrow()
        
        cacheService.refreshPlayerCache = originalRefresh
      })

      test('should get cached players', async () => {
        const mockGet = jest.spyOn(database, 'get')
        mockGet.mockResolvedValue({ 
          data: JSON.stringify({ 'player1': { full_name: 'Test Player' } })
        })

        const result = await cacheService.getAllPlayers()
        expect(result).toHaveProperty('player1')
        
        mockGet.mockRestore()
      })

      test('should handle missing cached players', async () => {
        const mockGet = jest.spyOn(database, 'get')
        mockGet.mockResolvedValue(null)

        await expect(cacheService.getAllPlayers()).rejects.toThrow('Failed to retrieve cached players')
        
        mockGet.mockRestore()
      })

      test('should get trending players', async () => {
        const mockGet = jest.spyOn(database, 'get')
        mockGet.mockResolvedValue({ 
          data: JSON.stringify([{ player_id: 'player1', count: 50 }])
        })

        const result = await cacheService.getTrendingPlayers('add')
        expect(Array.isArray(result)).toBe(true)
        
        mockGet.mockRestore()
      })

      test('should get cache status', async () => {
        const mockGet = jest.spyOn(database, 'get')
        mockGet.mockResolvedValueOnce({ value: new Date().toISOString() })
        mockGet.mockResolvedValueOnce({ data: JSON.stringify({ test: 'data' }) })
        mockGet.mockResolvedValueOnce({ data: JSON.stringify([{ test: 'trending' }]) })

        const result = await cacheService.getCacheStatus()
        expect(result).toHaveProperty('lastRefresh')
        expect(result).toHaveProperty('playersDataSize')
        expect(result).toHaveProperty('trendingAddDataSize')
        
        mockGet.mockRestore()
      })
    })
  })

  describe('PlayerSearchService', () => {
    beforeEach(async () => {
      // Set up test data
      const testPlayers = {
        'player1': { full_name: 'Patrick Mahomes', position: 'QB', team: 'KC', fantasy_positions: ['QB'] },
        'player2': { full_name: 'Travis Kelce', position: 'TE', team: 'KC', fantasy_positions: ['TE'] },
        'player3': { full_name: 'Josh Allen', position: 'QB', team: 'BUF', fantasy_positions: ['QB'] }
      }

      const mockCacheService = jest.spyOn(cacheService, 'getAllPlayers')
      mockCacheService.mockResolvedValue(testPlayers)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('should search players by name', async () => {
      const result = await playerSearchService.searchPlayersByName('mahomes')
      expect(Array.isArray(result)).toBe(true)
    })

    test('should search players by partial name', async () => {
      const result = await playerSearchService.searchPlayersByName('pat')
      expect(Array.isArray(result)).toBe(true)
    })

    test('should handle empty search query', async () => {
      await expect(playerSearchService.searchPlayersByName('')).rejects.toThrow()
    })

    test('should search players by position', async () => {
      const result = await playerSearchService.searchPlayersByPosition('QB')
      expect(Array.isArray(result)).toBe(true)
    })

    test('should handle invalid position', async () => {
      await expect(playerSearchService.searchPlayersByPosition('INVALID')).rejects.toThrow()
    })

    test('should search players by team', async () => {
      const result = await playerSearchService.searchPlayersByTeam('KC')
      expect(Array.isArray(result)).toBe(true)
    })

    test('should handle invalid team', async () => {
      await expect(playerSearchService.searchPlayersByTeam('')).rejects.toThrow()
    })

    test('should get active players', async () => {
      const result = await playerSearchService.getActivePlayersOnly()
      expect(Array.isArray(result)).toBe(true)
    })

    test('should search player by ID', async () => {
      const result = await playerSearchService.searchPlayerById('1')
      // Will be null since player doesn't exist in test data
      expect(result).toBeNull()
    })

    test('should handle cache errors gracefully', async () => {
      const mockCacheService = jest.spyOn(cacheService, 'getAllPlayers')
      mockCacheService.mockRejectedValue(new Error('Cache error'))

      const result = await playerSearchService.searchPlayersByName('test')
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
      
      mockCacheService.mockRestore()
    })
  })
})
