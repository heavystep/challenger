import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { execSync } from 'child_process';  

/**
 * Emul 명령어 클래스
 * /emul --file="[파일명]" 형식으로 Playwright 테스트 파일을 직접 실행
 */
export class EmulCommand extends Command {
  readonly name = 'emul';
  readonly description = 'Playwright 테스트 파일을 직접 실행하여 결과 확인';
  
  
  readonly args = {
    file: {
      type: 'string' as const,
      required: true,
      description: 'Playwright 테스트 파일명 (.spec.ts 자동 추가)'
    }
  };


  /**
   * 명령어 실행 - Playwright 테스트 파일을 직접 실행하여 결과 확인
   */
  async execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult> {
    try {
      console.log('🚀 Emul 명령어 실행 시작');
      
      // 인수 검증
      const validation = this.validateArgs(parsedCmd);
      if (!validation.valid) {
        return this.createErrorResult(validation.error);
      }

      // 인수 추출
      const { file } = this.extractArgs(parsedCmd);
      console.log(`📋 Emul 인수: FILENAME=${file}`);

      // 파일 경로 검증
      const fileValidation = await this.validateTestFile(file);
      if (!fileValidation.success) {
        return fileValidation;
      }

      const filePath = fileValidation.data!.filePath;
      console.log(`🎯 테스트 파일: ${filePath}`);

      // Playwright 테스트 실행
      console.log('🎯 Playwright 테스트 실행 시작');
      const startTimestamp = Date.now();
      
      const testResult = await this.executePlaywrightTest(filePath);

      // 결과 반환
      return this.formatTestResult(testResult, startTimestamp, file);

    } catch (error) {
      console.error('❌ Emul 명령어 실행 중 오류:', error);
      return this.handleError(error);
    }
  }

  /**
   * Playwright 테스트 실행
   */
  private async executePlaywrightTest(filePath: string): Promise<{ success: boolean, output: string, duration: number, reportDir: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // 스펙 파일명에서 확장자 제거
      const specFileName = path.basename(filePath, '.spec.ts');
      
      // 고유한 리포트 디렉토리 생성 (타임스탬프 포함)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const reportDir = `tests/report/${specFileName}-${timestamp}`;
      
      // 상대 경로로 변환 (tests/playwright/에서 tests/로)
      const relativePath = path.relative(path.join(process.cwd(), 'tests'), filePath);
      
      const child = spawn('npx', ['playwright', 'test', '--headed', relativePath], {
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', async (code) => {
        const duration = Date.now() - startTime;
        const output = stdout + stderr;
        
        // 테스트 실행 후 기본 리포트를 고유한 디렉토리로 복사
        try {
          const defaultReportDir = path.join(process.cwd(), 'playwright-report');
          if (fs.existsSync(defaultReportDir)) {
            // 리포트 디렉토리 생성
            fs.mkdirSync(reportDir, { recursive: true });
            
            // 기본 리포트를 고유한 디렉토리로 복사
            execSync(`cp -r "${defaultReportDir}"/* "${reportDir}/"`, { stdio: 'pipe' });
            
            console.log(`📊 리포트가 생성되었습니다: ${reportDir}`);
          }
        } catch (error) {
          console.error('❌ 리포트 복사 중 오류:', error);
        }
        
        resolve({
          success: code === 0,
          output,
          duration,
          reportDir
        });
      });

      child.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          output: `실행 오류: ${error.message}`,
          duration,
          reportDir
        });
      });
    });
  }

  /**
   * 테스트 파일 검증
   */
  private async validateTestFile(file: string): Promise<CommandResult & { data?: { filePath: string } }> {
    try {
      // tests 디렉토리에서 파일 찾기
      const testsDir = path.join(process.cwd(), 'tests', 'playwright');
      
      // .spec.ts 확장자가 없으면 추가
      const finalFilename = file.endsWith('.spec.ts') ? file : file + '.spec.ts';
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
            '💡 Playwright 테스트 파일인지 확인하세요.'
          ]
        };
      }

      console.log(`✅ Playwright 테스트 파일 검증 완료: ${finalFilename}`);

      return {
        success: true,
        output: [],
        data: { filePath: filepath }
      };

    } catch (error) {
      console.error('❌ 파일 검증 중 오류:', error);
      return {
        success: false,
        output: [
          '❌ 파일 검증 중 오류 발생',
          `🔍 오류 내용: ${error}`,
          '',
          '💡 파일 경로와 권한을 확인하세요.'
        ]
      };
    }
  }

  /**
   * 테스트 결과 포맷팅
   */
  private formatTestResult(testResult: { success: boolean, output: string, duration: number, reportDir: string }, startTimestamp: number, filename: string): CommandResult {
    const endTimestamp = Date.now();
    const totalDuration = endTimestamp - startTimestamp;
    
    const output = [
      '✅ Playwright 테스트 실행 완료',
      `⏱️ 총 실행 시간: ${totalDuration}ms`,
      `📁 테스트 파일: ${filename}`,
      `📊 리포트 디렉토리: ${testResult.reportDir}`,
      ''
    ];

    if (testResult.success) {
      output.push('🎉 테스트 성공!');
      output.push(`⚡ Playwright 실행 시간: ${testResult.duration}ms`);
    } else {
      output.push('❌ 테스트 실패');
      output.push(`⚡ Playwright 실행 시간: ${testResult.duration}ms`);
    }

    output.push('');
    output.push('📝 Playwright 실행 결과:');
    
    // 출력 결과를 줄 단위로 분리하여 추가
    const outputLines = testResult.output.split('\n').filter(line => line.trim());
    output.push(...outputLines);

    return {
      success: testResult.success,
      output
    };
  }





  /**
   * 인수 추출
   */
  private extractArgs(parsedCmd: ParsedCommand) {
    return {
      file: parsedCmd.args.file as string
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
        '  /emul --file="로그인-페이지에-진입할-수-있습니다"',
        '  /emul --file="테스트-케이스.spec.ts"',
        '  /emul --file="user-authentication-test"'
      ]
    };
  }

  /**
   * 에러 처리
   */
  private handleError(error: any): CommandResult {
    return {
      success: false,
      output: [
        '❌ Emul 명령어 실행 중 오류 발생',
        `🔍 오류 내용: ${error.message || error}`,
        '',
        '💡 파일 경로를 확인하고 다시 시도하세요.',
        `   예: /emul --file="example"`
      ]
    };
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default EmulCommand;