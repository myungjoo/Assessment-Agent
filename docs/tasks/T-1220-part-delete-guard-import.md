---
id: T-1220
title: part-delete-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.part-delete-contract.test.ts]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — T-1219 Follow-up 지목 part-delete(mutation slice 12); char-identical 4종(composeRoute·extractControllerRoute·normalizeRoute·stripComments)을 T-1201 공용 helper import 로 교체, behavior-preserving.
---

# T-1220 — part-delete-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(T-1202~T-1208)에 이어 mutation slice 를 group-create(T-1209)·create-user(T-1210)·group-update(T-1211)·group-delete(T-1212)·group-member-add(T-1213)·group-member-remove(T-1214)·person-create(T-1215)·person-update(T-1216)·person-delete(T-1217)·part-create(T-1218)·part-update(T-1219)로 이어왔고, T-1219 Follow-up 이 남긴 후보 목록의 다음 항목 `AdminView.part-delete-contract.test.ts`(DELETE /api/parts/:id 계약 guard)를 이번 slice 로 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 4종만** import 로 교체하고 전용 추출기·타입(`extractHandlerMethods`·`HandlerDecorator`·`handlerHasBody`·`pathParams`·`expectedPath`·`diffContract`·`toFire`)은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다. part-update(T-1219)/part-create(T-1218) mutation slice 와 동일하게 이 spec 의 `extractHandlerMethods` 는 inline 편차(주석·`handlerHasBody` 별도 판정 helper)가 있어 공용과 상이하므로 교체 대상에서 제외한다(char-identical 아님) — 동형 subset 이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 4종(값 함수): `stripComments`(L10~16), `extractControllerRoute`(L19~22), `normalizeRoute`(L73), `composeRoute`(L76~79). **주의**: 공용 `extractHandlerMethods`(L31~50)는 대상 spec 의 inline 버전과 주석·shape 이 상이 → import 하지 않는다. 공용 `extractHandlerParams`·`pathSegments`(`filter(Boolean)`)·`stripQuery` 도 이 spec 에서 미사용/전용(`pathParams` 는 `startsWith(':')` 필터라 공용 `pathSegments` 와 상이) → import 하지 않는다.
- `web/src/views/AdminView.part-delete-contract.test.ts` — 대상 spec(총 276행). inline 추출기 위치(검증 완료):
  - char-identical(교체 대상 4종): `stripComments`(L17~23), `extractControllerRoute`(L25~28), `normalizeRoute`(L83), `composeRoute`(L85~88) — 함수 본문이 공용과 byte-identical(`export` 접두만 차이).
  - **전용/상이(inline 유지)**: `HandlerDecorator` interface(L30~34)·`extractHandlerMethods`(L36~57)·`handlerHasBody`(L59~)·`pathParams`(L90, `startsWith(':')` 전용)·`expectedPath`(L92~95)·`diffContract`(L97~135)·`toFire`(L136~). 이들은 import 로 바꾸지 않는다.
  - **잔여 참조 확인**(검증 완료 — 4종 삭제 후 spec 에 직접 참조가 남는다 → TS6133 미발생):
    - `stripComments`: inline `extractControllerRoute`(L26)·`extractHandlerMethods`(L39)·`handlerHasBody`(L60)가 직접 호출.
    - `extractControllerRoute`: L126·L255·L259·L265·L269.
    - `normalizeRoute`: inline `composeRoute`(L87) 내부 + L178.
    - `composeRoute`: inline `expectedPath`(L93) 내부 + L183.
    - 따라서 4종 전부 import 후 tsc noUnusedLocals(TS6133) 미발생 예상. 단 삭제 후 `tsc --noEmit` 로 실검증한다.
  - **주의**: L7~15 파일 상단 R-112 guard 헤더 주석은 보존한다(함수-전용 주석이 아님). 단 L16 의 한 줄 주석(`// 주석 제거 — 추출이 주석 문구를 잡으면...`)은 `stripComments`(L17) 정의 직전의 함수-전용 주석이므로 함수와 함께 삭제한다(T-1218 패턴 mirror). 다른 함수 직전 주석이 있으면 그 함수를 삭제할 때만 함께 삭제 — inline 유지 함수의 주석은 보존.
- `web/src/views/AdminView.part-update-contract.test.ts`(L1~15) — 직전 mutation slice(T-1219)의 import 스타일 참조. 본 slice 는 동일한 4종 subset(composeRoute·extractControllerRoute·normalizeRoute·stripComments, extractHandlerMethods 제외)이므로 import 블록·삭제 패턴을 그대로 mirror 한다.

## Acceptance Criteria

- [ ] `AdminView.part-delete-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute` 정의 4종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments`), T-1219 의 주석/import 스타일 mirror.
- [ ] `extractHandlerMethods`·`HandlerDecorator` interface·`handlerHasBody` 는 inline 유지 — 공용과 상이하므로 import 로 바꾸지 않는다(공용 `extractHandlerMethods` import 추가 금지).
- [ ] 전용 추출기·타입(`pathParams`·`expectedPath`·`diffContract`·`toFire`)은 inline/기존 그대로 유지. `stripQuery`·`extractHandlerParams`·`pathSegments` import 추가 금지(이 spec 에 부재/미사용, pathParams 는 전용).
- [ ] 파일 상단 R-112 guard 헤더 주석(L7~15)은 보존한다. `stripComments` 직전의 함수-전용 주석(L16)은 함수와 함께 삭제한다.
- [ ] 삭제한 4종 각각에 잔여 직접 참조가 남아 있어 import 후 `tsc --noEmit` 이 noUnusedLocals(TS6133) 없이 통과함을 확인한다. 만약 어느 symbol 이 삭제 후 참조 0(예상 밖)이면 T-1210 규칙("잔여 참조 없으면 미import, inline 정의만 삭제")을 동형 적용하고 근거 주석 명시.
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(part-delete-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 4종이 공용 helper 에서 정상 해석되어 base `api/parts` + `@Delete(":id")`(param 1) 합성 → `/api/parts/:id` template(id → encodeURIComponent)이 유지되고 파트 삭제 발사 happy-path 가 여전히 pass. `normalizeRoute(ROUTE)` → `/api/parts`(L178)·`composeRoute` → `/api/parts/:id`(L183)도 유지.
- [ ] error/negative path: base 오타(api/part·api/parties)·subPath drift(`:id` 부재/오타)·method drift(@Post/@Put/@Patch)·@Body decorator 존재 drift·주석 false-positive(L16 negative)·빈 소스 유실(L265) 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(spec 자체는 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.part-delete-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(part-persons·llm-provider-create/update/delete·schedule-* 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지. 특히 상이한 `extractHandlerMethods`·`pathParams` 를 공용에 맞추는 편집 금지(behavior 은 유사하나 char-identical subset 정책상 inline 유지).
- 전용 `extractHandlerMethods`·`handlerHasBody`·`pathParams`·`expectedPath`·`diffContract`·`toFire` 등을 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`part.controller.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation contract-guard spec 이관 stream 계속. 남은 후보: part-persons·llm-provider-create/update/delete·schedule-trigger/apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·auth-me 등. 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. extractHandlerMethods 는 spec 별 inline hasBody/주석 편차가 커 대부분 제외 대상 — subset 크기는 3~5종 편차이므로 확인 필요.
