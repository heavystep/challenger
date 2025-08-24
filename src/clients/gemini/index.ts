/**
 * Gemini 모듈 진입점 - 배럴 패턴 구현
 * @description 외부에서는 이 파일만 import하여 Gemini 기능 사용
 */

// 클라이언트 클래스 내보내기 (default export)
export { default as GeminiClient } from './client';

// 유틸리티 함수들 내보내기
export { formatForUI, validateApiKey, handleGeminiError, safeJsonParse } from './utils';

// 타입 정의들 내보내기
export type { 
  GeminiConfig, 
  ChatResponse, 
  GeminiErrorType,
  StreamChunk,
  StreamCallback,
  FunctionDeclaration,
  FunctionCall,
  FunctionResponse
} from './types';