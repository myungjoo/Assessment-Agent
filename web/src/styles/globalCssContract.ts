// ADR-0061 D4 — 전역 CSS 계약 guard 의 순수 함수 층.
//
// CSS 는 타입 검사도 lint 도 받지 않아 조용히 깨진다: `:root` 토큰 선언이
// 지워져도 `var()` 참조는 무시될 뿐 빌드가 통과하고, 진입점의 stylesheet
// import 가 빠져도 빌드는 통과한다. 그래서 "토큰이 선언돼 있는가" 와
// "진입점이 stylesheet 를 side-effect import 하는가" 를 문자열 계약으로
// 검사한다. 본 모듈은 DOM · fs 접근이 없는 순수 함수만 둔다 — 실파일 읽기는
// colocated spec (globalCssContract.test.ts) 의 책임이다.

/** ADR-0061 D3 — `web/src/styles/global.css` 가 반드시 선언해야 하는 `:root` 토큰. */
export const REQUIRED_CSS_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-fg',
  '--color-muted',
  '--color-border',
  '--color-accent',
  '--color-danger',
  '--space-xs',
  '--space-sm',
  '--space-md',
  '--space-lg',
  '--font-base',
  '--font-size-base',
  '--radius-sm',
  '--radius-md',
] as const;

/** ADR-0061 D2 — 진입점이 side-effect import 해야 하는 유일한 stylesheet 경로. */
export const GLOBAL_STYLESHEET_SPECIFIER = './styles/global.css';

/** 정규식 메타문자를 이스케이프한다 (토큰 · 경로를 리터럴로 매칭하기 위함). */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `css` 안에 **선언** 이 없는 필수 토큰 목록을 선언 순서대로 반환한다.
 *
 * 선언으로 인정하는 모양은 `--token:` 뿐이다 — `var(--token)` 같은 **참조만**
 * 있는 경우는 선언으로 치지 않는다. 또한 토큰 앞뒤 경계를 검사해
 * `--color-bg-alt: ...` 가 `--color-bg` 의 선언으로 오인되지 않게 한다.
 */
export function findMissingTokens(css: string): string[] {
  return REQUIRED_CSS_TOKENS.filter((token) => {
    // (^|[^-\w]) — 앞이 식별자 문자가 아니어야 한다 (더 긴 토큰의 꼬리 매칭 차단).
    // \s*: — 뒤는 공백 후 콜론이어야 한다 (선언만 인정, 참조 `var(--x)` 는 제외).
    const declaration = new RegExp(`(^|[^-\\w])${escapeForRegExp(token)}\\s*:`);
    return !declaration.test(css);
  });
}

/**
 * 진입점 소스가 전역 stylesheet 를 side-effect import 하는지 판정한다.
 *
 * - 줄 주석 · 블록 주석 · JSDoc 이어짐 줄로 시작하는 줄은 세지 않는다.
 * - 다른 경로(`./styles/other.css`)나 바인딩 있는 import(`import x from ...`)도 false.
 */
export function hasGlobalStylesheetImport(entrySource: string): boolean {
  const sideEffectImport = new RegExp(
    `^import\\s+['"]${escapeForRegExp(GLOBAL_STYLESHEET_SPECIFIER)}['"]\\s*;?\\s*$`,
  );
  return entrySource
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
    .some((line) => sideEffectImport.test(line));
}
