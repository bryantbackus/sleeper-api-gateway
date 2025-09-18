const cron = require('node-cron')
const moment = require('moment-timezone')
const database = require('../config/database')
const sleeperService = require('./sleeperService')
const logger = require('../config/logger')

class CacheService {
  constructor() {
    this.timezone = process.env.CACHE_TIMEZONE || 'America/New_York'
    this.refreshTime = process.env.CACHE_REFRESH_TIME || '06:00'
    this.isRefreshing = false
  }

  async initialize() {
    // Schedule daily refresh at 6 AM EST
    const [hour, minute] = this.refreshTime.split(':')
    const cronExpression = `${minute} ${hour} * * *`
    
    logger.info(`Scheduling cache refresh for ${this.refreshTime} ${this.timezone}`)
    
    cron.schedule(cronExpression, async () => {
      await this.refreshPlayerCache()
    }, {
      timezone: this.timezone
    })

    // Refresh cache on startup if data is stale or missing
    await this.checkAndRefreshIfNeeded()
  }

  async checkAndRefreshIfNeeded() {
    try {
      const lastRefresh = await this.getLastRefreshTime()
      const now = moment().tz(this.timezone)
      
      if (!lastRefresh) {
        logger.info('No cache found, performing initial refresh')
        await this.refreshPlayerCache()
        return
      }

      const lastRefreshMoment = moment(lastRefresh).tz(this.timezone)
      const daysSinceRefresh = now.diff(lastRefreshMoment, 'days')
      
      if (daysSinceRefresh >= 1) {
        logger.info(`Cache is ${daysSinceRefresh} days old, refreshing`)
        await this.refreshPlayerCache()
      } else {
        logger.info('Cache is up to date')
      }
    } catch (error) {
      logger.error('Error checking cache freshness:', error)
      // Try to refresh anyway
      await this.refreshPlayerCache()
    }
  }

  async refreshPlayerCache() {
    if (this.isRefreshing) {
      logger.warn('Cache refresh already in progress, skipping')
      return
    }

    this.isRefreshing = true
    logger.info('Starting player cache refresh')

    try {
      // Fetch all players
      logger.info('Fetching all players from Sleeper API')
      const allPlayers = await sleeperService.getAllPlayers('nfl')
      
      // Cache all players
      await database.run(
        'INSERT OR REPLACE INTO players (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['all_players', JSON.stringify(allPlayers)]
      )
      logger.info(`Cached ${Object.keys(allPlayers).length} players`)

      // Fetch trending players (add)
      logger.info('Fetching trending players (add) from Sleeper API')
      const trendingAdd = await sleeperService.getTrendingPlayers('nfl', 'add', 24, 25)
      
      await database.run(
        'INSERT OR REPLACE INTO trending_players (id, type, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        ['trending_add', 'add', JSON.stringify(trendingAdd)]
      )
      logger.info(`Cached ${trendingAdd.length} trending add players`)

      // Fetch trending players (drop)
      logger.info('Fetching trending players (drop) from Sleeper API')
      const trendingDrop = await sleeperService.getTrendingPlayers('nfl', 'drop', 24, 25)
      
      await database.run(
        'INSERT OR REPLACE INTO trending_players (id, type, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        ['trending_drop', 'drop', JSON.stringify(trendingDrop)]
      )
      logger.info(`Cached ${trendingDrop.length} trending drop players`)

      // Update last refresh time
      await database.run(
        'INSERT OR REPLACE INTO cache_metadata (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        ['last_refresh', new Date().toISOString()]
      )

      logger.info('Player cache refresh completed successfully')
    } catch (error) {
      logger.error('Error refreshing player cache:', error)
      throw error
    } finally {
      this.isRefreshing = false
    }
  }

  async getAllPlayers() {
    try {
      const result = await database.get('SELECT data FROM players WHERE id = ?', ['all_players'])
      
      if (!result) {
        logger.warn('No cached players found, triggering refresh')
        await this.refreshPlayerCache()
        const newResult = await database.get('SELECT data FROM players WHERE id = ?', ['all_players'])
        return newResult ? JSON.parse(newResult.data) : {}
      }

      return JSON.parse(result.data)
    } catch (error) {
      logger.error('Error getting cached players:', error)
      throw new Error('Failed to retrieve cached players')
    }
  }

  async getTrendingPlayers(type = 'add') {
    try {
      const validTypes = ['add', 'drop']
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid trending type: ${type}. Must be 'add' or 'drop'`)
      }

      const result = await database.get(
        'SELECT data FROM trending_players WHERE id = ?', 
        [`trending_${type}`]
      )
      
      if (!result) {
        logger.warn(`No cached trending ${type} players found, triggering refresh`)
        await this.refreshPlayerCache()
        const newResult = await database.get(
          'SELECT data FROM trending_players WHERE id = ?', 
          [`trending_${type}`]
        )
        return newResult ? JSON.parse(newResult.data) : []
      }

      return JSON.parse(result.data)
    } catch (error) {
      logger.error(`Error getting cached trending ${type} players:`, error)
      throw new Error(`Failed to retrieve cached trending ${type} players`)
    }
  }

  async getLastRefreshTime() {
    try {
      const result = await database.get(
        'SELECT value FROM cache_metadata WHERE key = ?', 
        ['last_refresh']
      )
      return result ? result.value : null
    } catch (error) {
      logger.error('Error getting last refresh time:', error)
      return null
    }
  }

  async getCacheStatus() {
    try {
      const lastRefresh = await this.getLastRefreshTime()
      const playersCount = await database.get(
        'SELECT LENGTH(data) as size FROM players WHERE id = ?', 
        ['all_players']
      )
      const trendingAddCount = await database.get(
        'SELECT LENGTH(data) as size FROM trending_players WHERE id = ?', 
        ['trending_add']
      )
      const trendingDropCount = await database.get(
        'SELECT LENGTH(data) as size FROM trending_players WHERE id = ?', 
        ['trending_drop']
      )

      return {
        lastRefresh,
        isRefreshing: this.isRefreshing,
        playersDataSize: playersCount?.size || 0,
        trendingAddDataSize: trendingAddCount?.size || 0,
        trendingDropDataSize: trendingDropCount?.size || 0,
        nextRefreshTime: this.getNextRefreshTime()
      }
    } catch (error) {
      logger.error('Error getting cache status:', error)
      throw new Error('Failed to retrieve cache status')
    }
  }

  getNextRefreshTime() {
    const now = moment().tz(this.timezone)
    const [hour, minute] = this.refreshTime.split(':')
    let nextRefresh = moment().tz(this.timezone).hour(hour).minute(minute).second(0)
    
    if (nextRefresh.isBefore(now)) {
      nextRefresh.add(1, 'day')
    }
    
    return nextRefresh.toISOString()
  }

  async forceRefresh() {
    logger.info('Force refresh requested')
    await this.refreshPlayerCache()
  }
}

module.exports = new CacheService()
