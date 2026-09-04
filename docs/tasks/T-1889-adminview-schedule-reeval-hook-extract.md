---
id: T-1889
title: AdminView 의 스케줄·재평가 패널 배선(상태 9 + 조회 1 + 파생 3 + 핸들러 6 = 19 선언)을 useAdminSchedule hook 으로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-039]
independentStream: adminview-god-component-refactor
dependsOn: [T-1888]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/useAdminSchedule.ts
  - web/src/views/useAdminSchedule.test.ts
estimatedDiff: 700
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`1050 행` ~ `1080 행` 과 `1490 행` ~ `1598 행` 두 구역의 스케줄 · 재평가 패널 배선을 선행 주석까지 통째로 새 hook 모듈로 옮기고, 새로 쓰는 것은 `export function useAdminSchedule(params)` 시그니처와 반환 object literal · AdminView 의 destructure 배선뿐이며 분기 0) · (b) 신규 로직 0 LOC (`useApiResource<string[]>(SCHEDULES_PATH)` 조회 · `schedulePanelMessage`/`schedulePanelError` 파생 · `runApply`/`runTrigger`/`runReEvaluate` 주입 · `personOptions = members` 한 줄까지 본문 무변경 이동이고 `useMemo`/`useCallback` deps 배열도 그대로) · (c) 기존 spec 무수정 통과 — AdminView 소스를 `readFileSync` 로 읽는 drift-guard 17 파일을 전수 검사한 결과 본 두 축의 심볼을 anchor 로 쓰는 spec 이 0 건이다(`AdminView.schedule-apply-contract.test.ts` 는 T-1869 때 이미 `adminScheduleRunners.ts` 로 pointer 를 옮겼고, `AdminView.test.tsx` 의 `readFileSync` 가드 3 건은 각각 역할 변경 · 인스턴스 접근 · 사용자 섹션 렌더용이라 스케줄 · 재평가 심볼을 잡지 않는다). 이동 140 줄이 삭제 · 추가로 이중 계상될 뿐 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 준수."
created: 2026-09-04
plannerNote: "P6 / PLAN 183 행 AdminView 부채 다섯째 본문 분해 슬라이스 — 스케줄·재평가 축 hook 화, head bfbc5ab7 좌표 재실측 · drift-guard anchor 0 건 · 소비처 동반"
---

# T-1889 — AdminView 의 스케줄·재평가 패널 배선을 useAdminSchedule hook 으로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 지목한 **경로 1(prelude 축 → custom hook 모듈)** 의 다섯째 슬라이스다. [T-1884](T-1884-adminview-import-export-hook-extract.md)(import/export 축) · [T-1886](T-1886-adminview-collection-targets-hook-extract.md)(수집 대상 축) · [T-1887](T-1887-adminview-llm-provider-hook-extract.md)(LLM provider · 난이도 축) · [T-1888](T-1888-adminview-service-identity-hook-extract.md)(ServiceIdentity 축) 이 같은 방식으로 넷을 마감했고, 본 task 는 bullet 인벤토리 ⑨ **스케줄 · 재평가 축** 을 옮긴다. 두 패널의 실행 로직은 이미 [adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts)([T-1869](T-1869-adminview-schedule-apply-runner-extract.md) · [T-1870](T-1870-adminview-schedule-trigger-reeval-runners-extract.md)) 로 분리돼 있어 hook 이 소유할 것은 상태와 배선뿐이다.

**issue-still-relevant pre-check 실측** (head [`bfbc5ab7`](https://github.com/myungjoo/Assessment-Agent/commit/bfbc5ab7), working tree == origin/main):

- ① 목적지 `web/src/views/useAdminSchedule.ts` 는 main 에 **미존재** — `ls web/src/views/useAdmin*.ts` 가 `useAdminCollectionTargets` · `useAdminImportExport` · `useAdminLlmProviders` · `useAdminServiceIdentities` **4 쌍만** 보고한다. 동일 의도 미안착.
- ② PLAN bullet 이 지목한 "다음 대상 = import/export 축(`1481 행` ~ `1650 행`)" 문단은 **[T-1884](T-1884-adminview-import-export-hook-extract.md) 가 이미 소진해 무효**이고, bullet 의 좌표 · LOC(`3,450 줄`)도 그 뒤 4 슬라이스만큼 stale 하다. 그래서 **본 task 가 좌표를 직접 재실측**했다: `wc -l web/src/views/AdminView.tsx` = **2,652 줄**, prelude 는 `409 행` ~ `1611 행`, JSX return 은 `1612 행` ~ `2518 행`, 배럴은 `2520 행` ~ `2652 행` 이다.
- ③ 이동 대상은 **두 구역, 합 140 줄** — (A) `1050 행` ~ `1080 행`(31 줄, `// === 스케줄 패널 배선(T-0885)` 머리 주석부터 `} = useApiResource<string[]>(SCHEDULES_PATH);` 까지: `cronExpression`(`1053 행`) · `scheduleBusy`(`1059 행`) · `scheduleMessage`(`1063 행`) · `scheduleError`(`1069 행`) · 조회 destructure(`1076 행`)) · (B) `1490 행` ~ `1598 행`(109 줄, `schedulePanelMessage`(`1492 행`) · `schedulePanelError`(`1502 행`) · `handleApply`(`1508 행`) · `handleManualTrigger`(`1523 행`) · `handleCronChange`(`1538 행`) · `selectedPersonId`(`1547 행`) · `selectedDays`(`1554 행`) · `reevalSubmitting`(`1558 행`) · `reevalError`(`1564 행`) · `personOptions`(`1568 행`) · `handleReevalTrigger`(`1575 행`) · `handleReevalSelect`(`1589 행`) · `handlePersonChange`(`1595 행`) 과 `// === /재평가 트리거 패널 배선(T-0886)` 꼬리 주석). 합 **19 선언**.
- ④ **축 밖 의존 1 개** — 두 구역이 참조하는 외부 심볼은 `useState`/`useMemo`/`useCallback` · `useApiResource`/`toErrorMessage` · `request` · `SCHEDULES_PATH` · `deriveScheduleMessage` · `runApply`/`runTrigger`/`runReEvaluate` 로 **전부 모듈 최상위 import** 이며, 유일한 축 밖 값이 `const personOptions = members;`(`1568 행`) 의 `members`(그룹 축 파생, `897 행`) 다. `members` 정의가 hook 호출 지점(`1050 행`)보다 앞서므로 파라미터로 넘기면 되고, 그 한 줄은 hook 안에서 **글자-동일**로 남는다. 반대 방향(다른 축이 스케줄 · 재평가 state 를 읽는 줄)은 **0 건** — `scheduleData`/`scheduleLoading`/`scheduleGetError`/`set*` 전량이 위 두 구역 안에서만 등장한다.
- ⑤ 블록 밖에서 이 축 심볼을 쓰는 곳은 **JSX 소비처 두 덩어리뿐** — SchedulePanel props(`1861 행` ~ `1867 행`) 와 재평가 패널 props(`1869 행` ~ `1898 행`). 그래서 hook 반환은 그 소비처가 실제로 쓰는 **15 심볼**(`cronExpression` · `scheduleBusy` · `schedulePanelMessage` · `schedulePanelError` · `handleCronChange` · `handleApply` · `handleManualTrigger` · `selectedPersonId` · `selectedDays` · `reevalSubmitting` · `reevalError` · `personOptions` · `handleReevalTrigger` · `handleReevalSelect` · `handlePersonChange`) 만 공개하고 내부 setter 는 노출하지 않는다(T-1884 ~ T-1888 캡슐화 선례 승계).
- ⑥ **drift-guard anchor 0 건** — `grep -rl "AdminView.tsx" web/src --include=*.test.*` 의 17 파일 중 본 축 심볼을 가진 것은 `AdminView.schedule-apply-contract.test.ts` 와 `AdminView.test.tsx` 뿐인데, 전자는 T-1869 때 pointer 를 `adminScheduleRunners.ts` 로 옮겨 **AdminView 소스를 더는 읽지 않고**, 후자의 `readFileSync` 가드 3 건(`9187 행` 역할 변경 · `9605 행` 인스턴스 접근 · `9681 행` 사용자 섹션 렌더)은 스케줄 · 재평가 심볼을 잡지 않는다. 나머지 참조는 배럴 import 또는 `<AdminView />` 렌더 test 라 공개 표면 · 렌더 트리 무변경으로 green 을 유지한다.
- ⑦ AdminView 의 관련 import(`48 행` ~ `55 행` 의 `SCHEDULES_PATH` · `runApply` · `runTrigger` · `runReEvaluate` · `deriveScheduleMessage` 등)는 **하나도 지우지 않는다** — 배럴(`2520 행` ~ `2652 행`)이 그대로 재수출하므로 제거하면 기존 spec 의 `from './AdminView'` 가 깨진다(T-1887 · T-1888 이 확인한 동일 제약).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `18 행` ~ `20 행`(react · `useApiResource`/`toErrorMessage` · `request` import), `47 행` ~ `55 행`(스케줄 러너 · 상수 import), `409 행` ~ `421 행`(props destructure — `initialCronExpression` · `initialScheduleBusy` · `initialSelectedPersonId` · `initialSelectedDays` · `initialReevalSubmitting`), `894 행` ~ `900 행`(`members` 정의 — 파라미터로 넘길 유일한 축 밖 값), `1050 행` ~ `1080 행`(이동 대상 A), `1490 행` ~ `1598 행`(이동 대상 B), `1861 행` ~ `1898 행`(JSX 소비처 2 덩어리), `2520 행` ~ `2652 행`(배럴 재수출 — 무변경)
- [web/src/views/useAdminServiceIdentities.ts](../../web/src/views/useAdminServiceIdentities.ts) — 직전 슬라이스가 확립한 hook 모듈 형식(헤더 주석 · 파라미터 · 반환 literal · 배럴 미추가 원칙)
- [web/src/views/useAdminServiceIdentities.test.ts](../../web/src/views/useAdminServiceIdentities.test.ts) — colocated hook spec harness 선례(`renderToStaticMarkup` probe + `vi.hoisted` 러너 mock, RTL 미도입)
- [web/src/views/adminScheduleRunners.ts](../../web/src/views/adminScheduleRunners.ts) — hook 이 주입할 `runApply` · `runTrigger` · `runReEvaluate` · `deriveScheduleMessage` · `SCHEDULES_PATH` 의 계약
- [docs/PLAN.md](../PLAN.md) `183 행` — AdminView 부채 bullet 의 경로 1 판정(순수 추출 3 조건 (a)(b)(c) 충족 근거)

## Acceptance Criteria

- [ ] 신규 모듈 `web/src/views/useAdminSchedule.ts` 가 `export function useAdminSchedule(...)` 하나를 노출하고, AdminView 의 `1050 행` ~ `1080 행` · `1490 행` ~ `1598 행` 두 구역이 **선행 · 꼬리 주석까지 본문 무변경**으로 그 안에 들어간다. 옮긴 선언의 본문 · `useMemo`/`useCallback` deps 배열 · 러너 주입 키가 이동 전과 글자-동일임을 `git diff` 로 확인.
- [ ] hook 이 받는 값은 props 유래 초기값 5 개(`initialCronExpression` · `initialScheduleBusy` · `initialSelectedPersonId` · `initialSelectedDays` · `initialReevalSubmitting`)와 축 밖 값 `members` **뿐**이며, 가독성을 위해 단일 파라미터 object 로 받는다(분기 · 기본값 로직 신설 0 — 기본값은 AdminView props destructure 가 계속 소유).
- [ ] hook 반환이 JSX 소비처가 실제로 쓰는 **15 심볼**(위 Why ⑤ 목록)이고, 내부 setter(`setScheduleBusy` · `setSelectedDays` 등)는 노출하지 않는다.
- [ ] **소비처 동반** — 같은 PR 에서 AdminView 가 `1050 행` 자리에서 `const { ... } = useAdminSchedule({ ... });` 한 줄로 되돌려 쓰고, JSX(`1861 행` ~ `1898 행`)의 props 배선은 **한 글자도 바뀌지 않는다**. helper 단독 slice 아님(CLAUDE.md §3 소비처 동반 의무).
- [ ] AdminView 의 스케줄 러너 · 상수 import 와 배럴 재수출(`2520 행` ~ `2652 행`)은 **무변경** — 기존 spec 의 `from './AdminView'` 가 무수정 통과한다.
- [ ] R-112 happy-path: colocated spec `web/src/views/useAdminSchedule.test.ts` 가 hook 의 정상 경로를 cover — 초기값 5 개가 그대로 반환에 실리고, `handleApply`/`handleManualTrigger`/`handleReevalTrigger` 가 각각 `runApply`/`runTrigger`/`runReEvaluate` 를 **정확한 인자 · 주입 키**로 1 회 호출하며, `schedulePanelMessage` 가 `deriveScheduleMessage(scheduleData, scheduleLoading, scheduleMessage)` 결과를 그대로 돌려준다.
- [ ] R-112 error path: 러너가 reject 하는 경우 hook 이 throw 를 밖으로 흘리지 않고(러너 계약 그대로 전달) 반환 표면이 무너지지 않음 1+ test, 조회(`useApiResource`) 가 `error` 를 돌려줄 때 `schedulePanelError` 가 그 값을 노출함 1+ test.
- [ ] R-112 branch cover: `schedulePanelError = scheduleError ?? scheduleGetError` 의 **3 분기**(mutation 실패 우선 / GET 실패 fallback / 둘 다 없으면 `undefined`) 각각 1+ test, `handleCronChange`/`handleReevalSelect`/`handlePersonChange` 의 상태 반영 분기 각 1+ test.
- [ ] R-112 negative cases 충분 cover — 예외 상황마다 1+ test: (i) `members` 가 빈 배열이면 `personOptions` 가 빈 배열(placeholder 경계값), (ii) `scheduleData` 가 `undefined`/빈 배열일 때 파생이 throw 하지 않음, (iii) in-flight(`scheduleBusy` · `reevalSubmitting` true) 상태가 러너 deps 의 `busy`/`submitting` 로 그대로 주입돼 이중 발사 가드가 살아 있음, (iv) `handleReevalTrigger` 에 `days = 0` 을 넘겨도 hook 이 값을 가공하지 않고 러너에 그대로 전달, (v) 초기 person 미선택(`''`)에서도 반환이 정상 형태.
- [ ] `pnpm --filter web test:cov` (또는 저장소 표준 web coverage 명령) 통과 — line ≥ 80% / function ≥ 80%.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + CI 3 종(unit / smoke / e2e) green. 특히 `AdminView.schedule-apply-contract.test.ts` · `AdminView.test.tsx` 가 **무수정으로** green 임을 확인(위 Why ⑥ 전제 검증).
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **2,520 줄 안팎**(현 2,652 줄에서 `-130 줄` 안팎)으로 줄었음을 PR 본문에 실측 기재.

## Out of Scope

- 옮긴 코드의 **로직 수정 · 리네이밍 · 주석 재작성** 금지 — 순수 추출 3 조건 (b) 유지.
- JSX return(`1612 행` ~ `2518 행`)의 **패널 하위 컴포넌트화** 금지 — 그 경로는 순수 추출이 아니라 별도 판정 대상(PLAN `183 행` 경로 2).
- AdminView **배럴 재수출 목록 변경 · 신규 hook 의 배럴 추가** 금지(공개 표면 무변경이 전제).
- 다른 축(그룹 · 멤버십 · 인원 · 파트 · 사용자 관리)의 prelude 이동 금지 — 본 슬라이스는 스케줄 · 재평가 두 패널 구역만.
- `SchedulePanel` · `ReEvaluationTriggerPanel` 컴포넌트 파일 수정 금지.
- 새 dependency 추가(RTL · react-test-renderer 등) 금지 — spec harness 는 `renderToStaticMarkup` probe 선례 그대로.
- `docs/PLAN.md` `183 행` bullet 의 실측 갱신은 본 task 에서 하지 않는다(doc-only `direct` 라 commitMode 혼합 금지 — Follow-ups 로).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- PLAN `183 행` AdminView 부채 bullet 의 실측(현재 `3,450 줄` · 좌표 · "다음 대상 = import/export 축" 문단 전부 stale) 을 본 슬라이스 머지 후 `direct` task 1 건으로 재실측 · 갱신 — 남은 축은 ① 그룹 · 멤버십 · ② 인원 · ⑦ 파트 · ⑧ 사용자 관리 넷이다.
- ⑧ **사용자 관리 축** hook 화는 파일 cap 주의 — planner 실측상 `AdminView.create-user-failure.test.ts`(`runCreateUser(` 호출 블록 추출) · `AdminView.users-list-contract.test.ts`(`useApiResource<UserRow[]>(usersPath)` 추출) · `AdminView.test.tsx`(T-1165 `handleChangeRole` · T-1168 인스턴스 접근 배선 가드) **3 개 spec 의 pointer 갱신**이 강제돼 생성 · 역할 변경 · 인스턴스 접근을 한 슬라이스로 묶으면 6 파일(cap 초과)이 된다. 축을 2 슬라이스로 나눠 각 5 파일 안에 넣을 것.
