const axios = require('axios')
const logger = require('../config/logger')

class SleeperService {
  constructor() {
    this.baseURL = process.env.SLEEPER_BASE_URL || 'https://api.sleeper.app/v1'
    this.maxRetries = 3
    this.baseDelay = 1000 // 1 second
    
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

  // Determine if we should retry based on status code
  shouldRetry(statusCode) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504]
    return retryableStatuses.includes(statusCode)
  }

  // Calculate delay with exponential backoff
  calculateDelay(attempt) {
    return this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000 // Add jitter
  }

  // Wait for specified delay
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Make request with retry logic
  async makeRequest(method, url, config = {}) {
    let lastError

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.request({
          method,
          url,
          ...config
        })
        
        // Success - log if this was a retry
        if (attempt > 0) {
          logger.info('Request succeeded after retry:', {
            url,
            attempt: attempt + 1,
            totalAttempts: this.maxRetries + 1
          })
        }
        
        return response
      } catch (error) {
        lastError = error
        
        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break
        }
        
        // Check if we should retry
        const statusCode = error.response?.status
        if (!this.shouldRetry(statusCode)) {
          logger.info('Not retrying due to status code:', {
            url,
            statusCode,
            attempt: attempt + 1
          })
          break
        }
        
        // Calculate delay and wait
        const delayMs = this.calculateDelay(attempt)
        logger.warn('Request failed, retrying:', {
          url,
          statusCode,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delayMs,
          error: error.message
        })
        
        await this.delay(delayMs)
      }
    }

    // All retries exhausted
    logger.error('Request failed after all retries:', {
      url,
      totalAttempts: this.maxRetries + 1,
      finalError: lastError.message
    })
    
    throw lastError
  }

  // User endpoints
  async getUser(identifier) {
    try {
      const response = await this.makeRequest('GET', `/user/${identifier}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch user')
    }
  }

  // League endpoints
  async getUserLeagues(userId, sport = 'nfl', season = new Date().getFullYear()) {
    try {
      const response = await this.makeRequest('GET', `/user/${userId}/leagues/${sport}/${season}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch user leagues')
    }
  }

  async getLeague(leagueId) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league')
    }
  }

  async getLeagueRosters(leagueId) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}/rosters`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league rosters')
    }
  }

  async getLeagueUsers(leagueId) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}/users`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league users')
    }
  }

  async getLeagueMatchups(leagueId, week) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}/matchups/${week}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league matchups')
    }
  }

  async getLeaguePlayoffBracket(leagueId) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}/winners_bracket`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch playoff bracket')
    }
  }

  async getLeagueTransactions(leagueId, round) {
    try {
      const url = round ? `/league/${leagueId}/transactions/${round}` : `/league/${leagueId}/transactions`
      const response = await this.makeRequest('GET', url)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league transactions')
    }
  }

  async getLeagueTradedPicks(leagueId) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}/traded_picks`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch traded picks')
    }
  }

  // Draft endpoints
  async getUserDrafts(userId, sport = 'nfl', season = new Date().getFullYear()) {
    try {
      const response = await this.makeRequest('GET', `/user/${userId}/drafts/${sport}/${season}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch user drafts')
    }
  }

  async getLeagueDrafts(leagueId) {
    try {
      const response = await this.makeRequest('GET', `/league/${leagueId}/drafts`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch league drafts')
    }
  }

  async getDraft(draftId) {
    try {
      const response = await this.makeRequest('GET', `/draft/${draftId}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch draft')
    }
  }

  async getDraftPicks(draftId) {
    try {
      const response = await this.makeRequest('GET', `/draft/${draftId}/picks`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch draft picks')
    }
  }

  async getDraftTradedPicks(draftId) {
    try {
      const response = await this.makeRequest('GET', `/draft/${draftId}/traded_picks`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch draft traded picks')
    }
  }

  // Player endpoints (these will be cached)
  async getAllPlayers(sport = 'nfl') {
    try {
      const response = await this.makeRequest('GET', `/players/${sport}`)
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch all players')
    }
  }

  async getTrendingPlayers(sport = 'nfl', type = 'add', lookbackHours = 24, limit = 25) {
    try {
      const response = await this.makeRequest('GET', `/players/${sport}/trending/${type}`, {
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
      const response = await this.makeRequest('GET', '/state/nfl')
      return response.data
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch NFL state')
    }
  }

  // Error handler with user-friendly messages
  handleError(error, message) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      let userMessage = message
      
      // Provide user-friendly messages based on status code
      switch (status) {
        case 400:
          userMessage = 'Invalid request - please check your parameters'
          break
        case 404:
          userMessage = 'The requested resource was not found'
          break
        case 429:
          userMessage = 'Rate limit exceeded - please wait before making more requests'
          break
        case 500:
        case 502:
        case 503:
        case 504:
          userMessage = 'Sleeper API is temporarily unavailable - please try again later'
          break
        default:
          userMessage = `${message} (Status: ${status})`
      }
      
      const sleeperError = new Error(userMessage)
      sleeperError.status = status
      sleeperError.originalMessage = message
      sleeperError.data = error.response.data
      return sleeperError
    } else if (error.request) {
      // Request made but no response received
      const networkError = new Error('Unable to connect to Sleeper API - please check your internet connection')
      networkError.status = 503
      networkError.originalMessage = message
      return networkError
    } else {
      // Something else happened
      const genericError = new Error(`${message}: ${error.message}`)
      genericError.status = 500
      genericError.originalMessage = message
      return genericError
    }
  }
}

module.exports = new SleeperService()
