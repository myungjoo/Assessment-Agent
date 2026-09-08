// route-e2e-coverage-census-drift.smoke-spec.ts
// — PLAN 166 행 "E2E 시나리오 커버리지" 축을 기계가 감시하게 만드는 census drift smoke (T-1985).
// 존재 이유 — T-1960~T-1982 40 여 slice 가 route 별 실 왕복 e2e 를 채워 미커버를 사실상 0 으로
// 만들었지만 그 성과를 지키는 장치가 없다. 새 controller 가 e2e 없이 들어와도 어느 spec 도 red 가
// 되지 않는다(부재 축 미검출). 본 spec 은 `src/` 재귀 순회로 route 를 정적 추출해
// `test/e2e/*.e2e-spec.ts` 본문과 prefix + suffix 단위로 대조한다.
// 판정 비대칭(T-1983 승계) — 4 축 총량은 하한만(증가는 정상), **미커버 집합만 정확 일치**라 신규
// 유입(초과)도 stale 잔존(미달)도 red. allowlist 2 건은 blessing 이 아니라
// `realdb-perf-spec-covered` 태그가 붙은 이월분이다 — T-1981 이 realdb perf-spec 중복을 근거로
// 명시 이월했고 본 spec 은 새 커버를 만들지 않고 세기만 한다.
//      🔥 Nest 부팅 0 · DB 0 · 네트워크 0 · src 변경 0 — 파일 read + 합성 문자열 주입만.
import { readFileSync } from "fs";
import * as path from "path";

// 정적 추출 primitive 는 T-1986 이 단일 출처로 뽑아 둔 helper 를 쓴다 — guard 적용률
// census(T-1983) 와 같은 토크나이저를 공유해 두 census 의 route 모수가 갈리지 않게 한다.
import {
  ROUTE_RE,
  SLASH_RE,
  extractControllerPrefix,
  findFiles,
  stripComments,
} from "../helpers/route-census";

// repo-root — 실행 cwd 무관하게 `__dirname`(= test/smoke) 기준 두 단계 위로 고정.
const REPO_ROOT = path.resolve(__dirname, "../..");
const SRC_ROOT = path.join(REPO_ROOT, "src").replace(/\\/g, "/");
const E2E_ROOT = path.join(REPO_ROOT, "test/e2e").replace(/\\/g, "/");

/** 본 fire 실측 하한 — 증가는 정상, 감소는 red. */
const MIN = { controllers: 23, routes: 89, e2eSpecs: 38, covered: 87 };

/** e2e 왕복 미커버 허용 목록. 항목마다 reason 태그를 남긴다. 실측과 **정확히** 같아야 한다. */
const REASON = "realdb-perf-spec-covered";
const E2E_UNCOVERED_ALLOWLIST: readonly { route: string; reason: string }[] = [
  { route: "GET /api/admin/import/running", reason: REASON },
  { route: "GET /api/admin/import/modes", reason: REASON },
];
const ALLOWED = E2E_UNCOVERED_ALLOWLIST.map((e) => e.route).sort();

type RouteRef = { prefix: string; suffix: string; label: string };

// segment 경계 — `/running` 이 `/running-xyz` 를 커버로 오판하지 않게 하는 접두 충돌 방지.
const BOUNDARY = "(?![A-Za-z0-9_-])";
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 순수 함수 1/3 — controller 소스 1 개의 route census.
 * 주석은 공백으로 지우고(문자열 리터럴은 보존) `@Controller` prefix 와 route decorator 를 뽑는다.
 * `@Controller` 가 없으면 route 0 으로 조용히 흡수하지 않고 throw (0-byte false-PASS 방지).
 */
function censusRoutes(source: string): RouteRef[] {
  // non-string → TypeError, `@Controller` 부재 → Error 두 계약은 helper 가 그대로 승계한다.
  const stripped = stripComments(source);
  const prefix = extractControllerPrefix(stripped);
  const routes: RouteRef[] = [];
  let buffer: string[] = [];
  let pending = "";
  let depth = 0;
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
      seenClass = true;
      buffer = [];
      continue;
    }
    if (seenClass) {
      for (const decorator of buffer) {
        const match = ROUTE_RE.exec(decorator);
        if (match === null) continue;
        const suffix = (match[2] ?? match[3] ?? match[4] ?? "").replace(
          SLASH_RE,
          "",
        );
        const full = [prefix, suffix].filter((x) => x !== "").join("/");
        const label = `${match[1].toUpperCase()} /${full}`;
        routes.push({ prefix, suffix, label });
      }
    }
    buffer = [];
  }
  return routes;
}

/**
 * 순수 함수 2/3 — route 1 개가 e2e 소스 1 개에 왕복으로 등장하는지. e2e 는 URL 을
 * `const BASE = "/api/x"` + 템플릿 리터럴로 조립하므로 전체 경로 리터럴 매칭은 거짓 미커버를
 * 낸다. 그래서 prefix 존재 + suffix segment 별 존재로 나눠 보고, 동적 segment(`:id`)는 템플릿
 * 치환(`${...}`) 과 실 문자열 양쪽에 매칭한다.
 */
function isCoveredBy(route: RouteRef, e2eSource: string): boolean {
  const hasPath = (p: string): boolean =>
    new RegExp("/" + esc(p) + BOUNDARY).test(e2eSource);
  if (!hasPath(route.prefix)) return false;
  return route.suffix
    .split("/")
    .filter((seg) => seg !== "")
    .every((seg) =>
      seg.startsWith(":")
        ? /\/(?:\$\{[^}]*\}|[A-Za-z0-9_.-]+)/.test(e2eSource)
        : hasPath(seg),
    );
}

/** 순수 함수 3/3 — 어느 e2e 소스에도 걸리지 않는 route label 집합(정렬). */
function uncoveredLabels(
  routes: readonly RouteRef[],
  e2eSources: readonly string[],
): string[] {
  return routes
    .filter((r) => !e2eSources.some((src) => isCoveredBy(r, src)))
    .map((r) => r.label)
    .sort();
}

// --- IO (순수 함수 아님) — 파일 발견 · read 만. 파일 발견은 helper 의 `findFiles` 를 쓰며
// 없는 디렉터리는 그 안의 readdirSync 가 throw 한다.
const readAll = (files: readonly string[]): string[] =>
  files.map((f) => readFileSync(f, "utf8"));

const controllerFiles = (): string[] => findFiles(SRC_ROOT, ".controller.ts");
const e2eFiles = (): string[] => findFiles(E2E_ROOT, ".e2e-spec.ts");
const repoRoutes = (): RouteRef[] =>
  readAll(controllerFiles()).flatMap((src) => censusRoutes(src));

describe("전 route e2e 왕복 커버리지 census drift (PLAN 166 행 · T-1985)", () => {
  describe("Happy path — 실 src · 실 test/e2e 기준 4 축 하한", () => {
    it("controller 발견: 하드코딩 목록 없이 23 개 이상, 전부 .controller.ts", () => {
      const files = controllerFiles();
      expect(files.length).toBeGreaterThanOrEqual(MIN.controllers);
      expect(files.every((f) => f.endsWith(".controller.ts"))).toBe(true);
      expect(files).toContain(`${SRC_ROOT}/import/import.controller.ts`);
    });
    it("route decorator: 89 개 이상, 전부 /api 하위 full-path", () => {
      const routes = repoRoutes();
      expect(routes.length).toBeGreaterThanOrEqual(MIN.routes);
      expect(routes.every((r) => r.label.includes(" /api"))).toBe(true);
    });
    it("e2e spec 파일: 38 개 이상, 전부 test/e2e 하위 .e2e-spec.ts", () => {
      const files = e2eFiles();
      expect(files.length).toBeGreaterThanOrEqual(MIN.e2eSpecs);
      expect(files.every((f) => f.startsWith(`${E2E_ROOT}/`))).toBe(true);
    });
    it("e2e 커버 route: 87 개 이상 (증가는 정상, 감소는 red)", () => {
      const routes = repoRoutes();
      const covered =
        routes.length - uncoveredLabels(routes, readAll(e2eFiles())).length;
      expect(covered).toBeGreaterThanOrEqual(MIN.covered);
    });
  });

  describe("Negative — 미커버 집합 정확 일치", () => {
    it("실측 미커버 집합 == allowlist 2 건 (양방향 비교 · reason 태그 고정)", () => {
      const actual = uncoveredLabels(repoRoutes(), readAll(e2eFiles()));
      // 초과 = e2e 없는 route 신규 유입, 미달 = stale allowlist 항목.
      expect(actual.filter((r) => !ALLOWED.includes(r))).toEqual([]);
      expect(ALLOWED.filter((r) => !actual.includes(r))).toEqual([]);
      expect(actual).toEqual(ALLOWED);
      expect(E2E_UNCOVERED_ALLOWLIST.length).toBe(2);
      expect([
        ...new Set(E2E_UNCOVERED_ALLOWLIST.map((e) => e.reason)),
      ]).toEqual(["realdb-perf-spec-covered"]);
    });
  });

  describe("Flow — 매칭기 분기 cover (합성 입력)", () => {
    const ROUTE = (prefix: string, suffix: string): RouteRef => ({
      prefix,
      suffix,
      label: `GET /${[prefix, suffix].filter((x) => x !== "").join("/")}`,
    });
    it("(a) 동적 segment `:id` 는 템플릿 치환과 실 문자열 양쪽에 매칭", () => {
      const route = ROUTE("api/z", ":id/status");
      const tmpl = 'const BASE = "/api/z";\nget(`${BASE}/${id}/status`)';
      expect(isCoveredBy(route, tmpl)).toBe(true);
      expect(isCoveredBy(route, 'get("/api/z/abc-123/status")')).toBe(true);
    });
    it("(b) suffix 가 빈 문자열(`@Get()`) 이면 prefix 만으로 커버 판정", () => {
      const [route] = censusRoutes(
        '@Controller("api/z")\nexport class Z {\n@Get()\nr() {}\n}',
      );
      expect(route.label).toBe("GET /api/z");
      expect(isCoveredBy(route, 'request(server).get("/api/z")')).toBe(true);
    });
    it("(c) prefix 는 있으나 suffix 가 없는 e2e 는 미커버로 남는다", () => {
      const route = ROUTE("api/z", "detail");
      expect(isCoveredBy(route, 'get("/api/z")')).toBe(false);
      expect(isCoveredBy(route, 'get("/api/other/detail")')).toBe(false);
    });
    it("(d) 접두 충돌 방지 — `/running` 이 `/running-xyz` 를 커버로 오판하지 않음", () => {
      const route = ROUTE("api/z", "running");
      expect(isCoveredBy(route, 'get("/api/z/running-xyz")')).toBe(false);
      expect(isCoveredBy(route, 'get("/api/z/running")')).toBe(true);
    });
  });

  describe("Negative — 오집계 방지 · 회귀 감지 능력 자체 검증", () => {
    it("주석 안 @Get / 문자열 리터럴 안 @Controller 유사 텍스트는 오집계되지 않는다", () => {
      const routes = censusRoutes(
        '@Controller("api/c")\nexport class C {\n// @Get("ghost") 는 후속 task 책임\n/* @Delete("phantom") 예시 */\n@Get()\na() {}\nmsg = \'@Controller("api/fake")\';\n}',
      );
      expect(routes.map((r) => r.label)).toEqual(["GET /api/c"]);
      expect(routes[0].prefix).toBe("api/c");
    });
    it("e2e 가 아닌 파일(perf-spec · unit spec)은 커버 근거로 세지 않는다", () => {
      const files = e2eFiles();
      expect(files.every((f) => f.endsWith(".e2e-spec.ts"))).toBe(true);
      expect(files.some((f) => f.includes(".perf-spec.ts"))).toBe(false);
      // allowlist 2 건이 perf-spec 으로만 덮인다는 reason 태그의 근거 — 그 소스를 커버 근거에
      // 넣으면 미커버가 0 이 되지만, e2e census 는 그것을 세지 않는다.
      const rel = "test/perf/import-detail-read-realdb.perf-spec.ts";
      const perf = readFileSync(path.join(REPO_ROOT, rel), "utf8");
      const routes = repoRoutes().filter((r) => ALLOWED.includes(r.label));
      expect(routes.length).toBe(2);
      expect(routes.every((r) => isCoveredBy(r, perf))).toBe(true);
    });
    it("allowlist 에 실재하지 않는 route 를 넣으면 정확 일치가 깨진다(자기검증)", () => {
      const actual = uncoveredLabels(repoRoutes(), readAll(e2eFiles()));
      const tampered = [...ALLOWED, "GET /api/never/exists"].sort();
      expect(actual).not.toEqual(tampered);
      expect(tampered.filter((r) => !actual.includes(r))).toEqual([
        "GET /api/never/exists",
      ]);
    });
    it("합성 controller 1 개를 주입하면 미커버 집합이 늘어 red 가 된다", () => {
      const injected = censusRoutes(
        '@Controller("api/brand-new")\nexport class BrandNew {\n@Post("save")\ns() {}\n}',
      );
      const sources = readAll(e2eFiles());
      const before = uncoveredLabels(repoRoutes(), sources);
      const after = uncoveredLabels([...repoRoutes(), ...injected], sources);
      expect(before).toEqual(ALLOWED);
      expect(after).toEqual([...ALLOWED, "POST /api/brand-new/save"].sort());
      expect(after).not.toEqual(ALLOWED);
    });
  });

  describe("Error path", () => {
    it("없는 디렉터리 · @Controller 부재 · 비-string 은 조용히 흡수되지 않고 throw", () => {
      const absent = path.join(SRC_ROOT, "absent-dir");
      expect(() => findFiles(absent, ".ts")).toThrow();
      expect(() => censusRoutes("export class Bare {}")).toThrow(
        /@Controller decorator 부재/,
      );
      expect(() => censusRoutes(undefined as unknown as string)).toThrow(
        TypeError,
      );
    });
  });
});
