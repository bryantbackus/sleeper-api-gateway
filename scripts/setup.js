#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

async function setup() {
  console.log('🚀 Sleeper API Middleware Setup')
  console.log('=====================================\n')

  // Check if .env already exists
  const envPath = path.join(__dirname, '..', '.env')
  if (fs.existsSync(envPath)) {
    const overwrite = await prompt('.env file already exists. Overwrite? (y/N): ')
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.')
      rl.close()
      return
    }
  }

  const config = {}

  // Basic configuration
  console.log('\n📝 Basic Configuration')
  config.NODE_ENV = await prompt('Environment (development/production) [development]: ') || 'development'
  config.PORT = await prompt('Server port [3000]: ') || '3000'
  config.DOMAIN = await prompt('Domain name (e.g., example.com): ')

  // OAuth Configuration
  console.log('\n🔐 OAuth 2.0 Configuration')
  console.log('If you don\'t have OAuth credentials yet, you can leave these blank and set them later.')
  config.OAUTH_CLIENT_ID = await prompt('OAuth Client ID: ')
  config.OAUTH_CLIENT_SECRET = await prompt('OAuth Client Secret: ')
  config.JWT_SECRET = await prompt('JWT Secret (leave blank to generate): ')

  if (!config.JWT_SECRET) {
    config.JWT_SECRET = require('crypto').randomBytes(64).toString('hex')
    console.log('✅ Generated JWT secret')
  }

  // Sleeper Configuration
  console.log('\n🏈 Sleeper Configuration')
  config.DEFAULT_USER_ID = await prompt('Your Sleeper User ID: ')
  config.DEFAULT_USERNAME = await prompt('Your Sleeper Username: ')

  // Generate redirect URI
  if (config.DOMAIN) {
    config.OAUTH_REDIRECT_URI = `https://api.${config.DOMAIN}/auth/callback`
    config.API_BASE_URL = `https://api.${config.DOMAIN}`
  } else {
    config.OAUTH_REDIRECT_URI = `http://localhost:${config.PORT}/auth/callback`
    config.API_BASE_URL = `http://localhost:${config.PORT}`
  }

  // Set other defaults
  config.SLEEPER_BASE_URL = 'https://api.sleeper.app/v1'
  config.DATABASE_PATH = './data/database.sqlite'
  config.CACHE_REFRESH_TIME = '06:00'
  config.CACHE_TIMEZONE = 'America/New_York'
  config.LOG_LEVEL = 'info'

  // Write .env file
  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  fs.writeFileSync(envPath, envContent)

  console.log('\n✅ Configuration saved to .env')
  console.log('\n📋 Next steps:')
  console.log('1. Review and update the .env file if needed')
  console.log('2. Set up OAuth 2.0 credentials with your OAuth provider')
  console.log('3. Run `npm install` to install dependencies')
  console.log('4. For development: `npm run dev`')
  console.log('5. For production: `docker-compose up -d`')

  if (!config.DEFAULT_USER_ID) {
    console.log('\n⚠️  Don\'t forget to set your Sleeper User ID in the .env file!')
    console.log('   You can find it by going to https://sleeper.app and checking the URL of your profile.')
  }

  rl.close()
}

setup().catch(console.error)
