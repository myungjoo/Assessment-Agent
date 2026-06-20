// fill-requests-to-bridge.mapper spec — 순수 함수 `toPeriodBridgeRequests` 를 직접 호출해
// 검증. UnevaluatedFillRequest[] → PeriodBridgeDto[] 1:1 순서 보존 매핑, reevaluate 미설정,
// null/undefined fail-fast 한국어 TypeError, 비변형. R-112: happy / error / branch /
// negative 충분 cover(예외 분기마다 1+).
import type { UnevaluatedFillRequest } from "../domain/evaluation-unevaluated-fill-requests";

import { toPeriodBridgeRequests } from "./fill-requests-to-bridge.mapper";
import { PeriodBridgeDto } from "./period-bridge.dto";

// 요청 intent factory — 4 축을 빠르게 구성. periodStart 는 ISO string.
function req(
  personId: string,
  period = "week",
  scope = "commit",
  periodStart = "2026-06-10T15:00:00+09:00",
): UnevaluatedFillRequest {
  return { personId, period, scope, periodStart };
}

describe("toPeriodBridgeRequests — 미평가 fill 요청 intent → PeriodBridgeDto 배열 순수 mapper", () => {
  describe("happy-path — 정상 다중 원소 매핑", () => {
    it("출력 길이가 입력 길이와 같고, 각 원소의 4 축이 입력과 일치하며, reevaluate 는 undefined(미설정)이다", () => {
      const requests: UnevaluatedFillRequest[] = [
        req("p1", "week", "commit", "2026-06-10T15:00:00+09:00"),
        req("p2", "month", "document", "2026-06-11T15:00:00+09:00"),
      ];

      const result = toPeriodBridgeRequests(requests);

      expect(result).toHaveLength(2);
      result.forEach((dto, i) => {
        expect(dto.personId).toBe(requests[i].personId);
        expect(dto.period).toBe(requests[i].period);
        expect(dto.scope).toBe(requests[i].scope);
        expect(dto.periodStart).toBe(requests[i].periodStart);
        // reevaluate 축은 set 하지 않는다(fill = first-write-wins, overwrite 아님).
        expect(dto.reevaluate).toBeUndefined();
      });
    });

    it("각 출력 원소는 PeriodBridgeDto 인스턴스다", () => {
      const result = toPeriodBridgeRequests([req("p1")]);
      expect(result[0]).toBeInstanceOf(PeriodBridgeDto);
    });
  });

  describe("error path — null/undefined·non-array fail-fast(한국어 TypeError)", () => {
    it("requests 가 null 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toPeriodBridgeRequests(null as unknown as UnevaluatedFillRequest[]),
      ).toThrow(TypeError);
      expect(() =>
        toPeriodBridgeRequests(null as unknown as UnevaluatedFillRequest[]),
      ).toThrow("requests 는 배열이어야 한다");
    });

    it("requests 가 undefined 이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toPeriodBridgeRequests(
          undefined as unknown as UnevaluatedFillRequest[],
        ),
      ).toThrow("requests 는 배열이어야 한다");
    });

    it("requests 가 non-array(객체)이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toPeriodBridgeRequests({} as unknown as UnevaluatedFillRequest[]),
      ).toThrow("requests 는 배열이어야 한다");
    });

    it("requests 가 non-array(string)이면 한국어 메시지 TypeError 를 던진다", () => {
      expect(() =>
        toPeriodBridgeRequests("x" as unknown as UnevaluatedFillRequest[]),
      ).toThrow(TypeError);
    });

    it("배열 원소가 null 이면 인덱스를 포함한 한국어 메시지 TypeError 를 던진다", () => {
      const requests = [req("p1"), null as unknown as UnevaluatedFillRequest];
      expect(() => toPeriodBridgeRequests(requests)).toThrow(TypeError);
      expect(() => toPeriodBridgeRequests(requests)).toThrow(
        "requests[1] 요청 원소가 null/undefined 일 수 없다",
      );
    });

    it("배열 원소가 undefined 이면 인덱스를 포함한 한국어 메시지 TypeError 를 던진다", () => {
      const requests = [
        undefined as unknown as UnevaluatedFillRequest,
        req("p2"),
      ];
      expect(() => toPeriodBridgeRequests(requests)).toThrow(
        "requests[0] 요청 원소가 null/undefined 일 수 없다",
      );
    });
  });

  describe("flow / branch coverage — 빈/단일/다중/중복", () => {
    it("(a) 빈 배열은 빈 배열을 반환한다", () => {
      expect(toPeriodBridgeRequests([])).toEqual([]);
    });

    it("(b) 단일 원소는 길이 1 의 배열로 매핑된다", () => {
      const result = toPeriodBridgeRequests([req("solo")]);
      expect(result).toHaveLength(1);
      expect(result[0].personId).toBe("solo");
    });

    it("(c) 다중 원소는 입력 순서를 그대로 보존한다", () => {
      const requests = [req("a"), req("b"), req("c")];
      const result = toPeriodBridgeRequests(requests);
      expect(result.map((d) => d.personId)).toEqual(["a", "b", "c"]);
    });

    it("(d) 동일 좌표 중복 원소는 dedup 하지 않고 중복 그대로 출력한다", () => {
      const dup = req("dup", "week", "commit", "2026-06-10T15:00:00+09:00");
      const result = toPeriodBridgeRequests([dup, dup]);
      expect(result).toHaveLength(2);
      expect(result[0].personId).toBe("dup");
      expect(result[1].personId).toBe("dup");
      // 중복이어도 각 출력은 별개의 새 인스턴스다.
      expect(result[0]).not.toBe(result[1]);
    });
  });

  describe("negative cases — 경계값 정규화 안 함", () => {
    it('빈 personId("")는 정규화 없이 그대로 passthrough 한다', () => {
      const result = toPeriodBridgeRequests([req("")]);
      expect(result[0].personId).toBe("");
    });

    it("빈 period/scope/periodStart 도 그대로 passthrough 한다(boundary 정규화 안 함)", () => {
      const result = toPeriodBridgeRequests([req("p", "", "", "")]);
      expect(result[0].period).toBe("");
      expect(result[0].scope).toBe("");
      expect(result[0].periodStart).toBe("");
    });
  });

  describe("비변형 — 입력 mutate 0, 출력은 새 참조", () => {
    it("입력 배열과 각 요청 객체를 mutate 하지 않는다", () => {
      const original = req("p1", "week", "commit", "2026-06-10T15:00:00+09:00");
      const requests = [original];
      const snapshot = { ...original };

      toPeriodBridgeRequests(requests);

      expect(requests).toHaveLength(1);
      expect(original).toEqual(snapshot);
    });

    it("입력 원소와 출력 원소는 서로 다른 객체 참조다", () => {
      const original = req("p1");
      const result = toPeriodBridgeRequests([original]);
      expect(result[0]).not.toBe(original as unknown as PeriodBridgeDto);
    });
  });
});
