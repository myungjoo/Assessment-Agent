import {
  type CollectionTargetRow,
  mergeConfluenceInstances,
  mergeGithubInstances,
} from "./effective-instances";

const row = (
  overrides: Partial<CollectionTargetRow> = {},
): CollectionTargetRow => ({
  type: "GITHUB",
  instanceKey: "db",
  endpoint: " db.example.test ",
  orgs: ["o"],
  repos: [" o/r ", " "],
  spaces: [],
  active: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const confluenceRow = (
  overrides: Partial<CollectionTargetRow> = {},
): CollectionTargetRow =>
  row({
    type: "CONFLUENCE",
    instanceKey: "wiki",
    endpoint: "https://wiki.example.test/rest/api",
    orgs: [],
    repos: [],
    spaces: [" SP ", ""],
    ...overrides,
  });

const ENV_GITHUB: NodeJS.ProcessEnv = {
  GITHUB_INSTANCES: "env",
  GITHUB_ENV_HOST: "env.example.test",
  GITHUB_ENV_REPOS: "o/r",
  GITHUB_ENV_TOKEN_ENC: "enc-env",
};
const DB_TOKEN = { GITHUB_DB_TOKEN_ENC: " enc-db " };
const ENV_CONFIG = {
  key: "env",
  host: "env.example.test",
  orgs: [],
  repos: ["o/r"],
  tokenEnc: "enc-env",
};
const DB_CONFIG = {
  key: "db",
  host: "db.example.test",
  orgs: ["o"],
  repos: ["o/r"],
  tokenEnc: "enc-db",
};

describe("mergeGithubInstances", () => {
  it("env 와 row 가 모두 비면 대상도 목록도 비어 있다", () => {
    expect(mergeGithubInstances({}, [])).toEqual({
      instances: [],
      rejected: [],
      listedKeys: new Set(),
    });
  });

  it("row 가 없으면 env 결과와 같다", () => {
    const merged = mergeGithubInstances(ENV_GITHUB, []);
    expect(merged.instances).toEqual([ENV_CONFIG]);
    expect(merged.listedKeys).toEqual(new Set(["ENV"]));
  });

  it("DB 에만 있는 active row 는 env 의 credential 로 대상이 된다", () => {
    const merged = mergeGithubInstances(DB_TOKEN, [row()]);
    expect(merged.instances).toEqual([DB_CONFIG]);
    expect(merged.listedKeys).toEqual(new Set(["DB"]));
  });

  it("env 와 DB 대상은 env 먼저 합쳐진다", () => {
    const merged = mergeGithubInstances({ ...ENV_GITHUB, ...DB_TOKEN }, [
      row(),
    ]);

    expect(merged.instances).toEqual([ENV_CONFIG, DB_CONFIG]);
    expect(merged.listedKeys).toEqual(new Set(["ENV", "DB"]));
  });

  it("충돌하면 env 좌표가 이기고 row 는 진단에 남는다_n", () => {
    const merged = mergeGithubInstances(ENV_GITHUB, [
      row({ instanceKey: " ENV ", endpoint: "evil.example.test" }),
    ]);

    expect(merged.instances).toEqual([ENV_CONFIG]);
    expect(merged.rejected).toEqual(["ENV: env 정의 우선 (DB row 무시)"]);
    expect(merged.rejected.join()).not.toContain("enc-");
  });

  it("env 목록에 있으나 reject 된 key 를 row 가 복구하지 못한다_n", () => {
    const env = { GITHUB_INSTANCES: "db", ...DB_TOKEN };

    const merged = mergeGithubInstances(env, [row()]);
    expect(merged.instances).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set(["DB"]));
    expect(merged.rejected).toEqual([
      "db: 필수 env 부재 — GITHUB_DB_HOST",
      "db: env 정의 우선 (DB row 무시)",
    ]);
  });

  it("비활성 row 는 대상도 목록도 아니다_n", () => {
    const merged = mergeGithubInstances(DB_TOKEN, [row({ active: false })]);
    expect(merged.instances).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set());
  });

  it("같은 key 가 env 에 있으면 비활성 row 는 env 를 끄지 못한다", () => {
    const merged = mergeGithubInstances(ENV_GITHUB, [
      row({ instanceKey: "env", active: false }),
    ]);

    expect(merged.instances).toEqual([ENV_CONFIG]);
    expect(merged.rejected).toEqual(["env: env 정의 우선 (DB row 무시)"]);
  });

  it.each([
    ["부재", {}],
    ["공백", { GITHUB_DB_TOKEN_ENC: "  " }],
  ])(
    "credential 이 %s 인 active row 는 대상이 아니지만 목록에 남는다_n",
    (_label, env) => {
      const merged = mergeGithubInstances(env, [row()]);
      expect(merged.instances).toEqual([]);
      expect(merged.listedKeys).toEqual(new Set(["DB"]));
      expect(merged.rejected).toEqual([
        "db: 필수 env 부재 — GITHUB_DB_TOKEN_ENC",
      ]);
    },
  );

  it("Confluence row 는 충돌도 대상도 아니다_n", () => {
    const merged = mergeGithubInstances({ ...ENV_GITHUB, ...DB_TOKEN }, [
      row({ type: "CONFLUENCE" }),
      row({ type: "CONFLUENCE", instanceKey: "env" }),
    ]);

    expect(merged.instances).toEqual([ENV_CONFIG]);
    expect(merged.rejected).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set(["ENV"]));
  });

  it("env 목록의 혼합 구분자 · 대소문자를 resolve 와 같게 읽는다_n", () => {
    const env = { ...ENV_GITHUB, GITHUB_INSTANCES: " other, Env	third ," };

    const merged = mergeGithubInstances(env, [row({ instanceKey: "ENV" })]);
    expect(merged.instances.map((i) => i.key)).toEqual(["Env"]);
    expect(merged.listedKeys).toEqual(new Set(["OTHER", "ENV", "THIRD"]));
  });

  it("공백뿐인 instanceKey row 는 없는 것으로 친다_n", () => {
    const merged = mergeGithubInstances(DB_TOKEN, [row({ instanceKey: "  " })]);
    expect(merged.instances).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set());
  });

  it("대소문자만 다른 row 는 먼저 등록된 쪽만 쓴다_n", () => {
    const merged = mergeGithubInstances(DB_TOKEN, [
      row({ instanceKey: "DB", createdAt: new Date("2026-02-01T00:00:00Z") }),
      row({ instanceKey: "db" }),
    ]);

    expect(merged.instances.map((i) => i.key)).toEqual(["db"]);
    expect(merged.rejected).toEqual(["DB: 중복 key(먼저 등록된 row 만 활성)"]);
  });

  it("같은 시각의 중복 row 는 key 코드 순으로 고른다", () => {
    const a = row({ instanceKey: "db" });
    const b = row({ instanceKey: "DB" });

    for (const rows of [
      [a, b],
      [b, a],
    ]) {
      const merged = mergeGithubInstances(DB_TOKEN, rows);
      expect(merged.instances.map((i) => i.key)).toEqual(["DB"]);
    }
  });

  it("먼저 등록된 비활성 row 는 대소문자만 다른 active row 를 막지 않는다", () => {
    const merged = mergeGithubInstances(DB_TOKEN, [
      row({ active: false }),
      row({ instanceKey: "DB", createdAt: new Date("2026-02-01T00:00:00Z") }),
    ]);

    expect(merged.instances.map((i) => i.key)).toEqual(["DB"]);
    expect(merged.rejected).toEqual([]);
  });

  it("endpoint 가 공백인 row 는 대상이 아니지만 목록에 남는다_n", () => {
    const merged = mergeGithubInstances(DB_TOKEN, [row({ endpoint: "  " })]);
    expect(merged.instances).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set(["DB"]));
    expect(merged.rejected).toEqual(["db: endpoint 가 비어 있음"]);
  });
});

describe("mergeConfluenceInstances", () => {
  const ENV_CONFLUENCE: NodeJS.ProcessEnv = {
    CONFLUENCE_INSTANCES: "cloud",
    CONFLUENCE_CLOUD_BASE_URL: "https://cloud.example.test/rest/api",
    CONFLUENCE_CLOUD_TOKEN_ENC: "enc-cloud",
  };
  const WIKI_TOKEN = { CONFLUENCE_WIKI_TOKEN_ENC: "enc-wiki" };
  const WIKI_CONFIG = {
    key: "wiki",
    baseUrl: "https://wiki.example.test/rest/api",
    authUser: null,
    tokenEnc: "enc-wiki",
    spaceAllowlist: ["SP"],
  };

  it("DB 에만 있는 row 는 env credential 로 env 대상 뒤에 붙는다", () => {
    const merged = mergeConfluenceInstances(
      { ...ENV_CONFLUENCE, ...WIKI_TOKEN },
      [confluenceRow()],
    );

    expect(merged.instances.map((i) => i.key)).toEqual(["cloud", "wiki"]);
    expect(merged.instances[1]).toEqual(WIKI_CONFIG);
    expect(merged.listedKeys).toEqual(new Set(["CLOUD", "WIKI"]));
  });

  it.each([
    ["있으면 Basic 계정으로 쓴다", " kim@example.test ", "kim@example.test"],
    ["공백이면 null 이다", "  ", null],
  ])("_AUTH_USER 가 %s", (_label, authUser, expected) => {
    const merged = mergeConfluenceInstances(
      { ...WIKI_TOKEN, CONFLUENCE_WIKI_AUTH_USER: authUser },
      [confluenceRow()],
    );

    expect(merged.instances[0].authUser).toBe(expected);
  });

  it("충돌하면 env 가 이긴다_n", () => {
    const merged = mergeConfluenceInstances(ENV_CONFLUENCE, [
      confluenceRow({ instanceKey: "CLOUD" }),
    ]);

    expect(merged.instances.map((i) => i.baseUrl)).toEqual([
      "https://cloud.example.test/rest/api",
    ]);
    expect(merged.rejected).toEqual(["CLOUD: env 정의 우선 (DB row 무시)"]);
  });

  it("비활성 row 는 빠진다_n", () => {
    const merged = mergeConfluenceInstances(WIKI_TOKEN, [
      confluenceRow({ active: false }),
    ]);

    expect(merged.instances).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set());
  });

  it("credential 이 없는 row 는 대상이 아니지만 목록에 남는다_n", () => {
    const merged = mergeConfluenceInstances({}, [confluenceRow()]);

    expect(merged.instances).toEqual([]);
    expect(merged.listedKeys).toEqual(new Set(["WIKI"]));
    expect(merged.rejected).toEqual([
      "wiki: 필수 env 부재 — CONFLUENCE_WIKI_TOKEN_ENC",
    ]);
  });

  it("GitHub row 는 읽지 않는다_n", () => {
    const merged = mergeConfluenceInstances(WIKI_TOKEN, [
      row({ instanceKey: "wiki" }),
    ]);

    expect(merged.instances).toEqual([]);
  });
});
