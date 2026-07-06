---
id: T-0800
title: period-boundary boundary helper 에 timeZone 파라미터 일반화 (기본 KST)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-058, REQ-009]
dependsOn: [T-0799]
independentStream: timezone-user-config
touchesFiles:
  - src/common/period-boundary.ts
  - src/common/period-boundary.spec.ts
estimatedDiff: 180
estimatedFiles: 2
created: 2026-07-06
plannerNote: "P5 Q-0050 slice(2) — ADR-0052 §Decision(c) 경계 helper 에 timeZone 파라미터 일반화(기본 Asia/Seoul), caller 무변경 backward-compat"
---

# T-0800 — period-boundary boundary helper 에 timeZone 파라미터 일반화 (기본 KST)

## Why

[ADR-0052](../decisions/ADR-0052-user-timezone-storage.md) 가 확정한 per-user timezone 지원의 구현 slice(2) 다. slice(1)(T-0799)이 `User.timezone` 컬럼을 저장했고, 본 slice 는 [ADR-0051](../decisions/ADR-0051-user-configurable-timezone.md) §Decision(b) 가 지정한 `Intl.DateTimeFormat(timeZone)` 메커니즘 위에서 `src/common/period-boundary.ts` 의 **경계 계산 helper 들이 `timeZone` 파라미터(기본값 `"Asia/Seoul"`)를 받도록 일반화**한다. ADR-0052 §Decision(c) 가 "helper 가 `timeZone` 파라미터(기본값 `Asia/Seoul`)를 받도록 일반화되고 R-9 해석·display 경로가 요청 User 의 timezone 을 그 인자로 전달한다" 로 명시한 지점이다. 새 dependency 0(`Intl` built-in). 후속 slice(3)(R-9 controller/display mapper 배선)이 본 파라미터에 요청 User.timezone 을 흘려보낸다.

## Required Reading

- `docs/decisions/ADR-0052-user-timezone-storage.md` — §Decision(b)(지배 범위) · §Decision(c)(helper 일반화 계약) · §Consequences(무효 tz 방어) · §Follow-ups.
- `docs/decisions/ADR-0051-user-configurable-timezone.md` — §Decision(b) `Intl.DateTimeFormat(timeZone)` 단일 메커니즘, hardcoded offset 금지.
- `docs/decisions/ADR-0039-kst-period-boundary.md` — §Decision1(IANA single source) · §Decision3(granularity/주 시작=월요일/반열림 [start,end)) · §Decision5(boundary 계산 1점 집중).
- `src/common/period-boundary.ts` — 현행 KST-hardcoded 구현(module-level `kstFormatter`, `toKstWallClock`, `kstOffsetMs`, `kstToUtc`, `startOfKstDay/Week/Month`, `getKstPeriodRange`, `getKstPeriodRangeByPeriod`).
- `src/common/period-boundary.spec.ts` (colocated spec — 본 task 가 확장) — 현행 273 라인 KST 케이스.

## Acceptance Criteria

- [ ] `src/common/period-boundary.ts` 의 **경계 계산 경로**를 `timeZone` 파라미터로 일반화. 구체:
  - [ ] 내부 helper(`toWallClock`/`offsetMs`/`toUtc` 계열)가 timezone 을 인자로 받거나, timezone 별 `Intl.DateTimeFormat` 을 module-level `Map` 캐시로 조회하도록 리팩터(매 호출 새 인스턴스 생성 금지 — ADR-0039 §Decision5 drift/비용 backbone 유지).
  - [ ] `startOfKstDay` / `startOfKstWeek` / `startOfKstMonth` / `getKstPeriodRange` / `getKstPeriodRangeByPeriod` 각각 마지막 인자로 optional `timeZone: string = KST_TIMEZONE` 를 받도록 확장. **기존 시그니처 호출부 무변경**(default 로 기존 caller 동작 100% 보존 — backward-compat).
  - [ ] hardcoded `+09:00` 산술 도입 금지 — 모든 경로가 `Intl.DateTimeFormat(timeZone)` 경유(ADR-0051 §Decision(b)).
- [ ] **Happy-path unit test**: 각 public 경계 함수에 대해 (i) 인자 미지정 시 기존 KST 결과 불변(기존 spec 케이스 유지), (ii) `timeZone` 명시(예: `"America/New_York"`, `"UTC"`) 시 해당 zone 기준 경계 산출 정확성 검증 test 1+.
  - [ ] 주 시작=월요일(ISO 8601) 계약이 non-KST zone 에서도 유지됨을 검증(예: 다른 zone 의 월요일 자정 산출).
  - [ ] 월 가변 길이(28~31)가 non-KST zone 에서도 `[start,end)` 반열림으로 정확한지 검증.
- [ ] **Error path unit test**: 무효 IANA 식별자(예: `"Not/AZone"`) 전달 시 `Intl.DateTimeFormat` throw 가 명시 error 로 전파/래핑되는지 검증(ADR-0052 §Consequences 무효 tz 방어) — 1+ test.
- [ ] **Flow / branch coverage**: granularity 분기(daily/weekly/monthly) · period 라벨 분기(day/week/month) · timezone 지정 vs 미지정(default) 분기 각각 1+ test.
- [ ] **Negative cases 충분 cover**: (a) Invalid Date 입력(TypeError) · (b) 미지원 granularity(RangeError) · (c) 미지원 period 라벨(RangeError) · (d) 무효 timezone 식별자 · (e) 경계값(월말/윤년 2월/연말 12→1월) — 각 1+ test.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 본 파일은 기존 99%+ 수준 유지).

## Out of Scope

- **display formatter 일반화 금지** — `formatKstDisplay` / `formatKstIso` / `kstOffsetLabel` / `parseKstPeriodInput` 의 timeZone 파라미터화는 본 task 에 넣지 않는다(cap 보호). slice(2b) follow-up 으로 분리.
- **caller(도메인/controller) 배선 금지** — `summary-due-coordinates` · `period-evaluable` · `assessment-evaluation.controller` 등 호출부에 timezone 전달 접점 추가는 slice(3)(R-9 controller/display mapper) 로 미룬다. 본 task 는 helper 내부 + colocated spec 2 파일만 touch.
- **User.timezone 조회/저장 경로 금지** — repository/service 에서 User.timezone 을 읽어오는 배선은 slice(3).
- **timezone 화이트리스트 검증 로직 금지** — 무효 tz 는 `Intl` throw 를 error 로 전파하는 수준까지만. 입력 검증(화이트리스트)은 timezone 설정 저장 경로 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (slice 2b) display formatter 계열(`formatKstDisplay`/`formatKstIso`/`kstOffsetLabel`/`parseKstPeriodInput`) 에 timeZone 파라미터 일반화(기본 KST) + R-112.
- (slice 3) R-9 사용자 지정 기간 controller + display mapper 가 요청 User.timezone 을 본 helper 인자로 배선(ADR-0052 §Decision(b)). User.timezone 조회 경로 포함.
- (설정 저장) timezone 설정 update 경로에서 무효 IANA 식별자 화이트리스트/try-catch 검증(ADR-0052 §Consequences).

---

## Result (DONE — 2026-07-06, cron@AKIHA-16075)

- **STATUS: DONE / MERGED** — PR #714 squash 9e324ca4, reviewer round1 APPROVE(0 BLOCKER/0 MAJOR), 4-게이트 PASS, CI green(PR run) + main CI in_progress.
- **변경**: `src/common/period-boundary.ts` 경계 helper 5종(`startOfKstDay`/`startOfKstWeek`/`startOfKstMonth`/`getKstPeriodRange`/`getKstPeriodRangeByPeriod`)에 optional `timeZone: string = "Asia/Seoul"` 파라미터 추가. 내부 helper(`toWallClock`/`offsetMs`/`wallClockToUtc`) timeZone 인자화 + `formatterCache` Map 도입(매 호출 새 `Intl.DateTimeFormat` 생성 금지 — ADR-0039 §Decision5). hardcoded `+09:00` 산술 도입 0(전 경로 `Intl.DateTimeFormat(timeZone)` 경유 — ADR-0051 §Decision(b)). 기존 호출부 무변경 backward-compat. +286/-47, 2파일(300 LOC cap 내).
- **test**: `src/common/period-boundary.spec.ts` 확장(non-KST zone happy/branch/error/negative describe 4종). 8950 pass. cov period-boundary.ts stmts 98.88%/branch 91.42%/funcs 100%/lines 98.83%(threshold line·func 80% 충족). lint+build green. smoke/e2e 는 DB 무관(helper 순수) — CI 검증.
- **Out of Scope 준수**: formatter/parse 경로는 KST 고정 유지. slice(3) R-9 controller/display mapper 배선은 별도 task.
- **fire 구조**: fineGrainedConcurrency ON — acquire-lock CAS → reclaim no-op → a2 gate(pr-mode 활성0 단독) → select-claim atomic → lock-free executor → PR/integrator merge → re-acquire → claim prune(claims.json=[]) → tombstone release. counters 791→792.
