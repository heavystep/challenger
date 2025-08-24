/**
 * Hello 명령 프롬프트 예시
 * 사용자에게 개인화된 인사 제공
 * @example
 */

import { Prompt } from '@/prompts';

interface HelloParams {
  name: string;
}

class HelloPrompt implements Prompt {
  gemini({ name }: HelloParams): string {
    return `사용자 "${name}"님에게 따뜻하게 인사해주세요. 파란 하트 이모지를 같이 보내세요.`;
  }

  claude({ name }: HelloParams): string {
    return `사용자 "${name}"님에게 따뜻하게 인사해주세요. 오렌지색 하트 이모지를 같이 보내세요.`;
  }

  gpt({ name }: HelloParams): string {
    return `사용자 "${name}"님에게 따뜻하게 인사해주세요. 하얀 하트 이모지를 같이 보내세요.`;
  }
}

export default HelloPrompt;