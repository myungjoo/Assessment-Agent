---
id: T-1210
title: create-user-contract spec 의 char-identical 추출기 5종을 공용 helper import 로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.create-user-contract.test.ts]
estimatedDiff: 35
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — T-1209 Follow-up 첫 지목 create-user(mutation slice 2); char-identical 5종(extractHandlerMethods 포함)을 T-1201 공용 helper import 로 교체, behavior-preserving.
---

# T-1210 — create-user-contract spec 의 char-identical 추출기 5종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(T-1202~T-1208)에 이어 mutation slice 를 T-1209(group-create)로 시작했고, 그 Follow-up 이 첫 후보로 지목한 `AdminView.create-user-contract.test.ts`(POST /api/users 계약 guard)를 이번 slice 로 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 5종만** import 로 교체하고 전용 추출기·타입은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다. group-create(T-1209)와 달리 이 spec 의 `extractHandlerMethods` 는 함수 본문+inline 주석(`@HttpCode/@UseGuards/@Roles`)까지 공용과 byte-identical 이라 교체 대상에 포함된다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 5종(값 함수): `stripComments`(L10~16), `extractControllerRoute`(L19~22), `extractHandlerMethods`(L31~50), `normalizeRoute`(L73), `composeRoute`(L76~79). **주의**: 공용 `extractHandlerParams`·`pathSegments`·`stripQuery` 는 이 spec 에 부재하거나 미사용 → import 하지 않는다.
- `web/src/views/AdminView.create-user-contract.test.ts` — 대상 spec. inline 추출기 위치:
  - char-identical(교체 대상 5종): `stripComments`(L17~23), `extractControllerRoute`(L25~28), `extractHandlerMethods`(L37~56, inline 주석 L47 `@HttpCode/@UseGuards/@Roles` 가 공용 L41 과 byte-identical — 교체 가능), `normalizeRoute`(L94), `composeRoute`(L96~99).
  - **전용(inline 유지)**: `DtoFields` interface + `extractDtoFields`(L58~79, create-user 전용 DTO 필드 추출 — 공용에 없음)·`BackendContract`/`WebFire` 타입(L81~93)·`diffContract`(L101~122). 이들은 import 로 바꾸지 않는다.
  - **`HandlerDecorator` interface(L31~34)**: 공용에도 동일 export 가 있으나, extractHandlerMethods 를 import 로 교체한 뒤 이 파일에 `HandlerDecorator` 타입 참조가 남아있는지 확인한다. 남아있으면 `import { type HandlerDecorator }` 로 함께 import, 남아있지 않으면(BackendContract 는 method/subPath 를 분리 필드로 들고 handler 변수는 구조적 타이핑이라 대개 미참조) interface 정의만 삭제하고 import 하지 않는다.
- `web/src/views/AdminView.groups-list-contract.test.ts` (L1~13) — 직전 slice 의 import 스타일 참조. char-identical subset 을 alphabetical named import + inline 삭제 주석 패턴을 그대로 따른다. 단 본 slice 는 GET-list 와 달리 `stripQuery` 를 포함하지 않고 `extractHandlerMethods` 를 포함한다.

## Acceptance Criteria

- [ ] `AdminView.create-user-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`extractHandlerMethods`·`normalizeRoute`·`composeRoute` 정의 5종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, extractHandlerMethods, normalizeRoute, stripComments`), T-1205 의 주석 스타일 mirror.
- [ ] `HandlerDecorator` interface 는 extractHandlerMethods import 교체 후 잔여 참조 유무에 따라 처리: 참조 남으면 `type HandlerDecorator` 를 import 에 추가, 없으면 local interface 정의만 삭제(신규 import 불요). 잔여 참조 판정은 삭제 후 `tsc --noEmit` 통과로 검증.
- [ ] 전용 추출기·타입(`DtoFields`·`extractDtoFields`·`BackendContract`·`WebFire`·`diffContract`)은 inline/기존 그대로 유지 — import 로 바꾸지 않는다(공용에 없음). `stripQuery`·`extractHandlerParams`·`pathSegments` import 추가 금지(이 spec 에 부재/미사용).
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(create-user-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 5종이 공용 helper 에서 정상 해석되어 base `api/users` bare `@Post()` 합성 → `/api/users` POST 계약 일치 케이스(L189)가 여전히 pass. 다중 required(email·password) 부분집합 대조(L192)도 유지.
- [ ] error/negative path: route drift(negative (a) `@Post(":id")`)·method drift(negative (b) `@Put`)·초과 키/필수 누락(negative (c)(d))·DTO 축소 drift(negative (e))·body 부재(negative (f))·주석 false-positive(negative (g) `// @Post()`)·소스 유실 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(즉 spec 자체가 여전히 통과 — 대조 로직 불변). 특히 교체된 `extractHandlerMethods` 가 주석줄 `@Post()` 를 method 로 오인하지 않는 negative (g)(L236)가 그대로 pass 하는지 확인.
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.create-user-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(group-update/delete, person-create 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지.
- 전용 `extractDtoFields`·`diffContract` 등을 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`user.controller.ts`·`add-user.dto.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation contract-guard spec 이관 stream 계속. 남은 후보: group-update·group-delete·group-member-add/remove·person-create/update/delete·part-create/update/delete·llm-provider-create/update/delete·schedule-trigger/apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·part-persons·auth-me 등. 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. mutation spec 은 richer 변형·전용 추출기 비중이 커 slice 별 char-identical subset 크기가 4~6종으로 편차가 있으므로 확인 필요.
