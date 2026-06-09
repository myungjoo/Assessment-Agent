---
id: ADR-0033
title: 평가 결과 영속화 — in-memory EvaluationResult → 기존 Assessment/Contribution/Summary 매핑 + 재평가 upsert/partial-reset semantics + Contribution idempotency 1 migration
status: ACCEPTED
date: 2026-06-09
relatedTask: [T-0297, T-0298, T-0299, T-0300, T-0301, T-0302]
relatedPR: [250, 251, 252, 253]
supersedes: null
---

# ADR-0033 — 평가 결과 영속화 (EvaluationResult → Assessment/Contribution/Summary)

> 본 ADR 은 P5 "평가 결과 영속화" milestone (사용자가 [Q-0029](../STATE.json) 를 option (1) 로 승인) 의 **ADR-first 첫 slice** 다. [ADR-0032](ADR-0032-p5-evaluation-contract.md) 가 박제하고 후속 chain (T-0287~T-0293) 이 머지한 **in-memory 평가 파이프라인** (`EvaluationOrchestratorService.evaluateActivities` → `EvaluationResult[]` 반환, DB write 0) 을 **PostgreSQL 영속화로 닫는** 설계만 decide 하며 production code · migration SQL 0 LOC 다. 구현 (Prisma schema 1 줄 변경 → migration → repository write path → orchestrator/controller persist-return → doc-sync) 은 §Follow-ups 의 dependency-free chain 으로 분해되며 각 slice 는 ≤300 LOC / ≤5 파일 + R-112 4 종 (+ negative cases 충분 cover) 으로 강제한다. **status `ACCEPTED`** — 구현 chain T-0298~T-0302 (PR #250~#253 + doc-sync direct e6ce338) 머지·CI-green 완료로 전환 ([CLAUDE.md §3.1](../../CLAUDE.md) rule 4, T-0303).

## Context

[ADR-0032](ADR-0032-p5-evaluation-contract.md) 가 평가 단위 계약을 박제하고 그 구현 chain (T-0287~T-0293, PR #239~#245) 이 매퍼 / scoring service / dedup / orchestrator / controller 를 전부 main 에 안착시켰다. 그러나 ADR-0032 §3 / §Consequences / §Follow-ups 가 **명시적으로 deferred** 한 단 하나의 piece 가 "평가 결과 영속화 schema" 다 — orchestrator ([evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) L38–39 "본 orchestrator 는 in-memory 반환만 (DB write 0)") 와 controller ([assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) L28–29 "in-memory 결과 반환만") 가 둘 다 주석으로 "§5 schema 게이트 deferred" 를 박제해 둔 상태다. 즉 평가는 계산되지만 **REQ-029 (non-volatile 저장) 가 평가 layer 에서 미충족** — 매 trigger 마다 결과가 휘발한다.

핵심 사실 — **저장 대상 table 은 이미 존재한다**:

- [ADR-0006](ADR-0006-assessment-data-model.md) (ACCEPTED) + T-0110 이 `Assessment` / `Contribution` / `Summary` 3 model 을 [prisma/schema.prisma](../../prisma/schema.prisma) L274–349 에 박제 완료했고, migration [`20260531000000_assessment_contribution_summary`](../../prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql) 가 적용돼 있다.
- `Assessment` 는 `@@unique([personId, period, scope, periodStart])` + `@@index([personId, period, periodStart])` 를 이미 가지며, `onDelete: Cascade` (Person→Assessment, Assessment→Contribution, Person→Summary) FK 도 박제돼 있다.
- [AssessmentRepository](../../src/user/assessment.repository.ts) (T-0111) 가 `create` / `findById` / `findByPerson` / `delete` 4 primitive 와 P2002 (unique 위반) / P2025 (부재 삭제) propagation 정책까지 구현했다.

따라서 본 ADR 은 **새 table 도입이 아니라**, (a) in-memory `EvaluationResult` 가 기존 entity 의 어느 컬럼으로 매핑되는지 (방향·책임 경계), (b) 재평가/partial-reset 의 upsert/delete semantics, (c) Contribution idempotency 를 위한 **단 1 줄 schema 변경 + 그 migration** 을 decide 한다. 본 ADR 이 backbone 을 먼저 박제 (de-risk) 하고 구현 slice 로 분해한다.

### 외력

- **[Q-0029 decision](../STATE.json)** — 사용자가 P5 "평가 결과 영속화" 진입을 option (1) 로 승인하며 4 종 scope (entity 매핑 방향 / R-59 raw 미저장 재확인 / 재평가·partial-reset semantics / Prisma migrate-deploy 재사용) 를 attach. 본 ADR 의 §Decision 1~4 가 1:1 cover.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / live credential 은 BLOCKED. 본 결정은 **새 dependency 0** (내장 Prisma 만), **새 credential 0** (DATABASE_URL 은 [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 가 이미 CI 에 주입). DB schema 변경은 1 줄 (`@@unique([assessmentId, sourceRef])`) 에 한정하며 본 ADR 이 그 결정의 ADR 이다 (CLAUDE.md §5 "DB schema 변경은 ADR 동반" 충족).
- **REQ-029** ([README.md L56](../../README.md)) — 평가 자료 non-volatile 저장. 본 ADR 이 평가 layer 에서 이를 충족하는 마지막 piece.
- **R-59 / REQ-032** ([README.md L59](../../README.md), [data-model.md §4](../architecture/data-model.md)) — raw data 저장 금지. 본 ADR 의 매핑이 이 invariant 를 위반하지 않음을 §Decision 2 에서 재확인.
- **REQ-037 / REQ-041** ([README.md](../../README.md)) — "평가 없는 부분 일괄 평가 + Reset & Reeval" / "Admin manual delete". 재평가/partial-reset semantics 의 source.
- **[ADR-0004](ADR-0004-smoke-e2e-db-mode.md)** (ACCEPTED) — `pnpm prisma migrate deploy` + CI 실 PostgreSQL 16 container 패턴. 본 ADR 의 migration 전략이 그대로 재사용 (재발명 0).
- **[ADR-0022](ADR-0022-permission-denied-record-data-model.md) / Q-0019 PermissionDeniedRecord** — migration 명명·구조의 homolog 패턴 ([20260604000000_permission_denied_record](../../prisma/migrations/20260604000000_permission_denied_record/migration.sql)).

## Decision

### Decision §1 — entity 매핑 방향: EvaluationResult → 기존 Assessment(1) + Contribution(N), 새 table 0

**채택: 새 table 을 도입하지 않고 [ADR-0006](ADR-0006-assessment-data-model.md) 의 기존 `Assessment` / `Contribution` / `Summary` 에 평가 결과를 기록한다. 매핑 방향은 단방향 write — 평가 layer (`assessment-evaluation`) 가 `EvaluationResult[]` 를 영속화 layer 의 입력으로 넘기고, 영속화는 기존 `AssessmentRepository` (또는 그 위의 thin write service) 가 책임진다.**

매핑 규칙:

- **단위 평가 결과 (`EvaluationResult`) → `Contribution` row (1:1)**. `EvaluationResult` 의 필드는 개별 commit/document/issue 단위이므로 개념상 `Contribution` (개별 기여 단위) 에 대응한다. 컬럼 매핑:
  - `EvaluationResult.difficulty` → `Contribution.difficulty`
  - `EvaluationResult.contribution` (`ContributionLevel` enum `zero`/`low`/`medium`/`high`) → `Contribution.contributionScore` (`Decimal`). enum → 수치 변환 (예: zero=0 / low=1 / medium=2 / high=3, 또는 정규화 규칙) 의 **구체 매핑 함수는 구현 slice 의 순수 함수**가 담당한다 — 본 ADR 은 "enum → Decimal 변환이 필요하다" 와 "변환은 결정적 순수 함수" 만 박제 (REQ-036 상대 비교 가능 수치).
  - `EvaluationResult.volume` (`number`, ≥0 정수) → `Contribution.volume` (`Int`)
  - `EvaluationResult.unitId` → `Contribution.sourceRef`. `unitId` 는 `<sourceType>:<instanceKey>:<externalId>` 합성 (ADR-0032 §1) 이라 재수집용 참조 식별자인 `sourceRef` 의 의미에 정합한다. `Contribution.sourceUrl` 은 외부 URL 재구성값 (구현 slice 가 `unitId` 또는 metadata 에서 도출, 부재 시 빈 문자열 placeholder).
  - `Contribution.sourceType` ← `EvaluationResult` 가 직접 보유하지 않으므로 `unitId` 의 prefix (`commit`/`pr`/`issue`/`document`) 또는 영속화 시점 context 에서 도출.
- **평가 batch → `Assessment` row (1)**. 한 평가 trigger (한 person × 한 period × 한 scope) 의 결과인 `Contribution[]` 을 묶는 aggregate row 가 `Assessment` 다. `Assessment` 의 aggregate 수치 (`difficulty` / `contributionScore` / `volume` / `narrative`) 는 component `Contribution[]` 에서 결정적으로 집계 (예: `volume` = Σ contribution.volume, `difficulty` = 최빈/최대, `contributionScore` = 평균/합) — **집계 규칙 구체는 구현 slice 의 순수 함수**, 본 ADR 은 "Assessment 는 그 하위 Contribution 에서 집계된다" 방향만 박제.
- **`personId` / `period` / `scope` / `periodStart` 는 `EvaluationResult` 에 없다** — 이 4 종은 평가 trigger context (누구를, 어느 기간을, 어느 scope 로 평가했는가) 에서 온다. 따라서 영속화 진입점의 signature 는 `persist(context: { personId; period; scope; periodStart }, results: EvaluationResult[])` 형태가 되어야 한다 (구현 slice 가 controller/orchestrator 에서 이 context 를 받아 내려보냄). 본 ADR 은 이 **context 4-tuple 이 영속화 입력의 필수 부분**임을 박제한다.
- **`Summary` 는 본 slice 범위 밖**. `Summary` (일/주/월 요약 평가문) 는 단위 평가 결과가 아니라 aggregate 요약 평가문이며, ADR-0032 §2 "batch prompting 은 상위 layer 후속 slice" 와 정합하게 **본 영속화 slice 에서는 write 하지 않는다**. `Summary` 영속화는 aggregate 평가 slice (별도 후속) 책임. 본 ADR 은 `Summary` table 을 건드리지 않음을 명시 박제.

**방향 결정 근거**: `EvaluationResult` (in-memory, `assessment-evaluation` module) → `Assessment`/`Contribution` (영속, `user` module 의 `AssessmentRepository`) 의 단방향. 역방향 (영속 entity 가 평가 도메인 타입을 import) 은 금지 — 도메인 순수성 (evaluation-result.ts 는 의존성 0 타입) 을 보존하기 위해 **매핑 함수 layer** (`EvaluationResult` + context → `AssessmentCreateInput` / `ContributionCreateInput`) 를 별도 순수 함수로 둔다 (ADR-0032 의 `Activity` → `EvaluationInput` mapper 패턴 mirror).

### Decision §2 — R-59 raw 미저장 재확인: 평가-파생 데이터만 저장, raw payload 0

**채택: 영속화 model 은 평가-파생 데이터 (난이도·기여도 수치·양·LLM narrative·참조 식별자) 만 저장하며 raw activity payload (commit message 전문 / diff / issue body / Confluence page 본문 HTML) 를 저장하지 않는다 — schema 차원 부재로 강제 ([ADR-0006](ADR-0006-assessment-data-model.md) §4 의 invariant 를 본 영속화 path 에서 재확인).**

- **저장되는 derived 필드**: `Contribution` 의 `difficulty` (LLM 분류 결과) / `contributionScore` (enum → Decimal 변환값) / `volume` (deterministic metric) / `sourceType` / `sourceUrl` / `sourceRef` (참조 식별자 — pointer 일 뿐 본문 아님). `Assessment` 의 동형 aggregate 수치 + `narrative` (LLM 생성 결과물 — raw 인용 아님, R-59 적용 외).
- **명시적으로 제외 (저장 안 함)**: commit message 본문 / diff / PR description / issue body / Confluence page 본문 HTML / 첨부 raw — 이들은 `EvaluationResult` 가 애초에 필드로 보유하지 않고 ([evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) L17–20 의 raw-not-stored 주석), 대상 schema 도 raw 컬럼이 부재하므로 **구조적으로 저장 불가**. 본 매핑은 이 invariant 를 새로 위반할 표면을 만들지 않는다 — 새 컬럼을 추가하지 않으므로.
- **재수집 경로 보존 (REQ-031)**: 외부 본문이 필요하면 `Contribution.sourceUrl` + `sourceRef` (= `unitId`) 로 재수집 — 본문 저장 없이 pointer 만으로 충분. 본 ADR 의 §1 매핑이 `unitId` → `sourceRef` 를 명시해 재수집 가능성을 보장.
- **narrative quote 위생**: `narrative` 안에 raw 본문이 quote 형태로 끼어들지 않도록 하는 prompt 책임은 scoring service slice (ADR-0032 §3) 의 기존 책임이며 본 영속화 slice 가 추가로 변경하지 않는다 (저장 시점에 별도 sanitize 도입 0 — 입력 텍스트를 그대로 저장하되, 입력 자체가 raw-free 임은 상류 계약이 보장).

### Decision §3 — 재평가/partial-reset semantics: Assessment 단위 reset-and-recreate + idempotency key 재사용

**채택: 재평가 (re-run) 는 `Assessment` 단위의 "delete-then-create" (reset-and-recreate) 로 표현하며, idempotency key 는 기존 `@@unique([personId, period, scope, periodStart])` 를 그대로 재사용한다. partial reset 은 이 key 의 부분 일치 (personId + 특정 period) 로 표현한다.**

semantics 박제:

- **idempotency key = `(personId, period, scope, periodStart)`**. ADR-0006 이 이미 박제한 `Assessment.@@unique` 가 그대로 "한 person 의 한 기간·scope 평가는 정확히 1 row" 를 보장한다. `EvaluationResult.unitId` 가 아니라 이 4-tuple 이 Assessment-level idempotency 의 key 다 (`unitId` 는 Contribution-level — §1 매핑).
- **재평가 = reset-and-recreate (append 아님, in-place update 아님)**. Assessment 는 immutable (ADR-0006 §1 — `updatedAt` 미정의, AssessmentRepository 에 update 메서드 부재). 따라서 같은 4-tuple 로 재평가가 들어오면:
  1. 기존 Assessment row 를 `delete` (component `Contribution[]` 은 `onDelete: Cascade` 가 동반 삭제 — schema.prisma L322).
  2. 새 Assessment + 새 Contribution[] 를 `create`.
  - 이 delete→create 는 **단일 트랜잭션 (`prisma.$transaction`)** 으로 묶어 부분 실패 시 이전 평가가 유실되지 않도록 한다 (atomicity — 구현 slice 의 write service 책임). versioning (history row 누적) 은 본 v1 채택 안 함 (§Alternatives B).
  - **upsert 표현**: Prisma `upsert` 는 component Contribution 의 reset 을 자동 cascade 하지 않으므로 (upsert 는 Assessment row 만 갱신, 자식은 별도) 본 ADR 은 단순 `delete-if-exists` → `create` 패턴을 채택한다 (idempotency key 로 findUnique → 있으면 delete → create). "upsert" 라는 단어보다 **"reset-and-recreate keyed by the unique tuple"** 가 정확한 표현이다.
- **partial reset = key prefix 부분 일치 delete**. "한 person 의 한 period 만 재평가하고 다른 period 는 보존" 은 `delete where { personId, period }` (또는 `{ personId, period, periodStart }`) 로 표현된다 — `@@unique` 의 leading-edge 가 `personId`·`period` 이므로 (그리고 `@@index([personId, period, periodStart])`) 부분 삭제가 효율적이다. 다른 period/scope 의 Assessment 는 건드리지 않으므로 "wiping others" 가 발생하지 않는다 (REQ-037 "평가 없는 부분 일괄 평가" + Reset & Reeval 정합).
- **"평가 없는 부분만 평가" (REQ-037 첫 절)**: 영속화 진입 전에 해당 4-tuple 의 Assessment 존재 여부를 findUnique 로 확인 → 부재면 create, 존재면 (재평가 모드일 때만) reset-and-recreate. 단순 "없으면 채운다" 와 "강제 재평가" 의 두 모드를 영속화 입력의 flag (예: `mode: "fill" | "reeval"`) 로 구분 — 구체 flag 이름은 구현 slice 결정, 본 ADR 은 두 모드 존재만 박제.
- **idempotency 보장 = 같은 입력 재실행 시 row 수 불변**. fill 모드 재실행은 no-op (이미 존재), reeval 모드 재실행은 delete→create 로 같은 1 row 유지 — 어느 쪽도 중복 row 를 만들지 않는다 (REQ-031 재수집 중복 방지의 평가 영속 측 mirror).

### Decision §4 — Prisma migration 전략: ADR-0004 migrate-deploy 재사용 + Contribution idempotency 1 migration

**채택: [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 의 `pnpm prisma migrate deploy` + CI 실 PostgreSQL 16 container 패턴을 그대로 재사용한다. 본 milestone 의 schema 변경은 단 1 종 — `Contribution` 에 `@@unique([assessmentId, sourceRef])` 추가 — 이며 새 migration 1 개를 생성한다.**

- **migration 명**: `<timestamp>_contribution_source_ref_unique` (예: `20260609000000_contribution_source_ref_unique`). [permission_denied_record](../../prisma/migrations/20260604000000_permission_denied_record/migration.sql) (Q-0019 homolog) 의 명명·구조 패턴 mirror — `<YYYYMMDDHHMMSS>_<snake_case_description>/migration.sql`.
- **migration 내용**: 단일 `CREATE UNIQUE INDEX "Contribution_assessmentId_sourceRef_key" ON "Contribution"("assessmentId", "sourceRef");`. 새 table·새 컬럼·FK 변경 0 — 기존 컬럼 위 unique index 1 개 추가뿐.
- **이 unique 가 필요한 이유**: §3 의 reset-and-recreate 는 Assessment-level idempotency 를 보장하지만, **한 Assessment 안에서 동일 `unitId` (= `sourceRef`) 의 Contribution 중복**을 schema 차원에서 막지 못한다 (현 `Contribution` 은 unique 제약 0). 평가-side dedup (ADR-0032 §4) 이 application-layer 에서 중복을 제거하나, 영속 schema 차원의 backbone 을 ADR-0006 의 `Assessment.@@unique` 와 동형으로 박제해 두는 것이 일관적이다. 단위 평가가 `unitId` 단위 1:1 이므로 `(assessmentId, sourceRef)` 가 자연 idempotency key.
- **migrate-deploy 위치**: ADR-0004 가 이미 박제한 CI step (`pnpm prisma migrate deploy` 를 test 직전 실행, 실 postgres:16-alpine container 위) 이 본 migration 을 자동 적용한다 — `.github/workflows/ci.yml` 변경 0 (migration 파일 추가만으로 CI 가 deploy). 새 credential 0 (DATABASE_URL 기 주입).
- **새 dependency 0**: Prisma 는 이미 stack (ADR-0002). `@prisma/adapter-pg` 도 이미 도입 (schema.prisma 헤더). 본 결정은 어떤 새 패키지도 요구하지 않는다.

## Consequences

### 긍정

- **REQ-029 (non-volatile 저장) 가 평가 layer 에서 마침내 충족** — ADR-0032 가 deferred 한 마지막 piece 가 닫힌다. 평가 결과가 더 이상 휘발하지 않는다.
- **새 table 0 / 새 dependency 0 / 새 credential 0** — 기존 ADR-0006 schema + ADR-0004 CI migrate-deploy 를 재사용하므로 CLAUDE.md §5 BLOCKED 게이트를 발화하지 않는다 (단, schema 1 줄 변경은 본 ADR 이 그 ADR 이므로 §5 충족).
- **재평가 semantics 가 기존 immutable 모델과 정합** — ADR-0006 의 "재평가는 hard delete 후 재생성" (Assessment immutable) 결정을 그대로 따르므로 새 모순 0. `@@unique` idempotency key 재사용으로 새 key 발명 0.
- **partial reset 이 key prefix 로 자연 표현** — `personId`·`period` leading-edge + 기존 `@@index` 가 부분 삭제를 효율적으로 cover. "다른 period 보존" 이 구조적으로 보장.
- **R-59 raw 미저장 invariant 의 새 위반 표면 0** — 새 컬럼을 추가하지 않으므로 raw 가 끼어들 자리 자체가 생기지 않는다.

### 부정 / trade-off

- **EvaluationResult ↔ DB 사이 매핑 함수가 enum→Decimal·집계 규칙을 새로 정의해야 함** — `ContributionLevel` (zero/low/medium/high) → `contributionScore` (Decimal) 변환과 Contribution[]→Assessment 집계 규칙이 본 ADR 에서 "결정적 순수 함수" 로만 박제되고 구체 수식은 구현 slice 로 미룬다. 변환 규칙이 REQ-036 상대 비교 의미에 적합한지는 구현 slice + reviewer 점검 대상 (risk: 부적절한 매핑이 비교 왜곡 → 구현 slice 의 spec 으로 검증).
- **versioning 미채택** — 재평가가 이전 평가를 hard delete 하므로 평가 이력 (history) 이 남지 않는다 (ADR-0006 immutable 결정의 연장). 평가 변화 추적이 향후 요구되면 별도 ADR 로 history table 도입 필요 (§Alternatives B).
- **reset-and-recreate 의 트랜잭션 의존** — delete→create 가 단일 `$transaction` 이어야 atomicity 가 보장된다. 트랜잭션 미사용 구현 시 부분 실패로 평가 유실 risk → 구현 slice 가 `$transaction` 사용을 강제하고 R-112 negative case (트랜잭션 중단 시 이전 데이터 보존) 로 검증해야 한다.
- **Summary 영속화 미포함** — 본 slice 는 단위 평가 (Assessment/Contribution) 만 닫고 일/주/월 요약 (Summary) 은 미저장. aggregate 평가 slice 가 별도로 닫아야 REQ-034/REQ-035 영속이 완성된다 (의도된 범위 분할, ADR-0032 §2 batch 경계 정합).

### Cross-Module Impact

본 결정은 새 export contract 를 바꾸지 않고 **추가**한다 (영속화 진입점 신설 + Contribution unique index 1 개). hard rule (cross-module impact) 의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경은 없다 — 기존 `AssessmentRepository` 시그니처 / `EvaluationResult` 타입 / orchestrator·controller 의 기존 반환 계약을 모두 보존하며, 영속화는 별도 write service / 매핑 함수로 **추가**된다. 영향 module 은 `assessment-evaluation` (orchestrator/controller 가 persist hook 호출 추가) + `user` (`AssessmentRepository` 재사용, 변경 0 또는 transaction wrapper 1 메서드 추가) 의 **2 module 로 한정** (≥3 module spread 아님 → BLOCKED 미해당). `@@unique([assessmentId, sourceRef])` 추가는 기존 데이터에 중복 `(assessmentId, sourceRef)` 가 없으면 무해 (현 단계 평가 영속 데이터 0 이므로 충돌 0) — migration 적용 시 backfill 불요.

- **persist hook 위치**: `EvaluationOrchestratorService.evaluateActivities` (또는 controller) 가 결과 반환 직전 persist 를 호출하도록 변경. 기존 in-memory 반환 계약 (`Promise<EvaluationResult[]>`) 은 유지하되 side-effect 로 DB write 추가 — 또는 별도 persist endpoint/메서드 분리 (구현 slice 가 in-place vs 분리를 결정, 본 ADR 은 hook 지점만 박제).

## Alternatives considered

### A. 평가 결과 전용 신규 table (`EvaluationResultRecord`) 신설 (미채택)

`EvaluationResult` shape 를 1:1 로 반영하는 새 table 을 만드는 안. 미채택 — ADR-0006 이 이미 `Assessment`/`Contribution`/`Summary` 를 평가 결과 영속의 single source of truth 로 박제했고, 새 table 은 (a) ADR-0006 과 책임 중복 (어느 table 이 평가 결과인가의 ambiguity), (b) UC-02 조회·UC-06 reset/reeval·REQ-038 시계열이 모두 Assessment 기준으로 설계됨 (api.md / AssessmentRepository.findByPerson) 이라 새 table 은 그 조회 경로를 분기시켜 drift 유발. 기존 entity 재사용이 정합.

### B. 재평가를 versioning (append + version 컬럼) 으로 표현 (미채택)

재평가마다 이전 row 를 보존하고 `version` 컬럼을 증분하는 안 (평가 이력 추적 가능). 미채택 — ADR-0006 이 Assessment 를 **immutable + "재평가는 hard delete 후 재생성"** 으로 이미 박제했고 (`updatedAt` 미정의, update 메서드 부재), versioning 은 그 결정과 충돌해 별도 ADR (ADR-0006 amend/supersede) 가 선결돼야 한다. 본 v1 은 ADR-0006 정합을 우선해 reset-and-recreate 를 채택. 평가 이력이 실제 요구로 부상하면 그때 history table ADR 로 격상 (§Consequences 부정 항목에 risk 박제).

### C. application-layer dedup 만으로 Contribution 중복 방지, schema unique 미추가 (migration 0) (미채택)

ADR-0032 §4 평가-side dedup 이 이미 중복을 제거하므로 schema unique 를 추가하지 않고 migration 0 으로 가는 안. 부분적으로 매력적 (migration 회피) 이나 미채택 — ADR-0006 이 `Assessment.@@unique` 로 schema-level idempotency backbone 을 박제한 것과 비대칭이 생기고 (application-only 보장은 우회 가능), Contribution 차원의 idempotency 가 schema 에 없으면 재평가 트랜잭션 버그·동시 write 시 중복 row 가 새어들 수 있다. 단 1 줄 unique index 추가 비용이 작고 ADR-0004 migrate-deploy 가 이미 자동화돼 있어 cost 가 낮으므로 schema 차원 박제를 채택.

### D. Prisma `upsert` 로 재평가 표현 (미채택)

`prisma.assessment.upsert({ where: uniqueTuple, create, update })` 로 재평가를 표현하는 안. 미채택 — Assessment 는 immutable (update 경로 부재) 이라 `upsert` 의 `update` 분기가 의미상 부적합하고, 더 결정적으로 **upsert 는 component Contribution[] 의 reset 을 cascade 하지 않는다** (Assessment row 만 갱신, 기존 자식 Contribution 은 그대로 남아 stale). reset-and-recreate (delete cascade → create) 가 자식까지 정확히 정리하므로 의미가 명확. "upsert" 어휘 대신 "reset-and-recreate keyed by unique tuple" 를 정확한 표현으로 박제.

## References

- [ADR-0032](ADR-0032-p5-evaluation-contract.md) — P5 평가 계약 (본 ADR 의 직접 상류 — in-memory 파이프라인을 본 ADR 이 영속화로 닫음)
- [ADR-0006](ADR-0006-assessment-data-model.md) — Assessment/Contribution/Summary 데이터 모델 + R-59 schema-level 강제 (본 ADR 이 재사용하는 기존 table·unique·cascade 의 source)
- [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) — migrate-deploy + CI 실 PostgreSQL 패턴 (본 ADR 의 migration 전략 재사용 source)
- [ADR-0002](ADR-0002-db.md) — PostgreSQL + Prisma stack 기반
- [ADR-0022](ADR-0022-permission-denied-record-data-model.md) — PermissionDeniedRecord (Q-0019 migration 명명·구조 homolog)
- [prisma/schema.prisma](../../prisma/schema.prisma) — Assessment(L274~) / Contribution(L309~) / Summary(L335~) model + `@@unique`/cascade (본 ADR 의 매핑 대상)
- [src/user/assessment.repository.ts](../../src/user/assessment.repository.ts) — 기존 AssessmentRepository (재사용 대상)
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — in-memory EvaluationResult shape (매핑 source)
- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) / [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — persist hook 지점
- [docs/architecture/data-model.md §4](../architecture/data-model.md) — raw 미저장 invariant
- [README.md](../../README.md) L56 (REQ-029) / L59 (R-59·REQ-032) — 외력
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / 언어 정책

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112. dependency-free 5 slice 는 모두 완료·CI-green; deferred Summary slice 만 미착수.)

- [x] **Prisma schema 1 줄 변경 + migration slice** — `Contribution` 에 `@@unique([assessmentId, sourceRef])` 추가 + migration `<ts>_contribution_source_ref_unique` 생성 (`commitMode: pr`, ADR-0004 migrate-deploy 자동 적용). 완료(T-0298, PR #250).
- [x] **매핑 함수 slice** — `(EvaluationResult, context) → AssessmentCreateInput` / `ContributionCreateInput` 순수 함수 (enum `ContributionLevel`→`Decimal` 변환 + Contribution[]→Assessment 집계 규칙) + colocated spec (R-112 4 종 + negative: 빈 결과 / 알 수 없는 enum / unitId prefix 부재). 완료(T-0299, PR #251).
- [x] **영속화 write service slice** — reset-and-recreate (`$transaction` delete-if-exists → create) + fill/reeval 모드 분기 + partial-reset (`personId`+`period` prefix delete). 기존 `AssessmentRepository` 재사용 + transaction wrapper. mock unit + (가능 시) real-DB smoke. 완료(T-0300, PR #252).
- [x] **orchestrator/controller persist-return slice** — `evaluateActivities` 결과 반환 직전 persist hook 호출 (context 4-tuple 수신 경로 포함). controller DTO 에 personId/period/scope/periodStart 추가. 완료(T-0301, PR #253).
- [x] **doc-sync slice** (`commitMode: direct`) — [data-model.md](../architecture/data-model.md) 에 본 ADR 의 영속화 매핑·Contribution unique 를 반영 (§3 관계 5 / §5 갱신). 완료(T-0302, direct e6ce338).
- [ ] **(deferred) Summary 영속화 slice** — aggregate 평가 (일/주/월 요약) 의 Summary write — 별도 milestone (ADR-0032 §2 batch 경계). 미착수(deferred).
