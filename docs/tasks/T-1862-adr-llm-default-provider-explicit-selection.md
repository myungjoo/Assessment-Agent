---
id: T-1862
title: 다중-row LlmProviderConfig 의 기본 provider 선택 정책 ADR — Web UI 명시 선택 최우선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md
  - docs/architecture/data-model.md
estimatedDiff: 260
estimatedFiles: 2
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 — ADR-0048 §Decision 2 가 deferred 한 다중-row default 정책을 지금 박제. 정책 골자(명시 선택 최우선)는 오너가 확정했고 architect 는 저장 형태·API shape 만 택1. chain T-1862 → T-1863 → T-1864 → T-1865 → T-1866 → T-1867 → T-1868"
---

# T-1862 — 다중-row LlmProviderConfig 의 기본 provider 선택 정책 ADR — Web UI 명시 선택 최우선

## Why

**오너 지시 (2026-09-03)** — "다중 row 일 때 default 선택 정책 task 를 만들어라. Web UI 에서 선택할 수 있어야 하고, 사용자가 명시적으로 선택한 것이 언제나 우선이다."

현 상태는 [ADR-0048](../decisions/ADR-0048-default-model-id-source.md) §Decision 2 그대로다 — [LlmProviderConfigResolver](../../src/llm/llm-provider-config-resolver.service.ts) 가 `findMany()` row 수로 3 분기하며 row ≥ 2 면 "명시적 default 선택 정책 미박제" 한국어 fail-fast 한다. 그런데 운영 실제는 이미 다중-row 로 가고 있다:

- [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) 가 재배포마다 `SEED_LLM_CONFIG_ID` 고정 id row 를 `ON CONFLICT DO UPDATE` 로 upsert 한다 (apiKey 까지 덮어쓴다).
- Admin 이 Web UI ([AdminView.tsx](../../web/src/views/AdminView.tsx) 의 LlmProviderConfigList + 생성 폼) 로 별도 provider 를 등록하면 row 가 2 개가 되고, 난이도 매핑 경로는 정상이지만 `unevaluated-fill-run` 의 default 경로는 즉시 fail-fast 한다.

즉 "seed 가 넣은 row" 와 "Admin 이 UI 로 넣은 row" 가 공존하는 순간 default 경로가 죽는다. ADR-0048 이 예고한 후속 ADR 이 본 task 다.

**planner issue-still-relevant pre-check (origin/main `9b348ad8` 실측)**: `docs/decisions/` 최신은 ADR-0061 — 다중-row default 정책 ADR 부재. `prisma/schema.prisma` `406~418 행` LlmProviderConfig 에 `isDefault` 류 컬럼 · default 슬롯 table 없음. resolver `(c)` 분기 (row ≥ 2 fail-fast) 그대로 실재. 신규 생성이 맞다.

## Required Reading

- [docs/decisions/ADR-0048-default-model-id-source.md](../decisions/ADR-0048-default-model-id-source.md) — §Decision 2 의 후속 ADR 검토 대상 4 안 (i)~(iv) 와 §Decision 4 의 "schema migration 0" 가정. 본 ADR 이 §Decision 2 를 supersede 한다.
- [src/llm/llm-provider-config-resolver.service.ts](../../src/llm/llm-provider-config-resolver.service.ts) — 현 3 분기 fail-fast 의 정본. 본 ADR 의 우선순위 규칙이 이 분기를 어떻게 바꾸는지 명시.
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) + [prisma/schema.prisma](../../prisma/schema.prisma) `406 행` ~ `439 행` (LlmProviderConfig) · `441 행` 이후 (DifficultyMapping) — DifficultyMapping 의 "슬롯 → LlmProviderConfig FK, `onDelete: Restrict`" 패턴. 저장 형태 후보 (ii) 의 선례.
- [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) `1~30 행`, `97~116 행` — seed 의 upsert 범위. ADR 이 seed 의 default 개입 한계를 정해야 한다.
- [docs/architecture/data-model.md](../architecture/data-model.md) `31 행` (LlmProviderConfig 행), `57 행` (ERD), `80 행` (관계 8) — 동기 갱신 대상.
- [.claude/agents/architect.md](../../.claude/agents/architect.md) — ADR 형식.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md` 신설 (status PROPOSED → 머지 후 ACCEPTED 승격은 T-1868 direct). 다음 **오너 확정 사항은 결정 대상이 아니라 제약** 이며 ADR 본문에 그대로 박제한다:
  - (1) **명시 선택 최우선** — Admin 이 Web UI 에서 지정한 기본 provider 가 존재하면 seed env · `updatedAt` · row 수 · 그 어떤 자동 규칙보다 우선한다. 자동 규칙이 명시 선택을 덮어쓰거나 지우는 경로는 존재하지 않는다.
  - (2) **명시 선택 부재 시 fallback** — row 1 개면 그 row (ADR-0048 (a) 하위 호환), row 0 이면 fail-fast (기존 (b)), row ≥ 2 면 fail-fast 하되 메시지는 "Admin UI 에서 기본 provider 를 선택하라" 로 행동 지시형.
  - (3) **저장 위치는 DB** — env pointer 안 (ADR-0048 (ii)) 은 채택 금지 (재배포 env 가 UI 선택을 이길 수 있어 (1) 위반). `updatedAt` 자동 선택 (iii) 도 금지 (수정 = default 변경 이 되어 (1) 의 "명시" 가 아님).
  - (4) **기본으로 지정된 row 삭제는 409** — DifficultyMapping 의 in-use 409 와 동형. 먼저 다른 row 를 기본으로 지정한 뒤 삭제.
  - (5) **seed 는 명시 선택을 절대 덮어쓰지 않는다** — seed 가 default 를 건드리는 유일한 허용 동작은 "명시 선택이 하나도 없을 때 자기 row 를 기본으로 지정" (bootstrap 편의). 이미 선택이 있으면 seed 는 row upsert 만 하고 default 는 무변경.
- [ ] architect 가 **택1** 하는 결정 2 가지를 §Decision 에 근거와 함께 박제:
  - (A) 저장 형태 — (i) `LlmProviderConfig.isDefault Boolean @default(false)` + Postgres partial unique index (`WHERE "isDefault"`, migration raw SQL) vs (ii) 단일 슬롯 table (예: `LlmDefaultProvider { id "default" @id, llmProviderConfigId @unique, FK onDelete: Restrict }`, DifficultyMapping 패턴 mirror — 교체가 upsert 1 회로 원자적, 삭제 409 가 P2003 으로 자동). 비교 축: 원자성 · 유일성 강제 방식 · (4) 구현 비용 · 기존 패턴 정합.
  - (B) API shape — 권장안 `PUT /api/llm/providers/default` body `{ llmProviderConfigId }` → 200 + sanitize view, 그리고 목록 view 에 `isDefault: boolean` 필드 추가 (별도 GET 없이 목록 1 회로 UI 렌더 가능). 대안 (`PATCH /api/llm/providers/:id/default`) 과 비교. NestJS 는 선언 순서 매칭이라 정적 path `default` 가 `:id` 보다 **앞** 에 선언돼야 하는 함정을 명시.
- [ ] §Consequences 에 CLAUDE.md §5 "DB schema 변경 = BLOCKED" 게이트를 **오너 지시 2026-09-03 으로 사전 승인됨** 을 박제 (notifier 우회 근거). 새 dependency 0 · 새 env 0 명시.
- [ ] §Follow-ups 에 구현 chain 을 파일 · 배선 단위로 박제: T-1863 (schema + migration + repository) → T-1864 (resolver 우선순위 + service) → T-1865 (controller + DTO + api.md) → T-1866 (Web UI) → T-1867 (seed no-override) → T-1868 (requirements / PLAN doc-sync).
- [ ] [data-model.md](../architecture/data-model.md) `31 행` LlmProviderConfig 행에 기본 provider 표현 (택1 결과) 추가, ERD (`57 행` 부근) + 관계 목록 (`83 행` 다음 12 번) 동기. ADR-0048 본문은 건드리지 않는다 (supersede 표기는 T-1868 direct 에서 한 줄).
- [ ] 코드 변경 0. `pnpm lint && pnpm build && pnpm test` 가 main 과 동일하게 통과 (R-110 — tester 가 doc-only 라도 실행 확인).

## Out of Scope

- schema / migration / 코드 변경 일체 (T-1863~T-1867).
- ADR-0048 본문 수정 (status 표기 한 줄은 T-1868 direct).
- REQ-051 "custom 3 model 슬롯" 자체의 구현 — 본 ADR 은 그 진입 prerequisite 만 닫는다.
- provider 별 (per-provider) default — 오너 지시는 전역 단일 기본 provider 1 개. (iv) 안은 기각 근거만 적고 채택하지 않는다.

## Suggested Sub-agents

- architect (ADR + data-model.md) → tester (doc-only R-110 확인) → integrator.

## Follow-ups

- T-1863: 택1 (A) 에 따른 schema + migration + repository.
- T-1868: ADR-0062 status ACCEPTED 승격 + ADR-0048 §Decision 2 "superseded by ADR-0062" 한 줄 (direct).
