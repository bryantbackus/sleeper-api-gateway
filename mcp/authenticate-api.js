import { callSleeperAPI, log } from './shared_utils.js'
import { registerAuthenticatedTools } from './tools-auth.js'
import { USER_SESSIONS, TOOL_HANDLES } from './shared_utils.js'
import { z } from "zod";

// ### HELPER FUNCTIONS ###
// Helper Function to register a tool
function registerTool(server, tool_config) {
    const tool_handle = server.registerTool(tool_config.name, tool_config.config, tool_config.callback)
    return tool_handle
  }
  
  // ### AUTHENTICATION TOOL ###
  // Authentication tool registration
  function registerAuthTool(server, sessionId) {
    const tool_handle = registerTool(
      server,
      {
        name: 'authenticate',
        config: {
          title: 'Authenticate',
          description: 'Authenticate with your Sleeper API key to enable authenticated tools',
          inputSchema: { 
            apiKey: z.string()
              .regex(/^[a-f0-9]{64}$/, { message: "API key must be a 64-character lowercase hexadecimal string" })
              .describe('Sleeper API key')
          }
        },
        callback: async ({ apiKey }) => {
          const result = await authenticate(apiKey, sessionId)
          if (!result.success) {
            throw new Error(result.message)
          }
          
          registerAuthenticatedTools(server, sessionId)
          
          // Remove the authenticate tool
          const h = TOOL_HANDLES[sessionId]?.authenticate
          if (h) {
            h.remove()
            delete TOOL_HANDLES[sessionId].authenticate
          }
          
          server.sendToolListChanged()
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ...result,
                message: `${result.message} Tools registered.`
              }, null, 2)
            }]
          }
        }
      },
      sessionId
    )
    
    // Store the tool handle in the TOOL_HANDLES object
    TOOL_HANDLES[sessionId] ||= {}
    TOOL_HANDLES[sessionId].authenticate = tool_handle
  }
  
  async function authenticate(apiKey, sessionId) {
    // Try to get user profile with the API key
    const profileResult = await callSleeperAPI(
      "/auth/validate",
      "GET",
      null,
      apiKey
    );

    const success = !!profileResult.success;
    const message = success ? "Authentication successful" : "Invalid API key or unable to validate authentication";

    if (success) {
      USER_SESSIONS[sessionId] = {
        authenticated: true,
        apiKey: apiKey,
        username: profileResult.data.sleeper_username,
        userId: profileResult.data.user_id
      }
      
      log("info", "Authentication successful", {
        userId: profileResult.data.user_id,
        username: profileResult.data.sleeper_username,
      });
    }
  
    return {
      success,
      message,
      profile: success ? {
        user_id: profileResult.data.user_id,
        username: profileResult.data.sleeper_username,
        display_name: profileResult.data.display_name,
      } : null
    }
  }

  export { registerAuthTool }