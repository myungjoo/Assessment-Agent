---
id: T-1181
title: 파트 생성 endpoint web↔backend 계약 drift-guard spec (POST /api/parts · api/parts base + bare @Post() 세그먼트 0 합성 + CreatePartDto name 단일 required body 부분집합 + POST body/Content-Type 존재 축 + @HttpCode(201))
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-028, REQ-049]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.part-create-contract.test.ts
plannerNote: P6 line120 Admin 패널 — T-1180 Out of Scope 예약 "파트 CRUD(POST/PATCH/DELETE /api/parts)로 guard 확산" 첫 대상(파트 생성 POST /api/parts). api/parts base + bare @Post() 세그먼트0 합성 + name 단일 required 부분집합 + POST body 존재 축. test-only pr 1파일 disjoint 동시 claim 안전
---

# T-1181 — 파트 생성 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 인원·그룹·파트 관리 arc 의 후속 slice 다. web↔backend 계약 drift-guard 패턴이 인스턴스 접근(T-1169/T-1170) → 역할 변경(T-1171) → 사용자 생성(T-1172) → 그룹 멤버 추가/제거(T-1173/T-1174) → 그룹 생성/수정/삭제(T-1175/T-1176/T-1177) → 인원 생성/수정/삭제(T-1178/T-1179/T-1180) 12 slice 를 거쳐 안정됐다. T-1180 Out of Scope 는 "파트 CRUD(`POST/PATCH/DELETE /api/parts`)로 guard 확산 — 본 slice 로 인원 CRUD(생성·수정·삭제) 3 endpoint 를 완결. **이후 대상은 별도 slice**" 를 **명시적으로 예약**했으며, 그 예약의 **첫 대상**이 파트 생성 endpoint 다. 본 task 는 그 예약을 실행하며 파트 CRUD 계약 guard arc 를 연다.

파트 생성은 web `runCreatePart` 러너(`AdminView.tsx` 1629~1671)가 발사하고 backend `PartController.create`(`@Controller("api/parts")` base + bare `@Post()` + `@HttpCode(201)`, `@Body() dto: CreatePartDto`)가 받는다. 이 경로는 앞선 12 slice 와 같은 silent-drift 위험(backend 가 route/method/body 계약을 바꿔도 web unit test 가 green 유지 → 런타임 404/405/400)을 가지며, 다음 축을 대조한다 — 특히 **파트 도메인에서의 신규/대비 대조 포인트**를 담는다:

1. **`api/parts` base + bare `@Post()`(세그먼트 0) 합성 — `api/parts` base 첫 결합** — backend `@Controller("api/parts")` base 와 bare `@Post()`(path 인자 없음)를 합성하면 최종 template 은 `/api/parts`(path param **정확히 0개**)다. T-1178(person create)은 `api/persons` base + bare `@Post()`, T-1175(group create)은 `api/groups` base + bare `@Post()` 였으므로 본 task 는 **`api/parts` base 에 bare `@Post()`(세그먼트 0)** 를 처음 결합한다(신규 base). web 러너는 `PARTS_PATH`(= `/api/parts`, L95) 고정 상수를 그대로 발사한다 — 인원/사용자 생성과 동형으로 path param 이 없다(생성은 컬렉션 루트 POST). backend 가 세그먼트를 추가(`@Post(":something")`)하거나 base 를 `api/part`(오타)/`api/parties` 로 바꾸면 fail 한다.
2. **`CreatePartDto` name 단일 required 필드 body 부분집합 대조** — web 발사 body 는 `JSON.stringify({ name: trimmed })`(name 단일 키, L1653)다. backend `CreatePartDto`(`src/user/dto/create-part.dto.ts`)는 `@IsString() @IsNotEmpty() name!: string` **단일 required 필드**를 정의한다(`ValidationPipe` whitelist + forbidNonWhitelisted). 대조는 "web 발사 body 키 집합 ⊇ backend required 필드 집합" AND "web 발사 body 키 집합 ⊆ backend allowed(whitelist) 필드 집합" 형태다 — 여기서는 required = allowed = `{ name }` 이라 정확 일치. T-1175(group create CreateGroupDto name 단일 required) 와 동형이고, T-1178(person create fullName+email 2 required) 의 다중 required 축과 대비된다. backend 가 required 필드를 추가(예: `code!: string`)했는데 web 이 안 보내면 fail, web 이 whitelist 밖 필드를 보내면 fail(forbidNonWhitelisted 400).
3. **POST + body/Content-Type 존재 대조** — web 발사 `init` 은 `{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) }` 다(L1650~1654). backend `create(@Body() dto)` 는 `@Body` decorator 가 **있는** body 핸들러다. 대조는 "web 발사 body **존재** + Content-Type `application/json` 헤더 **존재** AND backend `@Body` decorator **존재**" 형태 — T-1180(person delete DELETE body 부재)와 대비되고 T-1178/T-1175(POST body 존재)와 정합된다. backend 가 `@Body` 를 빼거나 web 이 body/Content-Type 를 누락하면 fail 한다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 12 guard 파일들과도 disjoint → fineGrainedConcurrency(stage 5b) 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.person-create-contract.test.ts`(= T-1178 이 만든 **base + bare `@Post()` 세그먼트 0 합성 + required 필드 부분집합 + POST body/Content-Type 존재** 선례 guard spec) 전체 — bare `@Post()` 세그먼트 0 합성 대조 · required 필드 부분집합 대조 · POST body/Content-Type 존재 대조 · `options` 캡처 로직 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). T-1178 은 `api/persons` base + fullName/email 2 required 였으므로 본 task 는 **`api/parts` base + name 단일 required** 로 base 문자열·필드 집합만 조정한다(route/method shape 는 동일). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 공용 helper 추출은 아래 Out of Scope 대로 별도 slice). 실제 파일명은 `git ls-files web/src/views/` 로 확인.
- `web/src/views/AdminView.group-create-contract.test.ts`(= T-1175 이 만든 `api/groups` base + bare `@Post()` + name **단일 required** 선례) — name 단일 required 필드 부분집합 대조의 가장 가까운 선례. base 문자열(`api/groups`→`api/parts`)만 조정해 차용한다.
- `web/src/views/AdminView.tsx` 1629~1671행 `runCreatePart` — mock deps(`create`/`isConflict`/`describeError`/`creating`/`setCreating`/`setCreateError`/`bumpRefresh`/`resetInput`)로 호출해 실 발사 `path`(`PARTS_PATH` = `/api/parts`, L95·L1650)/`method`(`POST`)/`options`(body `{ name }` + Content-Type `application/json` 존재, L1650~1654)를 캡처하는 대상. 빈/공백 name·`creating` 중이면 미발사(가드) — happy-path 는 유효 name 발사 케이스로 캡처.
- `src/user/part.controller.ts` 50행 `@Controller("api/parts")` base + 84~88행 bare `@Post()` + `@HttpCode(201)` + `@Body() dto: CreatePartDto`. base(`api/parts`)와 method decorator 인자(없음)를 합성해 최종 template `/api/parts`(path param 0)로 정규화하는 것이 route 대조의 핵심. `@Body` decorator 존재가 body 존재 대조의 근거.
- `src/user/dto/create-part.dto.ts` — `name!: string` 단일 required 필드(`@IsString` `@IsNotEmpty`). backend required/allowed 필드 집합 추출의 근거.

## Acceptance Criteria

- [ ] **base + bare `@Post()` route 합성 대조**: backend 소스에서 `@Controller("api/parts")` base 와 bare `@Post()` decorator 를 파싱·합성해 최종 template `/api/parts`(path param **정확히 0개**)로 정규화하고, web `runCreatePart` 발사 path(`PARTS_PATH` → `/api/parts`)/method(`POST`)와 대조한다. path param 이 0개이고 base 가 `api/parts` 임을 명시 검증 — backend 가 `@Post(":id")`(세그먼트 추가) 또는 base 를 `api/part`(오타)/`api/parties` 로 바꾸면 fail.
- [ ] **required/allowed 필드 부분집합 대조**: backend `CreatePartDto` 에서 required 필드 집합(`{ name }`)과 allowed(whitelist) 필드 집합을 추출하고, web 발사 body 키 집합(`{ name }`)이 required 를 **모두 포함**(⊇) AND allowed 안에 **모두 포함**(⊆)됨을 대조한다. backend 가 required 필드를 추가(예: `code`)했는데 web 미전송 → 부분집합 위반 fail, web 이 whitelist 밖 필드(`foo`)를 보냄 → allowed 초과 fail.
- [ ] **POST body/Content-Type 존재 대조**: web 발사 `init` 에 `method: 'POST'` + `body`(JSON) + `Content-Type: application/json` 헤더가 **모두 존재**함을 대조하고, backend `create` 핸들러가 `@Body` decorator **있는** body 핸들러임을 소스에서 추출해 정합 검증한다(T-1178/T-1175 body 존재 축과 정합, T-1180 DELETE body 부재 축과 대비). backend 가 `@Body` 를 빼거나 web 이 body/Content-Type 를 누락하면 fail.
- [ ] **POST method 대조**: web 발사 method(`POST`)와 backend `@Post` decorator 종류가 정합함을 대조한다. backend method 가 `@Get`/`@Patch`/`@Put`/`@Delete` 로 바뀌거나 web 이 다른 method 를 발사하면 fail.
- [ ] **Happy-path test 1+**: 현재 backend(`@Controller("api/parts")` + bare `@Post()` + `CreatePartDto name` 단일 required) 상태에서 web `runCreatePart` 발사(유효 name)가 route/method/body/필드부분집합 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) base route 파싱분기(`@Controller("api/parts")` → `/api/parts`) 1 test, (2) bare `@Post()` 세그먼트 0 합성분기(path param 0) 1 test, (3) required/allowed 필드 집합 추출분기(`CreatePartDto` → `{ name }`) 1 test, (4) web `options` → method/body/Content-Type 헤더 존재 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 base 를 `api/part`(오타)/`api/parties` 로 바꿈 → base route 불일치 fail, (b) backend 가 bare `@Post()` 를 `@Post(":id")`(세그먼트 추가, path param 1) 로 바꿈 → route 세그먼트 초과 불일치 fail, (c) backend 가 method 를 `@Patch()`/`@Delete()` 로 바꿨는데 web 은 POST 발사 → method 불일치 fail, (d) backend `CreatePartDto` 에 required 필드(`code`) 추가했는데 web 미전송 → required 부분집합 위반 fail, (e) web 이 whitelist 밖 필드(`foo`)를 body 에 추가 → allowed 초과 fail, (f) backend 가 `@Body` decorator 를 제거(body-less) 했는데 web 은 body 발사 → body 존재 정합 위반 fail, (g) web 이 Content-Type 헤더 또는 body 를 누락 → POST body 존재 대조 fail, (h) 주석 줄에만 `@Post(...)`/`@Controller(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/base 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend base(`api/parts`→`api/part`) 또는 bare `@Post()`→`@Post(":id")`(세그먼트 추가) 또는 `@Post()`→`@Patch()`(method 변경) 중 하나를 임시 변경해 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1178/T-1175) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · 기존 guard spec 파일들(`AdminView.instance-access-contract.test.ts` · `AdminView.role-change-contract.test.ts` · `AdminView.create-user-contract.test.ts` · `AdminView.group-member-add-contract.test.ts` · `AdminView.group-member-remove-contract.test.ts` · `AdminView.group-create-contract.test.ts` · `AdminView.group-update-contract.test.ts` · `AdminView.group-delete-contract.test.ts` · `AdminView.person-create-contract.test.ts` · `AdminView.person-update-contract.test.ts` · `AdminView.person-delete-contract.test.ts`) · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 12 곳이 되어 추출 ROI 가 임계를 강하게 넘어섰다. 단 helper 추출은 12 개 기존 파일을 동시에 건드려 **파일-disjoint(동시 claim 안전)를 깨므로** 본 slice 와 분리한다. 별도 refactor slice 로 검토(본 task Follow-ups 에 추출 후보 박제 — 12 use site 도달로 우선 검토 강력 권장).
- 파트 수정(`PATCH /api/parts/:id`) · 파트 삭제(`DELETE /api/parts/:id`)로 guard 확산 — 본 slice 는 파트 생성만. 이후 대상은 별도 slice(파트 CRUD arc 로 이어감).
- LLM provider mutation(`POST/DELETE /api/llm/providers`)로 guard 확산 — 별도 slice.
- 응답 status code(201 Created) 대조 · 응답 body(생성된 Part row) 대조 · P2002(name 중복 409) 대조 · 409 전용 문구(`PART_DUPLICATE_ERROR`) 표면화 검증 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- `runCreatePart` 의 빈/공백 name 미발사 가드 · `creating` 이중발사 가드 · `bumpRefresh`/`resetInput` 성공 후 부수효과 · 실패 시 error 표면화(409 분기 포함) 등 러너 자체 동작 검증 — 본 guard 는 web↔backend **계약(route/method/body)** 정적 대조만. 러너 상태전이 동작은 별도 spec 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가. 특히 계약 guard use site 가 12 곳 도달 — 공용 helper 추출 ROI 가 임계를 강하게 넘어섰으므로 12 개 파일 동시 수정 refactor slice 후보를 명시 박제할 것. 파트 생성 후 다음 확산 대상은 파트 수정(PATCH)·삭제(DELETE).)
