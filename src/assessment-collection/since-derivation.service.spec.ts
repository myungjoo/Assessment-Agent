// SinceDerivationService 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). collection slice vi, ADR-0029 Decision §5(직전 Assessment 의
// periodStart 로부터 since 도출, 직전 Assessment 없으면 undefined = full collection,
// 경계값[단일·정렬무관·동일 timestamp·미래]을 negative case 로 cover). AssessmentService 는
// jest mock 으로 주입 — 실 DB·실 repository 0(Q-0025 deferred 정합). 직접 인스턴스화 +
// mock 주입 패턴(collection-persistence.service.spec.ts / assessment.service.spec.ts mirror).

import type { Assessment } from "@prisma/client";

import { AssessmentService } from "../user/assessment.service";

import { SinceDerivationService } from "./since-derivation.service";

// assessment — periodStart(필수) + createdAt(선택, 기본 = periodStart)만 채운 최소
// Assessment fixture. deriveSince 는 periodStart 만 읽으므로 나머지 컬럼은 cast 로 생략한다.
function assessment(periodStart: string, createdAt?: string): Assessment {
  return {
    id: `a-${periodStart}`,
    periodStart: new Date(periodStart),
    createdAt: new Date(createdAt ?? periodStart),
  } as unknown as Assessment;
}

// makeService — AssessmentService.findByPerson 을 jest mock 으로 주입한 service 를 만든다.
function makeService(findImpl: (personId: string) => Promise<Assessment[]>): {
  service: SinceDerivationService;
  findSpy: jest.Mock;
} {
  const findSpy = jest.fn(findImpl);
  const assessmentService = {
    findByPerson: findSpy,
  } as unknown as AssessmentService;
  return {
    service: new SinceDerivationService(assessmentService),
    findSpy,
  };
}

describe("SinceDerivationService", () => {
  describe("happy path (R-112-1)", () => {
    it("여러 Assessment 중 가장 최신 periodStart 의 ISO 문자열을 반환하고 findByPerson 을 personId 로 1회 호출한다", async () => {
      const { service, findSpy } = makeService(async () => [
        assessment("2026-01-01T00:00:00.000Z"),
        assessment("2026-03-01T00:00:00.000Z"),
        assessment("2026-02-01T00:00:00.000Z"),
      ]);

      const since = await service.deriveSince("person-1");

      expect(since).toBe("2026-03-01T00:00:00.000Z");
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith("person-1");
    });
  });

  describe("error path (R-112-2)", () => {
    it("(a) findByPerson 이 reject(의존성 실패)하면 deriveSince 가 그대로 전파한다(잡지 않음)", async () => {
      const { service } = makeService(async () => {
        throw new Error("assessment 조회 실패");
      });

      await expect(service.deriveSince("person-1")).rejects.toThrow(
        "assessment 조회 실패",
      );
    });

    it("(b) 직전 Assessment 부재(빈 배열, 신규 인원)면 undefined 를 반환한다(throw 0, full collection)", async () => {
      const { service } = makeService(async () => []);

      await expect(service.deriveSince("new-person")).resolves.toBeUndefined();
    });
  });

  describe("도출 기준 = periodStart(createdAt 아님) (ADR-0029 §5)", () => {
    it("createdAt 이 더 최신인 row 가 있어도 periodStart 가 가장 큰 row 를 선택한다", async () => {
      const { service } = makeService(async () => [
        // periodStart 최신 / createdAt 과거.
        assessment("2026-06-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
        // periodStart 과거 / createdAt 최신(나중에 영속된 재평가 등).
        assessment("2026-02-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z"),
      ]);

      // createdAt 기준이면 2번째가 뽑히지만, periodStart 기준이라 1번째(2026-06)가 뽑힌다.
      await expect(service.deriveSince("p")).resolves.toBe(
        "2026-06-01T00:00:00.000Z",
      );
    });
  });

  describe("negative / 경계값 충분 cover (R-112-4)", () => {
    it("(c) 단일 Assessment → 그 row 의 periodStart ISO 를 반환한다", async () => {
      const { service } = makeService(async () => [
        assessment("2026-05-15T12:00:00.000Z"),
      ]);

      await expect(service.deriveSince("p")).resolves.toBe(
        "2026-05-15T12:00:00.000Z",
      );
    });

    it("(d) findByPerson 이 정렬 안 된 순서로 반환해도 가장 큰 periodStart 를 선택한다(입력 순서 무관)", async () => {
      const { service } = makeService(async () => [
        assessment("2026-04-10T00:00:00.000Z"),
        assessment("2026-06-01T00:00:00.000Z"), // 최신 — 중간 위치
        assessment("2026-01-20T00:00:00.000Z"),
      ]);

      await expect(service.deriveSince("p")).resolves.toBe(
        "2026-06-01T00:00:00.000Z",
      );
    });

    it("(e) 동일 periodStart 가 복수 row → 그 timestamp 를 반환한다(중복 경계, throw 0)", async () => {
      const ts = "2026-03-03T03:03:03.000Z";
      const { service } = makeService(async () => [
        assessment(ts),
        assessment(ts),
      ]);

      await expect(service.deriveSince("p")).resolves.toBe(ts);
    });

    it("(f) 반환값이 유효한 ISO-8601 문자열이다(Date.toISOString round-trip)", async () => {
      const { service } = makeService(async () => [
        assessment("2026-02-28T23:59:59.000Z"),
      ]);

      const since = await service.deriveSince("p");

      expect(since).toBeDefined();
      // round-trip: 파싱 후 다시 ISO 로 변환해도 동일 → 유효 ISO-8601.
      expect(new Date(since as string).toISOString()).toBe(since);
    });

    it("(g) periodStart 가 미래 timestamp 여도(시계 오차/선예약 등) 시간 상대 로직 없이 그대로 최신으로 선택·반환한다", async () => {
      // ADR-0029 §5 가 명시한 '미래 timestamp' 경계 — deriveSince 는 now 대비 비교가
      // 없는 순수 max-selection 이므로 미래 periodStart 도 일반 timestamp 처럼 선택된다.
      const { service } = makeService(async () => [
        assessment("2026-06-01T00:00:00.000Z"),
        assessment("2099-12-31T00:00:00.000Z"),
      ]);

      await expect(service.deriveSince("p")).resolves.toBe(
        "2099-12-31T00:00:00.000Z",
      );
    });
  });
});
