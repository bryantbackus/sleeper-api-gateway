export const CONFIG = {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
    LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
    HTTP_PORT: parseInt(process.env.HTTP_PORT) || 3001,
    CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
    NODE_ENV: process.env.NODE_ENV || 'development',
    CACHE_TTL: parseInt(process.env.CACHE_TTL) || 600,
    REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
    SESSION_TTL: parseInt(process.env.SESSION_TTL) || 86400, // 24 hours
    ENABLE_DNS_REBINDING: process.env.NODE_ENV === 'production' ? false : true
  }