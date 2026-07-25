---
id: T-1229
title: recent-deletion 계약 guard spec char-identical 추출기 4종 공용 helper import 교체
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-26
independentStream: contract-guard-dedup
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.recent-deletion-contract.test.ts]
plannerNote: P6 contract-guard dedup — recent-deletion(POST /api/schedules/recent-deletion/:personId) guard spec 의 글자-동일 추출기 4종(composeRoute·extractControllerRoute·pathSegments·stripComments) T-1201 helper import 교체, normalizeRoute 는 inline composeRoute 유일 참조라 composeRoute import 시 orphan→inline 삭제·import 제외(T-1227 auth-me 반전 동형)
testCriteria:
  - 순수 test-only refactor — production 0 LOC. it 개수·describe/it 문자열·단언·coverage 완전 무변경.
  - pnpm --dir web test 로 AdminView.recent-deletion-contract.test.ts green 확인.
  - tsc --noEmit clean (TS6133 unused-import/unused-local 0 — import 4종 전부 잔여 참조 있음, normalizeRoute 는 inline·import 둘 다 제거).
---

# T-1229 — recent-deletion 계약 guard spec char-identical 추출기 4종 공용 helper import 교체

## Why

P6 contract-guard dedup stream(T-1201 이 공용 helper `web/src/views/__contract-guard__/contract-extractors.ts` 신설 후 소비 spec 을 하나씩 이관) 의 후속 slice. 31개 `AdminView.*-contract.test.ts` 중 27개가 이관 완료됐고 남은 inline spec 은 recent-deletion·role-change·schedule-apply·schedule-trigger 4종뿐이다. 본 task 는 그 중 **recent-deletion**(POST /api/schedules/recent-deletion/:personId drift guard) 의 글자 그대로 동일한 invariant 추출기를 helper import 로 교체해 중복을 제거한다(REQ-112 unit test 유지보수성).

planner byte-diff 결과, recent-deletion 의 `composeRoute`·`extractControllerRoute`·`pathSegments`·`stripComments` 4종은 helper 정의와 char-identical 이며 test body / 잔여 inline 추출기가 직접 참조하므로 import 로 교체해도 잔여 참조가 남는다. 반면 `normalizeRoute`(L98) 는 유일 참조가 inline `composeRoute` 본문(L101)뿐이라, composeRoute 를 import 로 교체하면 참조가 소멸한다 → inline 삭제하되 import 하지 않는다(helper 의 composeRoute 가 내부 normalizeRoute 를 자체 사용). 이는 T-1227(auth-me) 의 normalizeRoute orphan 처리와 동형이다. `extractHandlerMethods`(주석 spec-특화)·`extractDtoFields`·`sliceReEvaluateRunner`·`diffContract`·`expectedPath` 및 관련 타입은 per-spec 변형이라 inline 유지.

## Required Reading

- `web/src/views/AdminView.recent-deletion-contract.test.ts` — 이관 대상. inline 추출기 정의: `stripComments`(L12), `extractControllerRoute`(L19), `normalizeRoute`(L98), `composeRoute`(L99), `pathSegments`(L103). 이 중 4종(stripComments·extractControllerRoute·composeRoute·pathSegments)만 helper import 로 교체, normalizeRoute 는 inline 삭제·미import.
- `web/src/views/__contract-guard__/contract-extractors.ts` — import 원본. `stripComments`(L10)·`extractControllerRoute`(L19)·`composeRoute`(L76)·`pathSegments`(L82) export 시그니처·본문 char-identity 대조.
- `docs/tasks/T-1227-*.md` — 직전 동형 선례(auth-me: composeRoute import 시 normalizeRoute orphan → inline 삭제·import 제외). 본 task 의 normalizeRoute 처리 근거.

## Acceptance Criteria

- [ ] `AdminView.recent-deletion-contract.test.ts` 상단 inline `stripComments`·`extractControllerRoute`·`composeRoute`·`pathSegments` 정의 삭제 → `import { composeRoute, extractControllerRoute, pathSegments, stripComments } from './__contract-guard__/contract-extractors';` (alphabetical named import) 추가.
- [ ] inline `normalizeRoute`(L98) 정의 삭제하되 **import 하지 않음** — helper 의 composeRoute 가 내부 normalizeRoute 를 자체 사용하므로 test 내 직접 참조 0. import 하면 TS6133 unused.
- [ ] `extractHandlerMethods`·`extractDtoFields`·`sliceReEvaluateRunner`·`diffContract`·`expectedPath` 및 `HandlerDecorator`/`DtoFields`/`BackendContract`/`WebFire` 타입은 inline 유지(변경 0).
- [ ] production 코드(`AdminView.tsx` 등) 변경 0 LOC — test-only refactor.
- [ ] describe/it 문자열·it 개수·단언 내용 **완전 무변경** — 순수 정의 위치 이동. (분기 없음 — 로직 변경 0이라 happy/error/negative test 신규 추가 불요, 기존 계약 guard test 가 그대로 green 이면 충족.)
- [ ] `pnpm --dir web test` 로 해당 spec 파일 green 확인 (기존 it 전부 pass, coverage 무변경).
- [ ] `pnpm --dir web exec tsc --noEmit` clean — TS6133 unused import/local 0 (import 4종 전부 잔여 참조 존재, normalizeRoute inline·import 둘 다 제거).

## Out of Scope

- role-change·schedule-apply·schedule-trigger 등 나머지 inline contract spec 이관 — 각각 후속 slice.
- helper 모듈(`contract-extractors.ts`) 자체 수정 — 본 task 는 소비측 import 교체만.
- extractHandlerMethods 등 per-spec 변형 추출기의 이관 — 변형 있어 대상 아님.
- 계약 guard 로직/단언 변경, 새 test case 추가, devDependency 추가.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비움)

## Result (DONE)

- 완료: 2026-07-25T20:xxZ (cron@aa-local15-a1f92003 fire)
- PR #1121 squash-merge `10d813e2` + branch delete. reviewer round 1/7 APPROVE(0 finding), 4-게이트 PASS(reviewer comment issuecomment-5080389015, CI green run 30172958324, mergeState CLEAN).
- 변경: `AdminView.recent-deletion-contract.test.ts` +1/-17 (inline 추출기 4종 삭제 → alphabetical named import 1줄, normalizeRoute inline 삭제·미import). production 0 LOC.
- 검증: recent-deletion spec 22/22 green, 전체 web suite green, tsc --noEmit clean(TS6133=0). counters 1219→1220.
