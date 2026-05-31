// SummaryService spec — T-0116 acceptance (R-112: happy / error / branch / negative
// 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 SummaryRepository 를 Jest mock 으로 대체하여 PostgreSQL container 없이
// isolated 하게 실행 (contribution.service.spec.ts 의 mock 패턴 mirror). 검증 포인트:
//   - 4 메서드 (create / findById / findByPerson / remove) 의 happy path 각 1+ test.
//   - Prisma error code (P2003 / P2025) + null 반환의 NestJS exception 변환
//     (BadRequestException / NotFoundException) 각 1+ test.
//   - literal 검증 분기 (period 1종) 의 negative test — 허용 집합 밖 값 →
//     BadRequestException. 특히 정정된 결함 literal (`"daily"` / `"weekly"` /
//     `"monthly"`) 이 reject 되는지 명시 (copy-paste 버그 regression 차단).
//   - findByPerson 의 options?.period 2 분기 (주어짐 → 검증 후 forward / undefined →
//     검증 skip 후 전체 forward) + 컬렉션 결과 (다수 vs 빈 배열) 분기.
//   - unknown error code 의 re-throw (변환 안 함) + P2002 (또는 기타 known code) 가
//     본 service 에서 변환되지 않고 그대로 re-throw 됨 (Summary 는 @@unique 부재)
//     + raw 미저장 forward guard (R-59).
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Summary } from "@prisma/client";

import type {
  SummaryCreateInput,
  SummaryRepository,
} from "./summary.repository";
import { SummaryService } from "./summary.service";

// Summary fixture — 7 컬럼 (schema.prisma L285–299) 를 모두 채운 default row.
// metricScore 는 Decimal 컬럼이나 spec 에서는 plain number 로 충분 (mock 이 Prisma
// 변환을 거치지 않으므로).
function buildSummaryFixture(overrides: Partial<Summary> = {}): Summary {
  return {
    id: "cuid-default",
    personId: "person-1",
    period: "week",
    periodStart: new Date("2026-01-05T00:00:00.000Z"),
    narrative: "주간 활동 요약 평가문",
    metricScore: 0.82 as unknown as Summary["metricScore"],
    createdAt: new Date("2026-01-12T00:00:00.000Z"),
    ...overrides,
  };
}

// 유효한 create input — period 가 허용 집합 내. negative test 가 override 로 literal 을
// 깬다.
function buildCreateInput(
  overrides: Partial<SummaryCreateInput> = {},
): SummaryCreateInput {
  return {
    personId: "person-1",
    period: "week",
    periodStart: new Date("2026-01-05T00:00:00.000Z"),
    narrative: "주간 활동 요약 평가문",
    metricScore: 0.82,
    ...overrides,
  };
}

// SummaryRepository mock factory — 4 메서드 모두 jest.fn() 으로 대체.
function buildRepositoryMock(): {
  repository: SummaryRepository;
  repoMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByPerson: jest.Mock;
    delete: jest.Mock;
  };
} {
  const repoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findByPerson: jest.fn(),
    delete: jest.fn(),
  };
  return {
    repository: repoMock as unknown as SummaryRepository,
    repoMock,
  };
}

// Prisma known error helper — service.spec 패턴 (contribution.service.spec.ts 동일).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("SummaryService", () => {
  // -----------------------------------------------------------------------
  // create — happy / literal 검증 negative (period, 결함 literal 포함) / P2003 →
  // BadRequestException / P2002·unknown error re-throw / raw 미저장 forward guard
  // -----------------------------------------------------------------------
  describe("create()", () => {
    it("유효 period input 을 SummaryRepository.create 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = buildSummaryFixture({ id: "new-id" });
      repoMock.create.mockResolvedValueOnce(fixture);

      const service = new SummaryService(repository);
      const input = buildCreateInput();
      const result = await service.create(input);

      expect(repoMock.create).toHaveBeenCalledWith(input);
      expect(result).toBe(fixture);
    });

    it("literal 검증 통과 분기 — period=day 의 허용 조합도 통과해야 한다 (flow/branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildSummaryFixture());

      const service = new SummaryService(repository);
      await service.create(buildCreateInput({ period: "day" }));

      expect(repoMock.create).toHaveBeenCalledTimes(1);
    });

    it("period=month 의 또 다른 허용 조합도 통과한다 (flow/branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildSummaryFixture());

      const service = new SummaryService(repository);
      await service.create(buildCreateInput({ period: "month" }));

      expect(repoMock.create).toHaveBeenCalledTimes(1);
    });

    it("period 가 허용 집합 밖 (year) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new SummaryService(repository);
      await expect(
        service.create(buildCreateInput({ period: "year" })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    // copy-paste 버그 regression 차단 — summary.repository.ts 주석이 잘못 기술하던 결함
    // literal (`"daily"` / `"weekly"` / `"monthly"`) 이 모두 reject 되는지 명시 검증.
    // canonical 은 `"day"` / `"week"` / `"month"` (ADR-0006 L85).
    it.each(["daily", "weekly", "monthly"])(
      "결함 literal %s (canonical 은 day/week/month) 는 BadRequestException — repository 미호출 (negative regression)",
      async (defectPeriod) => {
        const { repository, repoMock } = buildRepositoryMock();

        const service = new SummaryService(repository);
        await expect(
          service.create(buildCreateInput({ period: defectPeriod })),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repoMock.create).not.toHaveBeenCalled();
      },
    );

    it("빈 문자열 period 도 허용 집합 밖이므로 BadRequestException (negative 경계값)", async () => {
      const { repository } = buildRepositoryMock();

      const service = new SummaryService(repository);
      await expect(
        service.create(buildCreateInput({ period: "" })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("P2003 (FK constraint — personId 미존재) 를 BadRequestException 으로 변환한다 (error/negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockRejectedValueOnce(buildPrismaError("P2003"));

      const service = new SummaryService(repository);
      await expect(
        service.create(buildCreateInput({ personId: "missing-fk" })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("P2002 (unique constraint) 를 받아도 본 service 는 변환하지 않고 그대로 re-throw 한다 — Summary 는 @@unique 부재 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const p2002 = buildPrismaError("P2002");
      repoMock.create.mockRejectedValueOnce(p2002);

      const service = new SummaryService(repository);
      // ConflictException 으로 변환하지 않고 원본 error 를 그대로 re-throw.
      await expect(service.create(buildCreateInput())).rejects.toBe(p2002);
    });

    it("P2003 가 아닌 unknown error code (P9999) 는 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const unknownError = buildPrismaError("P9999", "unknown");
      repoMock.create.mockRejectedValueOnce(unknownError);

      const service = new SummaryService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBe(
        unknownError,
      );
    });

    it("code field 가 없는 error 도 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const plainError = new Error("network-down");
      repoMock.create.mockRejectedValueOnce(plainError);

      const service = new SummaryService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBe(plainError);
    });

    it("raw 미저장 (R-59) — create 가 SummaryCreateInput 의 키 집합만 forward 하며 raw 키를 주입하지 않는다 (forward guard)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildSummaryFixture());

      const service = new SummaryService(repository);
      const input = buildCreateInput();
      await service.create(input);

      const forwardedArg = repoMock.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      // forward 된 키 집합이 SummaryCreateInput 의 5 키와 정확히 일치 — service 가
      // rawBody / diff / content 등 raw 컬럼 키를 주입하지 않음을 runtime assert.
      expect(Object.keys(forwardedArg).sort()).toEqual(
        [
          "metricScore",
          "narrative",
          "period",
          "periodStart",
          "personId",
        ].sort(),
      );
      expect("rawBody" in forwardedArg).toBe(false);
      expect("diff" in forwardedArg).toBe(false);
      expect("content" in forwardedArg).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // findById — happy / null → NotFoundException
  // -----------------------------------------------------------------------
  describe("findById()", () => {
    it("row 존재 시 그대로 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = buildSummaryFixture({ id: "abc" });
      repoMock.findById.mockResolvedValueOnce(fixture);

      const service = new SummaryService(repository);
      const result = await service.findById("abc");

      expect(repoMock.findById).toHaveBeenCalledWith("abc");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new SummaryService(repository);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("empty string id 도 그대로 forward 하며 null 분기는 NotFoundException (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new SummaryService(repository);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repoMock.findById).toHaveBeenCalledWith("");
    });
  });

  // -----------------------------------------------------------------------
  // findByPerson — options?.period 2 분기 + 컬렉션 결과 (다수 vs 빈 배열) 분기 +
  // period literal negative
  // -----------------------------------------------------------------------
  describe("findByPerson()", () => {
    it("period 주어짐 — literal 검증 후 options 와 함께 forward 하고 결과를 반환한다 (happy + branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = [
        buildSummaryFixture(),
        buildSummaryFixture({
          id: "id-2",
          periodStart: new Date("2026-01-19T00:00:00.000Z"),
        }),
      ];
      repoMock.findByPerson.mockResolvedValueOnce(fixture);

      const service = new SummaryService(repository);
      const result = await service.findByPerson("person-1", { period: "week" });

      expect(repoMock.findByPerson).toHaveBeenCalledWith("person-1", {
        period: "week",
      });
      expect(result).toBe(fixture);
    });

    it("period undefined — literal 검증 skip 후 전체 period 를 그대로 forward 한다 (branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = [buildSummaryFixture()];
      repoMock.findByPerson.mockResolvedValueOnce(fixture);

      const service = new SummaryService(repository);
      // options 자체를 생략 — undefined 분기.
      const result = await service.findByPerson("person-1");

      expect(repoMock.findByPerson).toHaveBeenCalledWith("person-1", undefined);
      expect(result).toBe(fixture);
    });

    it("매칭 row 0 시 빈 배열 [] 을 그대로 반환한다 (NotFoundException 던지지 않음) (branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findByPerson.mockResolvedValueOnce([]);

      const service = new SummaryService(repository);
      const result = await service.findByPerson("person-empty");

      expect(result).toEqual([]);
    });

    it("options.period 가 허용 집합 밖 (daily) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new SummaryService(repository);
      await expect(
        service.findByPerson("person-1", { period: "daily" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.findByPerson).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // remove (hard delete) — happy / P2025 → NotFoundException / unknown re-throw
  // -----------------------------------------------------------------------
  describe("remove()", () => {
    it("SummaryRepository.delete 를 호출한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.delete.mockResolvedValueOnce(undefined);

      const service = new SummaryService(repository);
      await service.remove("id-x");

      expect(repoMock.delete).toHaveBeenCalledWith("id-x");
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error/negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new SummaryService(repository);
      await expect(service.remove("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("P2025 가 아닌 unknown error 는 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const unknownError = new Error("cascade-fail");
      repoMock.delete.mockRejectedValueOnce(unknownError);

      const service = new SummaryService(repository);
      await expect(service.remove("id-y")).rejects.toBe(unknownError);
    });
  });
});
