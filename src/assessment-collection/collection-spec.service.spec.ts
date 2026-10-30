// CollectionSpecService 의 unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). ADR-0030 §3 Confluence enumerate + §5 buildCollectionSpec
// 전체 조립. resolveConfluenceInstances(순수 함수)는 실제로 통과시키고
// GithubCollectionSpecService(async)만 jest mock 으로 주입한다(Q-0025 deferred 정합 —
// 실 GitHub/Confluence 호출 0 / 실 token 0). env 는 임의 map literal 로 주입.

import type { CollectionTargetReader } from "../collection-target/collection-target-reader.service";
import type { CollectionTargetRow } from "../collection-target/effective-instances";

import {
  assessCollectionCoverage,
  CollectionSpecService,
} from "./collection-spec.service";
import {
  GithubCollectionSpecInput,
  GithubCollectionSpecService,
} from "./github-collection-spec.service";
import { GithubCollectionSpec } from "./github-collection.service";
import type { GithubOrgEnumerateService } from "./github-org-repo-enumerate.service";

const targetsOf = (rows: CollectionTargetRow[]): CollectionTargetReader =>
  ({ findAll: async () => rows }) as unknown as CollectionTargetReader;
const NO_TARGETS = targetsOf([]);

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
      ? new CollectionSpecService(githubSpecService, NO_TARGETS)
      : new CollectionSpecService(githubSpecService, NO_TARGETS, env);
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
  const repos = (value: string) => ({ ...COM, GITHUB_COM_REPOS: value });
  const SEC_LISTED = { ...COM, GITHUB_INSTANCES: "com,sec" };
  it.each<[string, NodeJS.ProcessEnv, string[]]>([
    ["GitHub repo 대상", COM, ["com"]],
    ["대소문자 · 공백이 다른 key", COM, [" COM "]],
    ["mode A org 대상", { ...repos(""), GITHUB_COM_ORG: "o" }, ["com"]],
    ["SPACE 대상", WIKI, ["wiki"]],
    ["GitHub 사용 가능 + 올린 적 없는 key", COM, ["com", "ecode"]],
    ["식별자 없는 instance 의 설정 결함", SEC_LISTED, ["com"]],
  ])("%s 는 완전하다", (_label, env, services) => {
    expect(assessCollectionCoverage(identities(...services), env)).toEqual({
      complete: true,
      unavailableKeys: [],
    });
  });

  const BOTH = { ...COM, ...WIKI };
  const NO_SPACES = { ...BOTH, CONFLUENCE_WIKI_SPACE_ALLOWLIST: "" };
  const NO_WIKI_TOKEN = { ...BOTH, CONFLUENCE_WIKI_TOKEN_ENC: "" };
  const COM_IN_BOTH = { ...COM, CONFLUENCE_INSTANCES: "com" };
  const COM_WIKI = ["com", "wiki"];
  it.each<[string, NodeJS.ProcessEnv, string[], string[]]>([
    ["env 빠진 GitHub", SEC_LISTED, ["com", "sec"], ["SEC"]],
    ["repo · org 대상 0", repos(""), ["com"], ["COM"]],
    ["malformed repo token 1 개", repos("o/r,a/b/c"), ["com"], ["COM"]],
    ["org 없는 bare repo token", repos("r"), ["com"], ["COM"]],
    ["SPACE 대상 0", NO_SPACES, COM_WIKI, ["WIKI"]],
    ["env 빠진 Confluence", NO_WIKI_TOKEN, COM_WIKI, ["WIKI"]],
    ["GitHub 만 쓸 수 있는 양쪽 key", COM_IN_BOTH, ["com"], ["COM"]],
    ["수집 설정 없음", {}, ["com"], []],
    ["식별자 0 개", COM, [], []],
    ["올린 적 없는 key 뿐", COM, ["ecode"], []],
    ["올린 적 없는 key + 쓸 수 있는 GitHub 없음", WIKI, COM_WIKI, []],
  ])("%s 는 불완전하다_n", (_label, env, services, unavailableKeys) => {
    expect(assessCollectionCoverage(identities(...services), env)).toEqual({
      complete: false,
      unavailableKeys,
    });
  });
});

describe("assessCollectionCoverage — 등록 대상 (ADR-0059 §Decision 3)", () => {
  const ROW: CollectionTargetRow = {
    type: "GITHUB",
    instanceKey: "db",
    endpoint: "db.example.test",
    orgs: [],
    repos: ["o/r"],
    spaces: [],
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const DB_TOKEN = { GITHUB_DB_TOKEN_ENC: "t" };
  const OK = { complete: true, unavailableKeys: [] };
  const assess = (
    env: NodeJS.ProcessEnv,
    rows: CollectionTargetRow[],
    ...services: string[]
  ) => assessCollectionCoverage(identities(...services), env, rows);

  it("DB 에만 있는 쓸 수 있는 대상의 식별자는 완전하다", () => {
    expect(assess(DB_TOKEN, [ROW], "DB")).toEqual(OK);
  });

  it("repo 없이 org 만 있는 DB 대상도 쓸 수 있다", () => {
    const row = { ...ROW, repos: [], orgs: ["o"] };
    expect(assess(DB_TOKEN, [row], "db")).toEqual(OK);
  });

  it("DB Confluence 대상도 쓸 수 있다", () => {
    const row = { ...ROW, type: "CONFLUENCE", spaces: ["A"] };
    expect(assess({ CONFLUENCE_DB_TOKEN_ENC: "t" }, [row], "db")).toEqual(OK);
  });

  it("DB GitHub 대상이 있으면 목록에 없는 key 가 저장을 막지 않는다", () => {
    expect(assess(DB_TOKEN, [ROW], "db", "neverlisted")).toEqual(OK);
  });

  it("credential 없는 DB 대상의 식별자는 미설정이 아니라 실패다_n", () => {
    expect(assess(COM, [ROW], "com", "db")).toEqual({
      complete: false,
      unavailableKeys: ["DB"],
    });
  });

  it.each<[string, CollectionTargetRow]>([
    ["repo · org 0", { ...ROW, repos: [], orgs: [] }],
    ["malformed repo", { ...ROW, repos: ["o/r", "a/b/c"] }],
    ["빈 endpoint", { ...ROW, endpoint: " " }],
  ])("%s 인 DB 대상의 식별자는 실패다_n", (_label, row) => {
    expect(assess({ ...COM, ...DB_TOKEN }, [row], "com", "db")).toEqual({
      complete: false,
      unavailableKeys: ["DB"],
    });
  });

  it("SPACE 0 인 DB Confluence 대상의 식별자는 실패다_n", () => {
    const row = { ...ROW, type: "CONFLUENCE", spaces: [] };

    expect(
      assess({ ...COM, CONFLUENCE_DB_TOKEN_ENC: "t" }, [row], "com", "db"),
    ).toEqual({ complete: false, unavailableKeys: ["DB"] });
  });

  it("비활성 대상의 식별자는 운영자가 제외한 것이므로 다른 대상을 막지 않는다", () => {
    expect(
      assess({ ...COM, ...DB_TOKEN }, [{ ...ROW, active: false }], "com", "db"),
    ).toEqual(OK);
  });

  const OFF = { ...ROW, active: false };
  it.each(["GITHUB", "CONFLUENCE"])(
    "GitHub 식별자 없는 인원도 비활성 %s 대상의 식별자로 막히지 않는다",
    (type) => {
      expect(assess(WIKI, [{ ...OFF, type }], "db", "wiki")).toEqual(OK);
    },
  );

  it("비활성 대상이 있어도 GitHub 없는 미목록 key 보호는 유지된다_n", () => {
    expect(assess(WIKI, [OFF], "db", "wiki", "ecode").complete).toBe(false);
  });

  it("비활성 대상의 식별자만 있으면 수집할 것이 없어 불완전하다_n", () => {
    expect(assess(DB_TOKEN, [{ ...ROW, active: false }], "db").complete).toBe(
      false,
    );
  });

  it("비활성 row 는 같은 key 의 env 대상을 끄지 못한다", () => {
    expect(
      assess(COM, [{ ...ROW, instanceKey: "com", active: false }], "com"),
    ).toEqual(OK);
  });

  it("env 목록에 있으나 쓸 수 없는 key 는 row 로 복구되지 않는다_n", () => {
    const env = { ...DB_TOKEN, GITHUB_INSTANCES: "db" };

    expect(assess(env, [ROW], "db")).toEqual({
      complete: false,
      unavailableKeys: ["DB"],
    });
  });
});

describe("CollectionSpecService.buildCollectionSpecWithCoverage", () => {
  function make(
    env: NodeJS.ProcessEnv,
    enumerateFailures = 0,
    rows: CollectionTargetRow[] = [],
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
    return {
      service: new CollectionSpecService(github, targetsOf(rows), env),
      spy,
    };
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

  const withReader = (reader: unknown, env: NodeJS.ProcessEnv) =>
    new CollectionSpecService(
      {
        buildGithubCollectionSpec: async () => GITHUB_SPEC,
      } as unknown as GithubCollectionSpecService,
      reader as CollectionTargetReader,
      env,
    );
  const WIKI_ROW: CollectionTargetRow = {
    type: "CONFLUENCE",
    instanceKey: "wiki",
    endpoint: "http://w",
    orgs: [],
    repos: [],
    spaces: ["A"],
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  const WIKI_TOKEN = { CONFLUENCE_WIKI_TOKEN_ENC: "t" };
  const WIKI_PERSON = { serviceIdentities: identities("wiki") };

  it("DB 에만 있는 Confluence 대상도 spec 과 판정에 들어간다", async () => {
    const { service } = make(WIKI_TOKEN, 0, [WIKI_ROW]);

    const { spec, coverage } =
      await service.buildCollectionSpecWithCoverage(WIKI_PERSON);

    expect(spec.confluence.instances.map((c) => c.key)).toEqual(["wiki"]);
    expect(coverage.complete).toBe(true);
  });

  it("credential 없는 DB 대상의 식별자는 실패로 판정한다_n", async () => {
    const { service } = make({}, 0, [WIKI_ROW]);

    const { spec, coverage } =
      await service.buildCollectionSpecWithCoverage(WIKI_PERSON);

    expect(spec.confluence.instances).toEqual([]);
    expect(coverage).toEqual({ complete: false, unavailableKeys: ["WIKI"] });
  });

  it("충돌하면 Confluence 도 env 좌표를 쓴다_n", async () => {
    const env = { ...WIKI, CONFLUENCE_WIKI_BASE_URL: "http://env" };
    const { service } = make(env, 0, [WIKI_ROW]);

    const { spec } = await service.buildCollectionSpecWithCoverage(WIKI_PERSON);

    expect(spec.confluence.instances.map((c) => c.baseUrl)).toEqual([
      "http://env",
    ]);
  });

  it("row 변경은 다음 호출에 반영된다", async () => {
    const findAll = jest
      .fn()
      .mockResolvedValueOnce([WIKI_ROW])
      .mockResolvedValueOnce([]);
    const service = withReader({ findAll }, WIKI_TOKEN);

    const first = await service.buildCollectionSpec(WIKI_PERSON);
    const second = await service.buildCollectionSpec(WIKI_PERSON);

    expect(first.confluence.instances).toHaveLength(1);
    expect(second.confluence.instances).toEqual([]);
  });

  it("spec 과 판정은 한 번 읽은 같은 row 를 본다", async () => {
    const row = { ...WIKI_ROW, type: "GITHUB", repos: ["o/r"], spaces: [] };
    const env = { GITHUB_WIKI_TOKEN_ENC: "t" };
    const findAll = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([row]);
    const reader = { findAll } as unknown as CollectionTargetReader;
    const github = new GithubCollectionSpecService(
      {} as GithubOrgEnumerateService,
      reader,
      env,
    );
    const service = new CollectionSpecService(github, reader, env);

    const { spec, coverage } =
      await service.buildCollectionSpecWithCoverage(WIKI_PERSON);

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(spec.github.sources).toEqual([]);
    expect(coverage.complete).toBe(false);
  });

  it("DB 조회 실패는 삼키지 않는다_n", async () => {
    const service = withReader(
      { findAll: jest.fn().mockRejectedValue(new Error("db down")) },
      {},
    );

    await expect(
      service.buildCollectionSpecWithCoverage(WIKI_PERSON),
    ).rejects.toThrow("db down");
    await expect(service.buildCollectionSpec(WIKI_PERSON)).rejects.toThrow(
      "db down",
    );
  });

  it("buildCollectionSpec 은 env 와 활성 DB 대상을 합치고 비활성은 뺀다", async () => {
    const off = { ...WIKI_ROW, instanceKey: "off", active: false };
    const service = withReader(targetsOf([WIKI_ROW, off]), {
      ...ENV_CONF,
      ...WIKI_TOKEN,
    });

    const spec = await service.buildCollectionSpec(WIKI_PERSON);

    expect(spec.confluence.instances.map((c) => c.key)).toEqual([
      "cloud",
      "wiki",
    ]);
  });

  it("열거가 모두 성공해도 범위 규칙을 어기면 불완전하다_n", async () => {
    const { service } = make({});

    const { coverage } = await service.buildCollectionSpecWithCoverage({
      serviceIdentities: identities("com"),
    });

    expect(coverage.complete).toBe(false);
  });
});
