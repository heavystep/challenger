import * as React from 'react';
import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { createAIClient, getCurrentModel } from '@/clients';
import { parseCommand, isValidCommand } from './parser';
import { hasCommand, getCommand } from './cmd';

/**
 * 명령어 처리기 컴포넌트 Props 인터페이스
 */
interface ProcessorProps {
  /** 처리할 명령어 문자열 */
  command: string;
  /** 명령어 처리 완료 시 호출되는 콜백 함수 */
  onComplete: () => void;
  /** 대기 상태 변경 콜백 함수 */
  onWaitingChange: (waiting: boolean) => void;
  /** 채팅 메시지 추가 콜백 함수 */
  onAddMessage?: (sender: 'user' | 'ai' | 'system', content: string) => void;
  /** 마지막 AI 메시지 업데이트 콜백 함수 (스트리밍용) */
  onUpdateLastAiMessage?: (content: string) => void;
}

/**
 * 명령어 처리 및 출력 컴포넌트
 * 사용자가 입력한 명령어를 파싱하고 실행하여 결과를 표시
 * 
 * @param props - 컴포넌트 props
 * @description
 * - 모듈화된 명령어 시스템 사용
 * - 명령어별 핸들러를 레지스트리에서 조회
 * - 출력 결과를 배열로 관리하여 다중 라인 표시
 * - 색상별 메시지 타입 구분 (에러: 빨강, 경고: 노랑)
 * - 비동기 명령어 처리 지원
 * 
 * @returns 명령어 출력 결과 또는 null
 */
const Processor: React.FC<ProcessorProps> = ({ 
  command, 
  onComplete,
  onWaitingChange,
  onAddMessage,
  onUpdateLastAiMessage
}) => {
  /** 명령어 처리 결과 출력 라인들의 배열 */
  const [output, setOutput] = useState<string[]>([]);

  /**
   * 명령어 변경 시 자동 처리 트리거
   * command prop이 변경될 때마다 명령어 핸들링 시작
   */
  useEffect(() => {
    if (!command) return;
    handle(command);
  }, [command]);

  /**
   * 메인 명령어 핸들러
   * 입력받은 명령어를 파싱하고 적절한 처리 함수로 라우팅
   * 
   * @param cmd - 처리할 명령어 문자열
   * @description
   * - 별칭 명령어 먼저 확인 (슬래시 없이)
   * - 명령어 형식 검증 (/ 시작 여부)
   * - 명령어와 인수 분리
   * - 레지스트리에서 명령어 조회 및 실행
   * - 알 수 없는 명령어 에러 처리
   * - 처리 완료 후 onComplete 콜백 호출
   */
  const handle = async (cmd: string) => {
    // 사용자 입력을 채팅 로그에 추가
    if (onAddMessage) {
      onAddMessage('user', cmd);
    }

    // 슬래시 없는 입력은 바로 AI로 전송 (환경변수 MODEL에 따라 Claude/Gemini 자동 선택)
    if (!cmd.startsWith('/')) {
      try {
        onWaitingChange(true); // 대기 시작
        const client = createAIClient();
        // const currentModel = getCurrentModel();
        
        // // 현재 사용 중인 모델 표시 (디버깅용)
        // if (currentModel) {
        //   console.log(`🤖 Using ${currentModel.toUpperCase()} model`);
        // }
        
        let streamingMessage = '';
        let isFirstChunk = true;
        let streamingFailed = false;
        
        try {
          // 1차 시도: 스트리밍으로 응답 받기
          await client.sendStream(cmd, (chunk) => {
            if (chunk.error) {
              // 스트리밍 중 에러 발생 - fallback 표시
              streamingFailed = true;
              return;
            }
            
            if (!chunk.done && !streamingFailed) {
              // 스트리밍 중: 텍스트 누적
              streamingMessage += chunk.text;
              
              if (isFirstChunk && onAddMessage) {
                // 첫 번째 청크: 새 AI 메시지 추가
                onAddMessage('ai', streamingMessage);
                isFirstChunk = false;
              } else if (!isFirstChunk && onUpdateLastAiMessage) {
                // 후속 청크: 마지막 AI 메시지 업데이트
                onUpdateLastAiMessage(streamingMessage);
              }
            }
            // chunk.done이 true면 스트리밍 완료
          });
          
          // 스트리밍이 실패했으면 fallback 실행
          if (streamingFailed) {
            throw new Error('Streaming failed, trying fallback');
          }
          
        } catch (streamError) {
          // 2차 시도: 일반 API로 fallback
          console.log('스트리밍 실패, 일반 모드로 전환');
          const response = await client.send(cmd);
          
          // AI 응답을 채팅 로그에 추가
          if (onAddMessage && response.content) {
            onAddMessage('ai', response.content);
          } else if (response.error && onAddMessage) {
            onAddMessage('system', `❌ AI 응답 오류: ${response.error}`);
          }
        }
        
        // Processor 자체 출력은 제거 (ChatLog로 통합)
        setOutput([]);
      } catch (error) {
        const errorMsg = [`❌ AI 기능을 사용할 수 없습니다.`, `💡 현재 모델(${getCurrentModel() || 'unknown'})의 API 키를 .env에 설정해주세요.`];
        setOutput(errorMsg);
        if (onAddMessage) {
          onAddMessage('system', errorMsg.join('\n'));
        }
      } finally {
        onWaitingChange(false); // 대기 종료
      }
      onComplete();
      return;
    }

    // 새로운 파인튜닝 명령 시스템 우선 체크
    try {
      if (isValidCommand(cmd)) {
        const parsedCmd = parseCommand(cmd);
        
        if (hasCommand(parsedCmd.name)) {
          // 파인튜닝 명령어 실행
          const command = getCommand(parsedCmd.name);
          
          // MCP 명령어는 대기 상태 표시
          if (parsedCmd.name === 'mcp') {
            onWaitingChange(true);
          }
          
          const result = await command.execute(parsedCmd, {
            onAddMessage,
            onUpdateLastAiMessage
          });
          
          // MCP 명령어는 이미 스트리밍 처리됨 (onUpdateLastAiMessage로 실시간 업데이트)
          if (parsedCmd.name === 'mcp') {
            // MCP 명령어는 이미 실시간으로 스트리밍되었으므로 추가 결과 표시 불필요
            onWaitingChange(false); // 대기 상태 해제
            setOutput([]);
            onComplete();
            return;
          }
          
          // 프롬프트가 있으면 스트리밍으로 AI 호출
          if (result.success && result.prompt && onAddMessage && onUpdateLastAiMessage) {
            try {
              onWaitingChange(true);
              const client = createAIClient();
              
              let streamingMessage = '';
              let isFirstChunk = true;
              let streamingFailed = false;
              
              try {
                await client.sendStream(result.prompt, (chunk) => {
                  if (chunk.error) {
                    streamingFailed = true;
                    return;
                  }
                  
                  if (!chunk.done && !streamingFailed) {
                    streamingMessage += chunk.text;
                    
                    if (isFirstChunk) {
                      // 첫 번째 청크: 새 AI 메시지 추가 (🤖 헤더 없이)
                      onAddMessage('ai', streamingMessage);
                      isFirstChunk = false;
                    } else {
                      // 후속 청크: 마지막 AI 메시지 업데이트
                      onUpdateLastAiMessage(streamingMessage);
                    }
                  }
                });
                
                if (!streamingFailed) {
                  setOutput([]);
                  onWaitingChange(false);
                  onComplete();
                  return;
                }
              } catch (streamError) {
                // Fallback: 일반 API 호출
                const response = await client.send(result.prompt);
                onAddMessage('ai', response.content);
              }
              
              onWaitingChange(false);
            } catch (error) {
              onWaitingChange(false);
              onAddMessage('system', `❌ AI 기능을 사용할 수 없습니다.\n💡 현재 모델(${getCurrentModel() || 'unknown'})의 API 키를 .env에 설정해주세요.`);
            }
          } else {
            // 일반 명령어 결과 처리
            if (onAddMessage) {
              if (result.success) {
                onAddMessage('ai', result.output.join('\n'));
              } else {
                onAddMessage('system', result.output.join('\n'));
              }
            }
          }
          
          setOutput([]);
          onComplete();
          return;
        }
      }
    } catch (parseError) {
      // 파싱 에러는 기존 시스템으로 fallback
    }

    // 파인튜닝 시스템에서 찾을 수 없는 명령어 에러 처리
    const [name] = cmd.slice(1).split(' ');
    const errorMsg = [
      `❌ 알 수 없는 명령어: /${name}`,
      '사용 가능한 명령어를 보려면 /help를 입력하세요.'
    ];
    
    if (onAddMessage) {
      onAddMessage('system', errorMsg.join('\n'));
    }

    onComplete();
  };


  // 출력할 내용이 없으면 렌더링하지 않음
  if (output.length === 0) return null;

  return (
    <Box flexDirection="column">
      {/* 출력 라인별 렌더링 및 색상 적용 */}
      {output.map((line, index) => (
        <Text 
          key={index} 
          color={line.includes('❌') ? 'red' : line.includes('⚠️') ? 'yellow' : 'white'}
        >
          {line}
        </Text>
      ))}
    </Box>
  );
};

export default Processor;