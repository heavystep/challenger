/**
 * 명령 핸들러 시스템 타입 정의
 */

import type { ParsedCommand } from '../parser';

/**
 * 명령 실행 결과
 */
export interface CommandResult {
  success: boolean;
  output: string[];
  error?: string;
  prompt?: string; // AI 호출용 프롬프트 (선택적)
}

/**
 * 명령 실행 컨텍스트
 */
export interface CommandContext {
  // 스트리밍 콜백 함수들
  onAddMessage?: (sender: 'user' | 'ai' | 'system', content: string) => void;
  onUpdateLastAiMessage?: (content: string) => void;
}

/**
 * 명령 인수 정의
 */
export interface CommandArg {
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

/**
 * 명령 스키마 정의
 */
export interface CommandSchema {
  name: string;
  description: string;
  args: Record<string, CommandArg>;
}

/**
 * 추상 Command 클래스
 */
export abstract class Command implements CommandSchema {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly args: Record<string, CommandArg>;

  /**
   * 명령어 실행 메서드
   */
  abstract execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult>;

  /**
   * 인수 검증 메서드
   */
  protected validateArgs(parsedCmd: ParsedCommand): { valid: boolean; error?: string } {
    for (const [argName, argDef] of Object.entries(this.args)) {
      const value = parsedCmd.args[argName];
      
      // 필수 인수 체크
      if (argDef.required && (value === undefined || value === null || value === '')) {
        return {
          valid: false,
          error: `Missing required argument: ${argName}`
        };
      }

      // 타입 체크 (값이 있는 경우에만)
      if (value !== undefined && value !== null && value !== '') {
        const expectedType = argDef.type;
        const actualType = typeof value;
        
        if (expectedType === 'number' && actualType !== 'number') {
          return {
            valid: false,
            error: `Invalid argument type: ${argName} must be ${expectedType}`
          };
        }
        
        if (expectedType === 'boolean' && actualType !== 'boolean') {
          return {
            valid: false,
            error: `Invalid argument type: ${argName} must be ${expectedType}`
          };
        }
      }
    }
    
    return { valid: true };
  }

  /**
   * 사용법 도움말 생성
   */
  getUsage(): string {
    const requiredArgs = Object.entries(this.args)
      .filter(([, def]) => def.required)
      .map(([name]) => `--${name}="[${name}]"`)
      .join(' ');
    
    const optionalArgs = Object.entries(this.args)
      .filter(([, def]) => !def.required)
      .map(([name, def]) => {
        const defaultValue = def.default !== undefined ? `"${def.default}"` : '"[value]"';
        return `[--${name}=${defaultValue}]`;
      })
      .join(' ');
    
    const args = [requiredArgs, optionalArgs].filter(Boolean).join(' ');
    return `/${this.name} ${args}`.trim();
  }

  /**
   * 인수 설명 목록 생성
   */
  getArgsDescription(): string[] {
    return Object.entries(this.args).map(([name, def]) => {
      const required = def.required ? '*' : ' ';
      const defaultValue = def.default !== undefined ? ` (default: ${def.default})` : ''; // init
      return `  ${required}--${name}: ${def.description}${defaultValue}`;
    });
  }
}

/**
 * 명령 레지스트리 타입
 */
export type CommandRegistry = Record<string, Command>;

/**
 * 명령 클래스 생성자 타입
 */
export type CommandConstructor = new () => Command;