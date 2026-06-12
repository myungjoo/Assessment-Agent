---
id: ADR-0039
title: timezone — boundary 계산·표시 timezone = Asia/Seoul (KST) 박제 (저장 UTC 보존)
status: ACCEPTED
date: 2026-06-10
relatedTask: T-0340
supersedes: null
---

# ADR-0039 — boundary 계산·표시 timezone = Asia/Seoul (KST) 박제

## Context

[docs/PLAN.md](../PLAN.md) L109 — 사용자가 2026-06-11 결정으로 "그동안 deferred 였던 timezone 쟁점 (Asia/Seoul vs UTC, Q-0034 context (5)) 을 **KST(Asia/Seoul)** 로 확정" 을 박제하면서, 적용 대상 4 종 (R-61 자정 / 주간·월간 시작 / R-9 사용자 지정 기간 / 시각화 표시) 의 세부 결정은 "구현 진입 시 **ADR 로 박제** — 본 bullet 은 사용자 결정의 박제이며 **ADR-first 로 처리**" 라고 명시했다. 본 ADR 이 그 ADR-first 의무를 이행한다 — 즉 사용자 결정의 design-level 박제만 닫고, impl chain (helper / DTO / boundary 계산 / view-layer formatter) 은 본 ADR ACCEPTED flip 후 별도 후속 task 분해로 미룬다.

### Q-0026 deferred 이력 (ADR-0035 §Decision3 / L41)

[ADR-0035 §Decision3 + L41](ADR-0035-aggregate-summary-evaluation.md) 는 일/주/월 요약 평가의 **시점 경계 (`isPeriodEvaluable`)** 가 "Asia/Seoul vs UTC 결정" 에 의존함을 명시적으로 박제하고, 그 결정 자체를 [STATE.json Q-0026 deferred](../STATE.json) ("1 주 재수집 window / timezone 보정 — SinceDerivationService 가 직전 periodStart 에서 1 주를 빼는 보정 + Asia/Seoul vs UTC 결정") 후속으로 미뤘다. ADR-0035 §Decision3 본문은 "timezone 은 **단일 결정으로 두 곳 (SinceDerivation 의 period 경계 + isPeriodEvaluable 의 자정 경계) 에 일관 적용**" 만 박제하고 그 값 (Asia/Seoul 권장 — README "KST 새벽 2시" 운영 맥락 정합) 자체는 Q-0026 후속 task 가 확정한다고 적었다. 본 ADR 이 그 Q-0026 후속의 timezone 값 결정 부분을 닫는다 (1 주 재수집 window 자체는 인접하지만 별도 surface — Out of scope 참조).

또한 [ADR-0029 L107](ADR-0029-assessment-collection-orchestrator.md) 의 "incremental since 도출 — 직전 periodStart 에서 1 주 빼기 / timezone 보정" + [ADR-0006 L54/L122](ADR-0006-assessment-data-model.md) 의 "`periodStart` timezone 정책은 별도 cross-cutting ADR 위임" + [ADR-0033](ADR-0033-evaluation-result-persistence.md) 의 `(period, periodStart, periodEnd)` 키 형태 — 세 곳의 timezone 결정 위임 표기를 본 ADR 이 일관 결정으로 닫는다.

### ADR-0012 §1 (저장 UTC) 와의 관계

[ADR-0012 §1](ADR-0012-cross-cutting-field-policy.md) 은 **저장 timezone = UTC 단일 기준** + "KST 등 사용자 timezone 변환은 **view-layer (조회 endpoint / Web UI) 책임**" 으로 박제했다. ADR-0012 §1 은 **저장 정책의 single source of truth** 다 — 본 ADR 은 **저장 정책을 변경하지 않으며**, 그 위에 "boundary 계산·표시 timezone 만 Asia/Seoul" 을 새로 박제한다. 두 ADR 은 직교 (저장 ↔ boundary 계산·표시) 하며 단일 source 원칙을 보존한다 (저장 timezone 단일 source = ADR-0012 §1, boundary timezone 단일 source = 본 ADR).

### 결정 필요 surface 4 종

본 ADR 이 닫아야 하는 4 surface 를 명시한다 (impl chain 의 적용 대상 set):

- **(1) R-61 자정** — [README L61](../../README.md) "종료된 날짜의 활동에 대해서는 (실행 당일은 자정이 될 때까지는 아직 끝나지 않았으니 하지 말자)" 의 "자정" 의미.
- **(2) 주간 시작** — 일/주/월 요약 평가 (ADR-0035 §Decision3) 의 주간 granularity 시작 시점.
- **(3) 월간 시작** — 동일 ADR-0035 §Decision3 의 월간 granularity 시작 시점.
- **(4) R-9 사용자 지정 기간** — [README L9](../../README.md) "사용자가 지정한 기간동안 어떠한 주요 활동이 있었는지" 의 기간 해석.
- **(부수) 시각화 표시** — 모든 조회 endpoint / Web UI 의 시각 표시 default. (impl 위치는 P6 frontend 책임이나 default 정책은 본 ADR 이 박제.)

### 사용자 결정 직접 인용 (PLAN.md L109, 2026-06-11)

> timezone = KST(Asia/Seoul) 확정 반영 — 사용자 결정 (2026-06-11). 그동안 deferred 였던 timezone 쟁점 (Asia/Seoul vs UTC, Q-0034 context (5) 참조) 을 사용자가 **KST(Asia/Seoul)** 로 확정. 적용 대상: P5 일/주/월 요약 경계 (위 R-61 자정 룰의 "자정" = KST 자정), 주간/월간 시작 시점 판정, 사용자 지정 기간 (R-9) 해석, 시각화 표시. 세부 (저장은 UTC timestamptz 유지 + 경계 계산·표시만 KST 등 표준 패턴) 는 구현 진입 시 **ADR 로 박제** — 본 bullet 은 사용자 결정의 박제이며 ADR-first 로 처리. 새 dependency 0.

## Decision

본 ADR 은 boundary timezone 정책을 5 개 §Decision 으로 박제한다. 모든 결정은 ADR-0012 §1 (저장 UTC) 과 직교하며 저장 정책을 변경하지 않는다.

### Decision §1 — boundary timezone = Asia/Seoul (KST, UTC+9)

- **채택**: 모든 시각 boundary 계산 및 시각 표시의 timezone = **`Asia/Seoul`** (IANA tz database 표준 식별자).
- **식별자 표기 규약**: 코드·문서·DTO 모두 IANA tz database 표준 식별자 `Asia/Seoul` 을 사용한다 — 단순 `"KST"` string 박제는 **금지**. 근거: (i) 한국 표준시는 DST 0 이라 현재 시점 단순 `+09:00` offset 으로 충분해 보이나, (ii) IANA 식별자가 historical / future tz rule 변경 (예: DST 도입 결정) 에 자동 대응하는 single source 다. (iii) Node 의 `Intl.DateTimeFormat` / `date-fns-tz` / `Luxon` 등 표준 라이브러리가 모두 IANA 식별자를 일등 인자로 받는다.
- **본 ADR 이 결정 위임하지 않는 항목**: timezone 값 자체 (`Asia/Seoul`) 는 본 §1 이 단일 source 다 — impl chain 의 helper / DTO / view-layer 가 이를 hardcoded constant 로 두든 config 로 두든 (구현 결정), 값은 항상 `Asia/Seoul`. 사용자별 timezone preference (multi-tenant 확장) 는 본 ADR Out of scope (확장 시 별도 ADR — §Alternatives (3) 참조).

### Decision §2 — 저장 timezone = UTC 보존 (ADR-0012 §1 single source 유지)

- **저장 정책 단일 source**: 모든 entity 의 시각 컬럼 (`createdAt` / `updatedAt` / `periodStart` / 향후 `deletedAt`) 은 **UTC 저장**. 이 결정은 [ADR-0012 §1](ADR-0012-cross-cutting-field-policy.md) 이 단일 source 이며 본 ADR 은 그 결정을 **변경하지 않는다**.
- **본 ADR 의 위치 박제**: 본 ADR 은 `boundary 계산·표시 timezone` 만 결정한다. 저장 timezone 은 ADR-0012 §1 이 보존되어 PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` (= Prisma `DateTime`, UTC instant) 그대로 유지. `@db.Timestamptz(3)` 격상 follow-up 도 ADR-0012 §1 의 책임이지 본 ADR 의 책임이 아니다.
- **두 ADR 의 정합 단언**: ADR-0012 §1 저장 UTC + 본 ADR boundary Asia/Seoul 은 직교 결정이며 모순되지 않는다. UTC 저장된 `periodStart` 위에서 boundary 계산이 Asia/Seoul timezone 으로 수행될 뿐이다 (예: `periodStart = 2026-06-10T15:00:00Z` UTC 저장 = `2026-06-11T00:00+09:00` KST 자정 boundary, 동일 instant 의 두 표현).

### Decision §3 — boundary 계산 정책 (4 surface 확정)

각 surface 의 boundary 정의를 명시한다. 반열림 구간 `[start, end)` 표기를 사용한다.

- **(a) 일별 (R-61 자정)** — 1 일 boundary = `[YYYY-MM-DD T00:00:00+09:00, T+1일 T00:00:00+09:00)`. 즉 **KST 자정 기준** 의 24 시간 구간. UTC 환산 = `[T-1일 T15:00:00Z, T 일 T15:00:00Z)`. R-61 의 "자정" = KST 자정 (= UTC 15:00) 으로 박제 — 사용자 직관 정합.
- **(b) 주간 시작** — **Asia/Seoul 월요일 00:00:00+09:00** 기준 1 주 = `[월 T00:00+09:00, 다음 월 T00:00+09:00)`. ISO-8601 week 도 동일하게 월요일 시작이라 정합하나 본 ADR 은 **`Asia/Seoul` 월요일 0 시 기준** 으로 표기 (단순 + DST 무관 + 한국 운영 관행 정합). 일요일 시작 변형은 채택하지 않는다.
- **(c) 월간 시작** — **Asia/Seoul 매월 1 일 00:00:00+09:00** 기준 = `[해당월 1일 T00:00+09:00, 다음월 1일 T00:00+09:00)`. 월 28~31 일 가변 길이는 표준 datetime 산술로 도출 (helper 책임).
- **(d) R-9 사용자 지정 기간** — 사용자 입력 (UI/API DTO) 의 시각 string 은 timezone offset **명시 의무**: ISO-8601 `+09:00` / `Z` 등 명시 권장. 미명시 시 default 해석 = **`Asia/Seoul` 로 해석** (예: `2026-06-10T15:00` → `2026-06-10T15:00:00+09:00` = `2026-06-10T06:00:00Z`). 입력 DTO 가 default 해석을 적용했다는 사실은 응답 / 영속 데이터의 timezone offset (예: `2026-06-10T06:00:00Z`) 으로 외부에서 검증 가능해야 한다.
- **(부수) 반열림 구간 일관성**: 위 (a)~(d) 는 모두 `[start, end)` 반열림 구간. 종료 시각은 다음 boundary 의 시작 시각 (배타). ADR-0035 §Decision3 `[periodStart, periodStart + 1 granularity)` 표기와 정합.

### Decision §4 — 시각화 표시 timezone default = Asia/Seoul

- **모든 조회 endpoint / Web UI 의 시각 표시 default = Asia/Seoul (KST)**. 응답 JSON 의 시각 필드는 UTC 저장값 그대로 (`...Z`) 또는 `+09:00` offset 명시 (어느 쪽이든 동일 instant 표현, 라이브러리·DTO 결정) — 단 **사용자 가독 표시 (UI label / formatted string)** 는 `Asia/Seoul` 기준 포맷을 default 로 사용.
- **사용자별 timezone preference 미지원 (본 ADR 단계)**: 현재 README 매핑은 단일조직 한국 운영이라 사용자별 timezone 선택 UI / preference column 은 본 ADR Out of scope. 향후 다국적 운영 진입 시 별도 ADR 로 multi-timezone preference 확장 결정 (§Alternatives (3) 참조).
- **포맷 / locale 분리**: chart axis hover timestamp 표시 형식 / locale-aware 한글 포맷 ("2026 년 6 월 10 일 (수)") 등은 본 ADR Out of scope — P6 frontend ADR 책임 (§Out of scope 참조).

### Decision §5 — impl 위치 합의 (helper 1 점 집중 권장)

- **권장 helper 위치**: `src/common/period-boundary.ts` (또는 impl task 가 명명한 등가 위치) 1 곳에 boundary 계산 로직을 집중. 본 ADR 은 **위치 권장** 이지 helper 신설 명령은 아니며, 실제 helper 신설은 impl chain task 의 책임이다.
- **경유 의무 컴포넌트**: 다음 4 컴포넌트는 모두 (helper 신설 후) 그 helper 1 곳을 경유해야 한다 — (i) `SinceDerivation` (Q-0026 incremental since 도출), (ii) `PeriodBridge` (ADR-0037 period→collection→evaluate bridge), (iii) `R-9 사용자 지정 기간 DTO parsing` (입력 timezone 해석), (iv) `view-layer formatter` (조회 endpoint 응답 / Web UI 표시).
- **boundary 계산 중복 금지**: 위 4 컴포넌트가 각자 `new Date(...)` / hardcoded `+09:00` offset 으로 boundary 를 재계산하면 drift 위험. helper 1 점 집중이 drift 차단 backbone.
- **본 ADR 의 책임 한계**: impl 위치 권장만 본 ADR 이 박제. helper 의 API shape (예: `startOfDay(date: Date, tz: 'Asia/Seoul'): Date` 등) 결정 / Node 표준 라이브러리 vs 외부 라이브러리 (`date-fns-tz` 등 — 단 새 dependency 추가는 §5 게이트라 별도 ADR 필요) 선택은 impl chain task 의 책임. 본 ADR 단계에서 impl 결정 0.

## Consequences

### 긍정

- **UTC 단일 저장 보존** — ADR-0012 §1 single source 유지. 비교 / 정렬 query / 인덱스 / migration 영향 0. PostgreSQL `TIMESTAMP` 단순성 보존.
- **boundary 계산 1 점 집중** — §Decision 5 의 helper 1 곳 권장이 drift 위험 차단. SinceDerivation / PeriodBridge / R-9 DTO / view-layer formatter 4 곳의 timezone 결정이 단일 source 로 수렴.
- **deferred 결정 닫힘** — [Q-0026](../STATE.json) (timezone 보정 결정 부분) + [ADR-0035 §Decision3](ADR-0035-aggregate-summary-evaluation.md) (시점 경계 timezone) 양쪽이 본 ADR 로 닫힌다. impl chain 이 추가 ADR 대기 없이 진입 가능.
- **사용자 직관 정합** — R-61 자정 = KST 자정 / R-9 입력 default = Asia/Seoul → 한국 운영자 / Admin 사용자의 직관과 align. UTC 자정 vs KST 자정 9 시간 drift 가 사용자에게 노출되지 않는다 (저장값은 UTC 이나 boundary / 표시는 KST).
- **dependency 0 / credential 0** — 본 ADR 은 design-only doc 이라 `src/` 변경 0 / `package.json` 변경 0 / 외부 자격증명 변경 0. CLAUDE.md §5 게이트 미발화.

### 부정

- **글로벌 multi-timezone 확장 시 재논의 필요** — 현재 단일조직 한국 운영 가정 (README 매핑) 위에서 boundary timezone = Asia/Seoul 을 hardcode 했다. 다국적 사용자 / multi-tenant 진입 시 사용자별 timezone preference / 조직별 timezone 변형이 필요해지며, 본 ADR 의 §Decision1 hardcoded `Asia/Seoul` 결정이 재논의 대상이 된다.
- **사용자별 timezone preference 미지원** — UI / DB 에 사용자별 timezone column 부재. 본 ADR 단계의 명시적 over-engineering 회피 (§Alternatives (3) 참조). 확장 시 별도 ADR + schema migration (§5 DB schema 게이트).
- **표시·boundary 불일치 가능성 (DST 변경 시)** — 한국은 현재 DST 0 이라 무관하나, 미래에 DST 도입 결정이 나면 (i) `Asia/Seoul` IANA 식별자가 자동 흡수하나 (ii) 이미 저장된 `periodStart` 의 boundary 재해석이 필요해질 수 있다. 본 ADR §Decision1 의 IANA 식별자 채택이 이 risk 의 1 차 방어.
- **impl chain 분해 task 필요** — 본 ADR ACCEPTED flip 후 helper / SinceDerivation / PeriodBridge / R-9 DTO / view-layer formatter 5 컴포넌트 단위로 impl chain task 분해가 별도로 필요하다 (`src/` 변경 task 가 본 ADR 단계에 포함되지 않음 — Out of scope).

## Alternatives

- **(1) UTC boundary 채택** — boundary 계산도 UTC 자정 기준 (`[YYYY-MM-DD T00:00:00Z, T+1 T00:00:00Z)`) 으로 박제. 장점: 저장과 boundary 가 동일 timezone 으로 단순. 단점: R-61 "자정" 의 사용자 직관 (한국 운영자의 KST 자정) 과 9 시간 drift — 6 월 10 일 23:30 KST 활동이 UTC 기준으로는 6 월 10 일 14:30 이라 "6 월 10 일 활동" 으로 분류되지만, 사용자 직관 (KST 6 월 10 일) 과는 align. 그러나 6 월 11 일 02:00 KST 활동 = UTC 17:00 (6 월 10 일) 은 사용자 직관 "6 월 11 일 활동" 인데 UTC boundary 는 "6 월 10 일 활동" 으로 분류 → **사용자 직관 위배** + 사용자 결정 (PLAN L109, KST 확정) **위반**. → **기각**.
- **(2) Web UI 만 KST 변환 + 저장 / boundary 모두 UTC** — 표시 layer 만 KST 변환, boundary 계산은 UTC 자정 기준 유지. 장점: backend 단순. 단점: R-61 자정의 의미가 KST 자정 (사용자 직관) 과 어긋나며 (위 (1) 와 동일 risk), Web UI 가 KST 표시하는데 boundary 가 UTC 라면 사용자가 "6 월 10 일 활동" 으로 본 row 가 일별 요약에서는 "6 월 11 일" 로 잡히는 등 silent drift. 사용자 결정 (PLAN L109) **위반**. → **기각**.
- **(3) `Asia/Seoul` + 사용자별 timezone preference column** — 사용자별 / 조직별 timezone 선택 + 본 ADR 의 default = `Asia/Seoul`. 장점: 다국적 확장 대비 + multi-tenant 미래 친화. 단점: User entity schema migration (`tz: String?` 등) + 모든 boundary 계산 / 표시 함수가 user context 의존 + 본 ADR 단계의 over-engineering. 현재 README 매핑 = 단일조직 한국 운영이라 즉시 가치 0 → 본 ADR 단계 **over-engineering 회피**. 확장 시 별도 ADR 로 재진입. → **기각** (현 단계).
- **(4) Asia/Seoul 일요일 시작 주간** — §Decision3 (b) 의 월요일 시작 대신 일요일 시작 (미국 관행). 장점: 미국 표준 calendar UI 정합. 단점: 한국 운영 관행 (주 시작 = 월요일, ISO-8601 정합) 위배 + README "KST 새벽 2시" 운영 맥락과 자연 정합. → **기각** (월요일 시작 채택).

## Status

**ACCEPTED** (2026-06-12) — Q-0036 사용자 결정(/loop 채팅 응답)으로 flip. frontmatter status 동기 갱신 (§3.1 rule 4 예외 — ADR status 수정은 direct).

본 ADR ACCEPTED flip 후 **impl chain 분해** 는 planner 의 후속 책임이며 다음 컴포넌트 단위 task chain 예상:

1. `src/common/period-boundary.ts` helper 신설 (boundary 계산 함수 모음, R-112 unit test). 본 ADR §Decision5 의 helper 위치 권장 실제 박제.
2. `SinceDerivation` (Q-0026 incremental since 도출) 이 helper 경유로 refactor.
3. `PeriodBridge` (ADR-0037) 가 helper 경유로 refactor.
4. R-9 사용자 지정 기간 DTO (조회 endpoint controller / DTO class-validator transform) 가 helper 의 timezone-default-aware parser 경유.
5. view-layer formatter (조회 endpoint 응답 직렬화 / P6 Web UI 표시 layer — P6 frontend ADR 도 본 ADR 의 §Decision4 default = Asia/Seoul 위에서 결정).

위 5 단계 task 분해의 dependency / 순서 / split 은 본 ADR ACCEPTED flip 시점의 planner 가 결정 (본 ADR 단계에서 결정 0).

## References

- [docs/PLAN.md](../PLAN.md) L109 — 사용자 결정 (2026-06-11, timezone=KST/Asia/Seoul) 직접 박제.
- [README.md](../../README.md) L61 — R-61 자정 (당일 자정 전까지는 평가 미실시). L72 — R-72 Admin cron 주기 지정 ("예: 매일 KST 새벽 2시" 운영 맥락). L9 — R-9 사용자 지정 기간 평가.
- [docs/requirements.md](../requirements.md) L23 — REQ-004 사용자 지정 기간. L53 — REQ-034 일별 활동 + 자정.
- [docs/decisions/ADR-0012-cross-cutting-field-policy.md](ADR-0012-cross-cutting-field-policy.md) §1 — **저장 timezone = UTC single source** (본 ADR 이 보존, 변경 0).
- [docs/decisions/ADR-0035-aggregate-summary-evaluation.md](ADR-0035-aggregate-summary-evaluation.md) §Decision3 + L41 + L86 — Aggregate Summary 의 시점 경계 timezone 결정 위임 → 본 ADR 이 닫는다.
- [docs/decisions/ADR-0029-assessment-collection-orchestrator.md](ADR-0029-assessment-collection-orchestrator.md) L107 — incremental since 도출 timezone 의존 표기 → 본 ADR 위임 닫음.
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) L54 / L122 — `periodStart` timezone 정책 위임 표기 → 본 ADR 이 boundary timezone 결정 단일 source.
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](ADR-0033-evaluation-result-persistence.md) — `(period, periodStart, periodEnd)` 키 형태 (본 ADR 의 반열림 구간 표기 정합).
- [docs/decisions/ADR-0037-period-collection-evaluate-bridge.md](ADR-0037-period-collection-evaluate-bridge.md) — PeriodBridge §Decision5 의 boundary timezone 결정 위임 (본 ADR 이 닫는다, helper 경유 의무 박제).
- **Q-0026** ([docs/STATE.json](../STATE.json)) — "1 주 재수집 window / timezone 보정 (SinceDerivationService 가 직전 periodStart 에서 1 주를 빼는 보정 + Asia/Seoul vs UTC 결정)". 본 ADR 이 **timezone 값 결정 부분만** 닫는다 (Asia/Seoul 확정). 1 주 재수집 window 자체는 본 ADR Out of scope (ADR-0029 / ADR-0035 후속 책임).
