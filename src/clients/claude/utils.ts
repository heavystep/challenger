/**
 * Claude AI 모듈 유틸리티 함수들
 * BLUEPRINT-NEO.md 설계에 따른 핵심 유틸리티만 구현
 */

import type { ChatResponse } from './types';

/**
 * Claude API 응답을 터미널 UI용 문자열 배열로 변환
 * @param res - Claude API 응답 객체
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
    '🤖 Claude:',
    ...lines.map(line => line.trim()).filter(line => line.length > 0)
  ];
};

/**
 * Anthropic API 키 기본 유효성 검증
 * @param key - 검증할 API 키 문자열
 * @returns 유효성 검증 결과 (true/false)
 * @description
 * - API 키가 'sk-ant-' 접두사로 시작하는지 확인
 * - 최소 길이 20자 이상인지 확인
 * - 기본적인 형식 검증만 수행 (실제 API 호출 X)
 */
export const validateApiKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  return key.startsWith('sk-ant-') && key.length > 20;
};