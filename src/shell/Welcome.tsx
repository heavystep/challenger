import * as React from 'react';
import { Box, Text, useStdout } from 'ink';
import ApiPanel from './ApiPanel';
import Gradient, { type GradientName } from 'ink-gradient';

// 타입 안전한 랜덤 값 선택 유틸리티
const getRandomValue = <T extends string>(values: readonly T[]): T => 
  values[Math.floor(Math.random() * values.length)];

// GradientName의 모든 가능한 값들
const GRADIENT_NAMES: readonly GradientName[] = [
   'teen', 'mind', 'vice',
  'atlas', 'retro', 'pastel'
] as const; `sc`

/**
 * 환영 화면 컴포넌트 (상단 고정 헤더)
 * Claude Code UI 스타일로 상단에 고정되어 표시되는 브랜딩 및 명령어 안내 헤더
 * 
 * @description
 * - QA Challenger CLI 브랜딩 표시
 * - 주요 명령어 목록 안내
 * - 프롬프트 위에 고정 표시되는 헤더 역할
 * 
 * @returns {JSX.Element} 환영 화면 UI 레이아웃
 */
const Welcome: React.FC = () => {
  const ASCII_LOGO =
`    __                                __           
   / /_  ___  ____ __   ____  _______/ /____  ____ 
  / __ \\/ _ \\/ __ \\/ | / / / / / ___/ __/ _ \\/ __ \\
 / / / /  __/ /_/ /| |/ / /_/ (__  ) /_/  __/ /_/ /
/_/ /_/\\___/\\__,_/ |___/\\__, /____/\\__/\\___/ .___/ 
                       /____/             /_/         
`;
  
  // const { stdout } = useStdout();
  // const columns = stdout?.columns || 80;

  // 컴포넌트 마운트 시 랜덤 그라디언트 선택
  const [randomGradient] = React.useState(() => getRandomValue(GRADIENT_NAMES));

  return (
    <Box flexDirection="column" flexShrink={0}>
      <Box marginLeft={1}>
        <Gradient name={randomGradient}>
          <Text>{ASCII_LOGO}</Text>
        </Gradient>
      </Box>
      
      <Box flexDirection="column" paddingX={1}>
        <Text color="white" bold>
          Heavystep Challenger
        </Text> 
        <Text color="white">
          AI✨ powered QA Automation CLI
        </Text>
      </Box>
    </Box>
  );
};

export default Welcome;