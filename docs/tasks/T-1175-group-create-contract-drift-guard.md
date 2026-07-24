---
id: T-1175
title: 그룹 생성 endpoint web↔backend 계약 drift-guard spec (POST /api/groups bare-route on api/groups base · CreateGroupDto name 단일 required body 축)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.group-create-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1174 Out of Scope 가 명시 예약한 "그룹 생성 POST /api/groups" 확산 slice. api/groups base + bare @Post() route 합성 · CreateGroupDto name 단일 required body 부분집합 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1175 — 그룹 생성 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가(T-1173) → 그룹 멤버 제거(T-1174) 6 slice 를 거쳐 안정됐다. T-1174 Out of Scope 는 "다른 그룹/인원 mutation(**그룹 생성 `POST /api/groups`** · 인원 CRUD)로 guard 추가 확산 … 이후 대상은 별도 slice" 를 **명시적으로 예약**했으며, 그 목록의 **첫 대상**이 그룹 생성 endpoint 다. 본 task 는 그 예약을 실행한다.

그룹 생성은 web `runCreateGroup` 러너(`AdminView.tsx` 1555~1592)가 발사하고 backend `GroupController.create`(`@Controller("api/groups")` base + `@Post()` **bare route** + `@Body() dto: CreateGroupDto`, 201 Created)가 받는다. 이 경로는 앞선 6 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405/400)을 가지며, 다음 축을 대조한다:

1. **bare `@Post()` route + api/groups base 합성** — backend `@Controller("api/groups")` base 와 `@Post()`(path 인자 없음)를 합성하면 최종 template 은 `/api/groups`(base only, path param 0)다. T-1173/T-1174 가 같은 `api/groups` base 를 썼지만 그쪽은 `:id/members[/:membershipId]` 로 path 세그먼트가 붙은 반면, 본 endpoint 는 **base 그대로(추가 세그먼트 0)** 인 게 대조 포인트다. backend 가 `@Post(":id")` 처럼 세그먼트를 붙이거나 base 를 바꾸면 fail 한다.
2. **`CreateGroupDto` name 단일 required body 부분집합** — web 발사 body 는 `{ name: trimmed }` 단일 필드. backend `CreateGroupDto` 는 `@IsString @IsNotEmpty name!: string` 단일 required 필드다(optional 필드 0). web 이 보내는 body 키 집합이 DTO 의 required 집합을 **정확히 만족(부분집합 + required 누락 0)** 하는지 대조한다. backend 가 required 필드를 추가하거나(web 미발사 → 400) web 이 정의되지 않은 필드를 붙이면(`forbidNonWhitelisted` → 400) fail 한다.
3. **POST + JSON body + Content-Type 존재** — 앞선 T-1174(DELETE body 부재)와 대비되는 축. web `init` 에 `method: 'POST'` · `Content-Type: application/json` 헤더 · `body`(JSON 문자열) 가 **존재**함을 대조한다. backend 가 method 를 바꾸거나 web 이 body/헤더를 누락하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 6 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.create-user-contract.test.ts`(= T-1172 이 만든 **bare-route + 단일 required body** 선례 guard spec, POST /api/users) 전체 — base route + method decorator 인자 합성 대조 · DTO `{required, optional}` 부분집합 대조 · `options.body` JSON 파싱 후 키 집합 대조 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인(현 디스크 존재 확인됨).
- `web/src/views/AdminView.group-member-add-contract.test.ts`(= T-1173 이 만든 `api/groups` base guard 선례) — 같은 `@Controller("api/groups")` base 파싱분기의 선례. bare-route(본 task) vs `:id/members`(선례)의 차이만 조정해 차용.
- `web/src/views/AdminView.tsx` 1555~1592행 `runCreateGroup` — mock deps(`create`/`describeError`/`creating`/`setCreating`/`setCreateError`/`bumpRefresh`/`resetInput`)로 호출해 실 발사 `path`(`GROUPS_PATH` = `/api/groups`, L75)/`method`(`POST`)/`headers`(`Content-Type: application/json`)/`body`(`JSON.stringify({ name: trimmed })`)를 캡처하는 대상. 빈/공백만 name 또는 `creating` 중이면 미발사(가드) — happy-path 는 유효 name 발사 케이스로 캡처.
- `src/user/group.controller.ts` 79행 `@Controller("api/groups")` base + 128~130행 `@Post()`(bare) + `@Body() dto: CreateGroupDto` (201 Created). base(`api/groups`) 와 method decorator 인자(**없음** — bare)를 합성해 최종 template `/api/groups` 로 정규화하는 것이 route 대조의 핵심.
- `src/user/dto/create-group.dto.ts` — `@IsString @IsNotEmpty name!: string` **단일 required 필드**, optional 필드 0. web body 키 집합이 이 required 집합과 정확히 일치하는지 대조하는 근거.

## Acceptance Criteria

- [ ] **base + bare-route 합성 대조**: backend 소스에서 `@Controller("api/groups")` base 와 `@Post()`(path 인자 없음) decorator 를 파싱·합성해 최종 template `/api/groups`(base only, 추가 세그먼트 0)로 정규화하고, web `runCreateGroup` 발사 path(`GROUPS_PATH`)/method(`POST`)와 대조한다. `@Post()` 가 bare(인자 없음)임을 명시 검증 — backend 가 `@Post(":id")` 처럼 세그먼트를 붙이면 fail.
- [ ] **CreateGroupDto required body 부분집합 대조**: backend `CreateGroupDto` 에서 required 필드 집합(`{ name }`)을 추출하고, web 발사 body(JSON 파싱한 키 집합 `{ name }`)가 required 를 **모두 만족(누락 0) + 정의 밖 필드 0** 임을 대조한다. backend 가 required 필드를 추가하거나 web 이 초과 필드를 붙이면 fail.
- [ ] **POST + body/헤더 존재 대조**: web 발사 `init` 에 `method: 'POST'` · `Content-Type: application/json` 헤더 · `body`(JSON 문자열) 가 존재함을 대조한다(T-1174 의 body 부재 축과 대비). backend method 가 `@Post` 임과 정합.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/groups")` + bare `@Post()` + `CreateGroupDto name`) 상태에서 web `runCreateGroup` 발사가 route/method/body 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/groups")` → `/api/groups`) 1 test, (2) bare `@Post()` 인자 부재 합성분기(추가 세그먼트 0) 1 test, (3) required 필드 추출분기(`CreateGroupDto` → `{ name }`) 1 test, (4) web body JSON 파싱 → 키 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/group`(오타)/`api/teams` 로 바꿈 → base route 불일치 fail, (b) backend 가 bare `@Post()` 에 세그먼트를 붙임(`@Post(":id")`) → route 세그먼트 초과 불일치 fail, (c) backend 가 method 를 `@Patch()`/`@Put()` 로 바꿨는데 web 은 POST 발사 → method 불일치 fail, (d) backend DTO 에 required 필드 추가(`description` 등)했는데 web body 는 `{ name }` 만 → required 누락 fail, (e) web 이 정의 밖 필드를 붙임(`{ name, foo }`) → 초과 필드 fail, (f) web 이 `Content-Type`/`body` 를 누락 → body 존재 대조 fail, (g) 주석 줄에만 `@Post(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/groups`→`api/group`) 또는 `@Post()`→`@Post(":id")` 또는 `CreateGroupDto` 에 임시 required 필드 추가 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1172/T-1173) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 6 곳(인스턴스 접근 + 역할 변경 + 사용자 생성 + 그룹 멤버 추가 + 그룹 멤버 제거 + 그룹 생성)이 되어 추출 ROI 가 임계를 넘어섰다. 단 helper 추출은 6 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 6 use site 도달로 우선 검토 권장).
- 다른 그룹/인원 mutation(그룹 수정 `PATCH /api/groups/:id` · 그룹 삭제 `DELETE /api/groups/:id` · 인원 CRUD `POST/PATCH/DELETE /api/persons`)로 guard 추가 확산 — 본 slice 로 그룹 생성까지만. 이후 대상은 별도 slice.
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 별도 slice.
- 응답 status code(201 Created) 대조 · 응답 body(생성된 Group 객체) 대조 · P2002(중복 이름) 처리 대조(Group.name @unique 미정의라 애초에 무관) · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runCreateGroup` 의 빈/공백 name 미발사 가드 · `creating` 이중발사 가드 · `resetInput`/`bumpRefresh` 성공 후 부수효과 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 6 곳 도달 — 공용 helper 추출 ROI 가 임계를 넘어섰으므로 6 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것.)

## Result (DONE 2026-07-24T07:14Z)

PR #1067 squash-merge(8d012148) 완료. web/src/views/AdminView.group-create-contract.test.ts 신규 1파일(+300/-0, production 무변경, 파일-disjoint). 계약 3축(base+bare @Post() 세그먼트 0 합성·CreateGroupDto name 단일 required 부분집합·POST body/Content-Type 존재) 실 backend 소스 라이브 로드 대조. R-112 happy/error/branch/negative(a~g) 18 tests. base flip 실측 6 fail→revert 로 guard 유효 검증. web vitest 1290 pass + tsc --noEmit + vite build green. reviewer round 1/7 APPROVE(0 BLOCKER/0 MAJOR/0 MINOR, 1 NIT informational=공용 helper 추출 Out-of-Scope refactor 이연), 4-게이트 PASS(reviewer comment external #issuecomment-5067162772, CI green run 30074570487, mergeState CLEAN). counters 1165→1166.
