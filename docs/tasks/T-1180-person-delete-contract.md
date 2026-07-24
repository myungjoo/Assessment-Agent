---
id: T-1180
title: 인원 삭제 endpoint web↔backend 계약 drift-guard spec (DELETE /api/persons/:id · api/persons base + @Delete(":id") 단일 path param + body 부재 축(@Body 없음) + @HttpCode(204))
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-049]
estimatedDiff: 275
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.person-delete-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1179 Out of Scope 예약 "인원 삭제 DELETE /api/persons/:id" 첫/유일 대상. api/persons base + @Delete(":id") 단일 path param + body 부재(@Body 없음) 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1180 — 인원 삭제 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가/제거(T-1173/T-1174) → 그룹 생성/수정/삭제(T-1175/T-1176/T-1177) → 인원 생성(T-1178) → 인원 수정(T-1179) 10 slice 를 거쳐 안정됐다. T-1179 Out of Scope 는 "인원 CRUD 잔여 mutation(삭제 `DELETE /api/persons/:id`)로 guard 확산 … 인원 삭제는 별도 slice(DELETE body 부재 축 + `@HttpCode(204)`)" 를 **명시적으로 예약**했으며, 그 예약의 **대상**이 인원 삭제 endpoint 다. 본 task 는 그 예약을 실행하며, 인원 CRUD 계약 guard(생성 POST · 수정 PATCH · 삭제 DELETE) 3 endpoint 를 완결한다.

인원 삭제는 web `runDeletePerson` 러너(`AdminView.tsx` 1969~2000)가 발사하고 backend `PersonController.remove`(`@Controller("api/persons")` base + `@Delete(":id")` + `@HttpCode(204)`, `@Body` 없음, 204 No Content 반환)가 받는다. 이 경로는 앞선 10 slice 와 같은 silent-drift 위험(backend 가 route/method 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405)을 가지며, 다음 축을 대조한다 — 특히 **인원 도메인에서의 신규/대비 대조 포인트**를 담는다:

1. **`api/persons` base + `@Delete(":id")` 단일 path param 합성 — `api/persons` base 에 DELETE method 첫 결합** — backend `@Controller("api/persons")` base 와 `@Delete(":id")` 를 합성하면 최종 template 은 `/api/persons/:id`(path param **정확히 1개**)다. T-1178(person create)은 `api/persons` base + bare `@Post()`(param 0)였고, T-1179(person update)은 `api/persons` base + `@Patch(":id")`(param 1, PATCH)였으므로 본 task 는 **`api/persons` base 에 `@Delete(":id")`(DELETE method + param 1)** 를 처음 결합한다(신규 method 조합). T-1177(group delete)이 같은 DELETE+`:id` shape 였으나 base 가 `api/groups` 였던 것과 대비된다. web 러너는 `` `${PERSONS_PATH}/${encodeURIComponent(id)}` ``(`PERSONS_PATH` = `/api/persons`, L81)로 path 를 합성한다 — id 를 **encodeURIComponent 로 안전 인코딩**하는 점(비정상 문자가 든 id 도 path 를 안 깨뜨림)이 T-1177 / T-1179 이후 재확인 대상. backend 가 세그먼트를 추가(`:id/deactivate`)하거나 빼면(`@Delete()` bare) fail 한다.
2. **DELETE + body/Content-Type 부재 — `@Body` 없음 축 (인원 도메인 body 부재)** — 이게 본 slice 의 **가장 큰 대조**다. web 발사 `init` 은 `{ method: 'DELETE' }` 뿐 — **`body` 도 `Content-Type` 헤더도 없다**. backend `remove(@Param("id") id)` 는 **`@Body` decorator 가 없는 body-less** 핸들러다. 앞선 인원 body 있는 slice(T-1179 PATCH body · T-1178 POST body)와 달리 대조는 "web 발사 body **부재** + Content-Type 헤더 **부재** AND backend `@Body` decorator **부재**" 형태가 된다. T-1177(group delete DELETE)의 body 부재 축과 정합되고 T-1179(person update PATCH body 존재)와 대비된다. backend 가 body 를 요구하도록 `@Body() dto` 를 붙이거나 web 이 불필요한 body/헤더를 붙이면 fail 한다.
3. **DELETE method + `@HttpCode(204)`** — web `init.method === 'DELETE'` 와 backend `@Delete` decorator 의 정합을 대조한다. backend 가 method 를 바꾸거나(`@Post`/`@Patch`/`@Put`) web 이 다른 method 를 발사하면 fail 한다. (응답 status 204 자체의 대조는 요청 계약 harness 경계 밖 — Out of Scope 참조. 여기서는 method decorator 종류만 대조한다.)

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 10 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.group-delete-contract.test.ts`(= T-1177 이 만든 **DELETE + body 부재 + `@Delete(":id")` 단일 path param** 선례 guard spec) 전체 — DELETE method 대조 · body/Content-Type 부재 대조 · `@Body` decorator 부재 판정 · path param 1 세그먼트 합성 · `encodeURIComponent` 정합 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1177 은 `api/groups` base 였으므로 본 task 는 **`api/persons` base** 로 base 문자열만 조정한다(method/param shape 는 동일). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.person-update-contract.test.ts`(= T-1179 이 만든 `api/persons` base + `:id` 단일 path param 선례) · `web/src/views/AdminView.person-create-contract.test.ts`(= T-1178 이 만든 `api/persons` base 선례) — 같은 `@Controller("api/persons")` base 문자열 파싱·정규화 선례. PATCH+body(T-1179) vs DELETE+body부재(본 task)의 method/body 축 차이만 조정해 차용.
- `web/src/views/AdminView.tsx` 1969~2000행 `runDeletePerson` — mock deps(`remove`/`describeError`/`deleting`/`setDeleting`/`setDeleteError`/`bumpRefresh`)로 호출해 실 발사 `path`(`` `${PERSONS_PATH}/${encodeURIComponent(id)}` ``, `PERSONS_PATH` = `/api/persons`, L81)/`method`(`DELETE`)/`options`(body/Content-Type **부재** — `{ method: 'DELETE' }` 뿐, L1988~1990)를 캡처하는 대상. 빈/공백 id·`deleting` 중이면 미발사(가드) — happy-path 는 유효 id 발사 케이스로 캡처.
- `src/user/person.controller.ts` 41행 `@Controller("api/persons")` base + 91~95행 `@Delete(":id")` + `@HttpCode(204)` + `@Param("id") id` (`@Body` **없음**). base(`api/persons`)와 method decorator 인자(`:id`)를 합성해 최종 template `/api/persons/:id`(path param 1)로 정규화하는 것이 route 대조의 핵심. `@Body` decorator 부재가 body 부재 대조의 근거.

## Acceptance Criteria

- [ ] **base + `@Delete(":id")` route 합성 대조**: backend 소스에서 `@Controller("api/persons")` base 와 `@Delete(":id")` decorator 를 파싱·합성해 최종 template `/api/persons/:id`(path param **정확히 1개**)로 정규화하고, web `runDeletePerson` 발사 path(`` `${PERSONS_PATH}/${encodeURIComponent(id)}` `` → `/api/persons/<id>`)/method(`DELETE`)와 대조한다. path param 이 정확히 1개(`:id`)이고 base 가 `api/persons` 임을 명시 검증 — backend 가 `@Delete()`(bare, 세그먼트 0) 또는 base 를 `api/person`(오타)로 바꾸면 fail.
- [ ] **encodeURIComponent path 처리 대조**: web 러너가 id 를 `encodeURIComponent` 로 안전 인코딩해 path 세그먼트에 넣음을 검증(비정상 문자 든 id 도 path 가 안 깨지는지 — 예: 공백·`/` 든 id 가 인코딩됨). backend 의 `:id` param 슬롯 정합.
- [ ] **DELETE body/Content-Type 부재 대조**: web 발사 `init` 에 `method: 'DELETE'` 만 있고 `body` 도 `Content-Type` 헤더도 **없음**을 대조한다. backend `remove` 핸들러가 `@Body` decorator **없는** body-less 핸들러임을 소스에서 추출해 정합 검증한다(T-1177 body 부재 축과 정합, T-1179 PATCH body 존재 축과 대비). backend 가 `@Body() dto` 를 추가하거나 web 이 body/Content-Type 를 붙이면 fail.
- [ ] **DELETE method 대조**: web 발사 method(`DELETE`)와 backend `@Delete` decorator 종류가 정합함을 대조한다. backend method 가 `@Post`/`@Patch`/`@Put`/`@Get` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/persons")` + `@Delete(":id")` + `@Body` 없음) 상태에서 web `runDeletePerson` 발사(유효 id)가 route/method/body부재 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/persons")` → `/api/persons`) 1 test, (2) `@Delete(":id")` 세그먼트 합성분기(path param 1) 1 test, (3) `@Body` decorator 부재 판정분기(body-less 핸들러) 1 test, (4) web `options` → method/body/헤더 부재 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/person`(오타)/`api/people` 로 바꿈 → base route 불일치 fail, (b) backend 가 `@Delete(":id")` 를 `@Delete(":id/deactivate")`(세그먼트 추가, path param 2) 로 바꿈 → route 세그먼트 초과 불일치 fail, (c) backend 가 `@Delete(":id")` 를 bare `@Delete()`(세그먼트 0) 로 바꿈 → route 세그먼트 부족 불일치 fail, (d) backend 가 method 를 `@Patch()`/`@Post()` 로 바꿨는데 web 은 DELETE 발사 → method 불일치 fail, (e) backend 가 `@Body() dto` 를 추가했는데 web 은 body 미발사 → body-less 정합 위반 fail, (f) web 이 불필요한 `body`/`Content-Type` 를 붙임 → body 부재 대조 fail, (g) web 이 id 를 encodeURIComponent 없이 raw 삽입 → path 인코딩 대조 fail, (h) 주석 줄에만 `@Delete(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/persons`→`api/person`) 또는 `@Delete(":id")`→`@Delete()`(bare) 또는 `@Delete(":id")`→`@Patch(":id")`(method 변경) 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1177/T-1179) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts` · `AdminView.group-create-contract.test.ts` · `AdminView.group-update-contract.test.ts` · `AdminView.group-delete-contract.test.ts` · `AdminView.person-create-contract.test.ts` · `AdminView.person-update-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 11 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 11 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 11 use site 도달로 우선 검토 강력 권장).
- 파트 CRUD(`POST/PATCH/DELETE /api/parts`)로 guard 확산 — 본 slice 로 인원 CRUD(생성·수정·삭제) 3 endpoint 를 완결. 이후 대상은 별도 slice.
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 별도 slice.
- 응답 status code(204 No Content) 대조 · 응답 body(없음) 대조 · P2025(미존재 404) 대조 · schema `onDelete: Cascade`(ServiceIdentity 동반 삭제) 부수효과 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runDeletePerson` 의 빈/공백 id 미발사 가드 · `deleting` 이중발사 가드 · `bumpRefresh` 성공 후 부수효과 · 실패 시 error 표면화 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 11 곳 도달 — 공용 helper 추출 ROI 가 임계를 강하게 넘어섰으므로 11 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것. 인원 CRUD 3 endpoint 완결 후 다음 확산 대상은 파트 CRUD.)
