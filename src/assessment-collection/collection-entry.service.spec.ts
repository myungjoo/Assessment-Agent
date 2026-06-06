// CollectionEntryService 의 unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). ADR-0030 §5 collectForPerson 4단계 조립. CollectionSpecService /
// CollectionOrchestratorService / CollectionPersistenceService 는 jest mock 으로 주입하고
// filterActivitiesByAuthor 는 실제 순수 함수를 통과시켜 조립 흐름을 검증한다(Q-0025 deferred
// 정합 — 실 GitHub/Confluence/DB 0). 호출 순서·인자(특히 author 필터 결과)를 검증한다.

import type { Contribution } from "@prisma/client";

import { CollectionEntryService } from "./collection-entry.service";
import type { CollectForPersonInput } from "./collection-entry.service";
import { CollectionOrchestratorService } from "./collection-orchestrator.service";
import type { CollectionSpec } from "./collection-orchestrator.service";
import { CollectionPersistenceService } from "./collection-persistence.service";
import { CollectionSpecService } from "./collection-spec.service";
import { Activity, GithubActivity } from "./domain/activity";

// ghActivity — GitHub Activity 최소 fixture(author 필터는 instanceKey/author 만 읽는다).
function ghActivity(instanceKey: string, author: string): GithubActivity {
  return {
    externalId: `sha-${author}`,
    sourceType: "github",
    instanceKey,
    author,
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    repoRef: "acme/api",
    kind: "commit",
  };
}

const EMPTY_SPEC: CollectionSpec = {
  github: { sources: [] },
  confluence: { instances: [] },
};

// makeService — 3 의존 service 를 jest mock 으로 주입한 CollectionEntryService 를 만든다.
// 기본 persist 는 입력 activities 를 Contribution marker(id = "c-"+externalId)로 echo 해
// author 필터를 통과한 활동이 무엇인지 호출 인자/반환으로 검증 가능하게 한다.
function makeService(opts?: {
  buildSpec?: (
    person: CollectForPersonInput,
    since?: string,
  ) => Promise<CollectionSpec>;
  collect?: (spec: CollectionSpec) => Promise<Activity[]>;
  persist?: (
    activities: Activity[],
    assessmentId: string,
  ) => Promise<Contribution[]>;
}): {
  service: CollectionEntryService;
  buildSpy: jest.Mock;
  collectSpy: jest.Mock;
  persistSpy: jest.Mock;
} {
  const buildSpy = jest.fn(
    opts?.buildSpec ?? (async (): Promise<CollectionSpec> => EMPTY_SPEC),
  );
  const collectSpy = jest.fn(
    opts?.collect ?? (async (): Promise<Activity[]> => []),
  );
  const persistSpy = jest.fn(
    opts?.persist ??
      (async (activities: Activity[]): Promise<Contribution[]> =>
        activities.map(
          (a) => ({ id: `c-${a.externalId}` }) as unknown as Contribution,
        )),
  );
  const specService = {
    buildCollectionSpec: buildSpy,
  } as unknown as CollectionSpecService;
  const orchestrator = {
    collectActivities: collectSpy,
  } as unknown as CollectionOrchestratorService;
  const persistence = {
    persistActivities: persistSpy,
  } as unknown as CollectionPersistenceService;
  return {
    service: new CollectionEntryService(specService, orchestrator, persistence),
    buildSpy,
    collectSpy,
    persistSpy,
  };
}

describe("CollectionEntryService.collectForPerson", () => {
  describe("happy path", () => {
    it("4단계를 순서대로 조립하고 author 필터 통과 활동만 영속화한다", async () => {
      const person: CollectForPersonInput = {
        serviceIdentities: [{ service: "public", externalId: "gildong" }],
      };
      const since = "2026-01-01T00:00:00Z";
      const { service, buildSpy, collectSpy, persistSpy } = makeService({
        buildSpec: async (): Promise<CollectionSpec> => EMPTY_SPEC,
        collect: async (): Promise<Activity[]> => [
          ghActivity("public", "gildong"),
          ghActivity("public", "stranger"),
        ],
      });

      const result = await service.collectForPerson(person, since, "assess-1");

      // (1) buildCollectionSpec(person, since)
      expect(buildSpy).toHaveBeenCalledWith(person, since);
      // (2) collectActivities(spec)
      expect(collectSpy).toHaveBeenCalledWith(EMPTY_SPEC);
      // (3)+(4) author 필터 후 gildong 활동만 persistActivities 로 전달(stranger 제외).
      expect(persistSpy).toHaveBeenCalledTimes(1);
      const [filtered, assessmentId] = persistSpy.mock.calls[0];
      expect(filtered).toEqual([ghActivity("public", "gildong")]);
      expect(assessmentId).toBe("assess-1");
      // 반환은 persist 결과.
      expect(result).toEqual([{ id: "c-sha-gildong" }]);
    });

    it("호출 순서가 build → collect → persist 다", async () => {
      const calls: string[] = [];
      const { service } = makeService({
        buildSpec: async (): Promise<CollectionSpec> => {
          calls.push("build");
          return EMPTY_SPEC;
        },
        collect: async (): Promise<Activity[]> => {
          calls.push("collect");
          return [];
        },
        persist: async (): Promise<Contribution[]> => {
          calls.push("persist");
          return [];
        },
      });

      await service.collectForPerson(
        { serviceIdentities: [{ service: "public", externalId: "g" }] },
        undefined,
        "assess-1",
      );

      expect(calls).toEqual(["build", "collect", "persist"]);
    });
  });

  describe("error path (의존성 실패 전파)", () => {
    it("(a) buildCollectionSpec reject → 전파하고 collect/persist 미호출", async () => {
      const { service, collectSpy, persistSpy } = makeService({
        buildSpec: async (): Promise<CollectionSpec> => {
          throw new Error("spec 실패");
        },
      });

      await expect(
        service.collectForPerson(
          { serviceIdentities: [{ service: "public", externalId: "g" }] },
          undefined,
          "assess-1",
        ),
      ).rejects.toThrow("spec 실패");
      expect(collectSpy).not.toHaveBeenCalled();
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it("(b) collectActivities reject → 전파하고 persist 미호출", async () => {
      const { service, persistSpy } = makeService({
        collect: async (): Promise<Activity[]> => {
          throw new Error("수집 실패");
        },
      });

      await expect(
        service.collectForPerson(
          { serviceIdentities: [{ service: "public", externalId: "g" }] },
          undefined,
          "assess-1",
        ),
      ).rejects.toThrow("수집 실패");
      expect(persistSpy).not.toHaveBeenCalled();
    });

    it("(c) persistActivities reject(FK 위반 등) → 그대로 전파", async () => {
      const { service } = makeService({
        collect: async (): Promise<Activity[]> => [ghActivity("public", "g")],
        persist: async (): Promise<Contribution[]> => {
          throw new Error("FK 위반");
        },
      });

      await expect(
        service.collectForPerson(
          { serviceIdentities: [{ service: "public", externalId: "g" }] },
          undefined,
          "assess-1",
        ),
      ).rejects.toThrow("FK 위반");
    });
  });

  describe("negative / flow cover", () => {
    it("(d) 빈 serviceIdentities → author 필터 빈 결과 → persist 빈 입력 → 빈 Contribution[]", async () => {
      const { service, persistSpy } = makeService({
        collect: async (): Promise<Activity[]> => [ghActivity("public", "x")],
      });

      const result = await service.collectForPerson(
        { serviceIdentities: [] },
        undefined,
        "assess-1",
      );

      expect(persistSpy).toHaveBeenCalledWith([], "assess-1");
      expect(result).toEqual([]);
    });

    it("(e) author 전부 불일치 → 필터가 모두 제외 → persist 빈 입력", async () => {
      const { service, persistSpy } = makeService({
        collect: async (): Promise<Activity[]> => [
          ghActivity("public", "someone-else"),
        ],
      });

      const result = await service.collectForPerson(
        { serviceIdentities: [{ service: "public", externalId: "gildong" }] },
        undefined,
        "assess-1",
      );

      expect(persistSpy).toHaveBeenCalledWith([], "assess-1");
      expect(result).toEqual([]);
    });

    it("(f) author 부분 일치 → 일치 활동만 persist 로 전달", async () => {
      const { service, persistSpy } = makeService({
        collect: async (): Promise<Activity[]> => [
          ghActivity("public", "gildong"),
          ghActivity("public", "other"),
          ghActivity("public", "gildong"),
        ],
      });

      await service.collectForPerson(
        { serviceIdentities: [{ service: "public", externalId: "gildong" }] },
        undefined,
        "assess-1",
      );

      const [filtered] = persistSpy.mock.calls[0];
      expect(filtered).toEqual([
        ghActivity("public", "gildong"),
        ghActivity("public", "gildong"),
      ]);
    });

    it("(g) since 지정 → buildCollectionSpec 에 그 since 가 pass-through 된다", async () => {
      const since = "2026-05-05T00:00:00Z";
      const { service, buildSpy } = makeService();

      await service.collectForPerson(
        { serviceIdentities: [{ service: "public", externalId: "g" }] },
        since,
        "assess-1",
      );

      expect(buildSpy).toHaveBeenCalledWith(
        { serviceIdentities: [{ service: "public", externalId: "g" }] },
        since,
      );
    });
  });
});
