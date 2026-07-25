---
id: T-1232
title: schedule-trigger 계약 guard spec char-identical 추출기 공용 helper import 교체
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-25
independentStream: contract-guard-dedup
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.schedule-trigger-contract.test.ts]
plannerNote: P6 contract-guard dedup 마지막 slice — schedule-trigger(POST /api/schedules/trigger fire-and-forget) guard spec 의 글자-동일 추출기 4종(composeRoute·extractControllerRoute·pathSegments·stripComments) T-1201 helper import 교체, normalizeRoute 는 inline composeRoute 유일 참조라 orphan→inline 삭제·import 제외(T-1231 동형)
testCriteria:
  - 순수 test-only refactor — production 0 LOC. it 개수·describe/it 문자열·단언·coverage 완전 무변경.
  - pnpm --dir web test 로 AdminView.schedule-trigger-contract.test.ts green 확인.
  - tsc --noEmit clean (TS6133 unused-import/unused-local 0 — import 4종 전부 잔여 참조 있음, normalizeRoute 는 inline·import 둘 다 제거).
---

# T-1232 — schedule-trigger 계약 guard spec char-identical 추출기 공용 helper import 교체

## Why

P6 contract-guard dedup stream(T-1201 이 공용 helper `web/src/views/__contract-guard__/contract-extractors.ts` 신설 후 소비 spec 을 하나씩 이관) 의 **마지막 slice**. `AdminView.*-contract.test.ts` 중 schedule-apply(T-1231)까지 이관 완료됐고 이 stream 에 남은 유일한 inline spec 이 **schedule-trigger**(POST /api/schedules/trigger fire-and-forget guard) 다. 본 task 는 그 글자 그대로 동일한 invariant 추출기를 helper import 로 교체해 중복을 제거하고 stream 을 종료한다(REQ-112 unit test 유지보수성).

planner byte-diff 결과, schedule-trigger 의 `composeRoute`(L94)·`extractControllerRoute`(L18)·`pathSegments`(L98)·`stripComments`(L11) 4종은 helper 정의와 char-identical 이며 test body / 잔여 inline 추출기가 직접 참조하므로 import 로 교체해도 잔여 참조가 남는다. 반면 `normalizeRoute`(L93) 는 helper 와 char-identical 이나 유일 참조가 inline `composeRoute` 본문뿐이라, composeRoute 를 import 로 교체하면 참조가 소멸한다 → inline 삭제하되 import 하지 않는다(helper 의 composeRoute 가 내부 normalizeRoute 를 자체 사용). 이는 T-1231(schedule-apply)·T-1229(recent-deletion) 의 normalizeRoute orphan 처리와 동형이다. `extractHandlerMethods`·`extractHandlerParams`·`sliceTriggerRunner`·`diffContract`·`toFire` 및 `HandlerDecorator`/`BackendContract`/`WebFire` 등 타입은 spec-특화 변형(또는 별도 구현)이라 inline 유지.

## Required Reading

- `web/src/views/AdminView.schedule-trigger-contract.test.ts` — 이관 대상. inline 추출기 정의: `stripComments`(L11), `extractControllerRoute`(L18), `normalizeRoute`(L93), `composeRoute`(L94), `pathSegments`(L98). 이 중 4종(stripComments·extractControllerRoute·composeRoute·pathSegments)만 helper import 로 교체, normalizeRoute 는 inline 삭제·미import.
- `web/src/views/__contract-guard__/contract-extractors.ts` — import 원본. `stripComments`(L10)·`extractControllerRoute`(L19)·`composeRoute`(L76)·`pathSegments`(L82) export 시그니처·본문 char-identity 대조.
- `docs/tasks/T-1231-schedule-apply-contract-helper-import.md` — 동형 선례(동일 4종 import 조합 + composeRoute import 시 normalizeRoute orphan → inline 삭제·import 제외). 본 task 의 normalizeRoute 처리 근거.

## Acceptance Criteria

- [ ] `AdminView.schedule-trigger-contract.test.ts` 상단 inline `stripComments`·`extractControllerRoute`·`composeRoute`·`pathSegments` 정의 삭제 → `import { composeRoute, extractControllerRoute, pathSegments, stripComments } from './__contract-guard__/contract-extractors';` (alphabetical named import) 추가.
- [ ] inline `normalizeRoute`(L93) 정의 삭제하되 **import 하지 않음** — helper 의 composeRoute 가 내부 normalizeRoute 를 자체 사용하므로 test 내 직접 참조 0. import 하면 TS6133 unused.
- [ ] `extractHandlerMethods`·`extractHandlerParams`·`sliceTriggerRunner`·`diffContract`·`toFire` 및 `HandlerDecorator`/`BackendContract`/`WebFire` 타입은 inline 유지(변경 0) — spec-특화 변형(또는 helper 와 다른 구현)이라 이관 대상 아님.
- [ ] production 코드(`AdminView.tsx` 등) 변경 0 LOC — test-only refactor.
- [ ] describe/it 문자열·it 개수·단언 내용 **완전 무변경** — 순수 정의 위치 이동. (분기 없음 — 로직 변경 0이라 happy/error/negative test 신규 추가 불요, 기존 계약 guard test 가 그대로 green 이면 충족.)
- [ ] `pnpm --dir web test` 로 해당 spec 파일 green 확인 (기존 it 전부 pass, coverage 무변경 — line ≥ 80% / function ≥ 80% 기존 임계 유지).
- [ ] `pnpm --dir web exec tsc --noEmit` clean — TS6133 unused import/local 0 (import 4종 전부 잔여 참조 존재, normalizeRoute inline·import 둘 다 제거).

## Out of Scope

- 다른 stream 의 inline contract spec 이관 — 본 task 는 contract-guard-dedup stream 의 마지막 slice(schedule-trigger 이후 이 stream 에 남는 inline spec 없음).
- helper 모듈(`contract-extractors.ts`) 자체 수정 — 본 task 는 소비측 import 교체만.
- extractHandlerMethods·extractHandlerParams·sliceTriggerRunner·diffContract·toFire 등 per-spec 변형/별도 구현 추출기의 이관 — 대상 아님.
- 계약 guard 로직/단언 변경, 새 test case 추가, devDependency 추가.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비움)
