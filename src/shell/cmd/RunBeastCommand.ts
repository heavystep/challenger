import type { CommandResult, CommandContext } from './types';
import { Command } from './types';
import type { ParsedCommand } from '../parser';
import { getCommand } from './index';

/**
 * 다중 케이스 배치 실행 명령어 클래스
 */
export class RunBeastCommand extends Command {
  readonly name = 'run:beast';
  readonly description = '여러 케이스를 순차적으로 배치 실행';
  
  readonly args = {
    file: {
      type: 'string' as const,
      required: true,
      description: 'GenCommand가 생성한 JSON 파일명'
    },
    indexes: {
      type: 'string' as const,
      required: true,
      description: '실행할 케이스들의 인덱스 (쉼표로 구분: 예 "1,2,3")'
    }
  };

  /**
   * 명령어 실행 - 다중 케이스 순차 처리
   */
  async execute(parsedCmd: ParsedCommand, context?: CommandContext): Promise<CommandResult> {
    try {
      console.log('🦁 Beast 모드 실행 시작');
      
      // 인수 검증
      const validation = this.validateArgs(parsedCmd);
      if (!validation.valid) {
        return this.createErrorResult(validation.error);
      }

      // 인수 추출
      const { file, indexes } = this.extractArgs(parsedCmd);
      console.log(`📋 Beast 인수: FILENAME=${file}, INDEXES=${indexes}`);

      // 인덱스 파싱
      const indexList = this.parseIndexes(indexes);
      if (indexList.length === 0) {
        return this.createErrorResult('유효한 인덱스가 없습니다');
      }

      console.log(`🎯 실행할 케이스 수: ${indexList.length}개 [${indexList.join(', ')}]`);

      // RunCommand 인스턴스 가져오기
      const runCommand = getCommand('run');
      if (!runCommand) {
        return this.createErrorResult('RunCommand를 찾을 수 없습니다');
      }

      // 결과 수집용 배열
      const results: Array<{
        index: number;
        success: boolean;
        output: string[];
        error?: string;
      }> = [];

      // 각 인덱스별 순차 실행
      for (let i = 0; i < indexList.length; i++) {
        const currentIndex = indexList[i];
        console.log(`\n🚀 [${i + 1}/${indexList.length}] 케이스 ${currentIndex} 실행 중...`);

        try {
          // RunCommand 실행
          const result = await runCommand.execute({
            name: 'run',
            args: { file, index: currentIndex },
            rawArgs: {},
            flags: {}
          }, context);

          results.push({
            index: currentIndex,
            success: result.success,
            output: result.output,
            error: result.error
          });

          if (result.success) {
            console.log(`✅ 케이스 ${currentIndex} 완료`);
          } else {
            console.log(`❌ 케이스 ${currentIndex} 실패: ${result.error}`);
          }

        } catch (error) {
          console.error(`❌ 케이스 ${currentIndex} 실행 중 오류:`, error);
          results.push({
            index: currentIndex,
            success: false,
            output: [`케이스 ${currentIndex} 실행 실패`],
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // 마지막이 아니면 잠시 대기 (브라우저 안정화)
        if (i < indexList.length - 1) {
          console.log('⏳ 다음 케이스 준비 중... (2초 대기)');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // 결과 요약 생성
      return this.generateSummary(results, file, indexList);

    } catch (error) {
      return {
        success: false,
        output: [
          '❌ Beast 모드 실행 실패',
          `🔍 오류: ${error instanceof Error ? error.message : 'Unknown error'}`
        ],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 인덱스 문자열 파싱 ("1,2,3" → [1, 2, 3])
   */
  private parseIndexes(indexesStr: string): number[] {
    try {
      return indexesStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n) && n >= 0);
    } catch (error) {
      console.error('인덱스 파싱 오류:', error);
      return [];
    }
  }

  /**
   * 인수 추출
   */
  private extractArgs(parsedCmd: ParsedCommand) {
    return {
      file: parsedCmd.args.file as string,
      indexes: parsedCmd.args.indexes as string
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
        '  /run:beast --file="example" --indexes="0,1,2"',
        '  /run:beast --file="github-com-search.json" --indexes="1,3,5"',
        '  /run:beast --file="test-cases" --indexes="0,2"'
      ]
    };
  }

  /**
   * 실행 결과 요약 생성
   */
  private generateSummary(
    results: Array<{ index: number; success: boolean; output: string[]; error?: string }>,
    file: string,
    requestedIndexes: number[]
  ): CommandResult {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const output = [
      '🦁 Beast 모드 실행 완료',
      `📁 파일: ${file}`,
      `📊 요청 케이스: [${requestedIndexes.join(', ')}]`,
      `✅ 성공: ${successful.length}개`,
      `❌ 실패: ${failed.length}개`,
      ''
    ];

    // 성공한 케이스들
    if (successful.length > 0) {
      output.push('🎉 성공한 케이스들:');
      successful.forEach(result => {
        output.push(`  • 케이스 ${result.index}: 완료`);
      });
      output.push('');
    }

    // 실패한 케이스들
    if (failed.length > 0) {
      output.push('⚠️  실패한 케이스들:');
      failed.forEach(result => {
        output.push(`  • 케이스 ${result.index}: ${result.error || '알 수 없는 오류'}`);
      });
      output.push('');
    }

    // 전체 성공/실패 판단
    const overallSuccess = failed.length === 0;

    if (overallSuccess) {
      output.push('🎊 모든 케이스가 성공적으로 완료되었습니다!');
    } else if (successful.length > 0) {
      output.push('⚠️  일부 케이스가 실패했지만 다른 케이스들은 성공했습니다.');
    } else {
      output.push('💥 모든 케이스가 실패했습니다.');
    }

    return {
      success: overallSuccess,
      output
    };
  }
}

// 클래스만 export (인스턴스는 레지스트리에서 생성)
export default RunBeastCommand;