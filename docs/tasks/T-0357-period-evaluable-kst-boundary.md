---
id: T-0357
title: ADR-0039 KST impl chain 2/5 — period-evaluable 의 boundary 산술을 period-boundary helper 경유로 refactor
phase: P5
status: DONE
completedAt: 2026-06-12T17:49:32Z
prNumber: 289
mergedAs: 30486c3
reviewRounds: 1
commitMode: pr
coversReq: [REQ-034, REQ-035]
estimatedDiff: 210
estimatedFiles: 3
independentStream: adr-0039-kst-impl
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/period-evaluable.ts
  - src/assessment-evaluation/domain/period-evaluable.spec.ts
  - src/assessment-evaluation/summary-aggregate-orchestrator.service.spec.ts
created: 2026-06-13
plannerNote: "ADR-0039 KST chain 2/5 — 실코드 확인 결과 boundary 산술 보유처는 SinceDerivation 아닌 period-evaluable (R-112 backbone × 1.5 ≈ 210 LOC·3파일); T-0355 교집합 0"
---

# T-0357 — ADR-0039 KST impl chain 2/5: `period-evaluable` 가 `period-boundary` helper 경유

## Why

[ADR-0039](../decisions/ADR-0039-timezone-kst-boundary-policy.md) §Status impl chain 2번째. ADR §Status 는 chain 2 를 "SinceDerivation refactor" 로 예상했으나, **실코드 확인 결과 `SinceDerivationService` 는 boundary 산술이 0** (직전 Assessment 의 `periodStart` 를 `.toISOString()` 으로 echo 만 — `new Date` 경계 계산 / hardcoded offset 없음) 이라 helper 경유 refactor 대상이 아니다. [ADR-0035 §Decision3](../decisions/ADR-0035-aggregate-summary-evaluation.md) 이 timezone 일관 적용 지점으로 박제한 다른 한 곳 — **`isPeriodEvaluable` 의 자정/주/월 경계** (`src/assessment-evaluation/domain/period-evaluable.ts` 의 `computePeriodEnd`) 가 실제 UTC 달력 산술을 보유하므로 이것이 자연스러운 chain 2/5 다.

특히 `computePeriodEnd` 의 `setUTCMonth(+1)` 는 KST 월초 boundary 입력에서 **실결함**이다: KST 월초 = 직전 UTC 월의 말일 15:00Z (예: `2026-06-01T00:00+09:00` = `2026-05-31T15:00:00Z`) 이라 +1 UTC month 가 "6월 31일" day overflow → JS 정규화로 `2026-07-01T15:00:00Z` (= KST 7월 2일 자정) 을 반환. 올바른 KST 월간 end 는 `2026-06-30T15:00:00Z` (= KST 7월 1일 자정). helper `getKstPeriodRange` 경유가 이 drift 를 구조적으로 차단한다 (ADR-0039 §Decision5 — boundary 계산 중복 금지).

## Required Reading

- `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` — §Decision3 (a)~(c) 일/주/월 boundary 정의 + 반열림 `[start, end)`, §Decision5 (helper 1 점 집중 경유 의무)
- `src/common/period-boundary.ts` — T-0356 helper API (`PeriodGranularity = "daily"|"weekly"|"monthly"`, `getKstPeriodRange(g, instant): PeriodRange` — instant 가 속한 KST period 의 `{start, end}`)
- `src/assessment-evaluation/domain/period-evaluable.ts` — 수정 대상 (`computePeriodEnd` / `isPeriodEvaluable` / `isValidPeriod`)
- `src/assessment-evaluation/domain/period-evaluable.spec.ts` — colocated spec (기존 UTC 산술 전제 fixture 의 KST 정합 갱신 대상)
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` — 호출 계약 확인용 (read-only, 수정 금지 — spec 은 fixture 가 boundary 의미에 의존할 경우에만 최소 조정)

## 구현 가이드

- **granularity 매핑** — domain 의 `VALID_PERIODS = ["day","week","month"]` (ADR-0006 enum-as-String, DB 저장값 — **변경 금지**) 와 helper 의 `["daily","weekly","monthly"]` 가 다르다. `period-evaluable.ts` 안에 매핑 상수 (`day → daily` 등) 를 두고 helper 를 호출한다. helper 쪽 변경 금지.
- **`computePeriodEnd(period, periodStart)` 의 새 의미** — `getKstPeriodRange(매핑(period), periodStart).end` 위임. 즉 "periodStart 가 **속한** KST period 의 end". KST boundary 로 정규화된 입력 (계약상 정상 경로) 에는 기존 +1 granularity 와 동치이고, 비정규 입력은 ADR-0039 §Decision3 boundary 로 snap 된다 (week 는 KST 월요일 anchor — 기존 "임의 요일 +7일" 의미는 ADR 위반이라 폐기). 이 의미 변화를 파일 상단 주석의 timezone 단락 (현재 "Q-0026 의존" deferred 서술) 을 ADR-0039 확정 서술로 갱신하며 함께 박제.
- **공개 signature 불변** — `isValidPeriod` / `computePeriodEnd` / `isPeriodEvaluable` 의 이름·인자·반환 type 유지. 호출처 (`summary-aggregate-orchestrator.service.ts`) 코드 변경 0.
- **새 dependency 0** — helper 가 이미 Node 내장 Intl 만 사용. `package.json` 변경 금지.

## Acceptance Criteria

- [ ] `computePeriodEnd` 가 `src/common/period-boundary.ts` 의 `getKstPeriodRange` 를 경유한다 — 자체 `setUTCDate`/`setUTCMonth` 달력 산술 제거 (inspect: `period-evaluable.ts` 에 helper import 존재 + UTC 산술 부재).
- [ ] **월말 overflow regression test**: `computePeriodEnd("month", new Date("2026-05-31T15:00:00.000Z"))` === `2026-06-30T15:00:00.000Z` (KST 6월 구간 — 기존 코드가 7월 1일 15:00Z 를 반환하던 결함이 재발하면 fail).
- [ ] happy-path test 1+ — day/week/month 각각 KST boundary 입력 (예: day = `T15:00:00Z` 자정 경계) 에 대해 §Decision3 (a)~(c) 의 end 산출 + `isPeriodEvaluable` 의 `now ≥ end` 경계값 (now == end 에서 true) 검증.
- [ ] error path test 1+ — 알 수 없는 period throw 전파 (기존 동작 유지) + Invalid Date 입력 시 helper 의 명시적 error 전파.
- [ ] 분기 cover — granularity 3 종 매핑 분기 각 1+ test, 비정규 (non-boundary) periodStart 의 snap 의미 1+ test (예: KST 수요일 instant 의 week → 다음 KST 월요일 자정이 end).
- [ ] negative cases 충분 cover — 빈 문자열 period / type mismatch / `now < end` 미평가 경로 / UTC 자정 (KST 09:00, 비-boundary) 입력 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) + `pnpm lint && pnpm build` green.

## Out of Scope

- `SinceDerivationService` 변경 — boundary 산술이 없어 helper 경유 대상 아님. 1주 재수집 window (Q-0026 잔여) 는 ADR-0039 도 Out of scope 로 박제 (ADR-0029/0035 후속 책임).
- chain 3/5 — `PeriodBridge` (ADR-0037) 의 helper 경유 refactor (periodStart 를 KST boundary 로 정규화해 생산하는 쪽).
- chain 4/5 — R-9 사용자 지정 기간 DTO parsing (`parseKstPeriodInput` 소비).
- chain 5/5 — view-layer formatter (조회 endpoint 응답 / P6 Web UI 표시).
- `src/common/period-boundary.ts` (helper 자체) 변경 — 매핑은 period-evaluable 쪽에 둔다.
- `VALID_PERIODS` 값 rename / `summary-aggregate-orchestrator.service.ts` 코드 변경.
- T-0355 보류 파일들 (ci.yml / web/ / directory.md / check-spec-presence / package.json) — touchesFiles 교집합 0 유지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (reviewer MINOR) `summary-aggregate-orchestrator.service.ts` L90 부근 jsdoc error 계약 서술에 Invalid Date periodStart 의 helper TypeError 전파 미언급 — chain 3/5 (PeriodBridge 배선) task 에서 jsdoc 한 줄 동기.
- (executor, local 한정) `pnpm test` 가 `.claude/worktrees/*` 잔존 worktree 의 repo 사본 spec 까지 수집해 suite 중복 inflate — jest roots/ignore 패턴 검토 후보 (CI 무영향, T-0354 executor 도 동일 관찰).

## Result

DONE (2026-06-12 17:49Z) — PR #289 squash `30486c3`, reviewer round 1/7 APPROVE (blockers 0 / major 0 / minor 1 — Out-of-Scope jsdoc, chain 3/5 위임). 3파일 +218/-112. computePeriodEnd 의 setUTCMonth 월말 overflow 실결함 fix + regression 박제 (month, 2026-05-31T15:00Z → 06-30, not-07-01 이중 단언). 의미 변화 3건 (UTC→KST fixture / week 월요일 anchor / Invalid Date TypeError 전파) reviewer 가 ADR-0039 정합 + production 파급 0 실증. run 27432466745 approval-gate rerun 후 전 step green. period-evaluable.ts 100% coverage.
