/**
 * Gemini용 MCP 도구 변환기
 * MCP 도구 형식을 Gemini 함수 호출 형식으로 변환
 */

import type { FunctionDeclaration } from '@/clients/gemini/types';

/**
 * MCP 도구를 Gemini 함수 선언으로 변환
 * @param mcpTools - MCP 형식의 도구 목록
 * @returns Gemini 함수 선언 목록
 */
export const convertMCPToolsToGeminiFunctions = (mcpTools: any[]): FunctionDeclaration[] => {
  return mcpTools.map(tool => {
    // MCP 도구의 input_schema를 Gemini 함수 스키마로 변환
    const inputSchema = tool.input_schema || {};
    
    // 스키마가 없는 경우 기본 스키마 생성
    const parametersJsonSchema = {
      type: 'object' as const,
      properties: inputSchema.properties || {},
      required: inputSchema.required || []
    };
    
    console.log(`🔄 MCP 도구 변환: ${tool.name}`, {
      original: tool.input_schema,
      converted: parametersJsonSchema
    });
    
    return {
      name: tool.name,
      description: tool.description,
      parametersJsonSchema
    };
  });
};

/**
 * Gemini 함수 호출 결과를 MCP 형식으로 변환
 * @param functionName - 함수 이름
 * @param functionArgs - 함수 인수
 * @returns MCP 도구 실행용 객체
 */
export const convertGeminiFunctionToMCPTool = (functionName: string, functionArgs: any) => {
  return {
    name: functionName,
    arguments: functionArgs
  };
};
