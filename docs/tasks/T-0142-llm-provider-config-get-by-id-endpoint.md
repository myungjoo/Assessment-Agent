---
id: T-0142
title: LlmProviderConfigController — GET /api/llm/providers/:id 단건 endpoint + 404 변환 + apiKey 비노출 sanitize 재사용 (Admin+ RBAC)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-051, REQ-096, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 200
estimatedFiles: 4
created: 2026-06-01
plannerNote: P4 — T-0140 Follow-up #2(단건 조회) slice. 기존 service.sanitize 재사용 + findById null→404. 외부 dep 0 HITL 미발화. R-112 backbone ×1.5 (P2002 sub 미적용 — @unique 없음).
---

# T-0142 — LlmProviderConfigController — GET /api/llm/providers/:id 단건 endpoint + 404 변환 + apiKey 비노출 sanitize 재사용 (Admin+ RBAC)

## Why

직전 머지된 [T-0140](T-0140-llm-provider-config-list-endpoint.md) 가 `GET /api/llm/providers` **목록** slice (apiKey redaction sanitize service 박제) 를 완결했고, 그 **Out of Scope 가 `GET /api/llm/providers/:id` 단건 조회를 Follow-up #2 로 명시 deferral** 했다. 본 task 는 그 deferral 의 직접 구현 — 이미 머지된 `LlmProviderConfigRepository.findById(id): Promise<LlmProviderConfig | null>` (T-0135 박제) 위에 **Admin 이 단일 LLM provider config 를 id 로 조회**하는 read-only HTTP layer 를 신설한다. [docs/architecture/p4-implementation-plan.md §2](../architecture/p4-implementation-plan.md) 표 T-0139 row (Admin LLM 모델 지정 endpoint, [PLAN.md L85/L87](../PLAN.md) R-96/R-99~103) 의 마지막 read-only 가시성 슬라이스다.

**핵심 보안 invariant (T-0140 mirror)**: `LlmProviderConfig.apiKey` 는 **secret** (평문 String 저장, encryption-at-rest 는 ADR-0006 follow-up). 단건 응답에도 `apiKey` 를 **절대 포함하면 안 된다**. 본 task 는 T-0140 이 박제한 `LlmProviderConfigService` 의 sanitize 헬퍼 (현재 private) 를 **단일 row 변환에도 재사용** 하여 (목록 / 단건 양쪽이 동일 allow-list redaction 정책을 공유) view shape (`LlmProviderConfigView`) 를 반환한다. raw row 를 controller 가 직접 직렬화하지 못하도록 sanitize 책임은 그대로 service 가 가진다.

**404 변환 분기 (본 task 의 신규 branch)**: `findById` 는 row 부재 시 `null` 을 반환 (Prisma native, throw 안 함). 단건 endpoint 는 목록 endpoint 와 달리 **부재를 정상 빈 결과로 두지 않고 404 (NotFoundException)** 로 변환한다. 이 null → 404 분기가 본 task 의 핵심 branch + negative test 대상이다.

본 task 는 **외부 dependency 0** — provider HTTP client / `pnpm add` / 외부 자격증명 0 ([p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) inventory: 본 read-only slice 게이트 **미발화**). 노출하는 endpoint 는 이미 머지된 repository.findById 를 forward + sanitize + null→404 변환하는 read-only HTTP layer 만이며, 인증/권한은 이미 설치된 `JwtAuthGuard` / `RolesGuard` / `@Roles("Admin")` 를 재사용한다. 따라서 본 task 는 **dependency-free clean next step** — HITL 게이트 미발화.

> **다음 게이트 milestone 예고 (본 task 범위 밖, 행동 0)**: P4 의 주요 잔여 작업인 **LLM provider HTTP client / `LlmGateway` 구현** (resolve 된 endpoint/apiKey 로 실제 provider 호출) 은 provider SDK `pnpm add` (`openai` / `@azure/openai` / `@anthropic-ai/sdk` / `@google/generative-ai` 등) + LLM API key 자격증명 처리를 동반하므로 [CLAUDE.md §5](../../CLAUDE.md) HITL **BLOCKED 게이트** (새 외부 dependency + 외부 자격증명) 가 의도적으로 발화하는 결정 지점이다 ([p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) 발화 시점 inventory 3). 본 task 는 그 게이트를 발화하지 않으며, config WRITE endpoint (POST/PATCH/DELETE — apiKey 를 body 로 받는 secret 처리) 도 다루지 않는다. 그 두 가지는 사용자 승인 동반 후속 task 의 책임이다.

## Required Reading

- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — 본 service 메서드가 호출할 repository. `findById(id): Promise<LlmProviderConfig | null>` (row 부재 시 `null` 반환, throw 안 함 — null-safe API, 주석 §55~58 박제) 가 노출 대상. `LlmProviderConfig` 는 `@unique`/`@@unique` **미정의** (다중 row) — P2002/ConflictException(409) 분기 부재. 본 task 는 read-only 라 create/delete/P2025 분기 사용 0.
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) — 본 task 가 메서드 1 개 추가할 service. **기존 `private sanitize(row): LlmProviderConfigView`** (명시 field pick allow-list — id/provider/endpointUrl/modelId/createdAt/updatedAt, apiKey 제외) 와 `findAll()` 패턴 박제. 본 task 는 sanitize 를 **단일 row 변환에 재사용** + null → `NotFoundException` 변환 책임을 service 에 둔다 (controller 가 아니라 service 가 404 throw — DifficultyMappingService 의 service-layer 4xx 변환 정책 mirror).
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) — 본 task 가 endpoint 1 개 추가할 controller. `@Controller("api/llm/providers")` + controller-scope `@UsePipes(ValidationPipe)` + 기존 `@Get()` findAll 의 RBAC stack (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`). 본 task 의 `@Get(":id")` 가 동일 RBAC stack 을 1:1 적용 + `@Param("id")` 로 path param 수신.
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) — service-layer 에서 부재 → `NotFoundException` 변환하는 패턴의 원형 (4xx mapping). 본 task 의 null→404 변환이 mirror.
- [src/llm/llm-provider-config.service.spec.ts](../../src/llm/llm-provider-config.service.spec.ts) — colocated service spec + `LlmProviderConfigRepository` Jest mock 주입 + apiKey redaction assertion 패턴. 본 task 가 `findById` 메서드 (happy / null→404 / apiKey 누락 / 의존성 실패) test 케이스를 **이 파일에 append**.
- [src/llm/llm-provider-config.controller.spec.ts](../../src/llm/llm-provider-config.controller.spec.ts) — colocated controller spec + `LlmProviderConfigService` Jest mock provider 주입 + guard metadata 검증 패턴. 본 task 가 `@Get(":id")` (service forward / propagate / guard·@Roles metadata) test 케이스를 **이 파일에 append**.
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — `@Roles("Admin")` escalation 정책 (Admin/SuperAdmin 통과, User 403). 본 endpoint 의 Admin+ tier source (목록 endpoint 와 동일 tier).

## Acceptance Criteria

- [ ] `src/llm/llm-provider-config.service.ts` 에 **`findById(id: string): Promise<LlmProviderConfigView>` 메서드 추가** — `repository.findById(id)` 호출, 결과가 `null` 이면 **`NotFoundException` throw** (`@nestjs/common` import), `null` 이 아니면 **기존 `sanitize(row)` 헬퍼를 재사용** 해 apiKey 제거 view 반환. sanitize 는 새로 만들지 말고 기존 private 헬퍼 재사용 (목록/단건 동일 redaction 정책 공유). view 타입은 기존 `LlmProviderConfigView` 재사용.
- [ ] `src/llm/llm-provider-config.controller.ts` 에 **`@Get(":id")` endpoint 추가** — `@Param("id") id: string` 수신 → `service.findById(id)` forward, 200 OK + sanitized 단건 view. RBAC: 기존 `@Get()` 과 동일하게 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (Admin+ tier — administrative concern, REQ-096). 인증 부재 시 JwtAuthGuard 401, User actor 403. `@Param` 은 `@nestjs/common` 에서 import.
- [ ] `src/llm/llm.module.ts` 갱신 **불요** 확인 — controller/service 는 이미 T-0140 에서 등록됨. 본 task 는 기존 class 에 메서드/endpoint 만 추가 (module 변경 0). (변경 0 이면 그대로 두고 본 항목은 점검만.)
- [ ] **Happy-path unit test** (service spec append, repository Jest mock): `findById("existing-id")` 가 mock 의 비-null row 를 apiKey 제거 view 로 변환해 반환 (1+ 케이스). repository.findById 가 정확한 id 인자로 호출됨 검증.
- [ ] **Happy-path unit test** (controller spec append, service Jest mock provider): `@Get(":id")` 가 `service.findById(id)` 결과를 그대로 반환 + service 가 path param id 로 호출됨 검증 (1+ 케이스).
- [ ] **Error path unit test**: (1) service `findById` 가 `repository.findById` 의 reject (DB 장애 등 의존성 실패) 를 swallow 하지 않고 그대로 propagate. (2) controller `@Get(":id")` 가 service 의 throw (NotFoundException / 의존성 reject) 를 그대로 propagate.
- [ ] **Flow / branch 분기 cover**: service `findById` 의 **null → NotFoundException throw 분기** 와 **비-null → sanitize view 반환 분기** 각 1+ test (두 분기 모두 명시 cover). controller 자체에 조건 분기가 없으면 (raw forward) "controller 분기 없음 — forward 검증으로 대체" 명시.
- [ ] **Negative cases 충분 cover** (단일 negative 금지 — 아래 4 종 각 1+ test):
  - (1) **404 변환 (핵심)** — `repository.findById` 가 `null` 반환 시 service `findById` 가 `NotFoundException` 을 throw (`await expect(...).rejects.toThrow(NotFoundException)`). 빈 결과를 200/undefined 로 반환하지 않음 검증.
  - (2) **secret redaction (핵심)** — service `findById` 의 반환 view 객체에 `apiKey` key 가 **존재하지 않음** 명시 assert (`expect(view).not.toHaveProperty("apiKey")`). repository mock 이 apiKey 값을 포함한 row 를 반환해도 view 에서 누락됨 검증.
  - (3) **RBAC negative** — RolesGuard 단위 또는 metadata 검증으로 비-Admin (User role) 거부 (403 의미) + 미인증 (req.user 부재) 거부 (401 의미) — 또는 `@Get(":id")` handler 의 `@UseGuards`/`@Roles` metadata 박제 검증 (목록 endpoint spec 의 guard negative 패턴 mirror).
  - (4) **의존성 실패** — repository.findById reject → service propagate (위 error path 와 별개 케이스로 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 R-110 검증 수행.

## Out of Scope

- **POST/PATCH/DELETE `/api/llm/providers` (config 생성/수정/삭제)** — `CreateLlmProviderConfigDto` / `UpdateLlmProviderConfigDto` 신설 + service create/update/delete + P2025 변환은 별도 task. config write 는 `apiKey` (secret) 를 body 로 받으므로 [CLAUDE.md §5](../../CLAUDE.md) "secret 처리" + encryption-at-rest (ADR-0006 deferred) **HITL BLOCKED 게이트 대상** — 사용자 승인 동반 후속 task 책임. 본 task 는 read-only 단건 slice 만.
- **apiKey encryption-at-rest 구현** — 평문 String 저장 (T-0135 박제값 그대로). encryption mechanism 은 ADR-0006 ([p4-impl-plan §3](../architecture/p4-implementation-plan.md) 후보 (c)) 책임. 본 task 는 **저장된 값을 응답에서 제외 (redact)** 만 — 암호화 코드 0 / secret 처리 코드 0.
- **provider HTTP client 구현 / 실제 LLM API call** — resolve 된 endpoint/apiKey 로 외부 provider 를 호출하는 `LlmGateway` 구현 + `pnpm add` (provider SDK) 는 후속 routing task 책임. **그 task 가 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 발화** (외부 dependency + API key 자격증명). 본 task 는 read-only HTTP layer 만, 외부 호출 0.
- **sanitize 헬퍼 public 노출 / 별도 util 추출** — 기존 private `sanitize` 를 단건에서 재사용만 (같은 class 내부라 private 그대로 호출 가능). public 격상 / 외부 util 파일 추출은 over-design — 본 task 0.
- **목록 endpoint (`@Get()` findAll) 변경** — T-0140 박제값 그대로. 본 task 는 `@Get(":id")` 추가만 (기존 endpoint touch 0).
- **새 auth-flow / RBAC 정책 변경 0** — `ROLE_HIERARCHY` / escalation / JWT 발급 chain 은 ADR-0008 / T-0083 박제값 그대로. 본 task 는 기존 guard stack 적용만.
- **audit log 영속화** — Admin 조회 행위 기록은 T-0144 / ADR-0007 책임. 본 task 는 endpoint 노출만.
- **schema.prisma / migration 변경** — entity 는 T-0135 박제 완료. 본 task 는 service 메서드 + controller endpoint + spec append 만 (schema 변경 0).
- **api.md / modules.md / data-model.md doc-sync** — 본 endpoint 의 api.md §5 행 갱신은 별도 direct doc-sync task (T-0141 패턴 — 본 task Follow-ups 에 기록). 본 task 는 src 코드 + spec 만.
- **Admin LLM 지정 UI (frontend)** — R-96 의 UI 부분은 P6 (Frontend) 책임. 본 task 는 backend endpoint 만.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — repository contract 는 T-0135 박제 + 기존 `LlmProviderConfigService`/`LlmProviderConfigController` (T-0140) 가 sanitize-service + RBAC controller template, 신규 architecture 결정 0. null→404 변환은 DifficultyMappingService 의 기존 service-layer 4xx 변환 관행 적용 — 보안/아키텍처 ADR 결정 아님. apiKey redaction 은 기존 sanitize 헬퍼 재사용).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)

후보 (planner 예약, 본 task 범위 밖):
- api.md §5 GET `/api/llm/providers` 행에 `:id` 단건 행 추가 doc-sync (direct, T-0141 패턴 mirror).
- POST/PATCH/DELETE config write CRUD — **[CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 (apiKey secret body 처리) + ADR-0006 동반** — 사용자 승인 필요.
- LLM provider HTTP client / `LlmGateway` 구현 — **[CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 (provider SDK `pnpm add` + LLM API key 자격증명)** — P4 의 다음 주요 milestone, 사용자 승인 필요.
