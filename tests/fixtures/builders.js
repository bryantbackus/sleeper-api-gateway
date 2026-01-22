const buildPlayer = (overrides = {}) => ({
  player_id: 'player-1',
  first_name: 'Test',
  last_name: 'Player',
  full_name: 'Test Player',
  position: 'QB',
  team: 'KC',
  fantasy_positions: ['QB'],
  ...overrides
})

const buildLeague = (overrides = {}) => ({
  league_id: 'league-123',
  name: 'Test League',
  season: '2024',
  sport: 'nfl',
  total_rosters: 12,
  ...overrides
})

const buildNflState = (overrides = {}) => ({
  week: 1,
  season: '2024',
  season_type: 'regular',
  ...overrides
})

module.exports = {
  buildPlayer,
  buildLeague,
  buildNflState
}