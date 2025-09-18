#!/bin/sh

# Substitute environment variables in nginx configuration
envsubst '${DOMAIN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Validate nginx configuration
nginx -t

# Execute the main command
exec "$@"
