const request = require('supertest')

process.env.NODE_ENV = 'test'

let app
let TRANSPORTS
let USER_SESSIONS

const initializePayload = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'jest-client',
      version: '1.0.0'
    }
  }
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  const serverModule = await import('../../mcp/server.js')
  app = serverModule.app

  const sharedUtils = await import('../../mcp/shared_utils.js')
  TRANSPORTS = sharedUtils.TRANSPORTS
  USER_SESSIONS = sharedUtils.USER_SESSIONS
})

afterEach(() => {
  if (TRANSPORTS) {
    for (const sessionId of Object.keys(TRANSPORTS)) {
      delete TRANSPORTS[sessionId]
    }
  }

  if (USER_SESSIONS) {
    for (const sessionId of Object.keys(USER_SESSIONS)) {
      delete USER_SESSIONS[sessionId]
    }
  }
})

describe('MCP server endpoints', () => {
  test('POST /mcp initializes a new session and registers transports', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Host', '127.0.0.1')
      .set('Accept', 'application/json, text/event-stream')
      .send(initializePayload)

    expect(res.status).toBe(200)
    const sessionId = res.headers['mcp-session-id']

    expect(typeof sessionId).toBe('string')
    expect(sessionId.length).toBeGreaterThan(0)

    expect(TRANSPORTS[sessionId]).toBeDefined()
    expect(USER_SESSIONS[sessionId]).toEqual({
      authenticated: false,
      apiKey: null,
      username: null,
      userId: null
    })

    // simulate session close to ensure cleanup
    const transport = TRANSPORTS[sessionId]
    expect(typeof transport.onclose).toBe('function')
    transport.onclose()

    expect(TRANSPORTS[sessionId]).toBeUndefined()
    expect(USER_SESSIONS[sessionId]).toBeUndefined()
  })

  test('POST /mcp rejects requests without initialize payload or session id', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Host', '127.0.0.1')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided'
      },
      id: null
    })
  })

  test('GET /mcp without session id returns 400', async () => {
    const res = await request(app)
      .get('/mcp')

    expect(res.status).toBe(400)
    expect(res.text).toBe('Invalid or missing session ID')
  })

  test('DELETE /mcp without session id returns 400', async () => {
    const res = await request(app)
      .delete('/mcp')

    expect(res.status).toBe(400)
    expect(res.text).toBe('Invalid or missing session ID')
  })

  test('GET /mcp/health reports server stats', async () => {
    const res = await request(app)
      .get('/mcp/health')
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('healthy')
    expect(typeof res.body.timestamp).toBe('string')
    expect(typeof res.body.uptime).toBe('number')
    expect(res.body.sessions).toEqual({
      active: 0,
      authenticated: 0
    })
    expect(res.body.cache).toMatchObject({
      keys: expect.any(Number),
      hits: expect.any(Number),
      misses: expect.any(Number)
    })
  })

  test('GET /mcp/info exposes metadata about the server', async () => {
    const res = await request(app)
      .get('/mcp/info')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      name: 'Sleeper API MCP Server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      transport: 'StreamableHTTP'
    })
    expect(res.body.endpoints).toHaveProperty('mcp')
    expect(res.body).toHaveProperty('sessionTTL')
    expect(res.body).toHaveProperty('environment')
  })

  test('Unknown routes return a 404 payload', async () => {
    const res = await request(app)
      .get('/mcp/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({
      error: 'Not Found',
      message: expect.stringContaining('Route GET /mcp/does-not-exist not found')
    })
    expect(Array.isArray(res.body.availableEndpoints)).toBe(true)
  })
})
