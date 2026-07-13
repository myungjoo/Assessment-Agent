// realdata-e2e-daily-test-machine-result-json-dual-sink-file-stdout-cat-single-source-emission-convergence.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 가 내보내는 머신 요약 JSON 의
// **dual-sink(file+stdout) single-source 방출 contract** 를 실 shell 파일을 readFileSync 로
// 읽어(실행/source 0) 정적 검증하는 non-gated build-time smoke (T-0945, PLAN.md 109행
// 🟢 실 평가 e2e step④).
//
// gap: PLAN 109행 step④·`deploy/daily-test.sh` 헤더(25행 주석: "머신 요약 JSON →
// deploy/logs/latest-result.json + stdout (루틴이 파싱)")는 머신 요약 JSON 을 파일과 stdout
// **두 sink** 로 내보내고 로컬 무인 모니터링 routine 이 stdout JSON 을 파싱함을 명시한다.
// 여기엔 조용한 불변식이 있다 — 두 sink 는 항상 동일 JSON 이어야 한다. 실 shell 은 이를
// **single write source** 로 보장한다: (a) 정확히 1개의 6-키 printf 템플릿(375~378행)이
// `>"$RESULT_JSON"` 로 파일에 overwrite(`>`) 1회 기록, (b) stdout 방출(387행 `cat "$RESULT_JSON"`)은
// 그 동일 파일을 재-읽기 할 뿐 독립 second printf 가 아님. 즉 stdout 은 파일의 byte-identical 복제다.
// 이 **방출-경로 single-source** 표면은 origin/main 검증 0 부재였다 — T-0791 parity-drift 는
// printf 템플릿의 6-키 스키마/order/failedStep 직렬화 형식만, T-0944 는 result/failedStep 집계
// 값 semantics 만 봉했고 **어떻게 방출되는가**(파일 write 1회 + stdout=그 파일 cat)는 미cover.
// 본 spec 이 그 상보적 표면을 닫는다.
//
// 전략(T-0791/T-0944 동형): daily-test.sh 를 readFileSync 로 읽어 머신-JSON printf 방출 표현식·
// `RESULT_JSON`/`LOG_DIR` 정의·`cat "$RESULT_JSON"` stdout 방출을 정적 앵커로 추출하고,
// dual-sink single-source contract(printf 발생==1·overwrite redirect·stdout cat 인자==printf
// redirect 대상 동일 변수·경로==deploy/logs/latest-result.json)를 assert. mutant 는 원본을
// 복제 후 치환해 본 smoke 가 drift 를 실제로 잡음을 실증(원본 문자열 mutate 0).
//   🔥 실 redeploy/HTTP/jest spawn/gh/git 0 — 파일 read + 정적 텍스트 추출 + 합성 mutant 만.
//   🔥 gating 분기 0 — non-gated 항상 실행(describe.skip 0). credential 0(§9/REQ-059).
//   🔥 새 외부 dependency 0(node 내장 fs/path). src 변경 0(test-only). daily-test.sh 읽기만.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// 머신 요약 JSON 파일 sink 정본 basename(무인 모니터링이 읽는 경로 고정, 53행).
const EXPECTED_RESULT_BASENAME = "latest-result.json";
// LOG_DIR 정본 상대 경로(50행 `LOG_DIR="$REPO_DIR/deploy/logs"`).
const EXPECTED_LOG_DIR_SUFFIX = "deploy/logs";

// 6-키 머신-JSON printf 템플릿(375행)을 소스 전체에서 발생 횟수만큼 매칭한다.
// 템플릿: `printf '{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,"steps":%s,"logPath":"%s"}\n'`.
// 값 조립용 내부 printf(`printf '"%s"'`, 377행)나 진행 로그 printf 는 6-키 `{"ts":"%s"` 로
// 시작하지 않으므로 본 카운트에 걸리지 않는다(방출 단일 source 만 계량).
const MACHINE_JSON_PRINTF_RE = /printf\s+'\{"ts":"%s".*?\}\\n'/g;

// 머신-JSON printf 가 소스에 몇 번 등장하는지 센다(방출 write source 개수).
function countMachineJsonPrintf(source: string): number {
  const m = source.match(MACHINE_JSON_PRINTF_RE);
  return m ? m.length : 0;
}

// 머신-JSON printf 문(375~378행)을 line-continuation(`\`) 을 따라 재조립해 반환한다.
// redirect(`>"$RESULT_JSON"`)가 마지막 continuation 줄(378행)에 있으므로 문 전체를 잡아야
// redirect 를 정적 추출할 수 있다. 앵커 부재 시 빈 문자열 반환(호출측 단언이 실패 담당).
function extractMachineJsonPrintfStatement(source: string): string {
  const lines = source.split("\n");
  const startIdx = lines.findIndex((l) => /printf\s+'\{"ts":"%s"/.test(l));
  if (startIdx === -1) {
    return "";
  }
  const collected: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    collected.push(lines[i]);
    // continuation(`\`)이 없는 첫 줄에서 문 종료.
    if (!lines[i].trimEnd().endsWith("\\")) {
      break;
    }
  }
  return collected.join("\n");
}

// printf 문에서 파일 sink redirect 를 추출한다 — `>"$VAR"`(overwrite) / `>>"$VAR"`(append).
// operator(`>` | `>>`)와 대상 변수(`$RESULT_JSON`)를 분리 반환. 앵커 부재 시 null.
function extractRedirect(
  printfStatement: string,
): { operator: string; target: string } | null {
  const m = printfStatement.match(/(>>?)\s*"(\$[A-Z_][A-Z0-9_]*)"/);
  if (!m) {
    return null;
  }
  return { operator: m[1], target: m[2] };
}

// stdout 방출(387행) `cat "$VAR"` 의 대상 변수를 추출한다(독립 printf 가 아니라 재-읽기 인자).
// 앵커 부재 시 null(호출측 단언이 명시적 실패 담당).
function extractStdoutCatTarget(source: string): string | null {
  const m = source.match(/cat\s+"(\$[A-Z_][A-Z0-9_]*)"/);
  if (!m) {
    return null;
  }
  return m[1];
}

// `RESULT_JSON="$LOG_DIR/latest-result.json"`(53행) 정의에서 우변을 추출한다. 부재 시 null.
function extractResultJsonDef(source: string): string | null {
  const m = source.match(/^RESULT_JSON="([^"]*)"/m);
  return m ? m[1] : null;
}

// `LOG_DIR="$REPO_DIR/deploy/logs"`(50행) 정의에서 우변을 추출한다. 부재 시 null.
function extractLogDirDef(source: string): string | null {
  const m = source.match(/^LOG_DIR="([^"]*)"/m);
  return m ? m[1] : null;
}

describe("realdata-e2e step④ daily-test.sh 머신 요약 JSON dual-sink single-source 방출 contract smoke — printf 단일·overwrite·stdout=cat 재읽기 (T-0945)", () => {
  describe("Happy-path: 머신-JSON printf 는 정확히 1회 방출(single write source)", () => {
    it("실 deploy/daily-test.sh 를 읽어 6-키 머신-JSON printf 가 파일 전체에 정확히 1회 등장(복제 printf 0 · 방출 0 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(countMachineJsonPrintf(shellSource)).toBe(1);
    });

    it('파일 sink 는 overwrite redirect(`>"$RESULT_JSON"`) — append(`>>`) 아님', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const stmt = extractMachineJsonPrintfStatement(shellSource);
      const redirect = extractRedirect(stmt);
      // 앵커가 실재해야 함(빈 결과 성공-위장 0).
      expect(redirect).not.toBeNull();
      expect(redirect?.operator).toBe(">");
      expect(redirect?.operator).not.toBe(">>");
      expect(redirect?.target).toBe("$RESULT_JSON");
    });

    it("stdout 방출은 동일 파일 cat 재-읽기 — cat 인자 == printf redirect 대상 변수, stdout 방출부에 독립 6-키 printf 없음", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const redirect = extractRedirect(
        extractMachineJsonPrintfStatement(shellSource),
      );
      const catTarget = extractStdoutCatTarget(shellSource);
      // cat 앵커 실재.
      expect(catTarget).not.toBeNull();
      // stdout cat 이 printf 가 write 한 그 파일(동일 변수)을 재-읽기.
      expect(catTarget).toBe(redirect?.target);
      expect(catTarget).toBe("$RESULT_JSON");
      // 방출 source 는 여전히 단일(stdout 이 독립 second printf 가 아님을 count==1 로 재확인).
      expect(countMachineJsonPrintf(shellSource)).toBe(1);
    });

    it("파일 sink 경로 해석 — RESULT_JSON=$LOG_DIR/latest-result.json · LOG_DIR=$REPO_DIR/deploy/logs → deploy/logs/latest-result.json", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const resultJsonDef = extractResultJsonDef(shellSource);
      const logDirDef = extractLogDirDef(shellSource);
      // 두 정의 실재.
      expect(resultJsonDef).not.toBeNull();
      expect(logDirDef).not.toBeNull();
      // RESULT_JSON 은 LOG_DIR 하위의 latest-result.json.
      expect(resultJsonDef).toBe("$LOG_DIR/latest-result.json");
      expect(path.basename(resultJsonDef as string)).toBe(
        EXPECTED_RESULT_BASENAME,
      );
      // LOG_DIR 은 deploy/logs 로 끝남(무인 모니터링 고정 경로).
      expect(logDirDef).toBe("$REPO_DIR/deploy/logs");
      expect(logDirDef?.endsWith(EXPECTED_LOG_DIR_SUFFIX)).toBe(true);
    });
  });

  describe("Error path: 앵커 부재 시 조용한 성공-위장 0", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0, T-0791 동형)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — printf 앵커 부재 합성 소스 → 문 추출 빈 문자열 · redirect null(빈 결과가 pass 로 오통과 0)", () => {
      const noPrintf = "#!/bin/bash\necho noop\n";
      const stmt = extractMachineJsonPrintfStatement(noPrintf);
      expect(stmt).toBe("");
      expect(extractRedirect(stmt)).toBeNull();
      // 카운트도 0 — happy-path 의 count==1 단언과 결코 혼동되지 않음.
      expect(countMachineJsonPrintf(noPrintf)).toBe(0);
    });

    it("error path — cat 앵커 부재 합성 소스 → extractStdoutCatTarget null(undefined 를 pass 로 오통과 0)", () => {
      const noCat = "#!/bin/bash\necho noop\n";
      expect(extractStdoutCatTarget(noCat)).toBeNull();
    });
  });

  describe("branch: count / redirect 분기 변별(본 smoke 가 drift 를 실제로 잡음)", () => {
    it("count 분기 — printf 복제 mutant 사본은 count==2, printf 제거 mutant 사본은 count==0(정본만 count==1, 원본 mutate 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalCount = countMachineJsonPrintf(shellSource);
      expect(canonicalCount).toBe(1);

      // mutant(사본): 머신-JSON printf 문을 복제(방출 2회 → 정본 모호).
      const stmt = extractMachineJsonPrintfStatement(shellSource);
      const duplicated = shellSource.replace(stmt, `${stmt}\n${stmt}`);
      expect(countMachineJsonPrintf(duplicated)).toBe(2);
      expect(countMachineJsonPrintf(duplicated)).not.toBe(canonicalCount);

      // mutant(사본): 머신-JSON printf 문 제거(방출 0회).
      const removed = shellSource.replace(MACHINE_JSON_PRINTF_RE, "true");
      expect(countMachineJsonPrintf(removed)).toBe(0);

      // 원본은 mutate 0 — 여전히 count==1.
      expect(countMachineJsonPrintf(shellSource)).toBe(1);
    });

    it("redirect overwrite/append 분기 — `>` 만 통과, `>>` 로 치환한 mutant 사본은 operator!==`>`(overwrite 계약 고정)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalRedirect = extractRedirect(
        extractMachineJsonPrintfStatement(shellSource),
      );
      expect(canonicalRedirect?.operator).toBe(">");

      // mutant(사본): overwrite `>"$RESULT_JSON"` → append `>>"$RESULT_JSON"`.
      const appendMutant = shellSource.replace(
        '>"$RESULT_JSON"',
        '>>"$RESULT_JSON"',
      );
      const mutantRedirect = extractRedirect(
        extractMachineJsonPrintfStatement(appendMutant),
      );
      expect(mutantRedirect?.operator).toBe(">>");
      expect(mutantRedirect?.operator).not.toBe(canonicalRedirect?.operator);

      // 원본 mutate 0.
      expect(
        extractRedirect(extractMachineJsonPrintfStatement(shellSource))
          ?.operator,
      ).toBe(">");
    });
  });

  describe("negative cases 충분 cover (각 1+, 단일 negative 금지)", () => {
    it("negative (a) — stdout 독립-printf drift 변별: `cat` 을 stdout 용 독립 6-키 printf 로 치환한 mutant 사본은 count==2(dual-source drift 검출)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // mutant(사본): 387행 `cat "$RESULT_JSON"` 을 stdout 용 두 번째 독립 6-키 printf 로 치환.
      const secondPrintf =
        `printf '{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,` +
        `"steps":%s,"logPath":"%s"}\\n' "$TS" "$GIT_SHA" "$RESULT" null ` +
        `"$steps_json" "$LOG_FILE"`;
      const driftMutant = shellSource.replace(
        'cat "$RESULT_JSON"',
        secondPrintf,
      );
      // 방출 source 가 2개로 갈라짐 → "printf 발생==1" 계약 위반을 실증.
      expect(countMachineJsonPrintf(driftMutant)).toBe(2);
      expect(countMachineJsonPrintf(driftMutant)).not.toBe(1);
      // 원본은 여전히 단일 source.
      expect(countMachineJsonPrintf(shellSource)).toBe(1);
    });

    it('negative (b) — cat 인자 변조 변별: `cat "$RESULT_JSON"` → `cat "$SOME_OTHER_FILE"` mutant 사본은 catTarget!==redirect 대상(single-source 위반)', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const redirectTarget = extractRedirect(
        extractMachineJsonPrintfStatement(shellSource),
      )?.target;

      // mutant(사본): cat 인자를 write 대상과 다른 변수로 치환.
      const tampered = shellSource.replace(
        'cat "$RESULT_JSON"',
        'cat "$SOME_OTHER_FILE"',
      );
      const mutantCatTarget = extractStdoutCatTarget(tampered);
      expect(mutantCatTarget).toBe("$SOME_OTHER_FILE");
      // stdout 이 write 된 그 파일을 읽지 않음 → single-source 계약 위반.
      expect(mutantCatTarget).not.toBe(redirectTarget);

      // 원본은 여전히 catTarget==redirect 대상.
      expect(extractStdoutCatTarget(shellSource)).toBe(redirectTarget);
    });

    it("negative (c) — 경로 drift 변별: RESULT_JSON basename 을 다른 이름으로 치환한 mutant 사본은 경로 assert 실패(무인 모니터링 계약 경로 고정)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // mutant(사본): latest-result.json → other-result.json.
      const pathMutant = shellSource.replace(
        '"$LOG_DIR/latest-result.json"',
        '"$LOG_DIR/other-result.json"',
      );
      const mutantDef = extractResultJsonDef(pathMutant);
      expect(path.basename(mutantDef as string)).not.toBe(
        EXPECTED_RESULT_BASENAME,
      );
      expect(path.basename(mutantDef as string)).toBe("other-result.json");

      // 원본은 여전히 정본 basename.
      expect(path.basename(extractResultJsonDef(shellSource) as string)).toBe(
        EXPECTED_RESULT_BASENAME,
      );
    });

    it("negative (d) — append drift 변별: `>`→`>>` 회귀가 latest-result 누적 오염을 유발(overwrite 계약 근거 별도 박제)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // mutant(사본): overwrite → append.
      const appendMutant = shellSource.replace(
        '>"$RESULT_JSON"',
        '>>"$RESULT_JSON"',
      );
      const mutantOp = extractRedirect(
        extractMachineJsonPrintfStatement(appendMutant),
      )?.operator;
      // append 면 run 간 누적 → routine 이 stale/garbage 파싱(latest 의미 붕괴).
      expect(mutantOp).toBe(">>");
      expect(mutantOp).not.toBe(">");
      // 원본은 overwrite 유지.
      expect(
        extractRedirect(extractMachineJsonPrintfStatement(shellSource))
          ?.operator,
      ).toBe(">");
    });

    it("negative (e) — credential 누출 0: 추출/합성한 어떤 문자열(printf 문·redirect·cat 라인·경로)에도 gh 토큰 어휘 미등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const stmt = extractMachineJsonPrintfStatement(shellSource);
      const catTarget = extractStdoutCatTarget(shellSource) ?? "";
      const resultJsonDef = extractResultJsonDef(shellSource) ?? "";
      const logDirDef = extractLogDirDef(shellSource) ?? "";
      // cat 라인 슬라이스(앵커 주변).
      const catIdx = shellSource.indexOf('cat "$RESULT_JSON"');
      const catSlice = shellSource.slice(catIdx, catIdx + 40);

      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;

      const haystacks = [stmt, catTarget, catSlice, resultJsonDef, logDirDef];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 shell 소스로 앵커 추출·검사를 두 번 호출하면 byte-identical deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(countMachineJsonPrintf(shellSource)).toBe(
        countMachineJsonPrintf(shellSource),
      );
      const s1 = extractMachineJsonPrintfStatement(shellSource);
      const s2 = extractMachineJsonPrintfStatement(shellSource);
      expect(s1).toBe(s2);
      expect(extractRedirect(s1)).toEqual(extractRedirect(s2));
      expect(extractStdoutCatTarget(shellSource)).toBe(
        extractStdoutCatTarget(shellSource),
      );
      expect(extractResultJsonDef(shellSource)).toBe(
        extractResultJsonDef(shellSource),
      );
    });

    it("추출 보조 함수가 입력(shell 문자열)을 mutate 0 · mutant 사본 생성이 원본 불변", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractMachineJsonPrintfStatement(shellSource);
      extractRedirect(extractMachineJsonPrintfStatement(shellSource));
      extractStdoutCatTarget(shellSource);
      extractResultJsonDef(shellSource);
      extractLogDirDef(shellSource);
      countMachineJsonPrintf(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      // mutant 사본(replace) 생성 후에도 원본 문자열 불변.
      const _mutant = shellSource.replace(
        '>"$RESULT_JSON"',
        '>>"$RESULT_JSON"',
      );
      expect(shellSource).toBe(sourceSnapshot);
      // 사본은 실제로 달라짐(replace 가 작동했음을 확인 — no-op 아님).
      expect(_mutant).not.toBe(shellSource);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("추출·검사 보조 함수가 env / 전역 상태 없이 순수하게 동작(non-gated — gating 분기 0)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const envSnapshot = { ...process.env };
      const before = countMachineJsonPrintf(shellSource);
      // env 를 임의로 주입해도 추출 결과 불변 — 모델이 gating env 를 참조하지 않음을 입증.
      Object.assign(process.env, { INJECTED_GATING_ENV: "1" });
      const after = countMachineJsonPrintf(shellSource);
      delete process.env.INJECTED_GATING_ENV;
      expect(after).toBe(before);
      // env 원복(테스트 side-effect 0).
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 shell 실행/source 0(추출 결과가 텍스트지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      // 읽은 값은 shell 스크립트 텍스트(첫 줄 shebang)일 뿐 실행 결과가 아님.
      expect(shellSource.startsWith("#!")).toBe(true);
      // 앵커 추출은 순수 문자열 검사(실행 0).
      expect(countMachineJsonPrintf(shellSource)).toBe(1);
      expect(extractStdoutCatTarget(shellSource)).toBe("$RESULT_JSON");
    });
  });
});
