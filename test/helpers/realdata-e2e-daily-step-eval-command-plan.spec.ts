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
});
