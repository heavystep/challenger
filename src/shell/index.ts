/**
 * Shell 컴포넌트 배럴 파일
 * 터미널 UI 컴포넌트들의 중앙 집중식 export 관리
 * 
 * @description
 * - default export 패턴으로 각 컴포넌트를 재export
 * - 단일 import 경로로 모든 shell 컴포넌트에 접근 가능
 * - 모듈 간 의존성 관리 및 코드 구조 개선
 * - 향후 shell 컴포넌트 추가/제거 시 이 파일만 수정하면 됨
 */

export { default as Welcome } from './Welcome';
export { default as Prompt } from './Prompt';
export { default as Processor } from './Processor';
export { default as ApiPanel } from './ApiPanel';
export { default as ChatLog } from './ChatLog';