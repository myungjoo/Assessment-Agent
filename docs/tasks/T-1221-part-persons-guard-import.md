---
id: T-1221
title: part-persons-contract spec 의 char-identical 추출기 5종을 공용 helper import 로 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.part-persons-contract.test.ts]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — T-1220 Follow-up 지목 part-persons(GET :id/persons slice); char-identical 5종(composeRoute·extractControllerRoute·normalizeRoute·stripComments·stripQuery)을 T-1201 공용 helper import 로 교체, behavior-preserving.
---

# T-1221 — part-persons-contract spec 의 char-identical 추출기 5종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(T-1202~T-1208)에 이어 mutation slice 를 group-create(T-1209)~part-delete(T-1220)로 이어왔고, T-1220 Follow-up 이 남긴 후보 목록의 다음 항목 `AdminView.part-persons-contract.test.ts`(GET /api/parts/:id/persons 파트 소속 인원 조회 계약 guard)를 이번 slice 로 처리한다. 이 spec 은 mutation 이 아니라 GET 조회라서 `stripQuery`(`?_r=n` cache-buster strip)를 사용하므로 char-identical subset 이 **5종**(직전 4종 mutation slice 와 달리 GET-list 계열처럼 stripQuery 포함)이다. 이 5종만 import 로 교체하고 전용 추출기·타입(5-field `HandlerDecorator`·멀티라인 괄호매칭 `extractHandlerMethods`·`extractPersonsFireMethod`·`pathParams`·`expectedPath`·`diffContract`)은 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 5종(값/함수): `stripComments`(L10~16), `extractControllerRoute`(L19~22), `normalizeRoute`(L73), `composeRoute`(L76~79), `stripQuery`(L85). **주의**: 공용 `extractHandlerMethods`(L31~50)는 `HandlerDecorator` 가 `{method, subPath}` 2-field 이고 단일-라인 handler 만 처리 → 대상 spec(5-field HandlerDecorator·멀티라인 괄호균형 signature·hasBody/hasParam/hasQuery)과 상이하므로 import 하지 않는다. 공용 `extractHandlerParams`·`pathSegments`(`filter(Boolean)`) 도 이 spec 에서 미사용/전용(`pathParams` 는 `startsWith(':')` 필터라 공용 `pathSegments` 와 상이) → import 하지 않는다.
- `web/src/views/AdminView.part-persons-contract.test.ts` — 대상 spec. inline 추출기 위치(검증 완료):
  - char-identical(교체 대상 5종): `stripComments`(L16~22, 함수 본문 byte-identical, `export function` vs `function` + 뒤 trailing 주석만 차이), `extractControllerRoute`(L23~26), `normalizeRoute`(L95), `composeRoute`(L96~99), `stripQuery`(L101, 함수 본문 byte-identical, 뒤 trailing 주석만 차이) — 5종 모두 함수 본문이 공용과 byte-identical(`export` 접두/trailing 주석만 차이).
  - **전용/상이(inline 유지)**: `HandlerDecorator` interface(L27~33, 5-field)·`extractHandlerMethods`(L36~71, 멀티라인 괄호균형 + hasBody/hasParam/hasQuery → 교체 불가)·`extractPersonsFireMethod`(L75~82, 전용)·`BackendContract`(L83~90)·`WebFire`(L91~94)·`pathParams`(L100, `startsWith(':')` 전용)·`expectedPath`(L104~106)·`diffContract`(L109~). 이들은 import 로 바꾸지 않는다.
  - **잔여 참조 확인**(검증 완료 — 5종 삭제 후 spec 에 직접 참조가 남는다):
    - `stripComments`: inline `extractHandlerMethods`(L38)·`extractPersonsFireMethod`(L76)가 직접 호출(교체 대상 아님이라 잔존).
    - `extractControllerRoute`: L124·L280·L282·L294·L297.
    - `normalizeRoute`: L161(`expect(normalizeRoute(String(ROUTE)))`) 직접 참조 잔존.
    - `composeRoute`: L166·L189~195 + inline `expectedPath`(L105) 내부.
    - `stripQuery`: L114·L115·L213.
    - 따라서 5종 전부 import 후 tsc noUnusedLocals(TS6133) 미발생 예상. 단 삭제 후 `tsc --noEmit` 로 실검증한다.
  - **주의**: L5~14 파일 상단 R-112 guard 헤더 주석은 보존한다(함수-전용 주석이 아님). `stripComments`(L16)·`stripQuery`(L101)의 same-line trailing 주석은 함수 정의와 함께 삭제된다(함수-전용).
- `web/src/views/AdminView.difficulty-mapping-list-contract.test.ts`(L1~15) — 직전 5종 subset slice(T-1208)의 import 스타일 참조. 본 slice 는 동일한 5종 subset(composeRoute·extractControllerRoute·normalizeRoute·stripComments·stripQuery)이므로 import 블록 스타일을 mirror 한다.

## Acceptance Criteria

- [ ] `AdminView.part-persons-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute`·`stripQuery` 정의 5종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments, stripQuery`).
- [ ] `extractHandlerMethods`·`HandlerDecorator` interface(5-field)·`extractPersonsFireMethod` 는 inline 유지 — 멀티라인 괄호균형·hasBody 판정 추가로 공용과 상이하므로 import 로 바꾸지 않는다(공용 `extractHandlerMethods`/`extractHandlerParams` import 추가 금지).
- [ ] 전용 추출기·타입(`BackendContract`·`WebFire`·`pathParams`·`expectedPath`·`diffContract`)은 inline/기존 그대로 유지. `pathSegments`·`extractHandlerParams` import 추가 금지(pathParams 는 `startsWith(':')` 전용, extractHandlerParams 는 미사용).
- [ ] 파일 상단 R-112 guard 헤더 주석(L5~14)은 보존한다 — 함수-전용 주석이 아니므로 5종 삭제와 함께 지우지 않는다.
- [ ] 삭제한 5종 각각에 잔여 직접 참조가 남아 있어 import 후 `tsc --noEmit` 이 noUnusedLocals(TS6133) 없이 통과함을 확인한다. 만약 어느 symbol 이 삭제 후 참조 0(예상 밖)이면 T-1210 규칙("잔여 참조 없으면 미import, inline 정의만 삭제")을 동형 적용하고 근거 주석 명시.
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(part-persons-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 5종이 공용 helper 에서 정상 해석되어 base `api/parts` + `@Get(":id/persons")`(세그먼트 2) 합성 → `/api/parts/:id/persons` template 이 유지되고 파트 소속 인원 조회 발사 happy-path 가 여전히 pass. `normalizeRoute(ROUTE)` → `/api/parts`(L161)·3-way GET composeRoute(L189~191)·`stripQuery(fired.path)` → `${BASE}/p1/persons`(L213)도 유지.
- [ ] error/negative path: base 오타·subPath drift(`:id/persons` 부재/오타)·method drift·`extractControllerRoute` fake/빈 소스 null(L280·L294)·3-way GET 판별 오류·query strip 실패 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(spec 자체는 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.part-persons-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(llm-provider-create/update/delete·schedule-trigger/apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·auth-me 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지. 특히 상이한 5-field `extractHandlerMethods`·`pathParams` 를 공용에 맞추는 편집 금지(behavior 은 유사하나 char-identical subset 정책상 inline 유지).
- 전용 `extractHandlerMethods`·`extractPersonsFireMethod`·`pathParams`·`expectedPath`·`diffContract` 등을 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`part.controller.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation/GET contract-guard spec 이관 stream 계속. 남은 후보: llm-provider-create·llm-provider-update·llm-provider-delete·schedule-trigger·schedule-apply·role-change·instance-access·recent-deletion·difficulty-mapping-assign·group-members·auth-me 등. 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. GET 계열은 stripQuery 포함 5종, mutation 계열은 4종이 통상 subset 크기(extractHandlerMethods 는 spec 별 inline 편차가 커 대부분 제외 대상).
