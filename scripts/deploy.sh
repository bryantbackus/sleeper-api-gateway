#!/bin/bash

# Sleeper API Middleware Deployment Script
set -e

echo "🚀 Deploying Sleeper API Middleware"
echo "==================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run 'npm run setup' first."
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$DOMAIN" ]; then
    echo "❌ DOMAIN not set in .env file"
    exit 1
fi

# Production deployment
echo "📦 Building and starting production containers..."

# Stop existing containers
docker-compose down

# Build and start services
docker-compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check health
echo "🏥 Checking service health..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Service is healthy!"
else
    echo "❌ Service health check failed"
    echo "📋 Container logs:"
    docker-compose logs --tail=20
    exit 1
fi

# SSL Certificate setup (if in production)
if [ "$NODE_ENV" = "production" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "🔒 Setting up SSL certificates..."
    
    # Create SSL directory
    mkdir -p nginx/ssl
    
    # Generate self-signed certificate for testing (replace with real certificates)
    if [ ! -f "nginx/ssl/cert.pem" ]; then
        echo "⚠️  Generating self-signed certificate for testing..."
        echo "   Replace with real certificates from Let's Encrypt or your CA"
        
        openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
        
        # Restart nginx to load certificates
        docker-compose restart nginx
    fi
fi

echo "🎉 Deployment complete!"
echo ""
echo "📡 Service URLs:"
echo "   Health: http://localhost/health"
echo "   API Docs: http://localhost/"

if [ "$DOMAIN" != "localhost" ]; then
    echo "   Production: https://$DOMAIN"
    echo "   API: https://api.$DOMAIN"
fi

echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart: docker-compose restart"
