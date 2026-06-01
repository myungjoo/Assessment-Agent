---
id: T-0139
title: DifficultyMappingController — Admin 난이도 모델 지정 endpoint (GET list + PATCH assign, Admin+ RBAC)
phase: P4
status: DONE
commitMode: pr
prNumber: 135
mergedAs: 1dff484
reviewRounds: 1
completedAt: 2026-06-01T21:33:14+09:00
coversReq: [REQ-049, REQ-050, REQ-096, REQ-097]
estimatedDiff: 290
estimatedFiles: 5
created: 2026-06-01
plannerNote: P4 — p4-impl-plan §2 T-0139 row + ADR-0011 후속 chain. repo+service 위 Admin endpoint(외부 dep 0, HITL 미발화). R-112 backbone ×1.5 ×P2002 1.2.
---

# T-0139 — DifficultyMappingController — Admin 난이도 모델 지정 endpoint (GET list + PATCH assign, Admin+ RBAC)

## Why

[docs/architecture/p4-implementation-plan.md §2](../architecture/p4-implementation-plan.md) 표의 **T-0139 row** ("Admin LLM 모델 지정 endpoint + DTO + RBAC (Admin+)") 와 [ADR-0011 §"후속 task chain 박제"](../decisions/ADR-0011-difficulty-model-assignment.md) 의 **T-0139 candidate** 를 구현한다 — 직전 머지된 [T-0138](T-0138-difficulty-mapping-service-fail-fast.md) 의 `DifficultyMappingService` (`findAllMappings` / `assignProviderConfig`) 위에 HTTP-facing layer 인 `DifficultyMappingController` 를 신설한다. [PLAN.md L87](../PLAN.md) "Admin 이 LLM 모델 지정 UI (R-96 — backend 부분)" 의 backend endpoint 슬라이스로, Admin 이 난이도 슬롯 (easy/medium/hard) 에 `LlmProviderConfig` 를 지정 (REQ-049/REQ-050) 하는 경로를 노출한다. SummaryController (T-0123) / AssessmentController (T-0121) 가 박제한 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` + controller-scope `ValidationPipe` 패턴의 1:1 mirror 다.

본 task 는 **외부 dependency 0** — provider HTTP client / `pnpm add` / 외부 자격증명 0. 노출하는 endpoint 는 내부 service (이미 머지된 `DifficultyMappingService`) 를 forward 하는 HTTP layer 만이며, 인증/권한은 이미 설치된 `JwtAuthGuard` / `RolesGuard` / `@Roles` 와 이미 설치된 `class-validator` 의 DTO 검증을 재사용한다. 실제 provider 호출 (resolve 된 `modelId` 로 LLM API call) + provider SDK 추가는 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트가 발화하는 후속 routing task 책임이다 ([p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) inventory — T-0139 게이트 **미발화**). 따라서 본 task 는 **dependency-free clean next step** — HITL 게이트 미발화.

## Required Reading

- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — §1 (3 슬롯 cardinality easy/medium/hard) + §2 (슬롯 ↔ `LlmProviderConfig` FK 재지정 의미) + §3 (미설정 fail-fast) + §"후속 task chain 박제" T-0139 row (Admin endpoint scope). 본 controller 가 노출하는 도메인 의미의 contract source.
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) — 본 controller 가 wrapping 할 service. `findAllMappings()` (3 row 전체 조회, 빈 배열 가능) + `assignProviderConfig(difficulty, llmProviderConfigId)` (슬롯 FK 재지정 — `isDifficulty` false → `BadRequestException`(400) / config 부재 → `NotFoundException`(404) / 슬롯 difficulty 부재 P2025 → `NotFoundException`(404)) 가 노출 대상. service 가 이미 모든 4xx 변환 책임을 가지므로 controller 는 raw forward + DTO validation 만.
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) — mirror 할 controller 패턴 (`@Controller(...)` + controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + endpoint 별 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` + service raw forward + `@HttpCode`). 본 controller 의 RBAC stack / ValidationPipe wire template.
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — `@Roles("Admin")` escalation 정책 (Admin/SuperAdmin 통과, User 403). 본 endpoint 들의 Admin+ tier source.
- [src/auth/current-user.decorator.ts](../../src/auth/current-user.decorator.ts) — `@CurrentUser()` / `@CurrentUser("sub")` param decorator. (감사 로그용 actor 가 필요하면 사용 — 단 본 task 는 audit 영속화 0, decorator 사용은 선택.)
- [src/user/dto/update-part.dto.ts](../../src/user/dto/update-part.dto.ts) — class-validator DTO 패턴 (`@IsString` / `@IsNotEmpty` / `@MaxLength` / `@IsOptional`). 본 task 의 `AssignDifficultyMappingDto` (`llmProviderConfigId` 단일 필드) mirror.
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — `DifficultyMappingController` 를 `controllers` 배열에 등록할 대상 module (`DifficultyMappingService` 는 이미 providers/exports 에 등록됨 — controller 가 inject 만).
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) — `Difficulty` union / `DIFFICULTIES` / `isDifficulty`. PATCH endpoint 의 `:difficulty` path param 검증 위치 판단 source (service 가 `isDifficulty` false → 400 변환하므로 controller 추가 검증은 선택, raw forward 권장).
- [src/user/summary.controller.spec.ts](../../src/user/summary.controller.spec.ts) — colocated controller spec + service Jest mock 주입 패턴. 본 task 의 `src/llm/difficulty-mapping.controller.spec.ts` 가 mirror (service 를 mock provider 로 주입, guard 는 overrideGuard 또는 단위 호출).

## Acceptance Criteria

- [ ] `src/llm/difficulty-mapping.controller.ts` 신설 — `@Controller("api/llm/difficulty-mappings")` + controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. `DifficultyMappingService` 를 constructor inject. SummaryController 패턴 1:1 mirror (service raw forward, controller 추가 예외 변환 0).
- [ ] **GET `/api/llm/difficulty-mappings`** — `findAllMappings()` forward, 200 OK + 슬롯 배열 (빈 배열도 정상 — 404 변환 안 함). RBAC: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (Admin+ tier — LLM 모델 지정은 administrative concern, REQ-096). 인증 부재 시 JwtAuthGuard 401, User actor 403.
- [ ] **PATCH `/api/llm/difficulty-mappings/:difficulty`** — `assignProviderConfig(difficulty, dto.llmProviderConfigId)` forward, 200 OK + 갱신된 슬롯 반환. `:difficulty` 는 path param (raw forward — service 가 `isDifficulty` false → 400 변환). RBAC: 동일 guard stack + `@Roles("Admin")` (Admin+ tier, REQ-049 명시 지정). service 의 4xx (미지원 난이도 400 / config 부재 404 / 슬롯 부재 P2025 404) 가 자동 status mapping.
- [ ] `src/llm/dto/assign-difficulty-mapping.dto.ts` 신설 — `AssignDifficultyMappingDto` (`llmProviderConfigId: string`, `@IsString` + `@IsNotEmpty` + 적정 `@MaxLength`). UpdatePartDto 패턴 mirror (단 `@IsOptional` 없음 — assign 은 필수 필드). whitelist + forbidNonWhitelisted 가 정의되지 않은 raw 키 400 reject.
- [ ] `src/llm/llm.module.ts` 의 `@Module` 에 `controllers: [DifficultyMappingController]` 추가 (배열 미존재 시 신설). `DifficultyMappingService` 는 이미 등록됨 — 재등록 0.
- [ ] **Happy-path unit test** (colocated `src/llm/difficulty-mapping.controller.spec.ts`, `DifficultyMappingService` 를 Jest mock provider 로 주입): GET 이 `findAllMappings` 결과를 그대로 반환 (3 row + 빈 배열 각 1+), PATCH 가 `assignProviderConfig` 를 `(difficulty, dto.llmProviderConfigId)` 인자로 호출하고 결과 반환 각 1+.
- [ ] **Happy-path unit test** (colocated `src/llm/dto/assign-difficulty-mapping.dto.spec.ts`): 유효한 `llmProviderConfigId` 가 validation pass (class-validator `validate()` 로 error 0 확인).
- [ ] **Error path unit test**: PATCH 가 service 의 throw (미지원 난이도 `BadRequestException` / config 부재 `NotFoundException` / 슬롯 부재 P2025 `NotFoundException` / 의존성 reject) 를 그대로 propagate 하는지 각 검증 (controller 가 swallow 하지 않음). DTO 의 빈/누락 `llmProviderConfigId` 가 validation error 발생.
- [ ] **Flow / branch 분기 cover**: GET 의 빈 배열 / 비어있지 않은 배열 분기 각 1+, PATCH 의 happy / service-throw 분기 각 1+. controller 자체에 조건 분기가 없으면 (raw forward) 본문에 "controller 분기 없음 — forward 검증으로 대체" 명시하고 DTO/service-interaction 분기로 cover.
- [ ] **Negative cases 충분 cover**: (1) **RBAC negative** — RolesGuard 단위 테스트로 비-Admin (User role) 거부 (403 의미) + 미인증 (req.user 부재) 거부 (401 의미) 각 1+ (SummaryController spec 의 guard negative 패턴 mirror; controller 단위 spec 에서 guard 직접 호출 또는 metadata 박제 검증으로). (2) **invalid difficulty** — PATCH `:difficulty` 가 미지원 값 ('Easy' 대문자 / 'trivial' / 빈 값) 일 때 service throw 가 400 으로 propagate. (3) **unknown config** — 존재하지 않는 `llmProviderConfigId` → service `NotFoundException` 404 propagate. (4) **DTO negative** — `llmProviderConfigId` 누락 / 빈 문자열 / 정의되지 않은 추가 키 각 validation reject. 단일 negative 금지 — 예외 분기마다 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 R-110 검증 수행.

## Out of Scope

- **`/api/llm/providers` config CRUD endpoint** (`LlmProviderConfig` 생성/수정/삭제 + `LlmProviderConfigService` 신설) — 본 task 의 5 파일 cap 보호 위해 별도 후속 task. 본 task 는 **difficulty-mapping 슬롯 지정 슬라이스** 만 (REQ-049/050 의 난이도↔model 매핑 부분). config CRUD 는 Follow-ups #1.
- **provider HTTP client 구현 / 실제 LLM API call** — resolve 된 `modelId` 로 외부 provider 를 호출하는 `LlmGateway` 구현 + `pnpm add` (provider SDK) 는 후속 routing task 책임. **그 task 가 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 발화** (외부 dependency + API key 자격증명). 본 task 는 HTTP-layer forward 만, 외부 호출 0.
- **새 auth-flow / RBAC 정책 변경 0** — `ROLE_HIERARCHY` / escalation / JWT 발급 chain 은 ADR-0008 / T-0083 박제값 그대로. 본 task 는 기존 guard stack 적용만 (신규 auth 결정 0).
- **audit log 영속화** — Admin 의 슬롯 지정 행위를 `PermissionDeniedRecord` / AuditLog 로 영속화하는 것은 T-0144 / ADR-0007 책임. 본 task 는 endpoint 노출만 (audit record 0).
- **3 row seed 스크립트 / fail-fast service 변경** — seed (T-0137 Out of Scope follow-up) + `resolveModel` fail-fast (T-0138 완료) 는 본 task 변경 0. 본 task 는 `findAllMappings` / `assignProviderConfig` forward 만.
- **응답 envelope (`{ data, meta }`) 표준화 / pagination / sort** — Prisma return 그대로 (기존 controller 동일 정책).
- **schema.prisma / migration 변경** — entity 는 T-0137 박제 완료. 본 task 는 controller + DTO + module 등록 + spec 만 (schema 변경 0).
- **Admin LLM 지정 UI (frontend)** — R-96 의 UI 부분은 P6 (Frontend) 책임. 본 task 는 backend endpoint 만.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0011 이 §2 resolve / §3 fail-fast 의미를 이미 확정 + T-0138 이 service contract 박제 + SummaryController 가 RBAC controller template, 신규 architecture 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
