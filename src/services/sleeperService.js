const axios = require('axios')
const logger = require('../config/logger')

class SleeperService {
  constructor() {
    this.baseURL = process.env.SLEEPER_BASE_URL || 'https://api.sleeper.app/v1'
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'User-Agent': 'sleeper-api-middleware/1.0.0'
      }
    })

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Sleeper API Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        logger.error('Sleeper API Request Error:', error)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Sleeper API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        logger.error('Sleeper API Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        })
        return Promise.reject(error)
      }
    )
  }

  // User endpoints
  async getUser(identifier) {
    try {
      const response = await this.client.get(`/user/${identifier}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch user')
    }
  }

  // League endpoints
  async getUserLeagues(userId, sport = 'nfl', season = new Date().getFullYear()) {
    try {
      const response = await this.client.get(`/user/${userId}/leagues/${sport}/${season}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch user leagues')
    }
  }

  async getLeague(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league')
    }
  }

  async getLeagueRosters(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}/rosters`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league rosters')
    }
  }

  async getLeagueUsers(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}/users`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league users')
    }
  }

  async getLeagueMatchups(leagueId, week) {
    try {
      const response = await this.client.get(`/league/${leagueId}/matchups/${week}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league matchups')
    }
  }

  async getLeaguePlayoffBracket(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}/winners_bracket`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch playoff bracket')
    }
  }

  async getLeagueTransactions(leagueId, round) {
    try {
      const url = round ? `/league/${leagueId}/transactions/${round}` : `/league/${leagueId}/transactions`
      const response = await this.client.get(url)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league transactions')
    }
  }

  async getLeagueTradedPicks(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}/traded_picks`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch traded picks')
    }
  }

  // Draft endpoints
  async getUserDrafts(userId, sport = 'nfl', season = new Date().getFullYear()) {
    try {
      const response = await this.client.get(`/user/${userId}/drafts/${sport}/${season}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch user drafts')
    }
  }

  async getLeagueDrafts(leagueId) {
    try {
      const response = await this.client.get(`/league/${leagueId}/drafts`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league drafts')
    }
  }

  async getDraft(draftId) {
    try {
      const response = await this.client.get(`/draft/${draftId}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch draft')
    }
  }

  async getDraftPicks(draftId) {
    try {
      const response = await this.client.get(`/draft/${draftId}/picks`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch draft picks')
    }
  }

  async getDraftTradedPicks(draftId) {
    try {
      const response = await this.client.get(`/draft/${draftId}/traded_picks`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch draft traded picks')
    }
  }

  // Player endpoints (these will be cached)
  async getAllPlayers(sport = 'nfl') {
    try {
      const response = await this.client.get(`/players/${sport}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch all players')
    }
  }

  async getTrendingPlayers(sport = 'nfl', type = 'add', lookbackHours = 24, limit = 25) {
    try {
      const response = await this.client.get(`/players/${sport}/trending/${type}`, {
        params: {
          lookback_hours: lookbackHours,
          limit: limit
        }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch trending players')
    }
  }

  // NFL State
  async getNFLState() {
    try {
      const response = await this.client.get('/state/nfl')
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch NFL state')
    }
  }

  // Error handler
  handleError(error, message) {
    if (error.response) {
      // Server responded with error status
      const sleeperError = new Error(`${message}: ${error.response.status} ${error.response.statusText}`)
      sleeperError.status = error.response.status
      sleeperError.data = error.response.data
      return sleeperError
    } else if (error.request) {
      // Request made but no response received
      const networkError = new Error(`${message}: Network error - ${error.message}`)
      networkError.status = 503
      return networkError
    } else {
      // Something else happened
      const genericError = new Error(`${message}: ${error.message}`)
      genericError.status = 500
      return genericError
    }
  }
}

module.exports = new SleeperService()
