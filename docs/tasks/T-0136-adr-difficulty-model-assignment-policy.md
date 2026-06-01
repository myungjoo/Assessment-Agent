---
id: T-0136
title: ADR-0011 신설 — 3 난이도 (easy/medium/hard) 모델 할당 정책 박제
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-097]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-01
plannerNote: "P4 세 번째 — p4-impl-plan §3 ADR 후보 (b) 3 난이도 모델 할당 정책. T-0136 entity code 의 선행 결정. doc-only, 외부 dep 0 → HITL 게이트 미발화."
---

# T-0136 — ADR-0011 신설 — 3 난이도 (easy/medium/hard) 모델 할당 정책 박제

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 L86 (3 난이도 모델 할당, R-97) 은 해당 정책을 **"ADR 로 박제"** 하도록 명시한다. [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §3 ADR 후보 (b) 와 §2 표 T-0136 row 도 DifficultyMapping entity 진입 시 본 ADR 신설을 트리거로 박제한다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 3](../../CLAUDE.md) (ADR + 코드 혼합 task 는 split) 에 따라, **DifficultyMapping entity·repository 코드 task 의 선행 결정 ADR** 을 본 task 가 단독으로 박제한다. 본 ADR 은 3 난이도 슬롯 (easy / medium / hard) 의 cardinality 모델 (3 row 고정 vs sub-relation), 슬롯 ↔ LlmProviderConfig.modelId 매핑 의미, 미설정 슬롯의 fallback 정책을 결정해 후속 entity·repository·service task 가 일관된 contract 위에서 구현되게 한다. **외부 dependency 0 / `pnpm add` 0 / 외부 자격증명 0** — [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 미발화 (p4-plan §4 inventory: T-0136 게이트 없음).

## Required Reading

- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) — §2 표 T-0136 row + §3 ADR 후보 (b) (책임 task·신설 사유·source) + §4 (본 task 게이트 미발화 근거).
- [docs/architecture/data-model.md](../architecture/data-model.md) — DifficultyMapping entity 정의 (3 난이도 easy/medium/hard ↔ LlmProviderConfig.modelId, **3 row 고정 또는 sub-relation**) + LlmProviderConfig ↔ DifficultyMapping 1:N 관계 (§ ER + 관계 8 번 항목) + REQ-049/REQ-050 매핑.
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — 최신 ADR 포맷 템플릿 (frontmatter id/title/status/date/relatedTask + Context / Decision / Consequences / Alternatives 섹션 구조). 본 ADR 이 mirror.
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — T-0135 가 박제한 LlmProviderConfig repository (다중 row 모델, modelId 컬럼). DifficultyMapping 매핑 대상의 source.
- [docs/decisions/ADR-0006-assessment-data-model.md](../decisions/ADR-0006-assessment-data-model.md) — (제목만 인지) ADR-0006 은 이미 assessment-data-model 로 점유됨. p4-plan §3 의 "ADR-0006 (LLM key)" 표기는 stale — 본 task 는 다음 free 번호 **ADR-0011** 을 사용.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0011-difficulty-model-assignment.md` 신설 — frontmatter (id: ADR-0011 / title / status: ACCEPTED / date: 2026-06-01 / relatedTask: T-0136 / supersedes: null) + Context / Decision / Consequences / Alternatives 4 섹션 (ADR-0008 포맷 mirror).
- [ ] **Context** 섹션 — PLAN.md L86 "ADR 로 박제" 의무 + R-97 (3 난이도 모델 할당) + data-model.md DifficultyMapping (3 row 고정 vs sub-relation) + REQ-049/REQ-050 외력 박제. source 링크 명시.
- [ ] **Decision** 섹션 — 다음 3 결정을 명시: (1) 난이도 슬롯 cardinality 모델 (3 row 고정 easy/medium/hard 권장 — data-model.md 와 정합) (2) 슬롯 ↔ LlmProviderConfig.modelId 매핑 의미 (각 슬롯이 어느 provider config 의 어느 model 을 가리키는지, LlmProviderConfig 1:N) (3) 미설정/누락 슬롯의 fallback 정책 (예: 기본 provider 사용 또는 평가 거부 — 택일 박제).
- [ ] **Consequences** 섹션 — 본 결정이 후속 T-0136-code (DifficultyMapping entity·repository) / T-0137+ (LlmGateway routing) 에 미치는 영향 + 3 row 고정 모델의 seed/migration 함의 박제.
- [ ] **Alternatives** 섹션 — 채택 안 된 대안 (예: N 난이도 가변 모델 / enum 컬럼 inline 매핑 / sub-relation) 각 1+ 와 기각 사유 박제.
- [ ] [docs/architecture/INDEX.md](../architecture/INDEX.md) 의 ADR 목록에 ADR-0011 row 1 줄 추가 (해당 목록 존재 시). 없으면 본 항목 생략 명시.
- [ ] 분기 없음 — 본 task 는 doc-only (ADR 신설), 코드·test 변경 0. [CLAUDE.md §3.2](../../CLAUDE.md) R-112 4 항목 (happy/error/branch/negative unit test) 은 production code 0 LOC 이므로 적용 대상 없음 — 단 tester 는 R-110 에 따라 `pnpm lint && pnpm build && pnpm test` 가 기존 green 유지됨을 확인 (ADR 신설이 코드 정합성을 깨지 않음 검증).

## Out of Scope

- **DifficultyMapping entity / Prisma model / repository 작성** — T-0136-code (별도 후속 pr-mode task) 책임. 본 task 는 정책 ADR 만, `prisma/schema.prisma` 변경 0 / `src/llm/` 코드 0.
- **3 난이도 슬롯 seed migration** — 3 row 고정 seed 의 실제 `prisma migrate` / seed script 는 entity code task 책임.
- **LlmGateway routing 구현** — 슬롯 ↔ model 매핑을 실제 LLM 호출로 연결하는 routing 은 T-0137+ 책임.
- **Admin LLM 지정 endpoint / DTO** — T-0139 책임. 본 ADR 은 정책만, controller 0.
- **외부 provider SDK / 자격증명** — `pnpm add` 0 / secret 0. provider SDK 는 T-0137+ HITL 게이트 발화 대상.
- **ADR-0006 LLM key encryption ADR** — 별도 후속 task (p4-plan §3 후보 (c)). 본 task 는 난이도 할당 정책 ADR 단독.

## Suggested Sub-agents

`architect → tester`

## Follow-ups

- (planner 후보) T-0137(잠정) — DifficultyMapping entity Prisma model + DifficultyMappingRepository + 3 난이도 슬롯 매핑 backbone (본 ADR-0011 결정 위에서, LlmProviderConfig 1:N). pr-mode.
- (planner 후보) ADR — LlmProviderConfig.apiKey encryption-at-rest mechanism (p4-plan §3 후보 (c), 다음 free ADR 번호). pr-mode.
