---
id: T-1227
title: auth-me 계약 guard spec char-identical 추출기 5종 공용 helper import 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 15
estimatedFiles: 1
created: 2026-07-26
independentStream: contract-guard-dedup
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.auth-me-contract.test.ts]
plannerNote: P6 contract-guard dedup — auth-me(GET /api/auth/me) guard spec 의 글자-동일 추출기 5종을 T-1201 helper import 로 교체, normalizeRoute 는 composeRoute 내부 전용이라 제외
testCriteria:
  - 순수 test-only refactor — production 0 LOC. it 개수·describe/it 문자열·단언·coverage 완전 무변경.
  - pnpm --dir web test 로 AdminView.auth-me-contract.test.ts green 확인.
  - tsc --noEmit clean (TS6133 unused-import 0 — normalizeRoute 는 import 하지 않음: composeRoute inline 삭제 시 유일 참조 소멸).
---

# T-1227 — auth-me 계약 guard spec char-identical 추출기 5종 공용 helper import 교체

## Why

[PLAN.md](../PLAN.md) P6 contract-guard dedup stream 의 다음 slice 다. T-1201 이 신설한 공용 helper
`web/src/views/__contract-guard__/contract-extractors.ts` 로 30+ 개 contract-guard spec 이 파일마다 복사해 들고 있던
invariant 추출기를 파일당 하나씩 이관한다. mutation CRUD 계열(T-1207~T-1226) 이관 완료 후, 남은 INLINE contract-guard spec 중
auth-me(GET `/api/auth/me` read 계약 guard)를 처리한다. README 112행(R-112)의 test invariant 를 손대지 않고 중복만 제거하는
순수 test-only refactor 다.

## Required Reading

- `web/src/views/AdminView.auth-me-contract.test.ts` — 이관 대상 spec. 현재 inline 추출기 정의는 L17~102 사이에 spec 전용 함수와 뒤섞여 있음.
- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 helper (import 원본). 특히 `composeRoute`·`extractControllerRoute`·`pathSegments`·`stripComments`·`stripQuery` L10~85.
- `web/src/views/AdminView.persons-list-contract.test.ts` L1~14 — 이관 완료 sibling 의 import 스타일(alphabetical named import, 주석 형식) 참조. auth-me 는 여기에 `pathSegments` 만 추가된 형태.

## 검증된 이관 범위 (planner 사전 byte-diff 완료)

planner 가 auth-me inline 정의 8종을 helper 와 byte-diff 한 결과 전부 body 글자-동일이나, **stream 관례(handler 추출기 inline 유지) + 참조 분석**으로 실제 import 대상은 아래 5종이다:

- **import (5종, alphabetical)**: `composeRoute`·`extractControllerRoute`·`pathSegments`·`stripComments`·`stripQuery`.
- **inline 정의 삭제 대상 (6종)**: 위 5종 + `normalizeRoute`. `normalizeRoute` 는 삭제하되 **import 하지 않는다** — auth-me 안 유일 참조가 inline `composeRoute` 본문 L99 뿐이라, `composeRoute` 를 helper import 로 교체하면 참조가 소멸한다(helper `composeRoute` 가 자체 `normalizeRoute` 를 내부 사용). `normalizeRoute` 를 import 하면 TS6133 unused-import 로 CI fail — 반드시 제외.
- **inline 유지 (spec 전용 또는 handler 추출기)**: `extractHandlerMethods`·`HandlerDecorator`(base 변형이나 stream 관례상 handler 추출기는 inline 유지)·`extractHandlerParams`·`extractMeFireMethod`·`BackendContract`/`WebFire` 인터페이스·`diffContract`·`meFire`. 이들은 삭제 대상 아님.

## Acceptance Criteria

- [ ] `AdminView.auth-me-contract.test.ts` 의 inline 추출기 중 **공용 helper 와 글자-동일하고 잔여 참조가 남는 5종** `composeRoute`·`extractControllerRoute`·`pathSegments`·`stripComments`·`stripQuery` 의 inline 정의를 삭제하고 `./__contract-guard__/contract-extractors` 에서 alphabetical named import 로 교체한다.
- [ ] `normalizeRoute` inline 정의도 삭제하되 **import 하지 않는다** — 유일 참조(inline composeRoute L99)가 composeRoute import 교체로 소멸하므로 import 시 TS6133 발생. import 목록에 normalizeRoute 를 넣지 말 것.
- [ ] handler 추출기·spec 전용 함수는 inline 유지: `extractHandlerMethods`·`HandlerDecorator`·`extractHandlerParams`·`extractMeFireMethod`·`BackendContract`/`WebFire`·`diffContract`·`meFire`.
- [ ] import 한 5종 모두 spec 안에 잔여 직접 참조가 있어 TS6133 unused-import 0 (검증: `composeRoute`→diffContract L111·L163 단언, `extractControllerRoute`→L125/L153/L157/L255, `pathSegments`→L166 단언, `stripComments`→inline extractHandlerMethods L35·extractHandlerParams L56·extractMeFireMethod L77 가 계속 참조, `stripQuery`→diffContract L111/L112·meFire L143·L249 단언).
- [ ] `pnpm --dir web exec tsc --noEmit` clean (TS6133 없음).
- [ ] `pnpm --dir web test` 로 대상 spec **전체 it green**, describe/it 문자열·단언·test 개수 완전 무변경 (순수 dedup — 동작·coverage 불변).
- [ ] production code(`src/`) 변경 0 LOC — 순수 test-only refactor.
- [ ] Happy-path: 이관 후에도 정상 계약(ROUTE·HANDLERS·ME_CONTRACT 추출)이 기존과 동일하게 통과함을 기존 spec 의 happy 케이스로 확인(신규 test 추가 불필요 — 기존 test 가 이미 5종 cover).
- [ ] Error/negative path: 기존 spec 의 negative 케이스(빈 소스→extractControllerRoute null·주석뿐 @Controller null·`_r` cache-buster strip·drift 감지 등 L153~166·L249·L255)가 import 교체 후에도 동일하게 통과함을 확인(추출기 동작 byte-identical 이므로 무변경).
- [ ] 분기 cover: 본 task 는 로직 분기를 추가·수정하지 않음(순수 import 교체) — 신규 분기 없음, 기존 분기 test 그대로 유지.

## Out of Scope

- 공용 helper `contract-extractors.ts` 자체 수정 (import 만; 정의 변경 금지).
- inline 유지 대상(`extractHandlerMethods`·`extractHandlerParams`·`extractMeFireMethod`·`diffContract` 등) 의 helper 이관 — handler 추출기는 stream 관례상 inline 유지, 나머지는 spec 전용.
- `normalizeRoute` 를 import 목록에 추가 (TS6133 유발 — 명시 금지).
- 다른 contract-guard spec(instance-access·recent-deletion·role-change·schedule-apply·schedule-trigger 등 남은 INLINE) 이관 — 각각 별도 slice.
- production code / 계약 로직 변경. test 개수·단언·describe/it 문자열 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 남은 INLINE contract-guard spec: instance-access·recent-deletion·role-change·schedule-apply·schedule-trigger — 각각 char-identical subset + 참조 분석(정의 삭제 시 참조 소멸 여부) 검증 후 후속 slice 로.
