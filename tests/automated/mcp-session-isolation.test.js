const request = require('supertest')

process.env.NODE_ENV = 'test'

let app
let USER_SESSIONS
let TRANSPORTS
let checkMcpRateLimit
let resetMcpRateLimit
let CONFIG

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  const serverModule = await import('../../mcp/server.js')
  app = serverModule.app

  const sharedUtils = await import('../../mcp/shared_utils.js')
  USER_SESSIONS = sharedUtils.USER_SESSIONS
  TRANSPORTS = sharedUtils.TRANSPORTS
  checkMcpRateLimit = sharedUtils.checkMcpRateLimit
  resetMcpRateLimit = sharedUtils.resetMcpRateLimit

  ;({ CONFIG } = await import('../../mcp/config.js'))
})

afterEach(() => {
  if (USER_SESSIONS) {
    for (const sessionId of Object.keys(USER_SESSIONS)) {
      resetMcpRateLimit(sessionId)
      delete USER_SESSIONS[sessionId]
    }
  }

  if (TRANSPORTS) {
    for (const sessionId of Object.keys(TRANSPORTS)) {
      delete TRANSPORTS[sessionId]
    }
  }
})

describe('MCP session isolation', () => {
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

  test('separate sessions do not share authentication or rate limit state', async () => {
    const res1 = await request(app)
      .post('/mcp')
      .set('Host', '127.0.0.1')
      .set('Accept', 'application/json, text/event-stream')
      .send(initializePayload)

    expect(res1.status).toBe(200)
    const sessionId1 = res1.headers['mcp-session-id']
    expect(typeof sessionId1).toBe('string')
    expect(sessionId1.length).toBeGreaterThan(0)

    USER_SESSIONS[sessionId1].authenticated = true
    USER_SESSIONS[sessionId1].apiKey = 'fake-api-key'

    // simulate rate-limit usage for session 1
    checkMcpRateLimit(sessionId1)
    checkMcpRateLimit(sessionId1)
    const thirdCall = checkMcpRateLimit(sessionId1)

    expect(thirdCall.limit).toBe(CONFIG.MCP_AUTHENTICATED_LIMIT)
    expect(thirdCall.remaining).toBe(CONFIG.MCP_AUTHENTICATED_LIMIT - 3)

    const res2 = await request(app)
      .post('/mcp')
      .set('Host', '127.0.0.1')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        ...initializePayload,
        id: 2
      })

    expect(res2.status).toBe(200)
    const sessionId2 = res2.headers['mcp-session-id']
    expect(typeof sessionId2).toBe('string')
    expect(sessionId2.length).toBeGreaterThan(0)
    expect(sessionId2).not.toBe(sessionId1)

    expect(USER_SESSIONS[sessionId2]).toEqual({
      authenticated: false,
      apiKey: null,
      username: null,
      userId: null
    })

    const rateLimitForSecondSession = checkMcpRateLimit(sessionId2)
    expect(rateLimitForSecondSession.limit).toBe(CONFIG.MCP_UNAUTHENTICATED_LIMIT)
    expect(rateLimitForSecondSession.remaining).toBe(CONFIG.MCP_UNAUTHENTICATED_LIMIT - 1)

    // session 1 should retain its own rate limit state
    const fourthCall = checkMcpRateLimit(sessionId1)
    expect(fourthCall.remaining).toBe(CONFIG.MCP_AUTHENTICATED_LIMIT - 4)
  })
})
