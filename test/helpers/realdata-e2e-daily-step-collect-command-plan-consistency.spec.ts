// realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts — T-0890 colocated
// unit spec (eval-leg T-0693 spec 의 collect-leg mirror).
//
// R-112 cover 구조:
//   - happy-path: gating 활성(env 7 종 set) → run plan 정합 / gating 부재(빈 env) →
//     skip plan 정합 각각 가드가 void(throw 0) 임을 검증. 정상 입력의 양 분기(run/skip)
//     모두 통과 확인.
//   - error path(TypeError): plan null/undefined/배열/원시, env null/배열/원시 각 1+.
//   - flow/branch: 구조(TypeError) vs 값 정합(RangeError) 분리 + 원소 내 fail-fast
//     순서(구조 → action enum → 매핑 → 분기별 argv → reason).
//   - negative 충분 cover(Acceptance ①~⑥): action↔gating 오매핑, argv config drift,
//     argv spec-path drift(eval-leg spec 교차오염 포함), argv 길이/순서 어긋남,
//     action="skip" 인데 argv 존재, reason 재포장 각 1+ test. 메시지에 기대/실측 정보 포함.
//   - credential 누출 0(§9 / REQ-059): 실 credential placeholder 를 담은 gating-enabled
//     env 로 가드를 통과/실패시켜도 가드가 접근/비교하는 어떤 문자열(에러 메시지 포함)에도
//     credential 값이 등장하지 않음을 정규식 단언.
//   - 결정론·무공유: 정합 호출이 plan / env 객체를 mutate 하지 않는다.
import {
  buildRealDataDailyStepCollectCommandPlan,
  REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG,
  type RealDataDailyStepCollectCommandPlan,
} from "./realdata-e2e-daily-step-collect-command-plan";
import { assertRealDataDailyStepCollectCommandPlanConsistentWithGating } from "./realdata-e2e-daily-step-collect-command-plan-consistency";
import {
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
} from "./realdata-e2e-live-gating";

// eval-leg smoke spec 경로 — collect-leg 가드가 절대 canonical 로 받아들이면 안 되는
// 교차오염 대상(Acceptance negative ③). 컴포저의 collection spec 경로와 구분됨을 박제.
const EVAL_LEG_SMOKE_SPEC_PATH = "test/smoke/realdata-e2e-live.smoke-spec.ts";

// 실 credential 을 모사하는 sentinel 값 — 가드가 접근/비교/에러 메시지에 절대 노출하면 안
// 되는 토큰(§9 / REQ-059 credential 누출 0 probe).
const SECRET_API_KEY = "sk-SECRET-leak-canary-9f8e7d";
const SECRET_PAT = "ghp_SECRET_leak_canary_1234567890";
const SECRET_BASE_URL = "http://secret-ollama.lan:11434/v1";

// gating env 7 종 모두 set 된 활성 env fixture — 실 credential 모사 값을 담는다.
function makeEnabledEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: SECRET_BASE_URL,
    [REALDATA_E2E_LLM_API_KEY_ENV]: SECRET_API_KEY,
    [REALDATA_E2E_LLM_MODEL_ENV]: "llama3.1:8b",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "openai-compatible",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-02-15",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: SECRET_PAT,
    ...overrides,
  };
}

// buildConsistent — 컴포저로 정합 plan 합성(happy-path source). negative 는 그 산출을
// 의도적으로 변형한다.
function buildConsistent(
  env: NodeJS.ProcessEnv,
): RealDataDailyStepCollectCommandPlan {
  return buildRealDataDailyStepCollectCommandPlan(env);
}

describe("assertRealDataDailyStepCollectCommandPlanConsistentWithGating", () => {
  describe("happy path (정합 → void)", () => {
    it("gating 활성(env 7 종 set) → run plan 정합 → void", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(plan.action).toBe("run");
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).not.toThrow();
    });

    it("gating 부재(빈 env) → skip plan 정합 → void(반환값 undefined)", () => {
      const env: NodeJS.ProcessEnv = {};
      const plan = buildConsistent(env);
      expect(plan.action).toBe("skip");
      expect(
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toBeUndefined();
    });

    it("gating 부분 set(PAT 만 부재) → skip plan 정합 → void", () => {
      const env = makeEnabledEnv({
        [REALDATA_E2E_GITHUB_READ_PAT_ENV]: undefined,
      });
      const plan = buildConsistent(env);
      expect(plan.action).toBe("skip");
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).not.toThrow();
    });
  });

  describe("error path — 구조 결손(TypeError)", () => {
    it("plan=null → TypeError('null' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          null as unknown as RealDataDailyStepCollectCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*null/);
    });

    it("plan=undefined → TypeError('undefined' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          undefined as unknown as RealDataDailyStepCollectCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*undefined/);
    });

    it("plan=배열 → TypeError('array' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          [] as unknown as RealDataDailyStepCollectCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*array/);
    });

    it("plan=string → TypeError('string' 라벨)", () => {
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          "not-a-plan" as unknown as RealDataDailyStepCollectCommandPlan,
          makeEnabledEnv(),
        ),
      ).toThrow(/plan 이 객체가 아니다.*string/);
    });

    it("env=null → TypeError('null' 라벨)", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          null as unknown as NodeJS.ProcessEnv,
        ),
      ).toThrow(/env 가 객체가 아니다.*null/);
    });

    it("env=배열 → TypeError('array' 라벨)", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          [] as unknown as NodeJS.ProcessEnv,
        ),
      ).toThrow(/env 가 객체가 아니다.*array/);
    });

    it("env=string → TypeError('string' 라벨)", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          "nope" as unknown as NodeJS.ProcessEnv,
        ),
      ).toThrow(/env 가 객체가 아니다.*string/);
    });
  });

  describe("flow / branch — fail-fast 순서(구조 → action enum → 매핑 → 분기별 → reason)", () => {
    it("값 정합 위반(action enum)은 RangeError 이고 TypeError 가 아니다", () => {
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "INVALID" as unknown as "run",
        reason: "any",
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(RangeError);
    });

    it('action enum 위반("running") → RangeError(실측 값 노출)', () => {
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "running" as unknown as "run",
        reason: "any",
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.action 이 "run"\/"skip" 외 값이다.*running/);
    });

    it("action 매핑 검증이 reason 검증보다 먼저 throw", () => {
      // gating.enabled=true 인데 action="skip" + reason 도 일부러 다르게 설정 →
      // 매핑 에러 메시지가 먼저 나와야 한다.
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "skip",
        reason: "totally wrong",
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.action 이 gating\.enabled 와 어긋난다/);
    });

    it("run 분기 argv 검증이 reason 검증보다 먼저 throw", () => {
      // action/매핑 ok, argv 어긋남 + reason 도 어긋남 → argv 메시지가 먼저.
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          "wrong-config.json",
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: "wrong reason",
      };
      expect(correct.reason).not.toBe(plan.reason);
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.argv\[1\] 가 canonical 벡터와 다르다/);
    });
  });

  describe("negative 충분 cover — 예외 상황 분기마다(Acceptance ①~⑥)", () => {
    // (①a) action↔gating.enabled 오매핑: gating.enabled=true 인데 action="skip"
    it('(①a) gating.enabled=true 인데 action="skip" → RangeError(매핑)', () => {
      const env = makeEnabledEnv();
      const correctRun = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "skip",
        reason: correctRun.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(
        /plan\.action 이 gating\.enabled 와 어긋난다.*gating\.enabled=true/,
      );
      // 기대는 "run", 실측은 "skip" — 메시지에 둘 다 노출.
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/기대=.*run.*실측=.*skip/);
    });

    // (①b) action↔gating.enabled 오매핑: gating.enabled=false 인데 action="run"
    it('(①b) gating.enabled=false 인데 action="run" → RangeError(매핑)', () => {
      const env: NodeJS.ProcessEnv = {};
      const correctSkip = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: correctSkip.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/gating\.enabled=false.*기대=.*skip.*실측=.*run/);
    });

    // (②) argv config drift (`REALDATA_E2E_SMOKE_JEST_CONFIG` 와 다른 값)
    it("(②) run 분기 argv config drift → RangeError(어긋난 index + 기대/실측)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          "./test/jest-different.json",
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(
        /plan\.argv\[1\] 가 canonical 벡터와 다르다.*기대=.*jest-smoke\.json.*실측=.*jest-different\.json/,
      );
    });

    // (③) argv spec-path drift — 특히 eval-leg spec 로의 교차오염
    it("(③) run 분기 argv spec-path drift(eval-leg spec 교차오염) → RangeError(index=3)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          // collection leg 가드에 eval-leg spec 를 넣으면 잡혀야 한다.
          EVAL_LEG_SMOKE_SPEC_PATH,
        ],
        reason: correct.reason,
      };
      // 애초에 두 경로가 다름을 박제.
      expect(EVAL_LEG_SMOKE_SPEC_PATH).not.toBe(
        REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
      );
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.argv\[3\] 가 canonical 벡터와 다르다/);
    });

    // (④a) argv 길이 짧음 (--runTestsByPath 누락 등)
    it("(④a) run 분기 argv 길이 짧음(3-요소) → RangeError(길이 기대/실측)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.argv 길이가 canonical 벡터와 다르다.*기대=4.*실측=3/);
    });

    // (④b) argv 순서 어긋남 (--config 와 --runTestsByPath 위치 swap)
    it("(④b) run 분기 argv 순서 어긋남 → RangeError(index=0 부터)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
        ],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.argv\[0\] 가 canonical 벡터와 다르다/);
    });

    // (④c) run 분기 argv 부재(undefined)
    it("(④c) run 분기 argv 부재(undefined) → RangeError(부재)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.argv 가 부재\(undefined\)다/);
    });

    // (④d) run 분기 argv 비-배열(객체)
    it("(④d) run 분기 argv 비-배열(객체) → RangeError(배열 아님)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: {} as unknown as string[],
        reason: correct.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.argv 가 배열이 아니다.*object/);
    });

    // (⑤) action="skip" 인데 argv 존재 (caller 가 잘못 spawn 유발)
    it('(⑤) action="skip" 인데 argv 존재 → RangeError(잘못 spawn 위험)', () => {
      const env: NodeJS.ProcessEnv = {};
      const correctSkip = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "skip",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: correctSkip.reason,
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(/plan\.action="skip" 인데 plan\.argv 가 존재한다.*array/);
    });

    // (⑥a) reason 재포장 (run 분기 gating.reason 과 불일치)
    it("(⑥a) run 분기 reason 재포장 → RangeError(기대/실측 reason 노출)", () => {
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: "재포장된 reason",
      };
      expect(correct.reason).not.toBe(plan.reason);
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(
        /plan\.reason 이 gating\.reason 과 다르다.*기대=.*활성.*실측=.*재포장된 reason/,
      );
    });

    // (⑥b) reason 재포장 (skip 분기)
    it("(⑥b) skip 분기 reason 재포장 → RangeError(기대/실측 reason 노출)", () => {
      const env: NodeJS.ProcessEnv = {};
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "skip",
        reason: "재포장된 skip reason",
      };
      expect(() =>
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        ),
      ).toThrow(
        /plan\.reason 이 gating\.reason 과 다르다.*기대=.*skip.*실측=.*재포장된 skip reason/,
      );
    });
  });

  describe("credential 누출 0(§9 / REQ-059)", () => {
    it("정합 run plan 통과 시 가드가 credential placeholder 를 어디에도 노출하지 않는다", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      // 가드는 void — argv 는 jest 실행 인자(spec 경로 + config flag)만 담아 credential
      // 미surface. plan 직렬화에 sentinel 이 없음을 박제.
      assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env);
      const blob = JSON.stringify(plan);
      expect(blob).not.toMatch(
        new RegExp(`${SECRET_API_KEY}|${SECRET_PAT}|secret-ollama`),
      );
      expect(blob).not.toMatch(/GH_TOKEN|Bearer|Authorization|ghp_SECRET/);
    });

    it("throw 경로의 에러 메시지에도 credential placeholder 가 등장하지 않는다", () => {
      // gating-enabled env(credential placeholder 담음) + 손상 reason plan → throw.
      // 에러 메시지는 reason 값만 노출(gating.reason 은 credential 미포함)하며 env 의
      // credential 값을 echo 하지 않음을 박제.
      const env = makeEnabledEnv();
      const correct = buildConsistent(env);
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "run",
        argv: [
          "--config",
          REALDATA_E2E_SMOKE_JEST_CONFIG,
          "--runTestsByPath",
          REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH,
        ],
        reason: `${correct.reason} tampered`,
      };
      let message = "";
      try {
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        );
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toMatch(
        new RegExp(`${SECRET_API_KEY}|${SECRET_PAT}|secret-ollama`),
      );
      expect(message).not.toMatch(/GH_TOKEN|Bearer|Authorization/);
    });
  });

  describe("비변형 / 순수성 (입력 mutate 0)", () => {
    it("정합 호출이 plan 객체와 env 객체를 변형하지 않는다(run 분기)", () => {
      const env = makeEnabledEnv();
      const envSnapshot = JSON.parse(JSON.stringify(env));
      const plan = buildConsistent(env);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const argvRefBefore = plan.argv;
      assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env);
      expect(plan).toEqual(planSnapshot);
      expect(plan.argv).toBe(argvRefBefore);
      expect(env).toEqual(envSnapshot);
    });

    it("정합 호출이 plan 객체와 env 객체를 변형하지 않는다(skip 분기)", () => {
      const env: NodeJS.ProcessEnv = {};
      const envSnapshot = JSON.parse(JSON.stringify(env));
      const plan = buildConsistent(env);
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env);
      expect(plan).toEqual(planSnapshot);
      expect(env).toEqual(envSnapshot);
    });
  });

  describe("결정론(동일 입력 → 동일 동작)", () => {
    it("정합 plan/env 를 두 번 검증해도 항상 void", () => {
      const env = makeEnabledEnv();
      const plan = buildConsistent(env);
      expect(() => {
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        );
        assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
          plan,
          env,
        );
      }).not.toThrow();
    });

    it("동일 손상 plan 을 두 번 검증해도 항상 동일 메시지로 throw", () => {
      const env = makeEnabledEnv();
      const plan: RealDataDailyStepCollectCommandPlan = {
        action: "skip",
        reason: "stale reason",
      };
      const collect = (): string => {
        try {
          assertRealDataDailyStepCollectCommandPlanConsistentWithGating(
            plan,
            env,
          );
          return "VOID";
        } catch (e) {
          return (e as Error).message;
        }
      };
      expect(collect()).toBe(collect());
    });
  });
});
