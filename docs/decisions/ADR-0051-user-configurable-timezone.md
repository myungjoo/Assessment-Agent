---
id: ADR-0051
title: "timezone 사용자 설정 지원 — 기본값 = Asia/Seoul(KST), 변환 메커니즘 권위 = Intl.DateTimeFormat(IANA zone) (ADR-0050 §Decision(b) 고정 offset 산술 supersede, ADR-0039 augment)"
status: ACCEPTED
date: 2026-07-06
acceptedAt: 2026-07-06
relatedTask: null
supersedes: null
augments: [ADR-0039, ADR-0050]
relatedReq: [REQ-034, REQ-031]
relatedQuestion: Q-0050
---

# ADR-0051 — timezone 사용자 설정 지원 (기본값 KST) + 변환 메커니즘 단일화

> 본 ADR 은 **ACCEPTED** (2026-07-06, repo owner myungjoo 가 aa-local interactive session 에서 직접 결정). [Q-0050](../STATE.json) 의 **쟁점 B**(변환 메커니즘 ADR 모순)를 해소하고, timezone 을 **사용자 설정 가능한 값**으로 확장하되 **Asia/Seoul(KST)을 기본값**으로 못 박는다. 새 dependency·새 credential·새 DB schema 를 도입하지 **않는다**(§Consequences). 구현 코드 0 LOC 의 decision document 다 — 후속 helper 일반화·배선·설정 저장은 §Follow-ups.

## Context

### 트리거 — Q-0050 쟁점 B (두 ADR 의 변환 메커니즘 모순)

[Q-0050](../STATE.json) 검토 중 두 ACCEPTED ADR 의 timezone 변환 **메커니즘 결정이 정면으로 상충**함이 드러났다:

- **[ADR-0050](ADR-0050-timezone-kst-period-boundary.md) §Decision (b)** — "KST 변환은 IANA tz 라이브러리 없이 순수 helper 의 **고정 `+09:00` offset 산술**로 처리한다. IANA tz 라이브러리를 새 dependency 로 도입하지 않는다." (§Alternatives A 에서 Intl/IANA 방식을 명시적으로 미채택)
- **[ADR-0039](ADR-0039-timezone-kst-boundary-policy.md) §Decision 1** — "Node 내장 **`Intl.DateTimeFormat`**(IANA `Asia/Seoul`)만 사용. **hardcoded +09:00 산술 금지**." — 그리고 main 의 실제 구현([src/common/period-boundary.ts](../../src/common/period-boundary.ts))이 이 방식으로 이미 landed.

두 §Decision 은 결과값은 동일하지만(한국은 1988 이후 DST 부재로 offset 이 항상 +09:00) **채택 메커니즘의 문서 서술이 서로를 부정**한다. ADR-0050 (b) 는 "고정 산술, Intl 금지", ADR-0039 §D1 은 "Intl 필수, 고정 산술 금지". 이 모순을 방치하면 후속 helper 배선 시 어느 규약을 따를지 재추론이 반복된다([CLAUDE.md §7.3](../../CLAUDE.md)).

### 결정 계기 — 사용자가 timezone 을 설정 가능하게 하기로 확정

2026-07-06 repo owner myungjoo 가 interactive session 에서 결정했다: **"timezone 을 사용자가 설정할 수 있도록 한다. KST 는 기본값으로 본다."** 이 결정이 쟁점 B 를 **구조적으로 강제 해소**한다 — 임의의 사용자 지정 timezone(예: `America/New_York`, `Europe/London`)은 **고정 `+09:00` offset 산술로는 표현 불가능**하고, 각 zone 의 DST·offset 규칙 조회가 필요하다. 따라서 IANA zone 규칙을 다루는 `Intl.DateTimeFormat(timeZone)` 방식(ADR-0039)만이 유일한 정답이 된다. ADR-0050 (b) 의 "고정 offset" 근거는 "KST 단일·DST 부재" 전제 위에서만 성립했고, 그 전제(단일 timezone)를 본 결정이 해제하므로 (b) 는 소멸한다.

### 외력

- **[ADR-0039](ADR-0039-timezone-kst-boundary-policy.md)** — 이미 `Intl.DateTimeFormat({ timeZone })` 로 boundary 를 계산한다. `KST_TIMEZONE = "Asia/Seoul"` 을 **하드코딩**하고 있을 뿐, timezone 을 **파라미터로 받도록 일반화하면** 그대로 사용자 설정형이 된다 — 구조는 이미 정답, 값만 고정돼 있다.
- **[ADR-0050](ADR-0050-timezone-kst-period-boundary.md) §NON-goal** — "다국가/사용자별 timezone 지원 아님" 을 명시했으나, 본 결정이 이를 **해제**한다(§Supersession).
- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 dependency / credential / DB schema 는 BLOCKED. 본 결정은 **새 dependency 0**(`Intl` 은 Node 내장이며 **모든 IANA zone 을 built-in 지원** — 사용자 설정형이어도 외부 tz 라이브러리 불요), **새 credential 0**. 설정 저장이 DB 를 건드릴지는 §Out of scope 로 분리(본 ADR 은 방향·메커니즘만 확정, schema 결정은 후속).

## Decision

### (a) timezone 은 사용자 설정 가능한 값, 기본값 = `Asia/Seoul`(KST)

**채택: 기간 경계 계산·표시의 기준 timezone 은 사용자가 설정할 수 있는 값이며, 설정이 없을 때의 기본값은 `Asia/Seoul`(KST)이다.** 일/주/월 요약 경계·사용자 지정 기간·재수집 window·시각화 표시는 "설정된 timezone(없으면 KST)" 기준으로 해석된다. ADR-0050 §Decision (a) 의 "KST 단일 고정" 은 "KST 기본값 + 설정 가능" 으로 완화된다.

### (b) 변환 메커니즘 단일 권위 = `Intl.DateTimeFormat(timeZone)` (IANA zone)

**채택: UTC↔local 변환의 권위 메커니즘은 Node 내장 `Intl.DateTimeFormat` 에 IANA zone 식별자(기본 `Asia/Seoul`)를 넘기는 방식이다** — [ADR-0039](ADR-0039-timezone-kst-boundary-policy.md) 구현이 이미 정답이다. **[ADR-0050](ADR-0050-timezone-kst-period-boundary.md) §Decision (b) 의 "고정 `+09:00` offset 산술" 은 supersede** 된다(임의 사용자 zone 은 고정 offset 으로 불가). hardcoded offset 산술은 금지한다(ADR-0039 §D1 유지·확장).

### (c) 새 dependency 0 유지 — `Intl` 이 모든 IANA zone 을 built-in 지원

**채택: 사용자 설정형 timezone 이어도 새 외부 dependency(Luxon·date-fns-tz 등)를 도입하지 않는다.** `Intl.DateTimeFormat` 은 ECMAScript Intl(ICU) 표준으로 모든 IANA tz 식별자를 built-in 으로 해석한다. 따라서 [CLAUDE.md §5](../../CLAUDE.md) 의 dependency 게이트는 사용자 설정형으로 확장해도 **발화하지 않는다** — ADR-0050 (b) 가 지키려던 "새 dep 0" 목표를 오히려 Intl 방식이 더 넓은 범위(임의 zone)에서 달성한다.

### (d) 저장 = UTC `timestamptz` 유지 (ADR-0050 (c)/(e) 불변)

**채택: 저장은 UTC `timestamptz` 를 그대로 유지한다. 사용자 timezone 은 경계 계산·표시 시점의 파라미터일 뿐, 저장 semantics 를 바꾸지 않는다.** ADR-0050 §Decision (c)(저장/계산 분리)·(d)(주 시작 월요일 ISO 8601)·(e)(반열림 `[start,end)`)·(f)(적용 범위)는 **전부 불변**이다 — 본 ADR 은 오직 "기준 timezone 이 KST 단일 고정 → KST 기본값 + 설정 가능" 과 "변환 메커니즘 = Intl(ADR-0039)" 두 축만 바꾼다.

## Supersession (명시 — 박제)

- **ADR-0050 §Decision (b)** ("고정 +09:00 offset 산술, IANA 미도입") → **SUPERSEDED by 본 (b)/(c)**. 변환 메커니즘 권위는 ADR-0039 의 `Intl.DateTimeFormat(timeZone)`.
- **ADR-0050 §Decision (a)** ("KST 단일 고정") → **완화** — "KST 기본값 + 사용자 설정 가능"(본 (a)).
- **ADR-0050 §NON-goal "다국가/사용자별 timezone 지원 아님" / §Alternatives A "IANA 미채택"** → **해제** — 사용자 설정형 timezone 이 이제 IN scope(KST 기본). 단 "다국가 지원" 자체(per-tenant·locale 확장)는 여전히 본 ADR 밖(설정형 단일 timezone 만 확정, 저장 범위는 §Out of scope).
- **ADR-0039 §Decision 1** ("Intl 필수, hardcoded offset 금지") → **augment(강화)** — 본 결정이 이를 프로젝트 전역 단일 권위로 승격하고, `KST_TIMEZONE` 하드코딩을 "설정값(기본 KST)" 으로 일반화할 근거를 준다.

## Consequences

### 긍정

- **쟁점 B 해소** — 변환 메커니즘 모순이 Intl(ADR-0039) 단일 권위로 정리됨. 후속 helper 배선이 어느 규약을 따를지 재추론 0.
- **사용자 설정형 timezone 이 새 dependency 0 으로 달성** — `Intl` built-in 만으로 임의 IANA zone 지원. §5 게이트 미발화.
- **기존 구현 재사용** — ADR-0039 helper 는 이미 `Intl.DateTimeFormat({ timeZone })` 구조라, `timeZone` 을 파라미터화하고 기본값 KST 를 주면 그대로 설정형이 된다(재작성이 아니라 일반화).
- **저장 layer 불변** — UTC `timestamptz` 유지로 이식성·비교 연산 단순성 보존(ADR-0050 (c) 정신).

### 부정 / trade-off

- **helper 시그니처 변경 파급** — `startOfKstDay(instant)` → `startOfDay(instant, tz = "Asia/Seoul")` 류 일반화 시 호출부(controller 좌표 snap·period-evaluable 게이트)가 새 파라미터를 통과시켜야 한다. mitigation: 기본값 KST 를 두어 기존 호출부는 무변경으로 동작(점진 배선), 명명 일반화는 별도 slice(§Follow-ups).
- **설정 저장 위치 미결** — 사용자 timezone 을 어디에 저장할지(per-user preference / global config / env)는 본 ADR 이 정하지 않는다. per-user·DB 저장을 택하면 그 slice 에서 §5 DB schema 게이트가 발화할 수 있다 — 별도 ADR/task 로 결정(§Out of scope).
- **잘못된 tz 식별자 입력** — 사용자가 유효하지 않은 IANA 식별자를 주면 `Intl.DateTimeFormat` 이 throw 하거나 UTC 로 fallback 한다. 배선 slice 에서 입력 검증(허용 zone 목록 또는 try/catch → 명시 error)을 R-112 negative case 로 다룬다.

### NON-goal (명시)

- **다국가/멀티테넌트 timezone 확장 아님** — 본 ADR 은 "단일 설정값(기본 KST)" 만 확정한다. per-user row 별 timezone·locale 별 표시 등은 설정 저장 범위 결정(후속) 이후의 별도 논의.
- **설정 저장 schema 결정 아님** — 저장 위치·범위는 §Out of scope.
- **helper 명명 일반화 강제 아님** — `startOfKstDay` 등의 rename 여부는 배선 slice 에서 alias/rename 트레이드오프로 결정(본 ADR 은 방향만).

## Out of scope

- **timezone 설정의 저장 위치·범위 결정** — per-user preference(DB) vs global config vs 환경변수. per-user·DB 저장이면 별도 ADR + DB schema 게이트([CLAUDE.md §5](../../CLAUDE.md)).
- **helper 일반화 구현** — `Intl` timezone 파라미터화 + 기본값 KST + 명명 일반화(alias/rename) — pr task.
- **호출부 배선** — summary / 재수집 window / 사용자 지정 기간 해석부에 설정 timezone 을 전달 — helper 일반화 이후 slice.
- **시각화 / frontend 설정 UI** — P6 이후.

## Follow-ups

- (다음 결정) timezone 설정의 저장 위치·범위 ADR — per-user(DB) / global config / env 중 택. DB 저장 시 §5 schema 게이트.
- (helper slice) [src/common/period-boundary.ts](../../src/common/period-boundary.ts) 의 `startOfKstDay`/`startOfKstWeek`/`startOfKstMonth`/`getKstPeriodRange`/formatter 를 `timeZone` 파라미터(기본값 `"Asia/Seoul"`)를 받도록 일반화 + R-112 4종(happy·error·flow·negative: 무효 tz 식별자·DST 있는 zone 경계·기본값 fallback 등). 기존 호출부는 기본값으로 무변경 동작. 새 dependency 0.
- (배선 slice) 설정 timezone 을 summary/재수집 window/사용자 지정 기간 해석부에 전달.

## References

- [docs/decisions/ADR-0050-timezone-kst-period-boundary.md](ADR-0050-timezone-kst-period-boundary.md) — §Decision (b) SUPERSEDED / (a) 완화 / NON-goal 해제 대상
- [docs/decisions/ADR-0039-timezone-kst-boundary-policy.md](ADR-0039-timezone-kst-boundary-policy.md) — §Decision 1 Intl 메커니즘(본 ADR 이 전역 권위로 augment) + 구현 [src/common/period-boundary.ts](../../src/common/period-boundary.ts)
- [docs/STATE.json](../STATE.json) — Q-0050 쟁점 B(본 ADR 이 해소) · Q-0049 decision(ADR-0050 확정 맥락)
- [CLAUDE.md §5 / §7.3](../../CLAUDE.md) — BLOCKED 게이트(dependency 미발화) / 결정 재추론 회피

Refs: ADR-0051, ADR-0050, ADR-0039, Q-0050, REQ-034, REQ-031
