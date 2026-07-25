---
id: T-1208
title: difficulty-mapping-list-contract spec 의 char-identical 추출기 5종을 공용 helper import 로 교체
phase: P6
status: DONE
prNumber: 1100
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.difficulty-mapping-list-contract.test.ts]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — T-1207 Follow-up difficulty-mapping-list; inline 5종을 T-1201 공용 helper import 로 교체(변형 inline 유지), behavior-preserving.
---

# T-1208 — difficulty-mapping-list-contract spec 의 char-identical 추출기 5종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. T-1202(schedules-list)·T-1203(persons-list)·T-1204(users-list)·T-1205(groups-list)·T-1206(parts-list)·T-1207(llm-provider-list)에 이어, T-1207 Follow-up 이 지목한 `AdminView.difficulty-mapping-list-contract.test.ts` 를 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 5종만** import 로 교체하고 richer 변형은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 5종: `stripComments`(L10), `extractControllerRoute`(L19), `normalizeRoute`(L73), `composeRoute`(L76), `stripQuery`(L85). **주의**: 공용의 `extractHandlerMethods`(L31, 2-field HandlerDecorator)·`extractHandlerParams`·`pathSegments` 는 difficulty-mapping-list 의 변형과 다르므로 import 하지 않는다.
- `web/src/views/AdminView.difficulty-mapping-list-contract.test.ts` — 대상 spec. inline 추출기 위치:
  - char-identical(교체 대상 5종): `stripComments`(L10~16), `extractControllerRoute`(L17~20), `normalizeRoute`(L88), `composeRoute`(L89~92), `stripQuery`(L94).
  - **변형(inline 유지)**: `HandlerDecorator` interface(5-field hasBody/hasParam/hasQuery, L21~27)·`extractHandlerMethods`(L30~65, 멀티라인 시그니처 괄호매칭 richer 판별)·`extractMappingsFireMethod`(L68~75, useApiResource 발사 method 추론)·`pathParams`(L93, `:`-세그먼트 필터 — 공용 `pathSegments` 의 Boolean 필터와 로직 상이)·`BackendContract`/`WebFire` 타입·`diffContract`(L97~109). 최상단 `buildMappingsPath` import(L3)도 유지.
- `web/src/views/AdminView.groups-list-contract.test.ts` (L1~13) — 직전 GET-list slice(T-1205)의 import 스타일 참조. 동일 5종을 alphabetical named import + inline 삭제 주석 패턴을 그대로 따른다.

## Acceptance Criteria

- [ ] `AdminView.difficulty-mapping-list-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute`·`stripQuery` 정의 5종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments, stripQuery`), T-1205 의 주석 스타일 mirror.
- [ ] 변형 추출기(`extractHandlerMethods` richer 5-field·`HandlerDecorator` interface·`extractMappingsFireMethod`·`pathParams`·`BackendContract`·`WebFire`·`diffContract`)와 `buildMappingsPath` import 는 inline/기존 그대로 유지 — import 로 바꾸지 않는다(공용과 로직 상이).
- [ ] 교체 전후 **test case 수 불변**(15 `it`/`it.each` 블록). describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(difficulty-mapping-list spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 5종이 공용 helper 에서 정상 해석되어 base `api/llm/difficulty-mappings` GET 목록 계약 일치 케이스가 여전히 pass.
- [ ] error/negative path: base 오타(단수/접미 drift)·method drift(@Post/@Patch/@Delete)·세그먼트 추가(@Get(":difficulty") 대조)·`?_r` nonce 무해·주석 false-positive·소스 유실 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(즉 spec 자체가 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.difficulty-mapping-list-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(auth-me, difficulty-mapping-assign 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지.
- 변형 추출기(richer extractHandlerMethods·extractMappingsFireMethod·pathParams)를 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`difficulty-mapping.controller.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- GET-list contract-guard spec 이관은 본 slice 로 사실상 소진(schedules/persons/users/groups/parts/llm-provider/difficulty-mapping-list 7종 완료). 남은 이관 후보는 non-list mutation contract-guard spec(auth-me, create-user, group-create/update/delete, person-create/update/delete, part-create/update/delete, llm-provider-create/update/delete, schedule-trigger/apply 등 26개) — 각 파일의 char-identical subset 을 확인해 파일당 slice 로 이관 가능. 단 mutation spec 은 richer 변형 비중이 커 char-identical 5종이 온전히 존재하는지 개별 검증 필요.
