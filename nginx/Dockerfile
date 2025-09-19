FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx configuration templates
COPY nginx-ssl.conf.template /etc/nginx/nginx-ssl.conf.template
COPY nginx-http.conf.template /etc/nginx/nginx-http.conf.template

# Create directories for SSL certificates and static files
RUN mkdir -p /etc/nginx/ssl /var/www/certbot

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
