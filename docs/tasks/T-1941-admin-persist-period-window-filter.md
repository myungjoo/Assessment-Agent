---
id: T-1941
title: Admin full-persist 경로에 기간 창 필터 배선 — generateAndPersist 가 반열림 [since, until) 을 실효 강제
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-004]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-period-window-bound
dependsOn: [T-1939]
touchesFiles:
  - src/assessment-evaluation/period-bridge-admin-persist.service.ts
  - src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts
plannerNote: "P5 REQ-004 상한 축 3 단 — T-1940 §Follow-ups (b') 지정 후속. Admin sibling 에 창 필터 동형 배선 (PLAN 98 행 R-9 arc)"
---

# T-1941 — Admin full-persist 경로에 기간 창 필터 배선

## Why

[T-1939](T-1939-period-window-activity-filter.md) 가 반열림 `[since, until)` 창 필터 순수 함수 `filterActivitiesByPeriodWindow` 를 신설하고 **User ephemeral 경로** (`PeriodBridgeEphemeralService`) 에만 배선했고, [T-1940](T-1940-period-window-until-controller-wiring.md) (main `9b7ebd82`) 이 그 경로의 상한 산출까지 controller 에 채웠다. 그러나 **sibling 인 Admin full-persist 경로는 창 필터를 전혀 타지 않는다** — `PeriodBridgeAdminPersistService.generateAndPersist` 는 수집 결과를 곧장 author 필터로 넘기므로, 수집 layer 가 흘려보낸 기간 밖 활동이 그대로 평가·**영속화** 된다. ephemeral 경로는 반환값만 오염되지만 Admin 경로는 잘못된 활동이 DB 에 남는다는 점에서 영향이 더 크다. 본 slice 는 그 비대칭을 없애 README `9 행` "사용자가 지정한 기간동안 어떠한 주요 활동" · `178 행` "조회 기간(일/주/월 + 시작 시점)" 계약을 두 경로 모두에서 실효 강제로 만든다. T-1940 `§Follow-ups (b')` (= T-1939 `§Follow-ups (b)` 승계) 가 파일 · 배선 단위로 지정한 후속이며, PLAN `98 행` R-9 (임의 기간 평가문 요청) arc 안이다.

**새 결정 0** — 반열림 상한 의미론 · 판정 규칙 (a)~(e) · 경계 산출 책임 분리는 [ADR-0050](../decisions/ADR-0050-timezone-kst-period-boundary.md) 과 `src/assessment-collection/domain/period-window-filter.ts` `1~40 행` head 주석이 이미 확정했다. 본 task 는 **이미 있는 순수 함수를 두 번째 소비처에 끼우는 것** 이 전부다 (새 판정 규칙 · 새 산술 0). 따라서 **새 ADR 을 만들지 않는다**.

**issue-still-relevant pre-check (origin/main `b4980389` 실측)**:

1. `git grep -n "filterActivitiesByPeriodWindow" origin/main -- src` — 히트는 `src/assessment-collection/domain/period-window-filter.{ts,spec.ts}` / `src/assessment-evaluation/period-bridge-ephemeral.service.{ts,spec.ts}` / `assessment-evaluation.controller.ts` (`384` · `563 행` 주석) 뿐. `period-bridge-admin-persist.service.ts` 히트 **0 건** — 미착수 확인.
2. `git show origin/main:src/assessment-evaluation/period-bridge-admin-persist.service.ts` `130~157 행` 실측 — signature 가 `period: { since?: string }` 로 **`until` key 자체가 없고**, 본문은 `(1) buildCollectionSpec` → `(2) collectActivities` → `(3) filterActivitiesByAuthor` → `(4) evaluateActivities` → `(5) persistAndReadThrough` 로 창 필터 단계가 **부재**. `51 행` import 도 `filterActivitiesByAuthor` 단독이다.
3. 대조군 `period-bridge-ephemeral.service.ts` `136~139 행` 은 `filterActivitiesByPeriodWindow(activities, { since: period.since, until: period.until })` 를 (2)와 (4) 사이에 이미 갖고 있다 — 본 task 가 mirror 할 정확한 형태이자, helper signature 재확인 불요의 근거.
4. `git show origin/main:src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts` `294~404 행` — `branch / flow` describe 의 기간 관련 test 는 `since pass-through` 2 건 (`371` · `388 행`) 뿐이고 **창 필터 단언 0 건**. 기존 fixture `githubActivity` 기본 `timestamp` 는 `55~68 행` 의 `"2026-06-01T12:00:00Z"` 이며, 기존 test 가 넘기는 유일한 `since` 는 `"2026-03-01T00:00:00Z"` (`376 행`) 라 **필터 삽입 후에도 창 안** 이다 → 기존 30 개 it 의 기대값 변경 0 (회귀 표면 최소).
5. **소비처 동반 의무 (CLAUDE.md `§ 3` 하한) 의 명시 예외** — 본 service 의 `until` 소비처인 controller `persistForAdmin` (`assessment-evaluation.controller.ts` `600~640 행`) 까지 한 PR 에 넣으면 `assessment-evaluation.controller.{ts,spec.ts}` 2 파일이 추가돼 **4 파일 · 약 400 LOC** 로 cap (≤ 300 LOC / ≤ 5 파일) 의 LOC 축을 넘는다 (controller spec 의 Admin 위임 단언 `1633` · `1789` · `1915 행` 계열 + `1582 행` "Admin 회귀 0" negative test 반전이 동반되기 때문). 따라서 규정대로 수치를 제시하고 소비처 slice 를 `§Follow-ups (a)` 에 파일 · 배선 단위로 명시한다. 본 PR 만으로도 `until` 미지정 호출은 **항등** 이라 회귀 0 이고, `since` 는 즉시 실효 강제된다 (부분 가치가 즉시 발생 — dead code 아님).
6. **오너 지시 게이트** — PLAN `157 행` R-91 k6 (자격증명 게이트) 미접촉 (`test/perf/` · `package.json` · 워크플로 변경 0). `158 행` R-92 신규 per-route perf-spec 금지 미접촉 (perf spec 신설 0). `183 행` REQ 재판정 once-rule — 본 task 는 **구현 slice** 라 `docs/requirements.md` 를 건드리지 않는다 (REQ-004 재판정은 상한 arc 완결 후 1 회, `§Follow-ups (c)`).

## Required Reading

- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` `85~110 행` (JSDoc 5 단 흐름 + `@param period` 서술) · `130~145 행` (`(3)` 창 필터 호출 + 그 앞 주석 3 줄). 본 task 가 **그대로 mirror 할 원본** 이다 — 주석 문구 · 단계 번호 표기 · 인자 형태를 여기서 가져온다.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `10~20 행` (파일 head 의 5 단계 흐름 주석 — 단계 번호가 하나씩 밀린다) · `46~58 행` (import 블록 — `51 행` 옆에 helper import 추가) · `94~130 행` (`generateAndPersist` JSDoc — 흐름 · 정책 · `@param period`) · `130~158 행` (본문 5 단계). 변경 지점 전부가 이 4 구간 안이다.
- `src/assessment-collection/domain/period-window-filter.ts` `1~40 행` (head 주석의 판정 규칙 (a)~(e) — 특히 (b) 무필터 항등 · (c) 파싱 불가 `RangeError` fail-fast · (e) 빈 창은 throw 0) 와 `67~80 행` (`filterActivitiesByPeriodWindow` signature + `ActivityPeriodWindow`). **재구현 금지** 의 근거 좌표.
- `src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts` `1~13 행` (spec head 주석 — cover 범위 서술에 창 필터 축을 추가해야 한다) · `55~68 행` (`githubActivity` fixture, 기본 `timestamp` `"2026-06-01T12:00:00Z"`) · `112~148 행` (`makeMocks` / `makeService`) · `294~404 행` (`branch / flow` describe 와 기존 `since pass-through` 2 건 — 신규 describe 를 이 뒤에 붙인다).
- `src/assessment-evaluation/period-bridge-ephemeral.service.spec.ts` `189~285 행` — T-1939 가 추가한 `기간 창 필터 — 반열림 [since, until) 배선` describe 4 it (창 밖 제외 happy / `until` 미지정 branch / 양쪽 미지정 회귀 0 / `RangeError` 전파 error). 본 task 의 신규 describe 가 mirror 할 **test 축 목록** 이자 문구 관행.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/period-bridge-admin-persist.service.ts` 의 `generateAndPersist` signature 를 `period: { since?: string; until?: string }` 로 넓힌다. 두 bound 모두 optional 이라 **기존 호출부 (controller `persistForAdmin`) 는 타입 변경 없이 그대로 컴파일** 돼야 한다 (`pnpm build` 로 확인).
- [ ] 수집 `(2)` 와 author 필터 사이에 창 필터 단계를 삽입한다 — `filterActivitiesByPeriodWindow(activities, { since: period.since, until: period.until })` 결과를 `filterActivitiesByAuthor` 의 입력으로 넘긴다. helper 는 `../assessment-collection/domain/period-window-filter` 에서 import 하며, **경계 산술 · 판정 규칙 재구현 0** (호출 1 줄).
- [ ] 단계 번호가 밀린 흐름 서술을 3 곳 모두 갱신한다 — 파일 head 주석 (`10~20 행` 의 5 단계 → 6 단계), `generateAndPersist` JSDoc 의 흐름 목록, 본문 각 단계 앞 인라인 주석. 신규 단계 주석에는 (a) 반열림 `[since, until)` 의미론 근거 좌표 (ADR-0050 · `period-window-filter.ts` head 규칙), (b) 수집 layer 의 `since` 가 실효 경계가 아니라 여기가 기간 계약 강제 지점이라는 사실, (c) **Admin 경로는 그 결과가 영속화되므로 창 밖 활동 유입이 DB 오염** 이라는 ephemeral 과의 차이 1 줄을 담는다.
- [ ] `@param period` JSDoc 을 갱신한다 — `since` inclusive 하한 / `until` exclusive 상한, 각각 미지정 시 무경계, 둘 다 미지정이면 창 필터가 항등 (기존 동작 회귀 0), 파싱 불가 bound 는 `RangeError` 로 전파 (swallow 0, persist 미도달). 정책 목록에도 "창 필터 `RangeError` 는 fail-fast 로 persist 미도달" 을 명시한다.
- [ ] `period.since` 는 여전히 `(1) buildCollectionSpec` 으로 **도출 없이 pass-through** 한다 (기존 동작 불변). `until` 은 수집 spec 으로 넘기지 않는다 (수집 query 축 추가는 `§Follow-ups (b)`).
- [ ] `src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts` 에 R-112 를 충족하는 신규 describe (`기간 창 필터 — 반열림 [since, until) 배선(T-1941)`) 를 추가한다. cap 유지를 위해 **it 은 6 개 이하** 로 묶되 아래 축을 모두 cover 한다:
  - happy 1+ — 창 밖 활동 (하한 미만 / 상한 이상) 이 `evaluateActivities` 입력에서 제외되고, 창 안 활동만 평가·영속 경로로 흐른다. `until` 과 **같은 instant** 의 활동도 exclusive 라 제외됨을 단언한다.
  - 분기 1+ — `until` 미지정 (현 controller 호출 형태) 시 하한만 적용된다.
  - 분기 1+ — `since` · `until` 둘 다 미지정이면 수집 전량이 그대로 흐른다 (**회귀 0** — 기존 Admin 호출 형태 보존).
  - error path 1+ — 파싱 불가 bound 의 `RangeError` 가 swallow 없이 전파되고 `evaluateActivities` **및 `persist` 가 미호출** 이다 (fail-fast, persist 미도달이 핵심 단언).
  - negative — 예외 분기마다 1+: (i) 창 필터로 전량 제외되면 `evaluateActivities([])` → `persist` 가 **빈 입력** 으로 호출되고 throw 0 으로 흡수된다 (기존 `729 행` 빈 수집 흡수 관행과 정합), (ii) 창 필터는 author 필터 **이전** 에 적용된다 — 창 안이지만 귀속 0 건인 활동은 평가 입력에서 빠진다 (두 필터 순서 · 합성 단언), (iii) `since > until` (빈 창) 은 throw 하지 않고 빈 평가 입력으로 수렴한다.
- [ ] 기존 30 개 it 의 기대값을 **바꾸지 않고** green 이다 — 기존 fixture `timestamp` 가 유일한 `since` (`2026-03-01T00:00:00Z`) 창 안이므로 변경이 필요 없다. 수정이 필요하다는 판단이 서면 코드를 밀지 말고 그 사실을 `§Follow-ups` 에 적고 원인을 먼저 보고한다.
- [ ] spec head 주석 (`1~13 행`) 의 cover 범위 서술에 창 필터 축을 1 줄 추가한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`).
- [ ] 변경 파일이 frontmatter `touchesFiles` 의 **2 개뿐** 이다 (task 파일 status · journal · STATE 는 executor · driver bookkeeping 몫).
- [ ] 기존 e2e (`test/e2e/period-bridge-admin-persist.e2e-spec.ts`) 와 smoke 를 **수정하지 않고** green — `until` 미지정 호출은 항등이므로 동작 변화가 없어야 한다.

## Out of Scope

- **새 ADR 신설 · 기존 ADR 결정 내용 변경** — 본 slice 는 ADR-0050 · ADR-0037 안의 배선이다. 진행 중 결정 충돌을 발견하면 코드를 밀지 말고 BLOCKED 로 escalate (CLAUDE.md `§ 5`).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` 의 `persistForAdmin` 배선 (`until` 산출 · 전달) 및 그 spec — `§Follow-ups (a)` 의 별도 slice다 (위 pre-check #5 의 cap 수치 근거). 본 PR 은 service 계약만 넓힌다.
- `src/assessment-collection/domain/period-window-filter.ts` 및 그 spec 수정 — helper 는 T-1939 에서 확정됐고 본 task 는 **두 번째 호출처만** 채운다.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` 수정 — User 경로는 T-1939 · T-1940 으로 이미 닫혔다 (sibling 구조 경계 보존).
- 수집 layer (`collection-spec.service.ts` · `github-collection.service.ts`) 에 `until` query 축 추가 — GitHub REST 의 `until` 은 commits 만 지원해 별도 판단이 필요하다 (`§Follow-ups (b)`).
- `PeriodBridgeDto` 에 종료 경계 **입력 필드** 추가 — README `178 행` 계약이 "일/주/월 + 시작 시점" 이라 종료는 granularity 에서 **파생** 이다.
- `docs/requirements.md` REQ-004 재판정 · `docs/architecture/*` doc-sync — PLAN `183 행` once-rule 상 상한 arc 완결 후 1 회 (`§Follow-ups (c)`).
- e2e / smoke / perf spec 신설 · 수정 (PLAN `157 행` k6 · `158 행` 신규 per-route perf-spec 금지 포함).
- `web/` 프런트 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)

- (a) **소비처 slice (본 task 의 cap 예외 잔여, CLAUDE.md `§ 3`)** — `src/assessment-evaluation/assessment-evaluation.controller.ts` `persistForAdmin` 이 이미 산출한 `normalizeKstPeriodRange` 의 `.end` 를 `generateAndPersist` 에 `{ since, until }` 로 전달하도록 배선. 동반 변경: `assessment-evaluation.controller.spec.ts` 의 Admin 위임 단언 (`1633` · `1789` · `1915 행` 계열) 갱신 + `1582 행` "Admin full-persist 분기 회귀 0 — 기간 인자에 `until` 없음" negative test 를 **상한 전달 단언으로 반전**.
- (b) 수집 layer `until` query 축 (GitHub commits 만 지원) 판단 — T-1939 `§Follow-ups (c)` 승계.
- (c) 상한 arc (User + Admin 양 경로) 완결 후 REQ-004 재판정 1 회 + `docs/architecture/modules.md` 에 `period-window-filter` helper 인덱스 등록.
