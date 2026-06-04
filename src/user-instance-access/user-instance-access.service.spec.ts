// UserInstanceAccessService spec — T-0237 acceptance §R-112 (happy / error / branch
// / negative 충분 cover + coverage line/function ≥ 80%, ADR-0027 §2/§3/§4).
// UserService.spec (src/user/user.service.spec.ts) 의 repository mock + buildPrismaError
// local helper 정공법 1:1 mirror — repository 를 Jest mock 으로 대체해 PostgreSQL
// container 없이 isolated 실행.
//
// 검증 포인트 (ADR-0027 §3/§4):
//   - grant happy — self ≠ target 일 때 repository.create 호출 인자 정합 + 반환.
//   - grant self-grant (actor === target) → ForbiddenException(403), repository 미호출.
//   - grant P2002 → ConflictException(409) / P2003 → NotFoundException(404) /
//     generic Error(undefined code) → raw propagate.
//   - revoke happy — self ≠ target 일 때 normalizeInstanceRef 후 deleteByUserIdAnd
//     InstanceRef 호출 (round-trip 정규화 정합).
//   - revoke self-revoke → ForbiddenException(403), repository 미호출.
//   - revoke 부재 binding (count 0) → idempotent no-op (throw 0).
//   - revoke P2003 → NotFoundException(404) / generic Error → raw propagate.
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { UserInstanceAccess } from "@prisma/client";

import type { UserInstanceAccessRepository } from "./user-instance-access.repository";
import { UserInstanceAccessService } from "./user-instance-access.service";

// UserInstanceAccess fixture — schema 의 4 컬럼을 채운 default binding row.
function buildAccessFixture(
  overrides: Partial<UserInstanceAccess> = {},
): UserInstanceAccess {
  return {
    id: "uia-default",
    userId: "target-1",
    instanceRef: "github.sec.samsung.net",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Prisma known error 생성 helper — `code` field 를 붙인 Error (UserService.spec 의
// buildPrismaError 1:1 mirror — getPrismaErrorCode 의 duck typing 과 정합).
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

// repository mock factory — service 가 사용하는 2 메서드 (create /
// deleteByUserIdAndInstanceRef) 만 jest.fn() 으로 대체. 각 test 마다 새 mock.
function buildRepositoryMock(): {
  repository: UserInstanceAccessRepository;
  repoMock: {
    create: jest.Mock;
    deleteByUserIdAndInstanceRef: jest.Mock;
  };
} {
  const repoMock = {
    create: jest.fn(),
    deleteByUserIdAndInstanceRef: jest.fn(),
  };
  return {
    repository: repoMock as unknown as UserInstanceAccessRepository,
    repoMock,
  };
}

function buildService(): {
  service: UserInstanceAccessService;
  repoMock: ReturnType<typeof buildRepositoryMock>["repoMock"];
} {
  const { repository, repoMock } = buildRepositoryMock();
  const service = new UserInstanceAccessService(repository);
  return { service, repoMock };
}

describe("UserInstanceAccessService", () => {
  // ------------------------------------------------------------------
  // grant — self-grant 거부 + repository.create 재사용 + Prisma error 매핑
  // ------------------------------------------------------------------
  describe("grant()", () => {
    // Happy path: self ≠ target 일 때 repository.create 를 정확한 인자로 호출하고
    // 그 결과를 반환 (ADR-0027 §2 repository.create 재사용).
    it("self ≠ target 일 때 repository.create 를 호출하고 결과를 반환한다 (happy)", async () => {
      const { service, repoMock } = buildService();
      const fixture = buildAccessFixture({ id: "uia-new" });
      repoMock.create.mockResolvedValueOnce(fixture);

      const result = await service.grant(
        "actor-1",
        "target-1",
        "github.sec.samsung.net",
      );

      expect(repoMock.create).toHaveBeenCalledWith({
        userId: "target-1",
        instanceRef: "github.sec.samsung.net",
      });
      expect(result).toBe(fixture);
    });

    // Negative (self-grant): actor === target → ForbiddenException(403),
    // repository.create 미호출 (privilege 자가 확장 차단, ADR-0027 §3 — self-grant
    // 분기 true).
    it("self-grant (actor === target) 는 ForbiddenException 으로 거부한다 (negative — 403)", async () => {
      const { service, repoMock } = buildService();

      await expect(
        service.grant("same-id", "same-id", "github.sec.samsung.net"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repoMock.create).not.toHaveBeenCalled();
    });

    // Error path (P2002): 중복 binding → ConflictException(409, ADR-0027 §4) —
    // getPrismaErrorCode 의 P2002 분기.
    it("repository 가 P2002 reject 하면 ConflictException 으로 변환한다 (error — 409 중복)", async () => {
      const { service, repoMock } = buildService();
      repoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      await expect(
        service.grant("actor-1", "target-1", "github.sec.samsung.net"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Error path (P2003): unknown user FK 위반 → NotFoundException(404, ADR-0027 §4)
    // — getPrismaErrorCode 의 P2003 분기.
    it("repository 가 P2003 reject 하면 NotFoundException 으로 변환한다 (error — 404 unknown user)", async () => {
      const { service, repoMock } = buildService();
      repoMock.create.mockRejectedValueOnce(buildPrismaError("P2003"));

      await expect(
        service.grant("actor-1", "target-1", "github.sec.samsung.net"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Error path (undefined code): generic Error (code 없음) → raw propagate —
    // getPrismaErrorCode 의 undefined 분기 (그 외 변환 0).
    it("repository 가 code 없는 generic Error reject 하면 raw 로 전파한다 (error — undefined code 분기)", async () => {
      const { service, repoMock } = buildService();
      repoMock.create.mockRejectedValueOnce(new Error("db-down"));

      await expect(
        service.grant("actor-1", "target-1", "github.sec.samsung.net"),
      ).rejects.toThrow("db-down");
    });

    // Negative (정규화 후 빈 문자열): repository.create 가 정규화 후 빈 문자열에
    // 대해 throw 하는 Error 는 known code 가 아니므로 호출자에게 raw propagate
    // (ADR-0027 §2 — repository 책임 위임, service 는 그 외 분기로 그대로 전파).
    it("repository.create 의 정규화 후 빈 문자열 Error 는 raw 로 전파한다 (negative — propagate)", async () => {
      const { service, repoMock } = buildService();
      repoMock.create.mockRejectedValueOnce(
        new Error("instanceRef 가 정규화 후 빈 문자열 — 유효 binding 아님"),
      );

      await expect(service.grant("actor-1", "target-1", "   ")).rejects.toThrow(
        /유효 binding 아님/,
      );
    });
  });

  // ------------------------------------------------------------------
  // revoke — self-revoke 거부 + 정규화 후 delete + idempotency + Prisma error 매핑
  // ------------------------------------------------------------------
  describe("revoke()", () => {
    // Happy path: self ≠ target 일 때 normalizeInstanceRef 정규화값으로
    // deleteByUserIdAndInstanceRef 호출 (round-trip 정규화 정합, ADR-0027 §2).
    it("self ≠ target 일 때 정규화 후 deleteByUserIdAndInstanceRef 를 호출한다 (happy)", async () => {
      const { service, repoMock } = buildService();
      repoMock.deleteByUserIdAndInstanceRef.mockResolvedValueOnce(1);

      await service.revoke("actor-1", "target-1", "GitHub.SEC.samsung.net/");

      // 입력 instanceRef 가 host lowercase + trailing slash 제거로 정규화된 값으로
      // 호출되어야 한다 (normalizeInstanceRef 재사용 — 정규화 단일 source).
      expect(repoMock.deleteByUserIdAndInstanceRef).toHaveBeenCalledWith(
        "target-1",
        "github.sec.samsung.net",
      );
    });

    // Negative (self-revoke): actor === target → ForbiddenException(403),
    // repository 미호출 (ADR-0027 §3 grant/revoke 대칭).
    it("self-revoke (actor === target) 는 ForbiddenException 으로 거부한다 (negative — 403)", async () => {
      const { service, repoMock } = buildService();

      await expect(
        service.revoke("same-id", "same-id", "github.sec.samsung.net"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repoMock.deleteByUserIdAndInstanceRef).not.toHaveBeenCalled();
    });

    // Negative (부재 binding): deleteByUserIdAndInstanceRef 가 count 0 을 반환해도
    // throw 하지 않고 정상 완료 (idempotent no-op — ADR-0027 §4 revoke 204 semantic).
    it("부재 binding revoke 는 throw 없이 정상 완료한다 (negative — idempotent no-op)", async () => {
      const { service, repoMock } = buildService();
      repoMock.deleteByUserIdAndInstanceRef.mockResolvedValueOnce(0);

      await expect(
        service.revoke("actor-1", "target-1", "nonexistent.host"),
      ).resolves.toBeUndefined();
    });

    // Error path (P2003): unknown user FK 위반 → NotFoundException(404, ADR-0027 §4).
    it("repository 가 P2003 reject 하면 NotFoundException 으로 변환한다 (error — 404 unknown user)", async () => {
      const { service, repoMock } = buildService();
      repoMock.deleteByUserIdAndInstanceRef.mockRejectedValueOnce(
        buildPrismaError("P2003"),
      );

      await expect(
        service.revoke("actor-1", "target-1", "github.sec.samsung.net"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Error path (그 외): generic Error (DB 장애 등) → raw propagate —
    // getPrismaErrorCode 의 undefined / non-P2003 분기.
    it("repository 가 code 없는 generic Error reject 하면 raw 로 전파한다 (error — propagate)", async () => {
      const { service, repoMock } = buildService();
      repoMock.deleteByUserIdAndInstanceRef.mockRejectedValueOnce(
        new Error("db-down"),
      );

      await expect(
        service.revoke("actor-1", "target-1", "github.sec.samsung.net"),
      ).rejects.toThrow("db-down");
    });
  });
});
