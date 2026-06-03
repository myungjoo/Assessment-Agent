// confluence-live-test-gating.spec — resolveConfluenceLiveTestGating 순수 helper 의
// R-112 unit test (T-0205, ADR-0021 Decision §(i)·§(ii)). happy(필수 3 종 set →
// run, Cloud Basic / Server Bearer 양 scheme 각 happy) + error/negative(flag 부재 ·
// base URL 부재 · token 부재 · 빈 문자열 · 공백-only · 부분-set → skip) + flow(scheme
// 분기 + enabled 분기 + reason 박제 분기 각 1+) + §9 안전(reason 에 실 token / base
// URL 미노출) 을 cover 한다. live smoke 의 describe.skip 본문은 직접 test 불가하므로
// gating 분기를 본 순수 함수로 분리해 여기서 검증한다(R-112 entrypoint-helper 분리
// 원칙 mirror — src/github/github-live-test-gating.spec.ts 동형, single-endpoint +
// scheme 분기로 reframe).
import {
  CONFLUENCE_LIVE_AUTH_USER_ENV,
  CONFLUENCE_LIVE_BASE_URL_ENV,
  CONFLUENCE_LIVE_TEST_ENV,
  CONFLUENCE_LIVE_TOKEN_ENV,
  resolveConfluenceLiveTestGating,
} from "./confluence-live-test-gating";

// 명백한 가짜 fixture — 실 credential 0(CLAUDE.md §9). reason 에 이 값들이
// 새어나오지 않음을 §9 test 가 검증한다.
const FAKE_BASE_URL = "https://fake-workspace.atlassian.net/wiki/rest/api";
const FAKE_AUTH_USER = "fake.user@example.com";
const FAKE_TOKEN = "confluence-FAKE-PLAINTEXT-TOKEN-DO-NOT-USE-0123456789";

// Cloud Basic 의 완전한 gating env(필수 3 종 + AUTH_USER) — 개별 case 가 일부만
// 누락/변형한다.
function cloudEnv(): NodeJS.ProcessEnv {
  return {
    [CONFLUENCE_LIVE_TEST_ENV]: "1",
    [CONFLUENCE_LIVE_BASE_URL_ENV]: FAKE_BASE_URL,
    [CONFLUENCE_LIVE_AUTH_USER_ENV]: FAKE_AUTH_USER,
    [CONFLUENCE_LIVE_TOKEN_ENV]: FAKE_TOKEN,
  };
}

// Server Bearer 의 완전한 gating env(필수 3 종, AUTH_USER 부재) — Server PAT 경로.
function serverEnv(): NodeJS.ProcessEnv {
  return {
    [CONFLUENCE_LIVE_TEST_ENV]: "1",
    [CONFLUENCE_LIVE_BASE_URL_ENV]: FAKE_BASE_URL,
    [CONFLUENCE_LIVE_TOKEN_ENV]: FAKE_TOKEN,
  };
}

describe("resolveConfluenceLiveTestGating — Confluence live smoke gating 순수 helper", () => {
  describe("happy: 필수 3 종 set → enabled(run), scheme 양 분기 각 happy", () => {
    it("Cloud Basic: 필수 3 종 + AUTH_USER set 이면 enabled / scheme=cloud-basic / baseUrl·authUser·token 채워짐", () => {
      const gating = resolveConfluenceLiveTestGating(cloudEnv());

      expect(gating.enabled).toBe(true);
      expect(gating.scheme).toBe("cloud-basic");
      expect(gating.baseUrl).toBe(FAKE_BASE_URL);
      expect(gating.authUser).toBe(FAKE_AUTH_USER);
      expect(gating.token).toBe(FAKE_TOKEN);
      expect(gating.reason).toContain("활성");
      expect(gating.reason).toContain("cloud-basic");
    });

    it("Server Bearer: 필수 3 종 set + AUTH_USER 부재면 enabled / scheme=server-bearer / authUser=null", () => {
      const gating = resolveConfluenceLiveTestGating(serverEnv());

      expect(gating.enabled).toBe(true);
      expect(gating.scheme).toBe("server-bearer");
      expect(gating.baseUrl).toBe(FAKE_BASE_URL);
      expect(gating.authUser).toBeNull();
      expect(gating.token).toBe(FAKE_TOKEN);
      expect(gating.reason).toContain("server-bearer");
    });

    it("주변 공백이 있어도 baseUrl·authUser·token 이 trim 되어 채워진다", () => {
      const env = cloudEnv();
      env[CONFLUENCE_LIVE_BASE_URL_ENV] = `  ${FAKE_BASE_URL}  `;
      env[CONFLUENCE_LIVE_AUTH_USER_ENV] = `\t${FAKE_AUTH_USER}\n`;
      env[CONFLUENCE_LIVE_TOKEN_ENV] = `  ${FAKE_TOKEN}  `;

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.scheme).toBe("cloud-basic");
      expect(gating.baseUrl).toBe(FAKE_BASE_URL);
      expect(gating.authUser).toBe(FAKE_AUTH_USER);
      expect(gating.token).toBe(FAKE_TOKEN);
    });
  });

  describe("flow / 분기: scheme(Cloud/Server) + enabled(run/skip) + reason 분기", () => {
    it("AUTH_USER 만 set + 필수 3 종 부재면 scheme=cloud-basic 이나 enabled=false(scheme 은 gating 과 독립)", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_LIVE_AUTH_USER_ENV]: FAKE_AUTH_USER,
      };

      const gating = resolveConfluenceLiveTestGating(env);

      // scheme 은 AUTH_USER 존재로만 결정 — gating skip 이어도 진단용으로 채워진다.
      expect(gating.scheme).toBe("cloud-basic");
      expect(gating.authUser).toBe(FAKE_AUTH_USER);
      // 필수 3 종 부재라 skip — token/baseUrl 은 undefined.
      expect(gating.enabled).toBe(false);
      expect(gating.baseUrl).toBeUndefined();
      expect(gating.token).toBeUndefined();
    });

    it("AUTH_USER 부재 시 scheme=server-bearer / authUser=null (skip 분기에서도)", () => {
      const gating = resolveConfluenceLiveTestGating({});

      expect(gating.scheme).toBe("server-bearer");
      expect(gating.authUser).toBeNull();
      expect(gating.enabled).toBe(false);
    });

    it("enabled=true 면 reason 이 '활성', skip 이면 '부재' 를 보고한다(reason 박제 분기)", () => {
      const runReason = resolveConfluenceLiveTestGating(serverEnv()).reason;
      const skipReason = resolveConfluenceLiveTestGating({}).reason;

      expect(runReason).toContain("활성");
      expect(skipReason).toContain("부재");
    });
  });

  describe("error / negative: 필수 env 부재 → skip(enabled=false) + reason 에 해당 env 박제", () => {
    it("전부-부재(빈 env)면 enabled=false 이고 reason 에 필수 3 종 env 가 모두 박제된다", () => {
      const gating = resolveConfluenceLiveTestGating({});

      expect(gating.enabled).toBe(false);
      expect(gating.baseUrl).toBeUndefined();
      expect(gating.token).toBeUndefined();
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TEST_ENV);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_BASE_URL_ENV);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TOKEN_ENV);
    });

    it("CONFLUENCE_LIVE_TEST 부재 시 base URL·token 이 다 있어도 skip(flag 가 master gate)", () => {
      const env = serverEnv();
      delete env[CONFLUENCE_LIVE_TEST_ENV];

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TEST_ENV);
      // flag 만 빠졌으니 base URL/token env 는 reason 에 미포함.
      expect(gating.reason).not.toContain(CONFLUENCE_LIVE_BASE_URL_ENV);
      expect(gating.reason).not.toContain(CONFLUENCE_LIVE_TOKEN_ENV);
    });

    it("CONFLUENCE_LIVE_BASE_URL 부재 시 skip + reason 에 base URL env 박제", () => {
      const env = serverEnv();
      delete env[CONFLUENCE_LIVE_BASE_URL_ENV];

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_BASE_URL_ENV);
      expect(gating.reason).not.toContain(CONFLUENCE_LIVE_TEST_ENV);
    });

    it("CONFLUENCE_LIVE_TOKEN 부재 시 skip + reason 에 token env 박제", () => {
      const env = serverEnv();
      delete env[CONFLUENCE_LIVE_TOKEN_ENV];

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TOKEN_ENV);
    });

    it("빈 문자열 flag 는 부재로 취급되어 skip", () => {
      const env = serverEnv();
      env[CONFLUENCE_LIVE_TEST_ENV] = "";

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TEST_ENV);
    });

    it("공백-only flag 는 부재로 취급되어 skip", () => {
      const env = serverEnv();
      env[CONFLUENCE_LIVE_TEST_ENV] = "   ";

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TEST_ENV);
    });

    it("빈 문자열 base URL 은 부재로 취급되어 skip", () => {
      const env = serverEnv();
      env[CONFLUENCE_LIVE_BASE_URL_ENV] = "";

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_BASE_URL_ENV);
    });

    it("공백-only token 은 부재로 취급되어 skip", () => {
      const env = serverEnv();
      env[CONFLUENCE_LIVE_TOKEN_ENV] = "   ";

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TOKEN_ENV);
    });

    it("부분-set(flag + base URL 만, token 부재)은 enabled=false 이고 reason 이 빠진 env(token)만 보고", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_LIVE_TEST_ENV]: "1",
        [CONFLUENCE_LIVE_BASE_URL_ENV]: FAKE_BASE_URL,
      };

      const gating = resolveConfluenceLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(CONFLUENCE_LIVE_TOKEN_ENV);
      // 채워진 env(flag/base URL)는 reason 에 미포함.
      expect(gating.reason).not.toContain(CONFLUENCE_LIVE_TEST_ENV);
      expect(gating.reason).not.toContain(CONFLUENCE_LIVE_BASE_URL_ENV);
    });

    it("AUTH_USER 만 공백-only 면 Server Bearer 로 분기(gating 필수 아님 — 3 종 set 이면 enabled)", () => {
      const env = serverEnv();
      // AUTH_USER 가 공백-only — present 가 아니므로 Server Bearer 로 fall back.
      env[CONFLUENCE_LIVE_AUTH_USER_ENV] = "   ";

      const gating = resolveConfluenceLiveTestGating(env);

      // 필수 3 종이 set 이므로 enabled === true(AUTH_USER 는 gating 필수 아님).
      expect(gating.enabled).toBe(true);
      expect(gating.scheme).toBe("server-bearer");
      expect(gating.authUser).toBeNull();
    });
  });

  describe("security(§9): reason 에 실 token / base URL 값을 노출하지 않는다(env 이름만)", () => {
    it("활성(enabled) 시 reason 에 실 token / base URL 평문이 새어나오지 않는다", () => {
      const gating = resolveConfluenceLiveTestGating(cloudEnv());

      expect(gating.reason).not.toContain(FAKE_TOKEN);
      expect(gating.reason).not.toContain(FAKE_BASE_URL);
    });

    it("부분-set skip 시에도 reason 에 채워진 base URL 평문이 노출되지 않는다", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_LIVE_TEST_ENV]: "1",
        [CONFLUENCE_LIVE_BASE_URL_ENV]: FAKE_BASE_URL,
      };

      const gating = resolveConfluenceLiveTestGating(env);

      // base URL 은 set 됐지만 token 부재로 skip — reason 에 base URL 평문 미노출.
      expect(gating.reason).not.toContain(FAKE_BASE_URL);
    });
  });
});
