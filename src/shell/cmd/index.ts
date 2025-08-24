/**
 * 명령 레지스트리 - 모든 명령어 핸들러의 중앙 집중 관리
 */

import type { CommandRegistry, CommandConstructor } from './types';
import HelloCommand from './HelloCommand';
import ExitCommand from './ExitCommand';
import MCPCommand from './MCPCommand';
import RunCommand from './RunCommand';
import RunBeastCommand from './RunBeastCommand';
import GenCommand from './GenCommand';
import EmulCommand from './EmulCommand';
import EmulBeastCommand from './EmulBeastCommand';

/**
 * 명령어 클래스 등록
 */
const commandClasses: Record<string, CommandConstructor> = {
  // hello: HelloCommand,
  // exit: ExitCommand,
  // mcp: MCPCommand,
  run: RunCommand,
  'run:beast': RunBeastCommand,
  gen: GenCommand,
  emul: EmulCommand,
  'emul:beast': EmulBeastCommand,
  // 향후 추가될 명령어들...
  // generate: GenerateCommand,
};

/**
 * 등록된 모든 명령어 인스턴스들
 */
export const commandRegistry: CommandRegistry = Object.fromEntries(
  Object.entries(commandClasses).map(([name, CommandClass]) => [
    name,
    new CommandClass()
  ])
);

/**
 * 명령어 존재 여부 확인
 */
export const hasCommand = (name: string): boolean => {
  return name in commandRegistry;
};

/**
 * 명령어 조회
 */
export const getCommand = (name: string) => {
  return commandRegistry[name];
};

/**
 * 등록된 모든 명령어 목록 조회
 */
export const getAllCommands = () => {
  return Object.values(commandRegistry);
};

// 타입과 명령어 클래스들 재export
export type { Command, CommandResult, CommandContext, CommandRegistry, CommandSchema, CommandArg, CommandConstructor } from './types';