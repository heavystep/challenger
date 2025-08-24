/**
 * AI 클라이언트 팩토리
 * 환경변수 MODEL을 읽어서 Claude 또는 Gemini 클라이언트를 생성
 */

import { ClaudeClient } from './claude/index';
import { GeminiClient } from './gemini/index';
import { GPTClient } from './gpt/index';
import type { 
  AIClient, 
  AIModelType, 
  AIFactoryConfig,
  ChatResponse,
  StreamCallback
} from './types';

/**
 * AI 클라이언트 팩토리 클래스
 * @description 환경변수 MODEL에 따라 Claude, Gemini 또는 GPT 클라이언트를 생성하고 관리
 */
export class AIClientFactory {
  private static instance: AIClientFactory;
  private client: AIClient | null = null;
  private currentModel: AIModelType | null = null;

  /**
   * 싱글톤 인스턴스 생성
   */
  public static getInstance(): AIClientFactory {
    if (!AIClientFactory.instance) {
      AIClientFactory.instance = new AIClientFactory();
    }
    return AIClientFactory.instance;
  }

  /**
   * 환경변수에서 모델 타입 읽기
   */
  private getModelFromEnv(): AIModelType {
    const model = process.env.MODEL?.toLowerCase();
    
    if (model === 'claude' || model === 'gemini' || model === 'gpt') {
      return model as AIModelType;
    }
    
    // 기본값은 claude
    console.warn('⚠️  MODEL 환경변수가 설정되지 않았거나 잘못되었습니다. 기본값 "claude"를 사용합니다.');
    return 'claude';
  }

  /**
   * AI 클라이언트 생성 또는 기존 클라이언트 반환
   * @param config - 선택적 설정 (환경변수보다 우선)
   * @returns AI 클라이언트 인스턴스
   */
  public getClient(config?: Partial<AIFactoryConfig>): AIClient {
    const modelType = config?.model || this.getModelFromEnv();

    if (!this.client || this.currentModel !== modelType) {
      this.client = this.createClient(modelType, config);
      this.currentModel = modelType;
    }

    return this.client;
  }

  /**
   * 지정된 모델 타입으로 클라이언트 생성
   */
  private createClient(modelType: AIModelType, config?: Partial<AIFactoryConfig>): AIClient {
    switch (modelType) {
      case 'claude':
        return new ClaudeClient(config?.claudeConfig);
      
      case 'gemini':
        return new GeminiClient(config?.geminiConfig);
      
      case 'gpt':
        return new GPTClient(config?.gptConfig);
      
      default:
        throw new Error(`지원되지 않는 AI 모델: ${modelType}`);
    }
  }

  /**
   * 현재 사용 중인 모델 타입 반환
   */
  public getCurrentModel(): AIModelType | null {
    return this.currentModel;
  }

  /**
   * 클라이언트 재설정 (모델 변경 시 사용)
   */
  public reset(): void {
    this.client = null;
    this.currentModel = null;
  }
}

/**
 * 기본 AI 클라이언트 인스턴스 생성 함수
 * @param config - 선택적 설정
 * @returns AI 클라이언트 인스턴스
 */
export function createAIClient(config?: Partial<AIFactoryConfig>): AIClient {
  const factory = AIClientFactory.getInstance();
  return factory.getClient(config);
}

/**
 * 편의 함수들 - 직접적인 AI 호출을 위한 래퍼
 */
export async function sendMessage(message: string, config?: Partial<AIFactoryConfig>): Promise<ChatResponse> {
  const client = createAIClient(config);
  return await client.send(message);
}

export async function sendMessageStream(
  message: string, 
  onChunk: StreamCallback,
  config?: Partial<AIFactoryConfig>
): Promise<ChatResponse> {
  const client = createAIClient(config);
  return await client.sendStream(message, onChunk);
}

/**
 * 현재 설정된 모델 타입 확인
 */
export function getCurrentModel(): AIModelType | null {
  const factory = AIClientFactory.getInstance();
  return factory.getCurrentModel();
}

/**
 * 지원되는 모델 목록
 */
export const SUPPORTED_MODELS: AIModelType[] = ['claude', 'gemini', 'gpt'];

/**
 * 기본 export - 싱글톤 팩토리 인스턴스
 */
export default AIClientFactory;