/**
 * AI 모듈 통합 진입점
 * 환경변수 MODEL에 따라 Claude, Gemini 또는 GPT 클라이언트를 자동 선택
 */

// 팩토리 패턴 - 메인 export
export { 
  AIClientFactory,
  createAIClient,
  sendMessage,
  sendMessageStream,
  getCurrentModel,
  SUPPORTED_MODELS
} from './factory';

// 개별 클라이언트 export (필요 시 직접 사용)
export { ClaudeClient } from './claude/index';
export { GeminiClient } from './gemini/index';
export { GPTClient } from './gpt/index';

// 공통 타입 export
export type {
  AIClient,
  AIModelType,
  AIFactoryConfig,
  ChatResponse,
  StreamChunk,
  StreamCallback,
  Tool,
  ToolCall,
  ToolResponse
} from './types';

// 개별 모듈 타입 export
export type {
  ClaudeConfig,
  ClaudeErrorType
} from './claude/types';

export type {
  GeminiConfig,
  GeminiErrorType,
  FunctionDeclaration,
  FunctionCall,
  FunctionResponse
} from './gemini/types';

export type {
  GPTConfig,
  GPTErrorType,
  GPTFunction,
  GPTFunctionCall,
  GPTToolCall,
  GPTToolResponse
} from './gpt/types';

// 기본 export - 편의를 위한 팩토리 함수
export { createAIClient as default } from './factory';