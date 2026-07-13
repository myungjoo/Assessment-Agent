// realdata-e2e-daily-test-gating-env-completeness-all-present-nonblank-missing-name-only-diagnostic-contract.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` nightly runner 가 realdata-e2e live leg(eval/collect/
// rediscovery) 을 언제 실행/SKIP 할지 결정하는 gating 함수(`realdata_eval_gating_enabled`)의 **내부
// 완전성 semantics** 를 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는 non-gated
// build-time smoke (T-0949, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 봉함 불변식: **gating 함수는 7-env 완전성(전부 present+non-blank, 공백-only 는 부재)으로만 enabled 를
// 산출하고, 부분-set 이면 부재 *이름* 만 진단해 credential 값을 절대 누출하지 않는다(§9).** 이 완전성이
// cloud CI / 일반 LAN 무인 실행의 조용한 SKIP(no-op)·§9 비-누출 신뢰성의 핵심. 계약 4종(실 소스 유도 앵커):
//   (a) 7-env 이름 집합·순서(150~158행 `REALDATA_E2E_REQUIRED_ENV=(...)` — enable flag → Ollama 5 종 →
//       github read PAT, T-0610 helper 의 `REALDATA_E2E_REQUIRED_ENV` 이름·순서 bash mirror) ·
//   (b) all-present-AND-non-blank 완전성 규칙(164~179행 — 7 종 *모두* present+non-blank 여야 return 0
//       (enabled), 하나라도 부재/빈/공백-only 면 return 1(disabled)) ·
//   (c) whitespace-blank guard(169행 `[ -z "${val//[[:space:]]/}" ]` — trim 후 길이 0 이면 부재로 간주) ·
//   (d) missing-NAMES-only §9 진단(175행 `${missing[*]}` — 부재 env *이름* 만 로그, 실 credential *값* echo 0).
//
// 전략(T-0947/T-0948 동형): gating 완전성 유도 표현을 정적 앵커로 추출 + bash 완전성 semantics 를 TS 순수
// 함수(`REQUIRED_ENV`·`isBlank`·`missingEnvNames`·`gatingEnabled`)로 동형 모델링해 완전성 불변식 assert.
// T-0947(cascade gate call-site count)·T-0790/T-0887(argv parity)·T-0791(6-키 schema)·T-0944(집계 값)·
// T-0945(dual-sink)·T-0946(prune)·T-0948(스칼라 provenance) 와 distinct surface(gating 함수 내부 완전성).
//   🔥 실 redeploy/HTTP/jest spawn/gh/git 0 · gating 분기 실행 0(non-gated, describe.skip 0) ·
//      process.env 읽기 0(env map 은 pure 함수 파라미터) · credential 0(§9/REQ-059) · 새 dep 0(node fs/path) ·
//      src 변경 0(test-only) · deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// ── TS 동형 pure 함수(정본) — daily-test.sh gating 완전성(150~158·164~179행)을 순수 함수로 모델링.
//    입력(env map·문자열)은 mutate 하지 않는다(읽기만). 실 bash/env 읽기 0 — env 는 함수 파라미터.

// (a) 7-env 이름·순서(150~158행 REALDATA_E2E_REQUIRED_ENV) — T-0610 helper 이름 집합·순서 bash mirror.
//     enable flag → Ollama 접속 5 종 → github read PAT.
const REQUIRED_ENV: readonly string[] = [
  "REALDATA_E2E_LIVE_TEST",
  "REALDATA_E2E_LLM_BASE_URL",
  "REALDATA_E2E_LLM_API_KEY",
  "REALDATA_E2E_LLM_MODEL",
  "REALDATA_E2E_LLM_PROVIDER",
  "REALDATA_E2E_LLM_API_VERSION",
  "REALDATA_E2E_GITHUB_READ_PAT",
] as const;

// (c) whitespace-blank guard(169행 `[ -z "${val//[[:space:]]/}" ]`) — trim 후 길이 0 이면 부재로 간주.
//     undefined(부재)도 blank 로 취급(bash `${!name-}` 가 부재 시 빈 문자열).
function isBlank(val: string | undefined): boolean {
  if (val === undefined) return true;
  return val.replace(/\s/g, "").length === 0;
}

// (b)+(d) missingEnvNames(env): 7-env 순회하며 부재/빈/공백-only 인 env *이름* 배열 반환(값 아님, §9).
//     실 소스 173~175행의 `missing` 누적 + `${missing[*]}` 이름-진단 동형.
function missingEnvNames(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  for (const name of REQUIRED_ENV) {
    if (isBlank(env[name])) {
      missing.push(name);
    }
  }
  return missing;
}

// (b) gatingEnabled(env): 7-env 모두 present+non-blank(missing 이 빈 배열) 여야 true(return 0 동형).
//     하나라도 부재면 false(return 1 동형) — 부분-set 은 disabled(half-armed 실행 차단).
function gatingEnabled(env: Record<string, string | undefined>): boolean {
  return missingEnvNames(env).length === 0;
}

// ── 정적 앵커 추출 보조 함수 (실 bash gating 완전성 표현이 소스에 실재하는지) ──────────────────

// (a) REQUIRED_ENV 배열의 env 이름을 소스에서 정적 추출(150~158행 `REALDATA_E2E_REQUIRED_ENV=( ... )` 내부).
//     선언 시작(`REALDATA_E2E_REQUIRED_ENV=(`)부터 닫는 `)` 까지 슬라이스 → 비어있지 않은 토큰만 이름으로 수집.
function extractRequiredEnvNames(shellSource: string): string[] {
  const startMarker = "REALDATA_E2E_REQUIRED_ENV=(";
  const startIdx = shellSource.indexOf(startMarker);
  if (startIdx === -1) return [];
  const afterStart = startIdx + startMarker.length;
  const closeIdx = shellSource.indexOf(")", afterStart);
  if (closeIdx === -1) return [];
  const body = shellSource.slice(afterStart, closeIdx);
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

// (a) 배열 선언 앵커(150행) — `REALDATA_E2E_REQUIRED_ENV=(`.
function hasRequiredEnvArrayAnchor(shellSource: string): boolean {
  return shellSource.includes("REALDATA_E2E_REQUIRED_ENV=(");
}

// (b) gating 함수 정의 앵커(164행) — `realdata_eval_gating_enabled() {`.
function hasGatingFnAnchor(shellSource: string): boolean {
  return shellSource.includes("realdata_eval_gating_enabled() {");
}

// (b) 배열 순회 앵커(166행) — `for name in "${REALDATA_E2E_REQUIRED_ENV[@]}"`.
function hasForLoopAnchor(shellSource: string): boolean {
  return shellSource.includes('for name in "${REALDATA_E2E_REQUIRED_ENV[@]}"');
}

// (c) whitespace-blank guard 앵커(169행) — `[ -z "${val//[[:space:]]/}" ]`(trim 후 길이 0 → 부재).
function hasBlankGuardAnchor(shellSource: string): boolean {
  return shellSource.includes('[ -z "${val//[[:space:]]/}" ]');
}

// (d) missing-NAMES-only §9 진단 앵커(175행) — `${missing[*]}`(부재 이름 배열, 실값 아님).
function hasMissingNamesDiagnosticAnchor(shellSource: string): boolean {
  return shellSource.includes("${missing[*]}");
}

// (b) disabled 반환 앵커(176행) `return 1` + enabled 반환 앵커(178행) `return 0`.
function hasReturnBranchAnchors(shellSource: string): boolean {
  return shellSource.includes("return 1") && shellSource.includes("return 0");
}

// 6종 gating 완전성 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractGatingCompletenessAnchors(shellSource: string): {
  requiredEnvArray: boolean;
  gatingFn: boolean;
  forLoop: boolean;
  blankGuard: boolean;
  missingNamesDiagnostic: boolean;
  returnBranches: boolean;
} {
  return {
    requiredEnvArray: hasRequiredEnvArrayAnchor(shellSource),
    gatingFn: hasGatingFnAnchor(shellSource),
    forLoop: hasForLoopAnchor(shellSource),
    blankGuard: hasBlankGuardAnchor(shellSource),
    missingNamesDiagnostic: hasMissingNamesDiagnosticAnchor(shellSource),
    returnBranches: hasReturnBranchAnchors(shellSource),
  };
}

// 정상 nightly env map 예시(실 process.env 읽기 0 — 함수 파라미터로만 표현, 값은 non-blank placeholder).
// credential *값* 은 어디에도 실재 없음 — 순수 non-secret placeholder("v1"…) 로만 present 를 표현.
function fullyPresentEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  REQUIRED_ENV.forEach((name, i) => {
    env[name] = `v${i + 1}`;
  });
  return env;
}

describe("realdata-e2e step④ daily-test.sh gating-env completeness contract smoke — 7-env all-present-non-blank · whitespace-blank guard · missing-NAMES-only §9 진단 (T-0949)", () => {
  describe("Happy-path: 7-env 이름 집합·순서 정적 추출", () => {
    it("실 deploy/daily-test.sh 를 읽어 REALDATA_E2E_REQUIRED_ENV 배열이 정확히 7 이름·예상 순서(T-0610 helper mirror)로 등장", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const names = extractRequiredEnvNames(shellSource);
      // 정확히 7 개(enable flag → Ollama 5 종 → github read PAT).
      expect(names).toHaveLength(7);
      expect(names).toEqual([
        "REALDATA_E2E_LIVE_TEST",
        "REALDATA_E2E_LLM_BASE_URL",
        "REALDATA_E2E_LLM_API_KEY",
        "REALDATA_E2E_LLM_MODEL",
        "REALDATA_E2E_LLM_PROVIDER",
        "REALDATA_E2E_LLM_API_VERSION",
        "REALDATA_E2E_GITHUB_READ_PAT",
      ]);
      // pure 함수 정본 REQUIRED_ENV 와 소스 추출 결과가 byte-identical(bash mirror 정합).
      expect(names).toEqual([...REQUIRED_ENV]);
    });
  });

  describe("Happy-path: gating 함수 앵커 정적 추출(pure 함수가 실 bash 완전성 로직을 mirror)", () => {
    it("함수 정의(164)·for 순회(166)·blank-guard(169)·이름-진단(175)·return 1/0(176/178)이 실 소스에 존재(6 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractGatingCompletenessAnchors(shellSource);
      expect(anchors.requiredEnvArray).toBe(true);
      expect(anchors.gatingFn).toBe(true);
      expect(anchors.forLoop).toBe(true);
      expect(anchors.blankGuard).toBe(true);
      expect(anchors.missingNamesDiagnostic).toBe(true);
      expect(anchors.returnBranches).toBe(true);
    });
  });

  describe("Happy-path: all-present-non-blank → enabled model", () => {
    it("gatingEnabled(env) 는 7-env 모두 present+non-blank 인 입력에서 true(return 0 동형) + missing 빈 배열", () => {
      const env = fullyPresentEnv();
      expect(gatingEnabled(env)).toBe(true);
      expect(missingEnvNames(env)).toEqual([]);
    });
  });

  describe("Happy-path: isBlank whitespace guard 검증(169행 trim-후-길이-0 규칙 정합)", () => {
    it("빈 문자열·공백-only·undefined 는 true, 내부 non-space 존재 값은 false", () => {
      // trim 후 길이 0 → 부재로 간주.
      expect(isBlank("")).toBe(true);
      expect(isBlank("   ")).toBe(true);
      expect(isBlank("\t\n")).toBe(true);
      expect(isBlank(" \t \n ")).toBe(true);
      // undefined(env 부재) 도 blank(bash `${!name-}` 부재 시 빈 문자열).
      expect(isBlank(undefined)).toBe(true);
      // 내부 non-space 존재 → non-blank.
      expect(isBlank("x")).toBe(false);
      expect(isBlank(" x ")).toBe(false);
      expect(isBlank("ollama")).toBe(false);
    });
  });

  describe("branch: partial-set → disabled + missing 이름 목록", () => {
    it("github read PAT 만 부재면 gatingEnabled false + missingEnvNames 가 그 이름만(부분-set → disabled)", () => {
      const env = fullyPresentEnv();
      delete env.REALDATA_E2E_GITHUB_READ_PAT;
      expect(gatingEnabled(env)).toBe(false);
      expect(missingEnvNames(env)).toEqual(["REALDATA_E2E_GITHUB_READ_PAT"]);
    });

    it("공백-only 값도 부재로 간주(half-armed 차단) — 부재가 2+ 종일 때 이름 목록이 정확히 그 부재 이름들", () => {
      const env = fullyPresentEnv();
      // 하나는 삭제(부재), 하나는 공백-only(blank guard).
      delete env.REALDATA_E2E_LLM_API_KEY;
      env.REALDATA_E2E_LLM_MODEL = "   ";
      expect(gatingEnabled(env)).toBe(false);
      expect(missingEnvNames(env)).toEqual([
        "REALDATA_E2E_LLM_API_KEY",
        "REALDATA_E2E_LLM_MODEL",
      ]);
    });
  });

  describe("branch: all-absent vs all-present 양극(완전성 규칙 양 끝단)", () => {
    it("7-env 전부 부재 → gatingEnabled false + missingEnvNames 가 7 이름 전부", () => {
      const empty: Record<string, string | undefined> = {};
      expect(gatingEnabled(empty)).toBe(false);
      expect(missingEnvNames(empty)).toEqual([...REQUIRED_ENV]);
    });

    it("7-env 전부 present+non-blank → gatingEnabled true + missingEnvNames 빈 배열", () => {
      const env = fullyPresentEnv();
      expect(gatingEnabled(env)).toBe(true);
      expect(missingEnvNames(env)).toEqual([]);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — gating 완전성 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(gating 유도 표현 부재)에서 추출기가 false / 빈 배열을 낸다.
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractGatingCompletenessAnchors(emptySource);
      expect(anchors.requiredEnvArray).toBe(false);
      expect(anchors.gatingFn).toBe(false);
      expect(anchors.forLoop).toBe(false);
      expect(anchors.blankGuard).toBe(false);
      expect(anchors.missingNamesDiagnostic).toBe(false);
      // 배열 추출도 빈 결과(성공-위장 0).
      expect(extractRequiredEnvNames(emptySource)).toEqual([]);
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractGatingCompletenessAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.gatingFn).toBe(true);
      expect(realAnchors.blankGuard).toBe(true);
    });

    it("negative (a) — 완전성 규칙 OR-약화 drift 변별: '하나라도 set 이면 enabled'(OR) mutant 모델에서 partial-set→disabled assert 실패", () => {
      // mutant(모델 사본): OR 완전성 — missing 이 7 전부일 때만 disabled(하나라도 present 면 enabled).
      const mutantGatingEnabled = (
        env: Record<string, string | undefined>,
      ): boolean => missingEnvNames(env).length < REQUIRED_ENV.length;
      const partial = fullyPresentEnv();
      delete partial.REALDATA_E2E_GITHUB_READ_PAT;
      // 정본(AND 완전성): partial-set → disabled.
      expect(gatingEnabled(partial)).toBe(false);
      // mutant(OR): partial-set 을 enabled 로 오판(half-armed 실행 회귀) — 정본과 어긋남.
      expect(mutantGatingEnabled(partial)).toBe(true);
      expect(mutantGatingEnabled(partial)).not.toBe(gatingEnabled(partial));
      // 원본 pure 함수 불변(재호출 시 여전히 AND 완전성).
      expect(gatingEnabled(partial)).toBe(false);
    });

    it("negative (b) — blank-guard 제거 drift 변별: isBlank 를 `val === \"\"`(공백-only 통과)로 약화한 mutant 에서 '공백-only 는 부재' assert 실패", () => {
      // mutant(모델 사본): 공백-only 통과(정확히 빈 문자열만 blank).
      const mutantIsBlank = (val: string | undefined): boolean =>
        val === undefined || val === "";
      // 정본: 공백-only 는 blank(부재).
      expect(isBlank("   ")).toBe(true);
      // mutant: 공백-only 를 non-blank 로 오판(공백 credential 오판 회귀).
      expect(mutantIsBlank("   ")).toBe(false);
      expect(mutantIsBlank("   ")).not.toBe(isBlank("   "));
      // 원본 불변.
      expect(isBlank("   ")).toBe(true);
    });

    it("negative (c) — 7-env 이름 누락/변조 drift 변별: 6-원소·오타 배열 사본에서 '정확히 7 이름·예상 순서' assert 실패", () => {
      const names = extractRequiredEnvNames(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      // mutant1(사본): env 이름 하나 제거(6 원소 — 불완전 gating).
      const dropped = names.filter((n) => n !== "REALDATA_E2E_GITHUB_READ_PAT");
      expect(dropped).toHaveLength(6);
      expect(dropped).not.toEqual([...REQUIRED_ENV]);
      // mutant2(사본): 이름 오타 치환.
      const typo = names.map((n) =>
        n === "REALDATA_E2E_LLM_MODEL" ? "REALDATA_E2E_LLM_MODLE" : n,
      );
      expect(typo).not.toEqual([...REQUIRED_ENV]);
      // 원본 추출 결과는 mutate 0(정본 7 이름·순서 불변).
      expect(names).toEqual([...REQUIRED_ENV]);
    });

    it("negative (d) — §9 missing-진단 값-누출 drift 변별: 이름 대신 실값을 내는 mutant 진단에서 '이름만(값 미포함)' assert 실패 + 실 소스 175행은 이름 배열", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const env = fullyPresentEnv();
      env.REALDATA_E2E_LLM_API_KEY = "secret-token-xyz"; // present 이나 §9 상 진단에 값 누출 금지 대상.
      env.REALDATA_E2E_GITHUB_READ_PAT = ""; // 부재(blank) 로 판정.
      const missing = missingEnvNames(env);
      // 정본 진단: 부재 env *이름* 만(값 아님).
      expect(missing).toEqual(["REALDATA_E2E_GITHUB_READ_PAT"]);
      // mutant(모델 사본): 진단이 실값을 내도록 변조 — present env 의 credential 값이 진단 문자열에 실림.
      const mutantDiagnostic = REQUIRED_ENV.map((name) => env[name]);
      // 정본 진단(이름)엔 present env 의 실값이 없어야 하고, mutant(값)엔 실값이 실림 → §9 회귀 검출.
      expect(missing.join(" ")).not.toContain("secret-token-xyz");
      expect(mutantDiagnostic).toContain("secret-token-xyz");
      // 실 소스 175행은 `${missing[*]}`(이름 배열) — `${!name}`(실값 dereference) 미등장.
      expect(hasMissingNamesDiagnosticAnchor(shellSource)).toBe(true);
      expect(shellSource).not.toContain("${!name}");
      // 진단 로그 라인에 실 env 값-echo 표현이 없음(이름만).
      const diagLine = shellSource
        .split("\n")
        .find((l) => l.includes("gating env 부재"));
      expect(diagLine).toBeDefined();
      expect(diagLine).toContain("${missing[*]}");
      expect(diagLine).not.toContain("${!");
    });

    it("negative (e) — credential 누출 0: 추출/합성 문자열(env 이름·missing 목록·앵커 텍스트)에 gh 토큰 어휘·실값 placeholder 미등장(§9)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const env = fullyPresentEnv();
      delete env.REALDATA_E2E_LLM_API_KEY;
      const synthesized = [
        ...REQUIRED_ENV,
        ...missingEnvNames(env),
        extractRequiredEnvNames(shellSource).join(" "),
      ];
      // gating 함수 슬라이스(164~179행 부근)도 검사 대상.
      const fnStart = shellSource.indexOf("realdata_eval_gating_enabled() {");
      const anchorSlice = shellSource.slice(fnStart, fnStart + 500);

      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;

      const haystacks = [...synthesized, anchorSlice];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // gating 함수 슬라이스에 실 credential 값 dereference(`${!name}`)가 없음(이름만 진단).
      expect(anchorSlice).not.toContain("${!name}");
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(env map)으로 pure 함수를 두 번 호출하면 byte-identical(결정론)", () => {
      const env = fullyPresentEnv();
      expect(gatingEnabled(env)).toBe(gatingEnabled(env));
      expect(missingEnvNames(env)).toEqual(missingEnvNames(env));
      expect(isBlank("   ")).toBe(isBlank("   "));
    });

    it("동일 shell 소스로 앵커 추출·이름 추출을 두 번 하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(extractGatingCompletenessAnchors(shellSource)).toEqual(
        extractGatingCompletenessAnchors(shellSource),
      );
      expect(extractRequiredEnvNames(shellSource)).toEqual(
        extractRequiredEnvNames(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(env map·shell 소스)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractGatingCompletenessAnchors(shellSource);
      extractRequiredEnvNames(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const env = fullyPresentEnv();
      const envSnapshot = { ...env };
      gatingEnabled(env);
      missingEnvNames(env);
      expect(env).toEqual(envSnapshot);
      // 정본 REQUIRED_ENV 도 불변(readonly).
      expect([...REQUIRED_ENV]).toEqual([
        "REALDATA_E2E_LIVE_TEST",
        "REALDATA_E2E_LLM_BASE_URL",
        "REALDATA_E2E_LLM_API_KEY",
        "REALDATA_E2E_LLM_MODEL",
        "REALDATA_E2E_LLM_PROVIDER",
        "REALDATA_E2E_LLM_API_VERSION",
        "REALDATA_E2E_GITHUB_READ_PAT",
      ]);
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("gating 완전성 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — env 는 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = gatingEnabled(fullyPresentEnv());
      // 실 process.env 를 mutate 해도 gating 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { REALDATA_E2E_LIVE_TEST: "injected" });
      const after = gatingEnabled(fullyPresentEnv());
      delete process.env.REALDATA_E2E_LIVE_TEST;
      expect(after).toBe(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 bash/git/env 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasGatingFnAnchor(shellSource)).toBe(true);
    });
  });
});
