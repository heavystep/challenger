import * as React from 'react';
import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
// MODELL 환경변수를 직접 읽어서 사용
import { validateApiKey as validateClaudeApiKey } from '@/clients/claude';
import { validateApiKey as validateGeminiApiKey } from '@/clients/gemini';
import { validateApiKey as validateGPTApiKey } from '@/clients/gpt';

/**
 * AI 모델 상태 표시 패널 컴포넌트
 * @description
 * - MODEL 환경변수에 따라 Claude, Gemini, GPT 등 선택
 * - 선택된 모델의 API 키 상태 확인 및 검증
 * - 키 유효성 검증 및 상태별 색상 표시
 * - Welcome 화면 하단에 박스 형태로 표시
 */
const ApiPanel: React.FC = () => {
  const [status, setStatus] = useState({ 
    color: 'gray', 
    icon: '?', 
    msg: 'Loading...',
  });

  const [model, setModel] = useState('unknown');

  // 모델별 설정 객체 (설정과 스타일 통합)
  const modelConfigs = {
    claude: {
      validator: validateClaudeApiKey,
      icon: '✴',
      color: '#DA7756',
    },
    gemini: {
      validator: validateGeminiApiKey,
      icon: '*',
      color: '#4796E3',
    },
    gpt: {
      validator: validateGPTApiKey,
      icon: '❃',
      color: '#fff',
    },
    unknown: {
       // ⚡
    }
  };

  /**
   * AI 모델 및 API 키 상태 검증 로직
   * @description
   * - MODEL 환경변수에 따라 모델 선택
   * - 선택된 모델의 API 키 로드 및 유효성 검증
   * - 상태별 메시지 및 색상 설정
   */

  // /model
  useEffect(() => {
    try {
      // 모든 환경변수 확인 (디버깅용)
      console.log('All env vars:', {
        MODEL: process.env.MODEL,
        CLAUDE_API_KEY: process.env.CLAUDE_API_KEY ? 'Present' : 'Missing',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Present' : 'Missing',
        GPT_API_KEY: process.env.GPT_API_KEY ? 'Present' : 'Missing',
      });
      
      // MODEL 환경변수에서 모델 타입 결정
      const modeFromEnv = process.env.MODEL?.toLowerCase();
      console.log('MODEL from env:', modeFromEnv); // 디버깅용 로그
      
      const currentModel = modeFromEnv || 'claude'; // 기본값
      console.log('Current model:', currentModel); // 디버깅용 로그
      
      setModel(currentModel);

      // 모델 설정이 존재하는지 확인
      const modelConfig = modelConfigs[currentModel];
      
      if (!modelConfig) {
        setStatus({ 
          color: 'red', 
          icon: '❌',
          msg: `Unsupported model: ${currentModel}`,
        });
        return;
      }

      // API 키 검증
      const apiKey = process.env[`${process.env.MODEL.toUpperCase()}_API_KEY`];
      console.log(`API Key for ${currentModel}:`, apiKey ? 'Present' : 'Missing'); // 디버깅용 로그

      if (!apiKey) {
        setStatus({ 
          color: 'red', 
          icon: '❌',
          msg: 'API key is missing',
        });
      } else if (modelConfig.validator(apiKey)) {
        setStatus({ 
          color: 'green', 
          icon: '✓', 
          msg: 'Ready!!',
        });
      } else {
        setStatus({ 
          color: 'red', 
          icon: '❌',
          msg: 'Invalid API key format',
        });
      }
    } catch (error) {
      console.error('ApiPanel error:', error); // 디버깅용 로그
      setStatus({ 
        color: 'red', 
        icon: '❌',
        msg: 'Configuration error',
      });
    }
  }, []);

  // const { color, icon } = status;
  const modelConfig = modelConfigs[model] || modelConfigs.unknown;

  return (
    <Box marginTop={1} paddingX={1} paddingY={0}>
        <Text>
           <Text backgroundColor={modelConfig.color}><Text color="#000">{` ${modelConfig.icon} `}</Text></Text>{' '}
           <Text color="#fff">{process.env[`${process.env.MODEL.toUpperCase()}_MODEL`]}</Text>{' '}
           <Text color={status.color}>{status.icon}</Text>
        </Text>
    </Box>
  );
};

export default ApiPanel;