---
id: T-1178
title: 인원 생성 endpoint web↔backend 계약 drift-guard spec (POST /api/persons · api/persons 신규 base + bare @Post() route 합성 + fullName+email 2 required body 부분집합 축)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-045]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.person-create-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1177 Out of Scope 예약 목록 "인원 CRUD POST/PATCH/DELETE /api/persons" 첫 대상. api/persons 신규 base + fullName+email 2 required 축이 T-1172(api/users) 대비 신규 domain. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1178 — 인원 생성 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가(T-1173) → 그룹 멤버 제거(T-1174) → 그룹 생성(T-1175) → 그룹 수정(T-1176) → 그룹 삭제(T-1177) 8 slice 를 거쳐 사용자·그룹 domain 을 완결했다. T-1177 Out of Scope 는 "다른 인원/파트 mutation(**인원 CRUD `POST/PATCH/DELETE /api/persons`** · 파트 CRUD `POST/PATCH/DELETE /api/parts`)로 guard 추가 확산 … 이후 대상은 별도 slice" 를 **명시적으로 예약**했으며, 그 목록의 **첫 대상**이 인원 생성 endpoint 다. 본 task 는 그 예약을 실행하며, 계약 guard 를 **처음으로 person domain(신규 `api/persons` base)** 으로 확장한다.

인원 생성은 web `runCreatePerson` 러너(`AdminView.tsx` 1479~1524)가 발사하고 backend `PersonController.create`(`@Controller("api/persons")` base + bare `@Post()` + `@HttpCode(201)` + `@Body() dto: CreatePersonDto`)가 받는다. 이 경로는 앞선 8 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/400)을 가지며, 다음 축을 대조한다 — 특히 **앞선 slice 대비 신규/재확인 대조 포인트**를 담는다:

1. **`api/persons` 신규 base + bare `@Post()` 합성 — path param 0, 신규 domain base** — backend `@Controller("api/persons")` base 와 bare `@Post()`(인자 없음)를 합성하면 최종 template 은 `/api/persons`(path param **0개**, trailing 세그먼트 없음)다. bare `@Post()` route 합성(세그먼트 0)은 T-1172(user create `api/users` bare)/T-1175(group create `api/groups` bare)의 선례와 같은 **shape** 이지만, **`api/persons` base 문자열 자체는 이번이 첫 guard 대상**(신규 domain). web 러너는 `PERSONS_PATH`(= `/api/persons`, L81)를 path 로 그대로 쓴다(id·query 없음). backend 가 base 를 바꾸거나(`api/person` 오타/`api/people`) bare `@Post()` 에 세그먼트를 추가하면(`@Post("bulk")` 등) fail 한다.
2. **CreatePersonDto `fullName`+`email` 2 required body 부분집합 — email @IsEmail 필드 포함** — 이게 본 slice 의 **핵심 대조**다. web 발사 body 는 `JSON.stringify({ fullName, email })` 2 필드다. backend `CreatePersonDto`(`src/user/dto/create-person.dto.ts`)는 `fullName`(`@IsString` + `@IsNotEmpty` + `@MaxLength(255)`) + `email`(`@IsEmail` + `@MaxLength(255)`) **2 필드 모두 required**(optional 표시 `?` 없음)다. 대조는 "web 발사 body key 집합 ⊇ backend required 필드 집합" — web 이 backend required 필드를 모두 담는지 검증한다. T-1172(user create `email`+`password` 2 required)의 다중-required 부분집합 축과 정합되고, T-1175(group create `name` 단일 required)/T-1176(group update `name` 단일 optional)과 대비된다. backend 가 required 필드를 추가(예: `department` required 신설)했는데 web 이 안 담거나, web 이 backend 에 없는 엉뚱한 key 만 담으면 fail 한다.
3. **POST body + Content-Type 존재 대조** — web `init` 은 `{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) }`다. backend `create(@Body() dto)` 는 `@Body` decorator **있는** body-요구 핸들러다. 대조는 "web 발사 body/Content-Type **존재** AND backend `@Body` decorator **존재**" 형태다(T-1175 POST body 존재 축과 정합, T-1177 DELETE body 부재 축과 대비). backend 가 `@Body` 를 제거하거나 web 이 body/Content-Type 를 빼면 fail 한다.
4. **POST method + `@HttpCode(201)`** — web `init.method === 'POST'` 와 backend `@Post` decorator 의 정합을 대조한다. backend 가 method 를 바꾸거나(`@Patch`/`@Put`) web 이 다른 method 를 발사하면 fail 한다. (응답 status 201 자체의 대조는 요청 계약 harness 경계 밖 — Out of Scope 참조. 여기서는 method decorator 종류만 대조.)

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 8 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.create-user-contract.test.ts`(= T-1172 이 만든 **bare `@Post()` route 합성 + 다중 required body 부분집합** 선례 guard spec) 전체 — bare route 세그먼트 0 합성 대조 · POST body/Content-Type 존재 대조 · required 필드 부분집합 판정 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1172 는 `api/users` base + `email`+`password` 2 required 였으므로 본 task 는 **`api/persons` base + `fullName`+`email` 2 required** 로 base 문자열·필드명만 조정한다. 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.group-create-contract.test.ts`(= T-1175 이 만든 `api/groups` base + bare `@Post()` + POST body 존재 선례) — 같은 bare `@Post()` 세그먼트 0 합성 + POST body/Content-Type 존재 축의 선례. base(`api/groups`→`api/persons`)와 필드 수(단일 name → 2 필드)만 조정해 차용.
- `web/src/views/AdminView.tsx` 1479~1524행 `runCreatePerson` — mock deps(`create`/`describeError`/`creating`/`setCreating`/`setCreateError`/`bumpRefresh`/`resetInput`)로 호출해 실 발사 `path`(`PERSONS_PATH` = `/api/persons`, L81)/`method`(`POST`)/`options`(body=`JSON.stringify({ fullName, email })` + `Content-Type: application/json`)를 캡처하는 대상. `fullName`/`email` 중 하나라도 빈/공백이거나 `creating` 중이면 미발사(가드) — happy-path 는 2 필드 모두 유효한 발사 케이스로 캡처.
- `src/user/person.controller.ts` 41행 `@Controller("api/persons")` base + 68~71행 bare `@Post()` + `@HttpCode(201)` + `@Body() dto: CreatePersonDto` (`@Param` **없음**). base(`api/persons`)와 method decorator 인자(**없음** → bare)를 합성해 최종 template `/api/persons`(path param 0)로 정규화하는 것이 route 대조의 핵심. `@Body` decorator 존재가 body 요구 대조의 근거.
- `src/user/dto/create-person.dto.ts` — `fullName`(`@IsString`+`@IsNotEmpty`) + `email`(`@IsEmail`) 2 필드 모두 required(optional `?` 없음). required 필드 집합 = `{fullName, email}` 추출이 부분집합 대조의 근거.

## Acceptance Criteria

- [ ] **base + bare `@Post()` route 합성 대조**: backend 소스에서 `@Controller("api/persons")` base 와 bare `@Post()`(인자 없음) decorator 를 파싱·합성해 최종 template `/api/persons`(path param **0개**, trailing 세그먼트 없음)로 정규화하고, web `runCreatePerson` 발사 path(`PERSONS_PATH` = `/api/persons`)/method(`POST`)와 대조한다. 세그먼트가 정확히 base 뿐(`api/persons`)임을 명시 검증 — backend 가 `@Post("bulk")`(세그먼트 추가) 또는 base 를 `api/person`(오타)로 바꾸면 fail.
- [ ] **fullName+email 2 required body 부분집합 대조**: backend `CreatePersonDto` 소스에서 required 필드 집합(`{fullName, email}` — optional `?` 없는 필드)을 추출하고, web 발사 body(`JSON.stringify({ fullName, email })`) key 집합이 backend required 집합을 **모두 포함**함(⊇)을 검증한다. backend 가 required 필드를 추가(예: `department` required)했는데 web 이 안 담거나, web body 가 required 필드를 빠뜨리면 fail.
- [ ] **POST body/Content-Type 존재 대조**: web 발사 `init` 에 `method: 'POST'` + `body`(JSON) + `Content-Type: application/json` 헤더가 **모두 있음**을 대조한다. backend `create` 핸들러가 `@Body` decorator **있는** body-요구 핸들러임을 소스에서 추출해 정합 검증한다(T-1175 POST body 존재 축과 정합, T-1177 DELETE body 부재 축과 대비). backend 가 `@Body` 를 제거하거나 web 이 body/Content-Type 를 빼면 fail.
- [ ] **POST method 대조**: web 발사 method(`POST`)와 backend `@Post` decorator 종류가 정합함을 대조한다. backend method 가 `@Patch`/`@Put`/`@Delete` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/persons")` + bare `@Post()` + `@Body() CreatePersonDto`) 상태에서 web `runCreatePerson` 발사가 route/method/body존재/required부분집합 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/persons")` → `/api/persons`) 1 test, (2) bare `@Post()` 세그먼트 0 합성분기(path param 0) 1 test, (3) required 필드 부분집합 추출분기(`{fullName, email}`) 1 test, (4) web `options` → method/body/Content-Type 존재 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/person`(오타)/`api/people` 로 바꿈 → base route 불일치 fail, (b) backend 가 bare `@Post()` 를 `@Post("bulk")`(세그먼트 추가) 로 바꿈 → route 세그먼트 초과 불일치 fail, (c) backend 가 `CreatePersonDto` 에 required 필드(`department`)를 추가했는데 web body 는 미포함 → 부분집합 위반 fail, (d) web body 가 `email` 을 빠뜨림(`{fullName}` 만) → required 부분집합 위반 fail, (e) backend 가 method 를 `@Patch()`/`@Put()` 로 바꿨는데 web 은 POST 발사 → method 불일치 fail, (f) backend 가 `@Body` decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반 fail, (g) web 이 `Content-Type` 헤더를 빼고 발사 → body/Content-Type 존재 대조 fail, (h) 주석 줄에만 `@Post(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/persons`→`api/person`) 또는 bare `@Post()`→`@Post("bulk")`(세그먼트 추가) 또는 `CreatePersonDto` 에 required 필드 추가 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1172/T-1175) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts` · `AdminView.group-create-contract.test.ts` · `AdminView.group-update-contract.test.ts` · `AdminView.group-delete-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 9 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 9 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 9 use site 도달로 우선 검토 강력 권장).
- 인원 CRUD 잔여 mutation(수정 `PATCH /api/persons/:id` · 삭제 `DELETE /api/persons/:id`)로 guard 확산 — 본 slice 는 인원 생성(POST) 1 endpoint 만. 잔여 인원 mutation 은 별도 slice(각각 PATCH partial body / DELETE body 부재 축).
- 파트 CRUD(`POST/PATCH/DELETE /api/parts`)로 guard 확산 — 인원 CRUD 3 endpoint 완결 후 별도 slice.
- 응답 status code(201 Created) 대조 · 응답 body(생성된 Person) 대조 · 409 email 중복(P2002) 대조 · 400 검증 실패 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runCreatePerson` 의 빈/공백 필드 미발사 가드 · `creating` 이중발사 가드 · `bumpRefresh`/`resetInput` 성공 후 부수효과 · 실패 시 error 표면화 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 9 곳 도달 — 공용 helper 추출 ROI 가 임계를 강하게 넘어섰으므로 9 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것.)
