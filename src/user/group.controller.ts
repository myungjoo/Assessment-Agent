// GroupController — `/api/groups` 4 REST endpoint. T-0055 acceptance §A 박제.
//
// api.md §3 row 정합 (api.md row 추가는 별도 doc-only direct follow-up 책임):
//   - GET    /api/groups       → findAll
//   - POST   /api/groups       → create     (201)
//   - GET    /api/groups/:id   → findById
//   - DELETE /api/groups/:id   → delete     (204 — P2025 → 404)
//
// PartController (T-0046) 패턴의 1:1 mirror minus `:id/persons` endpoint:
//   - `:id/persons` (Group 소속 Person 목록) endpoint 부재 — PersonGroupMembership
//     N:M reverse query 는 후속 별도 task (T-0056 예상) 책임. GroupController 의
//     본 4 endpoint 는 Group entity 자체의 CRUD-only.
//   - **POST 의 P2002 (unique 위반) → 409 변환 분기 부재** — Group.name 에 @unique
//     미정의 (prisma/schema.prisma L89-91 참조). GroupService.create 가 raw forward
//     이므로 controller 도 추가 변환 없음. (PartController 는 PartService.create 가
//     P2002 → ConflictException 변환 — Part.name @unique 따라.)
//   - **DELETE 의 P2003 (FK 위반) → 409 변환 분기 부재** — PersonGroupMembership 의
//     `onDelete: Cascade` (prisma/schema.prisma L130 참조) 가 schema 차원 처리 —
//     FK constraint 발생 안 함. GroupService.delete 는 P2025 → NotFoundException
//     1 종만 변환. (PartController 는 Part-Person FK default Restrict 따라 P2003
//     변환 분기 보유.)
//
// ValidationPipe wire 결정 (PartController 패턴 동일 reuse):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 task 의 4 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 DTO instance 로 변환 (decorator 동작 보장).
//   - main.ts global wire 는 별도 후속 task 책임 (다른 controller 도 cover 위해).
//
// 책임 경계 (Out of Scope):
//   - AuthGuard (Admin+ / User+) 적용 안 함 — 후속 task 책임. PartController 동일 정책.
//   - PATCH endpoint 미노출 — Group 의 mutation 은 본 task 의 CRUD 중 C/R/D 만 (별도 후속).
//   - `:id/persons` endpoint 미노출 — N:M membership operations (T-0056 예상) 책임.
//   - GET list 의 pagination / sorting / filtering query param 미지원.
//   - 응답 envelope (`{ data: ..., meta: ... }`) 표준화 안 함 — Prisma return 그대로.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { Group } from "@prisma/client";

import { CreateGroupDto } from "./dto/create-group.dto";
import { GroupService } from "./group.service";

@Controller("api/groups")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class GroupController {
  constructor(private readonly service: GroupService) {}

  // GET /api/groups — 전체 Group 목록. 200 OK + JSON 배열 (빈 배열 가능). 정렬은
  // service / repository 의 Prisma default 순서 유지 (후속 task 결정).
  @Get()
  async findAll(): Promise<Group[]> {
    return this.service.findAll();
  }

  // GET /api/groups/:id — 단일 Group 상세. row 부재 시 service 가 NotFoundException
  // throw → 404 Not Found 자동 mapping.
  @Get(":id")
  async findById(@Param("id") id: string): Promise<Group> {
    return this.service.findById(id);
  }

  // POST /api/groups — 신규 Group 추가. 201 Created. ValidationPipe 가 dto 의 2
  // decorator (IsString / IsNotEmpty) 검증 — 위반 시 400 BadRequest 자동. P2002
  // (unique 위반) 변환 분기 부재 — Group.name 에 @unique 미정의, raw forward.
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateGroupDto): Promise<Group> {
    return this.service.create(dto);
  }

  // DELETE /api/groups/:id — Group 삭제. 204 No Content. row 부재 시 service 가
  // NotFoundException throw → 404 Not Found. P2003 (FK 위반) 변환 분기 부재 —
  // PersonGroupMembership cascade 가 schema 차원 처리.
  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string): Promise<void> {
    await this.service.delete(id);
  }
}
