---
id: T-1223
title: llm-provider-update-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체
phase: P6
status: DONE
mergedAs: PR-1115
mergeCommit: 3bf25f05
reviewRounds: 1
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.llm-provider-update-contract.test.ts]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — llm-provider 자원 update slice(create=T-1222 완료); char-identical 4종(composeRoute·extractControllerRoute·normalizeRoute·stripComments)을 T-1201 helper import 로 교체, behavior-preserving.
---

# T-1223 — llm-provider-update-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(T-1202~T-1208)에 이어 mutation slice 를 group-*·create-user·person-*·part-*·llm-provider-create(T-1222)로 이어왔고, llm-provider 자원의 create 를 처리했으므로 이번에는 같은 자원의 update 를 이어간다(list 는 T-1207 에서 이미 이관). 이번 slice 는 `AdminView.llm-provider-update-contract.test.ts`(PATCH /api/llm/providers/:id 계약 guard)를 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 4종만**(composeRoute·extractControllerRoute·normalizeRoute·stripComments) import 로 교체하고, 전용 추출기·타입(`extractHandlerMethods`·`HandlerDecorator`·`extractDtoFields`·`DtoFields`·`BackendContract`·`WebFire`·`pathParams`·`expectedPath`·`diffContract`·`toFire`)은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다. 이 spec 의 `extractHandlerMethods` 는 멀티라인 `@Body` 탐지 등 편차가 있어 공용과 상이하므로 교체 대상에서 제외한다(char-identical subset 아님) — 직전 part-update(T-1219) slice 와 동형이다. planner 가 4종의 함수 본문이 공용과 byte-identical 함을 검증 완료했다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 4종: `stripComments`(L10~16 function), `extractControllerRoute`(L19~22 function), `normalizeRoute`(L73 const arrow), `composeRoute`(L76~79 function). **주의**: 공용 `extractHandlerMethods`(L31~50)·`extractHandlerParams`·`pathSegments`(`filter(Boolean)`)·`stripQuery` 는 이 spec 에서 미사용/전용(이 spec 의 `pathParams` 는 `startsWith(':')` 필터라 공용 `pathSegments` 와 상이)이거나 편차가 있으므로 import 하지 않는다.
- `web/src/views/AdminView.llm-provider-update-contract.test.ts` — 대상 spec(총 300행). inline 추출기 위치(검증 완료):
  - char-identical(교체 대상 4종): `stripComments`(L11~17), `extractControllerRoute`(L18~21), `normalizeRoute`(L95), `composeRoute`(L96~99) — 함수 본문이 공용과 byte-identical(`export` 접두만 차이).
  - **전용/상이(inline 유지)**: `HandlerDecorator` interface(L22~27)·`extractHandlerMethods`(L28~60)·`DtoFields`/`extractDtoFields`(L62~)·`BackendContract`·`WebFire`·`pathParams`(L100, `startsWith(':')` 전용)·`expectedPath`(L102, `composeRoute` 재사용하는 전용)·`diffContract`(L104~)·`toFire`(L150~). 이들은 import 로 바꾸지 않는다.
  - **잔여 참조 확인**(검증 완료 — 4종 삭제 후 spec 에 직접 참조가 남는다 → TS6133 미발생):
    - `stripComments`: inline `extractHandlerMethods`(L30)·`extractDtoFields`(L63)가 직접 호출.
    - `extractControllerRoute`: L133·L277·L281·L287·L291.
    - `normalizeRoute`: L192(및 삭제되는 inline `composeRoute` L98 외 직접 사용).
    - `composeRoute`: inline `expectedPath`(L102)·`diffContract` 내부 + L197.
    - 따라서 4종 전부 import 후 `tsc --noEmit` 의 noUnusedLocals(TS6133) 미발생 예상. 단 삭제 후 실검증한다.
  - **주의**: L1~9 파일 상단 import·R-112 guard 헤더 주석은 보존한다(함수-전용 주석이 아님). `stripComments`(L11) 정의 직전/줄끝에 함수-전용 주석("// 주석 제거 —…")이 있으면 함수와 함께 삭제한다(T-1219 패턴 mirror). inline 유지 함수 직전 주석은 보존.
- `web/src/views/AdminView.part-update-contract.test.ts`(L1~15) — 직전 동형 slice(T-1219, PATCH /:id path param 계약)의 import 스타일 참조. 본 slice 는 동일한 4종 subset(composeRoute·extractControllerRoute·normalizeRoute·stripComments, extractHandlerMethods 제외)이므로 import 블록·삭제 패턴을 그대로 mirror 한다.

## Acceptance Criteria

- [ ] `AdminView.llm-provider-update-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute` 정의 4종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments`), T-1219 의 주석/import 스타일 mirror.
- [ ] `extractHandlerMethods`·`HandlerDecorator` interface 는 inline 유지 — 공용과 상이하므로 import 로 바꾸지 않는다(공용 `extractHandlerMethods` import 추가 금지).
- [ ] 전용 추출기·타입(`extractDtoFields`·`DtoFields`·`BackendContract`·`WebFire`·`pathParams`·`expectedPath`·`diffContract`·`toFire`)은 inline/기존 그대로 유지. `stripQuery`·`extractHandlerParams`·`pathSegments` import 추가 금지(이 spec 에 부재/미사용, pathParams 는 전용).
- [ ] 파일 상단 import·R-112 guard 헤더 주석(L1~9)은 보존한다. `stripComments` 줄끝의 함수-전용 주석은 함수와 함께 삭제한다.
- [ ] 삭제한 4종 각각에 잔여 직접 참조가 남아 있어 import 후 `tsc --noEmit` 이 noUnusedLocals(TS6133) 없이 통과함을 확인한다. 만약 어느 symbol 이 삭제 후 참조 0(예상 밖)이면 T-1210 규칙("잔여 참조 없으면 미import, inline 정의만 삭제")을 동형 적용하고 근거 주석 명시.
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(llm-provider-update-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build`(`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 4종이 공용 helper 에서 정상 해석되어 base `api/llm/providers`(3-세그먼트) + `@Patch(":id")` path param 결합 → `/api/llm/providers/:id` template 이 유지되고 provider 수정 발사 happy-path 가 여전히 pass. `normalizeRoute(String(ROUTE))` → `/api/llm/providers`(L192)·`composeRoute`(L197)·`pathParams`(L200 `[':id']`)·`expectedPath`(L201 `/api/llm/providers/lp-1`)도 유지.
- [ ] error/negative path: base 오타·subPath drift(`:id`→bare 세그먼트 축소, L254)·method drift(@Put/@Post, L260/L261)·@Body decorator 존재 drift(L241 멀티라인/L243 bodyless)·주석 false-positive(negative (h))·빈 소스 유실(L287/L291) 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(spec 자체는 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.llm-provider-update-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(llm-provider-delete·schedule-*·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·auth-me 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지. 상이한 `extractHandlerMethods`·`pathParams` 를 공용에 맞추는 편집 금지(char-identical subset 정책상 inline 유지).
- 전용 `extractHandlerMethods`·`extractDtoFields`·`pathParams`·`expectedPath`·`diffContract`·`toFire` 등을 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`llm-provider-config.controller.ts`·`update-llm-provider-config.dto.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation contract-guard spec 이관 stream 계속. 남은 후보(9종): llm-provider-delete·schedule-trigger·schedule-apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·auth-me(본 slice 로 llm-provider-update 처리 후). 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. extractHandlerMethods 는 spec 별 inline hasBody/주석 편차가 커 대부분 제외 대상 — subset 크기는 4~5종 편차이므로 확인 필요.
