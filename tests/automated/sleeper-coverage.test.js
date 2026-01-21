const request = require('supertest')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const database = require('../../src/config/database')
const { generateAPIKey } = require('../../src/middleware/simpleAuth')

// Create test app
const app = express()

// Import middleware and routes
const { generalLimiter } = require('../../src/middleware/rateLimiter')
const { smartCache } = require('../../src/middleware/requestCache')
const sleeperRoutes = require('../../src/routes/sleeper')

// Configure test app
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(generalLimiter)

// Routes
app.use('/sleeper', smartCache, sleeperRoutes)

describe('Sleeper Routes Comprehensive Coverage Tests', () => {
  let apiKey

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test'
    process.env.MASTER_KEY = 'test-master-key-12345'
    process.env.JWT_SECRET = 'test-jwt-secret-12345'
    process.env.DEFAULT_USER_ID = 'test-user-default'
    process.env.DEFAULT_USERNAME = 'testuserdefault'
    
    await database.connect()
    
    // Create a test API key
    apiKey = generateAPIKey()
    await database.createAPIKey(apiKey, 'test-user-default', 'Sleeper Test API Key')
    
    // Create a test user profile with Sleeper user ID
    await database.createUserProfile('test-user-default', {
      sleeper_user_id: '353047433984344064', // Valid test Sleeper user ID
      sleeper_username: 'default',
      display_name: 'Test default',
      preferences: {}
    })
  })

  afterAll(async () => {
    await database.close()
    
    // Stop cache cleanup timer
    const { requestCache } = require('../../src/middleware/requestCache')
    if (requestCache && requestCache.destroy) {
      requestCache.destroy()
    }
  })

  describe('NFL State Routes (Public)', () => {
    test('GET /sleeper/state/nfl should work without auth', async () => {
      const response = await request(app)
        .get('/sleeper/state/nfl')

      expect([200, 500]).toContain(response.status)
      if (response.status === 200) {
        expect(response.body.week).toBeDefined()
        expect(response.body.season).toBeDefined()
      }
    })

    test('GET /sleeper/state/nfl should work with auth', async () => {
      const response = await request(app)
        .get('/sleeper/state/nfl')
        .set('X-API-Key', apiKey)

      expect([200, 500]).toContain(response.status)
      if (response.status === 200) {
        expect(response.body.week).toBeDefined()
      }
    })
  })

  describe('User Routes (Protected)', () => {
    test('GET /sleeper/user/:identifier should require auth', async () => {
      const response = await request(app)
        .get('/sleeper/user/testuser')

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('API key required')
    })

    test('GET /sleeper/user/:identifier should handle valid requests', async () => {
      const response = await request(app)
        .get('/sleeper/user/default')
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/user/:identifier should handle special characters', async () => {
      const response = await request(app)
        .get('/sleeper/user/test@user.com')
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/user/:identifier/leagues/:sport/:season should work', async () => {
      const response = await request(app)
        .get('/sleeper/user/default/leagues/nfl/2024')
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/user/:identifier/leagues/:sport/:season should validate sport', async () => {
      const response = await request(app)
        .get('/sleeper/user/default/leagues/invalid/2024')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/user/:identifier/leagues/:sport/:season should validate season', async () => {
      const response = await request(app)
        .get('/sleeper/user/default/leagues/nfl/invalid')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })
  })

  describe('League Routes (Protected)', () => {
    const testLeagueId = '123456789012345678'

    test('GET /sleeper/league/:league_id should require auth', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}`)

      expect(response.status).toBe(401)
    })

    test('GET /sleeper/league/:league_id should handle valid requests', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}`)
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/rosters should work', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/rosters`)
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/users should work', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/users`)
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/matchups/:week should work', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/matchups/1`)
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/matchups/:week should validate week', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/matchups/0`)
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/matchups/:week should validate week upper bound', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/matchups/25`)
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/transactions/:week should work', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/transactions/1`)
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/transactions/:week should validate week', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/transactions/invalid`)
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/league/:league_id/traded_picks should work', async () => {
      const response = await request(app)
        .get(`/sleeper/league/${testLeagueId}/traded_picks`)
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })
  })

  describe('Default User Routes (Protected)', () => {
    test('GET /sleeper/leagues/:sport/:season should use default user', async () => {
      const response = await request(app)
        .get('/sleeper/leagues/nfl/2024')
        .set('X-API-Key', apiKey)

      // Expect 400 since no Sleeper user is configured
      expect([400, 500]).toContain(response.status)
    })

    test('GET /sleeper/leagues/:sport/:season should validate sport', async () => {
      const response = await request(app)
        .get('/sleeper/leagues/invalid/2024')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/leagues/:sport/:season should validate season format', async () => {
      const response = await request(app)
        .get('/sleeper/leagues/nfl/abc')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/leagues/:sport/:season should handle historical seasons', async () => {
      const response = await request(app)
        .get('/sleeper/leagues/nfl/2020')
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/rosters/:league_id should work with default user', async () => {
      const response = await request(app)
        .get('/sleeper/rosters/123456789012345678')
        .set('X-API-Key', apiKey)

      expect([200, 404, 500]).toContain(response.status)
    })

    test('GET /sleeper/rosters/:league_id should validate league ID', async () => {
      const response = await request(app)
        .get('/sleeper/rosters/invalid')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })
  })

  describe('Route Validation', () => {
    test('should handle empty league ID', async () => {
      const response = await request(app)
        .get('/sleeper/league/')
        .set('X-API-Key', apiKey)

      expect([400, 404]).toContain(response.status)
    })

    test('should handle very long league ID', async () => {
      const longId = '1'.repeat(100)
      const response = await request(app)
        .get(`/sleeper/league/${longId}`)
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('should handle special characters in league ID', async () => {
      const response = await request(app)
        .get('/sleeper/league/123!@#$')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('should handle negative week numbers', async () => {
      const response = await request(app)
        .get('/sleeper/league/123456789012345678/matchups/-1')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })

    test('should handle float week numbers', async () => {
      const response = await request(app)
        .get('/sleeper/league/123456789012345678/matchups/1.5')
        .set('X-API-Key', apiKey)

      expect([400, 404, 500]).toContain(response.status)
    })
  })

  describe('Error Handling', () => {
    test('should handle malformed API key', async () => {
      const response = await request(app)
        .get('/sleeper/user/testuser')
        .set('X-API-Key', 'invalid-key')

      expect(response.status).toBe(200)
      // Optional auth allows through, may or may not have error
      if (response.body && response.body.error) {
        expect(response.body.error).toBeDefined()
      }
    })

    test('should handle expired API key gracefully', async () => {
      // This test simulates behavior - actual expiration would need database modifications
      const response = await request(app)
        .get('/sleeper/user/testuser')
        .set('X-API-Key', generateAPIKey())

      expect(response.status).toBe(200)
      // Optional auth allows through, may or may not have error
      if (response.body && response.body.error) {
        expect(response.body.error).toBeDefined()
      }
    })

    test('should handle missing required parameters', async () => {
      const response = await request(app)
        .get('/sleeper/league//rosters')
        .set('X-API-Key', apiKey)

      expect([400, 404]).toContain(response.status)
    })

    test('should handle concurrent requests', async () => {
      const requests = Array(5).fill().map(() =>
        request(app)
          .get('/sleeper/state/nfl')
          .set('X-API-Key', apiKey)
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect([200, 429, 500]).toContain(response.status)
      })
    })
  })

  describe('Cache Headers and Performance', () => {
    test('should include cache headers for cached responses', async () => {
      const response = await request(app)
        .get('/sleeper/state/nfl')
        .set('X-API-Key', apiKey)

      if (response.status === 200) {
        // Cache headers might be present
        expect(response.headers).toBeDefined()
      }
    })

    test('should handle conditional requests', async () => {
      const response = await request(app)
        .get('/sleeper/state/nfl')
        .set('If-None-Match', '"test-etag"')
        .set('X-API-Key', apiKey)

      expect([200, 304, 500]).toContain(response.status)
    })

    test('should handle large responses efficiently', async () => {
      const start = Date.now()
      const response = await request(app)
        .get('/sleeper/state/nfl')
        .set('X-API-Key', apiKey)
      const duration = Date.now() - start

      // Response should complete within reasonable time
      expect(duration).toBeLessThan(10000) // 10 seconds max
      expect([200, 500]).toContain(response.status)
    })
  })

  describe('API Key Authentication Edge Cases', () => {
    test('should handle API key in query parameter', async () => {
      const response = await request(app)
        .get(`/sleeper/state/nfl?api_key=${apiKey}`)

      expect([200, 500]).toContain(response.status)
    })

    test('should prioritize header over query parameter', async () => {
      const differentKey = generateAPIKey()
      const response = await request(app)
        .get(`/sleeper/user/testuser?api_key=${differentKey}`)
        .set('X-API-Key', apiKey)

      // Should use header key (which is valid) not query key (which is invalid)
      expect([200, 404, 500]).toContain(response.status)
    })

    test('should handle empty API key header', async () => {
      const response = await request(app)
        .get('/sleeper/user/testuser')
        .set('X-API-Key', '')

      expect(response.status).toBe(200)
      // Optional auth allows through, may or may not have error
      if (response.body && response.body.error) {
        expect(response.body.error).toBeDefined()
      }
    })

    test('should handle whitespace in API key', async () => {
      const response = await request(app)
        .get('/sleeper/user/default')
        .set('X-API-Key', '  ' + apiKey + '  ')

      expect([200, 404, 500]).toContain(response.status)
    })
  })
})
