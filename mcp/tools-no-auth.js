/**
 * MCP Tools for Sleeper API - No Authentication Required
 * These tools can be used without API keys
 */
import { callSleeperAPI, log } from './shared_utils.js'
import { z } from "zod";
import { USER_SESSIONS, checkMcpRateLimit } from './shared_utils.js'

// Tools that don't require authentication (use optionalAPIKey middleware)
const MCP_TOOLS_NO_AUTH = {
  get_trending_players: {
    config: {
      title: 'Get Trending Players',
      description: 'Get trending players (most added or dropped)',
      inputSchema: {
        type: z.enum(['add', 'drop'], {
          message: 'Type must be "add" or "drop"'
        }).describe('Trending type: "add" for most added, "drop" for most dropped'),
        lookback_hours: z.coerce.number()
          .min(1, { message: "Lookback hours must be at least 1" })
          .max(168, { message: "Lookback hours cannot exceed 168" })
          .optional()
          .describe('Hours to look back for trending data (1-168)'),
        limit: z.coerce.number()
          .min(1, { message: "Limit must be at least 1" })
          .max(100, { message: "Limit cannot exceed 100" })
          .optional()
          .describe('Maximum number of players to return (1-100)')
      }
    },
    callback: async ({ type, lookback_hours, limit }, apiKey = null) => {
      let trendingUrl = `/players/nfl/trending/${type}`
      const params = []
      if (lookback_hours) params.push(`lookback_hours=${lookback_hours}`)
      if (limit) params.push(`limit=${limit}`)
      if (params.length > 0) trendingUrl += `?${params.join('&')}`
      
      return await callSleeperAPI(trendingUrl, 'GET', null, apiKey, true)
    }
  },

  search_players_by_id: {
    config: {
      title: 'Search Player by ID',
      description: 'Search for a specific NFL player by their Sleeper ID',
      inputSchema: {
        playerId: z.union([
          z.coerce.number().int().positive().describe('Sleeper player ID as a number'),
          z.enum([
            'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB',
            'HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ',
            'PHI','PIT','SEA','SF','TB','TEN','WAS'
          ], {
            message: 'Must be a valid NFL Team Abbreviation (e.g. MIN, KC, DEN, CIN)'
          }).describe('NFL Team Abbreviation (e.g. MIN, KC, DEN, CIN)')
        ]).describe('Sleeper player ID (number or NFL Team Abbreviation)')       
      }
    },
    callback: async ({ playerId }, apiKey = null) => {
      return await callSleeperAPI(`/players/search/id/${playerId}`, 'GET', null, apiKey, true)
    }
  },

  search_players_by_name: {
    config: {
      title: 'Search Players by Name',
      description: 'Search for NFL players by name',
      inputSchema: {
        query: z.string()
          .min(1, { message: "Search query is required" })
          .describe('Search term (player name)'),
        limit: z.coerce.number()
          .min(1, { message: "Limit must be at least 1" })
          .max(100, { message: "Limit cannot exceed 100" })
          .optional()
          .describe('Maximum number of results to return (1-100)')
      }
    },
    callback: async ({ query, limit }, apiKey = null) => {
      let searchUrl = `/players/search/name?q=${encodeURIComponent(query)}`
      if (limit) searchUrl += `&limit=${limit}`
      
      return await callSleeperAPI(searchUrl, 'GET', null, apiKey, true)
    }
  },

  search_players_by_position: {
    config: {
      title: 'Search Players by Position',
      description: 'Search for NFL players by position',
      inputSchema: {
        position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'], {
          message: "Position must be a valid NFL position (e.g., QB, RB, WR, TE, K, DEF)"
        }).describe('Player position (QB, RB, WR, TE, K, DEF)'),
        limit: z.coerce.number()
          .min(1, { message: "Limit must be at least 1" })
          .max(100, { message: "Limit cannot exceed 100" })
          .optional()
          .describe('Maximum number of results to return (1-100)')
      }
    },
    callback: async ({ position, limit }, apiKey = null) => {
      let positionUrl = `/players/search/position/${position}`
      if (limit) positionUrl += `?limit=${limit}`
      
      return await callSleeperAPI(positionUrl, 'GET', null, apiKey, true)
    }
  },

  search_players_by_team: {
    config: {
      title: 'Search Players by Team',
      description: 'Search for NFL players by team',
      inputSchema: {
        team: z.enum([
          'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
        ], {
          message: "Team must be a valid NFL team abbreviation (e.g., KC, NE, GB)"
        }).describe('Team abbreviation (e.g., KC, NE, GB)'),
        limit: z.coerce.number()
          .min(1, { message: "Limit must be at least 1" })
          .max(100, { message: "Limit cannot exceed 100" })
          .optional()
          .describe('Maximum number of results to return (1-100)')
      }
    },
    callback: async ({ team, limit }, apiKey = null) => {
      let teamUrl = `/players/search/team/${team}`
      if (limit) teamUrl += `?limit=${limit}`
      
      return await callSleeperAPI(teamUrl, 'GET', null, apiKey, true)
    }
  },

  get_active_players: {
    config: {
      title: 'Get Active Players',
      description: 'Get only active NFL players',
      inputSchema: {
        limit: z.coerce.number()
          .min(1, { message: "Limit must be at least 1" })
          .max(200, { message: "Limit cannot exceed 200" })
          .optional()
          .describe('Maximum number of players to return (1-200)')
      }
    },
    callback: async ({ limit }, apiKey = null) => {
      const actualLimit = limit || 200
      return await callSleeperAPI(`/players/active?limit=${actualLimit}`, 'GET', null, apiKey, true)
    }
  },

  get_nfl_state: {
    config: {
      title: 'Get NFL State',
      description: 'Get current NFL state information (season, week, etc.)',
      inputSchema: {}
    },
    callback: async (_, apiKey = null) => {
      return await callSleeperAPI('/sleeper/state/nfl', 'GET', null, apiKey, true)
    }
  }
}

// ### HELPER FUNCTIONS ###
// Helper Function to register a tool
function registerTool(server, tool_config) {
  return server.registerTool(tool_config.name, tool_config.config, tool_config.callback)
}

// Function to register all no-auth tools
function registerNoAuthTools(server, sessionId = null) {
  log('debug', 'Registering no-auth tools', { sessionId })
  Object.entries(MCP_TOOLS_NO_AUTH).forEach(([toolName, toolConfig]) => {
    // Create a wrapper that injects API key if session is authenticated
    const wrappedCallback = async (args) => {
      let apiKey = null
      
      // If sessionId is provided, check if user is authenticated
      if (sessionId) {
        // Check rate limit
        const rateLimit = checkMcpRateLimit(sessionId)
        
        if (!rateLimit.allowed) {
          const resetInSeconds = Math.ceil(rateLimit.resetIn / 1000)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Rate limit exceeded',
                message: `You have exceeded the MCP rate limit. Please try again in ${resetInSeconds} seconds.`,
                limit: rateLimit.limit,
                resetIn: resetInSeconds,
                suggestion: `Authenticate with an API key for higher rate limits (${CONFIG.MCP_UNAUTHENTICATED_LIMIT} → ${CONFIG.MCP_AUTHENTICATED_LIMIT} requests/minute)`
              }, null, 2)
            }],
            success: false,
            isError: true
          }
        }

        const session = USER_SESSIONS[sessionId]
        if (session?.authenticated && session.apiKey) {
          apiKey = session.apiKey
        }
      }
      
      // Call original callback with API key
      return await toolConfig.callback(args, apiKey)
    }
    
    registerTool(server, {
      name: toolName,
      config: toolConfig.config,
      callback: wrappedCallback
    })
  })
}

export { registerNoAuthTools }