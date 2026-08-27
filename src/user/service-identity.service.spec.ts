// ServiceIdentityService spec — T-1741 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PersonRepository / ServiceIdentityRepository 를 Jest mock 으로 대체해
// PostgreSQL 없이 isolated 하게 실행된다. 검증 포인트:
//   - happy: Person 존재 + identity N row → repository 결과 그대로 반환, 인자 정합성.
//   - branch: identity 0 row (ADR-0058 §Decision 2 의 `N = 0` 정상 상태) / 2+ row /
//     Person 부재 3 분기.
//   - error: Person 부재 → NotFoundException 이고, 그때 ServiceIdentityRepository 는
//     **호출되지 않음** (선검사가 실제로 선행함을 고정).
//   - negative: 각 collaborator 의 throw propagate (변환 0) · 반환 배열 무가공 drift
//     guard · soft-deleted (`active=false`) Person 도 404 아님.
import { NotFoundException } from "@nestjs/common";
import type { Person, ServiceIdentity } from "@prisma/client";

import type { PersonRepository } from "./person.repository";
import type { ServiceIdentityRepository } from "./service-identity.repository";
import { ServiceIdentityService } from "./service-identity.service";

// Person fixture — active 기본 true. soft delete 분기는 overrides 로 false 지정.
// 반환 타입을 Person 으로 명시하되 `as` 단언은 쓰지 않는다 — schema 에 컬럼이
// 늘면 본 fixture 가 compile error 로 drift 를 알려야 하기 때문이다.
function buildPersonFixture(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-1",
    fullName: "홍길동",
    email: "hong@example.com",
    active: true,
    partId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ServiceIdentity fixture — schema.prisma 의 7 컬럼을 모두 채운 default row.
function buildServiceIdentityFixture(
  overrides: Partial<ServiceIdentity> = {},
): ServiceIdentity {
  return {
    id: "si-1",
    personId: "person-1",
    service: "github.com",
    externalId: "external-1",
    isPrimary: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// collaborator mock factory — test 마다 새 instance 를 만들어 호출 카운터를 격리.
function buildHarness(): {
  service: ServiceIdentityService;
  personFindById: jest.Mock;
  identityFindByPersonId: jest.Mock;
} {
  const personFindById = jest.fn();
  const identityFindByPersonId = jest.fn();
  const personRepository = {
    findById: personFindById,
  } as unknown as PersonRepository;
  const serviceIdentityRepository = {
    findByPersonId: identityFindByPersonId,
  } as unknown as ServiceIdentityRepository;

  return {
    service: new ServiceIdentityService(
      personRepository,
      serviceIdentityRepository,
    ),
    personFindById,
    identityFindByPersonId,
  };
}

describe("ServiceIdentityService", () => {
  describe("findByPersonId — happy path", () => {
    it("Person 이 존재하면 repository 결과 배열을 그대로 반환한다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      const rows = [
        buildServiceIdentityFixture({ id: "si-1", isPrimary: true }),
        buildServiceIdentityFixture({ id: "si-2", service: "gitlab.com" }),
      ];
      personFindById.mockResolvedValue(buildPersonFixture());
      identityFindByPersonId.mockResolvedValue(rows);

      await expect(service.findByPersonId("person-1")).resolves.toBe(rows);
    });

    it("선검사와 목록 조회를 각각 인자 personId 로 정확히 1 회 호출한다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      personFindById.mockResolvedValue(buildPersonFixture({ id: "person-9" }));
      identityFindByPersonId.mockResolvedValue([]);

      await service.findByPersonId("person-9");

      expect(personFindById).toHaveBeenCalledTimes(1);
      expect(personFindById).toHaveBeenCalledWith("person-9");
      expect(identityFindByPersonId).toHaveBeenCalledTimes(1);
      expect(identityFindByPersonId).toHaveBeenCalledWith("person-9");
    });
  });

  describe("findByPersonId — 분기 cover", () => {
    it("(a) Person 존재 + identity 0 row 면 빈 배열을 반환한다 (ADR-0058 §Decision 2 의 N = 0 정상 상태)", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      personFindById.mockResolvedValue(buildPersonFixture());
      identityFindByPersonId.mockResolvedValue([]);

      await expect(service.findByPersonId("person-1")).resolves.toEqual([]);
    });

    it("(b) Person 존재 + identity 2+ row 면 전 row 를 반환한다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      const rows = [
        buildServiceIdentityFixture({ id: "si-1" }),
        buildServiceIdentityFixture({ id: "si-2" }),
        buildServiceIdentityFixture({ id: "si-3" }),
      ];
      personFindById.mockResolvedValue(buildPersonFixture());
      identityFindByPersonId.mockResolvedValue(rows);

      await expect(service.findByPersonId("person-1")).resolves.toHaveLength(3);
    });

    it("(c) Person 부재면 NotFoundException 을 던진다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      personFindById.mockResolvedValue(null);

      await expect(service.findByPersonId("ghost")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(identityFindByPersonId).not.toHaveBeenCalled();
    });
  });

  describe("findByPersonId — negative cases", () => {
    it("(i) Person 부재 시 예외 메시지에 personId 가 담기고 목록 조회는 호출되지 않는다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      personFindById.mockResolvedValue(null);

      await expect(service.findByPersonId("ghost")).rejects.toThrow(
        "person not found: ghost",
      );
      expect(identityFindByPersonId).not.toHaveBeenCalled();
    });

    it("(ii) PersonRepository.findById 가 throw 하면 삼키지 않고 그대로 propagate 한다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      const boom = new Error("person lookup failed");
      personFindById.mockRejectedValue(boom);

      await expect(service.findByPersonId("person-1")).rejects.toBe(boom);
      expect(identityFindByPersonId).not.toHaveBeenCalled();
    });

    it("(iii) ServiceIdentityRepository.findByPersonId 가 throw 하면 변환 없이 그대로 propagate 한다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      const boom = Object.assign(new Error("db down"), { code: "P1001" });
      personFindById.mockResolvedValue(buildPersonFixture());
      identityFindByPersonId.mockRejectedValue(boom);

      await expect(service.findByPersonId("person-1")).rejects.toBe(boom);
      await expect(
        service.findByPersonId("person-1"),
      ).rejects.not.toBeInstanceOf(NotFoundException);
    });

    it("(iv) 반환 배열을 정렬 · 필터 · 복제 변형하지 않는다 (drift guard)", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      // 일부러 역순 · isPrimary 혼재 배열을 준다 — 정렬을 도입하면 본 test 가 깨진다.
      const first = buildServiceIdentityFixture({
        id: "si-z",
        isPrimary: false,
      });
      const second = buildServiceIdentityFixture({
        id: "si-a",
        isPrimary: true,
      });
      const rows = [first, second];
      personFindById.mockResolvedValue(buildPersonFixture());
      identityFindByPersonId.mockResolvedValue(rows);

      const result = await service.findByPersonId("person-1");

      expect(result).toBe(rows);
      expect(result[0]).toBe(first);
      expect(result[1]).toBe(second);
      expect(result.map((row) => row.id)).toEqual(["si-z", "si-a"]);
    });

    it("(v) active=false 인 soft-deleted Person 도 404 가 아니라 정상 목록 경로를 탄다", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      const rows = [buildServiceIdentityFixture()];
      personFindById.mockResolvedValue(buildPersonFixture({ active: false }));
      identityFindByPersonId.mockResolvedValue(rows);

      await expect(service.findByPersonId("person-1")).resolves.toBe(rows);
      expect(identityFindByPersonId).toHaveBeenCalledWith("person-1");
    });

    it("(vi) 빈 문자열 personId 도 검증 없이 선검사로 forward 된다 (검증은 DTO / controller 책임)", async () => {
      const { service, personFindById, identityFindByPersonId } =
        buildHarness();
      personFindById.mockResolvedValue(null);

      await expect(service.findByPersonId("")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(personFindById).toHaveBeenCalledWith("");
      expect(identityFindByPersonId).not.toHaveBeenCalled();
    });
  });
});
