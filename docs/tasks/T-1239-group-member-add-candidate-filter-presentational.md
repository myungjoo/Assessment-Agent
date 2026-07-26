---
id: T-1239
title: GroupMemberList 추가 후보 검색/필터 presentational slice — 대량 후보(수백 인원) 시 select 필터 입력
phase: P6
status: DONE
mergedAs: 820c0005
prNumber: 1131
commitMode: pr
coversReq: [REQ-046, REQ-047]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-26
independentStream: p6-group-member-add
dependsOn: [T-1237]
touchesFiles: [web/src/components/GroupMemberList.tsx, web/src/components/GroupMemberList.test.tsx]
plannerNote: P6 — T-1238 Follow-up "후보 대량 시 select 검색/필터" slice. presentational-only(GroupMemberList.tsx + test), AdminView.tsx 무접촉이라 concurrent-driver file-disjoint. R-91 100-200명 규모 사용성.
---

# T-1239 — GroupMemberList 추가 후보 검색/필터 presentational slice

## Why

방금 완결된 `p6-group-member-add` stream(T-1237 presentational `onAdd`/`addCandidates` + T-1238 AdminView 컨테이너 배선)으로 멤버 추가 UX 가 후보 `<select>` 기반으로 일원화됐다. 그러나 현재 `GroupMemberList` 의 추가 후보 select 는 **주입된 `addCandidates` 전체를 그대로 `<option>` 으로 렌더**(GroupMemberList.tsx L119~133)한다. R-91 이 명시한 실 규모(100~200명 인원)에서는 수백 개 옵션의 flat select 를 스크롤로 훑어야 해 특정 인원 선택이 사실상 불가능에 가깝다.

본 task 는 T-1238 이 명시적으로 defer 한 Follow-up("후보 목록 대량(수백 인원) 시 select 검색/필터 — 별도 slice")을 **presentational-first**(GroupMemberList 로컬 state)로 처리한다: 후보 select 위에 검색 입력을 추가하고, 이름(및 role)에 대한 case-insensitive 부분일치로 후보 옵션을 좁힌다. 컨테이너(AdminView) 는 건드리지 않으므로(파생·fetch·POST 불변) 방금 T-1238 이 수정한 `AdminView.tsx` 와 **file-disjoint** 다 — fine-grained concurrency(stage 5b) 하에서 다른 driver 작업과 충돌하지 않는다.

## Required Reading

- `web/src/components/GroupMemberList.tsx` — 특히: (a) 순수 helper `isAddDisabled`(L41)·`submitAdd`(L48) 관례 — 신 helper `filterCandidates` 를 동형(순수·throw 없음·비배열 방어)으로 작성한다. (b) 로컬 state `selectedPersonId` useState(L91)·`candidates = addCandidates ?? []`(L94) — 필터 state 를 같은 방식으로 추가한다. (c) `addForm` 의 후보 select 렌더(L109~137) — 여기서만 필터 입력을 추가하고 select 옵션 소스를 필터 결과로 교체한다. (d) `onAdd` 미전달 시 byte-동등 유지 분기(L138·L147·L177) — 필터 입력은 `addForm`(= onAdd 있을 때만) 안에만 넣어 무회귀를 지킨다.
- `web/src/components/GroupMemberList.test.tsx` — 기존 render/assert 관례(vitest + @testing-library/react, `onAdd`/`addCandidates` 주입 test 구조)를 mirror 해 필터 test 를 추가한다. 기존 add/remove test 는 무회귀.
- `web/src/components/PersonList.tsx` 의 필터/검색 관례(있으면 참고, 변경 불요) — 동일 프로젝트 내 presentational 필터 입력의 label/aria 패턴 정합.

## Acceptance Criteria

- [ ] 순수 helper `filterCandidates(candidates: Member[] | undefined, filterText: string): Member[]` 를 신설한다 — `filterText` 를 trim + toLowerCase 한 질의어로 각 후보의 `name`(및 존재 시 `role`)에 대해 case-insensitive 부분일치(`includes`)로 필터한 배열을 반환. 질의어가 빈 문자열/공백뿐이면 후보 전체를 그대로 반환(필터 미적용). `candidates` 가 배열이 아니면 빈 배열 반환(throw 없음).
- [ ] `GroupMemberList` 에 로컬 필터 state(`filterText` useState, 초기값 `''`)를 추가하고, 후보 select 위에 검색 `<input>`(명확한 `aria-label` 예: "추가 후보 검색")을 렌더한다. **이 입력은 `addForm`(= `onAdd` 전달 시) 안에만** 넣어 `onAdd` 미전달 렌더는 byte-동등 유지.
- [ ] select 의 `<option>` 소스를 `filterCandidates(candidates, filterText)` 결과로 교체한다. 원본 `candidates` 는 후보 유무 판정(빈 후보 안내·select disabled)에 그대로 쓰되, 옵션 렌더만 필터 결과를 쓴다.
- [ ] 필터 결과가 0개(단 원본 후보는 ≥1개)일 때: 한국어 안내(예: "검색 결과 없음")를 표시하고 select 옵션은 placeholder 만 남긴다(throw 없이 안전 표시). 추가 버튼은 미선택으로 인해 disabled 유지.
- [ ] 무회귀: `onAdd`/`addCandidates` 미전달 시 렌더 byte-동등(필터 입력·안내 미출현). `onRemove`·멤버 목록·loading/error·빈 상태 분기·`submitAdd`/`isAddDisabled` 동작 전부 불변. `AdminView.tsx`·apiClient·useApiResource·backend 는 **읽기만**, 수정 금지.
- [ ] **Happy-path test 1+**: `addCandidates` 5인 주입 + `onAdd` 주입 상태에서 검색 입력에 특정 부분 문자열 입력 시 매칭 후보만 `<option>` 으로 남고, 그 옵션 선택 → "추가" 클릭 시 `onAdd` 가 해당 personId 로 정확히 1회 호출됨을 검증.
- [ ] **Error/negative test 각 1+**: (a) `filterCandidates` 에 `undefined`/비배열 입력 시 빈 배열 반환(throw 없음). (b) 매칭 0건 질의어 입력 시 옵션이 placeholder 만 남고 "검색 결과 없음" 안내 표시 + 추가 버튼 disabled(빈 personId 발사 차단). (c) 대소문자 불일치(예: 소문자 질의 vs 대문자 이름) 에도 case-insensitive 매칭됨을 검증.
- [ ] **Flow/branch cover**: (1) 빈/공백 질의어 → 후보 전체 반환(필터 미적용 분기). (2) role 있는 후보 vs role 없는 후보 각각에 대해 name 매칭 분기. (3) `onAdd` 미전달 → 필터 입력 미렌더(byte-동등 분기).
- [ ] production 코드 변경은 `GroupMemberList.tsx` 1개로 한정 — `AdminView.tsx`·다른 컴포넌트·backend 수정 0.
- [ ] `pnpm --dir web test`(vitest) green — 신규/갱신 test 전부 pass, 나머지 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0). 신규 helper·필터 분기가 신규 test 로 충분 cover(web coverageThreshold 는 T-1165 게이트로 미강제이나 전 분기 test 지향).

## Out of Scope

- **AdminView.tsx 수정 금지** — 컨테이너의 후보 파생(`deriveAddCandidates`)·fetch·POST·재조회 nonce 는 불변. 본 slice 는 GroupMemberList 로컬 필터만.
- backend group.controller/service/add-member.dto/api.md 변경 0 — 후보 검색은 순수 client-side 필터(서버 검색 endpoint 도입 아님).
- 후보 정렬·페이지네이션·서버측 검색·debounce·가상 스크롤(대량 옵션 성능 고도화) 은 본 slice 미포함(필요 시 Follow-up). 본 task 는 단순 부분일치 client 필터 1종.
- 필터 적용 중 선택 후보가 필터 결과에서 사라지는 경우의 자동 `selectedPersonId` 리셋 고도화는 미포함 — 선택된 personId 는 여전히 유효한 실 후보이므로 add 발사는 정상 동작(숨겨진 상태에서 추가돼도 계약상 무해). 본 slice 는 옵션 렌더만 필터한다.
- 다른 P6 deferred 잔여(EvaluationGuardBanner 자동 polling 등) 배선 금지 — 본 task 는 멤버 추가 후보 필터 접점만.
- **cap 유의**: GroupMemberList.tsx 1 파일(helper 신설 + 필터 입력 + 옵션 소스 교체) + test 1 파일 ≈ 150 LOC 예상. 300 LOC / 5 파일 cap 초과 위험 시 executor 가 즉시 BLOCKED(task-too-large)로 planner split 요청.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후보: 대량 옵션(수백~수천) 시 debounce·가상 스크롤 등 성능 고도화 — 별도 slice(현 규모 R-91 100~200명 에선 불요).
- 후보: 필터 적용 중 선택값이 사라지면 자동 placeholder 복귀(재선택 유도) — 사용성 미세 조정, 필요 시 별도 slice.
