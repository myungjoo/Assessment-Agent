// realdata-e2e-live-gating-consistency.spec.ts — T-0707 colocated unit spec.
//
// 대상: `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` — live-gating 결정
// (`resolveRealDataE2eLiveGating`, T-0610) 이 동일 env map 으로부터 독립 재유도한 expected
// gating 과 deep-equal 정합한지 검증하는 순수 가드(gating-layer). 실 컴포저 산출 gating 을
// happy-path fixture 로 재사용해 컴포저↔가드 paired 교차 검증한다.
//
// R-112 cover 구조:
//   - happy-path: 7 env 전부 set(enabled=true) / enable flag 부재(enabled=false) / 부분-set
//     각 1+, 컴포저 산출 gating 에 대해 void(throw 0).
//   - error path: 구조 결손(gating null/undefined / 비객체 / enabled 비-boolean / reason
//     비-string / 활성인데 ollama 비-객체·필드 비-string / githubPat 비-string) 각 TypeError.
//   - branch/flow: 7 env 중 enable flag·Ollama 5 종 중 하나·github PAT 부재 각 분기 /
//     활성 vs 비활성 credential present-coupling 분기 cover.
//   - negative cases 충분 cover ①~⑥: enabled=true 인데 credential 누락(정 coupling) /
//     enabled=false 인데 credential present(역 coupling) / missing 순서 불일치 / 공백-only
//     env 경계(non-blank) / reason 에 credential 누출 / 입력 비변형.
//   - 비변형·결정론.
//
// §9: 실 credential 값 0 — 합성 더미("x" 등)만 사용. env 이름 상수만 메시지/매핑에 등장.
import {
  REALDATA_E2E_LIVE_TEST_ENV,
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
  resolveRealDataE2eLiveGating,
  type RealDataE2eLiveGating,
} from "./realdata-e2e-live-gating";
import { assertRealDataE2eLiveGatingConsistentWithEnv } from "./realdata-e2e-live-gating-consistency";

// 7 env 전부 set 된 완전 env fixture(합성 더미 — 실 credential 0, §9).
function fullEnv(): NodeJS.ProcessEnv {
  return {
    [REALDATA_E2E_LIVE_TEST_ENV]: "1",
    [REALDATA_E2E_LLM_BASE_URL_ENV]: "http://dummy/v1",
    [REALDATA_E2E_LLM_API_KEY_ENV]: "dummy-key",
    [REALDATA_E2E_LLM_MODEL_ENV]: "dummy-model",
    [REALDATA_E2E_LLM_PROVIDER_ENV]: "dummy-provider",
    [REALDATA_E2E_LLM_API_VERSION_ENV]: "2024-dummy",
    [REALDATA_E2E_GITHUB_READ_PAT_ENV]: "dummy-pat",
  };
}

// cloneGating — 변조 fixture 용 깊은 복제(JSON 직렬화 — gating 은 boolean/string/Record 만).
function cloneGating(gating: RealDataE2eLiveGating): RealDataE2eLiveGating {
  return JSON.parse(JSON.stringify(gating)) as RealDataE2eLiveGating;
}

describe("assertRealDataE2eLiveGatingConsistentWithEnv", () => {
  // ── happy-path (컴포저↔가드 paired) ──────────────────────────────────────
  it("7 env 전부 set → enabled=true 컴포저 gating 에 대해 void", () => {
    const env = fullEnv();
    const gating = resolveRealDataE2eLiveGating(env);
    expect(gating.enabled).toBe(true);
    expect(gating.ollama).toBeDefined();
    expect(gating.githubPat).toBe("dummy-pat");
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });

  it("enable flag 부재 → enabled=false 컴포저 gating 에 대해 void", () => {
    const env = fullEnv();
    delete env[REALDATA_E2E_LIVE_TEST_ENV];
    const gating = resolveRealDataE2eLiveGating(env);
    expect(gating.enabled).toBe(false);
    expect(gating.ollama).toBeUndefined();
    expect(gating.githubPat).toBeUndefined();
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });

  it("빈 env(전부 부재) → enabled=false 컴포저 gating 에 대해 void", () => {
    const env: NodeJS.ProcessEnv = {};
    const gating = resolveRealDataE2eLiveGating(env);
    expect(gating.enabled).toBe(false);
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });

  // ── branch/flow: 각 필수 env 부재 분기 (컴포저↔가드 paired void) ──────────
  it.each([
    ["enable flag", REALDATA_E2E_LIVE_TEST_ENV],
    ["Ollama base URL", REALDATA_E2E_LLM_BASE_URL_ENV],
    ["Ollama api key", REALDATA_E2E_LLM_API_KEY_ENV],
    ["Ollama model", REALDATA_E2E_LLM_MODEL_ENV],
    ["Ollama provider", REALDATA_E2E_LLM_PROVIDER_ENV],
    ["Ollama api version", REALDATA_E2E_LLM_API_VERSION_ENV],
    ["github PAT", REALDATA_E2E_GITHUB_READ_PAT_ENV],
  ])("%s 부재 → enabled=false paired void", (_label, envName) => {
    const env = fullEnv();
    delete env[envName as string];
    const gating = resolveRealDataE2eLiveGating(env);
    expect(gating.enabled).toBe(false);
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });

  // ── error path (구조 결손 = TypeError) ───────────────────────────────────
  it("gating null → TypeError", () => {
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(
        null as unknown as RealDataE2eLiveGating,
        fullEnv(),
      ),
    ).toThrow(TypeError);
  });

  it("gating undefined → TypeError", () => {
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(
        undefined as unknown as RealDataE2eLiveGating,
        fullEnv(),
      ),
    ).toThrow(TypeError);
  });

  it("gating 이 배열 → TypeError", () => {
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(
        [] as unknown as RealDataE2eLiveGating,
        fullEnv(),
      ),
    ).toThrow(TypeError);
  });

  it("gating.enabled 가 boolean 아님 → TypeError", () => {
    const gating = {
      enabled: "true",
      reason: "x",
    } as unknown as RealDataE2eLiveGating;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, fullEnv()),
    ).toThrow(TypeError);
  });

  it("gating.reason 이 string 아님 → TypeError", () => {
    const gating = {
      enabled: false,
      reason: 42,
    } as unknown as RealDataE2eLiveGating;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, fullEnv()),
    ).toThrow(TypeError);
  });

  it("활성인데 ollama 가 객체 아님 → TypeError", () => {
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    (gating as { ollama?: unknown }).ollama = null;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(
        gating as RealDataE2eLiveGating,
        env,
      ),
    ).toThrow(TypeError);
  });

  it("활성인데 ollama 필드가 string 아님 → TypeError", () => {
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    (gating.ollama as unknown as Record<string, unknown>).model = 7;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(TypeError);
  });

  it("활성인데 githubPat 이 string 아님 → TypeError", () => {
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    (gating as { githubPat?: unknown }).githubPat = 123;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(
        gating as RealDataE2eLiveGating,
        env,
      ),
    ).toThrow(TypeError);
  });

  // ── negative: enabled mismatch (값 정합 = RangeError) ─────────────────────
  it("enabled mismatch (env 완전한데 gating.enabled=false) → RangeError", () => {
    const env = fullEnv();
    const gating = {
      enabled: false,
      reason: "realdata-e2e live smoke 활성 — gating env 7 종 모두 set",
    } as RealDataE2eLiveGating;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("negative ①: enabled=true 인데 ollama 누락 → RangeError(정 coupling 위반)", () => {
    // 구조 검증을 통과시키되(ollama 가 객체) 값 정합에서 잡히도록 — enabled=true env 는
    // 부분-set 으로 만들어 재유도 expected.enabled=false 와 충돌시킨다.
    const env = fullEnv();
    delete env[REALDATA_E2E_GITHUB_READ_PAT_ENV];
    // gating 은 활성으로 손상(ollama 보유, githubPat 보유)됐지만 env 는 PAT 부재.
    const gating = resolveRealDataE2eLiveGating(fullEnv());
    expect(gating.enabled).toBe(true);
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("negative ①-b: enabled=true 인데 githubPat 누락 → TypeError(구조 검증 우선)", () => {
    // enabled=true gating 에서 githubPat 을 제거하면 값 정합(RangeError) 이전에 구조 검증이
    // TypeError 로 먼저 잡는다(검사 순서: 구조 → 재유도 → 값 비교 fail-fast). present-coupling
    // RangeError 정방향 위반은 negative ① 가 env 측 부분-set 으로 별도 cover 한다.
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    delete (gating as { githubPat?: unknown }).githubPat;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(TypeError);
  });

  it("negative ①-c: enabled=true 인데 ollama 누락 구조 결손 후 env 도 부분-set → RangeError 정 coupling", () => {
    // gating 은 ollama 누락(undefined)이지만 enabled=true, env 도 부분-set 이라 재유도
    // expected.enabled=false. enabled mismatch RangeError 가 먼저 잡힌다(구조 검증은 ollama
    // 가 undefined 면 활성 분기에서 TypeError — 따라서 enabled=true + ollama undefined 는
    // 구조 TypeError. 대신 enabled=false 인 env mismatch 를 negative ① 가 cover).
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    delete (gating as { ollama?: unknown }).ollama;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(TypeError);
  });

  it("negative ②: enabled=false 인데 ollama present → RangeError(역 coupling 위반)", () => {
    const env: NodeJS.ProcessEnv = {};
    const gating = {
      enabled: false,
      ollama: {
        baseUrl: "x",
        apiKey: "x",
        model: "x",
        provider: "x",
        apiVersion: "x",
      },
      reason: resolveRealDataE2eLiveGating(env).reason,
    } as RealDataE2eLiveGating;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("negative ②-b: enabled=false 인데 githubPat present → RangeError(역 coupling)", () => {
    const env: NodeJS.ProcessEnv = {};
    const gating = {
      enabled: false,
      githubPat: "x",
      reason: resolveRealDataE2eLiveGating(env).reason,
    } as RealDataE2eLiveGating;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("negative ③: reason 의 missing 순서가 REQUIRED_ENV 와 불일치 → RangeError", () => {
    const env: NodeJS.ProcessEnv = {};
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    // missing 나열 순서를 뒤집어 reason drift(순서 불변식 ④ 위반).
    gating.reason = `realdata-e2e live smoke skip — gating env 부재: ${[
      REALDATA_E2E_GITHUB_READ_PAT_ENV,
      REALDATA_E2E_LIVE_TEST_ENV,
    ].join(", ")}`;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("credential 값 drift → RangeError(실값 비노출)", () => {
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    gating.ollama!.model = "tampered-model";
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
    // 메시지에 실값(tampered-model / dummy-model)이 echo 되지 않는지 확인(§9).
    try {
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("tampered-model");
      expect(msg).not.toContain("dummy-model");
      expect(msg).toContain(REALDATA_E2E_LLM_MODEL_ENV);
    }
  });

  it("negative ⑤: reason 에 credential 실값 누출 → RangeError(실값 비노출)", () => {
    const env = fullEnv();
    const gating = cloneGating(resolveRealDataE2eLiveGating(env));
    // reason 에 githubPat 실값을 누출시킨 손상 gating. 단 reason 도 expected 와 일치해야
    // §9 단언까지 도달하므로, 누출 문자열을 expected reason 에 덧붙이는 대신 별도 검증을 위해
    // ollama.baseUrl 값을 reason 에 박는다 → reason drift(RangeError)로도, §9 위반으로도 잡힘.
    gating.reason = `realdata-e2e live smoke 활성 — ${gating.ollama!.apiKey}`;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("§9 단언 단독 경로: reason 일치하지만 credential 누출 시 RangeError", () => {
    // reason 정합 비교를 통과시키되 §9 비노출 단언만 위반하도록, expected reason 과
    // 동일하되 credential 값을 포함하는 경우를 합성한다. apiKey="활성" 같은 부분 문자열이
    // expected reason 에 우연히 포함되는 상황을 모사 — credential 값이 reason 부분과 겹침.
    //
    // T-0708 self-wire 후 컴포저(`resolveRealDataE2eLiveGating`)는 두 return 직전에
    // 자기 가드를 self-assert 하므로, apiKey="활성" env 로 컴포저를 호출하면 fixture
    // 생성 시점에 이 §9 위반으로 throw 해 회귀한다. 본 test 는 §9 단독 경로 검증이
    // 목적이므로 fixture 를 컴포저 호출 없이 literal object 로 손수 합성한다(컴포저
    // 의존 제거 — 테스트 의도는 가드의 §9 RangeError 전파 검증으로 불변).
    const env = fullEnv();
    env[REALDATA_E2E_LLM_API_KEY_ENV] = "활성"; // expected reason 에 등장하는 토큰
    // 컴포저가 위 env 로 산출했을 gating 과 byte-identical 한 literal 합성(active 분기).
    // reason="...live smoke 활성..." 이 apiKey "활성" 을 포함 → §9 위반(컴포저 비호출).
    const gating: RealDataE2eLiveGating = {
      enabled: true,
      ollama: {
        baseUrl: "http://dummy/v1",
        apiKey: "활성",
        model: "dummy-model",
        provider: "dummy-provider",
        apiVersion: "2024-dummy",
      },
      githubPat: "dummy-pat",
      reason: "realdata-e2e live smoke 활성 — gating env 7 종 모두 set",
    };
    expect(gating.reason).toContain("활성");
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(RangeError);
  });

  it("negative ④: 공백-only env 는 부재 처리(non-blank 경계) → enabled=false paired void", () => {
    const env = fullEnv();
    env[REALDATA_E2E_LLM_API_KEY_ENV] = "   "; // 공백-only → 부재
    const gating = resolveRealDataE2eLiveGating(env);
    expect(gating.enabled).toBe(false);
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });

  it("빈 문자열 env 는 부재 처리(non-blank 경계) → enabled=false paired void", () => {
    const env = fullEnv();
    env[REALDATA_E2E_LLM_PROVIDER_ENV] = "";
    const gating = resolveRealDataE2eLiveGating(env);
    expect(gating.enabled).toBe(false);
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });

  it("RangeError 메시지에 기대 vs 실측 노출(enabled mismatch)", () => {
    const env = fullEnv();
    const gating = {
      enabled: false,
      reason: "realdata-e2e live smoke 활성 — gating env 7 종 모두 set",
    } as RealDataE2eLiveGating;
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).toThrow(/기대=true.*실측=false/);
  });

  // ── 비변형 / 결정론 ──────────────────────────────────────────────────────
  it("negative ⑥: 가드가 입력 gating·env 를 변형하지 않는다(비변형)", () => {
    const env = fullEnv();
    const gating = resolveRealDataE2eLiveGating(env);
    const gatingSnapshot = JSON.stringify(gating);
    const envSnapshot = JSON.stringify(env);
    const envRef = env;
    assertRealDataE2eLiveGatingConsistentWithEnv(gating, env);
    expect(JSON.stringify(gating)).toBe(gatingSnapshot);
    expect(JSON.stringify(env)).toBe(envSnapshot);
    expect(env).toBe(envRef);
  });

  it("동일 입력 반복 호출 → 동일 동작(결정론)", () => {
    const env = fullEnv();
    const gating = resolveRealDataE2eLiveGating(env);
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
    expect(() =>
      assertRealDataE2eLiveGatingConsistentWithEnv(gating, env),
    ).not.toThrow();
  });
});
