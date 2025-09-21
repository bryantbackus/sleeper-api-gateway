#!/usr/bin/env node

/**
 * MCP Tools for Sleeper API - Authentication Required
 * These tools require API keys to function
 */

// Tools that require authentication (use requireAPIKey middleware)
export const MCP_TOOLS_AUTH = [
  // User Tools (require auth)
  {
    name: 'get_user_info',
    description: 'Get information about a Sleeper user',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { 
          type: 'string', 
          description: 'Sleeper user ID or username' 
        }
      },
      required: ['identifier']
    }
  },
  {
    name: 'get_user_leagues',
    description: 'Get fantasy football leagues for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { 
          type: 'string', 
          description: 'Sleeper user ID' 
        },
        sport: { 
          type: 'string', 
          description: 'Sport (currently only "nfl" supported)',
          enum: ['nfl'],
          default: 'nfl'
        },
        season: { 
          type: 'string', 
          description: 'Fantasy season year (e.g., "2024")',
          default: '2024'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_my_leagues',
    description: 'Get fantasy football leagues for the authenticated user (uses their profile)',
    inputSchema: {
      type: 'object',
      properties: {
        sport: { 
          type: 'string', 
          description: 'Sport (currently only "nfl" supported)',
          enum: ['nfl'],
          default: 'nfl'
        },
        season: { 
          type: 'string', 
          description: 'Fantasy season year (e.g., "2024")',
          default: '2024'
        }
      }
    }
  },

  // League Tools (require auth)
  {
    name: 'get_league_info',
    description: 'Get detailed information about a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_rosters',
    description: 'Get all rosters for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_users',
    description: 'Get all users in a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_matchups',
    description: 'Get matchups for a specific league and week',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        week: { 
          type: 'number', 
          description: 'Week number (1-18)',
          minimum: 1,
          maximum: 18
        }
      },
      required: ['leagueId', 'week']
    }
  },
  {
    name: 'get_league_playoff_bracket',
    description: 'Get playoff bracket for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_transactions',
    description: 'Get transactions for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        round: { 
          type: 'number', 
          description: 'Transaction round (optional)' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_league_traded_picks',
    description: 'Get traded picks for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        }
      },
      required: ['leagueId']
    }
  },

  // Draft Tools (require auth)
  {
    name: 'get_user_drafts',
    description: 'Get drafts for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { 
          type: 'string', 
          description: 'Sleeper user ID' 
        },
        sport: { 
          type: 'string', 
          description: 'Sport (currently only "nfl" supported)',
          enum: ['nfl'],
          default: 'nfl'
        },
        season: { 
          type: 'string', 
          description: 'Fantasy season year (e.g., "2024")',
          default: '2024'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_league_drafts',
    description: 'Get drafts for a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        }
      },
      required: ['leagueId']
    }
  },
  {
    name: 'get_draft_info',
    description: 'Get detailed information about a specific draft',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { 
          type: 'string', 
          description: 'Sleeper draft ID' 
        }
      },
      required: ['draftId']
    }
  },
  {
    name: 'get_draft_picks',
    description: 'Get all picks for a specific draft',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { 
          type: 'string', 
          description: 'Sleeper draft ID' 
        }
      },
      required: ['draftId']
    }
  },
  {
    name: 'get_draft_traded_picks',
    description: 'Get traded picks for a specific draft',
    inputSchema: {
      type: 'object',
      properties: {
        draftId: { 
          type: 'string', 
          description: 'Sleeper draft ID' 
        }
      },
      required: ['draftId']
    }
  },

  // Profile Tools (require auth)
  {
    name: 'get_my_profile',
    description: 'Get the authenticated user\'s profile information',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'update_my_profile',
    description: 'Update the authenticated user\'s profile information',
    inputSchema: {
      type: 'object',
      properties: {
        sleeper_user_id: { 
          type: 'string', 
          description: 'Sleeper user ID (8-20 digits)' 
        },
        sleeper_username: { 
          type: 'string', 
          description: 'Sleeper username (1-20 chars, alphanumeric, underscores, hyphens)' 
        },
        display_name: { 
          type: 'string', 
          description: 'Display name (1-50 characters)' 
        },
        preferences: { 
          type: 'object', 
          description: 'User preferences object' 
        }
      }
    }
  },
  {
    name: 'delete_my_profile',
    description: 'Delete the authenticated user\'s profile (reset to defaults)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'verify_sleeper_user',
    description: 'Verify a Sleeper user ID exists and get their information',
    inputSchema: {
      type: 'object',
      properties: {
        sleeper_user_id: { 
          type: 'string', 
          description: 'Sleeper user ID to verify' 
        }
      },
      required: ['sleeper_user_id']
    }
  },
  {
    name: 'get_profile_status',
    description: 'Get profile status and recommendations for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]

// Tool handlers for auth-required tools
export const createAuthToolHandlers = (callSleeperAPI) => ({
  async get_user_info(args, apiKey) {
    if (!args.identifier) {
      throw new Error('identifier is required')
    }
    return await callSleeperAPI(`/user/${args.identifier}`, 'GET', null, apiKey, true)
  },

  async get_user_leagues(args, apiKey) {
    if (!args.userId) {
      throw new Error('userId is required')
    }
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/user/${args.userId}/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_my_leagues(args, apiKey) {
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_league_info(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}`, 'GET', null, apiKey, true)
  },

  async get_league_rosters(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}/rosters`, 'GET', null, apiKey, true)
  },

  async get_league_users(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}/users`, 'GET', null, apiKey, true)
  },

  async get_league_matchups(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    if (!args.week) {
      throw new Error('week is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}/matchups/${args.week}`, 'GET', null, apiKey, true)
  },

  async get_league_playoff_bracket(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}/winners_bracket`, 'GET', null, apiKey, true)
  },

  async get_league_transactions(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    let url = `/league/${args.leagueId}/transactions`
    if (args.round) url += `/${args.round}`
    return await callSleeperAPI(url, 'GET', null, apiKey, true)
  },

  async get_league_traded_picks(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}/traded_picks`, 'GET', null, apiKey, true)
  },

  async get_user_drafts(args, apiKey) {
    if (!args.userId) {
      throw new Error('userId is required')
    }
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/user/${args.userId}/drafts/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_league_drafts(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/league/${args.leagueId}/drafts`, 'GET', null, apiKey, true)
  },

  async get_draft_info(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/draft/${args.draftId}`, 'GET', null, apiKey, true)
  },

  async get_draft_picks(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/draft/${args.draftId}/picks`, 'GET', null, apiKey, true)
  },

  async get_draft_traded_picks(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/draft/${args.draftId}/traded_picks`, 'GET', null, apiKey, true)
  },

  async get_my_profile(args, apiKey) {
    return await callSleeperAPI('/profile', 'GET', null, apiKey, true)
  },

  async update_my_profile(args, apiKey) {
    return await callSleeperAPI('/profile', 'PUT', args, apiKey, false)
  },

  async delete_my_profile(args, apiKey) {
    return await callSleeperAPI('/profile', 'DELETE', null, apiKey, false)
  },

  async verify_sleeper_user(args, apiKey) {
    if (!args.sleeper_user_id) {
      throw new Error('sleeper_user_id is required')
    }
    return await callSleeperAPI('/profile/verify-sleeper', 'POST', { sleeper_user_id: args.sleeper_user_id }, apiKey, false)
  },

  async get_profile_status(args, apiKey) {
    return await callSleeperAPI('/profile/status', 'GET', null, apiKey, true)
  }
})
