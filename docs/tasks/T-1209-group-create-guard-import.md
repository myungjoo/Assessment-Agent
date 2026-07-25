---
id: T-1209
title: group-create-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-060]
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.group-create-contract.test.ts]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-07-25
plannerNote: P6 contract-guard dedup stream — GET-list 소진 후 첫 mutation slice; group-create 의 char-identical 4종을 T-1201 공용 helper import 로 교체(변형 inline 유지), behavior-preserving.
---

# T-1209 — group-create-contract spec 의 char-identical 추출기 4종을 공용 helper import 로 교체

## Why

T-1201 이 신설한 공용 추출기 모듈(`web/src/views/__contract-guard__/contract-extractors.ts`)로 30+ contract-guard spec 의 중복 inline 추출기를 파일당 하나씩 이관하는 dedup stream 의 다음 slice 다. GET-list 계열 7종(schedules/persons/users/groups/parts/llm-provider/difficulty-mapping-list, T-1202~T-1208)이 소진돼, 이번에는 **mutation contract-guard spec** 로 stream 을 이어 첫 slice 로 `AdminView.group-create-contract.test.ts`(POST /api/groups 계약 guard)를 처리한다. 이 spec 의 inline 추출기 중 공용과 **글자-동일한 4종만** import 로 교체하고 변형·전용 추출기는 inline 유지 — 순수 test-only refactor 로 계약 검증 동작은 byte 단위로 불변이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — 공용 export 목록. 이 task 가 import 할 char-identical 4종: `stripComments`(L10~16), `extractControllerRoute`(L19~22), `normalizeRoute`(L73), `composeRoute`(L76~79). **주의**: 공용 `extractHandlerMethods`(L31)·`extractHandlerParams`·`pathSegments`·`stripQuery` 는 import 하지 않는다(아래 이유).
- `web/src/views/AdminView.group-create-contract.test.ts` — 대상 spec. inline 추출기 위치:
  - char-identical(교체 대상 4종): `stripComments`(L19~25), `extractControllerRoute`(L27~30), `normalizeRoute`(L96), `composeRoute`(L98~101).
  - **변형·전용(inline 유지)**: `HandlerDecorator` interface(L33~36)·`extractHandlerMethods`(L38~57, 함수 본문 코드는 공용과 동일하나 L48 inline 주석이 `@HttpCode/@UsePipes/@Param` 로 공용의 `@HttpCode/@UseGuards/@Roles` 와 상이 → char-identical 아님, 보수적으로 inline 유지)·`DtoFields`/`extractDtoFields`(L59~80, group-create 전용 DTO 필드 추출)·`BackendContract`/`WebFire` 타입·`diffContract`(L103~) 는 모두 inline 그대로 유지. `stripQuery` 는 이 spec 에 **존재하지 않는다**(POST fire 라 `?_r` nonce 없음) — 신규 import 하지 말 것.
- `web/src/views/AdminView.groups-list-contract.test.ts` (L1~13) — 직전 slice(T-1205)의 import 스타일 참조. char-identical subset 을 alphabetical named import + inline 삭제 주석 패턴을 그대로 따르되, 본 slice 는 5종이 아니라 **4종**(stripQuery 제외)임에 유의.

## Acceptance Criteria

- [ ] `AdminView.group-create-contract.test.ts` 의 inline `stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute` 정의 4종을 삭제하고 `./__contract-guard__/contract-extractors` 에서 named import 로 교체한다. import 는 alphabetical 정렬(`composeRoute, extractControllerRoute, normalizeRoute, stripComments`), T-1205 의 주석 스타일 mirror.
- [ ] 변형·전용 추출기(`extractHandlerMethods`·`HandlerDecorator`·`DtoFields`·`extractDtoFields`·`BackendContract`·`WebFire`·`diffContract`)는 inline/기존 그대로 유지 — import 로 바꾸지 않는다(공용과 로직·주석 상이 또는 spec 전용). `stripQuery` 는 import 추가 금지(이 spec 에 부재).
- [ ] 교체 전후 **test case 수 불변**. describe/it 문자열·assertion 로직 무변경 — 순수 추출기 출처 교체만.
- [ ] `pnpm --dir web test` 통과(group-create-contract spec 포함 전체 green, no-regression).
- [ ] `pnpm --dir web build` (`tsc --noEmit` + vite build) 통과 — import 경로/타입 해석 정상.
- [ ] `pnpm --dir web test:cov` coverageThreshold(line ≥ 80% AND function ≥ 80%) 무회귀. production src 0 LOC 변경이라 coverage 표면 불변.
- [ ] happy-path: 교체된 4종이 공용 helper 에서 정상 해석되어 base `api/groups` bare `@Post()` 합성 → `/api/groups` POST 계약 일치 케이스가 여전히 pass.
- [ ] error/negative path: base 오타(`api/group` 단수 drift)·method drift(@Get/@Put/@Patch/@Delete)·bare `@Post()` 에 세그먼트 추가 대조·DTO 필드 drift·주석 false-positive(negative (g))·소스 유실 등 기존 negative 케이스가 교체 후에도 fail-detection 을 유지(즉 spec 자체가 여전히 통과 — 대조 로직 불변).
- [ ] 분기: 이 task 는 추출기 출처 교체만이라 신규 분기 없음 — spec 내 기존 분기 커버리지는 test case 수 불변으로 보존. (신규 분기 없음 — 이 항목 별도 test 추가 불요.)
- [ ] size gate: diff ≤ 300 LOC AND 변경 파일 == 1 (`web/src/views/AdminView.group-create-contract.test.ts` 단일).

## Out of Scope

- 다른 contract-guard spec(create-user, group-update/delete, person-create 등) 이관 — 후속 slice.
- 공용 helper(`contract-extractors.ts`) 자체 수정 — 신규 export 추가·시그니처 변경 금지.
- `extractHandlerMethods`·`extractDtoFields` 등 변형·전용 추출기를 공용으로 승격/추출하는 refactor — 별도 판단 필요.
- production src(`AdminView.tsx`·`group.controller.ts`·`create-group.dto.ts`) 변경.
- test case 추가/삭제·assertion 강화 — behavior-preserving 이관만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

- mutation contract-guard spec 이관 stream 시작(본 slice 가 첫). 남은 후보: create-user·group-update·group-delete·group-member-add·group-member-remove·person-create/update/delete·part-create/update/delete·llm-provider-create/update/delete·schedule-trigger/apply·role-change·instance-access·recent-deletion 등. 각 파일의 char-identical subset(공용과 함수 본문+주석까지 byte-identical 한 것만)을 개별 검증해 파일당 slice 로 이관. mutation spec 은 richer 변형·전용 추출기 비중이 커 char-identical subset 이 4종 미만인 파일도 있을 수 있으므로 slice 별 확인 필요.
