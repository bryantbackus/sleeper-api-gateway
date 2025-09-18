// Utility functions for validation

const validatePlayerId = (id) => {
  return typeof id === 'string' && id.length > 0 && id.length < 20
}

const validateLeagueId = (id) => {
  return typeof id === 'string' && /^\d+$/.test(id)
}

const validateUserId = (id) => {
  return typeof id === 'string' && (id.length > 0 && id.length < 50)
}

const validateSeason = (season) => {
  const year = parseInt(season)
  const currentYear = new Date().getFullYear()
  return !isNaN(year) && year >= 2017 && year <= (currentYear + 1)
}

const validateWeek = (week) => {
  const weekNum = parseInt(week)
  return !isNaN(weekNum) && weekNum >= 1 && weekNum <= 18
}

const validatePosition = (position) => {
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
  return validPositions.includes(position.toUpperCase())
}

const validateTeam = (team) => {
  return typeof team === 'string' && team.length >= 2 && team.length <= 3
}

const sanitizeSearchTerm = (term) => {
  if (typeof term !== 'string') return ''
  return term.trim().replace(/[<>]/g, '').substring(0, 50)
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
