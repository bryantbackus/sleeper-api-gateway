#!/bin/sh

# Check if SSL certificates exist
if [ -f "/etc/nginx/ssl/live/${DOMAIN}/fullchain.pem" ] && [ -f "/etc/nginx/ssl/live/${DOMAIN}/privkey.pem" ]; then
    echo "🔒 SSL certificates found - using HTTPS configuration"
    envsubst '${DOMAIN}' < /etc/nginx/nginx-ssl.conf.template > /etc/nginx/nginx.conf
else
    echo "🔓 No SSL certificates found - using HTTP-only configuration"
    envsubst '${DOMAIN}' < /etc/nginx/nginx-http.conf.template > /etc/nginx/nginx.conf
fi

# Validate nginx configuration
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration validation failed"
    # Fall back to HTTP-only if SSL config fails
    echo "🔄 Falling back to HTTP-only configuration"
    envsubst '${DOMAIN}' < /etc/nginx/nginx-http.conf.template > /etc/nginx/nginx.conf
    nginx -t
fi

# Execute the main command
exec "$@"
