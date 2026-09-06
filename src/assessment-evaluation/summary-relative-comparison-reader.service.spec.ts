// SummaryRelativeComparisonReader spec — R-112 4 종(happy / error / 분기별 / negative
// cases). mock 은 SummaryService 의 findByCoordinate 만 jest.fn() 으로 대체한다
// (evaluation-persisted-records-reader.service.spec.ts 의 mock 패턴 mirror). DB /
// Prisma 접근 0 — 얇은 read-adapter 의 단위 검증.
import { BadRequestException } from "@nestjs/common";
import type { Summary } from "@prisma/client";

import type { SummaryService } from "../user/summary.service";

import { SummaryRelativeComparisonReader } from "./summary-relative-comparison-reader.service";

// makeRow — 테스트용 Summary row 팩토리. metricScore 는 Decimal / number / string /
// 그 외 어떤 형태든 넣어 adapter 의 매핑 분기를 찌를 수 있게 unknown 으로 받는다.
function makeRow(personId: string, metricScore: unknown): Summary {
  return {
    id: `s-${personId}`,
    personId,
    period: "week",
    periodStart: new Date("2026-01-05T00:00:00Z"),
    metricScore,
    narrative: null,
  } as unknown as Summary;
}

// makeDecimal — Prisma `Decimal` 유사 객체(toNumber() 보유). 실제 Decimal 을 끌어오지
// 않고 duck-typing 계약만 재현한다.
function makeDecimal(value: number): unknown {
  return { toNumber: () => value };
}

describe("SummaryRelativeComparisonReader", () => {
  const period = "week";
  const periodStart = new Date("2026-01-05T00:00:00Z");
  let findByCoordinate: jest.Mock;
  let reader: SummaryRelativeComparisonReader;

  beforeEach(() => {
    findByCoordinate = jest.fn();
    const serviceMock = { findByCoordinate } as unknown as SummaryService;
    reader = new SummaryRelativeComparisonReader(serviceMock);
  });

  // happy-path — public symbol readForCoordinate 1+
  describe("happy-path 상대 비교 산출", () => {
    it("person 3 명 좌표를 rank 오름차순 산출로 축약하고 findByCoordinate 를 인자 그대로 1 회 호출한다", async () => {
      findByCoordinate.mockResolvedValue([
        makeRow("p1", makeDecimal(10)),
        makeRow("p2", makeDecimal(30)),
        makeRow("p3", makeDecimal(20)),
      ]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.cohortSize).toBe(3);
      expect(result.mean).toBe(20);
      // rank 오름차순(= 점수 내림차순): p2(30) → p3(20) → p1(10).
      expect(result.byPerson.map((e) => e.personId)).toEqual([
        "p2",
        "p3",
        "p1",
      ]);
      expect(result.byPerson.map((e) => e.rank)).toEqual([1, 2, 3]);
      // 최상위는 자신보다 낮은 2 명 / 3 × 100, 최하위는 0.
      expect(result.byPerson[0].percentile).toBeCloseTo(66.666667, 5);
      expect(result.byPerson[2].percentile).toBe(0);
      expect(findByCoordinate).toHaveBeenCalledTimes(1);
      expect(findByCoordinate).toHaveBeenCalledWith(period, periodStart);
    });
  });

  // error path — 상류 · helper 예외의 무변환 전파
  describe("error path 전파", () => {
    it("findByCoordinate 의 BadRequestException 을 변환 없이 전파한다", async () => {
      const failure = new BadRequestException("invalid period: yearly");
      findByCoordinate.mockRejectedValue(failure);
      await expect(
        reader.readForCoordinate("yearly", periodStart),
      ).rejects.toBe(failure);
    });

    it("일반 rejection(의존성 실패)도 그대로 전파한다", async () => {
      const failure = new Error("db unavailable");
      findByCoordinate.mockRejectedValue(failure);
      await expect(reader.readForCoordinate(period, periodStart)).rejects.toBe(
        failure,
      );
    });

    it("같은 personId 가 2 행 섞이면 helper 의 TypeError 가 그대로 전파된다", async () => {
      findByCoordinate.mockResolvedValue([
        makeRow("p1", makeDecimal(10)),
        makeRow("p1", makeDecimal(20)),
      ]);
      await expect(
        reader.readForCoordinate(period, periodStart),
      ).rejects.toThrow(TypeError);
      await expect(
        reader.readForCoordinate(period, periodStart),
      ).rejects.toThrow("personId 가 중복되었습니다");
    });
  });

  // 분기별 — toEntryScore 4 분기 각 1+
  describe("toEntryScore 매핑 분기", () => {
    it("① plain number 는 그대로 실린다", async () => {
      findByCoordinate.mockResolvedValue([makeRow("p1", 4.5)]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.byPerson[0].metricScore).toBe(4.5);
    });

    it("② toNumber() 를 가진 Decimal 유사 객체는 toNumber() 결과가 실린다", async () => {
      findByCoordinate.mockResolvedValue([makeRow("p1", makeDecimal(7.25))]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.byPerson[0].metricScore).toBe(7.25);
    });

    it('③ 문자열 "1.5" 는 Number 변환돼 실린다', async () => {
      findByCoordinate.mockResolvedValue([makeRow("p1", "1.5")]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.byPerson[0].metricScore).toBe(1.5);
    });

    it("④ null / undefined / boolean 은 helper 의 0 절하로 귀결된다", async () => {
      findByCoordinate.mockResolvedValue([
        makeRow("p1", null),
        makeRow("p2", undefined),
        makeRow("p3", true),
      ]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.byPerson.every((e) => e.metricScore === 0)).toBe(true);
      expect(result.mean).toBe(0);
    });
  });

  // negative cases — 예외 분기마다 1+ (task AC ①~⑤)
  describe("negative cases", () => {
    it("① 빈 좌표는 throw 0 으로 cohortSize 0 산출을 반환한다", async () => {
      findByCoordinate.mockResolvedValue([]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result).toEqual({ cohortSize: 0, mean: 0, byPerson: [] });
    });

    it("② adapter 는 period / periodStart 를 자체 검증하지 않고 그대로 forward 한다", async () => {
      findByCoordinate.mockResolvedValue([]);
      const invalidStart = new Date("invalid");
      await reader.readForCoordinate("quarter", invalidStart);
      // 허용 집합 밖 literal · Invalid Date 여도 adapter 가 조기 차단하지 않는다
      // (단일 검증 출처 = SummaryService — layer 경계 단언).
      expect(findByCoordinate).toHaveBeenCalledWith("quarter", invalidStart);
    });

    it("③ 비유한 metricScore(NaN / Infinity)는 0 으로 절하돼 산출에 실린다", async () => {
      findByCoordinate.mockResolvedValue([
        makeRow("p1", Number.NaN),
        makeRow("p2", Number.POSITIVE_INFINITY),
        makeRow("p3", makeDecimal(6)),
      ]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.byPerson[0]).toMatchObject({ personId: "p3", rank: 1 });
      expect(result.byPerson[1].metricScore).toBe(0);
      expect(result.byPerson[2].metricScore).toBe(0);
      expect(result.mean).toBe(2);
    });

    it("④ 반환 row 배열 · 원소를 mutate 하지 않는다", async () => {
      const rows = [makeRow("p1", makeDecimal(3)), makeRow("p2", 5)];
      const snapshot = rows.map((row) => ({ ...row }));
      findByCoordinate.mockResolvedValue(rows);
      await reader.readForCoordinate(period, periodStart);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => ({ ...row }))).toEqual(snapshot);
    });

    it("⑤ 전원 동점이면 rank 가 전부 1 이고 반환 순서를 보존한다", async () => {
      findByCoordinate.mockResolvedValue([
        makeRow("pa", makeDecimal(2)),
        makeRow("pb", makeDecimal(2)),
        makeRow("pc", makeDecimal(2)),
      ]);
      const result = await reader.readForCoordinate(period, periodStart);
      expect(result.byPerson.map((e) => e.rank)).toEqual([1, 1, 1]);
      expect(result.byPerson.map((e) => e.percentile)).toEqual([0, 0, 0]);
      expect(result.byPerson.map((e) => e.personId)).toEqual([
        "pa",
        "pb",
        "pc",
      ]);
    });
  });
});
