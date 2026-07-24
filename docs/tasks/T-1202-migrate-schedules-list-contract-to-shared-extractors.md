---
id: T-1202
title: contract-guard 소비 spec 이관 slice 1 — AdminView.schedules-list-contract.test.ts 의 inline invariant 추출기 8종을 web/src/views/__contract-guard__/contract-extractors.ts import 로 교체(per-spec 발사기·타입·diffContract 는 inline 유지, 동작 무변경)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-060]
estimatedDiff: 95
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.schedules-list-contract.test.ts]
plannerNote: "P6 contract-guard refactor split slice 2(첫 이관). T-1201 이 머지한 공용 helper 를 첫 소비처(schedules-list spec)가 import 하도록 교체 — inline 8종 삭제·동작 무변경. 단일 test 파일 1개라 AdminView.tsx·타 spec 전부 파일-disjoint → stage 5b 동시 claim 안전, dependsOn=[T-1201](머지 완료)."
---

# T-1202 — contract-guard 소비 spec 이관 slice 1 (schedules-list)

## Why

T-1201(PR #1093, `8abaf0d3`)이 30+ contract-guard spec 이 각자 복사해 들고 있던 **invariant 정규식 추출기 8종**을 `web/src/views/__contract-guard__/contract-extractors.ts` 공용 helper 모듈로 신설하고 자체 colocated test 로 정확성을 고정했다. T-1201 의 Follow-up 이 지목한 다음 단계는 그 helper 를 실제로 소비하도록 **기존 spec 을 하나씩 이관**하는 것이다(각 이관은 파일당 소diff, 서로 파일-disjoint).

본 task 는 그 이관의 **slice 1** — 이관 순서로 지정된 "최근/단순 read spec(schedules-list 우선)"의 첫 대상인 `AdminView.schedules-list-contract.test.ts` 에서 inline 복사된 8종 invariant 추출기를 삭제하고 공용 helper import 로 교체한다. **동작(test 개수·통과 결과·coverage)은 완전 무변경** — 순수 중복 제거 refactor(REQ-060 unit test 유지보수성). 단일 test 파일 1개만 수정하므로 `AdminView.tsx`·다른 contract-guard spec 전부와 파일-disjoint 하여 stage 5b 동시 claim 에 안전하고, `dependsOn` 은 이미 머지된 T-1201 뿐이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — **import 원천**. export 8종의 정확한 이름·시그니처: `stripComments`, `extractControllerRoute`, `HandlerDecorator`(interface), `extractHandlerMethods`, `extractHandlerParams`, `normalizeRoute`, `composeRoute`, `pathSegments`, `stripQuery`. 이 spec 에서 실제 참조하는 것만 골라 import 한다(미참조 export 를 import 하면 unused-import lint — 참조 여부는 아래 대조로 확정).
- `web/src/views/AdminView.schedules-list-contract.test.ts` — **이관 대상**. 삭제할 inline 추출기: `stripComments`(L15~21), `extractControllerRoute`(L22~25), `interface HandlerDecorator`(L26~29), `extractHandlerMethods`(L30~51), `extractHandlerParams`(L52~72), `normalizeRoute`(L93), `composeRoute`(L94~97), `pathSegments`(L98), `stripQuery`(L99). **inline 유지(이관 금지)**: `extractSchedulesFireMethod`(L73~80, per-spec 발사기), `interface BackendContract`(L81~87), `interface WebFire`(L88~92), `diffContract`(L103~118). 이관 후에도 이 4종은 각 export 를 정상 호출/조합해야 한다(예: `diffContract`/`composeRoute` 가 `normalizeRoute`·`pathSegments`·`stripQuery` 를 참조하면 그 export 를 import).

## Acceptance Criteria

**정확히 파일 1개**만 수정한다(`AdminView.schedules-list-contract.test.ts`). 신규 파일 0, 다른 spec·production 코드 0 LOC.

- [ ] inline 복사된 invariant 추출기 8종(`stripComments`·`extractControllerRoute`·`HandlerDecorator`·`extractHandlerMethods`·`extractHandlerParams`·`normalizeRoute`·`composeRoute`·`pathSegments`·`stripQuery`)을 삭제하고, 이 spec 이 실제 참조하는 것만 `import { ... } from './__contract-guard__/contract-extractors';` 로 교체.
- [ ] per-spec 변형(`extractSchedulesFireMethod`·`BackendContract`·`WebFire`·`diffContract`)은 **inline 유지** — 삭제·이관·시그니처 변경 금지.
- [ ] **동작 무변경(behavior-preserving) 검증**: 이관 전후 `describe`/`it`/`it.each` 케이스 수·이름·단언이 동일. test 를 추가·삭제·완화하지 않는다(refactor 이므로 R-112 4종 커버는 기존 spec 이 이미 보유 — 신규 public symbol 도입 0이라 신규 test 불요이나, 아래 명시 항목으로 무회귀를 증명한다).
- [ ] happy-path 무회귀: 이관 후 이 spec 의 정상 계약 정합 test(예: `diffContract(schedulesFire(), LIST_CONTRACT)` → `[]`)가 그대로 green.
- [ ] error/negative 무회귀: 이관 후에도 backend 추출 실패(`extractControllerRoute('')`→null 경유)·method 불일치·path 불일치·인자 계약 불일치·형제 handler 오인 방지 등 기존 negative 케이스가 모두 그대로 green(import 된 helper 가 inline 과 의미 동일함을 실측 통과로 확인).
- [ ] 분기 무회귀: `composeRoute` subPath 유/무·`normalizeRoute` leading-slash 유/무 등 helper 분기가 이 spec 의 대조 경로에서 이전과 동일하게 동작(형제 method/segment 판별 test green).
- [ ] `pnpm --dir web test` 실측 통과 — 이 spec 의 test 수가 이관 전과 **동일**하고 전부 green(수 감소·skip 0).
- [ ] `pnpm --dir web build`(또는 `tsc`) clean — unused-import·타입 오류 0(미참조 export 를 import 하지 않았음).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — coverageThreshold 무회귀(공용 helper 는 T-1201 의 colocated test 로 이미 커버, 본 이관은 coverage 총량 무변경 또는 개선).
- [ ] size gate: diff ≤ 300 LOC(순감 예상 — inline ~85줄 삭제 + import 1줄), 변경 파일 정확히 1개.

## Out of Scope

- **다른 contract-guard spec(persons-list·users-list·groups-list 등 30+) 이관 금지** — 본 slice 는 schedules-list 단일 파일만. 각 spec 은 후속 slice(파일당 소diff, 파일-disjoint)로 하나씩. 두 개 이상 건드리면 파일-disjoint 동시성 전제 위반 + 회귀 표면 확대.
- `extractSchedulesFireMethod`·`BackendContract`/`WebFire`·`diffContract` 를 공용 helper 로 옮기려는 시도 금지 — per-spec 변형이라 공용화 대상 아님(T-1201 Out of Scope 그대로).
- 공용 helper(`contract-extractors.ts`) 자체 수정·시그니처 변경 금지 — 본 slice 는 소비처 교체만. helper 결함 발견 시 고치지 말고 Follow-up 에 남긴다.
- test 케이스 추가·완화·삭제 금지 — 순수 이관이므로 동작 무변경이 핵심. 커버 개선 아이디어는 Follow-up 으로.
- production 코드(`AdminView.tsx`)·vitest 설정 수정 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (이관 후속 slice) 남은 contract-guard spec 을 하나씩 같은 방식으로 이관 — 다음 후보는 `AdminView.persons-list-contract.test.ts`, 이어서 `users-list`·`groups-list`·`parts-list` 등. 각 파일-disjoint 소diff 라 stage 5b 병렬 claim 적합.
- (T-1201 에서 이월된 미해결 실 drift — 사람 확인 필요) export 계약 drift(web `runExport` 가 bare `@Get()` 없는 `api/admin/export` 호출)·import 계약 drift(web `runImport` multipart vs backend `@Body` JSON). 도메인 오너 결정 필요(humanQuestion 후보) — 이관 refactor 와 무관하니 별도 처리.
