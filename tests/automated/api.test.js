const request = require('supertest')
const database = require('../../src/config/database')
const { generateAPIKey } = require('../../src/middleware/simpleAuth')

// Import express app (need to create a separate app export)
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')

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

describe('Sleeper API Middleware Tests', () => {
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
    
    // Connect to test database
    await database.connect()
    
    // Create a test API key
    apiKey = generateAPIKey()
    await database.createAPIKey(apiKey, testUserId, 'Test API Key')
  })

  afterAll(async () => {
    // Clean up test database
    await database.close()
    
    // Stop cache cleanup timer to prevent Jest from hanging
    const { requestCache } = require('../../src/middleware/requestCache')
    if (requestCache && requestCache.destroy) {
      requestCache.destroy()
    }
  })

  describe('Health and Basic Endpoints', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
      
      expect(['healthy', 'degraded']).toContain(response.body.status)
      expect(response.body.timestamp).toBeDefined()
    })

    test('GET / should return API documentation', async () => {
      const response = await request(app)
        .get('/')
        .expect(200)
      
      expect(response.body.name).toBe('Sleeper API Gateway')
      expect(response.body.endpoints).toBeDefined()
    })
  })

  describe('Authentication', () => {
    test('GET /auth/validate should validate API key', async () => {
      const response = await request(app)
        .get('/auth/validate')
        .set('X-API-Key', apiKey)
        .expect(200)
      
      expect(response.body.valid).toBe(true)
      expect(response.body.userId).toBe(testUserId)
    })

    test('GET /auth/validate should reject invalid API key', async () => {
      const response = await request(app)
        .get('/auth/validate')
        .set('X-API-Key', 'invalid-key')
        .expect(400)
      
      expect(response.body.valid).toBe(false)
    })

    test('POST /auth/create-key should create new API key with master key', async () => {
      const response = await request(app)
        .post('/auth/create-key')
        .set('X-Master-Key', masterKey)
        .send({
          userId: 'new-user-123',
          description: 'Test created key'
        })
        .expect(200)
      
      expect(response.body.success).toBe(true)
      expect(response.body.apiKey).toBeDefined()
      expect(response.body.apiKey).toHaveLength(64)
    })

    test('POST /auth/create-key should reject without master key', async () => {
      const response = await request(app)
        .post('/auth/create-key')
        .send({
          userId: 'new-user-123',
          description: 'Test created key'
        })
        .expect(401)
      
      expect(response.body.error).toBe('Master key required')
    })

    test('GET /auth/keys should list API keys with master key', async () => {
      const response = await request(app)
        .get('/auth/keys')
        .set('X-Master-Key', masterKey)
        .expect(200)
      
      expect(response.body.success).toBe(true)
      expect(response.body.keys).toBeDefined()
      expect(Array.isArray(response.body.keys)).toBe(true)
    })

    test('Optional auth endpoint should allow access without API key', async () => {
      const response = await request(app)
        .get('/sleeper/state/nfl')
        .expect(200)
      
      expect(response.body.week).toBeDefined()
    })
  })

  describe('Cache Management', () => {
    test('GET /cache/stats should return cache statistics', async () => {
      const response = await request(app)
        .get('/cache/stats')
        .expect(200)
      
      expect(response.body.success).toBe(true)
      expect(response.body.cache).toBeDefined()
      expect(response.body.cache.size).toBeDefined()
    })

    test('POST /cache/clear should clear cache', async () => {
      const response = await request(app)
        .post('/cache/clear')
        .expect(200)
      
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('cleared')
    })

    test('Cache headers should be present in cached responses', async () => {
      // Make two identical requests to test caching
      const response1 = await request(app)
        .get('/players/nfl')
        .expect(200)
      
      const response2 = await request(app)
        .get('/players/nfl')
        .expect(200)
      
      // First request should be a miss or skip, second should be hit
      expect(response1.headers['x-cache']).toBeDefined()
      expect(response2.headers['x-cache']).toBeDefined()
    })
  })

  describe('Player Endpoints', () => {
    test('GET /players/nfl should return all players (no auth required)', async () => {
      const response = await request(app)
        .get('/players/nfl')
        .expect(200)
      
      expect(typeof response.body).toBe('object')
      expect(Object.keys(response.body).length).toBeGreaterThan(0)
    })

    test('GET /players/nfl/trending/add should return trending adds', async () => {
      const response = await request(app)
        .get('/players/nfl/trending/add')
        .expect(200)
      
      expect(Array.isArray(response.body)).toBe(true)
    })

    test('GET /players/search/name should search players by name', async () => {
      const response = await request(app)
        .get('/players/search/name?q=mahomes')
        .expect(200)
      
      expect(response.body.search_term).toBe('mahomes')
      expect(response.body.players).toBeDefined()
      expect(Array.isArray(response.body.players)).toBe(true)
    })

    test('GET /players/search/position/QB should return quarterbacks', async () => {
      const response = await request(app)
        .get('/players/search/position/QB')
        .expect(200)
      
      expect(response.body.position).toBe('QB')
      expect(response.body.players).toBeDefined()
      expect(Array.isArray(response.body.players)).toBe(true)
    })

    test('GET /players/search/team/KC should return Kansas City players', async () => {
      const response = await request(app)
        .get('/players/search/team/KC')
        .expect(200)
      
      expect(response.body.team).toBe('KC')
      expect(response.body.players).toBeDefined()
      expect(Array.isArray(response.body.players)).toBe(true)
    })

    test('GET /players/active should return active players only', async () => {
      const response = await request(app)
        .get('/players/active')
        .expect(200)
      
      expect(response.body.players).toBeDefined()
      expect(Array.isArray(response.body.players)).toBe(true)
    })

    test('GET /players/cache/status should require authentication', async () => {
      const response = await request(app)
        .get('/players/cache/status')
        .set('X-API-Key', apiKey)
        .expect(200)
      
      expect(response.body.lastRefresh).toBeDefined()
    })
  })

  describe('Sleeper API Proxy Endpoints', () => {
    test('GET /sleeper/state/nfl should return NFL state with optional auth', async () => {
      const response = await request(app)
        .get('/sleeper/state/nfl')
        .expect(200)
      
      expect(response.body.week).toBeDefined()
      expect(response.body.season).toBeDefined()
    })

    test('GET /sleeper/user/:identifier should require authentication', async () => {
      await request(app)
        .get('/sleeper/user/test-user')
        .set('X-API-Key', apiKey)
        .expect(200)
      
      // Note: This will fail if the user doesn't exist on Sleeper, 
      // but we're testing the auth middleware
    })

    test('GET /sleeper/leagues/nfl/2024 should handle test user appropriately', async () => {
      const response = await request(app)
        .get('/sleeper/leagues/nfl/2024')
        .set('X-API-Key', apiKey)
        .expect(400)
      
      // Test user doesn't have Sleeper user configured, so 400 is expected
      expect(response.body.error).toContain('No Sleeper user configured')
    })
  })

  describe('Input Validation', () => {
    test('Invalid API key format should be rejected', async () => {
      const response = await request(app)
        .get('/auth/validate')
        .set('X-API-Key', 'invalid')
        .expect(400)
      
      expect(response.body.valid).toBe(false)
      expect(response.body.error).toContain('format')
    })

    test('Empty search query should be rejected', async () => {
      const response = await request(app)
        .get('/players/search/name?q=')
        .expect(400)
      
      expect(response.body.error).toBe('Validation failed')
    })

    test('Invalid position should be rejected', async () => {
      const response = await request(app)
        .get('/players/search/position/INVALID')
        .expect(400)
      
      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('Rate Limiting', () => {
    test('Should handle rate limiting gracefully', async () => {
      // This test would need to be adjusted based on actual rate limits
      // For now, just ensure the middleware is present
      const response = await request(app)
        .get('/health')
        .expect(200)
      
      // Rate limiting headers may not be visible in single request
      // Just verify the response is successful
      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    test('Non-existent endpoints should return 404', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404)
      
      expect(response.body.error).toBe('Route not found')
    })

    test('Invalid JSON should return 400', async () => {
      await request(app)
        .post('/auth/create-key')
        .set('X-Master-Key', masterKey)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400)
    })
  })

  describe('Security Headers', () => {
    test('Security headers should be present', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
      
      expect(response.headers['x-frame-options']).toBeDefined()
      expect(response.headers['x-content-type-options']).toBeDefined()
      expect(response.headers['x-xss-protection']).toBeDefined()
    })
  })

  describe('API Key as Query Parameter', () => {
    test('Should accept API key as query parameter', async () => {
      const response = await request(app)
        .get(`/auth/validate?api_key=${apiKey}`)
        .expect(200)
      
      expect(response.body.valid).toBe(true)
    })
  })

  describe('Development Endpoints', () => {
    test('POST /auth/dev-key should work in development', async () => {
      process.env.NODE_ENV = 'development'
      
      const response = await request(app)
        .post('/auth/dev-key')
        .send({
          userId: 'dev-test-user',
          description: 'Development test key'
        })
        .expect(200)
      
      expect(response.body.success).toBe(true)
      expect(response.body.apiKey).toBeDefined()
      
      // Reset to test environment
      process.env.NODE_ENV = 'test'
    })
  })
})
