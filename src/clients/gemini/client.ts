/**
 * Gemini AI 클라이언트
 * Google Gemini API를 사용한 AI 채팅 기능
 */

import { GoogleGenAI } from '@google/genai';
import type { GeminiConfig, ChatResponse, StreamChunk, StreamCallback, FunctionDeclaration, FunctionResponse } from './types';
import { validateApiKey, handleGeminiError } from './utils';

/**
 * Gemini AI 클라이언트 클래스
 * @description Google Gemini API를 사용한 AI 채팅 기능 제공 
 * - Google Gemini API와의 HTTP 통신 담당
 * - 환경변수에서 설정 자동 로드
 * - 기본적인 에러 처리 및 응답 포맷팅
 * - Claude 클라이언트와 동일한 인터페이스 제공
 * - 함수 호출(Function Calling) 지원
 */
export default class GeminiClient {
  private ai: GoogleGenAI;
  private config: GeminiConfig;

  /**
   * Gemini 클라이언트 생성자
   * @param userConfig - 사용자 정의 설정 (선택사항)
   * @description
   * - 환경변수에서 기본 설정 로드
   * - 사용자 설정으로 기본값 오버라이드
   * - API 키 유효성 검증
   */
  constructor(userConfig?: Partial<GeminiConfig>) {
    // 환경변수에서 기본 설정 로드
    const defaultConfig: GeminiConfig = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-001',
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '4096'),
      timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000'),
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
      topP: parseFloat(process.env.GEMINI_TOP_P || '0.95'),
      topK: parseInt(process.env.GEMINI_TOP_K || '40')
    };

    // 사용자 설정과 병합
    this.config = { ...defaultConfig, ...userConfig };

    // API 키 유효성 검증
    if (!validateApiKey(this.config.apiKey)) {
      throw new Error('유효하지 않은 API 키입니다. .env 파일의 GEMINI_API_KEY를 확인하세요.');
    }

    // Google GenAI 클라이언트 초기화
    this.ai = new GoogleGenAI({
      apiKey: this.config.apiKey
    });
  }

  /**
   * 메시지를 Gemini AI에 전송하고 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @returns Gemini AI 응답 또는 에러 정보
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

      // Gemini API 호출 (최신 API 구조 사용)
      const response = await this.ai.models.generateContent({
        model: this.config.model!,
        contents: [message.trim()],
        config: {
          temperature: this.config.temperature,
          topP: this.config.topP,
          topK: this.config.topK,
          maxOutputTokens: this.config.maxTokens,
        }
      });

      return {
        content: response.text || ''
      };

    } catch (error) {
      // 에러 타입별 처리
      return {
        content: '',
        error: handleGeminiError(error)
      };
    }
  }

  /**
   * 스트리밍으로 메시지를 Gemini AI에 전송하고 실시간 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @param onChunk - 각 청크가 도착할 때마다 호출되는 콜백 함수
   * @returns 완료된 전체 응답 또는 에러 정보
   * @description
   * - 실시간으로 텍스트 청크를 받아 UI에 표시
   * - 각 청크마다 콜백 함수 호출
   * - 스트림 완료 시 전체 텍스트 반환
   * - Claude 스타일의 정교한 스트리밍 처리
   */
  async sendStream(message: string, onChunk: StreamCallback): Promise<ChatResponse> {
    try {
      // 입력 검증
      if (!message || message.trim().length === 0) {
        const errorChunk: StreamChunk = {
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

      // 스트리밍 API 호출 (최신 API 구조 사용)
      const response = await this.ai.models.generateContentStream({
        model: this.config.model!,
        contents: [message.trim()],
        config: {
          temperature: this.config.temperature,
          topP: this.config.topP,
          topK: this.config.topK,
          maxOutputTokens: this.config.maxTokens,
        }
      });
      
      let fullText = '';

      // 스트림 처리 - 최신 SDK 구조에 맞게 수정
      for await (const chunk of response) {
        if (chunk.text) {
          const text = chunk.text;
          fullText += text;
          
          // 실시간으로 청크 전송
          const streamChunk: StreamChunk = {
            text,
            done: false
          };
          onChunk(streamChunk);
        }
      }

      // 스트림 완료 신호
      const doneChunk: StreamChunk = {
        text: '',
        done: true
      };
      onChunk(doneChunk);

      return {
        content: fullText
      };

    } catch (error) {
      // 에러 발생 시 콜백으로 에러 전송
      const errorMessage = handleGeminiError(error);
      const errorChunk: StreamChunk = {
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
   * 함수 호출과 함께 메시지를 Gemini AI에 스트리밍으로 전송하고 실시간 응답 받기
   * @param message - 사용자 메시지 텍스트
   * @param functions - 함수 선언 목록
   * @param executeFunction - 함수 실행 함수
   * @param onChunk - 각 청크가 도착할 때마다 호출되는 콜백 함수
   * @returns 완료된 전체 응답 또는 에러 정보
   * @description
   * - 함수 호출(Function Calling) 지원 + 실시간 스트리밍
   * - 함수 호출 응답 자동 처리
   * - 함수 실행 결과를 Gemini에게 전달
   * - 실시간으로 텍스트 청크를 받아 UI에 표시
   */
  async sendWithFunctionsStream(
    message: string, 
    functions: FunctionDeclaration[], 
    executeFunction: (functionName: string, functionArgs: any) => Promise<any>,
    onChunk: StreamCallback
  ): Promise<ChatResponse> {
    try {
      // 입력 검증
      if (!message || message.trim().length === 0) {
        const errorChunk: StreamChunk = {
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

      // 채팅 세션 시작 (최신 함수 호출 설정)
      const chat = this.ai.chats.create({
        model: this.config.model!,
        config: {
          temperature: this.config.temperature,
          topP: this.config.topP,
          topK: this.config.topK,
          maxOutputTokens: this.config.maxTokens,
          tools: [{ functionDeclarations: functions }]
        }
      });
      
      let fullText = '';
      let result = await chat.sendMessageStream({
        message: message.trim()
      });

      // 함수 호출 루프
      while (true) {
        let hasFunction = false;
        let lastResponse: any = null;
        
        // 스트림 처리 - 최신 SDK 구조에 맞게 수정
        for await (const chunk of result) {
          if (chunk.text) {
            const text = chunk.text;
            fullText += text;
            
            const streamChunk: StreamChunk = {
              text,
              done: false
            };
            onChunk(streamChunk);
          }
          // 마지막 chunk를 저장 (함수 호출 정보가 포함될 수 있음)
          lastResponse = chunk;
        }

        // 최종 응답에서 함수 호출 확인
        const functionCalls = lastResponse?.functionCalls;
        
        if (functionCalls && functionCalls.length > 0) {
          hasFunction = true;
          
          // 함수 호출 결과 수집
          const functionResponses: FunctionResponse[] = [];
          
          for (const functionCall of functionCalls) {
            try {
              // 함수 실행 알림
              const functionCallChunk: StreamChunk = {
                text: `\n[함수 실행: ${functionCall.name}]\n`,
                done: false
              };
              onChunk(functionCallChunk);
              fullText += `\n[함수 실행: ${functionCall.name}]\n`;

              // 함수 실행
              const functionResult = await executeFunction(functionCall.name, functionCall.args || {});
              
              functionResponses.push({
                name: functionCall.name,
                response: functionResult
              });

            } catch (functionError) {
              // 함수 실행 실패
              const errorChunk: StreamChunk = {
                text: `\n[함수 실행 실패: ${functionCall.name} - ${functionError}]\n`,
                done: false
              };
              onChunk(errorChunk);
              fullText += `\n[함수 실행 실패: ${functionCall.name} - ${functionError}]\n`;
              
              // 에러도 응답으로 추가
              functionResponses.push({
                name: functionCall.name,
                response: { error: String(functionError) }
              });
            }
          }

          // 함수 실행 결과와 함께 다시 전송
          result = await chat.sendMessageStream({
            message: JSON.stringify(functionResponses)
          });
        }

        // 함수 호출이 없으면 루프 종료
        if (!hasFunction) {
          break;
        }
      }

      // 스트림 완료 신호
      const doneChunk: StreamChunk = {
        text: '',
        done: true
      };
      onChunk(doneChunk);

      return {
        content: fullText
      };

    } catch (error) {
      // 에러 발생 시 콜백으로 에러 전송
      const errorMessage = handleGeminiError(error);
      const errorChunk: StreamChunk = {
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