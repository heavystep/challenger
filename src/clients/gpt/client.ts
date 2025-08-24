/**
 * GPT AI 클라이언트
 * OpenAI GPT API를 사용한 AI 채팅 기능
 */

import OpenAI from 'openai';
import type { GPTConfig, ChatResponse, StreamCallback, GPTFunction } from './types';
import { validateApiKey, handleGPTError } from './utils';

/**
 * GPT AI 클라이언트 클래스
 * @description OpenAI GPT API를 사용한 AI 채팅 기능 제공
 */
export default class GPTClient {
  private openai: OpenAI;
  private config: GPTConfig;

  /**
   * GPT 클라이언트 생성자
   * @param userConfig - 사용자 정의 설정 (선택사항)
   * @description
   * - 환경변수에서 기본 설정 로드
   * - 사용자 설정으로 기본값 오버라이드
   * - API 키 유효성 검증
   */
  constructor(userConfig?: Partial<GPTConfig>) {
    // 환경변수에서 기본 설정 로드
    const defaultConfig: GPTConfig = {
      apiKey: process.env.GPT_API_KEY || '',
      model: process.env.GPT_MODEL || 'gpt-4o',
      maxTokens: parseInt(process.env.GPT_MAX_TOKENS || '4096'),
      timeout: parseInt(process.env.GPT_TIMEOUT || '30000'),
      temperature: parseFloat(process.env.GPT_TEMPERATURE || '0.7'),
      topP: parseFloat(process.env.GPT_TOP_P || '1.0'),
      frequencyPenalty: parseFloat(process.env.GPT_FREQUENCY_PENALTY || '0'),
      presencePenalty: parseFloat(process.env.GPT_PRESENCE_PENALTY || '0')
    };

    // 사용자 설정과 병합
    this.config = { ...defaultConfig, ...userConfig };

    // API 키 유효성 검증
    if (!validateApiKey(this.config.apiKey)) {
      throw new Error('유효하지 않은 API 키입니다. .env 파일의 GPT_API_KEY를 확인하세요.');
    }

    // OpenAI 클라이언트 초기화
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });
  }

  /**
   * 메시지를 GPT AI에 전송하고 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @returns GPT AI 응답 또는 에러 정보
   * @description
   * - 단순한 텍스트 메시지만 지원 (경량화)
   * - 에러 발생 시 적절한 에러 메시지 반환
   * - 타임아웃 및 네트워크 오류 처리
   */
  async send(message: string): Promise<ChatResponse> {
    try {
      // 입력 검증
      if (!message || message.trim().length === 0) {
        return {
          content: '',
          error: '메시지를 입력해주세요.'
        };
      }

      // OpenAI API 호출
      const response = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [{ role: 'user', content: message.trim() }],
        max_completion_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        frequency_penalty: this.config.frequencyPenalty,
        presence_penalty: this.config.presencePenalty
      });

      // 응답 파싱 및 반환
      const content = response.choices[0]?.message?.content;
      if (content) {
        return {
          content: content
        };
      } else {
        return {
          content: '',
          error: '응답을 받을 수 없습니다.'
        };
      }

    } catch (error) {
      // 에러 타입별 처리
      return {
        content: '',
        error: handleGPTError(error)
      };
    }
  }

  /**
   * 스트리밍으로 메시지를 GPT AI에 전송하고 실시간 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @param onChunk - 각 청크가 도착할 때마다 호출되는 콜백 함수
   * @returns 완료된 전체 응답 또는 에러 정보
   * @description
   * - 실시간으로 텍스트 청크를 받아 UI에 표시
   * - 각 청크마다 콜백 함수 호출
   * - 스트림 완료 시 전체 텍스트 반환
   */
  async sendStream(message: string, onChunk: StreamCallback): Promise<ChatResponse> {
    try {
      // 입력 검증
      if (!message || message.trim().length === 0) {
        const errorChunk = {
          text: '',
          done: true,
          error: '메시지를 입력해주세요.'
        };
        onChunk(errorChunk);
        return {
          content: '',
          error: '메시지를 입력해주세요.'
        };
      }

      // 스트리밍 API 호출
      const stream = await this.openai.chat.completions.create({
        model: this.config.model!,
        messages: [{ role: 'user', content: message.trim() }],
        max_completion_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        frequency_penalty: this.config.frequencyPenalty,
        presence_penalty: this.config.presencePenalty,
        stream: true
      });

      let fullText = '';

      // 스트림 처리
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          
          // 실시간으로 청크 전송
          const streamChunk = {
            text: delta,
            done: false
          };
          onChunk(streamChunk);
        }
      }

      // 스트림 완료 신호
      const doneChunk = {
        text: '',
        done: true
      };
      onChunk(doneChunk);

      return {
        content: fullText
      };

    } catch (error) {
      // 에러 발생 시 콜백으로 에러 전송
      const errorMessage = handleGPTError(error);
      const errorChunk = {
        text: '',
        done: true,
        error: errorMessage
      };
      onChunk(errorChunk);

      return {
        content: '',
        error: errorMessage
      };
    }
  }

  /**
   * 함수 호출과 함께 메시지를 GPT AI에 스트리밍으로 전송
   * @param message - 사용자 메시지 텍스트
   * @param functions - 사용 가능한 함수 목록
   * @param executeFunction - 함수 실행 콜백
   * @param onChunk - 각 청크가 도착할 때마다 호출되는 콜백 함수
   * @returns 완료된 전체 응답 또는 에러 정보
   * @description
   * - OpenAI Function Calling 지원
   * - 함수 호출 결과를 다시 GPT에 전달하여 최종 응답 생성
   * - 실시간 스트리밍 지원
   */
  async sendWithFunctionsStream(
    message: string, 
    functions: GPTFunction[], 
    executeFunction: (functionName: string, functionArgs: any) => Promise<any>,
    onChunk: StreamCallback
  ): Promise<ChatResponse> {
    try {
      // 입력 검증
      if (!message || message.trim().length === 0) {
        const errorChunk = {
          text: '',
          done: true,
          error: '메시지를 입력해주세요.'
        };
        onChunk(errorChunk);
        return {
          content: '',
          error: '메시지를 입력해주세요.'
        };
      }

      // 메시지 히스토리 초기화
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: message.trim()
        }
      ];

      let fullText = '';

      // Function Calling이 있는 경우 루프 처리
      while (true) {
        // GPT API 호출 (함수와 함께)
        const response = await this.openai.chat.completions.create({
          model: this.config.model!,
          messages,
          max_completion_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          top_p: this.config.topP,
          frequency_penalty: this.config.frequencyPenalty,
          presence_penalty: this.config.presencePenalty,
          tools: functions.map(func => ({
            type: 'function' as const,
            function: func
          })),
          tool_choice: 'auto',
          stream: true
        });

        let currentMessage = '';
        let toolCalls: any[] = [];
        let currentToolCall: any = null;

        // 스트림 처리
        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta;
          
          if (delta?.content) {
            // 텍스트 응답 스트리밍
            const text = delta.content;
            currentMessage += text;
            fullText += text;
            
            const streamChunk = {
              text,
              done: false
            };
            onChunk(streamChunk);
          }
          
          if (delta?.tool_calls) {
            // Function Calling 처리
            for (const toolCall of delta.tool_calls) {
              if (toolCall.index !== undefined) {
                if (!toolCalls[toolCall.index]) {
                  toolCalls[toolCall.index] = {
                    id: '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                  };
                }
                
                if (toolCall.id) {
                  toolCalls[toolCall.index].id = toolCall.id;
                }
                
                if (toolCall.function?.name) {
                  toolCalls[toolCall.index].function.name = toolCall.function.name;
                }
                
                if (toolCall.function?.arguments) {
                  toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }

        // 응답 메시지를 히스토리에 추가
        if (currentMessage || toolCalls.length > 0) {
          const assistantMessage: any = {
            role: 'assistant',
            content: currentMessage || null
          };
          
          if (toolCalls.length > 0) {
            assistantMessage.tool_calls = toolCalls;
          }
          
          messages.push(assistantMessage);
        }

        // Function Calling이 있는 경우 처리
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            try {
              // 함수 인자 파싱
              const functionArgs = JSON.parse(toolCall.function.arguments);
              
              // 함수 실행 알림
              const toolNoticeChunk = {
                text: `\n[함수 실행: ${toolCall.function.name}]\n`,
                done: false
              };
              onChunk(toolNoticeChunk);
              fullText += `\n[함수 실행: ${toolCall.function.name}]\n`;

              // 함수 실행
              const result = await executeFunction(toolCall.function.name, functionArgs);
              
              // 함수 결과를 메시지에 추가
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
              });

            } catch (error) {
              // 함수 실행 실패
              const errorChunk = {
                text: `\n[함수 실행 실패: ${toolCall.function.name} - ${error}]\n`,
                done: false
              };
              onChunk(errorChunk);
              fullText += `\n[함수 실행 실패: ${toolCall.function.name} - ${error}]\n`;
              
              // 에러 메시지를 히스토리에 추가
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `Error: ${error}`
              });
            }
          }
          
          // 함수 결과와 함께 다시 GPT 호출 (루프 계속)
          continue;
        } else {
          // Function Calling이 없으면 루프 종료
          break;
        }
      }

      // 스트림 완료 신호
      const doneChunk = {
        text: '',
        done: true
      };
      onChunk(doneChunk);

      return {
        content: fullText
      };

    } catch (error) {
      // 에러 발생 시 콜백으로 에러 전송
      const errorMessage = handleGPTError(error);
      const errorChunk = {
        text: '',
        done: true,
        error: errorMessage
      };
      onChunk(errorChunk);

      return {
        content: '',
        error: errorMessage
      };
    }
  }
}