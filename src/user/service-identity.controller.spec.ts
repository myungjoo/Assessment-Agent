// ServiceIdentityController spec — T-1748 acceptance 박제.
//
// route 1 개(GET 목록) + 순수 위임 handler 라 spec 도 그 분량에 맞춰 좁게 간다
// (assessment.controller.spec 을 통째로 베끼지 않고 metadata 검증 관례만 승계).
// 구성: (1) 위임 동작 — mock service 로 happy / error / negative, (2) metadata 박제 —
// guard stack 순서 · @Roles("User") · controller-scope ValidationPipe 옵션 3 종.
//
// R-112 분기 축 메모: GET handler 에는 **조건 분기가 없다**(순수 위임) — 코드 분기
// test 는 해당 없음이며, 분기 축은 guard tier metadata 2 케이스로 대체한다.
import { NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ServiceIdentity } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { ServiceIdentityController } from "./service-identity.controller";
import type { ServiceIdentityService } from "./service-identity.service";

// ServiceIdentity fixture — schema.prisma 의 6 컬럼 default 채움.
function buildIdentityFixture(
  overrides: Partial<ServiceIdentity> = {},
): ServiceIdentity {
  return {
    id: "identity-1",
    personId: "person-1",
    service: "GITHUB",
    externalId: "octocat",
    isPrimary: true,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  } as ServiceIdentity;
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
        service: "GHE",
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
