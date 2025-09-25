/**
 * MCP Tools for Sleeper API - Authentication Required
 * These tools require API keys to function
 */
import { callSleeperAPI, log, USER_SESSIONS } from './shared_utils.js'
import { z } from "zod";

// ### HELPER FUNCTIONS ###
// Helper Function to register a tool
function registerTool(server, tool_config) {
  server.registerTool(tool_config.name, tool_config.config, tool_config.callback)
}

// Tools that require authentication (use requireAPIKey middleware)
const MCP_TOOLS_AUTH = {
  get_user_info_requires_auth: {
    config: {
      title: 'Get User Info',
      description: 'Get information about a Sleeper user',
      inputSchema: {
        identifier: z.string()
          .min(1, { message: "Identifier is required" })
          .describe('Sleeper user ID or username')
      }
    },
    callback: async ({ identifier }, apiKey) => {
      return await callSleeperAPI(`/sleeper/user/${identifier}`, 'GET', null, apiKey, true)
    }
  },

  get_user_leagues_requires_auth: {
    config: {
      title: 'Get User Leagues',
      description: 'Get fantasy football leagues for a specific user',
      inputSchema: {
        userId: z.string()
          .min(1, { message: "User ID is required" })
          .describe('Sleeper user ID')
          ,
        sport: z.enum(['nfl'], {
          message: 'Sport must be "nfl"'
        }).optional().default('nfl').describe('Sport (currently only "nfl" supported)'),
        season: z.string()
          .min(4, { message: "Season must be a valid year" })
          .max(4, { message: "Season must be a valid year" })
          .regex(/^\d{4}$/, { message: "Season must be a 4-digit year" })
          .optional()
          .default(new Date().getFullYear().toString())
          .describe('Fantasy season year (e.g., "2025")')
      }
    },
    callback: async ({ userId, sport = 'nfl', season = '2025' }, apiKey) => {
      return await callSleeperAPI(`/sleeper/user/${userId}/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
    }
  },

  get_my_leagues_requires_auth: {
    config: {
      title: 'Get My Leagues',
      description: 'Get fantasy football leagues for the authenticated user',
      inputSchema: {
        sport: z.enum(['nfl'], {
          message: 'Sport must be "nfl"'
        }).optional().default('nfl').describe('Sport (currently only "nfl" supported)'),
        season: z.string()
          .min(4, { message: "Season must be a valid year" })
          .max(4, { message: "Season must be a valid year" })
          .regex(/^\d{4}$/, { message: "Season must be a 4-digit year" })
          .optional()
          .default(new Date().getFullYear().toString())
          .describe('Fantasy season year (e.g., "2025")')
      }
    },
    callback: async ({ sport = 'nfl', season = '2025' }, apiKey) => {
      return await callSleeperAPI(`/sleeper/leagues/${sport}/${season}`, 'GET', null, apiKey, true)
    }
  },

  get_league_info_requires_auth: {
    config: {
      title: 'Get League Info',
      description: 'Get detailed information about a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID') 
      }
    },
    callback: async ({ leagueId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}`, 'GET', null, apiKey, true)
    }
  },

  get_league_rosters_requires_auth: {
    config: {
      title: 'Get League Rosters',
      description: 'Get all rosters for a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID')          
      }
    },
    callback: async ({ leagueId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}/rosters`, 'GET', null, apiKey, true)
    }
  },

  get_league_users_requires_auth: {
    config: {
      title: 'Get League Users',
      description: 'Get all users in a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID')          
      }
    },
    callback: async ({ leagueId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}/users`, 'GET', null, apiKey, true)
    }
  },

  get_league_matchups_requires_auth: {
    config: {
      title: 'Get League Matchups',
      description: 'Get matchups for a specific league and week',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID'),
        week: z.number()
          .int()
          .min(1, { message: "Week must be at least 1" })
          .max(18, { message: "Week cannot exceed 18" })
          .describe('NFL week number (1-18)')          
      }
    },
    callback: async ({ leagueId, week }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}/matchups/${week}`, 'GET', null, apiKey, true)
    }
  },

  get_league_winners_bracket_requires_auth: {
    config: {
      title: 'Get League Winners Bracket',
      description: 'Get winners bracket for a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID')
      }
    },
    callback: async ({ leagueId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}/winners_bracket`, 'GET', null, apiKey, true)
    }
  },

  get_league_transactions_requires_auth: {
    config: {
      title: 'Get League Transactions',
      description: 'Get transactions for a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID'),
        week: z.number()
          .int()
          .min(1, { message: "Week must be at least 1" })
          .max(18, { message: "Week cannot exceed 18" })
          .optional()
          .describe('NFL week number (1-18), optional')
      }
    },
    callback: async ({ leagueId, week }, apiKey) => {
      let url = `/sleeper/league/${leagueId}/transactions`
      if (week) url += `/${week}`
      return await callSleeperAPI(url, 'GET', null, apiKey, true)
    }
  },

  get_league_traded_picks_requires_auth: {
    config: {
      title: 'Get League Traded Picks',
      description: 'Get traded picks for a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .regex(/^\d+$/, { message: "League ID must be numeric" })
          .describe('Sleeper league ID')          
      }
    },
    callback: async ({ leagueId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}/traded_picks`, 'GET', null, apiKey, true)
    }
  },

  get_league_drafts_requires_auth: {
    config: {
      title: 'Get League Drafts',
      description: 'Get drafts for a specific league',
      inputSchema: {
        leagueId: z.string()
          .min(1, { message: "League ID is required" })
          .describe('Sleeper league ID')
      }
    },
    callback: async ({ leagueId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/league/${leagueId}/drafts`, 'GET', null, apiKey, true)
    }
  },

  get_draft_info_requires_auth: {
    config: {
      title: 'Get Draft Info',
      description: 'Get detailed information about a specific draft',
      inputSchema: {
        draftId: z.string()
          .min(1, { message: "Draft ID is required" })
          .regex(/^\d+$/, { message: "Draft ID must be numeric" })
          .describe('Sleeper draft ID')
      }
    },
    callback: async ({ draftId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/draft/${draftId}`, 'GET', null, apiKey, true)
    }
  },

  get_draft_picks_requires_auth: {
    config: {
      title: 'Get Draft Picks',
      description: 'Get all picks for a specific draft',
      inputSchema: {
        draftId: z.string()
          .min(1, { message: "Draft ID is required" })
          .regex(/^\d+$/, { message: "Draft ID must be numeric" })
          .describe('Sleeper draft ID')          
      }
    },
    callback: async ({ draftId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/draft/${draftId}/picks`, 'GET', null, apiKey, true)
    }
  },

  get_draft_traded_picks_requires_auth: {
    config: {
      title: 'Get Draft Traded Picks',
      description: 'Get traded picks for a specific draft',
      inputSchema: {
        draftId: z.string()
          .min(1, { message: "Draft ID is required" })
          .regex(/^\d+$/, { message: "Draft ID must be numeric" })
          .describe('Sleeper draft ID')          
      }
    },
    callback: async ({ draftId }, apiKey) => {
      return await callSleeperAPI(`/sleeper/draft/${draftId}/traded_picks`, 'GET', null, apiKey, true)
    }
  },

  get_my_profile_requires_auth: {
    config: {
      title: 'Get My Profile',
      description: 'Get the authenticated user\'s profile information',
      inputSchema: {}
    },
    callback: async (_, apiKey) => {
      return await callSleeperAPI('/profile', 'GET', null, apiKey, true)
    }
  },

  update_my_profile: {
    config: {
      title: 'Update My Profile',
      description: 'Update the authenticated user\'s profile information',
      inputSchema: {
        display_name: z.string()
          .optional()
          .describe('User\'s display name'),
        sleeper_user_id: z.string()
          .optional()
          .describe('Sleeper user ID'),
        sleeper_username: z.string()
          .optional()
          .describe('Sleeper username')
      }
    },
    callback: async (args, apiKey) => {
      return await callSleeperAPI('/profile', 'PUT', args, apiKey, false)
    }
  },

  verify_sleeper_user: {
    config: {
      title: 'Verify Sleeper User',
      description: 'Verify a Sleeper user ID exists and get their information',
      inputSchema: {
        sleeper_user_id: z.string()
          .regex(/^\d+$/, { message: "Sleeper user ID must be numeric" })
          .describe('Sleeper user ID to verify')          
      }
    },
    callback: async ({ sleeper_user_id }, apiKey) => {
      return await callSleeperAPI('/profile/verify-sleeper', 'POST', { sleeper_user_id }, apiKey, false)
    }
  },

  get_profile_status: {
    config: {
      title: 'Get Profile Status',
      description: 'Get profile status and recommendations for the authenticated user',
      inputSchema: {}
    },
    callback: async (_, apiKey) => {
      return await callSleeperAPI('/profile/status', 'GET', null, apiKey, true)
    }
  }
}

// Function to register all auth-required tools
function registerAuthenticatedTools(server, sessionId) {
  Object.entries(MCP_TOOLS_AUTH).forEach(([toolName, toolConfig]) => {
    
    // Create a wrapper that injects API key from session
    const wrappedCallback = async (args) => {
      const session = USER_SESSIONS[sessionId]
      const apiKey = session.apiKey
      
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

export { registerAuthenticatedTools }