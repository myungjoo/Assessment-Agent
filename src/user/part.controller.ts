// PartController — `/api/parts` 5 REST endpoint. T-0046 acceptance §PartController 박제.
//
// api.md §3 row (T-0030 박제) 정합:
//   - GET    /api/parts             → findAll
//   - POST   /api/parts             → create        (201)
//   - GET    /api/parts/:id         → findById
//   - GET    /api/parts/:id/persons → findPersons   (Part 소속 Person 목록)
//   - DELETE /api/parts/:id         → delete        (204 — P2025 → 404 / P2003 → 409)
//
// ValidationPipe wire 결정 (PersonController 패턴 동일 reuse):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 task 의 5 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 DTO instance 로 변환 (decorator 동작 보장).
//   - main.ts global wire 는 별도 후속 task 책임 (다른 controller 도 cover 위해).
//
// 책임 경계 (Out of Scope):
//   - AuthGuard (Admin+ / User+) 적용 안 함 — 후속 task 책임.
//   - PATCH endpoint 미노출 — Part 의 mutation 은 본 task 의 CRUD 중 C/R/D 만 (별도 후속).
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
import type { Part, Person } from "@prisma/client";

import { CreatePartDto } from "./dto/create-part.dto";
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

  // DELETE /api/parts/:id — Part 삭제. 204 No Content. row 부재 시 404 / 소속 Person 1+
  // 시 409 (REQ-028 invariant — Part-Person 의 dangling reference 차단).
  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string): Promise<void> {
    await this.service.delete(id);
  }
}
