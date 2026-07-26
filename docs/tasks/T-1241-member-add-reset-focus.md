---
id: T-1241
title: GroupMemberList 추가 성공 후 검색어·선택 자동 초기화 + 검색 입력 auto-focus
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-group-member-add
dependsOn: [T-1240]
touchesFiles: [web/src/components/GroupMemberList.tsx, web/src/components/GroupMemberList.test.tsx]
plannerNote: P6 — T-1240 명시 Follow-up(b). 추가 발사 성공 시 filterText·selectedPersonId 로컬 초기화 + 검색 input auto-focus 로 연속 추가 UX 완결. submitAdd 를 boolean 반환(발사 여부)으로 확장해 reset gate 를 순수하게 재사용. GroupMemberList.tsx+test only(AdminView file-disjoint), pr.
---

# T-1241 — GroupMemberList 추가 성공 후 검색어·선택 자동 초기화 + 검색 입력 auto-focus

## Why

방금 완결된 `p6-group-member-add` stream(T-1237 presentational `onAdd`/`addCandidates` + T-1238 AdminView 컨테이너 배선 + T-1239 후보 검색/필터 + T-1240 stale 선택 자동 무효화)으로 그룹 멤버 추가 UX 가 후보 `<select>` + 검색 입력 기반으로 일원화됐다. 다만 **한 명을 추가한 직후** 로컬 검색어(`filterText`, GroupMemberList.tsx L156)와 선택값(`selectedPersonId`, L152)이 그대로 남는다 — 사용자가 "김"으로 좁혀 김철수를 추가하면 검색 입력엔 여전히 "김"이 남아 옵션이 "김"으로 계속 필터돼 있고(다음 인원 검색 전 지우는 수고 필요), 선택값도 방금 추가된 id 를 붙들다 다음 렌더에 `resolveActiveSelection`(T-1240)이 리셋해 준다.

본 task 는 T-1240 이 명시적으로 defer 한 Follow-up(b)("추가 성공 후 검색어 자동 초기화 + 다음 후보 auto-focus")를 **presentational-first**(이벤트 핸들러 내 로컬 state 리셋 + `useRef` focus)로 처리한다: 추가가 **실제 발사됐을 때만**(유효 선택) `filterText`·`selectedPersonId` 를 빈 값으로 초기화하고 검색 입력에 focus 를 줘, 연속으로 여러 인원을 추가하는 흐름을 깨끗한 상태에서 이어가게 한다. `useEffect` 없이 `onSubmit` 핸들러 안에서만 처리해 state 이중-진실원을 회피한다(T-1240 결정 계승). 컨테이너(AdminView)는 건드리지 않으므로 T-1238 이 수정한 `AdminView.tsx` 와 **file-disjoint** 다 — fine-grained concurrency(stage 5b) 하에서 다른 driver 작업과 충돌하지 않는다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` — 특히: (a) 순수 helper `submitAdd`(L109) — 현재 `void` 반환이라 호출부가 "발사됐는지" 알 수 없다. 본 task 는 이를 **boolean 반환**(발사 시 `true`, 미발사 시 `false`)으로 확장해 reset gate 조건을 순수 helper 에서 재사용한다(발사 판정 로직 중복 금지). (b) 로컬 state `selectedPersonId` useState(L152)·`filterText` useState(L156) — 추가 발사 성공 시 둘 다 빈 값으로 리셋한다. (c) `addForm` 의 `<form onSubmit>`(L185~190) 이 현재 `submitAdd(activeSelectedId, onAdd)` 만 호출 — 여기서 반환값을 받아 `true` 일 때만 리셋 + focus 한다. (d) 검색 `<input type="search" aria-label={SEARCH_LABEL}>`(L196~201) — 여기에 `ref` 를 달아 발사 성공 후 `.focus()` 한다. (e) `resolveActiveSelection`(L87)·`activeSelectedId`(L182) — 리셋은 이 파생과 상호보완(명시 리셋으로 컨테이너 재조회 지연과 무관하게 결정적). (f) `onAdd` 미전달 시 `addForm` null(L184) → byte-동등 유지 분기 — `useRef` 는 렌더 계산이라 무회귀.
- `web/src/components/GroupMemberList.test.tsx` — 기존 render/assert 관례(vitest + @testing-library/react, `onAdd`/`addCandidates` 주입 + `fireEvent`/`userEvent` 로 선택·제출 재현하는 test 구조)를 mirror 해 reset/focus test 를 추가한다. 기존 add/remove/filter/stale-reset test 는 무회귀.

## Acceptance Criteria

- [ ] 순수 helper `submitAdd` 를 `void` → `boolean` 반환으로 확장한다 — 선택 personId 가 비어있지 않고 `onAdd` 가 주어져 실제 콜백을 1회 호출하면 `true` 를, 미발사(빈 선택 또는 `onAdd` 미전달)면 `false` 를 반환한다. 발사 시 `onAdd` 를 정확히 1회 호출하는 기존 동작은 불변(반환값 추가만 — 기존 호출부·test 무회귀).
- [ ] `addForm` 의 `<form onSubmit>` 이 `submitAdd(activeSelectedId, onAdd)` 반환값(`fired`)을 받아 `fired === true` 일 때만 (a) `setFilterText('')` (b) `setSelectedPersonId('')` (c) 검색 입력 `ref` 의 `.focus()` 를 수행한다. 미발사(빈 선택 등)면 세 부수효과 모두 skip — 아무 것도 추가 안 됐는데 검색어가 지워지지 않는다.
- [ ] 검색 `<input type="search">` 에 `useRef<HTMLInputElement>` 를 달아 발사 성공 후 focus 대상으로 쓴다. `ref.current` 가 null 이어도(비정상) `?.` optional chaining 으로 throw 없이 안전 no-op.
- [ ] 무회귀: `onAdd`/`addCandidates` 미전달 시 렌더 byte-동등(`addForm` null, `useRef` 는 순수 계산이라 마크업 미변화). `onRemove`·멤버 목록·loading/error·빈 상태 분기·`filterCandidates`/`resolveActiveSelection`/`isAddDisabled` 자체 동작 전부 불변. `AdminView.tsx`·apiClient·useApiResource·backend 는 **읽기만**, 수정 금지.
- [ ] **Happy-path test 1+**: `addCandidates` 다수 + `onAdd` 주입 → 검색어 입력("김" 등)으로 옵션 좁힘 → 후보 선택 → "추가" 제출 시 (1) `onAdd` 가 그 personId 로 정확히 1회 호출, (2) 검색 입력 value 가 빈 문자열로 초기화, (3) select value 가 placeholder('')로 복귀, (4) 검색 입력이 `document.activeElement`(focus 획득)임을 검증.
- [ ] **Error/negative test 각 1+**: (a) `submitAdd('', onAdd)` 및 `submitAdd(id, undefined)` 가 `false` 반환 + `onAdd` 미호출(throw 없음). (b) 미선택 상태에서 "추가" 제출(또는 form submit) 시 `filterText` 가 지워지지 않고(리셋 skip) `onAdd` 미발사 — 검색어 보존. (c) 검색어가 있는 상태에서 발사 성공 후 검색어가 확실히 빈 값이 됨(잔여 필터 제거 회귀 방지).
- [ ] **Flow/branch cover**: (1) `submitAdd` 발사 → `true` 반환 → 리셋+focus 실행 분기. (2) `submitAdd` 미발사(빈 선택) → `false` 반환 → 리셋 skip 분기. (3) `submitAdd` 미발사(onAdd undefined) → `false` 분기(단, 이 경우 addForm 자체가 null 이라 렌더 경로 밖 — helper 단위 test 로 cover). (4) `onAdd` 미전달 → `addForm` null, 리셋/focus 코드 렌더 미영향(byte-동등 분기).
- [ ] production 코드 변경은 `GroupMemberList.tsx` 1개로 한정 — `AdminView.tsx`·다른 컴포넌트·backend 수정 0.
- [ ] `pnpm --dir web test`(vitest) green — 신규/갱신 test 전부 pass, 나머지 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0). 신규 분기·`submitAdd` boolean 반환이 신규 test 로 충분 cover(web coverageThreshold 는 T-1165 게이트로 미강제이나 전 분기 test 지향).

## Out of Scope

- **AdminView.tsx 수정 금지** — 컨테이너의 후보 파생(`deriveAddCandidates`)·fetch·POST·재조회 nonce 는 불변. 본 slice 는 GroupMemberList 로컬 state 리셋 + 검색 focus 만.
- backend group.controller/service/add-member.dto/api.md 변경 0 — 순수 client-side 렌더/이벤트 처리(서버 왕복 없음).
- **`useEffect` 기반 리셋 도입 지양** — 리셋/focus 는 `onSubmit` 이벤트 핸들러 안에서 처리해 state 이중-진실원을 회피한다(T-1240 결정 계승). `addCandidates` 변화를 감지하는 useEffect 로 리셋하지 않는다(부득이할 때만 최소 사용, 그 경우 근거 주석 명시).
- `resolveActiveSelection`(T-1240)·`filterCandidates`(T-1239)·`isAddDisabled`(T-1237) 자체 로직 변경 금지 — 본 task 는 발사-후 부수효과만 추가.
- 추가 성공 후 토스트/성공 배너·후보 정렬·중복 제거 등 추가 UX 고도화는 본 slice 미포함(필요 시 Follow-up).
- 다른 P6 deferred 잔여(ReEvaluationTriggerPanel·SchedulePanel·EvaluationGuardBanner polling·admin export/import 계약 drift) 배선 금지 — 본 task 는 멤버 추가 성공-후 상태 초기화 접점만.
- **cap 유의**: GroupMemberList.tsx 1 파일(`submitAdd` 반환 확장 + `onSubmit` 핸들러 리셋/focus + `useRef` 배선) + test 1 파일 ≈ 120 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: admin export/import 계약 drift(web `runExport` GET vs backend `POST /api/admin/export` job-기반 모델 — src/export/export.controller.ts) — 설계-수준 정합 필요, 별도 조사·결정 task(단순 test-only slice 아님).
- 후보: 남은 P6 deferred 배선(ReEvaluationTriggerPanel·SchedulePanel·EvaluationGuardBanner 자동 polling) — 각 backend 계약 shipped 여부 재확인 후 별도 wiring stream.
