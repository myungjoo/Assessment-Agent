// realdata-e2e-daily-step-eval-command-plan.spec.ts — T-0611 colocated unit spec.
//
// R-112 cover 구조:
//   - happy-path: gating env 7 종 모두 set → action="run" + argv 가 live smoke spec 경로 +
//     smoke config 를 정확히 포함 + 단일-spec bound(--runTestsByPath) 검증.
//   - error path: gating env 부재 → action="skip" + argv 미포함(undefined) + throw 0,
//     빈 객체 env → action="skip".
//   - flow/branch: (a) enabled true → "run" 분기, (b) enabled false → "skip" 분기 각 1+,
//     reason 문자열이 분기별로 구분됨(run 활성 / skip 부재) 검증.
//   - negative 충분 cover(단일 negative 금지 — 경계마다 분리):
//     (1) gating env 중 정확히 1 종 부재(부분 set) → "skip"(gating 위임 결과 전파),
//     (2) 공백-only env 값 → "skip"(gating 의 non-blank guard 동작 전파),
//     (3) plan 산출이 실 credential 값을 argv / reason 에 노출 0(§9) — argv 는 spec 경로 +
//       config flag 만, 부수효과 0,
//     (4) "skip" 산출 시 argv key 부재(undefined) — caller 가 잘못 spawn 하지 않도록 명시,
//     (5) 입력 env 객체 mutate 0(무공유) — 호출 전후 deep-equal.
//   - 결정론·무공유: 동일 env 2회 호출 → deep equal, 매 호출 새 argv 배열(참조 분리).
import {
  buildRealDataDailyStepEvalCommandPlan,
  REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
  REALDATA_E2E_SMOKE_JEST_CONFIG,
} from "./realdata-e2e-daily-step-eval-command-plan";
import * as consistency from "./realdata-e2e-daily-step-eval-command-plan-consistency";
import {
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
} from "./realdata-e2e-live-gating";

// 실 credential 을 모사하는 sentinel 값 — argv / reason 에 절대 새어나오면 안 되는 토큰.
// (§9: plan 산출이 실 credential 을 echo 하지 않음을 검증하기 위한 negative probe.)
const SECRET_BASE_URL = "http://secret-ollama.lan:11434/v1";
const SECRET_API_KEY = "sk-SECRET-leak-canary-9f8e7d";
const SECRET_PAT = "ghp_SECRET_leak_canary_1234567890";

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

describe("buildRealDataDailyStepEvalCommandPlan", () => {
  describe("happy-path (enabled → run)", () => {
    it('gating env 7 종 모두 set 시 action="run" 을 산출한다', () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      expect(plan.action).toBe("run");
    });

    it("run 산출의 argv 는 smoke config + live smoke spec 경로를 정확히 포함한다", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      expect(plan.argv).toBeDefined();
      expect(plan.argv).toEqual([
        "--config",
        REALDATA_E2E_SMOKE_JEST_CONFIG,
        "--runTestsByPath",
        REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
      ]);
    });

    it("argv 가 단일-spec bound(--runTestsByPath + 단일 경로)로 묶인다", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      const argv = plan.argv ?? [];
      // --runTestsByPath 다음 위치(=마지막)에 정확히 하나의 spec 경로만 온다.
      expect(argv).toContain("--runTestsByPath");
      const pathArgs = argv.filter((a) => a.endsWith(".smoke-spec.ts"));
      expect(pathArgs).toEqual([REALDATA_E2E_LIVE_SMOKE_SPEC_PATH]);
    });

    it("run 분기 reason 은 gating 활성 사유(set)를 전파한다", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      expect(plan.reason).toContain("활성");
    });
  });

  describe("error path (disabled → skip)", () => {
    it('gating env 전부 부재 시 action="skip" + throw 0', () => {
      expect(() => buildRealDataDailyStepEvalCommandPlan({})).not.toThrow();
      const plan = buildRealDataDailyStepEvalCommandPlan({});
      expect(plan.action).toBe("skip");
    });

    it('빈 객체 env → action="skip" + argv 미포함(undefined)', () => {
      const plan = buildRealDataDailyStepEvalCommandPlan({});
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    it("skip 분기 reason 은 gating 부재 사유(env 이름 나열)를 전파한다", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan({});
      expect(plan.reason).toContain("skip");
      expect(plan.reason).toContain(REALDATA_E2E_LIVE_TEST_ENV);
    });
  });

  describe("flow / branch 분기 cover", () => {
    it("enabled true → run, enabled false → skip 의 reason 이 분기별로 구분된다", () => {
      const runPlan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      const skipPlan = buildRealDataDailyStepEvalCommandPlan({});
      expect(runPlan.action).toBe("run");
      expect(skipPlan.action).toBe("skip");
      expect(runPlan.reason).not.toBe(skipPlan.reason);
    });
  });

  describe("negative cases 충분 cover", () => {
    // (1) gating env 중 정확히 1 종 부재(부분 set) → "skip"(gating 위임 결과 전파).
    it("(1) PAT 만 부재한 부분 set → skip", () => {
      const env = makeEnabledEnv({
        [REALDATA_E2E_GITHUB_READ_PAT_ENV]: undefined,
      });
      const plan = buildRealDataDailyStepEvalCommandPlan(env);
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
      expect(plan.reason).toContain(REALDATA_E2E_GITHUB_READ_PAT_ENV);
    });

    it("(1b) enable flag 만 부재한 부분 set → skip", () => {
      const env = makeEnabledEnv({ [REALDATA_E2E_LIVE_TEST_ENV]: undefined });
      const plan = buildRealDataDailyStepEvalCommandPlan(env);
      expect(plan.action).toBe("skip");
    });

    // (2) 공백-only env 값 → "skip"(gating 의 non-blank guard 동작 전파).
    it("(2) 공백-only LLM base URL 값 → skip", () => {
      const env = makeEnabledEnv({ [REALDATA_E2E_LLM_BASE_URL_ENV]: "   " });
      const plan = buildRealDataDailyStepEvalCommandPlan(env);
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    // (3) plan 산출이 실 credential 값을 argv / reason 에 노출 0(§9).
    it("(3) run 산출의 argv / reason 에 실 credential sentinel 값이 새어나오지 않는다", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      const blob = JSON.stringify(plan);
      expect(blob).not.toContain(SECRET_BASE_URL);
      expect(blob).not.toContain(SECRET_API_KEY);
      expect(blob).not.toContain(SECRET_PAT);
    });

    // (4) "skip" 산출 시 argv key 부재(undefined) — caller 의 오-spawn 방어.
    it("(4) skip plan 은 argv key 자체가 부재(undefined)다", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan({});
      expect("argv" in plan ? plan.argv : undefined).toBeUndefined();
    });

    // (5) 입력 env 객체 mutate 0(무공유) — 호출 전후 deep-equal.
    it("(5-run) run 경로에서 입력 env 객체를 mutate 하지 않는다", () => {
      const env = makeEnabledEnv();
      const snapshot = JSON.parse(JSON.stringify(env));
      buildRealDataDailyStepEvalCommandPlan(env);
      expect(env).toEqual(snapshot);
    });

    it("(5-skip) skip 경로에서 입력 env 객체를 mutate 하지 않는다", () => {
      const env: NodeJS.ProcessEnv = { [REALDATA_E2E_LIVE_TEST_ENV]: "1" };
      const snapshot = JSON.parse(JSON.stringify(env));
      buildRealDataDailyStepEvalCommandPlan(env);
      expect(env).toEqual(snapshot);
    });
  });

  describe("결정론·무공유", () => {
    it("동일 env 두 번 호출 → deep-equal 산출", () => {
      const a = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      const b = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      expect(a).toEqual(b);
    });

    it("매 호출 새 argv 배열을 반환한다(참조 분리)", () => {
      const a = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      const b = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());
      expect(a.argv).not.toBe(b.argv);
      expect(a.argv).toEqual(b.argv);
    });
  });

  // T-0694 self-wire 배선 검증 — 컴포저가 산출 RealDataDailyStepEvalCommandPlan 을 반환
  // 직전(run/skip 양 분기 각각) consistency 가드를 (산출 plan, env) 인자로 정확히 1회
  // self-assert 하는지, 정상 합성이면 throw 0·반환 plan 형태 보존(관측 불가능하게 동일),
  // 가드가 throw 하면 컴포저가 삼키지 않고 그대로 선전파하는지(RangeError/TypeError 모의)
  // 검증한다. T-0692 scoring-call-args self-wire spec 패턴의 step④-side mirror.
  describe("consistency 가드 self-wire (T-0694) — 반환 직전 self-assert 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("(run 분기) gating enabled → 가드가 (산출 run plan, env) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataDailyStepEvalCommandPlanConsistentWithGating",
      );
      const env = makeEnabledEnv();

      const plan = buildRealDataDailyStepEvalCommandPlan(env);

      // 정확히 1회 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      // 인자 순서·값이 (반환된 산출 plan, env) 와 일치.
      expect(spy).toHaveBeenCalledWith(plan, env);
      // 가드에 넘어간 첫 인자가 컴포저가 반환한 바로 그 plan 참조여야 한다(검증 대상 일치).
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(env);
    });

    it("(skip 분기) gating disabled → 가드가 (산출 skip plan, env) 인자로 정확히 1회 호출됨", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataDailyStepEvalCommandPlanConsistentWithGating",
      );
      const env: NodeJS.ProcessEnv = {};

      const plan = buildRealDataDailyStepEvalCommandPlan(env);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, env);
      expect(spy.mock.calls[0][0]).toBe(plan);
      expect(spy.mock.calls[0][1]).toBe(env);
      // skip 산출물 형태 보존.
      expect(plan.action).toBe("skip");
      expect(plan.argv).toBeUndefined();
    });

    it("(부분 set skip 분기) PAT 부재 → skip plan 산출 + 가드 정확히 1회 호출", () => {
      const spy = jest.spyOn(
        consistency,
        "assertRealDataDailyStepEvalCommandPlanConsistentWithGating",
      );
      const env = makeEnabledEnv({
        [REALDATA_E2E_GITHUB_READ_PAT_ENV]: undefined,
      });

      const plan = buildRealDataDailyStepEvalCommandPlan(env);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(plan, env);
      expect(plan.action).toBe("skip");
    });

    it("정상 합성(run) → 가드 통과 후 반환 plan 이 self-wire 미배선 기대값과 동일(불변)", () => {
      const plan = buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv());

      // self-wire 가 반환 plan 을 변형하지 않음 — action/argv canonical 벡터/reason 보존.
      expect(plan.action).toBe("run");
      expect(plan.argv).toEqual([
        "--config",
        REALDATA_E2E_SMOKE_JEST_CONFIG,
        "--runTestsByPath",
        REALDATA_E2E_LIVE_SMOKE_SPEC_PATH,
      ]);
    });

    it("정상 합성(run/skip 양 분기) → self-assert 통과로 throw 0", () => {
      expect(() =>
        buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv()),
      ).not.toThrow();
      expect(() => buildRealDataDailyStepEvalCommandPlan({})).not.toThrow();
    });

    it("(negative 1 — run 분기 RangeError argv drift 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataDailyStepEvalCommandPlanConsistentWithGating",
        )
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: plan.argv[1] 가 canonical 벡터와 다르다 — 기대="./test/jest-smoke.json", 실측="./drift.json".',
          );
        });

      expect(() =>
        buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv()),
      ).toThrow(/canonical 벡터와 다르다/);
    });

    it("(negative 2 — skip 분기 RangeError action 오매핑 회귀 모사) 가드 throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataDailyStepEvalCommandPlanConsistentWithGating",
        )
        .mockImplementation(() => {
          throw new RangeError(
            '정합 위반: plan.action 이 gating.enabled 와 어긋난다 — gating.enabled=false ⇒ 기대="skip", 실측="run".',
          );
        });

      expect(() => buildRealDataDailyStepEvalCommandPlan({})).toThrow(
        /gating\.enabled 와 어긋난다/,
      );
    });

    it("(negative 3 — TypeError 구조결손 회귀 모사) 가드 TypeError throw 가 그대로 전파", () => {
      jest
        .spyOn(
          consistency,
          "assertRealDataDailyStepEvalCommandPlanConsistentWithGating",
        )
        .mockImplementation(() => {
          throw new TypeError(
            "plan 이 객체가 아니다 — gating 재유도 정합 비교를 진행할 수 없다.",
          );
        });

      expect(() =>
        buildRealDataDailyStepEvalCommandPlan(makeEnabledEnv()),
      ).toThrow(TypeError);
    });

    it("self-wire 배선 후에도 입력 env 비변형 + 동일 입력 두 번 deterministic", () => {
      const env = makeEnabledEnv();
      const snapshot = JSON.parse(JSON.stringify(env));

      const a = buildRealDataDailyStepEvalCommandPlan(env);
      const b = buildRealDataDailyStepEvalCommandPlan(env);

      // 비변형(env mutate 0).
      expect(env).toEqual(snapshot);
      // deterministic byte-identical.
      expect(a).toEqual(b);
      // 무공유(매 호출 새 argv 배열).
      expect(a.argv).not.toBe(b.argv);
    });
  });
});
