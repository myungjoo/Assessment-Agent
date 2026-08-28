// ServiceIdentityController spec — T-1748(GET) + T-1749(POST) acceptance 박제.
//
// route 2 개(GET 목록 · POST 생성) 모두 순수 위임 handler 라 spec 도 그 분량에 맞춰 좁게
// 간다 (assessment.controller.spec 을 통째로 베끼지 않고 metadata 검증 관례만 승계).
// 구성: (1) 위임 동작 — mock service 로 happy / error / negative, (2) metadata 박제 —
// route method · guard stack 순서 · @Roles tier · @HttpCode 미부착 · controller-scope
// ValidationPipe 옵션 3 종.
//
// R-112 분기 축 메모: GET · POST handler 어느 쪽에도 **조건 분기가 없다**(순수 위임) —
// 코드 분기 test 는 해당 없음이며, 분기 축은 metadata 케이스(route method · @HttpCode
// 미부착 · @Roles tier 독립 · guard 순서)로 대체한다.
import {
  ConflictException,
  NotFoundException,
  RequestMethod,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ServiceIdentity } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import type { CreateServiceIdentityDto } from "./dto/create-service-identity.dto";
import { ServiceIdentityController } from "./service-identity.controller";
import type { ServiceIdentityService } from "./service-identity.service";

// ServiceIdentity fixture — schema.prisma 의 7 컬럼 default 채움 (type 단언 없이 전
// 컬럼을 채워 schema drift 를 컴파일로 잡는다 — service.spec 의 fixture 와 같은 형태).
function buildIdentityFixture(
  overrides: Partial<ServiceIdentity> = {},
): ServiceIdentity {
  return {
    id: "identity-1",
    personId: "person-1",
    service: "github.com",
    externalId: "octocat",
    isPrimary: true,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

// service mock — 5 메서드를 모두 깔아두고 findByPersonId 외 호출 0 을 negative 로 고정.
function buildServiceMock() {
  return {
    findByPersonId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setPrimary: jest.fn(),
    remove: jest.fn(),
  };
}

describe("ServiceIdentityController (위임 동작)", () => {
  let serviceMock: ReturnType<typeof buildServiceMock>;
  let controller: ServiceIdentityController;

  beforeEach(() => {
    serviceMock = buildServiceMock();
    controller = new ServiceIdentityController(
      serviceMock as unknown as ServiceIdentityService,
    );
  });

  // happy path — service 가 2 row 를 주면 controller 가 같은 배열을 가공 없이 반환.
  it("GET 목록: service 결과 배열을 가공 없이 그대로 반환하고 personId 를 그대로 전달한다", async () => {
    const rows = [
      buildIdentityFixture(),
      buildIdentityFixture({
        id: "identity-2",
        service: "ghe.example.com",
        externalId: "octocat-ghe",
        isPrimary: false,
      }),
    ];
    serviceMock.findByPersonId.mockResolvedValue(rows);

    const result = await controller.findByPersonId("person-1");

    // 동일 참조 — 복제 · 정렬 · 필터 0.
    expect(result).toBe(rows);
    expect(serviceMock.findByPersonId).toHaveBeenCalledTimes(1);
    expect(serviceMock.findByPersonId).toHaveBeenCalledWith("person-1");
  });

  // error path 1 — service 의 NotFoundException(Person 부재) 을 흡수 없이 전파.
  it("GET 목록: service 의 NotFoundException 을 변환·흡수 없이 그대로 전파한다", async () => {
    const error = new NotFoundException("person not found: missing-person");
    serviceMock.findByPersonId.mockRejectedValue(error);

    await expect(controller.findByPersonId("missing-person")).rejects.toBe(
      error,
    );
    expect(serviceMock.findByPersonId).toHaveBeenCalledWith("missing-person");
  });

  // error path 2 — HttpException 이 아닌 일반 Error 도 동일하게 raw forward.
  it("GET 목록: 일반 Error 도 그대로 전파한다 (controller 에 try/catch 없음)", async () => {
    const error = new Error("db down");
    serviceMock.findByPersonId.mockRejectedValue(error);

    await expect(controller.findByPersonId("person-1")).rejects.toBe(error);
  });

  // negative — 빈 문자열 personId 도 controller 가 가공(기본값 · 400 변환)하지 않고 전달.
  it("negative: 빈 문자열 personId 도 가공 없이 service 로 전달한다", async () => {
    serviceMock.findByPersonId.mockResolvedValue([]);

    await controller.findByPersonId("");

    expect(serviceMock.findByPersonId).toHaveBeenCalledWith("");
  });

  // negative — row 0 개는 예외가 아니라 빈 배열 200 (§Decision 1 GET 행).
  it("negative: service 가 빈 배열을 주면 빈 배열을 그대로 반환한다 (404 로 변환하지 않음)", async () => {
    serviceMock.findByPersonId.mockResolvedValue([]);

    const result = await controller.findByPersonId("person-1");

    expect(result).toEqual([]);
  });

  // negative — throw 후 후속 처리 0. 다른 service 메서드 호출 0 으로 단락 확인.
  it("negative: service throw 시 후속 처리 없이 단락한다 (다른 메서드 호출 0)", async () => {
    serviceMock.findByPersonId.mockRejectedValue(new NotFoundException("x"));

    await expect(controller.findByPersonId("person-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.setPrimary).not.toHaveBeenCalled();
    expect(serviceMock.remove).not.toHaveBeenCalled();
  });

  // negative — 성공 경로에서도 findByPersonId 외 collaborator 를 부르지 않는다.
  it("negative: 성공 경로에서도 findByPersonId 외 다른 collaborator 를 부르지 않는다", async () => {
    serviceMock.findByPersonId.mockResolvedValue([]);

    await controller.findByPersonId("person-1");

    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.setPrimary).not.toHaveBeenCalled();
    expect(serviceMock.remove).not.toHaveBeenCalled();
  });
});

// CreateServiceIdentityDto fixture — body 2 필드뿐 (§Decision 2 — `isPrimary` 없음).
function buildCreateDto(
  overrides: Partial<CreateServiceIdentityDto> = {},
): CreateServiceIdentityDto {
  return { service: "github.com", externalId: "octocat", ...overrides };
}

describe("ServiceIdentityController.create (POST 위임 동작)", () => {
  let serviceMock: ReturnType<typeof buildServiceMock>;
  let controller: ServiceIdentityController;

  beforeEach(() => {
    serviceMock = buildServiceMock();
    controller = new ServiceIdentityController(
      serviceMock as unknown as ServiceIdentityService,
    );
  });

  // happy path — (personId, dto) 를 그대로 위임하고 생성 row 를 동일 참조로 반환.
  it("POST 생성: service.create 에 (personId, dto) 를 그대로 전달하고 반환 row 를 가공 없이 돌려준다", async () => {
    const dto = buildCreateDto();
    const created = buildIdentityFixture();
    serviceMock.create.mockResolvedValue(created);

    const result = await controller.create("person-1", dto);

    // 동일 참조 — 복제 · envelope · 필드 추가 0.
    expect(result).toBe(created);
    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(serviceMock.create).toHaveBeenCalledWith("person-1", dto);
    // dto 객체 자체도 controller 가 변형하지 않는다.
    expect(dto).toEqual({ service: "github.com", externalId: "octocat" });
  });

  // error path 1 — `P2002` 변환 결과인 ConflictException(409) 을 동일 인스턴스로 전파.
  it("POST 생성: service 의 ConflictException(409) 을 동일 인스턴스로 그대로 전파한다", async () => {
    const error = new ConflictException(
      "service identity already exists: person-1/github.com",
    );
    serviceMock.create.mockRejectedValue(error);

    await expect(controller.create("person-1", buildCreateDto())).rejects.toBe(
      error,
    );
  });

  // error path 2 — Person 부재의 NotFoundException(404) 도 변환 없이 전파.
  it("POST 생성: service 의 NotFoundException(404) 을 동일 인스턴스로 그대로 전파한다", async () => {
    const error = new NotFoundException("person not found: missing-person");
    serviceMock.create.mockRejectedValue(error);

    await expect(
      controller.create("missing-person", buildCreateDto()),
    ).rejects.toBe(error);
    expect(serviceMock.create).toHaveBeenCalledWith(
      "missing-person",
      expect.any(Object),
    );
  });

  // error path 3 — HttpException 이 아닌 일반 Error 도 raw forward (try/catch 없음).
  it("POST 생성: 일반 Error 도 상태 변형 없이 그대로 전파한다", async () => {
    const error = new Error("db down");
    serviceMock.create.mockRejectedValue(error);

    await expect(controller.create("person-1", buildCreateDto())).rejects.toBe(
      error,
    );
  });

  // negative (i) — 빈 문자열 personId 도 controller 가 차단·가공하지 않고 위임한다
  // (검증 책임은 service 선검사 · ValidationPipe).
  it("negative: 빈 문자열 personId 도 가공·차단 없이 service.create 로 전달한다", async () => {
    serviceMock.create.mockResolvedValue(buildIdentityFixture());

    await controller.create("", buildCreateDto());

    expect(serviceMock.create).toHaveBeenCalledWith("", expect.any(Object));
  });

  // negative (ii) — throw 시 단락되어 반환값이 만들어지지 않는다.
  it("negative: service.create 가 throw 하면 단락되어 반환값이 만들어지지 않는다", async () => {
    serviceMock.create.mockRejectedValue(new ConflictException("dup"));

    let returned: unknown = "sentinel";
    await expect(
      (async () => {
        returned = await controller.create("person-1", buildCreateDto());
      })(),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(returned).toBe("sentinel");
  });

  // negative (iii) — POST 는 create 외 collaborator 를 부르지 않는다 (성공 · 실패 공통).
  it("negative: POST 성공 경로에서 create 외 다른 collaborator 호출 0 회", async () => {
    serviceMock.create.mockResolvedValue(buildIdentityFixture());

    await controller.create("person-1", buildCreateDto());

    expect(serviceMock.findByPersonId).not.toHaveBeenCalled();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.setPrimary).not.toHaveBeenCalled();
    expect(serviceMock.remove).not.toHaveBeenCalled();
  });

  it("negative: POST 실패 경로에서도 create 외 다른 collaborator 호출 0 회", async () => {
    serviceMock.create.mockRejectedValue(new Error("boom"));

    await expect(
      controller.create("person-1", buildCreateDto()),
    ).rejects.toThrow("boom");

    expect(serviceMock.findByPersonId).not.toHaveBeenCalled();
    expect(serviceMock.setPrimary).not.toHaveBeenCalled();
  });

  // negative (iv) — 응답을 envelope 로 감싸거나 필드를 덧붙이지 않는다 (키 집합 불변).
  it("negative: 응답을 감싸거나 필드를 덧붙이지 않는다 (반환 객체 키 집합 불변)", async () => {
    const created = buildIdentityFixture({ isPrimary: false });
    const keysBefore = Object.keys(created).sort();
    serviceMock.create.mockResolvedValue(created);

    const result = await controller.create("person-1", buildCreateDto());

    expect(Object.keys(result).sort()).toEqual(keysBefore);
    expect(result).not.toHaveProperty("data");
    expect(result).not.toHaveProperty("meta");
  });
});

describe("ServiceIdentityController (route · guard · pipe metadata)", () => {
  // base path — ADR-0058 §Decision 1 의 nested route shape 고정.
  it("base path 가 api/persons/:personId/identities 이다", () => {
    const path = Reflect.getMetadata("path", ServiceIdentityController) as
      | string
      | undefined;

    expect(path).toBe("api/persons/:personId/identities");
  });

  // 분기 축 (a) — @Roles("User") metadata 존재 (조회 User+ tier, §Decision 4).
  it('GET handler 에 @Roles("User") metadata 가 박혀 있다 (조회 User+ tier)', () => {
    const reflector = new Reflector();
    const roles = reflector.get<string[]>(
      ROLES_METADATA_KEY,
      ServiceIdentityController.prototype.findByPersonId,
    );

    expect(roles).toEqual(["User"]);
  });

  // 분기 축 (b) — 인증/권한 판정은 controller 코드가 아니라 guard layer 소관임을
  // guard 배열 순서로 고정. JwtAuthGuard(401) → RolesGuard(403) 순.
  it("GET handler 에 @UseGuards(JwtAuthGuard, RolesGuard) 가 이 순서로 부착돼 있다", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ServiceIdentityController.prototype.findByPersonId,
    ) as unknown[];

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  // 분기 축 (c) — POST handler 의 route method 가 RequestMethod.POST 로 박혀 있다.
  it("create handler 의 route method 가 POST 이다", () => {
    const method = Reflect.getMetadata(
      "method",
      ServiceIdentityController.prototype.create,
    ) as number | undefined;

    expect(method).toBe(RequestMethod.POST);
    // negative — GET handler 와 독립. 같은 controller 의 두 route 가 섞이지 않는다.
    expect(
      Reflect.getMetadata(
        "method",
        ServiceIdentityController.prototype.findByPersonId,
      ),
    ).toBe(RequestMethod.GET);
  });

  // 분기 축 (d) — @HttpCode 미부착 = NestJS POST 기본값 201 유지 (§Decision 1 POST 행).
  it("create handler 에 @HttpCode 가 부착돼 있지 않다 (기본 201 Created 유지)", () => {
    const httpCode = Reflect.getMetadata(
      "__httpCode__",
      ServiceIdentityController.prototype.create,
    ) as number | undefined;

    expect(httpCode).toBeUndefined();
  });

  // 분기 축 (e) — 편집 tier 는 Admin. GET 의 "User" 와 독립적으로 박제됨 (§Decision 4).
  it('create handler 에 @Roles("Admin") 이 박혀 있고 GET 의 "User" tier 와 독립이다', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        ServiceIdentityController.prototype.create,
      ),
    ).toEqual(["Admin"]);
    // negative — POST 배선이 GET 의 tier 를 덮어쓰지 않았다.
    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        ServiceIdentityController.prototype.findByPersonId,
      ),
    ).toEqual(["User"]);
  });

  // 분기 축 (f) — guard stack 이 GET 과 동일 순서 (JwtAuthGuard → RolesGuard).
  it("create handler 에 @UseGuards(JwtAuthGuard, RolesGuard) 가 GET 과 같은 순서로 부착돼 있다", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ServiceIdentityController.prototype.create,
    ) as unknown[];

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  // controller-scope ValidationPipe 옵션 3 종 고정 (§Decision 2 승계).
  it("controller-scope ValidationPipe 의 whitelist · forbidNonWhitelisted · transform 이 모두 true 이다", () => {
    const pipes = Reflect.getMetadata(
      "__pipes__",
      ServiceIdentityController,
    ) as Array<{
      validatorOptions?: {
        whitelist?: boolean;
        forbidNonWhitelisted?: boolean;
      };
      isTransformEnabled?: boolean;
    }>;

    expect(pipes).toHaveLength(1);
    expect(pipes[0]?.validatorOptions?.whitelist).toBe(true);
    expect(pipes[0]?.validatorOptions?.forbidNonWhitelisted).toBe(true);
    expect(pipes[0]?.isTransformEnabled).toBe(true);
  });
});
