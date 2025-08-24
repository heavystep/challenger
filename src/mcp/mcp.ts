// Microsoft 공식 Playwright MCP 클라이언트
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

export default class PlaywrightMCP {
  private client?: Client;
  private isInitialized = false;
  private availableTools: any[] = [];
  private transport?: StdioClientTransport;
  private connectionStartTime?: number;
  private traceOutputDir = './traces';

  async init() {
    if (this.isInitialized) {
      console.log('🔄 Playwright MCP: 이미 초기화됨, 연결 상태 확인');
      await this.checkConnection();
      return;
    }
    
    try {
      this.connectionStartTime = Date.now();
      console.log('🚀 Playwright MCP: Microsoft 공식 MCP 서버 연결...');
      
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '@playwright/mcp@latest',
          '--save-trace',  // AI 동작을 Playwright Trace로 녹화
          '--output-dir', './traces'  // Trace 파일 저장 디렉토리
        ]
      });
      
      this.client = new Client(
        { name: 'challenger-cli', version: '1.0.0' },
        { capabilities: {} }
      );
      
      await this.client.connect(this.transport);
      this.isInitialized = true;
      
      const connectionTime = Date.now() - this.connectionStartTime!;
      console.log(`✅ Playwright MCP: 연결 성공 (${connectionTime}ms)`);
      
      // 도구 목록 로드
      await this.refreshTools();
    } catch (error) {
      const connectionTime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
      console.error(`❌ Playwright MCP: 연결 실패 (${connectionTime}ms):`, error);
      await this.cleanup();
      throw new Error(`Playwright MCP 초기화 실패: ${error}`);
    }
  }

  /**
   * 연결 상태 확인
   */
  private async checkConnection(): Promise<boolean> {
    try {
      if (!this.client || !this.isInitialized) {
        console.log('⚠️ Playwright MCP: 클라이언트가 초기화되지 않음');
        return false;
      }

      console.log('🔍 Playwright MCP: 연결 상태 확인 중...');
      
      const toolsResponse = await Promise.race([
        this.client.listTools(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('연결 타임아웃')), 5000)
        )
      ]) as ListToolsResult;

      console.log(`✅ Playwright MCP: 연결 정상, ${toolsResponse.tools.length}개 도구 사용 가능`);
      return true;
    } catch (error) {
      console.error('❌ Playwright MCP: 연결 상태 확인 실패:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * 공식 Playwright MCP 도구 목록 로드
   */
  async refreshTools(): Promise<any[]> {
    if (!this.isInitialized) await this.init();
    
    try {
      console.log('🔄 Playwright MCP: 도구 목록 새로고침 중...');
      
      const toolsResponse = await Promise.race([
        this.client!.listTools(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('도구 목록 요청 타임아웃')), 10000)
        )
      ]) as ListToolsResult;
      
      this.availableTools = toolsResponse.tools;
      console.log(`📋 Playwright MCP: ${this.availableTools.length}개 기본 도구 로드됨`);
      
      console.log(`✅ Playwright MCP: 총 ${this.availableTools.length}개 도구 사용 가능`);
      return this.availableTools;
    } catch (error) {
      console.error('❌ Playwright MCP: 도구 목록 로드 실패, fallback 사용:', error);
      
      // 연결 문제 시 재초기화 필요 표시
      this.isInitialized = false;
    
      return this.availableTools;
    }
  }

  /**
   * Claude가 사용할 수 있는 도구 목록 반환
   */
  async getToolsForClaude(): Promise<any[]> {
    if (!this.isInitialized) await this.init();
    
    return this.availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }

  /**
   * 공식 Playwright MCP 도구 실행
   */
  async executeTool(toolName: string, toolArgs: any): Promise<CallToolResult> {
    console.log(`🎯 Playwright MCP: ${toolName} 도구 실행 시작`, {
      args: toolArgs,
      isInitialized: this.isInitialized,
      hasClient: !!this.client
    });

    if (!this.isInitialized) {
      console.log('🔄 Playwright MCP: 초기화되지 않음, 초기화 시도');
      await this.init();
    }

    // 실행 전 연결 상태 확인
    const isConnected = await this.checkConnection();
    if (!isConnected) {
      console.log('❌ Playwright MCP: 연결 끊어짐, 재연결 시도');
      this.isInitialized = false;
      await this.init();
    }
    
    try {
      const startTime = Date.now();
      
      console.log(`🔧 Playwright MCP: ${toolName} 표준 도구 실행`);
      const result = await Promise.race([
        this.client!.callTool({
          name: toolName,
          arguments: toolArgs
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${toolName} 실행 타임아웃`)), 30000)
        )
      ]) as CallToolResult;
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Playwright MCP: ${toolName} 실행 완료 (${executionTime}ms)`);
      return result;
    } catch (error) {
      const executionTime = Date.now() - (this.connectionStartTime || Date.now());
      console.error(`❌ Playwright MCP: ${toolName} 도구 실행 실패 (${executionTime}ms):`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        toolName,
        args: toolArgs,
        isInitialized: this.isInitialized,
        hasClient: !!this.client,
        hasTransport: !!this.transport
      });
      
      // 연결 관련 에러인지 확인
      const errorMsg = String(error);
      if (errorMsg.includes('connection') || errorMsg.includes('timeout') || errorMsg.includes('ECONNRESET')) {
        console.log('🔄 Playwright MCP: 연결 오류로 인한 실패, 재초기화 필요 표시');
        this.isInitialized = false;
      }
      
      throw new Error(`Playwright MCP 도구 실행 실패 (${toolName}): ${error}`);
    }
  }

  /**
   * Trace 파일을 Playwright 코드로 변환
   */
  async convertTraceToCode(traceFile?: string): Promise<string | null> {
    try {
      // Trace 파일 찾기
      const tracePath = traceFile || await this.findLatestTraceFile();
      if (!tracePath) {
        console.log('⚠️ Playwright MCP: Trace 파일을 찾을 수 없습니다');
        return null;
      }

      console.log(`🔄 Playwright MCP: Trace를 코드로 변환 중... (${tracePath})`);
      
      // Playwright show-trace 명령어로 Trace 정보 추출
      const { execSync } = require('child_process');
      const traceInfo = execSync(`npx playwright show-trace --stdin "${tracePath}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Trace 정보를 기반으로 Playwright 코드 생성
      const playwrightCode = this.generatePlaywrightCodeFromTrace(traceInfo);
      
      // 코드를 파일로 저장
      const outputFile = await this.savePlaywrightCode(playwrightCode);
      
      console.log(`✅ Playwright MCP: Trace 변환 완료 (${outputFile})`);
      return outputFile;
      
    } catch (error) {
      console.error('❌ Playwright MCP: Trace 변환 실패:', error);
      return null;
    }
  }

  /**
   * 최신 Trace 파일 찾기
   */
  private async findLatestTraceFile(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.traceOutputDir)) {
        return null;
      }
      
      const files = fs.readdirSync(this.traceOutputDir)
        .filter((file: string) => file.endsWith('.zip'))
        .map((file: string) => ({
          name: file,
          path: path.join(this.traceOutputDir, file),
          mtime: fs.statSync(path.join(this.traceOutputDir, file)).mtime
        }))
        .sort((a: any, b: any) => b.mtime - a.mtime);
      
      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      console.error('❌ Playwright MCP: Trace 파일 검색 실패:', error);
      return null;
    }
  }

  /**
   * Trace 정보를 기반으로 Playwright 코드 생성
   */
  private generatePlaywrightCodeFromTrace(traceInfo: string): string {
    // 기본 Playwright 테스트 코드 템플릿
    return `import { test, expect } from '@playwright/test';

test('AI Generated Test from Trace', async ({ page }) => {
  // 이 테스트는 Playwright MCP Trace에서 자동 생성되었습니다
  
  // TODO: Trace 정보를 분석하여 실제 동작 코드로 변환
  // 현재는 기본 템플릿만 제공됩니다
  
  console.log('Trace 정보:', ${JSON.stringify(traceInfo).slice(0, 200)}...);
  
  // 기본 네비게이션 예시
  // await page.goto('https://example.com');
  
  // 기본 클릭 예시
  // await page.click('button');
  
  // 기본 입력 예시
  // await page.fill('input[name="q"]', 'search term');
});
`;
  }

  /**
   * Playwright 코드를 파일로 저장
   */
  private async savePlaywrightCode(code: string): Promise<string> {
    // tests/playwright 디렉토리 생성
    const testDir = path.join(process.cwd(), 'tests', 'playwright');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // 파일명 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `ai-generated-${timestamp}.spec.ts`;
    const filepath = path.join(testDir, filename);
    
    // 코드 저장
    fs.writeFileSync(filepath, code, 'utf8');
    
    return filepath;
  }

  /**
   * 전체 정리
   */
  private async cleanup() {
    console.log('🧹 Playwright MCP: 정리 시작...');
    
    if (this.client && this.isInitialized) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn('⚠️ Playwright MCP 클라이언트 종료 오류:', error);
      }
    }
    
    this.isInitialized = false;
    this.client = undefined;
    this.transport = undefined;
    this.availableTools = [];
    
    console.log('✅ Playwright MCP: 정리 완료');
  }

  async close() {
    await this.cleanup();
  }
}