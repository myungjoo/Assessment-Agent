---
id: T-0043
title: P3 — smoke test domain endpoint 확장 `/api/persons` CRUD bootstrap smoke (mock PrismaService)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-113]
estimatedDiff: 180
estimatedFiles: 1
created: 2026-05-26
plannerNote: P3 L64 bullet 2 — smoke 가 GET / 만 cover, /api/persons CRUD 5 endpoint 의 bootstrap smoke 신설 (Test.overrideProvider(PrismaService) mock). R-113 smoke 의무.
dependsOn: [T-0036]
blocks: []
plannerSource: PLAN.md L64 (P3 bullet 2)
humanApprovalGate: false
---

# T-0043 — smoke test domain endpoint 확장 `/api/persons` CRUD bootstrap smoke

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 단락 L64 bullet 2 ("[테스트 품질] smoke test domain endpoint 확장 — 현재 smoke 가 `GET /` 만 커버. `/api/persons` CRUD (POST·GET·PATCH·DELETE) + 향후 Group/Part endpoint 에 대한 bootstrap smoke 추가. AppModule mock-DB 방식으로 실 DB 없이 supertest 실행") 의 정확한 cover.

현재 [test/smoke/app.smoke-spec.ts](../../test/smoke/app.smoke-spec.ts) 는 단 2 test 만 cover:

1. `GET /` 200 + body `APP_STATUS_MESSAGE`
2. `GET /__not_exists__` 404

T-0036 머지 ([6b84c62](https://github.com/myungjoo/Assessment-Agent/commit/6b84c62)) 로 [src/user/person.controller.ts](../../src/user/person.controller.ts) 가 5 endpoint (`GET /api/persons` / `GET /api/persons/:id` / `POST /api/persons` / `PATCH /api/persons/:id` / `DELETE /api/persons/:id`) 를 노출하지만 smoke layer 는 본 endpoint 들을 전혀 검증하지 않는다. PersonController → PersonService → PersonRepository → PrismaService chain 의 부트스트랩이 실 DB 없이 정상 동작하는지 (DI wiring / ValidationPipe / HttpException → status code mapping) 의 회귀 anchor 가 부재. 본 task 는 [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) 단일 신규 파일을 추가하여 5 endpoint 의 happy + negative-shape smoke 를 박제한다.

**mock-DB 전략 (architect 결정 — 본 task 안에서 결정, ADR 신설 불요)**:

- `Test.createTestingModule({imports: [AppModule]}).overrideProvider(PrismaService).useValue(mockPrismaService)` 패턴 — AppModule 전체를 부트스트랩하되 PrismaService 만 mock 객체로 교체. PrismaService 가 `@Global()` 으로 export 되므로 PersistenceModule 전체를 mock 할 필요 없이 provider override 1 곳만 처리.
- mock 객체는 `person` 속성에 `findMany / findUnique / create / update / delete` 5 메서드를 jest.fn() 으로 보유. supertest 호출 → controller → service → repository → mock 호출까지의 full wiring 검증.
- 본 task 는 controller 의 HTTP routing + status code + ValidationPipe 동작 만 smoke layer 에서 cover. business logic deep test 는 person.service.spec.ts / person.controller.spec.ts (이미 unit 으로 cover) 의 책임.

본 task 의 정당성:

- **R-113 smoke 의무 이행** ([CLAUDE.md §3.2](../../CLAUDE.md)) — "unit 외에 smoke + end-to-end test 도 CI 에서 함께 수행". 현 smoke 는 AppModule 부트스트랩 sanity 만 (1 endpoint), domain endpoint 추가 cover 가 R-113 의 의도에 합치.
- **회귀 anchor 강화** — 향후 GroupController / PartController / AssessmentController 등 backbone 도입 시 PersonController 의 routing/wiring 회귀를 smoke 1 파일에서 즉시 감지. 후속 PR 의 reviewer 가 smoke 결과만 보고 ValidationPipe / DI wiring 회귀 없음을 빠르게 확인.
- **task size 적정** — 단일 신규 파일 ~180 LOC (5 endpoint × ~25 LOC + setup ~40 LOC + helper ~15 LOC). cap (≤ 300 LOC / ≤ 5 파일) 의 60%. reviewer round 1 단발 머지 후보. production 코드 / DTO / repository / service 변경 0 — smoke test 파일 1 개 추가 + (필요 시) [package.json](../../package.json) 의 smoke jest config 변경 0 (기존 `test/smoke/` 를 jest.testPathIgnorePatterns 가 picking 제외 + `test/jest-smoke.json` 이 `testRegex` `.*\.smoke-spec\.ts$` 로 cover).
- **production 안정성 가산** — mock PrismaService 가 정상이면 5 endpoint 가 ValidationPipe + HttpCode + Param 데코레이터 + 응답 contract 그대로 동작함을 매 CI 마다 검증. test:cov 의 unit branch 100% 와 smoke 의 HTTP-level coverage 가 layer 별 다른 회귀를 cover.

본 task 의 정확한 산출물 (1 파일 신규 / ~180 LOC):

1. **[test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts)** 신규 — 6 ~ 8 test (5 endpoint × happy + 일부 negative shape):
   - `beforeAll`: `Test.createTestingModule({imports: [AppModule]}).overrideProvider(PrismaService).useValue(mockPrismaService).compile()` + `createNestApplication() + init()`.
   - `afterAll`: `app.close()`.
   - `afterEach`: `jest.clearAllMocks()` — test 간 mock 상태 격리.
   - **Happy path test 5 개**:
     1. `GET /api/persons` → 200 + body 가 mockPrismaService.person.findMany() return 그대로. mock 이 `[{ id: ..., fullName: ..., active: true, ... }]` return.
     2. `GET /api/persons/:id` → 200 + body 가 mock return.
     3. `POST /api/persons` → 201 + body 가 mock create return + ValidationPipe 가 `{ fullName, email }` body 통과.
     4. `PATCH /api/persons/:id` → 200 + body 가 mock update return + `{ fullName: "..." }` partial patch 통과.
     5. `DELETE /api/persons/:id` → 204 + body empty.
   - **Negative path test 2 ~ 3 개**:
     6. `GET /api/persons/missing` → 404 (mock.findUnique return null → service NotFoundException → 404 mapping).
     7. `POST /api/persons` body 누락 (fullName / email 무) → 400 BadRequest (ValidationPipe).
     8. `POST /api/persons` forbiddenNonWhitelisted field (예: `{ extra: "..." }`) → 400 (`forbidNonWhitelisted: true` 동작 확인).
   - **helper** (test 파일 안):
     - `function buildMockPrismaService()` — `person: { findMany, findUnique, create, update, delete }` 5 jest.fn() 보유한 객체 return.
     - `function buildPersonFixture(overrides)` — 표준 Person row sample. existing person.service.spec.ts 의 fixture 와 동일 shape.
   - `describe("Smoke: /api/persons CRUD bootstrap", ...)` 안 정리.
   - 모든 test 는 supertest + `request(app.getHttpServer())` 패턴 — 기존 [test/smoke/app.smoke-spec.ts](../../test/smoke/app.smoke-spec.ts) 와 동일.

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 L64 bullet 2 — 본 task 의 source bullet
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-113 (smoke + e2e CI 의무) / R-110 (tester 의무) / R-112 (4 항목 unit test)
- [test/smoke/app.smoke-spec.ts](../../test/smoke/app.smoke-spec.ts) — 기존 smoke 패턴 (2 test, `describe` / `beforeAll` / supertest)
- [test/jest-smoke.json](../../test/jest-smoke.json) — smoke jest config (`testRegex: .*\.smoke-spec\.ts$`)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — 5 endpoint 정의 + ValidationPipe + HttpCode + Param/Body decorator
- [src/user/person.service.ts](../../src/user/person.service.ts) — service layer 의 P2002 / P2025 → HttpException 변환 (smoke 가 검증할 mapping)
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — PrismaService class 정의 (override 대상 provider)
- [src/app.module.ts](../../src/app.module.ts) — AppModule imports (PersistenceModule + UserModule)
- [src/user/dto/create-person.dto.ts](../../src/user/dto/create-person.dto.ts) — `@IsString / @IsEmail / @IsNotEmpty / @MaxLength` decorator (ValidationPipe 가 400 reject 할 case)
- [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — partial patch DTO (PATCH endpoint smoke 용)
- [src/user/person.service.spec.ts](../../src/user/person.service.spec.ts) — `buildPersonFixture` helper 참조 (smoke 안의 fixture builder 작성 시 동일 shape 유지)
- [package.json](../../package.json) `jest.testPathIgnorePatterns` — `<rootDir>/test/smoke/` 가 unit 에서 제외 + scripts `test:smoke` (`jest --config ./test/jest-smoke.json`)

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) (R-110~R-114) 강제 항목 포함.

### A. Smoke test 신규 파일

- [ ] [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) 신규 파일 생성. existing [test/smoke/app.smoke-spec.ts](../../test/smoke/app.smoke-spec.ts) 와 동일한 구조 (`describe` block / `beforeAll` 에서 AppModule 부트스트랩 / `afterAll` 에서 `app.close()` / supertest 패턴).
- [ ] 단일 `describe("Smoke: /api/persons CRUD bootstrap", ...)` block 안에 6 ~ 8 test 포함.
- [ ] `beforeAll` 안에서 `Test.createTestingModule({imports: [AppModule]}).overrideProvider(PrismaService).useValue(buildMockPrismaService()).compile()` 패턴 — AppModule 전체 부트스트랩 + PrismaService 만 mock 으로 교체.
- [ ] `afterEach` 안에서 mock 상태 격리 (jest.clearAllMocks() 또는 동등).
- [ ] file header comment 에 본 spec 의 역할 / smoke vs e2e 책임 경계 / mock 전략 / R-113 cover 박제 (기존 app.smoke-spec.ts header 와 동일 톤).

### B. Test coverage (5 endpoint × happy + negative shape)

- [ ] **Happy GET /api/persons (200)** — mock `findMany.mockResolvedValueOnce([fixture])` → response.status === 200 + body[0].fullName === fixture.fullName.
- [ ] **Happy GET /api/persons/:id (200)** — mock `findUnique.mockResolvedValueOnce(fixture)` → response.status === 200 + body.id === fixture.id.
- [ ] **Happy POST /api/persons (201)** — mock `create.mockResolvedValueOnce(fixture)` + body `{ fullName: "홍길동", email: "hong@x.test" }` → response.status === 201 + body.fullName === "홍길동".
- [ ] **Happy PATCH /api/persons/:id (200)** — mock `update.mockResolvedValueOnce(fixture)` + body `{ fullName: "김철수" }` → response.status === 200 + body.fullName === fixture.fullName (mock return 그대로).
- [ ] **Happy DELETE /api/persons/:id (204)** — mock `delete.mockResolvedValueOnce(fixture)` → response.status === 204 + response.body empty (또는 빈 객체).
- [ ] **Negative GET /api/persons/missing (404)** — mock `findUnique.mockResolvedValueOnce(null)` → response.status === 404 (PersonService.findById 의 NotFoundException → 404).
- [ ] **Negative POST validation 400** — body `{}` (fullName / email 누락) → response.status === 400 (ValidationPipe).
- [ ] (선택) **Negative POST whitelist 400** — body `{ fullName: "X", email: "x@y.test", extra: "block" }` → response.status === 400 (`forbidNonWhitelisted: true`).

### C. Helper (test 파일 내부)

- [ ] `function buildMockPrismaService()` — `person: { findMany, findUnique, create, update, delete }` 5 jest.fn() 보유한 객체 return. 신규 helper 파일 분리 안 함 (1 파일 budget 유지).
- [ ] `function buildPersonFixture(overrides?: Partial<Person>)` — 표준 Person row sample (id / fullName / email / active / createdAt / updatedAt 등) return. existing person.service.spec.ts 의 fixture shape 와 호환.

### D. R-112 4 항목 (smoke test 자체가 충족하는 항목)

- [ ] **Happy path**: 5 endpoint 각 happy test 1 개 — cover ok (B 의 5 happy bullet).
- [ ] **Error path**: GET 404 + POST 400 (validation 누락) — cover ok (B 의 2 negative bullet).
- [ ] **Branch coverage**: 본 task 는 신규 production 코드 0 — controller / service / repository production branch 추가 없음. smoke spec 내부의 jest.fn() mock 가 endpoint 별로 다른 분기를 따라가는 점이 branch cover.
- [ ] **Negative cases 충분 cover**: 404 (not found) + 400 (validation 누락) + (선택) 400 (whitelist 위반) — 3 negative case. R-112 의 "예외 처리 분기마다 cover" 의 smoke 차원 이행.

본 task 는 production 코드 변경 0 — branch / coverage threshold 회귀 위험 없음. 단 R-112 4 항목은 smoke 차원에서도 만족.

### E. Lint / build / unit / smoke / e2e (R-111 / R-113)

- [ ] `pnpm lint` 통과 (신규 smoke 파일 0 lint error — ESLint config 가 `{src,test}/**/*.ts` cover 함).
- [ ] `pnpm build` 통과 (smoke 파일은 nest build 대상 제외, regression 없음).
- [ ] `pnpm test` 통과 (unit suite 영향 없음 — smoke 파일은 testPathIgnorePatterns 가 제외).
- [ ] `pnpm test:cov` 통과 (coverage threshold line ≥ 80% AND function ≥ 80% — 기존 그대로).
- [ ] `pnpm test:smoke` 통과 — 신규 6 ~ 8 test green + 기존 app.smoke-spec.ts 2 test 회귀 없음 = 합계 8 ~ 10 test.
- [ ] `pnpm test:e2e` 통과 (기존 e2e regression 없음 — e2e 는 별도 spec).
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green.

### F. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE (smoke 단일 신규 파일 PR — round 1 머지 가능성 높음).
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-113 smoke 의무 / 4 항목) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline):

- **e2e test domain endpoint 확장** — PLAN.md L65 bullet 3 (`/api/persons` status code + DTO contract + 4xx error shape e2e-spec) 는 **별도 T-0044** (또는 후속) 책임. 본 task 는 smoke layer 만 — e2e 는 spec depth 가 더 깊고 별도 commit 으로 분리. 두 layer 가 동일 endpoint 를 cover 하나 책임 (smoke = 부트스트랩 sanity / e2e = HTTP contract) 가 다름.
- **Group/Part endpoint smoke** — GroupController / PartController 가 아직 미존재 (T-0039 가 Group/Part entity + repository 만 도입, controller 는 후속 T-0045+ 책임). 본 task 는 PersonController 5 endpoint 만 cover. Group/Part controller 가 추가되면 본 spec 의 `describe` 옆에 새 `describe` block 추가 형태로 별도 task 가 확장.
- **production 코드 변경 일절 금지** — PersonController / PersonService / PersonRepository / DTO / PrismaService / AppModule / UserModule 등 production 파일은 read-only. 본 task 는 smoke spec 1 파일 신규만.
- **mock PrismaService 의 helper 분리** — `buildMockPrismaService()` 를 별도 `test/helpers/` 디렉토리로 분리하지 않는다. 본 task 는 spec 파일 안에 inline (1 파일 budget 유지). 다른 smoke spec 이 같은 helper 가 필요해지는 시점에 separate task 가 helper 디렉토리 신설 (예: `test/helpers/prisma-mock.ts`).
- **ValidationPipe global wire** — main.ts 에 `app.useGlobalPipes(...)` 추가는 별도 task (T-0036.5 후속, plan §2 박제). 본 task 는 PersonController 의 controller-scope ValidationPipe 동작을 smoke 로 검증.
- **jest config / package.json 변경** — `test/jest-smoke.json` / `package.json` 의 jest 영역은 unchanged. 기존 config 가 신규 spec 을 자동 picking.
- **새 외부 dependency / schema 변경 / migration / ADR 신설** — 0 건. 본 task 는 smoke test 1 파일 신규만으로 self-contained.
- **smoke 의 deep business assertion** — 본 task 는 supertest 의 status code + body shape 1-level cover 만. service-layer business logic (P2002 → 409 / P2025 → 404 의 정확한 message) 검증은 unit test (person.service.spec.ts) 의 책임. smoke 는 routing/wiring 회귀만.
- **smoke 의 동시성 / race / DB transaction 검증** — smoke 는 mock 환경이라 race 없음. 실 DB race 는 e2e 또는 integration 의 책임.

## Suggested Sub-agents

`architect → implementer → tester` — architect 가 mock PrismaService override 패턴 + helper inline vs separate 의 결정 (본 task 안에서 inline 결정, ADR 신설 불요 — 1 단계 decision) + smoke spec header comment 박제 + mock fixture shape 결정. implementer 가 [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) 신규 1 파일 작성 (~180 LOC, 6 ~ 8 test). tester 가 `pnpm lint / build / test / test:cov / test:smoke / test:e2e` 6 종 grand gate 실행하여 신규 smoke green + 기존 regression 없음 확인 (특히 test:cov coverage threshold 통과).

## Follow-ups

(implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **PLAN.md L65 후보 (e2e test domain endpoint 확장)** — `/api/persons` status code + response body shape (DTO contract) + 4xx error shape (NotFound 404 / Conflict 409 / BadRequest 400) e2e-spec 으로 cover. R-113 e2e 의무 이행. T-0044 (또는 후속) 책임.
- **GroupController / PartController smoke** — T-0045+ (Group/Part controller backbone) 머지 후 본 smoke 파일에 `describe("Smoke: /api/groups CRUD ...", ...)` block 추가. 또는 spec 별 분리 (groups.smoke-spec.ts / parts.smoke-spec.ts) — 파일 수 vs 시각적 cohesion trade-off 는 그 시점 결정.
- **mock PrismaService helper 디렉토리** — 두 번째 smoke spec 또는 e2e spec 이 동일 mock 패턴을 필요로 할 때 `test/helpers/prisma-mock.ts` 디렉토리 신설. 본 task 는 inline 유지.
- **smoke / e2e 의 ValidationPipe global wire 회귀** — main.ts global wire 도입 (T-0036.5 후속) 시 본 smoke spec 의 controller-scope wire 검증이 global 로 자연 확장. 회귀 anchor 강화.
