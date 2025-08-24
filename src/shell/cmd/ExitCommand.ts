/**
 * Exit 명령어 클래스
 * /exit 형식으로 프로그램 종료
 */

import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';

/**
 * Exit 명령어 클래스
 */
export class ExitCommand extends Command {
  readonly name = 'exit';
  readonly description = '프로그램을 종료합니다';
  
  readonly args = {}; // 인수 없음

  /**
   * 명령어 실행
   */
  async execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult> {
    // 종료 메시지 표시 후 프로세스 종료
    setTimeout(() => {
      process.exit(0);
    }, 500);
    
    return {
      success: true,
      output: [
        '👋 프로그램을 종료합니다...'
      ]
    };
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default ExitCommand;