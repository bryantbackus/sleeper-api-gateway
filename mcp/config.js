export const CONFIG = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  NODE_ENV: process.env.NODE_ENV || 'development',

  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  HTTP_PORT: parseInt(process.env.HTTP_PORT) || 3001,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 600,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
  SESSION_TTL: parseInt(process.env.SESSION_TTL) || 86400, // 24 hours
  ENABLE_DNS_REBINDING: process.env.NODE_ENV === 'production' ? false : true,

  // MCP Response Limit
  RESPONSE_LIMIT: parseInt(process.env.RESPONSE_LIMIT) || 15,
  
  // MCP Rate Limiting
  MCP_RATE_LIMIT_WINDOW: parseInt(process.env.MCP_RATE_LIMIT_WINDOW) || 60000, // 1 minute
  MCP_UNAUTHENTICATED_LIMIT: parseInt(process.env.MCP_UNAUTHENTICATED_LIMIT) || 50,
  MCP_AUTHENTICATED_LIMIT: parseInt(process.env.MCP_AUTHENTICATED_LIMIT) || 200
}