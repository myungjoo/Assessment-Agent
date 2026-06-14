---
id: T-0037
title: P3 patch — PATCH /api/persons/:id 의 active+other 동시 처리 semantics fix (T-0036 MAJOR-2)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-026, REQ-027]
estimatedDiff: 140
estimatedFiles: 4
created: 2026-05-25
plannerNote: T-0036 reviewer PR-35 round 1/7 MAJOR-2 confirmed gap fix — PATCH active+other 동시 처리 시 active 묵시 drop. spec 결정 (a) service forward 채택. Follow-ups 박제 → patch task.
dependsOn: [T-0036]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
---

# T-0037 — P3 patch: PATCH /api/persons/:id 의 active+other 동시 처리 semantics fix

## Why

[T-0036](T-0036-person-service-controller-dto.md) merge ([commit 6b84c62](https://github.com/myungjoo/Assessment-Agent/commit/6b84c62), PR-35 round 2/7 squash) 직후, reviewer round 1/7 MAJOR-2 finding 이 **confirmed product-spec gap** 으로 분류되어 [T-0036 Follow-ups](T-0036-person-service-controller-dto.md#follow-ups) 에 박제됨 — round 2/7 fix 가 주석 + doc 변경만 (production logic 변경 0) 이라 결함 자체는 main 에 박힌 상태. 본 task 는 그 gap 을 production logic 차원에서 해소한다.

**Gap 의 실체**: [PersonController.update](../../src/user/person.controller.ts) (L81–94) 는 PATCH body 의 keys 가 정확히 1 + `active` 단독일 때만 `service.deactivate` / `service.reactivate` 로 routing 하고, 그 외 모든 경우 `service.update(id, patch)` 로 forward. 그런데 [PersonService.update](../../src/user/person.service.ts) (L102–122) 의 spread 가 `fullName` / `email` 만 forward 하고 `active` 키를 **묵시적으로 drop** — 결과:

- PATCH `{ active: true, fullName: "홍길동" }` → controller 가 `service.update` 로 routing → `active` 묵시 drop → fullName 만 update, active flag 변경 안 됨 → **UC-03 §6.1 의 reactivate 의도 silently 무시**.
- PATCH `{ active: false, email: "x@y.z" }` → 동일 — deactivate 의도 silently 무시 + email 만 update.

UC-03 actor (Admin) 입장에서는 PATCH 요청에 200 응답을 받았으나 active flag 가 변하지 않은 결과 → REQ-026 (휴직 시 숨김 / 재활성) 의 semantic contract 가 부분적으로 깨진 상태.

**본 task 의 결정 (spec)**: T-0036 Follow-ups 가 두 옵션을 제시 — (a) service forward + repository.update 가 active 컬럼 갱신 cover (b) controller 가 동시 patch 를 400 BadRequest reject. **본 task 는 (a) 채택**. 근거:

1. [api.md](../architecture/api.md) §3 L74 가 `PATCH /api/persons/:id` 의 body 를 partial update 로 박제 — RFC-7396 (JSON Merge Patch) 의 자연스러운 semantics 는 "전달된 모든 필드 적용" 이고, 부분 reject 는 사용자 경험 측면에서 surprise.
2. UC-03 §3 sub-trigger 1 (인원 추가) 와 sub-trigger 4/5 (Deactivate/Activate) 는 모두 Admin 의 동일 management 흐름의 sub-action — 별도 endpoint 없이 PATCH 의 partial update 로 cover 하는 것이 [README.md](../../README.md) L36–58 의 minimal endpoint 정신과 정합.
3. 옵션 (b) 의 400 reject 는 Admin UI 가 reactivate + name 동시 편집을 두 step 으로 강제하게 만들어 UX 가 부자연. 또한 controller 가 도메인 semantics 결정을 갖는 것보다 service layer 에서 일관 처리하는 것이 SOLID 측면에서 자연.

**DO (본 task scope)**:

1. `PersonService.update` 의 spread 에 `active` 키 forward 추가 — `...(patch.active !== undefined && { active: patch.active })` 1 줄.
2. **`PersonController.update` 의 routing 단순화** — 현재 keys 길이 검사 routing 은 (a) 안 채택 시 불필요. 단독 `{active: false}` / `{active: true}` 도 `service.update` 로 통합 forward → `service.update` 가 active 만 PATCH 도 정상 처리 (이미 partial update 의 자연 확장). `deactivate` / `reactivate` service 메서드 자체는 유지 (다른 caller 가 향후 직접 호출 가능 — 예: 별도 `POST /:id/deactivate` endpoint 가 신설되는 경우).
3. **Regression test 1+ 필수** ([CLAUDE.md §3.2 R-112 patch 항목 6](../../CLAUDE.md)) — 본 결함이 다시 발생하면 fail 하는 test. service spec + controller spec 양쪽에 active+other 동시 patch case 추가.
4. **Acceptance Criteria R-112 4 항목 + coverage line ≥ 80% AND function ≥ 80%** ([CLAUDE.md §3.2](../../CLAUDE.md)) 강제 — patch task 이지만 본 task 가 service 의 update 메서드 logic 을 변경하므로 R-112 strict 적용.
5. **api.md 보강** — PATCH semantics 의 partial update + active 동시 patch 허용 박제 1–2 줄 추가 (L74 footnote 또는 inline note).
6. **UC-03 §6.1 보강** — Deactivate/Activate 의 trigger 가 별도 endpoint 아닌 PATCH partial update 임을 명시 1–2 줄.

**DO NOT (본 task scope 외 — 후속 task 책임)**:

- (a) **`src/main.ts` global ValidationPipe wire** — T-0036.5 의 원안 일부였으나 본 task 와 분리 — 별도 task 신설 (cap 보존 + 명확한 책임 분리).
- (b) **dedicated validation e2e** (`test/e2e/person-validation.e2e-spec.ts`) — 동일 별도 task.
- (c) **ServiceIdentity controller / DTO 도입** — T-0036 Follow-ups 의 별도 후보.
- (d) **Group / Part entity** — 다음 P3 backbone task (현 T-0037 number 사용으로 인해 다음 후속 task 가 T-0038 로 shift — planner 가 p3-implementation-plan.md §2 표 갱신 follow-up).
- (e) **NewPersonEvent emit** — AssessmentModule 도입 후 별도 task.
- (f) **AuthGuard 적용** — T-0038+ (또는 shift 후 T-0039+).
- (g) **partial unique index ADR / cap LOC ADR / .gitattributes ADR** — 별도 meta-ADR task 후보.

**T-NNNN 번호 결정 근거**: T-0036 의 Follow-ups 가 "T-0036.5" 라는 가상 ID 로 본 patch 를 박제하나, 실제 task ID 시퀀스는 monotonically increasing — 본 task 는 **T-0037**. 그 결과 p3-implementation-plan.md §2 의 원안 T-0037 (Assessment + Contribution + Summary entity) 는 T-0038 로 자연 shift, 이후 시퀀스도 한 자리씩 밀림. plan §2 표 갱신은 별도 doc-only follow-up task (본 task scope 외).

**산출물 (4 파일 = 2 production + 2 test)**:

1. `src/user/person.service.ts` (수정) — `update` 메서드 의 spread 에 `active` 키 forward. +1 LOC.
2. `src/user/person.controller.ts` (수정) — `update` 메서드 의 keys 길이 routing 제거, 모두 `service.update` 로 통합 forward. -8 / +2 LOC.
3. `src/user/person.service.spec.ts` (수정) — 동시 patch happy/error/branch/negative 4 항목 cover + regression test 1. +30 LOC 추정.
4. `src/user/person.controller.spec.ts` (수정) — 동시 patch routing 검증 + 단독 active patch 가 service.update 로 forward 됨 검증. +20 LOC 추정.
5. `docs/architecture/api.md` (수정) — PATCH semantics partial update note. +2 LOC.
6. `docs/use-cases/UC-03-person-crud.md` (수정) — §6.1 Deactivate/Activate trigger 가 PATCH partial 임을 명시. +2 LOC.

**Production 파일 count = 2** (src/user/person.service.ts + src/user/person.controller.ts), **doc 파일 = 2** (api.md + UC-03), **test = 2 spec edit** — 총 6 path 이나 production 만 2 → CLAUDE.md §3 cap (≤5 production 파일) 안. **production LOC ≈ +3/-8 = -5 net** (logic 단순화). **total LOC ≈ +57**.

cap 검산: 실측 production LOC > 300 또는 production 파일 > 5 면 architect 가 즉시 split 호출. 본 task 는 single-method spread + routing 단순화로 cap 여유 충분.

## Required Reading

- [docs/tasks/T-0036-person-service-controller-dto.md](T-0036-person-service-controller-dto.md) — 본 task 의 prerequisite. 특히 §Follow-ups 의 "T-0036.5+ active+other 동시 patch case fix" 항목 (L192) + Acceptance Criteria §C/§D + PersonService/PersonController 의 책임 박제.
- [src/user/person.service.ts](../../src/user/person.service.ts) — 본 task 가 수정. `update` 메서드 L96–122 + 주석 L96–101 (현 묵시 drop 명시) 의 정합 유지.
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — 본 task 가 수정. `update` endpoint L81–94 의 keys 길이 routing 단순화 대상.
- [src/user/person.service.spec.ts](../../src/user/person.service.spec.ts) — happy/error/branch/negative 패턴 reference (기존 PersonService spec 의 mock 패턴 답습).
- [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) — 기존 controller spec 의 service mock 패턴 reference.
- [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — `active?: boolean` 필드 (L40–43) + `@IsOptional()` + `@IsBoolean()` decorator. 본 task 는 DTO 변경 없음 — 검증 통과 후 service forward 만 보강.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — `update(id, patch)` 메서드 시그니처. patch 가 `Prisma.PersonUpdateInput` 부분 — `active` 필드 forward 가능 (Prisma 가 partial update 자연 cover).
- [prisma/schema.prisma](../../prisma/schema.prisma) — Person model 의 `active Boolean @default(true)` 컬럼 박제 확인.
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) — §3 sub-trigger 1/4/5 + §5 main flow + §6.1 Deactivate vs Delete + §6.2 primary key 변경. 본 task 가 §6.1 footnote 보강.
- [docs/architecture/api.md](../architecture/api.md) — §3 row `/api/persons` (L71–75). 본 task 가 PATCH 행 footnote 보강.
- [docs/requirements.md](../requirements.md) REQ-026 / REQ-027 row.
- [docs/STATE.json](../STATE.json) — `reviewRounds.T-0036=2` + `loopSession.note` 의 MAJOR-2 confirmed 박제 (T-0036 round 1 reviewer finding 의 product-spec gap 분류 근거).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — production code + test + doc 동시 변경) / §3.2 (R-110~R-114 + R-112 4 항목 happy/error/branch/negative + patch 항목 6 regression test + coverage line ≥ 80% AND function ≥ 80%) / §5 (HITL — 본 task 새 dep 0).

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) R-112 4 항목 + patch 항목 6 (regression) 강제 포함.

### A. PersonService.update — active forward 보강

- [ ] `src/user/person.service.ts` 의 `update` 메서드 (L102–122) 의 `this.repository.update(id, { ... })` spread 에 **`...(patch.active !== undefined && { active: patch.active })` 한 줄 추가** — `fullName` / `email` 와 동일 패턴.
- [ ] 주석 L96–101 의 "active 가 patch 에 동시 포함되어 들어와도 본 메서드는 묵시적으로 drop" 문장을 **"active forward 처리 — partial update 자연스러운 semantic"** 으로 갱신. UC-03 §6.1 PATCH semantic 의 정합 명시.
- [ ] `PersonService.update` 외 다른 메서드는 logic 변경 안 함 (`create` / `findById` / `deactivate` / `reactivate` / `remove` / `findActive` / `findAll` 모두 무변경).
- [ ] `PersonService.deactivate` / `reactivate` 메서드 자체는 보존 — 다른 caller (향후 dedicated endpoint 신설 시) 가 직접 호출 가능. 본 task 는 controller 의 routing 만 단순화, service 메서드 inventory 는 동일.

### B. PersonController.update — routing 단순화

- [ ] `src/user/person.controller.ts` 의 `update` endpoint (L81–94) 의 `Object.keys(patch).length === 1 && patch.active === false` / `=== true` 분기 2 개 **모두 제거** — 단독 active patch 도 `this.service.update(id, patch)` 로 통합 forward.
- [ ] 주석 L74–80 의 routing 분기 설명 갱신 — "단독/동시 patch 모두 service.update 가 partial update 처리 (active forward 포함). deactivate / reactivate service 메서드 는 향후 dedicated endpoint 또는 직접 호출용으로 보존" 명시.
- [ ] 본 controller 의 다른 endpoint (`findActive` / `findOne` / `create` / `remove`) 는 logic 변경 안 함.

### C. Unit test — PersonService.update 보강 (R-112 4 항목 + regression)

- [ ] `src/user/person.service.spec.ts` 의 `update` 메서드 describe block 에 다음 case 추가 (PersonRepository mock 활용):
  - **Happy path 동시 patch**: `update("id", { fullName: "X", active: true })` 호출 시 `repository.update` 가 **`{ fullName: "X", active: true }`** 인자로 호출됨 검증. 1 test.
  - **Happy path 단독 active patch**: `update("id", { active: false })` 호출 시 `repository.update` 가 `{ active: false }` 인자로 호출됨 검증. 1 test.
  - **Happy path 단독 fullName patch (regression)**: 기존 `{ fullName: "X" }` 케이스가 여전히 `{ fullName: "X" }` 로만 forward (active 키 자동 추가 안 됨 — undefined 분기) 검증. 1 test.
  - **Error path**: 동시 patch + `P2025` propagate 시 NotFoundException 변환 1 test. 동시 patch + `P2002` propagate 시 ConflictException 변환 1 test.
  - **Branch**: `patch.active === undefined` (현재 동작 유지) vs `patch.active === true` vs `patch.active === false` 의 3 분기 cover (위 happy + 단독 active 에서 이미 cover — 명시적 expect 로 branch coverage 표시).
  - **Negative**: 빈 객체 `{}` patch 시 `repository.update("id", {})` 호출됨 검증 (모든 키 undefined 분기) 1 test. `patch.active` 가 boolean 아닌 값 (예: `"true"` string — class-validator 가 controller 단계에서 reject 하나 service 단위 격리 시) 직접 forward 검증 1 test (service 는 validator 책임 안 짐 — raw pass-through).
  - **Regression marker test 1 (patch 6 항목 강제)**: test 이름에 `"REGRESSION: T-0036 MAJOR-2 — active+other 동시 patch active forward"` 와 같은 marker. 결함 재발 시 본 test 가 가장 먼저 fail 하여 root cause 식별.
- [ ] 위 case 추가로 인한 `pnpm test` 의 PersonService 관련 suite green.

### D. Unit test — PersonController.update routing 단순화 검증

- [ ] `src/user/person.controller.spec.ts` 의 `update` endpoint describe block 에 다음 case 추가/수정 (PersonService mock 활용):
  - **단독 `{active: false}` patch 가 service.update 로 forward 됨** (기존 spec 의 `service.deactivate` 호출 검증 case 가 있다면 — `service.update` 호출 검증으로 수정). 1 test.
  - **단독 `{active: true}` patch 가 service.update 로 forward 됨** (동일 패턴 수정). 1 test.
  - **동시 `{active: true, fullName: "X"}` patch 가 service.update 로 forward 됨** (신규). 1 test.
  - **동시 `{active: false, email: "x@y.z"}` patch 가 service.update 로 forward 됨** (신규). 1 test.
  - **Error path**: service.update 가 NotFoundException throw 시 controller 가 그대로 propagate 1 test. ConflictException 동일 1 test.
  - **Negative**: 빈 `{}` patch 가 그래도 service.update 호출됨 검증 (controller 는 검증 책임 안 짐 — ValidationPipe 가 controller 진입 전 처리) 1 test.
- [ ] 기존 controller spec 의 `service.deactivate` / `service.reactivate` 호출 검증 case 는 본 task 로 모두 `service.update` 로 통합 — 별도 `deactivate` / `reactivate` 호출 unit test 는 PersonService spec 의 책임으로 분리 유지.

### E. Coverage (R-112 + jest threshold 강제)

- [ ] `pnpm test:cov` 실행 결과 **line ≥ 80% AND function ≥ 80%** ([package.json](../../package.json) `coverageThreshold.global`) 통과. 미달 시 jest exit 1 → CI red.
- [ ] PersonService + PersonController 의 line/branch/function/stmt 4 종 coverage 가 T-0036 round 2 머지 시점 (line/function 100% / branch 97%) 보다 떨어지지 않음 (regression 없음).

### F. doc 보강

- [ ] `docs/architecture/api.md` 의 `/api/persons` 표 (§3 row L71–75) 의 `PATCH /api/persons/:id` 행 description 컬럼 또는 footnote 에 **"partial update — `active` 동시 포함 가능 (단독/동시 patch 모두 partial semantic)"** 1–2 줄 추가.
- [ ] `docs/use-cases/UC-03-person-crud.md` 의 §6.1 (Deactivate vs Delete) 끝에 **"Deactivate / Activate 의 trigger 는 별도 endpoint 가 아닌 `PATCH /api/persons/:id` 의 partial update 로 cover — `{active: false}` 가 Deactivate, `{active: true}` 가 Activate. 다른 필드 (fullName / email) 와 동시 patch 도 허용 — REQ-026 + REQ-027 semantic"** 1–2 줄 추가.

### G. Lint / build / unit / smoke / e2e (R-111 / R-113)

- [ ] `pnpm lint` 통과 (수정 파일 0 lint error).
- [ ] `pnpm build` 통과 (TypeScript 컴파일 성공).
- [ ] `pnpm test` 통과 (모든 unit test green — PersonService + PersonController + regression 포함).
- [ ] `pnpm test:cov` 통과 (coverage threshold line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 (기존 smoke regression 0).
- [ ] `pnpm test:e2e` 통과 (기존 e2e regression 0).
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green.

### H. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE 또는 후속 round 처리.
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 또는 MCP `add_issue_comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-112 4 항목 + regression / 4 항목) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 또는 MCP `merge_pull_request --squash` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline + 명확한 책임 분리):

- **`src/main.ts` global ValidationPipe wire** (`app.useGlobalPipes(...)`) — 별도 task. T-0036 의 controller-scope `@UsePipes` 가 본 controller 한정 검증 효과 유지.
- **dedicated validation e2e** (`test/e2e/person-validation.e2e-spec.ts`) — 별도 task.
- **ServiceIdentity service / controller / DTO + nested endpoint** (`/api/persons/:id/service-identities` / `/primary`) — 별도 task.
- **Group + Part entity Prisma model + Person↔Group N:M + Person↔Part N:1 mandatory invariant (REQ-028)** — p3-implementation-plan.md §2 의 다음 P3 backbone task (현재 T-0038 로 shift).
- **신규 인원 추가 시 1년치 평가 1회 trigger (REQ-027 NewPersonEvent emit)** — AssessmentModule 도입 후 별도 task.
- **isPrimary service-layer 1-row invariant 강제** — ServiceIdentityService 책임.
- **User entity + AuthModule + RBAC guard** — 후속 phase task.
- **`POST /api/persons/:id/deactivate` 또는 `/reactivate` dedicated endpoint** — api.md 박제 외. 본 task 는 PATCH partial update 통합 유지.
- **API 응답 envelope 표준화** (`{ data, meta }`) — 별도 ADR.
- **Pagination / filtering / sorting query param** — 별도 task.
- **OpenAPI / Swagger 자동 문서** — 별도 task.
- **cap LOC 정책 ADR** (T-0034/T-0035/T-0036 total LOC cap 초과 누적) — 별도 doc-only task.
- **partial unique index ADR** (REQ-024 isPrimary PostgreSQL `WHERE isPrimary=true` raw SQL migration) — 별도 doc-only task.
- **.gitattributes CRLF 정책 ADR** — 별도 doc-only task.
- **p3-implementation-plan.md §2 표 갱신** (본 task ID 가 T-0037 로 진입함에 따라 원안 T-0037 = Assessment+Contribution+Summary 가 T-0038 로 shift) — 별도 doc-only follow-up task.

## Suggested Sub-agents

`architect → implementer → tester` — architect 가 본 task 첫 read 직후 (a) cap 재검산 (production +3/-8 LOC + 2 test spec edit + 2 doc edit = 6 path, production 2 ≤ 5 ✓) (b) PATCH partial update semantic 의 RFC-7396 정합성 한 줄 doc 표현 확정 (c) PersonService.deactivate / reactivate 의 보존 정당성 — 본 task 머지 후에도 service 메서드 inventory 그대로 유지 (다른 caller 직접 호출 + 향후 dedicated endpoint 신설 시 reuse) (d) test naming convention — "REGRESSION:" prefix 가 결함 추적 용. implementer 가 service spread 1 줄 + controller routing 2 분기 제거 + 4 줄 doc + spec 2 파일 edit. tester 가 새 case 7+ (service spec) + 5+ (controller spec) 추가 + lint/build/test:cov/smoke/e2e 검증.

## Follow-ups

(architect / implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **p3-implementation-plan.md §2 표 갱신 task** — 본 task 가 T-0037 진입으로 plan §2 의 원안 T-0037 (Assessment + Contribution + Summary) 가 T-0038 로 shift, 이후 시퀀스 한 자리씩 밀림. doc-only direct commit 1 줄 edit.
- **T-0036.6 후보 — global ValidationPipe wire + validation e2e** — `src/main.ts` 의 `app.useGlobalPipes` + `test/e2e/person-validation.e2e-spec.ts` (supertest negative 5 종 + global pipe 가 다른 controller cover sanity-check). 2 파일 / ~60 LOC. T-0036 Follow-ups 의 T-0036.5 원안 1 절반 (다른 절반 = 본 task).
- **dedicated `POST /:id/deactivate` / `/reactivate` endpoint 신설 검토** — api.md 박제 외이나 Admin UI 의 button click 직관성 측면에서 별도 endpoint 가 자연스러울 수 있음. 별도 ADR (REST resource action endpoint 정책) + task 후보.
- **Group + Part entity task** — p3-implementation-plan.md §2 의 원안 T-0035 (현 T-0037 진입으로 인해 T-0038 로 shift). REQ-028 Group 정책 + Person↔Group N:M + Person↔Part N:1 mandatory invariant.

## 완료 기록

- **DONE (doc-sync 정합, T-0404)** — 본 patch 는 PR #36(`f63f94e fix(user): PATCH active+other 동시 처리 active forward (T-0037)`)으로 round 1 single-shot 머지됐고 driver journal 에 DONE 박제(`87c1bd6`)됐으나 task 파일 frontmatter `status:` 가 `PENDING` 으로 잔류했었다. T-0403 Follow-up 이 지목한 single-status stale 3건 중 하나로, T-0404 direct doc-only fire 가 `PENDING` → `DONE` 정합. tasksCompleted 불변(이미 머지 반영된 task 의 bookkeeping 정정).
