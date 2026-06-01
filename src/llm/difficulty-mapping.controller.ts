// DifficultyMappingController — `/api/llm/difficulty-mappings` 2 REST endpoint.
// T-0139 acceptance 박제. SummaryController (T-0123) / AssessmentController (T-0121) 가
// 박제한 controller RBAC stack 의 1:1 mirror — DifficultyMappingService (T-0138) 위에
// HTTP-facing layer 를 신설해 Admin 이 난이도 슬롯 (easy/medium/hard) 에
// LlmProviderConfig 를 지정 (REQ-049/REQ-050) 하는 경로를 노출한다.
//
// api.md / ADR-0011 정합 (DifficultyMappingService 가 이미 노출한 2 primitive 대응
// endpoint 만 — resolveModel 은 내부 routing 용이라 미노출):
//   - GET   /api/llm/difficulty-mappings              → findAllMappings    (200, 빈 배열도 정상)
//   - PATCH /api/llm/difficulty-mappings/:difficulty  → assignProviderConfig (200, 미지원 난이도 400 / config 부재 404 / 슬롯 부재 P2025 404)
//
// ValidationPipe wire 결정 (SummaryController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — 본 controller 2 endpoint 한정.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest.
//   - transform: plain JSON 을 AssignDifficultyMappingDto instance 로 변환.
//
// service-layer HttpException → status 자동 mapping (controller 는 추가 변환 0, raw forward):
//   - BadRequestException (isDifficulty false — 미지원 난이도) → 400.
//   - NotFoundException (지정 config 부재 / 슬롯 difficulty 부재 P2025) → 404.
//   - service 가 이미 모든 4xx 변환 책임을 가지므로 controller 는 raw forward + DTO
//     validation 만 (SummaryController 의 service raw forward 정책 동일). :difficulty 도
//     path param raw forward — controller 추가 검증 0 (service 의 isDifficulty 가 400 변환).
//
// RBAC 적용 (SummaryController POST/DELETE 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - LLM 모델 지정은 administrative concern (REQ-096) — GET (목록 조회) / PATCH (슬롯 지정)
//     둘 다 Admin+ tier. `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 는 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401. 권한 미달 → RolesGuard
//     가 403. ROLE_HIERARCHY escalation 매핑은 ADR-0008 / T-0083 박제값 그대로.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - /api/llm/providers config CRUD (LlmProviderConfig 생성/수정/삭제) — Follow-ups #1.
//   - provider HTTP client / 실제 LLM API call — 후속 routing task (HITL 게이트 발화).
//   - audit log 영속화 (Admin 슬롯 지정 행위 기록) — T-0144 / ADR-0007 책임.
//   - 새 auth-flow / RBAC 정책 변경 0 — 기존 guard stack 적용만.
//   - 응답 envelope (`{ data, meta }`) 표준화 / pagination / sort — Prisma return 그대로.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { DifficultyMapping } from "@prisma/client";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { DifficultyMappingService } from "./difficulty-mapping.service";
import { AssignDifficultyMappingDto } from "./dto/assign-difficulty-mapping.dto";

@Controller("api/llm/difficulty-mappings")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class DifficultyMappingController {
  constructor(private readonly service: DifficultyMappingService) {}

  // GET /api/llm/difficulty-mappings — 3 고정 슬롯 전체 조회 (REQ-096 Admin 가시성).
  // 200 OK + JSON 배열 (seed 전 빈 배열도 정상 결과 — 404 변환 안 함, service 가
  // findAllMappings 의 raw forward 책임). controller 자체 분기 없음 — service raw forward.
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findAll(): Promise<DifficultyMapping[]> {
    return this.service.findAllMappings();
  }

  // PATCH /api/llm/difficulty-mappings/:difficulty — 슬롯별 LlmProviderConfig FK 재지정
  // (REQ-049/REQ-050 난이도↔model 매핑, ADR-0011 §2). 200 OK + 갱신된 슬롯 반환.
  // :difficulty 는 path param raw forward — service 의 isDifficulty 가 미지원 난이도
  // (대문자 'Easy' / 'trivial' / 빈 값) → BadRequestException(400) 변환. dto 의
  // llmProviderConfigId 는 ValidationPipe 가 형식 검증 (누락 / 빈 문자열 / extra 키 →
  // 400). service 의 4xx (미지원 난이도 400 / config 부재 404 / 슬롯 부재 P2025 404) 가
  // 자동 status mapping — controller 는 swallow 없이 raw propagate.
  //
  // RBAC — Admin+ tier (findAll 동일). @Roles("Admin") → Admin / SuperAdmin 통과,
  // User actor 403. 슬롯 지정은 administrative concern (REQ-049 명시 지정).
  @Patch(":difficulty")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async assign(
    @Param("difficulty") difficulty: string,
    @Body() dto: AssignDifficultyMappingDto,
  ): Promise<DifficultyMapping> {
    return this.service.assignProviderConfig(
      difficulty,
      dto.llmProviderConfigId,
    );
  }
}
