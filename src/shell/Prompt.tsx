import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput, useStdout, useStdin } from 'ink';
import { commandRegistry } from './cmd';
import { validateCommand } from './parser';
import cliSpinners from 'cli-spinners';
import ApiPanel from './ApiPanel';

/**
 * 프롬프트 컴포넌트 Props 인터페이스
 */
interface PromptProps {
  /** 사용자가 명령어를 입력했을 때 호출되는 콜백 함수 */
  onSubmit: (command: string) => void;
  /** Claude AI 응답 대기 중인지 여부 */
  isWaiting?: boolean;
  /** 이전 입력 히스토리 가져오기 함수 */
  getPreviousInput?: (current: string) => string | null;
  /** 다음 입력 히스토리 가져오기 함수 */
  getNextInput?: () => string | null;
}

/**
 * 사용자 입력 프롬프트 컴포넌트
 * 터미널 스타일의 명령어 입력 인터페이스를 제공
 * 
 * @param {PromptProps} props - 컴포넌트 props
 * @description
 * - 실시간 키보드 입력 처리
 * - Enter 키로 명령어 제출
 * - Backspace/Delete 키로 입력 삭제
 * - Claude Code 스타일 박스 UI
 * - 커서 애니메이션 효과
 * - 자동완성 제안 UI (Tab 키 지원)
 * 
 * @returns {JSX.Element} 프롬프트 입력 UI
 */
const Prompt: React.FC<PromptProps> = ({ onSubmit, isWaiting = false, getPreviousInput, getNextInput }) => {
  const modelStyle = {
    claude: {
      color: '#DA7756',
    },
    gemini: {
      color: '#4796E3',
    },
    gpt: {
      color: '#fff',
    },
    unknown: {
       // ⚡
    }
  };

  /** 현재 입력 중인 명령어 텍스트 */
  const [input, setInput] = useState('');
  /** 커서 위치 */
  const [cursorPosition, setCursorPosition] = useState(0);
  /** 파싱 에러 메시지 */
  const [parseError, setParseError] = useState<string | null>(null);
  /** 스피너 프레임 인덱스 */
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  
  /** 터미널 크기 감지 - 메모이제이션으로 최적화 */
  const { stdout } = useStdout();
  const columns = useMemo(() => stdout?.columns || 80, [stdout?.columns]);
  
  /** Raw mode 지원 확인 */
  const { isRawModeSupported, setRawMode } = useStdin();

  /**
   * 자동완성 제안 계산 - 메모이제이션으로 성능 최적화
   */
  const suggestions = useMemo(() => {
    if (!input.startsWith('/')) return [];
    
    const partialCommand = input.substring(1); // '/' 제거
    const matchingCommands = Object.entries(commandRegistry)
      .filter(([name]) => name.startsWith(partialCommand))
      .map(([name, schema]) => ({
        name,
        description: schema.description,
        args: schema.args
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return matchingCommands;
  }, [input]);

  /**
   * Tab 키 자동완성 처리
   */
  const handleTabCompletion = useCallback(() => {
    if (suggestions.length > 0) {
      const firstSuggestion = suggestions[0];
      const newInput = '/' + firstSuggestion.name;
      setInput(newInput);
      setCursorPosition(newInput.length);
    }
  }, [suggestions]);

  // Raw mode 활성화
  useEffect(() => {
    if (isRawModeSupported) {
      setRawMode(true);
      return () => setRawMode(false);
    }
  }, [isRawModeSupported, setRawMode]);

  // 스피너 애니메이션 - 대기 중일 때만 작동

  const spinner = cliSpinners['aesthetic'];
  useEffect(() => {
    if (!isWaiting) return;

    const interval = setInterval(() => {
      setSpinnerFrame(prev => (prev + 1) % spinner.frames.length);
    }, spinner.interval);

    return () => clearInterval(interval);
  }, [isWaiting]);

  /**
   * 키보드 입력 이벤트 핸들러 (자동완성 기능 및 커서 이동 추가)
   * Raw mode가 지원되는 경우에만 활성화
   */
  const handleInput = useCallback((inputChar: string, key: any) => {
    if (!isRawModeSupported || isWaiting) return; // 대기 중일 때 입력 차단
    
    if (key.return) {
      setInput(currentInput => {
        if (currentInput.trim()) {
          const trimmedInput = currentInput.trim();
          
          // 슬래시로 시작하는 명령어인 경우 파싱 검증
          if (trimmedInput.startsWith('/')) {
            const validation = validateCommand(trimmedInput);
            if (validation.isValid) {
              // 파싱 성공 시 에러 클리어하고 제출
              setParseError(null);
              setTimeout(() => onSubmit(trimmedInput), 0);
              setCursorPosition(0);
              return '';
            } else {
              // 파싱 실패 시 에러 표시하고 입력은 유지
              setParseError(validation.error || '명령어 파싱 에러');
              return currentInput; // 입력 유지
            }
          } else {
            // 일반 텍스트는 바로 제출 (AI 채팅)
            setParseError(null);
            setTimeout(() => onSubmit(trimmedInput), 0);
            setCursorPosition(0);
            return '';
          }
        }
        return currentInput;
      });
    } else if (key.backspace || key.delete) {
      setInput(prev => {
        // 실제 입력 길이와 커서 위치를 비교하여 삭제 가능 여부 결정
        const actualCursorPos = Math.min(cursorPosition, prev.length);
        if (actualCursorPos > 0) {
          const newInput = prev.slice(0, actualCursorPos - 1) + prev.slice(actualCursorPos);
          setCursorPosition(actualCursorPos - 1);
          return newInput;
        }
        return prev;
      });
      // 입력이 변경되면 에러 메시지 클리어
      setParseError(null);
    } else if (key.leftArrow) {
      // 왼쪽 방향키 - 커서 왼쪽으로 이동
      setCursorPosition(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      // 오른쪽 방향키 - 커서 오른쪽으로 이동
      setCursorPosition(prev => Math.min(input.length, prev + 1));
    } else if (key.upArrow) {
      // 위쪽 방향키 - 이전 입력 히스토리 탐색
      if (getPreviousInput) {
        const prevInput = getPreviousInput(input);
        if (prevInput !== null) {
          setInput(prevInput);
          setCursorPosition(prevInput.length);
        }
      }
    } else if (key.downArrow) {
      // 아래쪽 방향키 - 다음 입력 히스토리 탐색
      if (getNextInput) {
        const nextInput = getNextInput();
        if (nextInput !== null) {
          setInput(nextInput);
          setCursorPosition(nextInput.length);
        }
      }
    } else if (key.escape) {
      // Esc 키 - 입력 리셋
      setInput('');
      setCursorPosition(0);
      setParseError(null);
    } else if (key.tab) {
      // Tab 키 자동완성 처리
      handleTabCompletion();
    } else if (inputChar && !key.ctrl && !key.meta && !key.escape) {
      // 한글 입력 및 붙여넣기 지원 개선
      setInput(prev => {
        const actualCursorPos = Math.min(cursorPosition, prev.length);
        // 붙여넣기나 한글 등 멀티바이트 문자 길이 고려
        const charLength = inputChar.length;
        const newInput = prev.slice(0, actualCursorPos) + inputChar + prev.slice(actualCursorPos);
        
        // 커서 위치를 입력된 문자 길이만큼 이동
        setCursorPosition(actualCursorPos + charLength);
        return newInput;
      });
      // 입력이 변경되면 에러 메시지 클리어
      setParseError(null);
    }
  }, [isRawModeSupported, isWaiting, onSubmit, handleTabCompletion, cursorPosition, input.length, getPreviousInput, getNextInput]);

  useInput(handleInput);

  const hints = [ // last child Execute
    { key: '/', description: 'Commands' },
    { key: '↑↓', description: 'History' },
    { key: 'Esc', description: 'Clear' },
    { key: 'Ctrl+C', description: 'Exit' }
  ]

  // Raw mode 지원되지 않는 경우 대체 UI 제공
  if (!isRawModeSupported) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="yellow">⚠️  인터랙티브 입력이 지원되지 않는 환경입니다</Text>
        <Text color="gray">실제 터미널에서 실행하거나 다음 명령어를 사용하세요:</Text>
        <Text color="cyan">  /help  /test  /generate  /cases  /report  /exit</Text>
      </Box>
    );
  }

  // 반응형 레이아웃 계산 - 메모이제이션으로 성능 최적화
  const layoutConfig = useMemo(() => {
    const promptWidth = Math.max(50, Math.min(columns - 4, 120));
    const maxInputLength = Math.max(50, promptWidth - 8); // 충분한 입력 공간 확보
    const showHints = columns >= 60;
    
    return { promptWidth, maxInputLength, showHints };
  }, [columns]);
  
  // 입력 텍스트 표시 - 커서 위치 기반으로 텍스트 분할
  const displayText = useMemo(() => {
    const before = input.slice(0, cursorPosition);
    const after = input.slice(cursorPosition);
    return { before, after };
  }, [input, cursorPosition]);

  return (
    <Box 
      flexDirection="column" 
      marginTop={1}
      flexShrink={0}
    >
      <ApiPanel />
      {/* Claude Code 스타일 박스 프롬프트 */}
      <Box 
        borderStyle="round" 
        borderColor="gray" 
        minWidth={layoutConfig.promptWidth}
        height={3}
        paddingX={1}
        flexShrink={0}
      >
        <Box alignItems="center" flexDirection="row">
          {/* 프롬프트 기호 (녹색 >) 또는 동적 스피너 */}
          <Text color={modelStyle[process.env.MODEL].color} bold>
            {`${isWaiting ? spinner.frames[spinnerFrame] : "❯"} `}
          </Text>
          {/* 대기 중이면 "Wait..." 표시, 아니면 사용자 입력 텍스트 */}
          {isWaiting ? (
            <Text color="yellow"></Text>
          ) : (
            <>
              <Text>{displayText.before}</Text>
              {/* 커서 표시 - 커서 위치에 문자가 있으면 배경색, 없으면 블록 */}
              {displayText.after.length > 0 ? (
                <Text backgroundColor="white" color="black">{displayText.after[0]}</Text>
              ) : (
                <Text color="white" backgroundColor="white"> </Text>
              )}
              <Text>{displayText.after.slice(1)}</Text>
            </>
          )}
        </Box>
      </Box>
      
      {/* 파싱 에러 표시 */}
      {parseError && (
        <Box 
          flexDirection="column" 
          marginLeft={4}
          minWidth={layoutConfig.promptWidth}
          marginBottom={1}
        >
          <Text color="red">❌ {parseError}</Text>
          <Text color="yellow">💡 올바른 형식: /command --argName="값"</Text>
        </Box>
      )}
      
      {/* 자동완성 제안 UI - 조건부 렌더링 (에러가 없을 때만) */}
      {suggestions.length > 0 && !isWaiting && !parseError && (
        <Box 
          flexDirection="column" 
          marginLeft={4}
          minWidth={layoutConfig.promptWidth}
          marginBottom={1}
        >
          {suggestions.map((suggestion, index) => (
            <Box key={suggestion.name} flexDirection="column" marginBottom={index < suggestions.length - 1 ? 1 : 0}>
              {/* 명령어 이름과 설명 */}
              <Box flexDirection="row">
                <Text color="cyan" bold>/{suggestion.name.padEnd(12)}</Text>
                <Text color="white">{suggestion.description}</Text>
              </Box>
              {/* Args 정보 표시 */}
              {Object.keys(suggestion.args).length > 0 && (
                <Box flexDirection="column" marginLeft={2}>
                  {Object.entries(suggestion.args).map(([argName, argInfo]) => (
                    <Box key={argName} flexDirection="row">
                      <Text color="white">
                        {argInfo.required ? <Text color="red">*</Text> : <Text color="gray"> </Text>}--{argName}
                        {argInfo.default !== undefined && <Text color="gray">={argInfo.default}</Text>}
                      </Text>
                      <Box marginX={4}>
                        <Text color="gray">{argInfo.description}</Text>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
      
      {/* 하단 사용 힌트 - 조건부 렌더링 최적화 flexShrink */}
      {layoutConfig.showHints && suggestions.length === 0 && (
        <Box marginLeft={1}>
          <Text color="yellow">💡{` `}
            {hints.map((hint) => (
              <Text key={hint.key}>
                <Text bold>[{hint.key}]</Text> <Text color="white">{hint.description}</Text>{hint.key !== hints[hints.length - 1].key ? ` · ` : ''}
              </Text>
            ))}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default Prompt;