---
id: T-0137
title: DifficultyMapping entity + repository + Difficulty literal (ADR-0011 구현)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-051, REQ-097]
estimatedDiff: 216
estimatedFiles: 5
created: 2026-06-01
plannerNote: P4 — ADR-0011 후속 chain T-0137 candidate. DifficultyMapping entity+repo (외부 dep 0, HITL 게이트 미발화). R-112 backbone ×1.5 ×P2002 1.2.
---

# T-0137 — DifficultyMapping entity + repository + Difficulty literal (ADR-0011 구현)

## Why

[ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §"후속 task chain 박제" 의 **T-0137 candidate** 를 구현한다 — ADR 이 확정한 3 결정 (3 row 고정 cardinality / `llmProviderConfigId` FK 참조 / fail-fast) 을 DifficultyMapping Prisma model + `Difficulty` String literal union + `DifficultyMappingRepository` 로 코드 박제한다. [PLAN.md L86](../PLAN.md) "3 난이도 모델 할당 (R-97)" 의 entity layer 이며 [p4-implementation-plan.md §2 T-0136 row](../architecture/p4-implementation-plan.md) (T-0135 LlmProviderConfig 위 1:N) 가 source. 외부 dependency 0 — [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 미발화 (ADR-0011 §Consequences / p4-plan §4 박제대로).

## Required Reading

- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — 3 결정 (§1 3 row 고정 + `@@unique([difficulty])` / §2 `llmProviderConfigId` FK 참조 N:1 / §3 fail-fast) + §"후속 task chain 박제" T-0137 scope.
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — mirror 할 repository 패턴 (PrismaService delegate 1:1 forward / findById null-safe / delete P2025 propagate / create input interface).
- [src/llm/llm-provider-config.repository.spec.ts](../../src/llm/llm-provider-config.repository.spec.ts) — colocated spec 패턴 + `prisma-mock.ts` helper 사용법 (본 task 의 spec 가 mirror).
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — `LlmGenerateOptions.difficulty?` placeholder (본 task 의 `Difficulty` union 이 연결될 슬롯 식별자 source).
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — `DifficultyMappingRepository` 를 providers/exports 에 등록할 대상 module.
- [prisma/schema.prisma](../../prisma/schema.prisma) L321–329 — `LlmProviderConfig` model (DifficultyMapping 의 FK relation 부모). 본 task 가 DifficultyMapping model + relation 추가.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — repository spec 의 Jest mock helper.

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 에 `DifficultyMapping` model 추가 — `id` (`@id @default(cuid())`), `difficulty` (String), `llmProviderConfigId` (String?, nullable — ADR-0011 §3 seed nullable 시작), `llmProviderConfig` relation (`LlmProviderConfig` N:1, `onDelete: Restrict` — ADR-0011 §2 RESTRICT 권장), `@@unique([difficulty])` (ADR-0011 §1), `createdAt`/`updatedAt`. `LlmProviderConfig` model 에 역방향 `difficultyMappings DifficultyMapping[]` relation 필드 추가.
- [ ] `prisma migrate dev` 로 migration 자동 생성 (`prisma/migrations/*`). seed 는 본 task 에서 별도 스크립트 도입하지 않고 nullable FK 시작만 박제 (3 row seed 자동화는 Follow-up).
- [ ] `src/llm/difficulty.ts` 신설 — `Difficulty` String literal union (`'easy' | 'medium' | 'hard'`) + `DIFFICULTIES` 배열 (single source) + `isDifficulty(value: string): value is Difficulty` type guard. `LlmProvider` enum (llm-gateway.interface.ts) 의 `LLM_PROVIDERS`/`isLlmProvider` 패턴 mirror.
- [ ] `src/llm/difficulty-mapping.repository.ts` 신설 — `DifficultyMappingRepository` (`@Injectable`) + `LlmProviderConfigRepository` 패턴 mirror: `create(input)` / `findById(id)` (null-safe) / `findByDifficulty(difficulty)` (null-safe findUnique on `@@unique([difficulty])`) / `findMany()` / `delete(id)` (P2025 propagate) / `updateProviderConfig(difficulty, llmProviderConfigId)` (슬롯별 FK 재지정). `create` 는 `@@unique([difficulty])` 위반 시 P2002 분기 — repository 는 raw propagate (service 가 변환, ADR-0011 §3 fail-fast 는 후속 service 책임).
- [ ] `src/llm/llm.module.ts` 의 `providers`/`exports` 에 `DifficultyMappingRepository` 추가.
- [ ] **Happy-path unit test**: `difficulty.ts` 의 `isDifficulty`/`DIFFICULTIES` + repository 의 `create`/`findById`/`findByDifficulty`/`findMany`/`delete`/`updateProviderConfig` 각 happy-path 1+ (colocated spec — `src/llm/difficulty.spec.ts` + `src/llm/difficulty-mapping.repository.spec.ts`, `prisma-mock.ts` 사용).
- [ ] **Error path unit test**: `findById`/`findByDifficulty` 가 row 부재 시 null 반환 검증, `delete` 가 P2025 propagate 검증, `create` 가 P2002 (`@@unique([difficulty])` 중복) propagate 검증, PrismaService reject (DB 장애) propagate 검증.
- [ ] **Flow / branch 분기 cover**: `isDifficulty` 의 true/false 분기 각 1+, null-safe findById/findByDifficulty 의 row 존재/부재 분기 각 1+.
- [ ] **Negative cases 충분 cover**: `isDifficulty` 에 빈 문자열 / 대문자 'Easy' / 'trivial' (미정의 난이도) / 공백 등 각 false 검증, repository 에 존재하지 않는 id/difficulty, P2002/P2025 error 객체 형태별 propagate.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 R-110 검증 수행.

## Out of Scope

- **3 row seed 스크립트 도입** — `prisma/seed.ts` 자동 3 row (easy/medium/hard) 삽입은 Follow-up (본 task 는 nullable FK 시작 + model/repository 만, seed 자동화 별도).
- **DifficultyMappingService / fail-fast routing 강제** — ADR-0011 §3 의 미설정 슬롯 4xx 거부 + LlmGateway resolve 는 T-0138+ (provider HTTP client + routing) 책임.
- **Admin LLM 지정 endpoint / DTO / RBAC** — PATCH `/api/llm/difficulty-mappings` 는 T-0139 책임.
- **provider HTTP client 구현 / `pnpm add`** — 외부 dependency 추가는 T-0137 후속 routing task 의 HITL 게이트 (본 task 외부 dep 0).
- **LlmProviderConfig `@unique` 추가 / encryption-at-rest** — ADR-0006(stale)/별도 보안 ADR follow-up. 본 task 는 기존 LlmProviderConfig model 변경 = 역방향 relation 필드 1 개만.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0011 이 schema/relation contract 를 이미 확정, 신규 architecture 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
