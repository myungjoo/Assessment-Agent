// CollectionSpecService 의 unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). ADR-0030 §3 Confluence enumerate + §5 buildCollectionSpec
// 전체 조립. resolveConfluenceInstances(순수 함수)는 실제로 통과시키고
// GithubCollectionSpecService(async)만 jest mock 으로 주입한다(Q-0025 deferred 정합 —
// 실 GitHub/Confluence 호출 0 / 실 token 0). env 는 임의 map literal 로 주입.

import {
  assessCollectionCoverage,
  CollectionSpecService,
} from "./collection-spec.service";
import {
  GithubCollectionSpecInput,
  GithubCollectionSpecService,
} from "./github-collection-spec.service";
import { GithubCollectionSpec } from "./github-collection.service";

// ENV_CONF — 활성 Confluence instance 1 개(cloud)를 산출하는 env map. _BASE_URL +
// _TOKEN_ENC 가 필수(authUser/spaceAllowlist 는 선택 → null/빈 배열).
const ENV_CONF: NodeJS.ProcessEnv = {
  CONFLUENCE_INSTANCES: "cloud",
  CONFLUENCE_CLOUD_BASE_URL: "https://ws.atlassian.net/wiki/rest/api",
  CONFLUENCE_CLOUD_TOKEN_ENC: "enc-conf",
};

// CLOUD_INSTANCE — ENV_CONF 가 resolveConfluenceInstances 로 산출하는 instance config.
const CLOUD_INSTANCE = {
  key: "cloud",
  baseUrl: "https://ws.atlassian.net/wiki/rest/api",
  authUser: null,
  tokenEnc: "enc-conf",
  spaceAllowlist: [],
};

// GITHUB_SPEC — GitHub service mock 의 happy 반환(buildGithubCollectionSpec 결과).
const GITHUB_SPEC: GithubCollectionSpec = {
  sources: [
    { instanceKey: "public", org: "acme", repo: "api", since: undefined },
  ],
};

// makeService — GithubCollectionSpecService.buildGithubCollectionSpec 만 mock 한 service.
// env === undefined 면 env 인자를 생략해 @Optional 기본값(process.env) 경로를 탄다.
function makeService(
  env: NodeJS.ProcessEnv | undefined,
  handler: (
    person: GithubCollectionSpecInput,
    since?: string,
  ) => GithubCollectionSpec | Promise<GithubCollectionSpec>,
): { service: CollectionSpecService; spy: jest.Mock } {
  const spy = jest.fn(
    async (
      person: GithubCollectionSpecInput,
      since?: string,
    ): Promise<GithubCollectionSpec> => handler(person, since),
  );
  const githubSpecService = {
    buildGithubCollectionSpec: spy,
  } as unknown as GithubCollectionSpecService;
  const service =
    env === undefined
      ? new CollectionSpecService(githubSpecService)
      : new CollectionSpecService(githubSpecService, env);
  return { service, spy };
}

describe("CollectionSpecService.buildCollectionSpec", () => {
  describe("happy path", () => {
    it("GitHub spec(위임) + Confluence 활성 instance 를 CollectionSpec 으로 결합하고 person/since 를 전달한다", async () => {
      const since = "2026-01-01T00:00:00Z";
      const person: GithubCollectionSpecInput = {
        serviceIdentities: [{ service: "public" }],
      };
      const { service, spy } = makeService(ENV_CONF, () => GITHUB_SPEC);

      const spec = await service.buildCollectionSpec(person, since);

      expect(spec).toEqual({
        github: GITHUB_SPEC,
        confluence: { instances: [CLOUD_INSTANCE] },
      });
      // GitHub 결합은 위임 — person/since 가 그대로 전달됨.
      expect(spy).toHaveBeenCalledWith(person, since);
    });
  });

  describe("negative / error path", () => {
    it("(a) GitHub 매칭 instance 부재(빈 sources) → github.sources 빈 + Confluence 정상", async () => {
      const { service } = makeService(ENV_CONF, () => ({ sources: [] }));

      const spec = await service.buildCollectionSpec({ serviceIdentities: [] });

      expect(spec.github).toEqual({ sources: [] });
      expect(spec.confluence).toEqual({ instances: [CLOUD_INSTANCE] });
    });

    it("(b) Confluence 활성 instance 0(env 없음) → confluence.instances 빈 + GitHub 정상", async () => {
      const { service } = makeService({}, () => GITHUB_SPEC);

      const spec = await service.buildCollectionSpec({
        serviceIdentities: [{ service: "public" }],
      });

      expect(spec.github).toEqual(GITHUB_SPEC);
      expect(spec.confluence).toEqual({ instances: [] });
    });

    it("(c) 양쪽 모두 비어 있음 → { github: { sources: [] }, confluence: { instances: [] } }", async () => {
      const { service } = makeService({}, () => ({ sources: [] }));

      const spec = await service.buildCollectionSpec({ serviceIdentities: [] });

      expect(spec).toEqual({
        github: { sources: [] },
        confluence: { instances: [] },
      });
    });

    it("(d) GitHub service 가 throw → buildCollectionSpec 도 전파(fail-fast)", async () => {
      const { service } = makeService(ENV_CONF, () => {
        throw new Error("github spec 실패");
      });

      await expect(
        service.buildCollectionSpec({ serviceIdentities: [{ service: "x" }] }),
      ).rejects.toThrow("github spec 실패");
    });

    it("(e) since 미지정(undefined) → GitHub service 가 since undefined 로 호출됨", async () => {
      const { service, spy } = makeService(ENV_CONF, () => GITHUB_SPEC);

      await service.buildCollectionSpec({
        serviceIdentities: [{ service: "public" }],
      });

      expect(spy).toHaveBeenCalledWith(
        { serviceIdentities: [{ service: "public" }] },
        undefined,
      );
    });

    it("(f) since 지정 → GitHub service 가 그 since 로 호출됨", async () => {
      const since = "2026-05-05T00:00:00Z";
      const { service, spy } = makeService(ENV_CONF, () => GITHUB_SPEC);

      await service.buildCollectionSpec(
        { serviceIdentities: [{ service: "public" }] },
        since,
      );

      expect(spy).toHaveBeenCalledWith(
        { serviceIdentities: [{ service: "public" }] },
        since,
      );
    });
  });

  describe("env 주입 기본값 분기", () => {
    it("env 미주입 시 process.env 기본값을 사용한다(테스트 env 엔 CONFLUENCE_INSTANCES 부재 → 빈 instances)", async () => {
      const { service } = makeService(undefined, () => GITHUB_SPEC);

      const spec = await service.buildCollectionSpec({
        serviceIdentities: [{ service: "public" }],
      });

      expect(spec.github).toEqual(GITHUB_SPEC);
      expect(spec.confluence).toEqual({ instances: [] });
    });
  });
});

const COM = {
  GITHUB_INSTANCES: "com",
  GITHUB_COM_HOST: "h",
  GITHUB_COM_TOKEN_ENC: "t",
  GITHUB_COM_REPOS: "o/r",
};
const WIKI = {
  CONFLUENCE_INSTANCES: "wiki",
  CONFLUENCE_WIKI_BASE_URL: "http://w",
  CONFLUENCE_WIKI_TOKEN_ENC: "t",
  CONFLUENCE_WIKI_SPACE_ALLOWLIST: "A",
};
const identities = (...services: string[]) =>
  services.map((service) => ({ service }));

describe("assessCollectionCoverage", () => {
  it.each<[string, NodeJS.ProcessEnv, string[]]>([
    ["GitHub repo 대상이 있는 식별자", COM, ["com"]],
    ["대소문자 · 공백이 다른 식별자", COM, [" COM "]],
    [
      "mode A org 대상이 있는 식별자",
      { ...COM, GITHUB_COM_REPOS: "", GITHUB_COM_ORG: "o" },
      ["com"],
    ],
    ["SPACE 대상이 있는 Confluence 식별자", WIKI, ["wiki"]],
    [
      "GitHub 이 쓸 수 있으면 운영자가 올린 적 없는 key 는 무시",
      COM,
      ["com", "ecode"],
    ],
    [
      "식별자 없는 instance 의 설정 결함은 무관",
      { ...COM, GITHUB_INSTANCES: "com,sec" },
      ["com"],
    ],
  ])("%s 는 완전하다", (_label, env, services) => {
    expect(assessCollectionCoverage(identities(...services), env)).toEqual({
      complete: true,
      unavailableKeys: [],
    });
  });

  it.each<[string, NodeJS.ProcessEnv, string[], string[]]>([
    [
      "목록에 있고 필수 env 가 빠진 GitHub instance 의 식별자",
      { ...COM, GITHUB_INSTANCES: "com,sec" },
      ["com", "sec"],
      ["SEC"],
    ],
    [
      "repo · org 대상이 0 인 GitHub instance 의 식별자",
      { ...COM, GITHUB_COM_REPOS: "" },
      ["com"],
      ["COM"],
    ],
    [
      "repo token 이 전부 malformed 인 instance 의 식별자",
      { ...COM, GITHUB_COM_REPOS: "a/b/c" },
      ["com"],
      ["COM"],
    ],
    [
      "SPACE 대상이 0 인 Confluence instance 의 식별자",
      { ...COM, ...WIKI, CONFLUENCE_WIKI_SPACE_ALLOWLIST: "" },
      ["com", "wiki"],
      ["WIKI"],
    ],
    [
      "양쪽에 올랐는데 Confluence 쪽만 쓸 수 없는 key",
      { ...COM, CONFLUENCE_INSTANCES: "com" },
      ["com"],
      ["COM"],
    ],
    ["수집 설정이 전혀 없음", {}, ["com"], []],
    ["식별자 0 개", COM, [], []],
    ["목록에 없는 식별자뿐", COM, ["ecode"], []],
    ["목록에 없는 식별자 + 쓸 수 있는 GitHub 없음", WIKI, ["com", "wiki"], []],
  ])("%s 는 불완전하다_n", (_label, env, services, unavailableKeys) => {
    expect(assessCollectionCoverage(identities(...services), env)).toEqual({
      complete: false,
      unavailableKeys,
    });
  });
});

describe("CollectionSpecService.buildCollectionSpecWithCoverage", () => {
  function make(
    env: NodeJS.ProcessEnv,
    enumerateFailures = 0,
  ): { service: CollectionSpecService; spy: jest.Mock } {
    const spy = jest.fn(
      async (
        _person: GithubCollectionSpecInput,
        _since: string | undefined,
        tally: { failed: number },
      ): Promise<GithubCollectionSpec> => {
        tally.failed += enumerateFailures;
        return GITHUB_SPEC;
      },
    );
    const github = {
      buildGithubCollectionSpec: spy,
    } as unknown as GithubCollectionSpecService;
    return { service: new CollectionSpecService(github, env), spy };
  }
  const SINCE = "2026-01-01T00:00:00Z";

  it("식별자가 있는 Confluence instance 만 spec 에 남기고 since 를 넘긴다", async () => {
    const env = {
      ...COM,
      ...WIKI,
      CONFLUENCE_INSTANCES: "wiki,other",
      CONFLUENCE_OTHER_BASE_URL: "http://o",
      CONFLUENCE_OTHER_TOKEN_ENC: "t",
      CONFLUENCE_OTHER_SPACE_ALLOWLIST: "A",
    };
    const { service, spy } = make(env);
    const person = { serviceIdentities: identities("com", "WIKI") };

    const { spec, coverage } = await service.buildCollectionSpecWithCoverage(
      person,
      SINCE,
    );

    expect(spec.github).toEqual(GITHUB_SPEC);
    expect(spec.confluence.instances.map((c) => c.key)).toEqual(["wiki"]);
    expect(coverage.complete).toBe(true);
    expect(spy.mock.calls[0].slice(0, 2)).toEqual([person, SINCE]);
  });

  it("org 열거가 하나라도 실패하면 범위 규칙을 통과해도 불완전하다_n", async () => {
    const { service } = make(COM, 1);

    const { coverage } = await service.buildCollectionSpecWithCoverage({
      serviceIdentities: identities("com"),
    });

    expect(coverage).toEqual({ complete: false, unavailableKeys: [] });
  });
});
