/**
 * A simplified tool registration function that directly captures the tool handlers.
 */
export class TestToolRegistration {
  private tools: Record<string, Function> = {};

  /**
   * Returns a mock server object with a tool registration method
   */
  getServer(): any {
    return {
      tool: (name: string, description: string, schema: any, handler: Function) => {
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
  async callTool(name: string, params: any): Promise<any> {
    if (!this.tools[name]) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await this.tools[name](params);
  }
}