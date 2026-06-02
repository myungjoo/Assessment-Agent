// llm-live-test-gating.spec — resolveLiveTestGating 순수 helper 의 R-112 unit test
// (T-0171, ADR-0015 Decision §1·§2). happy(전부 set → run) + error/negative(부분-set·
// 전부-부재·빈 문자열·공백-only → skip) + flow(각 분기 1+) + default model 을 cover.
// live smoke 의 describe.skip 본문은 직접 test 불가하므로 gating 분기를 본 순수
// 함수로 분리해 여기서 검증한다(R-112 entrypoint-helper 분리 원칙 mirror).
import {
  DEFAULT_LIVE_MODEL,
  LLM_LIVE_API_KEY_ENV,
  LLM_LIVE_BASE_URL_ENV,
  LLM_LIVE_MODEL_ENV,
  LLM_LIVE_TEST_ENV,
  resolveLiveTestGating,
} from "./llm-live-test-gating";

// 완전한 gating env(3 종 + model)를 만드는 helper — 개별 case 가 일부만 누락/변형.
function fullEnv(): NodeJS.ProcessEnv {
  return {
    [LLM_LIVE_TEST_ENV]: "1",
    [LLM_LIVE_BASE_URL_ENV]: "https://live.example/v1",
    [LLM_LIVE_API_KEY_ENV]: "sk-live-fixture-not-real",
    [LLM_LIVE_MODEL_ENV]: "gpt-live-model",
  };
}

describe("resolveLiveTestGating — live smoke gating 순수 helper", () => {
  describe("happy: gating env 3 종 모두 set → enabled(run)", () => {
    it("3 종 + model 모두 set 이면 enabled=true 이고 baseUrl/apiKey/model 이 trim 되어 채워진다", () => {
      const gating = resolveLiveTestGating(fullEnv());

      expect(gating.enabled).toBe(true);
      expect(gating.baseUrl).toBe("https://live.example/v1");
      expect(gating.apiKey).toBe("sk-live-fixture-not-real");
      expect(gating.model).toBe("gpt-live-model");
      expect(gating.reason).toContain("활성");
    });

    it("주변 공백이 있어도 trim 되어 baseUrl/apiKey 에 채워진다", () => {
      const env = fullEnv();
      env[LLM_LIVE_BASE_URL_ENV] = "  https://live.example/v1  ";
      env[LLM_LIVE_API_KEY_ENV] = "\tsk-live-fixture-not-real\n";

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.baseUrl).toBe("https://live.example/v1");
      expect(gating.apiKey).toBe("sk-live-fixture-not-real");
    });
  });

  describe("flow / 분기: model env 유무에 따른 default", () => {
    it("LLM_LIVE_MODEL set 시 그 값을 model 로 사용한다", () => {
      const gating = resolveLiveTestGating(fullEnv());
      expect(gating.model).toBe("gpt-live-model");
    });

    it("LLM_LIVE_MODEL 부재 시 DEFAULT_LIVE_MODEL 로 fall back 한다(gating 필수 아님)", () => {
      const env = fullEnv();
      delete env[LLM_LIVE_MODEL_ENV];

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.model).toBe(DEFAULT_LIVE_MODEL);
    });

    it("LLM_LIVE_MODEL 이 공백-only 면 DEFAULT_LIVE_MODEL 로 fall back 한다", () => {
      const env = fullEnv();
      env[LLM_LIVE_MODEL_ENV] = "   ";

      const gating = resolveLiveTestGating(env);

      expect(gating.model).toBe(DEFAULT_LIVE_MODEL);
    });
  });

  describe("error / negative: 부분-set·전부-부재 → skip(enabled=false)", () => {
    it("전부-부재(빈 env) 면 enabled=false 이고 reason 에 3 종 모두 박제된다", () => {
      const gating = resolveLiveTestGating({});

      expect(gating.enabled).toBe(false);
      expect(gating.baseUrl).toBeUndefined();
      expect(gating.apiKey).toBeUndefined();
      expect(gating.reason).toContain(LLM_LIVE_TEST_ENV);
      expect(gating.reason).toContain(LLM_LIVE_BASE_URL_ENV);
      expect(gating.reason).toContain(LLM_LIVE_API_KEY_ENV);
      // model 은 gating 부재에도 default 가 채워진다.
      expect(gating.model).toBe(DEFAULT_LIVE_MODEL);
    });

    it("LLM_LIVE_TEST 만 있고 base URL·key 부재 → skip", () => {
      const env: NodeJS.ProcessEnv = { [LLM_LIVE_TEST_ENV]: "1" };

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(LLM_LIVE_BASE_URL_ENV);
      expect(gating.reason).toContain(LLM_LIVE_API_KEY_ENV);
      expect(gating.reason).not.toContain(LLM_LIVE_TEST_ENV);
    });

    it("base URL 만 있고 flag·key 부재 → skip", () => {
      const env: NodeJS.ProcessEnv = {
        [LLM_LIVE_BASE_URL_ENV]: "https://live.example/v1",
      };

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(LLM_LIVE_TEST_ENV);
      expect(gating.reason).toContain(LLM_LIVE_API_KEY_ENV);
    });

    it("flag·base URL 은 있으나 API key 부재 → skip", () => {
      const env = fullEnv();
      delete env[LLM_LIVE_API_KEY_ENV];

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(LLM_LIVE_API_KEY_ENV);
    });

    it("빈 문자열 env 는 부재로 취급되어 skip 된다", () => {
      const env = fullEnv();
      env[LLM_LIVE_TEST_ENV] = "";

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(LLM_LIVE_TEST_ENV);
    });

    it("공백-only env 는 부재로 취급되어 skip 된다", () => {
      const env = fullEnv();
      env[LLM_LIVE_BASE_URL_ENV] = "   ";

      const gating = resolveLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(LLM_LIVE_BASE_URL_ENV);
    });

    it("skip 시 reason 에 실 credential 값을 노출하지 않는다(이름만 박제)", () => {
      const env = fullEnv();
      delete env[LLM_LIVE_API_KEY_ENV];

      const gating = resolveLiveTestGating(env);

      // base URL 실값이 reason 에 새어나오지 않음(env 이름만 보고).
      expect(gating.reason).not.toContain("https://live.example/v1");
    });
  });
});
