---
id: T-1216
title: person-update-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.person-update-contract.test.ts]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — T-1215 Follow-up 지목 person-update(mutation slice 8); char-identical 4종(composeRoute·extractControllerRoute·normalizeRoute·stripComments)을 T-1201 공용 helper import 로 교체, behavior-preserving.
---

# T-1216 — person-update-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(T-1202~T-1208)에 이어 mutation slice 를 group-create(T-1209)·create-user(T-1210)·group-update(T-1211)·group-delete(T-1212)·group-member-add(T-1213)·group-member-remove(T-1214)·person-create(T-1215)로 이어왔고, T-1215 Follow-up 이 남긴 후보 목록의 첫 항목 `AdminView.person-update-contract.test.ts`(PATCH /api/persons/:id 계약 guard)를 이번 slice 로 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 4종만** import 로 교체하고 전용 추출기·타입(hasBody/param/DTO 축)은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다. person-create(T-1215)/create-user(T-1210)와 동일하게 이 spec 의 `extractHandlerMethods` 는 body-요구 계약을 위해 `hasBody` 필드를 반환하고 다중-줄 시그니처 스캔 로직 + inline 주석(`@HttpCode/@UsePipes/@Param`)이 공용(`@HttpCode/@UseGuards/@Roles`, 단일-줄)과 상이하므로 교체 대상에서 제외한다(char-identical 아님) — 동형 subset 이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 4종(값 함수): `stripComments`(L10~16), `extractControllerRoute`(L19~22), `normalizeRoute`(L73), `composeRoute`(L76~79). **주의**: 공용 `extractHandlerMethods`(L31~50)는 `HandlerDecorator`가 `{method, subPath}`만 반환하고 단일-줄 시그니처만 보나 대상 spec 은 `{method, subPath, hasBody}`(다중-줄 시그니처 스캔으로 `@Body` 존재 추출)로 시그니처·본문이 상이하고 주석(L41 `@HttpCode/@UseGuards/@Roles`)도 spec(L39 `@HttpCode/@UsePipes/@Param`)과 상이해 char-identical 아님 → import 하지 않는다. 공용 `extractHandlerParams`·`pathSegments`·`stripQuery` 도 이 spec 에 부재/미사용 → import 하지 않는다.
- `web/src/views/AdminView.person-update-contract.test.ts` — 대상 spec. inline 추출기 위치(검증 완료):
  - char-identical(교체 대상 4종): `stripComments`(L11~17), `extractControllerRoute`(L18~21), `normalizeRoute`(L95), `composeRoute`(L96~99) — 함수 본문이 공용과 byte-identical(`export` 접두만 차이). **주의**: L7~10 은 함수별 주석이 아니라 파일 상단 R-112 guard 헤더 주석(spec 전체 설명)이므로 삭제 대상 아님 — inline stripComments 직전에 함수-전용 주석은 없다.
  - **전용/상이(inline 유지)**: `HandlerDecorator` interface(L22~26, `hasBody` 추가)·`extractHandlerMethods`(L27~56, `hasBody` 반환 + 다중-줄 시그니처 스캔 + 주석 L39 상이 → 교체 불가)·`DtoFields` interface(L57~60)·`extractDtoFields`(L61~78)·`BackendContract`(L79~86)·`WebFire`(L87~94)·`pathParams`(L100)·`expectedPath`(L101~103)·`diffContract`(L104~131)·`toFire`(L148~160). 이들은 import 로 바꾸지 않는다.
  - **잔여 참조 확인**: 4종 삭제 후 spec 에 직접 참조가 남는다 — `stripComments`(inline `extractHandlerMethods` L29·`extractDtoFields` L62 가 직접 호출), `extractControllerRoute`(L134·L277·L281·L287·L291), `normalizeRoute`(L191 직접 `expect(normalizeRoute(String(ROUTE)))`), `composeRoute`(L102 `expectedPath` 내부 + L196). 따라서 4종 전부 import 후 tsc noUnusedLocals(TS6133) 미발생 예상. 단 삭제 후 `tsc --noEmit` 로 실검증한다.
- `web/src/views/AdminView.person-create-contract.test.ts`(L1~15) — 직전 mutation slice(T-1215)의 import 스타일 참조. 본 slice 는 동일한 4종 subset(composeRoute·extractControllerRoute·normalizeRoute·stripComments, extractHandlerMethods 제외)이므로 import 블록·삭제 패턴을 그대로 mirror 한다.

## Acceptance Criteria

- [ ] `AdminView.person-update-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute` 정의 4종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments`), T-1215 의 주석/import 스타일 mirror.
- [ ] `extractHandlerMethods`·`HandlerDecorator` interface 는 inline 유지 — `hasBody` 필드·다중-줄 시그니처 스캔·주석(`@HttpCode/@UsePipes/@Param`)이 공용과 상이해 char-identical 아니므로 import 로 바꾸지 않는다(공용 import 추가 금지).
- [ ] 전용 추출기·타입(`DtoFields`·`extractDtoFields`·`BackendContract`·`WebFire`·`pathParams`·`expectedPath`·`diffContract`·`toFire`)은 inline/기존 그대로 유지. `stripQuery`·`extractHandlerParams`·`pathSegments` import 추가 금지(이 spec 에 부재/미사용).
- [ ] 파일 상단 R-112 guard 헤더 주석(L7~10)은 보존한다 — 함수-전용 주석이 아니므로 4종 삭제와 함께 지우지 않는다.
- [ ] 삭제한 4종 각각에 잔여 직접 참조가 남아 있어 import 후 `tsc --noEmit` 이 noUnusedLocals(TS6133) 없이 통과함을 확인한다. 만약 어느 symbol 이 삭제 후 참조 0(예상 밖)이면 T-1210 규칙("잔여 참조 없으면 미import, inline 정의만 삭제")을 동형 적용하고 근거 주석 명시.
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(person-update-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 4종이 공용 helper 에서 정상 해석되어 base `api/persons` + `@Patch(":id")` 합성 → `/api/persons/:id`(path param 1개) template 이 유지되고 인원 수정 발사 happy-path 가 여전히 pass. `normalizeRoute(ROUTE)` → `/api/persons`(L191)·`composeRoute` → `:id` 결합(L196)도 유지.
- [ ] error/negative path: base 오타(api/person·api/people)·param 제거(bare @Patch())·세그먼트 초과(archive/:id)·method drift(@Put/@Post)·rename 후 옛 key·미허용 key·@Body 제거·Content-Type 누락·주석 false-positive(L274 `extractControllerRoute`/`extractHandlerMethods` 가 주석줄을 실 decorator 로 오인하지 않음)·빈 소스 유실(L286) 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(spec 자체는 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.person-update-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(person-delete, part-* 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지. 특히 상이 주석/`hasBody`/다중-줄 스캔을 공용에 맞추는 편집 금지(behavior 은 유사하나 char-identical subset 정책상 inline 유지). 공용 `extractHandlerMethods` 에 `hasBody` 를 추가하는 편집도 금지(spec-특화 body 계약).
- 전용 `extractHandlerMethods`(hasBody 판)·`extractDtoFields`·`diffContract`·`expectedPath`·`pathParams` 등을 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`person.controller.ts`·`update-person.dto.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation contract-guard spec 이관 stream 계속. 남은 후보: person-delete·part-create/update/delete·llm-provider-create/update/delete·schedule-trigger/apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·part-persons·auth-me 등. 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. extractHandlerMethods 는 spec 별 inline 주석·시그니처(hasBody 등) 편차가 커 대부분 제외 대상 — subset 크기는 3~5종 편차이므로 확인 필요.
