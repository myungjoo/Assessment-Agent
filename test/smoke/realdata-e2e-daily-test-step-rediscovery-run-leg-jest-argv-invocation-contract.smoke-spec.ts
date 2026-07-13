// realdata-e2e-daily-test-step-rediscovery-run-leg-jest-argv-invocation-contract.smoke-spec.ts
// — 실 평가 e2e nightly runner `deploy/daily-test.sh` 의 **step_rediscovery() run-leg jest-spawn
// 호출 argv 계약**을 실 shell 파일을 readFileSync 로 읽어(실행/source/실 jest spawn 0) 정적
// 검증하는 non-gated build-time smoke (T-0957, PLAN.md §109 step④ 실 평가 e2e nightly runner —
// eval/collect run-leg 삼형제의 세 번째 미봉 leg 봉함).
//
// 본 spec 의 존재 이유 — run-leg 계약 표면 미봉 해소:
//   - `step_rediscovery()`(237~251행)는 read-only 재발견 검색 leg 을 단일-spec bound jest argv 로
//     1 회 spawn 한다(243~245행). 형제 스텝 step_eval(T-0790)·step_collect 는 각각 run-leg argv
//     parity smoke 로 봉했으나, 뒤늦게 추가된(T-0943) step_rediscovery 의 run-leg jest argv 에는
//     대응 smoke 가 없었다(origin/main 확인 — NONE). run-leg argv 가 reorder / flag 변경 / spec
//     경로 오타로 정본과 silent 분기하면 nightly e2e 가 잘못된 jest 를 spawn → 무인 모니터링 false
//     신호. 본 spec 은 그 세 번째 run-leg 을 봉해 eval/collect/rediscovery run-leg 삼형제 계약을
//     완결한다.
//   - eval/collect 는 canonical TS command-plan helper 가 존재하나 rediscovery 는 미존재 —
//     따라서 본 spec 은 helper 도입이 아니라 **daily-test.sh run-leg argv 를 정적 앵커(local
//     expected 벡터)로** 봉한다(새 helper 모듈 신설 0 — spec 로컬 보조 함수만).
//
//      🔥 실 LLM 호출 0 / 실 네트워크 0 / 실 jest 프로세스 spawn 0 / 실 gh·git·redeploy·health 0 /
//         DB 0 — 파일 read + 정적 토큰 추출·in-memory 순수 함수만. `deploy/daily-test.sh` 는
//         읽기만(실행/source 0).
//      🔥 process.env 읽기 0 — fixture 는 정적 파일 텍스트 + 로컬 상수만(non-gated 항상 실행,
//         describe.skip / gating 분기 0). 본 함수 내부에 gating 판정 없음(caller 가 gating 검사 —
//         run-leg 만 담당)임을 별도 assert.
//      🔥 credential 0 echo — argv 는 spec 경로 + config flag 만(§9/REQ-059). 추출/합성 문자열
//         어디에도 gh 토큰 어휘·credential 실값 미surface.
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만.
//
// Out of Scope (T-0957):
//   - `deploy/daily-test.sh` 변경 0 — readFileSync 로 읽기만(drift 실 발견 시 별도 fix task).
//   - step_eval/step_collect run-leg argv parity smoke(T-0790·collect) 재구현/변경 0 — 상보적
//     세 번째 leg(본 spec 은 삼형제 shape 대조에 두 형제 정본 벡터를 expected 로 참조만).
//   - rediscovery live smoke(T-0942) 자신의 검색 round-trip 로직 재검증 0 — 본 task 는 그 spec 을
//     spawn 하는 호출 계약만.
//   - write publish / step_report 배선(ADR-0045 deferred) 0 — 본 leg 은 read-only(mutation 0).
//   - 새 canonical TS command-plan helper 신설 0 — 정적 앵커로 봉함.
import { existsSync, readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// ── run-leg argv 정본 상수(daily-test.sh 243~245행 mirror — 실 jest spawn 0) ──────────────
// helper 미존재 leg 이므로 canonical 벡터를 spec 로컬 상수로 박제(정적 앵커).
const SMOKE_JEST_CONFIG = "./test/jest-smoke.json";
const REDISCOVERY_SPEC_PATH =
  "test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts";
// 형제 leg 의 spec 경로(삼형제 shape 대조 시 spec 경로만 다름을 실증하는 참조값).
const EVAL_SPEC_PATH = "test/smoke/realdata-e2e-live.smoke-spec.ts";
const COLLECT_SPEC_PATH =
  "test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts";

// rediscovery run-leg 의 canonical ordered argv 벡터(4-요소 — flag↔value 순서·길이 고정).
const REDISCOVERY_RUN_LEG_ARGV = [
  "--config",
  SMOKE_JEST_CONFIG,
  "--runTestsByPath",
  REDISCOVERY_SPEC_PATH,
];

// ── 정적 추출 보조 함수(형제 step_eval smoke 의 extractStepEvalJestArgv 와 동형) ──────────
//
// `deploy/daily-test.sh` 243~245행은 multi-line line-continuation(`\`) 으로 jest argv 를 박는다:
//
//   if ( cd "$REPO_DIR" && pnpm exec jest \
//         --config ./test/jest-smoke.json \
//         --runTestsByPath test/smoke/...rediscovery-search-live.smoke-spec.ts ) >>"$LOG_FILE" 2>&1; then
//
// 추출 전략(line-prefix·whitespace·line-continuation drift 에 robust):
//   1. 지정한 step 함수 본문(`<fn>() {` ~ 줄 시작 닫는 `}`)을 슬라이스(다른 step·주석 토큰 오염 방지).
//   2. 본문에서 `pnpm exec jest` 이후 subshell 닫는 `)` 직전까지 argv 영역만 잘라낸다.
//   3. line-continuation `\` + 개행을 공백으로 정규화하고 whitespace split 로 flag/value 토큰을
//      ordered 로 모은다(`jest` 실행 파일명·redirection·`cd` 등 제외).
// argv 영역을 못 찾으면 빈 배열 반환(silent 0-byte fallback 방지는 호출측 not.toEqual 단언 담당).
function extractRunLegJestArgv(shellSource: string, fnName: string): string[] {
  const fnHeaderMatch = shellSource.match(
    new RegExp(`${fnName}\\s*\\(\\)\\s*\\{`),
  );
  if (!fnHeaderMatch || fnHeaderMatch.index === undefined) {
    return [];
  }
  const bodyStart = fnHeaderMatch.index + fnHeaderMatch[0].length;
  const closeMatch = shellSource.slice(bodyStart).match(/\n\}/);
  const bodyEnd =
    closeMatch && closeMatch.index !== undefined
      ? bodyStart + closeMatch.index
      : shellSource.length;
  const fnBody = shellSource.slice(bodyStart, bodyEnd);

  const jestMarker = "pnpm exec jest";
  const jestIdx = fnBody.indexOf(jestMarker);
  if (jestIdx < 0) {
    return [];
  }
  const afterJest = fnBody.slice(jestIdx + jestMarker.length);
  // argv 는 subshell 닫는 `)` 직전까지. redirection(`>>"$LOG_FILE"`) 은 그 뒤라 제외됨.
  const closeParenIdx = afterJest.indexOf(")");
  const argvRegion =
    closeParenIdx >= 0 ? afterJest.slice(0, closeParenIdx) : afterJest;

  return argvRegion
    .replace(/\\\s*\n/g, " ") // line-continuation `\` + 개행 → 공백
    .replace(/\n/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// step 함수 본문 전체(run-leg 문장 포함)를 line-continuation 정규화해 반환하는 보조 함수 —
// subshell 격리·append redirect·stderr 병합·return 분기 앵커 검사에 사용.
function extractRunLegBlock(shellSource: string, fnName: string): string {
  const fnHeaderMatch = shellSource.match(
    new RegExp(`${fnName}\\s*\\(\\)\\s*\\{`),
  );
  if (!fnHeaderMatch || fnHeaderMatch.index === undefined) {
    return "";
  }
  const bodyStart = fnHeaderMatch.index + fnHeaderMatch[0].length;
  const closeMatch = shellSource.slice(bodyStart).match(/\n\}/);
  const bodyEnd =
    closeMatch && closeMatch.index !== undefined
      ? bodyStart + closeMatch.index
      : shellSource.length;
  return shellSource
    .slice(bodyStart, bodyEnd)
    .replace(/\\\s*\n/g, " ")
    .replace(/\n/g, " ");
}

// run-leg 계약 요소의 분리 boolean(정본 블록 파싱 결과).
interface RunLegContract {
  subshellIsolated: boolean; // `( cd "$REPO_DIR" && pnpm exec jest` subshell 격리.
  appendRedirect: boolean; // `>>"$LOG_FILE"`(append) — `>`(truncate) 아님.
  stderrMerged: boolean; // `2>&1` — stderr → stdout 병합.
  redirectTargetIsLogFile: boolean; // redirect 대상이 `$LOG_FILE`.
}

// run-leg 블록을 파싱해 계약 요소 분리 판정 — subshell 격리 / append(`>>`) / stderr 병합(`2>&1`) /
// LOG_FILE 대상. `>>` 존재 시 append true(없으면 truncate false).
function runLegContract(block: string): RunLegContract {
  return {
    subshellIsolated: /\(\s*cd\s+"\$REPO_DIR"\s+&&\s+pnpm exec jest/.test(
      block,
    ),
    appendRedirect: block.includes('>>"$LOG_FILE"'),
    stderrMerged: block.includes("2>&1"),
    redirectTargetIsLogFile: block.includes('"$LOG_FILE"'),
  };
}

// exit-code → return 분기 동형(245~250행 if/else) — 성공(exit 0) → return 0, 실패 → return 1.
function rediscoveryReturnBranch(childExitZero: boolean): {
  log: "OK" | "FAIL";
  ret: 0 | 1;
} {
  return childExitZero ? { log: "OK", ret: 0 } : { log: "FAIL", ret: 1 };
}

// 추출 argv 에서 spec 경로만 제거한 shape(subshell·config flag+value·runTestsByPath flag) —
// 삼형제 single-source 대조용(spec 경로만 다르고 나머지는 identical 임을 실증).
function argvShapeExceptSpecPath(argv: string[]): string[] {
  return argv.filter(
    (t) =>
      t !== REDISCOVERY_SPEC_PATH &&
      t !== EVAL_SPEC_PATH &&
      t !== COLLECT_SPEC_PATH,
  );
}

describe('realdata-e2e step④ daily-test.sh step_rediscovery() run-leg jest-spawn argv 호출 계약 smoke — subshell 격리 + ordered argv(--config/--runTestsByPath) + rediscovery spec 경로 byte-identical + append(`>>"$LOG_FILE"`) + stderr 병합(`2>&1`) + exit-code → return 0/1 (T-0957)', () => {
  describe("Happy-path: 실 소스 추출 + ordered argv 계약 불변식", () => {
    it("실 deploy/daily-test.sh 를 읽어 step_rediscovery run-leg argv 를 추출하면 canonical 4-요소 ordered 벡터와 byte-identical", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv = extractRunLegJestArgv(shellSource, "step_rediscovery");
      // substring-presence 가 아니라 ordered-vector equality — flag reorder·요소 추가/누락·
      // 값 drift 를 모두 검출(본 smoke 의 새 표면).
      expect(argv).toEqual(REDISCOVERY_RUN_LEG_ARGV);
    });

    it("추출 argv 의 각 위치가 canonical 토큰과 위치별 일치하고 length === 4(flag↔value 페어링·순서)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv = extractRunLegJestArgv(shellSource, "step_rediscovery");
      expect(argv).toHaveLength(4);
      expect(argv[0]).toBe("--config");
      expect(argv[1]).toBe(SMOKE_JEST_CONFIG);
      expect(argv[2]).toBe("--runTestsByPath");
      expect(argv[3]).toBe(REDISCOVERY_SPEC_PATH);
    });

    it("--runTestsByPath value 가 T-0942 rediscovery-search-live spec 경로와 byte-identical(오타·dangling 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv = extractRunLegJestArgv(shellSource, "step_rediscovery");
      const runByPathIdx = argv.indexOf("--runTestsByPath");
      expect(runByPathIdx).toBeGreaterThanOrEqual(0);
      expect(argv[runByPathIdx + 1]).toBe(REDISCOVERY_SPEC_PATH);
    });

    it("참조 spec 경로가 실재하는 파일(fs.existsSync) — 오타·dangling 경로면 nightly 가 잘못된 jest spawn", () => {
      expect(existsSync(path.join(REPO_ROOT, REDISCOVERY_SPEC_PATH))).toBe(
        true,
      );
    });

    it("run-leg 블록이 subshell 격리 + append redirect + stderr 병합 + LOG_FILE 대상(4 계약 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const block = extractRunLegBlock(shellSource, "step_rediscovery");
      expect(runLegContract(block)).toEqual({
        subshellIsolated: true,
        appendRedirect: true,
        stderrMerged: true,
        redirectTargetIsLogFile: true,
      });
    });
  });

  describe("Happy-path: exit-code → return 0/1 분기(245~250행 if/else 동형)", () => {
    it("childExitZero=true → {log:'OK', ret:0}, false → {log:'FAIL', ret:1}", () => {
      expect(rediscoveryReturnBranch(true)).toEqual({ log: "OK", ret: 0 });
      expect(rediscoveryReturnBranch(false)).toEqual({ log: "FAIL", ret: 1 });
    });

    it("실 소스에 성공 분기(`step rediscovery: OK` + return 0)·실패 분기(`step rediscovery: FAIL` + return 1) 둘 다 존재", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const block = extractRunLegBlock(shellSource, "step_rediscovery");
      expect(block).toContain("step rediscovery: OK");
      expect(block).toMatch(/return 0/);
      expect(block).toContain("step rediscovery: FAIL");
      expect(block).toMatch(/return 1/);
    });
  });

  describe("삼형제 single-source 동형(spec 경로만 제외하고 shape-identical)", () => {
    it("rediscovery run-leg argv 의 shape(spec 경로 제외)가 eval·collect run-leg 와 identical(subshell·config flag+value·runTestsByPath flag)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const rediscoveryArgv = extractRunLegJestArgv(
        shellSource,
        "step_rediscovery",
      );
      const evalArgv = extractRunLegJestArgv(shellSource, "step_eval");
      const collectArgv = extractRunLegJestArgv(shellSource, "step_collect");

      // spec 경로만 제거한 나머지 argv shape 는 삼형제가 byte-identical.
      const rediscoveryShape = argvShapeExceptSpecPath(rediscoveryArgv);
      const evalShape = argvShapeExceptSpecPath(evalArgv);
      const collectShape = argvShapeExceptSpecPath(collectArgv);
      expect(rediscoveryShape).toEqual(evalShape);
      expect(rediscoveryShape).toEqual(collectShape);
      expect(rediscoveryShape).toEqual([
        "--config",
        SMOKE_JEST_CONFIG,
        "--runTestsByPath",
      ]);

      // spec 경로는 세 leg 이 서로 다름(단일 표면을 세 spec 으로 분기).
      expect(rediscoveryArgv[3]).toBe(REDISCOVERY_SPEC_PATH);
      expect(evalArgv[3]).toBe(EVAL_SPEC_PATH);
      expect(collectArgv[3]).toBe(COLLECT_SPEC_PATH);
      expect(rediscoveryArgv[3]).not.toBe(evalArgv[3]);
      expect(rediscoveryArgv[3]).not.toBe(collectArgv[3]);
    });

    it("세 leg 의 run-leg 블록 계약(subshell·append·stderr 병합)이 전부 동일 shape 로 true", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const legs = ["step_rediscovery", "step_eval", "step_collect"];
      legs.forEach((fn) => {
        const contract = runLegContract(extractRunLegBlock(shellSource, fn));
        expect(contract.subshellIsolated).toBe(true);
        expect(contract.appendRedirect).toBe(true);
        expect(contract.stderrMerged).toBe(true);
      });
    });
  });

  describe("Flow/branch: run-leg-만-담당 경계(함수 내부 gating 판정 0)", () => {
    it("step_rediscovery 본문에 gating 판정(realdata_eval_gating_enabled 호출)이 없다 — gating 은 caller 담당, 본 함수는 run-leg 만", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const block = extractRunLegBlock(shellSource, "step_rediscovery");
      // 함수 본문에는 gating 판정 분기가 없다(pnpm exec jest run-leg 만 담당).
      expect(block).not.toContain("realdata_eval_gating_enabled");
      // run-leg 자체(jest spawn)는 존재.
      expect(block).toContain("pnpm exec jest");
    });

    it("성공·실패 두 분기가 서로 다른 return code(exit 0→0 / 실패→1, 오배선 아님)", () => {
      expect(rediscoveryReturnBranch(true).ret).toBe(0);
      expect(rediscoveryReturnBranch(false).ret).toBe(1);
      expect(rediscoveryReturnBranch(true).ret).not.toBe(
        rediscoveryReturnBranch(false).ret,
      );
    });
  });

  describe("Error path / negative cases 충분 cover(예외 상황 분기마다 mutant 합성 → not-match)", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — step_rediscovery 함수 부재 합성 shell → 추출 빈 배열(argv 못 찾음이 silent PASS 로 미누출)", () => {
      const noFn = "#!/bin/bash\necho noop\n";
      const argv = extractRunLegJestArgv(noFn, "step_rediscovery");
      expect(argv).toEqual([]);
      // 빈 배열은 canonical 4-요소 벡터와 결코 같지 않음 → 함수 소실 시 본 smoke 가 fail.
      expect(argv).not.toEqual(REDISCOVERY_RUN_LEG_ARGV);
    });

    it("negative (a) — --runTestsByPath value 를 eval/collect spec 로 바꾼 mutant → rediscovery 계약과 not.toEqual", () => {
      // 정본은 rediscovery spec.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv = extractRunLegJestArgv(shellSource, "step_rediscovery");
      expect(argv).toEqual(REDISCOVERY_RUN_LEG_ARGV);

      // mutant(사본): spec value 를 eval spec 으로 교체(잘못된 live smoke spawn 회귀).
      const evalMutant = [...argv];
      evalMutant[3] = EVAL_SPEC_PATH;
      expect(evalMutant).not.toEqual(REDISCOVERY_RUN_LEG_ARGV);

      // collect spec 으로 교체한 사본도 rediscovery 계약과 다름.
      const collectMutant = [...argv];
      collectMutant[3] = COLLECT_SPEC_PATH;
      expect(collectMutant).not.toEqual(REDISCOVERY_RUN_LEG_ARGV);

      // 원본 argv 는 mutate 0 — 여전히 canonical 과 byte-identical.
      expect(argv).toEqual(REDISCOVERY_RUN_LEG_ARGV);
    });

    it("negative (b) — --config / --runTestsByPath 순서 뒤집힌 mutant → not.toEqual(순서 민감)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv = extractRunLegJestArgv(shellSource, "step_rediscovery");
      // flag↔value 페어 순서 swap([0..1] ↔ [2..3]) — substring 이면 PASS 했을 케이스.
      const swapped = [argv[2], argv[3], argv[0], argv[1]];
      expect(swapped).toContain("--config");
      expect(swapped).toContain("--runTestsByPath");
      expect(swapped).not.toEqual(REDISCOVERY_RUN_LEG_ARGV);
    });

    it("negative (c) — --runTestsByPath flag 누락 mutant → argv 가 계약 벡터와 not.toEqual", () => {
      const missingFlag = [
        "#!/bin/bash",
        "step_rediscovery() {",
        '  if ( cd "$REPO_DIR" && pnpm exec jest \\',
        '        --config ./test/jest-smoke.json ) >>"$LOG_FILE" 2>&1; then',
        "    return 0",
        "  fi",
        "  return 1",
        "}",
      ].join("\n");
      const argv = extractRunLegJestArgv(missingFlag, "step_rediscovery");
      expect(argv).not.toEqual(REDISCOVERY_RUN_LEG_ARGV);
      expect(argv).not.toContain("--runTestsByPath");
    });

    it("negative (d) — append `>>` 를 overwrite `>` 로 바꾼 mutant → appendRedirect 계약 위반 검출", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const block = extractRunLegBlock(shellSource, "step_rediscovery");
      // 정본: append true.
      expect(runLegContract(block).appendRedirect).toBe(true);
      // mutant(사본): `>>"$LOG_FILE"` → `>"$LOG_FILE"`(진행 로그 덮어쓰기 회귀).
      const truncateMutant = block.replace('>>"$LOG_FILE"', '>"$LOG_FILE"');
      expect(runLegContract(truncateMutant).appendRedirect).toBe(false);
      // 실 소스 블록은 `>>"$LOG_FILE"`(append) 이고 `>"$LOG_FILE"`(truncate) 아님.
      expect(block).toContain('>>"$LOG_FILE"');
      expect(block).not.toMatch(/[^>]>"\$LOG_FILE"/);
    });

    it("negative (e) — `2>&1` 누락 mutant → stderrMerged 계약 위반 검출", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const block = extractRunLegBlock(shellSource, "step_rediscovery");
      // 정본: stderr 병합 true.
      expect(runLegContract(block).stderrMerged).toBe(true);
      // mutant(사본): ` 2>&1` 제거(자식 stderr 유실/오염 회귀).
      const noMergeMutant = block.replace(" 2>&1", "");
      expect(runLegContract(noMergeMutant).stderrMerged).toBe(false);
      // 실 소스 블록은 `2>&1` 포함.
      expect(block).toContain("2>&1");
    });
  });

  describe("§9 secret-safety(REQ-059) — argv 에 credential 실값 0", () => {
    it("추출 argv·run-leg 블록 어디에도 gh 토큰 어휘·credential 실값 미surface(spec 경로 + config flag 만)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv = extractRunLegJestArgv(shellSource, "step_rediscovery");
      const block = extractRunLegBlock(shellSource, "step_rediscovery");
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|\bsk-)/i;

      // argv 는 spec 경로 + config flag 만 — credential 실값 0.
      expect(credentialPattern.test(argv.join(" "))).toBe(false);
      expect(argv).toEqual([
        "--config",
        SMOKE_JEST_CONFIG,
        "--runTestsByPath",
        REDISCOVERY_SPEC_PATH,
      ]);
      // run-leg 블록에도 credential 어휘 미등장(gating credential 은 caller/env, 본 leg argv 밖).
      expect(credentialPattern.test(block)).toBe(false);
    });
  });

  describe("결정론 · no-mutation · non-gated 확인", () => {
    it("동일 shell 소스로 두 번 추출 → deep-equal(결정론)이고 입력 문자열 mutate 0", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv1 = extractRunLegJestArgv(shellSource, "step_rediscovery");
      const argv2 = extractRunLegJestArgv(shellSource, "step_rediscovery");
      expect(argv1).toEqual(argv2);

      const snapshot = shellSource;
      extractRunLegJestArgv(shellSource, "step_rediscovery");
      extractRunLegBlock(shellSource, "step_rediscovery");
      expect(shellSource).toBe(snapshot);
    });

    it("추출·계약 함수가 process.env 를 참조하지 않음(파라미터로만 — non-gated, describe.skip 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const envSnapshot = { ...process.env };
      const before = extractRunLegJestArgv(shellSource, "step_rediscovery");
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 참조 0.
      Object.assign(process.env, { REPO_DIR: "/tmp/evil" });
      const after = extractRunLegJestArgv(shellSource, "step_rediscovery");
      delete process.env.REPO_DIR;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 jest spawn/gh/git 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(shellSource).toContain("step_rediscovery()");
      expect(shellSource).toContain("pnpm exec jest");
    });
  });
});
