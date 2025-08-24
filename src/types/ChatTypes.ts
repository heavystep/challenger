/**
 * 채팅 메시지 타입 정의
 * IRC 스타일 대화 로그를 위한 메시지 구조
 */

/**
 * 메시지 발신자 타입
 */
export type MessageSender = 'user' | 'ai' | 'system';

/**
 * 개별 채팅 메시지 인터페이스
 */
export interface ChatMessage {
  /** 메시지 고유 ID */
  id: string;
  /** 발신자 타입 */
  sender: MessageSender;
  /** 메시지 내용 */
  content: string;
  /** 메시지 전송 시간 */
  timestamp: Date;
  /** 다중 라인 메시지 여부 */
  isMultiLine?: boolean;
}

/**
 * 채팅 히스토리 관리 인터페이스
 */
export interface ChatHistory {
  /** 모든 메시지 배열 */
  messages: ChatMessage[];
  /** 사용자 입력 히스토리 */
  inputHistory: string[];
  /** 새 메시지 추가 */
  addMessage: (sender: MessageSender, content: string) => void;
  /** 마지막 AI 메시지 업데이트 (스트리밍용) */
  updateLastAiMessage: (content: string) => void;
  /** 이전 입력 히스토리 가져오기 */
  getPreviousInput: (current: string) => string | null;
  /** 다음 입력 히스토리 가져오기 */
  getNextInput: () => string | null;
  /** 히스토리 초기화 */
  clear: () => void;
}