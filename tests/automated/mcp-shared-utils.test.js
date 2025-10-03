process.env.NODE_ENV = 'test'

describe('MCP shared utilities', () => {
  let checkMcpRateLimit
  let resetMcpRateLimit
  let USER_SESSIONS
  let CONFIG

  beforeEach(async () => {
    jest.resetModules()
    const configModule = await import('../../mcp/config.js')
    CONFIG = configModule.CONFIG
    CONFIG.MCP_UNAUTHENTICATED_LIMIT = 3
    CONFIG.MCP_AUTHENTICATED_LIMIT = 5
    CONFIG.MCP_RATE_LIMIT_WINDOW = 1000

    const utils = await import('../../mcp/shared_utils.js')
    checkMcpRateLimit = utils.checkMcpRateLimit
    resetMcpRateLimit = utils.resetMcpRateLimit
    USER_SESSIONS = utils.USER_SESSIONS
  })

  afterEach(() => {
    for (const key of Object.keys(USER_SESSIONS)) {
      delete USER_SESSIONS[key]
    }
  })

  test('enforces unauthenticated limits and resets after window', () => {
    jest.useFakeTimers({ now: 0 })
    try {
      const sessionId = 'session-rate-limit'
      USER_SESSIONS[sessionId] = { authenticated: false }

      expect(checkMcpRateLimit(sessionId)).toMatchObject({ allowed: true, remaining: 2, limit: 3 })
      expect(checkMcpRateLimit(sessionId)).toMatchObject({ allowed: true, remaining: 1, limit: 3 })
      expect(checkMcpRateLimit(sessionId)).toMatchObject({ allowed: true, remaining: 0, limit: 3 })
      const blocked = checkMcpRateLimit(sessionId)
      expect(blocked.allowed).toBe(false)
      expect(blocked.limit).toBe(3)
      expect(blocked.resetIn).toBeGreaterThan(0)

      jest.advanceTimersByTime(1100)
      jest.setSystemTime(1100)

      const afterReset = checkMcpRateLimit(sessionId)
      expect(afterReset.allowed).toBe(true)
      expect(afterReset.remaining).toBe(2)
    } finally {
      jest.useRealTimers()
    }
  })

  test('authenticated sessions use higher limits and reset helper clears state', () => {
    const sessionId = 'session-auth-rate-limit'
    USER_SESSIONS[sessionId] = { authenticated: true }

    for (let i = 0; i < 5; i++) {
      const result = checkMcpRateLimit(sessionId)
      expect(result.limit).toBe(5)
    }

    const blocked = checkMcpRateLimit(sessionId)
    expect(blocked.allowed).toBe(false)

    resetMcpRateLimit(sessionId)

    const afterReset = checkMcpRateLimit(sessionId)
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(4)
  })
})
