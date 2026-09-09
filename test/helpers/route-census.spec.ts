// route-census.spec.ts — 공통 정적 추출 helper 의 colocated spec (T-1986).
// 두 census smoke(T-1983 guard 적용률 · T-1985 e2e 왕복 커버리지)가 같은 primitive 를 쓰게
// 된 이상, 그 primitive 자체의 계약을 여기서 고정한다. 합성 fixture 디렉터리 + 합성 소스
// 문자열만 쓰므로 Nest 부팅 0 · DB 0 · 네트워크 0.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import * as path from "path";

import {
  CONTROLLER_RE,
  ROUTE_RE,
  SLASH_RE,
  TOKEN_RE,
  censusRoutes,
  extractControllerPrefix,
  findFiles,
  stripComments,
} from "./route-census";

const SRC_ROOT = path.resolve(__dirname, "../../src").replace(/\\/g, "/");

// 합성 fixture — 재귀 · suffix 판정 · 디렉터리 배제를 결정적으로 검증하려고 실 파일 트리를
// 임시로 만든다(실 `src/` 만으로는 "파일명 중간 suffix" 같은 negative 를 만들 수 없다).
let FIXTURE = "";

beforeAll(() => {
  FIXTURE = mkdtempSync(path.join(tmpdir(), "route-census-")).replace(
    /\\/g,
    "/",
  );
  mkdirSync(path.join(FIXTURE, "nested"));
  mkdirSync(path.join(FIXTURE, "dir.controller.ts")); // 디렉터리인데 이름이 suffix 로 끝남
  writeFileSync(path.join(FIXTURE, "a.controller.ts"), "// a", "utf8");
  writeFileSync(path.join(FIXTURE, "b.service.ts"), "// b", "utf8");
  writeFileSync(path.join(FIXTURE, "c.controller.ts.bak"), "// c", "utf8");
  writeFileSync(path.join(FIXTURE, "nested/d.controller.ts"), "// d", "utf8");
});

afterAll(() => {
  if (FIXTURE !== "") rmSync(FIXTURE, { recursive: true, force: true });
});

describe("route census 공통 정적 추출 helper (T-1986)", () => {
  describe("stripComments — 주석 제거 · 리터럴 보존", () => {
    it("Happy path: 주석만 지우고 코드와 문자열 리터럴은 그대로 남는다", () => {
      const out = stripComments('const a = "keep"; // drop\nconst b = 1;');
      expect(out).toContain('const a = "keep";');
      expect(out).toContain("const b = 1;");
      expect(out).not.toContain("drop");
    });
    it("(a) line 주석은 공백으로 치환된다", () => {
      expect(stripComments('code // @Get("ghost")').trim()).toBe("code");
    });
    it("(b) block 주석은 여러 행이어도 지워진다", () => {
      const out = stripComments('a\n/* @Delete("phantom")\n2 행 */\nb');
      expect(out).not.toContain("phantom");
      expect(out.split("\n")[0]).toBe("a");
      expect(out.split("\n")[3]).toBe("b");
    });
    it("(c) 문자열 · 템플릿 리터럴 안의 `//` 는 보존된다", () => {
      expect(stripComments('const u = "http://x/y";')).toBe(
        'const u = "http://x/y";',
      );
      expect(stripComments("const t = `a//b`;")).toBe("const t = `a//b`;");
      expect(stripComments("const s = 'p//q';")).toBe("const s = 'p//q';");
    });
    it("(d) 개행은 유지되어 행 수가 보존된다", () => {
      const src = "1 // x\n/* y */\n3";
      expect(stripComments(src).split("\n")).toHaveLength(3);
    });
    it("Negative: 문자열 리터럴 안의 `/* */` 는 코드로 오인돼 지워지지 않는다", () => {
      const src = 'const s = "/* not a comment */"; const n = 1;';
      expect(stripComments(src)).toBe(src);
    });
    it("Error path: non-string 입력은 조용히 흡수되지 않고 TypeError", () => {
      expect(() => stripComments(undefined as unknown as string)).toThrow(
        TypeError,
      );
      expect(() => stripComments(42 as unknown as string)).toThrow(
        /string 이어야 함/,
      );
    });
  });

  describe("findFiles — 재귀 발견 · suffix 판정", () => {
    it("Happy path: 실 src 재귀 수집 결과가 정렬되고 전부 suffix 로 끝난다", () => {
      const files = findFiles(SRC_ROOT, ".controller.ts");
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith(".controller.ts"))).toBe(true);
      expect(files).toEqual([...files].sort());
    });
    it("(a) 하위 디렉터리를 재귀로 훑는다", () => {
      expect(findFiles(FIXTURE, ".controller.ts")).toEqual([
        `${FIXTURE}/a.controller.ts`,
        `${FIXTURE}/nested/d.controller.ts`,
      ]);
    });
    it("(b) suffix 불일치 파일은 제외된다", () => {
      const files = findFiles(FIXTURE, ".controller.ts");
      expect(files.some((f) => f.endsWith("b.service.ts"))).toBe(false);
      expect(findFiles(FIXTURE, ".service.ts")).toEqual([
        `${FIXTURE}/b.service.ts`,
      ]);
    });
    it("Negative: 파일명 중간에만 suffix 가 있는 파일은 수집되지 않는다", () => {
      const files = findFiles(FIXTURE, ".controller.ts");
      expect(files.some((f) => f.includes("c.controller.ts.bak"))).toBe(false);
    });
    it("Negative: 이름이 suffix 로 끝나는 디렉터리를 파일로 오수집하지 않는다", () => {
      const files = findFiles(FIXTURE, ".controller.ts");
      expect(files.some((f) => f.endsWith("dir.controller.ts"))).toBe(false);
    });
    it("Error path: 없는 디렉터리는 빈 배열 fallback 없이 throw", () => {
      expect(() => findFiles(`${FIXTURE}/absent-dir`, ".ts")).toThrow();
    });
  });

  describe("extractControllerPrefix — prefix 추출", () => {
    it("Happy path: 인자 있는 @Controller 의 prefix 를 그대로 얻는다", () => {
      expect(
        extractControllerPrefix('@Controller("api/x")\nexport class X {}'),
      ).toBe("api/x");
      expect(
        extractControllerPrefix("@Controller('api/y')\nexport class Y {}"),
      ).toBe("api/y");
    });
    it("(b) 인자 없는 @Controller() 는 빈 prefix", () => {
      expect(extractControllerPrefix("@Controller()\nexport class Z {}")).toBe(
        "",
      );
    });
    it("(c) 앞뒤 `/` 는 정규화된다", () => {
      expect(extractControllerPrefix('@Controller("/api/x/")')).toBe("api/x");
    });
    it("Negative: 주석 안에 적힌 @Controller 는 prefix 로 오추출되지 않는다", () => {
      expect(
        extractControllerPrefix(
          '// @Controller("api/fake") 는 예시\n@Controller("api/real")',
        ),
      ).toBe("api/real");
      expect(() =>
        extractControllerPrefix('/* @Controller("api/fake") */'),
      ).toThrow(/@Controller decorator 부재/);
    });
    it("Error path: decorator 부재 · 빈 소스는 빈 prefix 로 흡수되지 않고 throw", () => {
      expect(() => extractControllerPrefix("export class Bare {}")).toThrow(
        Error,
      );
      expect(() => extractControllerPrefix("export class Bare {}")).toThrow(
        /@Controller decorator 부재/,
      );
      expect(() => extractControllerPrefix("")).toThrow(
        /@Controller decorator 부재/,
      );
    });
  });

  describe("export 된 정규식 상수 — 두 census 가 공유하는 계약", () => {
    it("ROUTE_RE 는 method 와 경로 인자를 캡처하고, SLASH_RE 로 정규화된다", () => {
      const match = ROUTE_RE.exec('@Get("/:id/status/")');
      expect(match?.[1]).toBe("Get");
      expect((match?.[2] ?? "").replace(SLASH_RE, "")).toBe(":id/status");
      expect(ROUTE_RE.exec("@UseGuards(JwtAuthGuard)")).toBeNull();
    });
    it("TOKEN_RE 는 global · CONTROLLER_RE 는 non-global (lastIndex 오염 방지)", () => {
      expect(TOKEN_RE.flags).toContain("g");
      expect(CONTROLLER_RE.global).toBe(false);
      expect(ROUTE_RE.global).toBe(false);
    });
  });

  describe("censusRoutes — 스캐너 본체 (T-1987 통합분)", () => {
    it("Happy path: 실 controller 소스에서 route 를 뽑고 label 이 `METHOD /api…` 형태", () => {
      const src = readFileSync(
        path.join(SRC_ROOT, "user/group.controller.ts"),
        "utf8",
      );
      const routes = censusRoutes(src);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every((r) => /^[A-Z]+ \/api\//.test(r.label))).toBe(true);
      expect(routes.every((r) => r.label === `${r.method} ${r.fullPath}`)).toBe(
        true,
      );
      expect(routes.every((r) => r.prefix === "api/groups")).toBe(true);
      expect(routes.map((r) => r.label)).toContain("GET /api/groups");
    });
    it("(a) 클래스 레벨 @UseGuards → 전 route 가 guarded", () => {
      const routes = censusRoutes(
        '@Controller("api/x")\n@UseGuards(JwtAuthGuard)\nexport class X {\n@Get()\na() {}\n@Post(":id")\nb() {}\n}',
      );
      expect(routes.map((r) => r.label)).toEqual([
        "GET /api/x",
        "POST /api/x/:id",
      ]);
      expect(routes.every((r) => r.guarded)).toBe(true);
    });
    it("(b) 메서드 레벨 @UseGuards → 그 route 만 guarded, 형제 route 는 false", () => {
      const routes = censusRoutes(
        '@Controller("api/y")\nexport class Y {\n@UseGuards(JwtAuthGuard)\n@Get("a")\na() {}\n@Delete("b")\nb() {}\n}',
      );
      expect(routes.find((r) => r.suffix === "a")?.guarded).toBe(true);
      expect(routes.find((r) => r.suffix === "b")?.guarded).toBe(false);
    });
    it("(c) 인자 없는 @Get() → fullPath 는 prefix 자신 · suffix 는 빈 문자열", () => {
      expect(
        censusRoutes('@Controller("api")\nexport class Z {\n@Get()\nr() {}\n}'),
      ).toEqual([
        {
          method: "GET",
          prefix: "api",
          suffix: "",
          fullPath: "/api",
          label: "GET /api",
          guarded: false,
        },
      ]);
    });
    it("(d) 여러 행에 걸친 @UsePipes 가 섞여도 route 누락 · 오판 0", () => {
      const routes = censusRoutes(
        '@Controller("api/w")\n@UsePipes(\n  new ValidationPipe({ whitelist: true }),\n)\nexport class W {\n@UseGuards(JwtAuthGuard, RolesGuard)\n@Roles("Admin")\n@HttpCode(204)\n@Patch(":id")\nu() {}\n}',
      );
      expect(routes).toEqual([
        {
          method: "PATCH",
          prefix: "api/w",
          suffix: ":id",
          fullPath: "/api/w/:id",
          label: "PATCH /api/w/:id",
          guarded: true,
        },
      ]);
    });
    it("Negative: 주석 안의 @Get / @UseGuards 예시는 route · 보호로 오집계되지 않는다", () => {
      const routes = censusRoutes(
        '@Controller("api/c")\nexport class C {\n// @Get("ghost") 는 후속 task 책임\n/* @UseGuards(JwtAuthGuard) 예시 */\n@Get()\na() {}\n}',
      );
      expect(routes.map((r) => r.label)).toEqual(["GET /api/c"]);
      expect(routes[0].guarded).toBe(false);
    });
    it("Negative: 클래스 선언 앞 decorator 는 첫 route 로도 그 보호로도 새지 않는다", () => {
      const routes = censusRoutes(
        '@Get("ghost")\n@Controller("api/n")\nexport class N {\n@Get("real")\na() {}\n}',
      );
      expect(routes.map((r) => r.label)).toEqual(["GET /api/n/real"]);
      expect(routes[0].guarded).toBe(false);
    });
    it("Negative: guard 없는 route 를 하나 더하면 그 route 만 guarded false", () => {
      const base =
        '@Controller("api/reg")\nexport class Reg {\n@UseGuards(JwtAuthGuard)\n@Get()\na() {}\n';
      expect(censusRoutes(`${base}}`).filter((r) => !r.guarded)).toEqual([]);
      const regressed = censusRoutes(`${base}@Post("new")\nb() {}\n}`);
      expect(regressed).toHaveLength(2);
      expect(regressed.filter((r) => !r.guarded).map((r) => r.label)).toEqual([
        "POST /api/reg/new",
      ]);
    });
    it("Error path: @Controller 부재는 route 0 개로 흡수되지 않고 throw · non-string 은 TypeError", () => {
      expect(() => censusRoutes("export class Bare {}")).toThrow(Error);
      expect(() => censusRoutes("export class Bare {}")).toThrow(
        /@Controller decorator 부재/,
      );
      expect(() => censusRoutes(undefined as unknown as string)).toThrow(
        TypeError,
      );
    });
  });
});
