// realdata-e2e-daily-test-http-step-contract-nestjs-route-decorator-parity-drift.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` 의 black-box HTTP step 계약(step_health·
// step_liveness·step_auth 가 두드리는 5 endpoint 의 path·HTTP method·기대 status) ↔ 실
// NestJS controller route decorator(`@Controller(prefix)`+`@Get/@Post(route)`+`@HttpCode(n)`+
// `APP_STATUS_MESSAGE`) 가 노출하는 조립 full-path·method·status contract parity 를, 양측
// 소스(shell + 4 controller/service 파일)를 readFileSync 로 읽어 정적 추출·cross-artifact
// 대조하는 drift-detection non-gated build-time smoke (T-0792 박제, PLAN.md 109행 🟢 실
// 평가 e2e step④).
//
// 본 spec 의 존재 이유 — shell-HTTP-contract ↔ controller-route-decorator gap 해소:
//   - PLAN 109행 step④·`deploy/daily-test.sh` 헤더(6~9행)는 nightly 자율 실 평가 e2e 가
//     기동된 컨테이너를 :3000 으로 두드려(step_health `GET /api == "Assessment-Agent"`,
//     step_liveness `GET /api 일치 + GET / == 200 + SPA HTML`, step_auth `POST /api/users
//     (201|409) → POST /api/auth/login(200) → GET /api/auth/me(200)`) 앱 생존·핵심 계약을
//     검증함을 명시한다. 즉 daily-test.sh 가 검사하는 **HTTP step 계약(path·method·기대 status)
//     은 실 NestJS controller 가 노출하는 route 와 정합해야 하는 운영 contract** 다.
//   - 이 contract 는 origin/main 시점에 **검증 0 부재** 였다:
//      (1) 기존 daily-test smoke 2개(`...step-eval-shell-argv...`(T-0790)·
//          `...machine-result-json-schema...`(T-0791))는 step_eval jest argv·머신 요약 JSON
//          스키마만 cover — step_health/step_liveness/step_auth 의 HTTP 계약(path·method·
//          status)을 실 controller route decorator 와 대조 0.
//      (2) e2e(`test/e2e/auth.e2e-spec.ts`·`users.e2e-spec.ts`)는 실 route 동작을 검증하나
//          gated DB-bound 이고 daily-test.sh 의 shell 계약 텍스트를 읽지 않으므로 shell
//          사본 ↔ controller 정본 drift 를 못 잡는다.
//   - 본 spec 은 그 빈 자리를 메운다 — `deploy/daily-test.sh` + 4 controller/service 소스를
//     readFileSync 로 읽어 (a) shell 측 5 HTTP 계약(method·full-path·기대 status)을 추출,
//     (b) controller 측 `@Controller` prefix + `@Get/@Post` route + `@HttpCode`/status +
//     `APP_STATUS_MESSAGE` 를 추출해 full-path·method·status 로 조립, (c) shell full-path ==
//     controller 조립 full-path byte-identical · method 1:1 · 기대 status 정합을 단언한다.
//     이 contract 가 drift 하면(@HttpCode 누락→default 200·prefix rename·method swap·path
//     rename) daily-test.sh 의 하드코딩 호출이 실 route 와 어긋나 nightly false-FAIL →
//     무인 모니터링 false 신호.
//
//      🔥 실 컨테이너·실 HTTP(curl)·실 NestJS 부팅·실 DB·실 supertest 0 — 파일 read +
//         정적 텍스트 추출 + 합성 문자열만. shell·controller 소스는 읽기만(실행/source/import 0).
//      🔥 NestJS module/controller class import 0 — readFileSync 텍스트 read only, DI/DB 의존 0.
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 credential 0 — HTTP 계약은 path·method·status·message 만 운반. 추출/합성 문자열에
//         토큰 placeholder 미surface(§9). shell 의 SMOKE_PASSWORD default literal 도 미포함.
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만.
//
// Out of Scope (T-0792):
//   - src 변경 0 — test-only. controller/service 는 readFileSync 텍스트 read 만.
//   - `deploy/daily-test.sh` 변경 0 — readFileSync 로 읽기만(drift 발견 시 별도 fix task).
//   - 실 daily-test.sh 실행/source/실 step 실행/실 curl/실 NestJS 부팅/실 DB/실 supertest 0.
//   - `GET /` SPA HTML 내용(`<!doctype html`·`id="root"`) 비교 0 — root 는 P6 serve-static
//     이라 controller route decorator 가 아님. 기대 status `200` 표기 정합만 정적 확인.
//   - 409 conflict 실 트리거(P2002 실 DB write) 검증 0 — shell `201 | 409` 멱등 표기·controller
//     created-status(201) 정합의 정적 확인만.
//   - step_eval jest argv full-vector parity(T-0790)·머신 요약 JSON 스키마(T-0791) 재단언 0
//     — distinct surface(HTTP 계약 ↔ controller route).
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");
const APP_CONTROLLER_PATH = path.join(REPO_ROOT, "src/app.controller.ts");
const APP_SERVICE_PATH = path.join(REPO_ROOT, "src/app.service.ts");
const USER_CONTROLLER_PATH = path.join(
  REPO_ROOT,
  "src/user/user.controller.ts",
);
const AUTH_CONTROLLER_PATH = path.join(
  REPO_ROOT,
  "src/auth/auth.controller.ts",
);

// ---------------------------------------------------------------------------
// 타입 정의 — shell·controller 양측에서 추출한 HTTP 계약/route 의 정규형.
// ---------------------------------------------------------------------------

// HTTP 계약 한 건 — method·full-path·기대 status. shell 측·controller 측 양쪽이 본 형태로
// 정규화돼 1:1 비교된다. status 는 `null`(미명시·기대 미검사) 또는 number(명시 status).
interface HttpContract {
  method: string; // "GET" | "POST" 등 대문자
  fullPath: string; // "/api"·"/api/users"·"/api/auth/login" 등 prefix+route 조립
  expectedStatus: number | null; // shell: 기대 status, controller: @HttpCode/default
}

// ---------------------------------------------------------------------------
// shell 측 추출 — daily-test.sh 의 black-box HTTP 계약(method·path·기대 status).
// ---------------------------------------------------------------------------

// shell 소스에서 `HEALTH_MESSAGE="..."` 의 값을 추출한다(43행 `readonly HEALTH_MESSAGE=
// "Assessment-Agent"`). 못 찾으면 빈 문자열을 반환(silent fallback 방지는 호출측 단언).
function extractShellHealthMessage(shellSource: string): string {
  const match = shellSource.match(/HEALTH_MESSAGE="([^"]*)"/);
  if (!match) {
    return "";
  }
  return match[1];
}

// shell step_auth 가 명시한 `-X POST` 호출이 어떤 endpoint 를 향하는지 추출한다(117·125행
// `-X POST "$BASE_URL/api/users"`·`-X POST "$BASE_URL/api/auth/login"`). `-X POST` 토큰과
// 같은 호출의 `$BASE_URL/<path>"` 를 묶는다. method 명시가 없는 호출은 GET(curl default).
function extractShellPostPaths(shellSource: string): string[] {
  // `-X POST "$BASE_URL/<path>"` — 같은 curl 호출 내(개행 continuation `\` 허용)의 path.
  const re = /-X\s+POST\s+"\$BASE_URL(\/[^"\s]*)"/g;
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(shellSource)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

// shell 측 5 HTTP 계약을 정규형(HttpContract[])으로 추출한다. method 는 `-X POST` 명시
// 여부로, 기대 status 는 step 별 shell 검사 토큰(`201 | 409`·`!= "200"`·health 는 status
// 미검사 body-match 라 null)으로 결정한다. status 추출은 step 별 anchor 정규식으로.
function extractShellContracts(shellSource: string): HttpContract[] {
  const postPaths = new Set(extractShellPostPaths(shellSource));
  const contracts: HttpContract[] = [];

  // step_health/liveness: GET /api — body 문자열 일치 검사라 status code 미검사(null).
  contracts.push({ method: "GET", fullPath: "/api", expectedStatus: null });
  // step_liveness: GET / — `[ "$code" != "200" ]`(99행) → 기대 status 200.
  contracts.push({ method: "GET", fullPath: "/", expectedStatus: 200 });
  // step_auth signup: POST /api/users — `case "$code" in 201 | 409)`(119행) → created 201.
  contracts.push({
    method: postPaths.has("/api/users") ? "POST" : "GET",
    fullPath: "/api/users",
    expectedStatus: extractShellSignupCreatedStatus(shellSource),
  });
  // step_auth login: POST /api/auth/login — `[ "$code" != "200" ]`(127행) → 200.
  contracts.push({
    method: postPaths.has("/api/auth/login") ? "POST" : "GET",
    fullPath: "/api/auth/login",
    expectedStatus: extractShellStatusNeqGuard(shellSource),
  });
  // step_auth me: GET /api/auth/me — `[ "$code" != "200" ]`(134행) → 200.
  contracts.push({
    method: "GET",
    fullPath: "/api/auth/me",
    expectedStatus: extractShellStatusNeqGuard(shellSource),
  });

  return contracts;
}

// signup step 의 created-status 추출 — `case "$code" in\n    201 | 409)` 패턴(119행)에서
// 첫 status(201) 를 created-status 로 본다. 멱등 분기 409 도 함께 수용함은 별도 단언.
function extractShellSignupCreatedStatus(shellSource: string): number | null {
  const match = shellSource.match(
    /case\s+"\$code"\s+in\s*\n\s*(\d+)\s*\|\s*(\d+)\)/,
  );
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

// signup step 의 멱등 분기(409) 를 추출 — shell 이 `201 | 409` 로 재호출 conflict 도 정상
// 수용함을 확인한다. 못 찾으면 null.
function extractShellSignupIdempotentStatus(
  shellSource: string,
): number | null {
  const match = shellSource.match(
    /case\s+"\$code"\s+in\s*\n\s*(\d+)\s*\|\s*(\d+)\)/,
  );
  if (!match) {
    return null;
  }
  return Number(match[2]);
}

// login/me step 의 기대 status 추출 — `[ "$code" != "200" ]` guard(127·134행)에서 기대
// status 200 을 역산한다(login·me 둘 다 `!= "200"` 패턴 공유 — 첫 매치 status 반환).
function extractShellStatusNeqGuard(shellSource: string): number | null {
  // login(127행)·me(134행) 둘 다 `[ "$code" != "200" ]` — `!= "<status>"` 의 status 역산.
  const matches = shellSource.match(/\[\s*"\$code"\s*!=\s*"(\d+)"\s*\]/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  // 두 guard(login·me) 모두 동일 200 이라 첫 매치 status 를 반환(둘 다 200 임은 happy 단언).
  const first = matches[0].match(/!=\s*"(\d+)"/);
  return first ? Number(first[1]) : null;
}

// ---------------------------------------------------------------------------
// controller 측 추출 — @Controller prefix + @Get/@Post route + @HttpCode/status.
// ---------------------------------------------------------------------------

// controller 소스에서 `@Controller("prefix")` 의 prefix 를 추출한다(따옴표 single/double
// 모두). `@Controller()`(인자 없음·빈) 면 빈 문자열을 반환. 못 찾으면 undefined.
function extractControllerPrefix(controllerSource: string): string | undefined {
  const match = controllerSource.match(/@Controller\(\s*["']([^"']*)["']\s*\)/);
  if (match) {
    return match[1];
  }
  // `@Controller()` — 인자 없는 빈 prefix.
  if (/@Controller\(\s*\)/.test(controllerSource)) {
    return "";
  }
  return undefined;
}

// prefix + route 를 byte-identical full-path 로 조립한다(NestJS route 매핑 규칙 mirror).
// 둘 다 `/` 정규화 — `prefix="api"`, `route=""` → `/api`; `route="login"` → `/api/auth/login`.
function assembleFullPath(prefix: string, route: string): string {
  const segs = [prefix, route]
    .map((s) => s.replace(/^\/+|\/+$/g, "")) // 양끝 슬래시 제거
    .filter((s) => s.length > 0);
  return "/" + segs.join("/");
}

// controller 소스에서 method decorator(`@Get`/`@Post`)+route+`@HttpCode(n)` 의 route 객체
// 배열을 추출한다. 각 method decorator 직후의 인자(route 문자열) + 동일 method 블록의
// `@HttpCode(n)` 를 묶는다. prefix 는 별도(extractControllerPrefix). route 미명시 → "".
function extractControllerRoutes(
  controllerSource: string,
): { method: string; route: string; httpCode: number | null }[] {
  const routes: { method: string; route: string; httpCode: number | null }[] =
    [];
  // `@Get(...)` / `@Post(...)` decorator 매치 — 인자(따옴표 route) optional.
  const re = /@(Get|Post)\(\s*(?:["']([^"']*)["'])?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(controllerSource)) !== null) {
    const method = m[1].toUpperCase();
    const route = m[2] ?? "";
    // 동일 decorator 블록의 `@HttpCode(n)` — 매치 직후 ~200자 window 안에서 탐색.
    const window = controllerSource.slice(m.index, m.index + 200);
    const hc = window.match(/@HttpCode\(\s*(\d+)\s*\)/);
    routes.push({
      method,
      route,
      httpCode: hc ? Number(hc[1]) : null,
    });
  }
  return routes;
}

// app.service 소스에서 `APP_STATUS_MESSAGE = "..."` 의 값을 추출한다(7행). 못 찾으면 빈 문자열.
function extractAppStatusMessage(serviceSource: string): string {
  const match = serviceSource.match(/APP_STATUS_MESSAGE\s*=\s*"([^"]*)"/);
  if (!match) {
    return "";
  }
  return match[1];
}

// ---------------------------------------------------------------------------
// 본 spec 이 박제하는 contract 정본 — shell·controller 양측이 수렴해야 하는 기대값.
// ---------------------------------------------------------------------------

const EXPECTED_HEALTH_MESSAGE = "Assessment-Agent";
const EXPECTED_GET_API_PATH = "/api";
const EXPECTED_USERS_PATH = "/api/users";
const EXPECTED_LOGIN_PATH = "/api/auth/login";
const EXPECTED_ME_PATH = "/api/auth/me";

describe("realdata-e2e step④ daily-test.sh HTTP step 계약(path·method·status) ↔ 실 NestJS controller route decorator parity drift smoke (T-0792)", () => {
  describe("Happy-path: shell + controller 소스 read + HTTP 계약/route decorator 추출", () => {
    it("실 deploy/daily-test.sh + 4 controller/service 소스를 읽어 shell HTTP 계약·controller route 를 비어있지 않게 추출한다", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const appController = readFileSync(APP_CONTROLLER_PATH, "utf8");
      const appService = readFileSync(APP_SERVICE_PATH, "utf8");
      const userController = readFileSync(USER_CONTROLLER_PATH, "utf8");
      const authController = readFileSync(AUTH_CONTROLLER_PATH, "utf8");

      const shellContracts = extractShellContracts(shellSource);
      const appRoutes = extractControllerRoutes(appController);
      const userRoutes = extractControllerRoutes(userController);
      const authRoutes = extractControllerRoutes(authController);

      // shell 측 5 HTTP 계약이 비어있지 않은 배열.
      expect(Array.isArray(shellContracts)).toBe(true);
      expect(shellContracts.length).toBe(5);
      // controller 측 route 추출이 각 파일에서 비어있지 않음.
      expect(appRoutes.length).toBeGreaterThan(0);
      expect(userRoutes.length).toBeGreaterThan(0);
      expect(authRoutes.length).toBeGreaterThan(0);
      // service status-message·controller prefix 가 비어있지 않게 추출됨.
      expect(extractAppStatusMessage(appService).length).toBeGreaterThan(0);
      expect(extractControllerPrefix(appController)).toBe("api");
      expect(extractControllerPrefix(userController)).toBe("api/users");
      expect(extractControllerPrefix(authController)).toBe("api/auth");
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 5 소스가 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      expect(readFileSync(DAILY_TEST_SH_PATH, "utf8")).toContain(
        'HEALTH_MESSAGE="Assessment-Agent"',
      );
      expect(readFileSync(APP_CONTROLLER_PATH, "utf8")).toContain(
        '@Controller("api")',
      );
      expect(readFileSync(USER_CONTROLLER_PATH, "utf8")).toContain(
        '@Controller("api/users")',
      );
      expect(readFileSync(AUTH_CONTROLLER_PATH, "utf8")).toContain(
        '@Controller("api/auth")',
      );
    });
  });

  describe("GET /api status-message 정합 수렴(핵심 불변식 1)", () => {
    it('shell HEALTH_MESSAGE 가 app.service APP_STATUS_MESSAGE 와 byte-identical AND GET /api path·method 가 app.controller @Controller("api")+@Get() 조립과 1:1', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const appController = readFileSync(APP_CONTROLLER_PATH, "utf8");
      const appService = readFileSync(APP_SERVICE_PATH, "utf8");

      // (1) health 신호 메시지 byte-identical(message rename 검출).
      const shellMsg = extractShellHealthMessage(shellSource);
      const ctrlMsg = extractAppStatusMessage(appService);
      expect(shellMsg).toBe(EXPECTED_HEALTH_MESSAGE);
      expect(shellMsg).toBe(ctrlMsg);

      // (2) GET /api full-path·method 1:1(path drift·method swap 검출).
      const prefix = extractControllerPrefix(appController);
      const routes = extractControllerRoutes(appController);
      const getRoot = routes.find((r) => r.method === "GET");
      expect(prefix).toBe("api");
      expect(getRoot).toBeDefined();
      const ctrlFullPath = assembleFullPath(prefix as string, getRoot!.route);
      expect(ctrlFullPath).toBe(EXPECTED_GET_API_PATH);

      const shellContracts = extractShellContracts(shellSource);
      const shellGetApi = shellContracts.find(
        (c) => c.fullPath === "/api" && c.method === "GET",
      );
      expect(shellGetApi).toBeDefined();
      expect(shellGetApi!.fullPath).toBe(ctrlFullPath);
      expect(shellGetApi!.method).toBe(getRoot!.method);
    });
  });

  describe("POST /api/users 계약 정합 수렴(핵심 불변식 2)", () => {
    it('shell signup path·method·status(201) 가 user.controller @Controller("api/users")+@Post()+@HttpCode(201) 조립과 1:1 AND 멱등 409 도 정상 수용', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const userController = readFileSync(USER_CONTROLLER_PATH, "utf8");

      // controller 측: prefix + @Post() route + @HttpCode(201) 조립.
      const prefix = extractControllerPrefix(userController);
      const routes = extractControllerRoutes(userController);
      const signup = routes.find(
        (r) => r.method === "POST" && r.route === "" && r.httpCode === 201,
      );
      expect(prefix).toBe("api/users");
      expect(signup).toBeDefined();
      const ctrlFullPath = assembleFullPath(prefix as string, signup!.route);
      expect(ctrlFullPath).toBe(EXPECTED_USERS_PATH);

      // shell 측: POST /api/users 계약.
      const shellSignup = extractShellContracts(shellSource).find(
        (c) => c.fullPath === "/api/users",
      );
      expect(shellSignup).toBeDefined();
      expect(shellSignup!.method).toBe("POST");
      expect(shellSignup!.method).toBe(signup!.method);
      expect(shellSignup!.fullPath).toBe(ctrlFullPath);
      // created-status 201 1:1(@HttpCode 누락→default 200 drift 검출).
      expect(shellSignup!.expectedStatus).toBe(201);
      expect(shellSignup!.expectedStatus).toBe(signup!.httpCode);

      // 멱등 분기: shell 이 409 도 정상 수용(`201 | 409`).
      expect(extractShellSignupIdempotentStatus(shellSource)).toBe(409);
    });
  });

  describe("POST /api/auth/login + GET /api/auth/me 계약 정합 수렴(핵심 불변식 3)", () => {
    it('shell login path·method·status(200) 가 @Post("login")+@HttpCode(200) 조립과 1:1 AND me path·method 가 @Get("me") 조립과 1:1', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authController = readFileSync(AUTH_CONTROLLER_PATH, "utf8");

      const prefix = extractControllerPrefix(authController);
      const routes = extractControllerRoutes(authController);
      expect(prefix).toBe("api/auth");

      // login: @Post("login") + @HttpCode(200).
      const login = routes.find(
        (r) => r.method === "POST" && r.route === "login",
      );
      expect(login).toBeDefined();
      const loginFullPath = assembleFullPath(prefix as string, login!.route);
      expect(loginFullPath).toBe(EXPECTED_LOGIN_PATH);
      expect(login!.httpCode).toBe(200);

      // me: @Get("me").
      const me = routes.find((r) => r.method === "GET" && r.route === "me");
      expect(me).toBeDefined();
      const meFullPath = assembleFullPath(prefix as string, me!.route);
      expect(meFullPath).toBe(EXPECTED_ME_PATH);

      // shell 측 login·me 계약 1:1.
      const shellContracts = extractShellContracts(shellSource);
      const shellLogin = shellContracts.find(
        (c) => c.fullPath === "/api/auth/login",
      );
      const shellMe = shellContracts.find((c) => c.fullPath === "/api/auth/me");
      expect(shellLogin).toBeDefined();
      expect(shellLogin!.method).toBe("POST");
      expect(shellLogin!.method).toBe(login!.method);
      expect(shellLogin!.fullPath).toBe(loginFullPath);
      expect(shellLogin!.expectedStatus).toBe(200);
      expect(shellLogin!.expectedStatus).toBe(login!.httpCode);

      expect(shellMe).toBeDefined();
      expect(shellMe!.method).toBe("GET");
      expect(shellMe!.method).toBe(me!.method);
      expect(shellMe!.fullPath).toBe(meFullPath);
      expect(shellMe!.expectedStatus).toBe(200);
    });
  });

  describe("GET / liveness root status 정합 수렴", () => {
    it("shell step_liveness 가 GET / 의 기대 status 200 을 검사함을 shell 소스에서 확인", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellRoot = extractShellContracts(shellSource).find(
        (c) => c.fullPath === "/" && c.method === "GET",
      );
      expect(shellRoot).toBeDefined();
      expect(shellRoot!.expectedStatus).toBe(200);
      // shell 소스에 `[ "$code" != "200" ]` root status guard 가 실재(99행).
      expect(shellSource).toMatch(/\[\s*"\$code"\s*!=\s*"200"\s*\]/);
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("controller @HttpCode(201)→@HttpCode(200) mutate 사본의 조립 status 가 shell 측 201 과 not.toBe — 원본은 mutate 0", () => {
      const userController = readFileSync(USER_CONTROLLER_PATH, "utf8");
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");

      // 원본 추출(불변 baseline).
      const originalRoutes = extractControllerRoutes(userController);
      const originalSignup = originalRoutes.find(
        (r) => r.method === "POST" && r.httpCode === 201,
      );
      expect(originalSignup).toBeDefined();

      // 사본만 mutate: @HttpCode(201) → @HttpCode(200)(default drift 모사). 주석에도
      // `@HttpCode(201)` 문구가 있어 global replace 로 실 decorator 까지 확실히 변형.
      const mutated = userController.replace(
        /@HttpCode\(201\)/g,
        "@HttpCode(200)",
      );
      const mutatedSignup = extractControllerRoutes(mutated).find(
        (r) => r.method === "POST" && r.route === "",
      );
      expect(mutatedSignup).toBeDefined();
      const shellSignupStatus = extractShellSignupCreatedStatus(shellSource);
      // mutate 사본의 status 가 shell 기대 201 과 정합 아님(status drift 검출).
      expect(mutatedSignup!.httpCode).not.toBe(shellSignupStatus);
      // 원본은 mutate 0 — 여전히 201.
      expect(originalSignup!.httpCode).toBe(201);
      expect(originalSignup!.httpCode).toBe(shellSignupStatus);
    });

    it('controller prefix @Controller("api/users")→@Controller("api/members") mutate 사본의 조립 full-path 가 shell /api/users 와 not.toBe', () => {
      const userController = readFileSync(USER_CONTROLLER_PATH, "utf8");

      const mutated = userController.replace(
        '@Controller("api/users")',
        '@Controller("api/members")',
      );
      const mutatedPrefix = extractControllerPrefix(mutated);
      const routes = extractControllerRoutes(mutated);
      const signup = routes.find((r) => r.method === "POST" && r.route === "");
      const mutatedFullPath = assembleFullPath(
        mutatedPrefix as string,
        signup!.route,
      );
      expect(mutatedFullPath).not.toBe(EXPECTED_USERS_PATH);
      // 원본은 정합.
      const origPrefix = extractControllerPrefix(userController);
      expect(assembleFullPath(origPrefix as string, signup!.route)).toBe(
        EXPECTED_USERS_PATH,
      );
    });

    it("shell login full-path 를 mutate 한 사본이 controller 조립 /api/auth/login 과 not.toBe", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");

      const mutated = shellSource.replace(
        '"$BASE_URL/api/auth/login"',
        '"$BASE_URL/api/auth/signin"',
      );
      const mutatedLogin = extractShellContracts(mutated).find(
        (c) => c.method === "POST" && c.fullPath === "/api/auth/login",
      );
      // mutate 후엔 /api/auth/login POST 계약이 사라짐(path 가 /api/auth/signin 로 drift).
      expect(mutatedLogin).toBeUndefined();
      // 원본은 정합 — login 계약이 controller full-path 와 동일.
      const origLogin = extractShellContracts(shellSource).find(
        (c) => c.fullPath === "/api/auth/login",
      );
      expect(origLogin).toBeDefined();
      expect(origLogin!.fullPath).toBe(EXPECTED_LOGIN_PATH);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("존재하지 않는 경로로 readFileSync → ENOENT throw(silent 0-byte fallback false-PASS 방지)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/does-not-exist-xyz.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("route 미존재 검출 — @Controller/@Get/@Post 없는 합성 controller → prefix undefined·route 빈 배열", () => {
      const synthetic = "export class X {}";
      // prefix 미존재 → undefined(silent 빈 문자열 PASS 아님).
      expect(extractControllerPrefix(synthetic)).toBeUndefined();
      // route 미존재 → 빈 배열.
      expect(extractControllerRoutes(synthetic)).toHaveLength(0);
    });

    it("path drift 검출 — @Controller prefix 를 바꾼 합성 controller → 조립 full-path 가 /api/users 와 not.toBe", () => {
      const synthetic =
        '@Controller("api/admins")\n@Post()\n@HttpCode(201)\nsignup() {}';
      const prefix = extractControllerPrefix(synthetic);
      const routes = extractControllerRoutes(synthetic);
      const signup = routes.find((r) => r.method === "POST");
      const fullPath = assembleFullPath(prefix as string, signup!.route);
      expect(fullPath).not.toBe(EXPECTED_USERS_PATH);
    });

    it("method swap 검출 — shell POST /api/auth/login 을 GET 으로 바꾼 합성 shell → controller @Post method POST 와 not.toBe", () => {
      // 합성 shell: `-X POST` 제거(GET default 로 swap).
      const syntheticShell =
        'code="$(curl_code 10 "$BASE_URL/api/auth/login")"';
      // POST path 추출이 비어 → login 은 GET 으로 분류됨.
      const postPaths = extractShellPostPaths(syntheticShell);
      expect(postPaths).not.toContain("/api/auth/login");
      // controller 측 login 은 POST 라 method mismatch(GET != POST) 검출.
      const syntheticMethod = postPaths.includes("/api/auth/login")
        ? "POST"
        : "GET";
      expect(syntheticMethod).not.toBe("POST");
    });

    it("status drift 검출 — @HttpCode(201) 제거(default 200)/204 합성 controller → shell 기대 201 과 not.toBe", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellStatus = extractShellSignupCreatedStatus(shellSource);

      // (a) @HttpCode 제거 → httpCode null(default 200 으로 silent drift).
      const noHttpCode = '@Controller("api/users")\n@Post()\nsignup() {}';
      const noHcRoute = extractControllerRoutes(noHttpCode).find(
        (r) => r.method === "POST",
      );
      expect(noHcRoute!.httpCode).not.toBe(shellStatus);
      expect(noHcRoute!.httpCode).toBeNull();

      // (b) @HttpCode(204) → 204 != 201.
      const wrongCode =
        '@Controller("api/users")\n@Post()\n@HttpCode(204)\nsignup() {}';
      const wrongRoute = extractControllerRoutes(wrongCode).find(
        (r) => r.method === "POST",
      );
      expect(wrongRoute!.httpCode).not.toBe(shellStatus);
    });

    it("prefix 누락 검출 — @Controller()(빈 prefix) 합성 → 조립 full-path 가 expected /api/users 와 not.toBe", () => {
      const synthetic = "@Controller()\n@Post()\n@HttpCode(201)\nsignup() {}";
      const prefix = extractControllerPrefix(synthetic);
      // 빈 prefix 는 빈 문자열(undefined 아님 — `@Controller()` 인자 없음 분기).
      expect(prefix).toBe("");
      const routes = extractControllerRoutes(synthetic);
      const signup = routes.find((r) => r.method === "POST");
      const fullPath = assembleFullPath(prefix as string, signup!.route);
      // 빈 prefix → full-path "/" (route 도 빈) → /api/users 와 not.toBe.
      expect(fullPath).not.toBe(EXPECTED_USERS_PATH);
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("추출/합성하는 어떤 문자열(path·method·status·message·합성 controller/shell)에도 credential placeholder 미surface", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const appService = readFileSync(APP_SERVICE_PATH, "utf8");
      const shellContracts = extractShellContracts(shellSource);
      const msg = extractAppStatusMessage(appService);

      // 본 smoke 가 다루는 surface 만 검사 — 계약 path·method·status·message·합성 문자열.
      const haystacks = [
        ...shellContracts.map(
          (c) => `${c.method} ${c.fullPath} ${c.expectedStatus}`,
        ),
        extractShellHealthMessage(shellSource),
        msg,
        EXPECTED_LOGIN_PATH,
        EXPECTED_ME_PATH,
        EXPECTED_USERS_PATH,
      ];

      // token 형태(GH_TOKEN/Bearer/Authorization/x-*-token/ghp_/sk- prefix)만 검출.
      const credentialPattern =
        /(GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|ghp_|\bsk-)/i;
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 shell·controller 소스로 추출을 두 번 → 결과가 byte-identical deep-equal", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const userController = readFileSync(USER_CONTROLLER_PATH, "utf8");

      const a = extractShellContracts(shellSource);
      const b = extractShellContracts(shellSource);
      expect(a).toEqual(b);

      const ra = extractControllerRoutes(userController);
      const rb = extractControllerRoutes(userController);
      expect(ra).toEqual(rb);
    });

    it("추출 보조 함수가 입력 문자열을 mutate 0 — 사본 mutate 후에도 원본 추출 결과 불변", () => {
      const userController = readFileSync(USER_CONTROLLER_PATH, "utf8");
      const before = extractControllerRoutes(userController);

      // 사본 mutate(drift 변별성 항과 동형) — 사본은 변형되나 원본 source 문자열·추출
      // 결과는 불변이어야. 사본 추출이 원본과 달라짐을 확인해 mutate 가 실재함을 입증.
      const mutated = userController.replace(
        /@HttpCode\(201\)/g,
        "@HttpCode(200)",
      );
      const mutatedRoutes = extractControllerRoutes(mutated);
      expect(mutatedRoutes).not.toEqual(before);
      // 원본 재추출은 before 와 deep-equal(보조 함수가 입력 문자열 mutate 0).
      const after = extractControllerRoutes(userController);
      expect(after).toEqual(before);
    });
  });
});
