// realdata-e2e-daily-test-step-redeploy-invocation-repo-dir-env-thread-log-redirect-append-stdout-purity-return-code-contract.smoke-spec.ts
// — 실 평가 e2e nightly runner `deploy/daily-test.sh` 의 **step_redeploy() 재배포 서브스크립트 호출 계약**을
// 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke
// (T-0955, PLAN.md §109 step① 실 평가 e2e — nightly 첫 관문 redeploy 서브스크립트 호출 배선).
//
// 봉함 불변식: **step_redeploy 는 REPO_DIR 을 env 로 threading 한 채(`REPO_DIR="$REPO_DIR"`)
// `$REPO_DIR/deploy/redeploy.sh` 를 bash 로 호출하고 자식의 stdout+stderr 를 append(`>>`)로 LOG_FILE 에
// 병합(`2>&1`)해 스크립트 stdout 순수성(387행 cat 유일 bare-emitter)을 유지하며 자식 exit code 로
// return 0(OK)/return 1(FAIL) 을 반환하되 시작·성공·실패 진단을 log()(stderr+file)로만 방출한다.**
// 계약 6종(실 소스 유도 앵커 — 71행 호출 라인 중심):
//   (a) REPO_DIR env-prefix threading(`REPO_DIR="$REPO_DIR"` — 자식이 부모와 동일 체크아웃 인식) ·
//   (b) bash interpreter + REPO_DIR-relative 경로(`bash "$REPO_DIR/deploy/redeploy.sh"` — exec bit 무관) ·
//   (c) append redirect + stderr 병합(`>>"$LOG_FILE" 2>&1` — truncate 아닌 append 로 진행 로그 보존) ·
//   (d) stdout 순수성 보증(자식 출력이 LOG_FILE 로 가고 스크립트 bare-stdout 으로 안 샘 — 유일 emitter 387행 cat) ·
//   (e) exit-code → return 분기(성공 exit 0 → `log OK; return 0`, 실패 non-zero → `log FAIL; return 1`) ·
//   (f) 진단 log() 라우팅(70·72·75행 "step redeploy: 실행/OK/FAIL" 이 log() 경유 stderr+file, bare-stdout 아님).
//
// 전략(T-0953 log·T-0954 curl_code 동형): step_redeploy 유도 표현을 정적 앵커로 추출 + bash 호출 배선 semantics
// 를 TS 순수 함수(`buildRedeployInvocation`·`redeployInvocationContract`·`redeployReturnBranch`)로 동형 모델링해
// REPO_DIR-threading·bash-호출·append-redirect·stderr-병합·stdout-순수성·exit-code-분기 불변식 assert.
// T-0953(log() 진행 로그 라우팅 — redeploy 호출 제외)·T-0954(curl_code HTTP status 헬퍼 — redeploy 무관)·
// T-0947(cascade downstream — 내부 호출 배선 아님)·redeploy-orchestration(redeploy.sh 자신 entrypoint) 와
// distinct surface(step_redeploy 의 *호출 측* 배선).
//   🔥 실 redeploy/bash/배포/gh/git 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// step_redeploy 호출 정본 라인(71행) — 실 bash 표현의 TS mirror(실 bash/redeploy 실행 0).
const REDEPLOY_INVOCATION_LINE = `if REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1; then`;
// 유일 bare-stdout emitter 정본 라인(387행) — step_redeploy 출력이 이리로 새지 않음의 대조점.
const CAT_EMITTER_LINE = `cat "$RESULT_JSON"`;

// ── TS 동형 pure 함수(정본) — daily-test.sh step_redeploy()(69~77행) 호출 배선을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 bash/redeploy/stream redirect/env 읽기 0 — 입력은 파라미터.

// 재배포 호출 구조(71행 배선의 구조 분해).
interface RedeployInvocation {
  envPrefix: { REPO_DIR: string }; // `REPO_DIR="$REPO_DIR"` env-prefix threading.
  interpreter: string; // `bash` — exec bit 무관 인터프리터 호출.
  script: string; // `${repoDir}/deploy/redeploy.sh` — repoDir-relative 경로.
  redirect: {
    target: string; // `$LOG_FILE` — 자식 출력이 향하는 로그 파일.
    mode: "append" | "truncate"; // `>>`(append) vs `>`(truncate).
    stderrToStdout: boolean; // `2>&1` — stderr 를 stdout 으로 병합.
  };
}

// (a)(b)(c) buildRedeployInvocation(repoDir, logFile): 71행 호출 배선 동형 —
//     REPO_DIR 을 env 로 threading + bash 인터프리터 + repoDir-relative 스크립트 경로 +
//     append redirect + stderr 병합. 실 redeploy 실행 0(입력은 파라미터).
function buildRedeployInvocation(
  repoDir: string,
  logFile: string,
): RedeployInvocation {
  return {
    envPrefix: { REPO_DIR: repoDir },
    interpreter: "bash",
    script: `${repoDir}/deploy/redeploy.sh`,
    redirect: { target: logFile, mode: "append", stderrToStdout: true },
  };
}

// 71행 호출 라인 파싱 결과 — 각 계약 요소의 분리 boolean.
interface RedeployContract {
  repoDirEnvThreaded: boolean; // `REPO_DIR="$REPO_DIR"` env-prefix 존재.
  bashInterpreter: boolean; // `bash` 인터프리터 호출.
  scriptPathRepoDirRelative: boolean; // `"$REPO_DIR/deploy/redeploy.sh"` repoDir-relative.
  appendRedirect: boolean; // `>>`(append) — `>`(truncate) 아님.
  stderrMerged: boolean; // `2>&1` — stderr → stdout 병합.
  redirectTargetIsLogFile: boolean; // redirect 대상이 `$LOG_FILE`.
  noBareStdout: boolean; // redirect 존재로 자식 출력이 bare-stdout 으로 안 샘.
}

// (a)(b)(c)(d) redeployInvocationContract(invocationLine): 71행 호출 라인을 파싱해 계약 요소 분리 판정 —
//     env-prefix / bash / repoDir-relative 경로 / append(`>>`) / stderr 병합(`2>&1`) / LOG_FILE 대상 /
//     redirect 존재로 stdout 순수성 보증. `>>` 존재 시 append true(없으면 truncate false).
function redeployInvocationContract(invocationLine: string): RedeployContract {
  const hasEnvPrefix = /REPO_DIR="\$REPO_DIR"\s/.test(invocationLine); // env-prefix threading.
  const hasBash = /\bbash\s/.test(invocationLine); // bash 인터프리터.
  const hasRepoDirScript = invocationLine.includes(
    '"$REPO_DIR/deploy/redeploy.sh"',
  ); // repoDir-relative 스크립트.
  const hasAppend = invocationLine.includes('>>"$LOG_FILE"'); // append redirect(`>>`).
  const hasStderrMerge = invocationLine.includes("2>&1"); // stderr → stdout 병합.
  return {
    repoDirEnvThreaded: hasEnvPrefix,
    bashInterpreter: hasBash,
    scriptPathRepoDirRelative: hasRepoDirScript,
    appendRedirect: hasAppend,
    stderrMerged: hasStderrMerge,
    redirectTargetIsLogFile: invocationLine.includes('"$LOG_FILE"'),
    // append redirect + stderr 병합이 있으면 자식 출력이 LOG_FILE 로 가고
    // 스크립트 bare-stdout 으로 새지 않는다(redirect 부재 시 stdout 오염).
    noBareStdout: hasAppend && hasStderrMerge,
  };
}

// (e) redeployReturnBranch(childExitZero): 72~76행 if/else 동형 —
//     자식 exit code 로 분기. 성공(exit 0) → `log OK; return 0`, 실패(non-zero) → `log FAIL; return 1`.
function redeployReturnBranch(childExitZero: boolean): {
  log: "OK" | "FAIL";
  ret: 0 | 1;
} {
  return childExitZero ? { log: "OK", ret: 0 } : { log: "FAIL", ret: 1 };
}

// ── 정적 앵커 추출 보조 함수 (실 bash step_redeploy 배선이 소스에 실재하는지) ──────────────

// step_redeploy() 함수 정의 앵커(69행) — `step_redeploy() {`.
function hasStepRedeployFnAnchor(shellSource: string): boolean {
  return shellSource.includes("step_redeploy() {");
}

// 71행 호출 라인 앵커 — REPO_DIR env-prefix + bash + repoDir-relative 경로 + append + stderr 병합 전체.
function hasRedeployInvocationAnchor(shellSource: string): boolean {
  return shellSource.includes(REDEPLOY_INVOCATION_LINE);
}

// 시작 진단 앵커(70행) — `log "step redeploy: deploy/redeploy.sh 실행"`.
function hasStartDiagnosticAnchor(shellSource: string): boolean {
  return shellSource.includes('log "step redeploy: deploy/redeploy.sh 실행"');
}

// 성공 분기 앵커(72~73행) — `log "step redeploy: OK"` + `return 0`.
function hasSuccessBranchAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('log "step redeploy: OK"') &&
    /return 0/.test(shellSource)
  );
}

// 실패 분기 앵커(75~76행) — `log "step redeploy: FAIL ..."` + `return 1`.
function hasFailBranchAnchor(shellSource: string): boolean {
  return (
    shellSource.includes('log "step redeploy: FAIL') &&
    /return 1/.test(shellSource)
  );
}

// 71행 호출 라인을 소스에서 추출 — `bash "$REPO_DIR/deploy/redeploy.sh"` 를 포함하는 라인.
function extractRedeployInvocationLine(shellSource: string): string {
  return (
    shellSource
      .replace(/\r\n/g, "\n")
      .split("\n")
      .find((l) => l.includes('bash "$REPO_DIR/deploy/redeploy.sh"')) ?? ""
  );
}

// 6종 step_redeploy 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractRedeployAnchors(shellSource: string): {
  fnDef: boolean;
  invocation: boolean;
  startDiagnostic: boolean;
  successBranch: boolean;
  failBranch: boolean;
  catEmitter: boolean;
} {
  return {
    fnDef: hasStepRedeployFnAnchor(shellSource),
    invocation: hasRedeployInvocationAnchor(shellSource),
    startDiagnostic: hasStartDiagnosticAnchor(shellSource),
    successBranch: hasSuccessBranchAnchor(shellSource),
    failBranch: hasFailBranchAnchor(shellSource),
    catEmitter: shellSource.includes(CAT_EMITTER_LINE),
  };
}

describe('realdata-e2e step① daily-test.sh step_redeploy() 재배포 서브스크립트 호출 계약 smoke — REPO_DIR env-threading + bash 호출 + append-redirect(`>>"$LOG_FILE"`) + stderr 병합(`2>&1`) + stdout 순수성 + exit-code → return 0/1 (T-0955)', () => {
  describe("Happy-path: step_redeploy 앵커 정적 추출(pure 함수가 실 bash 배선을 mirror)", () => {
    it("step_redeploy() 정의(69)·호출 라인(71)·시작 진단(70)·성공 분기(72~73)·실패 분기(75~76)·유일 cat emitter(387)가 실 소스에 존재(6 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractRedeployAnchors(shellSource);
      expect(anchors.fnDef).toBe(true);
      expect(anchors.invocation).toBe(true);
      expect(anchors.startDiagnostic).toBe(true);
      expect(anchors.successBranch).toBe(true);
      expect(anchors.failBranch).toBe(true);
      expect(anchors.catEmitter).toBe(true);
    });
  });

  describe("Happy-path: buildRedeployInvocation(repoDir, logFile) — env-threading + bash + repoDir-relative + append 병합", () => {
    it("정본 배선(71행 동형) 반환 — 여러 (repoDir, logFile) 조합으로 REPO_DIR env-threading·repoDir-relative 경로·append+병합 실증", () => {
      expect(
        buildRedeployInvocation("/opt/assessment-agent", "/var/log/daily.log"),
      ).toEqual({
        envPrefix: { REPO_DIR: "/opt/assessment-agent" },
        interpreter: "bash",
        script: "/opt/assessment-agent/deploy/redeploy.sh",
        redirect: {
          target: "/var/log/daily.log",
          mode: "append",
          stderrToStdout: true,
        },
      });
      // 다른 조합 — script 경로가 repoDir-relative 로 재구성, env 로 threading.
      const inv = buildRedeployInvocation("/home/ci/repo", "/tmp/x.log");
      expect(inv.envPrefix.REPO_DIR).toBe("/home/ci/repo");
      expect(inv.script).toBe("/home/ci/repo/deploy/redeploy.sh");
      expect(inv.interpreter).toBe("bash");
      expect(inv.redirect.mode).toBe("append");
      expect(inv.redirect.stderrToStdout).toBe(true);
      expect(inv.redirect.target).toBe("/tmp/x.log");
    });
  });

  describe("Happy-path: redeployInvocationContract — env-threading·bash·append·stderr-병합", () => {
    it("정본 71행 라인 → 7 계약 요소 전부 true(REPO_DIR prefix + bash + repoDir-relative + `>>` + `2>&1` + LOG_FILE + noBareStdout)", () => {
      const contract = redeployInvocationContract(REDEPLOY_INVOCATION_LINE);
      expect(contract).toEqual({
        repoDirEnvThreaded: true,
        bashInterpreter: true,
        scriptPathRepoDirRelative: true,
        appendRedirect: true,
        stderrMerged: true,
        redirectTargetIsLogFile: true,
        noBareStdout: true,
      });
    });

    it("실 소스에서 추출한 호출 라인도 동일 판정 — 각 계약 요소 분리 실증", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const line = extractRedeployInvocationLine(shellSource);
      expect(line).not.toBe("");
      const contract = redeployInvocationContract(line);
      expect(contract.repoDirEnvThreaded).toBe(true);
      expect(contract.bashInterpreter).toBe(true);
      expect(contract.scriptPathRepoDirRelative).toBe(true);
      expect(contract.appendRedirect).toBe(true);
      expect(contract.stderrMerged).toBe(true);
      expect(contract.redirectTargetIsLogFile).toBe(true);
      expect(contract.noBareStdout).toBe(true);
    });
  });

  describe("Happy-path: redeployReturnBranch — exit-code → return 0/1", () => {
    it("childExitZero=true → {log:'OK', ret:0}, false → {log:'FAIL', ret:1}(72~76행 if/else 동형)", () => {
      expect(redeployReturnBranch(true)).toEqual({ log: "OK", ret: 0 });
      expect(redeployReturnBranch(false)).toEqual({ log: "FAIL", ret: 1 });
    });
  });

  describe("branch: append(`>>`) vs truncate(`>`) 정적 대조", () => {
    it('정본은 `>>"$LOG_FILE"`(appendRedirect=true), `>>` → `>` mutant 은 false — 두 입력으로 분리 실증(진행 로그 보존)', () => {
      // 정본: append true.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).appendRedirect,
      ).toBe(true);
      // mutant(모델 사본): `>>"$LOG_FILE"` → `>"$LOG_FILE"`(truncate — 앞선 진행 로그 소실 회귀).
      const truncateMutant = REDEPLOY_INVOCATION_LINE.replace(
        '>>"$LOG_FILE"',
        '>"$LOG_FILE"',
      );
      expect(redeployInvocationContract(truncateMutant).appendRedirect).toBe(
        false,
      );
      // 실 소스 호출 라인이 `>>"$LOG_FILE"`(append) 이고 `>"$LOG_FILE"`(truncate) 아님.
      const line = extractRedeployInvocationLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain('>>"$LOG_FILE"');
      expect(line).not.toMatch(/[^>]>"\$LOG_FILE"/);
    });
  });

  describe("branch: stderr 병합(`2>&1`) 존재 vs 부재 정적 대조", () => {
    it("정본은 `2>&1`(stderrMerged=true), `2>&1` 제거 mutant 은 false — 두 입력으로 분리 실증(자식 stderr 도 LOG_FILE 로)", () => {
      // 정본: stderr 병합 true.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).stderrMerged,
      ).toBe(true);
      // mutant(모델 사본): ` 2>&1` 제거(자식 stderr 유실/오염 회귀).
      const noMergeMutant = REDEPLOY_INVOCATION_LINE.replace(" 2>&1", "");
      expect(redeployInvocationContract(noMergeMutant).stderrMerged).toBe(
        false,
      );
      // 실 소스 호출 라인이 `2>&1` 를 포함.
      const line = extractRedeployInvocationLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain("2>&1");
    });
  });

  describe("branch: REPO_DIR env-prefix 존재 vs 부재 정적 대조", () => {
    it('정본은 `REPO_DIR="$REPO_DIR"` prefix(repoDirEnvThreaded=true), prefix 제거 mutant 은 false — 두 입력으로 분리 실증(자식이 부모 체크아웃 인식)', () => {
      // 정본: env-threading true.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).repoDirEnvThreaded,
      ).toBe(true);
      // mutant(모델 사본): `REPO_DIR="$REPO_DIR" ` prefix 제거(자식이 다른 체크아웃 재배포 drift).
      const noPrefixMutant = REDEPLOY_INVOCATION_LINE.replace(
        'REPO_DIR="$REPO_DIR" ',
        "",
      );
      expect(
        redeployInvocationContract(noPrefixMutant).repoDirEnvThreaded,
      ).toBe(false);
      // 실 소스 호출 라인이 `REPO_DIR="$REPO_DIR"` prefix 로 배선.
      const line = extractRedeployInvocationLine(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(line).toContain('REPO_DIR="$REPO_DIR"');
    });
  });

  describe("branch: 성공/실패 return 분기", () => {
    it("redeployReturnBranch(true) → ret=0, (false) → ret=1 — 두 분기가 서로 다른 값(exit 0↔return 1 오배선 아님)", () => {
      expect(redeployReturnBranch(true).ret).toBe(0);
      expect(redeployReturnBranch(false).ret).toBe(1);
      expect(redeployReturnBranch(true).ret).not.toBe(
        redeployReturnBranch(false).ret,
      );
      expect(redeployReturnBranch(true).log).toBe("OK");
      expect(redeployReturnBranch(false).log).toBe("FAIL");
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — step_redeploy 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(step_redeploy 유도 표현 부재).
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractRedeployAnchors(emptySource);
      expect(anchors.fnDef).toBe(false);
      expect(anchors.invocation).toBe(false);
      expect(anchors.startDiagnostic).toBe(false);
      expect(anchors.successBranch).toBe(false);
      expect(anchors.failBranch).toBe(false);
      expect(anchors.catEmitter).toBe(false);
      // 호출 라인 추출도 빈 결과(성공-위장 0).
      expect(extractRedeployInvocationLine(emptySource)).toBe("");
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractRedeployAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.fnDef).toBe(true);
      expect(realAnchors.invocation).toBe(true);
      expect(realAnchors.startDiagnostic).toBe(true);
      expect(realAnchors.successBranch).toBe(true);
      expect(realAnchors.failBranch).toBe(true);
      expect(realAnchors.catEmitter).toBe(true);
    });

    it("negative (a) — REPO_DIR env-threading 제거 drift 변별: prefix 제거 사본에서 'repoDirEnvThreaded' assert 실패", () => {
      // 정본: env-threading true.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).repoDirEnvThreaded,
      ).toBe(true);
      // mutant(모델 사본): env-prefix 제거(자식이 다른 체크아웃 재배포 silent drift).
      const mutant = REDEPLOY_INVOCATION_LINE.replace(
        'REPO_DIR="$REPO_DIR" ',
        "",
      );
      expect(redeployInvocationContract(mutant).repoDirEnvThreaded).toBe(false);
      expect(redeployInvocationContract(mutant).repoDirEnvThreaded).not.toBe(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).repoDirEnvThreaded,
      );
      // 원본 문자열/함수 불변(replace 는 사본 반환).
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).repoDirEnvThreaded,
      ).toBe(true);
    });

    it("negative (b) — append → truncate drift 변별: `>>` → `>` 사본에서 'appendRedirect' assert 실패", () => {
      // 정본: append true.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).appendRedirect,
      ).toBe(true);
      // mutant(모델 사본): `>>"$LOG_FILE"` → `>"$LOG_FILE"`(truncate — 진행 로그 덮어쓰기 회귀).
      const mutant = REDEPLOY_INVOCATION_LINE.replace(
        '>>"$LOG_FILE"',
        '>"$LOG_FILE"',
      );
      expect(redeployInvocationContract(mutant).appendRedirect).toBe(false);
      expect(redeployInvocationContract(mutant).appendRedirect).not.toBe(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).appendRedirect,
      );
      // 원본 불변.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).appendRedirect,
      ).toBe(true);
    });

    it("negative (c) — stderr 병합 제거 drift 변별: `2>&1` 제거 사본에서 'stderrMerged' assert 실패", () => {
      // 정본: stderr 병합 true.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).stderrMerged,
      ).toBe(true);
      // mutant(모델 사본): ` 2>&1` 제거(자식 stderr 유실/오염 회귀).
      const mutant = REDEPLOY_INVOCATION_LINE.replace(" 2>&1", "");
      expect(redeployInvocationContract(mutant).stderrMerged).toBe(false);
      expect(redeployInvocationContract(mutant).stderrMerged).not.toBe(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).stderrMerged,
      );
      // 원본 불변.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).stderrMerged,
      ).toBe(true);
    });

    it("negative (d) — redirect 전체 제거 → stdout 오염 drift 변별: `>>\"$LOG_FILE\" 2>&1` 제거 사본에서 'noBareStdout' assert 실패", () => {
      // 정본: noBareStdout true(자식 출력이 LOG_FILE 로 가고 bare-stdout 으로 안 샘).
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).noBareStdout,
      ).toBe(true);
      // mutant(모델 사본): redirect 전체 제거(redeploy 출력이 스크립트 bare-stdout 으로 새어 JSON 파싱 붕괴 회귀).
      const mutant = REDEPLOY_INVOCATION_LINE.replace(
        ' >>"$LOG_FILE" 2>&1',
        "",
      );
      expect(redeployInvocationContract(mutant).noBareStdout).toBe(false);
      expect(redeployInvocationContract(mutant).noBareStdout).not.toBe(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).noBareStdout,
      );
      // 원본 불변.
      expect(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE).noBareStdout,
      ).toBe(true);
    });

    it("negative (e) — exit-code 분기 반전 drift 변별: exit 0→ret 1, 실패→ret 0 반전 사본에서 '성공→0/실패→1' assert 실패", () => {
      // 정본: 성공→0 / 실패→1.
      expect(redeployReturnBranch(true).ret).toBe(0);
      expect(redeployReturnBranch(false).ret).toBe(1);
      // mutant(모델 사본): 반전 배선(false green/false red 회귀).
      const invertedReturnBranch = (childExitZero: boolean): { ret: 0 | 1 } =>
        childExitZero ? { ret: 1 } : { ret: 0 };
      expect(invertedReturnBranch(true).ret).toBe(1);
      expect(invertedReturnBranch(false).ret).toBe(0);
      expect(invertedReturnBranch(true).ret).not.toBe(
        redeployReturnBranch(true).ret,
      );
      // 원본 함수 불변.
      expect(redeployReturnBranch(true).ret).toBe(0);
      expect(redeployReturnBranch(false).ret).toBe(1);
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열(앵커·buildRedeployInvocation·contract·return 분기)에 gh 토큰 어휘·credential 실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const synthesized = [
        JSON.stringify(
          buildRedeployInvocation("/opt/assessment-agent", "/var/log/x.log"),
        ),
        JSON.stringify(redeployInvocationContract(REDEPLOY_INVOCATION_LINE)),
        JSON.stringify(extractRedeployAnchors(shellSource)),
        extractRedeployInvocationLine(shellSource),
        JSON.stringify(redeployReturnBranch(true)),
        JSON.stringify(redeployReturnBranch(false)),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // `REPO_DIR="$REPO_DIR"` 는 변수 참조 토큰이지 실 경로값이 아님 — 실 배포 secret 미포함.
      const line = extractRedeployInvocationLine(shellSource);
      expect(line).toContain('REPO_DIR="$REPO_DIR"'); // 변수 참조.
      expect(line).not.toMatch(credentialPattern);
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(repoDir·logFile·호출 라인·shell 소스)으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(buildRedeployInvocation("/opt/aa", "/l.log")).toEqual(
        buildRedeployInvocation("/opt/aa", "/l.log"),
      );
      expect(redeployInvocationContract(REDEPLOY_INVOCATION_LINE)).toEqual(
        redeployInvocationContract(REDEPLOY_INVOCATION_LINE),
      );
      expect(redeployReturnBranch(true)).toEqual(redeployReturnBranch(true));
      expect(extractRedeployAnchors(shellSource)).toEqual(
        extractRedeployAnchors(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(shell 소스·호출 라인)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractRedeployAnchors(shellSource);
      extractRedeployInvocationLine(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const lineSnapshot = REDEPLOY_INVOCATION_LINE;
      redeployInvocationContract(REDEPLOY_INVOCATION_LINE);
      expect(REDEPLOY_INVOCATION_LINE).toBe(lineSnapshot);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("호출 배선 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = redeployInvocationContract(REDEPLOY_INVOCATION_LINE);
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { REPO_DIR: "/tmp/evil" });
      const after = redeployInvocationContract(REDEPLOY_INVOCATION_LINE);
      delete process.env.REPO_DIR;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 redeploy/bash/git 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasStepRedeployFnAnchor(shellSource)).toBe(true);
      expect(hasRedeployInvocationAnchor(shellSource)).toBe(true);
    });
  });
});
