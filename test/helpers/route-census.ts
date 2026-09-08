// route-census.ts — 두 census drift smoke 가 공유하는 **정적 추출 primitive** 단일 출처 (T-1986).
//
// 존재 이유 — T-1983(guard 적용률 축 · REQ-043)과 T-1985(e2e 왕복 커버리지 축 · PLAN 166 행)이
// 각자 자기 spec 안에 byte-identical 토크나이저를 복제해 뒀다. 추출기 결함 1 건을 한쪽에서만
// 고치면 두 census 의 route 모수가 조용히 갈리고, "미보호 집합 정확 일치" · "미커버 집합 정확
// 일치" 라는 두 계약이 서로 다른 모수를 세게 된다. 그 단일 출처를 여기로 옮긴다.
//
// 이동 범위 — 두 spec 에 **동일하게 존재하던 코드만** 옮겼다. 동작 변경 0. 각 spec 의
// `censusRoutes` 본체는 반환 타입부터 다르므로(guard 는 `guarded` 플래그, e2e 는
// `prefix`/`suffix`) 통합 대상이 아니며 각자 자리에 남는다.
//
// 파일 경로 정책: `test/helpers/route-census.ts` 는 unit jest 의 `testRegex`
// (`.*\.spec\.ts$`) 를 매칭하지 않아 test 로 pickup 0 이고, `collectCoverageFrom: ["src/**/*"]`
// scope 밖이라 coverage 통계 영향 0 이다. colocated spec 은 `route-census.spec.ts`.
import { readdirSync } from "fs";
import * as path from "path";

/** 문자열 리터럴(`"` · `'` · `` ` ``)을 먼저 잡아 보존하고, 주석만 뒤이어 매칭한다. */
export const TOKEN_RE =
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

/** `@Controller("prefix")` 의 인자 캡처. 인자 없는 `@Controller()` 도 매칭된다. */
export const CONTROLLER_RE =
  /@Controller\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)?\s*[,)]/;

/** route decorator(`@Get("x")` 등) 의 method + 경로 인자 캡처. */
export const ROUTE_RE =
  /^@(Get|Post|Put|Patch|Delete)\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)?/;

/** 앞뒤 `/` 정규화 — `/api/x/` 와 `api/x` 를 같은 표기로 모은다. */
export const SLASH_RE = /^\/+|\/+$/g;

/**
 * 주석(line · block) 제거 — 주석 속 `@UseGuards` · `@Get` 설명이 census 를 오염시키는 것을
 * 막는 전처리. 문자열 리터럴 안의 `//` 는 보존하고, 지워진 자리는 공백으로 채워 개행과 행
 * 구조를 유지한다. non-string 이면 TypeError(0-byte fallback 으로 인한 false-PASS 방지).
 */
export function stripComments(source: string): string {
  if (typeof source !== "string") {
    throw new TypeError("stripComments: source 는 string 이어야 함");
  }
  return source.replace(TOKEN_RE, (tok) =>
    tok.startsWith("/") ? tok.replace(/[^\n]/g, " ") : tok,
  );
}

/**
 * `dir` 이하 재귀 순회로 `suffix` 로 끝나는 파일 경로를 정렬 반환. 하드코딩 목록이 아니라
 * **발견**이라 신규 controller · 신규 e2e spec 이 자동 편입된다. 없는 디렉터리는
 * `readdirSync` 가 throw 한다 — 조용한 빈 배열 fallback 금지.
 */
export function findFiles(dir: string, suffix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) found.push(...findFiles(child, suffix));
    else if (entry.isFile() && entry.name.endsWith(suffix)) found.push(child);
  }
  return found.sort();
}

/**
 * `@Controller("prefix")` 의 prefix 추출. 인자 없는 `@Controller()` 는 빈 prefix, decorator
 * 자체가 없으면 Error throw — 빈 문자열 silent fallback 금지. 주석 속 `@Controller` 예시가
 * 잡히지 않도록 `stripComments` 를 먼저 통과시킨다.
 */
export function extractControllerPrefix(source: string): string {
  const match = CONTROLLER_RE.exec(stripComments(source));
  if (match === null) {
    throw new Error("extractControllerPrefix: @Controller decorator 부재");
  }
  return (match[1] ?? match[2] ?? match[3] ?? "").replace(SLASH_RE, "");
}
