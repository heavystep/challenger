import { useState, useCallback } from 'react';
import { ChatMessage, MessageSender, ChatHistory } from '@/types';

/**
 * 채팅 히스토리 관리 훅
 * IRC 스타일 대화 로그를 위한 상태 관리
 * 
 * @returns 채팅 히스토리 상태와 관리 함수들
 */
export const useChatHistory = (): ChatHistory => {
  /** 모든 채팅 메시지 배열 */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** 사용자 입력 히스토리 */
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  /** 현재 히스토리 인덱스 */
  const [historyIndex, setHistoryIndex] = useState(-1);
  /** 현재 입력 중인 텍스트 임시저장 */
  const [currentInput, setCurrentInput] = useState('');

  /**
   * 새 메시지 추가 함수
   * 
   * @param sender - 발신자 타입 (user | ai | system)
   * @param content - 메시지 내용
   */
  const addMessage = useCallback((sender: MessageSender, content: string) => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sender,
      content: content.trim(),
      timestamp: new Date(),
      isMultiLine: content.includes('\n') || content.length > 80
    };

    setMessages(prev => [...prev, newMessage]);
    
    // 사용자 메시지인 경우 입력 히스토리에 추가
    if (sender === 'user') {
      addToInputHistory(content.trim());
    }
  }, []);

  /**
   * 마지막 AI 메시지 업데이트 함수 (스트리밍용)
   * 
   * @param content - 업데이트할 메시지 내용
   */
  const updateLastAiMessage = useCallback((content: string) => {
    setMessages(prev => {
      const lastIndex = prev.length - 1;
      
      // 마지막 메시지가 AI 메시지인 경우에만 업데이트
      if (lastIndex >= 0 && prev[lastIndex].sender === 'ai') {
        const updatedMessages = [...prev];
        updatedMessages[lastIndex] = {
          ...updatedMessages[lastIndex],
          content: content.trim(),
          isMultiLine: content.includes('\n') || content.length > 80
        };
        return updatedMessages;
      }
      
      // 마지막 메시지가 AI 메시지가 아니면 그대로 반환
      return prev;
    });
  }, []);

  /**
   * 입력 히스토리에 새 항목 추가
   */
  const addToInputHistory = useCallback((input: string) => {
    if (input.trim() === '') return;
    
    setInputHistory(prev => {
      // 중복 제거 (최근 입력이 같으면 추가하지 않음)
      if (prev[prev.length - 1] === input) return prev;
      
      // 최대 100개까지만 유지
      const newHistory = [...prev, input];
      return newHistory.length > 100 ? newHistory.slice(1) : newHistory;
    });
    
    // 히스토리 인덱스 리셋
    setHistoryIndex(-1);
  }, []);

  /**
   * 이전 입력 히스토리 가져오기 (위 방향키)
   */
  const getPreviousInput = useCallback((current: string): string | null => {
    if (inputHistory.length === 0) return null;
    
    // 처음 히스토리 탐색 시작할 때 현재 입력 임시저장
    if (historyIndex === -1) {
      setCurrentInput(current);
    }
    
    const newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(newIndex);
    return inputHistory[newIndex];
  }, [inputHistory, historyIndex]);

  /**
   * 다음 입력 히스토리 가져오기 (아래 방향키)
   */
  const getNextInput = useCallback((): string | null => {
    if (inputHistory.length === 0 || historyIndex === -1) return null;
    
    const newIndex = historyIndex + 1;
    if (newIndex >= inputHistory.length) {
      // 히스토리 끝에 도달하면 임시저장된 현재 입력 복원
      setHistoryIndex(-1);
      const restored = currentInput;
      setCurrentInput(''); // 임시저장 클리어
      return restored;
    }
    
    setHistoryIndex(newIndex);
    return inputHistory[newIndex];
  }, [inputHistory, historyIndex, currentInput]);

  /**
   * 히스토리 초기화 함수
   */
  const clear = useCallback(() => {
    setMessages([]);
    setInputHistory([]);
    setHistoryIndex(-1);
    setCurrentInput('');
  }, []);

  return {
    messages,
    inputHistory,
    addMessage,
    updateLastAiMessage,
    getPreviousInput,
    getNextInput,
    clear
  };
};

export default useChatHistory;