#!/bin/bash

echo "🔧 Fixing SSL configuration..."

# Stop nginx to prevent conflicts
echo "⏸️ Stopping nginx container..."
docker-compose stop nginx

# Rebuild nginx with updated configuration
echo "🔨 Rebuilding nginx with fixed configuration..."
docker-compose build nginx

# Start nginx with SSL support
echo "🚀 Starting nginx with SSL..."
docker-compose --profile production up -d nginx

# Check nginx status
echo "📊 Checking nginx status..."
docker-compose ps nginx

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
docker-compose exec nginx nginx -t

echo "✅ SSL fix complete!"
echo ""
echo "🔗 Your API should now be available at:"
echo "   https://api.sleeper.bryantback.us/"
echo "   https://api.sleeper.bryantback.us/health"
