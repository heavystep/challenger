/**
 * GPT용 MCP 도구 변환기
 * MCP 도구 형식을 OpenAI GPT 함수 호출 형식으로 변환
 */

import type { GPTFunction } from '@/clients/gpt/types';

/**
 * MCP 도구를 GPT 함수 선언으로 변환
 * @param mcpTools - MCP 형식의 도구 목록
 * @returns GPT 함수 선언 목록
 */
export const convertMCPToolsToGPTFunctions = (mcpTools: any[]): GPTFunction[] => {
  return mcpTools.map(tool => {
    // MCP 도구의 input_schema를 GPT 함수 스키마로 변환
    const inputSchema = tool.input_schema || tool.inputSchema || {};
    
    // 스키마가 없는 경우 기본 스키마 생성
    const parameters = {
      type: 'object' as const,
      properties: inputSchema.properties || {},
      required: inputSchema.required || []
    };
    
    console.log(`🔄 MCP → GPT 도구 변환: ${tool.name}`, {
      original: inputSchema,
      converted: parameters
    });
    
    return {
      name: tool.name,
      description: tool.description || `Execute ${tool.name} tool`,
      parameters
    };
  });
};

/**
 * MCP 도구를 OpenAI tools 형식으로 변환
 * @param mcpTools - MCP 형식의 도구 목록
 * @returns OpenAI tools 형식
 */
export const convertMCPToolsToOpenAITools = (mcpTools: any[]) => {
  return mcpTools.map(tool => {
    const inputSchema = tool.input_schema || tool.inputSchema || {};
    
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name} tool`,
        parameters: {
          type: "object" as const,
          properties: inputSchema.properties || {},
          required: inputSchema.required || [],
          additionalProperties: false
        }
      }
    };
  });
};

/**
 * GPT 함수 호출 결과를 MCP 형식으로 변환
 * @param functionName - 함수 이름
 * @param functionArgs - 함수 인수
 * @returns MCP 도구 실행용 객체
 */
export const convertGPTFunctionToMCPTool = (functionName: string, functionArgs: any) => {
  return {
    name: functionName,
    arguments: functionArgs
  };
};

/**
 * OpenAI 도구 호출을 MCP 형식으로 변환
 * @param toolCall - OpenAI 도구 호출 객체
 * @returns MCP 도구 실행용 객체
 */
export const convertOpenAIToolCallToMCP = (toolCall: any) => {
  return {
    id: toolCall.id,
    name: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments)
  };
};