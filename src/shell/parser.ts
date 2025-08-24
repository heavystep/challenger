/**
 * 명령어 파싱 로직
 * "/hello --name 홍길동 --age 25" 형식의 입력을 구조화된 데이터로 변환
 */

/**
 * 파싱된 명령어 인터페이스
 */
export interface ParsedCommand {
  name: string;
  args: Record<string, string | number | boolean>;
  rawInput: string;
}

/**
 * 명령어 파싱 에러
 */
export class CommandParseError extends Error {
  constructor(message: string, public readonly input: string) {
    super(message);
    this.name = 'CommandParseError';
  }
}

/**
 * 값의 타입을 자동으로 변환
 */
const parseValue = (value: string): string | number | boolean => {
  // 불린 값 처리
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // 숫자 값 처리
  if (/^\d+$/.test(value)) {
    const num = parseInt(value, 10);
    if (!isNaN(num)) return num;
  }
  
  if (/^\d*\.\d+$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }
  
  // 기본값: 문자열
  return value;
};

/**
 * 명령어 문자열을 파싱하여 구조화된 데이터로 변환
 * @param input - 파싱할 명령어 문자열 (예: "/hello --name=\"홍길동\"")
 * @returns 파싱된 명령어 객체
 */
export const parseCommand = (input: string): ParsedCommand => {
  const trimmed = input.trim();
  
  // 빈 입력 체크
  if (!trimmed) {
    throw new CommandParseError('빈 명령어입니다', input);
  }
  
  // 슬래시로 시작하지 않는 경우
  if (!trimmed.startsWith('/')) {
    throw new CommandParseError('명령어는 "/"로 시작해야 합니다', input);
  }
  
  // 공백으로 분할 (따옴표 내부는 보존)
  const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  
  // 명령어 이름 추출 (슬래시 제거)
  const name = parts[0].substring(1);
  
  if (!name || name.startsWith('-')) {
    throw new CommandParseError('올바른 명령어 이름이 필요합니다', input);
  }
  
  // 인수 파싱
  const args: Record<string, string | number | boolean> = {};
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    
    // --flag=value 또는 --flag="value" 형식인지 확인
    if (part.startsWith('--')) {
      const equalIndex = part.indexOf('=');
      
      if (equalIndex === -1) {
        // 값 없는 불린 플래그 (--flag)
        const flagName = part.substring(2);
        if (!flagName) {
          throw new CommandParseError(`잘못된 플래그 형식: ${part}`, input);
        }
        args[flagName] = true;
      } else {
        // 값 있는 플래그 (--flag=value 또는 --flag="value")
        const flagName = part.substring(2, equalIndex);
        let value = part.substring(equalIndex + 1);
        
        if (!flagName) {
          throw new CommandParseError(`잘못된 플래그 형식: ${part}`, input);
        }
        
        // 빈 값 체크
        if (!value) {
          throw new CommandParseError(`플래그 ${flagName}에 값이 필요합니다. 올바른 형식: --${flagName}="값"`, input);
        }
        
        // 따옴표 검사 및 제거
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        } else {
          throw new CommandParseError(
            `플래그 ${flagName}의 값은 따옴표로 감싸야 합니다. 올바른 형식: --${flagName}="값"`,
            input
          );
        }
        
        args[flagName] = parseValue(value);
      }
    } else {
      // 플래그가 아닌 값은 에러 처리
      throw new CommandParseError(`예상치 못한 인수: ${part}`, input);
    }
  }
  
  return {
    name,
    args,
    rawInput: input
  };
};

/**
 * 명령어가 올바른 형식인지 간단히 체크
 */
export const isValidCommand = (input: string): boolean => {
  try {
    parseCommand(input);
    return true;
  } catch {
    return false;
  }
};

/**
 * 명령어 파싱을 시도하고 결과를 반환
 * @param input - 검증할 명령어 문자열
 * @returns 검증 결과 객체
 */
export const validateCommand = (input: string): {
  isValid: boolean;
  error?: string;
  parsedCommand?: ParsedCommand;
} => {
  try {
    const parsedCommand = parseCommand(input);
    return {
      isValid: true,
      parsedCommand
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof CommandParseError ? error.message : '명령어 파싱 에러'
    };
  }
};