import * as React from 'react';
import { Box, Text } from 'ink';
import { ChatMessage, MessageSender } from '@/types';

/**
 * 채팅 로그 컴포넌트 Props 인터페이스
 */
interface ChatLogProps {
  /** 표시할 채팅 메시지 배열 */
  messages: ChatMessage[];
}

/**
 * IRC 스타일 채팅 로그를 표시하는 컴포넌트
 * 사용자와 AI의 모든 대화를 순차적으로 표시
 * 
 * @param props - 컴포넌트 props
 * @description
 * - 사용자 메시지: 👤 이모지와 함께 표시
 * - AI 메시지: 🤖 이모지와 함께 표시  
 * - 시스템 메시지: ⚙️ 이모지와 함께 표시
 * - 긴 메시지는 다중 라인으로 표시
 * - 시간순으로 정렬된 대화 로그 유지
 * 
 * @returns IRC 스타일 채팅 로그 UI
 */
const ChatLog: React.FC<ChatLogProps> = ({ messages }) => {
  /**
   * 발신자 타입에 따른 이모지 반환
   * @param sender - 메시지 발신자 타입
   * @returns 해당하는 이모지 문자열
   */
  const getSenderIcon = (sender: MessageSender): string => {
    switch (sender) {
      case 'user': return '👤';
      case 'ai': return '🤖';
      case 'system': return '⚙️';
      default: return '💬';
    }
  };

  /**
   * 발신자 타입에 따른 텍스트 색상 반환
   * @param sender - 메시지 발신자 타입
   * @returns Ink 호환 색상 문자열
   */
  const getSenderColor = (sender: MessageSender): string => {
    switch (sender) {
      case 'user': return 'cyan';
      case 'ai': return 'green';
      case 'system': return 'yellow';
      default: return 'white';
    }
  };

  // 메시지가 없으면 렌더링하지 않음
  if (messages.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {messages.map((message) => (
        <Box key={message.id} flexDirection="row" marginBottom={1}>
          {/* 발신자 아이콘 */}
          <Text color={getSenderColor(message.sender)} bold>
            {getSenderIcon(message.sender)} 
          </Text>
          
          {/* 메시지 내용 */}
          <Box flexDirection="column" marginLeft={1}>
            {message.isMultiLine ? (
              // 다중 라인 메시지 처리
              message.content.split('\n').map((line, index) => (
                <Text key={index} color="white">
                  {line}
                </Text>
              ))
            ) : (
              // 단일 라인 메시지
              <Text color="white">{message.content}</Text>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default ChatLog;