/**
 * MCP 브라우저 제어 명령어 클래스
 * /mcp --url="[URL]" --act="[액션]" 형식으로 브라우저 자동화 실행
 */

import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';
import { exposeBrowserTools, convertMCPToolsToGeminiFunctions, convertMCPToolsToGPTFunctions } from '@/mcp';
import { createAIClient, getCurrentModel } from '@/clients';
import { geminiMcpPrompt } from '@/prompts';
import gptMcpPrompt from '@/prompts/gptMcp';

/**
 * MCP 브라우저 제어 명령어 클래스
 */
export class MCPCommand extends Command {
  readonly name = 'mcp';
  readonly description = 'Playwright를 통한 브라우저 자동화 제어';
  
  readonly args = {
    url: {
      type: 'string' as const,
      required: true,
      description: '브라우저로 이동할 URL (선택사항)'
    },
    act: {
      type: 'string' as const,
      required: true,
      description: '수행할 브라우저 액션 (예: "검색창에 일렉트론 검색")'
    }
  };

  /**
   * 명령어 실행 - 실제 MCP 브라우저 자동화 실행
   */
  async execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult> {
    try {
      // 인수 검증
      const validation = this.validateArgs(parsedCmd);
      if (!validation.valid) {
        return {
          success: false,
          output: [
            `❌ ${validation.error}`,
            `💡 사용법: ${this.getUsage()}`,
            '',
            '인수 설명:',
            ...this.getArgsDescription(),
            '',
            '예시:',
            '  /mcp --url="https://github.com" --act="검색창에 electron 검색하고 첫 번째 결과 클릭"',
            '  /mcp --act="현재 페이지에서 로그인 버튼 클릭"'
          ],
          error: validation.error
        };
      }

      // 인수 추출
      const url = parsedCmd.args.url as string | undefined;
      const act = parsedCmd.args.act as string;
      
      // MCP 브라우저 도구 초기화
      const browserTools = await exposeBrowserTools();
      const results: string[] = [];
      
      try {
        // 공식 Playwright MCP는 자동으로 페이지를 생성하므로 별도 createPage 불필요
        
        if (url) {
          // 1단계: URL로 네비게이션 (공식 MCP는 자동으로 페이지 생성)
          console.log('🌐 MCP: URL로 네비게이션 중...', { url });
          await browserTools.executeTool('browser_navigate', { url });
          console.log('✅ MCP: 네비게이션 완료');
          
          // 페이지 로딩 대기
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // 2단계: 페이지 스냅샷 가져오기 (공식 MCP 함수명 사용)
        console.log('📷 MCP: 페이지 스냅샷 캡처 중...');
        const snapshot = await browserTools.executeTool('browser_snapshot', {});
        console.log('✅ MCP: 스냅샷 캡처 완료');
        
        // 3단계: AI에게 액션 수행 요청 (모델별 분기 처리)
        
        // MCP 도구 목록 가져오기
        const availableTools = await browserTools.getToolsForClaude();
        
        // AI 클라이언트 생성 (환경변수에 따라 Claude/Gemini 자동 선택)
        const aiClient = createAIClient();
        const currentModel = getCurrentModel();
        
        let streamingMessage = '';
        let isFirstChunk = true;
        let aiResponse;
        
        // 응답 시간 측정을 위한 타임스탬프
        const startTimestamp = Date.now();
        console.log(`⏱️ AI 응답 시작: ${new Date(startTimestamp).toISOString()}`);
        let endTimestamp: number;
        let responseTimeLogged = false;
        
        if (currentModel === 'gemini') {
          // Gemini용: 함수 호출 방식 사용
          console.log('🤖 Gemini 모델 감지: 함수 호출 방식으로 MCP 도구 실행');
          
          const geminiFunctions = convertMCPToolsToGeminiFunctions(availableTools);
          console.log(`📋 Gemini 함수 ${geminiFunctions.length}개 변환됨:`, geminiFunctions.map(f => f.name));
          
          // GeminiClient의 sendWithFunctionsStream 메서드 직접 호출
          const geminiClient = aiClient as any; // 타입 캐스팅
          
          console.log('🚀 Gemini 함수 호출 시작...');
          // Gemini 함수 호출을 위한 프롬프트 개선
          const enhancedPrompt = geminiMcpPrompt({ url, act, geminiFunctions });

          console.log('📝 개선된 프롬프트:', enhancedPrompt);
          
          aiResponse = await geminiClient.sendWithFunctionsStream(
            enhancedPrompt,
            geminiFunctions,
            async (functionName: string, functionArgs: any) => {
              console.log(`🔧 Gemini 함수 실행: ${functionName}`, functionArgs);
              // 함수 실행 결과를 MCP 도구로 변환하여 실행
              const result = await browserTools.executeTool(functionName, functionArgs);
              console.log(`✅ 함수 실행 결과:`, result);
              return result;
            },
            (chunk) => {
              // 스트리밍 청크 처리 (Claude와 동일)
              if (chunk.error) {
                results.push(`❌ 스트리밍 오류: ${chunk.error}`);
                return;
              }
              
              if (!chunk.done) {
                // 텍스트 누적
                streamingMessage += chunk.text;
                
                if (isFirstChunk && context?.onAddMessage) {
                  // 첫 번째 청크: 새 AI 메시지 추가
                  context.onAddMessage('ai', streamingMessage);
                  isFirstChunk = false;
                } else if (!isFirstChunk && context?.onUpdateLastAiMessage) {
                  // 후속 청크: 마지막 AI 메시지 업데이트
                  context.onUpdateLastAiMessage(streamingMessage);
                }
              } else {
                // 스트리밍 완료 시 타임스탬프 기록 (Gemini)
                endTimestamp = Date.now();
                responseTimeLogged = true;
              }
            }
          );
        } else if (currentModel === 'gpt') {
          // GPT용: OpenAI 함수 호출 방식 사용
          console.log('🤖 GPT 모델 감지: OpenAI 함수 호출 방식으로 MCP 도구 실행');
          
          const gptFunctions = convertMCPToolsToGPTFunctions(availableTools);
          console.log(`📋 GPT 함수 ${gptFunctions.length}개 변환됨:`, gptFunctions.map(f => f.name));
          
          // GPTClient의 sendWithFunctionsStream 메서드 직접 호출
          const gptClient = aiClient as any; // 타입 캐스팅
          
          console.log('🚀 GPT 함수 호출 시작...');
          // GPT 함수 호출을 위한 프롬프트
          const gptPrompt = gptMcpPrompt({ act, gptFunctions });

          console.log('📝 GPT 프롬프트:', gptPrompt);
          
          aiResponse = await gptClient.sendWithFunctionsStream(
            gptPrompt,
            gptFunctions,
            async (functionName: string, functionArgs: any) => {
              console.log(`🔧 GPT 함수 실행: ${functionName}`, functionArgs);
              // 함수 실행 결과를 MCP 도구로 변환하여 실행
              const result = await browserTools.executeTool(functionName, functionArgs);
              console.log(`✅ 함수 실행 결과:`, result);
              return result;
            },
            (chunk) => {
              // 스트리밍 청크 처리 (Claude와 동일)
              if (chunk.error) {
                results.push(`❌ 스트리밍 오류: ${chunk.error}`);
                return;
              }
              
              if (!chunk.done) {
                // 텍스트 누적
                streamingMessage += chunk.text;
                
                if (isFirstChunk && context?.onAddMessage) {
                  // 첫 번째 청크: 새 AI 메시지 추가
                  context.onAddMessage('ai', streamingMessage);
                  isFirstChunk = false;
                } else if (!isFirstChunk && context?.onUpdateLastAiMessage) {
                  // 후속 청크: 마지막 AI 메시지 업데이트
                  context.onUpdateLastAiMessage(streamingMessage);
                }
              } else {
                // 스트리밍 완료 시 타임스탬프 기록 (GPT)
                endTimestamp = Date.now();
                responseTimeLogged = true;
              }
            }
          );
        } else {
          // Claude용: 기존 방식 유지 (변경 없음)
          console.log('🤖 Claude 모델 감지: 기존 MCP 방식으로 실행');
          
          aiResponse = await aiClient.sendStream(
            `브라우저에서 다음 액션을 수행해주세요: "${act}". 
            
            사용 가능한 도구들을 활용해 단계별로 실행하세요.`,
            (chunk) => {
              // 스트리밍 청크 처리
              if (chunk.error) {
                results.push(`❌ 스트리밍 오류: ${chunk.error}`);
                return;
              }
              
              if (!chunk.done) {
                // 텍스트 누적
                streamingMessage += chunk.text;
                
                if (isFirstChunk && context?.onAddMessage) {
                  // 첫 번째 청크: 새 AI 메시지 추가
                  context.onAddMessage('ai', streamingMessage);
                  isFirstChunk = false;
                } else if (!isFirstChunk && context?.onUpdateLastAiMessage) {
                  // 후속 청크: 마지막 AI 메시지 업데이트
                  context.onUpdateLastAiMessage(streamingMessage);
                }
              } else {
                // 스트리밍 완료 시 타임스탬프 기록 (Claude)
                endTimestamp = Date.now();
                responseTimeLogged = true;
              }
            }
          );
        }
        
        if (aiResponse.error) {
          results.push(`❌ AI 오류: ${aiResponse.error}`);
        }
        
        // 응답 시간 계산 및 출력
        if (!responseTimeLogged) {
          endTimestamp = Date.now();
        }
        
        const duration = endTimestamp - startTimestamp;
        const durationSeconds = (duration / 1000).toFixed(2);
        const endTime = new Date(endTimestamp).toISOString();
        
        console.log(`⏱️ AI 응답 완료: ${endTime}`);
        console.log(`🕒 응답 소요 시간: ${durationSeconds}초 (${duration}ms)`);
        
        // 타임스탬프를 사용자에게 표시
        const timestampMessage = `⏱️ 응답 완료: ${endTime.split('T')[1].split('.')[0]} (${durationSeconds}s)`;
        
        // 컨텍스트가 있으면 타임스탬프 메시지를 추가로 전송
        if (context?.onAddMessage) {
          context.onAddMessage('system', timestampMessage);
        }
        
        return {
          success: true,
          output: [
            ...results,
            timestampMessage
          ]
        };
        
      } finally {
        // ! 세션 종료 시에만 cleanup 호출하도록 개선 필요
        try {
          await browserTools.cleanup();
        } catch (cleanupError) {
          console.error('브라우저 정리 중 오류:', cleanupError);
        }
        console.log('ℹ️ MCP: 브라우저 연결 유지 (cleanup 건너뜀)');
      }
      
    } catch (error) {
      return {
        success: false,
        output: [
          '❌ MCP 브라우저 제어 실패',
        ],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default MCPCommand;