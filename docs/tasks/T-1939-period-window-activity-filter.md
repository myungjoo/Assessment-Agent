---
id: T-1939
title: 기간 창 [since, until) Activity 필터 도메인 helper 신설 + period bridge ephemeral 소비처 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-004]
estimatedDiff: 265
estimatedFiles: 4
created: 2026-09-07
independentStream: p5-period-window-bound
dependsOn: []
touchesFiles:
  - src/assessment-collection/domain/period-window-filter.ts
  - src/assessment-collection/domain/period-window-filter.spec.ts
  - src/assessment-evaluation/period-bridge-ephemeral.service.ts
  - src/assessment-evaluation/period-bridge-ephemeral.service.spec.ts
plannerNote: "P5 REQ-004 잔여 1 축(기간 종료 경계) — 반열림 창 필터 helper + ephemeral bridge 소비처 동반 배선 (PLAN 98 행 R-9 arc)"
---

# T-1939 — 기간 창 `[since, until)` Activity 필터 도메인 helper 신설 + period bridge ephemeral 소비처 배선

## Why

[T-1938](T-1938-req004-summary-endpoint-doc-sync.md) 의 REQ-004 재판정(main `4373441a`)이 잔여 축을 **하나** 로 좁혔다 — `docs/requirements.md` `23 행` 의 "한계" 절이 `DONE` 승격을 막는 축으로 **기간 종료 경계 입력 부재** 만 남기고, 그 근거로 `src/assessment-collection/collection-spec.service.ts` `39~42 행` `buildCollectionSpec(person, since?)` 이 시작만 받아 **수집이 open-ended** 임을 지목한다. 실제로 `POST /api/assessment-evaluation/period` (PLAN `98 행` R-9 arc) 의 User 경로는 수집된 활동을 기간 상한 없이 그대로 평가에 넘긴다 — README `9 행` "사용자가 지정한 기간동안 어떠한 주요 활동" · `178 행` "조회 기간(일/주/월 + 시작 시점)" 계약과 어긋나, 지정 기간 **밖** 활동이 그 기간 평가문에 섞여 들어간다.

본 slice 는 그 축의 첫 단으로 **반열림 `[since, until)` 창으로 `Activity[]` 를 거르는 순수 도메인 helper** 를 신설하고, 같은 PR 에서 **소비처인 `PeriodBridgeEphemeralService` 에 배선** 한다 (CLAUDE.md `§ 3` 소비처 동반 의무 — helper 단독 PR 금지). 기간 경계 의미론은 이미 확정돼 있어 **새 결정 0** 이다 — 반열림 `[start, end)` 는 [ADR-0050](../decisions/ADR-0050-timezone-kst-period-boundary.md) 과 [`period-evaluable.ts`](../../src/assessment-evaluation/domain/period-evaluable.ts) `40~59 행` `computePeriodEnd` 가 이미 박제했고, in-memory `Activity[]` 를 평가 전에 순수 함수로 거르는 배치는 [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) `§Decision 2` 가 `filterActivitiesByAuthor` 로 이미 쓰는 패턴이다. 본 task 는 그 자리에 필터 하나를 더 합성할 뿐이라 **새 ADR 을 만들지 않는다**.

**issue-still-relevant pre-check (origin/main `f8a99bc7` 실측)**:

1. `git grep -rln "filterActivitiesByPeriod\|period-window\|periodWindow" origin/main -- src test docs` 히트 **0** — 동형 helper 가 main 에 없다 (재큐잉 아님).
2. `git grep -n "until" origin/main -- src/assessment-collection src/assessment-evaluation` 의 비-spec 히트 **0** — 수집·평가 어디에도 상한 경계 심볼이 없다.
3. 소비처 실측: `src/assessment-evaluation/period-bridge-ephemeral.service.ts` `104~123 행` 이 `buildCollectionSpec(person, period.since)` → `collectActivities(spec)` → `filterActivitiesByAuthor(...)` → `evaluateActivities(...)` 4 단을 compose 하며, `period` 인자 타입이 `{ since?: string }` 라 상한을 받을 자리조차 없다. 즉 미착수 구간.
4. 하한도 실효 강제가 아니다 — `src/assessment-collection/github-collection.service.ts` `88~89 행` 이 `since` 를 GitHub query 로 pass-through 만 하는데 issues/pulls 의 `since` 는 **updated-at 기준** 이라 기간 이전 생성 활동이 통과하고, `collection-spec.service.ts` 의 Confluence 쪽 `resolveConfluenceInstances` 에는 `since` 필드 자체가 없다 (`43~49 행` 주석). 따라서 in-memory 하한 필터도 실질 신규 강제다.
5. **오너 지시 게이트** — PLAN `157 행` R-91 k6 · `158 행` R-92 per-route perf-spec 는 **미접촉** (`test/perf/` · `package.json` · 워크플로 변경 0). `182 행` 소비처 동반 의무는 helper 와 그 호출 배선을 **같은 PR** 에 담아 정면 준수. `183 행` REQ 재판정 once-rule 은 본 task 가 **구현 slice** 라 재판정을 수행하지 않는다 (REQ-004 재판정은 상한 축 arc 가 닫힌 뒤 1 회 — `§Follow-ups`).

## Required Reading

- `src/assessment-collection/domain/author-filter.ts` **전체 (63 행)** — 신설 helper 의 **직접 형식 기준**: 파일 head 주석(규칙·책임 경계·가정) 밀도, 순수 함수 signature, 입력 미변형 + 순서 보존 서술, `Activity` import 방식.
- `src/assessment-collection/domain/activity.ts` `48~62 행` — `ActivityBase` 의 `timestamp: string` (ISO-8601, 필터 판정 기준값) 및 discriminated union 구조.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` `8~16 행` (흐름 4 단계 주석 — 본 task 가 5 단계로 재서술) · `39~46 행` (import 블록 — `filterActivitiesByAuthor` 를 `../assessment-collection/domain/author-filter` 로 가져오는 경로 관행) · `73~123 행` (`generateEphemeral` 의 JSDoc + 본문 4 단).
- `src/assessment-evaluation/period-bridge-ephemeral.service.spec.ts` `99~160 행` (happy-path + 호출 순서 describe) · `158~187 행` (`since` 지정/미지정 branch describe — 본 task 의 신규 it 이 붙을 자리) · `238~300 행` (negative describe 의 mock 조립 관행).
- `src/assessment-evaluation/domain/period-evaluable.ts` `40~59 행` — `computePeriodEnd` 의 반열림 `[start, end)` 서술. 본 helper 의 상한 exclusive 근거를 이 좌표로 인용한다 (재구현 금지 — 본 task 는 경계 **산출** 을 하지 않는다).
- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` `§Decision 2` 의 "`filterActivitiesByAuthor`(author 귀속 필터, 순수 함수)를 in-memory 로 적용한 뒤 그 `Activity[]` 를 `evaluateActivities` 에 넘긴다" 문단 — 본 배선이 기존 결정 안임을 확인하는 좌표.

## Acceptance Criteria

- [ ] `src/assessment-collection/domain/period-window-filter.ts` 를 신설한다 — `export interface ActivityPeriodWindow { since?: string; until?: string }` 와 `export function filterActivitiesByPeriodWindow(activities: Activity[], window: ActivityPeriodWindow): Activity[]`. NestJS `@Injectable` 0 / Prisma import 0 / 부수효과 0 / 동기 순수 함수 (`author-filter.ts` 패턴 mirror).
- [ ] 의미론을 아래 그대로 구현하고 각 항의 근거를 파일 head 주석에 남긴다 (구현자 임의 해석 금지):
  - (a) **반열림 `[since, until)`** — `since` 는 inclusive (`timestamp >= since`), `until` 은 exclusive (`timestamp < until`). ADR-0050 · `computePeriodEnd` 좌표 인용.
  - (b) 두 bound 가 모두 `undefined` 면 **무필터** — 입력 순서를 보존한 새 배열을 반환한다 (입력 배열 미변형).
  - (c) bound 문자열이 파싱 불가(`Number.isNaN(Date.parse(bound))`) 면 **`RangeError` throw** — silent Invalid Date 전파 금지 (`period-evaluable.ts` · `parseKstPeriodInput` 의 명시적 reject 관행 정합).
  - (d) **activity 의 `timestamp` 가 파싱 불가면 보존** 한다 — 판정 불가 활동을 임의 폐기하면 평가 누락이 되므로 과다 포함 쪽을 택한다. 이 선택의 근거 1~2 줄을 주석에 박제.
  - (e) `since > until` 이면 throw 하지 않고 **빈 배열** 을 반환한다 (비교 결과의 자연 산출).
- [ ] `src/assessment-collection/domain/period-window-filter.spec.ts` (colocated) 를 신설하고 R-112 를 충족한다:
  - happy-path 1+ — 창 안/밖이 섞인 `Activity[]` 에서 창 안 활동만 순서 보존해 남는다.
  - 분기별 1+ — `since` 만 지정 / `until` 만 지정 / 둘 다 지정 / 둘 다 미지정 각 1+.
  - 경계값 1+ — `timestamp === since` 는 **포함**, `timestamp === until` 은 **제외**.
  - error path 1+ — 파싱 불가 `since` · 파싱 불가 `until` 각각 `RangeError`.
  - negative 1+ (각 예외 분기마다) — 빈 입력 배열 → 빈 배열, 파싱 불가 `timestamp` 활동 보존, `since > until` → 빈 배열, 입력 배열 미변형(호출 후 원본 length·참조 동일), 동일 입력 2 회 호출 결정성.
- [ ] `src/assessment-evaluation/period-bridge-ephemeral.service.ts` 를 배선한다 — `generateEphemeral` 의 `period` 인자 타입을 `{ since?: string; until?: string }` 로 넓히고, `collectActivities` 직후 · `filterActivitiesByAuthor` **직전** 에 `filterActivitiesByPeriodWindow(activities, { since: period.since, until: period.until })` 를 적용한다. 파일 head 의 흐름 주석과 `generateEphemeral` JSDoc 을 4 단 → **5 단** 으로 갱신하고 `@param period` 서술에 상한 축을 추가한다.
- [ ] `src/assessment-evaluation/period-bridge-ephemeral.service.spec.ts` 에 R-112 항목을 추가한다 — (1) 창 밖 활동이 `evaluateActivities` 입력에서 제외되는 happy-path 1+, (2) `until` 미지정(현 controller 호출 형태) 시 하한만 적용되는 분기 1+, (3) `since` · `until` 둘 다 미지정 시 **기존 동작 회귀 0**(수집 전량이 author 필터로 그대로 전달) 1+, (4) 필터가 `RangeError` 를 던지면 swallow 없이 전파되는 error path 1+ (fail-fast 관행 유지).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`).
- [ ] 변경 파일이 frontmatter `touchesFiles` 의 **4 개뿐** 이고 diff ≤ 300 LOC (task 파일 status · journal · STATE 는 executor · driver bookkeeping 몫).
- [ ] 기존 e2e (`test/e2e/period-bridge-ephemeral.e2e-spec.ts`) 를 수정하지 않고도 green — 수정이 필요하다는 판단이 서면 그 사실을 `§Follow-ups` 에 적고 본 PR 에서 e2e 를 건드리지 않는다.

## Out of Scope

- **새 ADR 신설 · 기존 ADR 결정 내용 변경** — 본 slice 는 ADR-0037 `§Decision 2` · ADR-0050 반열림 안의 구현이다. 진행 중 결정 충돌을 발견하면 코드를 밀지 말고 BLOCKED 로 escalate (CLAUDE.md `§ 5`).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` 변경 — controller 가 `getKstPeriodRangeByPeriod(...).end` 로 상한을 **산출해 넘기는** 배선은 다음 slice (`§Follow-ups (a)`). 본 PR 은 상한을 **받을 자리** 와 필터만 만든다.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` (Admin full-persist 경로) 배선 — 동형 배선이지만 같은 PR 에 담으면 파일 6 개로 cap 초과 (`§Follow-ups (b)`).
- `src/assessment-collection/collection-spec.service.ts` · `github-collection.service.ts` 에 `until` query 축 추가 — GitHub REST 의 `until` 은 commits 만 지원하고 issues/pulls 는 미지원이라 별도 판단이 필요하다 (`§Follow-ups (c)`).
- `PeriodBridgeDto` 에 종료 경계 **입력 필드** 추가 — README `178 행` 계약이 "일/주/월 + 시작 시점" 이라 종료는 granularity 에서 **파생** 이다. 사용자 입력 필드 신설은 요구사항 근거가 없다.
- `docs/requirements.md` REQ-004 재판정 · `docs/architecture/*` doc-sync — PLAN `183 행` once-rule 상 arc 완결 후 1 회 (`§Follow-ups (d)`).
- e2e / smoke / perf spec 신설 (PLAN `158 행` R-92 신규 per-route perf-spec 금지 포함).
- `web/` 프런트 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)

- (a) controller `ephemeralForUser` 가 `getKstPeriodRangeByPeriod(period, parsed, tz).end` 로 상한을 산출해 `generateEphemeral` 에 전달하는 배선 slice (controller + controller spec 2 파일).
- (b) `PeriodBridgeAdminPersistService` 의 동형 창 필터 배선 slice.
- (c) 수집 layer 의 `until` query 축 (GitHub commits 만 지원 — issues/pulls 는 in-memory 필터 유지) 판단.
- (d) 상한 arc 완결 후 REQ-004 재판정 1 회 + `docs/architecture/modules.md` helper 인덱스 등록.
