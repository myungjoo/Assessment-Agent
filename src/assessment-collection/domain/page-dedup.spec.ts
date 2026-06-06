// page-dedup 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch / negative
// cases 충분 cover). collection slice (iii), ADR-0029 Decision §4(page (page-id,
// version) latest-wins dedup). 부수효과 0 순수 함수만 검증 — adapter mock 0.

import { ConfluenceActivity } from "./activity";
import { dedupConfluenceActivities } from "./page-dedup";

// page — 주어진 page-id / version / spaceRef 로 Confluence 활동 fixture 를 만든다.
function page(
  pageId: string,
  version: number,
  spaceRef = "ENG",
): ConfluenceActivity {
  return {
    externalId: pageId,
    sourceType: "confluence",
    instanceKey: "cloud",
    author: "accountId-1",
    timestamp: "2026-06-01T09:00:00Z",
    spaceRef,
    version,
    metadata: {},
  };
}

describe("dedupConfluenceActivities", () => {
  describe("happy path (R-112-1)", () => {
    it("무중복 입력은 그대로(순서 보존) 반환한다", () => {
      const input = [page("p1", 1), page("p2", 1), page("p3", 2)];
      const result = dedupConfluenceActivities(input);
      expect(result).toEqual(input);
    });

    it("빈 배열은 빈 배열을 반환한다", () => {
      expect(dedupConfluenceActivities([])).toEqual([]);
    });

    it("입력 배열을 변형하지 않는다(부수효과 0)", () => {
      const input = [page("p1", 1), page("p1", 2)];
      const snapshot = JSON.parse(JSON.stringify(input));
      dedupConfluenceActivities(input);
      expect(input).toEqual(snapshot);
    });
  });

  describe("page-id/version latest-wins (R-112-3 branch, R-112-4 negative)", () => {
    it("같은 page-id 2건 중 첫째가 higher version 이면 첫째를 유지한다(i)", () => {
      const higher = page("dup", 5, "ENG");
      const lower = page("dup", 2, "OPS");
      const result = dedupConfluenceActivities([higher, lower]);
      expect(result).toEqual([higher]);
    });

    it("같은 page-id 2건 중 둘째가 higher version 이면 둘째를 유지한다(ii)", () => {
      const lower = page("dup", 2, "ENG");
      const higher = page("dup", 7, "OPS");
      const result = dedupConfluenceActivities([lower, higher]);
      // higher 항목이 살아남되, 반환 위치는 page-id 최초 등장(=lower 의 index 0) 기준.
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(higher);
    });

    it("같은 page-id·동일 version 이면 먼저 등장한 항목을 유지한다(iii tie-break)", () => {
      const first = page("dup", 3, "ENG");
      const second = page("dup", 3, "OPS");
      const result = dedupConfluenceActivities([first, second]);
      expect(result).toEqual([first]);
    });

    it("같은 page-id 3건이면 최대 version 1건만 유지한다", () => {
      const a = page("dup", 3);
      const b = page("dup", 9);
      const c = page("dup", 5);
      const result = dedupConfluenceActivities([a, b, c]);
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(9);
    });

    it("서로 다른 page-id 는 version 무관하게 모두 유지된다", () => {
      const input = [page("p1", 9), page("p2", 1)];
      expect(dedupConfluenceActivities(input)).toHaveLength(2);
    });
  });

  describe("반환 순서 안정성 (R-112-3 branch)", () => {
    it("dedup 후에도 page-id 최초 등장 순서를 보존한다", () => {
      const input = [
        page("p-a", 1),
        page("p-b", 1),
        page("p-a", 5), // p-a 의 latest — 위치는 첫 등장(index 0) 기준
        page("p-c", 1),
      ];
      const result = dedupConfluenceActivities(input);
      expect(result.map((a) => a.externalId)).toEqual(["p-a", "p-b", "p-c"]);
      // p-a 는 latest version 으로 수렴.
      expect(result[0].version).toBe(5);
    });
  });
});
