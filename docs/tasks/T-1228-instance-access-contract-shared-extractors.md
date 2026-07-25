---
id: T-1228
title: instance-access 계약 guard spec char-identical 추출기 3종 공용 helper import 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-26
independentStream: contract-guard-dedup
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.instance-access-contract.test.ts]
plannerNote: P6 contract-guard dedup — instance-access(POST 부여/DELETE 회수) guard spec 의 글자-동일 추출기 3종(stripComments·extractControllerRoute·normalizeRoute)만 T-1201 helper import 로 교체, composeRoute 는 const base 변형이라 inline 유지
testCriteria:
  - 순수 test-only refactor — production 0 LOC. it 개수·describe/it 문자열·단언·coverage 완전 무변경.
  - pnpm --dir web test 로 AdminView.instance-access-contract.test.ts green 확인.
  - tsc --noEmit clean (TS6133 unused-import 0 — import 한 3종 전부 잔여 참조 있음).
---

# T-1228 — instance-access 계약 guard spec char-identical 추출기 3종 공용 helper import 교체

## Why

[PLAN.md](../PLAN.md) P6 contract-guard dedup stream 의 다음 slice 다. T-1201 이 신설한 공용 helper
`web/src/views/__contract-guard__/contract-extractors.ts` 로, 30+ 개 contract-guard spec 이 파일마다 복사해 들고 있던
invariant 추출기를 파일당 하나씩 이관한다. T-1227(auth-me) 완료 후 남은 INLINE contract-guard spec 중
instance-access(POST `/api/users/:id/instance-access` 부여 / DELETE 회수 계약 guard)를 처리한다.
README 112행(R-112)의 test invariant 를 손대지 않고 **글자-동일 중복만** 제거하는 순수 test-only refactor 다.

## Required Reading

- `web/src/views/AdminView.instance-access-contract.test.ts` — 이관 대상 spec. inline 추출기 정의는 L42~138 사이에 spec 전용 함수와 뒤섞여 있음.
- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 helper(import 원본). 특히 `stripComments` L10~16, `extractControllerRoute` L19~22, `normalizeRoute` L73, `composeRoute` L76~79.
- `web/src/views/AdminView.persons-list-contract.test.ts` L1~13 — 이관 완료 sibling 의 import 스타일(alphabetical named import, 주석 형식) 참조. 단 persons-list 는 composeRoute 를 import 했으나(그쪽 inline 은 글자-동일), instance-access 는 composeRoute inline 이 변형이라 제외한다(아래 참조).

## 검증된 이관 범위 (planner 사전 byte-diff + 참조 분석 완료)

planner 가 instance-access inline 정의를 공용 helper 와 byte-diff 하고 참조 그래프를 분석한 결과, 실제 import 대상은 아래 **3종만**이다. 이 slice 의 sharp edge 는 **T-1227 과 정반대로 `normalizeRoute` 가 import 대상**이라는 점이다.

- **import (3종, alphabetical) — 글자-동일 + 삭제 후에도 잔여 직접 참조 있음**:
  - `stripComments` — helper L10~16 과 body 글자-동일. inline `extractControllerRoute` 삭제 후에도 **inline 유지되는** `extractHandlerMethods`(L69)·`extractDtoFields`(L97) 가 계속 참조 → import 필요.
  - `extractControllerRoute` — helper L19~22 와 글자-동일. 참조: L182(`ROUTE=`)·L382·L424·L430 → import 필요.
  - `normalizeRoute` — helper L73 과 글자-동일. 참조: **test body L273·L317·L410 이 직접 호출** + inline 유지되는 composeRoute(L135) → import 필요. **T-1227 과의 반전**: T-1227 에서는 normalizeRoute 의 유일 참조가 inline composeRoute 뿐이라 composeRoute 를 import 로 교체하면 참조가 소멸(orphan)해 import 하지 않았다. 여기서는 normalizeRoute 가 test body 에서 직접 3회 호출되므로 반드시 import 한다.
- **inline-deleted-but-not-imported (orphan) — 이번 slice 엔 없음**: T-1227 의 normalizeRoute 같은 orphan 케이스는 본 slice 에 존재하지 않는다. 삭제하는 3종 전부 잔여 참조가 있어 그대로 import 대상이다.
- **inline 유지 (helper 와 NOT 글자-동일 — 변형)**: `composeRoute`(L134~138). inline 은 `const base = normalizeRoute(route)` 지역변수 변형으로, helper(L76~79, `normalizeRoute(route)` 를 2회 인라인 호출)와 **동작은 동일하나 body 글자-동일이 아니다**. 본 stream 의 char-identical 안전 규율상 import 대상에서 제외하고 inline 유지한다. inline composeRoute 는 import 한 `normalizeRoute` 를 계속 호출하므로(L135) import 는 여전히 참조됨.
- **inline 유지 (handler 추출기 family / spec 전용, helper 와 무관하거나 stream 관례상 inline)**: `HandlerDecorator`·`extractHandlerMethods`(stream 관례상 handler 추출기 inline 유지)·`extractDtoFields`·`DtoFields`·`BackendContract`·`WebFire`·`expectedPath`·`diffContract`·`toFire`·`fireGrant`·`fireRevoke`. 삭제 대상 아님.

## Acceptance Criteria

- [ ] `AdminView.instance-access-contract.test.ts` 의 inline 추출기 중 **공용 helper 와 글자-동일하고 삭제 후 잔여 참조가 남는 3종** `stripComments`(L44~50)·`extractControllerRoute`(L53~56)·`normalizeRoute`(L130) 의 inline 정의를 삭제하고 `./__contract-guard__/contract-extractors` 에서 alphabetical named import(`extractControllerRoute`·`normalizeRoute`·`stripComments`)로 교체한다.
- [ ] `composeRoute`(L134~138) inline 정의는 **삭제하지 않고 유지한다** — helper 와 body 글자-동일이 아닌 `const base` 변형이므로 char-identical dedup 범위 밖. import 목록에 composeRoute 를 넣지 말 것.
- [ ] handler 추출기·spec 전용 함수는 inline 유지: `HandlerDecorator`·`extractHandlerMethods`·`extractDtoFields`·`DtoFields`·`BackendContract`·`WebFire`·`expectedPath`·`diffContract`·`toFire`·`fireGrant`·`fireRevoke`.
- [ ] import 한 3종 모두 spec 안에 잔여 직접 참조가 있어 TS6133 unused-import 0 (검증: `stripComments`→inline extractHandlerMethods L69·extractDtoFields L97, `extractControllerRoute`→L182/L382/L424/L430, `normalizeRoute`→inline composeRoute L135·test body L273/L317/L410).
- [ ] `pnpm --dir web exec tsc --noEmit` clean (TS6133 없음).
- [ ] `pnpm --dir web test` 로 대상 spec **전체 it green**, describe/it 문자열·단언·test 개수 완전 무변경 (순수 dedup — 동작·coverage 불변).
- [ ] production code(`src/`) 변경 0 LOC — 순수 test-only refactor.
- [ ] Happy-path: 이관 후에도 정상 계약(ROUTE·HANDLER_METHODS·DTO_FIELDS 추출)이 기존과 동일하게 통과함을 기존 spec 의 happy 케이스(L261~309)로 확인(신규 test 추가 불필요 — 기존 test 가 이미 3종 cover).
- [ ] Error/negative path: 기존 spec 의 negative 케이스(빈 소스→extractControllerRoute null·주석뿐 false-positive·route 이동·POST↔DELETE swap·경로 주입 L380~437)가 import 교체 후에도 동일하게 통과함을 확인(추출기 동작 byte-identical 이므로 무변경).
- [ ] 분기 cover: 본 task 는 로직 분기를 추가·수정하지 않음(순수 import 교체) — 신규 분기 없음, 기존 분기 test 그대로 유지.

## Out of Scope

- 공용 helper `contract-extractors.ts` 자체 수정 (import 만; 정의 변경 금지).
- `composeRoute` inline 정의 삭제·import 교체 (helper 와 글자-동일 아님 — 변형; 본 slice 명시 제외).
- inline 유지 대상(`extractHandlerMethods`·`extractDtoFields`·`diffContract` 등) 의 helper 이관 — handler 추출기는 stream 관례상 inline 유지, 나머지는 spec 전용.
- 다른 contract-guard spec(recent-deletion·role-change·schedule-apply·schedule-trigger 등 남은 INLINE) 이관 — 각각 별도 slice.
- production code / 계약 로직 변경. test 개수·단언·describe/it 문자열 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 남은 INLINE contract-guard spec: recent-deletion·role-change·schedule-apply·schedule-trigger — 각각 char-identical subset + 참조 분석(정의 삭제 시 참조 소멸/orphan 여부) 검증 후 후속 slice 로.
- instance-access 의 inline `composeRoute` 는 helper 와 동작 동일하나 `const base` 변형이라 이번 slice 에서 제외했다. helper 변형(normalizeRoute 2회 인라인)을 canonical 로 채택할지, spec 을 helper 변형에 맞출지 정리 후 별도 slice 에서 composeRoute 도 import 로 통합할지 검토.
