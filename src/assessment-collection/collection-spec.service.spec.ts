// CollectionSpecService 의 unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). ADR-0030 §3 Confluence enumerate + §5 buildCollectionSpec
// 전체 조립. resolveConfluenceInstances(순수 함수)는 실제로 통과시키고
// GithubCollectionSpecService(async)만 jest mock 으로 주입한다(Q-0025 deferred 정합 —
// 실 GitHub/Confluence 호출 0 / 실 token 0). env 는 임의 map literal 로 주입.

import { CollectionSpecService } from "./collection-spec.service";
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
