---
id: T-0060
title: parts.e2e-spec 신설 — PartController 5 endpoint HTTP contract + 4xx envelope + multi-step flow e2e
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-029, REQ-058]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-05-26
plannerNote: P3 backbone — persons.e2e (T-0054) 패턴 1:1 mirror 로 parts.e2e 신설. ADR-0004 §Decision real DB + afterEach truncate + jest-e2e-setup 재사용. T-0059 smoke 의 sibling e2e half.
dependsOn: [T-0046, T-0054, T-0059]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: |
  session #15 turn 2 — driver-supplied 후보 단일 (T-0060 = parts.e2e 단독, T-0059 sibling half) 채택. 후보 평가 + cap-safe split 정당화 + ADR-first split 4-stage trajectory 의 T-0059 → T-0060 closure 단계 박제.

  **후보 평가**: session #14 turn 6 planner queue note (loopSession 박제) 가 backbone 후보 6 종 중 (a) Part smoke/e2e 확장 채택 + cap-discipline split 결정. T-0059 (parts.smoke 단독) 가 mergeCommit 3f71c64 로 박제 완료 (session #15 turn 1, local-CI-proxy-during-outage HQ-0007 resolution). 잔여 = parts.e2e 단독 = 본 T-0060. 본 turn 의 단일 명백 후보.

  **cap-safe split 정당화**: persons 선례 (T-0053 smoke 220 LOC + T-0054 e2e 180 LOC = 통합 시 ~400 LOC) 가 cap 300 위협으로 split 됐다. parts 도메인은 동일 mass — T-0059 (parts.smoke) 가 ~293 LOC actual + 본 T-0060 (parts.e2e) ~200 LOC = 합 ~493 LOC. 단일 task 시 명백 cap 초과. 분리 가 자연.

  **ADR-first split 4-stage trajectory closure (persons 측 vs parts 측)**:
    - persons 측 — T-0051 (ADR-0004 신설) → T-0052 (CI services.postgres + helper) → T-0053 (persons.smoke real DB cutover) → T-0054 (persons.e2e real DB cutover) = 4-stage closure 박제 완료.
    - parts 측 — T-0046 (Part service+controller backbone) + T-0053/T-0054 박제 infra 재사용 → T-0059 (parts.smoke) → 본 T-0060 (parts.e2e) = parts 도메인의 smoke + e2e 양 layer closure 박제. ADR-first split 4-stage trajectory 의 마지막 단계.

  **architect 호출 0 justification**:
    1. ADR-0004 §Decision + §Cleanup 정책 박제 완료 (T-0051 mergeCommit 9109e65).
    2. test/helpers/jest-e2e-setup.ts thin re-export 패턴 박제 완료 (T-0054 mergeCommit 2d52128).
    3. test/helpers/db-truncate.ts signature 박제 완료 (T-0052 mergeCommit e0f4a9c).
    4. test/jest-e2e.json globalSetup wiring 박제 완료 (T-0054).
    5. ci.yml services.postgres 박제 완료 (T-0052).
    6. test/e2e/persons.e2e-spec.ts 패턴 박제 완료 — 1:1 mirror (T-0054).
    7. PartController 5 endpoint (GET / GET :id / GET :id/persons / POST / DELETE) + P2002/P2025/P2003 변환 박제 완료 (T-0046 + T-0059 smoke 검증).
    새 의사결정 0 — 모든 인프라 + 패턴이 박제 완료, 본 task 는 순수 spec 신설 + 패턴 mirror.

  **frontmatter 근거**:
    - commitMode=pr — test code 신설 (production code 0) 이나 CI 실행 검증 필수 (R-110 절대 규칙).
    - coversReq=[REQ-028, REQ-029, REQ-058] — REQ-028 (Part-Person N:1 invariant 의 e2e HTTP contract layer), REQ-029 (실 PostgreSQL durability path 의 e2e HTTP depth 발화), REQ-058 (운영 정책 underlying).
    - estimatedDiff=200, estimatedFiles=2 — persons.e2e (T-0054) actual 180 LOC + Part 의 GET :id/persons endpoint 추가 cover + multi-step flow 추가 = ~200 LOC. 2 파일 = spec + (optional) JSDoc 보강 0 변경 가능.
    - dependsOn=[T-0046 PartController/Service backbone, T-0054 persons.e2e + jest-e2e-setup 박제, T-0059 parts.smoke sibling] — 3 task 모두 mergeCommit 박제 완료.

  STATE.nextTask=T-0060.
---

# T-0060 — parts.e2e-spec 신설 (PartController 5 endpoint HTTP contract + 4xx envelope + multi-step flow e2e)

## Why

[T-0046](T-0046-part-service-controller-dto-backbone.md) 가 mergeCommit `2a314bc` 로 PartService + PartController + CreatePartDto + UserModule wiring 박제 (Part 1:N service+controller backbone closure). 그 위에 [T-0054](T-0054-e2e-persons-real-postgres-cutover.md) 가 mergeCommit `2d52128` 로 persons.e2e 의 real PostgreSQL cutover + `test/helpers/jest-e2e-setup.ts` thin re-export wrapper + `test/jest-e2e.json` globalSetup wiring + `afterEach(truncateAll)` 패턴 박제. 직전 [T-0059](T-0059-smoke-parts-real-postgres.md) 가 mergeCommit `3f71c64` 로 parts.smoke 절반 박제 (local-CI-proxy-during-outage HQ-0007 resolution).

**현재 상태의 gap**: parts 도메인 e2e spec 0 — `test/e2e/` 에 `app.e2e-spec.ts` + `persons.e2e-spec.ts` 2 파일만 존재. PartController 5 endpoint 의 e2e 차원 — **HTTP contract depth (status / Content-Type / body shape) + 4xx envelope (statusCode / error / message) + multi-step flow (POST → GET :id → DELETE → GET :id)** — 검증 0.

본 T-0060 은 [persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 의 패턴을 1:1 mirror 해 `test/e2e/parts.e2e-spec.ts` 1 파일을 신설한다. jest-e2e-setup.ts / db-truncate.ts / jest-e2e.json / ci.yml services.postgres 등 모든 infra 가 박제 완료 — 본 task 는 **순수 spec 파일 1 개 신설 + JSDoc 박제** 로 cap-safe.

본 task 머지 시점에 **ADR-first split 4-stage trajectory 의 parts 도메인 closure 박제 완성** — smoke (T-0059) + e2e (본 task) 양 layer cover. persons 도메인 (T-0053 + T-0054) 과 1:1 symmetry.

REQ 매핑:

- [REQ-028](../requirements.md) — Person ↔ Part N:1 invariant ("조직도 파트 정확히 1"). PartController 5 endpoint 의 e2e HTTP contract layer 박제 — multi-step flow 가 invariant 의 sequence 검증 (POST Part → POST Person with partId → GET :id/persons N:1 navigation → DELETE Part with assigned Person 409 → DELETE Person → DELETE Part 204).
- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. Part 도메인 e2e HTTP depth 발화 (T-0054 persons 박제 위 Part 확장 — REQ-029 정합 검증 path 가 unit + smoke + e2e 3 layer 의 양 도메인 (persons + parts) 박제 완성).
- [REQ-058](../requirements.md) — 운영 정책 underlying.

본 task 는 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md) (mock 의 unit-only 보조 유지 + e2e = real 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (afterEach truncate) 의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

## Required Reading

- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — **본 task 의 1차 reference 패턴**. JSDoc 5 줄 + describe + beforeAll(AppModule + PrismaService DI) + afterAll(app.close + prisma.$disconnect) + afterEach(truncateAll) + happy/contract/4xx envelope/multi-step flow test 패턴 직접 mirror.
- [test/smoke/parts.smoke-spec.ts](../../test/smoke/parts.smoke-spec.ts) — 직전 sibling (T-0059 결과물). smoke 측이 박제한 PartController 5 endpoint × happy 5 + negative 3 + branch 2 = 10 test 패턴 reference. 본 task 는 e2e 차원의 contract depth + envelope shape + multi-step flow 추가 cover (smoke 와의 boundary 명확화).
- [test/helpers/jest-e2e-setup.ts](../../test/helpers/jest-e2e-setup.ts) — globalSetup helper (jest-smoke-setup default re-export). 본 task 는 변경 0 — parts.e2e-spec 가 자동으로 본 setup 의 1 회 truncate 혜택을 받음.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry. `afterEach` 에서 호출 — Part / Person / PersonGroupMembership 5 테이블 동시 truncate.
- [test/jest-e2e.json](../../test/jest-e2e.json) — `testRegex: ".*\\.e2e-spec\\.ts$"` 가 본 task 신설 spec 을 자동 picking. wiring 변경 0.
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — 5 endpoint (GET / GET :id / GET :id/persons / POST 201 / DELETE 204) + Controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform).
- [src/user/part.service.ts](../../src/user/part.service.ts) — 5 메서드 (create / findAll / findById / delete / findPersonsByPartId) + P2002 / P2025 / P2003 의 3 error 변환 분기.
- [src/user/dto/create-part.dto.ts](../../src/user/dto/create-part.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `name` 1 필드.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Part.name `@unique` (P2002 source) + Person.partId nullable + Part → Person cascade `Restrict` (P2003 source).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Cleanup 정책 — 본 task 변경의 정책 reference.
- [docs/tasks/T-0054-e2e-persons-real-postgres-cutover.md](T-0054-e2e-persons-real-postgres-cutover.md) — persons 측 e2e 선례. JSDoc 5 줄 박제 + R-112 4 종 cover + 5 종 grand validation 의 acceptance 직접 mirror.
- [docs/tasks/T-0059-smoke-parts-real-postgres.md](T-0059-smoke-parts-real-postgres.md) — 직전 sibling smoke half. §Out of Scope §G §Follow-ups 가 본 task 책임 carve.

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. parts.e2e-spec 신설

- [ ] `test/e2e/parts.e2e-spec.ts` 신설. persons.e2e-spec.ts 의 describe + beforeAll + afterAll + afterEach 구조 1:1 mirror.
- [ ] 본 spec module-level JSDoc 5 줄 박제:
  1. "parts.e2e-spec.ts — PartController 5 endpoint 의 e2e HTTP contract + 4xx envelope + multi-step flow 검증 (T-0060)."
  2. "smoke vs unit vs e2e 경계: unit = part.controller.spec / part.service.spec (mock 보조) — DI wiring / 의존 호출 검증 / smoke = parts.smoke-spec (T-0059) — bootstrap + real PostgreSQL connection + 기본 endpoint 발화 / e2e = 본 spec — HTTP contract depth (status + Content-Type + body shape 정확 검증) + 4xx envelope shape (statusCode + error + message) + multi-step flow (POST + GET :id + DELETE + GET :id 의 step sequence)."
  3. "ADR-0004 §Decision reference: e2e = real PostgreSQL 고정 (mock override 0). PartController 의 P2002 / P2025 / P2003 변환 분기가 실 DB unique + record-not-found + FK constraint 발화로 HTTP contract envelope shape 검증."
  4. "afterEach(truncateAll) — ADR-0004 §Cleanup 정책 박제 (test 간 state leak 0, 5 테이블 동시 truncate). globalSetup (jest-e2e-setup.ts) 의 1 회 truncate 와 합쳐 2-단 격리."
  5. "testRegex 격리: `.e2e-spec.ts` suffix → jest unit testRegex (`.*\\.spec\\.ts$`) 의 NEGATIVE lookahead 매칭 0 → unit jest 가 본 spec 픽업 0 (test/jest-e2e.json 만 picking)."
- [ ] beforeAll — `Test.createTestingModule({imports: [AppModule]}).compile()` + `app.init()` + `prisma = moduleRef.get<PrismaService>(PrismaService)`. mock override 0 — 실 PrismaService 가 services.postgres 의 localhost:5432 connection 발화.
- [ ] afterAll — `await app.close(); await prisma.$disconnect();` — connection 누수 방지.
- [ ] afterEach — `await truncateAll(prisma);` — test 간 state leak 0.

### B. Happy path 5 endpoint × 각 1+ test (R-112 happy 항목 + e2e contract depth)

PartController 의 5 endpoint 각 1+ happy test. arrange 단계 `await prisma.part.create({data: {name: "..."}})` 로 실 row seed → endpoint 호출 → 응답 status / Content-Type / body shape 정확 검증 (e2e 의 contract depth — smoke 와 차별).

- [ ] **GET /api/parts** → status 200 + `Content-Type: application/json` 검증 + body array shape 검증 (`Array.isArray(body)` + `body[0]` keys: id, name, createdAt, updatedAt) + body[0].id === seed.id + body[0].name === "조직도파트A".
- [ ] **GET /api/parts/:id** → status 200 + `Content-Type: application/json` + body object shape (id / name / createdAt / updatedAt 4 key 정확 매칭, 추가 key 0) + body.id === seed.id + body.name === seed.name.
- [ ] **GET /api/parts/:id/persons** → status 200 + body array shape + Part 1 seed + Person 2 seed (`partId: <seed.id>`) → 응답 body 가 2 개 Person 박제, 각 id 검증 (Set 비교) + 각 Person object shape (id / name / email / partId / active / createdAt / updatedAt 7 key) 검증.
- [ ] **POST /api/parts** → status 201 + `Content-Type: application/json` + body object shape (id / name / createdAt / updatedAt 4 key) + body.name === "조직도파트신규" + body.id is non-empty string + 실 DB 의 `prisma.part.findUnique({where:{id:body.id}})` not null 검증.
- [ ] **DELETE /api/parts/:id** → status 204 + body empty (length 0) + 실 DB 의 `prisma.part.findUnique({where:{id:seed.id}})` null 검증.

### C. 4xx envelope shape 검증 (R-112 negative 항목 + e2e envelope depth)

NestJS HttpException 의 자동 envelope (`{statusCode, error, message}`) shape 정확 검증 — smoke 와 차별 (smoke 는 status code 만 검증).

- [ ] **GET /api/parts/missing → 404** envelope 검증: body.statusCode === 404 + body.error === "Not Found" + body.message 가 한국어 메시지 포함 (예: "Part" + "찾을 수 없" 또는 service-throws 텍스트 매칭).
- [ ] **POST /api/parts with empty body → 400** envelope 검증: body.statusCode === 400 + body.error === "Bad Request" + body.message array (ValidationPipe 의 string[]) + isString / isNotEmpty 위반 메시지 포함.
- [ ] **POST /api/parts with duplicate name → 409** envelope 검증: arrange 첫 row seed 후 동일 name POST → body.statusCode === 409 + body.error === "Conflict" + body.message 가 P2002 변환 메시지 (ConflictException) 포함. 실 PostgreSQL Part.name `@unique` constraint 발화 검증.

### D. Multi-step flow (e2e 만의 cover — smoke 와 차별)

- [ ] **flow 1: lifecycle full sequence** — `POST /api/parts {name: "라이프사이클파트"}` → 201 + new id 추출 → `GET /api/parts/:newId` → 200 + body 정합 → `DELETE /api/parts/:newId` → 204 → `GET /api/parts/:newId` → 404 envelope. **본 flow 가 multi-step state transition 의 e2e cover** — smoke 의 endpoint isolate 호출 대비 sequence 검증.
- [ ] **flow 2: N:1 navigation + cascade restrict** — `POST /api/parts {name: "Foo파트"}` → 201 + partId 추출 → `prisma.person.create({data: {name, email, partId}})` seed → `GET /api/parts/:partId/persons` → 200 + body[0].id === person.id (N:1 navigation 검증) → `DELETE /api/parts/:partId` → 409 envelope (P2003 cascade restrict 발화) → `prisma.person.delete({where:{id:person.id}})` → `DELETE /api/parts/:partId` → 204. **본 flow 가 REQ-028 invariant 의 e2e cover** — Part-Person N:1 관계의 schema-level enforce + service-layer 변환 + HTTP envelope 의 3-단 cover.

### E. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: §B 5 endpoint 각 1+ — 5 happy test cover.
- [ ] **Error path test**: §C 3 envelope test 가 NotFoundException + ValidationPipe + ConflictException 의 error path cover. PrismaService.onModuleInit 의 `$connect` 실패 케이스는 globalSetup helper 의 fail-fast 박제 (T-0054 §E 와 동일 boundary — globalSetup 의 error path 는 CI infra 의 자연 검증, 별도 unit spec 미작성).
- [ ] **Branch coverage**: §C 의 P2002 (duplicate name 409) 분기 + §D flow 2 의 P2003 (assigned persons 409) 분기 cover. P2025 (DELETE missing → 404) 분기는 §C 의 GET missing 404 가 NotFoundException 의 envelope 검증으로 cover (DELETE 측은 unit / smoke 책임 boundary 유지 — e2e 는 flow + envelope 에 focus).
- [ ] **Negative cases 충분 cover**: §C 3 envelope (404 / 400 / 409) + §D flow 1 의 sequence 끝 404 envelope + §D flow 2 의 mid 409 envelope = 5 negative path × envelope shape cover. 단일 negative 만으로 부족 함정 회피.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 본 task 는 production code 변경 0 (test 신설만) — src/** coverage 유지.

### F. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 본 task 는 smoke 측 변경 0, T-0059 박제 21 test green 보존.
- [ ] `pnpm test:e2e` 통과 — 본 task 신설 spec 이 jest-e2e.json testRegex 의 자동 picking 으로 실행, globalSetup → PrismaClient connect → truncateAll → disconnect → parts.e2e-spec 의 ~13 test (happy 5 + envelope 3 + flow 2 multi-step ~5 sub-assertion blocks) 가 services.postgres 위에서 발화. 합계 e2e = app.e2e 2 + persons.e2e 11 + parts.e2e ~10 = **~23 test**.

### G. 박제 / ADR-first split 4-stage closure marker

- [ ] 본 task 의 §Out of Scope 가 groups 도메인 smoke/e2e 확장 (T-0061 후보) 을 명확히 carve.
- [ ] 본 task 의 §Follow-ups 에 ADR-first split 4-stage trajectory 의 parts 도메인 closure 박제 (T-0046 backbone + T-0053/T-0054 infra reuse + T-0059 smoke + 본 task e2e) + p3-implementation-plan §6 progress 갱신 follow-up (별도 doc-only direct task) 박제.
- [ ] 본 task 가 머지되면 **persons (T-0053+T-0054) + parts (T-0059+T-0060) 양 도메인의 smoke + e2e 양 layer cover 가 동시 박제 완성** — REQ-028 + REQ-029 정합 검증 path 가 unit + smoke + e2e 3 layer × 2 도메인 = 6 layer 박제. groups 도메인이 남은 진척 영역.

## Out of Scope

본 task 는 **parts 도메인의 e2e 절반만** 박제. 다음은 명시적으로 후속 task 책임:

- **groups 도메인 e2e 확장**: GroupController CRUD 4 + N:M 3 = 7 endpoint 의 e2e cover. 본 task scope 외 — 별도 후속 task (T-0061 후보).
- **PartController PATCH endpoint**: 현 PartController 는 GET / GET :id / GET :id/persons / POST / DELETE 5 endpoint 만 박제 (PATCH 미존재). PATCH endpoint 신설 task 는 P3 후속 또는 P4 책임 — 본 task 는 기존 5 endpoint cover 만.
- **AuthGuard (Admin+ / User+) 적용**: AuthGuard 박제 0 (P3 / P4 후속) — 본 task scope 외, e2e 는 무인증 모드 검증.
- **phase 2 src/user/*.spec migration**: prisma-mock.ts phase 2 fixture variant decision 동반 follow-up. 본 task scope 외.
- **jest-e2e config / jest-e2e-setup.ts / ci.yml 변경 0**: T-0054 박제 완료. 본 task 는 spec 신설만.
- **PLAN.md / p3-implementation-plan §6 progress 갱신**: T-0058 ~ T-0060 closure 박제는 별도 doc-only direct task.
- **추가 happy/negative test 확장**: 본 task 는 5 happy + 3 envelope + 2 multi-step flow = ~10 test 박제 (smoke 와의 boundary 유지). 추가 cover (예: PATCH endpoint negative, 새 invariant 발견 시 검증) 는 후속 task 책임.
- **e2e 성능 / parallelism 최적화**: jest config 의 maxWorkers / testTimeout 튜닝은 본 task scope 외 — 본 task 는 신설만, 성능은 별도 follow-up.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + jest-e2e-setup.ts + db-truncate.ts + persons.e2e + parts.smoke 패턴 모두 박제 완료, 새 의사결정 0). 실 chain:

1. **implementer**: 1 파일 신설. `test/e2e/parts.e2e-spec.ts` (~200 LOC = JSDoc 5 줄 ~30 LOC + describe block ~170 LOC = beforeAll/afterAll/afterEach 헤더 ~30 LOC + happy 5 ~50 LOC (contract depth assertions 포함) + envelope 3 ~40 LOC + multi-step flow 2 ~50 LOC).
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존. 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제. test:e2e 가 services.postgres 부재 환경 (local dev DATABASE_URL 미주입) 에서 fail-fast → CI sole validator.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) PartController endpoint 의 새 분기 발견 → ADR 갱신 (b) jest-e2e-setup.ts 의 책임 분기 재결정 (예: e2e 전용 seed 도입) (c) Part-Person N:1 navigation 의 새 invariant 발견. 셋 다 본 task 의 frontmatter `plannerSource` 박제 범위 안에서 결정 완료 — implementer 직접 진행, architect escalation 0 예상.
