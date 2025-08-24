/**
 * TINYSHOT - 초경량 타입 정의
 * Rate Limit 해결을 위한 최소 필수 타입만 포함
 */

/** 압축된 스냅샷 결과 */
export interface CompSnapshot {
    /** 페이지 제목 */
    title: string;
    /** 압축된 텍스트 (1000자 제한) */
    text: string;
    /** 클릭 가능한 요소들 */
    elems: Elem[];
  }
  
  /** 인터랙티브 요소 */
  export interface Elem {
    /** 요소 타입 */
    type: 'btn' | 'input' | 'link' | 'select';
    /** 표시 텍스트 */
    text: string;
    /** CSS 선택자 */
    sel: string;
    /** 요소 위치 컨텍스트 */
    context?: string;
    /** XPath (정확한 타겟팅용) */
    xpath?: string;
    /** 고유 ID (브라우저 자동화용) */
    id?: string;
  }
  
  /** 압축 옵션 */
  export interface CompOpts {
    /** 최대 텍스트 길이 */
    maxText?: number;
    /** 최대 요소 개수 */
    maxElems?: number;
  }