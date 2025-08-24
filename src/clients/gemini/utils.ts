/**
 * Gemini AI 모듈 유틸리티 함수들
 * Claude 모듈과 동일한 인터페이스로 구현
 */

import type { ChatResponse } from './types';

/**
 * Gemini API 응답을 터미널 UI용 문자열 배열로 변환
 * @param res - Gemini API 응답 객체
 * @returns 터미널에 표시할 문자열 배열
 * @description
 * - 에러 시 ❌ 이모지와 함께 에러 메시지 표시
 * - 긴 응답은 80자 기준으로 자동 줄바꿈
 * - 짧은 응답은 🤖 이모지와 함께 한 줄 표시
 */
export const formatForUI = (res: ChatResponse): string[] => {
  // 에러 응답 처리
  if (res.error) {
    return [`❌ ${res.error}`];
  }

  // 80자 이하 짧은 응답
  if (res.content.length <= 80) {
    return ['🤖 ' + res.content];
  }

  // 80자 초과 긴 응답 - 자동 줄바꿈
  const lines = res.content.match(/.{1,80}(\s|$)/g) || [res.content];
  return [
    '🤖 Gemini:',
    ...lines.map(line => line.trim()).filter(line => line.length > 0)
  ];
};

/**
 * Google AI API 키 기본 유효성 검증
 * @param key - 검증할 API 키 문자열
 * @returns 유효성 검증 결과 (true/false)
 * @description
 * - API 키가 'AIza' 접두사로 시작하는지 확인
 * - 최소 길이 39자인지 확인
 * - 기본적인 형식 검증만 수행 (실제 API 호출 X)
 */
export const validateApiKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  return key.startsWith('AIza') && key.length === 39;
};

/**
 * Gemini 에러 메시지를 사용자 친화적으로 변환
 * @param error - 발생한 에러 객체 또는 메시지
 * @returns 사용자에게 표시할 에러 메시지
 */
export const handleGeminiError = (error: any): string => {
  if (typeof error === 'string') {
    const message = error.toLowerCase();
    
    if (message.includes('api_key') || message.includes('authentication') || message.includes('invalid_key')) {
      return 'API 키가 유효하지 않습니다. .env 파일의 GEMINI_API_KEY를 확인하세요.';
    } else if (message.includes('quota') || message.includes('resource_exhausted')) {
      return 'API 할당량을 초과했습니다. 월 사용량을 확인하세요.';
    } else if (message.includes('safety') || message.includes('blocked')) {
      return '안전 필터에 의해 응답이 차단되었습니다. 다른 질문을 시도해보세요.';
    } else if (message.includes('timeout') || message.includes('network')) {
      return '네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 다시 시도하세요.';
    }
    
    return `오류가 발생했습니다: ${error}`;
  }
  
  if (error instanceof Error) {
    return handleGeminiError(error.message);
  }
  
  return '알 수 없는 오류가 발생했습니다.';
};

/**
 * 텍스트를 안전하게 JSON으로 파싱
 * @param text - 파싱할 텍스트
 * @returns 파싱된 객체 또는 원본 텍스트
 */
export const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};