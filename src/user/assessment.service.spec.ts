// AssessmentService spec — T-0114 acceptance (R-112: happy / error / branch / negative
// 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 AssessmentRepository 를 Jest mock 으로 대체하여 PostgreSQL container 없이
// isolated 하게 실행 (person.service.spec.ts 의 mock 패턴 mirror). 검증 포인트:
//   - 4 메서드 (create / findById / findByPerson / remove) 의 happy path 각 1+ test.
//   - Prisma error code (P2002 / P2025) + null 반환의 NestJS exception 변환
//     (ConflictException / NotFoundException) 각 1+ test.
//   - literal 검증 분기 (period 3종 / scope 3종 / difficulty 3종) 마다 negative test
//     — 허용 집합 밖 값 → BadRequestException.
//   - findByPerson 의 options.period 분기 (지정 vs 미지정) + literal 검증 forward.
//   - unknown error code 의 re-throw (변환 안 함) + raw 미저장 forward guard (R-59).
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { Assessment } from "@prisma/client";

import type {
  AssessmentCreateInput,
  AssessmentRepository,
} from "./assessment.repository";
import { AssessmentService } from "./assessment.service";

// Assessment fixture — 10 컬럼 (schema.prisma §224) 를 모두 채운 default row.
// contributionScore 는 Decimal 컬럼이나 spec 에서는 plain number 로 충분 (mock 이
// Prisma 변환을 거치지 않으므로).
function buildAssessmentFixture(
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    id: "cuid-default",
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    difficulty: "medium",
    contributionScore: 0.75 as unknown as Assessment["contributionScore"],
    volume: 42,
    narrative: "주간 commit 기여 정량/정성 평가문",
    createdAt: new Date("2026-01-08T00:00:00.000Z"),
    ...overrides,
  };
}

// 유효한 create input — literal 3종 모두 허용 집합 내. negative test 가 override 로
// 개별 literal 을 깬다.
function buildCreateInput(
  overrides: Partial<AssessmentCreateInput> = {},
): AssessmentCreateInput {
  return {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    difficulty: "medium",
    contributionScore: 0.75,
    volume: 42,
    narrative: "주간 commit 기여 정량/정성 평가문",
    ...overrides,
  };
}

// AssessmentRepository mock factory — 4 메서드 모두 jest.fn() 으로 대체.
function buildRepositoryMock(): {
  repository: AssessmentRepository;
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
    repository: repoMock as unknown as AssessmentRepository,
    repoMock,
  };
}

// Prisma known error helper — service.spec 패턴 (person.service.spec.ts §75 동일).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("AssessmentService", () => {
  // -----------------------------------------------------------------------
  // create — happy / literal 검증 negative (period/scope/difficulty) / P2002 /
  // unknown error re-throw / raw 미저장 forward guard
  // -----------------------------------------------------------------------
  describe("create()", () => {
    it("유효 literal input 을 AssessmentRepository.create 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = buildAssessmentFixture({ id: "new-id" });
      repoMock.create.mockResolvedValueOnce(fixture);

      const service = new AssessmentService(repository);
      const input = buildCreateInput();
      const result = await service.create(input);

      expect(repoMock.create).toHaveBeenCalledWith(input);
      expect(result).toBe(fixture);
    });

    it("literal 검증 통과 분기 — period/scope/difficulty 모두 허용 집합 내면 정상 흐름 (flow/branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildAssessmentFixture());

      const service = new AssessmentService(repository);
      // period=day / scope=aggregate / difficulty=hard 의 다른 허용 조합도 통과해야 함.
      await service.create(
        buildCreateInput({
          period: "day",
          scope: "aggregate",
          difficulty: "hard",
        }),
      );

      expect(repoMock.create).toHaveBeenCalledTimes(1);
    });

    it("period 가 허용 집합 밖 (yearly) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new AssessmentService(repository);
      await expect(
        service.create(buildCreateInput({ period: "yearly" })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    it("scope 가 허용 집합 밖 (merge) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new AssessmentService(repository);
      await expect(
        service.create(buildCreateInput({ scope: "merge" })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    it("difficulty 가 허용 집합 밖 (trivial) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new AssessmentService(repository);
      await expect(
        service.create(buildCreateInput({ difficulty: "trivial" })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    it("빈 문자열 period 도 허용 집합 밖이므로 BadRequestException (negative 경계값)", async () => {
      const { repository } = buildRepositoryMock();

      const service = new AssessmentService(repository);
      await expect(
        service.create(buildCreateInput({ period: "" })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("P2002 (unique constraint) 를 ConflictException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      const service = new AssessmentService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("P2002 가 아닌 unknown error code (P9999) 는 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const unknownError = buildPrismaError("P9999", "unknown");
      repoMock.create.mockRejectedValueOnce(unknownError);

      const service = new AssessmentService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBe(
        unknownError,
      );
    });

    it("code field 가 없는 error 도 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const plainError = new Error("network-down");
      repoMock.create.mockRejectedValueOnce(plainError);

      const service = new AssessmentService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBe(plainError);
    });

    it("raw 미저장 (R-59) — create 가 AssessmentCreateInput 의 키 집합만 forward 하며 raw 키를 주입하지 않는다 (forward guard)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildAssessmentFixture());

      const service = new AssessmentService(repository);
      const input = buildCreateInput();
      await service.create(input);

      const forwardedArg = repoMock.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      // forward 된 키 집합이 AssessmentCreateInput 의 8 키와 정확히 일치 — service 가
      // rawBody / diff / content 등 raw 컬럼 키를 주입하지 않음을 runtime assert.
      expect(Object.keys(forwardedArg).sort()).toEqual(
        [
          "contributionScore",
          "difficulty",
          "narrative",
          "period",
          "periodStart",
          "personId",
          "scope",
          "volume",
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
      const fixture = buildAssessmentFixture({ id: "abc" });
      repoMock.findById.mockResolvedValueOnce(fixture);

      const service = new AssessmentService(repository);
      const result = await service.findById("abc");

      expect(repoMock.findById).toHaveBeenCalledWith("abc");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new AssessmentService(repository);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("empty string id 도 그대로 forward 하며 null 분기는 NotFoundException (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new AssessmentService(repository);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repoMock.findById).toHaveBeenCalledWith("");
    });
  });

  // -----------------------------------------------------------------------
  // findByPerson — options.period 분기 (지정/미지정) + literal 검증 + 빈 배열
  // -----------------------------------------------------------------------
  describe("findByPerson()", () => {
    it("options 미지정 시 personId 만 forward 하고 결과 배열을 반환한다 (happy + branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = [
        buildAssessmentFixture(),
        buildAssessmentFixture({ id: "id-2" }),
      ];
      repoMock.findByPerson.mockResolvedValueOnce(fixture);

      const service = new AssessmentService(repository);
      const result = await service.findByPerson("person-1");

      expect(repoMock.findByPerson).toHaveBeenCalledWith("person-1", undefined);
      expect(result).toBe(fixture);
    });

    it("options.period 지정 (유효 literal) 시 검증 통과 후 options 를 forward 한다 (happy + branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = [buildAssessmentFixture({ period: "month" })];
      repoMock.findByPerson.mockResolvedValueOnce(fixture);

      const service = new AssessmentService(repository);
      const result = await service.findByPerson("person-1", {
        period: "month",
      });

      expect(repoMock.findByPerson).toHaveBeenCalledWith("person-1", {
        period: "month",
      });
      expect(result).toBe(fixture);
    });

    it("매칭 row 0 시 빈 배열 [] 을 그대로 반환한다 (NotFoundException 던지지 않음) (branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findByPerson.mockResolvedValueOnce([]);

      const service = new AssessmentService(repository);
      const result = await service.findByPerson("person-empty");

      expect(result).toEqual([]);
    });

    it("options.period 가 허용 집합 밖 (decade) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new AssessmentService(repository);
      await expect(
        service.findByPerson("person-1", { period: "decade" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.findByPerson).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // remove (hard delete) — happy / P2025 → NotFoundException / unknown re-throw
  // -----------------------------------------------------------------------
  describe("remove()", () => {
    it("AssessmentRepository.delete 를 호출한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.delete.mockResolvedValueOnce(undefined);

      const service = new AssessmentService(repository);
      await service.remove("id-x");

      expect(repoMock.delete).toHaveBeenCalledWith("id-x");
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new AssessmentService(repository);
      await expect(service.remove("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("P2025 가 아닌 unknown error 는 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const unknownError = new Error("cascade-fail");
      repoMock.delete.mockRejectedValueOnce(unknownError);

      const service = new AssessmentService(repository);
      await expect(service.remove("id-y")).rejects.toBe(unknownError);
    });
  });
});
