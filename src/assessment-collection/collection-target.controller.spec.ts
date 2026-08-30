// CollectionTargetController spec — T-1814(골격 + 조회 tier 2 route) acceptance 박제.
//
// 두 handler(GET 목록 · GET 단건) 모두 순수 위임이라 spec 도 그 분량에 맞춰 좁게 간다
// (ServiceIdentityController spec 의 관례만 승계 — mock service 위임 검증 + decorator
// metadata drift guard).
// 구성: (1) 위임 동작 — mock service 로 happy / error / negative, (2) metadata 박제 —
// controller base path · route method · guard stack 순서 · @Roles tier · controller-scope
// ValidationPipe 옵션 3 종 · 편집 tier handler 부재.
//
// R-112 분기 축 메모: `findAll` · `findById` 어느 쪽에도 **조건 분기가 없다**(둘 다
// service 로의 무가공 위임 한 줄) — 코드 분기 test 는 해당 없음이다. 대신 ADR-0059
// §Decision 5 GET 행이 규정한 두 경로("0 row → 빈 배열 200, 예외 아님" 과 "row 존재 →
// 배열 1+")를 각각 test 로 고정하고, 나머지 분기 축은 metadata 케이스(route method ·
// path param 축 · @Roles tier · guard 순서 · 편집 handler 부재)로 대체 배치한다.
import { NotFoundException, RequestMethod } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CollectionTarget } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CollectionTargetController } from "./collection-target.controller";
import type { CollectionTargetService } from "./collection-target.service";

// CollectionTarget fixture — schema.prisma 의 10 컬럼을 전부 채운다(type 단언 없이 채워
// schema drift 를 컴파일로 잡는 service.spec 과 같은 형태).
function buildTargetFixture(
  overrides: Partial<CollectionTarget> = {},
): CollectionTarget {
  return {
    id: "target-1",
    type: "GITHUB",
    instanceKey: "default",
    endpoint: "https://github.com",
    orgs: ["acme"],
    repos: [],
    spaces: [],
    active: true,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

// service mock — 5 메서드를 모두 깔아두고, 조회 2 메서드 외 호출 0 을 negative 로 고정한다
// (본 slice 는 편집 3 route 를 노출하지 않으므로 create / update / delete 는 절대 불림 없음).
function buildServiceMock() {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

describe("CollectionTargetController (위임 동작)", () => {
  let serviceMock: ReturnType<typeof buildServiceMock>;
  let controller: CollectionTargetController;

  beforeEach(() => {
    serviceMock = buildServiceMock();
    controller = new CollectionTargetController(
      serviceMock as unknown as CollectionTargetService,
    );
  });

  // happy path 1 — service 가 2 row 를 주면 controller 가 같은 배열을 가공 없이 반환.
  // 경로 축 "row 존재 → 배열 1+" 을 함께 고정한다.
  it("GET 목록: service 결과 배열을 가공 없이 그대로 반환한다 (동일 참조)", async () => {
    const rows = [
      buildTargetFixture(),
      buildTargetFixture({
        id: "target-2",
        type: "CONFLUENCE",
        instanceKey: "wiki",
        endpoint: "https://wiki.example.com",
        orgs: [],
        spaces: ["ENG"],
      }),
    ];
    serviceMock.findAll.mockResolvedValue(rows);

    const result = await controller.findAll();

    // 동일 참조 — 복제 · 정렬 · 필터 0 (negative (c)).
    expect(result).toBe(rows);
    expect(result).toHaveLength(2);
  });

  // happy path 2 — 단건도 가공 없이 그대로 반환.
  it("GET 단건: service 가 준 row 를 가공 없이 그대로 반환한다 (동일 참조)", async () => {
    const row = buildTargetFixture();
    serviceMock.findById.mockResolvedValue(row);

    const result = await controller.findById("target-1");

    expect(result).toBe(row);
    expect(serviceMock.findById).toHaveBeenCalledTimes(1);
    expect(serviceMock.findById).toHaveBeenCalledWith("target-1");
  });

  // 경로 축 — 0 row 는 예외가 아니라 빈 배열 200 (ADR-0059 §Decision 5 GET 행).
  it("GET 목록: service 가 빈 배열을 주면 빈 배열을 그대로 반환한다 (404 로 변환하지 않음)", async () => {
    const rows: CollectionTarget[] = [];
    serviceMock.findAll.mockResolvedValue(rows);

    const result = await controller.findAll();

    expect(result).toBe(rows);
    expect(result).toEqual([]);
  });

  // error path 1 — findById 의 NotFoundException(오류 표 d 행) 을 흡수 없이 전파.
  it("GET 단건: service 의 NotFoundException 을 변환·흡수 없이 그대로 전파한다", async () => {
    const error = new NotFoundException("collection target not found: missing");
    serviceMock.findById.mockRejectedValue(error);

    await expect(controller.findById("missing")).rejects.toBe(error);
    expect(serviceMock.findById).toHaveBeenCalledWith("missing");
  });

  // error path 2 — HttpException 이 아닌 일반 Error 도 동일하게 raw forward
  // (controller 에 try/catch 가 없음의 증명).
  it("GET 목록: 일반 Error 도 그대로 전파한다 (controller 에 try/catch 없음)", async () => {
    const error = new Error("db down");
    serviceMock.findAll.mockRejectedValue(error);

    await expect(controller.findAll()).rejects.toBe(error);
  });

  // negative (a) — findAll 은 인자를 만들지 않고 service 를 정확히 1 회 호출한다.
  it("negative (a): findAll 이 인자 없이 service 를 정확히 1 회 호출한다", async () => {
    serviceMock.findAll.mockResolvedValue([]);

    await controller.findAll();

    expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    expect(serviceMock.findAll).toHaveBeenCalledWith();
    // 인자 개수 0 — 기본값 · 필터 객체를 몰래 끼워 넣지 않았다.
    expect(serviceMock.findAll.mock.calls[0]).toHaveLength(0);
  });

  // negative (b) — path param 무가공 전달. 빈 문자열 · 공백 포함 값도 trim · 형식 검증 ·
  // 기본값 없이 그대로 넘어간다(형식 오류의 판정은 controller 책임이 아님).
  it("negative (b): 빈 문자열 · 공백 포함 id 도 가공 없이 그대로 service 로 전달한다", async () => {
    serviceMock.findById.mockResolvedValue(buildTargetFixture());

    await controller.findById("");
    await controller.findById("  target-1  ");

    expect(serviceMock.findById).toHaveBeenNthCalledWith(1, "");
    expect(serviceMock.findById).toHaveBeenNthCalledWith(2, "  target-1  ");
  });

  // negative (c) — 반환 배열을 복제 · 정렬 · 필터하지 않는다. 정렬돼 있지 않은 입력을
  // 그대로 되돌려주는지로 확인(동일 참조 + 원소 순서 보존).
  it("negative (c): service 반환 배열을 복제·정렬·필터하지 않는다", async () => {
    const rows = [
      buildTargetFixture({ id: "b", instanceKey: "b", active: false }),
      buildTargetFixture({ id: "a", instanceKey: "a" }),
    ];
    serviceMock.findAll.mockResolvedValue(rows);

    const result = await controller.findAll();

    expect(result).toBe(rows);
    expect(result.map((row) => row.id)).toEqual(["b", "a"]);
    // active=false row 도 걸러내지 않는다 — 필터 판단은 controller 소관이 아니다.
    expect(result.some((row) => !row.active)).toBe(true);
  });

  // negative — throw 후 후속 처리 0. 편집 tier service 메서드 호출 0 으로 단락 확인.
  it("negative: service throw 시 후속 처리 없이 단락한다 (편집 메서드 호출 0)", async () => {
    serviceMock.findById.mockRejectedValue(new NotFoundException("x"));

    await expect(controller.findById("target-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.delete).not.toHaveBeenCalled();
  });
});

describe("CollectionTargetController (route · guard · pipe metadata)", () => {
  // negative (e) 전반 — base path 가 flat `/api/collection-targets` 로 고정
  // (ADR-0059 §Decision 5 — nested 가 아니다).
  it("negative (e-1): base path 가 api/collection-targets 이다", () => {
    const path = Reflect.getMetadata("path", CollectionTargetController) as
      | string
      | undefined;

    expect(path).toBe("api/collection-targets");
  });

  // negative (e) 후반 — controller-scope ValidationPipe 옵션 3 종 유지.
  it("negative (e-2): controller-scope ValidationPipe 의 whitelist · forbidNonWhitelisted · transform 이 모두 true 이다", () => {
    const pipes = Reflect.getMetadata(
      "__pipes__",
      CollectionTargetController,
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

  // 분기 축 대체 — 두 handler 의 route method 와 path param 축.
  it("두 handler 가 각각 GET '' 와 GET ':id' 로 박혀 있다", () => {
    expect(
      Reflect.getMetadata(
        "method",
        CollectionTargetController.prototype.findAll,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata("path", CollectionTargetController.prototype.findAll),
    ).toBe("/");
    expect(
      Reflect.getMetadata(
        "method",
        CollectionTargetController.prototype.findById,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        "path",
        CollectionTargetController.prototype.findById,
      ),
    ).toBe(":id");
  });

  // negative (d) 전반 — 두 route 의 @Roles tier 가 모두 "User" (조회 User+ tier).
  it('negative (d-1): 두 handler 에 @Roles("User") 가 박혀 있다 (조회 User+ tier)', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        CollectionTargetController.prototype.findAll,
      ),
    ).toEqual(["User"]);
    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        CollectionTargetController.prototype.findById,
      ),
    ).toEqual(["User"]);
  });

  // negative (d) 후반 — guard stack 순서 고정. JwtAuthGuard(401) → RolesGuard(403) 순.
  it("negative (d-2): 두 handler 에 @UseGuards(JwtAuthGuard, RolesGuard) 가 이 순서로 부착돼 있다", () => {
    expect(
      Reflect.getMetadata(
        "__guards__",
        CollectionTargetController.prototype.findAll,
      ),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(
      Reflect.getMetadata(
        "__guards__",
        CollectionTargetController.prototype.findById,
      ),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });

  // negative (f) — 편집 tier handler(POST · PATCH · DELETE)가 본 slice 에는 아직 없다.
  // prototype 의 메서드 목록을 통째로 고정해 후속 slice 가 route 를 얹을 때 본 test 가
  // 의도적으로 fail 하도록 둔다(후속 slice 의 회귀 신호).
  it("negative (f): public 핸들러가 정확히 findAll · findById 2 개뿐이다 (편집 3 route 미배선)", () => {
    const methods = Object.getOwnPropertyNames(
      CollectionTargetController.prototype,
    ).filter((name) => name !== "constructor");

    expect(methods.sort()).toEqual(["findAll", "findById"]);
    // 어떤 handler 도 GET 이 아닌 method 로 박혀 있지 않다.
    for (const name of methods) {
      expect(
        Reflect.getMetadata(
          "method",
          (
            CollectionTargetController.prototype as unknown as Record<
              string,
              unknown
            >
          )[name] as object,
        ),
      ).toBe(RequestMethod.GET);
    }
  });
});
