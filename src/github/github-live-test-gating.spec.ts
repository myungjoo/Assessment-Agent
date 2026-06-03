// github-live-test-gating.spec — resolveGithubLiveTestGating 순수 helper 의 R-112
// unit test (T-0204, ADR-0021 Decision §(i)·§(ii)). happy(전부 set 또는 일부 host
// set → run) + error/negative(flag 부재·host token 부재·빈 문자열·공백-only·부분-set
// → skip) + flow(host 별 활성/비활성 분기 각 1+) + §9 안전(reason 에 실 token 미노출)
// 을 cover 한다. live smoke 의 describe.skip 본문은 직접 test 불가하므로 gating
// 분기를 본 순수 함수로 분리해 여기서 검증한다(R-112 entrypoint-helper 분리 원칙
// mirror — src/llm/llm-live-test-gating.spec.ts 동형).
import {
  GITHUB_LIVE_HOST_SPECS,
  GITHUB_LIVE_TEST_ENV,
  GITHUB_LIVE_TOKEN_ECODE_ENV,
  GITHUB_LIVE_TOKEN_PUBLIC_ENV,
  GITHUB_LIVE_TOKEN_SEC_ENV,
  resolveGithubLiveTestGating,
} from "./github-live-test-gating";

// 3 host token 평문(명백한 가짜 fixture — 실 credential 0, CLAUDE.md §9). reason 에
// 이 값들이 새어나오지 않음을 §9 test 가 검증한다.
const PUBLIC_TOKEN = "ghp_FAKE_PUBLIC_TOKEN_DO_NOT_USE_0001";
const SEC_TOKEN = "ghp_FAKE_SEC_TOKEN_DO_NOT_USE_0002";
const ECODE_TOKEN = "ghp_FAKE_ECODE_TOKEN_DO_NOT_USE_0003";

// 3 host 전부 + flag 가 set 된 완전한 gating env — 개별 case 가 일부만 누락/변형.
function fullEnv(): NodeJS.ProcessEnv {
  return {
    [GITHUB_LIVE_TEST_ENV]: "1",
    [GITHUB_LIVE_TOKEN_PUBLIC_ENV]: PUBLIC_TOKEN,
    [GITHUB_LIVE_TOKEN_SEC_ENV]: SEC_TOKEN,
    [GITHUB_LIVE_TOKEN_ECODE_ENV]: ECODE_TOKEN,
  };
}

describe("resolveGithubLiveTestGating — GitHub live smoke gating 순수 helper", () => {
  describe("happy: flag + host token set → 해당 host enabled(run)", () => {
    it("flag + 3 host token 모두 set 이면 3 host 전부 enabled 이고 token 이 trim 되어 채워진다", () => {
      const gating = resolveGithubLiveTestGating(fullEnv());

      expect(gating.enabled).toBe(true);
      expect(gating.enabledHosts).toHaveLength(3);
      expect(gating.hosts).toHaveLength(3);

      const publicHost = gating.hosts.find((h) => h.key === "public");
      expect(publicHost?.enabled).toBe(true);
      expect(publicHost?.host).toBe("github.com");
      expect(publicHost?.token).toBe(PUBLIC_TOKEN);

      const secHost = gating.hosts.find((h) => h.key === "sec");
      expect(secHost?.enabled).toBe(true);
      expect(secHost?.host).toBe("github.sec.samsung.net");
      expect(secHost?.token).toBe(SEC_TOKEN);

      const ecodeHost = gating.hosts.find((h) => h.key === "ecode");
      expect(ecodeHost?.enabled).toBe(true);
      expect(ecodeHost?.host).toBe("github.ecodesamsung.com");
      expect(ecodeHost?.token).toBe(ECODE_TOKEN);

      expect(gating.reason).toContain("활성");
    });

    it("주변 공백이 있어도 token 이 trim 되어 채워진다", () => {
      const env = fullEnv();
      env[GITHUB_LIVE_TOKEN_PUBLIC_ENV] = `  ${PUBLIC_TOKEN}  `;
      env[GITHUB_LIVE_TOKEN_SEC_ENV] = `\t${SEC_TOKEN}\n`;

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.hosts.find((h) => h.key === "public")?.token).toBe(
        PUBLIC_TOKEN,
      );
      expect(gating.hosts.find((h) => h.key === "sec")?.token).toBe(SEC_TOKEN);
    });

    it("host spec 상수가 ADR-0017 instance key(public/sec/ecode)와 정합한다", () => {
      expect(GITHUB_LIVE_HOST_SPECS.map((s) => s.key)).toEqual([
        "public",
        "sec",
        "ecode",
      ]);
      expect(GITHUB_LIVE_HOST_SPECS.map((s) => s.host)).toEqual([
        "github.com",
        "github.sec.samsung.net",
        "github.ecodesamsung.com",
      ]);
    });
  });

  describe("flow / 분기: 부분 활성(host 별 enabled/disabled 각 1+)", () => {
    it("flag + public token 만 set 이면 public 만 활성, Enterprise 2 host 는 skip(부분 활성)", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_LIVE_TEST_ENV]: "1",
        [GITHUB_LIVE_TOKEN_PUBLIC_ENV]: PUBLIC_TOKEN,
      };

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.enabledHosts).toHaveLength(1);
      expect(gating.enabledHosts[0].key).toBe("public");
      expect(gating.hosts.find((h) => h.key === "public")?.enabled).toBe(true);
      expect(gating.hosts.find((h) => h.key === "sec")?.enabled).toBe(false);
      expect(gating.hosts.find((h) => h.key === "ecode")?.enabled).toBe(false);
      // skip 된 host 의 token env 이름이 reason 에 박제(부분 활성 진단).
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_SEC_ENV);
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_ECODE_ENV);
    });

    it("flag + Enterprise(sec) token 만 set 이면 sec 만 활성, public/ecode skip", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_LIVE_TEST_ENV]: "1",
        [GITHUB_LIVE_TOKEN_SEC_ENV]: SEC_TOKEN,
      };

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(true);
      expect(gating.enabledHosts).toHaveLength(1);
      expect(gating.enabledHosts[0].key).toBe("sec");
      expect(gating.enabledHosts[0].token).toBe(SEC_TOKEN);
      expect(gating.hosts.find((h) => h.key === "public")?.enabled).toBe(false);
      expect(gating.hosts.find((h) => h.key === "ecode")?.enabled).toBe(false);
    });

    it("비활성 host 는 token 이 undefined 로 남는다(활성 host 만 token narrowing)", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_LIVE_TEST_ENV]: "1",
        [GITHUB_LIVE_TOKEN_ECODE_ENV]: ECODE_TOKEN,
      };

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.hosts.find((h) => h.key === "ecode")?.token).toBe(
        ECODE_TOKEN,
      );
      expect(
        gating.hosts.find((h) => h.key === "public")?.token,
      ).toBeUndefined();
      expect(gating.hosts.find((h) => h.key === "sec")?.token).toBeUndefined();
    });
  });

  describe("error / negative: flag 부재·host token 부재·부분-set → skip(enabled=false)", () => {
    it("전부-부재(빈 env)면 enabled=false 이고 reason 에 flag env 가 박제된다", () => {
      const gating = resolveGithubLiveTestGating({});

      expect(gating.enabled).toBe(false);
      expect(gating.enabledHosts).toHaveLength(0);
      // 전 host 가 비활성 + token undefined.
      expect(gating.hosts.every((h) => !h.enabled)).toBe(true);
      expect(gating.hosts.every((h) => h.token === undefined)).toBe(true);
      expect(gating.reason).toContain(GITHUB_LIVE_TEST_ENV);
    });

    it("GITHUB_LIVE_TEST 부재 시 host token 이 다 있어도 전 host skip(flag 가 master gate)", () => {
      const env = fullEnv();
      delete env[GITHUB_LIVE_TEST_ENV];

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.enabledHosts).toHaveLength(0);
      expect(gating.reason).toContain(GITHUB_LIVE_TEST_ENV);
    });

    it("flag 만 set + 전 host token 부재 → 전 host skip", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_LIVE_TEST_ENV]: "1" };

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_PUBLIC_ENV);
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_SEC_ENV);
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_ECODE_ENV);
      // flag 는 present 이므로 reason 에 flag env 는 미포함.
      expect(gating.reason).not.toContain(GITHUB_LIVE_TEST_ENV);
    });

    it("빈 문자열 flag 는 부재로 취급되어 전 host skip", () => {
      const env = fullEnv();
      env[GITHUB_LIVE_TEST_ENV] = "";

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(GITHUB_LIVE_TEST_ENV);
    });

    it("공백-only flag 는 부재로 취급되어 전 host skip", () => {
      const env = fullEnv();
      env[GITHUB_LIVE_TEST_ENV] = "   ";

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.enabled).toBe(false);
      expect(gating.reason).toContain(GITHUB_LIVE_TEST_ENV);
    });

    it("빈 문자열 host token 은 부재로 취급되어 그 host skip(나머지 영향 0)", () => {
      const env = fullEnv();
      env[GITHUB_LIVE_TOKEN_PUBLIC_ENV] = "";

      const gating = resolveGithubLiveTestGating(env);

      // public 만 skip, sec/ecode 는 여전히 활성(부분 활성 유지).
      expect(gating.enabled).toBe(true);
      expect(gating.hosts.find((h) => h.key === "public")?.enabled).toBe(false);
      expect(gating.hosts.find((h) => h.key === "sec")?.enabled).toBe(true);
      expect(gating.hosts.find((h) => h.key === "ecode")?.enabled).toBe(true);
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_PUBLIC_ENV);
    });

    it("공백-only host token 은 부재로 취급되어 그 host skip", () => {
      const env = fullEnv();
      env[GITHUB_LIVE_TOKEN_SEC_ENV] = "   ";

      const gating = resolveGithubLiveTestGating(env);

      expect(gating.hosts.find((h) => h.key === "sec")?.enabled).toBe(false);
      expect(gating.reason).toContain(GITHUB_LIVE_TOKEN_SEC_ENV);
    });
  });

  describe("security(§9): reason 에 실 token 값을 노출하지 않는다(이름만 박제)", () => {
    it("부분 활성 skip 시 reason 에 활성 host 의 실 token 값이 새어나오지 않는다", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_LIVE_TEST_ENV]: "1",
        [GITHUB_LIVE_TOKEN_PUBLIC_ENV]: PUBLIC_TOKEN,
      };

      const gating = resolveGithubLiveTestGating(env);

      // 활성 host(public)의 token 평문이 reason 에 노출되면 안 됨(env 이름만 보고).
      expect(gating.reason).not.toContain(PUBLIC_TOKEN);
    });

    it("전부 set(전 host 활성) 시에도 reason 에 어느 token 평문도 노출하지 않는다", () => {
      const gating = resolveGithubLiveTestGating(fullEnv());

      expect(gating.reason).not.toContain(PUBLIC_TOKEN);
      expect(gating.reason).not.toContain(SEC_TOKEN);
      expect(gating.reason).not.toContain(ECODE_TOKEN);
    });
  });
});
