#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function prompt(question, defaultValue = '') {
  return new Promise((resolve) => {
    const displayDefault = defaultValue ? ` [${defaultValue}]` : ''
    rl.question(question + displayDefault + ': ', (answer) => {
      resolve(answer.trim() || defaultValue)
    })
  })
}

function generateSecureKey() {
  return crypto.randomBytes(32).toString('hex')
}

function generateAPIKey() {
  return crypto.randomBytes(32).toString('hex')
}

async function createEnvFile(config) {
  const envContent = `# Server Configuration
NODE_ENV=${config.nodeEnv}
PORT=${config.port}

# Security Keys (auto-generated)
MASTER_KEY=${config.masterKey}

# Sleeper Configuration
SLEEPER_BASE_URL=https://api.sleeper.app/v1

# Database & Cache
DATABASE_PATH=./data/database.sqlite
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=info

# Optional: Disable caching for testing
# DISABLE_CACHE=false
`

  const envPath = path.join(__dirname, '..', '.env')
  fs.writeFileSync(envPath, envContent)
  
  console.log('✅ Created .env file')
  return envPath
}

async function saveAPIKeyReference(apiKey, userId, description) {
  const apiKeysPath = path.join(__dirname, '..', 'data', 'api-keys.json')
  
  // Ensure data directory exists
  const dataDir = path.dirname(apiKeysPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const keyData = {
    createdAt: new Date().toISOString(),
    apiKey: apiKey,
    userId: userId,
    description: description,
    usage: {
      header: `X-API-Key: ${apiKey}`,
      query: `?api_key=${apiKey}`
    },
    warning: 'This is your only copy of this API key. Store it securely!'
  }

  fs.writeFileSync(apiKeysPath, JSON.stringify(keyData, null, 2))
  console.log('✅ Saved API key reference to data/api-keys.json')
  
  return apiKeysPath
}

function displayInstructions(config, apiKey) {
  console.log('\n' + '='.repeat(60))
  console.log('🎉 SETUP COMPLETE!')
  console.log('='.repeat(60))
  
  console.log('\n📋 Your Configuration:')
  console.log(`   Port: ${config.port}`)
  console.log(`   Environment: ${config.nodeEnv}`)
  console.log(`   User Management: Multi-user (configure via /profile endpoints)`)
  
  console.log('\n🔑 Your API Key:')
  console.log(`   ${apiKey}`)
  console.log('   ⚠️  SAVE THIS KEY - YOU WON\'T SEE IT AGAIN!')
  
  console.log('\n🚀 Start the Server:')
  console.log('   npm start                    # Production mode')
  console.log('   npm run dev                  # Development mode')
  console.log('   docker-compose up -d         # Docker production')
  
  console.log('\n🧪 Test Your Setup:')
  console.log('   # Health check (no auth required)')
  console.log(`   curl http://localhost:${config.port}/health`)
  console.log('')
  console.log('   # Test with your API key')
  console.log(`   curl -H "X-API-Key: ${apiKey}" \\`)
  console.log(`     http://localhost:${config.port}/sleeper/state/nfl`)
  console.log('')
  console.log('   # Search for a player')
  console.log(`   curl -H "X-API-Key: ${apiKey}" \\`)
  console.log(`     "http://localhost:${config.port}/players/search/name?q=mahomes"`)
  
  console.log('\n📚 Useful Endpoints:')
  console.log(`   GET  /health                           # Health check`)
  console.log(`   GET  /                                 # API documentation`)
  console.log(`   GET  /sleeper/leagues/nfl/2024         # Your leagues`)
  console.log(`   GET  /players/nfl                      # All players (cached)`)
  console.log(`   GET  /players/nfl/trending/add         # Trending adds`)
  console.log(`   GET  /cache/stats                      # Cache statistics`)
  
  console.log('\n🔧 Cache Management:')
  console.log(`   GET  /cache/stats                      # View cache stats`)
  console.log(`   POST /cache/clear                      # Clear cache`)
  console.log(`   POST /cache/clear?pattern=players      # Clear specific cache`)
  
  console.log('\n🗝️  API Key Management (requires master key):')
  console.log(`   # Create new API key`)
  console.log(`   curl -X POST -H "X-Master-Key: ${config.masterKey}" \\`)
  console.log(`     -H "Content-Type: application/json" \\`)
  console.log(`     -d '{"userId":"your-username","description":"My second key"}' \\`)
  console.log(`     http://localhost:${config.port}/auth/create-key`)
  
  console.log('\n📁 Important Files:')
  console.log('   .env                    # Your configuration')
  console.log('   data/api-keys.json      # Your API key backup')
  console.log('   data/database.sqlite    # Local cache database')
  console.log('   data/combined.log       # Application logs')
  
  console.log('\n🆘 Need Help?')
  console.log('   - Check logs: tail -f data/combined.log')
  console.log('   - View cache: GET /cache/stats')
  console.log('   - Clear cache: POST /cache/clear')
  console.log('   - Documentation: GET /')
  
  console.log('\n' + '='.repeat(60))
}

async function main() {
  console.log('🏈 Sleeper API Middleware Setup')
  console.log('=' .repeat(40))
  console.log('\nThis will create your .env file and generate your first API key.')
  console.log('The setup takes less than 2 minutes!\n')

  try {
    // Check if .env already exists
    const envPath = path.join(__dirname, '..', '.env')
    if (fs.existsSync(envPath)) {
      const overwrite = await prompt('⚠️  .env file already exists. Overwrite?', 'N')
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Setup cancelled. Your existing configuration is preserved.')
        rl.close()
        return
      }
    }

    console.log('\n📝 Basic Configuration:')
    
    const config = {}
    config.nodeEnv = await prompt('Environment (development/production)', 'production')
    config.port = await prompt('Server port', '3000')
    
    console.log('\n🏈 Multi-User Setup:')
    console.log('Sleeper accounts are configured per user after deployment.')
    console.log('Each user will set their own Sleeper credentials via /profile endpoints.')

    console.log('\n🔐 Generating Security Keys...')
    config.masterKey = generateSecureKey()
    console.log('✅ Security keys generated')

    // Create .env file
    await createEnvFile(config)

    // Generate first API key
    console.log('\n🗝️  Generating your first API key...')
    const apiKey = generateAPIKey()
    const description = 'Initial setup key'
    
    // Save API key reference
    await saveAPIKeyReference(apiKey, 'admin-user', description)

    // Display completion instructions
    displayInstructions(config, apiKey)

    console.log('\n🎯 Next Steps:')
    console.log('1. Save your API key somewhere secure')
    console.log('2. Run: npm install (if you haven\'t already)')
    console.log('3. Run: npm start')
    console.log('4. Test the health endpoint')
    console.log('5. Start building your fantasy football AI! 🤖')

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.error('Please try running the setup again.')
  } finally {
    rl.close()
  }
}

// Handle CLI arguments
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Sleeper API Middleware Setup Script

Usage:
  node scripts/manage.js          # Interactive setup
  npm run setup                   # Same as above
  npm run quick-start            # Setup + install + start

Options:
  --help, -h                     # Show this help message

This script will:
1. Create your .env configuration file
2. Generate secure master key and JWT secret
3. Generate your first API key
4. Save API key reference for backup
5. Show you how to test everything

The entire setup takes less than 2 minutes!
`)
  process.exit(0)
}

// Run the setup
main().catch(console.error)
