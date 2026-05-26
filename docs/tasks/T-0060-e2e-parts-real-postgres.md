---
id: T-0060
title: parts.e2e-spec 신설 — PartController 5 endpoint real PostgreSQL HTTP contract depth e2e + jest-e2e maxWorkers:1 race fix (T-0059 amendment mirror)
phase: P3
status: IN_PROGRESS
prNumber: 56
commitMode: pr
slug: e2e-parts-real-postgres
coversReq: [REQ-028, REQ-029, REQ-058]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-05-26
plannerNote: P3 closure backbone — persons.e2e (T-0054) 패턴 mirror로 parts.e2e 신설. T-0059 smoke maxWorkers:1 race fix 의 e2e 측 동등 적용. ADR-0004 §Migration 5/5 closure 위에서 Part 도메인 HTTP contract depth 박제.
dependsOn: [T-0046, T-0052, T-0054, T-0059]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: |
  session #16 turn 1 wake (KST 21:55, fresh /loop session, cap 10). 직전 session #15 turn 1 SUCCESS: T-0059 parts.smoke (+ maxWorkers:1 race fix) MERGED 3f71c64 via local-CI-proxy-during-outage. STATE: currentTask=null, nextTask=null, lock=null, P3-in-progress, counters.tasksCompleted=58, HQ-0007 resolved, blockers 0.
  session #14 turn 6 planner 가 박제한 split decision 자연 후속 — Part smoke/e2e 단일 결합 ~370-400 LOC > 300 cap → T-0059 (parts.smoke ~220 LOC) + 본 T-0060 (parts.e2e ~180 LOC) split. T-0059 (parts.smoke) MERGED 후 본 task 가 e2e 절반 closure.
  채택: parts.e2e 신설 — persons.e2e (T-0054) 패턴 1:1 mirror + ADR-0004 §Decision real DB + jest-e2e-setup.ts (thin re-export, T-0054 박제) globalSetup 재사용 + afterEach truncate 박제. **T-0059 smoke 에서 처음 노출된 cross-file race (parts.smoke + persons.smoke afterEach truncate 동시 발화) 가 e2e 차원에서도 발생 가능** — parts.e2e + persons.e2e 가 동시 실행 시 동일 cross-file truncate race 위험 → test/jest-e2e.json 에 `maxWorkers: 1` 1 줄 추가 (T-0059 amendment d350bde 의 smoke 측 fix 와 동일 패턴, e2e 측 동등 적용). app.e2e 는 DB 미사용이라 무영향.
  estimate: parts.e2e-spec.ts +160 LOC (persons.e2e 의 ~220 LOC 중 PATCH endpoint 1 종 부재 분량 감소 + GET :id/persons 1 종 추가, JSDoc 5 줄 박제 + describe + beforeAll/afterAll/afterEach + happy 5 + negative 3 + branch 2 = 합계 ~150-170 LOC) + jest-e2e.json +1 LOC (maxWorkers:1) = **180 LOC / 2 파일**. cap 300 안전 envelope.
  PartController 5 endpoint (GET / GET :id / GET :id/persons / POST 201 / DELETE 204) e2e cover. PATCH 부재 — Part 의 mutation 은 후속 task. happy 5 + negative 3 (404 missing / 400 empty / 400 non-whitelisted) + branch 2 (P2002 duplicate name 409 / P2003 assigned persons 409) = ~10 test, persons.e2e 의 11 test 와 동등 mass (PATCH 1 종 부재 + GET :id/persons 1 종 추가).
  REQ 매핑: REQ-028 (Person-Part N:1 invariant + REVERSE query :id/persons HTTP contract depth — REQ-028 invariant 의 e2e closure layer) + REQ-029 (평가 자료 non-volatile durability path Part 도메인 e2e HTTP contract — persons 도메인 T-0054 박제 위에 Part 도메인 확장으로 REQ-029 검증 path 가 unit + smoke + e2e 3 layer 전부 박제) + REQ-058 (운영 정책 underlying).
  architect 호출 0 (ADR-0004 §Decision + §Cleanup 정책 + persons.e2e (T-0054) 패턴 + jest-e2e-setup.ts re-export + T-0059 maxWorkers:1 race fix 모두 박제 완료, 새 의사결정 0).
  dependsOn=[T-0046 PartController/Service backbone, T-0052 ADR-0004 + ci.yml services.postgres + DATABASE_URL + migrate deploy, T-0054 persons.e2e 패턴 + jest-e2e-setup.ts thin re-export, T-0059 parts.smoke + maxWorkers:1 race fix].
  STATE.nextTask=T-0060.
---

# T-0060 — parts.e2e-spec 신설 (PartController 5 endpoint real PostgreSQL HTTP contract depth e2e + jest-e2e maxWorkers:1 race fix)

## Why

[T-0046](T-0046-part-service-controller-dto-backbone.md) 가 mergeCommit `2a314bc` 로 PartService + PartController + CreatePartDto + UserModule wiring 박제 완료. [T-0054](T-0054-e2e-persons-real-postgres-cutover.md) 가 mergeCommit `2d52128` 로 ADR-first split 4-stage trajectory 의 stage 4 closure — `test/helpers/jest-e2e-setup.ts` thin re-export + `test/jest-e2e.json` globalSetup wiring + persons.e2e real PostgreSQL cutover 박제 완료. [T-0059](T-0059-smoke-parts-real-postgres.md) 가 mergeCommit `3f71c64` 로 parts.smoke real PostgreSQL bootstrap + **`test/jest-smoke.json` maxWorkers:1** cross-file race fix (parts.smoke ↔ persons.smoke afterEach truncate 동시 발화 차단) 박제 완료.

**현재 상태의 gap**: parts 도메인 e2e spec 0 — `test/e2e/` 에 `app.e2e-spec.ts` + `persons.e2e-spec.ts` 2 파일만 존재. PartController 5 endpoint (GET / GET :id / GET :id/persons / POST 201 / DELETE 204) 는 unit (`src/user/part.controller.spec.ts`) + smoke (`test/smoke/parts.smoke-spec.ts`, T-0059 박제) cover 만, e2e 차원의 HTTP contract depth + 4xx envelope (statusCode / error / message) + 응답 header content-type + multi-step branch flow 검증 0.

본 T-0060 은 [persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 의 패턴을 1:1 mirror 해 `test/e2e/parts.e2e-spec.ts` 1 파일을 신설 + `test/jest-e2e.json` 의 maxWorkers:1 race fix 1 줄을 박제 (T-0059 amendment `d350bde` 의 smoke 측 fix 와 동등 패턴의 e2e 측 적용).

**maxWorkers:1 fix 필연성**: T-0059 가 처음 노출시킨 cross-file race — parts.smoke + persons.smoke 가 jest 의 default parallel (cpu-count workers) 환경에서 동시 실행되면 각 spec 의 afterEach(truncateAll) 가 동일 5 테이블에 동시 TRUNCATE 발화 → 한 spec 의 test arrange (seed) 와 다른 spec 의 afterEach (truncate) 가 racing → seed 직후 truncate 로 row 사라짐 → assertion 실패. e2e 도 동일 구조 — 본 task 가 parts.e2e 추가 시점부터 e2e 측에서도 동일 race 발생 가능 (app.e2e 는 DB 미사용이라 무영향, parts.e2e ↔ persons.e2e 가 race 당사자). T-0059 smoke 측 fix (`maxWorkers: 1` 1 줄) 를 e2e 측에도 동등 적용 — `test/jest-e2e.json` 에 1 줄 추가.

본 task 의 변경은 모두 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md#decision) (mock 의 unit-only 보조 유지 + e2e = real 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (afterEach truncate) + persons.e2e (T-0054) 패턴 + T-0059 maxWorkers:1 race fix 의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

REQ 매핑:

- [REQ-028](../requirements.md) — Person ↔ Part N:1 invariant ("조직도 파트 정확히 1"). PartController 의 5 endpoint 가 본 invariant 의 controller-layer 박제 — 본 task 의 e2e 가 실 PostgreSQL 의 FK constraint (Part → Person Restrict) + name unique constraint 의 HTTP contract depth 발화 검증 + 4xx envelope shape 박제. `GET :id/persons` endpoint 가 Part-Person N:1 reverse query 의 e2e HTTP contract depth 첫 박제.
- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. Part 도메인이 실 PostgreSQL durability + Prisma adapter / pg connection 의 e2e HTTP contract depth 발화 (persons 도메인 T-0054 박제 위에 Part 도메인 확장). **본 task 머지 시점부터 REQ-029 검증 path 가 unit (mock 보조) + smoke (실 DB bootstrap) + e2e (실 DB HTTP contract depth) 3 layer 전부 박제 완성 — Part 도메인까지 확장.**
- [REQ-058](../requirements.md) — 운영 정책 underlying.

## Required Reading

- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — **본 task 의 1차 reference 패턴**. JSDoc 5 줄 박제 + describe + beforeAll(AppModule + PrismaService DI) + afterAll(app.close + prisma.$disconnect) + afterEach(truncateAll) + expectDtoFields helper + messageText helper + happy/negative/branch test 패턴 직접 mirror.
- [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) — DB 미사용 (GET / 만 + 404 fallback). 본 task 의 maxWorkers:1 후 jest serial 실행 영향만 확인 — 동작 변경 0 (변경 0 LOC 예상).
- [test/jest-e2e.json](../../test/jest-e2e.json) — `maxWorkers: 1` key 추가 대상. 기존 8 key (moduleFileExtensions / rootDir / testRegex / testPathIgnorePatterns / transform / globalSetup / testEnvironment / passWithNoTests) 보존.
- [test/jest-smoke.json](../../test/jest-smoke.json) — reference (T-0059 amendment d350bde 박제 `maxWorkers: 1` 패턴 mirror). 본 task 의 e2e 측 fix 가 동등 패턴.
- [test/helpers/jest-e2e-setup.ts](../../test/helpers/jest-e2e-setup.ts) — globalSetup helper (T-0054 박제 thin re-export). 본 task 는 변경 0 — parts.e2e-spec 가 자동으로 본 setup 의 1 회 truncate + DATABASE_URL fail-fast 혜택을 받음.
- [test/helpers/jest-smoke-setup.ts](../../test/helpers/jest-smoke-setup.ts) — re-export source. 본 task 의 e2e 가 본 helper 의 default export 를 통해 PrismaClient connect + truncate + disconnect 발화.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry. afterEach 에서 호출 — Part / Person / PersonGroupMembership 5 테이블 동시 truncate.
- [test/smoke/parts.smoke-spec.ts](../../test/smoke/parts.smoke-spec.ts) — T-0059 박제 sibling. seed 패턴 + Part-Person N:1 navigation 패턴 + P2002 / P2003 분기 cover 참조 (e2e 는 envelope shape 검증으로 depth 보강).
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — 5 endpoint (GET / GET :id / GET :id/persons / POST 201 / DELETE 204) + Controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform).
- [src/user/part.service.ts](../../src/user/part.service.ts) — 5 메서드 (create / findAll / findById / delete / findPersonsByPartId) + P2002 / P2025 / P2003 의 3 error 변환 분기.
- [src/user/dto/create-part.dto.ts](../../src/user/dto/create-part.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `name` 1 필드.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Part.name `@unique` (P2002 source) + Person.partId nullable + Part → Person cascade `Restrict` (P2003 source).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Cleanup 정책 — 본 task 변경의 정책 reference.
- [docs/tasks/T-0054-e2e-persons-real-postgres-cutover.md](T-0054-e2e-persons-real-postgres-cutover.md) — persons.e2e 선례 (acceptance 패턴 + JSDoc 박제 + 5 종 grand validation 직접 mirror).
- [docs/tasks/T-0059-smoke-parts-real-postgres.md](T-0059-smoke-parts-real-postgres.md) — smoke 측 sibling. acceptance §A/§B/§C/§D 구조 + maxWorkers:1 race fix (smoke 측 d350bde amendment) 박제 reference.

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. parts.e2e-spec 신설

- [ ] `test/e2e/parts.e2e-spec.ts` 신설. persons.e2e-spec.ts 의 describe + beforeAll + afterAll + afterEach 구조 1:1 mirror.
- [ ] 본 spec module-level JSDoc 5 줄 박제 — (1) 책임 (PartController 5 endpoint HTTP contract depth e2e + status + content-type + body shape + 4xx envelope + multi-step branch flow) (2) smoke vs unit vs e2e 책임 경계 (unit = part.controller.spec / part.service.spec / smoke = parts.smoke-spec T-0059 / e2e = 본 spec HTTP contract depth + envelope shape) (3) ADR-0004 §Decision 실 DB 전략 reference + persons.e2e (T-0054) 패턴 mirror (4) afterEach(truncateAll) 의 ADR-0004 §Cleanup 정책 박제 (5) testRegex 격리 (`.e2e-spec.ts` suffix → unit/smoke jest picking 0) + jest-e2e-setup.ts globalSetup 자동 picking + jest-e2e.json maxWorkers:1 후 serial 실행 (T-0059 cross-file race 차단의 e2e 측 박제).
- [ ] beforeAll — `Test.createTestingModule({imports: [AppModule]}).compile()` + `app.init()` + `prisma = moduleRef.get<PrismaService>(PrismaService)`. mock override 0 — 실 PrismaService 가 services.postgres 의 localhost:5432 connection 발화. (persons.e2e 패턴 직접 mirror.)
- [ ] afterAll — `await app.close(); await prisma.$disconnect();` — connection 누수 방지.
- [ ] afterEach — `await truncateAll(prisma);` — test 간 state leak 0.
- [ ] PART_DTO_FIELDS const + expectDtoFields helper + messageText helper 박제 (persons.e2e 패턴 mirror, Part DTO 의 필수 field = `id`, `name` 2 종 — Person 의 5 종 대비 축소).

### B. Happy path 5 endpoint × 각 1+ test (R-112 happy 항목)

PartController 의 5 endpoint 각 1+ happy test. arrange 단계 `await prisma.part.create({data: {name: "..."}})` 로 실 row seed → endpoint 호출 → 응답 status + content-type header + body shape (DTO field) + 실 DB state 양쪽 검증.

- [ ] **B.1 GET /api/parts** → 200 + `content-type: application/json` + `Array.isArray(body) === true` + body[0] 가 PART_DTO_FIELDS (id, name) 모두 보유 + body[0].id === seed.id + body[0].name === seed.name. `PartService.findAll()` → `PartRepository.findMany()` → `prisma.part.findMany()` 실 발화.
- [ ] **B.2 GET /api/parts/:id** → 200 + `content-type: application/json` + `Array.isArray(body) === false` + body 가 PART_DTO_FIELDS 모두 보유 + body.id === seed.id + body.name === seed.name. `PartService.findById()` → `PartRepository.findById()` → `prisma.part.findUnique()` 실 발화.
- [ ] **B.3 GET /api/parts/:id/persons** → 200 + `content-type: application/json` + `Array.isArray(body) === true` + Part 1 seed + Person 2 seed (`partId: <seed.id>`) → body 가 length 2 + 각 item 이 fullName/email/active/partId field 보유 + 각 id 가 seed Person id 와 일치. `PartService.findPersonsByPartId(id)` → `PartService.findById` (존재 검증) + `PersonRepository.findByPartId()` → `prisma.person.findMany({where:{partId,active:true}})` 실 발화. **본 endpoint 의 e2e HTTP contract depth 첫 박제 — REQ-028 invariant 의 reverse query path closure.**
- [ ] **B.4 POST /api/parts** → 201 + `content-type: application/json` + body.id 존재 + body.name === "조직도파트신규" + 실 DB 에 row 존재 재조회 (`prisma.part.findUnique({where:{id:response.body.id}})` not null + name 일치). ValidationPipe 가 `{name}` 통과 → `PartService.create()` → `PartRepository.create()` → `prisma.part.create()` 실 발화 + `@HttpCode(201)`.
- [ ] **B.5 DELETE /api/parts/:id** → 204 + body empty (`response.body === {}`) + 실 DB 에서 row 사라짐 재조회 (`prisma.part.findUnique({where:{id:seed.id}})` null). 소속 Person 0 인 Part 만 seed → `PartService.delete()` → `prisma.part.delete()` 실 발화 + `@HttpCode(204)`.

### C. 4xx error envelope 3+ test (R-112 negative 항목 — 충분 cover + envelope shape 박제)

persons.e2e 의 C 섹션 envelope shape 검증 (statusCode / error / message) 패턴 mirror. body.statusCode === 숫자 + body.error === "Not Found"/"Bad Request"/"Conflict" + body.message truthy + (해당 시) message 내 핵심 어휘 substring 검증.

- [ ] **C.1 GET /api/parts/missing → 404 envelope**. 실 DB seed 없음 → `prisma.part.findUnique` null → `PartService.findById()` NotFoundException → 404. `response.body` 가 `{statusCode: 404, error: "Not Found"}` toMatchObject + `body.message` truthy.
- [ ] **C.2 POST {} → 400 envelope + validation message**. ValidationPipe `@IsString` + `@IsNotEmpty` 위반 reject. `response.body` 가 `{statusCode: 400, error: "Bad Request"}` toMatchObject + `body.message` truthy + `messageText(body).toLowerCase()` 가 `/name/` substring 매칭 (CreatePartDto.name 필드 검증 사유). 실 DB 의 `prisma.part.count()` === 0 (validation 차단으로 create 미발화 — mock 의 `.not.toHaveBeenCalled()` 의 실 DB 등가 검증).
- [ ] **C.3 POST {name: "..", extra: ".."} → 400 envelope + whitelist message**. ValidationPipe `forbidNonWhitelisted: true` reject. `response.body` 가 `{statusCode: 400, error: "Bad Request"}` toMatchObject + `body.message` truthy + `messageText(body).toLowerCase()` 가 `/extra|property/` substring 매칭 (NestJS 10 ValidationPipe whitelist 표준 메시지). 실 DB 의 `prisma.part.count()` === 0.

### D. Branch coverage — P2002 + P2003 변환 envelope (R-112 branch 항목)

smoke (T-0059) 의 1-level status 검증 + 본 task envelope shape 검증으로 P2002 + P2003 분기 양 layer 박제 완성.

- [ ] **D.1 POST /api/parts duplicate name → 409 envelope**. arrange — `await prisma.part.create({data:{name:"중복파트"}})` 첫 row seed → 동일 name 으로 POST → 실 PostgreSQL 의 Part.name `@unique` constraint 가 P2002 발화 → `PartService.create()` ConflictException 변환 → 409. `response.body` 가 `{statusCode: 409, error: "Conflict"}` toMatchObject + `body.message` truthy.
- [ ] **D.2 DELETE /api/parts/:id assigned persons → 409 envelope**. arrange — Part 1 + Person 1 seed (`partId: <seed.id>`) → DELETE Part → 실 PostgreSQL 의 FK constraint (Part → Person `Restrict`) 가 P2003 발화 → `PartService.delete()` ConflictException 변환 → 409. `response.body` 가 `{statusCode: 409, error: "Conflict"}` toMatchObject + `body.message` truthy. **본 분기가 REQ-028 invariant (Part 정확히 1 / dangling reference 차단) 의 schema-level enforce 의 e2e HTTP contract depth + envelope shape 박제 완성 — Person.partId nullable 위에 service-layer + schema-layer + e2e envelope 의 3-단 cover.**

### E. test/jest-e2e.json maxWorkers:1 wiring (T-0059 amendment mirror)

- [ ] `test/jest-e2e.json` 에 `maxWorkers: 1` key 1 줄 추가. 값은 정수 `1` (T-0059 amendment `d350bde` 의 jest-smoke.json 박제 패턴 mirror).
- [ ] 기존 8 key (moduleFileExtensions / rootDir / testRegex / testPathIgnorePatterns / transform / globalSetup / testEnvironment / passWithNoTests) 보존 — 본 task 는 1 key 만 추가.
- [ ] **race fix 필연성 박제** — 본 task 신설 parts.e2e + 기존 persons.e2e 가 jest default parallel 환경에서 동시 실행 시 afterEach(truncateAll) cross-file race 발생 가능 (T-0059 smoke 측에서 처음 노출된 패턴의 e2e 등가). maxWorkers:1 로 직렬화하여 race 차단. app.e2e 는 DB 미사용이라 영향 0.

### F. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: §B 5 endpoint 각 1+ — 5 happy test cover.
- [ ] **Error path test**: §C 3 negative envelope test 가 ValidationPipe + NotFoundException 의 error path + 4xx envelope shape cover. PrismaService.onModuleInit `$connect` 실패 케이스는 globalSetup helper (jest-e2e-setup.ts → jest-smoke-setup.ts default) 의 DATABASE_URL fail-fast 박제 (T-0054 §E 와 동일 boundary — 별도 unit spec 미작성).
- [ ] **Branch coverage**: §D P2002 + P2003 2 분기 envelope cover. P2025 (DELETE missing id → 404 envelope) 분기는 본 task 가 추가 — 별도 negative test 또는 추가 branch 로 검토 시 §C 보강 가능 (planner 권장: §C 에 missing-id DELETE 404 envelope 1 test 추가하여 negative cover 강화, cap 안전 ~5 LOC 추가).
- [ ] **Negative cases 충분 cover**: ValidationPipe 위반 2 종 (empty body / non-whitelisted field) + missing id 404 + duplicate name 409 + assigned persons 409 = **5 negative path envelope cover** (smoke §C+§D 의 1-level status 검증 위에 e2e envelope shape 검증 추가). 단일 negative 만으로 부족 함정 회피.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 본 task 는 production code 변경 0 (test + jest config 변경만) — src/** coverage 유지.

### G. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용 — T-0059 lesson Windows CRLF 정책 follow-up 참조).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 본 task 가 smoke 측 변경 0, 기존 smoke 3 suites / 21 tests (app.smoke 2 + persons.smoke 9 + parts.smoke 10) green 보존. CI services.postgres 위에서 발화.
- [ ] `pnpm test:e2e` 통과 — 본 task 신설 parts.e2e-spec 이 jest-e2e.json testRegex `.e2e-spec.ts` 자동 picking + globalSetup → PrismaClient connect → truncateAll → disconnect → maxWorkers:1 직렬 실행 → app.e2e (2 test) + persons.e2e (11 test) + parts.e2e (~10 test = happy 5 + negative 3 + branch 2, 또는 §F 권장 missing-id DELETE 추가 시 ~11 test) 가 services.postgres 위에서 race-free 발화. 합계 e2e = **~23-24 test** (기존 13 + 본 task 신설 10-11).

### H. 박제 / 후속 task 분리

- [ ] 본 task 의 §Out of Scope 가 후속 task 책임을 명확히 carve — groups 도메인 smoke/e2e (T-0061+ 후보) + PATCH endpoint / Part mutation (별도 후속) + AuthGuard / 권한 boundary (P3 또는 P4) + phase 2 src/user spec migration (별도) + estimate model 갱신 doc (별도) + P3 → P4 전이 evaluation doc (별도) + .gitattributes CRLF ADR (T-0059 lesson follow-up) + .wslconfig vmIdleTimeout (T-0059 lesson follow-up).
- [ ] 본 task 의 §Follow-ups 에 ADR-0004 §Migration 5/5 closure 확장 박제 — persons (T-0053 smoke + T-0054 e2e) + Part (T-0059 smoke + 본 T-0060 e2e) = 두 도메인 smoke+e2e 4 PR closure. Group 도메인 smoke/e2e 후속 (T-0061+) 진척 marker.

## Out of Scope

본 task 는 parts 도메인 e2e closure + jest-e2e.json maxWorkers:1 race fix. 다음은 명시적으로 후속 task 책임:

- **groups 도메인 smoke/e2e 확장**: GroupController CRUD 4 + N:M 3 = 7 endpoint 의 smoke + e2e cover. 본 task scope 외 — 별도 후속 task (T-0061~T-0062 후보, persons + parts 패턴 mirror).
- **PartController PATCH endpoint** / **Part 의 mutation 박제**: 본 task scope 외, 별도 후속 backbone task.
- **추가 branch cover (P2025 DELETE missing 404 envelope / GET :id/persons missing Part 404 envelope)**: §F 권장으로 §C 보강 가능 — 본 task 안에서 처리 또는 별도 후속 task 결정 (implementer 자유도, cap 안전 envelope 안에서).
- **AuthGuard (Admin+ / User+)** — 후속 P3 또는 P4 책임.
- **phase 2 src/user/*.spec migration**: prisma-mock.ts phase 2 fixture variant decision 동반 follow-up. 본 task scope 외.
- **PLAN.md / p3-implementation-plan §6 progress 갱신**: T-0058~T-0060 closure 박제는 별도 doc-only direct task.
- **estimate model 갱신 doc / R-112 colocated-spec hint 강화 doc / P3 → P4 전이 evaluation doc**: 별도 doc-only direct task.
- **.gitattributes CRLF 정책 ADR / .wslconfig vmIdleTimeout follow-up**: T-0059 local-CI-proxy lesson 박제. 본 task scope 외.
- **e2e 성능 / parallelism 회복**: maxWorkers:1 의 trade-off 는 직렬 실행으로 e2e suite 시간 ↑. 후속 follow-up — schema 격리 (per-spec DATABASE_URL/schema) 또는 worker-level isolation 도입은 별도 ADR + task.
- **e2e seed factory / fixture builder 도입**: 본 task 는 inline `prisma.X.create` 패턴 (persons.e2e + parts.smoke 동일) — factory 패턴 도입은 별도 ADR 후 task.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + persons.e2e (T-0054) 패턴 + jest-e2e-setup.ts re-export + T-0059 maxWorkers:1 race fix 모두 박제 완료, 새 의사결정 0). 실 chain:

1. **implementer**: 2 파일 변경 박제.
   - (i) `test/e2e/parts.e2e-spec.ts` 신설 (~170 LOC = JSDoc 5 줄 ~30 LOC + describe block ~140 LOC = beforeAll/afterAll/afterEach 헤더 ~25 LOC + PART_DTO_FIELDS + expectDtoFields + messageText ~15 LOC + happy 5 ~60 LOC + negative 3 ~35 LOC + branch 2 ~30 LOC + 빈 줄/주석 ~5 LOC). persons.e2e 패턴 1:1 mirror — PATCH 1 종 부재 + GET :id/persons 1 종 추가 mass 균형.
   - (ii) `test/jest-e2e.json` 에 `"maxWorkers": 1` 1 줄 추가 (~1 LOC, T-0059 amendment d350bde 의 jest-smoke.json 박제 패턴 mirror).
   - 합계 추정 ~170-180 LOC delta / 2 파일.
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존 (T-0054 + T-0059 동일 패턴). 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제. test:e2e 가 services.postgres 부재 환경 (local dev DATABASE_URL 미주입) 에서 fail-fast → CI sole validator. **race-free 검증 anchor**: maxWorkers:1 박제 후 parts.e2e + persons.e2e 동시 발화 시 race fail 0 — T-0059 smoke 측 동등 시나리오의 21/21 test green 박제와 평행 cover.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) maxWorkers:1 의 trade-off (e2e suite 시간 ↑) 가 CI timeout 임계 초과 → schema 격리 ADR 신설 결정 (b) parts.e2e + persons.e2e 가 maxWorkers:1 후에도 race 잔존 (예: globalSetup 의 1 회 truncate 와 afterEach 의 다회 truncate 의 lifecycle mismatch) → globalSetup helper 책임 재결정 (c) Part DTO field shape 의 새 invariant 발견 → ADR 갱신. 셋 다 본 task plannerSource 박제 범위 안의 최소 결정 — implementer 직접 진행, architect escalation 0 예상.
