/**
 * AI 모듈 공통 타입 정의
 * Claude와 Gemini 클라이언트 간의 통합 인터페이스
 */

/**
 * 지원되는 AI 모델 타입
 */
export type AIModelType = 'claude' | 'gemini' | 'gpt';

/**
 * AI 채팅 응답 인터페이스 (공통)
 * @description Claude와 Gemini 모든 클라이언트에서 사용하는 통합 응답 형식
 */
export interface ChatResponse {
  /** AI 응답 텍스트 */
  content: string;
  /** 에러 발생 시 에러 메시지 */
  error?: string;
}

/**
 * 스트리밍 응답 청크 인터페이스 (공통)
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
 * 스트리밍 콜백 함수 타입 (공통)
 * @description 각 청크가 도착할 때마다 호출되는 함수
 */
export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * AI 클라이언트 통합 인터페이스
 * @description Claude와 Gemini 클라이언트가 구현해야 하는 공통 메서드
 */
export interface AIClient {
  /**
   * 메시지를 AI에 전송하고 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @returns AI 응답 또는 에러 정보
   */
  send(message: string): Promise<ChatResponse>;

  /**
   * 스트리밍으로 메시지를 AI에 전송하고 실시간 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @param onChunk - 각 청크가 도착할 때마다 호출되는 콜백 함수
   * @returns 완료된 전체 응답 또는 에러 정보
   */
  sendStream(message: string, onChunk: StreamCallback): Promise<ChatResponse>;
}

/**
 * 도구/함수 관련 통합 타입들
 */
export interface Tool {
  name: string;
  description: string;
  parameters: any;
}

export interface ToolCall {
  name: string;
  args: any;
}

export interface ToolResponse {
  name: string;
  response: any;
}

/**
 * AI 클라이언트 팩토리 설정
 */
export interface AIFactoryConfig {
  /** 사용할 AI 모델 ('claude' | 'gemini' | 'gpt') */
  model: AIModelType;
  /** Claude 전용 설정 */
  claudeConfig?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    timeout?: number;
    temperature?: number;
  };
  /** Gemini 전용 설정 */
  geminiConfig?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    timeout?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  /** GPT 전용 설정 */
  gptConfig?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    timeout?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
}