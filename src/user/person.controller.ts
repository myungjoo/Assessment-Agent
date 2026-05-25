// PersonController — `/api/persons` 5 REST endpoint. T-0036 acceptance D 박제.
//
// api.md §3 row L71–75 정합:
//   - GET    /api/persons         → findActive  (active filter default true)
//   - POST   /api/persons         → create      (201)
//   - GET    /api/persons/:id     → findOne
//   - PATCH  /api/persons/:id     → update      (active: false → soft deactivate /
//                                                active: true  → reactivate)
//   - DELETE /api/persons/:id     → remove      (hard delete, 204)
//
// ValidationPipe wire 결정 (task §D-113 박제):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 task 의 5 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 포함 시 400 BadRequest.
//   - transform: plain JSON 을 DTO instance 로 변환 (decorator 동작 보장).
//   - main.ts global wire 는 T-0036.5 후속 책임 (다른 controller 도 cover 위해).
//
// 책임 경계 (Out of Scope):
//   - AuthGuard (Admin+ / User+) 적용 안 함 — T-0038+ 책임.
//   - ServiceIdentity nested endpoint 미노출 — T-0036.5+ 책임.
//   - GET list 의 pagination / sorting / filtering query param 미지원.
//   - 응답 envelope (`{ data: ..., meta: ... }`) 표준화 안 함 — Prisma return 그대로.
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
import type { Person } from "@prisma/client";

import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { PersonService } from "./person.service";

@Controller("api/persons")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PersonController {
  constructor(private readonly service: PersonService) {}

  // GET /api/persons — active 인원 목록. 200 OK + JSON 배열.
  @Get()
  async findActive(): Promise<Person[]> {
    return this.service.findActive();
  }

  // GET /api/persons/:id — 단일 인원 상세. row 부재 시 service 가 NotFoundException
  // throw → 404 Not Found 자동 mapping.
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<Person> {
    return this.service.findById(id);
  }

  // POST /api/persons — 신규 인원 추가. 201 Created. email 중복 시 409 Conflict.
  // ValidationPipe 가 dto 의 4 decorator (IsString / IsEmail / IsNotEmpty / MaxLength)
  // 검증 — 위반 시 400 BadRequest.
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreatePersonDto): Promise<Person> {
    return this.service.create(dto);
  }

  // PATCH /api/persons/:id — 부분 수정 + active toggle.
  //   - patch.active === false → service.deactivate (soft, REQ-026)
  //   - patch.active === true  → service.reactivate
  //   - 그 외 (fullName / email 변경) → service.update
  // active 와 다른 필드의 동시 포함 시 active 가 우선 routing 후 다른 필드도 update.
  // 단순화: active 만 있으면 deactivate / reactivate, fullName / email 만 있으면 update,
  // 둘 다 있으면 update 가 active 포함하여 forward (Prisma 가 한 query 로 처리).
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() patch: UpdatePersonDto,
  ): Promise<Person> {
    const keys = Object.keys(patch);
    if (keys.length === 1 && patch.active === false) {
      return this.service.deactivate(id);
    }
    if (keys.length === 1 && patch.active === true) {
      return this.service.reactivate(id);
    }
    return this.service.update(id, patch);
  }

  // DELETE /api/persons/:id — hard delete. 204 No Content. row 부재 시 404.
  // schema 의 onDelete: Cascade 로 ServiceIdentity 동반 삭제.
  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string): Promise<void> {
    await this.service.remove(id);
  }
}
