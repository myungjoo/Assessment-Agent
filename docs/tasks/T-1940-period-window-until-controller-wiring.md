---
id: T-1940
title: User ephemeral 경로에 기간 상한(until) 산출 배선 — controller 가 반열림 창 종료 경계를 bridge 에 전달
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-004]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-period-window-bound
dependsOn: [T-1939]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: "P5 REQ-004 상한 축 2 단 — T-1939 §Follow-ups (a) 지정 후속. controller 가 period end 를 산출해 until 로 전달 (PLAN 98 행 R-9 arc)"
---

# T-1940 — User ephemeral 경로에 기간 상한(`until`) 산출 배선

## Why

[T-1939](T-1939-period-window-activity-filter.md) (main `a09699a1`) 가 반열림 `[since, until)` 창 필터 helper `filterActivitiesByPeriodWindow` 를 신설하고 `PeriodBridgeEphemeralService` 에 배선했으나, **상한을 산출해 넘기는 호출처가 아직 없다** — 유일한 production 호출처인 controller 가 `{ since: sinceBoundary.toISOString() }` 만 전달하므로 `until` 은 언제나 `undefined` 고, 창 필터의 상한 분기는 production 경로에서 한 번도 실행되지 않는다 (helper 는 사실상 하한 전용). 본 slice 는 그 마지막 한 칸을 채워 README `9 행` "사용자가 지정한 기간동안 어떠한 주요 활동" · `178 행` "조회 기간(일/주/월 + 시작 시점)" 계약을 User ephemeral 경로에서 **실효 강제** 로 만든다. 이는 T-1939 `§Follow-ups (a)` 가 파일 · 배선 단위로 지정한 후속이며 (CLAUDE.md `§ 3` 소비처 동반 의무의 지정 잔여분), PLAN `98 행` R-9 (임의 기간 평가문 요청) arc 안이다.

**새 결정 0** — 상한 산출은 이미 controller 안에 있는 single source `getKstPeriodRangeByPeriod(period, parseKstPeriodInput(periodStart, tz), tz)` 의 `.end` 를 읽는 것이 전부다 (ADR-0039 `§Decision 5` boundary 계산 helper 1 점 집중 — 새 산술 박제 금지). 반열림 상한 의미론은 [ADR-0050](../decisions/ADR-0050-timezone-kst-period-boundary.md) 과 `src/assessment-evaluation/domain/period-evaluable.ts` `40~59 행` `computePeriodEnd` 가 이미 확정했다. 따라서 **새 ADR 을 만들지 않는다**.

**issue-still-relevant pre-check (origin/main `3ce75171` 실측)**:

1. `git grep -n "filterActivitiesByPeriodWindow" origin/main -- src` — 히트는 `src/assessment-collection/domain/period-window-filter.{ts,spec.ts}` 와 `src/assessment-evaluation/period-bridge-ephemeral.service.{ts,spec.ts}` 뿐이고 **controller 는 0 건**. 즉 상한 배선은 미착수.
2. `git show origin/main:src/assessment-evaluation/assessment-evaluation.controller.ts` `526~535 행` 실측 — `this.ephemeralBridge.generateEphemeral({ serviceIdentities }, { since: sinceBoundary.toISOString() }, { modelId: undefined })` 로 **`until` key 자체가 없다**. bridge 쪽 signature 는 이미 `period: { since?: string; until?: string }` 로 넓혀져 있어 (T-1939 머지분) 호출처만 채우면 된다 — 타입 변경 0.
3. `git grep -n "normalizeKstPeriodStart" origin/main -- src` — 정의 `354 행` · 호출 2 곳 (`522 행` User ephemeral / `566 행` Admin persist). 상한을 반환하는 sibling 은 **없다** (`normalizeKstPeriodRange` 히트 0) — 신설 대상.
4. `git show origin/main:src/assessment-evaluation/assessment-evaluation.controller.spec.ts | grep -c "since:"` = **10** — 그중 exact-object 위임 단언은 `1276` · `1394` · `1441` · `2075 행` 4 곳이며 전부 `{ since: "2026-05-31T15:00:00.000Z" }` 형태라 `until` 추가 시 함께 갱신해야 한다 (나머지 6 곳은 `mock.calls[0][1]` 의 `since` 필드만 읽으므로 무변경).
5. **오너 지시 게이트** — PLAN `157 행` R-91 k6 (자격증명 게이트) 는 **미접촉** (`test/perf/` · `package.json` · 워크플로 변경 0). `158 행` R-92 신규 per-route perf-spec 금지도 **미접촉** (perf spec 신설 0). `183 행` REQ 재판정 once-rule 은 본 task 가 **구현 slice** 라 재판정을 수행하지 않는다 (REQ-004 재판정은 상한 arc 가 닫힌 뒤 1 회 — `§Follow-ups`). `182 행` 소비처 동반 의무는 본 task 자체가 그 잔여 소비처 배선이라 정면 준수.

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` `329~365 행` — `normalizeKstPeriodStart` 의 head 주석 (ADR-0039 `§Decision 3/5` 근거 · T-0802 timeZone 파라미터 서술) 과 본문. 본 task 의 신규 sibling 이 이 주석 밀도 · signature 관행을 mirror 한다.
- 같은 파일 `471~536 행` — `ephemeralForUser` 전체 (reevaluate fail-closed → self-only → person resolve → timezone 해석 → `sinceBoundary` snap → `generateEphemeral` 위임 순서). 상한 산출을 끼울 지점과 **차단 우선순위 불변** 조건을 여기서 확인한다.
- 같은 파일 `560~575 행` — `persistForAdmin` 의 `periodStartBoundary = this.normalizeKstPeriodStart(...)` 호출. 본 task 가 **건드리지 않아야 하는** 두 번째 호출처 (회귀 0 기준점).
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` `73~110 행` — `generateEphemeral` 의 JSDoc `@param period` (`since` inclusive 하한 / `until` exclusive 상한, 파싱 불가 값은 `RangeError`) 와 5 단 흐름. 본 배선이 그 계약을 그대로 만족함을 확인하는 좌표.
- `src/common/period-boundary.ts` 의 `getKstPeriodRangeByPeriod` signature 와 반환 `{ start, end }` 의 반열림 서술 — `.end` 가 **exclusive 상한** 임을 인용 근거로 삼는다 (재구현 금지).
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` `575~588 행` (`makePeriodDto` fixture — 기본 `period: "week"`, `periodStart: "2026-06-01T00:00:00.000Z"`) · `1252~1285 행` (happy-path 위임 단언 — 신규 `until` 단언이 붙을 자리) · `1770~1800 행` · `1900~1960 행` (`mock.calls[0][1]` 로 `since` 를 읽는 timezone / 분기 test 관행) · `2060~2080 행` (exact-object 단언 4 번째 지점).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/assessment-evaluation.controller.ts` 에 private 메서드 `normalizeKstPeriodRange(period: string, periodStart: string, timeZone: string = KST_TIMEZONE): { start: Date; end: Date }` 를 신설한다 — 본문은 `getKstPeriodRangeByPeriod(period, parseKstPeriodInput(periodStart, timeZone), timeZone)` **단 1 회 호출** 의 결과를 그대로 반환한다 (경계 산술 재구현 0, 이중 parse 0).
- [ ] 기존 `normalizeKstPeriodStart` 는 **삭제하지 않고** 신규 메서드에 위임하는 얇은 wrapper 로 바꾼다 (`return this.normalizeKstPeriodRange(...).start`). `persistForAdmin` (`566 행`) 의 호출부는 **무변경** — Admin full-persist 경로 동작 회귀 0.
- [ ] `ephemeralForUser` 가 `normalizeKstPeriodRange` 로 `{ start, end }` 를 얻어 `generateEphemeral` 에 `{ since: start.toISOString(), until: end.toISOString() }` 를 전달한다. 위임 **이전** 의 차단 순서 (reevaluate 403 → self-only 403 → person resolve 404 → timezone 해석) 는 불변이며, 경계 산출은 그 검사들 **이후** 에만 도달한다.
- [ ] 주석을 갱신한다 — 신규 메서드 head 에 (a) `.end` 가 반열림 exclusive 상한이라는 근거 좌표 (ADR-0050 · `period-evaluable.ts` `40~59 행`), (b) single source 재사용 근거 (ADR-0039 `§Decision 5`), (c) `until` 이 in-memory 창 필터의 상한으로 흐른다는 소비 경로 1~2 줄을 박제한다. `ephemeralForUser` 의 위임 직전 주석도 "since 만 전달" → "반열림 창 두 bound 전달" 로 갱신한다.
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 의 기존 exact-object 위임 단언 4 곳 (`1276` · `1394` · `1441` · `2075 행` 좌표) 에 `until` 을 추가해 green 을 회복한다 — 기본 fixture (`week` / `2026-06-01T00:00:00.000Z` / KST) 의 기대값은 `{ since: "2026-05-31T15:00:00.000Z", until: "2026-06-07T15:00:00.000Z" }` (KST 2026-06-01 월 00:00 시작 + 7 일).
- [ ] R-112 를 충족하는 신규 test 를 같은 spec 에 추가한다:
  - happy-path 1+ — `until` 이 `getKstPeriodRangeByPeriod(dto.period, ...).end` 의 ISO 값과 정확히 일치하고, `since < until` 이다.
  - 분기별 1+ — `period` 가 `day` / `week` / `month` 각각에서 `until` 이 해당 granularity 의 반열림 상한 (다음 일/주/월 시작 instant) 으로 산출된다.
  - 분기 1+ — 비-KST timezone User (`userService.findById` 가 다른 IANA zone 반환, T-0802 경로) 에서 `since` 와 `until` **둘 다** 그 zone 기준 경계로 산출된다.
  - error path 1+ — 알 수 없는 `period` (예 `"year"`) 는 `RangeError` 로 reject 되고 `generateEphemeral` 미호출 (기존 `1662 행` 관행 유지); 파싱 불가 `periodStart` 도 helper error 가 swallow 없이 전파된다.
  - negative — 예외 분기마다 1+: (i) `reevaluate === true` 403 시 경계 산출 · 위임 미도달, (ii) self != personId 403 시 미도달, (iii) principal sub `undefined` 403 시 미도달, (iv) person 미존재 404 전파 시 위임 미호출, (v) **Admin 분기 회귀 0** — `persistForAdmin` 위임 인자에 `until` 이 추가되지 않고 기존 형태 그대로다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`).
- [ ] 변경 파일이 frontmatter `touchesFiles` 의 **2 개뿐** 이다 (task 파일 status · journal · STATE 는 executor · driver bookkeeping 몫).
- [ ] 기존 e2e (`test/e2e/period-bridge-ephemeral.e2e-spec.ts`) 와 smoke (`test/smoke/period-bridge-live.smoke-spec.ts`) 를 **수정하지 않고** green — 수정이 필요하다는 판단이 서면 코드를 밀지 말고 그 사실을 `§Follow-ups` 에 적고 본 PR 에서는 건드리지 않는다.

## Out of Scope

- **새 ADR 신설 · 기존 ADR 결정 내용 변경** — 본 slice 는 ADR-0039 `§Decision 5` · ADR-0050 안의 배선이다. 진행 중 결정 충돌을 발견하면 코드를 밀지 말고 BLOCKED 로 escalate (CLAUDE.md `§ 5`).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` 및 `persistForAdmin` 배선 — Admin full-persist 경로의 동형 창 필터는 T-1939 `§Follow-ups (b)` 의 별도 slice다. 본 PR 은 User ephemeral 경로만 닫는다.
- `src/assessment-collection/collection-spec.service.ts` · `github-collection.service.ts` 에 `until` query 축 추가 (T-1939 `§Follow-ups (c)`) — GitHub REST 의 `until` 은 commits 만 지원해 별도 판단이 필요하다.
- `PeriodBridgeDto` 에 종료 경계 **입력 필드** 추가 — README `178 행` 계약이 "일/주/월 + 시작 시점" 이라 종료는 granularity 에서 **파생** 이다. 사용자 입력 필드 신설은 요구사항 근거가 없다.
- `src/assessment-collection/domain/period-window-filter.ts` 및 그 spec 수정 — helper 는 T-1939 에서 확정됐고 본 task 는 **호출처만** 채운다.
- `docs/requirements.md` REQ-004 재판정 · `docs/architecture/*` doc-sync — PLAN `183 행` once-rule 상 상한 arc 완결 후 1 회 (`§Follow-ups`).
- e2e / smoke / perf spec 신설 · 수정 (PLAN `158 행` R-92 신규 per-route perf-spec 금지 포함).
- `web/` 프런트 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)

- (b') T-1939 `§Follow-ups (b)` 승계 — `PeriodBridgeAdminPersistService` 의 동형 창 필터 배선 + Admin controller 상한 전달 slice.
- (c') T-1939 `§Follow-ups (c)` 승계 — 수집 layer `until` query 축 (GitHub commits 만 지원) 판단.
- (d') 상한 arc 완결 후 REQ-004 재판정 1 회 + `docs/architecture/modules.md` 에 `period-window-filter` helper 인덱스 등록.
