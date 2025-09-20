#!/usr/bin/env node

/**
 * MCP Tools for Sleeper API
 * Contains all tool definitions and handlers
 */

// MCP Tools definition
export const MCP_TOOLS = [
  // Player Tools
  {
    name: 'get_all_players',
    description: 'Get all NFL players (cached data)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (default: 100)',
          minimum: 1,
          maximum: 1000
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },
  {
    name: 'get_trending_players',
    description: 'Get trending players (most added or dropped)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['add', 'drop'], 
          description: 'Trending type: "add" for most added, "drop" for most dropped' 
        },
        lookback_hours: { 
          type: 'number', 
          description: 'Hours to look back for trending data (1-168)',
          minimum: 1,
          maximum: 168
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-100)',
          minimum: 1,
          maximum: 100
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['type']
    }
  },
  {
    name: 'search_players_by_id',
    description: 'Search for a specific NFL player by their Sleeper ID',
    inputSchema: {
      type: 'object',
      properties: {
        playerId: { 
          type: 'string', 
          description: 'Sleeper player ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['playerId']
    }
  },
  {
    name: 'search_players_by_name',
    description: 'Search for NFL players by name',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Search term (player name)' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-50)',
          minimum: 1,
          maximum: 50
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['query']
    }
  },
  {
    name: 'search_players_by_position',
    description: 'Search for NFL players by position',
    inputSchema: {
      type: 'object',
      properties: {
        position: { 
          type: 'string', 
          description: 'Player position',
          enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-100)',
          minimum: 1,
          maximum: 100
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['position']
    }
  },
  {
    name: 'search_players_by_team',
    description: 'Search for NFL players by team',
    inputSchema: {
      type: 'object',
      properties: {
        team: { 
          type: 'string', 
          description: 'Team abbreviation (e.g., "KC", "SF")' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-100)',
          minimum: 1,
          maximum: 100
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['team']
    }
  },
  {
    name: 'get_active_players',
    description: 'Get only active NFL players',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Maximum number of players to return (1-200)',
          minimum: 1,
          maximum: 200
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },

  // User Tools
  {
    name: 'get_user_info',
    description: 'Get information about a Sleeper user',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { 
          type: 'string', 
          description: 'Sleeper user ID or username' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },

  // League Tools
  {
    name: 'get_league_info',
    description: 'Get detailed information about a specific league',
    inputSchema: {
      type: 'object',
      properties: {
        leagueId: { 
          type: 'string', 
          description: 'Sleeper league ID' 
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['leagueId']
    }
  },

  // Draft Tools
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      },
      required: ['draftId']
    }
  },

  // Profile Tools
  {
    name: 'get_my_profile',
    description: 'Get the authenticated user\'s profile information',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },
  {
    name: 'delete_my_profile',
    description: 'Delete the authenticated user\'s profile (reset to defaults)',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
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
        },
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
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
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  },

  // System Tools
  {
    name: 'get_nfl_state',
    description: 'Get current NFL state information (season, week, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: { 
          type: 'string', 
          description: 'Your API key for authentication (required - can also be provided via X-API-Key header)' 
        }
      }
    }
  }
]

// Tool handlers implementation
export const createToolHandlers = (callSleeperAPI) => ({
  async get_all_players(args, apiKey) {
    const limit = args.limit || 100
    return await callSleeperAPI(`/players/nfl?limit=${limit}`, 'GET', null, apiKey, true)
  },

  async get_trending_players(args, apiKey) {
    if (!args.type || !['add', 'drop'].includes(args.type)) {
      throw new Error('type must be "add" or "drop"')
    }
    let trendingUrl = `/players/nfl/trending/${args.type}`
    if (args.lookback_hours) trendingUrl += `?lookback_hours=${args.lookback_hours}`
    if (args.limit) trendingUrl += `${args.lookback_hours ? '&' : '?'}limit=${args.limit}`
    return await callSleeperAPI(trendingUrl, 'GET', null, apiKey, true)
  },

  async search_players_by_id(args, apiKey) {
    if (!args.playerId) {
      throw new Error('playerId is required')
    }
    return await callSleeperAPI(`/players/search/id/${args.playerId}`, 'GET', null, apiKey, true)
  },

  async search_players_by_name(args, apiKey) {
    if (!args.query) {
      throw new Error('query is required')
    }
    let nameUrl = `/players/search/name?q=${encodeURIComponent(args.query)}`
    if (args.limit) nameUrl += `&limit=${args.limit}`
    return await callSleeperAPI(nameUrl, 'GET', null, apiKey, true)
  },

  async search_players_by_position(args, apiKey) {
    if (!args.position) {
      throw new Error('position is required')
    }
    let positionUrl = `/players/search/position/${args.position}`
    if (args.limit) positionUrl += `?limit=${args.limit}`
    return await callSleeperAPI(positionUrl, 'GET', null, apiKey, true)
  },

  async search_players_by_team(args, apiKey) {
    if (!args.team) {
      throw new Error('team is required')
    }
    let teamUrl = `/players/search/team/${args.team}`
    if (args.limit) teamUrl += `?limit=${args.limit}`
    return await callSleeperAPI(teamUrl, 'GET', null, apiKey, true)
  },

  async get_active_players(args, apiKey) {
    let activeUrl = '/players/active'
    if (args.limit) activeUrl += `?limit=${args.limit}`
    return await callSleeperAPI(activeUrl, 'GET', null, apiKey, true)
  },

  async get_user_info(args, apiKey) {
    if (!args.identifier) {
      throw new Error('identifier is required')
    }
    return await callSleeperAPI(`/sleeper/user/${args.identifier}`, 'GET', null, apiKey, true)
  },

  async get_user_leagues(args, apiKey) {
    if (!args.userId) {
      throw new Error('userId is required')
    }
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/sleeper/user/${args.userId}/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_my_leagues(args, apiKey) {
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/sleeper/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_league_info(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}`, 'GET', null, apiKey, true)
  },

  async get_league_rosters(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/rosters`, 'GET', null, apiKey, true)
  },

  async get_league_users(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/users`, 'GET', null, apiKey, true)
  },

  async get_league_matchups(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    if (!args.week) {
      throw new Error('week is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/matchups/${args.week}`, 'GET', null, apiKey, true)
  },

  async get_league_playoff_bracket(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/winners_bracket`, 'GET', null, apiKey, true)
  },

  async get_league_transactions(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    let transactionsUrl = `/sleeper/league/${args.leagueId}/transactions`
    if (args.round) transactionsUrl += `/${args.round}`
    return await callSleeperAPI(transactionsUrl, 'GET', null, apiKey, false)
  },

  async get_league_traded_picks(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/traded_picks`, 'GET', null, apiKey, true)
  },

  async get_user_drafts(args, apiKey) {
    if (!args.userId) {
      throw new Error('userId is required')
    }
    const sport = args.sport || 'nfl'
    const season = args.season || '2024'
    return await callSleeperAPI(`/sleeper/user/${args.userId}/drafts/${sport}/${season}`, 'GET', null, apiKey, true)
  },

  async get_league_drafts(args, apiKey) {
    if (!args.leagueId) {
      throw new Error('leagueId is required')
    }
    return await callSleeperAPI(`/sleeper/league/${args.leagueId}/drafts`, 'GET', null, apiKey, true)
  },

  async get_draft_info(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/sleeper/draft/${args.draftId}`, 'GET', null, apiKey, true)
  },

  async get_draft_picks(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/sleeper/draft/${args.draftId}/picks`, 'GET', null, apiKey, true)
  },

  async get_draft_traded_picks(args, apiKey) {
    if (!args.draftId) {
      throw new Error('draftId is required')
    }
    return await callSleeperAPI(`/sleeper/draft/${args.draftId}/traded_picks`, 'GET', null, apiKey, true)
  },

  async get_my_profile(args, apiKey) {
    return await callSleeperAPI('/profile', 'GET', null, apiKey, false)
  },

  async update_my_profile(args, apiKey) {
    const profileData = {}
    if (args.sleeper_user_id) profileData.sleeper_user_id = args.sleeper_user_id
    if (args.sleeper_username) profileData.sleeper_username = args.sleeper_username
    if (args.display_name) profileData.display_name = args.display_name
    if (args.preferences) profileData.preferences = args.preferences
    return await callSleeperAPI('/profile', 'PUT', profileData, apiKey, false)
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
    return await callSleeperAPI('/profile/status', 'GET', null, apiKey, false)
  },

  async get_nfl_state(args, apiKey) {
    return await callSleeperAPI('/sleeper/state/nfl', 'GET', null, apiKey, true)
  }
})
