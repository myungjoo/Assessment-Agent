---
id: T-1870
title: AdminView 의 스케줄 trigger · 재평가 러너 군을 adminScheduleRunners 로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-039]
independentStream: adminview-god-component-refactor
dependsOn: [T-1869]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminScheduleRunners.ts
  - web/src/views/adminScheduleRunners.test.ts
  - web/src/views/AdminView.schedule-trigger-contract.test.ts
  - web/src/views/AdminView.recent-deletion-contract.test.ts
estimatedDiff: 290
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (블록 이동 + 선언 앞 export 키워드 + import 배선만) · (b) 신규 로직 0 LOC (상수 2 · async 러너 2 · 순수 helper 1 · deps 타입 1 의 본문 무변경) · (c) 런타임 spec 은 AdminView 재수출 덕에 import 경로까지 무수정 통과하고, 소스-텍스트 drift-guard spec 2 개는 읽기 대상 파일 pointer 만 바뀌며 단언 내용은 불변. 삭제 약 110 + 추가 약 115 가 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 5 로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 아홉째 실분할 — T-1869 가 후속으로 넘긴 스케줄 축 잔여 4 심볼 + 상수 2 를 한 slice 로 마감"
created: 2026-09-03
---

# T-1870 — AdminView 의 스케줄 trigger · 재평가 러너 군을 adminScheduleRunners 로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 · AdminView god component 부채) 의 실분할 아홉째 슬라이스다. 그 bullet 이 지목한 다음 대상은 **스케줄 · 재평가 축 7 심볼** 이고, [T-1869](T-1869-adminview-schedule-apply-runner-extract.md) 가 그 중 apply 조각 3 개 (`ScheduleMutationDeps` · `runApply` · `deriveScheduleMessage`) 만 옮기면서 **잔여 심볼 (`runTrigger` · 재평가 축) 은 후속 slice 로 넘긴다** 고 [adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts) 모듈 헤더 (`10~16 행`) 에 박제했다. 본 task 가 그 후속이며 스케줄 축을 마감한다.

**issue-still-relevant pre-check (origin/main `8fddef63` 기준 실측)** — 대상이 아직 main 에 안착하지 않았음을 확인했다. [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 는 `4,597 행` (`wc -l`) 이고 이동 대상 6 선언이 모두 여기 잔류한다: `SCHEDULE_TRIGGER_PATH` (`447 행`) · `TRIGGER_DONE_TEXT` (`449 행`) · `runTrigger` (`1006 행`) · `buildRecentDeletionPath` (`1032 행`) · `ReEvaluationDeps` (`1039 행`) · `runReEvaluate` (`1059 행`). `adminScheduleRunners.ts` (`143 행`) 의 export 목록은 `SCHEDULES_PATH` · `DEFAULT_SCHEDULE_NAME` · `APPLY_DONE_TEXT` · `SCHEDULE_LOADING_TEXT` · `NO_SCHEDULE_TEXT` · `SCHEDULE_LIST_PREFIX` · `ScheduleMutationDeps` · `runApply` · `deriveScheduleMessage` 뿐 — 본 task 의 6 심볼은 아직 없다. 즉 중복 · superseded 가 아니다.

**경계 근거 (파일 cap 산술)** — 스케줄 축 심볼은 AdminView **소스 텍스트를 읽어 단언하는** drift-guard spec 4 개에 묶여 있는데 apply 조각이 소비한 2 개 (`AdminView.schedule-apply-contract.test.ts` · `AdminView.schedules-list-contract.test.ts`) 는 이미 읽기 대상이 `adminScheduleRunners.ts` 로 갱신됐다. 본 slice 가 건드릴 drift-guard 는 남은 2 개 (`AdminView.schedule-trigger-contract.test.ts` `110 행`/`197 행` · `AdminView.recent-deletion-contract.test.ts` `117 행`) 뿐이라 총 5 파일로 cap 안에 정확히 들어온다 — 그래서 두 축 (trigger · 재평가) 을 쪼개지 않고 한 slice 로 마감한다 (CLAUDE.md §3 소비처 동반 의무 · 과분할 차단 취지).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 구간 `444~449 행` (trigger 상수 2 + 선행 주석) 과 `1000~1100 행` (`runTrigger` · `buildRecentDeletionPath` · `ReEvaluationDeps` · `runReEvaluate` + 각 선행 주석), 소비처 `3467~3480 행` (`handleTrigger`) · `3515~3530 행` (`handleReevalTrigger`), import 배선 `55~67 행`, 파일 끝 test 전용 export 배럴 `4493~4497 행` 과 `export type` 배럴 `4562~4563 행`.
- [web/src/views/adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts) — 모듈 헤더 주석의 단방향 import 규약 (`17~34 행`) 과 기존 export 배치 (`41~143 행`).
- [web/src/views/adminScheduleRunners.test.ts](../../web/src/views/adminScheduleRunners.test.ts) — T-1869 이 세운 경계 spec 형식 (러너 직접 호출 + AdminView 재수출 identity `141 행` describe).
- [web/src/views/AdminView.schedule-trigger-contract.test.ts](../../web/src/views/AdminView.schedule-trigger-contract.test.ts) — `110 행` `ADMIN_VIEW_SOURCE` · `115 행` `sliceTriggerRunner` · `197 행` `TRIGGER_PATH_DECL` 단언.
- [web/src/views/AdminView.recent-deletion-contract.test.ts](../../web/src/views/AdminView.recent-deletion-contract.test.ts) — `117 행` `ADMIN_VIEW_SOURCE` · `122 행` `sliceReEvaluateRunner`.
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet 의 대상 지목 · 좌표 · 측정 방법.

## Acceptance Criteria

- [ ] `SCHEDULE_TRIGGER_PATH` · `TRIGGER_DONE_TEXT` · `runTrigger` · `buildRecentDeletionPath` · `ReEvaluationDeps` · `runReEvaluate` 6 선언이 **본문 한 줄도 바뀌지 않은 채** (선언 앞 `export` 키워드 부착과 import 배선만 허용) `web/src/views/adminScheduleRunners.ts` 로 옮겨졌고, `AdminView.tsx` 에는 같은 이름의 재선언이 남아있지 않다 (`grep -n "^const SCHEDULE_TRIGGER_PATH\|^async function runTrigger\|^function buildRecentDeletionPath\|^interface ReEvaluationDeps\|^async function runReEvaluate" web/src/views/AdminView.tsx` 결과 0 줄).
- [ ] 각 선언 위의 주석 블록 (가드 근거 정본) 을 함께 옮겼다 — AdminView 에 고아 주석이 남지 않는다.
- [ ] `AdminView.tsx` 는 옮긴 값을 `./adminScheduleRunners` 에서 import 해 쓰고, 소비처 `handleTrigger` · `handleReevalTrigger` 배선이 같은 PR 안에서 그대로 동작한다 (소비처 동반 의무 — helper 단독 PR 아님). `adminScheduleRunners.ts` 는 `AdminView` 를 import 하지 않는다 (단방향 규약 유지).
- [ ] 파일 끝 test 전용 export 배럴이 `runTrigger` · `buildRecentDeletionPath` · `runReEvaluate` 값과 `ReEvaluationDeps` 타입을 **그대로 re-export** 해 공개 표면이 변하지 않는다 — 기존 `AdminView.test.tsx` (`96~139 행` import) 는 **한 줄도 수정하지 않는다**.
- [ ] **happy-path unit test**: `adminScheduleRunners.test.ts` 에 새 모듈 경로에서 직접 import 한 `runTrigger` (POST `/api/schedules/trigger` · body 없음 · 성공 시 `TRIGGER_DONE_TEXT` message) · `runReEvaluate` (POST `/api/schedules/recent-deletion/:personId` · body `{ instants: [], days }`) · `buildRecentDeletionPath` (정상 personId) 각각 happy-path 1+.
- [ ] **error path unit test**: `runTrigger` · `runReEvaluate` 각각 request/post 가 throw 할 때 `describeError` 문구가 error setter 로 표면화되고 **throw 는 전파되지 않는다** (`resolves.toBeUndefined()`) 는 test 1+.
- [ ] **분기 cover**: `runTrigger` 의 `busy` 가드 (미발사) · `runReEvaluate` 의 빈 personId 가드 · `submitting` 가드 · 성공/실패 후 `finally` 진행 off 각 분기 1+ test.
- [ ] **negative cases 충분 cover**: 빈 문자열 personId 미발사 · 이중 발사 (busy/submitting true) 미발사 · 비-2xx throw 시 error 표면화 · `buildRecentDeletionPath` 의 비정상 문자 personId (`a/b`, 공백, 한글 등) 가 `encodeURIComponent` 로 안전 인코딩되는지 각 1+ test.
- [ ] **재수출 identity**: `AdminView` 에서 import 한 `runTrigger` · `runReEvaluate` · `buildRecentDeletionPath` 가 `adminScheduleRunners` 의 동일 함수 참조임을 `toBe` 로 단언하는 test 1+ (T-1869 `141 행` describe 형식 답습).
- [ ] `AdminView.schedule-trigger-contract.test.ts` 와 `AdminView.recent-deletion-contract.test.ts` 의 **읽기 대상 파일 pointer 만** `adminScheduleRunners.ts` 로 바꾸고 (T-1869 의 `121~124 행` 주석 형식 답습) **단언 내용은 한 줄도 바꾸지 않는다** — 계약 drift 감시 강도가 유지된다.
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 전부 통과 (기존 spec 무수정 통과 포함).
- [ ] 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `wc -l web/src/views/AdminView.tsx` 가 `4,597` 보다 **최소 100 줄 이상 감소** 했음을 PR 본문에 실측으로 박제.

## Out of Scope

- 옮긴 러너의 **동작 변경 금지** — 가드 순서 · 에러 문구 · body 모양 · path 리터럴 어느 것도 손대지 않는다 (순수 추출의 (b) 조건).
- `runAssign` (`973 행`, 난이도 매핑 축) 과 `RemoveDeps` (`1191 행`) 이후 (멤버 add/remove 축) 는 대상이 **아니다** — 경계 밖.
- `docs/PLAN.md` `183 행` 의 실측 LOC 갱신 (현재 `4,688`, 실제 `4,597`) 은 `direct` 대상이라 본 task 에 섞지 않는다 (§3.1 판정 규칙 3).
- 새 devDependency 추가 · vitest 설정 변경 · drift-guard 단언 로직 재작성 금지.
- `runReEvaluate` 의 미해결 Follow-up (선택 person 의 최근 N일 instant 자동 도출) 구현 금지 — 이동만 한다.
- 파일 수가 6 개로 늘어날 사정이 발견되면 (예상 밖 drift-guard 가 하나 더 걸리는 등) **재평가 축 3 심볼 (`buildRecentDeletionPath` · `ReEvaluationDeps` · `runReEvaluate`) 을 본 slice 에서 제외** 하고 trigger 축만 완결한 뒤 Follow-ups 에 잔여를 박제한다 — 파일 cap (≤ 5) 은 예외가 없다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `docs/PLAN.md` `183 행` 의 AdminView 실측 LOC · 선언 수 갱신 (`direct`, 1 파일) — T-1869 (`4,688 → 4,597`) 과 본 task 의 감소분을 **한 번에** 반영해 remeasure slice 를 1 회로 줄인다. 다음 추출 대상 재지목도 같은 slice 에서.
