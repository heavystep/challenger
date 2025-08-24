/**
 * TINYSHOT - 단일 진입점 모듈
 * HTML을 압축하여 토큰 사용량 98% 절약
 */
import Tinyshot from './tinyshot'
export type { CompSnapshot, Elem, CompOpts } from './types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

class TinyshotTool {
  /**
   * 스마트 스냅샷 실행 - 기존 스냅샷을 압축하여 반환
   * @param mcpClient MCP 클라이언트
   * @param args 도구 인수
   * @returns 압축된 스냅샷 결과
   */
  static async exec(mcpClient: any, args: any = {}): Promise<CallToolResult> {
    try {
      // 1. 기존 browser_snapshot 호출
      const result = await mcpClient.callTool({
        name: 'browser_snapshot',
        arguments: {}
      });

      // 2. HTML 추출
      const html = this.extractHtml(result);
      if (!html) throw new Error('HTML 추출 실패');

      // 3. 압축 수행 - 더 많은 컨텍스트 제공
      const comp = Tinyshot.tiny(html, {
        maxText: args.maxText || 3000,    // 1000 → 3000 (3배 증가)
        maxElems: args.maxElems || 50     // 15 → 50 (3.3배 증가)
      });

      // 4. 압축된 JSON 직접 반환 (토큰 효율성)
      return {
        content: [{ type: 'text', text: JSON.stringify(comp, null, 2) }]
      };
    } catch (err) {
      throw new Error(`스마트 스냅샷 실패: ${err}`);
    }
  }

  /** MCP 응답에서 HTML 추출 */
  private static extractHtml(result: CallToolResult): string {
    if (!result.content?.[0]) return '';
    
    const content = result.content[0];
    if (content.type !== 'text') return '';

    try {
      const data = JSON.parse(content.text);
      return data.html || data.content || content.text;
    } catch {
      return content.text;
    }
  }
}

/**
 * 타이니샷 압축기 - 순수 HTML 압축 함수
 * @param html 원본 HTML
 * @param opts 압축 옵션
 * @returns 압축된 스냅샷
 */
const tinyshot = {
  tinyshot: Tinyshot.tiny.bind(Tinyshot),
  execTool: TinyshotTool.exec.bind(TinyshotTool)
};

export default tinyshot;