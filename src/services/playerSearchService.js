const cacheService = require('./cacheService')
const logger = require('../config/logger')

class PlayerSearchService {
  constructor() {
    this.playersCache = null
    this.lastCacheUpdate = null
  }

  async getPlayersCache() {
    // Refresh local cache if it's stale or missing
    if (!this.playersCache || this.isCacheStale()) {
      logger.info('Refreshing local players cache')
      this.playersCache = await cacheService.getAllPlayers()
      this.lastCacheUpdate = Date.now()
    }
    return this.playersCache
  }

  isCacheStale() {
    // Consider cache stale after 1 hour
    return !this.lastCacheUpdate || (Date.now() - this.lastCacheUpdate) > 60 * 60 * 1000
  }

  async searchPlayerById(playerId) {
    try {
      const players = await this.getPlayersCache()
      const player = players[playerId]
      
      if (!player) {
        return null
      }

      return {
        player_id: playerId,
        ...player
      }
    } catch (error) {
      logger.error('Error searching player by ID:', error)
      throw new Error('Failed to search player by ID')
    }
  }

  async searchPlayersByName(searchTerm, limit = 10) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new Error('Search term must be at least 2 characters long')
      }

      const players = await this.getPlayersCache()
      const searchTermLower = searchTerm.toLowerCase().trim()
      const results = []

      // Search through all players
      for (const [playerId, player] of Object.entries(players)) {
        if (results.length >= limit) break

        // Skip if player doesn't have required fields
        if (!player.first_name || !player.last_name) continue

        const firstName = player.first_name.toLowerCase()
        const lastName = player.last_name.toLowerCase()
        const fullName = `${firstName} ${lastName}`
        const searchFullName = player.search_full_name?.toLowerCase() || ''

        // Check various name matches
        if (
          firstName.includes(searchTermLower) ||
          lastName.includes(searchTermLower) ||
          fullName.includes(searchTermLower) ||
          searchFullName.includes(searchTermLower)
        ) {
          results.push({
            player_id: playerId,
            ...player,
            match_score: this.calculateMatchScore(searchTermLower, firstName, lastName, fullName)
          })
        }
      }

      // Sort by match score (higher = better match)
      results.sort((a, b) => b.match_score - a.match_score)

      // Remove match_score from final results
      return results.map(({ match_score, ...player }) => player)
    } catch (error) {
      logger.error('Error searching players by name:', error)
      throw new Error('Failed to search players by name')
    }
  }

  calculateMatchScore(searchTerm, firstName, lastName, fullName) {
    let score = 0

    // Exact matches get highest score
    if (firstName === searchTerm || lastName === searchTerm) {
      score += 100
    } else if (fullName === searchTerm) {
      score += 90
    }
    // Starts with matches get high score
    else if (firstName.startsWith(searchTerm) || lastName.startsWith(searchTerm)) {
      score += 80
    } else if (fullName.startsWith(searchTerm)) {
      score += 70
    }
    // Contains matches get lower score
    else if (firstName.includes(searchTerm) || lastName.includes(searchTerm)) {
      score += 50
    } else if (fullName.includes(searchTerm)) {
      score += 40
    }

    return score
  }

  async searchPlayersByPosition(position, limit = 50) {
    try {
      const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
      if (!validPositions.includes(position.toUpperCase())) {
        throw new Error(`Invalid position: ${position}. Valid positions: ${validPositions.join(', ')}`)
      }

      const players = await this.getPlayersCache()
      const results = []
      const positionUpper = position.toUpperCase()

      for (const [playerId, player] of Object.entries(players)) {
        if (results.length >= limit) break

        if (player.position === positionUpper || 
            (player.fantasy_positions && player.fantasy_positions.includes(positionUpper))) {
          results.push({
            player_id: playerId,
            ...player
          })
        }
      }

      // Sort by search_rank if available (lower rank = better)
      results.sort((a, b) => (a.search_rank || 999999) - (b.search_rank || 999999))

      return results
    } catch (error) {
      logger.error('Error searching players by position:', error)
      throw new Error('Failed to search players by position')
    }
  }

  async searchPlayersByTeam(team, limit = 50) {
    try {
      if (!team || team.trim().length === 0) {
        throw new Error('Team parameter is required')
      }

      const players = await this.getPlayersCache()
      const results = []
      const teamUpper = team.toUpperCase().trim()

      for (const [playerId, player] of Object.entries(players)) {
        if (results.length >= limit) break

        if (player.team === teamUpper) {
          results.push({
            player_id: playerId,
            ...player
          })
        }
      }

      // Sort by position and search_rank
      results.sort((a, b) => {
        const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 }
        const aPos = positionOrder[a.position] || 7
        const bPos = positionOrder[b.position] || 7
        
        if (aPos !== bPos) {
          return aPos - bPos
        }
        
        return (a.search_rank || 999999) - (b.search_rank || 999999)
      })

      return results
    } catch (error) {
      logger.error('Error searching players by team:', error)
      throw new Error('Failed to search players by team')
    }
  }

  async getActivePlayersOnly(limit = 100) {
    try {
      const players = await this.getPlayersCache()
      const results = []

      for (const [playerId, player] of Object.entries(players)) {
        if (results.length >= limit) break

        if (player.status === 'Active' && player.team && player.team !== '') {
          results.push({
            player_id: playerId,
            ...player
          })
        }
      }

      // Sort by search_rank
      results.sort((a, b) => (a.search_rank || 999999) - (b.search_rank || 999999))

      return results
    } catch (error) {
      logger.error('Error getting active players:', error)
      throw new Error('Failed to get active players')
    }
  }
}

module.exports = new PlayerSearchService()
