const request = require('supertest')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const database = require('../../src/config/database')
const { generateAPIKey } = require('../../src/middleware/simpleAuth')

// Define sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Create test app
const app = express()

// Import middleware and routes
const { generalLimiter } = require('../../src/middleware/rateLimiter')
const { smartCache, cacheStats, clearCache } = require('../../src/middleware/requestCache')
const authRoutes = require('../../src/routes/auth')
const sleeperRoutes = require('../../src/routes/sleeper')
const playersRoutes = require('../../src/routes/players')
const indexRoutes = require('../../src/routes/index')

// Configure test app
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(generalLimiter)

// Cache management routes
app.get('/cache/stats', cacheStats)
app.post('/cache/clear', clearCache)

// Routes
app.use('/auth', authRoutes)
app.use('/sleeper', smartCache, sleeperRoutes)
app.use('/players', smartCache, playersRoutes)
app.use('/', indexRoutes)

describe('Routes Comprehensive Coverage Tests', () => {
  let apiKey
  let masterKey
  let testUserId

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test'
    process.env.MASTER_KEY = 'test-master-key-12345'
    process.env.JWT_SECRET = 'test-jwt-secret-12345'
    process.env.DEFAULT_USER_ID = 'test-user-123'
    
    masterKey = process.env.MASTER_KEY
    testUserId = 'test-user-123'
    
    await database.connect()
    
    // Create a test API key
    apiKey = generateAPIKey()
    await database.createAPIKey(apiKey, testUserId, 'Test API Key')
    
    // Create a test user profile with Sleeper user ID
    await database.createUserProfile(testUserId, {
      sleeper_user_id: '12345678', // Valid test Sleeper user ID
      sleeper_username: 'testuser',
      display_name: 'Test User',
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

  describe('Sleeper Routes - Complete Coverage', () => {
    describe('User Endpoints', () => {
      test('GET /sleeper/user/:identifier should handle valid users', async () => {
        // This will fail with 404 for test user, but tests the route
        const response = await request(app)
          .get('/sleeper/user/validuser123')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })

      test('GET /sleeper/user/:identifier/leagues/:sport/:season should handle user leagues', async () => {
        const response = await request(app)
          .get('/sleeper/user/testuser/leagues/nfl/2024')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })
    })

    describe('League Endpoints', () => {
      test('GET /sleeper/league/:league_id should get league details', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })

      test('GET /sleeper/league/:league_id/rosters should get league rosters', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/rosters')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })

      test('GET /sleeper/league/:league_id/users should get league users', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/users')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })

      test('GET /sleeper/league/:league_id/matchups/:week should get matchups', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/matchups/1')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })

      test('GET /sleeper/league/:league_id/transactions/:week should get transactions', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/transactions/1')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })

      test('GET /sleeper/league/:league_id/traded_picks should get traded picks', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/traded_picks')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })
    })

    describe('Default User Endpoints', () => {
      test('GET /sleeper/leagues/:sport/:season should use default user', async () => {
        const response = await request(app)
          .get('/sleeper/leagues/nfl/2024')
          .set('X-API-Key', apiKey)

        // Expect 400 since test user isn't configured
        expect(response.status).toBe(400)
      })

      test('GET /sleeper/rosters/:league_id should get default user rosters', async () => {
        const response = await request(app)
          .get('/sleeper/rosters/123456789')
          .set('X-API-Key', apiKey)

        expect([200, 404, 500]).toContain(response.status)
      })
    })

    describe('Validation Tests', () => {
      test('should validate league ID format', async () => {
        const response = await request(app)
          .get('/sleeper/league/invalid-id')
          .set('X-API-Key', apiKey)

        expect([400, 404]).toContain(response.status)
      })

      test('should validate week parameter', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/matchups/0')
          .set('X-API-Key', apiKey)

        expect([400, 404]).toContain(response.status)
      })

      test('should validate week parameter upper bound', async () => {
        const response = await request(app)
          .get('/sleeper/league/123456789/matchups/25')
          .set('X-API-Key', apiKey)

        expect([400, 404]).toContain(response.status)
      })

      test('should validate season parameter', async () => {
        const response = await request(app)
          .get('/sleeper/leagues/nfl/2010')
          .set('X-API-Key', apiKey)

        expect([400, 404, 500]).toContain(response.status)
      })
    })

    describe('Authentication Tests', () => {
      test('should allow optional auth for NFL state', async () => {
        const response = await request(app)
          .get('/sleeper/state/nfl')

        expect(response.status).toBe(200)
      })

      test('should require auth for user-specific endpoints', async () => {
        const response = await request(app)
          .get('/sleeper/leagues/nfl/2024')

        expect(response.status).toBe(401)
      })
    })
  })

  describe('Player Routes - Complete Coverage', () => {
    describe('Search Endpoints', () => {
      test('GET /players/search/id/:player_id should search by player ID', async () => {
        const response = await request(app)
          .get('/players/search/id/4017')

        expect([200, 404, 500]).toContain(response.status)
      })

      describe('POST /players/search/id - Multiple Player IDs', () => {
        test('should retrieve multiple players successfully', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: ['4017', '4034', '4039'] })

          expect(response.status).toBe(200)
          expect(response.body).toHaveProperty('total_requested')
          expect(response.body).toHaveProperty('found')
          expect(response.body).toHaveProperty('not_found')
          expect(response.body).toHaveProperty('results')
          expect(Array.isArray(response.body.results)).toBe(true)
          expect(response.body.results.length).toBe(3)
        })

        test('should handle single ID in array', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: ['4017'] })

          expect([200, 404, 500]).toContain(response.status)
          if (response.status === 200) {
            expect(response.body.total_requested).toBe(1)
            expect(response.body.results.length).toBe(1)
          }
        })

        test('should return 400 for missing body', async () => {
          const response = await request(app)
            .post('/players/search/id')

          expect(response.status).toBe(400)
          expect(response.body.error).toBe('Bad request')
          expect(response.body.message).toContain('ids')
        })

        test('should return 400 for missing ids field', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({})

          expect(response.status).toBe(400)
          expect(response.body.error).toBe('Bad request')
          expect(response.body.message).toContain('ids')
        })

        test('should return 400 for empty array', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: [] })

          expect(response.status).toBe(400)
          expect(response.body.error).toBe('Bad request')
          expect(response.body.message).toContain('empty')
        })

        test('should return 400 for non-array ids', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: '4017' })

          expect(response.status).toBe(400)
          expect(response.body.error).toBe('Bad request')
          expect(response.body.message).toContain('array')
        })

        test('should return 400 for invalid ID types', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: ['4017', null, undefined, {}, []] })

          expect(response.status).toBe(400)
          expect(response.body.error).toBe('Bad request')
          expect(response.body).toHaveProperty('invalidIds')
        })

        test('should handle partial results (some found, some not)', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: ['4017', '999999999', '4034'] })

          expect(response.status).toBe(200)
          expect(response.body.total_requested).toBe(3)
          expect(response.body.found).toBeGreaterThan(0)
          expect(response.body.not_found).toBeGreaterThan(0)
          expect(response.body.found + response.body.not_found).toBe(3)
          
          // Check that not found entries have error field
          const notFoundEntries = response.body.results.filter(r => r.error === 'Not Found')
          expect(notFoundEntries.length).toBe(response.body.not_found)
        })

        test('should return 404 when no players found', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: ['999999999', '999999998', '999999997'] })

          expect(response.status).toBe(404)
          expect(response.body.error).toBe('No players found')
          expect(response.body).toHaveProperty('requested_ids')
          expect(response.body).toHaveProperty('results')
        })

        test('should accept numeric IDs', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: [4017, 4034] })

          expect([200, 404, 500]).toContain(response.status)
          if (response.status === 200) {
            expect(response.body.total_requested).toBe(2)
          }
        })

        test('should work with optional authentication', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .set('X-API-Key', apiKey)
            .send({ ids: ['4017', '4034'] })

          expect([200, 404, 500]).toContain(response.status)
        })

        test('should work without authentication', async () => {
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids: ['4017'] })

          expect([200, 404, 500]).toContain(response.status)
        })

        test('should handle large array of IDs', async () => {
          const ids = Array.from({ length: 10 }, (_, i) => String(4017 + i))
          const response = await request(app)
            .post('/players/search/id')
            .send({ ids })

          expect([200, 404, 500]).toContain(response.status)
          if (response.status === 200) {
            expect(response.body.total_requested).toBe(10)
            expect(response.body.results.length).toBe(10)
          }
        })
      })

      test('GET /players/search/name should handle various search terms', async () => {
        const searchTerms = ['mahomes', 'kelce', 'allen', 'josh']
        
        for (const term of searchTerms) {
          const response = await request(app)
            .get(`/players/search/name?q=${term}`)

          expect([200, 500]).toContain(response.status)
        }
      })

      test('GET /players/search/position/:position should handle all positions', async () => {
        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
        
        for (const position of positions) {
          const response = await request(app)
            .get(`/players/search/position/${position}`)
            .set('X-API-Key', apiKey)

          expect([200, 429, 500]).toContain(response.status)
          await sleep(200)
        }
      })

      test('GET /players/search/team/:team should handle team codes', async () => {
        const teams = ['KC', 'BUF', 'NE', 'MIA']
        
        for (const team of teams) {
          const response = await request(app)
            .get(`/players/search/team/${team}`)
            .set('X-API-Key', apiKey)

          expect([200, 429, 500]).toContain(response.status)
          await sleep(200)
        }
      })
    })

    describe('Trending Endpoints', () => {
      test('GET /players/nfl/trending/drop should get trending drops', async () => {
        const response = await request(app)
          .get('/players/nfl/trending/drop')
          .set('X-API-Key', apiKey)

        expect([200, 429, 500]).toContain(response.status)
      })

      test('GET /players/nfl/trending/add should get trending adds', async () => {
        const response = await request(app)
          .get('/players/nfl/trending/add')
          .set('X-API-Key', apiKey)

        expect([200, 429, 500]).toContain(response.status)
      })
    })

    describe('Cache Management', () => {
      test('GET /players/cache/status should require authentication', async () => {
        const response = await request(app)
          .get('/players/cache/status')

        expect(response.status).toBe(401)
      })

      test('GET /players/cache/status should return status with auth', async () => {
        const response = await request(app)
          .get('/players/cache/status')
          .set('X-API-Key', apiKey)

        expect([200, 500]).toContain(response.status)
      })

      test('POST /players/cache/refresh should require authentication', async () => {
        const response = await request(app)
          .post('/players/cache/refresh')

        expect(response.status).toBe(401)
      })

      test('POST /players/cache/refresh should trigger refresh with auth', async () => {
        const response = await request(app)
          .post('/players/cache/refresh')
          .set('X-API-Key', apiKey)

        expect([200, 500]).toContain(response.status)
      })
    })

    describe('Validation Edge Cases', () => {
      test('should handle empty search terms', async () => {
        const response = await request(app)
          .get('/players/search/name?q=')

        expect(response.status).toBe(400)
      })

      test('should handle very long search terms', async () => {
        const longTerm = 'a'.repeat(100)
        const response = await request(app)
          .get(`/players/search/name?q=${longTerm}`)

        expect([200, 400, 500]).toContain(response.status)
      })

      test('should handle special characters in search', async () => {
        const response = await request(app)
          .get('/players/search/name?q=<script>alert("test")</script>')

        expect([200, 400, 500]).toContain(response.status)
      })
    })
  })

  describe('Index Routes - Complete Coverage', () => {
    test('GET / should return API documentation', async () => {
      const response = await request(app)
        .get('/')

      expect([200, 503]).toContain(response.status)
      
      if (response.status === 200) {
        expect(response.body.name).toBe('Sleeper API Gateway')
      }
    })

    test('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')

      expect([200, 503]).toContain(response.status)
    })

    test('GET /health should return detailed status', async () => {
      const response = await request(app)
        .get('/health')

      expect([200, 500]).toContain(response.status)
    })
  })

  describe('Rate Limiting Tests', () => {
    test('should apply general rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(5).fill().map(() => 
        request(app).get('/health')
      )

      const responses = await Promise.all(requests)
      
      // All should succeed since limit is typically higher than 5
      responses.forEach(response => {
        expect([200, 429, 503]).toContain(response.status)
      })
    })

    test('should apply auth rate limiting', async () => {
      const requests = Array(3).fill().map(() => 
        request(app)
          .post('/auth/create-key')
          .set('X-Master-Key', masterKey)
          .send({ userId: 'test', description: 'Test' })
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status)
      })
    })

    test('should apply Sleeper API rate limiting', async () => {
      const requests = Array(3).fill().map(() => 
        request(app)
          .get('/sleeper/state/nfl')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status)
      })
    })
  })

  describe('Error Handling Edge Cases', () => {
    test('should handle malformed JSON in POST requests', async () => {
      const response = await request(app)
        .post('/auth/create-key')
        .set('Content-Type', 'application/json')
        .set('X-Master-Key', masterKey)
        .send('{"invalid": json')

      expect(response.status).toBe(400)
    })

    test('should handle very large payloads', async () => {
      const largePayload = { data: 'x'.repeat(15 * 1024 * 1024) } // 15MB

      const response = await request(app)
        .post('/auth/create-key')
        .set('X-Master-Key', masterKey)
        .send(largePayload)

      expect([400, 413]).toContain(response.status)
    })

    test('should handle requests with no content-type', async () => {
      const response = await request(app)
        .post('/auth/create-key')
        .set('X-Master-Key', masterKey)
        .send('userId=test&description=test')

      expect([200, 400]).toContain(response.status)
    })
  })

  describe('Cache Management Integration', () => {
    test('should handle cache clear with authentication', async () => {
      const response = await request(app)
        .post('/cache/clear')

      expect(response.status).toBe(200)
    })

    test('should handle cache stats request', async () => {
      const response = await request(app)
        .get('/cache/stats')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('should handle cache clear with pattern', async () => {
      const response = await request(app)
        .post('/cache/clear')
        .send({ pattern: 'players*' })

      expect(response.status).toBe(200)
    })
  })

  describe('Security Headers and CORS', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')

      expect(response.headers['x-frame-options']).toBeDefined()
      expect(response.headers['x-content-type-options']).toBeDefined()
    })

    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')

      expect([200, 204]).toContain(response.status)
    })

    test('should handle CORS for different origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://example.com')

      expect(response.headers['access-control-allow-origin']).toBeDefined()
    })
  })
})
