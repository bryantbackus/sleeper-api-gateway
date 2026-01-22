const shouldRun = process.env.RUN_REAL_SLEEPER_SMOKE === 'true'
const run = shouldRun ? describe : describe.skip

run('Real Sleeper API smoke tests (opt-in)', () => {
  test('getNFLState returns expected shape', async () => {
    const sleeperService = require('../../src/services/sleeperService')
    const response = await sleeperService.getNFLState()

    expect(response).toHaveProperty('week')
    expect(response).toHaveProperty('season')
  })
})
