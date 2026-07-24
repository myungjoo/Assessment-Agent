// web↔backend contract-guard 공용 정규식 추출기 모듈 (T-1201, refactor split slice 1).
//
// 30+ 개 contract-guard spec 이 파일마다 복사해 들고 있던 invariant 추출기 8종을
// 단일 공용 helper 로 신설한다. 본문은 `AdminView.schedules-list-contract.test.ts`
// (T-1200 원본, L15~99) 와 **의미 동일** — 정규식·괄호매칭 로직 무변형, 옮기기만 했다.
// 소비 spec 의 inline → import 이관은 본 slice 범위 밖(후속 split slice 가 파일당 처리).

// 주석 제거 — 추출이 주석 문구의 `@Controller`/`@Get` 등을 실 decorator 로 오인하면 guard 가
// 무력화된다(negative false-positive 방어). 블록 주석 `/* */` 과 줄 주석 `//` 둘 다 제거.
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

// `@Controller("...")` base route 추출. 부재 시 null(빈 소스가 falsy 통과로 오인되지 않도록 선단언).
export function extractControllerRoute(source: string): string | null {
  const matched = /^[ \t]*@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/m.exec(stripComments(source));
  return matched ? matched[1] : null;
}

export interface HandlerDecorator {
  method: string;
  subPath: string;
}

// handler 이름 → {HTTP method, subPath} 매핑. HTTP method decorator(@Get/@Post/@Put/@Patch/@Delete)만
// pending 으로 잡고, 그 외 decorator(@HttpCode/@UseGuards/@Roles)는 handler 로 오인하지 않고 skip 한다.
export function extractHandlerMethods(source: string): Record<string, HandlerDecorator> {
  const found: Record<string, HandlerDecorator> = {};
  let pending: HandlerDecorator | null = null;
  for (const line of stripComments(source).split('\n')) {
    const decorator = /^[ \t]*@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`]\s*)?\)/.exec(line);
    if (decorator) {
      pending = { method: decorator[1].toUpperCase(), subPath: decorator[2] ?? '' };
      continue;
    }
    if (/^[ \t]*@/.test(line)) {
      continue; // 그 외 decorator(@HttpCode/@UseGuards/@Roles)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      found[handler[1]] = pending;
      pending = null;
    }
  }
  return found;
}

// handler 파라미터를 균형 괄호 매칭으로 슬라이스 — @Body/@Param 을 handler 서명 안에서만 판정. 부재 null.
// 인자 0 handler 는 빈 문자열('')을 반환 → hasBody/hasParam 둘 다 false. 미종결(닫는 괄호 부재) 시 null.
export function extractHandlerParams(source: string, handlerName: string): string | null {
  const stripped = stripComments(source);
  const m = new RegExp(`(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?\\b${handlerName}\\s*\\(`).exec(stripped);
  if (!m) {
    return null;
  }
  let depth = 0;
  const start = m.index + m[0].length;
  for (let i = start - 1; i < stripped.length; i++) {
    if (stripped[i] === '(') {
      depth++;
    } else if (stripped[i] === ')' && --depth === 0) {
      return stripped.slice(start, i);
    }
  }
  return null;
}

// route 앞에 leading slash 를 보장한다(있으면 그대로, 없으면 부여).
export const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);

// base route + subPath 합성. subPath 有 → `/base/sub`, 無 → `/base`.
export function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}

// 경로를 세그먼트 배열로 분해(빈 세그먼트 제거).
export const pathSegments = (route: string): string[] => route.split('/').filter(Boolean);

// `?_r=n` cache-buster query 제거 — base 만 대조. query 부재 시 원본 그대로.
export const stripQuery = (path: string): string => path.split('?')[0];
