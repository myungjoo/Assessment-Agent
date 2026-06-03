// confluence-instance-config.spec — resolveConfluenceInstances 순수 helper 의 R-112
// unit test (T-0184, ADR-0018 Decision §2, ADR-0017 Decision §3 mirror). happy(전 key
// 활성) + error/negative(필수 env 부재 → reject) + flow(CONFLUENCE_INSTANCES 부재 /
// 다중·단일 SPACE / authUser Cloud·Server 분기 / 부분-set / 중복·대소문자 / 구분자
// 변형 각 분기) + 실값 미노출 을 cover. env→config 변환은 부수효과 0 순수 함수라
// missing/malformed 분기를 spec 이 직접 호출해 R-112 카테고리로 cover 한다
// (github-instance-config.spec.ts 패턴 mirror).
import {
  CONFLUENCE_AUTH_USER_SUFFIX,
  CONFLUENCE_BASE_URL_SUFFIX,
  CONFLUENCE_INSTANCES_ENV,
  CONFLUENCE_SPACE_ALLOWLIST_SUFFIX,
  CONFLUENCE_TOKEN_ENC_SUFFIX,
  confluenceEnvName,
  resolveConfluenceInstances,
} from "./confluence-instance-config";

// 단일 instance(key) 의 4 변수를 env 에 set 하는 helper — 실값 0(fixture 만, §9).
// authUser / allowlist 는 빈 문자열을 넘기면 미설정(공백 분기)로 시뮬레이션 가능.
function setInstance(
  env: NodeJS.ProcessEnv,
  key: string,
  baseUrl: string,
  authUser: string,
  tokenEnc: string,
  spaceAllowlist: string,
): void {
  env[confluenceEnvName(key, CONFLUENCE_BASE_URL_SUFFIX)] = baseUrl;
  env[confluenceEnvName(key, CONFLUENCE_AUTH_USER_SUFFIX)] = authUser;
  env[confluenceEnvName(key, CONFLUENCE_TOKEN_ENC_SUFFIX)] = tokenEnc;
  env[confluenceEnvName(key, CONFLUENCE_SPACE_ALLOWLIST_SUFFIX)] =
    spaceAllowlist;
}

describe("resolveConfluenceInstances — env→instance config 순수 helper", () => {
  describe("happy: CONFLUENCE_INSTANCES + 각 key 의 변수 set → 활성 config 배열", () => {
    it("2 instance 가 정확히 매핑된다(baseUrl/authUser/tokenEnc/spaceAllowlist + key 보존)", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_INSTANCES_ENV]: "cloud,internal",
      };
      // cloud: Cloud Basic 의도(authUser non-empty). internal: Server Bearer(authUser 빈).
      setInstance(
        env,
        "cloud",
        "https://acme.atlassian.net/wiki/rest/api",
        "ci@example.test",
        "enc-cloud-fixture",
        "DEV,DOCS",
      );
      setInstance(
        env,
        "internal",
        "https://confluence.internal.example/rest/api",
        "",
        "enc-internal-fixture",
        "RND",
      );

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(rejected).toEqual([]);
      expect(instances).toHaveLength(2);
      expect(instances[0]).toEqual({
        key: "cloud",
        baseUrl: "https://acme.atlassian.net/wiki/rest/api",
        authUser: "ci@example.test",
        tokenEnc: "enc-cloud-fixture",
        spaceAllowlist: ["DEV", "DOCS"],
      });
      // internal 은 Server Bearer 의도 — authUser 가 null 로 normalize.
      expect(instances[1].baseUrl).toBe(
        "https://confluence.internal.example/rest/api",
      );
      expect(instances[1].authUser).toBeNull();
      expect(instances[1].spaceAllowlist).toEqual(["RND"]);
      // CONFLUENCE_INSTANCES 열거 순서가 결과 배열 순서로 보존됨(상위 traversal
      // service 의 instance 순회 순서 가정 정합).
      expect(instances.map((i) => i.key)).toEqual(["cloud", "internal"]);
    });

    it("baseUrl/tokenEnc/authUser 주변 공백이 있어도 trim 되어 채워진다", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(
        env,
        "cloud",
        "  https://acme.atlassian.net/wiki/rest/api  ",
        "  ci@example.test  ",
        "\tenc-fixture\n",
        "DEV",
      );

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].baseUrl).toBe(
        "https://acme.atlassian.net/wiki/rest/api",
      );
      expect(instances[0].authUser).toBe("ci@example.test");
      expect(instances[0].tokenEnc).toBe("enc-fixture");
    });
  });

  describe("flow / 분기: 다중·단일·빈 SPACE allowlist, authUser 분기, 구분자 변형", () => {
    it("_SPACE_ALLOWLIST 다중 값은 comma-split + trim 되어 배열로 매핑된다", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(
        env,
        "cloud",
        "https://x/rest/api",
        "",
        "enc",
        "DEV, DOCS ,RND",
      );

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].spaceAllowlist).toEqual(["DEV", "DOCS", "RND"]);
    });

    it("_SPACE_ALLOWLIST 단일 값은 원소 1 개 배열로 매핑된다", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(env, "cloud", "https://x/rest/api", "", "enc", "DEV");

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].spaceAllowlist).toEqual(["DEV"]);
    });

    it("_AUTH_USER non-empty → authUser 가 그 값으로 박제(Cloud Basic 의도)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(
        env,
        "cloud",
        "https://x/rest/api",
        "user@example.test",
        "enc",
        "DEV",
      );

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].authUser).toBe("user@example.test");
    });

    it("key list 의 trailing comma / 연속 구분자 / 공백 토큰은 무시된다", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_INSTANCES_ENV]: " cloud, ,internal,, ",
      };
      setInstance(env, "cloud", "https://x/rest/api", "", "enc-cloud", "DEV");
      setInstance(
        env,
        "internal",
        "https://y/rest/api",
        "",
        "enc-internal",
        "RND",
      );

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toHaveLength(2);
      expect(instances.map((i) => i.key)).toEqual(["cloud", "internal"]);
      expect(rejected).toEqual([]);
    });

    it("whitespace 구분자(space-separated)도 comma 와 동일하게 split 된다", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_INSTANCES_ENV]: "cloud internal",
      };
      setInstance(env, "cloud", "https://x/rest/api", "", "enc-cloud", "DEV");
      setInstance(
        env,
        "internal",
        "https://y/rest/api",
        "",
        "enc-internal",
        "RND",
      );

      const { instances } = resolveConfluenceInstances(env);

      expect(instances.map((i) => i.key)).toEqual(["cloud", "internal"]);
    });
  });

  describe("부분 활성: 일부 key 만 완전 set → 그 key 만 활성", () => {
    it("열거된 key 중 필수 변수 set 된 key 만 활성, 나머지는 reject", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_INSTANCES_ENV]: "cloud,internal",
      };
      // cloud 만 완전 set, internal 은 변수 전부 부재(부분-set).
      setInstance(env, "cloud", "https://x/rest/api", "", "enc-cloud", "DEV");

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toHaveLength(1);
      expect(instances[0].key).toBe("cloud");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toContain("internal");
    });
  });

  describe("error / negative: 필수 env 부재 → reject (평문/빈 fallback 안 함)", () => {
    it("(a) CONFLUENCE_INSTANCES undefined → 활성 0(빈 결과), reject 0", () => {
      const { instances, rejected } = resolveConfluenceInstances({});

      expect(instances).toEqual([]);
      expect(rejected).toEqual([]);
    });

    it("(a) CONFLUENCE_INSTANCES 빈 문자열 → 활성 0", () => {
      const { instances } = resolveConfluenceInstances({
        [CONFLUENCE_INSTANCES_ENV]: "",
      });
      expect(instances).toEqual([]);
    });

    it("(a) CONFLUENCE_INSTANCES 공백-only → 활성 0", () => {
      const { instances } = resolveConfluenceInstances({
        [CONFLUENCE_INSTANCES_ENV]: "   ",
      });
      expect(instances).toEqual([]);
    });

    it("(b) 열거된 key 의 _BASE_URL 부재 → reject(진단에 _BASE_URL env 이름 박제)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      env[confluenceEnvName("cloud", CONFLUENCE_TOKEN_ENC_SUFFIX)] =
        "enc-fixture";
      // _BASE_URL 미설정.

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        confluenceEnvName("cloud", CONFLUENCE_BASE_URL_SUFFIX),
      );
    });

    it("(b) 열거된 key 의 _BASE_URL 이 공백-only → reject", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(env, "cloud", "   ", "", "enc-fixture", "DEV");

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        confluenceEnvName("cloud", CONFLUENCE_BASE_URL_SUFFIX),
      );
    });

    it("(c) 열거된 key 의 _TOKEN_ENC 부재 → reject(평문 fallback 안 함)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      env[confluenceEnvName("cloud", CONFLUENCE_BASE_URL_SUFFIX)] =
        "https://x/rest/api";
      // _TOKEN_ENC 미설정.

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        confluenceEnvName("cloud", CONFLUENCE_TOKEN_ENC_SUFFIX),
      );
    });

    it("(c) 열거된 key 의 _TOKEN_ENC 가 공백-only → reject", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(env, "cloud", "https://x/rest/api", "", "   ", "DEV");

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        confluenceEnvName("cloud", CONFLUENCE_TOKEN_ENC_SUFFIX),
      );
    });

    it("(d) _SPACE_ALLOWLIST 빈/부재 → spaceAllowlist 빈 배열(reject 사유 아님)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      env[confluenceEnvName("cloud", CONFLUENCE_BASE_URL_SUFFIX)] =
        "https://x/rest/api";
      env[confluenceEnvName("cloud", CONFLUENCE_TOKEN_ENC_SUFFIX)] =
        "enc-fixture";
      // _SPACE_ALLOWLIST / _AUTH_USER 미설정.

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(rejected).toEqual([]);
      expect(instances).toHaveLength(1);
      expect(instances[0].spaceAllowlist).toEqual([]);
    });

    it("(d) _SPACE_ALLOWLIST 가 공백-only → spaceAllowlist 빈 배열", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      setInstance(env, "cloud", "https://x/rest/api", "", "enc-fixture", "   ");

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].spaceAllowlist).toEqual([]);
    });

    it("(g) _AUTH_USER 가 공백-only → authUser null(Cloud Basic 아니라 Server Bearer 의도로 normalize)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "internal" };
      setInstance(
        env,
        "internal",
        "https://y/rest/api",
        "   ",
        "enc-fixture",
        "RND",
      );

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].authUser).toBeNull();
    });

    it("(g) _AUTH_USER 부재 → authUser null", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "internal" };
      env[confluenceEnvName("internal", CONFLUENCE_BASE_URL_SUFFIX)] =
        "https://y/rest/api";
      env[confluenceEnvName("internal", CONFLUENCE_TOKEN_ENC_SUFFIX)] =
        "enc-fixture";
      // _AUTH_USER 미설정.

      const { instances } = resolveConfluenceInstances(env);

      expect(instances[0].authUser).toBeNull();
    });

    it("(e) 중복 key → 먼저 등장한 1 개만 활성, 이후 중복은 reject", () => {
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_INSTANCES_ENV]: "cloud,cloud",
      };
      setInstance(env, "cloud", "https://x/rest/api", "", "enc-cloud", "DEV");

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toHaveLength(1);
      expect(rejected.some((r) => r.includes("중복"))).toBe(true);
    });

    it("(e) 대소문자만 다른 중복 key(cloud ≡ Cloud) → 대문자 정규화로 dedupe, 이후 분은 reject", () => {
      // 대문자 정규화(confluenceEnvName)로 env 이름이 동일하므로 "cloud" 와 "Cloud" 는
      // 같은 instance 로 간주된다 — 먼저 등장한 원형 key 만 활성, 뒤의 변형은 중복 reject.
      const env: NodeJS.ProcessEnv = {
        [CONFLUENCE_INSTANCES_ENV]: "cloud,Cloud",
      };
      env["CONFLUENCE_CLOUD_BASE_URL"] = "https://x/rest/api";
      env["CONFLUENCE_CLOUD_TOKEN_ENC"] = "enc-fixture";

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toHaveLength(1);
      // 먼저 등장한 원형("cloud")이 보존되고, 뒤 변형("Cloud")이 reject 된다.
      expect(instances[0].key).toBe("cloud");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toContain("Cloud");
      expect(rejected[0]).toContain("중복");
    });

    it("(e) key 대소문자 변형 → 대문자 정규화로 env 이름 매핑(Cloud ≡ CLOUD env)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "Cloud" };
      // env 이름은 CONFLUENCE_CLOUD_* (대문자) — key 가 "Cloud" 여도 매핑.
      env["CONFLUENCE_CLOUD_BASE_URL"] = "https://x/rest/api";
      env["CONFLUENCE_CLOUD_TOKEN_ENC"] = "enc-fixture";

      const { instances } = resolveConfluenceInstances(env);

      expect(instances).toHaveLength(1);
      expect(instances[0].key).toBe("Cloud");
      expect(instances[0].baseUrl).toBe("https://x/rest/api");
    });

    it("(f) 열거된 key 인데 변수 전부 부재 → reject(부분-set 진단)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "ghost" };
      // ghost 의 어떤 변수도 set 하지 않음.

      const { instances, rejected } = resolveConfluenceInstances(env);

      expect(instances).toEqual([]);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toContain(
        confluenceEnvName("ghost", CONFLUENCE_BASE_URL_SUFFIX),
      );
      expect(rejected[0]).toContain(
        confluenceEnvName("ghost", CONFLUENCE_TOKEN_ENC_SUFFIX),
      );
    });

    it("(h) reject 진단에 실 token 암호문 값을 노출하지 않는다(이름만 박제, §9)", () => {
      const env: NodeJS.ProcessEnv = { [CONFLUENCE_INSTANCES_ENV]: "cloud" };
      // _BASE_URL 부재로 reject 되지만 _TOKEN_ENC 실값은 진단에 새어나오면 안 됨.
      env[confluenceEnvName("cloud", CONFLUENCE_TOKEN_ENC_SUFFIX)] =
        "secret-enc-value-should-not-leak";

      const { rejected } = resolveConfluenceInstances(env);

      expect(rejected[0]).not.toContain("secret-enc-value-should-not-leak");
    });
  });

  describe("confluenceEnvName — env 이름 조립 순수 함수", () => {
    it("key 를 대문자로 정규화하고 suffix 를 붙인다", () => {
      expect(confluenceEnvName("cloud", CONFLUENCE_BASE_URL_SUFFIX)).toBe(
        "CONFLUENCE_CLOUD_BASE_URL",
      );
      expect(confluenceEnvName("Internal", CONFLUENCE_AUTH_USER_SUFFIX)).toBe(
        "CONFLUENCE_INTERNAL_AUTH_USER",
      );
      expect(confluenceEnvName("cloud", CONFLUENCE_TOKEN_ENC_SUFFIX)).toBe(
        "CONFLUENCE_CLOUD_TOKEN_ENC",
      );
      expect(
        confluenceEnvName("cloud", CONFLUENCE_SPACE_ALLOWLIST_SUFFIX),
      ).toBe("CONFLUENCE_CLOUD_SPACE_ALLOWLIST");
    });
  });
});
