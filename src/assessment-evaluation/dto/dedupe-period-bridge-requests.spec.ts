// dedupe-period-bridge-requests.spec — T-0551. 순수 helper dedupePeriodBridgeRequests 의
// R-112 cover: happy path / error path / branch coverage / negative cases 충분 cover /
// 비변형. 신규 파일 100% coverage 목표.

import { dedupePeriodBridgeRequests } from "./dedupe-period-bridge-requests";
import { PeriodBridgeDto } from "./period-bridge.dto";

/** 좌표 4 축 + 선택 reevaluate 를 갖는 PeriodBridgeDto plain 객체 조립 helper. */
function makeRequest(
  overrides: Partial<PeriodBridgeDto> = {},
): PeriodBridgeDto {
  const dto = new PeriodBridgeDto();
  dto.personId = overrides.personId ?? "person-1";
  dto.period = overrides.period ?? "week";
  dto.scope = overrides.scope ?? "commit";
  dto.periodStart = overrides.periodStart ?? "2026-06-10T00:00:00+09:00";
  if (overrides.reevaluate !== undefined) {
    dto.reevaluate = overrides.reevaluate;
  }
  return dto;
}

describe("dedupePeriodBridgeRequests", () => {
  describe("happy path — 중복 없는 입력 보존", () => {
    it("중복 없는 다중 원소(2+)는 길이·순서·각 원소 참조가 그대로 통과한다", () => {
      const a = makeRequest({ personId: "p-a" });
      const b = makeRequest({ personId: "p-b" });
      const c = makeRequest({ personId: "p-c" });

      const result = dedupePeriodBridgeRequests([a, b, c]);

      expect(result).toHaveLength(3);
      // 순서 보존 + 각 원소 동일 객체 참조 재사용(복제 0).
      expect(result[0]).toBe(a);
      expect(result[1]).toBe(b);
      expect(result[2]).toBe(c);
    });

    it("중복이 있으면 중복이 제거되고 첫 등장만 남아 길이가 줄어든다", () => {
      const first = makeRequest({ periodStart: "2026-06-10T00:00:00+09:00" });
      const dup = makeRequest({ periodStart: "2026-06-10T00:00:00+09:00" });

      const result = dedupePeriodBridgeRequests([first, dup]);

      expect(result).toHaveLength(1);
      // 첫 등장(first-wins) 원소가 보존되고 두 번째 중복은 버려진다.
      expect(result[0]).toBe(first);
    });
  });

  describe("error path — fail-fast 한국어 TypeError", () => {
    it("requests 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        dedupePeriodBridgeRequests(null as unknown as PeriodBridgeDto[]),
      ).toThrow(TypeError);
      expect(() =>
        dedupePeriodBridgeRequests(null as unknown as PeriodBridgeDto[]),
      ).toThrow("배열이어야 한다");
    });

    it("requests 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        dedupePeriodBridgeRequests(undefined as unknown as PeriodBridgeDto[]),
      ).toThrow(TypeError);
      expect(() =>
        dedupePeriodBridgeRequests(undefined as unknown as PeriodBridgeDto[]),
      ).toThrow("배열이어야 한다");
    });

    it("requests 가 non-array(객체)면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        dedupePeriodBridgeRequests({} as unknown as PeriodBridgeDto[]),
      ).toThrow(TypeError);
      expect(() =>
        dedupePeriodBridgeRequests({} as unknown as PeriodBridgeDto[]),
      ).toThrow("배열이어야 한다");
    });

    it("requests 가 non-array(string)면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        dedupePeriodBridgeRequests("nope" as unknown as PeriodBridgeDto[]),
      ).toThrow(TypeError);
    });

    it("배열 원소가 null 이면 인덱스 포함 한국어 메시지 TypeError 를 던진다", () => {
      const good = makeRequest();
      expect(() =>
        dedupePeriodBridgeRequests([good, null as unknown as PeriodBridgeDto]),
      ).toThrow(TypeError);
      expect(() =>
        dedupePeriodBridgeRequests([good, null as unknown as PeriodBridgeDto]),
      ).toThrow("requests[1]");
    });

    it("배열 원소가 undefined 이면 인덱스 포함 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        dedupePeriodBridgeRequests([undefined as unknown as PeriodBridgeDto]),
      ).toThrow("requests[0]");
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 빈 배열 [] 은 빈 배열을 반환한다", () => {
      const result = dedupePeriodBridgeRequests([]);
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("(b) 중복 없는 단일 원소는 그대로 보존한다", () => {
      const only = makeRequest();
      const result = dedupePeriodBridgeRequests([only]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(only);
    });

    it("(b) 중복 없는 다중 원소는 전부 보존한다", () => {
      const a = makeRequest({ scope: "commit" });
      const b = makeRequest({ scope: "document" });
      const result = dedupePeriodBridgeRequests([a, b]);
      expect(result).toEqual([a, b]);
    });

    it("(c) 동일 좌표 인접 중복은 첫 것만 보존한다", () => {
      const first = makeRequest({ period: "month" });
      const adjacentDup = makeRequest({ period: "month" });
      const result = dedupePeriodBridgeRequests([first, adjacentDup]);
      expect(result).toEqual([first]);
    });

    it("(d) 동일 좌표 비인접 중복(사이에 다른 좌표)도 전역으로 제거한다", () => {
      const first = makeRequest({ personId: "p-x" });
      const other = makeRequest({ personId: "p-y" });
      const nonAdjacentDup = makeRequest({ personId: "p-x" });

      const result = dedupePeriodBridgeRequests([first, other, nonAdjacentDup]);

      // 전역 dedup — 인접만 아니라 비인접 중복도 제거. 첫 등장 순서 보존.
      expect(result).toEqual([first, other]);
      expect(result[0]).toBe(first);
      expect(result[1]).toBe(other);
    });
  });

  describe("negative cases 충분 cover — false-merge / false-split 방지", () => {
    it("key 구분자 충돌 회피 — personId='a|b',period='' 와 personId='a',period='b' 는 별개로 둘 다 보존", () => {
      const left = makeRequest({ personId: "a|b", period: "" });
      const right = makeRequest({ personId: "a", period: "b" });

      const result = dedupePeriodBridgeRequests([left, right]);

      // 단순 concat 이면 둘 다 "a|b|" 로 false-merge — JSON 직렬화 key 로 별개 취급.
      expect(result).toHaveLength(2);
      expect(result).toEqual([left, right]);
    });

    it("personId 만 다른 좌표는 별개로 둘 다 보존한다", () => {
      const a = makeRequest({ personId: "p-1" });
      const b = makeRequest({ personId: "p-2" });
      expect(dedupePeriodBridgeRequests([a, b])).toHaveLength(2);
    });

    it("period 만 다른 좌표는 별개로 둘 다 보존한다", () => {
      const a = makeRequest({ period: "week" });
      const b = makeRequest({ period: "month" });
      expect(dedupePeriodBridgeRequests([a, b])).toHaveLength(2);
    });

    it("scope 만 다른 좌표는 별개로 둘 다 보존한다", () => {
      const a = makeRequest({ scope: "commit" });
      const b = makeRequest({ scope: "aggregate" });
      expect(dedupePeriodBridgeRequests([a, b])).toHaveLength(2);
    });

    it("periodStart 만 다른 좌표는 별개로 둘 다 보존한다", () => {
      const a = makeRequest({ periodStart: "2026-06-10T00:00:00+09:00" });
      const b = makeRequest({ periodStart: "2026-06-11T00:00:00+09:00" });
      expect(dedupePeriodBridgeRequests([a, b])).toHaveLength(2);
    });

    it("reevaluate 는 dedup key 에 포함하지 않는다 — 좌표 같고 reevaluate 만 다르면 중복으로 첫 것만 보존", () => {
      const first = makeRequest({ reevaluate: false });
      const dupDifferentReeval = makeRequest({ reevaluate: true });

      const result = dedupePeriodBridgeRequests([first, dupDifferentReeval]);

      // reevaluate 축은 key 미포함 — 좌표 4-tuple 동일하므로 첫 등장만 보존(first-wins).
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(first);
      expect(result[0].reevaluate).toBe(false);
    });
  });

  describe("비변형 — 입력 mutate 0, first-wins 원소 참조 재사용", () => {
    it("입력 배열을 mutate 하지 않는다(호출 후 길이·원소 그대로)", () => {
      const a = makeRequest({ personId: "p-a" });
      const dup = makeRequest({ personId: "p-a" });
      const b = makeRequest({ personId: "p-b" });
      const input = [a, dup, b];

      dedupePeriodBridgeRequests(input);

      // 입력 배열 길이·순서 불변(반환은 새 배열).
      expect(input).toHaveLength(3);
      expect(input).toEqual([a, dup, b]);
    });

    it("보존된 원소는 입력의 동일 객체 참조를 그대로 재사용한다(복제 0)", () => {
      const a = makeRequest({ personId: "p-a" });
      const b = makeRequest({ personId: "p-b" });

      const result = dedupePeriodBridgeRequests([a, b]);

      // 새 인스턴스 복제가 아니라 입력 원소 passthrough.
      expect(result[0]).toBe(a);
      expect(result[1]).toBe(b);
    });

    it("입력 요청 객체의 필드를 mutate 하지 않는다", () => {
      const req = makeRequest({ personId: "p-keep", reevaluate: true });
      dedupePeriodBridgeRequests([req]);
      expect(req.personId).toBe("p-keep");
      expect(req.reevaluate).toBe(true);
    });

    it("반환 배열은 입력 배열과 다른 새 인스턴스다", () => {
      const input = [makeRequest()];
      const result = dedupePeriodBridgeRequests(input);
      expect(result).not.toBe(input);
    });
  });
});
