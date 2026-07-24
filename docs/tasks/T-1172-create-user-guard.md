---
id: T-1172
title: 사용자 생성 endpoint web↔backend 계약 drift-guard spec (bare route·method·body 부분집합)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-07-24
independentStream: web-admin-user
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.create-user-contract.test.ts
plannerNote: P6 line120 사용자 관리 arc — T-1171 Out of Scope 가 예약한 "guard 확산" 두 번째 대상(사용자 생성). bare-route(@Post() 인자 부재) 축 특화, test-only pr, 파일-disjoint 동시 claim 안전
---

# T-1172 — 사용자 생성 endpoint web↔backend 계약 drift-guard spec

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 후속 slice 다. T-1169(인스턴스 접근 도입) → T-1170(정밀화) → T-1171(역할 변경 endpoint 확산 첫 대상)으로 web↔backend 계약 drift-guard 패턴이 3 slice 를 거쳐 안정됐다. T-1171 Out of Scope(파일 53행)는 "다른 endpoint(**사용자 생성** · 그룹/인원 mutation · LLM provider)로 guard 추가 확산 — 이후 대상은 별도 slice"를 명시적으로 예약했다. 본 task 는 그 확산의 두 번째 대상으로 **사용자 생성 endpoint(`POST /api/users`)** 를 택한다.

사용자 생성은 web `runCreateUser` 러너가 발사하고 backend `UserController.signup`(`@Post()`, `@HttpCode(201)`, `@Body() AddUserDto {email, password}`)가 받는다. 이 경로는 인스턴스 접근·역할 변경과 같은 silent-drift 위험(backend 가 route/method/body-key 를 바꿔도 web unit test 가 green 유지 → 런타임 404/400)을 가지며, **역할 변경에는 없던 drift 축**이 하나 있다: `@Post()` 의 **인자 부재(bare route)**. 역할 변경은 `@Patch(":id/role")` 처럼 decorator 인자를 base route 와 합성했지만, 사용자 생성은 decorator 인자가 비어(`@Post()`) 최종 route 가 base route(`/api/users`) 자체이고 `:id` path param 이 없다. 본 guard 는 이 **bare-route 합성(인자 부재 → route == base, param 위치 0)** 을 endpoint-특화 차원으로 검증해, backend 가 실수로 `@Post(":id")` 같은 인자를 붙이거나 web 이 잘못된 하위 경로로 발사하면 fail 하도록 make-work 가 아닌 실효 검증을 만든다. 또한 사용자 생성은 required 필드가 2개(`email` + `password`, 역할 변경의 단일 `role` 대비)라 `required ⊆ fired` 다중 필드 대조가 실효를 가진다.

본 task 는 **신규 test 파일 1개만** 추가하며 production 소스(`AdminView.tsx` · `src/user/**`)를 건드리지 않는다. 신규 파일이라 기존 두 guard 파일과도 disjoint → fineGrainedConcurrency 하에서 동시 claim 안전하다.

## Required Reading

- `web/src/views/AdminView.role-change-contract.test.ts` 전체 — T-1171 이 만든 **직전 선례 guard spec**. method decorator 인자 합성 대조 · DTO `{required, optional}` 부분집합 대조 · `options.body` 부재 → 빈 키 집합 매핑 · 주석 false-positive 방어 로직을 **읽어 패턴만 차용**하고 **수정하지 않는다**(파일-disjoint 유지). 로컬 함수는 새 파일에 compact 하게 다시 둔다(YAGNI — 아직 use site 3 곳이지만 공용 helper 추출은 아래 Out of Scope 대로 별도 slice).
- `web/src/views/AdminView.instance-access-contract.test.ts` 전체 — T-1169+T-1170 원본. bare-route(인자 부재) 대조의 기준선 참고용. 역시 **읽기만**.
- `web/src/views/AdminView.tsx` 1685~1719행 `runCreateUser` — mock deps 로 호출해 실 발사 `path`(`/api/users`)/`method`(`POST`)/`init.body`(`{email, password}`) 를 캡처하는 대상. `trimmedEmail` 로 email 만 trim, password 는 원문 전송 — body 키 대조 시 두 키(`email`, `password`)가 모두 발사됨을 확인.
- `src/user/user.controller.ts` 156~166행 — `@Controller` base route + `@Post()`(인자 **없음**) + `@HttpCode(201)` + `@Body() AddUserDto`. decorator 인자 부재를 base route 자체(`/api/users`)로 정규화하는 것이 bare-route 대조의 핵심.
- `src/user/dto/add-user.dto.ts` 43~61행 — `email!`(`@IsEmail`+`@IsNotEmpty`) + `password!`(`@IsString`+`@IsNotEmpty`+`@MinLength(8)`) 두 required, optional 0. required 다중 필드 부분집합 대조의 backend-side 입력. `role` 필드 부재(forbidNonWhitelisted 로 reject)도 확인 — web 이 `role` 초과 키를 발사하면 안 됨.

## Acceptance Criteria

- [ ] **bare-route/method 합성 대조 (endpoint-특화 신규 축)**: backend 소스에서 `@Controller(...)` base route 와 `@Post(...)` decorator 인자를 파싱·합성한다. `@Post()` 처럼 인자가 **비어 있으면 최종 route == base route**(`/api/users`, 하위 경로/param 0)로 정규화하고, web `runCreateUser` 발사 path(`/api/users`)/method(`POST`)와 대조한다. backend 가 실수로 `@Post(":id")` 나 `@Post("signup")` 같은 인자를 붙이면 route 불일치로 fail.
- [ ] **body 키 부분집합 대조 (다중 required)**: `AddUserDto` 필드 추출기가 `{required: [email, password], optional: []}` 를 반환하고, web 발사 body 키에 대해 `fired ⊆ declared`(초과 키 없음, forbidNonWhitelisted 근거) AND `required ⊆ fired`(필수 누락 없음 — email·password **둘 다** 발사됨) 로 대조한다.
- [ ] **Happy-path test 1+**: 현재 backend(`@Post()` bare route, `email`+`password` 두 required, optional 0) 상태에서 web `runCreateUser` 발사가 정밀화된 bare-route/method/body 대조를 모두 통과함을 검증(정상 계약이 green).
- [ ] **Error path test 1+**: 추출기가 빈 집합/`null` 을 반환하는 입력(빈 소스 등)에서 대조가 조용히 통과하지 않고 선단언으로 fail 함을 유지·검증(guard 무력화 방어).
- [ ] **분기 cover**: 각 새 분기를 test 로 나눈다 — (1) decorator 인자 부재(`@Post()` → base route) 정규화분기 1 test, (2) decorator 인자 있음(`@Post(":id")` 등) 합성분기 1 test(bare 와 대비), (3) `fired ⊄ declared`(초과 키) 실패분기 · `required ⊄ fired`(필수 누락) 실패분기 각 1 test, (4) `options.body` 부재 → 빈 키 집합 매핑분기 1 test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) backend 가 route 를 `@Post(":id")` 로 바꿨는데 web 은 `/api/users` bare 발사 → route 불일치 fail, (b) backend 가 method 를 `@Put()`/`@Get()` 으로 바꿨는데 web 은 POST 발사 → method 불일치 fail, (c) web 이 DTO 에 없는 초과 키(`role` 우회/`username` 오타 등) 발사 → `fired ⊆ declared` 위반 fail, (d) web 이 required `password`(또는 `email`) 를 누락 → `required ⊆ fired` 위반 fail, (e) backend DTO 가 `email` 만 남기고 `password` 를 제거했는데 web 은 여전히 `password` 발사 → 초과 키 fail(DTO 축소 drift 감지), (f) `options.body` 부재 시 `SyntaxError` 없이 "body 키 불일치"(빈 집합 ≠ required)로 판정, (g) 주석 줄에만 `@Post(...)` 문자열이 있고 실 decorator 가 없는 가짜 소스는 method/route 추출 실패로 판정(주석 false-positive 방어).
- [ ] **실측 확인**: 구현자는 backend decorator 를 임시로 `@Post(":id")` 또는 `@Put()` 로 바꾸거나 DTO 에서 `password` 를 임시 제거해 정밀화된 guard 가 실제로 fail 하는 것을 최소 1회 확인한 뒤 되돌린다(되돌림 후 green 상태로 commit).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage(line ≥ 80% / function ≥ 80%)가 그대로 통과해야 한다.
- [ ] **사이즈 게이트** — 최종 diff ≤ 300 LOC / 파일 1개. 초과 예상 시 negative case 를 `it.each` 표로 합치고 추출기 주석을 선례(T-1171) 참조 한 줄로 압축한다. **test 항목 자체를 빼서 줄이지 말 것**(R-112 위반).

## Out of Scope

- `web/src/views/AdminView.tsx` · `web/src/views/AdminView.role-change-contract.test.ts` · `web/src/views/AdminView.instance-access-contract.test.ts` · `src/user/**` 등 **기존 파일 수정 전면 금지** — 본 slice 는 신규 파일 1개 추가만(파일-disjoint 유지가 동시 claim 안전성의 근거). 대조 결과 실제 drift 가 발견되면 고치지 말고 Follow-ups 에 적는다.
- 공용 계약 추출 helper 파일 신설(`web/src/test-utils/contract-guard.ts` 등) — 확산 use site 가 3 곳(인스턴스 접근 + 역할 변경 + 사용자 생성)이 되지만, 세 파일이 로컬 함수를 각자 compact 하게 두는 현 패턴이 아직 유지 가능하므로 YAGNI. 공용 helper 추출은 4+ use site 또는 로컬 중복이 실제 비용이 될 때 별도 slice 로 검토(본 task Follow-ups 에 추출 후보 박제).
- 다른 endpoint(그룹/인원 mutation · LLM provider)로 guard 추가 확산 — 본 slice 로 사용자 생성까지만. 이후 대상은 별도 slice.
- 응답 status code(201/400/409) 대조 · `@HttpCode(201)` 성공 코드 대조 · UserResponseDto 응답 shape 대조 · OpenAPI 스키마 공유 구조 — ADR-0040 §5 harness 경계 그대로(요청 계약만 guard, 응답 계약은 범위 밖).
- backend 의 forbidNonWhitelisted `role` reject 동작 자체를 e2e 로 검증 — 본 guard 는 web 이 초과 키를 발사하지 않는지(`fired ⊆ declared`)만 정적 대조. 실 400 응답 검증은 backend e2e 몫.
- backend 소스 파싱용 AST 파서·새 devDependency 도입 — 문자열/정규식으로 충분(§5 새-dep 게이트 대상).
- `web/package.json` vitest coverage threshold 도입 — 새 외부 dependency(`@vitest/coverage-v8`) PLAN P6 게이트 backlog(line 125).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 추가.)
