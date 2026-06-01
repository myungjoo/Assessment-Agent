---
id: ADR-0012
title: Cross-cutting field policy — timezone (UTC 저장) / createdAt·updatedAt 적용 범위 / soft-vs-hard delete entity 별 표 / createdBy audit-source 위상 박제
status: ACCEPTED
date: 2026-06-01
relatedTask: T-0144
supersedes: null
---

# ADR-0012 — Cross-cutting field policy 박제

## Context

본 ADR 은 [docs/architecture/data-model.md §5 (Cross-cutting field conceptual 표)](../architecture/data-model.md) 가 **"구체 컬럼명·type·default·timezone 정책은 P3 의 `schema.prisma` 책임"** 으로 미룬 4 축 (timezone / `createdAt`·`updatedAt` 적용 범위 / soft-vs-hard delete entity 별 채택 / `createdBy` audit-source) 의 결정을 single source of truth 로 박제한다. P3 는 종료되고 ([STATE.phase](../STATE.json) = P4-in-progress, [T-0133](../tasks/T-0133-p3-to-p4-binding-decision.md) binding option (c) hybrid-parallel) P4 가 신규 entity 3 종 (LlmProviderConfig / DifficultyMapping 머지 완료 + PermissionDeniedRecord 후속) 을 추가 중이라, cross-cutting field 정책이 ADR 로 박제되지 않으면 **entity 마다 ad-hoc 분기** (어떤 entity 에 `updatedAt` 을 두는지 / 어떤 entity 가 soft delete 인지) 가 누적된다.

[p4-implementation-plan.md §2.1 carryover 표](../architecture/p4-implementation-plan.md) (P3-deferred "ADR-0005 cross-cutting field policy" row) + [§3 ADR 후보 "(추가) Cross-cutting field policy"](../architecture/p4-implementation-plan.md) 가 본 작업을 **P4 와 병행 가능한 dependency-free doc artifact** 로 박제했다. 단 p4-plan 의 "ADR-0005" 표기는 stale — ADR-0005 는 이미 [MCP tools for PR review flow](ADR-0005-mcp-tools-for-pr-review-flow.md) 로 점유, 다음 free 번호는 ADR-0011 (난이도) 다음의 **ADR-0012** 다 (ADR-0007 은 audit-log schema 후보로 예약·미신설). 본 ADR 은 ADR-0012 를 사용한다.

### 결정 대상 4 축

[data-model.md §5 표](../architecture/data-model.md) 가 4 cross-cutting field 의 존재만 conceptual 박제하고 구체 정책을 미뤘다. 본 ADR 이 그 4 축을 확정:

- **축 (1) timezone** — 모든 시각 컬럼의 저장 timezone (UTC 저장 + view-layer 변환 vs KST 저장).
- **축 (2) `createdAt` / `updatedAt` 적용 범위** — 전 entity `createdAt` 공통 + `updatedAt` 의 entity 별 적용 (mutable only vs 전 entity).
- **축 (3) soft-vs-hard delete** — entity 별 삭제 정책 표 (Person soft via `active` / Assessment·Contribution hard / 나머지 default).
- **축 (4) `createdBy` audit-source** — mutation 발화 User 추적을 row 자체 컬럼으로 둘지 AuditLog event-stream 으로 둘지의 위상 + 적용 범위.

### REQ 외력 (본 ADR 이 cover)

- **REQ-026** ([docs/requirements.md](../requirements.md)) — 인원 CRUD + Deactivate/Activate. Person 의 soft delete (`active: false`) 정책의 출처 — 축 (3).
- **REQ-041** ([docs/requirements.md](../requirements.md)) — Admin 이 최근 N일 평가 결과 manual delete → 재수집. Assessment / Contribution 의 hard delete lifecycle 출처 — 축 (3).
- **REQ-049** ([docs/requirements.md](../requirements.md)) — Admin 이 LLM 모델 지정. P4 신규 mutable entity (LlmProviderConfig / DifficultyMapping) 의 `updatedAt` / 삭제 정책 적용 대상 — 축 (2)·(3).

### 기반 ADR / reality 정합

- [ADR-0002 — Persistence DB / ORM](ADR-0002-db.md) — **PostgreSQL 16+ + Prisma**. 본 ADR 의 timezone / timestamp 결정은 Prisma `DateTime` 매핑 위에서 성립.
- [ADR-0006 — Assessment 데이터 모델](ADR-0006-assessment-data-model.md) §6 — Assessment / Contribution / Summary = hard delete + `updatedAt` 미정의 박제. 본 ADR 의 축 (2)·(3) 표가 그 결정을 흡수·일반화 (ADR-0006 은 자기 3 entity 의 최소 cross-cutting 결정만 박제하고 전면 정책은 본 ADR 로 위임 — ADR-0006 Decision §6 명시).
- [ADR-0011 — 3 난이도 모델 할당](ADR-0011-difficulty-model-assignment.md) — DifficultyMapping (mutable, `updatedAt` 보유) 의 출처. 본 ADR 축 (2) 표 정합.
- [prisma/schema.prisma](../../prisma/schema.prisma) — 본 ADR 결정이 정합해야 하는 **현 reality** (§ Decision 각 축에서 1:1 대조).

## Decision

본 ADR 은 4 축 정책을 박제한다. 모든 결정은 [prisma/schema.prisma](../../prisma/schema.prisma) 현 reality 와 **모순되지 않으며**, reality 와 어긋나는 부분 (예: `TIMESTAMPTZ` 미명시 / `createdBy` 컬럼 부재) 은 향후 정렬 follow-up 으로 명시한다.

### Decision §1 — timezone: 모든 시각 컬럼 UTC 저장 (view-layer 변환)

- **UTC 저장 채택** — 모든 entity 의 시각 컬럼 (`createdAt` / `updatedAt` / `periodStart` / 향후 `deletedAt`) 은 **UTC 로 저장**한다. KST (Asia/Seoul, UTC+9) 등 사용자 timezone 변환은 **view-layer (조회 endpoint / Web UI) 책임** — DB 는 항상 UTC 단일 기준.
- **reality 대조** — 현 [schema.prisma](../../prisma/schema.prisma) 의 모든 시각 컬럼은 `DateTime @default(now())` / `@updatedAt` 로 정의되어 있다. Prisma `DateTime` 은 PostgreSQL `timestamp(3)` (= `TIMESTAMP WITHOUT TIME ZONE`) 로 매핑되며, `now()` / Node `Date` 는 UTC instant 를 기록하므로 **저장 값은 사실상 UTC** — 본 §1 의 UTC 저장 정책과 reality 가 align 한다.
- **향후 정렬 follow-up (모순 아님, 명시적 강화)** — 의미를 schema 차원에서 못박으려면 `@db.Timestamptz(3)` (= `TIMESTAMPTZ`) 로 격상하는 것이 권장이나, 이는 (i) 기존 컬럼 type 변경 migration (ii) 전 entity 일괄 적용 cost 가 있어 **별도 코드 task 의 책임**으로 분리한다. 본 ADR 은 저장 기준 (UTC) 만 정책으로 못박고, `TIMESTAMPTZ` 격상은 reality 와 충돌하지 않는 **후속 정렬 옵션**으로 박제 — 현 `timestamp(3)` + UTC instant 도 본 정책을 위반하지 않는다 (값이 UTC 이므로).
- **view-layer 변환 위치** — UTC↔KST 표시 변환 코드는 P6 (Web UI) 또는 조회 endpoint task 의 책임 (본 ADR Out of scope). 저장 정책만 본 §1 이 확정.

### Decision §2 — `createdAt` / `updatedAt` 적용 범위

- **`createdAt` 전 entity 공통** — 모든 entity 가 `createdAt DateTime @default(now())` 를 보유한다 (row 최초 생성 시각, audit / 시계열 조회 backbone).
- **`updatedAt` 은 mutable entity 만** — 갱신 가능한 entity 만 `updatedAt DateTime @updatedAt` 를 보유한다. **immutable entity** (생성 후 갱신 없이 삭제·재생성만 하는 entity) 는 `updatedAt` 을 **정의하지 않는다** — 갱신이 없으므로 불필요하며, 컬럼 부재가 immutability 를 schema 차원에서 표식한다.
- **entity 별 적용 표** ([schema.prisma](../../prisma/schema.prisma) reality 1:1 대조):

| entity | mutable / immutable | `createdAt` | `updatedAt` | reality 정합 |
| --- | --- | --- | --- | --- |
| **Person** | mutable | ✓ | ✓ | align (`@updatedAt` 보유) |
| **Group** | mutable | ✓ | ✓ | align |
| **Part** | mutable | ✓ | ✓ | align |
| **User** | mutable | ✓ | ✓ | align |
| **ServiceIdentity** | mutable | ✓ | ✓ | align |
| **LlmProviderConfig** | mutable | ✓ | ✓ | align (T-0135) |
| **DifficultyMapping** | mutable | ✓ | ✓ | align (T-0137, 슬롯별 model 재지정 — ADR-0011) |
| **PersonGroupMembership** | immutable (join) | ✓ | — | align (`updatedAt` 미정의 — membership 은 생성·삭제만) |
| **Assessment** | immutable | ✓ | — | align (ADR-0006 §1, 재평가 = hard delete 후 재생성) |
| **Contribution** | immutable | ✓ | — | align (ADR-0006 §2) |
| **Summary** | immutable | ✓ | — | align (ADR-0006 §3, 재계산 = 재생성) |
| **PermissionDeniedRecord** | immutable | ✓ (후속) | — (후속) | 후속 entity (T-0144 후속 코드 task) — 외부 4xx event 의 영속 기록은 갱신 없는 append-only → immutable, `createdAt` 만. 본 ADR 이 정책 사전 박제 |

- **reality 대조 요지** — 현 schema 의 mutable 7 entity 모두 `@updatedAt` 보유, immutable 4 entity (PersonGroupMembership / Assessment / Contribution / Summary) 모두 `updatedAt` 미정의 — 본 §2 정책과 **완전 align** (모순 0).

### Decision §3 — soft-vs-hard delete: entity 별 표

- **default = hard delete** — 명시적으로 soft delete 가 요구되지 않는 모든 entity 는 **hard delete** (`DELETE` row 물리 삭제). soft delete 는 (i) 데이터 보존 요구 (평가 이력 / 휴직자 명단 숨김) 가 명시된 entity 에만 선택적으로 채택한다 — 전 entity soft delete 는 query 마다 `WHERE deletedAt IS NULL` 부담 + tombstone 누적이라 채택 안 함 (Alternatives §(2)).
- **soft delete 표식 방식** — `deletedAt` tombstone 컬럼 대신, **이미 도메인 의미를 가진 flag** (`Person.active: Boolean`) 로 표현한다 — Person 의 휴직/복직은 `active = false/true` toggle 이 REQ-026 의 Deactivate/Activate 의미와 직결 ([UC-03](../use-cases/UC-03-person-crud.md) §5). 별도 `deletedAt` 컬럼을 entity 에 일괄 추가하지 않는다 (현 reality 에 `deletedAt` 컬럼 0 — 본 정책과 align).
- **entity 별 삭제 정책 표** ([schema.prisma](../../prisma/schema.prisma) reality + REQ 대조):

| entity | 삭제 정책 | 표식 | 출처 | reality 정합 |
| --- | --- | --- | --- | --- |
| **Person** | **soft** | `active: false` (평가 데이터 보존, 명단에서 숨김) | REQ-026 / UC-03 Deactivate | align (`active Boolean @default(true)` 보유, `deletedAt` 없음) |
| **Assessment** | **hard** | row 물리 삭제 (재수집 lifecycle) | REQ-041 / REQ-037 / ADR-0006 §6 | align (`deletedAt` 미정의) |
| **Contribution** | **hard** | row 물리 삭제 (Assessment cascade) | REQ-041 / ADR-0006 §6 | align |
| **Summary** | **hard** | row 물리 삭제 (재계산 = 재생성) | ADR-0006 §3 | align |
| **Group** | **hard** | row 물리 삭제 (자유 grouping) | REQ-028 "임의 group" semantics / schema.prisma 헤더 | align (Group → membership Cascade) |
| **Part** | **hard** (restricted) | row 물리 삭제, 단 소속 Person 1+ 이면 FK `Restrict` 로 차단 | REQ-028 "정확히 1 Part" invariant / schema.prisma 헤더 | align (Person → Part default Restrict) |
| **PersonGroupMembership** | **hard** | row 물리 삭제 (Person/Group cascade) | schema.prisma 헤더 cascade 결정 | align |
| **ServiceIdentity** | **hard** | row 물리 삭제 (Person hard delete 시 cascade) | schema.prisma 헤더 cascade 결정 | align |
| **User** | **hard** | row 물리 삭제 (계정 삭제) | data-model.md §2 / schema.prisma | align (relation 미박제, cascade 후속) |
| **LlmProviderConfig** | **hard** (restricted) | row 물리 삭제, 단 DifficultyMapping 이 참조 중이면 FK `Restrict` 로 차단 | ADR-0011 §2 | align (DifficultyMapping → LlmProviderConfig `onDelete: Restrict`) |
| **DifficultyMapping** | **hard** | row 물리 삭제 (슬롯 재지정) | ADR-0011 | align |
| **PermissionDeniedRecord** | **hard** | row 물리 삭제 (audit 보존 기간 경과 시 purge — 보존 기간 정책은 후속) | data-model.md §2 / T-0144 후속 | 후속 entity (정책 사전 박제) |

- **reality 대조 요지** — 현 schema 에 `deletedAt` 컬럼은 어디에도 없고 Person 만 `active` flag 를 가진다 — 본 §3 의 "soft = Person `active` only, 나머지 hard, `deletedAt` 일괄 미도입" 정책과 **완전 align** (모순 0).

### Decision §4 — `createdBy` audit-source: AuditLog event-stream (row 컬럼 미도입)

- **AuditLog event-stream 채택, row 컬럼 미도입** — mutation 발화 User 추적 (`createdBy` / `updatedBy`) 은 **각 entity row 에 `createdBy` FK 컬럼을 부착하지 않고**, 별도 **AuditLog entity 의 event-stream** ([data-model.md §2 conceptual mention](../architecture/data-model.md)) 으로 박제한다. 즉 "누가 이 row 를 만들었나 / 바꿨나" 는 AuditLog 의 `(actorUserId, action, targetEntity, targetId, at)` event 로 추적하며, 각 도메인 entity 는 audit 책임을 지지 않는다 (관심사 분리).
- **위상 구분 (data-model.md §5 의 `createdBy` ↔ AuditLog 구분 확정)** — data-model.md §5 는 "`createdBy` 는 row 자체에, AuditLog 는 event-stream 형태" 의 **두 가능성** 을 conceptual 병기했다. 본 ADR 은 그 중 **AuditLog event-stream 단일 채택** 으로 확정 — row 컬럼 방식 (`createdBy`) 은 (i) 전 entity 컬럼 부착 cost (ii) `updatedBy` 는 최근 1 회만 보존 (이력 손실) (iii) User 삭제 시 FK 정합 부담 (iv) audit 관심사가 도메인 schema 에 누수 — 4 차원에서 event-stream 열세이므로 미채택 (Alternatives §(3)).
- **reality 대조** — 현 [schema.prisma](../../prisma/schema.prisma) 의 어떤 entity 도 `createdBy` / `updatedBy` 컬럼을 보유하지 않는다 — 본 §4 의 "row 컬럼 미도입" 결정과 **align** (모순 0). AuditLog entity 자체의 구체 schema (컬럼 / index / 보존) 는 **ADR-0007 (audit log entity schema, 예약·미신설)** + T-0144 후속 PermissionDeniedRecord task 의 책임 — 본 ADR 은 `createdBy` 의 **위상** (row 컬럼 아님, event-stream) 만 확정한다.
- **적용 범위** — audit 대상은 **state-changing mutation** (User 등급 변경 / 평가 삭제 / Import-Export / LLM config 변경 등) — 조회 (GET) 는 audit 대상 아님. 구체 audit 대상 action 목록은 ADR-0007 책임.

## Consequences

### 양의 (positive)

1. **신규 P4 entity ad-hoc 분기 차단** — PermissionDeniedRecord 등 후속 entity 가 본 ADR §2·§3 표를 참조해 `createdAt`-only / hard delete / `createdBy` 미보유를 일관되게 적용 → architect / implementer 의 cross-cutting field 환각 ↓.
2. **reality 와 0 모순 — migration 불요** — 4 축 결정이 현 [schema.prisma](../../prisma/schema.prisma) 와 모두 align (UTC instant / mutable=`updatedAt` / soft=Person `active` only / `createdBy` 컬럼 0) → 본 ADR 머지로 즉시 발생하는 schema 변경 0 (doc-only).
3. **관심사 분리 (§4)** — audit 를 AuditLog event-stream 으로 외화해 도메인 entity schema 가 audit 책임에서 자유 → 도메인 모델 단순성 보존 + audit 이력 full 보존 (row 컬럼은 최근 1 회만).
4. **UTC 단일 기준 (§1)** — DB 가 항상 UTC 이므로 timezone 버그 surface (DST / offset 혼선) 가 view-layer 1 곳으로 집중 → 비교 / 정렬 / 집계 query 가 timezone-free.
5. **soft delete 최소화 (§3)** — Person 1 entity 만 soft (도메인 의미 `active` flag) → 나머지 entity 의 query 가 `WHERE deletedAt IS NULL` 부담 없이 단순.

### 음의 (negative) / trade-off

1. **timezone 의미의 schema 차원 미강제 (§1)** — `timestamp(3)` 는 type 차원에서 UTC 를 강제하지 않음 (값이 UTC 일 뿐). 잘못된 코드가 local time 을 기록하면 schema 가 막지 못함. mitigation: Prisma `now()` / Node `Date` 가 UTC instant 이므로 정공법 경로는 안전 + `TIMESTAMPTZ` 격상 follow-up 으로 강화 가능.
2. **AuditLog 의존 (§4)** — `createdBy` 를 row 에 두지 않으므로 "이 row 작성자" 조회가 AuditLog join / 조회를 요구 → 단순 조회 cost ↑. mitigation: audit 는 본래 빈번 조회 대상이 아님 (관리/감사 시점만) + AuditLog index (ADR-0007) 로 완화.
3. **soft delete 확장 시 ADR 갱신 (§3)** — 향후 다른 entity 에 보존 요구 (예: 평가 결과 soft delete) 가 생기면 본 §3 표 갱신 ADR 필요. mitigation: 현 요구 (REQ-026 Person only) 범위에서 안정, 확장은 명시적 ADR 경로.
4. **`updatedAt` 부재 entity 의 갱신 금지 (§2)** — immutable entity (Assessment 등) 를 향후 갱신해야 하면 `updatedAt` 추가 + immutability 재검토 ADR 필요. mitigation: ADR-0006 이 재평가 = 삭제 후 재생성 lifecycle 을 이미 박제 → 갱신 요구 자체가 발생 안 함.

### 후속 task chain 박제 (ADR-first, doc-only)

본 ADR (doc-only, pr-mode) 머지 후 후속 — [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) (ADR = pr-column) 정합:

| 후속 task (잠정) | scope | dependency | 비고 |
| --- | --- | --- | --- |
| **PermissionDeniedRecord entity** (T-0144 후속 코드 task) | Prisma model (`createdAt`-only, hard delete, `createdBy` 미보유 — 본 ADR §2·§3·§4 적용) + repository | 본 ADR + GithubAdapter/ConfluenceAdapter (HITL 게이트) | 본 ADR 표가 cross-cutting field 결정 제공 |
| **ADR-0007 (audit log entity schema)** | AuditLog entity 구체 schema (`actorUserId` / `action` / `targetEntity` / `targetId` / `at` + index + 보존 기간) — 본 ADR §4 의 event-stream 위상 위에서 | 본 ADR §4 | `createdBy` event-stream 의 실 schema 박제 |
| **`TIMESTAMPTZ` 격상** (선택, 향후) | 전 entity 시각 컬럼 `@db.Timestamptz(3)` 격상 migration — 본 ADR §1 UTC 정책의 schema 차원 강화 | 본 ADR §1 | reality 와 비충돌 — 의미 강화 옵션 |
| **timezone view-layer 변환** | UTC↔KST 표시 변환 (조회 endpoint / Web UI) | 본 ADR §1 | P6 또는 조회 endpoint task |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(0) UTC 저장 + mutable-only updatedAt + Person-only soft + AuditLog event-stream** (채택) | 현 reality 0 모순 (migration 불요) / timezone 단일 기준 / 관심사 분리 / soft delete 최소화 / 신규 entity 일관 적용 | timezone schema 차원 미강제 (값만 UTC) / AuditLog 조회 cost / 확장 시 ADR 갱신 | **✓ 채택** |
| **(1) KST 저장** (모든 시각 컬럼을 KST 로 저장) | 한국 운영 환경 직관적 / view 변환 불요 (단일 timezone) | 글로벌 / 다중 timezone 확장 불가 / DST 없는 KST 라 당장은 무난하나 표준 위반 / 비교·집계 query 가 timezone-coupled / [ADR-0002](ADR-0002-db.md) Prisma `now()` UTC instant 와 어긋남 (저장 시 +9 변환 코드 필요) | 기각 — UTC 표준 위반 + 확장성 0 + reality (UTC instant) 와 어긋남 |
| **(2) 전 entity soft delete** (`deletedAt` tombstone 일괄 도입) | 모든 삭제 복구 가능 / audit trail 완전 / 실수 삭제 방어 | 전 entity `deletedAt` 컬럼 + 전 query `WHERE deletedAt IS NULL` 부담 / tombstone 무한 누적 / REQ-041 의 hard delete (재수집) 의도와 어긋남 (Assessment 는 물리 삭제 후 재생성이 정책) / 현 reality (`deletedAt` 컬럼 0) 와 어긋남 → 전면 migration | 기각 — over-engineering + REQ-041 hard delete 의도 위반 + reality 전면 변경 |
| **(3) `createdBy` row 컬럼** (각 entity 에 `createdBy` FK 부착) | row 단위 작성자 즉시 조회 (join 불요) / 단순 모델 | 전 entity 컬럼 부착 cost / `updatedBy` 는 최근 1 회만 (이력 손실) / User 삭제 시 FK 정합 부담 / audit 관심사가 도메인 schema 에 누수 / 현 reality (`createdBy` 컬럼 0) 와 어긋남 → 전면 migration | 기각 — 이력 손실 + 관심사 누수 + reality 전면 변경 (4 차원 event-stream 열세) |
| **(4) `updatedAt` 전 entity 일괄** (immutable entity 에도 `updatedAt` 부착) | 일관성 (모든 entity 동일 컬럼 set) / 향후 갱신 요구 시 무변경 | immutable entity 의 `updatedAt` 은 항상 `createdAt` 과 동일 (무의미 컬럼) / immutability 의 schema 차원 표식 (컬럼 부재) 손실 / 현 reality (Assessment 등 `updatedAt` 미정의) 와 어긋남 / [ADR-0006 §1](ADR-0006-assessment-data-model.md) 박제 위반 | 기각 — 무의미 컬럼 + immutability 표식 손실 + ADR-0006 위반 |

## References

- [docs/architecture/data-model.md §5](../architecture/data-model.md) — Cross-cutting field conceptual 표 (본 ADR 이 결정으로 격상하는 source). §2 entity 11 종 목록 (mutable / immutable 구분 source).
- [docs/architecture/p4-implementation-plan.md §2.1 carryover 표 + §3 ADR 후보](../architecture/p4-implementation-plan.md) — 본 ADR 의 트리거 ("ADR-0005 cross-cutting field policy" 표기는 stale → 본 ADR 은 ADR-0012).
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma. `DateTime` 매핑 / `now()` UTC instant 의 baseline.
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) §6 — Assessment / Contribution / Summary = hard delete + `updatedAt` 미정의 박제. 본 ADR §2·§3 표가 흡수·일반화 (ADR-0006 이 전면 cross-cutting policy 를 본 ADR 로 위임).
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](ADR-0011-difficulty-model-assignment.md) — DifficultyMapping (mutable, `updatedAt` 보유) 의 출처. ADR 템플릿 mirror.
- [prisma/schema.prisma](../../prisma/schema.prisma) — 본 ADR 4 축 결정이 정합하는 현 reality (모든 시각 컬럼 `DateTime` UTC instant / mutable=`@updatedAt` / soft=Person `active` only / `createdBy` 컬럼 0).
- [docs/requirements.md](../requirements.md) — REQ-026 (Person Deactivate soft) / REQ-041 (Assessment hard delete) / REQ-049 (Admin LLM 지정 mutable entity) source of truth.
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) §5 — Person Deactivate/Activate (`active` toggle) 의 soft delete 의미 출처.
- [CLAUDE.md §3.1 rule 4](../../CLAUDE.md) — ADR 신설 = pr-column. [CLAUDE.md §5](../../CLAUDE.md) — 본 ADR 외부 dependency 0 / `pnpm add` 0 / 자격증명 0 / DB migration 0 → HITL 게이트 미발화 (정책 결정 doc 만).

Refs: T-0144, ADR-0002, ADR-0006, ADR-0011, REQ-026, REQ-041, REQ-049, data-model.md, p4-implementation-plan.md
