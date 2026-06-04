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
// 격리되도록 한다. service 가 사용하는 create / findMany (PermissionDeniedRecord
// Repository) + findInstanceRefsByUserId (UserInstanceAccessRepository, ADR-0024 §3
// split B own-instance allowlist lookup) 메서드를 mock 으로 정의.
function buildService(): {
  service: PermissionDeniedRecordService;
  repo: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  uiaRepo: {
    findInstanceRefsByUserId: jest.Mock;
  };
} {
  const repo = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  const uiaRepo = {
    findInstanceRefsByUserId: jest.fn(),
  };
  const service = new PermissionDeniedRecordService(
    repo as never,
    uiaRepo as never,
  );
  return { service, repo, uiaRepo };
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

  // list(actor, query?) — T-0214 (ADR-0023 §1/§3) actor-aware + T-0224 (ADR-0024 §3
  // split B) own-instance 필터 결선. audience 차등 (Admin bypass vs non-Admin
  // own-instance allowlist 필터) 을 actor.role + actor.sub 로 분기. non-Admin 은
  // findInstanceRefsByUserId 로 allowlist 를 받아 instanceRefIn 강제 주입.
  describe("list(actor, query?)", () => {
    // ----- Admin bypass 분기 (ADR-0023 §3) — repository.findMany 로 forward -----

    // Happy: Admin actor → 필터 없이 findMany(query) forward, 전체 record 반환.
    // allowlist lookup 무시 (Admin bypass — ADR-0024 §3).
    it("Admin actor 는 repository.findMany(query) 로 forward 하고 전체 record 를 반환한다 (happy — Admin bypass, allowlist lookup 무시)", async () => {
      const { service, repo, uiaRepo } = buildService();
      const fixture = [
        buildRecordFixture({ id: "r-1" }),
        buildRecordFixture({ id: "r-2", provider: "confluence" }),
      ];
      repo.findMany.mockResolvedValueOnce(fixture);

      const result = await service.list({ sub: "admin-1", role: "Admin" });

      expect(repo.findMany).toHaveBeenCalledWith(undefined);
      expect(uiaRepo.findInstanceRefsByUserId).not.toHaveBeenCalled();
      expect(result).toBe(fixture);
    });

    // Happy: SuperAdmin actor → 동일 bypass (escalation tier 상위).
    it("SuperAdmin actor 도 동일하게 bypass 해 findMany 로 forward 한다 (happy — SuperAdmin bypass)", async () => {
      const { service, repo } = buildService();
      const fixture = [buildRecordFixture()];
      repo.findMany.mockResolvedValueOnce(fixture);

      const result = await service.list({ sub: "su-1", role: "SuperAdmin" });

      expect(repo.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe(fixture);
    });

    // Branch: Admin actor 가 필터 query 를 주면 repository 로 그대로 forward.
    it("Admin actor 의 필터 query 를 repository.findMany 로 그대로 forward 한다 (branch — Admin + 필터)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([buildRecordFixture()]);

      await service.list(
        { sub: "admin-1", role: "Admin" },
        { provider: "github", httpStatus: 403 },
      );

      expect(repo.findMany).toHaveBeenCalledWith({
        provider: "github",
        httpStatus: 403,
      });
    });

    // Negative: Admin path 의 repository 가 빈 배열 → 404 변환 없이 빈 배열 그대로.
    it("Admin path 에서 repository 가 빈 배열이면 404 변환 없이 빈 배열을 반환한다 (negative — empty result)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([]);

      const result = await service.list({ sub: "admin-1", role: "Admin" });

      expect(result).toEqual([]);
    });

    // Error path: Admin path 의 repository.findMany reject (DB 장애) propagate.
    it("Admin path 의 repository.findMany reject 를 swallow 없이 전파한다 (error — 의존성 실패)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockRejectedValueOnce(new Error("db-down"));

      await expect(
        service.list({ sub: "admin-1", role: "Admin" }),
      ).rejects.toThrow("db-down");
    });

    // Error path: Admin path 의 findMany reject 외에, non-Admin path 에서도
    // findInstanceRefsByUserId reject (DB 장애) 를 propagate 함을 별도 검증 (아래).

    // ----- non-Admin own-instance 필터 분기 (ADR-0024 §3 split B) -----

    // Happy: non-Admin actor + 비어있지 않은 allowlist → findMany 가
    // instanceRefIn=allowlist 로 호출되고 해당 record 만 반환 (자기 instance 조회).
    it("non-Admin actor 는 allowlist 를 instanceRefIn 으로 findMany 에 강제 주입해 자기 instance record 만 반환한다 (happy — own-instance 필터)", async () => {
      const { service, repo, uiaRepo } = buildService();
      const allowlist = [
        "github.sec.samsung.net",
        "https://acme.atlassian.net",
      ];
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce(allowlist);
      const fixture = [buildRecordFixture({ id: "own-1" })];
      repo.findMany.mockResolvedValueOnce(fixture);

      const result = await service.list({ sub: "user-1", role: "User" });

      expect(uiaRepo.findInstanceRefsByUserId).toHaveBeenCalledWith("user-1");
      expect(repo.findMany).toHaveBeenCalledWith({ instanceRefIn: allowlist });
      expect(result).toBe(fixture);
    });

    // Regression (T-0224): binding 있는 non-Admin 사용자가 자기 record 를 **실제로**
    // 받는지 — 과거 placeholder("항상 빈 배열") 로 회귀하지 않음을 방어.
    it("binding 있는 non-Admin 사용자가 실제로 record 를 받는다 (regression — placeholder 빈 배열 회귀 방어)", async () => {
      const { service, repo, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([
        "github.sec.samsung.net",
      ]);
      const fixture = [buildRecordFixture({ id: "r-own" })];
      repo.findMany.mockResolvedValueOnce(fixture);

      const result = await service.list({ sub: "user-1", role: "User" });

      expect(result).toEqual(fixture);
      expect(result).not.toEqual([]);
    });

    // Branch: 기타 query 필터 (provider / httpStatus) 는 own-instance 필터와 함께
    // forward (덮어쓰지 않음).
    it("provider / httpStatus 등 기타 query 필터를 own-instance 필터와 함께 forward 한다 (branch — 기타 필터 보존)", async () => {
      const { service, repo, uiaRepo } = buildService();
      const allowlist = ["github.sec.samsung.net"];
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce(allowlist);
      repo.findMany.mockResolvedValueOnce([]);

      await service.list(
        { sub: "user-1", role: "User" },
        { provider: "github", httpStatus: 403 },
      );

      expect(repo.findMany).toHaveBeenCalledWith({
        provider: "github",
        httpStatus: 403,
        instanceRefIn: allowlist,
      });
    });

    // Negative #1 + branch: allowlist 공집합 → 빈 배열, findMany 미호출 (binding 0
    // fallback, ADR-0024 §4).
    it("non-Admin 의 allowlist 가 공집합이면 빈 배열을 반환하고 findMany 를 호출하지 않는다 (negative — 빈 allowlist binding 0 fallback)", async () => {
      const { service, repo, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([]);

      const result = await service.list({ sub: "user-1", role: "User" });

      expect(result).toEqual([]);
      expect(repo.findMany).not.toHaveBeenCalled();
    });

    // Branch + negative #3a: query.instanceRef 가 (정규화 후) allowlist 에 속함 →
    // 단일로 좁힘 (instanceRef + instanceRefIn 둘 다 전달, repository AND 합성 교집합).
    it("query.instanceRef 가 allowlist 에 속하면 그 단일로 좁혀 instanceRef + instanceRefIn 을 둘 다 전달한다 (branch — in-allowlist)", async () => {
      const { service, repo, uiaRepo } = buildService();
      const allowlist = [
        "github.sec.samsung.net",
        "https://acme.atlassian.net",
      ];
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce(allowlist);
      repo.findMany.mockResolvedValueOnce([buildRecordFixture()]);

      await service.list(
        { sub: "user-1", role: "User" },
        { instanceRef: "github.sec.samsung.net" },
      );

      expect(repo.findMany).toHaveBeenCalledWith({
        instanceRef: "github.sec.samsung.net",
        instanceRefIn: allowlist,
      });
    });

    // Negative #1 + #3b: query.instanceRef 가 allowlist 밖 → 빈 결과, findMany 미호출
    // (타 instance 비노출, ADR-0024 §4 빈-필터).
    it("query.instanceRef 가 allowlist 밖이면 빈 결과를 반환하고 findMany 를 호출하지 않는다 (negative — 타 instance 차단, out-of-allowlist)", async () => {
      const { service, repo, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([
        "github.sec.samsung.net",
      ]);

      const result = await service.list(
        { sub: "user-1", role: "User" },
        { instanceRef: "other.instance.example.com" },
      );

      expect(result).toEqual([]);
      expect(repo.findMany).not.toHaveBeenCalled();
    });

    // Negative #6: 경계 instance 식별자 — query.instanceRef 가 case / trailing-slash
    // 변형이어도 정규화 후 allowlist 매칭 (ADR-0024 §4 round-trip 일관).
    it("query.instanceRef 가 case / trailing-slash 변형이어도 정규화 후 allowlist 에 매칭된다 (negative — 경계 식별자 정규화)", async () => {
      const { service, repo, uiaRepo } = buildService();
      const allowlist = ["github.sec.samsung.net"];
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce(allowlist);
      repo.findMany.mockResolvedValueOnce([buildRecordFixture()]);

      await service.list(
        { sub: "user-1", role: "User" },
        { instanceRef: "GitHub.SEC.samsung.net/" },
      );

      expect(repo.findMany).toHaveBeenCalledWith({
        instanceRef: "github.sec.samsung.net",
        instanceRefIn: allowlist,
      });
    });

    // Negative #5: actor undefined → non-Admin 취급, sub 부재로 빈 userId → 빈
    // allowlist → 빈 배열, throw 0. service 의 actor?.sub undefined 방어.
    it("actor 가 undefined 면 빈 userId 로 allowlist 를 조회하고 빈 배열을 반환한다 (negative — actor 부재, throw 0)", async () => {
      const { service, repo, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([]);

      const result = await service.list(undefined);

      expect(result).toEqual([]);
      expect(uiaRepo.findInstanceRefsByUserId).toHaveBeenCalledWith("");
      expect(repo.findMany).not.toHaveBeenCalled();
    });

    // Negative: role 누락 (sub 만) → non-Admin 취급, sub 로 allowlist 조회.
    it("role 이 누락된 actor 는 non-Admin 취급해 actor.sub 로 allowlist 를 조회한다 (negative — role 누락)", async () => {
      const { service, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([]);

      const result = await service.list({ sub: "x" });

      expect(result).toEqual([]);
      expect(uiaRepo.findInstanceRefsByUserId).toHaveBeenCalledWith("x");
    });

    // Negative: unknown / case-변형 role → non-Admin 취급 (own-instance 필터 경로).
    // exact 매칭 경계 — 'admin' (소문자) 은 bypass 아님.
    it("unknown role / case 변형 role (예: 'admin') 은 non-Admin 취급해 own-instance 필터를 탄다 (negative — role 경계, exact 매칭)", async () => {
      const { service, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValue([]);

      const lowerCase = await service.list({ sub: "x", role: "admin" });
      const unknown = await service.list({ sub: "y", role: "Auditor" });

      expect(lowerCase).toEqual([]);
      expect(unknown).toEqual([]);
      expect(uiaRepo.findInstanceRefsByUserId).toHaveBeenCalledWith("x");
      expect(uiaRepo.findInstanceRefsByUserId).toHaveBeenCalledWith("y");
    });

    // Negative: 빈 문자열 role → non-Admin 취급 (isAdminBypass("") === false).
    // 경계 직접 cover — Admin bypass NOT 발생, actor.sub 로 allowlist lookup 이
    // 실제로 호출되고 own-instance 필터 경로를 탄다 (간접이 아닌 직접 검증).
    it("role 이 빈 문자열인 actor 는 non-Admin 취급해 findInstanceRefsByUserId 가 호출되고 own-instance 필터를 탄다 (negative — 빈 문자열 role 경계)", async () => {
      const { service, repo, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([]);

      const result = await service.list({ sub: "z", role: "" });

      // Admin bypass 미발생 → allowlist lookup 이 actor.sub 로 호출됨.
      expect(uiaRepo.findInstanceRefsByUserId).toHaveBeenCalledWith("z");
      // 빈 allowlist → 빈 배열, findMany 미호출 (own-instance 필터 경로).
      expect(result).toEqual([]);
      expect(repo.findMany).not.toHaveBeenCalled();
    });

    // Error path: non-Admin path 에서 findInstanceRefsByUserId reject (DB 장애) 를
    // swallow 없이 propagate.
    it("non-Admin path 의 findInstanceRefsByUserId reject 를 swallow 없이 전파한다 (error — allowlist lookup 의존성 실패)", async () => {
      const { service, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockRejectedValueOnce(
        new Error("db-down"),
      );

      await expect(
        service.list({ sub: "user-1", role: "User" }),
      ).rejects.toThrow("db-down");
    });

    // Error path: non-Admin path 에서 allowlist 조회 성공 후 findMany reject 를 propagate.
    it("non-Admin path 의 findMany reject 를 swallow 없이 전파한다 (error — own-instance 조회 의존성 실패)", async () => {
      const { service, repo, uiaRepo } = buildService();
      uiaRepo.findInstanceRefsByUserId.mockResolvedValueOnce([
        "github.sec.samsung.net",
      ]);
      repo.findMany.mockRejectedValueOnce(new Error("db-down"));

      await expect(
        service.list({ sub: "user-1", role: "User" }),
      ).rejects.toThrow("db-down");
    });
  });
});
