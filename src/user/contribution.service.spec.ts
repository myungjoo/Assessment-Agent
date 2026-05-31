// ContributionService spec — T-0115 acceptance (R-112: happy / error / branch / negative
// 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 ContributionRepository 를 Jest mock 으로 대체하여 PostgreSQL container 없이
// isolated 하게 실행 (assessment.service.spec.ts 의 mock 패턴 mirror). 검증 포인트:
//   - 4 메서드 (create / findById / findByAssessment / remove) 의 happy path 각 1+ test.
//   - Prisma error code (P2003 / P2025) + null 반환의 NestJS exception 변환
//     (BadRequestException / NotFoundException) 각 1+ test.
//   - literal 검증 분기 (sourceType 3종 / difficulty 3종) 마다 negative test
//     — 허용 집합 밖 값 → BadRequestException.
//   - findByAssessment 의 컬렉션 결과 (다수 vs 빈 배열) 분기.
//   - unknown error code 의 re-throw (변환 안 함) + P2002 (또는 기타 known code) 가
//     본 service 에서 변환되지 않고 그대로 re-throw 됨 (Contribution 은 @@unique 부재)
//     + raw 미저장 forward guard (R-59).
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Contribution } from "@prisma/client";

import type {
  ContributionCreateInput,
  ContributionRepository,
} from "./contribution.repository";
import { ContributionService } from "./contribution.service";

// Contribution fixture — 8 컬럼 (schema.prisma §259) 를 모두 채운 default row.
// contributionScore 는 Decimal 컬럼이나 spec 에서는 plain number 로 충분 (mock 이
// Prisma 변환을 거치지 않으므로).
function buildContributionFixture(
  overrides: Partial<Contribution> = {},
): Contribution {
  return {
    id: "cuid-default",
    assessmentId: "assessment-1",
    sourceType: "commit",
    sourceUrl: "https://github.com/org/repo/commit/abc123",
    sourceRef: "abc123",
    difficulty: "medium",
    contributionScore: 0.75 as unknown as Contribution["contributionScore"],
    volume: 42,
    createdAt: new Date("2026-01-08T00:00:00.000Z"),
    ...overrides,
  };
}

// 유효한 create input — literal 2종 모두 허용 집합 내. negative test 가 override 로
// 개별 literal 을 깬다.
function buildCreateInput(
  overrides: Partial<ContributionCreateInput> = {},
): ContributionCreateInput {
  return {
    assessmentId: "assessment-1",
    sourceType: "commit",
    sourceUrl: "https://github.com/org/repo/commit/abc123",
    sourceRef: "abc123",
    difficulty: "medium",
    contributionScore: 0.75,
    volume: 42,
    ...overrides,
  };
}

// ContributionRepository mock factory — 4 메서드 모두 jest.fn() 으로 대체.
function buildRepositoryMock(): {
  repository: ContributionRepository;
  repoMock: {
    create: jest.Mock;
    findById: jest.Mock;
    findByAssessment: jest.Mock;
    delete: jest.Mock;
  };
} {
  const repoMock = {
    create: jest.fn(),
    findById: jest.fn(),
    findByAssessment: jest.fn(),
    delete: jest.fn(),
  };
  return {
    repository: repoMock as unknown as ContributionRepository,
    repoMock,
  };
}

// Prisma known error helper — service.spec 패턴 (assessment.service.spec.ts §88 동일).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

describe("ContributionService", () => {
  // -----------------------------------------------------------------------
  // create — happy / literal 검증 negative (sourceType/difficulty) / P2003 →
  // BadRequestException / P2002·unknown error re-throw / raw 미저장 forward guard
  // -----------------------------------------------------------------------
  describe("create()", () => {
    it("유효 literal input 을 ContributionRepository.create 에 forward 하고 결과를 반환한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = buildContributionFixture({ id: "new-id" });
      repoMock.create.mockResolvedValueOnce(fixture);

      const service = new ContributionService(repository);
      const input = buildCreateInput();
      const result = await service.create(input);

      expect(repoMock.create).toHaveBeenCalledWith(input);
      expect(result).toBe(fixture);
    });

    it("literal 검증 통과 분기 — sourceType/difficulty 모두 허용 집합 내면 정상 흐름 (flow/branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildContributionFixture());

      const service = new ContributionService(repository);
      // sourceType=document / difficulty=hard 의 다른 허용 조합도 통과해야 함.
      await service.create(
        buildCreateInput({ sourceType: "document", difficulty: "hard" }),
      );

      expect(repoMock.create).toHaveBeenCalledTimes(1);
    });

    it("sourceType=pr / difficulty=easy 의 또 다른 허용 조합도 통과한다 (flow/branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildContributionFixture());

      const service = new ContributionService(repository);
      await service.create(
        buildCreateInput({ sourceType: "pr", difficulty: "easy" }),
      );

      expect(repoMock.create).toHaveBeenCalledTimes(1);
    });

    it("sourceType 가 허용 집합 밖 (issue) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new ContributionService(repository);
      await expect(
        service.create(buildCreateInput({ sourceType: "issue" })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    it("difficulty 가 허용 집합 밖 (trivial) 이면 BadRequestException — repository 미호출 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();

      const service = new ContributionService(repository);
      await expect(
        service.create(buildCreateInput({ difficulty: "trivial" })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    it("빈 문자열 sourceType 도 허용 집합 밖이므로 BadRequestException (negative 경계값)", async () => {
      const { repository } = buildRepositoryMock();

      const service = new ContributionService(repository);
      await expect(
        service.create(buildCreateInput({ sourceType: "" })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("P2003 (FK constraint — assessmentId 미존재) 를 BadRequestException 으로 변환한다 (error/negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockRejectedValueOnce(buildPrismaError("P2003"));

      const service = new ContributionService(repository);
      await expect(
        service.create(buildCreateInput({ assessmentId: "missing-fk" })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("P2002 (unique constraint) 를 받아도 본 service 는 변환하지 않고 그대로 re-throw 한다 — Contribution 은 @@unique 부재 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const p2002 = buildPrismaError("P2002");
      repoMock.create.mockRejectedValueOnce(p2002);

      const service = new ContributionService(repository);
      // ConflictException 으로 변환하지 않고 원본 error 를 그대로 re-throw.
      await expect(service.create(buildCreateInput())).rejects.toBe(p2002);
    });

    it("P2003 가 아닌 unknown error code (P9999) 는 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const unknownError = buildPrismaError("P9999", "unknown");
      repoMock.create.mockRejectedValueOnce(unknownError);

      const service = new ContributionService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBe(
        unknownError,
      );
    });

    it("code field 가 없는 error 도 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const plainError = new Error("network-down");
      repoMock.create.mockRejectedValueOnce(plainError);

      const service = new ContributionService(repository);
      await expect(service.create(buildCreateInput())).rejects.toBe(plainError);
    });

    it("raw 미저장 (R-59) — create 가 ContributionCreateInput 의 키 집합만 forward 하며 raw 키를 주입하지 않는다 (forward guard)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.create.mockResolvedValueOnce(buildContributionFixture());

      const service = new ContributionService(repository);
      const input = buildCreateInput();
      await service.create(input);

      const forwardedArg = repoMock.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      // forward 된 키 집합이 ContributionCreateInput 의 7 키와 정확히 일치 — service 가
      // rawBody / diff / content 등 raw 컬럼 키를 주입하지 않음을 runtime assert.
      expect(Object.keys(forwardedArg).sort()).toEqual(
        [
          "assessmentId",
          "contributionScore",
          "difficulty",
          "sourceRef",
          "sourceType",
          "sourceUrl",
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
      const fixture = buildContributionFixture({ id: "abc" });
      repoMock.findById.mockResolvedValueOnce(fixture);

      const service = new ContributionService(repository);
      const result = await service.findById("abc");

      expect(repoMock.findById).toHaveBeenCalledWith("abc");
      expect(result).toBe(fixture);
    });

    it("null 반환 시 NotFoundException 으로 변환한다 (error)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new ContributionService(repository);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("empty string id 도 그대로 forward 하며 null 분기는 NotFoundException (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findById.mockResolvedValueOnce(null);

      const service = new ContributionService(repository);
      await expect(service.findById("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repoMock.findById).toHaveBeenCalledWith("");
    });
  });

  // -----------------------------------------------------------------------
  // findByAssessment — 컬렉션 결과 (다수 vs 빈 배열) 분기 + forward
  // -----------------------------------------------------------------------
  describe("findByAssessment()", () => {
    it("component Contribution 다수를 그대로 반환한다 (happy + branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const fixture = [
        buildContributionFixture(),
        buildContributionFixture({ id: "id-2", sourceType: "pr" }),
      ];
      repoMock.findByAssessment.mockResolvedValueOnce(fixture);

      const service = new ContributionService(repository);
      const result = await service.findByAssessment("assessment-1");

      expect(repoMock.findByAssessment).toHaveBeenCalledWith("assessment-1");
      expect(result).toBe(fixture);
    });

    it("매칭 row 0 시 빈 배열 [] 을 그대로 반환한다 (NotFoundException 던지지 않음) (branch)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.findByAssessment.mockResolvedValueOnce([]);

      const service = new ContributionService(repository);
      const result = await service.findByAssessment("assessment-empty");

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // remove (hard delete) — happy / P2025 → NotFoundException / unknown re-throw
  // -----------------------------------------------------------------------
  describe("remove()", () => {
    it("ContributionRepository.delete 를 호출한다 (happy)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.delete.mockResolvedValueOnce(undefined);

      const service = new ContributionService(repository);
      await service.remove("id-x");

      expect(repoMock.delete).toHaveBeenCalledWith("id-x");
    });

    it("P2025 (record not found) 를 NotFoundException 으로 변환한다 (error/negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      repoMock.delete.mockRejectedValueOnce(buildPrismaError("P2025"));

      const service = new ContributionService(repository);
      await expect(service.remove("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("P2025 가 아닌 unknown error 는 그대로 re-throw 한다 (negative)", async () => {
      const { repository, repoMock } = buildRepositoryMock();
      const unknownError = new Error("cascade-fail");
      repoMock.delete.mockRejectedValueOnce(unknownError);

      const service = new ContributionService(repository);
      await expect(service.remove("id-y")).rejects.toBe(unknownError);
    });
  });
});
