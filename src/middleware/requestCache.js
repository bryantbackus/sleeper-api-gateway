const logger = require('../config/logger')

class RequestCache {
  constructor() {
    this.cache = new Map()
    this.maxSize = 1000
    this.cleanupInterval = 60 * 1000 // 1 minute
    
    // Start cleanup timer (store reference for cleanup)
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), this.cleanupInterval)
    
    logger.info('Request cache initialized', { 
      maxSize: this.maxSize,
      cleanupInterval: this.cleanupInterval 
    })
  }

  // Generate cache key from request
  generateCacheKey(req) {
    const userId = req.user?.id || 'anonymous'
    const method = req.method
    const path = req.path
    const query = JSON.stringify(req.query)
    
    return `${method}:${path}:${query}:${userId}`
  }

  // Get TTL based on endpoint
  getTTL(path) {
    // Different TTLs for different endpoints (in milliseconds)
    if (path.includes('/players/nfl') || path.includes('/players/search')) {
      return 30 * 60 * 1000 // 30 minutes for player data
    }
    
    if (path.includes('/league/') && (path.includes('/rosters') || path.includes('/users'))) {
      return 10 * 60 * 1000 // 10 minutes for league data
    }
    
    if (path.includes('/matchups/') || path.includes('/transactions')) {
      return 2 * 60 * 1000 // 2 minutes for matchups/transactions
    }
    
    if (path.includes('/state/nfl')) {
      return 1 * 60 * 1000 // 1 minute for NFL state
    }
    
    // Default TTL for other endpoints
    return 5 * 60 * 1000 // 5 minutes
  }

  // Check if response should be cached
  shouldCache(req, res) {
    // Only cache GET requests
    if (req.method !== 'GET') return false
    
    // Only cache successful responses
    if (res.statusCode !== 200) return false
    
    // Don't cache auth endpoints
    if (req.path.startsWith('/auth/')) return false
    
    // Don't cache health endpoints
    if (req.path === '/health') return false
    
    return true
  }

  // Get cached response
  get(key) {
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    // Update access time for LRU
    cached.lastAccessed = Date.now()
    return cached.data
  }

  // Store response in cache
  set(key, data, ttl) {
    // Implement simple LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }
    
    const expiresAt = Date.now() + ttl
    this.cache.set(key, {
      data,
      expiresAt,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    })
  }

  // Evict least recently used item
  evictLRU() {
    let oldestKey = null
    let oldestTime = Date.now()
    
    for (const [key, value] of this.cache) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey)
      logger.debug('Evicted LRU cache entry:', { key: oldestKey })
    }
  }

  // Clean up expired entries
  cleanupExpired() {
    const now = Date.now()
    let cleanedCount = 0
    
    for (const [key, value] of this.cache) {
      if (now > value.expiresAt) {
        this.cache.delete(key)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired cache entries:', { 
        count: cleanedCount, 
        remaining: this.cache.size 
      })
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    let expiredCount = 0
    
    for (const value of this.cache.values()) {
      if (now > value.expiresAt) {
        expiredCount++
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredCount,
      activeCount: this.cache.size - expiredCount
    }
  }

  // Clear all cache
  clear() {
    const size = this.cache.size
    this.cache.clear()
    logger.info('Cache cleared:', { entriesRemoved: size })
  }

  // Clear cache by pattern
  clearByPattern(pattern) {
    let cleared = 0
    
    // Validate cache exists
    if (!this.cache || typeof this.cache.keys !== 'function') {
      logger.error('Cache not initialized or invalid')
      throw new Error('Cache not available')
    }
    
    // Create flexible pattern matcher
    const isMatch = pattern instanceof RegExp
      ? (key) => pattern.test(key)
      : (key) => key.includes(String(pattern))
    
    try {
      for (const key of this.cache.keys()) {
        try {
          if (isMatch(key)) {
            this.cache.delete(key)
            cleared++
          }
        } catch (deleteError) {
          logger.warn('Failed to delete cache key:', {
            key,
            error: deleteError.message
          })
          // Continue with other keys
        }
      }
    } catch (iterationError) {
      logger.error('Error iterating cache keys:', {
        error: iterationError.message
      })
      throw new Error('Cache iteration failed')
    }
    
    logger.info('Cache cleared by pattern:', { 
      pattern: pattern.toString(), 
      entriesRemoved: cleared 
    })
    return cleared
  }

  // Stop cleanup timer (for testing cleanup)
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      logger.info('Cache cleanup timer stopped')
    }
  }
}

// Create singleton instance
const requestCache = new RequestCache()

// Middleware function
const smartCache = (req, res, next) => {
  // Skip if caching is disabled
  if (process.env.DISABLE_CACHE === 'true') {
    return next()
  }

  const cacheKey = requestCache.generateCacheKey(req)
  
  // Try to get cached response
  const cached = requestCache.get(cacheKey)
  if (cached) {
    logger.debug('Cache hit:', { 
      key: cacheKey.substring(0, 50) + '...',
      path: req.path 
    })
    
    // Set cache headers
    res.set('X-Cache', 'HIT')
    res.set('X-Cache-Key', cacheKey.substring(0, 32) + '...')
    
    return res.json(cached)
  }

  // Cache miss - proceed with request
  logger.debug('Cache miss:', { 
    key: cacheKey.substring(0, 50) + '...',
    path: req.path 
  })

  // Override res.json to cache successful responses
  const originalJson = res.json
  res.json = function(data) {
    // Check if we should cache this response
    if (requestCache.shouldCache(req, res)) {
      const ttl = requestCache.getTTL(req.path)
      requestCache.set(cacheKey, data, ttl)
      
      logger.debug('Response cached:', {
        key: cacheKey.substring(0, 50) + '...',
        ttl: ttl / 1000 + 's',
        path: req.path
      })
      
      // Set cache headers
      res.set('X-Cache', 'MISS')
      res.set('X-Cache-TTL', ttl.toString())
    } else {
      res.set('X-Cache', 'SKIP')
    }
    
    res.set('X-Cache-Key', cacheKey.substring(0, 32) + '...')
    
    // Call original json method
    return originalJson.call(this, data)
  }

  next()
}

// Cache management endpoints middleware
const cacheStats = (req, res) => {
  const stats = requestCache.getStats()
  res.json({
    success: true,
    cache: stats,
    message: 'Cache statistics retrieved successfully'
  })
}

const clearCache = (req, res) => {
  const pattern = req.query.pattern
  
  if (pattern) {
    const cleared = requestCache.clearByPattern(pattern)
    res.json({
      success: true,
      message: `Cache cleared by pattern: ${pattern}`,
      entriesRemoved: cleared
    })
  } else {
    requestCache.clear()
    res.json({
      success: true,
      message: 'All cache cleared successfully'
    })
  }
}

module.exports = {
  smartCache,
  cacheStats,
  clearCache,
  requestCache
}
