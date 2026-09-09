// route-census.ts — 두 census drift smoke 가 공유하는 **정적 추출 primitive** 단일 출처 (T-1986).
//
// 존재 이유 — T-1983(guard 적용률 축 · REQ-043)과 T-1985(e2e 왕복 커버리지 축 · PLAN 166 행)이
// 각자 자기 spec 안에 byte-identical 토크나이저를 복제해 뒀다. 추출기 결함 1 건을 한쪽에서만
// 고치면 두 census 의 route 모수가 조용히 갈리고, "미보호 집합 정확 일치" · "미커버 집합 정확
// 일치" 라는 두 계약이 서로 다른 모수를 세게 된다. 그 단일 출처를 여기로 옮긴다.
//
// 이동 범위 — 1 차(T-1986)는 두 spec 에 **동일하게 존재하던** 토크나이저만 옮겼고, 스캐너
// 본체 `censusRoutes` 는 반환 타입이 달라 남겨 뒀다. 2 차(T-1987)가 그 마지막 중복까지
// 옮겨 왔다 — guard 의 `guarded` 와 e2e 의 `prefix`/`suffix` 를 **필드 합집합 레코드**
// (`RouteRecord`) 1 종으로 합쳐, 이제 두 census 의 route 모수는 이 파일 하나에서 나온다.
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

/**
 * 두 census 가 공유하는 route 레코드 — 필드 합집합 1 종 (T-1987). guard census 는
 * `method`/`fullPath`/`guarded` 를, e2e census 는 `prefix`/`suffix`/`label` 을 쓴다.
 * `label` 은 두 spec 이 이미 같은 문자열(`` `${method} ${fullPath}` ``)을 만들고 있었다.
 */
export type RouteRecord = {
  /** HTTP method 대문자 — `GET` · `POST` · `PUT` · `PATCH` · `DELETE`. */
  method: string;
  /** `@Controller` 인자를 앞뒤 `/` 정규화한 값. 인자 없는 `@Controller()` 는 빈 문자열. */
  prefix: string;
  /** route decorator 인자를 같은 방식으로 정규화한 값. `@Get()` 는 빈 문자열. */
  suffix: string;
  /** `/` 로 시작하는 전체 경로 — `prefix` + `suffix` 를 빈 조각 제거 후 `/` 로 결합. */
  fullPath: string;
  /** `` `${method} ${fullPath}` `` — 두 census 의 집합 비교 키. */
  label: string;
  /** 클래스 레벨 `@UseGuards` 또는 해당 route decorator 블록의 `@UseGuards` 여부. */
  guarded: boolean;
};

/**
 * controller 소스 1 개의 route census — **두 census 의 route 모수 단일 출처** (T-1987).
 * 주석을 먼저 공백으로 지우고(문자열 리터럴 보존) `@Controller` prefix 를 뽑은 뒤, 클래스
 * 선언을 기준으로 decorator buffer 를 리셋해 클래스 앞 decorator 가 첫 route 로 새지 않게
 * 한다. 여러 행에 걸친 decorator(`@UsePipes(\n ... \n)`) 는 괄호 균형으로 이어붙인다.
 * 보호 판정은 클래스 레벨 `@UseGuards` 면 전 route, 아니면 해당 route 의 decorator 블록에
 * `@UseGuards` 가 있어야 보호. `@Roles` 등 타 decorator 는 무시한다.
 * 계약 승계 — non-string 은 `stripComments` 가 `TypeError`, `@Controller` 부재는
 * `extractControllerPrefix` 가 `Error` (route 0 개로 조용히 흡수하지 않는다).
 */
export function censusRoutes(source: string): RouteRecord[] {
  const stripped = stripComments(source);
  const prefix = extractControllerPrefix(stripped);
  const routes: RouteRecord[] = [];
  let buffer: string[] = [];
  let pending = "";
  let depth = 0;
  let classGuarded = false;
  let seenClass = false;
  for (const raw of stripped.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const delta =
      (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
    if (depth > 0) {
      // 여러 행에 걸친 decorator(`@UsePipes(\n ... \n)`) 를 괄호 균형으로 이어붙인다.
      pending += " " + line;
      depth += delta;
      if (depth <= 0) {
        buffer.push(pending);
        pending = "";
        depth = 0;
      }
      continue;
    }
    if (line.startsWith("@")) {
      if (delta > 0) {
        pending = line;
        depth = delta;
      } else buffer.push(line);
      continue;
    }
    if (/^(export\s+)?(abstract\s+)?class\s+\w+/.test(line)) {
      classGuarded = buffer.some((d) => d.startsWith("@UseGuards"));
      seenClass = true;
      buffer = [];
      continue;
    }
    if (seenClass) {
      const guarded =
        classGuarded || buffer.some((d) => d.startsWith("@UseGuards"));
      for (const decorator of buffer) {
        const match = ROUTE_RE.exec(decorator);
        if (match === null) continue;
        const suffix = (match[2] ?? match[3] ?? match[4] ?? "").replace(
          SLASH_RE,
          "",
        );
        const joined = [prefix, suffix].filter((x) => x !== "").join("/");
        const method = match[1].toUpperCase();
        const fullPath = `/${joined}`;
        routes.push({
          method,
          prefix,
          suffix,
          fullPath,
          label: `${method} ${fullPath}`,
          guarded,
        });
      }
    }
    buffer = [];
  }
  return routes;
}
