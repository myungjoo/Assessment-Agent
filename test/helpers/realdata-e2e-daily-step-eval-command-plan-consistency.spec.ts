// realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts — T-0693 colocated
// unit spec.
//
// R-112 cover 구조:
//   - happy-path: gating 활성(env 7 종 set) → run plan 정합 / gating 부재(빈 env) →
//     skip plan 정합 각각 가드가 void(throw 0) 임을 검증. 정상 입력의 양 분기(run/skip)
//     모두 통과 확인.
//   - error path(TypeError): plan null/undefined/배열/원시, env null/배열/원시 각 1+.
//   - flow/branch: 구조(TypeError) vs 값 정합(RangeError) 분리 + 원소 내 fail-fast
//     순서(구조 → action enum → 매핑 → 분기별 argv → reason).
//   - negative 충분 cover(Acceptance ①~⑥): action↔gating 오매핑, argv config drift,
//     argv spec-path drift, argv 길이/순서 어긋남, action="skip" 인데 argv 존재, reason
//     재포장 각 1+ test. 메시지에 기대/실측 정보 포함 검증.
//   - 결정론·무공유: 정합 호출이 plan / env 객체를 mutate 하지 않는다.
import {
  buildRealDataDailyStepEvalCommandPlan,
  REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG,
  type RealDataDailyStepEvalCommandPlan,
} from "./realdata-e2e-daily-step-eval-command-plan";
import { assertRealDataDailyStepEvalCommandPlanConsistentWithGating } from "./realdata-e2e-daily-step-eval-command-plan-consistency";
import {
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
} from "./realdata-e2e-live-gating";

// gating env 7 종 모두 set 된 활성 env fixture — 기존 컴포저 spec 의 fixture 모양을
// 차용(sentinel 값은 본 spec 안 별도 의미 없음, argv/reason 비교용).
function makeEnabledEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: "http://ollama.test.local:11434/v1",
    [REALDATA_E2E_LLM_API_KEY_ENV]: "sk-test-key",
    [REALDATA_E2E_LLM_MODEL_ENV]: "llama3.1:8b",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "openai-compatible",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-02-15",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: "ghp_test_pat",
    ...overrides,
  };
}

// buildConsistent — 컴포저로 정합 plan 합성(happy-path source). negative 는 그 산출을
// 의도적으로 변형한다.
function buildConsistent(
  env: NodeJS.ProcessEnv,
): RealDataDailyStepEvalCommandPlan {
  return buildRealDataDailyStepEvalCommandPlan(env);
}

describe("assertRealDataDailyStepEvalCommandPlanConsistentWithGating", () => {
  describe("happy path (정합 → void)", () => {
    it("gating 활성(env 7 종 set) → run plan 정합 → void", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(plan.action).toBe("run");
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).not.toThrow();
    });

    it("gating 부재(빈 env) → skip plan 정합 → void(반환값 undefined)", () => {
      const env: NodeJS.ProcessEnv = {};
      const plan = buildConsistent(env);
      expect(plan.action).toBe("skip");
      expect(
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toBeUndefined();
    });

    it("gating 부분 set(PAT 만 부재) → skip plan 정합 → void", () => {
      const env = makeEnabledEnv({
        [REALDATA_E2E_GITHUB_READ_PAT_ENV]: undefined,
      });
      const plan = buildConsistent(env);
      expect(plan.action).toBe("skip");
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).not.toThrow();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("plan=null → TypeError('null' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          null as unknown as RealDataDailyStepEvalCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*null/);
    });

    it("plan=undefined → TypeError('undefined' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          undefined as unknown as RealDataDailyStepEvalCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*undefined/);
    });

    it("plan=배열 → TypeError('array' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          [] as unknown as RealDataDailyStepEvalCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*array/);
    });

    it("plan=string → TypeError('string' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          "not-a-plan" as unknown as RealDataDailyStepEvalCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*string/);
    });

    it("env=null → TypeError('null' 라벨)", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          plan,
          null as unknown as NodeJS.ProcessEnv,
        ),
      ).toThrow(/env 가 객체가 아니다.*null/);
    });

    it("env=배열 → TypeError('array' 라벨)", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          plan,
          [] as unknown as NodeJS.ProcessEnv,
        ),
      ).toThrow(/env 가 객체가 아니다.*array/);
    });

    it("env=string → TypeError('string' 라벨)", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(
          plan,
          "nope" as unknown as NodeJS.ProcessEnv,
        ),
      ).toThrow(/env 가 객체가 아니다.*string/);
    });
  });

  describe("flow / branch — fail-fast 순서(구조 → action enum → 매핑 → 분기별 → reason)", () => {
    it("값 정합 위반(action enum)은 RangeError 이고 TypeError 가 아니다", () => {
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "INVALID" as unknown as "run",
        reason: "any",
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(RangeError);
    });

    it('action enum 위반("running") → RangeError(실측 값 노출)', () => {
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "running" as unknown as "run",
        reason: "any",
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.action 이 "run"\/"skip" 외 값이다.*running/);
    });

    it("action 매핑 검증이 reason 검증보다 먼저 throw", () => {
      // gating.enabled=true 인데 action="skip" + reason 도 일부러 다르게 설정 →
      // 매핑 에러 메시지가 먼저 나와야 한다.
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "skip",
        reason: "totally wrong",
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.action 이 gating\.enabled 와 어긋난다/);
    });

    it("run 분기 argv 검증이 reason 검증보다 먼저 throw", () => {
      // action/매핑 ok, argv 어긋남 + reason 도 어긋남 → argv 메시지가 먼저.
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--config",
          "wrong-config.json",
          "--runTestsByPath",
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
        ],
        reason: "wrong reason",
      };
      expect(correct.reason).not.toBe(plan.reason);
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.argv\[1\] 가 canonical 벡터와 다르다/);
    });
  });

  describe("negative 충분 cover — 예외 상황 분기마다(Acceptance ①~⑥)", () => {
    // (①a) action↔gating.enabled 오매핑: gating.enabled=true 인데 action="skip"
    it('(①a) gating.enabled=true 인데 action="skip" → RangeError(매핑)', () => {
      const env = makeEnabledEnv();
      const correctRun = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "skip",
        reason: correctRun.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(
        /plan\.action 이 gating\.enabled 와 어긋난다.*gating\.enabled=true/,
      );
      // 기대는 "run", 실측은 "skip" — 메시지에 둘 다 노출.
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/기대=.*run.*실측=.*skip/);
    });

    // (①b) action↔gating.enabled 오매핑: gating.enabled=false 인데 action="run"
    it('(①b) gating.enabled=false 인데 action="run" → RangeError(매핑)', () => {
      const env: NodeJS.ProcessEnv = {};
      const correctSkip = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
        ],
        reason: correctSkip.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/gating\.enabled=false.*기대=.*skip.*실측=.*run/);
    });

    // (②) argv config drift (`REALDATA_E2E_SMOKE_JEST_CONFIG` 와 다른 값)
    it("(②) run 분기 argv config drift → RangeError(어긋난 index + 기대/실측)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--config",
          "./test/jest-different.json",
          "--runTestsByPath",
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(
        /plan\.argv\[1\] 가 canonical 벡터와 다르다.*기대=.*jest-smoke\.json.*실측=.*jest-different\.json/,
      );
    });

    // (③) argv spec-path drift (`REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` 와 다른 값)
    it("(③) run 분기 argv spec-path drift → RangeError(index=3 어긋남)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          "test/smoke/realdata-e2e-different.smoke-spec.ts",
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.argv\[3\] 가 canonical 벡터와 다르다/);
    });

    // (④a) argv 길이 짧음 (--runTestsByPath 누락 등)
    it("(④a) run 분기 argv 길이 짧음(3-요소) → RangeError(길이 기대/실측)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.argv 길이가 canonical 벡터와 다르다.*기대=4.*실측=3/);
    });

    // (④b) argv 순서 어긋남 (--config 와 --runTestsByPath 위치 swap)
    it("(④b) run 분기 argv 순서 어긋남 → RangeError(index=0 부터)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--runTestsByPath",
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.argv\[0\] 가 canonical 벡터와 다르다/);
    });

    // (④c) run 분기 argv 부재(undefined)
    it("(④c) run 분기 argv 부재(undefined) → RangeError(부재)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.argv 가 부재\(undefined\)다/);
    });

    // (④d) run 분기 argv 비-배열(객체)
    it("(④d) run 분기 argv 비-배열(객체) → RangeError(배열 아님)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: {} as unknown as string[],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.argv 가 배열이 아니다.*object/);
    });

    // (⑤) action="skip" 인데 argv 존재 (caller 가 잘못 spawn 유발)
    it('(⑤) action="skip" 인데 argv 존재 → RangeError(잘못 spawn 위험)', () => {
      const env: NodeJS.ProcessEnv = {};
      const correctSkip = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "skip",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
        ],
        reason: correctSkip.reason,
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(/plan\.action="skip" 인데 plan\.argv 가 존재한다.*array/);
    });

    // (⑥) reason 재포장 (gating.reason 과 불일치)
    it("(⑥a) run 분기 reason 재포장 → RangeError(기대/실측 reason 노출)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
        ],
        reason: "재포장된 reason",
      };
      expect(correct.reason).not.toBe(plan.reason);
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(
        /plan\.reason 이 gating\.reason 과 다르다.*기대=.*활성.*실측=.*재포장된 reason/,
      );
    });

    it("(⑥b) skip 분기 reason 재포장 → RangeError(기대/실측 reason 노출)", () => {
      const env: NodeJS.ProcessEnv = {};
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "skip",
        reason: "재포장된 skip reason",
      };
      expect(() =>
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env),
      ).toThrow(
        /plan\.reason 이 gating\.reason 과 다르다.*기대=.*skip.*실측=.*재포장된 skip reason/,
      );
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 plan 객체와 env 객체를 변형하지 않는다(run 분기)", () => {
      const env = makeEnabledEnv();
      const envSnapshot = JSON.parse(JSON.stringify(env));
      const plan = buildConsistent(env);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const argvRefBefore = plan.argv;
      assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env);
      expect(plan).toEqual(planSnapshot);
      expect(plan.argv).toBe(argvRefBefore);
      expect(env).toEqual(envSnapshot);
    });

    it("정합 호출이 plan 객체와 env 객체를 변형하지 않는다(skip 분기)", () => {
      const env: NodeJS.ProcessEnv = {};
      const envSnapshot = JSON.parse(JSON.stringify(env));
      const plan = buildConsistent(env);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env);
      expect(plan).toEqual(planSnapshot);
      expect(env).toEqual(envSnapshot);
    });
  });

  describe("결정론(동일 입력 → 동일 동작)", () => {
    it("정합 plan/env 를 두 번 검증해도 항상 void", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() => {
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env);
        assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env);
      }).not.toThrow();
    });

    it("동일 손상 plan 을 두 번 검증해도 항상 동일 메시지로 throw", () => {
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepEvalCommandPlan = {
        action: "skip",
        reason: "stale reason",
      };
      const collect = (): string => {
        try {
          assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env);
          return "VOID";
        } catch (e) {
          return (e as Error).message;
        }
      };
      expect(collect()).toBe(collect());
    });
  });
});
