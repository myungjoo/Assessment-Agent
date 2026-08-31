// CollectionTargetController spec — T-1814(골격 + 조회 tier 2 route) · T-1815(POST 등록
// route) · T-1816(PATCH 부분 수정 route) acceptance 박제.
//
// 네 handler(GET 목록 · GET 단건 · POST 등록 · PATCH 부분 수정) 모두 순수 위임이라 spec 도
// 그 분량에 맞춰 좁게 간다 (ServiceIdentityController spec 의 관례만 승계 — mock service
// 위임 검증 + decorator metadata drift guard).
// 구성: (1) 위임 동작 — mock service 로 happy / error / negative, (2) metadata 박제 —
// controller base path · route method · guard stack 순서 · @Roles tier · controller-scope
// ValidationPipe 옵션 3 종 · 미배선 handler(DELETE) 부재.
//
// R-112 분기 축 메모: `findAll` · `findById` · `create` · `update` 어느 쪽에도 **조건
// 분기가 없다**(넷 다 service 로의 무가공 위임 한 줄) — 코드 분기 test 는 해당 없음이다.
// 대신 ADR-0059 §Decision 5 GET 행이 규정한 두 경로("0 row → 빈 배열 200, 예외 아님" 과
// "row 존재 → 배열 1+"), POST 행의 두 입력 경로(optional 필드가 있는 body / 필수 3 필드만
// 있는 body), PATCH 행의 두 입력 경로(빈 객체 `{}` merge patch / 여러 필드 body)를 각각
// test 로 고정하고, 나머지 분기 축은 metadata 케이스(route method · path param 축 ·
// @Roles tier · guard 순서 · @HttpCode 부재 · 미배선 handler 부재)로 대체 배치한다.
import {
  ConflictException,
  NotFoundException,
  RequestMethod,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CollectionTarget } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CollectionTargetController } from "./collection-target.controller";
import type { CollectionTargetService } from "./collection-target.service";
import { CreateCollectionTargetDto } from "./dto/create-collection-target.dto";
import { UpdateCollectionTargetDto } from "./dto/update-collection-target.dto";

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

// CreateCollectionTargetDto fixture — 필수 3 필드만 채우고 optional 4 필드는 인자로 얹는다.
// DTO class 로 만드는 이유는 필드 drift 를 컴파일 단계에서 잡기 위함이다(plain object 로
// 두면 DTO 에 필수 필드가 늘어나도 spec 이 조용히 통과한다).
function buildCreateDto(
  overrides: Partial<CreateCollectionTargetDto> = {},
): CreateCollectionTargetDto {
  return Object.assign(new CreateCollectionTargetDto(), {
    type: "GITHUB",
    instanceKey: "default",
    endpoint: "https://github.com",
    ...overrides,
  });
}

// UpdateCollectionTargetDto fixture — 5 필드 전량 optional 이라 기본은 **빈 객체 `{}`**
// (merge patch 의 no-field 요청) 이고 인자로 필드를 얹는다. Create 쪽과 같은 이유로 DTO
// class 인스턴스를 쓴다 — 허용 축이 바뀌면 컴파일에서 잡힌다.
function buildUpdateDto(
  overrides: Partial<UpdateCollectionTargetDto> = {},
): UpdateCollectionTargetDto {
  return Object.assign(new UpdateCollectionTargetDto(), overrides);
}

// service mock — 5 메서드를 모두 깔아두고, 각 handler 가 자기 위임 대상 외 메서드를 전혀
// 부르지 않음을 negative 로 고정한다(본 slice 까지 배선된 route 는 4 개라 delete 는 여전히
// 절대 불림 없음).
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

  // negative — throw 후 후속 처리 0. 미배선 tier service 메서드 호출 0 으로 단락 확인.
  it("negative: service throw 시 후속 처리 없이 단락한다 (미배선 메서드 호출 0)", async () => {
    serviceMock.findById.mockRejectedValue(new NotFoundException("x"));

    await expect(controller.findById("target-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.delete).not.toHaveBeenCalled();
  });

  // happy path 3 (POST) — DTO 를 가공 없이 넘기고 service 가 만든 row 를 그대로 반환.
  it("POST 등록: DTO 를 그대로 service.create 에 넘기고 생성 row 를 그대로 반환한다", async () => {
    const dto = buildCreateDto({ orgs: ["acme"], active: true });
    const created = buildTargetFixture();
    serviceMock.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    // 반환도 인자도 동일 참조 — 복제 · 재조립 0 (negative (b)).
    expect(result).toBe(created);
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  // 입력 경로 축 1 — optional 4 필드를 모두 채운 body 도 그대로 통과한다.
  // (handler 에 조건 분기가 없으므로 "분기 cover" 는 입력 경로 고정으로 대체한다.)
  it("POST 등록: optional 필드가 모두 있는 body 도 가공 없이 그대로 전달한다", async () => {
    const dto = buildCreateDto({
      type: "CONFLUENCE",
      instanceKey: "wiki",
      endpoint: "https://wiki.example.com",
      orgs: [],
      repos: [],
      spaces: ["ENG"],
      active: false,
    });
    serviceMock.create.mockResolvedValue(buildTargetFixture());

    await controller.create(dto);

    const passed = serviceMock.create.mock.calls[0]?.[0] as
      | CreateCollectionTargetDto
      | undefined;
    expect(passed).toBe(dto);
    expect(passed?.spaces).toEqual(["ENG"]);
    expect(passed?.active).toBe(false);
  });

  // 입력 경로 축 2 — 필수 3 필드만 있는 body 에 optional 기본값을 주입하지 않는다
  // (DB default 위임 — controller 가 `orgs: []` 등을 몰래 채우면 계약이 깨진다).
  it("POST 등록: 필수 3 필드만 있는 body 에 optional 기본값을 주입하지 않는다", async () => {
    const dto = buildCreateDto();
    serviceMock.create.mockResolvedValue(buildTargetFixture());

    await controller.create(dto);

    const passed = serviceMock.create.mock.calls[0]?.[0] as
      | CreateCollectionTargetDto
      | undefined;
    expect(passed).toBe(dto);
    // 필수 3 필드는 그대로, optional 4 필드는 미전달 상태(undefined) 그대로다 —
    // controller 가 `orgs: []` · `active: true` 같은 기본값을 채워 넣지 않았다.
    expect(passed?.type).toBe("GITHUB");
    expect(passed?.instanceKey).toBe("default");
    expect(passed?.endpoint).toBe("https://github.com");
    expect(passed?.orgs).toBeUndefined();
    expect(passed?.repos).toBeUndefined();
    expect(passed?.spaces).toBeUndefined();
    expect(passed?.active).toBeUndefined();
  });

  // error path 3 — 중복 등록의 ConflictException(오류 표 c 행)을 흡수 없이 전파.
  it("POST 등록: service 의 ConflictException 을 변환·흡수 없이 그대로 전파한다", async () => {
    const error = new ConflictException(
      "collection target already registered: GITHUB/default",
    );
    serviceMock.create.mockRejectedValue(error);

    await expect(controller.create(buildCreateDto())).rejects.toBe(error);
  });

  // error path 4 — HttpException 이 아닌 일반 Error 도 동일하게 raw forward
  // (create 경로에도 try/catch 가 없음의 증명).
  it("POST 등록: 일반 Error 도 그대로 전파한다 (controller 에 try/catch 없음)", async () => {
    const error = new Error("db down");
    serviceMock.create.mockRejectedValue(error);

    await expect(controller.create(buildCreateDto())).rejects.toBe(error);
  });

  // negative (a) — create 는 service.create 를 정확히 1 회, 인자 1 개로만 호출하고
  // 조회 메서드는 건드리지 않는다.
  it("negative (a): create 가 service.create 를 정확히 1 회 호출하고 조회 메서드는 호출 0 이다", async () => {
    serviceMock.create.mockResolvedValue(buildTargetFixture());

    await controller.create(buildCreateDto());

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(serviceMock.create.mock.calls[0]).toHaveLength(1);
    expect(serviceMock.findAll).not.toHaveBeenCalled();
    expect(serviceMock.findById).not.toHaveBeenCalled();
  });

  // negative (c) — create 가 throw 하면 후속 처리 없이 단락한다(다른 service 메서드 0).
  it("negative (c): create throw 시 다른 service 메서드를 호출하지 않고 단락한다", async () => {
    serviceMock.create.mockRejectedValue(new ConflictException("dup"));

    await expect(controller.create(buildCreateDto())).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(serviceMock.findAll).not.toHaveBeenCalled();
    expect(serviceMock.findById).not.toHaveBeenCalled();
    expect(serviceMock.update).not.toHaveBeenCalled();
    expect(serviceMock.delete).not.toHaveBeenCalled();
  });

  // happy path 4 (PATCH) — id 와 DTO 를 가공 없이 넘기고 갱신 row 를 그대로 반환.
  it("PATCH 부분 수정: id 와 DTO 를 그대로 service.update 에 넘기고 갱신 row 를 그대로 반환한다", async () => {
    const dto = buildUpdateDto({ endpoint: "https://github.example.com" });
    const updated = buildTargetFixture({
      endpoint: "https://github.example.com",
    });
    serviceMock.update.mockResolvedValue(updated);

    const result = await controller.update("target-1", dto);

    // 반환도 인자도 동일 참조 — 복제 · 재조립 0 (negative (b)).
    expect(result).toBe(updated);
    expect(serviceMock.update).toHaveBeenCalledWith("target-1", dto);
  });

  // 입력 경로 축 1 — 빈 객체 `{}` (merge patch 의 no-field 요청) 도 그대로 통과한다.
  // handler 에 조건 분기가 없으므로 "분기 cover" 는 입력 경로 고정으로 대체한다 —
  // controller 가 빈 body 를 400 · no-op 으로 가로채지 않음을 여기서 못박는다.
  it("PATCH 부분 수정: 빈 객체 body 도 가로채지 않고 그대로 service 로 전달한다", async () => {
    const dto = buildUpdateDto();
    serviceMock.update.mockResolvedValue(buildTargetFixture());

    await controller.update("target-1", dto);

    const passed = serviceMock.update.mock.calls[0]?.[1] as
      | UpdateCollectionTargetDto
      | undefined;
    expect(passed).toBe(dto);
    // 5 필드 전량 미전달(undefined) 그대로 — controller 가 `active: true` 같은 기본값을
    // 채워 넣거나 빈 body 를 400 · no-op 으로 가로채지 않았다. (DTO class 인스턴스라
    // 선언된 5 필드가 own property 로는 존재하지만 값은 전부 undefined 다.)
    expect(Object.values(passed ?? {}).every((v) => v === undefined)).toBe(
      true,
    );
    expect(passed?.endpoint).toBeUndefined();
    expect(passed?.active).toBeUndefined();
    expect(serviceMock.update).toHaveBeenCalledTimes(1);
  });

  // 입력 경로 축 2 — 여러 필드를 담은 body 도 필드 선별 · 기본값 주입 없이 그대로 통과.
  it("PATCH 부분 수정: 여러 필드를 담은 body 도 선별·기본값 주입 없이 그대로 전달한다", async () => {
    const dto = buildUpdateDto({
      endpoint: "https://wiki.example.com",
      orgs: [],
      repos: ["acme/api"],
      spaces: ["ENG"],
      active: false,
    });
    serviceMock.update.mockResolvedValue(buildTargetFixture());

    await controller.update("target-2", dto);

    const passed = serviceMock.update.mock.calls[0]?.[1] as
      | UpdateCollectionTargetDto
      | undefined;
    expect(passed).toBe(dto);
    expect(passed?.repos).toEqual(["acme/api"]);
    expect(passed?.active).toBe(false);
  });

  // error path 5 — `:id` row 부재의 NotFoundException(오류 표 d 행)을 흡수 없이 전파.
  it("PATCH 부분 수정: service 의 NotFoundException 을 변환·흡수 없이 그대로 전파한다", async () => {
    const error = new NotFoundException("collection target not found: missing");
    const dto = buildUpdateDto({ active: false });
    serviceMock.update.mockRejectedValue(error);

    await expect(controller.update("missing", dto)).rejects.toBe(error);
    // 실패 경로에서도 인자는 무가공 전달 — id 원문 + DTO 동일 참조 (reviewer N1).
    expect(serviceMock.update).toHaveBeenCalledWith("missing", dto);
    expect(serviceMock.update.mock.calls[0]?.[1]).toBe(dto);
  });

  // error path 6 — HttpException 이 아닌 일반 Error 도 동일하게 raw forward
  // (update 경로에도 try/catch 가 없음의 증명).
  it("PATCH 부분 수정: 일반 Error 도 그대로 전파한다 (controller 에 try/catch 없음)", async () => {
    const error = new Error("db down");
    serviceMock.update.mockRejectedValue(error);

    await expect(controller.update("target-1", buildUpdateDto())).rejects.toBe(
      error,
    );
  });

  // negative (a) — update 는 service.update 를 정확히 1 회, 인자 2 개로만 호출하고
  // 다른 service 메서드는 건드리지 않는다.
  it("negative (a): update 가 service.update 를 정확히 1 회 호출하고 다른 메서드는 호출 0 이다", async () => {
    serviceMock.update.mockResolvedValue(buildTargetFixture());

    await controller.update("target-1", buildUpdateDto());

    expect(serviceMock.update).toHaveBeenCalledTimes(1);
    expect(serviceMock.update.mock.calls[0]).toHaveLength(2);
    expect(serviceMock.findAll).not.toHaveBeenCalled();
    expect(serviceMock.findById).not.toHaveBeenCalled();
    expect(serviceMock.create).not.toHaveBeenCalled();
    expect(serviceMock.delete).not.toHaveBeenCalled();
  });

  // negative (b) — path param 무가공 전달. 빈 문자열 · 공백 포함 id 도 trim · 형식 검증 ·
  // 기본값 없이 그대로 넘어간다. 정체성 축(`type` · `instanceKey`) 제거 로직도 없다 —
  // 두 축은 DTO 허용 축이 아니라 ValidationPipe 의 forbidNonWhitelisted 소관이다.
  it("negative (b): 빈 문자열 · 공백 포함 id 도 가공 없이 그대로 service 로 전달한다", async () => {
    const dto = buildUpdateDto({ active: true });
    serviceMock.update.mockResolvedValue(buildTargetFixture());

    await controller.update("", dto);
    await controller.update("  target-1  ", dto);

    expect(serviceMock.update).toHaveBeenNthCalledWith(1, "", dto);
    expect(serviceMock.update).toHaveBeenNthCalledWith(2, "  target-1  ", dto);
  });

  // negative (c) — update 가 throw 하면 후속 처리 없이 단락한다(다른 service 메서드 0).
  it("negative (c): update throw 시 다른 service 메서드를 호출하지 않고 단락한다", async () => {
    serviceMock.update.mockRejectedValue(new NotFoundException("missing"));

    await expect(
      controller.update("missing", buildUpdateDto()),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(serviceMock.findAll).not.toHaveBeenCalled();
    expect(serviceMock.findById).not.toHaveBeenCalled();
    expect(serviceMock.create).not.toHaveBeenCalled();
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

  // 분기 축 대체 — 조회 2 handler 의 route method 와 path param 축.
  it("조회 handler 가 각각 GET '' 와 GET ':id' 로 박혀 있다", () => {
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

  // negative (e) — 편집 tier 추가로 인한 조회 권한 회귀 차단. 조회 2 route 의
  // @Roles tier 가 여전히 "User" 임을 재확인한다.
  it('negative (e-3): 조회 2 handler 의 @Roles tier 가 여전히 "User" 이다 (편집 tier 추가로 인한 회귀 없음)', () => {
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
  // 4 route 가 같은 stack 을 같은 순서로 공유한다(tier 만 다르다).
  it("negative (d-2): 4 handler 모두에 @UseGuards(JwtAuthGuard, RolesGuard) 가 이 순서로 부착돼 있다", () => {
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
    expect(
      Reflect.getMetadata(
        "__guards__",
        CollectionTargetController.prototype.create,
      ),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(
      Reflect.getMetadata(
        "__guards__",
        CollectionTargetController.prototype.update,
      ),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });

  // negative (d) — POST 등록 route 의 metadata drift guard. tier 가 편집 tier("Admin")
  // 이고 method 는 POST · path 는 '/' 임을 고정한다. tier 가 조회와 같은 "User" 로
  // 미끄러지면 권한 회귀이므로 여기서 잡는다.
  it("negative (d-3): create 가 POST '/' 이고 @Roles(\"Admin\") 편집 tier 이다", () => {
    const reflector = new Reflector();

    expect(
      Reflect.getMetadata(
        "method",
        CollectionTargetController.prototype.create,
      ),
    ).toBe(RequestMethod.POST);
    expect(
      Reflect.getMetadata("path", CollectionTargetController.prototype.create),
    ).toBe("/");
    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        CollectionTargetController.prototype.create,
      ),
    ).toEqual(["Admin"]);
  });

  // negative (d) — 성공 status 는 NestJS `@Post` 기본값 201 이므로 `@HttpCode` 를 붙이지
  // 않는다(ADR-0059 §Decision 5 POST 행). httpCode metadata 부재로 그 사실을 고정한다.
  it("negative (d-4): create 에 @HttpCode 가 붙어 있지 않다 (201 은 @Post 기본값)", () => {
    expect(
      Reflect.getMetadata(
        "__httpCode__",
        CollectionTargetController.prototype.create,
      ),
    ).toBeUndefined();
  });

  // negative (d) — PATCH 부분 수정 route 의 metadata drift guard. tier 가 편집
  // tier("Admin")이고 method 는 PATCH · path 는 ':id' 임을 고정한다. tier 가 조회와 같은
  // "User" 로 미끄러지면 편집 권한 회귀이므로 여기서 잡는다.
  it("negative (d-5): update 가 PATCH ':id' 이고 @Roles(\"Admin\") 편집 tier 이다", () => {
    const reflector = new Reflector();

    expect(
      Reflect.getMetadata(
        "method",
        CollectionTargetController.prototype.update,
      ),
    ).toBe(RequestMethod.PATCH);
    expect(
      Reflect.getMetadata("path", CollectionTargetController.prototype.update),
    ).toBe(":id");
    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        CollectionTargetController.prototype.update,
      ),
    ).toEqual(["Admin"]);
  });

  // negative (d) — 성공 status 는 NestJS `@Patch` 기본값 200 이므로 `@HttpCode` 를 붙이지
  // 않는다(ADR-0059 §Decision 5 PATCH 행). httpCode metadata 부재로 그 사실을 고정한다.
  it("negative (d-6): update 에 @HttpCode 가 붙어 있지 않다 (200 은 @Patch 기본값)", () => {
    expect(
      Reflect.getMetadata(
        "__httpCode__",
        CollectionTargetController.prototype.update,
      ),
    ).toBeUndefined();
  });

  // negative (f) — 지금까지 배선된 public 핸들러는 4 개(findAll · findById · create ·
  // update)이고 **DELETE route 는 아직 미배선**이다. prototype 의 메서드 목록을 통째로
  // 고정해 후속 slice 가 route 를 얹을 때 본 test 가 의도적으로 fail 하도록 둔다
  // (후속 slice 의 회귀 신호 — T-1814 → T-1815 → T-1816 도 같은 방식으로 갱신됐다).
  it("negative (f): public 핸들러가 정확히 findAll · findById · create · update 4 개뿐이다 (DELETE 미배선)", () => {
    const methods = Object.getOwnPropertyNames(
      CollectionTargetController.prototype,
    ).filter((name) => name !== "constructor");

    expect(methods.sort()).toEqual(["create", "findAll", "findById", "update"]);
    // 각 handler 의 route method 도 함께 고정 — DELETE 는 어디에도 없다.
    const methodOf = (name: string): unknown =>
      Reflect.getMetadata(
        "method",
        (
          CollectionTargetController.prototype as unknown as Record<
            string,
            unknown
          >
        )[name] as object,
      );

    expect(methods.map(methodOf).sort()).toEqual(
      [
        RequestMethod.GET,
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.PATCH,
      ].sort(),
    );
    expect(methods.map(methodOf)).toContain(RequestMethod.PATCH);
    expect(methods.map(methodOf)).not.toContain(RequestMethod.DELETE);
  });
});
