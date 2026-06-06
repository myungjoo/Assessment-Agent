// ConfluenceCollectionService 의 unit test(CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). collection slice (iii), ADR-0029 Decision §3
// (skip-and-continue) + §4((page-id, version) latest-wins dedup). live/credentialed
// 수집 0 — `ConfluenceSpaceTraversalService` 는 jest mock 으로 주입(Q-0025 deferred
// 정합). 실 Confluence 호출 0 / 실 token 0.

import { ConfluenceInstanceConfig } from "../confluence/confluence-instance-config";
import {
  ConfluenceSpaceTraversalService,
  SpaceTraversalResult,
} from "../confluence/confluence-space-traversal.service";

import {
  ConfluenceCollectionService,
  ConfluenceCollectionSpec,
} from "./confluence-collection.service";

// rawPage — traversal service 가 `SpaceTraversalResult.pages` 로 주는 raw `unknown[]`
// 의 단일 item 형태(confluence-activity.mapper fixture 와 동형). mapper 를 실제로
// 통과시켜 service 의 raw→typed→dedup flow 전체를 검증한다(mapper mock 0 — 순수 함수
// 합성 검증).
function rawPage(id: string, version: number, when: string): unknown {
  return {
    id,
    title: "페이지 제목",
    version: {
      number: version,
      when,
      by: { accountId: "accountId-1" },
    },
  };
}

// makeConfig — 단일 instance config fixture. spaceAllowlist 는 traversal service 가
// 내부적으로 쓰는 값이라 본 service 가 직접 참조하지 않지만(traversal 이 mock 이므로),
// config.key 는 mapper 에 instanceKey 로 주입되므로 의미가 있다.
function makeConfig(key: string): ConfluenceInstanceConfig {
  return {
    key,
    baseUrl: "https://example.atlassian.net/wiki/rest/api",
    authUser: "user@example.com",
    tokenEnc: "enc:fake",
    spaceAllowlist: ["ENG"],
  };
}

// makeServiceMock — `traverseInstance` 만 mock 한 `ConfluenceSpaceTraversalService` 를
// 만든다. handler 는 config → SpaceTraversalResult[] 또는 throw 를 결정한다.
function makeServiceMock(
  handler: (config: ConfluenceInstanceConfig) => SpaceTraversalResult[],
): {
  service: ConfluenceCollectionService;
  spy: jest.Mock;
} {
  const spy = jest.fn(
    async (config: ConfluenceInstanceConfig): Promise<SpaceTraversalResult[]> =>
      handler(config),
  );
  const traversal = {
    traverseInstance: spy,
  } as unknown as ConfluenceSpaceTraversalService;
  return { service: new ConfluenceCollectionService(traversal), spy };
}

describe("ConfluenceCollectionService", () => {
  describe("happy path (R-112-1)", () => {
    it("단일 instance 의 SPACE page 를 수집해 ConfluenceActivity[]로 매핑한다", async () => {
      const { service, spy } = makeServiceMock(() => [
        {
          spaceKey: "ENG",
          pages: [
            rawPage("100", 1, "2026-06-01T09:00:00Z"),
            rawPage("101", 1, "2026-06-02T10:00:00Z"),
          ],
        },
      ]);

      const spec: ConfluenceCollectionSpec = {
        instances: [makeConfig("cloud")],
      };
      const result = await service.collectConfluenceActivities(spec);

      // 2 page → 2 activity.
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.sourceType === "confluence")).toBe(true);
      // 호출 context(instanceKey / spaceRef)가 mapper 에 주입됐다.
      expect(result.every((a) => a.instanceKey === "cloud")).toBe(true);
      expect(result.every((a) => a.spaceRef === "ENG")).toBe(true);
      expect(result.map((a) => a.externalId).sort()).toEqual(["100", "101"]);
      // 1 instance = 1 회 traverseInstance 호출.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(makeConfig("cloud"));
    });

    it("여러 SPACE 결과의 page 를 각 spaceKey 로 매핑해 누적한다", async () => {
      const { service } = makeServiceMock(() => [
        { spaceKey: "ENG", pages: [rawPage("1", 1, "2026-06-01T09:00:00Z")] },
        { spaceKey: "OPS", pages: [rawPage("2", 1, "2026-06-02T09:00:00Z")] },
      ]);
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud")],
      });
      expect(result).toHaveLength(2);
      const byId = new Map(result.map((a) => [a.externalId, a.spaceRef]));
      // 각 page 가 자기 SPACE 의 key 로 spaceRef 주입됐다.
      expect(byId.get("1")).toBe("ENG");
      expect(byId.get("2")).toBe("OPS");
    });

    it("다중 instance 를 모두 enumerate 한다", async () => {
      const { service, spy } = makeServiceMock(() => []);
      await service.collectConfluenceActivities({
        instances: [makeConfig("cloud"), makeConfig("internal")],
      });
      // 2 instance = 2 회 호출.
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("dedup 통합 (R-112-3 branch, R-112-4 negative)", () => {
    it("같은 page-id 의 여러 version 이 수집되면 latest version 1건만 남는다", async () => {
      const { service } = makeServiceMock(() => [
        {
          spaceKey: "ENG",
          // 같은 page-id "p" 의 version 2 / 5 (편집 이력 / 재수집).
          pages: [
            rawPage("p", 2, "2026-06-01T09:00:00Z"),
            rawPage("p", 5, "2026-06-05T09:00:00Z"),
          ],
        },
      ]);
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud")],
      });
      // latest-wins → 1건, 최대 version 유지.
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(5);
    });

    it("여러 instance 에서 같은 page-id 가 수집돼도 latest version 으로 수렴한다", async () => {
      const { service } = makeServiceMock((config) => {
        // cloud 는 version 3, internal 은 version 8 의 같은 page-id "shared".
        const version = config.key === "cloud" ? 3 : 8;
        return [
          {
            spaceKey: "ENG",
            pages: [rawPage("shared", version, "2026-06-01T09:00:00Z")],
          },
        ];
      });
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud"), makeConfig("internal")],
      });
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(8);
    });
  });

  describe("malformed skip (R-112-2)", () => {
    it("mapper 가 null 반환하는 malformed raw page 는 결과에서 걸러진다", async () => {
      const { service } = makeServiceMock(() => [
        {
          spaceKey: "ENG",
          pages: [
            rawPage("good", 1, "2026-06-01T09:00:00Z"),
            { id: "no-version" }, // version 누락 → mapper null
            null, // 비-객체 → mapper null
          ],
        },
      ]);
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud")],
      });
      // good 1건만 남고 malformed 2건은 skip.
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("good");
    });
  });

  describe("skip-and-continue (R-112-2, R-112-3 branch, R-112-4 negative)", () => {
    it("한 instance 가 throw(instance 레벨 오류)해도 나머지 instance 결과는 반환한다(전체 throw 0)", async () => {
      const { service } = makeServiceMock((config) => {
        if (config.key === "cloud") {
          throw new Error("token decrypt 실패 (instance 레벨)");
        }
        return [
          {
            spaceKey: "ENG",
            pages: [rawPage("ok", 1, "2026-06-01T09:00:00Z")],
          },
        ];
      });
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud"), makeConfig("internal")],
      });
      // cloud 는 skip, internal 의 page 1건만 반환.
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("ok");
    });

    it("모든 instance 가 throw 해도 빈 배열을 반환한다(전체 실패도 throw 0)", async () => {
      const { service } = makeServiceMock(() => {
        throw new Error("all instances unavailable");
      });
      await expect(
        service.collectConfluenceActivities({
          instances: [makeConfig("cloud"), makeConfig("internal")],
        }),
      ).resolves.toEqual([]);
    });
  });

  describe("empty enumerate (R-112-2 negative)", () => {
    it("빈 instance 입력이면 빈 배열을 반환하고 traversal 을 호출하지 않는다", async () => {
      const { service, spy } = makeServiceMock(() => []);
      const result = await service.collectConfluenceActivities({
        instances: [],
      });
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("instance 는 있으나 traversal 이 빈 결과면 빈 배열을 반환한다", async () => {
      const { service } = makeServiceMock(() => []);
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud")],
      });
      expect(result).toEqual([]);
    });

    it("SPACE 결과는 있으나 pages 가 비면 빈 배열을 반환한다", async () => {
      const { service } = makeServiceMock(() => [
        { spaceKey: "ENG", pages: [] },
      ]);
      const result = await service.collectConfluenceActivities({
        instances: [makeConfig("cloud")],
      });
      expect(result).toEqual([]);
    });
  });
});
