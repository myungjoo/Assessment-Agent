// PermissionDeniedRecordService spec — T-0209 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// LlmProviderConfigService spec 의 repository Jest mock 패턴 mirror, 단 본 service 의
// 핵심 차이 (reason 도출 분기) 를 branch / negative case 로 집중 검증.
//
// 본 spec 은 PermissionDeniedRecordRepository 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - record 의 reason 도출 분기: 401/403 → "permission-denied" / 404 →
//     "not-found-or-hidden" / 호출자 reason 제공 시 우선 / 미지원 status → null fallback.
//   - list 의 빈 배열 vs 비-빈 배열 분기 + 필터 forward.
//   - error path: repository.create / findMany reject (DB 장애) 를 swallow 없이
//     propagate (404 등으로 잘못 변환하지 않음).
import type { PermissionDeniedRecord } from "@prisma/client";

import { PermissionDeniedRecordService } from "./permission-denied-record.service";

// PermissionDeniedRecord fixture — schema.prisma 의 8 컬럼을 모두 채운 default row.
function buildRecordFixture(
  overrides: Partial<PermissionDeniedRecord> = {},
): PermissionDeniedRecord {
  return {
    id: "pdr-default",
    provider: "github",
    instanceRef: "github.sec.samsung.net",
    resourceRef: "/repos/acme/widget/commits",
    principal: null,
    httpStatus: 403,
    reason: "permission-denied",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// repository mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. service 가 사용하는 create / findMany 메서드를 mock 으로 정의.
function buildService(): {
  service: PermissionDeniedRecordService;
  repo: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
} {
  const repo = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  const service = new PermissionDeniedRecordService(repo as never);
  return { service, repo };
}

describe("PermissionDeniedRecordService", () => {
  describe("record()", () => {
    // ------------------------------------------------------------------
    // Happy path / branch — 403 → reason "permission-denied" 도출 후 repository.create forward
    // ------------------------------------------------------------------
    it("403 이벤트의 reason 을 'permission-denied' 로 도출해 repository.create 로 forward 한다 (happy — 403 분기)", async () => {
      const { service, repo } = buildService();
      const fixture = buildRecordFixture();
      repo.create.mockResolvedValueOnce(fixture);

      const result = await service.record({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/acme/widget/commits",
        httpStatus: 403,
      });

      expect(repo.create).toHaveBeenCalledWith({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/acme/widget/commits",
        principal: null,
        httpStatus: 403,
        reason: "permission-denied",
      });
      expect(result).toBe(fixture);
    });

    // Branch: 401 도 "permission-denied" 로 도출 (401 || 403 동일 분기).
    it("401 이벤트의 reason 도 'permission-denied' 로 도출한다 (branch — 401 분기)", async () => {
      const { service, repo } = buildService();
      repo.create.mockResolvedValueOnce(
        buildRecordFixture({ httpStatus: 401 }),
      );

      await service.record({
        provider: "confluence",
        instanceRef: "https://acme.atlassian.net/wiki/rest/api",
        resourceRef: "/content",
        httpStatus: 401,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpStatus: 401,
          reason: "permission-denied",
        }),
      );
    });

    // Branch: 권한 비가시 404 → "not-found-or-hidden" 도출.
    it("404 이벤트의 reason 을 'not-found-or-hidden' 로 도출한다 (branch — 404 분기)", async () => {
      const { service, repo } = buildService();
      repo.create.mockResolvedValueOnce(
        buildRecordFixture({ httpStatus: 404 }),
      );

      await service.record({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/acme/secret",
        httpStatus: 404,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          httpStatus: 404,
          reason: "not-found-or-hidden",
        }),
      );
    });

    // Branch: 호출자가 reason 을 명시하면 도출보다 우선 (호출자 제공값 우선 분기).
    it("호출자가 reason 을 제공하면 도출보다 우선한다 (branch — 호출자 reason 우선)", async () => {
      const { service, repo } = buildService();
      repo.create.mockResolvedValueOnce(buildRecordFixture());

      await service.record({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/acme/widget/commits",
        httpStatus: 403,
        reason: "custom-operator-reason",
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "custom-operator-reason" }),
      );
    });

    // Negative #1: 미지원/비정상 httpStatus (emit 대상 아닌 500) → reason null fallback,
    // service crash 0 (방어). emit 경계 밖이라도 안전 처리.
    it("미지원 httpStatus (500) 는 reason null 로 fallback 하고 crash 하지 않는다 (negative — 미지원 status)", async () => {
      const { service, repo } = buildService();
      repo.create.mockResolvedValueOnce(
        buildRecordFixture({ httpStatus: 500 }),
      );

      await service.record({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/acme/widget",
        httpStatus: 500,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ httpStatus: 500, reason: null }),
      );
    });

    // Negative #2: 빈 문자열 reason 은 미제공으로 간주 → 도출로 떨어짐 (falsy 분기).
    it("빈 문자열 reason 은 미제공으로 간주해 도출 reason 을 사용한다 (negative — 빈 reason)", async () => {
      const { service, repo } = buildService();
      repo.create.mockResolvedValueOnce(buildRecordFixture());

      await service.record({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/r",
        httpStatus: 403,
        reason: "",
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "permission-denied" }),
      );
    });

    // Negative #3: principal 명시 시 그대로 forward (nullish coalescing 의 truthy 분기).
    it("principal 이 명시되면 그 값을 그대로 forward 한다 (negative — principal 제공 분기)", async () => {
      const { service, repo } = buildService();
      repo.create.mockResolvedValueOnce(buildRecordFixture());

      await service.record({
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/r",
        principal: "svc-identity-1",
        httpStatus: 403,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ principal: "svc-identity-1" }),
      );
    });

    // Error path: repository.create reject (DB 장애) 를 swallow 없이 propagate
    // (404 등으로 잘못 변환하지 않음).
    it("repository.create reject 를 swallow 없이 그대로 전파한다 (error — 의존성 실패)", async () => {
      const { service, repo } = buildService();
      repo.create.mockRejectedValueOnce(new Error("db-down"));

      await expect(
        service.record({
          provider: "github",
          instanceRef: "h",
          resourceRef: "/r",
          httpStatus: 403,
        }),
      ).rejects.toThrow("db-down");
    });
  });

  describe("list()", () => {
    // Happy / branch (비-빈 배열): repository.findMany 결과를 그대로 반환.
    it("repository.findMany 의 결과 (비-빈 배열) 를 그대로 반환한다 (happy — 비-빈 배열 분기)", async () => {
      const { service, repo } = buildService();
      const fixture = [
        buildRecordFixture({ id: "r-1" }),
        buildRecordFixture({ id: "r-2", provider: "confluence" }),
      ];
      repo.findMany.mockResolvedValueOnce(fixture);

      const result = await service.list();

      expect(repo.findMany).toHaveBeenCalledWith(undefined);
      expect(result).toBe(fixture);
    });

    // Branch: 필터 query 를 repository.findMany 로 그대로 forward.
    it("필터 query 를 repository.findMany 로 그대로 forward 한다 (branch — 필터 제공)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([buildRecordFixture()]);

      await service.list({ provider: "github", httpStatus: 403 });

      expect(repo.findMany).toHaveBeenCalledWith({
        provider: "github",
        httpStatus: 403,
      });
    });

    // Negative: 빈 배열 (등록 0) 도 404 변환 없이 빈 배열 그대로 반환.
    it("repository 가 빈 배열을 반환하면 404 변환 없이 빈 배열을 반환한다 (negative — empty result)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });

    // Negative: 빈 객체 filter 도 raw forward (비정상 filter 인자).
    it("빈 객체 filter 도 repository 로 그대로 forward 한다 (negative — 빈 filter)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([]);

      await service.list({});

      expect(repo.findMany).toHaveBeenCalledWith({});
    });

    // Error path: repository.findMany reject (DB 장애) 를 swallow 없이 propagate.
    it("repository.findMany reject 를 swallow 없이 그대로 전파한다 (error — 의존성 실패)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.list()).rejects.toThrow("db-down");
    });
  });
});
