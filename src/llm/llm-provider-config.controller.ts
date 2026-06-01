// LlmProviderConfigController — `/api/llm/providers` GET 목록 endpoint.
// T-0140 acceptance 박제 (T-0139 Follow-up #1). DifficultyMappingController (T-0139) /
// SummaryController (T-0123) 가 박제한 controller RBAC stack 의 1:1 mirror —
// LlmProviderConfigService (T-0140) 위에 HTTP-facing layer 를 신설해 Admin 이 등록된
// LLM provider config 목록을 조회 (REQ-096) 하는 read-only 경로를 노출한다.
//
// api.md / p4-impl-plan §2 정합 (read 조회 + create slice — PATCH/DELETE 는 Follow-up):
//   - GET /api/llm/providers → service.findAll (200, 빈 배열도 정상 — apiKey 제거 view)
//   - GET /api/llm/providers/:id → service.findById (200 단건 view / 부재 시 404 —
//     T-0142, Follow-up #2 구현. service 가 null → NotFoundException 변환)
//   - POST /api/llm/providers → service.create (201, apiKey encrypt 후 영속 + 제거 view
//     — T-0149. apiKey 를 request body 로 받아 AES-256-GCM envelope 으로 암호화 영속,
//     응답에는 apiKey 미노출. PATCH slice 는 split Follow-up)
//   - DELETE /api/llm/providers/:id → service.delete (204 No Content, body 없음
//     — T-0150. service 가 P2025→404 (id 부재) / P2003→409 (DifficultyMapping 슬롯
//     사용 중, onDelete:Restrict) 변환. PATCH slice 는 split Follow-up)
//
// ValidationPipe wire 결정 (DifficultyMappingController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — DTO 입력 endpoint 신설
//     (POST/PATCH config CRUD — Follow-up #1) 시 일관 정책 유지를 위해 GET-only 단계
//     에서도 박제. whitelist / forbidNonWhitelisted / transform 3 옵션 동일 mirror.
//
// 핵심 보안 invariant (task §Why 박제):
//   - 응답 직렬화 대상은 service.findAll 의 반환 (LlmProviderConfigView) — apiKey 가
//     이미 service 에서 redact 된 view shape. controller 는 raw row 를 직접 직렬화하지
//     않으며, service 가 sanitize 한 view 를 raw forward 만 한다. apiKey leak 표면 0.
//
// service-layer 예외 → status 자동 mapping (controller 는 추가 변환 0, raw forward):
//   - findAll 은 read-only — 4xx 변환 분기 부재 (빈 배열도 정상, 404 변환 안 함).
//   - findById 는 단건 — service 가 null → NotFoundException (404) 변환. controller 는
//     그 throw 를 추가 변환 없이 raw propagate (NestJS 가 404 로 자동 mapping).
//   - repository reject (DB 장애) → service 가 propagate → controller 가 raw propagate
//     (swallow 없이 그대로). NestJS 가 5xx 로 자동 mapping.
//
// RBAC 적용 (DifficultyMappingController GET 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - LLM provider config 조회는 administrative concern (REQ-096) — Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 는 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401. ROLE_HIERARCHY
//     escalation 매핑은 ADR-0008 / T-0083 박제값 그대로.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - PATCH/DELETE config CRUD — split Follow-up (본 controller 는 GET 조회 + POST 생성).
//   - apiKey encryption-at-rest — ADR-0014 (POST 시 service 가 encrypt, read 는 redact).
//   - provider HTTP client / 실제 LLM API call — 후속 routing task (HITL 게이트).
//   - 새 auth-flow / RBAC 정책 변경 0 — 기존 guard stack 적용만.
//   - 응답 envelope (`{ data, meta }`) 표준화 / pagination / sort — view return 그대로.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { CreateLlmProviderConfigDto } from "./dto/create-llm-provider-config.dto";
import { UpdateLlmProviderConfigDto } from "./dto/update-llm-provider-config.dto";
import {
  LlmProviderConfigService,
  type LlmProviderConfigView,
} from "./llm-provider-config.service";

@Controller("api/llm/providers")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class LlmProviderConfigController {
  constructor(private readonly service: LlmProviderConfigService) {}

  // GET /api/llm/providers — 등록된 LLM provider config 목록 조회 (REQ-096 Admin
  // 가시성). 200 OK + JSON 배열 (apiKey 제거된 view shape). 등록 0 이면 빈 배열도
  // 정상 결과 — 404 변환 안 함 (service.findAll 의 raw forward). controller 자체
  // 분기 없음 — service raw forward (sanitize 는 service 책임).
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findAll(): Promise<LlmProviderConfigView[]> {
    return this.service.findAll();
  }

  // GET /api/llm/providers/:id — 단일 LLM provider config 를 id 로 조회 (REQ-096
  // Admin 가시성, Follow-up #2). 200 OK + apiKey 제거된 단건 view (service 가
  // sanitize). config 부재 시 service 가 NotFoundException (404) 을 throw 하며
  // controller 는 그 throw 를 추가 변환 없이 raw propagate (controller 자체 분기
  // 없음 — service raw forward). @Param("id") 로 path param 수신.
  //
  // RBAC — Admin+ tier (목록 endpoint 와 동일). @Roles("Admin") → Admin / SuperAdmin
  // 통과 (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findById(@Param("id") id: string): Promise<LlmProviderConfigView> {
    return this.service.findById(id);
  }

  // POST /api/llm/providers — 새 LLM provider config 생성 (REQ-051~055, T-0149).
  // 201 Created + apiKey 제거된 view 반환 (NestJS POST 기본 201). @Body() 로 수신한
  // CreateLlmProviderConfigDto 는 controller-scope ValidationPipe 가 형식 검증
  // (whitelist + forbidNonWhitelisted — 4 필드 allow-list 밖 키 / 누락 / 빈값 / wrong
  // type 시 400). service.create 가 (1) isLlmProvider 로 provider 허용 집합 검증
  // (미지원 → BadRequestException 400), (2) LlmApiKeyCipher.encrypt 로 apiKey 암호화,
  // (3) ciphertext 영속, (4) apiKey 제거 view 반환 (ADR-0014 §3 never-read-back).
  // controller 자체 분기 없음 — service raw forward.
  //
  // RBAC — Admin+ tier (GET 과 동일). @Roles("Admin") → Admin / SuperAdmin 통과
  // (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(
    @Body() dto: CreateLlmProviderConfigDto,
  ): Promise<LlmProviderConfigView> {
    return this.service.create(dto);
  }

  // PATCH /api/llm/providers/:id — 등록된 LLM provider config 부분 갱신 (REQ-051~055,
  // T-0151). 200 OK + apiKey 제거된 view 반환. @Param("id") 로 path param 수신,
  // @Body() 로 UpdateLlmProviderConfigDto (4 필드 전부 optional) 수신 — controller-scope
  // ValidationPipe 가 형식 검증 (whitelist + forbidNonWhitelisted — allow-list 밖 키 /
  // 명시 필드의 빈값·wrong type 시 400). service.update 가 (1) provider 명시 시
  // isLlmProvider 검증 (미지원 → 400), (2) 명시 필드만 partial data 구성, (3) apiKey
  // 명시 시 재암호화 / 부재 시 기존 ciphertext 유지 (never-read-back, ADR-0014 §3),
  // (4) P2025→404 (id 부재) 변환, (5) apiKey 제거 view 반환. controller 자체 분기
  // 없음 — service raw forward (service 가 4xx 변환).
  //
  // RBAC — Admin+ tier (GET/POST/DELETE 과 동일). @Roles("Admin") → Admin / SuperAdmin
  // 통과 (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateLlmProviderConfigDto,
  ): Promise<LlmProviderConfigView> {
    return this.service.update(id, dto);
  }

  // DELETE /api/llm/providers/:id — 등록된 LLM provider config 삭제 (REQ-051~055,
  // T-0150). @HttpCode(204) 로 204 No Content (삭제 성공 body 없음 — apiKey 든 어떤
  // config 필드든 직렬화 0, ADR-0014 §3 never-read-back). @Param("id") 로 path param
  // 수신해 service.delete 로 raw forward. service 가 Prisma error 를 4xx 로 변환
  // (P2025→404 id 부재 / P2003→409 in-use, onDelete:Restrict) — controller 자체 분기
  // 없음, 그 throw 를 추가 변환 없이 raw propagate (NestJS 가 자동 status mapping).
  //
  // RBAC — Admin+ tier (GET/POST 과 동일). @Roles("Admin") → Admin / SuperAdmin
  // 통과 (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Delete(":id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async delete(@Param("id") id: string): Promise<void> {
    return this.service.delete(id);
  }
}
