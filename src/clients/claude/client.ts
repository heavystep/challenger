/**
 * Claude AI 클라이언트
 * Anthropic Claude API를 사용한 AI 채팅 기능
 */

import { Anthropic } from '@anthropic-ai/sdk';
import type { ClaudeConfig, ChatResponse, StreamCallback } from './types';
import { validateApiKey } from './utils';

/**
 * Claude AI 클라이언트 클래스
 * @description Anthropic Claude API를 사용한 AI 채팅 기능 제공
 */
export default class ClaudeClient {
  private anthropic: Anthropic;
  private config: ClaudeConfig;

  /**
   * Claude 클라이언트 생성자
   * @param userConfig - 사용자 정의 설정 (선택사항)
   * @description
   * - 환경변수에서 기본 설정 로드
   * - 사용자 설정으로 기본값 오버라이드
   * - API 키 유효성 검증
   */
  constructor(userConfig?: Partial<ClaudeConfig>) {
    // 환경변수에서 기본 설정 로드
    const defaultConfig: ClaudeConfig = {
      apiKey: process.env.CLAUDE_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
      timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000'),
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.0')
    };

    // 사용자 설정과 병합
    this.config = { ...defaultConfig, ...userConfig };

    // API 키 유효성 검증
    if (!validateApiKey(this.config.apiKey)) {
      throw new Error('유효하지 않은 API 키입니다. .env 파일의 CLAUDE_API_KEY를 확인하세요.');
    }

    // Anthropic 클라이언트 초기화
    this.anthropic = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });
  }

  /**
   * 메시지를 Claude AI에 전송하고 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @returns Claude AI 응답 또는 에러 정보
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

      // Claude API 호출
      const response = await this.anthropic.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        messages: [{
          role: 'user',
          content: message.trim()
        }]
      });

      // 응답 파싱 및 반환
      const content = response.content[0];
      if (content.type === 'text') {
        return {
          content: content.text
        };
      } else {
        return {
          content: '',
          error: '텍스트 응답을 받을 수 없습니다.'
        };
      }

    } catch (error) {
      // 에러 타입별 처리
      return {
        content: '',
        error: this.handleError(error)
      };
    }
  }

  /**
   * MCP 도구와 함께 메시지를 Claude AI에 스트리밍으로 전송하고 실시간 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @param tools - MCP 도구 목록
   * @param executeTool - 도구 실행 함수
   * @param onChunk - 각 청크가 도착할 때마다 호출되는 콜백 함수
   * @returns 완료된 전체 응답 또는 에러 정보
   * @description
   * - MCP 도구 통합 지원 + 실시간 스트리밍
   * - tool_use 응답 자동 처리
   * - 도구 실행 결과를 Claude에게 전달
   * - 실시간으로 텍스트 청크를 받아 UI에 표시
   */
  async sendWithToolsStream(
    message: string, 
    tools: any[], 
    executeTool: (toolName: string, toolArgs: any) => Promise<any>,
    onChunk: StreamCallback
  ): Promise<ChatResponse> {
    try {
      // 입력 검증
      if (!message || message.trim().length === 0) {
        const errorChunk: any = {
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
      const messages: any[] = [
        {
          role: 'user',
          content: message.trim()
        }
      ];

      let fullText = '';
      let currentResponse = await this.anthropic.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        messages,
        tools: tools,
        stream: true
      });

      // tool_use 응답 처리 루프 (스트리밍)
      while (true) {
        let hasToolUse = false;
        let currentText = '';
        let currentToolUse: any = null;
        let toolInputJson = '';

        // 스트림에서 응답 처리
        for await (const chunk of currentResponse) {
          if (chunk.type === 'content_block_start') {
            const contentBlock = chunk.content_block;
            
            if (contentBlock.type === 'text') {
              // 텍스트 블록 시작
              currentText = contentBlock.text || '';
            } else if (contentBlock.type === 'tool_use') {
              // 도구 사용 시작
              hasToolUse = true;
              currentToolUse = {
                id: contentBlock.id,
                name: contentBlock.name,
                input: contentBlock.input || {}
              };
              toolInputJson = '';
            }
          } else if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              // 텍스트 청크 스트리밍
              const text = chunk.delta.text;
              currentText += text;
              fullText += text;
              
              // 실시간으로 청크 전송
              const streamChunk: any = {
                text,
                done: false
              };
              onChunk(streamChunk);
            } else if (chunk.delta.type === 'input_json_delta' && currentToolUse) {
              // 도구 입력 JSON 스트리밍
              toolInputJson += chunk.delta.partial_json;
            }
          } else if (chunk.type === 'content_block_stop') {
            if (currentToolUse && hasToolUse) {
              // 도구 사용 완료 - 도구 실행
              try {
                // JSON 파싱 시도
                let toolArgs = currentToolUse.input;
                if (toolInputJson) {
                  try {
                    toolArgs = JSON.parse(toolInputJson);
                  } catch (parseError) {
                    console.warn('Tool input JSON parse error:', parseError);
                    // 기존 input 사용
                  }
                }

                // console.log(`🔧 Claude가 도구 호출: ${currentToolUse.name}`, toolArgs);

                // MCP 도구 실행
                const result = await executeTool(currentToolUse.name, toolArgs);
                
                // 도구 실행 결과를 스트리밍으로 전송
                const toolResultChunk: any = {
                  text: `\n[도구 실행: ${currentToolUse.name}]\n`,
                  done: false
                };
                onChunk(toolResultChunk);
                fullText += `\n[도구 실행: ${currentToolUse.name}]\n`;

                // Claude의 응답(도구 사용 포함)을 메시지에 추가
                messages.push({
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: currentText
                    },
                    {
                      type: 'tool_use',
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      input: toolArgs
                    }
                  ]
                });

                // 도구 결과를 메시지에 추가
                messages.push({
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: currentToolUse.id,
                      content: [
                        {
                          type: 'text',
                          text: JSON.stringify(result)
                        }
                      ]
                    }
                  ]
                });

                // 도구 결과와 함께 Claude에게 다시 요청 (스트리밍)
                currentResponse = await this.anthropic.messages.create({
                  model: this.config.model!,
                  max_tokens: this.config.maxTokens!,
                  temperature: this.config.temperature!,
                  messages,
                  tools: tools,
                  stream: true
                });

                // 새로운 응답 처리 시작
                break;

              } catch (toolError) {
                // console.error(`❌ 도구 실행 실패 (${currentToolUse.name}):`, toolError);
                const errorChunk: any = {
                  text: `\n[도구 실행 실패: ${currentToolUse.name} - ${toolError}]\n`,
                  done: false
                };
                onChunk(errorChunk);
                fullText += `\n[도구 실행 실패: ${currentToolUse.name} - ${toolError}]\n`;
              }
            }
          }
        }

        // tool_use가 없으면 루프 종료
        if (!hasToolUse) {
          break;
        }
      }

      // 스트림 완료 신호
      const doneChunk: any = {
        text: '',
        done: true
      };
      onChunk(doneChunk);

      return {
        content: fullText
      };

    } catch (error) {
      // 에러 발생 시 콜백으로 에러 전송
      const errorMessage = this.handleError(error);
      const errorChunk: any = {
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
   * 스트리밍으로 메시지를 Claude AI에 전송하고 실시간 응답 받기
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
        const errorChunk: any = {
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
      const stream = await this.anthropic.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        messages: [{
          role: 'user',
          content: message.trim()
        }],
        stream: true
      });

      let fullText = '';

      // 스트림 처리
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullText += text;
          
          // 실시간으로 청크 전송
          const streamChunk: any = {
            text,
            done: false
          };
          onChunk(streamChunk);
        }
      }

      // 스트림 완료 신호
      const doneChunk: any = {
        text: '',
        done: true
      };
      onChunk(doneChunk);

      return {
        content: fullText
      };

    } catch (error) {
      // 에러 발생 시 콜백으로 에러 전송
      const errorMessage = this.handleError(error);
      const errorChunk: any = {
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
   * 에러를 사용자 친화적 메시지로 변환
   * @param error - 발생한 에러 객체
   * @returns 사용자에게 표시할 에러 메시지
   * @description
   * - API 키, 네트워크, 타임아웃 등 에러 타입별 분류
   * - 사용자가 이해하기 쉬운 메시지로 변환
   */
  private handleError(error: any): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('api_key') || message.includes('authentication')) {
        return 'API 키가 유효하지 않습니다. .env 파일의 CLAUDE_API_KEY를 확인하세요.';
      } else if (message.includes('timeout') || message.includes('network')) {
        return '네트워크 연결에 실패했습니다. 인터넷 연결을 확인하고 다시 시도하세요.';
      } else if (message.includes('rate_limit')) {
        return 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
      } else if (message.includes('quota')) {
        return 'API 할당량을 초과했습니다. 월 사용량을 확인하세요.';
      } else {
        return `오류가 발생했습니다: ${error.message}`;
      }
    }
    
    return '알 수 없는 오류가 발생했습니다.';
  }
}