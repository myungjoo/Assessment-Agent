---
id: T-0801
title: period-boundary display formatter·parse 계열에 timeZone 파라미터 일반화 (기본 KST)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-058, REQ-009]
dependsOn: [T-0800]
independentStream: timezone-user-config
touchesFiles:
  - src/common/period-boundary.ts
  - src/common/period-boundary.spec.ts
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-06
plannerNote: "P5 Q-0050 slice(2b) — ADR-0052 §Decision(b)/(d) display·parse helper 에 timeZone 파라미터 일반화(기본 Asia/Seoul), caller 무변경 backward-compat, T-0800 Follow-up"
---

# T-0801 — period-boundary display formatter·parse 계열에 timeZone 파라미터 일반화 (기본 KST)

## Why

[ADR-0052](../decisions/ADR-0052-user-timezone-storage.md) 가 확정한 per-user timezone 지원의 구현 slice(2b) 다. slice(2)(T-0800)가 **경계 계산** helper 5종(`startOfKstDay` 등)에 `timeZone` 파라미터를 일반화했고, 본 slice 는 그 후속으로 T-0800 Follow-up 이 박제한 **display / 입력해석 계열** — `formatKstIso`, `kstOffsetLabel`(및 있으면 `formatKstDisplay`), 그리고 R-9 사용자 지정 기간 입력 해석기 `parseKstPeriodInput` — 에 optional `timeZone: string = KST_TIMEZONE` 파라미터를 추가한다. 현행 `parseKstPeriodInput` 은 line 296 주석("T-0800 Out of Scope — R-9 입력 해석의 timeZone 파라미터화는 slice(2b/3). 여기선 KST 해석 고정")이 명시한 대로 offset 미명시 입력을 KST 로 고정 해석 중인데, 본 slice 가 이를 파라미터화한다(내부는 이미 timeZone 을 받는 `wallClockToUtc` 로 위임하므로 seam 이 좁다). [ADR-0051](../decisions/ADR-0051-user-configurable-timezone.md) §Decision(b) 의 `Intl.DateTimeFormat(timeZone)` 단일 메커니즘 위에서 동작하며 새 dependency 0(`Intl` built-in). 후속 slice(3)(R-9 controller/display mapper 배선)이 본 파라미터에 요청 User.timezone 을 흘려보낸다.

## Required Reading

- `docs/decisions/ADR-0052-user-timezone-storage.md` — §Decision(b)(지배 범위 = R-9 입력 해석 + display) · §Decision(d)(메커니즘 = ADR-0051 (b) 계승) · §Consequences(무효 tz 방어) · §Follow-ups.
- `docs/decisions/ADR-0051-user-configurable-timezone.md` — §Decision(b) `Intl.DateTimeFormat(timeZone)` 단일 메커니즘, hardcoded offset 금지.
- `docs/decisions/ADR-0039-kst-period-boundary.md` — §Decision3(granularity/반열림 [start,end)) · §Decision4(응답 JSON offset-명시/Z 허용) · §Decision5(boundary 계산 1점 집중, formatter 캐시).
- `src/common/period-boundary.ts` — 특히 `formatKstIso`(L249), `kstOffsetLabel`, `parseKstPeriodInput`(L265, line 296 KST-고정 주석), 이미 timeZone 을 받는 `wallClockToUtc`(L85) 와 `formatterCache` Map(T-0800 도입).
- `src/common/period-boundary.spec.ts` (colocated spec — 본 task 가 확장) — 현행 `parseKstPeriodInput`/`formatKstIso` KST 케이스(L111~, L447 round-trip).

## Acceptance Criteria

- [ ] `src/common/period-boundary.ts` 의 **display / 입력해석 경로**를 `timeZone` 파라미터로 일반화. 구체:
  - [ ] `formatKstIso` (및 존재 시 `formatKstDisplay`)가 마지막 인자로 optional `timeZone: string = KST_TIMEZONE` 를 받아 해당 zone 의 wall-clock + offset 라벨을 산출하도록 확장. 내부 wall-clock 조회는 T-0800 의 `formatterCache` Map 을 재사용(매 호출 새 `Intl.DateTimeFormat` 생성 금지 — ADR-0039 §Decision5).
  - [ ] `kstOffsetLabel`(offset 라벨 산출)이 `timeZone` 인자를 받아 해당 zone 의 offset(예: `-04:00`, `+00:00`)을 산출하도록 확장. hardcoded `+09:00` 산술 도입 금지 — offset 은 `Intl` 로 실측(ADR-0051 §Decision(b)).
  - [ ] `parseKstPeriodInput` 이 마지막 인자로 optional `timeZone: string = KST_TIMEZONE` 를 받아, **offset 미명시 입력**을 해당 zone 으로 해석하도록 확장(line 296 KST-고정 → 파라미터화). offset **명시**(Z / ±hh:mm) 입력은 여전히 그대로 그 offset 을 존중(zone 무시). 내부는 이미 timeZone 을 받는 `wallClockToUtc` 로 위임.
  - [ ] **기존 시그니처 호출부 무변경** — 모든 추가 파라미터는 default `KST_TIMEZONE` 라 기존 caller 동작 100% 보존(backward-compat).
- [ ] **Happy-path unit test**: 확장된 각 public 함수(`formatKstIso`/`kstOffsetLabel`/`parseKstPeriodInput`, 존재 시 `formatKstDisplay`)에 대해 (i) 인자 미지정 시 기존 KST 결과 불변(기존 spec 케이스 유지), (ii) `timeZone` 명시(예: `"America/New_York"`, `"UTC"`) 시 해당 zone 기준 산출 정확성 검증 test 1+.
  - [ ] `parseKstPeriodInput` round-trip: offset 미명시 입력을 non-KST zone 으로 해석 → 그 결과를 같은 zone `formatKstIso` 로 되돌리면 원 wall-clock 복원됨을 검증(예: `parseKstPeriodInput("2026-06-10T15:00", "UTC")` = `2026-06-10T15:00:00Z`).
  - [ ] `parseKstPeriodInput` offset **명시** 입력은 `timeZone` 인자와 무관하게 명시 offset 을 존중함을 검증(예: `"...+09:00"` 을 `"UTC"` 인자로 넘겨도 결과 동일).
- [ ] **Error path unit test**: 무효 IANA 식별자(예: `"Not/AZone"`)를 `formatKstIso`/`parseKstPeriodInput`/`kstOffsetLabel` 에 전달 시 `Intl.DateTimeFormat` throw(RangeError)가 명시 error 로 전파되는지 검증(ADR-0052 §Consequences 무효 tz 방어) — 각 1+ test.
  - [ ] `parseKstPeriodInput` 의 기존 error path(비문자열/빈 문자열 TypeError, 형식 위반/불가능 시각 RangeError)가 timeZone 파라미터 추가 후에도 유지됨을 검증.
- [ ] **Flow / branch coverage**: `parseKstPeriodInput` 의 offset 명시 분기 vs 미명시(zone 해석) 분기 · timeZone 지정 vs 미지정(default) 분기 각각 1+ test.
- [ ] **Negative cases 충분 cover**: (a) 비문자열/빈 입력(TypeError) · (b) 형식 위반 입력(RangeError) · (c) 달력상 불가능 시각(2/30·25시, RangeError) · (d) 무효 offset(RangeError) · (e) 무효 timezone 식별자 · (f) 경계값(윤년 2/29·연말 12/31 자정·DST 존재 zone 예: `"America/New_York"` 봄 전환 근방 wall-clock) — 각 1+ test.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 본 파일은 기존 98%+ 수준 유지).

## Out of Scope

- **경계 계산 helper 재수정 금지** — `startOfKstDay`/`startOfKstWeek`/`startOfKstMonth`/`getKstPeriodRange`/`getKstPeriodRangeByPeriod` 는 이미 T-0800 에서 timeZone 일반화 완료. 본 task 는 display/parse 계열만 touch(중복 수정 금지).
- **caller(도메인/controller) 배선 금지** — `assessment-evaluation.controller` 등 호출부에 timezone 전달 접점 추가는 slice(3)(R-9 controller/display mapper) 로 미룬다. 본 task 는 `period-boundary.ts` 내부 + colocated spec 2 파일만 touch.
- **User.timezone 조회/저장 경로 금지** — repository/service 에서 User.timezone 을 읽어오는 배선은 slice(3).
- **timezone 화이트리스트 검증 로직 금지** — 무효 tz 는 `Intl` throw 를 error 로 전파하는 수준까지만. 입력 검증(화이트리스트)은 timezone 설정 저장 경로 slice.
- **응답 JSON 시각 필드 format 변경 금지** — `formatKstIso` 의 출력 형식(offset-명시 ISO) 자체는 불변, timeZone 인자만 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (slice 3) R-9 사용자 지정 기간 controller(`assessment-evaluation.controller`) + display mapper 가 요청 User.timezone 을 `parseKstPeriodInput`/`formatKstIso` 인자로 배선(ADR-0052 §Decision(b)). User.timezone 조회 경로(PersonService/JwtPayload) 포함.
- (설정 저장) timezone 설정 update 경로에서 무효 IANA 식별자 화이트리스트/try-catch 검증(ADR-0052 §Consequences).
