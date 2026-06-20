// EvaluationUnevaluatedFillPlanner spec — R-112 4 종(happy / error / flow-branch /
// negative cases 충분 cover) + 입력 비변형 검증. mock 은 EvaluationPersistedRecordsReader
// 의 공개 메서드 readForPersons 만 jest.fn() 으로 stub(evaluation-persisted-records-reader
// .service.spec.ts 의 mock 패턴 mirror — 새 helper 추출 불요). DB / Prisma 접근 0 — service
// 단위 검증. 순수 compose helper(composeUnevaluatedFillPlan)는 실제 구현을 그대로 통과시켜
// end-to-end 조립(reader 출력 → persisted 입력 → batch plan)을 검증한다.
import type { IntendedPeriodCoordinatesInput } from "./domain/evaluation-intended-period-coordinates";
import type { PersistedAssessmentRecord } from "./domain/evaluation-persisted-period-coordinates";
import type { EvaluationPersistedRecordsReader } from "./evaluation-persisted-records-reader.service";
import { EvaluationUnevaluatedFillPlanner } from "./evaluation-unevaluated-fill-planner.service";

// makeIntended — 테스트용 의도 좌표 입력 팩토리. 기본은 day period 의 단일 anchor 구간
// (rangeStart 의 KST day anchor 1 개)으로 결정적 enumeration 을 산출한다.
function makeIntended(
  overrides: Partial<IntendedPeriodCoordinatesInput> = {},
): IntendedPeriodCoordinatesInput {
  return {
    personIds: ["p1", "p2"],
    period: "day",
    scope: "commit",
    rangeStart: new Date("2026-01-01T00:00:00Z"),
    rangeEnd: new Date("2026-01-01T12:00:00Z"),
    ...overrides,
  };
}

// makeRecord — 테스트용 영속 Assessment 레코드 팩토리(좌표 4-field + index signature).
function makeRecord(
  personId: string,
  period: string,
  scope: string,
  periodStart: Date,
  extra: Record<string, unknown> = {},
): PersistedAssessmentRecord {
  return { personId, period, scope, periodStart, ...extra };
}

describe("EvaluationUnevaluatedFillPlanner", () => {
  let readForPersons: jest.Mock;
  let planner: EvaluationUnevaluatedFillPlanner;

  beforeEach(() => {
    readForPersons = jest.fn();
    // reader 의 readForPersons 만 mock — planner 가 쓰는 유일한 surface.
    const readerMock = {
      readForPersons,
    } as unknown as EvaluationPersistedRecordsReader;
    planner = new EvaluationUnevaluatedFillPlanner(readerMock);
  });

  // ---------------------------------------------------------------------------
  // happy-path — reader 출력이 persisted 로 흘러 최종 batch plan 이 산출됨(end-to-end 조립)
  // ---------------------------------------------------------------------------
  describe("happy-path 조립", () => {
    it("2+ person 영속 레코드를 읽어 compose 로 흘려 UnevaluatedFillBatchPlan 을 산출한다", async () => {
      const intended = makeIntended({ personIds: ["p1", "p2"], period: "day" });
      // p1 은 해당 day(2026-01-01 KST anchor)에 이미 평가됨 → gap 에서 제외.
      // p2 는 다른 날짜만 보유 → 해당 day gap 으로 남음.
      const kstDayAnchor = new Date("2025-12-31T15:00:00Z"); // 2026-01-01 KST 00:00 anchor
      const p1Persisted = makeRecord("p1", "day", "commit", kstDayAnchor, {
        id: "a1",
      });
      readForPersons.mockResolvedValueOnce([p1Persisted]);

      const plan = await planner.planUnevaluatedFill(intended);

      // p1 은 이미 평가돼 gap 0, p2 는 미평가 → batch 1 개(p2).
      expect(plan.personCount).toBe(1);
      expect(plan.batches).toHaveLength(1);
      expect(plan.batches[0].personId).toBe("p2");
      expect(plan.totalGapCount).toBe(1);
    });

    it("persisted 가 빈 배열이면 intended 전체가 gap 으로 산출된다", async () => {
      const intended = makeIntended({ personIds: ["p1", "p2"], period: "day" });
      readForPersons.mockResolvedValueOnce([]);

      const plan = await planner.planUnevaluatedFill(intended);

      // 두 person 모두 미평가 → batch 2 개, gap 2 개(person × anchor 1).
      expect(plan.personCount).toBe(2);
      expect(plan.totalGapCount).toBe(2);
      expect(plan.batches.map((b) => b.personId)).toEqual(["p1", "p2"]);
    });
  });

  // ---------------------------------------------------------------------------
  // reader forward 인자 정합 — personIds + period 가 입력에서 파생됨
  // ---------------------------------------------------------------------------
  describe("reader forward 인자", () => {
    it("intended.personIds 와 period 로 readForPersons 를 호출한다", async () => {
      const intended = makeIntended({ personIds: ["x", "y"], period: "week" });
      readForPersons.mockResolvedValueOnce([]);

      await planner.planUnevaluatedFill(intended);

      expect(readForPersons).toHaveBeenCalledTimes(1);
      expect(readForPersons).toHaveBeenCalledWith(["x", "y"], {
        period: "week",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // branch coverage — period 지정 vs 미지정, 빈 personIds
  // ---------------------------------------------------------------------------
  describe("branch — period 지정 / 미지정 / 빈 목록", () => {
    it("period 지정 분기 — options 에 { period } 를 forward 한다", async () => {
      const intended = makeIntended({ period: "month" });
      readForPersons.mockResolvedValueOnce([]);

      await planner.planUnevaluatedFill(intended);

      expect(readForPersons).toHaveBeenCalledWith(intended.personIds, {
        period: "month",
      });
    });

    it("period 미지정(undefined) 분기 — options 를 undefined 로 forward 한다", async () => {
      // period 를 런타임에 undefined 로 강제(방어적 분기 — 타입상 string 이나 source 부재 대비).
      // options 삼항 분기가 undefined 를 택하는지 검증한다. 이후 순수 enumerate 조각이
      // 미지정 period 에 TypeError 를 던지지만(자연 전파), forward 인자 검증은 reader 호출
      // 시점에 이미 박제되므로 throw 를 흡수한 뒤 호출 인자를 단언한다.
      const intended = makeIntended({
        period: undefined as unknown as string,
      });
      readForPersons.mockResolvedValueOnce([]);

      await expect(planner.planUnevaluatedFill(intended)).rejects.toThrow(
        TypeError,
      );

      // period 미지정 분기 → reader 에 options 를 undefined 로 forward.
      expect(readForPersons).toHaveBeenCalledWith(
        intended.personIds,
        undefined,
      );
    });

    it("빈 personIds → reader 빈 배열 → 빈 plan(batch 0, gap 0)", async () => {
      const intended = makeIntended({ personIds: [] });
      readForPersons.mockResolvedValueOnce([]);

      const plan = await planner.planUnevaluatedFill(intended);

      expect(plan.batches).toEqual([]);
      expect(plan.personCount).toBe(0);
      expect(plan.totalGapCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // negative cases 충분 cover (task AC (1)~(5))
  // ---------------------------------------------------------------------------
  describe("negative cases", () => {
    it("(1) intended 가 null 이면 한국어 메시지 TypeError, reader 호출 0", async () => {
      await expect(
        planner.planUnevaluatedFill(
          null as unknown as IntendedPeriodCoordinatesInput,
        ),
      ).rejects.toThrow(TypeError);
      await expect(
        planner.planUnevaluatedFill(
          null as unknown as IntendedPeriodCoordinatesInput,
        ),
      ).rejects.toThrow("intended 가 null/undefined 일 수 없다.");
      expect(readForPersons).not.toHaveBeenCalled();
    });

    it("(1) intended 가 undefined 이면 TypeError, reader 호출 0", async () => {
      await expect(
        planner.planUnevaluatedFill(
          undefined as unknown as IntendedPeriodCoordinatesInput,
        ),
      ).rejects.toThrow("intended 가 null/undefined 일 수 없다.");
      expect(readForPersons).not.toHaveBeenCalled();
    });

    it("(3) reader 가 reject 하면(의존성 실패) 그 rejection 을 그대로 전파한다", async () => {
      const depError = new Error("DB 연결 실패");
      readForPersons.mockRejectedValueOnce(depError);

      await expect(planner.planUnevaluatedFill(makeIntended())).rejects.toBe(
        depError,
      );
    });

    it("(4) 일부 person 만 영속 레코드 보유 — 나머지는 자연히 gap 으로 남는다", async () => {
      const intended = makeIntended({
        personIds: ["p1", "p2", "p3"],
        period: "day",
      });
      const kstDayAnchor = new Date("2025-12-31T15:00:00Z");
      // p2 만 이미 평가됨 → p1, p3 가 gap 으로 남음.
      readForPersons.mockResolvedValueOnce([
        makeRecord("p2", "day", "commit", kstDayAnchor, { id: "b1" }),
      ]);

      const plan = await planner.planUnevaluatedFill(intended);

      expect(plan.batches.map((b) => b.personId)).toEqual(["p1", "p3"]);
      expect(plan.personCount).toBe(2);
    });

    it("(5) intended 필수 field(period) 가 미지원 값이면 순수 조각의 RangeError 가 자연 전파", async () => {
      // reader 는 통과(빈 배열)시키되, enumerate 조각이 미지원 period 에서 RangeError 를
      // 던지도록 한다 — wrapper 는 재던지지 않고 그대로 전파(single-source 방어).
      readForPersons.mockResolvedValueOnce([]);
      const intended = makeIntended({ period: "yearly" });

      await expect(planner.planUnevaluatedFill(intended)).rejects.toThrow();
    });

    it("(5) intended.rangeStart 가 Invalid Date 면 순수 조각의 TypeError 가 자연 전파", async () => {
      readForPersons.mockResolvedValueOnce([]);
      const intended = makeIntended({ rangeStart: new Date("nope") });

      await expect(planner.planUnevaluatedFill(intended)).rejects.toThrow(
        TypeError,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 입력 비변형
  // ---------------------------------------------------------------------------
  describe("입력 비변형", () => {
    it("전달받은 intended 객체를 mutate 하지 않는다", async () => {
      const intended = makeIntended({ personIds: ["p1", "p2"] });
      const snapshot = {
        personIds: [...intended.personIds],
        period: intended.period,
        scope: intended.scope,
        rangeStart: new Date(intended.rangeStart.getTime()),
        rangeEnd: new Date(intended.rangeEnd.getTime()),
      };
      readForPersons.mockResolvedValueOnce([]);

      await planner.planUnevaluatedFill(intended);

      expect(intended.personIds).toEqual(snapshot.personIds);
      expect(intended.period).toBe(snapshot.period);
      expect(intended.scope).toBe(snapshot.scope);
      expect(intended.rangeStart.getTime()).toBe(snapshot.rangeStart.getTime());
      expect(intended.rangeEnd.getTime()).toBe(snapshot.rangeEnd.getTime());
    });
  });
});
