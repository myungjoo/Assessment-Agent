// realdata-e2e-daily-test-shell-strictness-uo-pipefail-errexit-absence-env-override-default-resolution-contract.smoke-spec.ts
// — 실 평가 e2e nightly runner `deploy/daily-test.sh` 의 **서두 shell-strictness(`set -uo pipefail`) +
// env-override 기본값 해석 계약**을 실 shell 파일을 readFileSync 로 읽어(실행/source 0) 정적 검증하는
// non-gated build-time smoke (T-0956, PLAN.md §109 step① 실 평가 e2e — nightly 서두 부트스트랩 계약).
//
// 봉함 불변식: **스크립트 서두(38~46행)는 `set -uo pipefail` 로 nounset(`-u`)·pipefail(`-o pipefail`)을 켜되
// errexit(`-e`)을 의도적으로 끈 채(step 실패의 return-code 를 if/elif 게이트에 흡수 — mark PASS/FAIL
// orchestration 전체가 `-e` 부재에 의존) 7 운영 env(REPO_DIR/BASE_URL/DAILY_SMOKE_EMAIL/DAILY_SMOKE_PASSWORD/
// SKIP_REDEPLOY/HEALTH_TIMEOUT/LOG_KEEP)를 각 `${VAR:-default}` 로 해석하고 DAILY_SMOKE_EMAIL/DAILY_SMOKE_PASSWORD
// 를 SMOKE_EMAIL/SMOKE_PASSWORD 로 매핑하며 password 기본값(`daily-smoke-pw-2026`, 길이 19)이 AddUserDto
// `@MinLength(8)` 을 충족하되 실 secret 을 담지 않는다.**
// 계약 6종(실 소스 유도 앵커 — 38~46행 서두 중심):
//   (a) shell-strictness 모드(38행 `set -uo pipefail` — nounset ON·pipefail ON·errexit 의도적 OFF) ·
//   (b) 7 env-override 기본값 fallback(40~46행 `${VAR:-default}` — 각 운영 env 의 `:-default` 해석) ·
//   (c) env→shell 이름 매핑(DAILY_SMOKE_EMAIL→SMOKE_EMAIL·DAILY_SMOKE_PASSWORD→SMOKE_PASSWORD; 나머지 5 종 동일) ·
//   (d) `:-` fallback 시맨틱(env set·non-empty → env 값, unset/빈 문자열 → default; bash parameter expansion) ·
//   (e) DAILY_SMOKE_PASSWORD 기본값 길이 ≥ 8(34행 주석 `@MinLength(8)` 충족 — auth step signup 유효성) ·
//   (f) §9 secret-safety(7 default 중 실 credential 미포함 — SMOKE_PASSWORD default 는 문서화 local-test placeholder).
//
// 전략(T-0955 step_redeploy·T-0952 step_health 정적-smoke 동형): 서두 유도 표현을 정적 앵커로 추출 +
// 해석 동형 TS 순수 함수(`parseShellStrictness`·`buildEnvOverrideTable`·`resolveEnvOverride`·
// `smokePasswordMeetsMinLength`)로 strictness-플래그·default-값·이름-매핑·`:-`-시맨틱·MinLength·secret-safety
// 불변식 assert. T-0952(HEALTH_TIMEOUT 폴링 math — default *해석*만)·T-0946(LOG_KEEP prune glob — default *해석*만)·
// T-0948(ts/logPath/LOG_DIR 유도 — env-override *fallback*만)·T-0949(REALDATA_E2E_* gating env — distinct set)·
// T-0792(HEALTH_MESSAGE parity — 미다룸) 와 distinct surface(서두 shell-strictness + env-override 기본값 해석).
//   🔥 실 bash/set/env-expansion/배포/gh/git 0 · process.env 읽기 0(입력은 pure 함수 파라미터) ·
//      credential 0(§9/REQ-059) · 새 dep 0(node fs/path) · src 변경 0(test-only) ·
//      deploy/daily-test.sh 읽기만(실행/source 0).
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// 서두 정본 앵커(실 bash 표현의 TS mirror — 실 bash/set/env-expansion 실행 0).
const SHELL_STRICTNESS_LINE = `set -uo pipefail`; // 38행.
const PASSWORD_MINLENGTH_COMMENT = `AddUserDto @MinLength(8)`; // 34행 주석 근거.
const SMOKE_PASSWORD_DEFAULT = `daily-smoke-pw-2026`; // 43행 default(길이 19).

// ── TS 동형 pure 함수(정본) — daily-test.sh 서두(38~46행) 실행-모드 + env-override 해석을 모델링.
//    입력(문자열)은 mutate 하지 않는다(읽기만). 실 bash/set/env-expansion/env 읽기 0 — 입력은 파라미터.

// (a) shell-strictness 파싱 결과 — `set` 플래그 3종 분리 boolean.
interface ShellStrictness {
  nounset: boolean; // `-u` — unset 변수 참조 시 error.
  pipefail: boolean; // `-o pipefail` — 파이프 중간 실패 전파.
  errexit: boolean; // `-e` — 첫 실패에서 script abort. **정본은 false(의도적 OFF)**.
}

// (a) parseShellStrictness(setLine): `set -uo pipefail` 서두 라인을 파싱해 strictness 플래그 분리 —
//     `-u`·`-o pipefail` 존재로 nounset/pipefail true, `-e` 부재로 errexit false(orchestration 이 의존).
//     실 bash `set` 실행 0(문자열 파싱). `-e` 는 `-u`/`-e`/`-x` 조합 flag 또는 단독 `-e` 로 등장 가능.
function parseShellStrictness(setLine: string): ShellStrictness {
  // `set -uo pipefail` / `set -euo pipefail` / `set -e` 등 — flag 문자 집합을 추출.
  // 조합 short-flag(`-uo`, `-euo`) 와 개별 flag(`-e -u -o pipefail`) 모두 수용.
  const shortFlagChars = new Set<string>();
  for (const m of setLine.matchAll(/(?<![\w-])-([a-zA-Z]+)\b/g)) {
    // `-o` 뒤 옵션 이름(`pipefail`)은 flag 문자가 아니므로 `o` 만 남기고 값은 별도 처리.
    for (const ch of m[1]) shortFlagChars.add(ch);
  }
  // `-o pipefail` — `set -o pipefail` 또는 `-uo pipefail` 형태 모두 pipefail on.
  const pipefail = /-\w*o\b\s+pipefail\b/.test(setLine);
  return {
    nounset: shortFlagChars.has("u"),
    pipefail,
    errexit: shortFlagChars.has("e"),
  };
}

// (b)(c) env-override 표 원소 — 외부 env 이름 → 내부 shell 변수 + documented default.
interface EnvOverrideEntry {
  envName: string; // 외부 env 이름(운영자가 주입).
  shellVar: string; // 내부 shell 변수 이름(스크립트가 사용).
  default: string; // `${VAR:-default}` 의 default 값.
}

// (b)(c) buildEnvOverrideTable(): 40~46행 7 env-override 배선 동형 — 순서 포함 7 원소 배열.
//     각 원소의 envName/shellVar/default 가 실 소스 라인과 일치(정적 대조 대상). 실 env 읽기 0.
function buildEnvOverrideTable(): EnvOverrideEntry[] {
  return [
    {
      envName: "REPO_DIR",
      shellVar: "REPO_DIR",
      default: "/opt/assessment-agent",
    }, // 40행.
    {
      envName: "BASE_URL",
      shellVar: "BASE_URL",
      default: "http://localhost:3000",
    }, // 41행.
    {
      envName: "DAILY_SMOKE_EMAIL",
      shellVar: "SMOKE_EMAIL",
      default: "daily-smoke@local.test",
    }, // 42행 매핑.
    {
      envName: "DAILY_SMOKE_PASSWORD",
      shellVar: "SMOKE_PASSWORD",
      default: "daily-smoke-pw-2026",
    }, // 43행 매핑.
    { envName: "SKIP_REDEPLOY", shellVar: "SKIP_REDEPLOY", default: "0" }, // 44행.
    { envName: "HEALTH_TIMEOUT", shellVar: "HEALTH_TIMEOUT", default: "180" }, // 45행.
    { envName: "LOG_KEEP", shellVar: "LOG_KEEP", default: "14" }, // 46행.
  ];
}

// (d) resolveEnvOverride(shellVar, envValue, def): `${VAR:-default}` 시맨틱 동형 —
//     envValue 가 set-이고-non-empty 면 envValue, unset(undefined)/빈 문자열이면 default.
//     bash parameter expansion `:-` 규약. 실 env 읽기 0(입력은 파라미터).
function resolveEnvOverride(
  _shellVar: string,
  envValue: string | undefined,
  def: string,
): string {
  // `:-` 는 unset 또는 빈 문자열 모두 default 로 대체(vs `-` 는 unset 만).
  return envValue !== undefined && envValue !== "" ? envValue : def;
}

// (e) smokePasswordMeetsMinLength(defaultPw, minLength): AddUserDto `@MinLength(8)` 충족 여부 —
//     default password 길이가 minLength 이상인지. auth step signup 유효성(길이 < 8 → 400 회귀 검출).
function smokePasswordMeetsMinLength(
  defaultPw: string,
  minLength: number,
): boolean {
  return defaultPw.length >= minLength;
}

// ── 정적 앵커 추출 보조 함수 (실 bash 서두 표현이 소스에 실재하는지) ──────────────

// 38행 shell-strictness 앵커 — `set -uo pipefail`.
function hasShellStrictnessAnchor(shellSource: string): boolean {
  return shellSource.includes(SHELL_STRICTNESS_LINE);
}

// 34행 password MinLength 주석 앵커.
function hasPasswordMinLengthCommentAnchor(shellSource: string): boolean {
  return shellSource.includes(PASSWORD_MINLENGTH_COMMENT);
}

// 특정 env-override 라인 앵커 — `SHELLVAR="${ENVNAME:-DEFAULT}"` 형태가 실 소스에 존재하는지.
function hasEnvOverrideLineAnchor(
  shellSource: string,
  entry: EnvOverrideEntry,
): boolean {
  const expected = `${entry.shellVar}="\${${entry.envName}:-${entry.default}}"`;
  return shellSource.includes(expected);
}

// 7 env-override 라인이 모두(순서 무관) 실 소스에 존재하는지 — 하나라도 부재면 false.
function allEnvOverrideLinesPresent(shellSource: string): boolean {
  return buildEnvOverrideTable().every((e) =>
    hasEnvOverrideLineAnchor(shellSource, e),
  );
}

// 서두 유도 앵커가 모두 실재하는지 — 하나라도 부재면 명시적 실패(빈 결과 성공-위장 0).
function extractPreambleAnchors(shellSource: string): {
  strictness: boolean;
  envOverrides: boolean;
  minLengthComment: boolean;
} {
  return {
    strictness: hasShellStrictnessAnchor(shellSource),
    envOverrides: allEnvOverrideLinesPresent(shellSource),
    minLengthComment: hasPasswordMinLengthCommentAnchor(shellSource),
  };
}

describe("realdata-e2e step① daily-test.sh 서두 shell-strictness(`set -uo pipefail`, errexit 의도적 OFF) + env-override 기본값 해석 계약 smoke — nounset/pipefail ON·errexit OFF + 7 `${VAR:-default}` + env→shell 매핑 + `:-` 시맨틱 + password MinLength(8) + secret-safety (T-0956)", () => {
  describe("Happy-path: 서두 앵커 정적 추출(pure 함수가 실 서두를 mirror)", () => {
    it("38행 `set -uo pipefail`·40~46행 7 env-override 라인·34행 MinLength 주석이 실 소스에 존재(3 앵커 전부 true)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const anchors = extractPreambleAnchors(shellSource);
      expect(anchors.strictness).toBe(true);
      expect(anchors.envOverrides).toBe(true);
      expect(anchors.minLengthComment).toBe(true);
    });

    it('7 env-override 라인이 각각 `SHELLVAR="${ENVNAME:-DEFAULT}"` 형태로 실 소스에 개별 존재(배선 동형)', () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      for (const entry of buildEnvOverrideTable()) {
        expect(hasEnvOverrideLineAnchor(shellSource, entry)).toBe(true);
      }
    });
  });

  describe("Happy-path: parseShellStrictness(setLine)", () => {
    it("`set -uo pipefail` → { nounset:true, pipefail:true, errexit:false } — `-e` 부재로 errexit false(orchestration 이 return-code 흡수)", () => {
      expect(parseShellStrictness("set -uo pipefail")).toEqual({
        nounset: true,
        pipefail: true,
        errexit: false,
      });
    });

    it("실 소스 38행에서 추출한 strictness 라인도 동일 판정 — nounset/pipefail true·errexit false", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const line = shellSource
        .replace(/\r\n/g, "\n")
        .split("\n")
        .find((l) => l.trim().startsWith("set -"));
      expect(line).toBeDefined();
      const strictness = parseShellStrictness(line as string);
      expect(strictness.nounset).toBe(true);
      expect(strictness.pipefail).toBe(true);
      expect(strictness.errexit).toBe(false);
    });
  });

  describe("Happy-path: buildEnvOverrideTable()", () => {
    it("7 원소 배열(순서 포함)을 반환 — 각 envName/shellVar/default 가 40~46행 배선 동형", () => {
      expect(buildEnvOverrideTable()).toEqual([
        {
          envName: "REPO_DIR",
          shellVar: "REPO_DIR",
          default: "/opt/assessment-agent",
        },
        {
          envName: "BASE_URL",
          shellVar: "BASE_URL",
          default: "http://localhost:3000",
        },
        {
          envName: "DAILY_SMOKE_EMAIL",
          shellVar: "SMOKE_EMAIL",
          default: "daily-smoke@local.test",
        },
        {
          envName: "DAILY_SMOKE_PASSWORD",
          shellVar: "SMOKE_PASSWORD",
          default: "daily-smoke-pw-2026",
        },
        { envName: "SKIP_REDEPLOY", shellVar: "SKIP_REDEPLOY", default: "0" },
        {
          envName: "HEALTH_TIMEOUT",
          shellVar: "HEALTH_TIMEOUT",
          default: "180",
        },
        { envName: "LOG_KEEP", shellVar: "LOG_KEEP", default: "14" },
      ]);
    });

    it("정확히 7 원소 — 운영 env 표가 과부족 없음", () => {
      expect(buildEnvOverrideTable()).toHaveLength(7);
    });
  });

  describe("Happy-path: resolveEnvOverride(shellVar, envValue, default)", () => {
    it("env non-empty → env 값(예: HEALTH_TIMEOUT '300' → '300')", () => {
      expect(resolveEnvOverride("HEALTH_TIMEOUT", "300", "180")).toBe("300");
    });

    it("env unset(undefined) → default(예: HEALTH_TIMEOUT undefined → '180')", () => {
      expect(resolveEnvOverride("HEALTH_TIMEOUT", undefined, "180")).toBe(
        "180",
      );
    });

    it("env 빈 문자열 → default(예: HEALTH_TIMEOUT '' → '180'; `:-` 규약)", () => {
      expect(resolveEnvOverride("HEALTH_TIMEOUT", "", "180")).toBe("180");
    });
  });

  describe("Happy-path: smokePasswordMeetsMinLength(defaultPw, minLength)", () => {
    it("`daily-smoke-pw-2026`(길이 19) + minLength 8 → true(AddUserDto @MinLength(8) 충족)", () => {
      expect(smokePasswordMeetsMinLength(SMOKE_PASSWORD_DEFAULT, 8)).toBe(true);
      expect(SMOKE_PASSWORD_DEFAULT.length).toBe(19);
    });
  });

  describe("branch: errexit 부재(`-uo`) vs 존재(`-euo`) 정적 대조", () => {
    it("정본 `set -uo pipefail` → errexit false, mutant `set -euo pipefail` → errexit true — 두 입력 분리 실증(정본은 return-code 흡수)", () => {
      // 정본: errexit OFF.
      expect(parseShellStrictness("set -uo pipefail").errexit).toBe(false);
      // mutant(모델 사본): `-e` 추가(첫 실패 step 에서 script abort → 결과 JSON 미방출 회귀).
      expect(parseShellStrictness("set -euo pipefail").errexit).toBe(true);
      // 두 판정이 서로 다름.
      expect(parseShellStrictness("set -uo pipefail").errexit).not.toBe(
        parseShellStrictness("set -euo pipefail").errexit,
      );
      // 실 소스 38행은 `set -uo pipefail`(errexit 없음) 이고 `set -euo pipefail` 아님.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource).toContain("set -uo pipefail");
      expect(shellSource).not.toContain("set -euo pipefail");
    });
  });

  describe("branch: env→shell 이름 매핑 동일/상이 분리", () => {
    it("매핑 상이 2 종(DAILY_SMOKE_EMAIL→SMOKE_EMAIL·DAILY_SMOKE_PASSWORD→SMOKE_PASSWORD)·동일 5 종 분리 실증", () => {
      const table = buildEnvOverrideTable();
      const differing = table.filter((e) => e.envName !== e.shellVar);
      const same = table.filter((e) => e.envName === e.shellVar);
      expect(differing).toHaveLength(2);
      expect(same).toHaveLength(5);
      // 상이한 2 종의 정확한 매핑.
      expect(differing).toEqual([
        {
          envName: "DAILY_SMOKE_EMAIL",
          shellVar: "SMOKE_EMAIL",
          default: "daily-smoke@local.test",
        },
        {
          envName: "DAILY_SMOKE_PASSWORD",
          shellVar: "SMOKE_PASSWORD",
          default: "daily-smoke-pw-2026",
        },
      ]);
      // 동일한 5 종.
      expect(same.map((e) => e.envName)).toEqual([
        "REPO_DIR",
        "BASE_URL",
        "SKIP_REDEPLOY",
        "HEALTH_TIMEOUT",
        "LOG_KEEP",
      ]);
    });
  });

  describe("branch: `:-` fallback 3 분기", () => {
    it("(env set·non-empty → env 값)·(unset → default)·(빈 문자열 → default) 3 분기 모두 서로 다른 경로 실증", () => {
      // env set·non-empty → env 값.
      expect(
        resolveEnvOverride("REPO_DIR", "/custom", "/opt/assessment-agent"),
      ).toBe("/custom");
      // unset → default.
      expect(
        resolveEnvOverride("REPO_DIR", undefined, "/opt/assessment-agent"),
      ).toBe("/opt/assessment-agent");
      // 빈 문자열 → default.
      expect(resolveEnvOverride("REPO_DIR", "", "/opt/assessment-agent")).toBe(
        "/opt/assessment-agent",
      );
      // set 분기 결과가 default 분기 결과와 다름(3 분기가 실제로 분기함).
      expect(
        resolveEnvOverride("REPO_DIR", "/custom", "/opt/assessment-agent"),
      ).not.toBe(
        resolveEnvOverride("REPO_DIR", undefined, "/opt/assessment-agent"),
      );
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("error path — shell 파일 부재 경로 → readFileSync throw(silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("error path — 서두 앵커 부재 시 명시적 실패(빈 매칭을 pass 로 오통과 0)", () => {
      // 앵커를 제거한 합성 소스(서두 유도 표현 부재).
      const emptySource = "#!/usr/bin/env bash\necho hello\n";
      const anchors = extractPreambleAnchors(emptySource);
      expect(anchors.strictness).toBe(false);
      expect(anchors.envOverrides).toBe(false);
      expect(anchors.minLengthComment).toBe(false);
      // 개별 env-override 라인도 전부 부재.
      for (const entry of buildEnvOverrideTable()) {
        expect(hasEnvOverrideLineAnchor(emptySource, entry)).toBe(false);
      }
      // 실 소스는 반대로 전부 존재 — 부재/실재를 변별함을 대비로 실증.
      const realAnchors = extractPreambleAnchors(
        readFileSync(DAILY_TEST_SH_PATH, "utf8"),
      );
      expect(realAnchors.strictness).toBe(true);
      expect(realAnchors.envOverrides).toBe(true);
      expect(realAnchors.minLengthComment).toBe(true);
    });

    it("negative (a) — errexit 추가 drift 변별: `set -euo pipefail` 사본에서 'errexit === false' assert 실패", () => {
      // 정본: errexit false.
      expect(parseShellStrictness("set -uo pipefail").errexit).toBe(false);
      // mutant(모델 사본): `-e` 추가(첫 실패 step → script abort → 결과 JSON 미방출 회귀).
      const mutant = "set -uo pipefail".replace("-uo", "-euo");
      expect(parseShellStrictness(mutant).errexit).toBe(true);
      expect(parseShellStrictness(mutant).errexit).not.toBe(
        parseShellStrictness("set -uo pipefail").errexit,
      );
      // 원본 판정 불변(replace 는 사본 반환).
      expect(parseShellStrictness("set -uo pipefail").errexit).toBe(false);
    });

    it("negative (b) — nounset/pipefail 제거 drift 변별: `-u` 제거 / pipefail 제거 사본에서 각 assert 실패", () => {
      // 정본: nounset·pipefail true.
      const canonical = parseShellStrictness("set -uo pipefail");
      expect(canonical.nounset).toBe(true);
      expect(canonical.pipefail).toBe(true);
      // mutant 1: `-u` 제거(`set -o pipefail`) → nounset false.
      expect(parseShellStrictness("set -o pipefail").nounset).toBe(false);
      // mutant 2: pipefail 제거(`set -u`) → pipefail false.
      expect(parseShellStrictness("set -u").pipefail).toBe(false);
      // 원본 판정 불변.
      expect(parseShellStrictness("set -uo pipefail").nounset).toBe(true);
      expect(parseShellStrictness("set -uo pipefail").pipefail).toBe(true);
    });

    it("negative (c) — default 값 drift 변별: HEALTH_TIMEOUT :-180 → :-60(또는 LOG_KEEP :-14 → :-7) 사본에서 default assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalHT = buildEnvOverrideTable().find(
        (e) => e.envName === "HEALTH_TIMEOUT",
      );
      const canonicalLK = buildEnvOverrideTable().find(
        (e) => e.envName === "LOG_KEEP",
      );
      expect(canonicalHT?.default).toBe("180");
      expect(canonicalLK?.default).toBe("14");
      // mutant(모델 사본): default drift.
      const htMutant = { ...(canonicalHT as EnvOverrideEntry), default: "60" };
      const lkMutant = { ...(canonicalLK as EnvOverrideEntry), default: "7" };
      // drift 된 default 라인은 실 소스에 존재하지 않음(회귀 검출).
      expect(hasEnvOverrideLineAnchor(shellSource, htMutant)).toBe(false);
      expect(hasEnvOverrideLineAnchor(shellSource, lkMutant)).toBe(false);
      // 정본 라인은 실 소스에 존재.
      expect(
        hasEnvOverrideLineAnchor(shellSource, canonicalHT as EnvOverrideEntry),
      ).toBe(true);
      expect(
        hasEnvOverrideLineAnchor(shellSource, canonicalLK as EnvOverrideEntry),
      ).toBe(true);
      // 원본 표 불변.
      expect(
        buildEnvOverrideTable().find((e) => e.envName === "HEALTH_TIMEOUT")
          ?.default,
      ).toBe("180");
    });

    it("negative (d) — env→shell 이름 매핑 오배선 drift 변별: DAILY_SMOKE_EMAIL 오배선 사본에서 매핑 assert 실패", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const canonicalEmail = buildEnvOverrideTable().find(
        (e) => e.envName === "DAILY_SMOKE_EMAIL",
      ) as EnvOverrideEntry;
      // 정본 매핑: DAILY_SMOKE_EMAIL → SMOKE_EMAIL, 실 소스에 존재.
      expect(canonicalEmail.shellVar).toBe("SMOKE_EMAIL");
      expect(hasEnvOverrideLineAnchor(shellSource, canonicalEmail)).toBe(true);
      // mutant(모델 사본): env 이름 오배선(다른 env 로) → 실 소스에 그 라인 부재(운영자 계정 미반영 회귀).
      const misWired = { ...canonicalEmail, envName: "WRONG_SMOKE_EMAIL" };
      expect(hasEnvOverrideLineAnchor(shellSource, misWired)).toBe(false);
      // 원본 매핑 불변.
      expect(
        (
          buildEnvOverrideTable().find(
            (e) => e.envName === "DAILY_SMOKE_EMAIL",
          ) as EnvOverrideEntry
        ).shellVar,
      ).toBe("SMOKE_EMAIL");
    });

    it("negative (e) — password default < 8 drift 변별: `pw`(길이 2) 사본에서 smokePasswordMeetsMinLength(..., 8) === false", () => {
      // 정본: 길이 18 ≥ 8 → true.
      expect(smokePasswordMeetsMinLength(SMOKE_PASSWORD_DEFAULT, 8)).toBe(true);
      // mutant(모델 사본): 길이 8 미만 password(auth signup @MinLength(8) 위반 → 400 회귀).
      expect(smokePasswordMeetsMinLength("pw", 8)).toBe(false);
      expect(smokePasswordMeetsMinLength("1234567", 8)).toBe(false); // 길이 7 경계.
      expect(smokePasswordMeetsMinLength("12345678", 8)).toBe(true); // 길이 8 경계.
      // 판정이 서로 다름.
      expect(smokePasswordMeetsMinLength(SMOKE_PASSWORD_DEFAULT, 8)).not.toBe(
        smokePasswordMeetsMinLength("pw", 8),
      );
    });

    it("negative (f) — credential/secret 누출 0: 추출/합성 문자열(앵커·표·resolve 결과)에 gh 토큰 어휘·credential 실값 미등장(§9/REQ-059)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const synthesized = [
        JSON.stringify(buildEnvOverrideTable()),
        JSON.stringify(parseShellStrictness("set -uo pipefail")),
        JSON.stringify(extractPreambleAnchors(shellSource)),
        resolveEnvOverride("REPO_DIR", undefined, "/opt/assessment-agent"),
        resolveEnvOverride("HEALTH_TIMEOUT", "300", "180"),
        String(smokePasswordMeetsMinLength(SMOKE_PASSWORD_DEFAULT, 8)),
      ];
      const credentialPattern =
        /(ghp_|--token|GITHUB_TOKEN|GH_TOKEN|\bBearer\b|Authorization|\bsk-)/i;
      synthesized.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
      // SMOKE_PASSWORD default 는 문서화된 local-test placeholder(34행 주석 근거) — 실 배포 secret 아님.
      expect(shellSource).toContain(PASSWORD_MINLENGTH_COMMENT); // MinLength 주석 = placeholder 근거.
      expect(SMOKE_PASSWORD_DEFAULT).toBe("daily-smoke-pw-2026"); // 문서화된 placeholder.
      // 표 산출에도 gh 토큰 어휘 미등장.
      expect(
        credentialPattern.test(JSON.stringify(buildEnvOverrideTable())),
      ).toBe(false);
    });
  });

  describe("flow: 결정론 · no-mutation", () => {
    it("동일 입력(setLine·shell 소스)으로 pure 함수를 두 번 호출하면 deep-equal(결정론)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(parseShellStrictness("set -uo pipefail")).toEqual(
        parseShellStrictness("set -uo pipefail"),
      );
      expect(buildEnvOverrideTable()).toEqual(buildEnvOverrideTable());
      expect(resolveEnvOverride("REPO_DIR", undefined, "/opt/aa")).toEqual(
        resolveEnvOverride("REPO_DIR", undefined, "/opt/aa"),
      );
      expect(extractPreambleAnchors(shellSource)).toEqual(
        extractPreambleAnchors(shellSource),
      );
    });

    it("pure 함수·추출 보조 함수가 입력(shell 소스·setLine)을 mutate 0(원본 불변)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractPreambleAnchors(shellSource);
      allEnvOverrideLinesPresent(shellSource);
      expect(shellSource).toBe(sourceSnapshot);

      const setLine = "set -uo pipefail";
      const setSnapshot = setLine;
      parseShellStrictness(setLine);
      expect(setLine).toBe(setSnapshot);

      // buildEnvOverrideTable 산출을 mutate 해도 다음 호출은 fresh(공유 참조 노출 0).
      const first = buildEnvOverrideTable();
      first[0].default = "MUTATED";
      expect(buildEnvOverrideTable()[0].default).toBe("/opt/assessment-agent");
    });
  });

  describe("dormant / non-gated 확인 — side-effect 0", () => {
    it("서두 해석 모델이 env / 전역 상태 없이 순수하게 동작(non-gated — 입력은 파라미터로만)", () => {
      // 본 describe 가 실행된다는 것 자체가 describe.skip 0(항상 실행)의 런타임 증거.
      const envSnapshot = { ...process.env };
      const before = parseShellStrictness("set -uo pipefail");
      // 실 process.env 를 mutate 해도 산출 불변 — 모델이 process.env 를 참조하지 않음(파라미터로만).
      Object.assign(process.env, { HEALTH_TIMEOUT: "999" });
      const after = parseShellStrictness("set -uo pipefail");
      delete process.env.HEALTH_TIMEOUT;
      expect(after).toEqual(before);
      expect(Object.keys(process.env)).toEqual(Object.keys(envSnapshot));
      // resolveEnvOverride 도 process.env 미참조 — 파라미터만.
      expect(resolveEnvOverride("HEALTH_TIMEOUT", undefined, "180")).toBe(
        "180",
      );
    });

    it("파일 read 는 deploy/daily-test.sh 읽기만 — 실 bash/set/env-expansion 실행 0(추출 결과가 문자열이지 실행 산출물 아님)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource.startsWith("#!")).toBe(true);
      expect(hasShellStrictnessAnchor(shellSource)).toBe(true);
      expect(allEnvOverrideLinesPresent(shellSource)).toBe(true);
    });
  });
});
