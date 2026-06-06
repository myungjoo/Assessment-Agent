// github-instance-config.spec — resolveGithubInstances 순수 helper 의 R-112 unit test
// (T-0178, ADR-0017 Decision §3). happy(전 key 활성) + error/negative(필수 env 부재 →
// reject) + flow(GITHUB_INSTANCES 부재 / 다중·단일 org / 부분-set / 중복·대소문자 /
// 구분자 변형 각 분기) + 실값 미노출 을 cover. env→config 변환은 부수효과 0 순수
// 함수라 missing/malformed 분기를 spec 이 직접 호출해 R-112 카테고리로 cover 한다
// (llm-live-test-gating.spec.ts 패턴 mirror).
import {
  GITHUB_HOST_SUFFIX,
  GITHUB_INSTANCES_ENV,
  GITHUB_ORG_SUFFIX,
  GITHUB_REPOS_SUFFIX,
  GITHUB_TOKEN_ENC_SUFFIX,
  githubEnvName,
  resolveGithubInstances,
} from "./github-instance-config";

// 단일 instance(key) 의 3 필수 변수(+ 선택 _REPOS)를 env 에 set 하는 helper —
// 실값 0(fixture 만, §9). repos 인자가 주어지면 _REPOS 도 set(미지정 시 미설정).
function setInstance(
  env: NodeJS.ProcessEnv,
  key: string,
  host: string,
  org: string,
  tokenEnc: string,
  repos?: string,
): void {
  env[githubEnvName(key, GITHUB_HOST_SUFFIX)] = host;
  env[githubEnvName(key, GITHUB_ORG_SUFFIX)] = org;
  env[githubEnvName(key, GITHUB_TOKEN_ENC_SUFFIX)] = tokenEnc;
  if (repos !== undefined) {
    env[githubEnvName(key, GITHUB_REPOS_SUFFIX)] = repos;
  }
}

describe("resolveGithubInstances — env→instance config 순수 helper", () => {
  describe("happy: GITHUB_INSTANCES + 각 key 의 3 변수 set → 활성 config 배열", () => {
    it("3 instance 가 정확히 매핑된다(host/orgs/tokenEnc + key 보존)", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_INSTANCES_ENV]: "public,sec,ecode",
      };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-public-fixture",
      );
      setInstance(
        env,
        "sec",
        "github.sec.samsung.net",
        "sec-org",
        "enc-sec-fixture",
      );
      setInstance(
        env,
        "ecode",
        "github.ecodesamsung.com",
        "ecode-org",
        "enc-ecode-fixture",
      );

      const { instances, rejected } = resolveGithubInstances(env);

      expect(rejected).toEqual([]);
      expect(instances).toHaveLength(3);
      expect(instances[0]).toEqual({
        key: "public",
        host: "github.com",
        orgs: ["octo-org"],
        repos: [],
        tokenEnc: "enc-public-fixture",
      });
      expect(instances[1].host).toBe("github.sec.samsung.net");
      expect(instances[2].key).toBe("ecode");
      // GITHUB_INSTANCES 열거 순서가 결과 배열 순서로 보존됨(상위 orchestrator 의
      // instance 순회 순서 가정 정합).
      expect(instances.map((i) => i.key)).toEqual(["public", "sec", "ecode"]);
    });

    it("host/tokenEnc 주변 공백이 있어도 trim 되어 채워진다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "  github.com  ",
        "octo-org",
        "\tenc-fixture\n",
      );

      const { instances } = resolveGithubInstances(env);

      expect(instances[0].host).toBe("github.com");
      expect(instances[0].tokenEnc).toBe("enc-fixture");
    });
  });

  describe("flow / 분기: 다중·단일 org, key list 구분자 변형", () => {
    it("_ORG 다중 값은 comma-split + trim 되어 배열로 매핑된다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "github.com", "a, b ,c", "enc-fixture");

      const { instances } = resolveGithubInstances(env);

      expect(instances[0].orgs).toEqual(["a", "b", "c"]);
    });

    it("_ORG 단일 값은 원소 1 개 배열로 매핑된다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "github.com", "solo-org", "enc-fixture");

      const { instances } = resolveGithubInstances(env);

      expect(instances[0].orgs).toEqual(["solo-org"]);
    });

    it("key list 의 trailing comma / 연속 구분자 / 공백 토큰은 무시된다", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_INSTANCES_ENV]: " public, ,sec,, ",
      };
      setInstance(env, "public", "github.com", "octo-org", "enc-public");
      setInstance(env, "sec", "github.sec.samsung.net", "sec-org", "enc-sec");

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toHaveLength(2);
      expect(instances.map((i) => i.key)).toEqual(["public", "sec"]);
      expect(rejected).toEqual([]);
    });

    it("whitespace 구분자(space-separated)도 comma 와 동일하게 split 된다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public sec" };
      setInstance(env, "public", "github.com", "octo-org", "enc-public");
      setInstance(env, "sec", "github.sec.samsung.net", "sec-org", "enc-sec");

      const { instances } = resolveGithubInstances(env);

      expect(instances.map((i) => i.key)).toEqual(["public", "sec"]);
    });
  });

  describe("부분 활성: 일부 key 만 완전 set → 그 key 만 활성", () => {
    it("열거된 key 중 변수 set 된 key 만 활성, 나머지는 reject", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_INSTANCES_ENV]: "public,sec",
      };
      // public 만 완전 set, sec 은 변수 전부 부재(부분-set).
      setInstance(env, "public", "github.com", "octo-org", "enc-public");

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toHaveLength(1);
      expect(instances[0].key).toBe("public");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toContain("sec");
    });
  });

  describe("error / negative: 필수 env 부재 → reject (평문/빈 fallback 안 함)", () => {
    it("(a) GITHUB_INSTANCES undefined → 활성 0(빈 결과), reject 0", () => {
      const { instances, rejected } = resolveGithubInstances({});

      expect(instances).toEqual([]);
      expect(rejected).toEqual([]);
    });

    it("(a) GITHUB_INSTANCES 빈 문자열 → 활성 0", () => {
      const { instances } = resolveGithubInstances({
        [GITHUB_INSTANCES_ENV]: "",
      });
      expect(instances).toEqual([]);
    });

    it("(a) GITHUB_INSTANCES 공백-only → 활성 0", () => {
      const { instances } = resolveGithubInstances({
        [GITHUB_INSTANCES_ENV]: "   ",
      });
      expect(instances).toEqual([]);
    });

    it("(b) 열거된 key 의 _HOST 부재 → reject(진단에 _HOST env 이름 박제)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      env[githubEnvName("public", GITHUB_TOKEN_ENC_SUFFIX)] = "enc-fixture";
      // _HOST 미설정.

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        githubEnvName("public", GITHUB_HOST_SUFFIX),
      );
    });

    it("(b) 열거된 key 의 _HOST 가 공백-only → reject", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "   ", "octo-org", "enc-fixture");

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        githubEnvName("public", GITHUB_HOST_SUFFIX),
      );
    });

    it("(c) 열거된 key 의 _TOKEN_ENC 부재 → reject(평문 fallback 안 함)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      env[githubEnvName("public", GITHUB_HOST_SUFFIX)] = "github.com";
      // _TOKEN_ENC 미설정.

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        githubEnvName("public", GITHUB_TOKEN_ENC_SUFFIX),
      );
    });

    it("(c) 열거된 key 의 _TOKEN_ENC 가 공백-only → reject", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "github.com", "octo-org", "   ");

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        githubEnvName("public", GITHUB_TOKEN_ENC_SUFFIX),
      );
    });

    it("(d) _ORG 빈/부재 → orgs 빈 배열(reject 사유 아님, 필수 변수는 충족)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      env[githubEnvName("public", GITHUB_HOST_SUFFIX)] = "github.com";
      env[githubEnvName("public", GITHUB_TOKEN_ENC_SUFFIX)] = "enc-fixture";
      // _ORG 미설정.

      const { instances, rejected } = resolveGithubInstances(env);

      expect(rejected).toEqual([]);
      expect(instances).toHaveLength(1);
      expect(instances[0].orgs).toEqual([]);
    });

    it("(d) _ORG 가 공백-only → orgs 빈 배열", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "github.com", "   ", "enc-fixture");

      const { instances } = resolveGithubInstances(env);

      expect(instances[0].orgs).toEqual([]);
    });

    it("(e) 중복 key → 먼저 등장한 1 개만 활성, 이후 중복은 reject", () => {
      const env: NodeJS.ProcessEnv = {
        [GITHUB_INSTANCES_ENV]: "public,public",
      };
      setInstance(env, "public", "github.com", "octo-org", "enc-public");

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toHaveLength(1);
      expect(rejected.some((r) => r.includes("중복"))).toBe(true);
    });

    it("(e) 대소문자만 다른 중복 key(public ≡ Public) → 대문자 정규화로 dedupe, 이후 분은 reject", () => {
      // 대문자 정규화(githubEnvName)로 env 이름이 동일하므로 "public" 과 "Public" 은
      // 같은 instance 로 간주된다 — 먼저 등장한 원형 key 만 활성, 뒤의 변형은 중복 reject.
      // exact-string 중복(위 test)과 구분되는 case-insensitive dedupe 분기 cover.
      const env: NodeJS.ProcessEnv = {
        [GITHUB_INSTANCES_ENV]: "public,Public",
      };
      env["GITHUB_PUBLIC_HOST"] = "github.com";
      env["GITHUB_PUBLIC_TOKEN_ENC"] = "enc-fixture";

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toHaveLength(1);
      // 먼저 등장한 원형("public")이 보존되고, 뒤 변형("Public")이 reject 된다.
      expect(instances[0].key).toBe("public");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toContain("Public");
      expect(rejected[0]).toContain("중복");
    });

    it("(e) key 대소문자 변형 → 대문자 정규화로 env 이름 매핑(Public ≡ PUBLIC env)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "Public" };
      // env 이름은 GITHUB_PUBLIC_* (대문자) — key 가 "Public" 이어도 매핑.
      env["GITHUB_PUBLIC_HOST"] = "github.com";
      env["GITHUB_PUBLIC_TOKEN_ENC"] = "enc-fixture";

      const { instances } = resolveGithubInstances(env);

      expect(instances).toHaveLength(1);
      expect(instances[0].key).toBe("Public");
      expect(instances[0].host).toBe("github.com");
    });

    it("(f) 열거된 key 인데 변수 전부 부재 → reject(부분-set 진단)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "ghost" };
      // ghost 의 어떤 변수도 set 하지 않음.

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toEqual([]);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toContain(githubEnvName("ghost", GITHUB_HOST_SUFFIX));
      expect(rejected[0]).toContain(
        githubEnvName("ghost", GITHUB_TOKEN_ENC_SUFFIX),
      );
    });

    it("reject 진단에 실 token 암호문 값을 노출하지 않는다(이름만 박제, §9)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      // _HOST 부재로 reject 되지만 _TOKEN_ENC 실값은 진단에 새어나오면 안 됨.
      env[githubEnvName("public", GITHUB_TOKEN_ENC_SUFFIX)] =
        "secret-enc-value-should-not-leak";

      const { rejected } = resolveGithubInstances(env);

      expect(rejected[0]).not.toContain("secret-enc-value-should-not-leak");
    });
  });

  describe("_REPOS(ADR-0030 §1 모드 B) — repo allowlist 파싱", () => {
    it("happy: _REPOS 설정 시 토큰이 repos 배열로 매핑된다(org/repo + repo 형식)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        "octo-org/repo-a, repo-b",
      );

      const { instances } = resolveGithubInstances(env);

      expect(instances[0].repos).toEqual(["octo-org/repo-a", "repo-b"]);
      // repos 추가가 host/orgs/tokenEnc 회귀를 일으키지 않음(다른 필드 보존).
      expect(instances[0].orgs).toEqual(["octo-org"]);
      expect(instances[0].host).toBe("github.com");
    });

    it("단일 토큰은 원소 1 개 배열로 매핑된다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        "solo/repo",
      );
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([
        "solo/repo",
      ]);
    });

    it("(a) _REPOS 부재 → repos 빈 배열(모드 A org 전체 fallback 대상)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "github.com", "octo-org", "enc-fixture");
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([]);
    });

    it("(b) _REPOS 빈 문자열 → repos 빈 배열", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(env, "public", "github.com", "octo-org", "enc-fixture", "");
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([]);
    });

    it("(b) _REPOS 공백-only → repos 빈 배열", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        "   ",
      );
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([]);
    });

    it("(c) comma-separated 토큰 split + trim", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        "a/x, b/y ,c/z",
      );
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([
        "a/x",
        "b/y",
        "c/z",
      ]);
    });

    it("(d) space-separated 토큰도 split 된다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        "a/x b/y c/z",
      );
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([
        "a/x",
        "b/y",
        "c/z",
      ]);
    });

    it("(e) comma+space 혼합 구분자도 split 된다", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        " a/x,  b/y ,, c/z ",
      );
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([
        "a/x",
        "b/y",
        "c/z",
      ]);
    });

    it("(f) trailing/연속 구분자/빈 토큰은 무시된다(빈 문자열 미생성)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      setInstance(
        env,
        "public",
        "github.com",
        "octo-org",
        "enc-fixture",
        "a/x,,, ,b/y,",
      );
      expect(resolveGithubInstances(env).instances[0].repos).toEqual([
        "a/x",
        "b/y",
      ]);
    });

    it("(g) _REPOS 설정됐어도 필수 env(_TOKEN_ENC) 부재면 instance reject(repos 가 reject 를 막지 않음)", () => {
      const env: NodeJS.ProcessEnv = { [GITHUB_INSTANCES_ENV]: "public" };
      env[githubEnvName("public", GITHUB_HOST_SUFFIX)] = "github.com";
      env[githubEnvName("public", GITHUB_REPOS_SUFFIX)] = "octo-org/repo-a";
      // _TOKEN_ENC 미설정.

      const { instances, rejected } = resolveGithubInstances(env);

      expect(instances).toEqual([]);
      expect(rejected[0]).toContain(
        githubEnvName("public", GITHUB_TOKEN_ENC_SUFFIX),
      );
    });
  });

  describe("githubEnvName — env 이름 조립 순수 함수", () => {
    it("key 를 대문자로 정규화하고 suffix 를 붙인다", () => {
      expect(githubEnvName("public", GITHUB_HOST_SUFFIX)).toBe(
        "GITHUB_PUBLIC_HOST",
      );
      expect(githubEnvName("Sec", GITHUB_ORG_SUFFIX)).toBe("GITHUB_SEC_ORG");
      expect(githubEnvName("ecode", GITHUB_TOKEN_ENC_SUFFIX)).toBe(
        "GITHUB_ECODE_TOKEN_ENC",
      );
    });
  });
});
