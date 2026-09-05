---
id: T-1863
title: 기본 provider 저장 — schema + migration + repository 읽기/지정 메서드
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1862]
touchesFiles:
  - prisma/schema.prisma
  - prisma/migrations/20260903000000_llm_default_provider/migration.sql
  - src/llm/llm-provider-config.repository.ts
  - src/llm/llm-provider-config.repository.spec.ts
estimatedDiff: 220
estimatedFiles: 4
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 chain 2/7. DB schema 변경 — CLAUDE.md §5 게이트는 오너 지시로 사전 승인 (ADR-0062 §Consequences 박제). helper-only slice 예외 근거: 소비처 (resolver + spec, service + spec) 까지 넣으면 8 파일 > cap 5 — 소비처는 T-1864 에 파일·배선 단위로 박제"
---

# T-1863 — 기본 provider 저장 — schema + migration + repository 읽기/지정 메서드

## Why

[ADR-0062](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) (T-1862) 가 택1 한 저장 형태 (A) 를 DB 와 repository 에 실체화한다. 오너 지시 (2026-09-03) "명시 선택 최우선" 의 저장 위치는 DB 이므로 schema 변경이 불가피하다 — CLAUDE.md §5 의 schema 변경 BLOCKED 게이트는 **오너 지시로 사전 승인** 됐고 ADR-0062 §Consequences 가 그 근거를 박제한다. executor 는 notifier 를 호출하지 않는다.

**소비처 동반 의무 (CLAUDE.md §3) 예외 근거 (수치)** — 본 slice 의 repository 메서드 2 개의 소비처는 resolver (`llm-provider-config-resolver.service.ts` + spec) 와 service (`llm-provider-config.service.ts` + spec) 다. 본 slice 4 파일에 그 4 파일을 더하면 8 파일로 cap 5 를 넘고, diff 도 약 220 + 260 = 480 LOC 로 cap 300 을 넘는다. 따라서 소비처 배선은 [T-1864](T-1864-llm-default-provider-resolver-precedence-service.md) 로 분리하며, 어느 파일의 어느 배선인지는 아래 Follow-ups 에 박제한다.

## Required Reading

- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) — §Decision (A) 택1 결과가 본 slice 의 schema 정본. (i) `isDefault` + partial unique index 면 migration 에 raw `CREATE UNIQUE INDEX ... WHERE "isDefault"` 를 손으로 추가, (ii) 단일 슬롯 table 이면 DifficultyMapping 과 동형 FK + `onDelete: Restrict`.
- [prisma/schema.prisma](../../prisma/schema.prisma) `406~440 행` — LlmProviderConfig · DifficultyMapping 정의. 주석 규약 (data-model.md § 참조 인용) 을 따른다.
- [prisma/migrations/20260830000000_collection_target/migration.sql](../../prisma/migrations/20260830000000_collection_target/migration.sql) — 직전 migration 의 파일명 · SQL 스타일 선례.
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — `findById` / `findMany` / `create` / `update` / `delete` 의 주석 · 시그니처 규약. 신규 메서드 2 개를 같은 규약으로 추가.
- [src/llm/llm-provider-config.repository.spec.ts](../../src/llm/llm-provider-config.repository.spec.ts) — PrismaService mock 패턴.
- [src/llm/difficulty-mapping.repository.ts](../../src/llm/difficulty-mapping.repository.ts) — 택1 (ii) 시 슬롯 upsert 의 선례.

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 에 ADR-0062 (A) 택1 결과 반영 + `prisma/migrations/20260903000000_llm_default_provider/migration.sql` 신설. `pnpm prisma validate` 통과. 기존 row 는 migration 후 **기본 지정 없음** 상태여야 한다 (자동 승격 금지 — 명시 선택 원칙).
- [ ] repository 에 **읽기** `findDefault(): Promise<LlmProviderConfig | null>` (지정 없음 → null) 와 **지정** `setDefault(id: string): Promise<LlmProviderConfig>` 추가. (i) 채택 시 `setDefault` 는 `$transaction` 으로 "전체 해제 → 대상 지정" 을 원자적으로, (ii) 채택 시 슬롯 upsert 1 회. 대상 id 부재는 Prisma P2025 를 그대로 propagate (service 가 404 변환 — T-1864).
- [ ] 두 메서드 각각 happy-path unit test 1+ (지정 후 findDefault 가 그 row · 지정 없으면 null).
- [ ] error path 1+ — PrismaService reject 가 swallow 없이 propagate, P2025 propagate.
- [ ] 분기 cover — (i) 면 "이전 default 해제 + 새 지정" 두 write 가 한 transaction 에 있음을 mock 으로 검증, (ii) 면 upsert 의 create/update 양쪽 인자.
- [ ] negative cases 각 1+ — 빈 문자열 id · 존재하지 않는 id (P2025) · 동일 id 재지정 (멱등, 두 번째 호출도 성공) · findDefault 가 apiKey 를 포함한 raw row 를 돌려주더라도 본 layer 에서 redact 하지 않음을 명시 (redact 는 service 책임 — 회귀 방지 주석).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `pnpm lint && pnpm build` 통과.
- [ ] `test/smoke` 의 schema-parity 계열 spec (`realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift.smoke-spec.ts`) 이 새 컬럼 / table 로 깨지면 **본 PR 에서 함께 갱신** (seed 스크립트의 INSERT 컬럼 목록은 T-1867 까지 무변경이어도 parity spec 이 schema 컬럼 수를 세는 경우가 있다 — 깨지는 경우에만, cap 안에서).

## Out of Scope

- resolver / service / controller / UI 배선 (T-1864 ~ T-1866).
- seed 스크립트 변경 (T-1867).
- 기존 row 의 자동 default 승격 (금지 — ADR-0062 (1)).

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- **소비처 배선 (T-1864 — 파일 · 배선 명시)**: `src/llm/llm-provider-config-resolver.service.ts` 의 `resolveDefaultModelId()` 가 `repository.findDefault()` 를 **먼저** 호출 (명시 선택 최우선) 하고 null 일 때만 기존 `findMany()` 3 분기로 fallback. `src/llm/llm-provider-config.service.ts` 에 `setDefault(id)` (P2025 → 404) + sanitize view 에 `isDefault` 필드.
