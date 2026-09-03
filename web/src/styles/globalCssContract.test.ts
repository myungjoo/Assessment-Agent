import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GLOBAL_STYLESHEET_SPECIFIER,
  REQUIRED_CSS_TOKENS,
  findMissingTokens,
  hasGlobalStylesheetImport,
} from './globalCssContract';

// R-112 — ADR-0061 D4 전역 CSS 계약 guard 검증.
// AppShell.test.tsx 관행을 따라 node 환경 + readFileSync 로 실파일을 읽어
// "토큰 선언 전부 존재" 와 "진입점 side-effect import 존재" 를 CI 게이트로 고정한다.
// 파일명은 .test.ts 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피
// (ADR-0041 Decision 3).

/** 전 토큰을 선언한 최소 CSS — happy-path 입력. */
function cssDeclaringAllTokens(): string {
  const declarations = REQUIRED_CSS_TOKENS.map((token) => `  ${token}: 0;`).join('\n');
  return `:root {\n${declarations}\n}\n`;
}

describe('findMissingTokens', () => {
  it('전 토큰이 선언된 CSS 에는 누락이 없다 (happy path)', () => {
    expect(findMissingTokens(cssDeclaringAllTokens())).toEqual([]);
  });

  it('빈 문자열에는 전 토큰이 누락으로 잡힌다 (error path)', () => {
    expect(findMissingTokens('')).toEqual([...REQUIRED_CSS_TOKENS]);
  });

  it('토큰이 하나도 없는 CSS 에도 전 토큰이 누락으로 잡힌다 (error path)', () => {
    expect(findMissingTokens('body { color: #000; }')).toEqual([...REQUIRED_CSS_TOKENS]);
  });

  it('일부만 선언된 CSS 는 나머지만 누락으로 잡는다 (분기: 부분 선언)', () => {
    const missing = findMissingTokens(':root { --color-bg: #fff; --space-md: 16px; }');
    expect(missing).not.toContain('--color-bg');
    expect(missing).not.toContain('--space-md');
    expect(missing).toContain('--color-fg');
    expect(missing).toHaveLength(REQUIRED_CSS_TOKENS.length - 2);
  });

  it('참조(var)만 있고 선언이 없으면 누락으로 잡는다 (분기: 참조만 존재 / negative (a))', () => {
    const cssWithReferenceOnly = 'body { background: var(--color-bg); }';
    expect(findMissingTokens(cssWithReferenceOnly)).toContain('--color-bg');
  });

  it('유사 접두 토큰 선언을 짧은 토큰의 선언으로 오인하지 않는다 (negative (d))', () => {
    expect(findMissingTokens(':root { --color-bg-alt: #eee; }')).toContain('--color-bg');
  });

  it('반환 순서는 REQUIRED_CSS_TOKENS 선언 순서를 따른다', () => {
    const declaredOne = `:root { ${REQUIRED_CSS_TOKENS[1]}: 0; }`;
    expect(findMissingTokens(declaredOne)).toEqual(
      REQUIRED_CSS_TOKENS.filter((token) => token !== REQUIRED_CSS_TOKENS[1]),
    );
  });
});

describe('hasGlobalStylesheetImport', () => {
  it('진입점의 side-effect import 줄을 인식한다 (happy path / 분기: 정상 import)', () => {
    const source = [
      "import App from './App';",
      `import '${GLOBAL_STYLESHEET_SPECIFIER}';`,
      'createRoot(document.getElementById("root")!);',
    ].join('\n');
    expect(hasGlobalStylesheetImport(source)).toBe(true);
  });

  it('빈 소스에는 import 가 없다 (error path)', () => {
    expect(hasGlobalStylesheetImport('')).toBe(false);
  });

  it('주석 처리된 import 는 세지 않는다 (분기: 주석 / negative (b))', () => {
    const source = ["// import './styles/global.css';", "import App from './App';"].join('\n');
    expect(hasGlobalStylesheetImport(source)).toBe(false);
  });

  it('블록 주석 이어짐 줄의 import 도 세지 않는다 (negative (b) 보강)', () => {
    const source = ["/*", " * import './styles/global.css';", " */"].join('\n');
    expect(hasGlobalStylesheetImport(source)).toBe(false);
  });

  it('다른 경로의 stylesheet import 는 false (분기: 다른 경로 / negative (c))', () => {
    expect(hasGlobalStylesheetImport("import './styles/other.css';")).toBe(false);
  });

  it('바인딩이 있는 import 는 side-effect import 가 아니므로 false (negative)', () => {
    expect(hasGlobalStylesheetImport("import styles from './styles/global.css';")).toBe(false);
  });
});

describe('실파일 계약 guard (ADR-0061 D4)', () => {
  it('global.css 가 필수 토큰을 모두 선언한다', () => {
    const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
    expect(findMissingTokens(css)).toEqual([]);
  });

  it('global.css 는 외부 URL 을 @import 하지 않는다 (ADR-0061 D1)', () => {
    const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
    // 규칙(at-rule) 로서의 @import 만 금지 — 파일 상단 주석의 서술 언급은 대상 아니다.
    expect(css).not.toMatch(/^[ 	]*@import/m);
  });

  it('main.tsx 가 전역 stylesheet 를 side-effect import 한다', () => {
    const entry = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
    expect(hasGlobalStylesheetImport(entry)).toBe(true);
  });
});
