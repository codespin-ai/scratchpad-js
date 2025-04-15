// src/mcp/loggingWrapper.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logMcpCall } from "../utils/logger.js";

type ToolHandlerFunction = (...args: unknown[]) => Promise<unknown>;

// Wraps a tool handler with logging
export function wrapToolHandler(name: string, handler: ToolHandlerFunction): ToolHandlerFunction {
  // Return a wrapped handler that logs calls
  return async (...args: unknown[]) => {
    const startTime = new Date();
    let response;
    let error = null;
    
    try {
      // Call the original handler
      response = await handler(...args);
      return response;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const endTime = new Date();
      const payload = args.length > 0 ? args[0] : {};
      
      // Log the call with all required information
      logMcpCall({
        method: name,
        payload,
        response: error ? { error: String(error) } : response,
        startTime,
        endTime
      });
    }
  };
}

// A decorator for the McpServer to add logging
export function addLoggingToServer(server: McpServer): McpServer {
  // Save the original tool method
  const originalTool = server.tool.bind(server);
  
  // Override the tool method to add logging
  server.tool = function<T, U>(...args: unknown[]) {
    const name = args[0] as string;
    
    // Find the callback (last argument or third for tools with params)
    const callbackIndex = args.length - 1;
    const callback = args[callbackIndex] as ToolHandlerFunction;
    
    if (typeof callback === 'function') {
      args[callbackIndex] = wrapToolHandler(name, callback);
    }
    
    // Call the original method
    return originalTool(...args);
  };
  
  return server;
}
