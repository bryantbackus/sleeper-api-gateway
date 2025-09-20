#!/bin/bash

# SSL Setup Script for Sleeper API Middleware
set -e

echo "🔒 SSL Certificate Setup for Sleeper API Middleware"
echo "=================================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run setup first."
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
    echo "❌ DOMAIN not set or set to localhost. Please update .env file."
    exit 1
fi

if [ -z "$SSL_EMAIL" ]; then
    echo "❌ SSL_EMAIL not set. Please update .env file."
    echo "   Set SSL_EMAIL=your-email@domain.com"
    exit 1
fi

echo "📋 Configuration:"
echo "   Domain: $DOMAIN"
echo "   Email: $SSL_EMAIL"

# Create SSL directory structure
echo "📁 Creating SSL directories..."
mkdir -p nginx/ssl/live/$DOMAIN
mkdir -p nginx/ssl/archive/$DOMAIN

# Step 1: Start with HTTP-only
echo "🚀 Step 1: Starting services with HTTP-only..."
docker-compose down
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Test HTTP connectivity
echo "🧪 Testing HTTP connectivity..."
if curl -f http://$DOMAIN/health > /dev/null 2>&1; then
    echo "✅ HTTP connectivity confirmed"
else
    echo "❌ HTTP connectivity failed. Check DNS and firewall settings."
    echo "💡 Debug with: curl -v http://$DOMAIN/health"
    exit 1
fi

# Step 2: Generate SSL certificates
echo "🔒 Step 2: Generating SSL certificates..."
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $SSL_EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ SSL certificates generated successfully!"
else
    echo "❌ SSL certificate generation failed"
    echo "💡 Common issues:"
    echo "   - DNS not pointing to this server"
    echo "   - Port 80 not accessible from internet"
    echo "   - Domain already has rate limit reached"
    exit 1
fi

# Step 3: Update environment to enable SSL
echo "⚙️ Step 3: Enabling SSL in configuration..."
if grep -q "ENABLE_SSL=" .env; then
    sed -i 's/ENABLE_SSL=.*/ENABLE_SSL=true/' .env
else
    echo "ENABLE_SSL=true" >> .env
fi

# Step 4: Restart with SSL enabled
echo "🔄 Step 4: Restarting services with SSL enabled..."
docker-compose down
docker-compose up -d

# Wait for restart
echo "⏳ Waiting for SSL restart..."
sleep 20

# Step 5: Test HTTPS connectivity
echo "🧪 Step 5: Testing HTTPS connectivity..."
if curl -f https://$DOMAIN/health > /dev/null 2>&1; then
    echo "✅ HTTPS connectivity confirmed!"
else
    echo "⚠️ HTTPS connectivity test failed, but certificates may still be working"
    echo "💡 Test manually: curl -v https://$DOMAIN/health"
fi

# Display summary
echo ""
echo "🎉 SSL Setup Complete!"
echo "======================"
echo ""
echo "🔗 Your API is now available at:"
echo "   https://$DOMAIN/"
echo "   https://$DOMAIN/health"
echo ""
echo "📜 Certificate Details:"
echo "   Location: nginx/ssl/live/$DOMAIN/"
echo "   Renewal: Automatic (every 12 hours)"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs: docker-compose logs nginx"
echo "   Renew certs: docker-compose run --rm certbot renew"
echo "   Check cert expiry: openssl x509 -in nginx/ssl/live/$DOMAIN/cert.pem -text -noout | grep 'Not After'"
