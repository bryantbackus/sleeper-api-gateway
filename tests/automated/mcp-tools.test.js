process.env.NODE_ENV = 'test'

describe('MCP tool registration', () => {
  let callSleeperAPIMock
  let checkMcpRateLimitMock
  let resetMcpRateLimitMock
  let userSessions
  let toolHandles
  let registerNoAuthTools
  let registerAuthenticatedTools

  const createServerDouble = () => {
    const registered = {}
    const server = {
      registerTool: jest.fn((name, config, callback) => {
        const remove = jest.fn()
        registered[name] = { config, callback, remove }
        return { remove }
      })
    }
    return { server, registered }
  }

  const setupModules = async () => {
    jest.resetModules()
    callSleeperAPIMock = jest.fn().mockResolvedValue({ success: true })
    checkMcpRateLimitMock = jest.fn().mockReturnValue({ allowed: true, remaining: 10, limit: 50 })
    resetMcpRateLimitMock = jest.fn()
    userSessions = {}
    toolHandles = {}

    const cacheStub = {
      keys: () => [],
      getStats: () => ({ hits: 0, misses: 0 })
    }

    jest.unstable_mockModule('../../mcp/shared_utils.js', () => ({
      callSleeperAPI: callSleeperAPIMock,
      log: jest.fn(),
      USER_SESSIONS: userSessions,
      TRANSPORTS: {},
      TOOL_HANDLES: toolHandles,
      cache: cacheStub,
      checkMcpRateLimit: checkMcpRateLimitMock,
      resetMcpRateLimit: resetMcpRateLimitMock
    }))

    const toolsNoAuthModule = await import('../../mcp/tools-no-auth.js')
    registerNoAuthTools = toolsNoAuthModule.registerNoAuthTools

    const toolsAuthModule = await import('../../mcp/tools-auth.js')
    registerAuthenticatedTools = toolsAuthModule.registerAuthenticatedTools
  }

  describe('registerNoAuthTools', () => {
    beforeEach(async () => {
      await setupModules()
    })

    test('registers every unauthenticated MCP tool and routes requests', async () => {
      const { server, registered } = createServerDouble()
      const sessionId = 'session-no-auth'
      userSessions[sessionId] = { authenticated: true, apiKey: 'a'.repeat(64) }

      registerNoAuthTools(server, sessionId)

      const expectedTools = [
        'get_trending_players',
        'search_players_by_id',
        'search_players_by_name',
        'search_players_by_position',
        'search_players_by_team',
        'get_active_players',
        'get_nfl_state'
      ]

      expect(Object.keys(registered)).toEqual(expectedTools)
      expect(server.registerTool).toHaveBeenCalledTimes(expectedTools.length)

      const scenarios = [
        {
          tool: 'get_trending_players',
          args: { type: 'add', lookback_hours: 12, limit: 5 },
          expected: ['/players/nfl/trending/add?lookback_hours=12&limit=5', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'search_players_by_id',
          args: { playerId: '1234' },
          expected: ['/players/search/id/1234', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'search_players_by_name',
          args: { query: 'Justin Jefferson', limit: 3 },
          expected: ['/players/search/name?q=Justin%20Jefferson&limit=3', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'search_players_by_position',
          args: { position: 'QB', limit: 10 },
          expected: ['/players/search/position/QB?limit=10', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'search_players_by_team',
          args: { team: 'MIN', limit: 8 },
          expected: ['/players/search/team/MIN?limit=8', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_active_players',
          args: {},
          expected: ['/players/active?limit=200', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_nfl_state',
          args: {},
          expected: ['/sleeper/state/nfl', 'GET', null, userSessions[sessionId].apiKey, true]
        }
      ]

      for (const scenario of scenarios) {
        callSleeperAPIMock.mockClear()
        await registered[scenario.tool].callback(scenario.args)
        expect(callSleeperAPIMock).toHaveBeenCalledWith(...scenario.expected)
      }
    })

    test('omits API key when session is not authenticated', async () => {
      const { server, registered } = createServerDouble()
      const sessionId = 'session-no-auth'
      userSessions[sessionId] = { authenticated: false, apiKey: null }

      registerNoAuthTools(server, sessionId)

      callSleeperAPIMock.mockClear()
      await registered.get_trending_players.callback({ type: 'drop' })
      expect(callSleeperAPIMock).toHaveBeenCalledWith('/players/nfl/trending/drop', 'GET', null, null, true)
    })

    test('returns structured error when rate limit is exceeded', async () => {
      const { server, registered } = createServerDouble()
      const sessionId = 'session-no-auth'
      userSessions[sessionId] = { authenticated: false, apiKey: null }
      checkMcpRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, limit: 50, resetIn: 4000 })

      registerNoAuthTools(server, sessionId)

      const response = await registered.get_trending_players.callback({ type: 'add' })
      expect(response.success).toBe(false)
      expect(response.isError).toBe(true)
      expect(JSON.parse(response.content[0].text)).toMatchObject({
        error: 'Rate limit exceeded',
        limit: 50,
        resetIn: 4
      })
    })
  })

  describe('registerAuthenticatedTools', () => {
    beforeEach(async () => {
      await setupModules()
    })

    test('requires a session id', async () => {
      const { server } = createServerDouble()
      expect(() => registerAuthenticatedTools(server)).toThrow('registerAuthenticatedTools requires a valid session ID')
    })

    test('registers every authenticated MCP tool and uses session API key', async () => {
      const { server, registered } = createServerDouble()
      const sessionId = 'session-auth'
      userSessions[sessionId] = { authenticated: true, apiKey: 'b'.repeat(64) }

      registerAuthenticatedTools(server, sessionId)

      const expectedTools = [
        'get_user_info_requires_auth',
        'get_user_leagues_requires_auth',
        'get_my_leagues_requires_auth',
        'get_league_info_requires_auth',
        'get_league_rosters_requires_auth',
        'get_league_users_requires_auth',
        'get_league_matchups_requires_auth',
        'get_league_winners_bracket_requires_auth',
        'get_league_transactions_requires_auth',
        'get_league_traded_picks_requires_auth',
        'get_league_drafts_requires_auth',
        'get_draft_info_requires_auth',
        'get_draft_picks_requires_auth',
        'get_draft_traded_picks_requires_auth',
        'get_my_profile_requires_auth',
        'update_my_profile',
        'verify_sleeper_user',
        'get_profile_status'
      ]

      expect(Object.keys(registered)).toEqual(expectedTools)
      expect(server.registerTool).toHaveBeenCalledTimes(expectedTools.length)

      const scenarios = [
        {
          tool: 'get_user_info_requires_auth',
          args: { identifier: 'user123' },
          expected: ['/sleeper/user/user123', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_user_leagues_requires_auth',
          args: { userId: 'user123', sport: 'nfl', season: '2025' },
          expected: ['/sleeper/user/user123/leagues/nfl/2025', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_my_leagues_requires_auth',
          args: { sport: 'nfl', season: '2025' },
          expected: ['/sleeper/leagues/nfl/2025', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_info_requires_auth',
          args: { leagueId: '12345' },
          expected: ['/sleeper/league/12345', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_rosters_requires_auth',
          args: { leagueId: '12345' },
          expected: ['/sleeper/league/12345/rosters', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_users_requires_auth',
          args: { leagueId: '12345' },
          expected: ['/sleeper/league/12345/users', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_matchups_requires_auth',
          args: { leagueId: '12345', week: 5 },
          expected: ['/sleeper/league/12345/matchups/5', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_winners_bracket_requires_auth',
          args: { leagueId: '12345' },
          expected: ['/sleeper/league/12345/winners_bracket', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_transactions_requires_auth',
          args: { leagueId: '12345', week: 6 },
          expected: ['/sleeper/league/12345/transactions/6', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_traded_picks_requires_auth',
          args: { leagueId: '12345' },
          expected: ['/sleeper/league/12345/traded_picks', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_league_drafts_requires_auth',
          args: { leagueId: '12345' },
          expected: ['/sleeper/league/12345/drafts', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_draft_info_requires_auth',
          args: { draftId: '54321' },
          expected: ['/sleeper/draft/54321', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_draft_picks_requires_auth',
          args: { draftId: '54321' },
          expected: ['/sleeper/draft/54321/picks', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_draft_traded_picks_requires_auth',
          args: { draftId: '54321' },
          expected: ['/sleeper/draft/54321/traded_picks', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'get_my_profile_requires_auth',
          args: {},
          expected: ['/profile', 'GET', null, userSessions[sessionId].apiKey, true]
        },
        {
          tool: 'update_my_profile',
          args: { display_name: 'New Name' },
          expected: ['/profile', 'PUT', { display_name: 'New Name' }, userSessions[sessionId].apiKey, false]
        },
        {
          tool: 'verify_sleeper_user',
          args: { sleeper_user_id: '777' },
          expected: ['/profile/verify-sleeper', 'POST', { sleeper_user_id: '777' }, userSessions[sessionId].apiKey, false]
        },
        {
          tool: 'get_profile_status',
          args: {},
          expected: ['/profile/status', 'GET', null, userSessions[sessionId].apiKey, true]
        }
      ]

      for (const scenario of scenarios) {
        callSleeperAPIMock.mockClear()
        await registered[scenario.tool].callback(scenario.args)
        expect(callSleeperAPIMock).toHaveBeenCalledWith(...scenario.expected)
      }
    })

    test('returns rate limit error when exceeded', async () => {
      const { server, registered } = createServerDouble()
      const sessionId = 'session-auth'
      userSessions[sessionId] = { authenticated: true, apiKey: 'b'.repeat(64) }

      registerAuthenticatedTools(server, sessionId)

      checkMcpRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, limit: 200, resetIn: 2500 })
      const response = await registered.get_my_profile_requires_auth.callback({})
      expect(response.success).toBe(false)
      expect(response.isError).toBe(true)
      expect(JSON.parse(response.content[0].text)).toMatchObject({
        error: 'Rate limit exceeded',
        limit: 200,
        resetIn: 3
      })
    })

    test('omits API key when session is not authenticated', async () => {
      const { server, registered } = createServerDouble()
      const sessionId = 'session-auth'
      userSessions[sessionId] = { authenticated: false, apiKey: null }

      registerAuthenticatedTools(server, sessionId)

      callSleeperAPIMock.mockClear()
      await registered.get_user_info_requires_auth.callback({ identifier: 'user123' })
      expect(callSleeperAPIMock).toHaveBeenCalledWith('/sleeper/user/user123', 'GET', null, null, true)
    })
  })
})

describe('Authentication tool flows', () => {
  let callSleeperAPIMock
  let resetMcpRateLimitMock
  let userSessions
  let toolHandles
  let registerAuthTool
  let registerAuthToolNoToolRegistration
  let registerAuthenticatedToolsMock

  const cacheStub = {
    keys: () => [],
    getStats: () => ({ hits: 0, misses: 0 })
  }

  const createServerDouble = () => {
    const registered = {}
    const server = {
      registerTool: jest.fn((name, config, callback) => {
        const remove = jest.fn()
        registered[name] = { config, callback, remove }
        return { remove }
      }),
      sendToolListChanged: jest.fn()
    }
    return { server, registered }
  }

  const setupModules = async () => {
    jest.resetModules()
    callSleeperAPIMock = jest.fn().mockResolvedValue({ valid: true, userId: 'user123', description: 'ok' })
    resetMcpRateLimitMock = jest.fn()
    registerAuthenticatedToolsMock = jest.fn()
    userSessions = {}
    toolHandles = {}

    jest.unstable_mockModule('../../mcp/tools-auth.js', () => ({
      registerAuthenticatedTools: registerAuthenticatedToolsMock
    }))

    jest.unstable_mockModule('../../mcp/shared_utils.js', () => ({
      callSleeperAPI: callSleeperAPIMock,
      log: jest.fn(),
      USER_SESSIONS: userSessions,
      TRANSPORTS: {},
      TOOL_HANDLES: toolHandles,
      cache: cacheStub,
      checkMcpRateLimit: jest.fn(),
      resetMcpRateLimit: resetMcpRateLimitMock
    }))

    const authModule = await import('../../mcp/authenticate-api.js')
    registerAuthTool = authModule.registerAuthTool
    registerAuthToolNoToolRegistration = authModule.registerAuthToolNoToolRegistration
  }

  beforeEach(async () => {
    await setupModules()
  })

  test('registerAuthTool authenticates users, registers protected tools and resets rate limits', async () => {
    const { server, registered } = createServerDouble()
    const sessionId = 'session-auth'

    registerAuthTool(server, sessionId)

    expect(toolHandles[sessionId].authenticate).toBeDefined()

    const response = await registered.authenticate.callback({ apiKey: 'a'.repeat(64) })

    expect(callSleeperAPIMock).toHaveBeenCalledWith('/auth/validate', 'GET', null, 'a'.repeat(64), false, true)
    expect(userSessions[sessionId]).toEqual({
      authenticated: true,
      apiKey: 'a'.repeat(64),
      userId: 'user123'
    })
    expect(resetMcpRateLimitMock).toHaveBeenCalledWith(sessionId)
    expect(registerAuthenticatedToolsMock).toHaveBeenCalledWith(server, sessionId)
    expect(server.sendToolListChanged).toHaveBeenCalled()

    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.success).toBe(true)
    expect(toolHandles[sessionId].authenticate).toBeUndefined()
    expect(registered.authenticate.remove).toHaveBeenCalled()
  })

  test('registerAuthTool propagates authentication failures', async () => {
    callSleeperAPIMock.mockResolvedValueOnce({ valid: false })
    const { server, registered } = createServerDouble()
    const sessionId = 'session-auth'

    registerAuthTool(server, sessionId)

    await expect(
      registered.authenticate.callback({ apiKey: 'a'.repeat(64) })
    ).rejects.toThrow('Invalid API key or unable to validate authentication')

    expect(resetMcpRateLimitMock).not.toHaveBeenCalled()
    expect(registerAuthenticatedToolsMock).not.toHaveBeenCalled()
  })

  test('registerAuthToolNoToolRegistration authenticates without registering extra tools', async () => {
    const { server, registered } = createServerDouble()
    const sessionId = 'session-auth'

    registerAuthToolNoToolRegistration(server, sessionId)

    expect(toolHandles[sessionId].authenticate).toBeDefined()

    const response = await registered.authenticate.callback({ apiKey: 'b'.repeat(64) })

    expect(callSleeperAPIMock).toHaveBeenCalledWith('/auth/validate', 'GET', null, 'b'.repeat(64), false, true)
    expect(userSessions[sessionId]).toEqual({
      authenticated: true,
      apiKey: 'b'.repeat(64),
      userId: 'user123'
    })
    const parsed = JSON.parse(response.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.message).toBe('Authentication successful')
    expect(registerAuthenticatedToolsMock).not.toHaveBeenCalled()
    expect(toolHandles[sessionId].authenticate).toBeUndefined()
  })

  test('registerAuthToolNoToolRegistration propagates authentication errors', async () => {
    callSleeperAPIMock.mockResolvedValueOnce({ valid: false })
    const { server, registered } = createServerDouble()
    const sessionId = 'session-auth'

    registerAuthToolNoToolRegistration(server, sessionId)

    await expect(
      registered.authenticate.callback({ apiKey: 'c'.repeat(64) })
    ).rejects.toThrow('Invalid API key or unable to validate authentication')
  })
})
