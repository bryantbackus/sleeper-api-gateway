#!/usr/bin/env node

/**
 * SSL Certificate Management Script
 * Handles SSL certificate generation, renewal, and management
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function showHelp() {
  console.log(`
🔒 SSL Certificate Manager

Usage: node scripts/ssl-manager.js [command]

Commands:
  generate     Generate initial SSL certificates
  renew        Renew existing SSL certificates
  status       Check certificate status
  disable      Disable SSL and switch to HTTP
  enable       Enable SSL (requires certificates)
  help         Show this help message

Examples:
  node scripts/ssl-manager.js generate
  node scripts/ssl-manager.js renew
  node scripts/ssl-manager.js status
`)
}

function checkEnvFile() {
  if (!fs.existsSync('.env')) {
    console.error('❌ .env file not found. Please run deployment setup first.')
    process.exit(1)
  }
}

function readEnvValue(key) {
  const envContent = fs.readFileSync('.env', 'utf8')
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : null
}

function updateEnvValue(key, value) {
  let envContent = fs.readFileSync('.env', 'utf8')
  const regex = new RegExp(`^${key}=.*$`, 'm')
  
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${key}=${value}`)
  } else {
    envContent += `\n${key}=${value}`
  }
  
  fs.writeFileSync('.env', envContent)
}

async function generateCertificates() {
  console.log('🔒 Generating SSL certificates...')
  
  const domain = readEnvValue('DOMAIN')
  const sslEmail = readEnvValue('SSL_EMAIL')
  
  if (!domain || domain === 'localhost') {
    console.error('❌ Valid domain required for SSL certificates')
    console.error('   Update DOMAIN in .env file to your actual domain')
    process.exit(1)
  }
  
  if (!sslEmail || !sslEmail.includes('@')) {
    console.error('❌ Valid email required for SSL certificates')
    console.error('   Update SSL_EMAIL in .env file')
    process.exit(1)
  }
  
  try {
    // Stop services
    console.log('⏸️ Stopping services...')
    execSync('docker-compose down', { stdio: 'inherit' })
    
    // Start with production profile (includes certbot)
    console.log('🚀 Starting services with SSL support...')
    execSync('docker-compose --profile production up -d', { stdio: 'inherit' })
    
    // Wait for nginx to be ready
    console.log('⏳ Waiting for services to be ready...')
    await new Promise(resolve => setTimeout(resolve, 15000))
    
    console.log('✅ SSL certificates generated successfully!')
    console.log(`📄 Certificates saved for domain: ${domain}`)
    
    // Update ENABLE_SSL to true
    updateEnvValue('ENABLE_SSL', 'true')
    console.log('✅ SSL enabled in configuration')
    
  } catch (error) {
    console.error('❌ Failed to generate SSL certificates:', error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Ensure your domain points to this server')
    console.error('2. Ensure ports 80 and 443 are open')
    console.error('3. Check Docker logs: docker-compose logs certbot')
  }
}

async function renewCertificates() {
  console.log('🔄 Renewing SSL certificates...')
  
  try {
    execSync('docker-compose exec certbot certbot renew', { stdio: 'inherit' })
    execSync('docker-compose restart nginx', { stdio: 'inherit' })
    console.log('✅ SSL certificates renewed successfully!')
  } catch (error) {
    console.error('❌ Failed to renew certificates:', error.message)
  }
}

async function checkStatus() {
  console.log('📊 SSL Certificate Status\n')
  
  const domain = readEnvValue('DOMAIN')
  const sslEnabled = readEnvValue('ENABLE_SSL')
  const sslEmail = readEnvValue('SSL_EMAIL')
  
  console.log(`Domain: ${domain}`)
  console.log(`SSL Enabled: ${sslEnabled}`)
  console.log(`SSL Email: ${sslEmail}`)
  
  // Check if certificates exist
  const certPath = `./nginx/ssl/live/${domain}`
  if (fs.existsSync(certPath)) {
    console.log(`\n✅ Certificates found at: ${certPath}`)
    
    try {
      // Check certificate expiry
      const certInfo = execSync(`docker-compose exec nginx openssl x509 -in /etc/nginx/ssl/live/${domain}/cert.pem -text -noout | grep "Not After"`, { encoding: 'utf8' })
      console.log(`📅 ${certInfo.trim()}`)
    } catch (error) {
      console.log('⚠️ Could not read certificate expiry date')
    }
  } else {
    console.log('\n❌ No SSL certificates found')
  }
  
  // Check service status
  try {
    const services = execSync('docker-compose ps --format "table {{.Name}}\\t{{.State}}"', { encoding: 'utf8' })
    console.log('\n🐳 Docker Services:')
    console.log(services)
  } catch (error) {
    console.log('\n❌ Could not check Docker service status')
  }
}

async function disableSSL() {
  console.log('🔓 Disabling SSL...')
  
  updateEnvValue('ENABLE_SSL', 'false')
  
  try {
    // Restart with HTTP only
    execSync('docker-compose down', { stdio: 'inherit' })
    execSync('docker-compose up -d', { stdio: 'inherit' })
    
    console.log('✅ SSL disabled - services running on HTTP only')
    console.log(`🔗 API available at: http://${readEnvValue('DOMAIN') || 'localhost'}/`)
  } catch (error) {
    console.error('❌ Failed to disable SSL:', error.message)
  }
}

async function enableSSL() {
  console.log('🔒 Enabling SSL...')
  
  const domain = readEnvValue('DOMAIN')
  const certPath = `./nginx/ssl/live/${domain}`
  
  if (!fs.existsSync(certPath)) {
    console.error('❌ SSL certificates not found')
    console.error('   Run: node scripts/ssl-manager.js generate')
    process.exit(1)
  }
  
  updateEnvValue('ENABLE_SSL', 'true')
  
  try {
    // Restart with SSL
    execSync('docker-compose down', { stdio: 'inherit' })
    execSync('docker-compose --profile production up -d', { stdio: 'inherit' })
    
    console.log('✅ SSL enabled')
    console.log(`🔗 API available at: https://${domain}/`)
  } catch (error) {
    console.error('❌ Failed to enable SSL:', error.message)
  }
}

async function main() {
  const command = process.argv[2]
  
  if (!command || command === 'help') {
    showHelp()
    return
  }
  
  checkEnvFile()
  
  switch (command) {
    case 'generate':
      await generateCertificates()
      break
    case 'renew':
      await renewCertificates()
      break
    case 'status':
      await checkStatus()
      break
    case 'disable':
      await disableSSL()
      break
    case 'enable':
      await enableSSL()
      break
    default:
      console.error(`❌ Unknown command: ${command}`)
      showHelp()
      process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ SSL Manager Error:', error.message)
  process.exit(1)
})
