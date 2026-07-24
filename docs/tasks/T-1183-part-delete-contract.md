---
id: T-1183
title: 파트 삭제 endpoint web↔backend 계약 drift-guard spec (DELETE /api/parts/:id · api/parts base + @Delete(":id") 단일 path param + body 부재 축(@Body 없음) + @HttpCode(204))
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.part-delete-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1182 Out of Scope 예약 "파트 삭제(DELETE /api/parts/:id)로 guard 확산 — 파트 CRUD arc 마무리" 대상. api/parts base + @Delete(":id") 단일 path param + DELETE body 부재(@Body 없음) 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1183 — 파트 삭제 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹·파트 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가/제거(T-1173/T-1174) → 그룹 생성/수정/삭제(T-1175/T-1176/T-1177) → 인원 생성/수정/삭제(T-1178/T-1179/T-1180) → 파트 생성/수정(T-1181/T-1182) 14 slice 를 거쳐 안정됐다. T-1182 Out of Scope 는 "파트 삭제(`DELETE /api/parts/:id`)로 guard 확산 — 본 slice 는 파트 수정만. 이후 대상은 별도 slice(파트 CRUD arc 마무리)" 를 **명시적으로 예약**했으며, 그 예약의 **대상**이 파트 삭제 endpoint 다. 본 task 는 그 예약을 실행하며, 파트 CRUD 계약 guard(생성 POST · 수정 PATCH · 삭제 DELETE) 3 endpoint 를 완결한다.

파트 삭제는 web `runDeletePart` 러너(`AdminView.tsx` 2087~2119)가 발사하고 backend `PartController.delete`(`@Controller("api/parts")` base + `@Delete(":id")` + `@HttpCode(204)`, `@Body` 없음, 204 No Content 반환)가 받는다. 이 경로는 앞선 14 slice 와 같은 silent-drift 위험(backend 가 route/method 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405)을 가지며, 다음 축을 대조한다 — 특히 **파트 도메인 DELETE 에서의 신규/대비 대조 포인트**를 담는다:

1. **`api/parts` base + `@Delete(":id")` 단일 path param 합성 — `api/parts` base 에 DELETE method 첫 결합** — backend `@Controller("api/parts")` base 와 `@Delete(":id")` 를 합성하면 최종 template 은 `/api/parts/:id`(path param **정확히 1개**)다. T-1181(part create)은 `api/parts` base + bare `@Post()`(param 0)였고, T-1182(part update)은 `api/parts` base + `@Patch(":id")`(param 1, PATCH)였으므로 본 task 는 **`api/parts` base 에 `@Delete(":id")`(DELETE method + param 1)** 를 처음 결합한다(신규 method 조합). T-1180(person delete)이 같은 DELETE+`:id` shape 였으나 base 가 `api/persons` 였던 것과 대비된다. web 러너는 `` `${PARTS_PATH}/${encodeURIComponent(id)}` ``(`PARTS_PATH` = `/api/parts`, L95)로 path 를 합성한다 — id 를 **encodeURIComponent 로 안전 인코딩**하는 점(비정상 문자가 든 id 도 path 를 안 깨뜨림)이 T-1180 / T-1182 이후 재확인 대상. backend 가 세그먼트를 추가(`:id/archive`)하거나 빼면(`@Delete()` bare) fail 한다.
2. **DELETE + body/Content-Type 부재 — `@Body` 없음 축 (파트 도메인 body 부재)** — 이게 본 slice 의 **가장 큰 대조**다. web 발사 `init` 은 `{ method: 'DELETE' }` 뿐 — **`body` 도 `Content-Type` 헤더도 없다**(L2106~2108). backend `delete(@Param("id") id)` 는 **`@Body` decorator 가 없는 body-less** 핸들러다. 앞선 파트 body 있는 slice(T-1182 PATCH body · T-1181 POST body)와 달리 대조는 "web 발사 body **부재** + Content-Type 헤더 **부재** AND backend `@Body` decorator **부재**" 형태가 된다. T-1180(person delete DELETE)의 body 부재 축과 정합되고 T-1182(part update PATCH body 존재)와 대비된다. backend 가 body 를 요구하도록 `@Body() dto` 를 붙이거나 web 이 불필요한 body/헤더를 붙이면 fail 한다.
3. **DELETE method + `@HttpCode(204)`** — web `init.method === 'DELETE'` 와 backend `@Delete` decorator 의 정합을 대조한다. backend 가 method 를 바꾸거나(`@Post`/`@Patch`/`@Put`) web 이 다른 method 를 발사하면 fail 한다. (응답 status 204 자체의 대조 · 소속 Person 1+ 시 409 대조는 요청 계약 harness 경계 밖 — Out of Scope 참조. 여기서는 method decorator 종류만 대조한다.)

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 14 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.person-delete-contract.test.ts`(= T-1180 이 만든 **DELETE + body 부재 + `@Delete(":id")` 단일 path param + `@Body` 없음** 선례 guard spec) 전체 — DELETE method 대조 · body/Content-Type 부재 대조 · `@Body` decorator 부재 판정 · path param 1 세그먼트 합성 · `encodeURIComponent` 정합 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1180 은 `api/persons` base 였으므로 본 task 는 **`api/parts` base** 로 base 문자열만 조정한다(method/param shape 는 동일). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.part-update-contract.test.ts`(= T-1182 이 만든 `api/parts` base + `:id` 단일 path param 선례) · `web/src/views/AdminView.part-create-contract.test.ts`(= T-1181 이 만든 `api/parts` base 선례) — 같은 `@Controller("api/parts")` base 문자열 파싱·정규화 선례. PATCH+body(T-1182) vs DELETE+body부재(본 task)의 method/body 축 차이만 조정해 차용.
- `web/src/views/AdminView.tsx` 2087~2119행 `runDeletePart` — mock deps(`remove`/`describeError`/`deleting`/`setDeleting`/`setDeleteError`/`bumpRefresh`)로 호출해 실 발사 `path`(`` `${PARTS_PATH}/${encodeURIComponent(id)}` ``, `PARTS_PATH` = `/api/parts`, L95)/`method`(`DELETE`)/`options`(body/Content-Type **부재** — `{ method: 'DELETE' }` 뿐, L2106~2108)를 캡처하는 대상. 빈/공백 id·`deleting` 중이면 미발사(가드) — happy-path 는 유효 id 발사 케이스로 캡처.
- `src/user/part.controller.ts` 50행 `@Controller("api/parts")` base + 131~135행 `@Delete(":id")` + `@HttpCode(204)` + `@Param("id") id` (`@Body` **없음**, 핸들러 이름은 `delete`). base(`api/parts`)와 method decorator 인자(`:id`)를 합성해 최종 template `/api/parts/:id`(path param 1)로 정규화하는 것이 route 대조의 핵심. `@Body` decorator 부재가 body 부재 대조의 근거.

## Acceptance Criteria

- [ ] **base + `@Delete(":id")` route 합성 대조**: backend 소스에서 `@Controller("api/parts")` base 와 `@Delete(":id")` decorator 를 파싱·합성해 최종 template `/api/parts/:id`(path param **정확히 1개**)로 정규화하고, web `runDeletePart` 발사 path(`` `${PARTS_PATH}/${encodeURIComponent(id)}` `` → `/api/parts/<id>`)/method(`DELETE`)와 대조한다. path param 이 정확히 1개(`:id`)이고 base 가 `api/parts` 임을 명시 검증 — backend 가 `@Delete()`(bare, 세그먼트 0) 또는 base 를 `api/part`(오타)/`api/parties` 로 바꾸면 fail.
- [ ] **encodeURIComponent path 처리 대조**: web 러너가 id 를 `encodeURIComponent` 로 안전 인코딩해 path 세그먼트에 넣음을 검증(비정상 문자 든 id 도 path 가 안 깨지는지 — 예: 공백·`/` 든 id 가 인코딩됨). backend 의 `:id` param 슬롯 정합.
- [ ] **DELETE body/Content-Type 부재 대조**: web 발사 `init` 에 `method: 'DELETE'` 만 있고 `body` 도 `Content-Type` 헤더도 **없음**을 대조한다. backend `delete` 핸들러가 `@Body` decorator **없는** body-less 핸들러임을 소스에서 추출해 정합 검증한다(T-1180 body 부재 축과 정합, T-1182 PATCH body 존재 축과 대비). backend 가 `@Body() dto` 를 추가하거나 web 이 body/Content-Type 를 붙이면 fail.
- [ ] **DELETE method 대조**: web 발사 method(`DELETE`)와 backend `@Delete` decorator 종류가 정합함을 대조한다. backend method 가 `@Post`/`@Patch`/`@Put`/`@Get` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/parts")` + `@Delete(":id")` + `@Body` 없음) 상태에서 web `runDeletePart` 발사(유효 id)가 route/method/body부재 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/parts")` → `/api/parts`) 1 test, (2) `@Delete(":id")` 세그먼트 합성분기(path param 1) 1 test, (3) `@Body` decorator 부재 판정분기(body-less 핸들러) 1 test, (4) web `options` → method/body/헤더 부재 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/part`(오타)/`api/parties` 로 바꿈 → base route 불일치 fail, (b) backend 가 `@Delete(":id")` 를 `@Delete(":id/archive")`(세그먼트 추가, path param 2) 로 바꿈 → route 세그먼트 초과 불일치 fail, (c) backend 가 `@Delete(":id")` 를 bare `@Delete()`(세그먼트 0) 로 바꿈 → route 세그먼트 부족 불일치 fail, (d) backend 가 method 를 `@Patch()`/`@Post()` 로 바꿨는데 web 은 DELETE 발사 → method 불일치 fail, (e) backend 가 `@Body() dto` 를 추가했는데 web 은 body 미발사 → body-less 정합 위반 fail, (f) web 이 불필요한 `body`/`Content-Type` 를 붙임 → body 부재 대조 fail, (g) web 이 id 를 encodeURIComponent 없이 raw 삽입 → path 인코딩 대조 fail, (h) 주석 줄에만 `@Delete(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/parts`→`api/part`) 또는 `@Delete(":id")`→`@Delete()`(bare) 또는 `@Delete(":id")`→`@Patch(":id")`(method 변경) 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1180/T-1182) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(instance-access · role-change · create-user · group-member-add · group-member-remove · group-create · group-update · group-delete · person-create · person-update · person-delete · part-create · part-update contract test) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 15 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 15 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 15 use site 도달로 우선 검토 강력 권장).
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 본 slice 로 파트 CRUD(생성·수정·삭제) 3 endpoint 를 완결. 이후 확산 대상은 별도 slice.
- 응답 status code(204 No Content) 대조 · 응답 body(없음) 대조 · P2025(미존재 404) 대조 · 소속 Person 1+ 시 409(REQ-028 dangling reference 차단) 대조 · 409 전용 문구 표면화 검증 · schema 부수효과 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runDeletePart` 의 빈/공백 id 미발사 가드 · `deleting` 이중발사 가드 · `bumpRefresh` 성공 후 부수효과 · 실패 시 error 표면화(409 분기 포함) 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 15 곳 도달 — 공용 helper 추출 ROI 가 임계를 **강하게** 넘어섰으므로 15 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것(별도 slice — 파일-disjoint 동시 claim 안전성을 깨므로 본 arc 확산과 분리). 파트 CRUD 3 endpoint 완결 후 다음 확산 대상은 LLM provider mutation(POST/DELETE /api/llm/providers).)

## Result (DONE)

- 완료: 2026-07-24 (PR #1075 squash merge `4883bc6b`, branch delete).
- 신규 파일 1개 `web/src/views/AdminView.part-delete-contract.test.ts` (+276 LOC, 18 test green — it.each 5 포함). production 소스 불변(`test:cov` 기준선 유지).
- 실측: `@Delete(":id")`→`@Delete()` 변이 시 6 test fail 확인 후 되돌림(drift 검출력 검증).
- reviewer round 1/7 APPROVE(0 BLOCKER/MAJOR/MINOR, NIT 2 조치 불요). 4-게이트 PASS, CI green(기본 검사 pass incl 승인 게이트 + 배포 산출물 검증 pass).
- 파트 CRUD(생성 POST T-1181 · 수정 PATCH T-1182 · 삭제 DELETE T-1183) 계약 guard arc 완결. 다음 확산 대상: LLM provider mutation(T-1184 큐잉).
