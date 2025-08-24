import PlaywrightMCP from './mcp';
export { convertMCPToolsToGeminiFunctions, convertGeminiFunctionToMCPTool } from './gemini-adapter';
export { convertMCPToolsToGPTFunctions, convertGPTFunctionToMCPTool, convertMCPToolsToOpenAITools } from './gpt-adapter';

// Microsoft 공식 Playwright MCP - Claude에게 노출할 브라우저 제어 인터페이스
export const exposeBrowserTools = async () => {
  const proxy = new PlaywrightMCP();
  
  return {
    // Claude가 사용할 수 있는 도구들 (MCP 명세 형식)
    getToolsForClaude: async () => {
      return await proxy.getToolsForClaude();
    },
    
    // 공식 Playwright MCP 도구 실행기 (Claude의 tool_use 응답 처리용)
    executeTool: async (toolName: string, toolArgs: any) => {
      return await proxy.executeTool(toolName, toolArgs);
    },
    
    // Trace를 Playwright 코드로 변환
    convertTraceToCode: async (traceFile?: string) => {
      return await proxy.convertTraceToCode(traceFile);
    },
    
    // 정리
    cleanup: async () => {
      await proxy.close();
    }
  };
};