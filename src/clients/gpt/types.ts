/**
 * GPT AI 모듈 타입 정의
 * Claude 및 Gemini와 동일한 인터페이스 구조로 구현
 */

/**
 * GPT 클라이언트 설정 인터페이스
 * @description API 키와 기본 모델 설정을 관리
 */
export interface GPTConfig {
  /** OpenAI API 키 (필수) */
  apiKey: string;
  /** 사용할 GPT 모델 (기본: gpt-4o) */
  model?: string;
  /** 최대 출력 토큰 수 (기본: 4096) */
  maxTokens?: number;
  /** 요청 타임아웃 (기본: 30000ms) */
  timeout?: number;
  /** 응답 창의성 조절 (0.0-2.0, 기본: 0.7) */
  temperature?: number;
  /** Top-p 샘플링 (0.0-1.0, 기본: 1.0) */
  topP?: number;
  /** Frequency penalty (-2.0-2.0, 기본: 0) */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0-2.0, 기본: 0) */
  presencePenalty?: number;
}

/**
 * ChatResponse, StreamChunk, StreamCallback는 공통 타입 사용
 */
export type { ChatResponse, StreamChunk, StreamCallback } from '../types';

/**
 * GPT 에러 타입 열거형
 * @description 에러 처리 시 타입별 분류를 위한 열거형
 */
export type GPTErrorType = 
  | 'API_KEY'     // API 키 관련 오류
  | 'NETWORK'     // 네트워크 연결 오류
  | 'TIMEOUT'     // 요청 타임아웃
  | 'QUOTA'       // 할당량 초과
  | 'RATE_LIMIT'  // 속도 제한
  | 'CONTENT'     // 콘텐츠 정책 위반
  | 'UNKNOWN';    // 기타 알 수 없는 오류

/**
 * GPT 도구 호출 관련 타입들 (Function Calling)
 */
export interface GPTFunction {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface GPTFunctionCall {
  name: string;
  arguments: string; // JSON string
}

export interface GPTToolCall {
  id: string;
  type: 'function';
  function: GPTFunctionCall;
}

export interface GPTToolResponse {
  tool_call_id: string;
  role: 'tool';
  content: string;
}