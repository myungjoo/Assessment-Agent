// realdata-e2e-daily-test-auth-signup-login-me-roundtrip-cookie-jar-threading-idempotent-branch-failfast-secret-safe-diagnostic-contract.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 의 `step_auth`(116~144행) 가 배포된 앱의
// **인증 흐름 실 생존** 을 판정하는 **signup→login→me 순차 round-trip 계약** 을 실 shell 파일을 readFileSync
// 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke (T-0951, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 봉함 불변식: **auth 는 signup→login→me 를 *순서대로* 통과해야만 인증-생존을 단언하고(중간 leg 실패는
// 하류 미실행 FAIL), signup 은 201|409 를 멱등 수용하며, login 이 발급한 cookie 는 단일 jar 로만 me 에
// 전달되고, jar 는 모든 종료 경로에서 정리되며, 실패 진단은 status 코드만 노출해 credential 실값을 누출하지
// 않는다(§9).** 이 불변식이 무인 nightly 가 "배포 앱의 인증 흐름이 실제로 살아있다" 를 credential-safe 하게
// 판정하는 신뢰의 핵심. 계약 6종(실 소스 유도 앵커):
//   (a) 순차 3-leg round-trip(116~144행 step_auth — ① 122행 `POST "$BASE_URL/api/users"` signup →
//       ② 130행 `POST "$BASE_URL/api/auth/login"` login → ③ 137행 `GET "$BASE_URL/api/auth/me"` me 를
//       *순서대로*, 각 leg 성공이 다음 leg 진입의 전제) ·
//   (b) 멱등 signup 분기(124행 `case "$code" in 201 | 409)` — 첫 회 201·이미-존재 409 *둘 다* OK, 그 외 FAIL) ·
//   (c) cookie-jar 단일-소스 threading(119행 `jar="$(mktemp)"` → 130행 login `-c "$jar"` write →
//       137행 me `-b "$jar"` read — login 발급 세션이 단일 jar 로 me 에 전달) ·
//   (d) rm -f 전-경로 정리(126·133·138행 — signup FAIL·login FAIL·me 진입 *모든* 경로에서 `rm -f "$jar"`) ·
//   (e) fail-fast short-circuit(각 leg guard FAIL 시 `return 1` 즉시 종료 → 하류 leg 미실행) ·
//   (f) §9-safe status-only 진단(126·133·140행 `log "step auth: FAIL — <leg> status=$code"` — status 코드만
//       진단, SMOKE_EMAIL/SMOKE_PASSWORD/payload 실값·cookie 값 echo 0).
//
// 전략(T-0947/T-0948/T-0949/T-0950 동형): auth round-trip 유도 표현을 정적 앵커로 추출 + bash round-trip
// semantics 를 TS 순수 함수(`isIdempotentSignupStatus`·`authRoundTripOutcome`·`authDiagnostic`)로 동형
// 모델링해 순차·멱등·jar-threading·정리·short-circuit·§9-진단 불변식 assert. T-0792(HTTP path·method·status
// parity — round-trip 순서·jar·멱등 *명시 제외*, 그 spec line 48)·T-0947(cascade black-box outcome)·
// T-0950(liveness 3-gate 합취)·T-0944~T-0949 와 distinct surface(step_auth *내부* signup→login→me round-trip).
//   🔥 실 signup/login/me/HTTP/curl/mktemp/gh/git 0 · auth 분기 실행 0(non-gated, describe.skip 0) ·
//      process.env 읽기 0(입력은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// auth round-trip 입력 3-tuple — 실 curl 산출(signup status · login status · me status)의 동형 모델.
// 실 signup/login/me HTTP 요청 0 — 값은 함수 파라미터로만 주입.
interface AuthRoundTripInput {
  signupStatus: number;
  loginStatus: number;
  meStatus: number;
}

// auth round-trip 결과 — return 0(ok:true) / return 1(ok:false, 어느 leg 에서 fail-fast 종료했는지).
interface AuthRoundTripOutcome {
  ok: boolean;
  // 실패 leg — signup|login|me 중 fail-fast 로 멈춘 지점. ok:true 면 undefined.
  failedLeg?: "signup" | "login" | "me";
  // fail-fast short-circuit 로 실제 실행된 leg 목록(순차 진행 증거). signup 은 항상 실행,
  // signup FAIL 이면 login/me 미실행, login FAIL 이면 me 미실행.
  executedLegs: Array<"signup" | "login" | "me">;
}

// ── TS 동형 pure 함수(정본) — daily-test.sh step_auth(116~144행) round-trip 을 순수 함수로 모델링.
//    입력(숫자)은 mutate 하지 않는다(읽기만). 실 bash/curl/env 읽기 0 — 입력은 함수 파라미터.

// (b) isIdempotentSignupStatus(code): 124행 `case "$code" in 201 | 409)` 동형 — 첫 회 created 201 또는
//     이미-존재 409 *둘 다* 멱등 수용(true), 그 외 status(0 curl 실패 포함)는 signup FAIL(false).
function isIdempotentSignupStatus(code: number): boolean {
  return code === 201 || code === 409;
}

// (a)(e) authRoundTripOutcome(input): signup→login→me 순차 round-trip + fail-fast short-circuit 동형.
//     ① signup(멱등 201|409) → 실패면 즉시 종료(login/me 미실행) · ② login(==200) → 실패면 즉시 종료
//     (me 미실행) · ③ me(==200) → 실패면 종료. 셋 모두 통과여야 ok:true(return 0 동형). 각 leg 실패 시
//     하류 leg 는 executedLegs 에 넣지 않는다(하류 미실행 = fail-fast short-circuit 증거).
function authRoundTripOutcome(input: AuthRoundTripInput): AuthRoundTripOutcome {
  const executedLegs: Array<"signup" | "login" | "me"> = [];
  // ① signup — 항상 먼저 실행.
  executedLegs.push("signup");
  if (!isIdempotentSignupStatus(input.signupStatus)) {
    return { ok: false, failedLeg: "signup", executedLegs };
  }
  // ② login — signup 통과 후에만 진입(순차 의존).
  executedLegs.push("login");
  if (input.loginStatus !== 200) {
    return { ok: false, failedLeg: "login", executedLegs };
  }
  // ③ me — login 통과 후에만 진입(login 발급 세션 의존).
  executedLegs.push("me");
  if (input.meStatus !== 200) {
    return { ok: false, failedLeg: "me", executedLegs };
  }
  return { ok: true, executedLegs };
}

// (f) authDiagnostic(input): 실패 시 어느 *leg* 가 어떤 *status* 로 깨졌는지만 진단(126·133·140행 동형).
//     SMOKE_EMAIL/SMOKE_PASSWORD/payload 실값·cookie 값은 반환 문자열에 절대 포함하지 않는다(§9) —
//     leg 이름 + status 코드만 노출. fail-fast 순서(signup → login → me)를 따라 첫 실패 leg 만 진단.
function authDiagnostic(input: AuthRoundTripInput): string {
  if (!isIdempotentSignupStatus(input.signupStatus)) {
    return `signup status=${input.signupStatus}`;
  }
  if (input.loginStatus !== 200) {
    return `login status=${input.loginStatus}`;
  }
  if (input.meStatus !== 200) {
    return `me status=${input.meStatus}`;
  }
  return "OK";
}

// ── 정적 앵커 추출 보조 함수 (실 bash auth round-trip 표현이 소스에 실재하는지) ──────────────

// step_auth 함수 정의 앵커(116행) — `step_auth() {`.
function hasAuthFnAnchor(shellSource: string): boolean {
  return shellSource.includes("step_auth() {");
}

// signup leg 앵커(122·124행) — `-X POST "$BASE_URL/api/users"` + 멱등 분기 `case "$code" in`/`201 | 409)`.
function hasSignupLegAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('-X POST "$BASE_URL/api/users"') &&
    shellSource.includes("201 | 409)")
  );
}

// login leg 앵커(130행) — cookie jar write `-c "$jar"` + `-X POST "$BASE_URL/api/auth/login"`.
function hasLoginLegAnchor(shellSource: string): boolean {
  return shellSource.includes('-c "$jar" -X POST "$BASE_URL/api/auth/login"');
}

// me leg 앵커(137행) — cookie jar read `-b "$jar"` + `GET "$BASE_URL/api/auth/me"`.
function hasMeLegAnchor(shellSource: string): boolean {
  return shellSource.includes('-b "$jar" "$BASE_URL/api/auth/me"');
}

// jar 생성 앵커(119행) — `jar="$(mktemp)"`(단일 소스 mktemp).
function hasJarCreateAnchor(shellSource: string): boolean {
  return shellSource.includes('jar="$(mktemp)"');
}

// OK return 앵커(142~143행) — `step auth: OK (signup→login→me round-trip)` + `return 0`.
function hasAuthOkAnchor(shellSource: string): boolean {
  return (
    shellSource.includes("step auth: OK (signup→login→me round-trip)") &&
    shellSource.includes("return 0")
  );
}

// curl_code helper 앵커(62~65행) — status-only 추출 `%{http_code}` + hang guard `--max-time "${1}"`.
function hasCurlCodeHelperAnchor(shellSource: string): boolean {
  return (
    shellSource.includes("curl_code() {") &&
    shellSource.includes("%{http_code}") &&
    shellSource.includes('--max-time "${1}"')
  );
}

// 6종 auth round-trip 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractAuthRoundTripAnchors(shellSource: string): {
  authFn: boolean;
  signupLeg: boolean;
  loginLeg: boolean;
  meLeg: boolean;
  jarCreate: boolean;
  okReturn: boolean;
  curlCodeHelper: boolean;
} {
  return {
    authFn: hasAuthFnAnchor(shellSource),
    signupLeg: hasSignupLegAnchor(shellSource),
    loginLeg: hasLoginLegAnchor(shellSource),
    meLeg: hasMeLegAnchor(shellSource),
    jarCreate: hasJarCreateAnchor(shellSource),
    okReturn: hasAuthOkAnchor(shellSource),
    curlCodeHelper: hasCurlCodeHelperAnchor(shellSource),
  };
}

// step_auth 함수 본문 슬라이스(116행 정의 ~ 다음 top-level 앵커 직전) — jar-threading·rm -f·§9 진단 검사용.
function extractAuthFnSlice(shellSource: string): string {
  const start = shellSource.indexOf("step_auth() {");
  if (start === -1) return "";
  // step_auth 뒤에는 gating-env 배열 주석(`# realdata-e2e live smoke 의 gating env`)이 온다 — 그 직전까지.
  const next = shellSource.indexOf(
    "# realdata-e2e live smoke 의 gating env",
    start,
  );
  return next === -1
    ? shellSource.slice(start)
    : shellSource.slice(start, next);
}

// 정상 round-trip 입력(3-leg 모두 통과) — 실 curl 산출의 동형 placeholder(실 네트워크 0).
function okInput(): AuthRoundTripInput {
  return { signupStatus: 201, loginStatus: 200, meStatus: 200 };
}

describe("realdata-e2e step④ daily-test.sh step_auth signup→login→me 인증 round-trip contract smoke — 순차 3-leg + 멱등 201|409 + cookie-jar -c/-b threading + rm -f 전-경로 정리 + fail-fast short-circuit + §9-safe status-only 진단 (T-0951)", () => {
  describe("Happy-path: step_auth round-trip 앵커 정적 추출(pure 함수가 실 bash round-trip 을 mirror)", () => {
    it("함수 정의(116)·signup(122/124)·login(130)·me(137)·jar 생성(119)·OK return(143)·curl_code helper(62~65)가 실 소스에 존재(7 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractAuthRoundTripAnchors(shellSource);
      expect(anchors.authFn).toBe(true);
      expect(anchors.signupLeg).toBe(true);
      expect(anchors.loginLeg).toBe(true);
      expect(anchors.meLeg).toBe(true);
      expect(anchors.jarCreate).toBe(true);
      expect(anchors.okReturn).toBe(true);
      expect(anchors.curlCodeHelper).toBe(true);
    });
  });

  describe("Happy-path: 3-leg 모두 통과 → auth OK(정상 + 멱등 재실행 둘 다)", () => {
    it("authRoundTripOutcome 는 signup∈{201,409} AND login==200 AND me==200 인 입력에서 ok:true(return 0 동형) + 3-leg 모두 실행 + 진단 OK", () => {
      const input = okInput();
      const outcome = authRoundTripOutcome(input);
      expect(outcome.ok).toBe(true);
      expect(outcome.failedLeg).toBeUndefined();
      expect(outcome.executedLegs).toEqual(["signup", "login", "me"]);
      expect(authDiagnostic(input)).toBe("OK");
    });

    it("멱등 재실행 입력(signup 409·login 200·me 200)도 ok:true — 2회차 nightly 가 409(이미-존재)를 signup OK 로 수용", () => {
      const input: AuthRoundTripInput = {
        signupStatus: 409,
        loginStatus: 200,
        meStatus: 200,
      };
      const outcome = authRoundTripOutcome(input);
      expect(outcome.ok).toBe(true);
      expect(outcome.executedLegs).toEqual(["signup", "login", "me"]);
      expect(authDiagnostic(input)).toBe("OK");
    });
  });

  describe("Happy-path: isIdempotentSignupStatus(201|409 수용, 그 외 거부)", () => {
    it("201·409 는 true, 200·400·401·403·422·500·0(curl 실패) 각각 false(124행 `case 201 | 409)` 정합)", () => {
      // 멱등 수용: 첫 회 created 201 · 이미-존재 409.
      expect(isIdempotentSignupStatus(201)).toBe(true);
      expect(isIdempotentSignupStatus(409)).toBe(true);
      // 그 외 status 는 signup FAIL.
      expect(isIdempotentSignupStatus(200)).toBe(false);
      expect(isIdempotentSignupStatus(400)).toBe(false);
      expect(isIdempotentSignupStatus(401)).toBe(false);
      expect(isIdempotentSignupStatus(403)).toBe(false);
      expect(isIdempotentSignupStatus(422)).toBe(false);
      expect(isIdempotentSignupStatus(500)).toBe(false);
      expect(isIdempotentSignupStatus(0)).toBe(false); // curl 실패(연결 불가) code.
    });
  });

  describe("branch: leg 별 실패 → not-ok + leg별 진단 + fail-fast short-circuit(하류 미실행)", () => {
    it("(i) signup status ∉ {201,409}(login/me 정상) → ok:false, failedLeg:signup + 'signup status=' 진단 + login/me 미실행", () => {
      const input: AuthRoundTripInput = {
        signupStatus: 500,
        loginStatus: 200,
        meStatus: 200,
      };
      const outcome = authRoundTripOutcome(input);
      expect(outcome.ok).toBe(false);
      expect(outcome.failedLeg).toBe("signup");
      // fail-fast — signup 에서 멈춤(login/me 미실행).
      expect(outcome.executedLegs).toEqual(["signup"]);
      expect(outcome.executedLegs).not.toContain("login");
      expect(outcome.executedLegs).not.toContain("me");
      expect(authDiagnostic(input)).toBe("signup status=500");
    });

    it("(ii) signup OK 이나 login != 200(me 정상) → ok:false, failedLeg:login + 'login status=' 진단 + me 미실행", () => {
      const input: AuthRoundTripInput = {
        signupStatus: 201,
        loginStatus: 401,
        meStatus: 200,
      };
      const outcome = authRoundTripOutcome(input);
      expect(outcome.ok).toBe(false);
      expect(outcome.failedLeg).toBe("login");
      // fail-fast — login 에서 멈춤(me 미실행). signup·login 만 실행.
      expect(outcome.executedLegs).toEqual(["signup", "login"]);
      expect(outcome.executedLegs).not.toContain("me");
      expect(authDiagnostic(input)).toBe("login status=401");
    });

    it("(iii) signup·login OK 이나 me != 200 → ok:false, failedLeg:me + 'me status=' 진단(3-leg 모두 실행)", () => {
      const input: AuthRoundTripInput = {
        signupStatus: 201,
        loginStatus: 200,
        meStatus: 401,
      };
      const outcome = authRoundTripOutcome(input);
      expect(outcome.ok).toBe(false);
      expect(outcome.failedLeg).toBe("me");
      expect(outcome.executedLegs).toEqual(["signup", "login", "me"]);
      expect(authDiagnostic(input)).toBe("me status=401");
    });

    it("첫 실패 leg 만 진단(signup·login·me 동시 실패 시 signup 진단 — bash fail-fast 순서)", () => {
      const input: AuthRoundTripInput = {
        signupStatus: 500,
        loginStatus: 500,
        meStatus: 500,
      };
      expect(authDiagnostic(input)).toBe("signup status=500");
      expect(authRoundTripOutcome(input).failedLeg).toBe("signup");
    });

    it("leg별 진단은 실 소스 126·133·140행 status-only FAIL 라인과 정합(signup/login/me status=$code 3종)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      expect(authSlice).toContain("step auth: FAIL — signup status=$code");
      expect(authSlice).toContain("step auth: FAIL — login status=$code");
      expect(authSlice).toContain("step auth: FAIL — me status=$code");
    });
  });

  describe("branch: cookie-jar 단일-소스 threading(login write `-c` → me read `-b`) 정적 대조", () => {
    it('login leg 은 `-c "$jar"`(Set-Cookie write), me leg 은 `-b "$jar"`(cookie read), 동일 jar(119행 mktemp 단일 소스) 참조', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      // 단일 소스 jar 생성(mktemp).
      expect(authSlice).toContain('jar="$(mktemp)"');
      // login write(-c) 와 me read(-b) 가 *동일* "$jar" 변수를 인자로.
      expect(authSlice).toContain(
        '-c "$jar" -X POST "$BASE_URL/api/auth/login"',
      );
      expect(authSlice).toContain('-b "$jar" "$BASE_URL/api/auth/me"');
    });

    it("signup leg 은 jar 미참조(cookie 발급 전 — `-c`/`-b` 없이 `-X POST .../api/users`)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      // signup 라인만 추출(users endpoint 를 포함하는 curl_code 라인).
      const signupLine = authSlice
        .split("\n")
        .find((l) => l.includes('"$BASE_URL/api/users"'));
      expect(signupLine).toBeDefined();
      // signup 은 cookie write/read flag 없음(발급 전).
      expect(signupLine).not.toContain("-c ");
      expect(signupLine).not.toContain("-b ");
    });
  });

  describe("branch: rm -f 전-경로 정리(signup FAIL·login FAIL·me 진입 모든 종료 경로)", () => {
    it('signup FAIL(126)·login FAIL(133) 경로에 `rm -f "$jar"; return 1` 존재 + me 진입(138) `rm -f "$jar"` 존재 — 어느 exit 도 jar 정리', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      // rm -f 가 정확히 3회(signup FAIL·login FAIL·me 진입) 등장 — 어느 경로도 누수 없음.
      const rmCount = authSlice.split('rm -f "$jar"').length - 1;
      expect(rmCount).toBe(3);
      // signup FAIL·login FAIL 은 rm 후 즉시 return 1(fail-fast 종료).
      expect(authSlice).toContain(
        'step auth: FAIL — signup status=$code"; rm -f "$jar"; return 1',
      );
      expect(authSlice).toContain(
        'step auth: FAIL — login status=$code"; rm -f "$jar"; return 1',
      );
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — auth round-trip 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(auth 유도 표현 부재)에서 추출기가 false / 빈 슬라이스를 낸다.
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractAuthRoundTripAnchors(emptySource);
      expect(anchors.authFn).toBe(false);
      expect(anchors.signupLeg).toBe(false);
      expect(anchors.loginLeg).toBe(false);
      expect(anchors.meLeg).toBe(false);
      expect(anchors.jarCreate).toBe(false);
      expect(anchors.okReturn).toBe(false);
      expect(anchors.curlCodeHelper).toBe(false);
      // 슬라이스 추출도 빈 결과(성공-위장 0).
      expect(extractAuthFnSlice(emptySource)).toBe("");
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractAuthRoundTripAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.authFn).toBe(true);
      expect(realAnchors.signupLeg).toBe(true);
      expect(realAnchors.meLeg).toBe(true);
    });

    it("negative (a) — 멱등 signup 좁힘(201-only) drift 변별: 201 만 수용(409 거부)한 mutant 에서 '409 도 signup OK' assert 실패", () => {
      // mutant(모델 사본): 201 만 signup OK 로 좁힘(409 이미-존재 거부).
      const mutantIsIdempotent = (code: number): boolean => code === 201;
      // 정본: 201·409 둘 다 멱등 수용.
      expect(isIdempotentSignupStatus(409)).toBe(true);
      // mutant: 409(이미-존재)를 signup FAIL 로 오판(2회차 nightly 오판 회귀) — 정본과 어긋남.
      expect(mutantIsIdempotent(409)).toBe(false);
      expect(mutantIsIdempotent(409)).not.toBe(isIdempotentSignupStatus(409));
      // 201 은 양쪽 동일(첫 회 created).
      expect(mutantIsIdempotent(201)).toBe(isIdempotentSignupStatus(201));
      // 원본 불변(재호출 시 여전히 201·409 수용).
      expect(isIdempotentSignupStatus(409)).toBe(true);
    });

    it("negative (b) — fail-fast short-circuit 제거 drift 변별: 실패 후에도 하류 실행하는 mutant 에서 'signup 실패면 login/me 미실행' assert 실패", () => {
      // mutant(모델 사본): short-circuit 제거 — 실패해도 3-leg 전부 실행(executedLegs 항상 3).
      const mutantExecutedLegs = (): Array<"signup" | "login" | "me"> => [
        "signup",
        "login",
        "me",
      ];
      const signupFail: AuthRoundTripInput = {
        signupStatus: 500,
        loginStatus: 200,
        meStatus: 200,
      };
      // 정본(fail-fast): signup 실패면 login/me 미실행.
      expect(authRoundTripOutcome(signupFail).executedLegs).toEqual(["signup"]);
      // mutant: signup 실패에도 login/me 실행(실패 후 하류 실행 회귀) — 정본과 어긋남.
      expect(mutantExecutedLegs()).toContain("me");
      expect(mutantExecutedLegs()).not.toEqual(
        authRoundTripOutcome(signupFail).executedLegs,
      );
      // 원본 불변.
      expect(authRoundTripOutcome(signupFail).executedLegs).toEqual(["signup"]);
    });

    it("negative (c) — cookie-jar threading 단절(me `-b` 누락) drift 변별: me 가 jar 미참조하도록 약화한 mutant 슬라이스에서 'login write→me read 단일-소스' assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      // 정본: me leg 이 `-b "$jar"` 로 login 발급 cookie 를 읽음(threading 유지).
      expect(authSlice).toContain('-b "$jar" "$BASE_URL/api/auth/me"');
      // mutant(모델 사본): me 의 `-b "$jar"` 를 제거(세션 전달 단절 — me 가 인증 없이 요청).
      const mutantSlice = authSlice.replace(
        '-b "$jar" "$BASE_URL/api/auth/me"',
        '"$BASE_URL/api/auth/me"',
      );
      // mutant 슬라이스에는 me 의 cookie-read threading 이 부재(false-negative 회귀).
      expect(mutantSlice).not.toContain('-b "$jar" "$BASE_URL/api/auth/me"');
      expect(mutantSlice).not.toBe(authSlice);
      // 원본 불변(replace 는 사본을 반환, 원본 슬라이스는 그대로).
      expect(authSlice).toContain('-b "$jar" "$BASE_URL/api/auth/me"');
    });

    it("negative (d) — rm -f 정리 누락 drift 변별: login FAIL 경로의 `rm -f` 를 뺀 mutant 슬라이스에서 '모든 종료 경로에서 jar 정리(rm 3회)' assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      // 정본: rm -f 정확히 3회(전-경로 정리).
      expect(authSlice.split('rm -f "$jar"').length - 1).toBe(3);
      // mutant(모델 사본): login FAIL 경로의 rm -f 제거(jar 누수 — 반복 nightly 마다 /tmp 잔존).
      const mutantSlice = authSlice.replace(
        'step auth: FAIL — login status=$code"; rm -f "$jar"; return 1',
        'step auth: FAIL — login status=$code"; return 1',
      );
      // mutant 는 rm -f 가 2회로 줄어듦(정리 누락 회귀) — 정본(3회)과 어긋남.
      expect(mutantSlice.split('rm -f "$jar"').length - 1).toBe(2);
      expect(mutantSlice.split('rm -f "$jar"').length - 1).not.toBe(
        authSlice.split('rm -f "$jar"').length - 1,
      );
      // 원본 불변.
      expect(authSlice.split('rm -f "$jar"').length - 1).toBe(3);
    });

    it("negative (e) — §9 진단 credential-누출 drift 변별: status 대신 payload/password 실값을 내는 mutant 진단에서 '진단은 leg+status 만' assert 실패 + 실 소스 진단은 status 만", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      const secretPw = "SMOKE-PW-super-secret-xyz";
      const input: AuthRoundTripInput = {
        signupStatus: 500,
        loginStatus: 200,
        meStatus: 200,
      };
      // 정본 진단: leg+status 만(credential/payload 실값 미포함).
      expect(authDiagnostic(input)).toBe("signup status=500");
      expect(authDiagnostic(input)).not.toContain(secretPw);
      // mutant(모델 사본): 진단이 password 실값을 내도록 변조 — credential 이 진단 문자열에 실림.
      const mutantDiagnostic = (pw: string): string =>
        `signup FAIL password=${pw}`;
      expect(mutantDiagnostic(secretPw)).toContain(secretPw);
      // 실 소스 126·133·140행 FAIL 라인은 status=$code 만 — payload/email/password/cookie echo 미등장.
      const failLines = authSlice
        .split("\n")
        .filter((l) => l.includes("step auth: FAIL"));
      expect(failLines.length).toBe(3);
      failLines.forEach((l) => {
        expect(l).not.toContain("$payload");
        expect(l).not.toContain("$SMOKE_PASSWORD");
        expect(l).not.toContain("$SMOKE_EMAIL");
        // 진단은 status=$code 만 노출.
        expect(l).toContain("status=$code");
      });
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열(앵커 텍스트·진단·입력 status·auth 슬라이스)에 gh 토큰 어휘·credential 실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const authSlice = extractAuthFnSlice(shellSource);
      const synthesized = [
        authDiagnostic(okInput()),
        authDiagnostic({ signupStatus: 500, loginStatus: 200, meStatus: 200 }),
        authDiagnostic({ signupStatus: 201, loginStatus: 401, meStatus: 200 }),
        String(isIdempotentSignupStatus(409)),
        JSON.stringify(authRoundTripOutcome(okInput())),
        JSON.stringify(extractAuthRoundTripAnchors(shellSource)),
        authSlice,
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // 진단/합성 문자열에 access_token cookie 실값·password 실값이 surface 되지 않음.
      // payload(118행)는 email/password 를 담으나 그 *실값* 은 진단/앵커 어디에도 등장하지 않는다 —
      // auth 슬라이스에는 payload 참조(`$payload`)만 있고 실 email/password 값 리터럴은 없음.
      expect(authSlice).not.toContain("access_token=");
      // 진단 문자열은 leg+status 만(email/password 리터럴 0).
      synthesized.slice(0, 3).forEach((diag) => {
        expect(diag).not.toContain("password");
        expect(diag).not.toContain("email");
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(auth status map)으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const input = okInput();
      expect(authRoundTripOutcome(input)).toEqual(authRoundTripOutcome(input));
      expect(authDiagnostic(input)).toBe(authDiagnostic(input));
      expect(isIdempotentSignupStatus(409)).toBe(isIdempotentSignupStatus(409));
    });

    it("동일 shell 소스로 앵커 추출·슬라이스 추출을 두 번 하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(extractAuthRoundTripAnchors(shellSource)).toEqual(
        extractAuthRoundTripAnchors(shellSource),
      );
      expect(extractAuthFnSlice(shellSource)).toBe(
        extractAuthFnSlice(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(auth input·shell 소스)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractAuthRoundTripAnchors(shellSource);
      extractAuthFnSlice(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const input = okInput();
      const inputSnapshot = { ...input };
      authRoundTripOutcome(input);
      authDiagnostic(input);
      isIdempotentSignupStatus(input.signupStatus);
      expect(input).toEqual(inputSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("auth round-trip 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = authRoundTripOutcome(okInput()).ok;
      // 실 process.env 를 mutate 해도 auth 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { SMOKE_EMAIL: "injected@example.com" });
      const after = authRoundTripOutcome(okInput()).ok;
      delete process.env.SMOKE_EMAIL;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 signup/login/me/curl/git/HTTP 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasAuthFnAnchor(shellSource)).toBe(true);
    });
  });
});
