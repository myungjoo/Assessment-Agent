// CollectionOrchestratorService 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). collection slice (v-b), ADR-0029 Decision §3
// (두 source 호출 + skip-and-continue 부분 가용성). 두 collection service 는 jest mock
// 으로 주입 — 실 adapter·실 네트워크·실 token 0(Q-0025 deferred 정합). orchestrator 의
// aggregate / 순서 / 부분 가용성 흡수만 검증한다(collection service 내부 동작은 각
// github-collection.service.spec.ts / confluence-collection.service.spec.ts 책임).

import {
  CollectionOrchestratorService,
  CollectionSpec,
} from "./collection-orchestrator.service";
import { ConfluenceCollectionService } from "./confluence-collection.service";
import { ConfluenceActivity, GithubActivity } from "./domain/activity";
import { GithubCollectionService } from "./github-collection.service";

// ghActivity / cfActivity — 두 변형의 최소 fixture. orchestrator 는 내용을 해석하지
// 않고 concat 만 하므로 externalId 만 식별자로 달리해 순서·보존을 검증한다.
function ghActivity(externalId: string): GithubActivity {
  return {
    externalId,
    sourceType: "github",
    instanceKey: "com",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    repoRef: "octo-org/octo-repo",
    kind: "commit",
  };
}

function cfActivity(externalId: string): ConfluenceActivity {
  return {
    externalId,
    sourceType: "confluence",
    instanceKey: "wiki",
    author: "writer",
    timestamp: "2026-06-02T10:00:00Z",
    metadata: {},
    spaceRef: "ENG",
    version: 1,
  };
}

// makeSpec — orchestrator 입력 spec 을 매 test 마다 fresh object 로 만든다. github
// source 와 confluence instances 의 pass-through reference 정합을 assert 할 때 동일
// 객체를 비교하기 위함.
function makeSpec(): CollectionSpec {
  return {
    github: {
      sources: [{ instanceKey: "com", org: "octo-org", repo: "octo-repo" }],
    },
    confluence: { instances: [] },
  };
}

// makeOrchestrator — 두 collection service 를 collect 메서드만 가진 jest mock 으로
// 주입한 orchestrator 를 만든다. handler 가 반환값(또는 throw)을 결정한다.
function makeOrchestrator(
  githubImpl: () => Promise<GithubActivity[]>,
  confluenceImpl: () => Promise<ConfluenceActivity[]>,
): {
  service: CollectionOrchestratorService;
  githubSpy: jest.Mock;
  confluenceSpy: jest.Mock;
} {
  const githubSpy = jest.fn(githubImpl);
  const confluenceSpy = jest.fn(confluenceImpl);
  const github = {
    collectGithubActivities: githubSpy,
  } as unknown as GithubCollectionService;
  const confluence = {
    collectConfluenceActivities: confluenceSpy,
  } as unknown as ConfluenceCollectionService;
  return {
    service: new CollectionOrchestratorService(github, confluence),
    githubSpy,
    confluenceSpy,
  };
}

describe("CollectionOrchestratorService", () => {
  describe("happy path (R-112-1)", () => {
    it("GitHub 2건 + Confluence 1건을 단일 Activity[] 3건으로 concat 반환한다 (각 service 정확한 spec 으로 1회 호출)", async () => {
      const { service, githubSpy, confluenceSpy } = makeOrchestrator(
        async () => [ghActivity("g-1"), ghActivity("g-2")],
        async () => [cfActivity("c-1")],
      );
      const spec = makeSpec();

      const result = await service.collectActivities(spec);

      expect(result).toHaveLength(3);
      expect(result.map((a) => a.externalId)).toEqual(["g-1", "g-2", "c-1"]);
      // 각 collection service 가 정확히 1회, 해당 sub-spec 으로 호출됨(잘못된 spec 전달 0).
      expect(githubSpy).toHaveBeenCalledTimes(1);
      expect(githubSpy).toHaveBeenCalledWith(spec.github);
      expect(confluenceSpy).toHaveBeenCalledTimes(1);
      expect(confluenceSpy).toHaveBeenCalledWith(spec.confluence);
    });

    it("결과는 GitHub→Confluence 순서로 결정론적으로 concat 된다", async () => {
      const { service } = makeOrchestrator(
        async () => [ghActivity("g-A"), ghActivity("g-B")],
        async () => [cfActivity("c-X"), cfActivity("c-Y")],
      );

      const result = await service.collectActivities(makeSpec());

      // GitHub 두 건이 먼저, Confluence 두 건이 그 뒤 — 순서 고정.
      expect(result.map((a) => a.externalId)).toEqual([
        "g-A",
        "g-B",
        "c-X",
        "c-Y",
      ]);
      // 변형도 순서대로 보존(앞 2건 github, 뒤 2건 confluence).
      expect(result.map((a) => a.sourceType)).toEqual([
        "github",
        "github",
        "confluence",
        "confluence",
      ]);
    });
  });

  describe("error path (R-112-2)", () => {
    it("GitHub collection 이 throw 하면 Confluence 결과만 보존되어 반환된다 (부분 가용성, 전체 throw 0)", async () => {
      const { service } = makeOrchestrator(
        async () => {
          throw new Error("github 수집 실패");
        },
        async () => [cfActivity("c-1")],
      );

      const result = await service.collectActivities(makeSpec());

      expect(result.map((a) => a.externalId)).toEqual(["c-1"]);
    });

    it("Confluence collection 이 throw 하면 GitHub 결과만 보존되어 반환된다 (부분 가용성, 전체 throw 0)", async () => {
      const { service } = makeOrchestrator(
        async () => [ghActivity("g-1")],
        async () => {
          throw new Error("confluence 수집 실패");
        },
      );

      const result = await service.collectActivities(makeSpec());

      expect(result.map((a) => a.externalId)).toEqual(["g-1"]);
    });
  });

  describe("branch cover (R-112-3)", () => {
    it("두 source 모두 빈 배열이면 빈 Activity[] 를 반환한다", async () => {
      const { service } = makeOrchestrator(
        async () => [],
        async () => [],
      );

      const result = await service.collectActivities(makeSpec());

      expect(result).toEqual([]);
    });

    it("GitHub 만 비어있으면 Confluence 결과만 반환된다", async () => {
      const { service } = makeOrchestrator(
        async () => [],
        async () => [cfActivity("c-1")],
      );

      const result = await service.collectActivities(makeSpec());

      expect(result.map((a) => a.externalId)).toEqual(["c-1"]);
    });

    it("Confluence 만 비어있으면 GitHub 결과만 반환된다", async () => {
      const { service } = makeOrchestrator(
        async () => [ghActivity("g-1")],
        async () => [],
      );

      const result = await service.collectActivities(makeSpec());

      expect(result.map((a) => a.externalId)).toEqual(["g-1"]);
    });
  });

  describe("negative cases 충분 cover (R-112-4)", () => {
    it("두 collection service 모두 throw 하면 빈 Activity[] 를 반환한다 (전체 throw 0)", async () => {
      const { service } = makeOrchestrator(
        async () => {
          throw new Error("github down");
        },
        async () => {
          throw new Error("confluence down");
        },
      );

      // orchestrator 가 reject 하지 않음을 검증.
      await expect(service.collectActivities(makeSpec())).resolves.toEqual([]);
    });

    it("spec.github.sources 가 빈 배열이어도 GithubCollectionService 에 그대로 pass-through 된다 (orchestrator enumerate·검증 0)", async () => {
      const { service, githubSpy } = makeOrchestrator(
        async () => [],
        async () => [],
      );
      const spec: CollectionSpec = {
        github: { sources: [] },
        confluence: { instances: [] },
      };

      await service.collectActivities(spec);

      // 빈 sources 도 검증 없이 그대로 전달(enumerate 는 상위 책임 — 본 orchestrator 밖).
      expect(githubSpy).toHaveBeenCalledWith(spec.github);
      expect(githubSpy.mock.calls[0][0].sources).toEqual([]);
    });

    it("두 service 는 각각 1회, GitHub 가 Confluence 보다 먼저 호출된다 (호출 순서·인자 정합)", async () => {
      const { service, githubSpy, confluenceSpy } = makeOrchestrator(
        async () => [ghActivity("g-1")],
        async () => [cfActivity("c-1")],
      );
      const spec = makeSpec();

      await service.collectActivities(spec);

      expect(githubSpy).toHaveBeenCalledTimes(1);
      expect(confluenceSpy).toHaveBeenCalledTimes(1);
      // GitHub 호출이 Confluence 호출보다 먼저 일어남(결정론적 순서 backbone).
      expect(githubSpy.mock.invocationCallOrder[0]).toBeLessThan(
        confluenceSpy.mock.invocationCallOrder[0],
      );
      // 각 service 는 자기 sub-spec 만 받음(교차 전달 0).
      expect(githubSpy).toHaveBeenCalledWith(spec.github);
      expect(confluenceSpy).toHaveBeenCalledWith(spec.confluence);
    });

    it("한쪽이 throw 해도 다른 쪽 collection 은 정상 호출된다 (skip 이 호출 자체를 막지 않음)", async () => {
      const { service, confluenceSpy } = makeOrchestrator(
        async () => {
          throw new Error("github 수집 실패");
        },
        async () => [cfActivity("c-1")],
      );
      const spec = makeSpec();

      await service.collectActivities(spec);

      // GitHub throw 가 Confluence 호출을 건너뛰게 하지 않음.
      expect(confluenceSpy).toHaveBeenCalledTimes(1);
      expect(confluenceSpy).toHaveBeenCalledWith(spec.confluence);
    });
  });
});
