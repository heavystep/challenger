/**
 * Gemini AI 모듈 타입 정의
 * Claude 모듈과 동일한 인터페이스 구조로 구현
 */

/**
 * Gemini 클라이언트 설정 인터페이스
 * @description API 키와 기본 모델 설정을 관리
 */
export interface GeminiConfig {
  /** Google API 키 (필수) */
  apiKey: string;
  /** 사용할 Gemini 모델 (기본: gemini-1.5-pro) */
  model?: string;
  /** 최대 출력 토큰 수 (기본: 4096) */
  maxTokens?: number;
  /** 요청 타임아웃 (기본: 30000ms) */
  timeout?: number;
  /** 응답 창의성 조절 (0.0-2.0, 기본: 0.7) */
  temperature?: number;
  /** Top-p 샘플링 (0.0-1.0, 기본: 0.95) */
  topP?: number;
  /** Top-k 샘플링 (1-40, 기본: 40) */
  topK?: number;
}

/**
 * AI 채팅 응답 인터페이스
 * @description Gemini API 응답을 UI에 맞게 단순화한 구조
 */
export interface ChatResponse {
  /** AI 응답 텍스트 */
  content: string;
  /** 에러 발생 시 에러 메시지 */
  error?: string;
}

/**
 * 스트리밍 응답 청크 인터페이스
 * @description 실시간으로 전송되는 텍스트 조각
 */
export interface StreamChunk {
  /** 현재 청크의 텍스트 */
  text: string;
  /** 스트림이 완료되었는지 여부 */
  done: boolean;
  /** 에러 발생 시 에러 메시지 */
  error?: string;
}

/**
 * 스트리밍 콜백 함수 타입
 * @description 각 청크가 도착할 때마다 호출되는 함수
 */
export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * Gemini 에러 타입 열거형
 * @description 에러 처리 시 타입별 분류를 위한 열거형
 */
export type GeminiErrorType = 
  | 'API_KEY'   // API 키 관련 오류
  | 'NETWORK'   // 네트워크 연결 오류
  | 'TIMEOUT'   // 요청 타임아웃
  | 'QUOTA'     // 할당량 초과
  | 'SAFETY'    // 안전 필터링
  | 'UNKNOWN';  // 기타 알 수 없는 오류

/**
 * Gemini 함수 호출 관련 타입들
 */
export interface FunctionDeclaration {
  name: string;
  description?: string;
  parametersJsonSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface FunctionResponse {
  name: string;
  response: Record<string, any>;
}