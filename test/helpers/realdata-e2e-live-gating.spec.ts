// realdata-e2e-live-gating.spec.ts — resolveRealDataE2eLiveGating 의 gating 판정
// 로직 unit 검증 (T-0610, R-112). live 실 round-trip 자체는 smoke spec 에서 CI 기본
// skip 되므로, 판정 helper 의 모든 분기(happy / error / branch / negative)를 unit 으로
// cover 한다(llm-live-test-gating.spec.ts / period-bridge gating 의 unit 검증 선례 동형).
//
// 검증 축:
//   - happy: 전 7 env present → enabled true + credential 정확 매핑.
//   - error: 필수 env 부재/공백 → enabled false(throw 0, 조용한 skip 유도).
//   - branch: enable flag / LLM env 일부 / PAT 각 부재 분기 분리 cover.
//   - negative: 공백-only / falsy 문자열 flag / 부분-set / credential 비노출(§9).
import {
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_REQUIRED_ENV,
  resolveRealDataE2eLiveGating,
} from "./realdata-e2e-live-gating";

// 전 7 gating env 가 모두 set 된 모의 env 를 만든다(실값 아님 — 합성 토큰, §9).
// 각 키를 식별 가능한 distinct 값으로 채워 매핑 정확성을 assert 할 수 있게 한다.
function fullEnv(): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: "http://localhost:11434/v1",
    [REALDATA_E2E_LLM_API_KEY_ENV]: "ollama-dummy-key",
    [REALDATA_E2E_LLM_MODEL_ENV]: "llama3.1",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "openai-compatible",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-02-01",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: "ghp_synthetic_pat_value",
  };
}

describe("resolveRealDataE2eLiveGating", () => {
  describe("happy-path — 전 gating env present", () => {
    it("7 env 모두 set → enabled true + credential 묶음(Ollama 5 종 + PAT)이 정확 매핑된다", () => {
      const gating = resolveRealDataE2eLiveGating(fullEnv());

      expect(gating.enabled).toBe(true);
      // Ollama credential 5 종이 env 값과 정확히 1:1 매핑(trim 후).
      expect(gating.ollama).toEqual({
        baseUrl: "http://localhost:11434/v1",
        apiKey: "ollama-dummy-key",
        model: "llama3.1",
        provider: "openai-compatible",
        apiVersion: "2024-02-01",
      });
      // github read PAT 가 정확히 매핑.
      expect(gating.githubPat).toBe("ghp_synthetic_pat_value");
      // reason 은 활성 사실만 보고(사람 보고용).
      expect(gating.reason).toContain("활성");
    });

    it("주변 공백이 있는 값은 trim 되어 credential 에 매핑된다", () => {
      const env = fullEnv();
      env[REALDATA_E2E_LLM_BASE_URL_ENV] = "  http://localhost:11434/v1  ";
      env[REALDATA_E2E_GITHUB_READ_PAT_ENV] = "  ghp_padded  ";

      const gating = resolveRealDataE2eLiveGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.ollama?.baseUrl).toBe("http://localhost:11434/v1");
      expect(gating.githubPat).toBe("ghp_padded");
    });

    it("enable flag 가 falsy 문자열('false'/'0')이어도 non-blank 면 활성으로 본다(존재=의도 정책)", () => {
      // 정책 박제: enable flag 는 존재+non-blank 면 활성(값 의미 해석 0). gating 은
      // "의도적으로 켰는가" 만 검사한다 — "false"/"0" 도 set 한 것이므로 활성.
      for (const flagValue of ["false", "0", "no", "off"]) {
        const env = fullEnv();
        env[REALDATA_E2E_LIVE_TEST_ENV] = flagValue;
        const gating = resolveRealDataE2eLiveGating(env);
        expect(gating.enabled).toBe(true);
      }
    });
  });

  describe("error-path — 필수 env 부재 시 enabled false(throw 0)", () => {
    it("빈 객체 env → enabled false + throw 0", () => {
      // throw 0 — 조용한 skip 유도(부재는 enabled=false 로만 표현).
      expect(() => resolveRealDataE2eLiveGating({})).not.toThrow();
      const gating = resolveRealDataE2eLiveGating({});
      expect(gating.enabled).toBe(false);
      expect(gating.ollama).toBeUndefined();
      expect(gating.githubPat).toBeUndefined();
    });

    it("enabled false 일 때 credential 슬롯(ollama / githubPat)이 채워지지 않는다", () => {
      const env = fullEnv();
      delete env[REALDATA_E2E_LLM_API_KEY_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.ollama).toBeUndefined();
      expect(gating.githubPat).toBeUndefined();
    });
  });

  describe("branch — 각 필수 키 누락 분기 분리 cover", () => {
    it("(b) enable flag 만 부재 → false", () => {
      const env = fullEnv();
      delete env[REALDATA_E2E_LIVE_TEST_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(REALDATA_E2E_LIVE_TEST_ENV);
    });

    it("(c) LLM env 일부(base URL) 부재 → false", () => {
      const env = fullEnv();
      delete env[REALDATA_E2E_LLM_BASE_URL_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(REALDATA_E2E_LLM_BASE_URL_ENV);
    });

    it("(d) PAT 만 부재 → false(수집 leg 진입 불가)", () => {
      const env = fullEnv();
      delete env[REALDATA_E2E_GITHUB_READ_PAT_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(REALDATA_E2E_GITHUB_READ_PAT_ENV);
    });

    it("Ollama 5 종 각각이 단독 부재 시 false(provider / model / api-version / api-key 분기)", () => {
      // base URL 은 위에서 cover — 나머지 4 종 각 단독 부재 분기를 분리 cover.
      const keys = [
        REALDATA_E2E_LLM_API_KEY_ENV,
        REALDATA_E2E_LLM_MODEL_ENV,
        REALDATA_E2E_LLM_PROVIDER_ENV,
        REALDATA_E2E_LLM_API_VERSION_ENV,
      ];
      for (const key of keys) {
        const env = fullEnv();
        delete env[key];
        const gating = resolveRealDataE2eLiveGating(env);
        expect(gating.enabled).toBe(false);
        expect(gating.reason).toContain(key);
      }
    });
  });

  describe("negative cases — 경계마다 분리 cover", () => {
    it("(1) 공백-only env 값 → 부재로 간주(non-blank guard 동작) → false", () => {
      const env = fullEnv();
      env[REALDATA_E2E_LIVE_TEST_ENV] = "   ";
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(REALDATA_E2E_LIVE_TEST_ENV);
    });

    it("(1b) 빈 문자열 env 값 → 부재로 간주 → false", () => {
      const env = fullEnv();
      env[REALDATA_E2E_LLM_API_KEY_ENV] = "";
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(REALDATA_E2E_LLM_API_KEY_ENV);
    });

    it("(3) LLM 5 종 중 정확히 1 종만 부재(부분 set) → false", () => {
      const env = fullEnv();
      // 정확히 1 종(model)만 제거 — 나머지 6 종은 present.
      delete env[REALDATA_E2E_LLM_MODEL_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      // reason 에 부재한 1 종만 박제(나머지는 미박제).
      expect(gating.reason).toContain(REALDATA_E2E_LLM_MODEL_ENV);
      expect(gating.reason).not.toContain(REALDATA_E2E_LLM_BASE_URL_ENV);
    });

    it("(4) PAT 부재 시 enabled false 로 전 suite skip 보장 — credential 슬롯 미채움", () => {
      const env = fullEnv();
      delete env[REALDATA_E2E_GITHUB_READ_PAT_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      expect(gating.enabled).toBe(false);
      expect(gating.githubPat).toBeUndefined();
      expect(gating.ollama).toBeUndefined();
    });

    it("(5a) reason 이 credential 실값을 노출하지 않는다(§9) — 부재 진단은 env 이름만", () => {
      const env = fullEnv();
      delete env[REALDATA_E2E_LLM_API_KEY_ENV];
      const gating = resolveRealDataE2eLiveGating(env);
      // 부재한 env 의 이름은 reason 에 있지만, present 한 다른 키의 실값은 없다.
      expect(gating.reason).not.toContain("ghp_synthetic_pat_value");
      expect(gating.reason).not.toContain("http://localhost:11434/v1");
      expect(gating.reason).not.toContain("llama3.1");
    });

    it("(5b) enabled true 의 reason 도 credential 실값을 노출하지 않는다(§9)", () => {
      const gating = resolveRealDataE2eLiveGating(fullEnv());
      expect(gating.enabled).toBe(true);
      // reason 은 활성 사실만 — base URL / API key / PAT 실값 미포함.
      expect(gating.reason).not.toContain("http://localhost:11434/v1");
      expect(gating.reason).not.toContain("ollama-dummy-key");
      expect(gating.reason).not.toContain("ghp_synthetic_pat_value");
    });

    it("(5c) resolveRealDataE2eLiveGating 은 입력 env 를 mutate 하지 않는다(부수효과 0)", () => {
      const env = fullEnv();
      const snapshot = { ...env };
      resolveRealDataE2eLiveGating(env);
      expect(env).toEqual(snapshot);
    });

    it("REALDATA_E2E_REQUIRED_ENV 가 7 종을 정확히 나열한다(missing 진단 source 정합)", () => {
      expect(REALDATA_E2E_REQUIRED_ENV).toHaveLength(7);
      expect(REALDATA_E2E_REQUIRED_ENV).toEqual([
        REALDATA_E2E_LIVE_TEST_ENV,
        REALDATA_E2E_LLM_BASE_URL_ENV,
        REALDATA_E2E_LLM_API_KEY_ENV,
        REALDATA_E2E_LLM_MODEL_ENV,
        REALDATA_E2E_LLM_PROVIDER_ENV,
        REALDATA_E2E_LLM_API_VERSION_ENV,
        REALDATA_E2E_GITHUB_READ_PAT_ENV,
      ]);
    });
  });
});
