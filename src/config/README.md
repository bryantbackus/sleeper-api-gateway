# Authentication Configuration Guide

This guide explains how to set up authentication for the Sleeper API Middleware. The system supports multiple authentication methods depending on your needs.

## 🔐 Authentication Overview

The middleware uses **OAuth 2.0** with **JWT tokens** for secure API access. You have several options:

1. **Development Mode** - Built-in token generation (easiest)
2. **Google OAuth** - Recommended for personal use
3. **GitHub OAuth** - Great for developer-focused applications
4. **Custom OAuth Provider** - Any OAuth 2.0 compatible service

## 🚀 Quick Start: Development Mode

For testing and development, use the built-in development token system:

### 1. Configure Environment
```env
NODE_ENV=development
JWT_SECRET=your-secret-key-here
```

### 2. Start the Server
```bash
npm run dev
```

### 3. Generate a Development Token
```bash
curl -X POST http://localhost:3000/auth/dev-token \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-sleeper-user-id",
    "username": "your-sleeper-username"
  }'
```

### 4. Use the Token
```bash
# Example API call with token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/sleeper/leagues/nfl/2024
```

**Note:** Development tokens are only available when `NODE_ENV=development`

## 🌐 Production Setup: Google OAuth

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Project name: "Sleeper Fantasy API" (or your choice)

### Step 2: Enable Required APIs

1. Navigate to "APIs & Services" → "Library"
2. Search for and enable:
   - **Google+ API** (legacy but works)
   - **Google Identity Services** (newer option)

### Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Configure the OAuth consent screen (if prompted):
   - Application name: "Sleeper Fantasy API"
   - User support email: Your email
   - Authorized domains: Your domain (if applicable)
4. Choose "Web application" as application type
5. Name: "Sleeper API Middleware"

### Step 4: Configure Redirect URIs

Add these authorized redirect URIs:

**Development:**
```
http://localhost:3000/auth/callback
```

**Production:**
```
https://api.yourdomain.com/auth/callback
https://yourdomain.com/auth/callback
```

### Step 5: Update Environment Variables

Add to your `.env` file:

```env
# Google OAuth Configuration
OAUTH_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=GOCSPX-your-secret-here
OAUTH_AUTHORIZATION_URL=https://accounts.google.com/oauth/authorize
OAUTH_TOKEN_URL=https://oauth2.googleapis.com/token
OAUTH_REDIRECT_URI=https://api.yourdomain.com/auth/callback

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
```

### Step 6: Test OAuth Flow

1. Start your server
2. Visit: `http://localhost:3000/auth/login`
3. Complete Google login
4. You'll be redirected to `/auth/callback` with your JWT token

## 🐙 Alternative: GitHub OAuth

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Settings → Developer settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in details:
   - **Application name:** "Sleeper API Middleware"
   - **Homepage URL:** `https://yourdomain.com`
   - **Authorization callback URL:** `https://api.yourdomain.com/auth/callback`

### Step 2: Configure Environment

```env
# GitHub OAuth Configuration
OAUTH_CLIENT_ID=your-github-client-id
OAUTH_CLIENT_SECRET=your-github-client-secret
OAUTH_AUTHORIZATION_URL=https://github.com/login/oauth/authorize
OAUTH_TOKEN_URL=https://github.com/login/oauth/access_token
OAUTH_REDIRECT_URI=https://api.yourdomain.com/auth/callback

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
```

## 🔧 Custom OAuth Provider

For other OAuth 2.0 providers (Auth0, Microsoft, etc.):

```env
# Custom OAuth Configuration
OAUTH_CLIENT_ID=your-provider-client-id
OAUTH_CLIENT_SECRET=your-provider-client-secret
OAUTH_AUTHORIZATION_URL=https://your-provider.com/oauth/authorize
OAUTH_TOKEN_URL=https://your-provider.com/oauth/token
OAUTH_REDIRECT_URI=https://api.yourdomain.com/auth/callback

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
```

## 🔑 JWT Secret Generation

### Secure JWT Secret
Generate a strong JWT secret:

```bash
# Node.js method
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL method
openssl rand -hex 64

# Or use online generator (not recommended for production)
```

### Environment Configuration
```env
JWT_SECRET=your-generated-64-character-hex-string-here
```

## 📋 Complete Environment Template

Here's a complete `.env` template with all auth options:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
DOMAIN=yourdomain.com
API_BASE_URL=https://api.yourdomain.com

# JWT Configuration (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-here

# Google OAuth (Choose this OR GitHub OR Custom)
OAUTH_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=GOCSPX-your-secret-here
OAUTH_AUTHORIZATION_URL=https://accounts.google.com/oauth/authorize
OAUTH_TOKEN_URL=https://oauth2.googleapis.com/token
OAUTH_REDIRECT_URI=https://api.yourdomain.com/auth/callback

# GitHub OAuth (Alternative to Google)
# OAUTH_CLIENT_ID=your-github-client-id
# OAUTH_CLIENT_SECRET=your-github-client-secret
# OAUTH_AUTHORIZATION_URL=https://github.com/login/oauth/authorize
# OAUTH_TOKEN_URL=https://github.com/login/oauth/access_token
# OAUTH_REDIRECT_URI=https://api.yourdomain.com/auth/callback

# Sleeper Configuration
SLEEPER_BASE_URL=https://api.sleeper.app/v1
DEFAULT_USER_ID=your-sleeper-user-id
DEFAULT_USERNAME=your-sleeper-username

# Database & Cache
DATABASE_PATH=./data/database.sqlite
CACHE_REFRESH_TIME=06:00
CACHE_TIMEZONE=America/New_York

# Logging
LOG_LEVEL=info
```

## 🧪 Testing Authentication

### 1. Health Check (No Auth Required)
```bash
curl http://localhost:3000/health
```

### 2. Protected Endpoint Test
```bash
# This should return 401 without token
curl http://localhost:3000/sleeper/leagues/nfl/2024

# This should work with valid token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/sleeper/leagues/nfl/2024
```

### 3. Token Validation
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/auth/validate
```

## 🔒 Security Best Practices

### JWT Secret
- **Length:** Minimum 32 characters, recommended 64+
- **Randomness:** Use cryptographically secure random generation
- **Storage:** Never commit to version control
- **Rotation:** Change periodically in production

### OAuth Configuration
- **HTTPS Only:** Always use HTTPS in production
- **Redirect URI Validation:** Exact match required
- **Scope Limitation:** Request minimal necessary scopes
- **State Parameter:** Use for CSRF protection (handled automatically)

### Environment Security
- **File Permissions:** Secure your `.env` file (`chmod 600 .env`)
- **Environment Isolation:** Separate dev/staging/prod configurations
- **Secret Management:** Use proper secret management in production

## 🚨 Troubleshooting

### Common Issues

**1. "Invalid Client" Error**
- Check `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
- Verify redirect URI matches exactly
- Ensure OAuth app is properly configured

**2. "Invalid Token" Error**
- Check `JWT_SECRET` configuration
- Verify token hasn't expired (24-hour default)
- Ensure token format: `Bearer YOUR_TOKEN`

**3. "OAuth Provider Not Responding"**
- Check `OAUTH_AUTHORIZATION_URL` and `OAUTH_TOKEN_URL`
- Verify network connectivity
- Check OAuth provider status

**4. Development Token Not Working**
- Ensure `NODE_ENV=development`
- Check endpoint: `POST /auth/dev-token`
- Verify request body format

### Debug Logging
Enable debug logging to troubleshoot:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

Then check logs:
```bash
# Docker logs
docker-compose logs -f sleeper-api

# Local development
npm run dev
```

## 📚 Additional Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [GitHub Developer Settings](https://github.com/settings/developers)
- [JWT.io Debugger](https://jwt.io/)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
- [Passport.js Documentation](http://www.passportjs.org/docs/)

## 🤝 Need Help?

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for error details
3. Verify environment variable configuration
4. Test with development tokens first
5. Create an issue in the project repository

---

**Remember:** Start with development mode to get familiar with the system, then move to production OAuth when you're ready to deploy or share access with others!
