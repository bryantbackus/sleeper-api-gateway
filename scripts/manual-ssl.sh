#!/bin/bash

echo "🔧 Manual SSL Certificate Generation"

# Ensure nginx is running in HTTP mode
echo "📋 Step 1: Ensuring nginx is running in HTTP mode..."
ENABLE_SSL=false docker-compose up -d nginx
sleep 5

# Test that nginx is accessible
echo "🧪 Step 2: Testing nginx accessibility..."
if curl -s -o /dev/null -w "%{http_code}" http://api.sleeper.bryantback.us/health | grep -q "200\|404"; then
    echo "✅ Nginx is accessible from internet"
else
    echo "❌ Nginx not accessible. Check DNS and firewall settings."
    exit 1
fi

# Test ACME challenge path
echo "🧪 Step 3: Testing ACME challenge path..."
docker-compose exec nginx sh -c 'echo "test" > /var/www/certbot/test-file'
if curl -s http://api.sleeper.bryantback.us/.well-known/acme-challenge/test-file | grep -q "test"; then
    echo "✅ ACME challenge path is working"
    docker-compose exec nginx rm /var/www/certbot/test-file
else
    echo "❌ ACME challenge path not working"
    exit 1
fi

# Run certbot with detailed logging
echo "🔐 Step 4: Running certbot with detailed logging..."
docker-compose --profile production run --rm certbot \
    certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${SSL_EMAIL:-admin@yourdomain.com}" \
    --agree-tos \
    --no-eff-email \
    --verbose \
    --keep-until-expiring \
    --expand \
    -d api.sleeper.bryantback.us

# Check if certificates were created
echo "📋 Step 5: Checking certificate generation..."
if docker-compose exec nginx ls /etc/letsencrypt/live/api.sleeper.bryantback.us/ 2>/dev/null | grep -q "fullchain.pem"; then
    echo "✅ Certificates generated successfully!"
    
    # Start nginx with SSL
    echo "🔒 Step 6: Starting nginx with SSL..."
    ENABLE_SSL=true docker-compose --profile production up -d
    
    echo "🎉 SSL setup complete!"
    echo "🔗 Your API is available at: https://api.sleeper.bryantback.us/"
    
else
    echo "❌ Certificate generation failed"
    echo "📋 Checking certbot logs..."
    docker-compose logs certbot
    exit 1
fi
