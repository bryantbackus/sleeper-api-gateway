#!/usr/bin/env node

/**
 * Docker Setup Script for Sleeper API Middleware
 * 
 * This script prepares the environment for Docker deployment:
 * 1. Creates .env file with secure defaults
 * 2. Generates secure keys
 * 3. Prompts for essential configuration
 * 4. Sets up Docker environment
 * 5. Creates initial API key for access
 */

const fs = require('fs')
const crypto = require('crypto')
const readline = require('readline')
const { execSync } = require('child_process')

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

async function createEnvFile(config) {
  const envContent = `# Sleeper API Middleware Configuration
# Generated on ${new Date().toISOString()}

# Environment
NODE_ENV=${config.environment}
PORT=3000

# Security Keys (Auto-generated)
MASTER_KEY=${config.masterKey}

# Database Configuration
DATABASE_PATH=/app/data/database.sqlite

# Cache Configuration
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=${config.logLevel}

# Domain Configuration (for production)
DOMAIN=${config.domain || 'localhost'}

# SSL/HTTPS Configuration
ENABLE_SSL=${config.enableSsl || false}
SSL_EMAIL=${config.sslEmail || 'your-email@domain.com'}

# Optional: Disable caching for testing
# DISABLE_CACHE=false
`

  fs.writeFileSync('.env', envContent)
  console.log('✅ .env file created successfully')
}

async function createDockerEnvFile(config) {
  // Create a separate .env.docker file for Docker-specific variables
  const dockerEnvContent = `# Docker-specific environment variables
COMPOSE_PROJECT_NAME=sleeper-api-middleware
DOCKER_BUILDKIT=1

# Domain for SSL certificates (production)
DOMAIN=${config.domain || 'localhost'}

# Database volume path
DB_VOLUME_PATH=./data

# Logs volume path  
LOGS_VOLUME_PATH=./logs
`

  fs.writeFileSync('.env.docker', dockerEnvContent)
  console.log('✅ .env.docker file created successfully')
}

async function checkDockerInstallation() {
  try {
    execSync('docker --version', { stdio: 'ignore' })
    execSync('docker-compose --version', { stdio: 'ignore' })
    return true
  } catch (error) {
    return false
  }
}

async function createDirectories() {
  const dirs = ['data', 'logs', 'nginx/logs', 'nginx/ssl']
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`✅ Created directory: ${dir}`)
    }
  })
}

async function cleanupExistingContainers() {
  console.log('\n🧹 Cleaning up existing containers...')
  try {
    // Stop and remove existing containers
    execSync('docker-compose down', { stdio: 'ignore' })
    console.log('✅ Existing containers stopped and removed')
    return true
  } catch (error) {
    // Ignore errors if no containers exist
    console.log('ℹ️ No existing containers to clean up')
    return true
  }
}

async function buildDockerImages() {
  console.log('\n🔨 Building Docker images...')
  try {
    execSync('docker-compose build --no-cache', { stdio: 'inherit' })
    console.log('✅ Docker images built successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to build Docker images:', error.message)
    return false
  }
}

async function startDockerServices(_config) {
  console.log('\n🚀 Starting Docker services...')
  try {
    // Always start with basic services first (nginx will auto-detect SSL)
    const composeCommand = 'docker-compose up -d'
    console.log('🔄 Starting services with smart SSL detection')
    
    execSync(composeCommand, { stdio: 'inherit' })
    console.log('✅ Docker services started successfully')
    
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    
    return true
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error.message)
    return false
  }
}

async function createInitialAPIKey(config) {
  console.log('\n🔑 Creating initial API key...')
  
  try {
    // Use docker-compose exec to create API key inside running container
    const createKeyCommand = `docker-compose exec -T sleeper-api node -e "
      const database = require('./src/config/database');
      const crypto = require('crypto');
      
      async function createKey() {
        try {
          await database.connect();
          const apiKey = crypto.randomBytes(32).toString('hex');
          await database.createAPIKey(apiKey, 'admin-user', 'Initial admin API key');
          console.log('API_KEY=' + apiKey);
          process.exit(0);
        } catch (error) {
          console.error('Error:', error.message);
          process.exit(1);
        }
      }
      
      createKey();
    "`
    
    const result = execSync(createKeyCommand, { encoding: 'utf8' })
    const apiKeyMatch = result.match(/API_KEY=([a-f0-9]{64})/)
    
    if (apiKeyMatch) {
      const apiKey = apiKeyMatch[1]
      config.initialApiKey = apiKey
      console.log('✅ Initial API key created successfully')
      return apiKey
    } else {
      throw new Error('Failed to extract API key from output')
    }
  } catch (error) {
    console.error('❌ Failed to create initial API key:', error.message)
    console.log('💡 You can create an API key manually after deployment using:')
    console.log('   curl -X POST http://localhost/auth/dev-key')
    return null
  }
}

async function displaySummary(config) {
  console.log('\n' + '='.repeat(60))
  console.log('🎉 DOCKER DEPLOYMENT SETUP COMPLETE!')
  console.log('='.repeat(60))
  
  console.log('\n📋 Configuration Summary:')
  console.log(`   Environment: ${config.environment}`)
  console.log(`   Domain: ${config.domain || 'localhost'}`)
  console.log(`   Log Level: ${config.logLevel}`)
  console.log(`   User Management: Multi-user (configure via /profile endpoints)`)
  
  console.log('\n🔗 Service URLs:')
  
  const protocol = config.enableSsl ? 'https' : 'http'
  const domain = config.domain || 'localhost'
  
  console.log(`   API: ${protocol}://${domain}/`)
  console.log(`   Health Check: ${protocol}://${domain}/health`)
  console.log(`   API Documentation: ${protocol}://${domain}/`)
  
  if (config.enableSsl) {
    console.log(`\n🔒 SSL Certificate:`)
    console.log(`   Email: ${config.sslEmail}`)
    console.log(`   Domain: ${domain}`)
    console.log(`   Certificate will be auto-generated by Let's Encrypt`)
  }
  
  if (config.initialApiKey) {
    console.log('\n🔑 Initial API Key:')
    console.log(`   ${config.initialApiKey}`)
    console.log('\n💡 Save this API key securely - you\'ll need it to access the API!')
    console.log('   Test it with: curl -H "X-API-Key: YOUR_KEY" http://localhost/health')
  }
  
  console.log('\n🐳 Docker Commands:')
  console.log('   View logs: docker-compose logs -f')
  console.log('   Stop services: docker-compose down')
  console.log('   Restart: docker-compose restart')
  console.log('   Update: docker-compose pull && docker-compose up -d')
  
  console.log('\n📁 Important Files:')
  console.log('   .env - Environment configuration')
  console.log('   .env.docker - Docker-specific variables')
  console.log('   docker-compose.yml - Service definitions')
  console.log('   data/ - Database and persistent data')
  console.log('   logs/ - Application logs')
}

async function main() {
  console.log('🐳 Sleeper API Middleware - Docker Setup')
  console.log('=========================================\n')
  
  // Check Docker installation
  if (!await checkDockerInstallation()) {
    console.error('❌ Docker or Docker Compose not found!')
    console.error('Please install Docker Desktop or Docker Engine + Docker Compose')
    process.exit(1)
  }
  console.log('✅ Docker installation detected')
  
  // Gather configuration
  const config = {}
  
  console.log('\n📝 Configuration Setup:')
  
  config.environment = await prompt('Environment (development/production)', 'production')
  config.domain = await prompt('Domain name (for SSL and external access)', 'localhost')
  config.logLevel = await prompt('Log level (error/warn/info/debug)', 'info')
  
  // SSL Configuration
  if (config.domain && config.domain !== 'localhost') {
    console.log('\n🔒 SSL/HTTPS Configuration:')
    const enableSsl = await prompt('Enable SSL/HTTPS with Let\'s Encrypt? (y/n)', 'y')
    config.enableSsl = enableSsl.toLowerCase() === 'y' || enableSsl.toLowerCase() === 'yes'
    
    if (config.enableSsl) {
      config.sslEmail = await prompt('Email for SSL certificate (required by Let\'s Encrypt)')
      while (!config.sslEmail || !config.sslEmail.includes('@')) {
        console.log('❌ Valid email required for SSL certificate')
        config.sslEmail = await prompt('Email for SSL certificate')
      }
    }
  } else {
    config.enableSsl = false
  }
  
  // Generate secure keys
  console.log('\n🔐 Generating secure keys...')
  config.masterKey = generateSecureKey()
  console.log('✅ Security keys generated')
  
  // Create directories
  console.log('\n📁 Creating directories...')
  await createDirectories()
  
  // Create configuration files
  console.log('\n⚙️ Creating configuration files...')
  await createEnvFile(config)
  await createDockerEnvFile(config)
  
  // Clean up existing containers
  await cleanupExistingContainers()
  
  // Build and start Docker services
  const buildSuccess = await buildDockerImages()
  if (!buildSuccess) {
    console.error('❌ Setup failed during Docker build')
    process.exit(1)
  }
  
  const startSuccess = await startDockerServices(config)
  if (!startSuccess) {
    console.error('❌ Setup failed during Docker startup')
    process.exit(1)
  }
  
  // Create initial API key
  await createInitialAPIKey(config)
  
  // SSL setup integration
  if (config.enableSsl && config.domain !== 'localhost') {
    console.log('\n🔒 SSL Certificate Setup:')
    const runSslSetup = await prompt('Run SSL certificate setup now? (y/n)', 'y')
    if (runSslSetup.toLowerCase() === 'y' || runSslSetup.toLowerCase() === 'yes') {
      try {
        console.log('🔄 Running SSL setup script...')
        execSync('chmod +x scripts/ssl-setup.sh', { stdio: 'inherit' })
        execSync('./scripts/ssl-setup.sh', { stdio: 'inherit' })
      } catch (error) {
        console.log('⚠️ SSL setup encountered an issue. You can run it manually later:')
        console.log('   chmod +x scripts/ssl-setup.sh')
        console.log('   ./scripts/ssl-setup.sh')
      }
    } else {
      console.log('📝 SSL setup skipped. Run later with:')
      console.log('   chmod +x scripts/ssl-setup.sh')
      console.log('   ./scripts/ssl-setup.sh')
    }
  }
  
  // Display summary
  await displaySummary(config)
  
  rl.close()
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Unexpected error:', error.message)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\n\n⚠️ Setup interrupted by user')
  rl.close()
  process.exit(0)
})

// Run setup
main().catch(error => {
  console.error('❌ Setup failed:', error.message)
  process.exit(1)
})
