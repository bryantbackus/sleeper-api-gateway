const request = require('supertest')
const express = require('express')

describe('Rate limiter configuration', () => {
  test('disables rate limiting when RATE_LIMIT_ENABLED=false', async () => {
    process.env.RATE_LIMIT_ENABLED = 'false'
    jest.resetModules()

    const { generalLimiter } = require('../../src/middleware/rateLimiter')
    const app = express()
    app.use(generalLimiter)
    app.get('/test', (req, res) => res.json({ ok: true }))

    const response = await request(app).get('/test')
    expect(response.status).toBe(200)
    expect(response.headers['ratelimit-limit']).toBeUndefined()
  })

  test('enables rate limiting headers when RATE_LIMIT_ENABLED=true', async () => {
    process.env.RATE_LIMIT_ENABLED = 'true'
    jest.resetModules()

    const { generalLimiter } = require('../../src/middleware/rateLimiter')
    const app = express()
    app.use(generalLimiter)
    app.get('/test', (req, res) => res.json({ ok: true }))

    const response = await request(app).get('/test')
    expect(response.status).toBe(200)
    expect(response.headers['ratelimit-limit']).toBeDefined()

    process.env.RATE_LIMIT_ENABLED = 'false'
  })
})
