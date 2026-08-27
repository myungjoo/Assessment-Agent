// ServiceIdentityService spec — T-1741 (findByPersonId) + T-1742 (create) + T-1743
// (update) + T-1744 (setPrimary) acceptance
// (R-112: happy / error / branch / negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PersonRepository / ServiceIdentityRepository 를 Jest mock 으로 대체해
// PostgreSQL 없이 isolated 하게 실행된다. 검증 포인트:
//   - happy: Person 존재 + identity N row → repository 결과 그대로 반환, 인자 정합성.
//   - branch: identity 0 row (ADR-0058 §Decision 2 의 `N = 0` 정상 상태) / 2+ row /
//     Person 부재 3 분기.
//   - error: Person 부재 → NotFoundException 이고, 그때 ServiceIdentityRepository 는
//     **호출되지 않음** (선검사가 실제로 선행함을 고정).
//   - negative: 각 collaborator 의 throw propagate (변환 0) · 반환 배열 무가공 drift
//     guard · soft-deleted (`active=false`) Person 도 404 아님 · 타 Person 소유 id 는
//     403 이 아니라 404 이고 메시지에 소유자 정보가 새지 않음 (ADR-0058 §Decision 5 e).
//   - setPrimary: 이미 primary 인 대상도 early return 없이 repository.setPrimary 1 회
//     호출 (idempotent) · 2 op transaction 재구현 0 guard (repository.update 미호출).
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Person, ServiceIdentity } from "@prisma/client";

import type { CreateServiceIdentityDto } from "./dto/create-service-identity.dto";
import type { UpdateServiceIdentityDto } from "./dto/update-service-identity.dto";
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
  identityCreate: jest.Mock;
  identityUpdate: jest.Mock;
  identitySetPrimary: jest.Mock;
} {
  const personFindById = jest.fn();
  const identityFindByPersonId = jest.fn();
  const identityCreate = jest.fn();
  const identityUpdate = jest.fn();
  const identitySetPrimary = jest.fn();
  const personRepository = {
    findById: personFindById,
  } as unknown as PersonRepository;
  const serviceIdentityRepository = {
    findByPersonId: identityFindByPersonId,
    create: identityCreate,
    update: identityUpdate,
    setPrimary: identitySetPrimary,
  } as unknown as ServiceIdentityRepository;

  return {
    service: new ServiceIdentityService(
      personRepository,
      serviceIdentityRepository,
    ),
    personFindById,
    identityFindByPersonId,
    identityCreate,
    identityUpdate,
    identitySetPrimary,
  };
}

function buildCreateDto(
  overrides: Partial<CreateServiceIdentityDto> = {},
): CreateServiceIdentityDto {
  return { service: "github.com", externalId: "external-1", ...overrides };
}

function buildUpdateDto(
  overrides: Partial<UpdateServiceIdentityDto> = {},
): UpdateServiceIdentityDto {
  return { externalId: "external-2", ...overrides };
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
  describe("create — happy path", () => {
    it("기존 row 2 개인 Person 에 추가하면 create 인자에 isPrimary 키가 없고 setPrimary 미호출 + 생성 row 를 그대로 반환한다", async () => {
      const h = buildHarness();
      const created = buildServiceIdentityFixture({ id: "si-new" });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-1", isPrimary: true }),
        buildServiceIdentityFixture({ id: "si-2", service: "gitlab.com" }),
      ]);
      h.identityCreate.mockResolvedValue(created);

      await expect(
        h.service.create(
          "person-1",
          buildCreateDto({ service: "ghe.corp", externalId: "ext-9" }),
        ),
      ).resolves.toBe(created);

      expect(h.identityCreate).toHaveBeenCalledTimes(1);
      expect(h.identityCreate).toHaveBeenCalledWith({
        personId: "person-1",
        service: "ghe.corp",
        externalId: "ext-9",
      });
      expect(Object.keys(h.identityCreate.mock.calls[0][0]).sort()).toEqual([
        "externalId",
        "personId",
        "service",
      ]);
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });
  });

  describe("create — 분기 cover", () => {
    it("(a) 기존 row 0 개면 setPrimary 를 1 회 호출하고 그 반환값을 최종 반환한다", async () => {
      const h = buildHarness();
      const promoted = buildServiceIdentityFixture({
        id: "si-new",
        isPrimary: true,
      });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);
      h.identityCreate.mockResolvedValue(
        buildServiceIdentityFixture({ id: "si-new" }),
      );
      h.identitySetPrimary.mockResolvedValue(promoted);

      await expect(
        h.service.create("person-1", buildCreateDto()),
      ).resolves.toBe(promoted);
      expect(h.identitySetPrimary).toHaveBeenCalledTimes(1);
      expect(h.identitySetPrimary).toHaveBeenCalledWith("person-1", "si-new");
    });

    it("(b) 기존 row 1 개면 setPrimary 미호출 + create 반환값이 최종 반환값이다", async () => {
      const h = buildHarness();
      const created = buildServiceIdentityFixture({ id: "si-new" });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-1", isPrimary: true }),
      ]);
      h.identityCreate.mockResolvedValue(created);

      await expect(
        h.service.create("person-1", buildCreateDto()),
      ).resolves.toBe(created);
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(c) create 가 P2002 를 던지면 ConflictException 으로 변환한다 (409)", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);
      h.identityCreate.mockRejectedValue(
        Object.assign(new Error("unique constraint"), { code: "P2002" }),
      );

      await expect(
        h.service.create("person-1", buildCreateDto()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(d) create 가 P2002 외 code 를 던지면 변환 없이 원 오류를 propagate 한다", async () => {
      const h = buildHarness();
      const boom = Object.assign(new Error("db down"), { code: "P1001" });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);
      h.identityCreate.mockRejectedValue(boom);

      await expect(h.service.create("person-1", buildCreateDto())).rejects.toBe(
        boom,
      );
    });
  });

  describe("create — error path / negative cases", () => {
    it("(i) Person 부재면 NotFoundException 이고 create · setPrimary 가 둘 다 호출되지 않는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(null);

      await expect(h.service.create("ghost", buildCreateDto())).rejects.toThrow(
        "person not found: ghost",
      );
      expect(h.identityFindByPersonId).not.toHaveBeenCalled();
      expect(h.identityCreate).not.toHaveBeenCalled();
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(ii) P2002 변환 결과는 ConflictException 이며 NotFoundException 이 아니다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);
      h.identityCreate.mockRejectedValue(
        Object.assign(new Error("unique constraint"), { code: "P2002" }),
      );

      await expect(
        h.service.create("person-1", buildCreateDto()),
      ).rejects.not.toBeInstanceOf(NotFoundException);
      await expect(
        h.service.create("person-1", buildCreateDto()),
      ).rejects.toThrow("service identity already exists: person-1/github.com");
    });

    it("(iii) code 가 P2025 이거나 code 가 없는 · string 이 아닌 오류는 원형 그대로 propagate 한다", async () => {
      const errors = [
        Object.assign(new Error("record not found"), { code: "P2025" }),
        new Error("plain failure"),
        Object.assign(new Error("numeric code"), { code: 2002 }),
      ];

      for (const boom of errors) {
        const h = buildHarness();
        h.personFindById.mockResolvedValue(buildPersonFixture());
        h.identityFindByPersonId.mockResolvedValue([]);
        h.identityCreate.mockRejectedValue(boom);

        await expect(
          h.service.create("person-1", buildCreateDto()),
        ).rejects.toBe(boom);
      }
    });

    it("(iv) setPrimary 가 throw 하면 승격 실패를 삼키지 않고 propagate 한다", async () => {
      const h = buildHarness();
      const boom = Object.assign(new Error("promotion failed"), {
        code: "P2025",
      });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);
      h.identityCreate.mockResolvedValue(
        buildServiceIdentityFixture({ id: "si-new" }),
      );
      h.identitySetPrimary.mockRejectedValue(boom);

      await expect(h.service.create("person-1", buildCreateDto())).rejects.toBe(
        boom,
      );
    });

    it("(v) PersonRepository.findById 가 throw 하면 그대로 propagate 하고 이후 경로를 타지 않는다", async () => {
      const h = buildHarness();
      const boom = new Error("person lookup failed");
      h.personFindById.mockRejectedValue(boom);

      await expect(h.service.create("person-1", buildCreateDto())).rejects.toBe(
        boom,
      );
      expect(h.identityFindByPersonId).not.toHaveBeenCalled();
      expect(h.identityCreate).not.toHaveBeenCalled();
    });

    it("(vi) active=false 인 soft-deleted Person 도 404 가 아니라 정상 create 경로를 탄다 (drift guard)", async () => {
      const h = buildHarness();
      const promoted = buildServiceIdentityFixture({
        id: "si-new",
        isPrimary: true,
      });
      h.personFindById.mockResolvedValue(buildPersonFixture({ active: false }));
      h.identityFindByPersonId.mockResolvedValue([]);
      h.identityCreate.mockResolvedValue(
        buildServiceIdentityFixture({ id: "si-new" }),
      );
      h.identitySetPrimary.mockResolvedValue(promoted);

      await expect(
        h.service.create("person-1", buildCreateDto()),
      ).resolves.toBe(promoted);
    });
  });

  describe("update — happy path", () => {
    it("본인 소유 identity 에 externalId 를 전달하면 repository.update 결과를 가공 없이 반환한다", async () => {
      const h = buildHarness();
      const updated = buildServiceIdentityFixture({ externalId: "external-2" });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identityUpdate.mockResolvedValue(updated);

      await expect(
        h.service.update("person-1", "si-1", buildUpdateDto()),
      ).resolves.toBe(updated);
    });

    it("repository.update 를 (identityId, { externalId }) 인자로 정확히 1 회 호출한다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-7" }),
      ]);
      h.identityUpdate.mockResolvedValue(buildServiceIdentityFixture());

      await h.service.update(
        "person-1",
        "si-7",
        buildUpdateDto({ externalId: "renamed" }),
      );

      expect(h.identityUpdate).toHaveBeenCalledTimes(1);
      expect(h.identityUpdate).toHaveBeenCalledWith("si-7", {
        externalId: "renamed",
      });
      // 금지 축 (`service` · `isPrimary` · `personId`) 이 data 로 새지 않는지 고정.
      expect(Object.keys(h.identityUpdate.mock.calls[0][1])).toEqual([
        "externalId",
      ]);
    });
  });

  describe("update — 분기 cover", () => {
    it("(a) Person 부재면 NotFoundException 이고 ServiceIdentityRepository 는 미호출", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(null);

      await expect(
        h.service.update("ghost", "si-1", buildUpdateDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identityFindByPersonId).not.toHaveBeenCalled();
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it("(b) 소유 목록에 identityId 가 없으면 NotFoundException 이고 update 미호출", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-1" }),
      ]);

      await expect(
        h.service.update("person-1", "si-none", buildUpdateDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it("(c) externalId 미전달이면 update 를 호출하지 않고 현재 row 를 그대로 반환한다 (RFC-7396 보존)", async () => {
      const h = buildHarness();
      const current = buildServiceIdentityFixture({ id: "si-1" });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-0" }),
        current,
      ]);

      await expect(h.service.update("person-1", "si-1", {})).resolves.toBe(
        current,
      );
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it("(d) 정상 갱신 분기는 선검사 · 소유 조회 · update 를 각 1 회씩 탄다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identityUpdate.mockResolvedValue(buildServiceIdentityFixture());

      await h.service.update("person-1", "si-1", buildUpdateDto());

      expect(h.personFindById).toHaveBeenCalledTimes(1);
      expect(h.identityFindByPersonId).toHaveBeenCalledTimes(1);
      expect(h.identityFindByPersonId).toHaveBeenCalledWith("person-1");
      expect(h.identityUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe("update — error path / negative cases", () => {
    it("(i) Person 부재 예외 메시지는 personId 만 담는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(null);

      await expect(
        h.service.update("ghost", "si-1", buildUpdateDto()),
      ).rejects.toThrow("person not found: ghost");
    });

    it("(ii) repository.update 의 P2025 는 NotFoundException (404) 으로 변환된다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identityUpdate.mockRejectedValue(
        Object.assign(new Error("record not found"), { code: "P2025" }),
      );

      await expect(
        h.service.update("person-1", "si-1", buildUpdateDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("(iii) 타 Person 소유 id 는 403 이 아니라 404 이며 메시지에 존재 사실 · 소유자가 새지 않는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      // person-1 의 목록에는 si-other (person-2 소유) 가 없다.
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-1" }),
      ]);

      const error = await h.service
        .update("person-1", "si-other", buildUpdateDto())
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getStatus()).toBe(404);
      const message = (error as Error).message;
      expect(message).toBe("service identity not found: si-other");
      expect(message).not.toContain("person-2");
      expect(message).not.toContain("forbidden");
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it("(iv) identityId 가 빈 문자열이면 404 이고 update 는 호출되지 않는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);

      await expect(
        h.service.update("person-1", "", buildUpdateDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it("(v) 해당 Person 의 identity 목록이 빈 배열이면 404", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);

      await expect(
        h.service.update("person-1", "si-1", buildUpdateDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it.each([
      [
        "P2002 (unique 위반)",
        Object.assign(new Error("dup"), { code: "P2002" }),
      ],
      ["code 없는 일반 Error", new Error("update failed")],
    ])(
      "(vi) repository.update 의 %s 는 변환 없이 그대로 propagate 한다",
      async (_label, boom) => {
        const h = buildHarness();
        h.personFindById.mockResolvedValue(buildPersonFixture());
        h.identityFindByPersonId.mockResolvedValue([
          buildServiceIdentityFixture(),
        ]);
        h.identityUpdate.mockRejectedValue(boom);

        await expect(
          h.service.update("person-1", "si-1", buildUpdateDto()),
        ).rejects.toBe(boom);
      },
    );

    it("(vii) PersonRepository.findById 자체의 throw 는 그대로 propagate 하고 이후 경로를 타지 않는다", async () => {
      const h = buildHarness();
      const boom = new Error("person lookup failed");
      h.personFindById.mockRejectedValue(boom);

      await expect(
        h.service.update("person-1", "si-1", buildUpdateDto()),
      ).rejects.toBe(boom);
      expect(h.identityFindByPersonId).not.toHaveBeenCalled();
      expect(h.identityUpdate).not.toHaveBeenCalled();
    });

    it("(viii) dto 가 {} 일 때 repository.update 호출 0 회 drift guard", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);

      await h.service.update("person-1", "si-1", {});

      expect(h.identityUpdate).toHaveBeenCalledTimes(0);
    });
  });

  describe("setPrimary — happy path", () => {
    it("본인 소유 identity 를 지정하면 repository.setPrimary 결과를 가공 없이 반환한다", async () => {
      const h = buildHarness();
      const promoted = buildServiceIdentityFixture({ isPrimary: true });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identitySetPrimary.mockResolvedValue(promoted);

      await expect(h.service.setPrimary("person-1", "si-1")).resolves.toBe(
        promoted,
      );
    });

    it("repository.setPrimary 를 (personId, identityId) 인자로 정확히 1 회 호출한다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(
        buildPersonFixture({ id: "person-9" }),
      );
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-7", personId: "person-9" }),
      ]);
      h.identitySetPrimary.mockResolvedValue(
        buildServiceIdentityFixture({ id: "si-7", isPrimary: true }),
      );

      await h.service.setPrimary("person-9", "si-7");

      expect(h.personFindById).toHaveBeenCalledTimes(1);
      expect(h.personFindById).toHaveBeenCalledWith("person-9");
      expect(h.identityFindByPersonId).toHaveBeenCalledTimes(1);
      expect(h.identityFindByPersonId).toHaveBeenCalledWith("person-9");
      expect(h.identitySetPrimary).toHaveBeenCalledTimes(1);
      expect(h.identitySetPrimary).toHaveBeenCalledWith("person-9", "si-7");
    });
  });

  describe("setPrimary — 분기 cover", () => {
    it("(a) Person 부재면 NotFoundException 이고 ServiceIdentityRepository 는 미호출", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(null);

      await expect(
        h.service.setPrimary("ghost", "si-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identityFindByPersonId).not.toHaveBeenCalled();
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(b) 소유 목록에 identityId 가 없으면 NotFoundException 이고 setPrimary 미호출", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-1" }),
      ]);

      await expect(
        h.service.setPrimary("person-1", "si-none"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(c) 대상이 이미 isPrimary=true 여도 early return 없이 setPrimary 를 1 회 호출한다 (idempotent)", async () => {
      const h = buildHarness();
      const already = buildServiceIdentityFixture({
        id: "si-1",
        isPrimary: true,
      });
      // 다른 row 가 잘못 primary 로 남은 상태 — early return 이 있으면 이 복구가 막힌다.
      const strayPrimary = buildServiceIdentityFixture({
        id: "si-2",
        service: "gitlab.com",
        isPrimary: true,
      });
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([already, strayPrimary]);
      h.identitySetPrimary.mockResolvedValue(already);

      await expect(h.service.setPrimary("person-1", "si-1")).resolves.toBe(
        already,
      );
      expect(h.identitySetPrimary).toHaveBeenCalledTimes(1);
      expect(h.identitySetPrimary).toHaveBeenCalledWith("person-1", "si-1");
    });

    it("(d) 대상이 isPrimary=false 인 정상 승격 분기는 선검사 · 소유 조회 · setPrimary 를 각 1 회씩 탄다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-0", isPrimary: true }),
        buildServiceIdentityFixture({ id: "si-1", isPrimary: false }),
      ]);
      h.identitySetPrimary.mockResolvedValue(
        buildServiceIdentityFixture({ id: "si-1", isPrimary: true }),
      );

      await h.service.setPrimary("person-1", "si-1");

      expect(h.personFindById).toHaveBeenCalledTimes(1);
      expect(h.identityFindByPersonId).toHaveBeenCalledTimes(1);
      expect(h.identitySetPrimary).toHaveBeenCalledTimes(1);
    });
  });

  describe("setPrimary — error path / negative cases", () => {
    it("(i) Person 부재 예외 메시지는 personId 만 담는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(null);

      await expect(h.service.setPrimary("ghost", "si-1")).rejects.toThrow(
        "person not found: ghost",
      );
    });

    it("(ii) repository.setPrimary 의 P2025 는 NotFoundException (404) 으로 변환된다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identitySetPrimary.mockRejectedValue(
        Object.assign(new Error("record not found"), { code: "P2025" }),
      );

      const error = await h.service
        .setPrimary("person-1", "si-1")
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getStatus()).toBe(404);
      expect((error as Error).message).toBe("service identity not found: si-1");
    });

    it("(iii) 타 Person 소유 id 는 403 이 아니라 404 이며 메시지에 존재 사실 · 소유자가 새지 않는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      // person-1 의 목록에는 si-other (person-2 소유) 가 없다.
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture({ id: "si-1" }),
      ]);

      const error = await h.service
        .setPrimary("person-1", "si-other")
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getStatus()).toBe(404);
      const message = (error as Error).message;
      expect(message).toBe("service identity not found: si-other");
      expect(message).not.toContain("person-2");
      expect(message).not.toContain("forbidden");
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(iv) 해당 Person 의 identity 목록이 빈 배열이면 404 이고 setPrimary 미호출", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([]);

      await expect(
        h.service.setPrimary("person-1", "si-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it.each([
      ["P2002", Object.assign(new Error("dup"), { code: "P2002" })],
      ["code 없는 일반 Error", new Error("transaction failed")],
    ])(
      "(v) repository.setPrimary 의 %s 는 변환 없이 그대로 propagate 한다",
      async (_label, boom) => {
        const h = buildHarness();
        h.personFindById.mockResolvedValue(buildPersonFixture());
        h.identityFindByPersonId.mockResolvedValue([
          buildServiceIdentityFixture(),
        ]);
        h.identitySetPrimary.mockRejectedValue(boom);

        await expect(h.service.setPrimary("person-1", "si-1")).rejects.toBe(
          boom,
        );
      },
    );

    it("(vi) PersonRepository.findById 자체의 throw 는 그대로 propagate 하고 이후 경로를 타지 않는다", async () => {
      const h = buildHarness();
      const boom = new Error("person lookup failed");
      h.personFindById.mockRejectedValue(boom);

      await expect(h.service.setPrimary("person-1", "si-1")).rejects.toBe(boom);
      expect(h.identityFindByPersonId).not.toHaveBeenCalled();
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(vii) findByPersonId 자체의 throw 는 그대로 propagate 하고 setPrimary 는 미호출", async () => {
      const h = buildHarness();
      const boom = new Error("identity lookup failed");
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockRejectedValue(boom);

      await expect(h.service.setPrimary("person-1", "si-1")).rejects.toBe(boom);
      expect(h.identitySetPrimary).not.toHaveBeenCalled();
    });

    it("(viii) soft-deleted Person (active=false) 도 row 가 존재하면 404 가 아니다", async () => {
      const h = buildHarness();
      const promoted = buildServiceIdentityFixture({ isPrimary: true });
      h.personFindById.mockResolvedValue(buildPersonFixture({ active: false }));
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identitySetPrimary.mockResolvedValue(promoted);

      await expect(h.service.setPrimary("person-1", "si-1")).resolves.toBe(
        promoted,
      );
    });

    it("(ix) transaction 재구현 0 drift guard — 본 경로에서 repository.update · create 는 호출되지 않는다", async () => {
      const h = buildHarness();
      h.personFindById.mockResolvedValue(buildPersonFixture());
      h.identityFindByPersonId.mockResolvedValue([
        buildServiceIdentityFixture(),
      ]);
      h.identitySetPrimary.mockResolvedValue(
        buildServiceIdentityFixture({ isPrimary: true }),
      );

      await h.service.setPrimary("person-1", "si-1");

      expect(h.identityUpdate).not.toHaveBeenCalled();
      expect(h.identityCreate).not.toHaveBeenCalled();
    });
  });
});
