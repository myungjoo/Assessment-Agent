// route-auth-guard-coverage-census-drift.smoke-spec.ts
// — REQ-043 "전 기능 보호 적용률" 축을 기계가 감시하게 만드는 census drift smoke (T-1983).
// 존재 이유 — guard 단언이 colocated controller spec 7 개에 흩어져 각자 자기 route 만 보는 탓에,
// 새 controller 가 `@UseGuards` 없이 들어와도 어느 spec 도 red 가 되지 않는다(부재 축 미검출).
// 본 spec 은 `src/` 를 재귀 순회해 `*.controller.ts` 를 **발견**하고 route 를 정적 추출한다.
// 판정 비대칭 — 총 route · 보호 route 는 하한만 건다(정확 일치면 보호 route 를 정상 추가할 때마다
// red 가 되어 소음). **미보호 집합만 정확 일치**라 신규 유입(초과)도 stale 잔존(미달)도 red 다.
// `known-gap-REQ-043` 20 건은 blessing 이 아니라 카운트 가능한 부채이며, guard 실 배선(§5 오너
// 승인 대상) slice 가 이 목록을 함께 줄여야 한다.
//      🔥 Nest 부팅 0 · DB 0 · 네트워크 0 · src 변경 0 — 파일 read + 합성 문자열 주입만.
import { readFileSync, existsSync, readdirSync } from "fs";
import * as path from "path";

// repo-root — 실행 cwd 무관하게 `__dirname`(= test/smoke) 기준 두 단계 위로 고정.
const REPO_ROOT = path.resolve(__dirname, "../..");
const SRC_ROOT = path.join(REPO_ROOT, "src").replace(/\\/g, "/");

/** 본 fire 실측 하한 — 증가는 정상, 감소는 red. */
const MIN = { controllers: 23, routes: 89, guarded: 64 };

/** 인증 진입 경로 · sanity root · 가입 — 설계상 public. */
const PUBLIC_BY_DESIGN: readonly string[] = [
  "GET /api",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "POST /api/auth/refresh",
  "POST /api/users",
];

/** guard 미배선 부채 — 배선은 §5 오너 승인 대상이라 본 spec 은 세기만 한다. */
const KNOWN_GAP_REQ_043: readonly string[] = [
  "GET /api/groups",
  "GET /api/groups/:id",
  "GET /api/groups/:id/persons",
  "GET /api/groups/:id/members",
  "POST /api/groups",
  "POST /api/groups/:id/members",
  "PATCH /api/groups/:id",
  "DELETE /api/groups/:id",
  "DELETE /api/groups/:id/members/:membershipId",
  "GET /api/parts",
  "GET /api/parts/:id",
  "GET /api/parts/:id/persons",
  "POST /api/parts",
  "PATCH /api/parts/:id",
  "DELETE /api/parts/:id",
  "GET /api/persons",
  "GET /api/persons/:id",
  "POST /api/persons",
  "PATCH /api/persons/:id",
  "DELETE /api/persons/:id",
];

/** 미보호 허용 목록 = 두 reason 태그의 합. 실측 집합과 **정확히** 같아야 한다. */
const UNPROTECTED_ALLOWLIST: readonly string[] = [
  ...PUBLIC_BY_DESIGN,
  ...KNOWN_GAP_REQ_043,
];

type RouteEntry = { method: string; fullPath: string; guarded: boolean };

// 문자열 리터럴을 먼저 잡아 보존하고, 주석만 공백으로 지운다(개행은 유지).
const TOKEN_RE =
  /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const CONTROLLER_RE =
  /@Controller\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)?\s*[,)]/;
const SLASH_RE = /^\/+|\/+$/g; // 앞뒤 `/` 정규화
const ROUTE_RE =
  /^@(Get|Post|Put|Patch|Delete)\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)?/;

// 주석(line · block) 제거 — 주석 속 `@UseGuards` 설명이 census 를 오염시키는 것을 막는 전처리.
// 문자열 리터럴 안의 `//` 는 보존. non-string 이면 TypeError(0-byte fallback false-PASS 방지).
function stripComments(source: string): string {
  if (typeof source !== "string") {
    throw new TypeError("stripComments: source 는 string 이어야 함");
  }
  return source.replace(TOKEN_RE, (tok) =>
    tok.startsWith("/") ? tok.replace(/[^\n]/g, " ") : tok,
  );
}

// `dir` 이하 재귀 순회로 `suffix` 파일 경로를 정렬 반환. 하드코딩 목록이 아니라 **발견**이라
// 신규 controller 가 자동 편입된다.
function findFiles(dir: string, suffix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) found.push(...findFiles(child, suffix));
    else if (entry.isFile() && entry.name.endsWith(suffix)) found.push(child);
  }
  return found.sort();
}

// `@Controller("prefix")` 의 prefix 추출. 인자 없는 `@Controller()` 는 빈 prefix, decorator
// 자체가 없으면 Error throw — 빈 문자열 silent fallback 금지.
function extractControllerPrefix(source: string): string {
  const match = CONTROLLER_RE.exec(stripComments(source));
  if (match === null) {
    throw new Error("extractControllerPrefix: @Controller decorator 부재");
  }
  return (match[1] ?? match[2] ?? match[3] ?? "").replace(SLASH_RE, "");
}

// 한 controller 소스의 route census. 클래스 레벨 `@UseGuards` 면 전 route 보호, 아니면 해당
// route 의 decorator 블록에 `@UseGuards` 가 있어야 보호. `@Roles` 등 타 decorator 는 무시.
function censusRoutes(source: string): RouteEntry[] {
  const prefix = extractControllerPrefix(source);
  const routes: RouteEntry[] = [];
  let buffer: string[] = [];
  let pending = "";
  let depth = 0;
  let classGuarded = false;
  let seenClass = false;
  for (const raw of stripComments(source).split("\n")) {
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
        const seg = (match[2] ?? match[3] ?? match[4] ?? "").replace(
          SLASH_RE,
          "",
        );
        const joined = [prefix, seg].filter((x) => x !== "").join("/");
        routes.push({
          method: match[1].toUpperCase(),
          fullPath: `/${joined}`,
          guarded,
        });
      }
    }
    buffer = [];
  }
  return routes;
}

// 실 `src/` 전수 census — 파일 발견 → 소스 read → route 추출을 한 번에 묶는다.
function repoRoutes(): RouteEntry[] {
  return findFiles(SRC_ROOT, ".controller.ts").flatMap((f) =>
    censusRoutes(readFileSync(f, "utf8")),
  );
}

const label = (r: RouteEntry): string => `${r.method} ${r.fullPath}`;

describe("전 route 인증 guard 적용률 census drift (REQ-043 · T-1983)", () => {
  describe("Happy path — 실 src 기준", () => {
    it("controller 발견: 하드코딩 목록 없이 23 개 이상, 전부 .controller.ts", () => {
      const files = findFiles(SRC_ROOT, ".controller.ts");
      expect(files.length).toBeGreaterThanOrEqual(MIN.controllers);
      expect(files.every((f) => f.endsWith(".controller.ts"))).toBe(true);
      expect(files).toContain(`${SRC_ROOT}/app.controller.ts`);
    });
    it("prefix 추출: 실 controller 소스에서 @Controller 인자를 그대로 얻는다", () => {
      const read = (rel: string): string =>
        readFileSync(path.join(SRC_ROOT, rel), "utf8");
      expect(extractControllerPrefix(read("user/group.controller.ts"))).toBe(
        "api/groups",
      );
      expect(extractControllerPrefix(read("app.controller.ts"))).toBe("api");
    });
    it("route/guard census: route 89+ · 보호 64+ (증가는 정상, 감소는 red)", () => {
      const routes = repoRoutes();
      expect(routes.length).toBeGreaterThanOrEqual(MIN.routes);
      expect(routes.filter((r) => r.guarded).length).toBeGreaterThanOrEqual(
        MIN.guarded,
      );
      expect(routes.every((r) => r.fullPath.startsWith("/api"))).toBe(true);
    });
  });

  describe("Negative — 미보호 집합 정확 일치 · 전역 guard 부재", () => {
    it("실측 미보호 full-path 집합 == allowlist (양방향 비교)", () => {
      const actual = repoRoutes()
        .filter((r) => !r.guarded)
        .map(label)
        .sort();
      const allowed = [...UNPROTECTED_ALLOWLIST].sort();
      // 초과 = 새 미보호 route 유입, 미달 = stale allowlist 항목.
      expect(actual.filter((r) => !allowed.includes(r))).toEqual([]);
      expect(allowed.filter((r) => !actual.includes(r))).toEqual([]);
      expect(actual).toEqual(allowed);
    });
    it("allowlist 태그 건수 고정 — public-by-design 5 · known-gap-REQ-043 20", () => {
      expect(PUBLIC_BY_DESIGN.length).toBe(5);
      expect(KNOWN_GAP_REQ_043.length).toBe(20);
      expect(UNPROTECTED_ALLOWLIST.length).toBe(25);
      // 두 태그가 겹치면 합계 25 가 우연히 맞을 수 있어 교집합 0 도 함께 고정.
      expect(
        PUBLIC_BY_DESIGN.filter((r) => KNOWN_GAP_REQ_043.includes(r)),
      ).toEqual([]);
    });
    it("전역 guard 전제: src 전체 APP_GUARD 히트 0 (생기면 census 재도출 강제)", () => {
      const hits = findFiles(SRC_ROOT, ".ts").filter((f) =>
        readFileSync(f, "utf8").includes("APP_GUARD"),
      );
      expect(hits).toEqual([]);
    });
  });

  describe("Flow — 합성 소스 분기 cover", () => {
    it("(a) 클래스 레벨 @UseGuards 만 → 전 route 보호", () => {
      const routes = censusRoutes(
        '@Controller("api/x")\n@UseGuards(JwtAuthGuard)\nexport class X {\n@Get()\na() {}\n@Post(":id")\nb() {}\n}',
      );
      expect(routes.map(label)).toEqual(["GET /api/x", "POST /api/x/:id"]);
      expect(routes.every((r) => r.guarded)).toBe(true);
    });
    it("(b) 메서드 레벨 @UseGuards → 그 route 만 보호, 형제 route 는 미보호", () => {
      const routes = censusRoutes(
        '@Controller("api/y")\nexport class Y {\n@UseGuards(JwtAuthGuard)\n@Get("a")\na() {}\n@Delete("b")\nb() {}\n}',
      );
      expect(routes.find((r) => r.fullPath === "/api/y/a")?.guarded).toBe(true);
      expect(routes.find((r) => r.fullPath === "/api/y/b")?.guarded).toBe(
        false,
      );
    });
    it("(c) 인자 없는 @Get() → full-path 가 prefix 자신", () => {
      expect(
        censusRoutes('@Controller("api")\nexport class Z {\n@Get()\nr() {}\n}'),
      ).toEqual([{ method: "GET", fullPath: "/api", guarded: false }]);
    });
    it("(d) @Roles/@HttpCode/여러 행 @UsePipes 가 섞여도 오판 없음", () => {
      const routes = censusRoutes(
        '@Controller("api/w")\n@UsePipes(\n  new ValidationPipe({ whitelist: true }),\n)\nexport class W {\n@UseGuards(JwtAuthGuard, RolesGuard)\n@Roles("Admin")\n@HttpCode(204)\n@Patch(":id")\nu() {}\n}',
      );
      expect(routes).toEqual([
        { method: "PATCH", fullPath: "/api/w/:id", guarded: true },
      ]);
    });
    it("주석 안의 @UseGuards/@Controller 예시는 census 를 오염시키지 않는다", () => {
      const routes = censusRoutes(
        '// @UseGuards(JwtAuthGuard) 는 후속 task 책임\n@Controller("api/c")\nexport class C {\n/* @UseGuards 예시 */\n@Get()\na() {}\n}',
      );
      expect(routes).toEqual([
        { method: "GET", fullPath: "/api/c", guarded: false },
      ]);
    });
  });

  describe("Negative — 회귀 감지 능력 자체 검증", () => {
    it("guard 없는 route 를 하나 더하면 그 route 가 미보호로 분류된다", () => {
      const base =
        '@Controller("api/reg")\nexport class Reg {\n@UseGuards(JwtAuthGuard)\n@Get()\na() {}\n';
      expect(censusRoutes(`${base}}`).filter((r) => !r.guarded)).toEqual([]);
      const regressed = censusRoutes(`${base}@Post("new")\nb() {}\n}`);
      expect(regressed.filter((r) => !r.guarded).map(label)).toEqual([
        "POST /api/reg/new",
      ]);
      // 실제 회귀가 들어오면 위 정확-일치 단언이 "초과" 항목으로 red 가 된다는 증명.
      expect(UNPROTECTED_ALLOWLIST).not.toContain("POST /api/reg/new");
    });
  });

  describe("Error path", () => {
    it("존재하지 않는 경로 → existsSync false · readFileSync throw (silent fallback 금지)", () => {
      const bad = path.join(SRC_ROOT, "absent.controller.ts");
      expect(existsSync(bad)).toBe(false);
      expect(() => readFileSync(bad, "utf8")).toThrow();
    });
    it("@Controller 없는 합성 소스 → 빈 문자열이 아니라 명시적 throw", () => {
      expect(() => extractControllerPrefix("export class Bare {}")).toThrow(
        /@Controller decorator 부재/,
      );
      expect(() => censusRoutes("export class Bare {}")).toThrow(Error);
      expect(() => stripComments(undefined as unknown as string)).toThrow(
        TypeError,
      );
    });
  });
});
