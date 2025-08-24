import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';
import { getCommand } from './index';

/**
 * 다중 Playwright 테스트 파일 배치 실행 명령어 클래스
 */
export class EmulBeastCommand extends Command {
  readonly name = 'emul:beast';
  readonly description = '여러 Playwright 테스트 파일을 순차적으로 배치 실행';
  
  readonly args = {
    files: {
      type: 'string' as const,
      required: true,
      description: '실행할 테스트 파일들 (쉼표로 구분: 예 "file1,file2,file3")'
    }
  };

  /**
   * 명령어 실행 - 다중 테스트 파일 순차 처리
   */
  async execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult> {
    try {
      console.log('🦁 Emul Beast 모드 실행 시작');
      
      // 인수 검증
      const validation = this.validateArgs(parsedCmd);
      if (!validation.valid) {
        return this.createErrorResult(validation.error);
      }

      // 인수 추출
      const { files } = this.extractArgs(parsedCmd);
      console.log(`📋 Emul Beast 인수: FILES=${files}`);

      // 파일 목록 파싱
      const fileList = this.parseFiles(files);
      if (fileList.length === 0) {
        return this.createErrorResult('유효한 파일명이 없습니다');
      }

      console.log(`🎯 실행할 테스트 파일 수: ${fileList.length}개 [${fileList.join(', ')}]`);

      // EmulCommand 인스턴스 가져오기
      const emulCommand = getCommand('emul');
      if (!emulCommand) {
        return this.createErrorResult('EmulCommand를 찾을 수 없습니다');
      }

      // 결과 수집용 배열
      const results: Array<{
        filename: string;
        success: boolean;
        output: string[];
        error?: string;
        duration?: number;
      }> = [];

      // 각 파일별 순차 실행
      for (let i = 0; i < fileList.length; i++) {
        const currentFile = fileList[i];
        console.log(`\n🚀 [${i + 1}/${fileList.length}] 테스트 파일 ${currentFile} 실행 중...`);

        const fileStartTime = Date.now();

        try {
          // EmulCommand 실행
          const result = await emulCommand.execute({
            name: 'emul',
            args: { file: currentFile },
            rawArgs: {},
            flags: {}
          }, context);

          const fileDuration = Date.now() - fileStartTime;

          results.push({
            filename: currentFile,
            success: result.success,
            output: result.output,
            error: result.error,
            duration: fileDuration
          });

          if (result.success) {
            console.log(`✅ 테스트 파일 ${currentFile} 완료 (${fileDuration}ms)`);
          } else {
            console.log(`❌ 테스트 파일 ${currentFile} 실패: ${result.error} (${fileDuration}ms)`);
          }

        } catch (error) {
          const fileDuration = Date.now() - fileStartTime;
          console.error(`❌ 테스트 파일 ${currentFile} 실행 중 오류:`, error);
          
          results.push({
            filename: currentFile,
            success: false,
            output: [`테스트 파일 ${currentFile} 실행 실패`],
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: fileDuration
          });
        }

        // 마지막이 아니면 잠시 대기 (시스템 안정화)
        if (i < fileList.length - 1) {
          console.log('⏳ 다음 테스트 준비 중... (1초 대기)');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 결과 요약 생성
      return this.generateSummary(results, fileList);

    } catch (error) {
      return {
        success: false,
        output: [
          '❌ Emul Beast 모드 실행 실패',
          `🔍 오류: ${error instanceof Error ? error.message : 'Unknown error'}`
        ],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 파일 목록 문자열 파싱 ("file1,file2,file3" → ["file1", "file2", "file3"])
   */
  private parseFiles(filesStr: string): string[] {
    try {
      return filesStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } catch (error) {
      console.error('파일 목록 파싱 오류:', error);
      return [];
    }
  }

  /**
   * 인수 추출
   */
  private extractArgs(parsedCmd: ParsedCommand) {
    return {
      files: parsedCmd.args.files as string
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
        '  /emul:beast --files="test1,test2,test3"',
        '  /emul:beast --files="로그인-테스트,회원가입-테스트"',
        '  /emul:beast --files="ui-test.spec.ts,api-test.spec.ts"'
      ]
    };
  }

  /**
   * 실행 결과 요약 생성
   */
  private generateSummary(
    results: Array<{ 
      filename: string; 
      success: boolean; 
      output: string[]; 
      error?: string; 
      duration?: number 
    }>,
    requestedFiles: string[]
  ): CommandResult {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

    const output = [
      '🦁 Emul Beast 모드 실행 완료',
      `📁 요청 파일: [${requestedFiles.join(', ')}]`,
      `⏱️ 총 실행 시간: ${totalDuration}ms`,
      `✅ 성공: ${successful.length}개`,
      `❌ 실패: ${failed.length}개`,
      ''
    ];

    // 성공한 테스트들
    if (successful.length > 0) {
      output.push('🎉 성공한 테스트들:');
      successful.forEach(result => {
        const durationStr = result.duration ? ` (${result.duration}ms)` : '';
        output.push(`  • ${result.filename}: 완료${durationStr}`);
      });
      output.push('');
    }

    // 실패한 테스트들
    if (failed.length > 0) {
      output.push('⚠️  실패한 테스트들:');
      failed.forEach(result => {
        const durationStr = result.duration ? ` (${result.duration}ms)` : '';
        output.push(`  • ${result.filename}: ${result.error || '알 수 없는 오류'}${durationStr}`);
      });
      output.push('');
    }

    // 성능 통계
    if (results.length > 1) {
      const avgDuration = Math.round(totalDuration / results.length);
      const fastestTest = results.reduce((min, r) => 
        (r.duration || Infinity) < (min.duration || Infinity) ? r : min
      );
      const slowestTest = results.reduce((max, r) => 
        (r.duration || 0) > (max.duration || 0) ? r : max
      );

      output.push('📊 실행 통계:');
      output.push(`  • 평균 실행 시간: ${avgDuration}ms`);
      if (fastestTest.duration) {
        output.push(`  • 최고 속도: ${fastestTest.filename} (${fastestTest.duration}ms)`);
      }
      if (slowestTest.duration) {
        output.push(`  • 최저 속도: ${slowestTest.filename} (${slowestTest.duration}ms)`);
      }
      output.push('');
    }

    // 전체 성공/실패 판단
    const overallSuccess = failed.length === 0;

    if (overallSuccess) {
      output.push('🎊 모든 테스트가 성공적으로 완료되었습니다!');
    } else if (successful.length > 0) {
      output.push('⚠️  일부 테스트가 실패했지만 다른 테스트들은 성공했습니다.');
    } else {
      output.push('💥 모든 테스트가 실패했습니다.');
    }

    return {
      success: overallSuccess,
      output
    };
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default EmulBeastCommand;