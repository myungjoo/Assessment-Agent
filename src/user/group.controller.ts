// GroupController — `/api/groups` 7 REST endpoint. T-0055 acceptance §A 박제
// (CRUD 4 endpoint) + T-0057 acceptance §A 확장 (N:M membership 3 endpoint).
//
// api.md §3 row 정합 (api.md row 추가는 별도 doc-only direct follow-up 책임):
//   - GET    /api/groups                            → findAll
//   - POST   /api/groups                            → create        (201)
//   - GET    /api/groups/:id                        → findById
//   - DELETE /api/groups/:id                        → delete        (204 — P2025 → 404)
//   - POST   /api/groups/:id/members                → addMember     (201, T-0057 추가)
//   - DELETE /api/groups/:id/members/:membershipId  → removeMember  (204, T-0057 추가)
//   - GET    /api/groups/:id/persons                → findPersons   (200, T-0057 추가)
//
// T-0057 추가 — N:M membership endpoint 3 종 (REQ-028 핵심 invariant fully operational
// closure). T-0056 박제 3 service 메서드 (addMember / removeMember / findPersonsByGroupId)
// 를 HTTP layer 로 wrap. 외부 API 클라이언트 가 N:M 연산을 호출 가능.
//
// PartController (T-0046) 와의 차이 — N:M middle table 책임의 POST/DELETE 신설:
//   - `:id/persons` (GET) — PartController.findPersons 와 동일 패턴 (1:1 mirror). 단
//     service-layer 는 N:M middle table indirect navigation (PersonGroupMembership
//     loop), PartService 는 Person.partId 직접 FK navigation (group.service.ts L196-227
//     참조).
//   - `:id/members` (POST/DELETE) — PartController 에는 부재 (Part 의 1:N 패턴은
//     Person.partId 직접 update). Group 의 N:M middle row 의 생성/삭제는 별도
//     endpoint 노출 — PersonGroupMembership row 의 mutation 책임.
//   - **DELETE path 의 `:membershipId` 결정** (driver 원안 `:personId` 의 정정) —
//     T-0056 service `removeMember(membershipId: string)` 시그니처 정합. RESTful URL
//     의 N:M middle row 자체 식별자 (PersonGroupMembership.id) 활용. driver 원안의
//     `:personId` 는 그 시점 추정 — task §Why §4 의 (a) 결정 박제. 만약 (personId,
//     groupId) 쌍 으로 삭제를 원하면 별도 service 메서드 신설 + endpoint 분기 후속
//     follow-up 책임 (현재는 client 가 GET 후 membershipId 추출 → DELETE 패턴).
//
// POST 의 P2002 (PersonGroupMembership `@@unique([personId, groupId])` 위반) → 409
// 변환 분기는 service-layer (group.service.ts addMember try/catch) 박제 — controller
// 는 추가 변환 0, automatic propagate. NestJS 가 HttpException 의 status 자동 매핑.
//
// 기존 4 endpoint 의 책임 (T-0055 박제 — 변경 0):
//   - findAll / findById / create / delete — Group entity 자체의 CRUD-only.
//   - POST 의 P2002 변환 분기 부재 — Group.name @unique 미정의 (prisma/schema.prisma
//     L89-91). DELETE 의 P2003 변환 분기 부재 — PersonGroupMembership cascade.
//
// ValidationPipe wire 결정 (T-0055 박제 — 변경 0):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 task 의 7 endpoint
//     한정. 신규 AddMemberDto 의 decorator (IsString / IsNotEmpty) 가 자동 발화.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 DTO instance 로 변환 (decorator 동작 보장).
//
// 책임 경계 (Out of Scope — T-0057 시점):
//   - AuthGuard (Admin+ / User+) 적용 안 함 — 후속 task 책임. PartController 동일 정책.
//   - PATCH endpoint 미노출 — Group 의 mutation 은 본 task 의 CRUD 중 C/R/D + N:M
//     add/remove 만 (별도 후속).
//   - GET `:id/persons` 의 pagination / sorting / filtering query param 미지원 —
//     REQ-029 평가 자료 조회 시점에 결합.
//   - 응답 envelope (`{ data: ..., meta: ... }`) 표준화 안 함 — Prisma return 그대로.
//   - `(personId, groupId)` 복합 path DELETE 미지원 — `:membershipId` 단일 path 만.
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
import type { Group, Person, PersonGroupMembership } from "@prisma/client";

import { AddMemberDto } from "./dto/add-member.dto";
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

  // GET /api/groups/:id/persons — 지정 Group 소속 Person 목록. T-0057 추가.
  // Group 자체가 존재하지 않으면 service 가 404 강제. Group 은 있으나 membership
  // 0 이면 200 + 빈 배열 (404 변환 안 함). PartController.findPersons 와 동일 패턴.
  // service-layer 는 PersonGroupMembership middle table indirect navigation.
  @Get(":id/persons")
  async findPersons(@Param("id") id: string): Promise<Person[]> {
    return this.service.findPersonsByGroupId(id);
  }

  // POST /api/groups — 신규 Group 추가. 201 Created. ValidationPipe 가 dto 의 2
  // decorator (IsString / IsNotEmpty) 검증 — 위반 시 400 BadRequest 자동. P2002
  // (unique 위반) 변환 분기 부재 — Group.name 에 @unique 미정의, raw forward.
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateGroupDto): Promise<Group> {
    return this.service.create(dto);
  }

  // POST /api/groups/:id/members — N:M membership row 신규 추가. T-0057 추가.
  // 201 Created + 신규 PersonGroupMembership row 반환. ValidationPipe 가
  // AddMemberDto 의 2 decorator 검증 — personId 누락 / 빈 문자열 / wrong type / 추가
  // 필드 시 400 자동. service-layer 분기 → 404 (Group/Person 없음) / 409 (이미 member)
  // / 404 (P2003 race window) automatic propagate. groupId 는 path param, personId 는
  // body — service.addMember(groupId, personId) 결합.
  @Post(":id/members")
  @HttpCode(201)
  async addMember(
    @Param("id") groupId: string,
    @Body() dto: AddMemberDto,
  ): Promise<PersonGroupMembership> {
    return this.service.addMember(groupId, dto.personId);
  }

  // DELETE /api/groups/:id — Group 삭제. 204 No Content. row 부재 시 service 가
  // NotFoundException throw → 404 Not Found. P2003 (FK 위반) 변환 분기 부재 —
  // PersonGroupMembership cascade 가 schema 차원 처리.
  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string): Promise<void> {
    await this.service.delete(id);
  }

  // DELETE /api/groups/:id/members/:membershipId — N:M membership row 제거. T-0057 추가.
  // 204 No Content + body 없음. groupId path param 은 RESTful URL 정합용 (서버 호출엔
  // 미사용 — T-0056 service `removeMember(membershipId)` 시그니처 단일 인자). row 부재
  // 시 service 가 NotFoundException (P2025) → 404 automatic. driver 원안 `:personId`
  // 의 정정 — service 시그니처 정합 (헤더 주석 박제).
  @Delete(":id/members/:membershipId")
  @HttpCode(204)
  async removeMember(
    @Param("id") _groupId: string,
    @Param("membershipId") membershipId: string,
  ): Promise<void> {
    await this.service.removeMember(membershipId);
  }
}
