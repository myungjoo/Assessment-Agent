---
id: T-1869
title: AdminView 의 스케줄 apply 러너 · 안내 문구 파생 helper 를 별도 모듈로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-039]
independentStream: adminview-god-component-refactor
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminScheduleRunners.ts
  - web/src/views/adminScheduleRunners.test.ts
  - web/src/views/AdminView.schedule-apply-contract.test.ts
  - web/src/views/AdminView.schedules-list-contract.test.ts
estimatedDiff: 470
estimatedFiles: 5
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동 + 최상단 import 몇 줄 + 선언 앞 export 키워드만) · (b) 신규 로직 0 LOC (deps 타입 1 · async 러너 1 · 순수 helper 1 · 상수 6 의 본문 무변경) · (c) 런타임 계약 spec 은 AdminView 재수출 덕에 import 경로까지 무수정 통과 — 예외 1 종은 소스-텍스트 drift-guard spec 2 개의 읽기 대상 파일 pointer 뿐이며 단언 내용은 한 줄도 바뀌지 않는다. 삭제 약 110 + 추가 약 150 이 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 5 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채의 여덟째 실분할 — 스케줄 축을 drift-guard spec 파일 cap 에 맞춰 apply 조각으로 좁혀 추출"
created: 2026-09-03
---

# T-1869 — AdminView 의 스케줄 apply 러너 · 안내 문구 파생 helper 를 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31 — AdminView god component 부채) 의 **여덟째 실분할** 이다. 그 bullet 이 [T-1861](T-1861-plan-adminview-debt-remeasure-next-target.md) 에서 다음 대상을 **스케줄 · 재평가 축 7 심볼 (`1007 행` ~ `1185 행`)** 로 지목했고, 본 slice 가 그 지목의 **앞 조각 (apply 축)** 을 집행한다. 7 심볼을 한 slice 로 옮기면 아래 pre-check 가 실측한 소스-텍스트 drift-guard spec 4 개를 함께 고쳐야 해 **파일 7 개** 가 되어 파일 cap (≤ 5) 을 넘긴다 — cap 은 LOC 만 면제되고 파일 수는 예외가 없으므로 ([.claude/agents/planner.md](../../.claude/agents/planner.md) `§ Estimate model` 순수 추출 카테고리), 잔여 심볼은 후속 slice 로 넘긴다.

**planner issue-still-relevant pre-check (origin/main `dedacc1b` 실측)** — 부채도 대상 블록도 그대로 남아 있어 신규 생성이 맞다:

- `ls web/src/views/` 에 `adminScheduleRunners.ts` **없음** (기존 추출본 6 개는 collection-target · serviceIdentity · groupPart · person · llmProvider · importExport 축뿐).
- `wc -l web/src/views/AdminView.tsx` = **4,688 줄** 로 PLAN `183 행` 표기와 일치 (T-1861 이 방금 동기화한 값).
- 대상 좌표 실재 확인 — `ScheduleMutationDeps` (`1011 행`) · `runApply` (`1030 행`) · `deriveScheduleMessage` (`1102 행`), 동반 상수 6 개는 `438 행` ~ `456 행` 구간.
- **경계 축소 근거 (본 slice 의 핵심 실측)** — 스케줄 축 심볼은 AdminView **소스 텍스트를 읽어 단언하는** drift-guard spec 4 개에 묶여 있다: `AdminView.schedule-apply-contract.test.ts` (`sliceApplyRunner(ADMIN_VIEW_SOURCE)` + `SCHEDULES_PATH` · `DEFAULT_SCHEDULE_NAME` 선언 대조) · `AdminView.schedule-trigger-contract.test.ts` (`sliceTriggerRunner` + `SCHEDULE_TRIGGER_PATH` 선언) · `AdminView.schedules-list-contract.test.ts` (`SCHEDULES_PATH` 선언) · `AdminView.recent-deletion-contract.test.ts` (`sliceReEvaluateRunner`). 옮긴 심볼마다 그 spec 의 읽기 대상 파일이 따라 바뀌어야 한다. apply 축만 옮기면 고칠 spec 이 2 개라 총 5 파일로 cap 안에 들어온다.
- 직전 7 슬라이스와 동일한 순수 추출 패턴이며, 누적 `-1,399 줄` 페이스를 잇는다 (목표선 ≤ 2,000 줄 까지 잔여 `-2,688 줄`).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 2 개 블록 `1007 행` ~ `1067 행` (`ScheduleMutationDeps` 선행 주석 → `runApply` 끝) 과 `1096 행` ~ `1117 행` (`deriveScheduleMessage` 선행 주석 → 함수 끝), 동반 이동 상수 구간 `434 행` ~ `456 행` (그중 6 개만 대상 — 아래 AC 참조), 잔류 심볼 `runTrigger` (`1075 행`) · `buildRecentDeletionPath` (`1123 행`), 소비처 `2919 행` (`useApiResource<string[]>(SCHEDULES_PATH)`) · `3530 행` (`deriveScheduleMessage` 호출) · `3546 행` (`runApply` 호출), 상단 import 블록 `18 행` ~ `40 행`, 파일 끝 `export {` (`4584 행` 부근) · `export type {` (`4653 행` 부근) 표면.
- [web/src/views/adminImportExportRunners.ts](../../web/src/views/adminImportExportRunners.ts) `1 행` ~ `30 행` — 직전 슬라이스의 모듈 헤더 주석 규약 (단방향 import · 재수출 · 동반 이동 상수 근거 · 확장자 판단) 정본. 본 slice 는 같은 형식을 따른다.
- [web/src/views/adminImportExportRunners.test.ts](../../web/src/views/adminImportExportRunners.test.ts) — 신설 **경계 spec** 의 범위 규약 (기존 계약 spec 복제 금지 · 재수출 identity `toBe` 고정) 선례.
- [web/src/views/AdminView.schedule-apply-contract.test.ts](../../web/src/views/AdminView.schedule-apply-contract.test.ts) — `68 행` `sliceApplyRunner` · `121 행` `ADMIN_VIEW_SOURCE` · `127 행` `RUNNER_SRC` · `139 행` ~ `140 행` 선언 문자열 · `198 행` · `212 행` 단언. 본 slice 가 고칠 대상.
- [web/src/views/AdminView.schedules-list-contract.test.ts](../../web/src/views/AdminView.schedules-list-contract.test.ts) — `74 행` `ADMIN_VIEW_SOURCE` · `79 행` `extractSchedulesFireMethod` (AdminView 잔류 call site 대상 — 유지) · `89 행` · `134 행` `SCHEDULES_PATH_DECL` 단언. 본 slice 가 고칠 대상.
- [docs/PLAN.md](../PLAN.md) `183 행` — 부채 bullet · 대상 7 심볼 열거 · 경계 밖 명시 (`runAssign` · `RemoveDeps` 이후).
- [.claude/agents/planner.md](../../.claude/agents/planner.md) `§ Estimate model` 의 "순수 추출 리팩터" 카테고리 — (a)(b)(c) 조건과 `sizeExempt` 직행 규칙 (파일 수 cap 은 면제 아님).

## Acceptance Criteria

- [ ] `web/src/views/adminScheduleRunners.ts` 신설 — 아래 **3 심볼** 을 **본문 한 줄도 바꾸지 않고** 옮긴다. 각 선언 위 주석 블록도 그대로 옮긴다. JSX 가 없으므로 확장자는 `.ts`.
  - deps 타입 1: `ScheduleMutationDeps` (`1011 행`)
  - async 러너 1: `runApply` (`1030 행`)
  - 순수 helper 1: `deriveScheduleMessage` (`1102 행`)
- [ ] **동반 이동 (역방향 import 차단 목적)** — 옮긴 심볼이 직접 참조하는 모듈 상수 **6 개** 도 본문 무변경으로 함께 옮긴다 (선행 주석 포함): `SCHEDULES_PATH` (`438 행`) · `DEFAULT_SCHEDULE_NAME` (`445 행`) · `APPLY_DONE_TEXT` (`447 행`) · `SCHEDULE_LOADING_TEXT` (`452 행`) · `NO_SCHEDULE_TEXT` (`454 행`) · `SCHEDULE_LIST_PREFIX` (`456 행`). 근거는 `GROUPS_PATH` 를 옮긴 T-1854 · `PERSONS_PATH` 를 옮긴 T-1856 · `LLM_PROVIDERS_PATH` 를 옮긴 T-1857 선례와 동형 — AdminView 에 남기면 새 모듈 → AdminView 역방향 import 가 생긴다.
- [ ] **잔류 심볼이 새 모듈을 import 한다 (단방향 유지)** — AdminView 에 남는 `runTrigger` 는 `ScheduleMutationDeps` 를 새 모듈에서 `import type` 하고, `buildRecentDeletionPath` 와 `2919 행` 의 `useApiResource<string[]>(SCHEDULES_PATH)` 는 `SCHEDULES_PATH` 를 새 모듈에서 import 해 쓴다 (정본 1 개 유지 · 재선언 0). `SCHEDULE_TRIGGER_PATH` (`441 행`) · `TRIGGER_DONE_TEXT` (`449 행`) 는 `runTrigger` 전용이라 **AdminView 에 남긴다**.
- [ ] **이동 범위가 위 목록 (3 심볼 + 상수 6) 을 넘지 않는다** — 옮기다 보니 또 다른 AdminView 심볼이 필요해지면 범위를 넓히지 말고 그 자리에서 멈춰 `Follow-ups` 에 적는다 (범위 확대는 이동 경계를 잘못 잡았다는 신호이자, 본 slice 에서는 파일 cap 초과 신호다).
- [ ] 허용 변경은 (i) 선언 앞 `export` 키워드 추가, (ii) 새 모듈 최상단 import (`RequestOptions` from `../api/apiClient` — 실제 필요한 것만), (iii) AdminView 최상단의 새 모듈 import 블록 뿐이다. 그 외 본문 편집 0.
- [ ] 모듈 최상단 헤더 주석 — 이동 근거 (PLAN `183 행` 부채 · 여덟째 실분할) · **AdminView → 본 모듈 단방향 import** 규약 · 재수출로 기존 spec 을 보존한다는 사실 · 동반 이동 상수 6 개의 역방향 차단 근거 · **apply 축으로 경계를 좁힌 이유 (drift-guard spec 파일 cap)** · `.ts` 확장자 판단을 명시.
- [ ] `AdminView.tsx` 는 옮긴 심볼을 새 모듈에서 import 하고 **재선언하지 않는다**. 소비처 (`3546 행` 부근 `handleApply` 의 `runApply` 호출, `3530 행` 부근 `deriveScheduleMessage` 호출, `2919 행` 조회 call site) 가 import 한 심볼을 그대로 호출한다 — 소비처 배선을 같은 PR 에 포함한다 ([CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무).
- [ ] `AdminView.tsx` 파일 끝 `export {` / `export type {` 목록의 **공개 표면이 이동 전과 정확히 같다** — 이동 전 export 표면이던 `runApply` · `deriveScheduleMessage` 와 타입 `ScheduleMutationDeps` 를 그대로 re-export 하고, 이동 전 export 가 아니던 상수 6 개는 AdminView 에서 새로 export 하지 않는다.
- [ ] **런타임 계약 spec 무수정 통과** — `from './AdminView'` 로 심볼을 import 하는 spec (`AdminView.test.tsx` 의 `deriveScheduleMessage` describe 군, `AdminView.schedule-apply-contract.test.ts` 의 `runApply` · `ScheduleMutationDeps` import) 이 **import 문을 한 줄도 수정하지 않고** 통과한다. 이것이 순수 추출 조건 (c) 의 기계적 증거다.
- [ ] **소스-텍스트 drift-guard 2 개의 읽기 대상만 갱신** — 단언 내용은 바꾸지 않고 읽는 파일만 바꾼다:
  - `AdminView.schedule-apply-contract.test.ts`: `RUNNER_SRC` 를 새 모듈 소스에서 슬라이스하도록 `sliceApplyRunner` 의 입력을 교체하고, `SCHEDULES_PATH_DECL` · `DEFAULT_NAME_DECL` 대조 대상도 새 모듈 소스로 바꾼다 (`export const ...` 형태라 기존 선언 문자열이 부분 문자열로 그대로 매칭된다 — 기대 문자열 자체는 수정 금지).
  - `AdminView.schedules-list-contract.test.ts`: `SCHEDULES_PATH_DECL` 대조 대상만 새 모듈 소스로 바꾼다. `extractSchedulesFireMethod(ADMIN_VIEW_SOURCE)` 는 call site 가 AdminView 에 남으므로 **그대로 둔다**.
  - 두 spec 모두 위 두 종류 외의 단언 · 문구 · 구조 변경 0.
- [ ] **happy-path unit test** — 신설 경계 spec `web/src/views/adminScheduleRunners.test.ts` 에서 공개 심볼이 **직접 import 경로** 로도 정상 동작함을 검증 (심볼당 1+): `runApply` 가 주입 `request` 로 `PUT /api/schedules` 를 1 회 발사하고 body 키가 `{ name, cronExpression }` 이며 성공 시 완료 문구를 `setMessage` 로 표면화한다 · `deriveScheduleMessage` 가 이름 목록을 접두 문구와 합성한다.
- [ ] **error path unit test** — `runApply` 의 주입 `request` 가 reject 할 때 **throw 없이** `describeError` 파생 문구를 `setError` 로 표면화하고 `setBusy(false)` 로 진행 플래그를 `finally` 에서 되돌림을 검증 (1+).
- [ ] **분기 cover** — 각 분기를 분리해 test: `runApply` 의 빈/falsy `cronExpression` 가드 · `busy` in-flight 가드 · 발사 시작 시 이전 `error` · `message` 비움 · 성공 분기 · 실패 분기, `deriveScheduleMessage` 의 4 갈래 (`mutationMessage` 우선 · `loading` · 빈/비배열 목록 · 1+ 건 요약).
- [ ] **negative cases 충분 cover** — 최소 6 종 이상: ① 빈 문자열 `cronExpression` 으로 `request` 0 회 ② `busy: true` 재호출 시 이중 PUT 0 회 ③ 실패 경로에서 완료 문구 미설정 (`setMessage` 가 완료 문구로 호출되지 않음) ④ `deriveScheduleMessage(null as unknown as string[], ...)` · 배열 아님 입력에서 throw 0 이고 빈 상태 안내 반환 ⑤ `deriveScheduleMessage` 가 `loading: true` 여도 `mutationMessage` 가 있으면 그것을 우선 ⑥ 실패 후에도 `setBusy(false)` 가 반드시 호출됨 (`finally` 보장) ⑦ **재수출 identity 보존** — `AdminView` 에서 import 한 `runApply` · `deriveScheduleMessage` 가 새 모듈에서 import 한 것과 **동일 함수 참조** (`toBe`) 임을 검증.
- [ ] 경계 spec 은 기존 계약 spec 의 상세 행동 검증을 **복제하지 않는다** — 검증 범위를 "새 모듈 자신의 공개 표면" 으로 한정하고 그 규약을 spec 최상단 주석에 명시 (T-1830 · T-1857 · T-1860 선례).
- [ ] `cd web && pnpm test` (vitest) 전량 green + `cd web && pnpm build` 성공.
- [ ] repo 루트에서 `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — backend 전역 임계 유지 (본 slice 는 `web/` 만 건드리므로 backend coverage 영향 0 이어야 한다).
- [ ] `AdminView.tsx` 순 감소 확인 — `wc -l web/src/views/AdminView.tsx` 가 작업 전 `4688` 보다 **80 줄 이상 작아진다** (이동 약 110 줄 - 새 import 블록 약 15 줄).

## Out of Scope

- 스케줄 축 잔여 심볼 (`runTrigger` `1075 행` · `SCHEDULE_TRIGGER_PATH` · `TRIGGER_DONE_TEXT`) 이동 — 함께 옮기면 `AdminView.schedule-trigger-contract.test.ts` 까지 고쳐야 해 파일 6 개로 cap 초과. 다음 slice.
- 재평가 축 (`buildRecentDeletionPath` `1123 행` · `ReEvaluationDeps` `1130 행` · `runReEvaluate` `1150 행`) 이동 — `AdminView.recent-deletion-contract.test.ts` 동반 수정이 필요해 본 slice 범위 밖. 후속 slice.
- 난이도 매핑 축 (`runAssign` `973 행`) · 멤버 add/remove 축 (`RemoveDeps` `1191 행` 이후) 이동 — PLAN `183 행` 이 명시적으로 경계 밖으로 그은 대상.
- drift-guard spec 의 단언 강화 · 추출기 개선 · 구조 리팩터 — 본 slice 는 **읽기 대상 파일 pointer 만** 바꾼다.
- 러너 · helper 본문 로직 개선 (가드 추가 · 에러 문구 변경 · 중복 제거 · 타입 정리) — **순수 추출** 이므로 본문 한 줄도 바꾸지 않는다. 개선 여지가 보이면 Follow-ups 에 적는다.
- `docs/PLAN.md` `183 행` 실측 LOC 갱신 — `direct` 문서 갱신이라 본 `pr` task 와 섞지 않는다 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 3). 머지 후 별도 slice.
- web `coverageThreshold` 도입 — 새 devDependency (`@vitest/coverage-v8`) 가 필요해 `§5` 새-dep 게이트 대상 (PLAN 게이트된 backlog).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
