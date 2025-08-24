#!/usr/bin/env node

/**
 * @heavystep/challenger 
 * QA 테스트 자동화 CLI 앱 - 범용 AI 테스트 자동화 기능 테스트
 * 
 * @description Ink 기반 React 터미널 UI를 사용한 QA 자동화 도구
 * @author heavystep
 * @version 1.0.0
 */

import { config } from 'dotenv';

import * as React from 'react';
import { render } from 'ink';

import { useState, useEffect } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { Welcome, Prompt, Processor, ChatLog } from './shell';
import { useChatHistory } from './hooks';

/**
 * 메인 애플리케이션 컴포넌트
 * 화면 상태 관리와 명령어 처리를 담당하는 최상위 컴포넌트
 * 
 * @description 
 * - 첫 명령어 실행 시 화면 지우고 Welcome 숨김
 * - 이후 프롬프트와 컨텐츠만 렌더링
 * - 사용자 명령어 입력 처리 및 라우팅
 * - 종료 명령 처리 (/exit, /quit)
 * 
 * @returns {JSX.Element} 터미널 UI 레이아웃
 */

config();

export const App: React.FC = () => {
  // 앱 시작과 동시에 터미널 clear
  useEffect(() => {
    console.clear();
  }, []);
  /** 현재 처리 중인 명령어 문자열 */
  const [cmd, setCmd] = useState<string>('');
  
  /** 첫 명령어 실행 여부 - Welcome 표시 제어 */
  const [isFirstCommand, setIsFirstCommand] = useState<boolean>(true);
  
  /** Claude AI 응답 대기 중인지 여부 */
  const [isWaiting, setIsWaiting] = useState<boolean>(false);
  
  /** 채팅 히스토리 관리 훅 */
  const chatHistory = useChatHistory();
  
  /** Ink 앱 종료 훅 */
  const { exit } = useApp();
  
  /** 터미널 크기 동적 감지 */
  const { stdout } = useStdout();
  const columns = stdout?.columns || 80;
  const rows = stdout?.rows || 24;

  /**
   * 사용자 명령어 입력 핸들러
   * 
   * @param {string} input - 사용자가 입력한 명령어 문자열
   * @description
   * - 빈 입력 필터링
   * - 첫 명령어 실행 시 화면 지우고 Welcome 숨김
   * - 종료 명령 처리 (/exit, /quit)
   * - 일반 명령어를 Processor로 전달
   */
  const handleCommand = async (input: string) => {
    if (!input.trim()) return;
    
    // 종료 명령어 처리
    if (input === '/exit' || input === '/quit') {
      exit();
      return;
    }

    // 첫 명령어 실행 시 화면 지우고 Welcome 숨김
    if (isFirstCommand) {
      console.clear();
      setIsFirstCommand(false);
    }

    // 대기 상태 설정 및 명령어 전달
    setIsWaiting(true);
    setCmd(input);
  };

  // 반응형 레이아웃 계산
  const minWidth = Math.max(60, columns);
  const minHeight = Math.max(20, rows);

  return (
    <Box flexDirection="column" width={minWidth}>
      {/* 첫 명령어 실행 전에만 Welcome 표시 */}
      {isFirstCommand && <Welcome />}
      
      {/* IRC 스타일 채팅 로그 */}
      <ChatLog messages={chatHistory.messages} />
      
      {/* 명령어 처리 결과 출력 (기존 방식 유지) */}
      <Processor 
        command={cmd} 
        onComplete={() => {
          setCmd('');
          setIsWaiting(false);
        }}
        onWaitingChange={setIsWaiting}
        onAddMessage={chatHistory.addMessage}
        onUpdateLastAiMessage={chatHistory.updateLastAiMessage}
      />
      
      {/* 하단 고정 프롬프트 */}
      <Prompt 
        onSubmit={handleCommand} 
        isWaiting={isWaiting} 
        getPreviousInput={chatHistory.getPreviousInput}
        getNextInput={chatHistory.getNextInput}
      />
    </Box>
  );
};

/**
 * 애플리케이션 진입점
 * Ink render 함수를 사용하여 React 컴포넌트를 터미널에 렌더링
 */
render(<App />);