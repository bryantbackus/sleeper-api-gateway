#!/usr/bin/env node

/**
 * MCP Tools for Sleeper API - No Authentication Required
 * These tools can be used without API keys
 */

// Tools that don't require authentication (use optionalAPIKey middleware)
export const MCP_TOOLS_NO_AUTH = [
  // Player Tools (no auth required)
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
        }
      }
    }
  },

  // System Tools (no auth required)
  {
    name: 'get_nfl_state',
    description: 'Get current NFL state information (season, week, etc.)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]

// Tool handlers for no-auth tools
export const createNoAuthToolHandlers = (callSleeperAPI) => ({
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
    const limit = args.limit || 200
    return await callSleeperAPI(`/players/active?limit=${limit}`, 'GET', null, apiKey, true)
  },

  async get_nfl_state(args, apiKey) {
    return await callSleeperAPI('/state/nfl', 'GET', null, apiKey, true)
  }
})
