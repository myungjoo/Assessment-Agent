---
id: T-1226
title: difficulty-mapping-assign 계약 guard spec char-identical 추출기 4종 공용 helper import 교체
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-26
independentStream: contract-guard-dedup
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts]
plannerNote: P6 contract-guard dedup mutation slice — difficulty-mapping-assign 의 글자-동일 추출기 4종을 T-1201 helper import 로 교체, 순수 test-only
testCriteria:
  - 순수 test-only refactor — production 0 LOC. 13/13 it 및 describe/it 문자열·단언·coverage 완전 무변경.
  - pnpm --dir web test 로 AdminView.difficulty-mapping-assign-contract.test.ts 13 test green 확인.
  - tsc --noEmit clean (TS6133 unused-import 0 — 4종 모두 잔여 직접 참조 존재).
---

# T-1226 — difficulty-mapping-assign 계약 guard spec char-identical 추출기 4종 공용 helper import 교체

## Why

[PLAN.md](../PLAN.md) P6 contract-guard dedup stream 의 mutation slice 연속 작업이다. T-1201 이 신설한 공용 helper
`web/src/views/__contract-guard__/contract-extractors.ts` 로 30+ 개 contract-guard spec 이 파일마다 복사해 들고 있던
invariant 추출기를 파일당 하나씩 이관한다. LLM provider CRUD 4종(T-1207/1222/1223/1224) 및 group-members(T-1225) 이관 완료 후,
남은 INLINE mutation contract-guard spec 중 difficulty-mapping-assign(POST-with-body `@Patch(":difficulty")` /api/llm/difficulty-mappings guard)
을 다음 slice 로 처리한다. README 112행(R-112)의 test invariant 를 손대지 않고 중복만 제거하는 순수 test-only refactor 다.

## Required Reading

- `web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts` — 이관 대상 spec (현재 inline 추출기 정의 L12~104).
- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 helper (import 원본, 특히 `composeRoute`·`extractControllerRoute`·`normalizeRoute`·`stripComments` L10~79).
- `web/src/views/AdminView.group-create-contract.test.ts` L1~14 — 이관 완료 sibling 의 import 스타일(alphabetical named import, 주석 형식) 참조.

## Acceptance Criteria

- [ ] `AdminView.difficulty-mapping-assign-contract.test.ts` 의 inline 추출기 중 **공용 helper 와 글자-동일한 4종** `composeRoute`·`extractControllerRoute`·`normalizeRoute`·`stripComments` 의 inline 정의를 삭제하고 `./__contract-guard__/contract-extractors` 에서 alphabetical named import 로 교체한다.
- [ ] richer / 전용 추출기는 inline 유지: `extractHandlerMethods`(hasBody 판정·멀티라인 시그니처, 주석 상이)·`HandlerDecorator`(hasBody 필드 추가)·`DtoFields`·`extractDtoFields`·`BackendContract`/`WebFire`·`pathParams`·`expectedPath`·`diffContract`·`toFire`.
- [ ] import 한 4종 모두 spec 안에 잔여 직접 참조가 있어 TS6133 unused-import 0 (검증: `stripComments`→inline extractHandlerMethods L31·extractDtoFields L64 가 계속 참조, `normalizeRoute`→L194 단언, `extractControllerRoute`→L136/285/287/291/294, `composeRoute`→expectedPath L104·L199 단언).
- [ ] `pnpm --dir web exec tsc --noEmit` clean (TS6133 없음).
- [ ] `pnpm --dir web test` 로 대상 spec **13/13 it green**, describe/it 문자열·단언·test 개수 완전 무변경 (순수 dedup — 동작·coverage 불변).
- [ ] production code(`src/`) 변경 0 LOC — 순수 test-only refactor.
- [ ] Happy-path: 이관 후에도 정상 계약(ROUTE·HANDLERS·DTO_FIELDS 추출)이 기존과 동일하게 통과함을 기존 spec 의 happy 케이스로 확인(신규 test 추가 불필요 — 기존 test 가 이미 4종 cover).
- [ ] Error/negative path: 기존 spec 의 negative 케이스(fake controller route null·빈 소스·drift 감지 등 L285~294)가 import 교체 후에도 동일하게 통과함을 확인(추출기 동작 byte-identical 이므로 무변경).
- [ ] 분기 cover: 본 task 는 로직 분기를 추가·수정하지 않음(순수 import 교체) — 신규 분기 없음, 기존 분기 test 그대로 유지.

## Out of Scope

- 공용 helper `contract-extractors.ts` 자체 수정 (import 만; 정의 변경 금지).
- inline 유지 대상(`extractHandlerMethods`·`extractDtoFields`·`pathParams`·`expectedPath`·`diffContract`·`toFire`) 의 helper 이관 — 이들은 공용과 글자-상이하거나 spec 전용.
- 다른 contract-guard spec(auth-me·instance-access·recent-deletion·role-change·schedule-apply·schedule-trigger 등 남은 INLINE) 이관 — 각각 별도 slice.
- production code / 계약 로직 변경. test 개수·단언·describe/it 문자열 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 남은 INLINE mutation/기타 contract-guard spec: auth-me·instance-access·recent-deletion·role-change·schedule-apply·schedule-trigger — 각각 char-identical subset 검증 후 후속 slice 로.

## Result

**DONE** 2026-07-25T17:50Z — PR [#1118](https://github.com/myungjoo/Assessment-Agent/pull/1118) squash-merge(`e6210a40`). char-identical 추출기 4종(composeRoute·extractControllerRoute·normalizeRoute·stripComments) inline 정의 삭제 후 T-1201 공용 helper alphabetical named import 로 교체. 1 파일 +9/-16, production 0 LOC. 대상 spec 전부 green, tsc clean(TS6133 0). reviewer APPROVE round 1/7(0 findings), 4-게이트 all PASS, CI green.
