// UserInstanceAccessRepository spec — T-0222 acceptance (R-112: happy / error /
// branch / negative cases 충분 cover + coverage line/function ≥ 80%).
// PermissionDeniedRecordRepository spec (src/permission-denied/permission-denied-
// record.repository.spec.ts) 의 inline buildPrismaMock 패턴 1:1 mirror.
//
// 본 spec 은 PrismaService 의 `userInstanceAccess` delegate 를 Jest mock
// (`jest.fn()`) 으로 대체하여 PostgreSQL container 없이 isolated 하게 실행된다.
// 검증 포인트:
//   - findInstanceRefsByUserId 가 올바른 where/select 로 delegate 를 호출하고
//     instanceRef 만 string[] 로 추출하는지 (ADR-0024 §3 allowlist lookup).
//   - 빈/null userId → DB 조회 없이 빈 배열 (§3 step 1 / §4(iv) 경계).
//   - 빈/null instanceRef row 가 allowlist 에서 제외되는지 (§4(iv)).
//   - create 가 insert 전 instanceRef 에 정규화 (host lowercase / trailing-slash
//     제거 / scheme·path 보존) 를 적용하는지 (§4(i)(ii)(iii)).
//   - 정규화 후 빈 instanceRef create 가 throw 로 거부되는지 (§4(iv)).
//   - PrismaService reject (DB 장애) 가 swallow 없이 propagate (error path).
//   - normalizeInstanceRef helper 의 각 정규화 분기 + idempotency (negative edge).
//
// regression 경계: 본 slice 는 service placeholder 를 미접촉 (audit endpoint
// non-Admin 동작 변경 0). 본 spec 의 lookup/정규화 정확성 test 가 다음 slice
// (placeholder → 실 필터 전환) 의 회귀 방어 토대다 (ADR-0024 후속 chain row (4)).
import type { UserInstanceAccess } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import {
  UserInstanceAccessRepository,
  normalizeInstanceRef,
} from "./user-instance-access.repository";

// UserInstanceAccess fixture — schema.prisma 의 4 컬럼을 채운 default binding row.
function buildAccessFixture(
  overrides: Partial<UserInstanceAccess> = {},
): UserInstanceAccess {
  return {
    id: "uia-default",
    userId: "user-1",
    instanceRef: "github.sec.samsung.net",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 로 호출 카운터 격리.
// `userInstanceAccess` delegate 의 findMany / create 만 사용.
function buildPrismaMock(): {
  prisma: PrismaService;
  accessMock: {
    findMany: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
} {
  const accessMock = {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  };
  const prisma = {
    userInstanceAccess: accessMock,
  } as unknown as PrismaService;
  return { prisma, accessMock };
}

describe("UserInstanceAccessRepository", () => {
  // ------------------------------------------------------------------
  // findInstanceRefsByUserId — allowlist lookup (ADR-0024 §3 step 1)
  // ------------------------------------------------------------------
  describe("findInstanceRefsByUserId()", () => {
    // Happy path: binding 있는 userId 의 instanceRef 들을 정확히 반환 +
    // where/select 가 올바르게 구성되는지.
    it("userId 의 binding instanceRef 들을 string[] 로 반환한다 (happy)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.findMany.mockResolvedValueOnce([
        { instanceRef: "github.sec.samsung.net" },
        { instanceRef: "https://acme.atlassian.net/wiki/rest/api" },
      ]);

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.findInstanceRefsByUserId("user-1");

      expect(accessMock.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        select: { instanceRef: true },
      });
      expect(result).toEqual([
        "github.sec.samsung.net",
        "https://acme.atlassian.net/wiki/rest/api",
      ]);
    });

    // Branch (row 1+): 단일 binding 도 채워진 allowlist 반환.
    it("단일 binding row 도 채워진 allowlist 를 반환한다 (branch — row 1+)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.findMany.mockResolvedValueOnce([
        { instanceRef: "github.sec.samsung.net" },
      ]);

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.findInstanceRefsByUserId("user-1");

      expect(result).toEqual(["github.sec.samsung.net"]);
    });

    // Branch (row 0개): binding 0 → 빈 배열 (non-Admin 빈 allowlist fallback source).
    it("binding row 가 0개면 빈 배열을 반환한다 (branch — empty allowlist)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.findMany.mockResolvedValueOnce([]);

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.findInstanceRefsByUserId("user-1");

      expect(result).toEqual([]);
    });

    // Negative #6 (빈 userId): 빈 문자열 userId → DB 조회 없이 빈 배열 (§4(iv) 경계).
    it("빈 문자열 userId 면 DB 조회 없이 빈 배열을 반환한다 (negative — empty userId)", async () => {
      const { prisma, accessMock } = buildPrismaMock();

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.findInstanceRefsByUserId("");

      expect(result).toEqual([]);
      expect(accessMock.findMany).not.toHaveBeenCalled();
    });

    // Negative #6 (null/undefined userId): null/undefined → DB 조회 없이 빈 배열 (throw 0).
    it("null/undefined userId 면 DB 조회 없이 빈 배열을 반환한다 (negative — null userId)", async () => {
      const { prisma, accessMock } = buildPrismaMock();

      const repo = new UserInstanceAccessRepository(prisma);
      // 호출자가 잘못된 값을 넘긴 방어 케이스 — type 우회 입력.
      const resultNull = await repo.findInstanceRefsByUserId(
        null as unknown as string,
      );
      const resultUndef = await repo.findInstanceRefsByUserId(
        undefined as unknown as string,
      );

      expect(resultNull).toEqual([]);
      expect(resultUndef).toEqual([]);
      expect(accessMock.findMany).not.toHaveBeenCalled();
    });

    // Negative #2 (빈/null instanceRef row 제외): 섞인 결과에서 빈·null row 를 allowlist 에서 제외.
    it("빈/null instanceRef row 는 allowlist 에서 제외한다 (negative — 방어적 필터)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.findMany.mockResolvedValueOnce([
        { instanceRef: "github.sec.samsung.net" },
        { instanceRef: "" },
        { instanceRef: null },
        { instanceRef: "https://acme.atlassian.net/wiki/rest/api" },
      ]);

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.findInstanceRefsByUserId("user-1");

      expect(result).toEqual([
        "github.sec.samsung.net",
        "https://acme.atlassian.net/wiki/rest/api",
      ]);
    });

    // Error path: PrismaService reject (DB 장애) 가 swallow 없이 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (의존성 실패)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserInstanceAccessRepository(prisma);
      await expect(repo.findInstanceRefsByUserId("user-1")).rejects.toThrow(
        "db-down",
      );
    });
  });

  // ------------------------------------------------------------------
  // create — 정규화 binding insert (ADR-0024 §4)
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 이미 정규화된 instanceRef 는 그대로 delegate 의 data 로 전달.
    it("정규화된 instanceRef 로 PrismaService.create 를 호출한다 (happy)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      const fixture = buildAccessFixture({ id: "uia-new" });
      accessMock.create.mockResolvedValueOnce(fixture);

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.create({
        userId: "user-1",
        instanceRef: "github.sec.samsung.net",
      });

      expect(accessMock.create).toHaveBeenCalledWith({
        data: { userId: "user-1", instanceRef: "github.sec.samsung.net" },
      });
      expect(result).toBe(fixture);
    });

    // Negative #3 (대문자 host 정규화): host 부분 lowercase 후 저장.
    it("대문자 host 를 lowercase 정규화 후 저장한다 (negative — case 정규화)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.create.mockResolvedValueOnce(buildAccessFixture());

      const repo = new UserInstanceAccessRepository(prisma);
      await repo.create({
        userId: "user-1",
        instanceRef: "GitHub.SEC.samsung.net",
      });

      expect(accessMock.create).toHaveBeenCalledWith({
        data: { userId: "user-1", instanceRef: "github.sec.samsung.net" },
      });
    });

    // Negative #4 (trailing slash 제거): Confluence base URL 의 끝 slash 제거 후 저장.
    it("Confluence base URL 의 trailing slash 를 제거 후 저장한다 (negative — slash 정규화)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.create.mockResolvedValueOnce(buildAccessFixture());

      const repo = new UserInstanceAccessRepository(prisma);
      await repo.create({
        userId: "user-1",
        instanceRef: "https://acme.atlassian.net/wiki/rest/api/",
      });

      expect(accessMock.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          instanceRef: "https://acme.atlassian.net/wiki/rest/api",
        },
      });
    });

    // Negative #1 (빈 문자열 instanceRef): 정규화 후 빈 문자열이면 throw 로 거부 (§4(iv)).
    it("빈 문자열 instanceRef create 는 throw 로 거부한다 (negative — §4(iv))", async () => {
      const { prisma, accessMock } = buildPrismaMock();

      const repo = new UserInstanceAccessRepository(prisma);
      await expect(
        repo.create({ userId: "user-1", instanceRef: "" }),
      ).rejects.toThrow(/유효 binding 아님/);
      // 정규화 후 빈 문자열이면 delegate 미호출 (silent 무효 row insert 방지).
      expect(accessMock.create).not.toHaveBeenCalled();
    });

    // Negative #1 변형 (공백만): trim 후 빈 문자열도 throw 로 거부.
    it("공백만으로 이뤄진 instanceRef create 도 throw 로 거부한다 (negative — whitespace)", async () => {
      const { prisma, accessMock } = buildPrismaMock();

      const repo = new UserInstanceAccessRepository(prisma);
      await expect(
        repo.create({ userId: "user-1", instanceRef: "   " }),
      ).rejects.toThrow(/유효 binding 아님/);
      expect(accessMock.create).not.toHaveBeenCalled();
    });

    // Error path: PrismaService reject (DB 장애 / P2002 중복) 가 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (의존성 실패 / P2002)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.create.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserInstanceAccessRepository(prisma);
      await expect(
        repo.create({
          userId: "user-1",
          instanceRef: "github.sec.samsung.net",
        }),
      ).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // deleteByUserIdAndInstanceRef — revoke row delete (ADR-0027 §2/§4)
  // ------------------------------------------------------------------
  describe("deleteByUserIdAndInstanceRef()", () => {
    // Happy path: 정규화된 (userId, instanceRef) 로 deleteMany 호출 + count 반환.
    it("정규화된 (userId, instanceRef) 로 deleteMany 를 호출하고 count 를 반환한다 (happy)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.deleteMany.mockResolvedValueOnce({ count: 1 });

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.deleteByUserIdAndInstanceRef(
        "user-1",
        "github.sec.samsung.net",
      );

      expect(accessMock.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1", instanceRef: "github.sec.samsung.net" },
      });
      expect(result).toBe(1);
    });

    // Negative (부재 binding): 매칭 row 0개면 count 0 을 반환하고 throw 하지 않는다
    // (idempotent no-op — ADR-0027 §4 revoke 204 semantic 의 repository 토대).
    it("부재 binding 은 count 0 을 반환하고 throw 하지 않는다 (idempotent no-op)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.deleteMany.mockResolvedValueOnce({ count: 0 });

      const repo = new UserInstanceAccessRepository(prisma);
      const result = await repo.deleteByUserIdAndInstanceRef(
        "user-1",
        "nonexistent.host",
      );

      expect(result).toBe(0);
    });

    // Error path: PrismaService reject (DB 장애 등) 는 swallow 없이 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (의존성 실패)", async () => {
      const { prisma, accessMock } = buildPrismaMock();
      accessMock.deleteMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserInstanceAccessRepository(prisma);
      await expect(
        repo.deleteByUserIdAndInstanceRef("user-1", "github.sec.samsung.net"),
      ).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // normalizeInstanceRef helper — 각 정규화 분기 + idempotency (ADR-0024 §4)
  // ------------------------------------------------------------------
  describe("normalizeInstanceRef()", () => {
    // §4(i): host-only (GitHub configured host) 전체 lowercase.
    it("scheme 없는 host 는 전체 lowercase 한다 (§4(i))", () => {
      expect(normalizeInstanceRef("GitHub.SEC.samsung.net")).toBe(
        "github.sec.samsung.net",
      );
    });

    // §4(i): scheme://authority 형태면 authority(host) 만 lowercase, path 보존.
    it("scheme URL 은 host 만 lowercase 하고 path 는 보존한다 (§4(i)(iii))", () => {
      expect(
        normalizeInstanceRef("https://ACME.atlassian.net/wiki/rest/api"),
      ).toBe("https://acme.atlassian.net/wiki/rest/api");
    });

    // §4(iii): path 의 대소문자는 보존 (host 만 정규화 — path 는 case-sensitive).
    it("path 의 대소문자는 보존한다 (§4(iii) — path 비정규화)", () => {
      expect(
        normalizeInstanceRef("https://acme.atlassian.net/Wiki/REST/api"),
      ).toBe("https://acme.atlassian.net/Wiki/REST/api");
    });

    // §4(ii): trailing slash 제거 (단일 + 다중).
    it("trailing slash 를 제거한다 (§4(ii) — 단일/다중)", () => {
      expect(
        normalizeInstanceRef("https://acme.atlassian.net/wiki/rest/api/"),
      ).toBe("https://acme.atlassian.net/wiki/rest/api");
      expect(
        normalizeInstanceRef("https://acme.atlassian.net/wiki/rest/api///"),
      ).toBe("https://acme.atlassian.net/wiki/rest/api");
    });

    // §4(iii): scheme 은 그대로 — http ≠ https (다른 instance).
    it("scheme 은 정규화하지 않는다 — http 와 https 는 다른 값 (§4(iii))", () => {
      expect(normalizeInstanceRef("http://acme.atlassian.net/wiki")).toBe(
        "http://acme.atlassian.net/wiki",
      );
      expect(normalizeInstanceRef("https://acme.atlassian.net/wiki")).toBe(
        "https://acme.atlassian.net/wiki",
      );
      expect(normalizeInstanceRef("http://acme.atlassian.net/wiki")).not.toBe(
        normalizeInstanceRef("https://acme.atlassian.net/wiki"),
      );
    });

    // idempotency: 이미 정규화된 값을 다시 넣어도 동일 값 반환.
    it("이미 정규화된 값은 idempotent 하게 동일 값을 반환한다", () => {
      const normalized = "https://acme.atlassian.net/wiki/rest/api";
      expect(normalizeInstanceRef(normalized)).toBe(normalized);
      expect(normalizeInstanceRef("github.sec.samsung.net")).toBe(
        "github.sec.samsung.net",
      );
    });

    // §4(ii)+(i) 복합: trailing slash + 대문자 host 동시 정규화.
    it("trailing slash + 대문자 host 를 동시에 정규화한다 (복합)", () => {
      expect(
        normalizeInstanceRef("https://ACME.Atlassian.NET/wiki/rest/api/"),
      ).toBe("https://acme.atlassian.net/wiki/rest/api");
    });

    // §4(iv): 빈/공백 입력은 빈 문자열 반환.
    it("빈 문자열·공백·null·undefined 입력은 빈 문자열을 반환한다 (§4(iv))", () => {
      expect(normalizeInstanceRef("")).toBe("");
      expect(normalizeInstanceRef("   ")).toBe("");
      expect(normalizeInstanceRef(null as unknown as string)).toBe("");
      expect(normalizeInstanceRef(undefined as unknown as string)).toBe("");
    });

    // 주변 공백 trim — host-only 값의 앞뒤 공백 제거.
    it("앞뒤 공백을 trim 한다", () => {
      expect(normalizeInstanceRef("  github.sec.samsung.net  ")).toBe(
        "github.sec.samsung.net",
      );
    });
  });
});
