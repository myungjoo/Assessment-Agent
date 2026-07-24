---
id: T-1176
title: 그룹 수정 endpoint web↔backend 계약 drift-guard spec (PATCH /api/groups/:id · UpdateGroupDto name 단일 optional partial body 축 + encodeURIComponent :id path)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.group-update-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1175 Out of Scope 예약 목록의 첫 대상 "그룹 수정 PATCH /api/groups/:id". :id path(encodeURIComponent) 세그먼트 + UpdateGroupDto name 단일 optional partial(required 0) body 축이 대조 신규 포인트. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1176 — 그룹 수정 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가(T-1173) → 그룹 멤버 제거(T-1174) → 그룹 생성(T-1175) 7 slice 를 거쳐 안정됐다. T-1175 Out of Scope 는 "다른 그룹/인원 mutation(**그룹 수정 `PATCH /api/groups/:id`** · 그룹 삭제 `DELETE /api/groups/:id` · 인원 CRUD)로 guard 추가 확산 … 이후 대상은 별도 slice" 를 **명시적으로 예약**했으며, 그 목록의 **첫 대상**이 그룹 수정 endpoint 다. 본 task 는 그 예약을 실행한다.

그룹 수정은 web `runUpdateGroup` 러너(`AdminView.tsx` 2323~2372)가 발사하고 backend `GroupController.update`(`@Controller("api/groups")` base + `@Patch(":id")` + `@Body() patch: UpdateGroupDto`, 200 반환)가 받는다. 이 경로는 앞선 7 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405/400)을 가지며, 다음 축을 대조한다 — 특히 **앞선 slice 에 없던 두 신규 대조 포인트**를 담는다:

1. **`:id` path 세그먼트 + api/groups base 합성 + encodeURIComponent** — backend `@Controller("api/groups")` base 와 `@Patch(":id")` 를 합성하면 최종 template 은 `/api/groups/:id`(path param 1)다. T-1175(그룹 생성)가 같은 `api/groups` base 를 bare route(`/api/groups`, 세그먼트 0)로 쓴 반면 본 endpoint 는 **`:id` 단일 path param 이 붙는 게 대조 포인트**다. web 러너는 `${GROUPS_PATH}/${encodeURIComponent(id)}` 로 path 를 합성한다 — id 를 **encodeURIComponent 로 안전 인코딩**하는 점(비정상 문자가 든 id 도 path 를 안 깨뜨림)이 T-1171(role-change PATCH :id/role) 이후 재확인 대상. backend 가 세그먼트를 빼거나(`@Patch()` bare) 다른 세그먼트로 바꾸면 fail 한다.
2. **`UpdateGroupDto` name 단일 optional partial body — required 0 축** — 이게 본 slice 의 **가장 큰 신규 대조**다. web 발사 body 는 `{ name: trimmed }` 단일 필드. backend `UpdateGroupDto` 는 `@IsOptional @IsString @IsNotEmpty @MaxLength(255) name?: string` — **required 필드 0(name 이 optional)** 인 partial-update DTO 다. 앞선 slice(T-1172 email/password required · T-1175 name required)와 달리 **required 집합이 빈 집합**이므로, 대조는 "web 발사 body 키 집합 ⊆ declared 필드 집합(정의 밖 필드 0) AND required(=∅) 누락 0" 형태가 된다. backend 가 name 을 required 로 승격(`@IsOptional` 제거)하거나 web 이 정의 밖 필드를 붙이면(`forbidNonWhitelisted` → 400) fail 한다.
3. **PATCH + JSON body + Content-Type 존재** — T-1174(DELETE body 부재)와 대비되고 T-1171(role-change PATCH)과 정합되는 축. web `init` 에 `method: 'PATCH'` · `Content-Type: application/json` 헤더 · `body`(JSON 문자열) 가 **존재**함을 대조한다. backend 가 method 를 바꾸거나 web 이 body/헤더를 누락하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 7 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.role-change-contract.test.ts`(= T-1171 이 만든 **`:id` path param + PATCH + method decorator 합성** 선례 guard spec, PATCH /api/users/:id/role) 전체 — base route + `:id` 세그먼트 합성 대조 · encodeURIComponent path param 처리 · `options.body` JSON 파싱 후 키 집합 대조 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.group-create-contract.test.ts`(= T-1175 이 만든 `api/groups` base guard 선례) — 같은 `@Controller("api/groups")` base 파싱분기의 선례. bare-route(T-1175) vs `:id`(본 task)의 세그먼트 차이 · required body(T-1175) vs optional partial body(본 task)의 required 집합 차이만 조정해 차용.
- `web/src/views/AdminView.tsx` 2323~2372행 `runUpdateGroup` — mock deps(`update`/`describeError`/`updating`/`setUpdating`/`setUpdateError`/`bumpRefresh`/`closeEdit`)로 호출해 실 발사 `path`(`${GROUPS_PATH}/${encodeURIComponent(id)}`, `GROUPS_PATH` = `/api/groups`, L75)/`method`(`PATCH`)/`headers`(`Content-Type: application/json`)/`body`(`JSON.stringify({ name: trimmed })`)를 캡처하는 대상. 빈/공백 id·미변경 name·`updating` 중이면 미발사(가드) — happy-path 는 유효 id + 변경된 name 발사 케이스로 캡처.
- `src/user/group.controller.ts` 79행 `@Controller("api/groups")` base + 176~181행 `@Patch(":id")` + `@Body() patch: UpdateGroupDto`. base(`api/groups`) 와 method decorator 인자(`:id`)를 합성해 최종 template `/api/groups/:id`(path param 1)로 정규화하는 것이 route 대조의 핵심.
- `src/user/dto/update-group.dto.ts` — `@IsOptional @IsString @IsNotEmpty @MaxLength(255) name?: string` **단일 optional 필드(required 0)**. web body 키 집합이 declared 집합의 부분집합이면서 required(=∅)를 누락 없이 만족하는지 대조하는 근거.

## Acceptance Criteria

- [ ] **base + `:id` route 합성 대조**: backend 소스에서 `@Controller("api/groups")` base 와 `@Patch(":id")` decorator 를 파싱·합성해 최종 template `/api/groups/:id`(path param 1)로 정규화하고, web `runUpdateGroup` 발사 path(`${GROUPS_PATH}/${encodeURIComponent(id)}`)/method(`PATCH`)와 대조한다. path param 이 정확히 1개(`:id`)임을 명시 검증 — backend 가 `@Patch()`(bare)로 세그먼트를 빼거나 다른 세그먼트로 바꾸면 fail.
- [ ] **encodeURIComponent path 처리 대조**: web 러너가 id 를 `encodeURIComponent` 로 안전 인코딩해 path 세그먼트에 넣음을 검증(비정상 문자 든 id 도 path 가 안 깨지는지 — 예: 공백·`/` 든 id 가 인코딩됨). backend 의 `:id` param 슬롯 정합.
- [ ] **UpdateGroupDto optional partial body 부분집합 대조**: backend `UpdateGroupDto` 에서 declared 필드 집합(`{ name }`)과 required 집합(**∅ — name 이 `@IsOptional`**)을 추출하고, web 발사 body(JSON 파싱한 키 집합 `{ name }`)가 declared 를 **초과하지 않음(정의 밖 필드 0)** + required(∅) 누락 0 임을 대조한다. backend 가 name 을 required 로 승격(`@IsOptional` 제거)해 required 집합이 `{ name }` 이 됐는데 web 이 name 을 미발사하는 경우도 fail 로 잡히도록(현재는 web 이 name 을 항상 발사하므로 green — required 추출 자체를 검증).
- [ ] **PATCH + body/헤더 존재 대조**: web 발사 `init` 에 `method: 'PATCH'` · `Content-Type: application/json` 헤더 · `body`(JSON 문자열) 가 존재함을 대조한다(T-1174 의 body 부재 축과 대비, T-1171 PATCH 축과 정합). backend method 가 `@Patch` 임과 정합.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/groups")` + `@Patch(":id")` + `UpdateGroupDto name?`) 상태에서 web `runUpdateGroup` 발사가 route/method/body 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/groups")` → `/api/groups`) 1 test, (2) `@Patch(":id")` 세그먼트 합성분기(path param 1) 1 test, (3) declared/required 필드 추출분기(`UpdateGroupDto` → declared `{ name }`, required ∅) 1 test, (4) web body JSON 파싱 → 키 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/group`(오타)/`api/teams` 로 바꿈 → base route 불일치 fail, (b) backend 가 `@Patch(":id")` 를 bare `@Patch()` 로 바꿈(세그먼트 0) → route 세그먼트 부족 불일치 fail, (c) backend 가 method 를 `@Put()`/`@Post()` 로 바꿨는데 web 은 PATCH 발사 → method 불일치 fail, (d) backend DTO 가 name 을 required 로 승격(`@IsOptional` 제거)했는데 required 추출이 이를 반영 안 하면 fail(required 집합 추출 정합 검증), (e) web 이 정의 밖 필드를 붙임(`{ name, foo }`) → declared 초과 필드 fail, (f) web 이 `Content-Type`/`body` 를 누락 → body 존재 대조 fail, (g) web 이 id 를 encodeURIComponent 없이 raw 삽입 → path 인코딩 대조 fail, (h) 주석 줄에만 `@Patch(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/groups`→`api/group`) 또는 `@Patch(":id")`→`@Patch()` 또는 `UpdateGroupDto` name 의 `@IsOptional` 임시 제거 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1171/T-1175) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts` · `AdminView.group-create-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 7 곳이 되어 추출 ROI 가 임계를 넘어섰다. 단 helper 추출은 7 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 7 use site 도달로 우선 검토 강력 권장).
- 다른 그룹/인원 mutation(그룹 삭제 `DELETE /api/groups/:id` · 인원 CRUD `POST/PATCH/DELETE /api/persons` · 파트 CRUD)로 guard 추가 확산 — 본 slice 로 그룹 수정까지만. 이후 대상은 별도 slice.
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 별도 slice.
- 응답 status code(200) 대조 · 응답 body(수정된 Group 객체) 대조 · P2002(중복 이름) 처리 대조(Group.name @unique 미정의라 무관) · P2025(미존재 404) 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runUpdateGroup` 의 빈/공백 id 미발사 가드 · 미변경 name 미발사 가드 · `updating` 이중발사 가드 · `bumpRefresh`/`closeEdit` 성공 후 부수효과 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 7 곳 도달 — 공용 helper 추출 ROI 가 임계를 강하게 넘어섰으므로 7 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것.)

---

## 완료 기록

- Status: DONE (2026-07-24T08:00:48Z)
- PR: [#1068](https://github.com/myungjoo/Assessment-Agent/pull/1068) squash `ce122029` + branch delete
- 결과: test-only 신규 1파일 `web/src/views/AdminView.group-update-contract.test.ts` (+300 LOC). 신규 spec 19 test green, web 전체 1309 pass, build/lint green. drift 실측(@Patch(":id")→@Patch() 6 test fail → revert) 확인. reviewer round 1/7 APPROVE (0 BLOCKER/0 MAJOR/0 MINOR/1 NIT informational — non-route decorator 스킵 분기 명시 assert 부재, cap 300/300 이라 follow-up 권장·비차단), 4-게이트 PASS.
- fineGrainedConcurrency ON(stage 5b) claim-pickup fire (cron@cloud-429d35aa, claimedAt 2026-07-24T07:38:39Z ≈ server-time).
