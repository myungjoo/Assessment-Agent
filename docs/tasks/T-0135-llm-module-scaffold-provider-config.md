---
id: T-0135
title: LlmModule scaffold — LlmGateway interface + provider enum + LlmProviderConfig entity·repository
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 225
estimatedFiles: 5
created: 2026-06-01
plannerNote: "P4 두 번째 task — p4-impl-plan §2 T-0135 LlmModule scaffold (interface+enum+entity+repo). 외부 dep 0 → HITL 게이트 미발화."
---

# T-0135 — LlmModule scaffold — LlmGateway interface + provider enum + LlmProviderConfig entity·repository

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 L85 (LLM provider 추상화, R-99~103) 와 [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §2 표의 **T-0135 row** 를 구현한다. P4 LLM gateway chain 의 시작점으로, **외부 provider SDK 0 종 / 외부 자격증명 0 의 dependency-free scaffold** 만 박제한다 — `LlmGateway` interface + 5 provider enum + `LlmProviderConfig` Prisma model + `LlmProviderConfigRepository`. 실제 provider HTTP client 구현은 후속 T-0137+ 책임이며, 그 시점에 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트가 발화한다 (본 task 는 게이트 미발화 — §4 plan inventory 참조). 이는 LlmProviderConfig entity 의 P3-deferred carryover 흡수 ([p4-implementation-plan.md §2.1](../architecture/p4-implementation-plan.md)) 도 겸한다.

## Required Reading

- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) — §2 표 T-0135 row + §4 (본 task 게이트 미발화 근거) + §5 Out of scope.
- [docs/architecture/data-model.md](../architecture/data-model.md) — LlmProviderConfig entity 정의 (5 provider, 다중 row, custom 3 슬롯 — REQ-051) + DifficultyMapping 1:N 관계 (본 task 는 DifficultyMapping 구현 안 함, 관계만 인지).
- [docs/architecture/modules.md](../architecture/modules.md) — LlmModule 이름·책임·의존성 (외부 adapter leaf).
- [prisma/schema.prisma](../../prisma/schema.prisma) — 기존 model 패턴 (Group / Part / PersonGroupMembership), `@default(now())` / `@updatedAt` / `@@unique` directive 사용례. 새 `LlmProviderConfig` model 을 동일 컨벤션으로 추가.
- [src/user/group.repository.ts](../../src/user/group.repository.ts) — repository 패턴 (PrismaService delegate 1:1 forwarding, P2025 propagate, null-safe findById). LlmProviderConfigRepository 가 mirror 할 템플릿.
- [src/user/group.repository.spec.ts](../../src/user/group.repository.spec.ts) — colocated spec 패턴 (PrismaService Jest mock). 본 task 의 `llm-provider-config.repository.spec.ts` 가 mirror.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 공유 PrismaService mock helper (있으면 재사용).
- [src/persistence/persistence.module.ts](../../src/persistence/persistence.module.ts) — PrismaService 제공 module wiring 패턴.

## Acceptance Criteria

- [ ] `src/llm/llm-gateway.interface.ts` 신설 — `LlmGateway` interface (예: `generate(prompt, options): Promise<...>` 시그니처 1+ 추상 메서드) + `LlmProvider` enum (`custom` / `azure_openai` / `anthropic` / `google_gemini` / `openai` 5 값). 실제 구현 class 0 (interface·enum 만).
- [ ] `prisma/schema.prisma` 에 `LlmProviderConfig` model 추가 — id / provider (enum 또는 String) / endpointUrl / apiKey (String, 평문 컬럼 — encryption-at-rest 는 ADR-0006 follow-up, 본 task 는 secret 처리 코드 0) / modelId / createdAt(`@default(now())`) / updatedAt(`@updatedAt`). DifficultyMapping 1:N relation 역방향 필드 placeholder 는 두지 않음 (DifficultyMapping 은 T-0136). **`@unique` / `@@unique` 미정의** — 다중 row 모델이라 unique 제약 없음 (GroupRepository 와 동일, P2002 분기 없음).
- [ ] `prisma migrate dev` 로 migration 자동 생성 (`prisma/migrations/*`) — DB schema 반영.
- [ ] `src/llm/llm-provider-config.repository.ts` 신설 — `LlmProviderConfigRepository` (PrismaService delegate 1:1 forwarding: create / findById(null-safe) / findMany / delete). GroupRepository 패턴 mirror, P2025 propagate, 본 layer validation 0.
- [ ] `src/llm/llm.module.ts` 신설 — LlmModule (LlmProviderConfigRepository provider, PersistenceModule import). app.module.ts 에 wiring (필요 시).
- [ ] **happy-path unit test**: LlmProviderConfigRepository 의 4 메서드(create/findById/findMany/delete) 각각 happy-path test 1+ — PrismaService mock 으로 호출 인자·return 정합성 검증.
- [ ] **error path unit test**: findById row 부재 시 null 반환 검증, delete row 부재 시 P2025 propagate 검증, create 가 mock reject 시 throw propagate 검증.
- [ ] **flow / branch coverage**: findById 의 null 분기 / row-존재 분기 각 1+ test. (repository 외 단순 forwarding 메서드는 분기 없음 — 해당 항목 생략 명시.)
- [ ] **negative cases 충분 cover**: 빈 input / 잘못된 provider enum 값 / PrismaService 의존성 실패(reject) 각 1+ test. LlmProvider enum 5 값이 모두 정의됐는지 검증하는 test 1+ (interface spec, colocated `src/llm/llm-gateway.interface.spec.ts`).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **외부 provider SDK 추가** (`openai` / `@azure/openai` / `@anthropic-ai/sdk` / `@google/generative-ai` 등) — `pnpm add` 0. provider HTTP client 구현은 T-0137+ 책임이며 그 시점에 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 발화.
- **LLM API key encryption-at-rest 구현** — apiKey 컬럼은 본 task 에서 평문 String. encryption mechanism 은 ADR-0006 (별도 후속 task) 책임. 본 task 는 secret 0 기재, 암호화 코드 0.
- **DifficultyMapping entity / 3 난이도 매핑** — T-0136 책임. 본 task 는 1:N 관계 인지만, DifficultyMapping model·repository 작성 0.
- **provider별 routing / LlmGateway 구현 class** — interface·enum 만. routing 은 T-0137.
- **Admin LLM 지정 endpoint / controller / DTO** — T-0139 책임. 본 task 는 controller 0.
- **ADR 신설** — ADR-0006(LLM key encryption) / LLM 난이도 ADR 은 후속 task. 본 task 는 코드 scaffold 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 후보) ADR-0006 — LlmProviderConfig.apiKey encryption-at-rest mechanism 결정 (pr-mode, dependency 평가 동반).
- (planner 후보) T-0136 — DifficultyMapping entity + repository + 3 난이도 매핑 backbone (LlmProviderConfig 1:N).
