---
id: T-0044
title: P3 — e2e test domain endpoint 확장 `/api/persons` HTTP contract + DTO body shape + 4xx error envelope
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-113]
estimatedDiff: 200
estimatedFiles: 1
created: 2026-05-26
plannerNote: P3 L65 bullet 3 — e2e 가 GET / 만 cover, /api/persons 5 endpoint HTTP contract (status + DTO body shape + 4xx envelope) e2e-spec 신설 (mock PrismaService). R-113 e2e 의무.
dependsOn: [T-0036, T-0043]
blocks: []
plannerSource: PLAN.md L65 (P3 bullet 3)
humanApprovalGate: false
---

# T-0044 — e2e test domain endpoint 확장 `/api/persons` HTTP contract + DTO body shape + 4xx error envelope

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 단락 L65 bullet 3 ("[테스트 품질] e2e test domain endpoint 확장 — 현재 e2e 가 `GET /` HTTP contract 만 검증. `/api/persons` 의 status code + response body shape (DTO contract) + 4xx error shape 를 e2e-spec 으로 커버. R-113 e2e 의무 이행") 의 정확한 cover. PLAN.md L63-65 의 P3 test-quality 3 bullet 중 마지막 잔여 — L63 (T-0042, unit branch 100%) 와 L64 (T-0043, smoke domain) 가 closed 된 상태에서 본 task 가 L65 closure.

현재 [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) 는 단 2 test 만 cover:

1. `GET /` 200 + content-type text/html + body 가 정확히 `APP_STATUS_MESSAGE` (HTTP contract: status + header + body 3-tuple)
2. `GET /__not_exists_e2e__` 404 + body `{ statusCode: 404 }` (error envelope shape)

T-0036 머지 ([6b84c62](https://github.com/myungjoo/Assessment-Agent/commit/6b84c62)) 로 [src/user/person.controller.ts](../../src/user/person.controller.ts) 가 5 endpoint (`GET /api/persons` / `GET /api/persons/:id` / `POST /api/persons` / `PATCH /api/persons/:id` / `DELETE /api/persons/:id`) 를 노출하고, T-0043 머지 ([e7bb95a](https://github.com/myungjoo/Assessment-Agent/commit/e7bb95a)) 로 smoke layer 의 bootstrap sanity 가 박제되었으나 — e2e layer 는 domain endpoint 의 **HTTP contract depth** 를 전혀 검증하지 않는다. smoke 와 e2e 의 책임 경계:

- **smoke** (T-0043) — AppModule 부트스트랩 + DI wiring + HTTP routing + status code 1-level. status === 200 / body[0].fullName === fixture.fullName 같은 single-assertion happy path.
- **e2e** (본 task) — HTTP contract depth. status code + response header (content-type) + response body **shape** (DTO contract: 필수 field 존재 + type + 형태) + 4xx error envelope (`{ statusCode, message, error }` 3 field 구조). 회귀 시 smoke 는 통과하나 e2e 가 fail 하는 contract 변경 (예: 응답 envelope 변경 / DTO field rename / error shape 변경) 을 본 spec 이 cover.

본 task 의 정당성:

- **R-113 e2e 의무 이행** ([CLAUDE.md §3.2](../../CLAUDE.md)) — "unit 외에 smoke + end-to-end test 도 CI 에서 함께 수행". 현 e2e 는 AppModule 부트스트랩 + 1 endpoint 의 contract sample 만, domain endpoint 5 종 cover 가 R-113 의 정확한 의도.
- **회귀 anchor 강화 (smoke 와 별 layer)** — smoke 가 routing/wiring 회귀 / e2e 가 contract 회귀. T-0037 의 PATCH active routing 분기 같은 결함이 발생하면 smoke 는 200 통과하나 e2e 의 body shape assertion (`expect(response.body.active).toBe(false)`) 이 회귀를 catch.
- **PLAN.md L63-65 P3 test-quality 단락 closure** — 본 task 머지 시 P3 test-quality 3 bullet 모두 closed. 이후 P3 backbone (GroupService / PartService / AuthModule) 진입에 test-infrastructure rock-solid foundation 확보.
- **task size 적정** — 단일 신규 파일 ~150-200 LOC (5 endpoint × ~30 LOC HTTP contract depth + 4xx error envelope 2-3 case + setup ~40 LOC + helper ~15 LOC). cap (≤ 300 LOC / ≤ 5 파일) 의 67%. reviewer round 1 단발 머지 후보. production 코드 / DTO / repository / service 변경 0 — e2e test 파일 1 개 추가.
- **production 안정성 가산** — mock PrismaService 가 정상이면 5 endpoint 의 ValidationPipe + HttpCode + Param/Body decorator + DTO contract + error envelope 가 매 CI 마다 검증.

본 task 의 정확한 산출물 (1 파일 신규 / ~150-200 LOC):

1. **[test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts)** 신규 — 8 ~ 11 test (5 endpoint × HTTP contract depth + 4xx error envelope 2-3 case):
   - `beforeAll`: `Test.createTestingModule({imports: [AppModule]}).overrideProvider(PrismaService).useValue(buildMockPrismaService()).compile()` + `createNestApplication() + init()`. T-0043 의 smoke spec 와 동일 패턴.
   - `afterAll`: `app.close()`.
   - `afterEach`: `jest.clearAllMocks()` — test 간 mock 상태 격리.
   - **Happy path HTTP contract test 5 개 (depth: status + header + body shape)**:
     1. `GET /api/persons` → 200 + content-type `application/json` + body 가 array + body[0] 가 Person DTO contract 5 field (id / fullName / email / active / partId — createdAt / updatedAt 은 ISO string 변환 후 확인 가능).
     2. `GET /api/persons/:id` → 200 + content-type `application/json` + body 가 Person DTO contract 단일 object + 모든 필수 field 존재.
     3. `POST /api/persons` → 201 + content-type `application/json` + body 가 생성된 Person + ValidationPipe `transform: true` 동작 검증 (request body 의 fullName / email 이 mock create 호출 인자에 그대로 전달).
     4. `PATCH /api/persons/:id` → 200 + body 가 updated Person + active toggle 시 body.active 가 boolean.
     5. `DELETE /api/persons/:id` → 204 + body empty (content-length 0 또는 빈 객체 `{}`).
   - **4xx error envelope test 3 개 (status + body envelope 3 field 검증)**:
     6. `GET /api/persons/missing` → 404 + body `{ statusCode: 404, message: <string>, error: "Not Found" }` 3 field 모두 존재.
     7. `POST /api/persons` body `{}` → 400 + body `{ statusCode: 400, message: <string|array>, error: "Bad Request" }` envelope + message 가 validation 실패 사유 포함.
     8. `POST /api/persons` body `{ fullName: "X", email: "x@y.test", extra: "block" }` → 400 + body envelope + message 가 `extra` field 의 forbidNonWhitelisted 위반 포함.
   - **(선택) branch test 2-3 개 — service-layer HttpException 변환 → status code mapping**:
     9. `PATCH /api/persons/:id` mock.update reject P2002 → 409 + body `{ statusCode: 409, message: <string>, error: "Conflict" }` envelope.
     10. `PATCH /api/persons/missing` mock.update reject P2025 → 404 + envelope.
     11. (선택) `DELETE /api/persons/missing` mock.delete reject P2025 → 404 + envelope.
   - **helper** (test 파일 안 inline — T-0043 의 smoke spec 동일 패턴, 본 task §Out of Scope 박제):
     - `function buildMockPrismaService()` — `person: { findMany, findUnique, create, update, delete }` 5 jest.fn() 보유한 객체 return.
     - `function buildPersonFixture(overrides)` — 표준 Person row sample. T-0043 smoke spec / person.service.spec.ts 의 fixture 와 동일 shape.
     - `function buildPrismaError(code)` — Prisma known error helper. P2002 / P2025 분기 검증용.
   - `describe("E2E: /api/persons HTTP contract", ...)` 안 정리.
   - 모든 test 는 supertest + `request(app.getHttpServer())` 패턴 — 기존 [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) 와 동일.

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 L65 bullet 3 — 본 task 의 source bullet
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-113 (smoke + e2e CI 의무) / R-110 (tester 의무) / R-112 (4 항목 unit test — negative cases 충분 cover) / R-114 (CI 자동 실행)
- [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) — 기존 e2e 패턴 (2 test, `describe` / `beforeAll` / supertest, HTTP contract depth)
- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — T-0043 가 박제한 smoke 패턴 + helper inline 패턴 (buildMockPrismaService / buildPersonFixture / buildPrismaError) 재사용 reference
- [test/jest-e2e.json](../../test/jest-e2e.json) — e2e jest config (`testRegex: .*\.e2e-spec\.ts$`, rootDir `..`)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — 5 endpoint 정의 + ValidationPipe + HttpCode + Param/Body decorator
- [src/user/person.service.ts](../../src/user/person.service.ts) — service layer 의 P2002 / P2025 → HttpException 변환 (e2e 가 검증할 mapping)
- [src/user/dto/create-person.dto.ts](../../src/user/dto/create-person.dto.ts) — `@IsString / @IsEmail / @IsNotEmpty / @MaxLength` decorator (ValidationPipe 가 400 reject 할 case + envelope shape 결정)
- [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — partial patch DTO (PATCH endpoint e2e 용)
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — PrismaService class 정의 (override 대상 provider)
- [src/app.module.ts](../../src/app.module.ts) — AppModule imports (PersistenceModule + UserModule)
- [package.json](../../package.json) `jest.testPathIgnorePatterns` — `<rootDir>/test/e2e/` 가 unit 에서 제외 + scripts `test:e2e` (`jest --config ./test/jest-e2e.json`)

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) (R-110~R-114) 강제 항목 포함.

### A. E2e test 신규 파일

- [ ] [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 신규 파일 생성. existing [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) 와 동일한 구조 (`describe` block / `beforeAll` 에서 AppModule 부트스트랩 / `afterAll` 에서 `app.close()` / supertest 패턴).
- [ ] 단일 `describe("E2E: /api/persons HTTP contract", ...)` block 안에 8 ~ 11 test 포함.
- [ ] `beforeAll` 안에서 `Test.createTestingModule({imports: [AppModule]}).overrideProvider(PrismaService).useValue(buildMockPrismaService()).compile()` 패턴 — AppModule 전체 부트스트랩 + PrismaService 만 mock 으로 교체. T-0043 smoke spec 와 동일 mock 전략.
- [ ] `afterEach` 안에서 mock 상태 격리 (`jest.clearAllMocks()` 또는 동등).
- [ ] file header comment 에 본 spec 의 역할 / smoke vs e2e 책임 경계 / mock 전략 / R-113 e2e 의무 cover 박제 (기존 app.e2e-spec.ts header 와 동일 톤 + smoke 와의 차이점 1-2 줄 명시).

### B. Happy path HTTP contract depth (5 endpoint × 3-tuple — status + header + body shape)

- [ ] **GET /api/persons (200 + json + array shape)** — mock `findMany.mockResolvedValueOnce([fixture])` → `response.status === 200` + `response.headers["content-type"]` 가 `application/json` 매칭 + `Array.isArray(response.body)` + `response.body[0]` 가 Person DTO 5+ field (id / fullName / email / active / partId) 모두 존재.
- [ ] **GET /api/persons/:id (200 + json + object shape)** — mock `findUnique.mockResolvedValueOnce(fixture)` → status + content-type + body 가 단일 object (`Array.isArray` false) + 필수 field 모두 존재 + 값이 fixture 와 일치.
- [ ] **POST /api/persons (201 + json + created object)** — mock `create.mockResolvedValueOnce(fixture)` + body `{ fullName, email }` → status 201 + content-type + body 가 생성된 Person + ValidationPipe `transform` 으로 mock create 호출 인자에 dto field 전달 확인 (`expect(mockPrisma.person.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fullName, email }) }))`).
- [ ] **PATCH /api/persons/:id (200 + json + updated object)** — mock `update.mockResolvedValueOnce(fixture)` + body `{ fullName: "X" }` → status 200 + content-type + body 가 updated Person + active field 가 boolean type.
- [ ] **DELETE /api/persons/:id (204 + empty)** — mock `delete.mockResolvedValueOnce(fixture)` → status 204 + body empty (`response.body` 가 `{}` 또는 content-length 0).

### C. 4xx error envelope (status + body envelope 3 field)

- [ ] **GET /api/persons/missing → 404 envelope** — mock `findUnique.mockResolvedValueOnce(null)` → status 404 + `response.body` 가 `{ statusCode: 404, message: <truthy>, error: "Not Found" }` 3 field 모두 존재 (`expect(response.body).toMatchObject({ statusCode: 404, error: "Not Found" })` + `message` truthy).
- [ ] **POST /api/persons {} → 400 envelope + validation message** — body `{}` → status 400 + envelope 3 field + `message` 가 validation 실패 사유 (`fullName` / `email` 키워드 포함 — string 또는 string array).
- [ ] **POST /api/persons with forbidden field → 400 envelope + whitelist message** — body `{ fullName: "X", email: "x@y.test", extra: "block" }` → status 400 + envelope 3 field + `message` 가 forbidNonWhitelisted 위반 사유 (`extra` 키워드 또는 "property" 키워드 포함).

### D. Branch test (service-layer HttpException 변환 → status code mapping) — 선택 강력 권장

- [ ] **PATCH duplicate email → 409 envelope** — mock `update.mockRejectedValueOnce(buildPrismaError("P2002"))` → status 409 + body `{ statusCode: 409, error: "Conflict" }` matchObject + message truthy.
- [ ] **PATCH missing id → 404 envelope** — mock `update.mockRejectedValueOnce(buildPrismaError("P2025"))` → status 404 + envelope.
- [ ] (선택) **DELETE missing id → 404 envelope** — mock `delete.mockRejectedValueOnce(buildPrismaError("P2025"))` → status 404 + envelope.

### E. Helper (test 파일 내부 — T-0043 패턴 reuse)

- [ ] `function buildMockPrismaService()` — `person: { findMany, findUnique, create, update, delete }` 5 jest.fn() 보유한 객체 return. T-0043 의 smoke spec 와 **동일 helper 시그니처 reuse** (1 파일 budget 유지 / DRY 위반 아님 — 격리 가치 우선, §Out of Scope 박제).
- [ ] `function buildPersonFixture(overrides?: Partial<Person>)` — 표준 Person row sample (id / fullName / email / active / partId / createdAt / updatedAt 7 field) return. T-0043 / person.service.spec.ts 의 fixture shape 와 호환.
- [ ] `function buildPrismaError(code: string, message?: string)` — Prisma known error helper. `Object.assign(new Error(message), { code })` 패턴. T-0043 동일.
- [ ] helper inline 정당화 1 줄 박제 — "T-0043 smoke spec 의 helper 와 시그니처 동일. 향후 두 번째 e2e spec 또는 별도 layer 가 동일 helper 를 필요로 할 때 `test/helpers/prisma-mock.ts` 디렉토리 신설 별도 task (§Follow-ups L161)."

### F. R-112 4 항목 (e2e test 자체가 충족하는 항목)

- [ ] **Happy path**: 5 endpoint 각 HTTP contract happy test 1 개 — cover ok (B 의 5 bullet).
- [ ] **Error path**: GET 404 + POST 400 (validation) + POST 400 (whitelist) — cover ok (C 의 3 bullet).
- [ ] **Branch / flow coverage**: 본 task 는 신규 production 코드 0 — controller / service / repository production branch 추가 없음. e2e spec 내부의 jest.fn() mock 가 endpoint 별로 다른 분기 (P2002 → 409 / P2025 → 404 / null findUnique → 404 / validation 실패 → 400 / whitelist 위반 → 400) 를 따라가는 점이 branch cover (D 의 2-3 bullet 가 service-layer branch 의 HTTP-level cover).
- [ ] **Negative cases 충분 cover**: 404 (not found) + 400 (validation 누락) + 400 (whitelist 위반) + 409 (duplicate email) + 404 (PATCH missing) = 5 negative case. R-112 의 "예외 처리 분기마다 cover" 의 e2e 차원 이행 — 단일 negative 만으로 부족, **5 negative** 가 본 task 의 negative cap (smoke 가 cover 한 3 negative 와 layer 차원에서 별 회귀 anchor).

본 task 는 production 코드 변경 0 — branch / coverage threshold 회귀 위험 없음. 단 R-112 4 항목은 e2e 차원에서도 만족.

### G. Lint / build / unit / smoke / e2e (R-111 / R-113 / R-114)

- [ ] `pnpm lint` 통과 (신규 e2e 파일 0 lint error — ESLint config 가 `{src,test}/**/*.ts` cover 함).
- [ ] `pnpm build` 통과 (e2e 파일은 nest build 대상 제외, regression 없음).
- [ ] `pnpm test` 통과 (unit suite 영향 없음 — e2e 파일은 testPathIgnorePatterns 가 제외).
- [ ] `pnpm test:cov` 통과 (coverage threshold line ≥ 80% AND function ≥ 80% — 기존 그대로).
- [ ] `pnpm test:smoke` 통과 — T-0043 의 9 신규 + 기존 2 = 11 smoke test 회귀 없음.
- [ ] `pnpm test:e2e` 통과 — 신규 8 ~ 11 test green + 기존 app.e2e-spec.ts 2 test 회귀 없음 = 합계 10 ~ 13 e2e test.
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green. R-114 의 "commit 후 CI 자동 실행 + 종료 전 conclusion 확인" 의무.

### H. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE (e2e 단일 신규 파일 PR — round 1 머지 가능성 높음, T-0043 의 smoke 패턴과 같은 일관성).
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-113 e2e 의무 / R-112 4 항목 / negative 5 cover) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline):

- **smoke test domain endpoint 확장** — PLAN.md L64 bullet 2 는 **T-0043 머지 (e7bb95a) 로 closed**. 본 task 는 e2e layer 전용 — smoke 와 별 회귀 anchor 책임 분리. 본 task 가 smoke spec 의 assertion 을 중복 또는 보강하지 않는다.
- **Group/Part endpoint e2e** — GroupController / PartController 가 아직 미존재 (T-0039 가 Group/Part entity + repository 만 도입, controller 는 후속 backbone 책임). 본 task 는 PersonController 5 endpoint 만 cover. Group/Part controller 추가 시 본 spec 의 `describe` 옆에 새 `describe` block 추가 또는 별도 spec 파일 (groups.e2e-spec.ts / parts.e2e-spec.ts) — trade-off 는 그 시점 결정.
- **production 코드 변경 일절 금지** — PersonController / PersonService / PersonRepository / DTO / PrismaService / AppModule / UserModule / main.ts 등 production 파일은 read-only. 본 task 는 e2e spec 1 파일 신규만.
- **mock PrismaService helper 디렉토리 신설** — `buildMockPrismaService()` / `buildPersonFixture()` / `buildPrismaError()` 3 helper 를 별도 `test/helpers/prisma-mock.ts` 디렉토리로 분리하지 않는다. T-0043 smoke spec 도 inline 유지, 본 task 도 inline 유지 (1 파일 budget + 격리 가치 우선). 두 spec (smoke + e2e) 모두 helper 시그니처 동일 — DRY 위반은 의도된 절충 (test 격리 > DRY). 세 번째 spec 이 같은 helper 필요해지는 시점에 별도 task 가 `test/helpers/` 디렉토리 신설.
- **ValidationPipe global wire** — main.ts 에 `app.useGlobalPipes(...)` 추가는 별도 task (T-0036.5 후속). 본 task 는 PersonController 의 controller-scope ValidationPipe 동작을 e2e 로 검증.
- **jest config / package.json 변경** — `test/jest-e2e.json` / `package.json` 의 jest 영역은 unchanged. 기존 config 가 신규 spec 을 자동 picking (`testRegex: .*\.e2e-spec\.ts$`).
- **새 외부 dependency / schema 변경 / migration / ADR 신설** — 0 건. 본 task 는 e2e test 1 파일 신규만으로 self-contained.
- **e2e 의 실 DB 연동 검증** — 본 task 는 mock PrismaService 환경 — 실 DB 없이 HTTP contract 검증. 실 DB 연동 / docker-compose 띄움 / migration 적용 후 e2e 는 후속 integration test 의 책임 (P5+ 별도 phase).
- **e2e 의 deep business assertion** — 본 task 는 HTTP contract (status + header + body shape + envelope) 검증만. service-layer business logic (P2002 → 409 의 message text 한국어 / 영어 정확 match, partial update 의 field-by-field 분기) 검증은 unit (person.service.spec.ts) 의 책임. e2e 는 status code + envelope shape 만.
- **e2e 의 동시성 / race / transaction 검증** — e2e 는 mock 환경이라 race 없음. 실 DB race / transaction rollback 은 integration test 의 책임 (별도 phase).
- **regression test 별 항목 추가** — 본 task 는 patch task 가 아님 (frontmatter `hqOrigin` 없음) — R-112 의 regression 의무 면제. happy + negative 5 cover 로 충분.

## Suggested Sub-agents

`architect → implementer → tester` — architect 가 mock PrismaService override 패턴 (T-0043 reuse) + helper inline vs separate 의 결정 (본 task 안에서 inline 결정, ADR 신설 불요 — 1 단계 decision) + e2e spec header comment 박제 + smoke 와의 책임 경계 1-2 줄 명시 + mock fixture shape 결정 (T-0043 reuse). implementer 가 [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 신규 1 파일 작성 (~150-200 LOC, 8 ~ 11 test). tester 가 `pnpm lint / build / test / test:cov / test:smoke / test:e2e` 6 종 grand gate 실행하여 신규 e2e green + 기존 regression 없음 확인 (특히 test:cov coverage threshold 통과 + test:smoke 11 test pass).

## Follow-ups

(implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **PLAN.md L63-65 P3 test-quality 단락 closure 박제** — 본 task 머지 시 L63 (T-0042) / L64 (T-0043) / L65 (T-0044) 3 bullet 모두 closed. 별도 doc-only direct task 가 PLAN.md §P3 의 3 bullet 을 closed 마커로 갱신 (예: ~~strikethrough~~ + 머지 commit reference) — small task ~10 LOC / 1 파일. 본 task 는 PLAN.md 변경 안 함.
- **GroupController / PartController e2e** — T-0045+ (Group/Part controller backbone) 머지 후 본 e2e 파일에 `describe("E2E: /api/groups HTTP contract", ...)` block 추가 또는 spec 별 분리 (groups.e2e-spec.ts / parts.e2e-spec.ts). 파일 수 vs 시각적 cohesion trade-off 는 그 시점 결정.
- **mock PrismaService helper 디렉토리 신설** — 본 task 와 T-0043 smoke spec 이 동일 helper (buildMockPrismaService / buildPersonFixture / buildPrismaError) 를 각자 inline 보유 = 2 spec 중복. 세 번째 spec (예: GroupController smoke 또는 e2e) 이 같은 helper 를 필요로 할 때 `test/helpers/prisma-mock.ts` 디렉토리 신설 별도 task. 본 task 머지 후 GroupController smoke/e2e 진입 시 trigger.
- **e2e 의 deep negative case 확장** — 본 task 는 5 negative case cover. 향후 추가 endpoint (Group / Part / Assessment) 의 e2e 합류 시 negative pool 누적 — 일정 시점에 `test/helpers/` 디렉토리 + negative case fixture 분리 task.
- **GroupService / PartService backbone 진입** — T-0040 / T-0041 §Follow-ups 의 다음 P3 backbone. PersonRepository.findByPartId / findByGroupId (T-0041) 가 prerequisite 충족 완료 — GroupService 의 Group 멤버 list / PartService 의 Part 소속 인원 list 의 repository-layer 호출 source. 본 task 머지 후 cron/session 가 큐잉 — task size 추정 ~250-300 LOC / 4-5 파일 (cap 보존 가능).
- **e2e 의 실 DB integration test (별도 phase)** — 본 task 는 mock 환경. 실 DB 연동 + migration + docker-compose 띄움 + e2e 는 P5+ integration phase 의 책임. 본 phase (P3) 종료 후 별도 ADR + plan §2 갱신.
