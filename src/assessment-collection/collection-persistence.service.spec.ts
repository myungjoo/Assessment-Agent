// CollectionPersistenceService 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). collection slice (v-c), ADR-0029 Decision §6
// (Activity → Contribution 영속화 매핑 + fail-fast 전파). orchestrator 와 ContributionService
// 는 jest mock 으로 주입 — 실 DB·실 adapter·실 token 0(Q-0025 deferred 정합). 매퍼는
// 실제 함수를 통과시켜(mock 0) service+mapper 합성을 검증한다.

import { BadRequestException } from "@nestjs/common";
import type { Contribution } from "@prisma/client";

import type { ContributionCreateInput } from "../user/contribution.repository";
import { ContributionService } from "../user/contribution.service";

import { CollectionOrchestratorService } from "./collection-orchestrator.service";
import type { CollectionSpec } from "./collection-orchestrator.service";
import { CollectionPersistenceService } from "./collection-persistence.service";
import {
  Activity,
  ConfluenceActivity,
  GithubActivity,
  GithubActivityKind,
} from "./domain/activity";
import { mapActivityToContribution } from "./domain/activity-contribution.mapper";

// ghActivity / cfActivity — 두 변형의 최소 fixture(orchestrator spec 과 동형). 매퍼가
// 실제로 통과하므로 kind / externalId / version 이 산출 sourceType / sourceRef 에 반영된다.
function ghActivity(
  externalId: string,
  kind: GithubActivityKind = "commit",
): GithubActivity {
  return {
    externalId,
    sourceType: "github",
    instanceKey: "com",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    repoRef: "octo-org/octo-repo",
    kind,
  };
}

function cfActivity(externalId: string, version = 1): ConfluenceActivity {
  return {
    externalId,
    sourceType: "confluence",
    instanceKey: "wiki",
    author: "writer",
    timestamp: "2026-06-02T10:00:00Z",
    metadata: {},
    spaceRef: "ENG",
    version,
  };
}

// makeSpec — orchestrator 에 pass-through 될 입력 spec. 내용은 mock orchestrator 가
// 무시하므로 최소 형태로 둔다(pass-through reference 정합 assert 용).
function makeSpec(): CollectionSpec {
  return { github: { sources: [] }, confluence: { instances: [] } };
}

// makeService — orchestrator(collectActivities) 와 ContributionService(create) 를
// jest mock 으로 주입한 service 를 만든다. createImpl 기본값은 input 을 echo 하는 가짜
// Contribution(id = "c-"+sourceRef)을 반환해 반환 순서/매핑을 검증 가능하게 한다.
function makeService(
  collectImpl: () => Promise<Activity[]>,
  createImpl?: (input: ContributionCreateInput) => Promise<Contribution>,
): {
  service: CollectionPersistenceService;
  collectSpy: jest.Mock;
  createSpy: jest.Mock;
} {
  const collectSpy = jest.fn(collectImpl);
  const createSpy = jest.fn(
    createImpl ??
      (async (input: ContributionCreateInput): Promise<Contribution> =>
        ({ id: `c-${input.sourceRef}`, ...input }) as unknown as Contribution),
  );
  const orchestrator = {
    collectActivities: collectSpy,
  } as unknown as CollectionOrchestratorService;
  const contributions = {
    create: createSpy,
  } as unknown as ContributionService;
  return {
    service: new CollectionPersistenceService(orchestrator, contributions),
    collectSpy,
    createSpy,
  };
}

describe("CollectionPersistenceService", () => {
  describe("happy path (R-112-1)", () => {
    it("GitHub commit 1 + Confluence page 1 을 매퍼 거쳐 create 2회 호출 + Contribution[] 2건 반환한다", async () => {
      const { service, collectSpy, createSpy } = makeService(async () => [
        ghActivity("sha-1", "commit"),
        cfActivity("page-1", 2),
      ]);
      const spec = makeSpec();

      const result = await service.collectAndPersist(spec, "assess-1");

      // orchestrator 가 spec 그대로 1회 호출됨(pass-through).
      expect(collectSpy).toHaveBeenCalledTimes(1);
      expect(collectSpy).toHaveBeenCalledWith(spec);
      // 매퍼 산출 input 으로 create 가 순서대로 2회 호출됨(placeholder 평가 필드 포함).
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(createSpy).toHaveBeenNthCalledWith(1, {
        assessmentId: "assess-1",
        sourceType: "commit",
        sourceUrl: "octo-org/octo-repo#sha-1",
        sourceRef: "sha-1",
        difficulty: "easy",
        contributionScore: 0,
        volume: 0,
      });
      expect(createSpy).toHaveBeenNthCalledWith(2, {
        assessmentId: "assess-1",
        sourceType: "document",
        sourceUrl: "ENG#page-1",
        sourceRef: "page-1@2",
        difficulty: "easy",
        contributionScore: 0,
        volume: 0,
      });
      // 반환 Contribution[] 순서 = 입력 Activity[] 순서(GitHub→Confluence).
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(["c-sha-1", "c-page-1@2"]);
    });
  });

  describe("error path (R-112-2)", () => {
    it("ContributionService.create 가 reject 하면 collectAndPersist 가 그대로 전파한다 (fail-fast)", async () => {
      const { service } = makeService(
        async () => [ghActivity("sha-1")],
        async () => {
          throw new BadRequestException("invalid assessmentId reference");
        },
      );

      await expect(
        service.collectAndPersist(makeSpec(), "bad-assessment"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("orchestrator.collectActivities 가 reject 하면 전파하고 create 는 호출되지 않는다", async () => {
      const { service, createSpy } = makeService(async () => {
        throw new Error("수집 실패");
      });

      await expect(
        service.collectAndPersist(makeSpec(), "assess-1"),
      ).rejects.toThrow("수집 실패");
      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe("branch cover (R-112-3)", () => {
    it("빈 Activity[] 면 create 를 0회 호출하고 빈 Contribution[] 를 반환한다", async () => {
      const { service, createSpy } = makeService(async () => []);

      const result = await service.collectAndPersist(makeSpec(), "assess-1");

      expect(result).toEqual([]);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("GitHub-only(commit/pr) 는 sourceType commit/pr 로 create 호출된다", async () => {
      const { service, createSpy } = makeService(async () => [
        ghActivity("sha-c", "commit"),
        ghActivity("num-p", "pr"),
      ]);

      await service.collectAndPersist(makeSpec(), "assess-1");

      expect(createSpy.mock.calls.map((c) => c[0].sourceType)).toEqual([
        "commit",
        "pr",
      ]);
    });

    it("Confluence-only 는 sourceType document 로 create 호출된다", async () => {
      const { service, createSpy } = makeService(async () => [
        cfActivity("page-x", 4),
      ]);

      await service.collectAndPersist(makeSpec(), "assess-1");

      expect(createSpy.mock.calls.map((c) => c[0].sourceType)).toEqual([
        "document",
      ]);
    });

    it("mixed(GitHub issue→pr + Confluence) 매퍼 분기가 올바른 sourceType 으로 create 호출된다", async () => {
      const { service, createSpy } = makeService(async () => [
        ghActivity("num-i", "issue"),
        cfActivity("page-m", 1),
      ]);

      await service.collectAndPersist(makeSpec(), "assess-1");

      // issue 는 별도 literal 부재로 "pr" 로 흡수(매퍼 정합).
      expect(createSpy.mock.calls.map((c) => c[0].sourceType)).toEqual([
        "pr",
        "document",
      ]);
    });
  });

  describe("negative cases 충분 cover (R-112-4)", () => {
    it("빈 수집 결과 시 ContributionService.create 를 전혀 호출하지 않는다 (불필요 DB 호출 0)", async () => {
      const { service, createSpy } = makeService(async () => []);

      await service.collectAndPersist(makeSpec(), "assess-1");

      expect(createSpy).not.toHaveBeenCalled();
    });

    it("assessmentId 가 빈 문자열이어도 매퍼는 통과시키고 create 에 위임한다 (검증은 service-layer 책임)", async () => {
      const { service, createSpy } = makeService(async () => [
        ghActivity("sha-1"),
      ]);

      await service.collectAndPersist(makeSpec(), "");

      // orchestrator/매퍼는 assessmentId 를 검증하지 않고 그대로 전달(FK 유효성은
      // ContributionService.create 의 P2003→400 변환 책임 — 본 service 밖).
      expect(createSpy.mock.calls[0][0].assessmentId).toBe("");
    });

    it("create 에 전달되는 input 이 매퍼 산출과 정합한다 (변형 0)", async () => {
      const activity = cfActivity("page-9", 3);
      const { service, createSpy } = makeService(async () => [activity]);

      await service.collectAndPersist(makeSpec(), "assess-7");

      // service 가 매퍼 결과를 어떤 변형도 없이 그대로 create 에 전달함을 검증.
      const expected = mapActivityToContribution(activity, "assess-7");
      expect(createSpy).toHaveBeenCalledWith(expected);
    });

    it("반환 Contribution[] 순서가 입력 Activity[] 순서와 일치한다 (결정론)", async () => {
      const { service } = makeService(async () => [
        ghActivity("a", "commit"),
        cfActivity("b", 1),
        ghActivity("c", "pr"),
      ]);

      const result = await service.collectAndPersist(makeSpec(), "assess-1");

      // 기본 createImpl 이 input 을 echo → sourceRef 로 순서 검증.
      expect(
        result.map((c) => (c as unknown as ContributionCreateInput).sourceRef),
      ).toEqual(["a", "b@1", "c"]);
    });
  });

  describe("persistActivities 직접 경로 (slice iii-b1)", () => {
    it("이미 수집된 Activity[] 를 매퍼 거쳐 create 순서대로 호출하고 Contribution[] 반환 (orchestrator 미호출)", async () => {
      const { service, collectSpy, createSpy } = makeService(async () => []);

      const result = await service.persistActivities(
        [ghActivity("sha-1", "commit"), cfActivity("page-1", 2)],
        "assess-1",
      );

      // persistActivities 는 orchestrator 를 호출하지 않는다(이미 수집된 활동을 받음).
      expect(collectSpy).not.toHaveBeenCalled();
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(createSpy.mock.calls.map((c) => c[0].sourceRef)).toEqual([
        "sha-1",
        "page-1@2",
      ]);
      expect(result.map((c) => c.id)).toEqual(["c-sha-1", "c-page-1@2"]);
    });

    it("(a) create 가 첫 활동에서 reject → 전파하고 이후 create 미호출 (fail-fast)", async () => {
      const { service, createSpy } = makeService(
        async () => [],
        async () => {
          throw new BadRequestException("첫 활동 실패");
        },
      );

      await expect(
        service.persistActivities(
          [ghActivity("sha-1"), ghActivity("sha-2")],
          "assess-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it("(b) create 가 중간 활동에서 reject → 그 시점까지만 호출되고 전파 (부분 영속 후 fail-fast)", async () => {
      let n = 0;
      const { service, createSpy } = makeService(
        async () => [],
        async (input: ContributionCreateInput): Promise<Contribution> => {
          n += 1;
          if (n === 2) {
            throw new Error("두번째 활동 실패");
          }
          return {
            id: `c-${input.sourceRef}`,
            ...input,
          } as unknown as Contribution;
        },
      );

      await expect(
        service.persistActivities(
          [ghActivity("a"), ghActivity("b"), ghActivity("c")],
          "assess-1",
        ),
      ).rejects.toThrow("두번째 활동 실패");
      // 2번째에서 중단 — 3번째 create 는 호출되지 않음.
      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it("(c) 빈 activities → create 0회 + 빈 배열 (throw 0)", async () => {
      const { service, createSpy } = makeService(async () => []);

      const result = await service.persistActivities([], "assess-1");

      expect(result).toEqual([]);
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
