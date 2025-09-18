const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')

class Database {
  constructor() {
    this.db = null
    this.dbPath = process.env.DATABASE_PATH || './data/database.sqlite'
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err)
          reject(err)
        } else {
          console.log('Connected to SQLite database')
          this.configureDatabase()
            .then(() => this.initializeTables())
            .then(() => resolve())
            .catch(reject)
        }
      })
    })
  }

  async configureDatabase() {
    // Enable WAL mode for better performance and concurrency
    await this.run('PRAGMA journal_mode = WAL')
    
    // Set synchronous mode to NORMAL for better performance
    await this.run('PRAGMA synchronous = NORMAL')
    
    // Set cache size (negative value = KB, positive = pages)
    await this.run('PRAGMA cache_size = -64000') // 64MB cache
    
    // Enable foreign key constraints
    await this.run('PRAGMA foreign_keys = ON')
    
    console.log('Database configured with WAL mode and performance optimizations')
  }

  async initializeTables() {
    const createTables = [
      `CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS trending_players (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cache_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        active INTEGER DEFAULT 1
      )`
    ]

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_players_updated_at ON players(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_trending_players_type ON trending_players(type)',
      'CREATE INDEX IF NOT EXISTS idx_trending_players_updated_at ON trending_players(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_cache_metadata_updated_at ON cache_metadata(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active)',
      'CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used)'
    ]

    // Execute table creation with proper error handling
    for (const sql of createTables) {
      try {
        await this.run(sql)
      } catch (error) {
        console.error('Error creating table:', error)
        throw error
      }
    }

    // Execute index creation with proper error handling
    for (const sql of createIndexes) {
      try {
        await this.run(sql)
      } catch (error) {
        console.error('Error creating index:', error)
        throw error
      }
    }

    console.log('Database tables and indexes created successfully')
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve({ id: this.lastID })
        }
      })
    })
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err)
          } else {
            console.log('Database connection closed')
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }

  // API Key management methods
  async createAPIKey(key, userId, description = null) {
    const sql = 'INSERT INTO api_keys (key, user_id, description) VALUES (?, ?, ?)'
    return this.run(sql, [key, userId, description])
  }

  async getAPIKey(key) {
    const sql = 'SELECT * FROM api_keys WHERE key = ? AND active = 1'
    return this.get(sql, [key])
  }

  async updateAPIKeyLastUsed(key) {
    const sql = 'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE key = ?'
    return this.run(sql, [key])
  }

  async getAllAPIKeys() {
    const sql = 'SELECT key, user_id, description, created_at, last_used, active FROM api_keys ORDER BY created_at DESC'
    return this.all(sql)
  }

  async revokeAPIKey(keyPrefix) {
    const sql = 'UPDATE api_keys SET active = 0 WHERE key LIKE ? AND active = 1'
    return this.run(sql, [`${keyPrefix}%`])
  }

  async cleanupInactiveKeys(daysOld = 90) {
    const sql = 'DELETE FROM api_keys WHERE active = 0 AND created_at < datetime("now", "-" || ? || " days")'
    return this.run(sql, [daysOld])
  }
}

module.exports = new Database()
