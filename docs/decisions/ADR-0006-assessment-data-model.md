---
id: ADR-0006
title: Assessment / Contribution / Summary 데이터 모델 + raw 미저장 (R-59) schema-level 강제 결정
status: PROPOSED
date: 2026-05-31
relatedTask: T-0109
supersedes: null
---

# ADR-0006 — Assessment / Contribution / Summary 데이터 모델 + raw 미저장 (R-59) schema-level 강제

## Context

본 ADR 은 [docs/architecture/data-model.md §2](../architecture/data-model.md) 의 **Assessment / Contribution / Summary** 3 entity 행 + [§3 관계 4·5·6](../architecture/data-model.md) (Person↔Assessment / Assessment↔Contribution / Person↔Summary) + [§4 raw 미저장 invariant](../architecture/data-model.md) 를 **schema-level 결정 (구체 컬럼명·type·`@@unique`·cascade)** 으로 격상하는 single source of truth 다. data-model.md 가 박제한 conceptual model 의 "구체 컬럼 type / index / unique constraint / cascade policy 는 P3 의 `prisma/schema.prisma` 책임" deferral 을 본 ADR 이 받아 결정으로 박제한다 (단 본 task 자체는 doc-only — Prisma 코드는 후속 task 책임. `Consequences §후속` 참조).

### REQ 외력 (본 ADR 이 cover)

- **REQ-029** ([requirements.md L56](../requirements.md), [README.md L56](../../README.md)) — "평가 자료 non-volatile 저장". 본 ADR 의 3 entity 가 PostgreSQL row 로 영속 ([ADR-0002](ADR-0002-db.md)).
- **REQ-032** ([requirements.md L59](../requirements.md), [README.md L59](../../README.md)) — "🔥 Raw data 저장 금지 — 평가 결과만 보유". requirements.md L59 가 구현 위치를 **"P3 (ADR 필수)"** 로 명시 박제 → 본 ADR 이 그 ADR. raw body column 자체를 정의하지 않는 **schema-level 강제** 결정 (`Decision §4`).
- **REQ-033** ([requirements.md L60](../requirements.md), [README.md L60](../../README.md)) — "commit/문서 별 기여도·난이도·양 보유". Contribution entity 가 개별 commit/PR/문서 단위로 cover (`Decision §2`).
- **REQ-034** ([requirements.md L61](../requirements.md), [README.md L61](../../README.md)) — "일별 활동 요약 평가문". Summary entity 의 `period=day` (`Decision §3`).
- **REQ-035** ([requirements.md L62](../requirements.md), [README.md L62](../../README.md)) — "주간/월간 요약 평가문". Summary entity 의 `period=week/month` (`Decision §3`).
- **REQ-036** ([requirements.md L63](../requirements.md), [README.md L63](../../README.md)) — "상대 비교 가능 + LLM 정성 + Metric 수치". Assessment + Summary 의 정규화된 수치 컬럼 결정 (`Decision §5`). **본 ADR 은 REQ-036 을 사용** — data-model.md §2 Assessment 행이 인용한 REQ-063 은 stale (REQ-063 은 [requirements.md L82](../requirements.md) 의 "PR review" 매핑). 본 ADR 은 canonical REQ-036 으로 정정 cross-reference.

### 진척 정합 (옵션 (c) hybrid-parallel)

[docs/architecture/p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) 가 권장한 **옵션 (c) hybrid-parallel** 의 핵심 backbone — User/AuthModule (ADR-0008 chain, T-0079~T-0087 완결) 후의 다음 진입점인 **Assessment + Contribution + Summary** entity backbone. [§5 옵션 (c) refresh 표](../architecture/p3-to-p4-transition.md) 의 "Assessment + Contribution + Summary entity ~3 task (raw 미저장 R-59 schema-level 강제는 Assessment entity 박제 task 안에서 동반 박제)" estimate 의 ADR-first 진입 task 가 본 ADR.

### 기반 ADR 정합

- [ADR-0002 — Persistence DB / ORM](ADR-0002-db.md) — **PostgreSQL 16+ + Prisma**. 본 ADR 의 schema 결정은 `prisma/schema.prisma` 의 schema-as-code form 으로 후속 task 에서 실현.
- [ADR-0003 — Deployment 토폴로지](ADR-0003-deployment.md) §1 — monolithic NestJS process + **단일 DB 인스턴스**. 본 3 entity 가 동일 DB 안에 거주, multi-DB 분리 0.
- 기존 [prisma/schema.prisma](../../prisma/schema.prisma) 패턴 정합 의무 — 모든 entity 가 `id String @id @default(cuid())` + `createdAt DateTime @default(now())` 패턴 사용 (Person/ServiceIdentity/Group/Part/User 와 동일). 본 ADR 의 3 entity 도 동 패턴 mirror.

## Decision

본 ADR 은 **Assessment / Contribution / Summary 3 entity** 를 박제하며, 각 entity 의 구체 컬럼·type·`@@unique`·cascade 를 결정한다. 핵심 invariant: **3 entity 모두 raw 본문 컬럼 0** (R-59 schema-level 강제 — `Decision §4`).

### Decision §1 — Assessment model

평가 결과의 unit. **Person × period (일/주/월) × scope (commit/document/aggregate)** 의 cross product. raw 본문 컬럼 0 — 평가 결과 (난이도/기여도/양/LLM 평가문 텍스트) 만 보유.

| 컬럼 | type | 의미 |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | 기존 entity 패턴 정합 (cuid) |
| `personId` | `String` | Person N:1 FK |
| `period` | `String` | `"day"` / `"week"` / `"month"` enum-as-String (ServiceIdentity.service / User.role 의 String literal 박제 정공법 정합 — Prisma enum 격상은 별도 ADR) |
| `scope` | `String` | `"commit"` / `"document"` / `"aggregate"` enum-as-String |
| `periodStart` | `DateTime` | 평가 기간 시작 (일/주/월 경계). timezone 정책 (UTC/KST) 은 cross-cutting field ADR 책임 — 본 ADR 은 컬럼 존재만 박제 |
| `difficulty` | `String` | LLM 평가 난이도 `"easy"`/`"medium"`/`"hard"` (REQ-050 매핑 결과의 평가 결과값 — DifficultyMapping entity 와 별개) |
| `contributionScore` | `Decimal` | 기여도 정규화 수치 (REQ-036 상대 비교 가능 형태 — `Decision §5`) |
| `volume` | `Int` | 양 (commit 수 / 변경 line / 문서 수 등 aggregate 수치) |
| `narrative` | `String` | LLM 정성 평가문 텍스트 (**LLM 생성 결과물 — raw 아님**, R-59 적용 외. `Decision §4` 참조) |
| `createdAt` | `DateTime @default(now())` | 기존 패턴 정합 |

- **raw 본문 컬럼 0** — commit message 본문 / diff / 문서 본문 / Confluence page 본문 컬럼을 **정의하지 않음** (R-59 schema-level 강제). 외부 본문 접근이 필요하면 Contribution 의 참조 식별자 (`Decision §2`) 로 재수집 (REQ-031).
- `updatedAt` **미정의** — Assessment 는 immutable (재평가는 hard delete 후 재생성, REQ-037/REQ-041). data-model.md §5 의 "immutable entity (Assessment / Contribution) 는 updatedAt 불필요" 박제 정합.

### Decision §2 — Contribution model

개별 기여 단위 (단일 commit / 단일 PR / 단일 문서 변경). Assessment N:1 — N Contribution 이 1 Assessment 로 aggregate. **참조 식별자만 보유, raw 본문 미저장** (REQ-032).

| 컬럼 | type | 의미 |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | 패턴 정합 |
| `assessmentId` | `String` | Assessment N:1 FK |
| `sourceType` | `String` | `"commit"` / `"pr"` / `"document"` enum-as-String |
| `sourceUrl` | `String` | 외부 GitHub / Confluence URL (참조 식별자 — raw 본문 아님) |
| `sourceRef` | `String` | commit SHA / PR number / page version ID (재수집용 참조 식별자) |
| `difficulty` | `String` | 개별 기여 난이도 (REQ-033) |
| `contributionScore` | `Decimal` | 개별 기여도 수치 (REQ-033) |
| `volume` | `Int` | 개별 양 (변경 line 수 등, REQ-033) |
| `createdAt` | `DateTime @default(now())` | 패턴 정합 |

- **raw 본문 컬럼 0** — commit body / diff / 문서 본문 컬럼 정의 안 함. `sourceUrl` + `sourceRef` 만으로 필요 시 재수집 (REQ-031). `updatedAt` 미정의 (immutable).

### Decision §3 — Summary model

일·주·월 단위 요약 평가문. **Person N:1** (default). LLM 정성 평가문 + Metric 수치. **Group/Part aggregate Summary 는 별도 entity 신설 안 함 — view-time 계산** (data-model.md §3 관계 6 의 본 시점 결정 재확인).

| 컬럼 | type | 의미 |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | 패턴 정합 |
| `personId` | `String` | Person N:1 FK |
| `period` | `String` | `"day"` / `"week"` / `"month"` enum-as-String (REQ-034/REQ-035) |
| `periodStart` | `DateTime` | 요약 기간 시작 경계 |
| `narrative` | `String` | LLM 정성 요약 평가문 (LLM 생성 결과물 — raw 아님) |
| `metricScore` | `Decimal` | 정규화된 Metric 수치 (REQ-036 상대 비교 가능 — `Decision §5`) |
| `createdAt` | `DateTime @default(now())` | 패턴 정합 |

- **Group/Part aggregate 는 view-time 계산** — 동일 Group/Part 소속 Person 들의 Summary 를 query-time 에 집계 (별도 `GroupSummary`/`PartSummary` entity 신설 0). 성능/요구 압박 시 P5+ 에서 별도 entity 도입 가능 (`Alternatives §(c)` defer).
- Summary 는 재계산 가능하므로 일·주·월 경계 도래 시 재생성 — 본 ADR 은 immutable 로 보고 `updatedAt` 미정의 (재계산 = hard delete 후 재생성).

### Decision §4 — raw 미저장 (R-59) schema-level 강제

본 ADR 의 핵심 architectural invariant — [README.md L59](../../README.md) + REQ-032 박제.

- **강제 방식 = column 부재** — Assessment / Contribution / Summary 어디에도 raw commit body / diff / 문서 본문 / Confluence page 본문 컬럼을 **정의하지 않는다**. "저장하지 않는다" 를 application-layer 검증이 아닌 **schema 차원 (컬럼 자체의 부재)** 으로 보장 — schema 에 자리가 없으면 저장 자체가 불가.
- **LLM 평가문 (`narrative`) 은 raw 아님** — LLM 이 생성한 정성 평가 결과물이므로 R-59 적용 외. 단 평가문 안에 raw 본문이 quote 형태로 섞이지 않도록 하는 **prompt 설계 책임은 P5 의 LLM gateway / evaluation pipeline** (본 ADR scope 외 — `Consequences` 참조).
- **참조 식별자는 raw 아님** — Contribution 의 `sourceUrl` / `sourceRef` 는 외부 본문을 가리키는 pointer 일 뿐 본문 자체가 아님. 재수집 (REQ-031) 의 backbone.
- **본 invariant 위반 = ADR 신설 필수** — [data-model.md §4](../architecture/data-model.md) 가 박제한 "본 invariant 위반은 ADR 신설 필수, 별도 ADR 없이 raw column 추가 금지" 가 가리키는 ADR 이 **본 ADR-0006**. 향후 raw column 추가 제안은 본 ADR 을 supersede 하는 새 ADR + [CLAUDE.md §5](../../CLAUDE.md) HITL 승인 없이는 금지.

### Decision §5 — 상대 비교 가능 데이터 구조 (REQ-036)

- **정규화된 수치 컬럼** — Assessment.`contributionScore` / Summary.`metricScore` 를 `Decimal` 정규화 수치로 박제 → 동일 metric 축에서 Person × Person 비교 가능 (Person A 의 week scope contributionScore vs Person B 의 동일 period contributionScore). 비교 query 는 `(period, periodStart, scope)` 동일 축으로 group 후 personId 별 수치 정렬.
- **Decimal 채택 사유** — 정규화 점수는 소수 (예: 0.0~1.0 또는 0~100 의 비율) 가능 → `Float` 의 binary 부동소수 오차 회피 위해 `Decimal` (PostgreSQL `NUMERIC`). 구체 precision/scale (`@db.Decimal(p,s)`) 은 후속 schema task 책임.

### Decision §6 — `@@unique` / `@@index` / cascade / delete 정책

- **Assessment `@@unique([personId, period, scope, periodStart])`** — 동일 Person 의 동일 (period, scope, periodStart) 조합 중복 Assessment 차단 → 재수집 중복 방지 (REQ-031) 의 schema-level backbone.
- **`@@index` 후보** — Assessment `@@index([personId, period, periodStart])` (시계열 조회 REQ-038), Summary `@@index([personId, period, periodStart])`. 구체 index 최종 결정은 후속 schema task (query pattern 확정 후).
- **cascade 정책**:
  - **Person 삭제 시 Assessment / Summary** — `onDelete: Cascade`. 단 Person 은 REQ-026 에 따라 hard delete 가 아닌 soft delete (`active=false`) 채택이므로 본 cascade 는 안전망 (ServiceIdentity / PersonGroupMembership 의 기존 Cascade 패턴 정합).
  - **Assessment 삭제 시 Contribution** — `onDelete: Cascade`. Assessment hard delete (REQ-041 Admin manual delete) 시 component Contribution 동반 삭제.
- **soft / hard delete (entity 별)**:
  - **Assessment / Contribution / Summary = hard delete** — REQ-041 (Admin 최근 N일 결과 manual delete → 재수집) + REQ-037 (Reset & Reeval) 가 평가 결과의 물리 삭제 후 재생성 lifecycle. `deletedAt` tombstone 컬럼 미정의 — data-model.md §5 의 "Assessment / Contribution 은 hard delete" 박제 정합.
  - 본 ADR 은 **Assessment backbone 에 필요한 최소 cross-cutting 결정 (hard delete) 만** 박제 — 전면 cross-cutting field policy (timezone / createdBy audit-source) 는 별도 doc-only ADR 책임 (`Out of Scope` 정합).

## Consequences

### 양의 (positive)

1. **R-59 schema-level 강제의 영구 backbone** — raw body column 부재로 "저장 안 함" 을 application bug 와 무관하게 schema 차원 보장. reviewer 가 후속 Prisma schema task 의 PR 에서 raw column 추가 여부만 보면 R-59 위반 catch 가능.
2. **재수집 (REQ-031) 정합** — Contribution 의 `sourceUrl` + `sourceRef` 참조 식별자만으로 외부 본문 재수집 가능 → raw 저장 없이도 재평가 lifecycle (REQ-037) 성립.
3. **상대 비교 (REQ-036) 즉시 가능** — 정규화 `Decimal` 수치 컬럼으로 Person × Person 비교 query 가 추가 entity 없이 성립.
4. **기존 entity 패턴 정합** — cuid id + createdAt 패턴 mirror 로 후속 schema task 의 implementer framework 환각 ↓.
5. **Summary aggregate 의 entity 폭발 회피** — Group/Part aggregate 를 view-time 계산으로 시작 → entity 수 최소화, 요구 확정 후 P5+ 도입 여지 보존.

### 음의 (negative) / trade-off

1. **재수집 의존** — raw 미저장으로 외부 본문이 필요한 모든 시점 (재평가 / export 상세) 에 외부 API 재호출 의무 → 외부 서비스 outage / rate-limit 시 본문 접근 불가. mitigation: 평가 결과 (난이도/기여도/양/평가문) 는 영속되므로 핵심 데이터 손실 0.
2. **Export (REQ-030) 의 raw 미포함** — `/api/admin/export` 산출물도 raw 미포함 (REQ-030 + REQ-032 정합). 외부 본문이 export 에 필요하면 재수집 단계 동반 — export task (P7) 의 책임.
3. **LLM prompt 책임 전가** — `narrative` 에 raw quote 섞임 방지가 schema 가 아닌 P5 prompt 설계 책임 → schema-level 강제의 사각. mitigation: P5 LLM gateway task 의 Acceptance Criteria 에 "평가문 raw quote 미포함" 명시 의무 (후속 task 책임).
4. **enum-as-String 의 값 invariant 가 service-layer 책임** — `period`/`scope`/`sourceType` 가 String literal 이므로 잘못된 값 차단이 schema 가 아닌 service-layer 검증 의무 (User.role / ServiceIdentity.service 의 기존 String 박제와 동일 trade-off).

### 후속 구현 task chain 박제 (본 ADR 은 doc-only)

본 ADR 은 **결정 문서만** — Prisma schema 코드 / service / controller 는 후속 task 책임:

| 후속 task 후보 | scope | dependency |
| --- | --- | --- |
| **T-0110 candidate** | `prisma/schema.prisma` 에 Assessment / Contribution / Summary 3 model 추가 + migration | 본 ADR 머지 (=reviewer 사인오프) 후 |
| **T-0111 candidate** | AssessmentService / repository (CRUD + raw 미저장 invariant test) | T-0110 |
| **T-0112 candidate** | AssessmentController + DTO + endpoint | T-0111 |

- **§5 DB-schema 정합 경로** — 신규 model 추가는 순수 additive dev-phase schema (기존 데이터 migration 0, Person/ServiceIdentity/Group/Part/User 와 동일 패턴). 본 ADR 이 schema 결정을 reviewer 가 먼저 검토하는 ADR-first 경로를 박제 → 후속 schema 코드 task 는 본 ADR 의 결정을 그대로 구현 ([CLAUDE.md §5](../../CLAUDE.md) DB-schema BLOCKED 게이트는 ADR 머지로 해소).

### 후속 amend 후보 (별도 doc-only direct task)

- [data-model.md §2 Assessment 행](../architecture/data-model.md) 의 REQ-063 인용 → REQ-036 정정 + ADR-0006 link.
- [INDEX.md ADR 매핑 표](../architecture/INDEX.md) — ADR-0004/0005/0006/0008 row 추가 (현재 ADR-0001~0003 만 박제, stale).

본 ADR 자체는 위 amend 를 **결정만** 박제 — 실 amend 는 별도 doc-only direct follow-up.

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(0) Assessment/Contribution/Summary 3 entity 분리 + raw 미저장 column 부재** (채택) | R-59 schema-level 강제 / aggregate(Assessment) ↔ 개별(Contribution) ↔ 요약(Summary) 단위 명확 분리 / 재수집 정합 / 상대 비교 정규화 수치 즉시 가능 | 재수집 의존 / LLM prompt 책임 전가 / enum-as-String 값 invariant 가 service-layer 책임 | **✓ 채택** |
| **(a) raw 본문 저장 후 평가** (commit body / diff / 문서 본문 컬럼 보유) | 재수집 불요 (저장된 본문으로 재평가) / export 에 본문 포함 가능 / 외부 outage 무관 | **R-59 정면 위반** ([README.md L59](../../README.md) "🔥 Raw data 저장 금지") / 저장 비용 폭증 (100~200명 × 50~100 repo 의 commit 본문) / 보안 surface 확대 (raw 본문 유출 risk) / REQ-032 박제와 정합 0 | 기각 — R-59 정면 위반 |
| **(b) Assessment / Contribution 단일 테이블 통합** (scope 컬럼으로 구분) | 테이블 1 개로 단순 / join 불요 / 단일 query | aggregate(일/주/월) 단위와 개별(commit/문서) 단위가 한 테이블에 섞여 **aggregate 단위 분리 손실** / `@@unique` 의미 모호 (개별 row 와 aggregate row 가 동일 unique 축 공유 불가) / Contribution N:1 Assessment 관계 표현 불가 | 기각 — aggregate 단위 분리 손실 |
| **(c) Summary 를 별도 GroupSummary / PartSummary entity 로** | Group/Part 단위 요약을 미리 계산·저장 → 조회 성능 / aggregate 전용 metric 보유 가능 | entity 폭발 (Person/Group/Part × 일/주/월) / 요구 미확정 상태에서 조기 schema 박제 / view-time 계산으로 충분한 초기 규모 (100~200명) | **defer** — view-time 계산으로 시작, 성능/요구 압박 시 P5+ 도입 (data-model.md §7 Out of scope 정합) |
| **(d) `narrative` 도 별도 entity (EvaluationNarrative) 로 분리** | 평가문 버전 관리 / 다국어 / 재생성 이력 보유 가능 | 초기 단순성 손실 / Assessment 1:1 narrative 가 대부분 → 분리 ROI 낮음 / 요구 미확정 | 미채택 (deferred) — Assessment/Summary 의 컬럼으로 시작, 버전/이력 요구 발생 시 별도 ADR |

## References

- [docs/architecture/data-model.md](../architecture/data-model.md) §2 / §3 (관계 4·5·6) / §4 (raw 미저장 invariant) / §5 (cross-cutting field) / §7 (Out of scope) — 본 ADR 의 conceptual source. §4 의 "본 invariant 위반은 ADR 신설 필수" 가 가리키는 ADR = 본 ADR-0006.
- [docs/requirements.md L56–63](../requirements.md) — REQ-029/032/033/034/035/036 source of truth. REQ-032 의 구현 위치 "P3 (ADR 필수)" 박제.
- [README.md L56–63](../../README.md) — 평가 자료 저장 / raw 금지 / commit·문서 단위 / 일·주·월 요약 / 상대 비교 외력.
- [docs/architecture/p3-to-p4-transition.md §2.6 / §4.1 / §5](../architecture/p3-to-p4-transition.md) — 옵션 (c) hybrid-parallel 의 Assessment+Contribution+Summary backbone 위치 + ~3 task estimate.
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma (본 schema 결정의 실 구현 form).
- [docs/decisions/ADR-0003-deployment.md §1](ADR-0003-deployment.md) — monolithic / 단일 DB (본 3 entity 거주).
- [docs/decisions/ADR-0008-auth-credential-type.md](ADR-0008-auth-credential-type.md) — ADR 본문 구조 (frontmatter + Context + REQ 외력 + Decision + Consequences + Alternatives) precedent. 본 ADR 이 1:1 mirror.
- [prisma/schema.prisma](../../prisma/schema.prisma) — 기존 6 entity (Person/ServiceIdentity/Group/Part/PersonGroupMembership/User) 의 cuid id / createdAt / `@@unique` / cascade 패턴. 본 ADR 의 schema 결정이 정합.
- [CLAUDE.md §3.1](../../CLAUDE.md) — pr-mode 정합 (ADR 신설 = pr-column). [CLAUDE.md §5](../../CLAUDE.md) — DB-schema BLOCKED 게이트 (본 ADR 은 doc-only, schema 코드 0).

Refs: T-0109, ADR-0002, ADR-0003, ADR-0008, REQ-029, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036
