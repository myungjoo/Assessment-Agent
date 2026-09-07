---
id: T-1942
title: Admin full-persist 경로 controller 에 반열림 상한(until) 전달 배선 — persistForAdmin 이 창 필터 상한을 실효화
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-004]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-period-window-bound
dependsOn: [T-1941]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: "P5 REQ-004 상한 축 4 단(arc 종단) — T-1941 §Follow-ups (a) 지정 소비처 slice, §3 cap 예외 잔여 상환 (PLAN 98 행 R-9 arc)"
---

# T-1942 — Admin full-persist 경로 controller 에 반열림 상한(until) 전달 배선

## Why

[T-1941](T-1941-admin-persist-period-window-filter.md) (main `bc6285e2`) 이 `PeriodBridgeAdminPersistService.generateAndPersist` 안에 반열림 `[since, until)` 창 필터를 끼웠지만, **그 상한을 채워 주는 호출부가 없다** — controller 의 `persistForAdmin` 은 여전히 `{ since }` 만 넘기므로 Admin 경로에서 `until` 은 항상 `undefined` 고 창 필터의 상한 분기는 production 에서 한 번도 실행되지 않는다. 즉 T-1941 의 배선은 현재 **하한만 실효**다. 본 slice 가 그 마지막 한 칸을 채워 README `9 행` "사용자가 지정한 기간동안 어떠한 주요 활동" · `178 행` "조회 기간(일/주/월 + 시작 시점)" 계약을 User·Admin 두 경로에서 대칭으로 완성한다.

본 task 는 T-1941 이 cap (≤ 300 LOC / ≤ 5 파일) 초과를 근거로 `§Follow-ups (a)` 에 **파일 · 배선 단위로 명시해 분리한 소비처 slice** 이며, CLAUDE.md `§ 3` 소비처 동반 의무의 잔여분 상환이다. PLAN `98 행` R-9 (임의 기간 평가문 요청) arc 안이다.

**새 결정 0** — 경계 쌍 산출은 T-1940 이 신설한 single-source helper `normalizeKstPeriodRange` (ADR-0039 `§Decision5`) 가, 반열림 의미론은 [ADR-0050](../decisions/ADR-0050-timezone-kst-period-boundary.md) 과 `period-window-filter.ts` head 주석이 이미 확정했다. 본 task 는 **이미 있는 helper 의 `.end` 를 두 번째 호출부에 끼우는 것** 이 전부다 (새 산술 · 새 판정 규칙 0). 따라서 **새 ADR 을 만들지 않는다**.

**issue-still-relevant pre-check (origin/main `765db988` 실측)**:

1. `git show origin/main:src/assessment-evaluation/assessment-evaluation.controller.ts` `626~632 행` — 위임이 `generateAndPersist({...}, { since: periodStartBoundary.toISOString() }, ...)` 로 **`until` key 자체가 없다**. `605 행` 은 아직 하한 전용 wrapper `normalizeKstPeriodStart` 를 부른다 → 미착수 확인.
2. 대조군 `ephemeralForUser` `557~575 행` 은 `const { start: sinceBoundary, end: untilBoundary } = this.normalizeKstPeriodRange(...)` 로 이미 두 bound 를 받아 `{ since, until }` 을 넘긴다 (T-1940 배선) — 본 task 가 mirror 할 정확한 형태이자, helper signature 재확인 불요의 근거.
3. `git show origin/main:src/assessment-evaluation/period-bridge-admin-persist.service.ts` — T-1941 이 넣은 `filterActivitiesByPeriodWindow(activities, { since: period.since, until: period.until })` 가 이미 존재하고 signature 가 `{ since?: string; until?: string }` 이라 **service 측 변경 0**. 소비처만 채우면 상한이 즉시 실효된다.
4. `assessment-evaluation.controller.spec.ts` 실측 — `adminSpy` 의 기간 인자를 **exact-object** 로 단언하는 지점은 `1641 행` (happy — Admin persist) · `2275 행` (happy — reeval dispatch) **2 곳뿐**이고, `1595~1596 행` 은 "until 이 붙지 않음" 을 `toEqual` + `Object.keys` 로 못박은 **의도적 회귀 기준점** (T-1940 이 남긴 negative (v)) 이라 본 slice 에서 **반전 대상**이다. 반면 `1797` · `1923` · `2135 행` 의 `snapAdmin` 계열 helper 는 `(...as { since: string }).since` 로 **하한만 읽어** `until` 추가에 영향받지 않는다 (T-1940 때 관측된 "갱신 대상 과대 산정" 재발 방지 — 갱신은 3 곳뿐).
5. **dead helper 동반 제거 근거** — `normalizeKstPeriodStart` 의 호출처는 `605 행` **단 하나**다 (`git grep` 결과 나머지는 전부 주석). 본 slice 가 그 호출을 `normalizeKstPeriodRange` 로 바꾸면 소비처 0 인 private 메서드가 남으므로 같은 PR 에서 제거한다 — CLAUDE.md `§ 3` 소비처 동반 의무의 역방향 (소비처 0 helper 잔존 금지) 이며 별도 slice 로 미루면 dead code 가 main 에 머문다.
6. **소비처 동반 의무 (CLAUDE.md `§ 3`) 판정 — 본 task 는 예외 없이 정면 준수**다. 변경 대상이 최종 소비처 (HTTP controller) 자체라 아래로 더 내려갈 배선이 없고, 위로도 DTO 입력 축 추가가 없다 (종료 경계는 granularity 파생). 따라서 cap 예외 주장 0 · 분리 Follow-up 0 이며, 오히려 T-1941 의 예외 잔여를 상환하는 쪽이다. 예상 2 파일 · 260 LOC 로 cap 안이다.
7. **오너 지시 게이트** — PLAN `157 행` R-91 k6 미접촉 (`test/load/` · `package.json` · 워크플로 변경 0). `158 행` R-92 신규 per-route perf-spec 금지 미접촉 (perf spec 신설 0). `183 행` REQ 재판정 once-rule — 본 task 는 **구현 slice** 라 `docs/requirements.md` 를 건드리지 않는다 (REQ-004 재판정은 arc 종단 직후 1 회, `§Follow-ups (b)`).

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` `550~575 행` (`ephemeralForUser` 의 `normalizeKstPeriodRange` 구조분해 + `{ since, until }` 위임 + 그 앞 주석 6 줄). 본 task 가 **그대로 mirror 할 원본** — 주석 문구 관행 · 구조분해 형태 · 인자 shape 를 여기서 가져온다.
- 같은 파일 `329~366 행` (`normalizeKstPeriodStart` JSDoc + 본문 — **제거 대상**, 문서 가치가 있는 서술은 아래 range helper 주석으로 흡수) · `368~400 행` (`normalizeKstPeriodRange` JSDoc + signature, 특히 `379 행` "(b) single source 재사용 — 하한만 필요한 호출부도 본 helper 경유" 와 `384 행` "창 필터의 상한으로" 서술 — 제거 후 문구 정합을 맞춰야 하는 좌표) · `492 행` (`normalizeKstPeriodStart` 를 이름으로 언급하는 주석 — 갱신 대상).
- 같은 파일 `577~648 행` (`persistForAdmin` 전체 — `579 행` 메서드 head 주석 / `605~609 행` snap 호출 / `613~620 행` context 4-tuple 조립 / `622~632 행` 위임 주석 + 호출). 변경 지점 전부가 이 구간과 위 두 구간 안이다.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `130~160 행` (T-1941 이 넣은 창 필터 단계 + `period: { since?, until? }` signature). **소비처가 채워야 할 계약** 확인용이며 본 task 는 이 파일을 수정하지 않는다.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` `1420~1470 행` (T-1940 describe head — 재사용할 `WEEK_SINCE` / `WEEK_UNTIL` 상수와 `periodArg` helper, granularity 별 상한 `it.each` 표) · `1582~1597 행` (**반전 대상** negative (v)) · `1630~1650 행` · `2265~2285 행` (갱신 대상 exact-object 단언 2 곳) · `1789~1800 행` · `1912~1930 행` (`snapAdmin` helper — `.since` 만 읽어 **무변경** 인 근거).

## Acceptance Criteria

- [ ] `persistForAdmin` 이 `normalizeKstPeriodStart` 대신 `normalizeKstPeriodRange(dto.period, dto.periodStart, timeZone)` 를 1 회 호출해 `{ start, end }` 를 구조분해하고, `generateAndPersist` 의 기간 인자를 `{ since: start.toISOString(), until: end.toISOString() }` 로 넓힌다. `ephemeralForUser` `557~575 행` 과 **같은 형태**여야 한다 (두 분기 대칭).
- [ ] `context.periodStart` (4-tuple 좌표) 는 같은 range 호출의 `.start` 를 그대로 쓴다 — **좌표와 `since` 가 단일 산출에서 나온 짝**이며 helper 를 두 번 부르지 않는다 (ADR-0039 `§Decision5` 중복 산술 0). 영속 idempotency 좌표는 **불변**이어야 한다 (기존 `periodStart` 기대값 변경 0).
- [ ] 소비처가 0 이 된 private 메서드 `normalizeKstPeriodStart` (`329~366 행`) 를 같은 PR 에서 제거하고, 그 JSDoc 중 살아 있는 서술 (offset 미명시 입력의 zone 해석 · 알 수 없는 period reject) 은 `normalizeKstPeriodRange` 주석으로 흡수한다. `379 행` "(b) 하한만 필요한 호출부" · `492 행` 의 이름 언급 주석도 현재 사실에 맞게 갱신한다. `pnpm build` 로 잔존 참조 0 확인.
- [ ] `persistForAdmin` 의 위임 주석을 갱신한다 — (a) 반열림 `[since, until)` 두 bound 를 함께 넘긴다는 사실과 근거 좌표 (ADR-0050 · ADR-0039 `§Decision5`), (b) `until` 은 exclusive 라 그 instant 자체는 제외된다는 점, (c) **Admin 경로는 결과가 영속화되므로 상한 미전달 시 기간 밖 활동이 DB 에 남는다**는 ephemeral 과의 차이 1 줄.
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` `1582~1597 행` 의 negative (v) (`"Admin 분기 위임 인자에는 until 이 추가되지 않는다"`) 를 **상한 전달 단언으로 반전**한다 — `toEqual({ since: WEEK_SINCE, until: WEEK_UNTIL })` + `Object.keys(...)` 가 `["since", "until"]` 임을 못박아 이후 회귀를 감지한다. it 문구와 앞 주석도 새 계약에 맞게 고친다 (stale "회귀 0" 서술 잔존 금지).
- [ ] exact-object 단언 2 곳 (`1641 행` happy — Admin persist, `2275 행` happy — reeval dispatch) 에 `until: "2026-06-07T15:00:00.000Z"` 를 더한다. `snapAdmin` 계열 (`1797` · `1923` · `2135 행`) 은 **건드리지 않는다** (하한만 읽으므로 무변경이 정답 — 수정이 필요하다고 느껴지면 원인을 먼저 보고한다).
- [ ] R-112 를 충족하는 신규 describe (`AssessmentEvaluationController.persistForAdmin (unit — 반열림 창 상한 until 배선, T-1942)`) 를 추가한다. cap 유지를 위해 **it 은 6 개 이하**로 묶되 아래 축을 모두 cover 한다:
  - happy 1+ — Admin 위임의 `until` 이 `getKstPeriodRangeByPeriod(...).end` 의 ISO 와 **정확히 일치**하고 `since < until` 이다 (helper 재계산 대조 — 경계 산술 재구현 0 을 test 로 박제). T-1940 describe 의 happy (`1435 행` 계열) 를 Admin spy 로 mirror 한다.
  - 분기 1+ — `day` / `week` / `month` 각 granularity 의 상한이 "다음 일/주/월 시작 instant" 로 갈린다 (`it.each` 재사용, 하한은 셋 다 수렴).
  - 분기 1+ — 비-KST timezone 요청 주체 (Admin `sub` 의 `User.timezone`) 에서 `until` 도 그 zone 기준 경계로 산출된다 — **입력 해석 zone 은 target person 이 아니라 요청 주체** 라는 기존 계약 (`2128~2141 행`) 이 상한에도 동일 적용됨을 단언한다.
  - error path 1+ — 알 수 없는 period (`"year"`) / Invalid Date 입력에서 helper 가 reject 하고 `generateAndPersist` 가 **미호출** 이다 (fail-fast, persist 미도달).
  - negative — 예외 분기마다 1+: (i) `context.periodStart` 좌표가 상한 배선 후에도 **종전과 동일**하다 (영속 idempotency 회귀 0), (ii) `until` 은 `context` 4-tuple 에 **섞이지 않는다** (좌표 shape 오염 0 — `Object.keys(계약 4 키)` 단언), (iii) User ephemeral 분기는 본 변경에 영향받지 않는다 (`generateSpy` 기대 인자 불변 — 분기 격리).
- [ ] 위 3 곳 외 기존 it 의 기대값을 **바꾸지 않고** green 이다. 추가 수정이 필요하다는 판단이 서면 코드를 밀지 말고 그 사실과 원인을 `§Follow-ups` 에 적고 먼저 보고한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`).
- [ ] 변경 파일이 frontmatter `touchesFiles` 의 **2 개뿐** 이다 (task 파일 status · journal · STATE 는 executor · driver bookkeeping 몫).
- [ ] 기존 e2e (`test/e2e/period-bridge-admin-persist.e2e-spec.ts` · `period-bridge-reevaluate.e2e-spec.ts`) 와 smoke 를 **수정하지 않고** green — 이들 fixture 의 활동 timestamp 가 요청 기간 창 안이면 동작 변화가 없어야 한다. red 가 나면 그것이 곧 "기간 밖 활동이 영속되고 있었다" 는 증거이므로 **spec 을 느슨하게 고치지 말고** 원인을 보고한다.

## Out of Scope

- **새 ADR 신설 · 기존 ADR 결정 내용 변경** — 본 slice 는 ADR-0039 `§Decision5` · ADR-0050 안의 배선이다. 진행 중 결정 충돌을 발견하면 코드를 밀지 말고 BLOCKED 로 escalate (CLAUDE.md `§ 5`).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` 및 그 spec 수정 — T-1941 이 이미 `{ since?, until? }` 계약과 창 필터를 확정했다. 본 task 는 **호출부만** 채운다.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` · `ephemeralForUser` 분기 수정 — User 경로는 T-1939 · T-1940 으로 닫혔다 (회귀 기준점으로 보존).
- `src/assessment-collection/domain/period-window-filter.ts` 수정 — helper 는 T-1939 확정분이다.
- 수집 layer (`collection-spec.service.ts` · `github-collection.service.ts`) 에 `until` query 축 추가 — GitHub REST 의 `until` 은 commits 만 지원해 별도 판단이 필요하다 (`§Follow-ups (c)`).
- `PeriodBridgeDto` 에 종료 경계 **입력 필드** 추가 — README `178 행` 계약이 "일/주/월 + 시작 시점" 이라 종료는 granularity 에서 **파생** 이다.
- `docs/requirements.md` REQ-004 재판정 · `docs/architecture/*` doc-sync — PLAN `183 행` once-rule 상 arc 종단 후 1 회 (`§Follow-ups (b)`).
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.ts` `14 행` · `test/e2e/period-bridge-admin-persist.e2e-spec.ts` `67 행` 의 `normalizeKstPeriodStart` **이름 언급 주석** 정정 — 파일 수 축소를 위해 `§Follow-ups (a)` 로 분리.
- e2e / smoke / perf spec 신설 · 수정 (PLAN `157 행` k6 · `158 행` 신규 per-route perf-spec 금지 포함).
- `web/` 프런트 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)

- (a) 제거된 `normalizeKstPeriodStart` 를 이름으로 언급하는 **주석 2 곳** 정정 — `src/assessment-evaluation/dto/unevaluated-fill-plan-request.mapper.ts` `14 행`, `test/e2e/period-bridge-admin-persist.e2e-spec.ts` `67 행`. 둘 다 주석-only 이라 동작 영향 0 이며, 다른 주석 drift 와 묶어 1 회로 처리한다.
- (b) **arc 종단 정산** — User + Admin 양 경로 상한 배선 완료 후 REQ-004 재판정 1 회 (PLAN `183 행` once-rule) + `docs/architecture/modules.md` 에 `period-window-filter` helper 인덱스 등록. T-1941 `§Follow-ups (c)` 승계.
- (c) 수집 layer `until` query 축 (GitHub commits 만 지원) 판단 — T-1939 `§Follow-ups (c)` 승계.
