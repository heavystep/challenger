/**
 * GPT 모듈 유틸리티 함수들
 */

import type { GPTErrorType } from './types';

/**
 * OpenAI API 키 유효성 검증
 * @param apiKey - 검증할 API 키 문자열
 * @returns 유효성 검증 결과 (true/false)
 * @description
 * - API 키가 'sk-' 접두사로 시작하는지 확인
 * - 최소 길이 20자 이상인지 확인
 * - 기본적인 형식 검증만 수행 (실제 API 호출 X)
 */
export function validateApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  return apiKey.startsWith('sk-') && apiKey.length > 20;
}

/**
 * GPT 에러를 사용자 친화적 메시지로 변환
 * @param error - OpenAI API에서 발생한 에러 객체
 * @returns 사용자에게 표시할 에러 메시지
 * @description OpenAI API의 다양한 에러 타입을 한국어로 변환
 */
export function handleGPTError(error: any): string {
  // OpenAI API 특정 에러 코드 처리
  if (error?.code) {
    switch (error.code) {
      case 'invalid_api_key':
      case 'incorrect_api_key':
        return 'API 키가 유효하지 않습니다. .env 파일의 GPT_API_KEY를 확인하세요.';
      case 'rate_limit_exceeded':
        return 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
      case 'quota_exceeded':
        return 'API 할당량을 초과했습니다. 월 사용량을 확인하세요.';
      case 'content_filter':
        return '콘텐츠 정책에 위반되는 내용입니다. 다른 메시지로 시도하세요.';
      case 'model_not_found':
        return '요청한 모델을 찾을 수 없습니다. 모델명을 확인하세요.';
      case 'context_length_exceeded':
        return '입력 텍스트가 너무 깁니다. 짧게 줄여서 다시 시도하세요.';
      default:
        return `GPT API 오류: ${error.message || error.code}`;
    }
  }

  // OpenAI API HTTP 상태 코드 처리
  if (error?.status) {
    switch (error.status) {
      case 401:
        return 'API 키가 유효하지 않습니다. .env 파일의 GPT_API_KEY를 확인하세요.';
      case 429:
        return 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
      case 500:
      case 502:
      case 503:
        return 'OpenAI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도하세요.';
      default:
        return `HTTP 오류 ${error.status}: ${error.message || '알 수 없는 오류'}`;
    }
  }

  // 네트워크 및 타임아웃 에러 처리
  if (error?.message) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('network')) {
      return '네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 다시 시도하세요.';
    }
    
    if (message.includes('fetch')) {
      return '서버 연결에 실패했습니다. 네트워크 상태를 확인하세요.';
    }
  }
  
  return '알 수 없는 오류가 발생했습니다.';
}

/**
 * UI 표시용 응답 포맷팅
 * @param content - GPT 응답 텍스트
 * @returns 포맷팅된 텍스트
 * @description
 * - 연속된 줄바꿈 제거
 * - 앞뒤 공백 제거
 * - 터미널 출력에 최적화
 */
export function formatForUI(content: string): string {
  return content.trim().replace(/\n{3,}/g, '\n\n');
}

/**
 * GPT 에러 타입 분류
 * @param error - 에러 객체
 * @returns GPT 에러 타입
 * @description 에러 객체를 분석하여 적절한 에러 타입 반환
 */
export function classifyGPTError(error: any): GPTErrorType {
  if (error?.code) {
    switch (error.code) {
      case 'invalid_api_key':
      case 'incorrect_api_key':
        return 'API_KEY';
      case 'rate_limit_exceeded':
        return 'RATE_LIMIT';
      case 'quota_exceeded':
        return 'QUOTA';
      case 'content_filter':
        return 'CONTENT';
      default:
        return 'UNKNOWN';
    }
  }
  
  if (error?.message?.toLowerCase().includes('timeout')) {
    return 'TIMEOUT';
  }
  
  if (error?.message?.toLowerCase().includes('network')) {
    return 'NETWORK';
  }
  
  return 'UNKNOWN';
}