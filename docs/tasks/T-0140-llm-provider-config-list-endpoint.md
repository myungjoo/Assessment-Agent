---
id: T-0140
title: LlmProviderConfigController — GET /api/llm/providers 목록 endpoint + apiKey 비노출 sanitize service (Admin+ RBAC)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-051, REQ-096, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 270
estimatedFiles: 5
created: 2026-06-01
plannerNote: P4 — p4-impl-plan §2 T-0139 row 의 /api/llm/providers slice(T-0139 Follow-up #1). GET 목록 + apiKey secret redact service. 외부 dep 0 HITL 미발화. R-112 backbone ×1.5.
---

# T-0140 — LlmProviderConfigController — GET /api/llm/providers 목록 endpoint + apiKey 비노출 sanitize service (Admin+ RBAC)

## Why

[docs/architecture/p4-implementation-plan.md §2](../architecture/p4-implementation-plan.md) 표의 **T-0139 row** 는 Admin LLM 모델 지정 endpoint 로 `/api/llm/providers` + `/api/llm/difficulty-mappings` 두 surface 를 매핑한다. 직전 머지된 [T-0139](T-0139-difficulty-mapping-admin-endpoint.md) 가 difficulty-mappings slice 를 완결했고, 그 **Out of Scope 가 `/api/llm/providers` config CRUD 를 Follow-up #1 로 명시 deferral** 했다. 본 task 는 그 deferral 의 첫 slice — 이미 머지된 `LlmProviderConfigRepository` (T-0135, `findMany` 보유) 위에 **Admin 이 등록된 LLM provider config 목록을 조회**하는 read-only HTTP layer 를 신설한다. [PLAN.md L85/L87](../PLAN.md) "LLM provider 추상화 (R-99~103) + Admin 이 LLM 모델 지정 (R-96)" 의 backend gateway 가시성 슬라이스다.

**핵심 보안 invariant**: `LlmProviderConfig.apiKey` 는 **secret** (평문 String 으로 저장, encryption-at-rest 는 ADR-0006 follow-up). GET 응답에 `apiKey` 를 **절대 포함하면 안 된다**. 따라서 본 task 는 repository 의 raw row 를 그대로 forward 하지 않고, `apiKey` 를 제거한 view shape 를 반환하는 얇은 `LlmProviderConfigService` 를 신설한다 (controller 가 raw row 를 직접 직렬화하지 못하도록 service 가 sanitize 책임을 가짐). 이 redaction 이 본 task 의 negative test 핵심이다.

본 task 는 **외부 dependency 0** — provider HTTP client / `pnpm add` / 외부 자격증명 0 ([p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) inventory: 본 slice 게이트 **미발화**). 노출하는 endpoint 는 이미 머지된 repository 를 forward 하는 read-only HTTP layer 만이며, 인증/권한은 이미 설치된 `JwtAuthGuard` / `RolesGuard` / `@Roles` 를 재사용한다. 실제 provider 호출 (resolve 된 endpoint/apiKey 로 LLM API call) + provider SDK 추가는 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트가 발화하는 후속 routing task 책임이다. 따라서 본 task 는 **dependency-free clean next step** — HITL 게이트 미발화.

## Required Reading

- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — 본 service 가 wrapping 할 repository. `findMany(): Promise<LlmProviderConfig[]>` (다중 row 모델 전체 조회, 빈 배열 가능) 가 노출 대상. `LlmProviderConfig` 는 `@unique`/`@@unique` **미정의** (다중 row) — P2002 / ConflictException(409) 분기 부재 (주석 §14~17 박제). 본 task 는 read-only 라 create/delete/P2025 분기도 사용 0.
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) — 직전 T-0139 가 박제한 mirror 대상. `@Controller(...)` + controller-scope `@UsePipes(new ValidationPipe({ whitelist, forbidNonWhitelisted, transform }))` + endpoint 별 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + service forward. 본 controller 의 RBAC stack / ValidationPipe wire template (1:1 mirror).
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) — service 가 repository 를 inject 하고 raw forward 하는 패턴. 본 task 의 `LlmProviderConfigService` 가 mirror 하되 **추가로 apiKey sanitize** (raw row → view shape 변환) 책임을 가짐.
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) — controller RBAC chain 의 원형 (GET 의 `@Roles("User")` vs POST/DELETE 의 `@Roles("Admin")` tier 결정 근거). 본 task 의 GET 은 LLM 모델 지정이 administrative concern (REQ-096) 이므로 **Admin+ tier** (DifficultyMappingController GET 과 동일).
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — `@Roles("Admin")` escalation 정책 (Admin/SuperAdmin 통과, User 403). 본 endpoint 의 Admin+ tier source.
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — `LlmProviderConfigController` 를 `controllers` 배열에 추가하고 `LlmProviderConfigService` 를 `providers` 에 등록할 대상 module (`LlmProviderConfigRepository` 는 이미 providers/exports 에 등록됨 — service 가 inject 만).
- [src/llm/difficulty-mapping.controller.spec.ts](../../src/llm/difficulty-mapping.controller.spec.ts) — colocated controller spec + service Jest mock 주입 + guard metadata 검증 패턴. 본 task 의 `src/llm/llm-provider-config.controller.spec.ts` 가 mirror.
- [src/llm/difficulty-mapping.service.spec.ts](../../src/llm/difficulty-mapping.service.spec.ts) — colocated service spec + repository Jest mock 주입 패턴. 본 task 의 `src/llm/llm-provider-config.service.spec.ts` 가 mirror (특히 apiKey redaction assertion).
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — repository spec 가 공유하는 PrismaService mock helper (필요 시 service spec 가 import; 단 본 service spec 는 repository 자체를 mock 하므로 helper 불요할 수 있음 — colocated mock 우선).

## Acceptance Criteria

- [ ] `src/llm/llm-provider-config.service.ts` 신설 — `LlmProviderConfigService` 가 `LlmProviderConfigRepository` 를 constructor inject. `findAll()` 메서드: `repository.findMany()` 결과 각 row 에서 **`apiKey` 를 제거한 view shape** (id / provider / endpointUrl / modelId / createdAt / updatedAt — `apiKey` 제외) 배열을 반환. sanitize 는 명시적 field pick 또는 rest destructuring (`const { apiKey, ...view } = row`) 로 구현 (전체 row spread 후 delete 금지 — 누락 방지 위해 명시 pick 권장). view shape 의 TypeScript 타입을 export (예: `LlmProviderConfigView`).
- [ ] `src/llm/llm-provider-config.controller.ts` 신설 — `@Controller("api/llm/providers")` + controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. `LlmProviderConfigService` 를 constructor inject. DifficultyMappingController 패턴 1:1 mirror.
- [ ] **GET `/api/llm/providers`** — `service.findAll()` forward, 200 OK + sanitized 배열 (빈 배열도 정상 — 404 변환 안 함). RBAC: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (Admin+ tier — LLM provider config 는 administrative concern, REQ-096). 인증 부재 시 JwtAuthGuard 401, User actor 403.
- [ ] `src/llm/llm.module.ts` 갱신 — `@Module` 의 `controllers` 배열에 `LlmProviderConfigController` 추가, `providers` 와 `exports` 배열에 `LlmProviderConfigService` 추가. `LlmProviderConfigRepository` 는 이미 등록됨 — 재등록 0.
- [ ] **Happy-path unit test** (colocated `src/llm/llm-provider-config.service.spec.ts`, `LlmProviderConfigRepository` 를 Jest mock 으로 주입): `findAll()` 이 `findMany` 의 각 row 를 apiKey 제거 view 로 변환해 반환 (다중 row 1+ 케이스). 빈 배열 입력 → 빈 배열 반환 케이스 1+.
- [ ] **Happy-path unit test** (colocated `src/llm/llm-provider-config.controller.spec.ts`, `LlmProviderConfigService` 를 Jest mock provider 로 주입): GET 이 `service.findAll()` 결과를 그대로 반환 (비어있지 않은 배열 + 빈 배열 각 1+).
- [ ] **Error path unit test**: service `findAll()` 이 `repository.findMany()` 의 reject (DB 장애 등 의존성 실패) 를 swallow 하지 않고 그대로 propagate. controller GET 이 service 의 throw 를 그대로 propagate.
- [ ] **Flow / branch 분기 cover**: service `findAll()` 의 빈 배열 / 비어있지 않은 배열 분기 각 1+. controller 자체에 조건 분기가 없으면 (raw forward) 본문에 "controller 분기 없음 — forward 검증으로 대체" 명시하고 service-interaction 분기로 cover.
- [ ] **Negative cases 충분 cover**: (1) **secret redaction (핵심)** — service `findAll()` 의 반환 view 객체에 `apiKey` key 가 **존재하지 않음** 을 명시 assert (`expect(view).not.toHaveProperty("apiKey")` 또는 `expect(Object.keys(view)).not.toContain("apiKey")`). repository mock 이 apiKey 값을 포함한 row 를 반환해도 view 에서 누락됨을 검증. **단일 row 가 아니라 다중 row 모두** apiKey 누락 확인. (2) **RBAC negative** — RolesGuard 단위 테스트로 비-Admin (User role) 거부 (403 의미) + 미인증 (req.user 부재) 거부 (401 의미) 각 1+ (DifficultyMappingController spec 의 guard negative 패턴 mirror; controller 단위 spec 에서 guard 직접 호출 또는 `@Roles`/`@UseGuards` metadata 박제 검증으로). (3) **의존성 실패** — repository reject → service propagate (위 error path 와 별개 케이스로 명시). 단일 negative 금지 — 위 3 종 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 R-110 검증 수행.

## Out of Scope

- **POST/PATCH/DELETE `/api/llm/providers` (config 생성/수정/삭제)** — `CreateLlmProviderConfigDto` / `UpdateLlmProviderConfigDto` 신설 + service create/update/delete + repository delete(P2025) 변환 + ConflictException 처리는 **본 task 5 파일 cap 보호 위해 Follow-up #1**. 본 task 는 **read-only 목록 slice** 만 (apiKey redaction backbone 박제). create slice 가 본 redaction service 위에 build.
- **GET `/api/llm/providers/:id` (단건 조회)** — `findById` 기반 단건 + 404 변환은 Follow-up #2 (본 task 는 목록만). 단건도 apiKey redaction 동일 적용 필요 — 본 task 의 service sanitize 헬퍼를 재사용.
- **apiKey encryption-at-rest 구현** — 평문 String 저장 (T-0135 박제값 그대로). encryption mechanism 은 ADR-0006 (p4-impl-plan §3 후보 (c)) 책임. 본 task 는 **저장된 값을 응답에서 제외 (redact)** 만 — 암호화 코드 0 / secret 처리 코드 0.
- **provider HTTP client 구현 / 실제 LLM API call** — resolve 된 endpoint/apiKey 로 외부 provider 를 호출하는 `LlmGateway` 구현 + `pnpm add` (provider SDK) 는 후속 routing task 책임. **그 task 가 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 발화** (외부 dependency + API key 자격증명). 본 task 는 read-only HTTP layer 만, 외부 호출 0.
- **새 auth-flow / RBAC 정책 변경 0** — `ROLE_HIERARCHY` / escalation / JWT 발급 chain 은 ADR-0008 / T-0083 박제값 그대로. 본 task 는 기존 guard stack 적용만 (신규 auth 결정 0).
- **audit log 영속화** — Admin 의 조회/지정 행위 기록은 T-0144 / ADR-0007 책임. 본 task 는 endpoint 노출만 (audit record 0).
- **응답 envelope (`{ data, meta }`) 표준화 / pagination / sort / provider 별 필터** — sanitized Prisma return 그대로 (기존 controller 동일 정책).
- **schema.prisma / migration 변경** — entity 는 T-0135 박제 완료. 본 task 는 service + controller + module 등록 + spec 만 (schema 변경 0).
- **Admin LLM 지정 UI (frontend)** — R-96 의 UI 부분은 P6 (Frontend) 책임. 본 task 는 backend endpoint 만.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — repository contract 는 T-0135 박제 + DifficultyMappingController/Service 가 RBAC controller + sanitize-service template, 신규 architecture 결정 0. apiKey redaction 은 보안 ADR 결정이 아니라 응답 직렬화 정책으로 기존 secret-비노출 관행 적용).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
