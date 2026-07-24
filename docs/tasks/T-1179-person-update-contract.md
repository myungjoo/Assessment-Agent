---
id: T-1179
title: 인원 수정 endpoint web↔backend 계약 drift-guard spec (PATCH /api/persons/:id · api/persons base + @Patch(":id") path param 1 합성 + UpdatePersonDto 전-필드 optional partial(required ∅) allowed-field 부분집합 축)
phase: P6
status: DONE
completedAt: 2026-07-24T09:29:36Z
result: PR #1071 round1 APPROVE(0 BLOCKER/MAJOR/MINOR, 1 informational NIT) → squash df783e1e. web 40파일 1368 test green + build + 루트 lint clean. 신규 spec 21 test. backend 무변경.
commitMode: pr
coversReq: [REQ-026, REQ-045]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.person-update-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1178 Out of Scope 예약 "인원 CRUD 잔여 mutation(PATCH /api/persons/:id · DELETE)" 첫 대상. persons base + @Patch(":id") path param 1 + 전-필드 optional partial + active boolean 신규 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1179 — 인원 수정 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가/제거(T-1173/T-1174) → 그룹 생성/수정/삭제(T-1175/T-1176/T-1177) → 인원 생성(T-1178) 9 slice 를 거쳤다. T-1178 Out of Scope 는 "인원 CRUD 잔여 mutation(수정 `PATCH /api/persons/:id` · 삭제 `DELETE /api/persons/:id`)로 guard 확산 … 각각 PATCH partial body / DELETE body 부재 축" 을 **명시적으로 예약**했으며, 그 목록의 **첫 대상**이 인원 수정 endpoint 다. 본 task 는 그 예약을 실행하며, 계약 guard 를 person domain 의 **PATCH partial 축**으로 확장한다.

인원 수정은 web `runUpdatePerson` 러너(`AdminView.tsx` 2244~2286)가 발사하고 backend `PersonController.update`(`@Controller("api/persons")` base + `@Patch(":id")` + `@Param("id")` + `@Body() patch: UpdatePersonDto`)가 받는다. 이 경로는 앞선 9 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/400)을 가지며, 다음 축을 대조한다 — 특히 **앞선 slice 대비 신규/재확인 대조 포인트**를 담는다:

1. **`api/persons` base + `@Patch(":id")` 합성 — path param 1개, persons base 에 path param 첫 결합** — backend `@Controller("api/persons")` base 와 `@Patch(":id")` 를 합성하면 최종 template `/api/persons/:id`(path param **1개**)다. web 러너는 `` `${PERSONS_PATH}/${encodeURIComponent(id)}` ``(= `/api/persons/<id>`)를 path 로 쓴다. T-1178(person create)은 `api/persons` base + bare `@Post()`(param 0)였고, T-1176(group update)은 `api/groups` base + `@Patch(":id")`(param 1)였으므로 본 task 는 **`api/persons` base 에 `:id` path param 을 처음 결합**한다(신규 shape 조합). backend 가 base 를 오타내거나(`api/person`) `@Patch(":id")` 의 param 을 빼면(`@Patch()`) fail 한다. `encodeURIComponent` 인코딩 정합도 대조한다(비정상 문자 id 안전).
2. **UpdatePersonDto 전-필드 optional partial → required ∅ + allowed-field 부분집합 대조 — `active` boolean optional 필드 신규 포함** — 이게 본 slice 의 **핵심 대조**다. backend `UpdatePersonDto`(`src/user/dto/update-person.dto.ts`)는 `fullName?`(`@IsOptional`+`@IsString`) · `email?`(`@IsOptional`+`@IsEmail`) · `active?`(`@IsOptional`+`@IsBoolean`) **3 필드 모두 optional**(required 집합 = ∅)이다. partial DTO 이므로 "web body ⊇ required(∅)" 는 자명 통과 — 의미 있는 대조는 **역방향**: web 발사 body 의 key 집합이 backend 가 **허용(allowed)하는 필드 집합 `{fullName, email, active}` 의 부분집합(⊆)** 임을 검증한다(web 이 backend 가 모르는 엉뚱한 key 를 보내지 않는지). T-1176(group update `name` 단일 optional)의 optional-partial 축과 정합되며, 본 slice 는 **다중 optional 필드 + `active` boolean 타입**을 처음 대조한다. backend 가 필드를 rename(`fullName`→`name`) 했는데 web 은 옛 key 를 보내거나, web 이 `role` 같은 backend 미허용 key 를 담으면 fail 한다.
3. **PATCH body + Content-Type 존재 대조** — web `init` 은 `{ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }`다. backend `update(@Body() patch)` 는 `@Body` decorator **있는** body-요구 핸들러다. 대조는 "web body/Content-Type **존재** AND backend `@Body` decorator **존재**" 형태다(T-1176 PATCH body 존재 축과 정합, T-1177 DELETE body 부재 축과 대비). backend 가 `@Body` 를 제거하거나 web 이 body/Content-Type 를 빼면 fail 한다.
4. **PATCH method 대조** — web `init.method === 'PATCH'` 와 backend `@Patch` decorator 의 정합을 대조한다. backend 가 method 를 바꾸거나(`@Put`/`@Post`) web 이 다른 method 를 발사하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 9 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.group-update-contract.test.ts`(= T-1176 이 만든 **`@Patch(":id")` path param 1 합성 + `encodeURIComponent` + optional partial(required ∅) + PATCH body/Content-Type 존재** 선례 guard spec) 전체 — path param 1 합성 대조 · encodeURIComponent 정합 · optional partial 추출(required ∅) · allowed-field 부분집합 판정 · PATCH body 존재 대조 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1176 은 `api/groups` base + `name` 단일 optional 이므로 본 task 는 **`api/persons` base + `{fullName, email, active}` 다중 optional** 로 base 문자열·필드 집합만 조정한다. 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.person-create-contract.test.ts`(= T-1178 이 만든 `api/persons` base 선례) — 같은 `api/persons` base 문자열 파싱·정규화 선례. base 재확인 + method/param 조합만 조정해 차용.
- `web/src/views/AdminView.tsx` 2244~2286행 `runUpdatePerson` — mock deps(`update`/`describeError`/`updating`/`setUpdating`/`setUpdateError`/`bumpRefresh`/`closeEdit`)로 호출해 실 발사 `path`(`` `${PERSONS_PATH}/${encodeURIComponent(id)}` ``)/`method`(`PATCH`)/`options`(body=`JSON.stringify(patch)` + `Content-Type: application/json`)를 캡처하는 대상. 빈/공백 id · `updating` 중 · `patch` 빈 객체(`Object.keys(patch).length === 0`)면 미발사(가드) — happy-path 는 유효 id + 비어있지 않은 patch(≥1 필드)로 캡처.
- `src/user/person.controller.ts` 41행 `@Controller("api/persons")` base + 81~85행 `@Patch(":id")` + `@Param("id") id` + `@Body() patch: UpdatePersonDto`. base(`api/persons`)와 `@Patch(":id")` param 을 합성해 최종 template `/api/persons/:id`(path param 1)로 정규화하는 것이 route 대조의 핵심. `@Body` decorator 존재가 body 요구 대조의 근거.
- `src/user/dto/update-person.dto.ts` — `fullName?`(`@IsOptional`+`@IsString`) + `email?`(`@IsOptional`+`@IsEmail`) + `active?`(`@IsOptional`+`@IsBoolean`) 3 필드 모두 optional(required ∅). allowed 필드 집합 = `{fullName, email, active}`, required 집합 = ∅ 추출이 부분집합 대조의 근거.

## Acceptance Criteria

- [ ] **base + `@Patch(":id")` route 합성 대조**: backend 소스에서 `@Controller("api/persons")` base 와 `@Patch(":id")` decorator 를 파싱·합성해 최종 template `/api/persons/:id`(path param **1개**)로 정규화하고, web `runUpdatePerson` 발사 path(`` `${PERSONS_PATH}/${encodeURIComponent(id)}` `` → `/api/persons/<id>`)/method(`PATCH`)와 대조한다. path param 이 정확히 1개(`:id`)이고 base 가 `api/persons` 임을 명시 검증 — backend 가 `@Patch()`(param 제거) 또는 base 를 `api/person`(오타)로 바꾸면 fail. `encodeURIComponent` 로 id 를 인코딩하는 정합도 대조.
- [ ] **UpdatePersonDto optional partial(required ∅) + allowed-field 부분집합 대조**: backend `UpdatePersonDto` 소스에서 optional 필드 집합(`{fullName, email, active}`)과 required 집합(∅)을 추출하고, web 발사 body(happy-path patch)의 key 집합이 backend allowed 집합의 **부분집합(⊆)** 임을 검증한다(web 이 backend 미허용 key 를 보내지 않는지). required 가 ∅ 임(전-필드 optional)도 명시 검증. backend 가 필드를 rename 했는데 web 이 옛 key 를 보내거나 web 이 backend 미허용 key 를 담으면 fail.
- [ ] **PATCH body/Content-Type 존재 대조**: web 발사 `init` 에 `method: 'PATCH'` + `body`(JSON) + `Content-Type: application/json` 헤더가 **모두 있음**을 대조한다. backend `update` 핸들러가 `@Body` decorator **있는** body-요구 핸들러임을 소스에서 추출해 정합 검증한다(T-1176 PATCH body 존재 축과 정합, T-1177 DELETE body 부재 축과 대비). backend 가 `@Body` 를 제거하거나 web 이 body/Content-Type 를 빼면 fail.
- [ ] **PATCH method 대조**: web 발사 method(`PATCH`)와 backend `@Patch` decorator 종류가 정합함을 대조한다. backend method 가 `@Put`/`@Post`/`@Delete` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/persons")` + `@Patch(":id")` + `@Body() UpdatePersonDto`) 상태에서 web `runUpdatePerson` 발사(유효 id + ≥1 필드 patch)가 route/method/body존재/allowed부분집합 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base+`@Patch(":id")` route 파싱분기(`/api/persons/:id`, path param 1) 1 test, (2) encodeURIComponent 인코딩 정합분기 1 test, (3) allowed/required 필드 집합 추출분기(`{fullName,email,active}` / required ∅) 1 test, (4) web `options` → method/body/Content-Type 존재 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/person`(오타)/`api/people` 로 바꿈 → base route 불일치 fail, (b) backend 가 `@Patch(":id")` 를 `@Patch()`(path param 제거) 로 바꿈 → param 개수 불일치 fail, (c) backend 가 `@Patch(":id")` 를 `@Patch("archive/:id")`(세그먼트 추가) 로 바꿈 → route 세그먼트 초과 불일치 fail, (d) backend 가 `UpdatePersonDto` 필드를 rename(`fullName`→`name`) 했는데 web 은 `fullName` key 발사 → allowed 부분집합 위반 fail, (e) web body 가 backend 미허용 key(`role`)를 담음 → allowed 부분집합 위반 fail, (f) backend 가 method 를 `@Put()`/`@Post()` 로 바꿨는데 web 은 PATCH 발사 → method 불일치 fail, (g) backend 가 `@Body` decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반 fail, (h) web 이 `Content-Type` 헤더를 빼고 발사 → body/Content-Type 존재 대조 fail, (i) 주석 줄에만 `@Patch(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/persons`→`api/person`) 또는 `@Patch(":id")`→`@Patch()`(param 제거) 또는 `UpdatePersonDto` 필드 rename 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1176/T-1178) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts` · `AdminView.group-create-contract.test.ts` · `AdminView.group-update-contract.test.ts` · `AdminView.group-delete-contract.test.ts` · `AdminView.person-create-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 10 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 10 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 10 use site 도달로 우선 검토 강력 권장).
- 인원 CRUD 잔여 mutation(삭제 `DELETE /api/persons/:id`)로 guard 확산 — 본 slice 는 인원 수정(PATCH) 1 endpoint 만. 인원 삭제는 별도 slice(DELETE body 부재 축 + `@HttpCode(204)`).
- 파트 CRUD(`POST/PATCH/DELETE /api/parts`)로 guard 확산 — 인원 CRUD 3 endpoint 완결 후 별도 slice.
- 응답 status code(200 OK) 대조 · 응답 body(수정된 Person) 대조 · `active` soft-deactivate 부수효과 · 409 email 중복(P2002) 대조 · 400 검증 실패 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runUpdatePerson` 의 빈/공백 id 미발사 가드 · `updating` 이중발사 가드 · 빈 patch(`Object.keys().length === 0`) 미발사 가드 · `bumpRefresh`/`closeEdit` 성공 후 부수효과 · 실패 시 error 표면화 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 10 곳 도달 — 공용 helper 추출 ROI 가 임계를 강하게 넘어섰으므로 10 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것.)
