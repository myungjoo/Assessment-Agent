---
id: T-1218
title: part-create-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.part-create-contract.test.ts]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — T-1217 Follow-up 지목 part-create(mutation slice 10); char-identical 4종(composeRoute·extractControllerRoute·normalizeRoute·stripComments)을 T-1201 공용 helper import 로 교체, behavior-preserving.
---

# T-1218 — part-create-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(T-1202~T-1208)에 이어 mutation slice 를 group-create(T-1209)·create-user(T-1210)·group-update(T-1211)·group-delete(T-1212)·group-member-add(T-1213)·group-member-remove(T-1214)·person-create(T-1215)·person-update(T-1216)·person-delete(T-1217)로 이어왔고, T-1217 Follow-up 이 남긴 후보 목록의 첫 항목 `AdminView.part-create-contract.test.ts`(POST /api/parts 계약 guard)를 이번 slice 로 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 4종만** import 로 교체하고 전용 추출기·타입(hasBody 필드를 가진 `extractHandlerMethods`·`HandlerDecorator`·`extractDtoFields`·`pathParams`·`diffContract`·`toFire`)은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다. person-create(T-1215)/create-part 계열 mutation slice 와 동일하게 이 spec 의 `extractHandlerMethods` 는 inline 에 `hasBody: /@Body\b/.test(line)` 판정을 추가로 담고 있어 공용(hasBody 없음)과 상이하므로 교체 대상에서 제외한다(char-identical 아님) — 동형 subset 이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 4종(값 함수): `stripComments`(L10~16), `extractControllerRoute`(L19~22), `normalizeRoute`(L73), `composeRoute`(L76~79). **주의**: 공용 `extractHandlerMethods`(L31~50)는 반환 shape 에 `hasBody` 가 없어 대상 spec(inline `HandlerDecorator.hasBody` + L45 `hasBody: /@Body\b/.test(line)`)과 상이 → import 하지 않는다. 공용 `extractHandlerParams`·`pathSegments`(`filter(Boolean)`)·`stripQuery` 도 이 spec 에서 미사용/전용(`pathParams` 는 `startsWith(':')` 필터라 공용 `pathSegments` 와 상이) → import 하지 않는다.
- `web/src/views/AdminView.part-create-contract.test.ts` — 대상 spec. inline 추출기 위치(검증 완료):
  - char-identical(교체 대상 4종): `stripComments`(L14~20), `extractControllerRoute`(L21~24), `normalizeRoute`(L89), `composeRoute`(L90~93) — 함수 본문이 공용과 byte-identical(`export` 접두만 차이).
  - **전용/상이(inline 유지)**: `HandlerDecorator` interface(L26~30, `hasBody` 필드 有)·`extractHandlerMethods`(L31~50, hasBody 판정 추가 → 교체 불가)·`extractDtoFields`(L55~72)·`DtoFields`(L51~54)·`BackendContract`(L74~81)·`WebFire`(L82~88)·`pathParams`(L94, `startsWith(':')` 전용)·`diffContract`(L96~123)·`toFire`(L138~148). 이들은 import 로 바꾸지 않는다.
  - **잔여 참조 확인**: 4종 삭제 후 spec 에 직접 참조가 남는다 — `stripComments`(inline `extractControllerRoute`(import 됨)·`extractHandlerMethods` L34·`extractDtoFields` L56 가 직접 호출), `extractControllerRoute`(L127·L275·L279·L285·L290), `normalizeRoute`(L180 `expect(normalizeRoute(String(ROUTE)))` + inline `composeRoute` 내부), `composeRoute`(L185·L192·L242 + inline `diffContract` L101 내부). 따라서 4종 전부 import 후 tsc noUnusedLocals(TS6133) 미발생 예상. 단 삭제 후 `tsc --noEmit` 로 실검증한다.
  - **주의**: L13 은 함수 직전 한 줄 주석(`// 주석 제거 — 추출이 주석 문구를...`)이므로 inline `stripComments` 정의와 함께 삭제한다. L7~11 파일 상단 R-112 guard 헤더 주석은 보존한다.
- `web/src/views/AdminView.person-delete-contract.test.ts`(L1~15) — 직전 mutation slice(T-1217)의 import 스타일 참조. 본 slice 는 동일한 4종 subset(composeRoute·extractControllerRoute·normalizeRoute·stripComments, extractHandlerMethods 제외)이므로 import 블록·삭제 패턴을 그대로 mirror 한다.

## Acceptance Criteria

- [ ] `AdminView.part-create-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute` 정의 4종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments`), T-1217 의 주석/import 스타일 mirror.
- [ ] `extractHandlerMethods`·`HandlerDecorator` interface(hasBody 필드)·`extractDtoFields`·`DtoFields` 는 inline 유지 — hasBody 판정 추가로 공용과 상이하므로 import 로 바꾸지 않는다(공용 import 추가 금지).
- [ ] 전용 추출기·타입(`BackendContract`·`WebFire`·`pathParams`·`diffContract`·`toFire`)은 inline/기존 그대로 유지. `stripQuery`·`extractHandlerParams`·`pathSegments` import 추가 금지(이 spec 에 부재/미사용, pathParams 는 전용).
- [ ] 파일 상단 R-112 guard 헤더 주석(L7~11)은 보존한다 — 함수-전용 주석이 아니므로 4종 삭제와 함께 지우지 않는다. 단 inline `stripComments` 직전 한 줄 주석(L13)은 정의와 함께 삭제.
- [ ] 삭제한 4종 각각에 잔여 직접 참조가 남아 있어 import 후 `tsc --noEmit` 이 noUnusedLocals(TS6133) 없이 통과함을 확인한다. 만약 어느 symbol 이 삭제 후 참조 0(예상 밖)이면 T-1210 규칙("잔여 참조 없으면 미import, inline 정의만 삭제")을 동형 적용하고 근거 주석 명시.
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(part-create-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 4종이 공용 helper 에서 정상 해석되어 base `api/parts` + bare `@Post()`(세그먼트 0) 합성 → `/api/parts`(path param 0개) template 이 유지되고 파트 생성 발사 happy-path 가 여전히 pass. `normalizeRoute(ROUTE)` → `/api/parts`(L180)·`composeRoute` → base 자체(L185)도 유지.
- [ ] error/negative path: base 오타(api/part·api/parties)·세그먼트 초과(@Post(":id"))·method drift(@Patch/@Delete)·required 누락(code 추가)·whitelist 밖 필드(foo)·@Body 제거 drift·Content-Type 누락·주석 false-positive(L272)·빈 소스 유실(L284) 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(spec 자체는 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.part-create-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(part-update/delete·part-persons·llm-provider-create/update/delete·schedule-* 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지. 특히 상이한 `extractHandlerMethods` hasBody 판정·`pathParams` 를 공용에 맞추는 편집 금지(behavior 은 유사하나 char-identical subset 정책상 inline 유지).
- 전용 `extractHandlerMethods`·`extractDtoFields`·`pathParams`·`diffContract` 등을 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`part.controller.ts`·`create-part.dto.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation contract-guard spec 이관 stream 계속. 남은 후보: part-update/delete·part-persons·llm-provider-create/update/delete·schedule-trigger/apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·auth-me 등. 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. extractHandlerMethods 는 spec 별 inline hasBody/주석 편차가 커 대부분 제외 대상 — subset 크기는 3~5종 편차이므로 확인 필요.
