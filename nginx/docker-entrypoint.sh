#!/bin/sh

# Create nginx configuration based on SSL settings
if [ "${ENABLE_SSL}" = "true" ]; then
    echo "🔒 SSL enabled - using HTTPS configuration"
    envsubst '${DOMAIN}' < /etc/nginx/nginx-ssl.conf.template > /etc/nginx/nginx.conf
else
    echo "🔓 SSL disabled - using HTTP-only configuration"
    envsubst '${DOMAIN}' < /etc/nginx/nginx-http.conf.template > /etc/nginx/nginx.conf
fi

# Validate nginx configuration
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration validation failed"
    exit 1
fi

# Execute the main command
exec "$@"
