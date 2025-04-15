/**
 * A simplified tool registration function that directly captures the tool handlers.
 */
export class TestToolRegistration {
  private tools: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  /**
   * Returns a mock server object with a tool registration method
   */
  getServer(): { tool: (name: string, description: string, schema: unknown, handler: (...args: unknown[]) => Promise<unknown>) => void } {
    return {
      tool: (name: string, description: string, schema: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
        this.tools[name] = handler;
      }
    };
  }

  /**
   * Directly calls a registered tool handler
   * 
   * @param name The name of the tool to call
   * @param params Parameters to pass to the tool
   * @returns The tool's response
   */
  async callTool(name: string, params: unknown): Promise<unknown> {
    if (!this.tools[name]) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await this.tools[name](params);
  }
}
