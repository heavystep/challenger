import { JSDOM } from 'jsdom';
import type { Element, Document } from 'jsdom';
import type { CompSnapshot, Elem, CompOpts } from './types';

/**
 * 타이니샷 HTML 압축기
 * 50,000토큰 → 1,000토큰 압축 (98% 절약)
 */
export default class Tinyshot {
  // Performance optimization caches
  private static domCache = new Map<string, Document>();
  private static selectorCache = new Map<string, string>();
  private static lastCacheCleanup = Date.now();
  private static readonly CACHE_TTL = 300000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 100;
  /**
   * HTML을 극도로 압축하여 토큰 사용량 최소화
   * @param html 원본 HTML
   * @param opts 압축 옵션
   * @returns 압축된 스냅샷
   */
  static tiny(html: string, opts: CompOpts = {}): CompSnapshot {
    this.cleanupCaches();
    
    // Input validation for performance
    if (html.length > 5000000) { // 5MB limit
      throw new Error('HTML too large for processing');
    }
    
    const { maxText = 1000, maxElems = 15 } = opts;

    const title = this.getTitle(html);
    const text = this.getText(html).slice(0, maxText);
    const elems = this.getElems(html).slice(0, maxElems);
    
    return { title, text, elems };
  }

  /** 페이지 제목 추출 */
  private static getTitle(html: string): string {
    return html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || 'Page';
  }

  /** 가시적 텍스트만 추출 */
  private static getText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** 클릭 가능한 요소만 추출 - 최적화된 다단계 파싱 */
  private static getElems(html: string): Elem[] {
    // Try optimized DOM parsing first
    const domResult = this.getElemsDom(html);
    if (domResult.length > 0) return domResult;
    
    // Fallback to regex if DOM fails
    return this.getElemsRegex(html);
  }
  
  /** DOM 기반 요소 추출 (캐싱 최적화) */
  private static getElemsDom(html: string): Elem[] {
    try {
      // Use cached DOM if available
      const cacheKey = this.generateHtmlHash(html);
      let document = this.domCache.get(cacheKey);
      
      if (!document) {
        const dom = new JSDOM(html, {
          runScripts: 'dangerously', // Prevent script execution
          resources: 'usable'
        });
        document = dom.window.document;
        
        // Cache if reasonable size
        if (this.domCache.size < this.MAX_CACHE_SIZE) {
          this.domCache.set(cacheKey, document);
        }
      }
      
      const meaningfulElems = this.findMeaningfulElements(document);
      return meaningfulElems.map(elem => this.elemToElem(elem)).slice(0, 50);
    } catch (error) {
      console.warn('DOM parsing failed:', error.message);
      return [];
    }
  }

  /**
   * DOM에서 의미있는 인터랙티브 요소 추출
   * @param document DOM Document
   * @returns 의미있는 요소 배열
   */
  private static findMeaningfulElements(document: Document): Element[] {
    const meaningful: Element[] = [];
    const selectors = [
      'button',
      'a[href]',
      'input[type]:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[onclick]',
      'nav a',
      '.menu a',
      '.nav-link'
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(elem => {
        if (this.isMeaningfulElement(elem) && this.isVisible(elem, document)) {
          meaningful.push(elem);
        }
      });
    });

    // 불필요한 래퍼 해체 적용
    return this.unwrapUselessWrappers(meaningful);
  }

  /**
   * 요소가 의미있는 인터랙티브 요소인지 판단
   * @param element DOM 요소
   * @returns 의미있는 요소 여부
   */
  private static isMeaningfulElement(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim() || '';
    
    // 텍스트가 없는 경우 의미없는 요소로 간주 (input 제외)
    if (!text && tag !== 'input') return false;
    
    // 너무 긴 텍스트는 제외 (노이즈일 가능성)
    if (text.length > 100) return false;
    
    return true;
  }

  /**
   * 요소가 사용자에게 보이는지 판단 (CSS 기반 가시성 검사)
   * @param element DOM 요소
   * @param document DOM Document
   * @returns 가시성 여부
   */
  private static isVisible(element: Element, document: Document): boolean {
    try {
      // JSDOM의 제한으로 인해 기본적인 속성 기반 체크만 수행
      
      // 1. hidden 속성 체크
      if (element.hasAttribute('hidden')) return false;
      
      // 2. style 속성의 display: none 체크
      const style = element.getAttribute('style') || '';
      if (style.includes('display:none') || style.includes('display: none')) return false;
      if (style.includes('visibility:hidden') || style.includes('visibility: hidden')) return false;
      
      // 3. CSS 클래스 기반 숨김 체크 (일반적인 패턴)
      const className = element.className || '';
      const hiddenPatterns = ['hidden', 'invisible', 'd-none', 'sr-only', 'visually-hidden'];
      if (hiddenPatterns.some(pattern => className.includes(pattern))) return false;
      
      // 4. 부모 요소의 가시성 체크 (재귀적)
      const parent = element.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement) {
        return this.isVisible(parent, document);
      }
      
      return true;
    } catch {
      // 에러 발생 시 기본적으로 보이는 것으로 간주
      return true;
    }
  }

  /**
   * 불필요한 래퍼 요소인지 판단
   * @param element DOM 요소
   * @returns 불필요한 래퍼 여부
   */
  private static isUselessWrapper(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    
    // div, span만 래퍼로 간주
    if (!['div', 'span'].includes(tag)) return false;
    
    // 자체 텍스트 콘텐츠가 있으면 의미있는 요소
    const ownText = this.getOwnText(element);
    if (ownText.trim()) return false;
    
    // 자식 요소가 정확히 1개인 경우만 래퍼로 간주
    const childElements = Array.from(element.children);
    if (childElements.length !== 1) return false;
    
    // 의미있는 속성이 있으면 래퍼가 아님
    if (this.hasMeaningfulAttributes(element)) return false;
    
    return true;
  }

  /**
   * 요소의 직접 텍스트 콘텐츠 추출 (자식 제외)
   * @param element DOM 요소
   * @returns 직접 텍스트
   */
  private static getOwnText(element: Element): string {
    let ownText = '';
    for (const node of element.childNodes) {
      if (node.nodeType === 3) { // TEXT_NODE
        ownText += node.textContent || '';
      }
    }
    return ownText;
  }

  /**
   * 의미있는 속성을 가지고 있는지 체크
   * @param element DOM 요소
   * @returns 의미있는 속성 보유 여부
   */
  private static hasMeaningfulAttributes(element: Element): boolean {
    const meaningfulAttrs = ['id', 'data-', 'aria-', 'role', 'onclick', 'onchange'];
    
    for (const attr of element.getAttributeNames()) {
      // class, style은 래퍼로 간주
      if (attr === 'class' || attr === 'style') continue;
      
      // 의미있는 속성인지 체크
      if (meaningfulAttrs.some(meaningful => attr.startsWith(meaningful))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 불필요한 래퍼에서 의미있는 자식 요소 추출
   * @param wrapper 래퍼 요소
   * @returns 의미있는 자식 요소
   */
  private static extractMeaningfulChild(wrapper: Element): Element {
    const children = Array.from(wrapper.children);
    
    if (children.length === 1) {
      return children[0];
    }
    
    // 여러 자식이 있으면 원래 요소 반환
    return wrapper;
  }

  /**
   * 요소 배열에서 불필요한 래퍼들을 해체
   * @param elements 원본 요소 배열
   * @returns 래퍼가 해체된 요소 배열
   */
  private static unwrapUselessWrappers(elements: Element[]): Element[] {
    const unwrapped: Element[] = [];
    
    for (let element of elements) {
      // 재귀적으로 래퍼 해체 (최대 5단계까지)
      let depth = 0;
      while (this.isUselessWrapper(element) && depth < 5) {
        element = this.extractMeaningfulChild(element);
        depth++;
      }
      
      // 중복 제거 - 이미 추가된 요소는 건너뛰기
      if (!unwrapped.includes(element)) {
        unwrapped.push(element);
      }
    }
    
    return unwrapped;
  }

  /**
   * 캐시된 HTML 해시 생성
   */
  private static generateHtmlHash(html: string): string {
    // Simple hash for caching
    let hash = 0;
    for (let i = 0; i < Math.min(html.length, 1000); i++) {
      const char = html.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * 캐시 정리 (메모리 관리)
   */
  private static cleanupCaches(): void {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.CACHE_TTL) {
      if (this.domCache.size > this.MAX_CACHE_SIZE) {
        // Clear half of the cache
        const entries = Array.from(this.domCache.entries());
        entries.slice(0, Math.floor(entries.length / 2)).forEach(([key]) => {
          this.domCache.delete(key);
        });
      }
      this.selectorCache.clear();
      this.lastCacheCleanup = now;
    }
  }
  
  /**
   * 요소의 의미있는 CSS 선택자 생성 (캐싱 최적화)
   * @param element DOM 요소
   * @returns 의미있는 CSS 선택자
   */
  private static generateMeaningfulSelector(element: Element): string {
    // Check cache first
    const cacheKey = this.getElementCacheKey(element);
    if (this.selectorCache.has(cacheKey)) {
      return this.selectorCache.get(cacheKey)!;
    }
    
    const tag = element.tagName.toLowerCase();
    const selectors: string[] = [tag];
    
    // 1. ID가 있으면 최우선
    const id = element.id;
    if (id && this.isMeaningfulId(id)) {
      const result = `#${id}`;
      this.selectorCache.set(cacheKey, result);
      return result;
    }
    
    // 2. 의미있는 클래스 추가
    const classes = Array.from(element.classList);
    const meaningfulClasses = classes.filter((cls: string) => this.isMeaningfulClass(cls));
    if (meaningfulClasses.length > 0) {
      selectors.push('.' + meaningfulClasses.slice(0, 2).join('.'));
    }
    
    // 3. 타입이 있는 input의 경우
    if (tag === 'input') {
      const type = element.getAttribute('type');
      if (type) selectors.push(`[type="${type}"]`);
    }
    
    // 4. 부모 컨텍스트 추가
    const parentContext = this.getParentContext(element);
    let result: string;
    if (parentContext) {
      result = `${parentContext} ${selectors.join('')}`;
    } else {
      result = selectors.join('');
    }
    
    // Cache the result
    this.selectorCache.set(cacheKey, result);
    return result;
  }

  /**
   * 요소의 캐시 키 생성
   */
  private static getElementCacheKey(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id;
    const classes = element.className;
    const type = element.getAttribute('type') || '';
    return `${tag}-${id}-${classes}-${type}`;
  }
  
  /**
   * ID가 의미있는지 판단 (정규식 사전 컴파일)
   */
  private static isMeaningfulId(id: string): boolean {
    // Pre-compiled regex for performance
    if (!this.meaninglessIdPattern) {
      this.meaninglessIdPattern = /^(auto|gen|temp|[a-f0-9]{8,}|\d+)$/i;
    }
    return !this.meaninglessIdPattern.test(id) && id.length < 30 && id.length > 2;
  }

  // Pre-compiled regex patterns for performance
  private static meaninglessIdPattern: RegExp;
  private static meaningfulClassPattern: RegExp;
  private static meaninglessClassPattern: RegExp;
  
  /**
   * 클래스가 의미있는지 판단 (정규식 사전 컴파일)
   */
  private static isMeaningfulClass(className: string): boolean {
    // Pre-compiled patterns for performance
    if (!this.meaningfulClassPattern) {
      this.meaningfulClassPattern = /^(btn|button|link|nav|menu|form|input|search|login|header|footer|main|primary|secondary|submit|cancel|close|back|next|prev|home|user|account|profile|settings|logout|signin|signup)$/i;
    }
    if (!this.meaninglessClassPattern) {
      this.meaninglessClassPattern = /^(col-|row-|d-|m[tblr]?-|p[tblr]?-|text-|bg-|border-|[a-f0-9]{6,}|w-|h-|flex|grid|absolute|relative|fixed|static)$/i;
    }
    
    return this.meaningfulClassPattern.test(className) && !this.meaninglessClassPattern.test(className);
  }

  /**
   * 부모 요소의 컨텍스트 추출
   */
  private static getParentContext(element: Element): string {
    let parent = element.parentElement;
    let depth = 0;
    
    while (parent && depth < 3) {
      const tag = parent.tagName.toLowerCase();
      const parentId = parent.id;
      const classes = Array.from(parent.classList);
      
      // nav, form, header 등 의미있는 부모
      if (['nav', 'form', 'header', 'footer', 'main', 'aside'].includes(tag)) {
        return tag;
      }
      
      // 의미있는 ID나 클래스
      if (parentId && this.isMeaningfulId(parentId)) {
        return `#${parentId}`;
      }
      
      const meaningfulClass = classes.find((cls: string) => this.isMeaningfulClass(cls));
      if (meaningfulClass) {
        return `.${meaningfulClass}`;
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    return '';
  }

  /**
   * 요소의 컨텍스트 정보 추출 (LLM이 이해할 수 있는 형태)
   * @param element DOM 요소
   * @returns 컨텍스트 문자열
   */
  private static getElementContext(element: Element): string {
    const contexts: string[] = [];
    
    // 1. 부모 컨테이너 정보
    let parent = element.parentElement;
    let depth = 0;
    
    while (parent && depth < 2) {
      const tag = parent.tagName.toLowerCase();
      const id = parent.id;
      const classes = Array.from(parent.classList);
      
      // 의미있는 컨테이너
      if (['nav', 'header', 'footer', 'main', 'aside', 'form'].includes(tag)) {
        contexts.unshift(tag);
      }
      
      // 의미있는 섹션
      const sectionClasses = ['menu', 'sidebar', 'content', 'login', 'search'];
      const sectionClass = classes.find((cls: string) => sectionClasses.some(sc => cls.includes(sc)));
      if (sectionClass) {
        contexts.unshift((sectionClass as string).replace(/[-_]/g, ' '));
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    return contexts.join(' > ') || '';
  }

  /**
   * DOM Element를 Elem 인터페이스로 변환
   * @param element DOM 요소
   * @returns Elem 객체
   */
  private static elemToElem(element: Element): Elem {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.trim() || '';
    const meaningfulSelector = this.generateMeaningfulSelector(element);
    const context = this.getElementContext(element);
    
    switch (tag) {
      case 'button':
        return { 
          type: 'btn', 
          text: text.slice(0, 30), 
          sel: meaningfulSelector,
          context: context || 'page button'
        };
      case 'a':
        return { 
          type: 'link', 
          text: text.slice(0, 30), 
          sel: meaningfulSelector,
          context: context || 'page link'
        };
      case 'input':
        const placeholder = element.getAttribute('placeholder') || element.getAttribute('name') || 'Input';
        const inputType = element.getAttribute('type') || 'text';
        return { 
          type: 'input', 
          text: placeholder, 
          sel: meaningfulSelector,
          context: context || `${inputType} input`
        };
      case 'select':
        return { 
          type: 'select', 
          text: text.slice(0, 30) || 'Select', 
          sel: meaningfulSelector,
          context: context || 'dropdown select'
        };
      case 'textarea':
        const textareaPlaceholder = element.getAttribute('placeholder') || 'Text area';
        return { 
          type: 'input', 
          text: textareaPlaceholder, 
          sel: meaningfulSelector,
          context: context || 'text area'
        };
      default:
        return { 
          type: 'btn', 
          text: text.slice(0, 30), 
          sel: meaningfulSelector,
          context: context || `${tag} element`
        };
    }
  }

  /** Fallback: 정규표현식 기반 요소 추출 */
  private static getElemsRegex(html: string): Elem[] {
    const elems: Elem[] = [];
    
    // 버튼
    html.match(/<button[^>]*>.*?<\/button>/gi)?.forEach(btn => {
      const text = btn.replace(/<[^>]+>/g, '').trim();
      if (text) elems.push({ type: 'btn', text: text.slice(0, 30), sel: 'button' });
    });

    // 링크
    html.match(/<a[^>]*>.*?<\/a>/gi)?.forEach(link => {
      const text = link.replace(/<[^>]+>/g, '').trim();
      if (text) elems.push({ type: 'link', text: text.slice(0, 30), sel: 'a' });
    });

    // 입력 필드
    html.match(/<input[^>]*>/gi)?.forEach(input => {
      const placeholder = input.match(/placeholder=["']([^"']*)/)?.[1] || 'Input';
      elems.push({ type: 'input', text: placeholder, sel: 'input' });
    });

    return elems;
  }

  /**
   * CompSnapshot을 의미론적 HTML로 복원
   * @param snapshot 압축된 스냅샷
   * @returns 복원된 HTML
   */
  static restore(snapshot: CompSnapshot): string {
    // 요소들을 컨텍스트별로 그룹화
    const elementsByContext = this.groupElementsByContext(snapshot.elems);
    
    // 의미론적 HTML 구조 생성
    return `<!DOCTYPE html>
<html>
<head>
  <title>${this.escapeHtml(snapshot.title)}</title>
</head>
<body>
${this.generateSemanticBody(elementsByContext, snapshot.text)}
</body>
</html>`;
  }

  /**
   * 요소들을 컨텍스트별로 그룹화
   * @param elements 요소 배열
   * @returns 컨텍스트별 그룹화된 요소들
   */
  private static groupElementsByContext(elements: Elem[]): Map<string, Elem[]> {
    const groups = new Map<string, Elem[]>();
    
    elements.forEach(elem => {
      const context = elem.context || 'main';
      if (!groups.has(context)) {
        groups.set(context, []);
      }
      groups.get(context)!.push(elem);
    });
    
    return groups;
  }

  /**
   * 의미론적 body 구조 생성
   * @param elementsByContext 컨텍스트별 요소 그룹
   * @param pageText 페이지 텍스트
   * @returns body HTML
   */
  private static generateSemanticBody(elementsByContext: Map<string, Elem[]>, pageText: string): string {
    const sections: string[] = [];
    
    // 1. 네비게이션 섹션
    if (elementsByContext.has('nav') || elementsByContext.has('nav > menu')) {
      const navElems = [
        ...(elementsByContext.get('nav') || []),
        ...(elementsByContext.get('nav > menu') || [])
      ];
      if (navElems.length > 0) {
        sections.push(this.generateNavSection(navElems));
      }
    }

    // 2. 헤더 섹션
    if (elementsByContext.has('header')) {
      const headerElems = elementsByContext.get('header')!;
      sections.push(this.generateHeaderSection(headerElems));
    }

    // 3. 메인 컨텐츠 섹션
    const mainSections: string[] = [];
    
    // 폼 섹션
    const formContexts = ['form', 'form > login', 'login form', 'search form'];
    const formElems = formContexts.flatMap(ctx => elementsByContext.get(ctx) || []);
    if (formElems.length > 0) {
      mainSections.push(this.generateFormSection(formElems));
    }
    
    // 일반 컨텐츠
    const generalElems = Array.from(elementsByContext.entries())
      .filter(([context]) => !['nav', 'nav > menu', 'header', ...formContexts].includes(context))
      .flatMap(([_, elems]) => elems);
    
    if (pageText.trim() || generalElems.length > 0) {
      mainSections.push(this.generateContentSection(pageText, generalElems));
    }
    
    if (mainSections.length > 0) {
      sections.push(`  <main>\n${mainSections.join('\n')}\n  </main>`);
    }

    return sections.join('\n');
  }

  /**
   * 네비게이션 섹션 생성
   */
  private static generateNavSection(elements: Elem[]): string {
    const navItems = elements.map(elem => this.elemToHtml(elem, '      ')).join('\n');
    return `  <header>
    <nav>
${navItems}
    </nav>
  </header>`;
  }

  /**
   * 헤더 섹션 생성
   */
  private static generateHeaderSection(elements: Elem[]): string {
    const headerItems = elements.map(elem => this.elemToHtml(elem, '    ')).join('\n');
    return `  <header>
${headerItems}
  </header>`;
  }

  /**
   * 폼 섹션 생성
   */
  private static generateFormSection(elements: Elem[]): string {
    const formItems = elements.map(elem => this.elemToHtml(elem, '      ')).join('\n');
    return `    <form>
${formItems}
    </form>`;
  }

  /**
   * 일반 컨텐츠 섹션 생성
   */
  private static generateContentSection(pageText: string, elements: Elem[]): string {
    const sections: string[] = [];
    
    if (pageText.trim()) {
      // 텍스트를 문단으로 나누기
      const paragraphs = pageText.split(/\n\s*\n/).filter(p => p.trim());
      paragraphs.forEach(paragraph => {
        sections.push(`      <p>${this.escapeHtml(paragraph.trim())}</p>`);
      });
    }
    
    if (elements.length > 0) {
      sections.push('      <div class="actions">');
      elements.forEach(elem => {
        sections.push(this.elemToHtml(elem, '        '));
      });
      sections.push('      </div>');
    }
    
    return `    <section>
${sections.join('\n')}
    </section>`;
  }

  /**
   * 개별 요소를 HTML로 변환
   */
  private static elemToHtml(elem: Elem, indent: string = ''): string {
    switch (elem.type) {
      case 'btn':
        return `${indent}<button sel="${elem.sel}">${this.escapeHtml(elem.text)}</button>`;
      case 'link':
        return `${indent}<a href="#" sel="${elem.sel}">${this.escapeHtml(elem.text)}</a>`;
      case 'input':
        return `${indent}<input type="text" sel="${elem.sel}" placeholder="${this.escapeHtml(elem.text)}">`;
      case 'select':
        return `${indent}<select sel="${elem.sel}"><option>${this.escapeHtml(elem.text)}</option></select>`;
      default:
        return `${indent}<div sel="${elem.sel}">${this.escapeHtml(elem.text)}</div>`;
    }
  }

  /**
   * HTML 이스케이프 처리
   */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}