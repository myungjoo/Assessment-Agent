// realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts — 실 평가 e2e
// daily-test `step_eval` command-plan 조립 체인 non-gated build-time smoke (T-0736 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소:
//   - PLAN 109행 step ④(`deploy/daily-test.sh` 의 `step_eval`) 진입 경계는 순수 컴포저
//     `buildRealDataDailyStepEvalCommandPlan(env)`(T-0611) 가 닫는다 — gating 판정을
//     `resolveRealDataE2eLiveGating(env)`(T-0610) 에 위임하고 그 `enabled` 분기를
//     `{ action:"run", argv:[...] }` / `{ action:"skip" }` plan 으로 매핑한다. run 분기는
//     단일-spec bound jest argv(--config + --runTestsByPath)를 합성한다.
//   - 이 컴포저는 컴포저 단위 unit/consistency spec
//     (`realdata-e2e-daily-step-eval-command-plan.spec.ts`) 으로는 닫혀 있으나,
//     **gating → action → jest-argv 합성을 묶은 조립 체인 단위의 non-gated build-time
//     smoke** 는 부재였다 — 즉 action↔gating 오매핑, skip 인데 argv 존재, run 인데 argv
//     config/spec-path drift, argv 길이/순서 어긋남, reason 재포장 같은 조립 surface
//     회귀는 컴포저 unit spec 밖의 조립 레벨에서는 CI 그물이 없었다(sibling 조립 smoke
//     T-0728/T-0729/T-0730/T-0731 은 다른 composer family 만 cover).
//   - 본 spec 은 그 gap 을 정확히 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     동일 조립 surface(fixture env 직접 주입 → command-plan 컴포저 → gating→action→argv
//     합성) 를 검증한다. live leg(실 LLM / 네트워크 / DB / Ollama / orchestrator / 실 jest
//     spawn) 는 복제하지 않고, gating→action→argv 조립만 검증한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. gating→action→
//         argv 조립만 — 실 평가 실행은 본 컴포저 범위 밖.
//      🔥 실 네트워크 호출 0 — github / Ollama 호출 0. fetch 0. 실 jest 프로세스 spawn 0.
//      🔥 process.env 읽기 0 — fixture env 객체를 직접 주입(env-gated describe.skip 금지).
//      🔥 credential 0 echo — argv 는 spec 경로 + config flag 만. 주입한 token-like
//         fixture 값이 argv 어디에도 나타나지 않음(§9).
//      🔥 새 외부 dependency 0 — 기존 build*/gating 컴포저 import 재사용만(consistency-
//         guard 신설 금지 — sweep 종결, T-0726).
//
// build-time consistency-guard sweep(T-0584~T-0726) 종결과 직교한 조립 레벨 그물이며,
// T-0728/T-0729/T-0730/T-0731 의 file-disjoint 병렬 sibling 이다. 컴포저 unit spec 가 닫지
// 못하는 조립 레벨 회귀를 non-gated 로 cover 한다.
//
// Out of Scope (T-0736):
//   - T-0728/T-0729/T-0730/T-0731 의 기존 조립 smoke 파일 — 절대 건드리지 않음(file-disjoint 병렬).
//   - 실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 live smoke 실행.
//   - 컴포저 소스(`realdata-e2e-daily-step-eval-command-plan.ts`) / gating helper /
//     consistency 가드 수정 — test-only(신규 smoke spec 1 파일).
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만(sweep 종결).
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepEvalCommandPlan,
  REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG,
} from "../helpers/realdata-e2e-daily-step-eval-command-plan";
import {
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
} from "../helpers/realdata-e2e-live-gating";

// gating env 7 종 모두 set 된 완전 fixture — happy-path("run") 진입용. 실 credential 0,
// 결정론 placeholder 값만(token-like 값은 argv echo 부재 검증에도 재사용). process.env
// 읽기 0 — 본 객체를 컴포저에 직접 주입한다.
function fullGatingEnv(): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: "http://localhost:11434/v1",
    [REALDATA_E2E_LLM_API_KEY_ENV]: "smoke-fixture-api-key-TOKENLIKE",
    [REALDATA_E2E_LLM_MODEL_ENV]: "smoke-fixture-model",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "openai-compatible",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-smoke",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: "ghp_smokeFixturePAT_TOKENLIKE",
  };
}

// argv echo 부재 검증에 쓸 token-like 값 집합 — 위 fixture 가 주입하는 credential-성 값들.
// run 분기 argv 어디에도 이 값이 나타나면 안 된다(§9).
const TOKENLIKE_VALUES = [
  "http://localhost:11434/v1",
  "smoke-fixture-api-key-TOKENLIKE",
  "smoke-fixture-model",
  "openai-compatible",
  "2024-smoke",
  "ghp_smokeFixturePAT_TOKENLIKE",
];

// run 분기가 산출해야 할 canonical 4-요소 argv 벡터 — config flag + smoke config + 단일
// spec bound. 컴포저 상수로부터 유도(하드코딩 drift 방지).
const CANONICAL_RUN_ARGV = [
  "--config",
  REALDATA_E2E_SMOKE_JEST_CONFIG,
  "--runTestsByPath",
  REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
];

describe("Smoke(non-gated): 실 평가 e2e daily-test step_eval command-plan 조립 체인(env→{action,argv,reason}) live 0 검증", () => {
  describe("happy path — gating 완전 set → action=run + canonical argv", () => {
    it("gating env 7 종 완전 set → action='run' + argv 가 canonical 4-요소 벡터 + reason 전파", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());

      expect(plan.action).toBe("run");
      // argv 가 canonical 4-요소 벡터와 정확히 일치(config flag + smoke config + 단일 spec bound).
      expect(plan.argv).toEqual(CANONICAL_RUN_ARGV);
      // reason 은 gating helper 의 활성 사유를 전파(비공백, 사람 보고용).
      expect(typeof plan.reason).toBe("string");
      expect(plan.reason.length).toBeGreaterThan(0);
    });

    it("run 분기 argv 의 요소·순서가 정확 — 길이 4 + 각 위치의 flag/값 1:1 정합", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());

      expect(plan.argv).toBeDefined();
      expect(plan.argv).toHaveLength(4);
      expect(plan.argv?.[0]).toBe("--config");
      expect(plan.argv?.[1]).toBe(REALDATA_E2E_SMOKE_JEST_CONFIG);
      expect(plan.argv?.[2]).toBe("--runTestsByPath");
      expect(plan.argv?.[3]).toBe(REALDATA_E2E_LIVE_SMOKE_SPEC_PATH);
    });
  });

  describe("skip path — gating 부재 → action=skip + argv undefined", () => {
    it("gating env 전무({}) → action='skip' + argv === undefined + reason 전파(조용한 SKIP, throw 0)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan({});

      expect(plan.action).toBe("skip");
      // skip 분기는 argv 를 명시적으로 두지 않음(caller 가 잘못 spawn 하지 않도록 부재).
      expect(plan.argv).toBeUndefined();
      expect(typeof plan.reason).toBe("string");
      expect(plan.reason.length).toBeGreaterThan(0);
    });
  });

  describe("flow / branch — run/skip 두 분기 각각 1:1 도달", () => {
    it("완전 gating → run 분기(argv 존재)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());
      expect(plan.action).toBe("run");
      expect(plan.argv).toBeDefined();
    });

    it("빈 env → skip 분기(argv 부재)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan({});
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });
  });

  describe("negative cases — 불완전 gating 은 run 으로 새지 않음 + credential echo 0", () => {
    it("(a) 빈 env({}) → skip(완전성 미충족, run 으로 새지 않음)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan({});
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    it("(b) enable flag 만 set, 나머지 누락 → skip(부분-set 은 run 으로 새지 않음)", () => {
      const partial: NodeJS.ProcessEnv = {
        [REALDATA_E2E_LIVE_TEST_ENV]: "1",
      };
      const plan = buildRealDataDailyStepEvalCommandPlan(partial);
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    it("(b') github PAT 1 종만 누락 → skip(필수 키 일부 누락 = 불완전 gating)", () => {
      const partial = fullGatingEnv();
      delete partial[REALDATA_E2E_GITHUB_READ_PAT_ENV];
      const plan = buildRealDataDailyStepEvalCommandPlan(partial);
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    it("(b'') LLM base URL 만 공백-only → skip(공백 값은 부재와 동일, run 으로 새지 않음)", () => {
      const partial = fullGatingEnv();
      partial[REALDATA_E2E_LLM_BASE_URL_ENV] = "   ";
      const plan = buildRealDataDailyStepEvalCommandPlan(partial);
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    it("run 분기 argv 가 실 credential 값을 echo 하지 않음 — argv 는 spec 경로·config flag 만(§9)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());
      expect(plan.action).toBe("run");

      const joinedArgv = (plan.argv ?? []).join(" ");
      for (const tokenLike of TOKENLIKE_VALUES) {
        expect(joinedArgv).not.toContain(tokenLike);
      }
    });

    it("run 분기 reason 도 실 credential 값을 echo 하지 않음(§9 — reason 은 활성 사실만)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(fullGatingEnv());
      for (const tokenLike of TOKENLIKE_VALUES) {
        expect(plan.reason).not.toContain(tokenLike);
      }
    });
  });

  describe("결정론 · 무공유 — 동일 입력 두 호출의 deep-equal + 참조 비공유 + 입력 불변", () => {
    it("(c) 같은 완전 env 두 호출 → plan deep-equal 이면서 plan · plan.argv 참조 비공유(새 배열)", () => {
      const env = fullGatingEnv();
      const a = buildRealDataDailyStepEvalCommandPlan(env);
      const b = buildRealDataDailyStepEvalCommandPlan(env);

      // deep-equal 산출(결정론).
      expect(a).toEqual(b);
      // 새 plan 컨테이너 + 새 argv 배열 — 두 호출이 같은 reference 를 공유하지 않음.
      expect(a).not.toBe(b);
      expect(a.argv).not.toBe(b.argv);
    });

    it("(c') 같은 빈 env 두 호출 → skip plan deep-equal(argv 둘 다 undefined)", () => {
      const a = buildRealDataDailyStepEvalCommandPlan({});
      const b = buildRealDataDailyStepEvalCommandPlan({});
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it("(d) 입력 env 객체가 호출 전후로 mutate 되지 않음(run 분기)", () => {
      const env = fullGatingEnv();
      const before = JSON.parse(JSON.stringify(env));

      buildRealDataDailyStepEvalCommandPlan(env);

      // 호출 후 입력 env 내용 동형(읽기 전용, mutate 0).
      expect(env).toEqual(before);
    });

    it("(d') 입력 env 객체가 호출 전후로 mutate 되지 않음(skip 분기)", () => {
      const env: NodeJS.ProcessEnv = {
        [REALDATA_E2E_LIVE_TEST_ENV]: "1",
      };
      const before = JSON.parse(JSON.stringify(env));

      buildRealDataDailyStepEvalCommandPlan(env);

      expect(env).toEqual(before);
    });
  });
});
