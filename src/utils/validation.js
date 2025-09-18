// Utility functions for validation

const validatePlayerId = (id) => {
  return typeof id === 'string' && id.length > 0 && id.length < 20 && /^\d+$/.test(id)
}

const validateLeagueId = (id) => {
  return typeof id === 'string' && /^\d+$/.test(id)
}

const validateUserId = (id) => {
  return typeof id === 'string' && id.length > 0 && id.length < 50 && /^[a-zA-Z0-9_-]+$/.test(id)
}

const validateSeason = (season) => {
  const year = parseInt(season)
  const currentYear = new Date().getFullYear()
  return !isNaN(year) && year >= 2011 && year <= (currentYear + 1)
}

const validateWeek = (week) => {
  const weekNum = parseInt(week)
  return !isNaN(weekNum) && Number.isInteger(Number(week)) && weekNum >= 1 && weekNum <= 22
}

const validatePosition = (position) => {
  if (typeof position !== 'string') return false
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
  return validPositions.includes(position.toUpperCase())
}

const validateTeam = (team) => {
  if (typeof team !== 'string') return false
  const nflTeams = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
  ]
  return nflTeams.includes(team.toUpperCase())
}

const sanitizeSearchTerm = (term) => {
  if (typeof term !== 'string') {
    if (term === null || term === undefined) return ''
    return String(term).toLowerCase().substring(0, 50)
  }
  return term.trim().toLowerCase().replace(/<[^>]*>/g, '').replace(/[<>]/g, '').substring(0, 50)
}

module.exports = {
  validatePlayerId,
  validateLeagueId,
  validateUserId,
  validateSeason,
  validateWeek,
  validatePosition,
  validateTeam,
  sanitizeSearchTerm
}
