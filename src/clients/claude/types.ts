/**
 * Claude AI 모듈 타입 정의
 * BLUEPRINT-NEO.md 설계에 따른 경량화된 타입 시스템
 */

/**
 * Claude 클라이언트 설정 인터페이스 (필수 옵션만)
 * @description API 키와 기본 모델 설정을 관리
 */
export interface ClaudeConfig {
  /** Anthropic API 키 (필수) */
  apiKey: string;
  /** 사용할 Claude 모델 (기본: claude-3-5-sonnet-20241022) */
  model?: string;
  /** 최대 토큰 수 (기본: 4096) */
  maxTokens?: number;
  /** 요청 타임아웃 (기본: 30000ms) */
  timeout?: number;
  /** 응답 창의성 조절 (0.0-1.0, 기본: 0.7) */
  temperature?: number;
}

/**
 * AI 채팅 응답 인터페이스
 * @description Claude API 응답을 UI에 맞게 단순화한 구조
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
 * Claude 에러 타입 열거형 (간소화)
 * @description 에러 처리 시 타입별 분류를 위한 열거형
 */
export type ClaudeErrorType = 
  | 'API_KEY'   // API 키 관련 오류
  | 'NETWORK'   // 네트워크 연결 오류
  | 'TIMEOUT'   // 요청 타임아웃
  | 'UNKNOWN';  // 기타 알 수 없는 오류