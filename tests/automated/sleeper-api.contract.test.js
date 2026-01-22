const nock = require('nock')
const { buildNflState } = require('../fixtures/builders')

describe('Sleeper API contract stubs', () => {
  beforeAll(() => {
    nock.disableNetConnect()
    nock.enableNetConnect('127.0.0.1')
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  test('getNFLState hits the expected endpoint', async () => {
    process.env.SLEEPER_BASE_URL = 'https://api.sleeper.app/v1'
    jest.resetModules()

    const sleeperService = require('../../src/services/sleeperService')
    const payload = buildNflState({ week: 2 })

    const scope = nock('https://api.sleeper.app')
      .get('/v1/state/nfl')
      .reply(200, payload)

    const response = await sleeperService.getNFLState()
    expect(response).toEqual(payload)
    expect(scope.isDone()).toBe(true)
  })

  test('getUser hits the expected endpoint', async () => {
    process.env.SLEEPER_BASE_URL = 'https://api.sleeper.app/v1'
    jest.resetModules()

    const sleeperService = require('../../src/services/sleeperService')

    const scope = nock('https://api.sleeper.app')
      .get('/v1/user/testuser')
      .reply(200, { user_id: 'user-1', username: 'testuser' })

    const response = await sleeperService.getUser('testuser')
    expect(response).toEqual({ user_id: 'user-1', username: 'testuser' })
    expect(scope.isDone()).toBe(true)
  })
})
