---
id: ADR-0050
title: "timezone 표준 = Asia/Seoul(KST) 기간 경계 패턴 — 저장=UTC timestamptz 유지 + 경계 계산·표시만 고정 +09:00 offset KST 변환, 주 시작=월요일(ISO 8601), 반열림 구간 [start, end)"
status: ACCEPTED
date: 2026-07-01
acceptedAt: 2026-07-01
relatedTask: T-0798
supersedes: null
augments: [ADR-0045]
relatedReq: [REQ-034, REQ-031]
---

# ADR-0050 — timezone 표준 = Asia/Seoul(KST) 기간 경계 패턴

> 본 ADR 은 **ACCEPTED** (2026-07-01, repo owner myungjoo 가 aa-local interactive session 에서 [Q-0049](../STATE.json) 옵션(1) 로 아래 §Decision 6종 (a)~(f) 를 모두 확정 — 결정 record 는 §ACCEPTED record 참조). 새 dependency·새 credential·새 schema 를 도입하지 **않으며**, 구현 코드 0 LOC 의 **순수 decision document** 다. 이미 확정된 결정을 정밀 박제해, 일/주/월 요약 경계·재수집 window·사용자 지정 기간 해석·시각화 표시가 전부 같은 timezone 규약 위에서 일관되도록 못 박는다. [ADR-0045](ADR-0045-llm-provider-deployment-config.md) §Decision3 의 "저장/계산 분리 + no-new-dependency" 정신에 인접한다.

## ACCEPTED record (2026-07-01)

repo owner myungjoo 가 aa-local interactive session(2026-07-01)에서 [Q-0049](../STATE.json) 옵션(1)("timezone/REQ-058 재승인")을 채택하며, PLAN P5 bullet 110(2026-06-11 KST 확정)의 [Q-0026](../STATE.json) 옵션2 deferral 을 해제했다. 동시에 아래 §Decision 의 세부 6종 (a)~(f) — 기준 timezone·offset 처리·저장/계산 분리·주 시작·경계 구간·적용 범위 — 를 모두 확정했다. 본 ADR 은 그 확정 결정을 architect 가 record 로 박제한 것이며, 새 아키텍처 탐색이 아니다([ADR-0045](ADR-0045-llm-provider-deployment-config.md) 의 결정 record 패턴 mirror). 후속 구현(순수 helper chain)은 §Out of scope / §Follow-ups 로 분해한다.

## Context

### 트리거 — timezone 규약이 코드에 흩뿌려지기 전에 하나의 record 로 고정해야 한다

PLAN P5 bullet 110 은 사용자가 2026-06-11 에 기준 timezone 을 **KST(Asia/Seoul)** 로 확정했음을 박제했으나, 세부 표준 패턴(자정 판정·주/월 시작·경계 구간·offset 처리 방식)은 "구현 진입 시 ADR 로 박제" 로 미뤄졌고 [Q-0026](../STATE.json) 옵션2 가 이를 "미승인/deferred 유지" 상태로 두었다. 2026-07-01 사용자가 [Q-0049](../STATE.json) 옵션(1) 재승인 + 세부 6종을 확정하면서 이 deferral 이 해제됐다.

일별 요약([REQ-034](../requirements.md) / R-61 자정 룰) · 주간/월간 요약 시작 판정 · 사용자 지정 기간(R-9) 해석 · 최근 1주 재수집 window([REQ-031](../requirements.md) / R-58) · 시각화 표시가 전부 **같은 timezone 규약** 위에서 일관돼야 한다. 규약이 문서로 고정돼 있지 않으면 각 지점이 서로 다른 자정 기준·주 시작·경계 규칙으로 drift 할 수 있다. 같은 결정을 두 번 추론하지 않기 위해([CLAUDE.md §7.3](../../CLAUDE.md)) 코드 배선 전에 규약을 하나의 ADR 로 먼저 박제한다.

### 외력

- **[REQ-034](../requirements.md) (R-61)** — 일별 활동 요약 평가문. "당일은 자정까지 안 함" 이라는 시각 조건이 있어 '자정' 이 **어느 timezone 의 자정** 인지 규약이 필요하다.
- **[REQ-031](../requirements.md) (R-58)** — 재수집 중복 방지 + 최근 1주 재수집 OK. "최근 1주" window 의 경계가 timezone 에 의존한다.
- **R-9** — 사용자 지정 기간. 사용자가 준 기간 문자열/날짜의 해석 timezone 이 정해져 있어야 한다.
- **[ADR-0045](ADR-0045-llm-provider-deployment-config.md) §Decision3** — 저장/계산 분리 + no-new-dependency 정신(인접 패턴). 본 ADR 도 저장(UTC)과 계산·표시(KST)를 분리하고 새 dependency 를 도입하지 않는다.
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / 새 credential / DB schema migration 은 BLOCKED. 본 결정은 **새 dependency 0**(고정 +09:00 offset 산술은 순수 helper 로 처리 — IANA tz 라이브러리 불요), **새 credential 0**, **DB schema 변경 0**(저장은 기존 UTC `timestamptz` 유지). 따라서 §5 게이트를 어느 축도 발화하지 않는다.

## Decision

아래 6종 (a)~(f) 를 timezone 표준 규약으로 확정한다.

### (a) 기준 timezone = Asia/Seoul(KST, UTC+9)

**채택: 모든 기간 경계 계산·표시의 기준 timezone 은 `Asia/Seoul`(KST, UTC+9) 이다.** 일/주/월 요약 경계, 사용자 지정 기간, 재수집 window, 시각화 표시가 전부 KST 를 기준으로 해석된다. 서버/DB 의 물리 timezone 설정과 무관하게 도메인 경계 판정은 항상 KST 로 고정한다.

### (b) 고정 +09:00 offset 사용 — 새 dependency 0

**채택: KST 변환은 IANA tz 데이터베이스/라이브러리(Luxon · date-fns-tz 등) 없이 순수 helper 의 고정 `+09:00` offset 산술로 처리한다.** 한국은 1988 서울올림픽 이후 DST(일광절약시간)를 시행하지 않으므로 offset 이 연중 항상 `+09:00` 로 불변이다 — tz 규칙 테이블 조회가 필요 없다. 따라서 IANA tz 라이브러리를 **새 dependency 로 도입하지 않는다**([CLAUDE.md §5](../../CLAUDE.md) 게이트 미발화 — package.json 변경 0). UTC↔KST 변환은 UTC epoch 에 `+9h` 를 가감하는 순수 산술로 완결된다.

### (c) 저장 = UTC `timestamptz` 유지, 경계 계산·표시할 때만 KST 변환

**채택: 데이터 저장은 기존 UTC `timestamptz` 를 그대로 유지한다. KST 변환은 기간 경계 계산과 사용자 표시(display) 시점에만 수행한다 — 저장/계산을 분리한다.** DB 에 어떤 값도 KST 로 재저장하지 않으며 timestamp 컬럼의 semantics(UTC 순간)를 바꾸지 않는다 → **DB schema 변경 0**([CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트 미발화). 이는 [ADR-0045](ADR-0045-llm-provider-deployment-config.md) §Decision3 의 "저장/계산 분리" 정신과 인접한다 — 저장 layer 는 timezone-중립(UTC)으로 두고, timezone 은 도메인 경계·표시 layer 에서만 개입한다.

### (d) 주 시작 = 월요일(ISO 8601)

**채택: 주(week)의 시작은 월요일(ISO 8601)이다.** 주간 요약의 주 경계는 KST 기준 월요일 00:00(Asia/Seoul) 에서 시작해 다음 월요일 00:00 직전까지다. 일요일 시작(US 관습)이 아니라 ISO 8601 의 월요일 시작을 채택한다.

### (e) 기간 경계 = 반열림 구간 `[start, end)`

**채택: 모든 기간 경계는 반열림 구간 `[start, end)` 로 표현한다 — start 순간은 포함, end 순간은 배제한다.** 인접 기간의 end 와 다음 기간의 start 가 같은 순간으로 맞물려 경계 순간의 이중 계수(double-counting)나 누락(gap)이 발생하지 않는다. 예: 어떤 날의 일별 경계는 `[해당일 00:00 KST, 다음날 00:00 KST)` 이며, 다음날 00:00 정각의 활동은 다음날 구간에 귀속된다.

### (f) 적용 범위

**채택: 위 규약은 아래 표의 모든 지점에 일관되게 적용된다.**

| 적용 지점 | KST 규약 적용 |
| --- | --- |
| [REQ-034](../requirements.md) / R-61 일별 요약 '자정' | KST 자정(00:00 Asia/Seoul). 당일은 자정까지 평가 미실시(당일 구간이 아직 닫히지 않았으므로 요약 미생성) |
| 주간 요약 경계 | KST 주 — 월요일 00:00 KST 시작, `[월요일 00:00, 다음 월요일 00:00)` 반열림 |
| 월간 요약 경계 | KST 매월 1일 00:00, `[해당월 1일 00:00, 다음달 1일 00:00)` 반열림 |
| R-9 사용자 지정 기간 | 사용자가 준 기간을 KST 로 해석, `[start, end)` 반열림 |
| [REQ-031](../requirements.md) / R-58 최근 1주 재수집 window | KST 기준으로 window 경계 계산 |
| 시각화 표시(display) | KST 로 변환해 표시 |

### 후속 순수 helper 구현 예정 (본 규약 위)

본 ADR 은 결정만 박제하며, 위 규약 위에서 다음 **순수 helper** 들이 별도 후속 slice([§Follow-ups](#follow-ups))로 구현될 것임을 명시한다(본 task 에서는 helper 코드 작성 금지 — [§Out of scope](#out-of-scope)):

- `kstDayStart` — 임의 UTC 순간이 속한 KST 일(day)의 시작 순간(00:00 KST → UTC).
- `kstWeekStart` — 임의 UTC 순간이 속한 KST 주의 시작(월요일 00:00 KST → UTC, ISO 8601).
- `kstMonthStart` — 임의 UTC 순간이 속한 KST 월의 1일 00:00 KST → UTC.
- `toKstPeriodBoundary` — day/week/month/사용자 지정 종류에 따라 반열림 `[start, end)` 경계쌍을 계산.

이들은 전부 (b) 고정 `+09:00` offset 산술 + (c) 저장 UTC 유지 위에서 동작하는 순수 함수로, 새 dependency·credential·schema 0 이다.

## Consequences

### 긍정

- **timezone 규약 단일 진실원(single source)** — 일/주/월 요약·재수집 window·사용자 지정 기간·시각화가 전부 하나의 record 를 참조하므로 자정 기준·주 시작·경계 규칙 drift 가 차단된다. 후속 helper 들이 동일 기준으로 구현된다.
- **새 dependency 0 / 새 credential 0 / DB schema 변경 0** — 고정 offset 산술 + 저장 UTC 유지로 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트를 어느 축도 발화하지 않는다. cron 자율 진행 가능한 유일한 §5-미게이트 genuine 방향([Q-0049](../STATE.json) 권고안).
- **저장/계산 분리로 저장 layer timezone-중립 유지** — timestamp 는 UTC epoch 로 남아 이식성·비교 연산이 단순하고, timezone 관심사는 도메인 경계·표시 layer 로 국지화된다([ADR-0045](ADR-0045-llm-provider-deployment-config.md) §D3 정신 인접).
- **반열림 `[start, end)` 로 경계 순간 이중 계수/누락 차단** — 인접 기간이 end=next-start 로 맞물려 경계 활동 귀속이 결정적이다.

### 부정 / trade-off

- **DST 변경에 대한 취약성(이론적)** — 고정 `+09:00` 은 한국이 DST 를 재도입하면 깨진다. mitigation: 한국은 1988 이후 DST 부재이고 재도입 논의도 없다 — 재도입 시에만 IANA tz 라이브러리 도입을 별도 ADR 로 재론한다([§Alternatives A](#a-iana-tz-데이터베이스라이브러리-도입-미채택)). 현 결정은 KST 단일 기준 전제 위에서 성립하며, 다국가 timezone 지원이 필요해지면 그때 재결정한다.
- **표시 layer 마다 변환 책임** — 저장이 UTC 라 경계 계산·표시 지점마다 KST 변환을 호출해야 한다. mitigation: 변환을 순수 helper(`kstDayStart` 등)로 국지화해 각 호출부는 helper 만 부르면 되도록 한다 — 변환 로직 중복 0.

### NON-goal (명시 — 박제)

- **다국가/사용자별 timezone 지원 아님** — 본 ADR 은 KST 단일 기준만 확정한다. per-user timezone 이나 다국가 지원은 본 결정 밖(필요 시 별도 ADR).
- **저장 timezone 변경 아님** — 저장은 UTC `timestamptz` 유지. DB 를 KST 로 재저장하거나 컬럼 semantics 를 바꾸지 않는다.
- **helper 구현 아님** — 본 ADR 은 규약(결정)만 박제. helper 코드는 후속 slice([§Follow-ups](#follow-ups)).

### Cross-Module Impact

본 결정은 **public API / shared symbol contract 를 변경하지 않는다** — 구현 코드 0 LOC 의 decision document 이며, 기존 함수/클래스/엔드포인트 시그니처를 하나도 바꾸지 않는다. 따라서 hard rule(cross-module impact)의 "public API / shared symbol contract 변경" 에 해당하는 파괴적 변경이 없어 inbound caller scan / BLOCKED(cross-module-spread) 게이트가 발화하지 않는다. 후속 helper slice 는 **새 순수 함수 추가**(기존 symbol 변경이 아님)이며, 그 배선 slice 에서 caller 접점이 생길 때 해당 task 가 별도로 impact 를 평가한다.

## Alternatives considered

### A. IANA tz 데이터베이스/라이브러리 도입 (미채택)

Luxon / date-fns-tz 등 IANA tz 라이브러리를 새 dependency 로 도입해 `Asia/Seoul` zone 규칙으로 변환하는 안. **미채택** — (1) 한국은 1988 이후 DST 부재라 offset 이 연중 `+09:00` 로 불변이므로 tz 규칙 테이블 조회의 실익이 0 이다. (2) 새 외부 dependency 는 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트를 발화시켜 사람 승인·유지보수·번들 비용을 유발한다. 고정 offset 산술이 동일 결과를 순수 함수로 달성하므로 dependency 도입은 불필요한 복잡성이다. (재론 조건: 한국이 DST 를 재도입하거나 다국가 timezone 지원이 필요해지면 그때 별도 ADR 로 IANA tz 도입을 재검토한다 — 그 전까지 재론 금지.)

### B. 기준 timezone = UTC (미채택)

경계 계산·표시도 전부 UTC 로 두어 변환 자체를 없애는 안. **미채택** — 사용자·데이터 대상(한국 개발 활동)이 KST 로 사고하므로 UTC 자정 경계는 R-61 '자정'·주/월 시작·사용자 지정 기간을 사용자 직관과 9시간 어긋나게 만든다(예: KST 09:00 이전 활동이 전날로 귀속되는 혼란). 저장은 UTC 로 두되(=본 결정 (c)) 도메인 경계는 KST 로 해석하는 것이 사용자 정합이다. 사용자가 [Q-0049](../STATE.json) 에서 KST 를 명시 확정했다.

### C. 주 시작 = 일요일 (미채택)

주간 요약의 주 시작을 일요일(US 관습)로 두는 안. **미채택** — 사용자가 ISO 8601 월요일 시작을 확정((d)). ISO 8601 은 국제 표준이고 한국 관행과도 정합한다.

### D. 닫힌 구간 `[start, end]` (미채택)

기간 경계를 양끝 포함 `[start, end]` 로 표현하는 안. **미채택** — 인접 기간의 end 와 다음 기간의 start 가 같은 순간을 양쪽에서 포함해 경계 순간 활동이 이중 계수된다. 반열림 `[start, end)`((e))가 경계 귀속을 결정적으로 만든다.

## Out of scope

본 ADR 은 **규약(결정)만 박제**한다 — 다음은 후속 task / 별도 결정 책임:

- **순수 helper 구현** — `kstDayStart` / `kstWeekStart`(월요일 시작) / `kstMonthStart` / `toKstPeriodBoundary` 등의 코드 작성은 별도 후속 pr task(dependsOn: [T-0798]). 본 task 에서 helper 코드 작성 금지.
- **기존 코드의 timezone 로직 리팩터 / 호출부 배선** — summary / 재수집 window / 사용자 지정 기간 해석부에 helper 를 배선하는 것은 helper 구현 이후 slice.
- **DB schema 변경** — 저장 UTC `timestamptz` 유지 결정((c))이라 애초에 불요.
- **시각화 / frontend 표시 배선** — helper + P6 이후.
- **IANA tz 라이브러리 도입 검토** — 고정 `+09:00` 로 확정((b)/§Alternatives A) — 재론 금지(DST 재도입/다국가 지원 필요 시에만 별도 ADR).

## Follow-ups

- (다음 slice) 순수 helper `kstDayStart` / `kstWeekStart`(월요일 시작) / `kstMonthStart` / `toKstPeriodBoundary` 구현 + R-112 4종 test(happy · error · flow · negative 경계: 월/주/일 경계 전후 · 윤년 · UTC↔KST 자정 넘김 등) — pr, dependsOn: [T-0798]. 새 dependency · credential · schema 0.
- 이후 summary / 재수집 window / 사용자 지정 기간 해석부에 helper 배선 — helper 구현 이후 slice.

## References

- [docs/decisions/ADR-0045-llm-provider-deployment-config.md](ADR-0045-llm-provider-deployment-config.md) §Decision3 / §Decision4 — 저장/계산 분리 + no-new-dependency 정신(본 ADR 이 인접 패턴으로 참조 — 저장 UTC 유지 + 고정 offset 산술 새 dep 0)
- [docs/requirements.md](../requirements.md) — REQ-034(R-61 일별 요약, 당일 자정까지 미실시) · REQ-031(R-58 재수집 중복 방지 + 최근 1주) · R-9(사용자 지정 기간)
- [docs/PLAN.md](../PLAN.md) — P5 bullet 110(timezone KST 확정) · bullet 97(일/주/월 요약 + R-61 자정) · bullet 100(R-58 재수집 최근 1주)
- [docs/STATE.json](../STATE.json) — Q-0049 decision(사용자 확정 세부 6종 (a)~(f), 2026-07-01 aa-local interactive session) · Q-0026 decision(prior deferral 맥락)
- [CLAUDE.md §5 / §7.3 / §12](../../CLAUDE.md) — BLOCKED 게이트(새 dep · credential · schema 미발화) / 결정 재추론 회피(ADR record) / 언어 정책

Refs: T-0798, ADR-0045, REQ-034, REQ-031, Q-0049, Q-0026
