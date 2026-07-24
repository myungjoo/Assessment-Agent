---
id: T-1203
title: contract-guard 소비 spec 이관 slice 2 — AdminView.persons-list-contract.test.ts 의 inline invariant 추출기 중 공용 helper 와 글자-동일한 5종(stripComments·extractControllerRoute·normalizeRoute·composeRoute·stripQuery)만 __contract-guard__/contract-extractors.ts import 로 교체(richer extractHandlerMethods·pathParams 등 변형은 inline 유지, 동작 무변경)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-060]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-07-25
independentStream: web-contract-guard
dependsOn: [T-1201]
touchesFiles: [web/src/views/AdminView.persons-list-contract.test.ts]
plannerNote: "P6 contract-guard refactor 이관 slice 2(persons-list). T-1201 helper 와 글자-동일한 5종만 import 교체 — persons-list 의 richer extractHandlerMethods(5-field hasBody/hasParam/hasQuery)·pathParams 는 shared export 와 의미 상이라 inline 유지. 단일 test 파일 1개, AdminView.tsx·타 spec 전부 파일-disjoint → stage 5b 동시 claim 안전, dependsOn=[T-1201](머지 완료)."
---

# T-1203 — contract-guard 소비 spec 이관 slice 2 (persons-list)

## Why

T-1201(PR #1093, `8abaf0d3`)이 30+ contract-guard spec 이 중복 복사하던 invariant 추출기를 `web/src/views/__contract-guard__/contract-extractors.ts` 공용 helper 로 신설했고, T-1202(PR #1094, `cfe79997`)가 첫 소비처 `schedules-list` spec 을 이관했다. T-1202 Follow-up 이 지목한 **다음 이관 대상은 `AdminView.persons-list-contract.test.ts`** 다(REQ-060 unit test 유지보수성).

단, persons-list 는 schedules-list 와 달리 **일부 추출기가 공용 helper 와 의미가 다른 변형(variant)** 을 들고 있다. 따라서 본 slice 는 T-1201 이 정한 원칙("변형이 있는 함수는 이관에서 제외하고 Follow-up 에 남긴다")대로 **글자-동일한 5종만** 공용 helper import 로 교체하고, 변형 3종은 inline 유지한다. **동작(test 개수·통과 결과·coverage)은 완전 무변경** — 순수 중복 제거 refactor. 단일 test 파일 1개만 수정하므로 `AdminView.tsx`·다른 contract-guard spec 전부와 파일-disjoint 하여 stage 5b 동시 claim 에 안전하고, `dependsOn` 은 이미 머지된 T-1201 뿐이다.

## Required Reading

- `web/src/views/__contract-guard__/contract-extractors.ts` — **import 원천**. export 목록과 각 시그니처를 확인한다. 이 spec 이 import 할 **글자-동일한 5종**: `stripComments`, `extractControllerRoute`, `normalizeRoute`, `composeRoute`, `stripQuery`. **주의 — import 하면 안 되는 export**: 공용 `extractHandlerMethods`(반환 타입이 2-field `{method, subPath}` 인 simple 변형)·공용 `HandlerDecorator`(2-field 인터페이스)·`pathSegments`(전 세그먼트 반환)·`extractHandlerParams`. 이들은 persons-list 의 inline 변형과 의미가 다르므로 import 금지(아래 대조 참조).
- `web/src/views/AdminView.persons-list-contract.test.ts` — **이관 대상**. 삭제할(→ import 교체) **글자-동일 5종**: `stripComments`(L14~20), `extractControllerRoute`(L21~24), `normalizeRoute`(L93), `composeRoute`(L94~97), `stripQuery`(L99). **inline 유지(이관 금지) 변형/per-spec**:
  - `interface HandlerDecorator`(L25~31) — 공용은 `{method, subPath}` 2-field 이나 여기는 `{method, subPath, hasBody, hasParam, hasQuery}` **5-field 변형**. 유지.
  - `extractHandlerMethods`(L34~69) — 공용은 simple 2-field 매핑이나 여기는 멀티라인 시그니처 괄호-균형 매칭으로 `hasBody/hasParam/hasQuery` 까지 채우는 **richer 변형**. 유지(내부에서 참조하는 `stripComments` 는 import 된 것을 사용 — 의미 동일이라 무해).
  - `pathParams`(L98) — `route.split('/').filter((seg) => seg.startsWith(':'))`(`:` 접두 세그먼트만). 공용 `pathSegments`(전 세그먼트)와 **의미 상이**. 유지(공용에 대응 export 없음).
  - `extractPersonsFireMethod`(L73~80)·`interface BackendContract`(L81~88)·`interface WebFire`(L89~92)·`diffContract`(L102~114) — per-spec 발사기·타입·대조 로직. 유지.
- `web/src/views/AdminView.schedules-list-contract.test.ts`(L1~14) — **이관 스타일 참조**(read-only). T-1202 가 이관한 import 블록 형태(참조하는 export 만 알파벳 정렬 import + 한국어 주석 3줄)를 mirror 한다. 단 schedules-list 는 simple 변형이라 `extractHandlerMethods`/`pathSegments` 까지 import 했지만, persons-list 는 그 두 변형을 inline 유지하므로 **import 목록이 다르다**(위 5종 + `normalizeRoute` 포함).

## Acceptance Criteria

**정확히 파일 1개**만 수정한다(`AdminView.persons-list-contract.test.ts`). 신규 파일 0, 다른 spec·production 코드 0 LOC.

- [ ] inline 복사된 **글자-동일 5종**(`stripComments`·`extractControllerRoute`·`normalizeRoute`·`composeRoute`·`stripQuery`)을 삭제하고 `import { composeRoute, extractControllerRoute, normalizeRoute, stripComments, stripQuery } from './__contract-guard__/contract-extractors';` 로 교체(알파벳 정렬, 이 spec 이 실제 참조하는 5종만).
- [ ] **변형/per-spec 은 inline 유지** — `HandlerDecorator`(5-field 변형)·`extractHandlerMethods`(richer 변형)·`pathParams`·`extractPersonsFireMethod`·`BackendContract`·`WebFire`·`diffContract` 는 삭제·이관·시그니처 변경 금지. 공용 helper 의 `extractHandlerMethods`/`HandlerDecorator`/`pathSegments`/`extractHandlerParams` 를 import 하지 않는다(의미 상이 → 동작 변경 위험).
- [ ] **동작 무변경(behavior-preserving) 검증**: 이관 전후 `describe`/`it`/`it.each` 케이스 수·이름·단언이 동일. test 를 추가·삭제·완화하지 않는다(refactor 이므로 신규 public symbol 도입 0 → 신규 test 불요이나, 아래 명시 항목으로 무회귀를 증명한다).
- [ ] happy-path 무회귀: 이관 후 정상 계약 정합 test(`diffContract(personsFire(0), LIST_CONTRACT)` → `[]`, `buildPersonsPath(0)` → `/api/persons`)가 그대로 green.
- [ ] error/negative 무회귀: 이관 후에도 backend 추출 실패(`extractControllerRoute('')`→null)·method drift·path drift(`@Get(":id")` 세그먼트)·주석 false-positive·발사 override·소스 유실 등 기존 negative 케이스가 모두 그대로 green(import 된 5종이 inline 과 의미 동일함을 실측 통과로 확인).
- [ ] 분기 무회귀: `composeRoute` subPath 유/무·`normalizeRoute` leading-slash 유/무 등 import 된 helper 분기가 이 spec 의 대조 경로(GET-vs-GET 판별·mutation 대조군)에서 이전과 동일하게 동작. 특히 inline 유지한 richer `extractHandlerMethods` 가 import 된 `stripComments` 를 호출해도 `findActive`/`findOne`/`create`/`update`/`remove` 매핑이 이전과 동일.
- [ ] `pnpm --dir web test` 실측 통과 — 이 spec 의 test 수가 이관 전과 **동일**하고 전부 green(수 감소·skip 0).
- [ ] `pnpm --dir web build`(또는 `tsc`) clean — unused-import·타입 오류 0(import 한 5종 전부 실제 참조, 변형은 import 하지 않음).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — coverageThreshold 무회귀.
- [ ] size gate: diff ≤ 300 LOC(순감 예상 — inline 5종 삭제 + import 블록 추가), 변경 파일 정확히 1개.

## Out of Scope

- **다른 contract-guard spec(users-list·groups-list·parts-list·llm-provider-list 등 남은 29개) 이관 금지** — 본 slice 는 persons-list 단일 파일만. 각 spec 은 후속 slice(파일당 소diff, 파일-disjoint)로 하나씩.
- **richer `extractHandlerMethods`(5-field)·`pathParams` 를 공용 helper 로 이관/공용화 시도 금지** — 본 slice 는 글자-동일 5종만 소비처 교체. 공용 helper enrich 여부는 별도 설계 결정(아래 Follow-up).
- 공용 helper(`contract-extractors.ts`) 자체 수정·시그니처 변경·export 추가 금지 — 본 slice 는 소비처 교체만. helper 결함/enrich 필요 발견 시 고치지 말고 Follow-up 에 남긴다.
- test 케이스 추가·완화·삭제 금지 — 순수 이관이므로 동작 무변경이 핵심. 커버 개선 아이디어는 Follow-up 으로.
- production 코드(`AdminView.tsx`)·vitest 설정 수정 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (이관 후속 slice) 남은 contract-guard spec 을 하나씩 같은 방식으로 이관 — 다음 후보는 `AdminView.users-list-contract.test.ts`, 이어서 `groups-list`·`parts-list`·`llm-provider-list`. 이들 GET-list spec 은 persons-list 와 동형(richer `extractHandlerMethods` + `pathParams`)이라 **본 slice 와 동일한 부분-이관 패턴**(글자-동일 subset 만 import)을 적용할 가능성이 높다 — 각 spec 대조로 확정.
- (설계 결정 후보) 공용 helper enrich 검토 — GET-list spec 다수가 `extractHandlerMethods` 의 richer 변형(멀티라인 시그니처 + `hasBody/hasParam/hasQuery`)과 `pathParams`(`:` 세그먼트) export 를 공유한다. 공용 helper 에 이 richer 변형을 추가(또는 옵션화)하면 더 완전한 dedup 이 가능하나, simple 소비처(schedules-list)의 2-field 사용과의 하위호환·API 표면 증가 trade-off 가 있어 별도 refactor 결정 필요. 본 이관 slice 와 무관.
- (미해결 실 drift — 사람 확인 필요) T-1201/T-1202 에서 이월된 export 계약 drift(web `runExport` 가 bare `@Get()` 없는 `api/admin/export` 호출)·import 계약 drift(web `runImport` multipart vs backend `@Body` JSON). 도메인 오너 결정 필요(humanQuestion 후보) — 이관 refactor 와 무관하니 별도 처리.

---

## 완료 기록

- **Status: DONE** — 2026-07-24T23:40Z (KST 07-25 08:40)
- PR [#1095](https://github.com/myungjoo/Assessment-Agent/pull/1095) squash merge `f7e8408f`, reviewer round 1/7 APPROVE, 4-게이트 PASS.
- 결과: `AdminView.persons-list-contract.test.ts` 글자-동일 추출기 5종(stripComments·extractControllerRoute·normalizeRoute·composeRoute·stripQuery) inline 삭제 후 공용 helper import 로 교체(+10/-17, 1파일). 변형 3종(richer extractHandlerMethods·5-field HandlerDecorator·pathParams) inline 유지. persons-list spec 21 test 무변경 green, web 1836 test green, tsc clean. 신규 production symbol 0 → coverage 무영향.
- Follow-up: 다음 이관 대상 users-list → T-1204 큐잉.
