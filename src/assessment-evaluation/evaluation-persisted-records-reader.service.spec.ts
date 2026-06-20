// EvaluationPersistedRecordsReader spec — R-112 4 종(happy / error / flow-branch /
// negative cases 충분 cover) + 입력 비변형 검증. mock 은 AssessmentService 의 findByPerson
// 만 jest.fn() 으로 대체(assessment.service.spec.ts 의 mock 패턴 mirror — 새 helper 추출
// 불요). DB / Prisma 접근 0 — 순수 어댑터 단위 검증.
import type { AssessmentService } from "../user/assessment.service";

import type { PersistedAssessmentRecord } from "./domain/evaluation-persisted-period-coordinates";
import { EvaluationPersistedRecordsReader } from "./evaluation-persisted-records-reader.service";

// makeRecord — 테스트용 영속 Assessment 레코드 팩토리. 좌표 4-field + 추가 컬럼(id/
// difficulty 등)을 함께 보유해 구조적 호환(index signature 흡수)을 함께 검증한다.
function makeRecord(
  personId: string,
  period: string,
  scope: string,
  periodStart: Date,
  extra: Record<string, unknown> = {},
): PersistedAssessmentRecord {
  return { personId, period, scope, periodStart, ...extra };
}

describe("EvaluationPersistedRecordsReader", () => {
  let findByPerson: jest.Mock;
  let reader: EvaluationPersistedRecordsReader;

  beforeEach(() => {
    findByPerson = jest.fn();
    // AssessmentService 의 findByPerson 만 mock — 어댑터가 쓰는 유일한 surface.
    const serviceMock = { findByPerson } as unknown as AssessmentService;
    reader = new EvaluationPersistedRecordsReader(serviceMock);
  });

  // ---------------------------------------------------------------------------
  // happy-path — 2+ person 결과를 입력 순서대로 평탄화
  // ---------------------------------------------------------------------------
  describe("happy-path 평탄화", () => {
    it("2+ person 의 findByPerson 결과를 person 입력 순서대로 평탄화해 반환한다", async () => {
      const d = new Date("2026-01-01T00:00:00Z");
      const p1a = makeRecord("p1", "week", "commit", d, { id: "a1" });
      const p1b = makeRecord("p1", "month", "aggregate", d, { id: "a2" });
      const p2a = makeRecord("p2", "week", "document", d, { id: "b1" });
      findByPerson
        .mockResolvedValueOnce([p1a, p1b]) // p1
        .mockResolvedValueOnce([p2a]); // p2

      const result = await reader.readForPersons(["p1", "p2"]);

      // 총 길이 = 두 person 의 결과 합.
      expect(result).toHaveLength(3);
      // 입력 순서 보존: p1 의 레코드들이 먼저, 그 뒤 p2.
      expect(result).toEqual([p1a, p1b, p2a]);
      expect(findByPerson).toHaveBeenCalledTimes(2);
    });

    it("Assessment row 의 추가 컬럼을 매핑/제거 없이 그대로 element 로 보존한다", async () => {
      const d = new Date("2026-02-02T00:00:00Z");
      const rec = makeRecord("p1", "day", "commit", d, {
        id: "x1",
        difficulty: "hard",
        contributionScore: 2.5,
      });
      findByPerson.mockResolvedValueOnce([rec]);

      const result = await reader.readForPersons(["p1"]);

      // 동일 참조 그대로(매핑/복사 0 — 구조적 호환).
      expect(result[0]).toBe(rec);
      expect(result[0].difficulty).toBe("hard");
    });
  });

  // ---------------------------------------------------------------------------
  // branch coverage — period 옵션 지정 vs 미지정, 빈 목록
  // ---------------------------------------------------------------------------
  describe("branch — period 옵션 / 빈 목록", () => {
    it("period 옵션 지정 시 findByPerson 에 그대로 forward 한다", async () => {
      findByPerson.mockResolvedValue([]);

      await reader.readForPersons(["p1", "p2"], { period: "week" });

      expect(findByPerson).toHaveBeenCalledWith("p1", { period: "week" });
      expect(findByPerson).toHaveBeenCalledWith("p2", { period: "week" });
    });

    it("period 옵션 미지정 시 options 를 undefined 로 forward 한다", async () => {
      findByPerson.mockResolvedValue([]);

      await reader.readForPersons(["p1"]);

      expect(findByPerson).toHaveBeenCalledWith("p1", undefined);
    });

    it("빈 personId 목록 → 빈 배열 반환, findByPerson 호출 0", async () => {
      const result = await reader.readForPersons([]);

      expect(result).toEqual([]);
      expect(findByPerson).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // negative cases 충분 cover (task AC (1)~(6))
  // ---------------------------------------------------------------------------
  describe("negative cases", () => {
    it("(2) 일부 person 만 매칭 row 보유 — 나머지는 빈 배열로 자연 흡수", async () => {
      const d = new Date("2026-03-03T00:00:00Z");
      const p2a = makeRecord("p2", "week", "commit", d, { id: "c1" });
      findByPerson
        .mockResolvedValueOnce([]) // p1: 매칭 0
        .mockResolvedValueOnce([p2a]) // p2: 1 건
        .mockResolvedValueOnce([]); // p3: 매칭 0

      const result = await reader.readForPersons(["p1", "p2", "p3"]);

      expect(result).toEqual([p2a]);
      expect(findByPerson).toHaveBeenCalledTimes(3);
    });

    it("(3) personIds 가 null 이면 한국어 메시지 TypeError, findByPerson 호출 0", async () => {
      await expect(
        reader.readForPersons(null as unknown as string[]),
      ).rejects.toThrow(TypeError);
      await expect(
        reader.readForPersons(null as unknown as string[]),
      ).rejects.toThrow("personIds 배열이 null/undefined 일 수 없다.");
      expect(findByPerson).not.toHaveBeenCalled();
    });

    it("(3) personIds 가 undefined 이면 TypeError", async () => {
      await expect(
        reader.readForPersons(undefined as unknown as string[]),
      ).rejects.toThrow("personIds 배열이 null/undefined 일 수 없다.");
      expect(findByPerson).not.toHaveBeenCalled();
    });

    it("(4) personIds 가 non-array 이면 TypeError, findByPerson 호출 0", async () => {
      await expect(
        reader.readForPersons("p1" as unknown as string[]),
      ).rejects.toThrow("personIds 는 배열이어야 한다");
      expect(findByPerson).not.toHaveBeenCalled();
    });

    it("(5) personIds 원소가 non-string(number)이면 TypeError, findByPerson 호출 0", async () => {
      await expect(
        reader.readForPersons(["p1", 42 as unknown as string]),
      ).rejects.toThrow("personIds 원소는 string 이어야 한다");
      // 검증을 먼저 모두 수행하므로 잘못된 입력에서는 findByPerson 호출 0.
      expect(findByPerson).not.toHaveBeenCalled();
    });

    it("(5) personIds 원소가 null 이면 TypeError", async () => {
      await expect(
        reader.readForPersons(["p1", null as unknown as string]),
      ).rejects.toThrow("personIds 원소는 string 이어야 한다");
      expect(findByPerson).not.toHaveBeenCalled();
    });

    it("(6) findByPerson 이 reject 하면(의존성 실패) 그 rejection 을 그대로 전파한다", async () => {
      const depError = new Error("DB 연결 실패");
      findByPerson.mockRejectedValueOnce(depError);

      await expect(reader.readForPersons(["p1"])).rejects.toBe(depError);
    });

    it("(6) 잘못된 period literal 로 findByPerson 이 throw 하면 그대로 전파", async () => {
      // AssessmentService.findByPerson 은 잘못된 period 에 BadRequestException 을 던진다 —
      // 어댑터는 검증을 중복하지 않고 그 예외를 그대로 전파(single-source).
      const badReq = new Error("invalid period: yearly");
      findByPerson.mockRejectedValueOnce(badReq);

      await expect(
        reader.readForPersons(["p1"], { period: "yearly" }),
      ).rejects.toBe(badReq);
    });
  });

  // ---------------------------------------------------------------------------
  // 입력 비변형
  // ---------------------------------------------------------------------------
  describe("입력 비변형", () => {
    it("전달받은 personIds 배열을 mutate 하지 않는다", async () => {
      findByPerson.mockResolvedValue([]);
      const personIds = ["p1", "p2"];
      const snapshot = [...personIds];

      await reader.readForPersons(personIds);

      expect(personIds).toEqual(snapshot);
      expect(personIds).toHaveLength(2);
    });
  });
});
