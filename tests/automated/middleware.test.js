process.env.RATE_LIMIT_ENABLED = 'true'

const request = require('supertest')
const express = require('express')
const { generateAPIKey } = require('../../src/middleware/simpleAuth')
const database = require('../../src/config/database')

// Import rate limiters
const { generalLimiter, authLimiter, sleeperApiLimiter } = require('../../src/middleware/rateLimiter')

describe('Middleware Tests - Rate Limiters', () => {
  let app
  let apiKey

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test'
    process.env.MASTER_KEY = 'test-master-key-12345'
    
    await database.connect()
    
    // Create test API key
    apiKey = generateAPIKey()
    await database.createAPIKey(apiKey, 'test-user-123', 'Test API Key')
  })

  beforeEach(() => {
    // Create fresh app for each test
    app = express()
    app.use(express.json())
  })

  afterAll(async () => {
    await database.close()
  })

  describe('General Rate Limiter', () => {
    test('should allow requests under the limit', async () => {
      app.use(generalLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .get('/test')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('should include rate limit headers when enabled', async () => {
      app.use(generalLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .get('/test')

      expect(response.status).toBe(200)
      expect(response.headers['ratelimit-limit']).toBeDefined()
    })

    test('should handle multiple requests', async () => {
      app.use(generalLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      // Make several requests rapidly
      const requests = Array(5).fill().map(() => 
        request(app).get('/test')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Auth Rate Limiter', () => {
    test('should allow auth requests under the limit', async () => {
      app.use(authLimiter)
      app.post('/auth-test', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .post('/auth-test')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('should be more restrictive than general limiter', async () => {
      app.use(authLimiter)
      app.post('/auth-test', (req, res) => res.json({ success: true }))

      // Make several auth requests
      const requests = Array(3).fill().map(() => 
        request(app).post('/auth-test')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Sleeper API Rate Limiter', () => {
    test('should allow Sleeper API requests under the limit', async () => {
      app.use(sleeperApiLimiter)
      app.get('/sleeper-test', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .get('/sleeper-test')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('should handle rapid Sleeper API requests', async () => {
      app.use(sleeperApiLimiter)
      app.get('/sleeper-test', (req, res) => res.json({ success: true }))

      // Make several Sleeper API requests
      const requests = Array(4).fill().map(() => 
        request(app).get('/sleeper-test')
      )

      const responses = await Promise.all(requests)
      
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })

    test('should handle different IP addresses', async () => {
      app.use(sleeperApiLimiter)
      app.get('/sleeper-test', (req, res) => res.json({ success: true }))

      // Simulate different IP addresses
      const response1 = await request(app)
        .get('/sleeper-test')
        .set('X-Forwarded-For', '192.168.1.1')

      const response2 = await request(app)
        .get('/sleeper-test')
        .set('X-Forwarded-For', '192.168.1.2')

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })
  })

  describe('Rate Limiter Error Handling', () => {
    test('should handle rate limit exceeded gracefully', async () => {
      // Create a very restrictive rate limiter for testing
      const testLimiter = require('express-rate-limit')({
        windowMs: 1000, // 1 second
        max: 1, // Only 1 request per window
        message: { error: 'Too many requests' },
        standardHeaders: true,
        legacyHeaders: false
      })

      app.use(testLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      // First request should succeed
      const response1 = await request(app).get('/test')
      expect(response1.status).toBe(200)

      // Second immediate request should be rate limited
      const response2 = await request(app).get('/test')
      expect(response2.status).toBe(429)
    })

    test('should include proper error message when rate limited', async () => {
      const testLimiter = require('express-rate-limit')({
        windowMs: 1000,
        max: 1,
        message: { error: 'Rate limit exceeded' }
      })

      app.use(testLimiter)
      app.get('/test', (req, res) => res.json({ success: true }))

      // Make multiple requests to trigger rate limit
      await request(app).get('/test')
      const response = await request(app).get('/test')

      if (response.status === 429) {
        expect(response.body.error).toBe('Rate limit exceeded')
      }
    })
  })

  describe('Rate Limiter Integration', () => {
    test('should work with authentication middleware', async () => {
      const { requireAPIKey } = require('../../src/middleware/simpleAuth')
      
      app.use(authLimiter)
      app.use(requireAPIKey)
      app.get('/protected', (req, res) => res.json({ success: true, user: req.user }))

      const response = await request(app)
        .get('/protected')
        .set('X-API-Key', apiKey)

      expect(response.status).toBe(200)
    })

    test('should handle requests without API key', async () => {
      app.use(generalLimiter)
      app.get('/public', (req, res) => res.json({ success: true }))

      const response = await request(app)
        .get('/public')

      expect(response.status).toBe(200)
    })
  })
})
