import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';
import { exposeBrowserTools, convertMCPToolsToGeminiFunctions, convertMCPToolsToGPTFunctions } from '@/mcp';
import { createAIClient, getCurrentModel } from '@/clients';
import runPrompt from '@/prompts/runPrompt';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MCP 브라우저 제어 명령어 클래스
 */
export class RunCommand extends Command {
  readonly name = 'run';
  readonly description = 'GenCommand로 생성한 시나리오 파일로부터 Playwright 스크립트 생성';
  
  readonly args = {
    file: {
      type: 'string' as const,
      required: true,
      description: 'GenCommand가 생성한 JSON 파일명'
    },
    index: {
      type: 'number' as const,
      required: true,
      description: '추출할 케이스의 인덱스 (0부터 시작)'
    }
  };

  /**
   * 명령어 실행 - JSON 파일에서 특정 케이스 추출하여 Playwright 스크립트 생성
   */
  async execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult> {
    try {
      console.log('🚀 Run 명령어 실행 시작');
      
      // 인수 검증
      const validation = this.validateArgs(parsedCmd);
      if (!validation.valid) {
        return this.createErrorResult(validation.error);
      }

      // 인수 추출
      const { file, index } = this.extractArgs(parsedCmd);
      console.log(`📋 Run 인수: FILENAME=${file}, INDEX=${index}`);

      // 파일 읽기 및 케이스 추출
      const caseData = await this.readAndExtractCase(file, index);
      if (!caseData.success) {
        return caseData;
      }

      // URL과 케이스 데이터 가져오기
      const { url, extractedCase } = caseData.data!;
      console.log(`🎯 URL: ${url}, Case: ${extractedCase.name}`);
      
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
          const enhancedPrompt = runPrompt({ 
            url, 
            tc: JSON.stringify(extractedCase, null, 2), 
            geminiFunctions 
          });

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
            // const gptPrompt = runPrompt({ act, gptFunctions });

          // console.log('📝 GPT 프롬프트:', gptPrompt);
          
          // aiResponse = await gptClient.sendWithFunctionsStream(
          //   gptPrompt,
          //   gptFunctions,
          //   async (functionName: string, functionArgs: any) => {
          //     console.log(`🔧 GPT 함수 실행: ${functionName}`, functionArgs);
          //     // 함수 실행 결과를 MCP 도구로 변환하여 실행
          //     const result = await browserTools.executeTool(functionName, functionArgs);
          //     console.log(`✅ 함수 실행 결과:`, result);
          //     return result;
          //   },
          //   (chunk) => {
          //     // 스트리밍 청크 처리 (Claude와 동일)
          //     if (chunk.error) {
          //       results.push(`❌ 스트리밍 오류: ${chunk.error}`);
          //       return;
          //     }
              
          //     if (!chunk.done) {
          //       // 텍스트 누적
          //       streamingMessage += chunk.text;
                
          //       if (isFirstChunk && context?.onAddMessage) {
          //         // 첫 번째 청크: 새 AI 메시지 추가
          //         context.onAddMessage('ai', streamingMessage);
          //         isFirstChunk = false;
          //       } else if (!isFirstChunk && context?.onUpdateLastAiMessage) {
          //         // 후속 청크: 마지막 AI 메시지 업데이트
          //         context.onUpdateLastAiMessage(streamingMessage);
          //       }
          //     } else {
          //       // 스트리밍 완료 시 타임스탬프 기록 (GPT)
          //       endTimestamp = Date.now();
          //       responseTimeLogged = true;
          //     }
          //   }
          //  );
        } else {
          // Claude용: 기존 방식 유지 (변경 없음)
          console.log('🤖 Claude 모델 감지: 기존 MCP 방식으로 실행');
          
          aiResponse = await aiClient.sendStream(
            `브라우저에서 다음 액션을 수행해주세요: "${extractedCase.name}". 
            
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
        
        // Playwright 코드 파싱 및 저장 처리
        const content = aiResponse.content || streamingMessage || '응답이 없습니다.';
        const { playwrightCode, cleanContent } = this.parsePlaywrightFromResponse(content);
        let savedFilePath = null;
        
        if (playwrightCode) {
          savedFilePath = await this.savePlaywrightToFile(playwrightCode, extractedCase.name, url);
        }
        
        // Trace를 Playwright 코드로 변환 (AI 동작이 녹화됨)
        console.log('🎬 Trace 변환 시작...');
        const traceFilePath = await browserTools.convertTraceToCode();
        if (traceFilePath) {
          console.log(`✅ Trace 변환 완료: ${traceFilePath}`);
        }
        
        // 타임스탬프를 사용자에게 표시
        const timestampMessage = `⏱️ 응답 완료: ${endTime.split('T')[1].split('.')[0]} (${durationSeconds}s)`;
        
        // 컨텍스트가 있으면 타임스탬프 메시지를 추가로 전송
        if (context?.onAddMessage) {
          context.onAddMessage('system', timestampMessage);
        }
        
        const output = [
          '✅ Run 브라우저 자동화 완료',
          timestampMessage,
          `🤖 사용된 모델: ${currentModel}`,
          ''
        ];

        if (savedFilePath) {
          output.push(`💾 Playwright 파일 저장됨: ${path.basename(savedFilePath)}`);
          output.push('');
        }
        
        if (traceFilePath) {
          output.push(`🎬 Trace 변환 파일: ${path.basename(traceFilePath)}`);
          output.push('');
        }

        output.push('📝 AI 응답:');
        output.push(cleanContent);
        
        return {
          success: true,
          output
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

  /**
   * JSON 파일 읽기 및 케이스 추출
   */
  private async readAndExtractCase(file: string, index: number): Promise<CommandResult & { data?: { url: string, extractedCase: any } }> {
    try {
      // tests/scenario 디렉토리에서 파일 찾기
      const testsDir = path.join(process.cwd(), 'tests', 'scenario');
      
      // .json 확장자가 없으면 추가
      const finalFilename = file.endsWith('.json') ? file : file + '.json';
      const filepath = path.join(testsDir, finalFilename);

      console.log(`📂 파일 경로: ${filepath}`);

      // 파일 존재 확인
      if (!fs.existsSync(filepath)) {
        return {
          success: false,
          output: [
            `❌ 파일을 찾을 수 없습니다: ${finalFilename}`,
            `🔍 경로: ${filepath}`,
            '',
            '💡 GenCommand로 생성된 JSON 파일인지 확인하세요.'
          ]
        };
      }

      // 파일 읽기
      const fileContent = fs.readFileSync(filepath, 'utf8');
      console.log(`📄 파일 읽기 완료: ${finalFilename}`);

      // JSON 파싱
      let jsonData: any;
      try {
        jsonData = JSON.parse(fileContent);
      } catch (parseError) {
        return {
          success: false,
          output: [
            `❌ JSON 파싱 실패: ${finalFilename}`,
            `🔍 오류: ${parseError}`,
            '',
            '💡 파일이 유효한 JSON 형식인지 확인하세요.'
          ]
        };
      }

      // cases 배열 확인
      if (!jsonData.cases || !Array.isArray(jsonData.cases)) {
        return {
          success: false,
          output: [
            `❌ JSON 데이터에 cases 배열이 없습니다: ${finalFilename}`,
            `🔍 데이터 구조: ${JSON.stringify(Object.keys(jsonData))}`,
            '',
            '💡 GenCommand가 생성한 케이스 파일인지 확인하세요.'
          ]
        };
      }

      const cases = jsonData.cases;

      // 인덱스 범위 확인
      if (index < 0 || index >= cases.length) {
        return {
          success: false,
          output: [
            `❌ 인덱스가 범위를 벗어났습니다: ${index}`,
            `🔍 케이스 수: ${cases.length} (인덱스 범위: 0 ~ ${cases.length - 1})`,
            '',
            '💡 유효한 인덱스를 입력하세요.'
          ]
        };
      }

      // 케이스 추출
      const extractedCase = cases[index];
      console.log(`✅ 케이스 추출 완료: 인덱스 ${index}`);

      return {
        success: true,
        output: [],
        data: {
          url: jsonData.url,
          extractedCase
        }
      };

    } catch (error) {
      console.error('❌ 파일 처리 중 오류:', error);
      return {
        success: false,
        output: [
          '❌ 파일 처리 중 오류 발생',
          `🔍 오류 내용: ${error}`,
          '',
          '💡 파일 경로와 권한을 확인하세요.'
        ]
      };
    }
  }

  /**
   * 인수 추출
   */
  private extractArgs(parsedCmd: ParsedCommand) {
    return {
      file: parsedCmd.args.file as string,
      index: parsedCmd.args.index as number
    };
  }

  /**
   * 에러 결과 생성
   */
  private createErrorResult(error: string): CommandResult {
    return {
      success: false,
      output: [
        `❌ ${error}`,
        `💡 사용법: ${this.getUsage()}`,
        '',
        '인수 설명:',
        ...this.getArgsDescription(),
        '',
        '예시:',
        '  /run --file="example" --index=0',
        '  /run --file="github-com-search.json" --index=2',
        '  /run --file="m-albamon-com-로그인" --index=0'
      ]
    };
  }

  /**
   * AI 응답에서 Playwright 코드 블록을 파싱하여 추출
   */
  private parsePlaywrightFromResponse(content: string): { playwrightCode: string | null, cleanContent: string } {
    const playwrightRegex = /```typescript\s*([\s\S]*?)\s*```/g;
    const matches = content.match(playwrightRegex);
    
    if (!matches || matches.length === 0) {
      return { playwrightCode: null, cleanContent: content };
    }

    let playwrightCode = null;
    let cleanContent = content;

    try {
      // 첫 번째 매치에서 Playwright 코드 추출
      const codeContent = matches[0].replace(/```typescript\s*/, '').replace(/\s*```/, '');
      playwrightCode = codeContent;
      
      // 원본 내용에서 ```typescript...``` 블록 제거
      cleanContent = content.replace(playwrightRegex, '').trim();
      
      console.log('🔍 Playwright 코드 파싱 성공');
    } catch (error) {
      console.error('❌ Playwright 코드 파싱 실패:', error);
      playwrightCode = null;
    }

    return { playwrightCode, cleanContent };
  }

  /**
   * Playwright 코드를 tests/playwright 폴더에 저장
   */
  private async savePlaywrightToFile(playwrightCode: any, caseName: string, url?: string): Promise<string | null> {
    try {
      // tests/playwright 디렉토리 경로 설정
      const playwrightDir = path.join(process.cwd(), 'tests', 'playwright');
      
      // tests/playwright 디렉토리가 없으면 생성
      if (!fs.existsSync(playwrightDir)) {
        fs.mkdirSync(playwrightDir, { recursive: true });
      }

      // 파일명 생성
      const filename = this.generatePlaywrightFilename(caseName);
      const filepath = path.join(playwrightDir, filename);

      // Playwright 코드를 TypeScript 파일로 저장
      fs.writeFileSync(filepath, playwrightCode, 'utf8');
      
      console.log(`💾 Playwright 파일 저장 완료: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('❌ Playwright 파일 저장 실패:', error);
      return null;
    }
  }

  /**
   * 케이스 이름을 기반으로 Playwright 파일명 생성
   */
  private generatePlaywrightFilename(caseName: string): string {
    const sanitizedCaseName = caseName
      .replace(/[^\w가-힣\s]/g, '') // 특수문자 제거, 한글과 영문, 숫자, 공백만 유지
      .replace(/\s+/g, '-') // 공백을 - 로 변경
      .replace(/-+/g, '-') // 연속된 - 를 하나로 변경
      .replace(/^-|-$/g, ''); // 시작과 끝의 - 제거
    
    return `${sanitizedCaseName}.spec.ts`;
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default RunCommand;