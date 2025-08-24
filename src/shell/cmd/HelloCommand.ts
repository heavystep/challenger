/**
 * Hello 명령어 클래스
 * /hello --name="[이름]" 형식으로 개인화된 인사 제공
 */

import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';
import HelloPrompt from '@/prompts/hello';

/**
 * Hello 명령어 클래스
 */
export class HelloCommand extends Command {
  readonly name = 'hello';
  readonly description = '사용자에게 개인화된 인사를 제공합니다';
  
  readonly args = {
    name: {
      type: 'string' as const,
      required: true,
      description: '인사할 사용자의 이름'
    }
  };

  /**
   * 명령어 실행
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
            ...this.getArgsDescription()
          ],
          error: validation.error
        };
      }

      // name 인수 추출
      const name = parsedCmd.args.name as string;
      
      // HelloPrompt 인스턴스 생성
      const helloPrompt = new HelloPrompt();
      
      const prompt = helloPrompt[process.env.MODEL as 'gemini' | 'claude' | 'gpt']({ name });
      
      return {
        success: true,
        output: [], // 빈 배열
        prompt: prompt // 프롬프트를 결과에 포함
      };
      
    } catch (error) {
      return {
        success: false,
        output: [
          '❌ AI 기능을 사용할 수 없습니다.',
          '💡 .env에 CLAUDE_API_KEY를 설정해주세요.'
        ],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default HelloCommand;