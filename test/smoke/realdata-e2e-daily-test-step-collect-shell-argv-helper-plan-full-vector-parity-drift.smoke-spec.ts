// realdata-e2e-daily-test-step-collect-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts
// — 실 평가 e2e step④ `deploy/daily-test.sh` `step_collect` 의 하드코딩 jest argv ↔ 그 정본
// (canonical source) TS helper `buildRealDataDailyStepCollectCommandPlan(env).argv`(run 분기)
// full-ordered-vector cross-artifact(bash↔TS) drift-detection non-gated build-time smoke
// (T-0889 박제, PLAN.md 109행 🟢 실 평가 e2e step④ collect-leg).
//
// 본 spec 의 존재 이유 — cross-artifact parity gap 해소(eval-leg T-0790 mirror):
//   - PLAN 109행 step④ 는 `deploy/daily-test.sh` 가 nightly 로 실 github 수집 leg + 실 LLM
//     평가 leg 를 각 1 회 round-trip 하는 자율 실 평가 e2e 다. T-0888(PR #782, merged)이 그
//     수집 leg 를 배선하는 bash `step_collect()` 를 추가했고, 그 jest argv 는 **정본
//     (canonical source)** 인 TS helper `buildRealDataDailyStepCollectCommandPlan(env).argv`
//     (run 분기)를 손으로 mirror 한 사본이다(`deploy/daily-test.sh` 209~222행).
//   - 이 정본-사본 parity 는 origin/main 시점에 **약하게만** 검증됐다:
//      (1) bash test `deploy/daily-test-step-collect.test.sh`(T-0888) 는 argv 를
//          substring/grep-presence 로만 검사 — full-ordered 벡터·순서·길이·flag↔value
//          페어링 parity 0(순서가 뒤집히거나 flag 가 추가/누락돼도 못 잡음).
//      (2) TS 측은 helper `buildRealDataDailyStepCollectCommandPlan` 을 in-memory 단독
//          검증(T-0887 unit)만 하고 실 `deploy/daily-test.sh` bash 배선을 읽지 않는다.
//     → 실 shell 파일 argv 토큰을 읽어 helper 정본 ordered 벡터와 byte-identical 대조하는
//        smoke 0 부재.
//   - 본 spec 은 그 빈 자리를 메운다 — `deploy/daily-test.sh` 를 `readFileSync` 로 읽어
//     `step_collect()` 함수 본문에서 jest argv 토큰을 추출하고, gating-enabled env 로
//     helper 를 호출해 run-branch `.argv`(4-요소 ordered 벡터) 를 expected 로 삼아
//     shell 사본 ↔ helper 정본의 full-ordered-vector byte-identical parity 를 단언한다.
//     이 parity 가 깨지면(flag reorder·config 경로 변경·helper 상수만 갱신 등) 정본과
//     사본이 silent 분기 → nightly e2e 가 잘못된 jest 호출 → 무인 모니터링 false 신호.
//
//      🔥 실 LLM 호출 0 / 실 네트워크 0 / 실 jest 프로세스 spawn 0 / DB 0 — 파일 read +
//         in-memory helper 호출만. `deploy/daily-test.sh` 는 읽기만(실행/source 0).
//      🔥 process.env 읽기 0 — fixture env 객체를 직접 주입(non-gated 항상 실행,
//         describe.skip / gating 분기 0).
//      🔥 credential 0 echo — argv 는 spec 경로 + config flag 만. 주입한 placeholder
//         credential 값이 plan.argv / plan.reason / shell 추출 argv 어디에도 미surface(§9).
//      🔥 새 외부 dependency 0 — 기존 helper export + node 내장(`fs`/`path`) import 만.
//
// Out of Scope (T-0889):
//   - src 변경 0 — helper / 상수 / type 은 비교 source 로 import 만(변경 0).
//   - `deploy/daily-test.sh` 변경 0 — readFileSync 로 읽기만. step_collect/argv 미수정
//     (drift 가 실제로 발견되면 별도 fix task — 본 task 는 검증 smoke 신설만).
//   - `deploy/daily-test-step-collect.test.sh`(T-0888 bash test) 변경/재구현 0 — 상보적
//     TS smoke(substring-presence 를 full-vector parity 로 보완하되 bash test 는 그대로).
//   - 실 `deploy/daily-test.sh` 실행 / source / 실 jest spawn / 실 redeploy·health·
//     liveness·auth·eval·collect step 실행 0.
//   - helper 조립 로직·gating 판정 분기 재단언 0(T-0887/gating spec cover). 본 task 는
//     helper 산출 argv 를 expected 로 사용만(로직 재현 0).
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync } from "fs";
import * as path from "path";

import {
  buildRealDataDailyStepCollectCommandPlan,
  REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG,
} from "../helpers/realdata-e2e-daily-step-collect-command-plan";
import type { RealDataDailyStepCollectCommandPlan } from "../helpers/realdata-e2e-daily-step-collect-command-plan";
import {
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
} from "../helpers/realdata-e2e-live-gating";

// eval-leg live smoke spec 경로 — collect 사본이 실수로 eval spec 을 가리키는 교차오염을
// 검출하는 negative 합성에만 쓰는 literal(collect helper 는 이 상수를 export 하지 않는다).
const EVAL_LEG_LIVE_SMOKE_SPEC_PATH =
  "test/smoke/realdata-e2e-live.smoke-spec.ts";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const DAILY_TEST_SH_PATH = path.join(REPO_ROOT, "deploy/daily-test.sh");

// gating-enabled fixture env — 7 종 모두 set(credential 은 결정론 placeholder 만, §9).
// token-like 값은 argv echo 부재 검증(credential 누출 0)에도 재사용한다. process.env
// 읽기 0 — 본 객체를 helper 에 직접 주입한다.
const FAKE_CREDENTIAL_TOKEN = "ghp_FAKE_PLACEHOLDER_TOKEN_0000000000000000";
const FAKE_LLM_API_KEY = "sk-FAKE_LLM_KEY_PLACEHOLDER_0000";

function buildGatingEnabledEnv(): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: "http://placeholder.invalid:11434/v1",
    [REALDATA_E2E_LLM_API_KEY_ENV]: FAKE_LLM_API_KEY,
    [REALDATA_E2E_LLM_MODEL_ENV]: "placeholder-model",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "openai-compatible",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-01-01",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: FAKE_CREDENTIAL_TOKEN,
  };
}

// shell 소스의 `step_collect()` 함수 본문에서 jest argv 토큰을 추출하는 보조 함수.
//
// `deploy/daily-test.sh` 214~216행은 multi-line line-continuation(`\`) 으로 jest argv 를
// 박는다:
//
//   if ( cd "$REPO_DIR" && pnpm exec jest \
//         --config ./test/jest-smoke.json \
//         --runTestsByPath test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts ) >>"$LOG_FILE" 2>&1; then
//
// 추출 전략(line-prefix·whitespace·line-continuation drift 에 robust):
//   1. `step_collect()` 함수 본문(여는 `step_collect() {` ~ 매칭 닫는 `}`)을 슬라이스한다.
//      함수 밖(다른 step·주석)의 우연한 토큰을 오염원으로 끌어오지 않기 위함.
//   2. 함수 본문에서 `pnpm exec jest` 이후 `)` 직전까지의 argv 영역만 잘라낸다.
//   3. line-continuation `\` 와 개행을 공백으로 정규화하고 whitespace 로 split 해
//      `--config`·`--runTestsByPath` flag 와 그 value 토큰을 ordered 로 모은다.
//
// 반환: jest 실행 파일명(`jest`)·redirection·`cd` 등을 제외한 순수 argv ordered 배열.
// argv 영역을 못 찾으면 빈 배열을 반환한다(silent 0-byte fallback 방지는 호출측 단언이
// 담당 — 빈 배열이면 helper 4-요소 벡터와 not.toEqual 로 fail).
function extractStepCollectJestArgv(shellSource: string): string[] {
  // (1) step_collect 함수 본문 슬라이스 — `step_collect() {` 부터 닫는 `}` 까지.
  const fnHeaderMatch = shellSource.match(/step_collect\s*\(\)\s*\{/);
  if (!fnHeaderMatch || fnHeaderMatch.index === undefined) {
    return [];
  }
  const bodyStart = fnHeaderMatch.index + fnHeaderMatch[0].length;
  // 함수 닫는 `}` 는 줄 시작(들여쓰기 0)에 단독으로 오는 첫 `}` 로 간주(bash 관례).
  const closeMatch = shellSource.slice(bodyStart).match(/\n\}/);
  const bodyEnd =
    closeMatch && closeMatch.index !== undefined
      ? bodyStart + closeMatch.index
      : shellSource.length;
  const fnBody = shellSource.slice(bodyStart, bodyEnd);

  // (2) `pnpm exec jest` 이후 ~ argv 영역을 닫는 `)` 직전까지 슬라이스.
  const jestMarker = "pnpm exec jest";
  const jestIdx = fnBody.indexOf(jestMarker);
  if (jestIdx < 0) {
    return [];
  }
  const afterJest = fnBody.slice(jestIdx + jestMarker.length);
  // argv 는 `)` (subshell 닫기) 직전까지. redirection(`>>"$LOG_FILE"`) 은 그 뒤라 제외됨.
  const closeParenIdx = afterJest.indexOf(")");
  const argvRegion =
    closeParenIdx >= 0 ? afterJest.slice(0, closeParenIdx) : afterJest;

  // (3) line-continuation `\` + 개행 정규화 → whitespace split → 빈 토큰 제거.
  const tokens = argvRegion
    .replace(/\\\s*\n/g, " ") // line-continuation `\` + 개행 → 공백
    .replace(/\n/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  return tokens;
}

// helper run-branch plan 을 좁혀 argv(string[]) 를 보장하는 헬퍼(type narrowing).
function expectRunPlanArgv(
  plan: RealDataDailyStepCollectCommandPlan,
): string[] {
  expect(plan.action).toBe("run");
  expect(Array.isArray(plan.argv)).toBe(true);
  // run 분기는 argv 가 반드시 존재(narrowing). skip 분기였다면 위 단언이 먼저 fail.
  return plan.argv as string[];
}

describe("realdata-e2e step④ daily-test.sh step_collect shell argv ↔ helper run-branch argv full-vector parity drift smoke (T-0889)", () => {
  describe("Happy-path: shell argv 추출 + helper run-branch argv 산출", () => {
    it("실 deploy/daily-test.sh 를 읽어 step_collect argv 추출 + gating-enabled env helper 호출이 run plan 을 낸다", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );

      expect(plan.action).toBe("run");
      expect(Array.isArray(plan.argv)).toBe(true);
      expect(shellArgv.length).toBeGreaterThan(0);
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 daily-test.sh 가 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource).toContain("step_collect()");
      expect(shellSource).toContain("pnpm exec jest");
    });
  });

  describe("full-ordered-vector byte-identical parity 수렴(핵심 불변식)", () => {
    it("shell step_collect 추출 argv 가 helper run-branch argv 와 byte-identical(toEqual — 순서·길이·요소 1:1)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      // substring-presence 가 아니라 ordered-vector equality — flag reorder·요소 추가/누락·
      // 값 drift 를 모두 검출한다. 이것이 본 smoke 의 새 표면(정본=사본 full-vector).
      expect(shellArgv).toEqual(helperArgv);
    });
  });

  describe("요소별 위치-정합 1:1 수렴(핵심 불변식 2)", () => {
    it("추출 argv 의 각 위치가 canonical 토큰·상수와 일치하고 length === 4", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);

      expect(shellArgv).toHaveLength(4);
      expect(shellArgv[0]).toBe("--config");
      expect(shellArgv[1]).toBe(REALDATA_E2E_SMOKE_JEST_CONFIG);
      expect(shellArgv[2]).toBe("--runTestsByPath");
      expect(shellArgv[3]).toBe(REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH);
    });

    it("추출 argv 의 각 요소가 helper argv[i] 와 위치별 일치(flag↔value 페어링·길이 정합)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      expect(shellArgv).toHaveLength(helperArgv.length);
      helperArgv.forEach((token, i) => {
        expect(shellArgv[i]).toBe(token);
      });
    });
  });

  describe("helper 상수 ↔ shell 사본 토큰 1:1 수렴", () => {
    it("helper export 상수가 shell 소스에 literal 로 등장하고 추출 argv 대응 요소와 byte-identical", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);

      // 상수가 정본인데 shell 사본이 literal 로 박제됐음을 cross-check.
      expect(shellSource).toContain(REALDATA_E2E_SMOKE_JEST_CONFIG);
      expect(shellSource).toContain(
        REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
      );
      expect(shellArgv[1]).toBe(REALDATA_E2E_SMOKE_JEST_CONFIG);
      expect(shellArgv[3]).toBe(REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH);
    });
  });

  describe("skip-branch argv 부재 boundary 수렴(REQ-059 / §9 경계)", () => {
    it("gating-disabled env → plan.action skip · plan.argv undefined, shell 측도 mark collect SKIP 분기 존재", () => {
      const env = buildGatingEnabledEnv();
      delete env[REALDATA_E2E_GITHUB_READ_PAT_ENV]; // 7 종 중 1 부재 → skip
      const plan = buildRealDataDailyStepCollectCommandPlan(env);

      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();

      // shell 측 정합 — gating 부재 시 jest spawn 0(mark collect SKIP) 분기가 소스에 존재.
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      expect(shellSource).toContain("mark collect SKIP");
      expect(shellSource).toContain("realdata_eval_gating_enabled");
      // ORDER 에 collect step 이 등재돼 nightly runner 가 collect leg 를 순회함을 확인.
      expect(shellSource).toContain("collect");
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("추출 argv 의 한 요소를 mutate 한 사본은 helper argv 와 not.toEqual(원본은 mutate 0)", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      // 사본만 변형 — config 값 drift 모사.
      const mutatedValue = [...shellArgv];
      mutatedValue[1] = "./test/jest.json";
      expect(mutatedValue).not.toEqual(helperArgv);

      // flag 순서 swap 모사([0]↔[2]).
      const mutatedOrder = [...shellArgv];
      [mutatedOrder[0], mutatedOrder[2]] = [mutatedOrder[2], mutatedOrder[0]];
      expect(mutatedOrder).not.toEqual(helperArgv);

      // 원본 추출 argv 는 mutate 0 — 여전히 helper 정본과 byte-identical.
      expect(shellArgv).toEqual(helperArgv);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("shell 파일 부재 경로 → readFileSync 가 throw(ENOENT, silent 0-byte fallback 0)", () => {
      const badPath = path.join(REPO_ROOT, "deploy/__does_not_exist__.sh");
      expect(() => readFileSync(badPath, "utf8")).toThrow();
    });

    it("step_collect 함수 부재 합성 shell → 추출 결과 빈 배열(argv 못 찾음이 silent PASS 로 미누출)", () => {
      const noStepCollect = "#!/bin/bash\necho noop\n";
      const argv = extractStepCollectJestArgv(noStepCollect);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      expect(argv).toEqual([]);
      // 빈 배열은 helper 4-요소 벡터와 결코 같지 않음 → 함수 본문 소실 시 본 smoke 가 fail.
      expect(argv).not.toEqual(helperArgv);
    });

    it("flag 누락 합성 shell(--config 만, --runTestsByPath 부재) → 추출 argv 가 helper 벡터와 not.toEqual", () => {
      const missingFlag = [
        "#!/bin/bash",
        "step_collect() {",
        "  if ( cd x && pnpm exec jest \\",
        "        --config ./test/jest-smoke.json ); then",
        "    return 0",
        "  fi",
        "}",
      ].join("\n");
      const argv = extractStepCollectJestArgv(missingFlag);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      expect(argv).not.toEqual(helperArgv); // 길이/요소 mismatch
      expect(argv).not.toContain("--runTestsByPath");
    });

    it("순서 뒤집힘 합성 shell(runTestsByPath → config) → 추출 argv 가 helper 벡터와 not.toEqual", () => {
      // substring-presence(grep -q) 였다면 두 토큰이 다 등장하므로 PASS 했을 케이스 —
      // ordered-vector parity 에서는 FAIL(순서 민감)임을 박제(기존 grep 대비 우월성).
      const swappedOrder = [
        "#!/bin/bash",
        "step_collect() {",
        "  if ( cd x && pnpm exec jest \\",
        "        --runTestsByPath test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts \\",
        "        --config ./test/jest-smoke.json ); then",
        "    return 0",
        "  fi",
        "}",
      ].join("\n");
      const argv = extractStepCollectJestArgv(swappedOrder);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      // 두 토큰 쌍 모두 존재(substring 이면 PASS) — 그러나 순서가 다르므로 not.toEqual.
      expect(argv).toContain("--config");
      expect(argv).toContain("--runTestsByPath");
      expect(argv).not.toEqual(helperArgv);
    });

    it("eval-leg spec 교차오염 합성 shell(collect 가 eval spec 을 가리킴) → 추출 argv 가 helper 벡터와 not.toEqual", () => {
      // collect 사본이 실수로 eval-leg live smoke spec 을 박으면 두 leg argv 가 spec 경로만
      // 다르므로 collection helper 정본 벡터와 not.toEqual(교차오염 0 을 박제).
      const crossContaminated = [
        "#!/bin/bash",
        "step_collect() {",
        "  if ( cd x && pnpm exec jest \\",
        "        --config ./test/jest-smoke.json \\",
        `        --runTestsByPath ${EVAL_LEG_LIVE_SMOKE_SPEC_PATH} ); then`,
        "    return 0",
        "  fi",
        "}",
      ].join("\n");
      const argv = extractStepCollectJestArgv(crossContaminated);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      // spec 요소가 eval-leg spec 으로 잘못 박제됨 — collection helper 벡터와 not.toEqual.
      expect(argv).toContain(EVAL_LEG_LIVE_SMOKE_SPEC_PATH);
      expect(argv).not.toContain(
        REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
      );
      expect(argv).not.toEqual(helperArgv);
    });

    it("gating env 부분-부재마다 skip(서로 다른 키 2+ 케이스 각각 action skip · argv undefined)", () => {
      const keysToOmit = [
        REALDATA_E2E_LIVE_TEST_ENV,
        REALDATA_E2E_LLM_BASE_URL_ENV,
        REALDATA_E2E_LLM_MODEL_ENV,
        REALDATA_E2E_GITHUB_READ_PAT_ENV,
      ];
      keysToOmit.forEach((key) => {
        const env = buildGatingEnabledEnv();
        delete env[key];
        const plan = buildRealDataDailyStepCollectCommandPlan(env);
        expect(plan.action).toBe("skip");
        expect(plan.argv).toBeUndefined();
      });
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("placeholder credential 이 plan.argv · plan.reason · shell 추출 argv 어디에도 미surface", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const shellArgv = extractStepCollectJestArgv(shellSource);
      const plan = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const helperArgv = expectRunPlanArgv(plan);

      const credentialPattern =
        /(ghp_FAKE_PLACEHOLDER|sk-FAKE_LLM_KEY|GH_TOKEN|Bearer|Authorization|x-access-token|x-github-token)/i;

      const haystacks = [
        helperArgv.join(" "),
        plan.reason,
        shellArgv.join(" "),
      ];
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 shell 소스·동일 env 로 두 번 추출+helper 호출 → 두 번 byte-identical deep-equal", () => {
      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const argv1 = extractStepCollectJestArgv(shellSource);
      const argv2 = extractStepCollectJestArgv(shellSource);
      const plan1 = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );
      const plan2 = buildRealDataDailyStepCollectCommandPlan(
        buildGatingEnabledEnv(),
      );

      expect(argv1).toEqual(argv2);
      expect(plan1.argv).toEqual(plan2.argv);
    });

    it("helper 호출이 입력 env 를 mutate 0 · 추출 함수가 입력 shell 문자열을 mutate 0", () => {
      const env = buildGatingEnabledEnv();
      const envSnapshot = { ...env };
      buildRealDataDailyStepCollectCommandPlan(env);
      expect(env).toEqual(envSnapshot);

      const shellSource = readFileSync(DAILY_TEST_SH_PATH, "utf8");
      const sourceSnapshot = shellSource;
      extractStepCollectJestArgv(shellSource);
      expect(shellSource).toBe(sourceSnapshot);
    });
  });
});
