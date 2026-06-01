---
id: T-0144
title: ADR-0012 신설 — cross-cutting field policy (timezone / soft delete / createdBy / updatedAt)
phase: P4
status: DONE
completedAt: 2026-06-01T23:19:24+09:00
prNumber: 138
mergedAs: 72784a4
reviewRounds: 1
commitMode: pr
coversReq: [REQ-026, REQ-041, REQ-049]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-01
plannerNote: P4-parallel dependency-free 작업 — data-model §5 가 P3 로 미룬 cross-cutting field 결정을 ADR 로 박제. 신규 P4 entity 3종 ad-hoc 분기 방지. 외부 dep/credential/migration/auth 0.
---

# T-0144 — ADR-0012 신설: cross-cutting field policy

## Why

[docs/architecture/data-model.md §5](../architecture/data-model.md) 는 모든 entity 의 cross-cutting field (`createdAt` / `updatedAt` / `deletedAt` / `createdBy`) 와 그 timezone 정책 / soft-vs-hard delete 의 entity 별 채택 여부를 **"P3 의 `schema.prisma` 책임"** 으로 conceptual 명시만 하고 실 결정을 미뤘다. 그러나 P3 는 종료되고 ([STATE.phase](../STATE.json) = P4-in-progress, [T-0133](T-0133-p3-to-p4-phase-transition-decision.md) binding) P4 가 신규 entity 3 종 (LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord — 이 중 LlmProviderConfig / DifficultyMapping 은 이미 머지, PermissionDeniedRecord 는 후속) 을 추가 중이라, **cross-cutting field 정책이 ADR 로 박제되지 않으면 entity 마다 ad-hoc 분기**가 누적된다. [p4-implementation-plan.md §2.1 carryover 표](../architecture/p4-implementation-plan.md) + [§3 ADR 후보 "(추가) Cross-cutting field policy"](../architecture/p4-implementation-plan.md) 가 본 작업을 **P4 와 병행 가능한 dependency-free doc artifact** 로 박제했다.

본 ADR 은 **timezone (UTC 저장 정책) / `createdAt`·`updatedAt` 적용 범위 / soft-vs-hard delete 의 entity 별 표 / `createdBy` audit-source 의 schema-level 위상** 4 축을 확정한다. 외부 dependency / 자격증명 / DB migration / auth-flow 변경을 **하지 않으며** — 정책 결정 doc 만 박제한다 (migration 코드는 후속 task 책임). ADR-0005 / ADR-0007 번호는 이미 점유·예약되어 다음 free 번호 **ADR-0012** 를 사용한다.

## Required Reading

- [docs/architecture/data-model.md](../architecture/data-model.md) §5 (Cross-cutting field conceptual 표) + §2 entity 11 종 목록 (mutable / immutable 구분 source)
- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §2.1 (carryover 표 "ADR-0005 cross-cutting field policy" row) + §3 (ADR 후보 "(추가) Cross-cutting field policy" row) — 본 ADR 의 트리거 + source
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — ADR 템플릿 mirror (Context / Decision / Consequences / Alternatives 구조 + frontmatter 형식)
- [docs/decisions/ADR-0006-assessment-data-model.md](../decisions/ADR-0006-assessment-data-model.md) — raw 미저장 invariant (R-59) 와 cross-cutting field 의 정합성 확인용
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (신규 ADR-0012 row)
- [prisma/schema.prisma](../../prisma/schema.prisma) — 기존 entity (Person / User / Group / Part / LlmProviderConfig / DifficultyMapping 등) 의 실제 `createdAt` / `updatedAt` / `active` 컬럼 현황 대조 (ADR 결정이 reality 와 align 하는지 검증)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0012-cross-cutting-field-policy.md` 신설. frontmatter (`id` / `title` / `status: ACCEPTED` / `date` / `relatedTask: T-0144` / `supersedes: null`) 가 ADR-0011 형식과 일치.
- [ ] ADR 본문이 **4 축** 을 각각 명시 결정 + 사유 박제: (1) **timezone** — 모든 시각 컬럼 UTC 저장 (`TIMESTAMPTZ`, 표시 변환은 view-layer) vs KST 저장. (2) **`createdAt` / `updatedAt` 적용 범위** — 전 entity `createdAt` 공통, `updatedAt` 은 mutable entity 만 (immutable Assessment / Contribution / PermissionDeniedRecord 제외) 의 정책 + entity 별 표. (3) **soft-vs-hard delete** — entity 별 채택 표 (Person = soft via `active: false` REQ-026 / Assessment·Contribution = hard delete REQ-041 / 나머지 entity 의 default 정책). (4) **`createdBy` audit-source** — row 자체 컬럼 vs AuditLog event-stream 의 위상 + 적용 범위.
- [ ] ADR 의 결정이 [prisma/schema.prisma](../../prisma/schema.prisma) 현 reality 와 **모순되지 않는지** 본문에서 1+ 줄로 대조 명시 (이미 박제된 `createdAt`/`updatedAt`/`active` 컬럼과 align 또는 향후 정렬 follow-up 명시).
- [ ] `docs/architecture/INDEX.md` 의 ADR 목록에 ADR-0012 row 1 줄 추가.
- [ ] ADR 본문에 `Alternatives` 섹션 — 각 축의 기각 대안 (예: KST 저장 / 전 entity soft delete / `createdBy` 미보유) 1+ 박제.
- [ ] `Refs:` 줄에 T-0144 + 관련 REQ (REQ-026 / REQ-041 / REQ-049) + data-model.md / p4-implementation-plan.md 참조 박제.
- [ ] **R-112 4-항목 test 미적용** — 본 task 는 production code 0 LOC (doc-only ADR + INDEX 1 row). 새 public symbol / 분기 0 → unit test 추가 대상 없음. tester 는 **R-110 으로 `pnpm lint && pnpm build && pnpm test` green 유지** 만 확인 (코드 변경 0 이므로 기존 suite 가 그대로 통과해야 함). 이 항목은 분기 없음 — happy/error/branch/negative test 항목 생략.
- [ ] reviewer 가 §12 언어 정책 (ADR 본문 한국어, 식별자/enum 영어) + ADR 템플릿 정합성 + 결정의 reality 대조를 점검 (pr-mode).

## Out of Scope

- **`prisma/schema.prisma` 실 컬럼 변경 / migration 작성** — `deletedAt` / `createdBy` 컬럼을 entity 에 실제 추가하는 schema 변경 + `prisma migrate dev` 는 **후속 코드 task 책임** (DB schema 변경은 [CLAUDE.md §5](../../CLAUDE.md) 게이트 대상이므로 본 ADR 은 정책만 박제, migration 0). 본 task 의 commitMode 가 pr 인 것은 신규 ADR 이라서지 (§3.1 rule 4), schema 변경 때문이 아니다.
- **AuditLog entity 의 구체 schema** — [data-model.md §2 conceptual mention](../architecture/data-model.md) AuditLog 의 실 schema 는 **ADR-0007 (audit log entity schema, 예약됨)** + T-0144 후속 PermissionDeniedRecord task 책임. 본 ADR 은 `createdBy` 와 AuditLog 의 **위상 구분** 만 명시 (event-stream vs row 컬럼).
- **AssessmentModule 추출 refactor** — [p4-implementation-plan.md §5](../architecture/p4-implementation-plan.md) deferred 항목. 별도 pr-mode refactor task (cap 초과 예상 — 다수 split 필요).
- **PermissionDeniedRecord entity 구현** — p4-plan §2 표 (잠정 T-0144 row) 의 entity 코드. 외부 4xx event 영속화는 GithubAdapter / ConfluenceAdapter (HITL 게이트 task) 선행 의존이 있어 본 ADR 과 분리.
- **timezone 변환 view-layer 구현** — UTC↔KST 표시 변환 코드는 P6 (Web UI) 또는 조회 endpoint task 책임. 본 ADR 은 저장 정책만.
- **STATE.json / counters / PLAN.md status 갱신** — driver single-writer 책임 ([CLAUDE.md §9](../../CLAUDE.md)). 본 task 는 ADR + INDEX 만.

## Suggested Sub-agents

`architect → tester` — architect 가 ADR-0012 작성 + INDEX row 추가 (4 축 결정 + reality 대조). production code 변경 0 이므로 implementer 불요. tester 는 R-110 (lint/build/test green 유지) 만 확인.

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
