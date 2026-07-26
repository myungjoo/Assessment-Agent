---
id: T-1240
title: GroupMemberList 선택 후보 stale 자동 무효화 — 후보에서 사라진 selectedPersonId 오발사 차단(추가 성공 후)
phase: P6
status: DONE
mergedAs: 920f7062
prNumber: 1132
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-group-member-add
dependsOn: [T-1239]
touchesFiles: [web/src/components/GroupMemberList.tsx, web/src/components/GroupMemberList.test.tsx]
plannerNote: P6 — T-1238·T-1239 명시 Follow-up("add 성공 후 select 재선택 UX"). 추가 성공 시 후보에서 사라진 selectedPersonId 가 stale 로 남아 추가 버튼 enabled·phantom 재발사. 순수 helper 로 유효 선택 파생. GroupMemberList.tsx+test only(AdminView 무접촉 → concurrent-driver file-disjoint), commitMode pr.
---

# T-1240 — GroupMemberList 선택 후보 stale 자동 무효화

## Why

방금 완결된 `p6-group-member-add` stream(T-1237 presentational `onAdd`/`addCandidates` + T-1238 AdminView 컨테이너 배선 + T-1239 후보 검색/필터)으로 멤버 추가 UX 가 후보 `<select>` 기반으로 일원화됐다. 그러나 현재 `GroupMemberList` 는 로컬 state `selectedPersonId`(GroupMemberList.tsx L125)를 후보 목록 변화와 독립적으로 유지한다.

문제: 후보를 선택해 "추가"하면 컨테이너(AdminView)가 재조회(`membersRefreshNonce` bump)해 방금 추가된 인원이 `addCandidates`(→ `candidates`)에서 사라진다. 그러나 `selectedPersonId` 는 그 사라진 인원의 id 를 그대로 붙들고 있어 — (a) `<select value={selectedPersonId}>` 가 더 이상 존재하지 않는 option 을 가리키고, (b) `isAddDisabled(selectedPersonId, ...)` 는 `selectedPersonId !== ''` 이므로 추가 버튼을 **enabled 로 유지**하며, (c) 그 상태로 재클릭 시 `submitAdd` 가 이미 추가된(= 후보에 없는) personId 로 `onAdd` 를 재발사한다. backend `@@unique(groupId, personId)` 가 P2002 → 409 로 막고 AdminView `addError` 가 흡수하지만, 사용자에겐 phantom 선택 + 불필요한 에러가 노출되는 UX 결함이다.

본 task 는 T-1238·T-1239 가 명시적으로 defer 한 Follow-up("add 성공 후 select 재선택 UX")을 **presentational-first**(GroupMemberList 순수 helper 파생)로 처리한다: `selectedPersonId` 가 현재 `candidates` 집합에 더 이상 없으면 유효 선택을 빈 값('')으로 파생해 select 는 placeholder 로 복귀하고 추가 버튼은 disabled 로 돌아가며 phantom 재발사를 원천 차단한다. 컨테이너(AdminView)는 건드리지 않으므로 T-1238 이 수정한 `AdminView.tsx` 와 **file-disjoint** 다 — fine-grained concurrency(stage 5b) 하에서 다른 driver 작업과 충돌하지 않는다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` — 특히: (a) 순수 helper `isAddDisabled`(L45)·`filterCandidates`(L54)·`submitAdd`(L82) 관례 — 신 helper 를 동형(순수·throw 없음·비배열 방어)으로 작성한다. (b) 로컬 state `selectedPersonId` useState(L125)·`candidates = addCandidates ?? []`(L132) — 유효 선택은 이 `candidates` 를 기준으로 파생한다(필터 결과 `filtered` 아님 — 아래 Out of Scope 참조). (c) `addForm` 렌더의 `<select value={selectedPersonId}>`(L176)·`isAddDisabled`·`submitAdd` 호출부(L158) — 세 곳 모두 파생된 유효 선택값을 쓰도록 교체한다. (d) `onAdd` 미전달 시 `addForm` 이 null(L153) → byte-동등 유지 분기 — helper 파생은 렌더 계산이라 무회귀.
- `web/src/components/GroupMemberList.test.tsx` — 기존 render/assert 관례(vitest + @testing-library/react, `onAdd`/`addCandidates` 주입 + rerender 로 후보 변화 재현하는 test 구조)를 mirror 해 stale-reset test 를 추가한다. 기존 add/remove/filter test 는 무회귀.

## Acceptance Criteria

- [ ] 순수 helper `resolveActiveSelection(selectedPersonId: string, candidates: Member[] | undefined): string` 를 신설·export 한다 — `candidates` 안에 `id === selectedPersonId` 인 후보가 존재하면 `selectedPersonId` 를 그대로 반환하고, 존재하지 않으면(추가 성공으로 사라짐·후보 교체 등) 빈 문자열('')을 반환한다. `candidates` 가 배열이 아니거나(undefined 등) `selectedPersonId` 가 ''이면 ''를 반환한다(throw 없음 — 기존 helper 와 동형 방어).
- [ ] `GroupMemberList` 렌더에서 `const activeSelectedId = resolveActiveSelection(selectedPersonId, candidates)` 를 파생하고, (a) `<select value={...}>` 를 `activeSelectedId` 로, (b) `isAddDisabled(...)` 첫 인자를 `activeSelectedId` 로, (c) `submitAdd(...)` 첫 인자를 `activeSelectedId` 로 교체한다 — 세 소비처가 stale id 대신 유효 선택만 보게 한다.
- [ ] 판정 기준은 원본 `candidates`(필터 미적용) 다. 검색 필터(`filterText`)로 옵션에서 가려졌을 뿐 후보 집합에는 여전히 존재하는 선택은 유효로 유지한다(T-1239 의 "필터-숨김 선택은 유효" 결정 보존 — 필터 변경만으로 선택이 리셋되지 않아야 한다).
- [ ] 무회귀: `onAdd`/`addCandidates` 미전달 시 렌더 byte-동등(helper 파생은 순수 계산, 마크업 미변화). `onRemove`·멤버 목록·loading/error·빈 상태 분기·`filterCandidates`/`submitAdd`/`isAddDisabled` 자체 동작 전부 불변. `AdminView.tsx`·apiClient·useApiResource·backend 는 **읽기만**, 수정 금지.
- [ ] **Happy-path test 1+**: `addCandidates` 3인 + `onAdd` 주입 → 특정 후보 선택 후 rerender 로 그 인원을 `addCandidates` 에서 제거(추가 성공 재현) 시, select value 가 placeholder('')로 복귀하고 추가 버튼이 disabled 로 돌아감을 검증. 이어서 다른 후보를 재선택 → "추가" 클릭 시 `onAdd` 가 그 새 personId 로 정확히 1회 호출됨을 검증.
- [ ] **Error/negative test 각 1+**: (a) `resolveActiveSelection` 에 `undefined`/비배열 `candidates` 입력 시 '' 반환(throw 없음). (b) 선택 인원이 후보에서 사라진 stale 상태에서 "추가" 클릭 시 `onAdd` 미발사(phantom 재발사 차단 — 빈 personId → submitAdd no-op). (c) `selectedPersonId` 가 ''(미선택)일 때 '' 반환(경계값).
- [ ] **Flow/branch cover**: (1) 선택 id 가 candidates 에 존재 → 그대로 반환(유지 분기). (2) 선택 id 가 candidates 에서 사라짐 → '' 반환(리셋 분기). (3) 검색 필터로 가려졌으나 candidates 에는 존재 → 유지(필터-숨김 선택 보존 분기). (4) `onAdd` 미전달 → `addForm` null, 파생 결과 렌더 미영향(byte-동등 분기).
- [ ] production 코드 변경은 `GroupMemberList.tsx` 1개로 한정 — `AdminView.tsx`·다른 컴포넌트·backend 수정 0.
- [ ] `pnpm --dir web test`(vitest) green — 신규/갱신 test 전부 pass, 나머지 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0). 신규 helper·분기가 신규 test 로 충분 cover(web coverageThreshold 는 T-1165 게이트로 미강제이나 전 분기 test 지향).

## Out of Scope

- **AdminView.tsx 수정 금지** — 컨테이너의 후보 파생(`deriveAddCandidates`)·fetch·POST·재조회 nonce 는 불변. 본 slice 는 GroupMemberList 로컬 유효-선택 파생만.
- backend group.controller/service/add-member.dto/api.md 변경 0 — 순수 client-side 렌더 파생(서버 왕복 없음).
- **필터 변경만으로 선택 리셋 금지** — 검색어로 옵션이 가려졌을 뿐 후보 집합에 남아있는 선택은 유효로 유지한다(판정 기준은 `filtered` 가 아니라 원본 `candidates`). 필터-숨김 인원의 add 는 여전히 유효(T-1239 Out of Scope 결정 보존).
- `useEffect` 기반 state mutation 도입 지양 — 렌더-계산 순수 파생(`resolveActiveSelection`)으로 처리해 state 이중-진실원 회피(부득이할 때만 최소 사용, 그 경우 근거 주석 명시).
- 추가 성공 시 검색어(`filterText`) 자동 초기화·다음 후보 auto-focus 등 추가 UX 고도화는 본 slice 미포함(필요 시 Follow-up).
- 다른 P6 deferred 잔여(ReEvaluationTriggerPanel·SchedulePanel·EvaluationGuardBanner polling·admin export/import 계약 drift) 배선 금지 — 본 task 는 멤버 추가 선택 무효화 접점만.
- **cap 유의**: GroupMemberList.tsx 1 파일(helper 신설 + 소비처 3곳 교체) + test 1 파일 ≈ 110 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: admin export/import 계약 drift(web `runExport` GET vs backend `POST /api/admin/export` job-기반 모델 — src/export/export.controller.ts) — 설계-수준 정합 필요, 별도 조사·결정 task(단순 test-only slice 아님).
- 후보: 추가 성공 후 검색어(`filterText`) 자동 초기화 + 다음 후보 auto-focus — presentational 로컬 UX 고도화, 필요 시 별도 slice.
