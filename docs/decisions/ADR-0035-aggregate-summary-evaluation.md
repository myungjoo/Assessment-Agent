---
id: ADR-0035
title: batch/aggregate 평가 — 단위 EvaluationResult → 일·주·월 Summary 집계(deterministic metric + LLM 정성 narrative) + Summary 영속화 매핑 + R-61 시점 경계 + 재집계 reset-and-recreate + person-period batch prompt 경계
status: ACCEPTED
date: 2026-06-09
relatedTask: [T-0304, T-0305, T-0306, T-0307, T-0309, T-0310, T-0311]
relatedPR: [256, 257, 259, 260, 261]
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-064]
supersedes: null
---

# ADR-0035 — batch/aggregate 평가 + Summary 영속화 (EvaluationResult[] → Summary)

> 본 ADR 은 P5 "batch/aggregate 평가 + Summary 영속화" milestone (사용자가 [Q-0030](../STATE.json) 를 option (1) 로 승인) 의 **ADR-first 첫 slice** 다. [ADR-0033](ADR-0033-evaluation-result-persistence.md) 이 단위 평가 영속화 (`EvaluationResult[]` → `Assessment`/`Contribution`) 를 end-to-end 로 닫은 위에서, 그 산출물을 **일·주·월 요약 평가 (`Summary`)** 로 집계·영속화하는 설계만 decide 하며 production code · prisma model · migration SQL · service · controller 배선 0 LOC 다. 구현 (prisma `Summary` 갱신 → migration → aggregate 평가 service → orchestrator/controller batch endpoint 배선 → doc-sync) 은 §Follow-ups 의 dependency-free chain 으로 분해되며 각 slice 는 ≤300 LOC / ≤5 파일 + R-112 4 종 (+ negative cases 충분 cover) 으로 강제한다. **status `ACCEPTED`** — dependency-free 구현 chain T-0305~T-0311 (PR #256/#257/#259/#260/#261 + doc-sync direct) 머지·reviewer-APPROVE·CI-green 완료로 전환 ([CLAUDE.md §3.1](../../CLAUDE.md) rule 4, T-0312).

## Context

[ADR-0032](ADR-0032-p5-evaluation-contract.md) 가 단위 평가 계약을 박제하고 [ADR-0033](ADR-0033-evaluation-result-persistence.md) 가 그 결과 영속화를 닫았다. 두 ADR 이 **명시적으로 deferred** 한 단 하나의 piece 가 "일·주·월 요약 평가 (Summary)" 다:

- ADR-0032 §2 (LLM scoring 입력 shape) — "일/주/월 aggregate 평가의 **batch prompting** 은 본 단위 평가의 상위 layer 책임으로 후속 slice 에서 별도 설계 (본 ADR 범위 밖)".
- ADR-0033 §Decision 1 + §Follow-ups — "`Summary` 는 본 slice 범위 밖. `Summary` 영속화는 aggregate 평가 slice (별도 후속) 책임" + "(deferred) Summary 영속화 slice — aggregate 평가 (일/주/월 요약) 의 Summary write — 별도 milestone".

즉 단위 commit/document 평가는 계산·저장되지만, README L61~L63 가 요구하는 **"종료된 날짜의 전체 활동 요약 평가문 (자정 경계) + 주간 (다음주 시작) / 월간 (다음달 시작) 요약 + LLM 정성 평가 외에 Metric 수치도 함께 보유"** 가 평가 layer 에서 미충족 상태다 (REQ-034/REQ-035/REQ-036 의 aggregate 측면 gap).

핵심 사실 — **저장 대상 table 은 이미 존재한다**:

- [ADR-0006](ADR-0006-assessment-data-model.md) + T-0110 이 `Summary` model 을 [prisma/schema.prisma](../../prisma/schema.prisma) L341–355 에 박제 완료했다: `id` / `personId` / `period` / `periodStart` / `narrative` / `metricScore` (`Decimal`) / `createdAt`, Person N:1 `onDelete: Cascade`, `@@index([personId, period, periodStart])`. **단 `@@unique` 가 부재** (Assessment 는 `@@unique([personId, period, scope, periodStart])` 를 갖지만 Summary 는 idempotency key 가 schema 차원에 없다).
- `period` enum-as-String 의 허용 집합은 이미 `VALID_PERIODS = ["day", "week", "month"]` ([assessment.service.ts](../../src/user/assessment.service.ts) L40) 로 박제돼 있다 — 일·주·월 granularity 는 **별도 enum 신설 없이 기존 `period` 컬럼**이 표현한다.
- [ADR-0033](ADR-0033-evaluation-result-persistence.md) 가 `EvaluationResultPersistService` ([evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts)) 로 reset-and-recreate + fill/reeval 모드 + partial-reset (`resetByPeriod`) 를 구현했고, `mapEvaluationResultsToAssessment` ([evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts)) 가 deterministic 집계 (volume = Σ, difficulty = max, contributionScore = avg) 의 precedent 를 이미 박제했다.

따라서 본 ADR 은 **새 table 도입이 아니라**, (a) 단위 `EvaluationResult`/`Contribution` → `Summary` 집계 규칙의 field-level 분리 (deterministic metric vs LLM 정성 narrative), (b) `Summary` 영속화 매핑 + Summary idempotency key 를 위한 **단 1 줄 schema 변경 (`@@unique`)**, (c) R-61 자정 경계의 시점 판정 규칙, (d) 재집계 reset-and-recreate semantics (ADR-0033 정합), (e) batch prompt 경계를 decide 한다. 본 ADR 이 backbone 을 먼저 박제 (de-risk) 하고 dependency-free chain 으로 분해한다.

### 외력

- **[Q-0030 decision](../STATE.json)** — 사용자가 P5 "batch/aggregate 평가 + Summary 영속화" 진입을 option (1) ADR-first 로 승인. 본 ADR 의 §Decision 1~5 가 task §Acceptance Criteria 5 항목과 1:1 cover.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / live credential 은 BLOCKED. 본 결정은 **새 dependency 0** (내장 Prisma + 기존 `LlmHttpGateway`), **새 credential 0** (`DATABASE_URL` 은 [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 가 이미 CI 에 주입). DB schema 변경은 1 줄 (`Summary` 에 `@@unique([personId, period, periodStart])`) 에 한정하며 본 ADR 이 그 결정의 ADR 이다 (§5 "DB schema 변경은 ADR 동반" 충족).
- **README L61~L63 / REQ-034 / REQ-035 / REQ-036** ([README.md](../../README.md) L61–63) — "종료된 날짜 요약 평가문 (자정 경계) + 주간/월간 요약 + LLM 정성 평가 외 Metric 수치 함께 보유". 본 layer 의 직접 요구 출처. README 행 번호 표기는 ADR-0011 의 `R-NN = README line` 관행 준수 (canonical [docs/requirements.md](../requirements.md) 의 `REQ-NNN` ID 와 무관).
- **R-59 / REQ-032** ([README.md L59](../../README.md), [data-model.md §4](../architecture/data-model.md)) — raw data 저장 금지. 본 ADR 의 Summary 매핑이 이 invariant 를 위반하지 않음을 §Decision 2 에서 재확인.
- **R-64 / REQ-037 / REQ-041** ([README.md L64](../../README.md)) — "평가 없는 부분 일괄 평가 + Reset & Reeval" / Admin manual delete. 재집계/부분 reset semantics 의 source.
- **[ADR-0004](ADR-0004-smoke-e2e-db-mode.md)** (ACCEPTED) — `pnpm prisma migrate deploy` + CI 실 PostgreSQL 16 container 패턴. 본 ADR 의 migration 전략 그대로 재사용 (재발명 0).
- **[Q-0026 deferred SinceDerivation](../STATE.json)** — "1 주 재수집 window / timezone 보정 (SinceDerivationService 가 직전 periodStart 에서 1 주를 빼는 보정 + Asia/Seoul vs UTC 결정)". 본 ADR §Decision 3 의 시점 경계가 이 timezone 결정과 맞닿으므로 관계를 명시 (단 timezone 확정 자체는 Q-0026 후속).

## Decision

### Decision §1 — Summary 집계 규칙: deterministic metric (LLM 무관) + LLM 정성 narrative batch 의 field-level 분리

**채택: 단위 `EvaluationResult` (또는 그 영속물 `Contribution[]`) → 일·주·월 `Summary` 집계를 두 축으로 분리한다 — (a) `Summary.metricScore` 는 deterministic 수치 집계 (LLM 호출 0), (b) `Summary.narrative` 는 LLM 정성 batch 평가 (한 person 의 한 period unit 묶음 1 prompt). README L63 "LLM 정성 평가 + Metric 수치 함께 보유" 를 field 단위로 박제.**

field-level 분리 (Summary 의 2 본질 컬럼 기준):

- **`metricScore` (`Decimal`) = deterministic 집계, LLM 무관**. 해당 (person, period, periodStart) 에 속한 단위 결과들의 정량 신호를 결정적 순수 함수로 축약한다. 집계 source 와 규칙은 ADR-0033 의 `mapEvaluationResultsToAssessment` precedent 를 mirror:
  - 양 (volume) — Σ unit.volume (합).
  - 기여도 (contributionScore) — unit score 의 평균 (등간격 ordinal 0~3 의 산술 평균, REQ-036 상대 비교 의미 보존).
  - 난이도 (difficulty) — component 의 최대 (DIFFICULTY_ORDER ordinal — ADR-0033 §50 채택 정합).
  - 위 신호를 단일 `metricScore` Decimal 1 컬럼으로 어떻게 축약 (가중합 / 정규화 / 대표값 선택) 할지의 **구체 수식은 구현 slice 의 결정적 순수 함수**가 담당한다. 본 ADR 은 "metricScore 는 LLM 무관 deterministic 집계이며 변환은 결정적 순수 함수" 만 박제 (집계 수식 자체는 R-112 spec 으로 검증). `Summary` 가 단일 `metricScore` Decimal 만 보유하므로 (Assessment 와 달리 volume/difficulty 별도 컬럼 부재) 다신호 → 1 Decimal 축약 규칙이 본 layer 의 핵심 design 산물이다.
- **`narrative` (`String`) = LLM 정성 batch 평가**. 해당 (person, period) 의 단위 묶음을 **1 회 LLM `generate` 호출**로 요약 평가문을 생성한다 (batch prompt — §Decision 5). `LlmGenerateResult.narrative` 를 그대로 수용 (생성 결과물 — raw 인용 아님, R-59 적용 외). batch prompt 입력은 단위 평가의 typed surface (per-unit narrative / difficulty / contribution / volume) 만 사용하고 raw 본문 0 (§Decision 2).
- **두 축의 독립성**: `metricScore` 산출은 LLM mock 의존 0 으로 독립 검증 가능 (deterministic — `calculateEvaluationVolume` 패턴 mirror). `narrative` 산출은 mocked-LLM unit 으로 검증 (§Decision 5). 둘을 한 `Summary` row 로 묶어 한 (person, period, periodStart) 의 요약 결과를 구성 — README L63 "정성 + 수치 함께 보유" 의 schema-level 표현.

**집계 입력원 결정**: 집계는 **이미 영속화된 `Contribution[]` (DB read)** 또는 **in-memory `EvaluationResult[]` (직전 단위 평가 산출)** 중 어느 것을 source 로 하는가 — 본 ADR 은 **둘 다 허용하되 default 는 영속 `Contribution[]` read** 로 박제한다. 근거: aggregate 평가는 단위 평가와 시점이 분리될 수 있고 (R-61 — 단위는 활동 발생 시, 요약은 자정 이후), 영속물을 source 로 하면 단위 평가를 재실행하지 않고 집계만 가능하다 (재집계 비용 절감). in-memory source 는 단위 평가 직후 same-transaction 집계 시 사용 가능 (구현 slice 가 둘 중 선택, 본 ADR 은 "영속 source 우선" 방향만 박제).

### Decision §2 — Summary 영속화 매핑: 기존 Summary entity 재사용 (새 table 0) + Person N:1 + period granularity enum 재사용 + R-59 재확인. ADR-0033 §Follow-up deferred slice 를 닫는다

**채택: 새 table 을 도입하지 않고 [ADR-0006](ADR-0006-assessment-data-model.md) 의 기존 `Summary` model 에 aggregate 평가 결과를 기록한다. 이로써 [ADR-0033](ADR-0033-evaluation-result-persistence.md) §Follow-up 의 deferred "Summary 영속화 slice" 를 명시적으로 닫는다.**

매핑 규칙:

- **aggregate 평가 결과 → `Summary` row (1)**. 한 aggregate trigger (한 person × 한 period × 한 periodStart) 의 결과가 `Summary` 1 row 다. 컬럼 매핑:
  - deterministic 집계 수치 (§Decision 1) → `Summary.metricScore` (`Decimal`).
  - LLM 정성 batch 평가문 (§Decision 1) → `Summary.narrative` (`String`).
  - `personId` / `period` / `periodStart` → 동명 컬럼 (집계 trigger context 에서 도출 — `EvaluationResult` 에 없는 식별 축, ADR-0033 §51 의 context-tuple 패턴 mirror).
- **`Summary` ↔ `Assessment`/`Contribution` 관계**: `Summary` 는 `Assessment`/`Contribution` 과 **FK 직접 연결을 두지 않는다**. `Summary` 는 [ADR-0006](ADR-0006-assessment-data-model.md) §3 관계 6 그대로 **Person N:1** (`person Person @relation(... onDelete: Cascade)`) 만 보유한다. 집계 입력원인 `Contribution[]` 과는 **(personId, period, periodStart) 의 논리적 동일성**으로 연결될 뿐 schema FK 는 추가하지 않는다 — `Summary` 는 단위 평가의 derived rollup 이고, Assessment 와 동일 (personId, period, periodStart) 좌표를 공유하므로 application-layer 가 그 좌표로 집계한다. 새 FK 추가 0 (cross-module schema 결합 회피).
- **granularity enum**: 일·주·월 구분은 **신규 enum 신설 0** — 기존 `period` 컬럼 + `VALID_PERIODS = ["day", "week", "month"]` literal single source ([assessment.service.ts](../../src/user/assessment.service.ts) L40) 를 그대로 재사용한다. `Summary` 가 이미 `period String` 컬럼을 가지므로 schema 변경 불요. `Assessment` 와 동일 literal 집합을 공유해 단위↔요약 좌표 정합 (Assessment 의 `scope` = commit/document/aggregate 중 `aggregate` 와 Summary 의 period 가 의미상 짝).
- **period 표현**: `(period, periodStart)` 2-tuple 로 표현한다. `period` 가 granularity (day/week/month), `periodStart` 가 그 구간의 시작 시각 (`DateTime`). 한 구간은 `[periodStart, periodStart + 1 granularity)` 반열림 구간으로 해석 (예: day → `[2026-06-08T00:00, 2026-06-09T00:00)`). periodEnd 별도 컬럼은 두지 않는다 (granularity + periodStart 로 결정적 도출 — 중복 컬럼 회피). 구간 경계의 timezone 해석은 §Decision 3 + Q-0026 의존.
- **R-59 raw 미저장 재확인**: `Summary` 매핑은 평가-파생 데이터 (`metricScore` deterministic 수치 + `narrative` LLM 생성 평가문) 만 저장하며 raw activity payload (commit message 전문 / diff / issue body / page 본문 HTML) 를 저장하지 않는다 — `Summary` schema 에 raw 컬럼이 애초에 부재하고 ([data-model.md §4](../architecture/data-model.md) "Summary 의 LLM 평가문 텍스트는 LLM 이 생성한 결과물 — raw 가 아니므로 invariant 적용 외"), 본 ADR 은 새 컬럼을 추가하지 않으므로 raw 가 끼어들 표면을 만들지 않는다 (ADR-0033 §2 invariant 보존 mirror). batch prompt 입력도 단위 평가의 typed surface 만 사용 (§Decision 5) 하므로 narrative 안에 raw 본문이 quote 로 끼어들 source 자체가 없다.

### Decision §3 — 시점 경계 (R-61 / README L61~L62): "언제 평가 가능한가" 판정 규칙 (시점 판정 함수 경계만)

**채택: aggregate 평가는 평가 대상 구간 `[periodStart, periodEnd)` 가 **완전히 종료된 후에만** 허용한다 — 즉 "now ≥ periodEnd" 일 때만 해당 period 의 Summary 를 생성한다. 이 판정은 순수 시점 판정 함수 (`isPeriodEvaluable(period, periodStart, now): boolean` 형태) 로 표현하며, 실제 scheduler 자동화 (cron 구동) 는 본 ADR 밖이다 (P7 / 새 dep).**

판정 규칙 박제:

- **일 (day)**: 당일 활동은 자정이 지나기 전까지 미평가 (README L61 "실행 당일은 자정이 될 때까지는 아직 끝나지 않았으니 하지 말자"). 즉 day period 의 `periodEnd` = `periodStart + 1 day` (= 다음 날 자정) 이고, `now ≥ periodEnd` 일 때만 평가 허용. 오늘 (진행 중인 날) 은 항상 미평가.
- **주 (week)**: 주간 요약은 다음 주 시작 시 (README L62 "주간 (다음주 시작 시)"). week period 의 `periodEnd` = `periodStart + 1 week` 이고 `now ≥ periodEnd` 일 때 허용 — 진행 중인 주는 미평가.
- **월 (month)**: 월간 요약은 다음 달 시작 시 (README L62 "월간 (다음달 시작 시)"). month period 의 `periodEnd` = `periodStart + 1 month` (달력 month — 28~31 일 가변) 이고 `now ≥ periodEnd` 일 때 허용.
- **판정 함수 경계**: 본 ADR 은 `isPeriodEvaluable(period, periodStart, now): boolean` 가 **순수 결정적 함수** (동일 입력 → 동일 출력, 부수효과 0, `now` 를 인자로 주입받아 테스트 가능) 임만 박제한다. period→periodEnd 의 구체 산술 (day/week/month 각각의 +1 단위 더하기, 달력 month 의 가변 일수 처리) 은 구현 slice 의 순수 함수가 담당한다 (`calculateEvaluationVolume` 의 의존성 0 순수 함수 패턴 mirror). "평가 시점에 도달했는지" 만 판정하고, "도달한 미평가 구간을 자동으로 트리거" 하는 것은 본 함수 밖이다.
- **timezone 관계 (Q-0026 의존)**: "자정" / "다음 주 시작" / "다음 달 시작" 의 경계는 timezone 에 의존한다 (Asia/Seoul 자정 vs UTC 자정은 9 시간 차). 본 ADR 은 `isPeriodEvaluable` 가 **timezone-aware 경계를 전제**함을 박제하되, Asia/Seoul vs UTC 의 확정은 [Q-0026 deferred SinceDerivation](../STATE.json) 의 timezone 보정 결정과 **묶어서** 진행한다 — Q-0026 이 직전 `periodStart` 에서 1 주를 빼는 보정 + timezone 결정을 다루므로, 동일 timezone 결정이 본 시점 경계에도 적용돼야 정합한다 (두 곳에서 timezone 을 따로 정하면 drift). 본 ADR 은 "timezone 은 단일 결정으로 두 곳 (SinceDerivation 의 period 경계 + isPeriodEvaluable 의 자정 경계) 에 일관 적용" 만 박제하고, 그 값 (Asia/Seoul 권장 — README 의 "KST 새벽 2시" 운영 맥락 정합) 자체는 Q-0026 후속 task 가 확정.
- **scheduler 자동화는 OUT**: 실제 cron 구동 (@nestjs/schedule 으로 KST 02:00 매일 미평가 구간 자동 평가 — README L72 "매일 KST 새벽 2시") 은 **새 외부 dependency** 라 본 ADR 밖이다 (P7 / 별도 ADR). 본 ADR 은 "언제 평가 가능한가" (permission) 의 순수 판정 규칙만 정의하고, "언제 평가를 발화하는가" (trigger/scheduling) 는 manual trigger (이미 P4 collection 에 manual-trigger precedent — ADR-0031) 또는 후속 scheduler 가 담당한다. manual trigger + `isPeriodEvaluable` 게이트만으로도 본 layer 는 dependency-free 로 완결된다.

### Decision §4 — 재집계/부분 reset semantics: Summary 단위 reset-and-recreate + idempotency key `(personId, period, periodStart)` (ADR-0033 정합)

**채택: 재집계 (re-aggregate) 는 `Summary` 단위의 "delete-then-create" (reset-and-recreate) 로 표현하며, idempotency key 는 `(personId, period, periodStart)` 로 박제한다. 이를 위해 schema 변경 1 줄 — `Summary` 에 `@@unique([personId, period, periodStart])` 추가 — 을 동반한다. [ADR-0033](ADR-0033-evaluation-result-persistence.md) §3 의 단위 reset-and-recreate semantics 와 정합.**

semantics 박제:

- **idempotency key = `(personId, period, periodStart)`**. 한 person 의 한 granularity·구간 요약은 정확히 1 row 다. ADR-0033 의 Assessment idempotency key `(personId, period, scope, periodStart)` 와 동형이되, `Summary` 는 `scope` 컬럼이 없으므로 (요약은 period 단위 rollup 이라 commit/document scope 분리 부재) 3-tuple 이다. **현 `Summary` schema 는 `@@unique` 가 부재**하므로 (`@@index([personId, period, periodStart])` 만 존재) idempotency 를 schema 차원에 박제하려면 unique 추가가 필요하다.
- **재집계 = reset-and-recreate (append 아님, in-place update 아님)**. `Summary` 는 immutable (ADR-0006 — `updatedAt` 미정의, "재계산 = hard delete 후 재생성"). 같은 3-tuple 로 재집계가 들어오면: (1) 기존 `Summary` row 를 `delete` → (2) 새 `Summary` create. `Summary` 는 component 자식이 없으므로 (Contribution 같은 cascade 대상 부재) cascade 고려 불요 — Assessment 보다 단순하다. delete→create 를 단일 `prisma.$transaction` 으로 묶어 atomicity 보장 (구현 slice 의 write service 책임 — `EvaluationResultPersistService` 패턴 mirror). versioning (history row 누적) 은 본 v1 채택 안 함 (§Alternatives B — ADR-0033 §Alternatives B 정합).
- **fill / reeval 두 모드**: `fill` = 같은 key 존재 시 no-op (기존 보존, 재실행 idempotent), `reeval` = 존재 시 reset-and-recreate. ADR-0033 의 `PersistMode = "fill" | "reeval"` 을 그대로 재사용 (새 enum 발명 0). "평가 없는 부분만 평가" (R-64 첫 절) 는 fill 모드가, "Reset & Reeval" 은 reeval 모드가 cover.
- **partial reset = key prefix 부분 일치 delete**. "한 person 의 한 period 만 재집계하고 다른 period 는 보존" 은 `deleteMany where { personId, period }` (또는 `{ personId, period, periodStart }`) 로 표현 — `@@index([personId, period, periodStart])` leading-edge 가 부분 삭제를 효율 cover (ADR-0033 `resetByPeriod` 패턴 mirror). "최근 1 일/7 일/30 일 삭제 후 다음 평가 시 비어있는 만큼 재평가" (README L74) 는 partial-reset delete + fill 모드 재집계의 조합으로 표현된다.
- **idempotency 보장 = 같은 입력 재실행 시 row 수 불변**. fill 재실행은 no-op, reeval 재실행은 delete→create 로 같은 1 row 유지 — 어느 쪽도 중복 row 를 만들지 않는다.

### Decision §5 — batch prompt 경계 (ADR-0032 §2): 한 person 의 한 period unit 묶음 = 1 LLM 호출 (cross-person 묶음 금지), mocked-LLM unit 검증, live 검증 §5 credential deferred

**채택: LLM 정성 narrative batch 평가의 1 회 `generate` 호출 단위 = **한 person 의 한 (period, periodStart) 에 속한 단위 평가 묶음**으로 박제한다. cross-person 묶음 (여러 사람을 한 prompt 에) 은 금지한다.**

batch 경계 박제:

- **묶음 단위 = (person, period, periodStart) 1 좌표의 unit 들**. 한 Summary row 가 한 person 의 한 구간 요약이므로, 그 Summary 의 narrative 를 생성하는 LLM 호출도 정확히 그 좌표의 단위 평가 묶음 1 개를 입력으로 받는다 — Summary 1 row ↔ LLM 호출 1 회 (1:1). cross-person 묶음 (예: 한 팀 전원을 한 prompt) 은 채택 안 함: (a) 상대 비교 (REQ-036) 는 저장된 per-person metricScore 의 query-time 비교로 충분하고 prompt-time 비교 불요, (b) cross-person prompt 는 한 person 의 결과가 다른 person 의 입력에 오염되는 fairness risk + 실패 격리 약화 (한 명 분량 오류가 전원 narrative 를 오염), (c) GroupSummary/PartSummary 는 view-time 계산 (data-model.md §7) 이라 별도 LLM 묶음 불요.
- **prompt 입력 = 단위 평가의 typed surface 만 (raw 0)**. batch prompt 는 해당 좌표의 per-unit `narrative` / `difficulty` / `contribution` / `volume` (= `EvaluationResult`/`Contribution` 의 평가-파생 필드) 만 묶어 조립한다. raw 본문 (commit message / diff / issue body / page HTML) 은 source 타입이 애초에 보유하지 않아 구조적으로 불가 (REQ-032, §Decision 2 정합). `LlmHttpGateway.generate(prompt, options)` 시그니처를 **변경 없이 재사용** (ADR-0032 §2 mirror — gateway 확장 0). 단위 평가가 `generate` 단위 1 건당 1 회였다면, 본 aggregate 평가는 **Summary 좌표 1 개당 1 회** (단위 N 건 → 1 batch 호출) 로 LLM 호출 수를 줄인다 (ADR-0032 §Consequences "단위 1 건당 generate 1 회는 batch 대비 호출 수 많음 — aggregate batch prompting 이 별도 최적화" 의 실현).
- **mocked-LLM unit 으로 검증 가능한 경계**: aggregate 평가 service 의 unit test 는 `LlmHttpGateway` 를 mock 으로 주입해 — (a) 묶음 입력이 정확히 1 좌표의 unit 들로 구성되는지, (b) prompt 가 typed surface 만 포함하고 raw 0 인지, (c) mock 이 반환한 narrative 가 `Summary.narrative` 로 흘러가는지, (d) deterministic `metricScore` 가 LLM mock 과 독립으로 계산되는지 (LLM mock 을 throw 시켜도 metricScore 는 계산되는지 — 두 축 독립성), (e) negative: 빈 묶음 / 알 수 없는 enum / LLM reject 전파 — 를 검증한다 (R-112 4 종 + negative cases 충분 cover). LLM mock 의존이라 실 endpoint/key 0.
- **live 검증은 §5 credential deferred**: 실 LLM endpoint 로 batch prompt 를 한 번 실제 호출해 narrative 품질을 확인하는 것은 **실 API key 주입**이 필요하므로 (CLAUDE.md §5 credential 게이트) 별도 후속 §5 credential task 로 분리한다 (ADR-0032 의 "live LLM run task — §5 credential 게이트" mirror). 본 ADR 의 구현 chain 은 전부 mocked-LLM unit 으로 dependency-free / credential-free 완결된다.

## Consequences

### 긍정

- **REQ-034/REQ-035/REQ-036 의 aggregate 측면이 평가 layer 에서 충족** — ADR-0032 §2 / ADR-0033 §Follow-up 이 deferred 한 마지막 Summary piece 가 닫힌다. 일·주·월 요약 평가문 + Metric 수치가 영속한다 (README L61~L63 정합).
- **새 table 0 / 새 dependency 0 / 새 credential 0** — 기존 `Summary` model (ADR-0006) + 기존 `LlmHttpGateway` + ADR-0004 CI migrate-deploy 를 재사용하므로 CLAUDE.md §5 BLOCKED 게이트를 발화하지 않는다 (단, `@@unique` 1 줄 schema 변경은 본 ADR 이 그 ADR 이므로 §5 충족).
- **재집계 semantics 가 ADR-0033 단위 영속화와 완전 정합** — 동일 reset-and-recreate + fill/reeval + partial-reset 패턴을 `Summary` 에 mirror 하므로 새 모순 0. `PersistMode` enum / `$transaction` / prefix-delete 를 재사용 (새 발명 0).
- **deterministic / LLM 두 축의 독립성** — `metricScore` 는 LLM mock 없이 결정적 검증, `narrative` 는 mocked-LLM unit 으로 검증 → 한 축 실패가 다른 축을 오염시키지 않고 dependency-free / credential-free 로 전 chain 완결.
- **batch 가 LLM 호출 수를 절감** — Summary 좌표당 1 회 (단위 N → 1) 로 ADR-0032 가 예고한 batch 최적화를 실현. cross-person 금지로 fairness/실패격리도 보존.
- **R-59 raw 미저장 invariant 의 새 위반 표면 0** — 새 컬럼을 추가하지 않고 batch prompt 입력도 typed surface 만이라 raw 가 끼어들 자리가 생기지 않는다.

### 부정 / trade-off

- **Summary `@@unique` 추가가 schema 변경 1 줄을 동반** — migration 1 개 (`<ts>_summary_person_period_start_unique`) 가 필요하다. 현 단계 Summary 영속 데이터 0 이므로 기존 데이터 충돌·backfill 불요 (무해) 이나, schema 변경이라 ADR 동반 (본 ADR) + migrate-deploy 적용이 전제된다.
- **다신호 → 단일 `metricScore` Decimal 축약 규칙이 새로 정의돼야 함** — `Summary` 가 volume/difficulty/contributionScore 별도 컬럼 없이 `metricScore` 1 Decimal 만 보유하므로, 단위의 다축 신호를 1 수치로 어떻게 축약할지가 구현 slice 의 핵심 design + reviewer 점검 대상이다 (risk: 부적절한 축약이 REQ-036 상대 비교 의미를 왜곡 → 구현 slice 의 spec 으로 검증). Assessment 가 다축을 별도 컬럼으로 보존하는 것과 비대칭 — 향후 Summary 다축 보존이 요구되면 별도 schema ADR (§Alternatives C).
- **timezone 미확정 의존** — `isPeriodEvaluable` 의 자정/주/월 경계가 timezone-aware 를 전제하나 Asia/Seoul vs UTC 확정은 Q-0026 후속에 묶인다. 그 전까지 시점 경계 함수는 timezone 을 주입 파라미터로 받아 (또는 UTC default 로) 테스트되며, 실 운영 경계는 Q-0026 결정 시 확정 — 결정 전 구현 시 default timezone 가정이 박제돼야 한다 (구현 slice + reviewer 점검).
- **versioning 미채택** — 재집계가 이전 Summary 를 hard delete 하므로 요약 평가 이력이 남지 않는다 (ADR-0006 immutable + ADR-0033 §Alternatives B 정합). 요약 변화 추적이 향후 요구되면 별도 history table ADR.
- **scheduler 미포함** — "언제 평가 가능한가" 만 정의하고 "언제 발화하는가" (자동 cron) 는 미포함. 그 전까지는 manual trigger (ADR-0031 precedent) + `isPeriodEvaluable` 게이트로만 평가가 발화된다 — 완전 자동화 (README L72 "매일 KST 새벽 2시") 는 @nestjs/schedule 새 dep 도입 (P7 / 별도 ADR) 후.

### Cross-Module Impact

본 결정은 새 export contract 를 **파괴하지 않고 추가**한다 (aggregate 평가 service 신설 + `Summary` unique index 1 개 + 시점 판정 순수 함수 신설). hard rule (cross-module impact) 의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경은 없다 — 기존 `LlmHttpGateway.generate` 시그니처 / `EvaluationResult`·`Contribution` 타입 / `EvaluationResultPersistService` 의 기존 메서드 / orchestrator·controller 의 기존 반환 계약을 모두 보존하며, aggregate 평가는 별도 service / 매핑 함수 / 시점 판정 함수로 **추가**된다. `Summary.@@unique([personId, period, periodStart])` 추가는 현 단계 Summary 영속 데이터 0 이라 충돌 0 (backfill 불요).

- **영향 module = 2 module 한정 (≥3 spread 아님 → BLOCKED 미해당)**: (1) `assessment-evaluation` — aggregate 평가 service + Summary 매핑 함수 + 시점 판정 함수 + batch prompt 조립 신설 (persist hook 소유, ADR-0033 §Cross-Module 패턴 mirror). (2) `user` / persistence — `Summary` model `@@unique` 1 줄 + migration 추가, 기존 repository 시그니처 변경 0 (또는 thin write service 가 `prisma.summary` delegate 직접 사용 — ADR-0033 의 `EvaluationResultPersistService` 가 `AssessmentRepository` 우회 패턴 mirror). `VALID_PERIODS` literal 재사용 (assessment.service.ts export — read-only, 변경 0).
- **shared symbol 재사용 (변경 0, read-only)**: `VALID_PERIODS` ([assessment.service.ts](../../src/user/assessment.service.ts) L40), `PersistMode` ([evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) L45), `LlmHttpGateway.generate` ([llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts)) — 전부 import 재사용만, contract 변경 0.

### 새 dependency risk flag (CLAUDE.md §5)

- **@nestjs/schedule (scheduler 자동화)** — README L72 "매일 KST 새벽 2시" 완전 자동화에 필요하나 **새 외부 dependency** 다. 본 ADR 은 이를 도입하지 **않고** OUT 으로 명시 (시점 경계는 판정 규칙만). 도입은 P7 / 별도 ADR + 사용자 승인 (CLAUDE.md §5 BLOCKED 대상). 본 ADR 의 구현 chain 은 manual trigger + `isPeriodEvaluable` 게이트로 dependency-free 완결되므로 본 risk 가 본 milestone 을 막지 않는다.
- 그 외 새 dependency 0 — 내장 Prisma + 기존 `LlmHttpGateway` (mocked-LLM unit) 만으로 전 chain 완결.

## Alternatives considered

### A. Summary 전용 신규 table (`AggregateEvaluationRecord`) 신설 + Assessment FK 연결 (미채택)

aggregate 평가 결과를 위한 새 table 을 만들고 component Assessment[] 에 FK 로 묶는 안. 미채택 — ADR-0006 이 이미 `Summary` 를 일·주·월 요약 평가의 single source of truth 로 박제했고 ([data-model.md §2/§3 관계 6](../architecture/data-model.md)), 새 table 은 (a) ADR-0006 과 책임 중복 (어느 table 이 요약 평가인가의 ambiguity), (b) UC-02 조회·REQ-038 시계열이 모두 `Summary` 기준으로 설계됨 (data-model.md REQ-034/035 cover) 이라 새 table 은 조회 경로를 분기시켜 drift 유발. Assessment↔Summary FK 도 cross-module schema 결합을 만든다 (논리적 (personId, period, periodStart) 좌표 동일성으로 충분). 기존 entity 재사용이 정합 (ADR-0033 §Alternatives A mirror).

### B. 재집계를 versioning (append + version 컬럼) 으로 표현 (미채택)

재집계마다 이전 Summary 를 보존하고 `version` 컬럼을 증분하는 안 (요약 이력 추적 가능). 미채택 — ADR-0006 이 Summary 를 **immutable + "재계산 = hard delete 후 재생성"** 으로 이미 박제했고, ADR-0033 가 단위 평가도 동일 reset-and-recreate 로 닫았다. versioning 은 그 결정들과 충돌해 별도 ADR (ADR-0006 amend/supersede) 가 선결돼야 한다. 본 v1 은 ADR-0006/ADR-0033 정합을 우선해 reset-and-recreate 채택. 요약 이력이 실 요구로 부상하면 history table ADR 로 격상 (§Consequences 부정 항목에 risk 박제).

### C. metricScore 를 다축 컬럼 (volume/difficulty/contributionScore) 으로 분해해 Summary 에 추가 (미채택)

`Summary` 에 Assessment 처럼 volume/difficulty/contributionScore 별도 컬럼을 추가해 다신호를 손실 없이 보존하는 안. 미채택 (본 v1) — ADR-0006 이 `Summary` 를 `narrative` + `metricScore` 단일 Decimal 로 박제했고 ([prisma/schema.prisma](../../prisma/schema.prisma) L341–355), 다축 컬럼 추가는 schema 변경 폭을 키운다 (본 ADR 의 §5 BLOCKED 회피 — 변경 1 줄 unique 에 한정). README L63 의 "Metric 수치" 는 단일 대표 수치로 시작해도 상대 비교 (REQ-036) 가 가능하다 (per-person metricScore 비교). 다축 보존이 실제 시각화 요구 (REQ-038 지표별 변화) 로 부상하면 그때 Summary 다축 schema ADR 로 확장 (§Consequences 부정 항목 risk). 본 v1 은 ADR-0006 정합 + 변경 최소를 우선.

### D. cross-person batch prompt (한 팀/그룹을 1 LLM 호출로 묶어 상대 비교까지 prompt-time 수행) (미채택)

여러 person 의 단위 묶음을 한 prompt 에 넣어 LLM 이 상대 비교까지 한 번에 평가하게 하는 안 (LLM 호출 수 추가 절감 + prompt-time 상대 평가). 미채택 — (a) 상대 비교 (REQ-036) 는 저장된 per-person `metricScore` 의 query-time 비교로 충분해 prompt-time 비교가 불요하고, (b) cross-person prompt 는 한 person 결과가 다른 person 입력에 오염되는 fairness risk + 실패 격리 약화 (한 명 분량 오류가 전원 narrative 오염), (c) GroupSummary/PartSummary aggregate 는 view-time 계산 (data-model.md §7) 으로 이미 결정돼 별도 LLM 묶음이 불요. per-(person,period) 1 호출이 Summary 1 row 와 1:1 로 정합하고 실패 격리·fairness 를 보존한다.

### E. 집계 입력원을 in-memory EvaluationResult[] 만으로 한정 (영속 Contribution read 금지) (미채택)

aggregate 평가가 항상 단위 평가를 재실행해 그 in-memory 산출만 집계하는 안 (DB read 0). 미채택 — R-61 시점 경계상 단위 평가 (활동 발생 시) 와 요약 평가 (자정/주/월 종료 후) 는 시점이 분리되므로, 요약 때마다 단위를 재실행하면 (a) 단위 LLM 호출 비용을 반복 지불하고 (b) 재실행 결과가 직전 영속물과 미세하게 달라질 수 있어 (LLM 비결정성) 영속 단위 평가와 요약의 정합이 깨진다. 영속 `Contribution[]` 을 default source 로 두면 단위 재실행 없이 집계만 가능해 비용·정합 모두 우월. in-memory source 는 same-transaction 집계 시 보조로만 허용 (§Decision 1).

## References

- [ADR-0033](ADR-0033-evaluation-result-persistence.md) — 단위 평가 영속화 (본 ADR 의 직접 상류 — §Follow-up 의 deferred Summary slice 를 본 ADR 이 닫음). reset-and-recreate / fill·reeval / partial-reset / `PersistMode` / `$transaction` 패턴의 source.
- [ADR-0032](ADR-0032-p5-evaluation-contract.md) — P5 단위 평가 계약 (§2 batch prompting deferred 를 본 ADR §Decision 5 가 확정. `LlmHttpGateway.generate` 무변경 재사용 mirror).
- [ADR-0006](ADR-0006-assessment-data-model.md) — Assessment/Contribution/Summary 데이터 모델 + Summary immutable + R-59 schema-level 강제 (본 ADR 이 재사용하는 기존 `Summary` table·Person N:1 cascade·`@@index` 의 source).
- [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) — migrate-deploy + CI 실 PostgreSQL 패턴 (본 ADR 의 Summary `@@unique` migration 전략 재사용 source).
- [ADR-0031](ADR-0031-collection-manual-trigger.md) — collection manual-trigger (본 ADR 의 "scheduler OUT, manual trigger + 시점 게이트로 발화" precedent).
- [ADR-0002](ADR-0002-db.md) — PostgreSQL + Prisma stack 기반.
- [prisma/schema.prisma](../../prisma/schema.prisma) L341–355 — 기존 `Summary` model (`@@unique` 추가 대상 + 매핑 대상).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — 집계 source `EvaluationResult` shape.
- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) — deterministic 집계 (volume Σ / difficulty max / score avg) precedent (mirror 대상).
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) — reset-and-recreate / fill·reeval / `resetByPeriod` / `PersistMode` (mirror 대상).
- [src/user/assessment.service.ts](../../src/user/assessment.service.ts) L40 — `VALID_PERIODS = ["day","week","month"]` granularity single source (재사용).
- [docs/architecture/data-model.md](../architecture/data-model.md) §2/§3 관계 6/§4/§7 — Summary entity 정의 + Person↔Summary 관계 + raw 미저장 invariant + GroupSummary view-time 계산.
- [README.md](../../README.md) L61~L63 (요약 평가 요구) / L59 (R-59) / L64 (Reset & Reeval) / L72 (KST 새벽 2시 scheduler) — 외력.
- [docs/PLAN.md](../PLAN.md) P5 L97 — "일/주/월 요약 평가 + 자정 경계" bullet.
- [Q-0030](../STATE.json) — 본 milestone 진입 승인 (option 1 ADR-first). [Q-0026](../STATE.json) — timezone/SinceDerivation deferred (시점 경계 timezone 의존 source).
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / 언어 정책.

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112. dependency-free chain (ACCEPTED flip 포함) 은 모두 완료·CI-green; HITL/게이트 의존 항목 [timezone Q-0026 / scheduler P7 새 dep / live-LLM §5 credential] 만 미착수.)

- [x] **ADR-0035 ACCEPTED flip** — reviewer 통과 후 1 줄 status 전환. 완료(T-0312, `commitMode: pr` — `docs/decisions/` 는 doc-only allowlist 제외).
- [x] **prisma `Summary` `@@unique` 추가 + migration slice** — `Summary` 에 `@@unique([personId, period, periodStart])` 추가 + migration `<ts>_summary_person_period_start_unique` 생성 (`commitMode: pr`, ADR-0004 migrate-deploy 자동 적용). 완료(T-0305, PR #256).
- [x] **aggregate 매핑 + 시점 판정 함수 slice** — `(Contribution[]/EvaluationResult[], context) → SummaryCreateInput` deterministic 집계 순수 함수 (다신호 → metricScore Decimal 축약) + `isPeriodEvaluable(period, periodStart, now)` 순수 함수 + colocated spec (R-112 4 종 + negative: 빈 묶음 / 알 수 없는 enum / 진행 중 구간 미평가). 완료(T-0306, PR #257).
- [x] **aggregate 평가 write service slice** — Summary reset-and-recreate (`$transaction` delete-if-exists → create) + fill/reeval 모드 + partial-reset (`personId`+`period` prefix delete) + batch LLM narrative (mocked-LLM unit). `EvaluationResultPersistService` 패턴 mirror. 완료(T-0307 narrative + T-0309 persist, PR #259/#260).
- [x] **orchestrator/controller batch 평가 endpoint 배선 slice** — aggregate 평가 trigger endpoint (manual trigger + `isPeriodEvaluable` 게이트) + DTO (personId/period/periodStart/mode). 완료(T-0310 orchestrator, PR #261; controller/endpoint 배선 부분은 Q-0030 ADR-gate 로 OUT).
- [x] **doc-sync slice** (`commitMode: direct`) — [data-model.md](../architecture/data-model.md) §3 관계 6 + §6 에 Summary 영속화 매핑·`@@unique`·집계 규칙 반영. modules.md / api.md 동기. 완료(T-0311, direct).
- [ ] **(Q-0026 동행) timezone 확정** — `isPeriodEvaluable` 의 자정/주/월 경계 timezone (Asia/Seoul 권장) 을 SinceDerivation 보정과 묶어 단일 결정으로 확정.
- [ ] **(P7 / 새 dep) scheduler 자동화** — @nestjs/schedule 으로 KST 02:00 미평가 구간 자동 평가 (README L72) — 별도 ADR + 사용자 승인 (§5 dep 게이트).
- [ ] **(§5 credential) live LLM batch run** — 실 endpoint/key 주입 후 batch prompt 1 회 실제 호출로 narrative 품질 검증 (deferred).
