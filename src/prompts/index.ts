/**
 * 프롬프트 모듈 진입점 - 배럴 패턴 구현
 * @description 외부에서는 이 파일만 import하여 프롬프트 사용
 */

// 기본 프롬프트 템플릿 내보내기
export { default as basePrompt } from './_base';

// 인사 프롬프트 내보내기
export { default as helloPrompt } from './hello';

// Gemini MCP 프롬프트
export { default as geminiMcpPrompt } from './geminiMcp';

// GPT MCP 프롬프트
export { default as gptMcpPrompt } from './gptMcp';

// Run 프롬프트
export { default as runPrompt } from './run';

// Gen 프롬프트
export { default as genPrompt } from './genPrompt';

/**
 * 프롬프트 클래스 인터페이스
 * 모든 프롬프트 클래스가 구현해야 하는 기본 구조
 */
export interface Prompt {
  /**
   * Gemini 모델용 프롬프트 생성
   * @param params 프롬프트 생성에 필요한 매개변수들
   * @returns Gemini용 프롬프트 문자열
   */
  gemini(params: any): string;

  /**
   * Claude 모델용 프롬프트 생성
   * @param params 프롬프트 생성에 필요한 매개변수들
   * @returns Claude용 프롬프트 문자열
   */
  claude(params: any): string;

  /**
   * GPT 모델용 프롬프트 생성
   * @param params 프롬프트 생성에 필요한 매개변수들
   * @returns GPT용 프롬프트 문자열
   */
  gpt(params: any): string;
}