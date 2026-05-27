// PartController — `/api/parts` 6 REST endpoint. T-0046 acceptance §PartController 박제
// + T-0075 acceptance §A 확장 (@Patch(":id") update — Part.name partial update).
//
// api.md §3 row (T-0030 박제) 정합:
//   - GET    /api/parts             → findAll
//   - POST   /api/parts             → create        (201)
//   - GET    /api/parts/:id         → findById
//   - GET    /api/parts/:id/persons → findPersons   (Part 소속 Person 목록)
//   - PATCH  /api/parts/:id         → update        (200 — P2025 → 404 / P2002 → 409, T-0075 추가)
//   - DELETE /api/parts/:id         → delete        (204 — P2025 → 404 / P2003 → 409)
//
// ValidationPipe wire 결정 (PersonController 패턴 동일 reuse):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 task 의 6 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 DTO instance 로 변환 (decorator 동작 보장).
//   - main.ts global wire 는 별도 후속 task 책임 (다른 controller 도 cover 위해).
//
// T-0075 박제 — PATCH endpoint 도입으로 Part 도메인 CRUD-U 4-layer fully closed:
//   - UpdatePartDto (T-0069) + PartRepository.update (T-0069) + PartService.update
//     (T-0071, P2025→404 / P2002→409 변환) + 본 task 의 controller layer.
//   - Group 도메인 (T-0066~T-0068) 과의 핵심 차이는 P2002 분기 — Part.name 의
//     `@unique` directive (prisma/schema.prisma L108) 가 schema-level enforce →
//     PartService.update 의 ConflictException 변환 (Group 의 GroupController.@Patch
//     header 주석 정합 mirror, 단 Group 은 P2002 분기 부재).
//
// 책임 경계 (Out of Scope — T-0075 시점):
//   - AuthGuard (Admin+ / User+) 적용 안 함 — 후속 task 책임.
//   - GET list 의 pagination / sorting / filtering query param 미지원.
//   - 응답 envelope (`{ data: ..., meta: ... }`) 표준화 안 함 — Prisma return 그대로.
//   - PATCH e2e spec 신설 안 함 — 본 task 는 unit/integration 만 (별도 후속).
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Part, Person } from "@prisma/client";

import { CreatePartDto } from "./dto/create-part.dto";
import { UpdatePartDto } from "./dto/update-part.dto";
import { PartService } from "./part.service";

@Controller("api/parts")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PartController {
  constructor(private readonly service: PartService) {}

  // GET /api/parts — 전체 Part 목록. 200 OK + JSON 배열. 정렬은 service / repository 의
  // Prisma default 순서 유지 (후속 task 결정).
  @Get()
  async findAll(): Promise<Part[]> {
    return this.service.findAll();
  }

  // GET /api/parts/:id — 단일 Part 상세. row 부재 시 service 가 NotFoundException
  // throw → 404 Not Found 자동 mapping.
  @Get(":id")
  async findById(@Param("id") id: string): Promise<Part> {
    return this.service.findById(id);
  }

  // GET /api/parts/:id/persons — 지정 Part 소속 Person 목록. Part 자체가 존재하지
  // 않으면 service 가 404 강제. Part 는 있으나 Person 0 이면 200 + 빈 배열.
  @Get(":id/persons")
  async findPersons(@Param("id") id: string): Promise<Person[]> {
    return this.service.findPersonsByPartId(id);
  }

  // POST /api/parts — 신규 Part 추가. 201 Created. name 중복 시 409 Conflict.
  // ValidationPipe 가 dto 의 2 decorator (IsString / IsNotEmpty) 검증 — 위반 시 400.
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreatePartDto): Promise<Part> {
    return this.service.create(dto);
  }

  // PATCH /api/parts/:id — Part 부분 수정. T-0075 추가. 200 OK + 수정된 Part row.
  // GroupController.update (T-0068) + PersonController.update (T-0036/T-0037) 1:1
  // mirror — RFC-7396 JSON Merge Patch semantic, ValidationPipe wire + service.update
  // 단일 forward. UpdatePartDto 의 `name?: string` 단일 필드만 cover (Part 의 다른
  // 컬럼 createdAt/updatedAt 은 schema 의 `@default(now())` / `@updatedAt` directive
  // 가 자동 갱신).
  //
  // branch 박제 (controller 는 routing 만, 의미는 service):
  //   - `patch.name` 명시 (undefined 아님) → service.update 가 `{ name }` spread 로
  //     PartRepository.update 호출 → Prisma 가 partial update.
  //   - `patch.name === undefined` (빈 `{}` payload 등가) → service.update 가 빈 객체
  //     `{}` forward → Prisma `@updatedAt` directive 만 갱신 (PATCH no-op semantic).
  //     GroupController.update L146-148 의 동일 no-op 처리 mirror.
  //
  // error propagation (자동 — controller 는 raw forward):
  //   - service 가 throw 한 NotFoundException (P2025 변환, T-0071 박제) → 404 자동.
  //   - service 가 throw 한 ConflictException (P2002 변환, T-0071 박제) → 409 자동.
  //     **Group precedent 와의 핵심 차이** — Part.name `@unique`
  //     (prisma/schema.prisma L108) 가 schema-level enforce → service-layer 가
  //     Prisma P2002 를 ConflictException 으로 변환. Group 도메인은 `@unique`
  //     미정의 → P2002 분기 부재.
  //   - ValidationPipe 가 throw 한 BadRequestException (UpdatePartDto 의 IsString /
  //     IsNotEmpty / MaxLength(255) / IsOptional 위반) → 400 자동. controller-scope
  //     `@UsePipes` (L80-86) 가 본 endpoint 도 cover — 별도 wire 0.
  //   - 그 외 raw error → service 그대로 propagate.
  //
  // 책임 경계 (Out of Scope):
  //   - AuthGuard 적용 안 함 — ADR-0008 auth credential 미박제 상태 유지.
  //   - active toggle / 다른 도메인 필드 PATCH 미지원 — UpdatePartDto 가 `name`
  //     단일 필드만 정의.
  //   - PATCH e2e spec 신설 안 함 — 후속 follow-up.
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() patch: UpdatePartDto,
  ): Promise<Part> {
    return this.service.update(id, patch);
  }

  // DELETE /api/parts/:id — Part 삭제. 204 No Content. row 부재 시 404 / 소속 Person 1+
  // 시 409 (REQ-028 invariant — Part-Person 의 dangling reference 차단).
  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string): Promise<void> {
    await this.service.delete(id);
  }
}
