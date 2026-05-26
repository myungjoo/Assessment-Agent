---
id: T-0046
title: PartService + PartController + Part DTO backbone + module wiring (R-112 4종 + coverage)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 240
estimatedFiles: 5
created: 2026-05-26
plannerNote: T-0040 / T-0041 §Follow-ups 박제 — Part backbone service layer 진입. PartRepository (T-0039) + PersonRepository.findByPartId (T-0041) 위에서 service+controller+DTO, GroupService 보다 단순 (N:M 없음) cap 보존 안전.
dependsOn: [T-0039, T-0041]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/tasks/T-0041-person-repository-find-by-part-and-group.md §Follow-ups L133 ("GroupService + PartService + Controller + DTO + class-validator decorator backbone") + docs/architecture/p3-implementation-plan.md §6 (module 2/5 → PartService backbone 진입으로 UserModule scope 확장, 새 module 신설 0). Part 가 Group 보다 단순 (N:M membership 없음 — Person.partId 직접 FK) 으로 cap 보존 안전, GroupService 보다 우선 진입 결정 — PartService 머지 후 GroupService 가 별도 후속 task.
---

# T-0046 — PartService + PartController + Part DTO backbone

## Why

[T-0039](T-0039-group-part-entity-and-repository.md) 가 Part entity + PartRepository 4 메서드 (create / findById / findMany / delete) 를 박제했고, [T-0041](T-0041-person-repository-find-by-part-and-group.md) 이 PersonRepository.findByPartId 를 추가해 **"이 Part 에 소속된 Person list"** query primitive 를 확보했다. 다음 backbone 인 PartService + PartController + DTO 가 진입할 prerequisite 가 모두 충족.

본 task 는 Part entity 의 **service / HTTP layer** 를 박제한다 — [REQ-028](../requirements.md) "조직도 파트 정확히 1" invariant 의 service-layer enforce + `/api/parts` REST endpoint 5 종 (POST / GET list / GET by id / DELETE / GET members) 노출. Group 보다 우선 진입 사유:

1. **Part 의 데이터 모델이 단순** — Person.partId 직접 FK (1:N), N:M membership entity 0. service 가 PartRepository.create / findMany / findById / delete + PersonRepository.findByPartId 5 호출만 wrapping.
2. **cap 보존 안전** — Group 의 GroupService 는 PersonGroupMembership join entity 의 add/remove mutation 도 책임 → ~280 LOC / cap tight. PartService 는 ~240 LOC / 5 파일 cap 보존.
3. **GroupService prerequisite** — Group 안에 Part 참조가 들어가는 후속 backbone (예: Group 의 default Part 정책) 진입 시 PartService 의 API 가 source. 의존성 graph 상 PartService → GroupService 의 자연 순서.

본 task 는 [T-0036](T-0036-person-service-controller-dto.md) 의 PersonService + PersonController + DTO 패턴을 직접 reuse — class-validator + class-transformer (HQ-0005 결정으로 이미 도입) + ValidationPipe + Nest standard exception (NotFoundException / ConflictException) + repository forwarding + service-layer invariant.

## Required Reading

- [src/user/part.repository.ts](../../src/user/part.repository.ts) — 본 task 의 service 가 wrapping 할 단일 source. 4 메서드 (create / findById / findMany / delete) + Prisma error 정책 (P2002 / P2025 / P2003) + JSDoc 패턴.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) `findByPartId` (L?? — T-0041 박제) — `GET /api/parts/:id/persons` 의 service-layer 호출 source.
- [src/user/person.service.ts](../../src/user/person.service.ts) — 본 task 의 service 패턴 reference. PersonService 의 create / findById (NotFound 강제) / update (P2002 → Conflict 변환) / softDelete (P2025 → NotFound) 변환 패턴 + class 시그니처 + DI + JSDoc voice.
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — 본 task 의 controller 패턴 reference. `@Controller("api/persons")` + `@Post() / @Get() / @Get(":id") / @Patch(":id") / @Delete(":id")` + ValidationPipe + HttpCode 정책.
- [src/user/dto/create-person.dto.ts](../../src/user/dto/create-person.dto.ts) + [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — 본 task 의 DTO 패턴. `@IsString()` / `@IsNotEmpty()` / `@IsOptional()` decorator + whitelist (forbidNonWhitelisted) 정책.
- [src/user/user.module.ts](../../src/user/user.module.ts) — controllers + providers + exports 갱신 대상. PartController + PartService 추가, 기존 PartRepository wiring 은 unchanged.
- [src/user/person.service.spec.ts](../../src/user/person.service.spec.ts) — 본 task 의 spec 패턴 reference (mock repository + happy / error / branch / negative test row 구조 + buildPrismaError helper).
- [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) — controller spec 패턴 reference (mock service + HTTP response mapping 검증).
- [docs/requirements.md](../requirements.md) REQ-028 — "Group 정책 (다중 임의 group + 단일 조직도 파트)" — 본 task service layer 의 invariant source.
- [docs/architecture/api.md](../architecture/api.md) — `/api/parts` endpoint 행 (이미 박제됨, T-0030). 본 task 는 그 contract 를 controller 시그니처로 구현. 변경 0 (api.md 갱신 follow-up 별도).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr) / §3.2 R-110 ~ R-114 (happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80%) / §3.3 (4-게이트) / §11 (trail blob) / §12 (한국어).
- [docs/tasks/T-0036-person-service-controller-dto.md](T-0036-person-service-controller-dto.md) — 본 task 의 직접 패턴 source (PersonService backbone).
- [docs/tasks/T-0041-person-repository-find-by-part-and-group.md](T-0041-person-repository-find-by-part-and-group.md) §Follow-ups L133 — 본 task 의 박제 source.
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §6 — module 2/5 closure progress 박제, 본 task 머지 후 §2 표에 row 추가 (별도 doc-only follow-up).

## Acceptance Criteria

본 task 는 **pr-mode code task** — feature branch `claude/T-0046-part-service-controller-dto-backbone` → PR open → reviewer round 1 → integrator 4-게이트 → squash merge. [CLAUDE.md §3.2 R-110 ~ R-114](../../CLAUDE.md) 의 모든 test / CI 절대 규칙 적용.

**Schema / migration / dependency**:

- [ ] `prisma/schema.prisma` 변경 0 — 본 task 는 schema 변경 없음. 기존 Part / Person.partId 컬럼만 활용.
- [ ] 신규 migration 생성 0 — `prisma/migrations/` 추가 안 함.
- [ ] 새 외부 dependency 0 — class-validator + class-transformer + @nestjs/common 의 NotFoundException / ConflictException / ValidationPipe 모두 기존 도입 (T-0033 + T-0036). `pnpm add` 실행 안 함.

**PartService implementation** (`src/user/part.service.ts` 신규 파일):

- [ ] `@Injectable()` class `PartService` constructor 에 PartRepository + PersonRepository (findByPartId 호출 source) 2 dependency 주입.
- [ ] `create(dto: CreatePartDto): Promise<Part>` — PartRepository.create forwarding + Prisma `P2002` (name 중복) → NestJS `ConflictException("part name already in use: <name>")` 변환.
- [ ] `findAll(): Promise<Part[]>` — PartRepository.findMany forwarding. 정렬 정책은 후속 task 책임 (본 layer 는 raw forward).
- [ ] `findById(id: string): Promise<Part>` — PartRepository.findById 가 null 반환 시 NestJS `NotFoundException("part not found: <id>")` 강제. PersonService.findById 의 패턴 직접 reuse.
- [ ] `delete(id: string): Promise<void>` — PartRepository.delete forwarding + 두 Prisma error 분기 변환:
  - `P2025` (row 부재) → `NotFoundException("part not found: <id>")`.
  - `P2003` (FK 위반 — Part 소속 Person 1+) → `ConflictException("part has assigned persons: <id>")` — REQ-028 invariant 의 service-layer 에코.
- [ ] `findPersonsByPartId(partId: string): Promise<Person[]>` — Part 존재 검증 (`findById` 재호출, NotFound 강제) 후 PersonRepository.findByPartId(partId) forwarding. activeOnly default true (PersonService.findAll 의 패턴 동일).
- [ ] JSDoc 주석 voice 한국어 (§12) — 책임 경계 / Prisma error 변환 정책 / REQ-028 참조 / 후속 task scope 외 항목 명시 (예: name validation 의 regex 정책은 DTO layer).

**PartController implementation** (`src/user/part.controller.ts` 신규 파일):

- [ ] `@Controller("api/parts")` + `@Injectable()` class `PartController` constructor 에 PartService 주입.
- [ ] `@Post()` `create(@Body() dto: CreatePartDto): Promise<Part>` — PartService.create forwarding + 201 Created (NestJS default).
- [ ] `@Get()` `findAll(): Promise<Part[]>` — PartService.findAll forwarding + 200 OK.
- [ ] `@Get(":id")` `findById(@Param("id") id: string): Promise<Part>` — PartService.findById forwarding + 200 OK / 404 (NotFoundException).
- [ ] `@Get(":id/persons")` `findPersons(@Param("id") id: string): Promise<Person[]>` — PartService.findPersonsByPartId forwarding + 200 OK / 404.
- [ ] `@Delete(":id")` + `@HttpCode(204)` `delete(@Param("id") id: string): Promise<void>` — PartService.delete forwarding + 204 No Content / 404 (P2025) / 409 (P2003).
- [ ] DTO 검증: `@Body()` 가 `ValidationPipe` (전역 박제, T-0036) 를 통과 — `@IsString()` / `@IsNotEmpty()` / whitelist forbidNonWhitelisted 자동 적용. POST body 의 unknown field → 400.
- [ ] Update endpoint (PATCH) 신설 0 — Part 의 mutation 은 본 task scope 에서 CRUD 의 C/R/D 만 (Part 의 update 는 후속 task 책임, MVA cap 보존).

**Part DTO** (`src/user/dto/create-part.dto.ts` 신규 파일):

- [ ] `CreatePartDto` class — `name: string` 필드 + `@IsString()` + `@IsNotEmpty()` decorator. trim / regex 정책은 후속 task 책임.
- [ ] UpdatePartDto 신설 0 — controller 가 PATCH endpoint 노출 안 함 (위 §controller).

**Module wiring** (`src/user/user.module.ts` 갱신):

- [ ] `controllers: [PersonController, PartController]` 으로 PartController 추가.
- [ ] `providers: [..., PartService]` 으로 PartService 추가 (PartRepository 는 이미 등록).
- [ ] `exports: [..., PartService]` 으로 PartService 추가 — 다른 module (후속 AssessmentModule / GroupService) 가 inject 가능하도록.
- [ ] 기존 6 항목 (PersonRepository / ServiceIdentityRepository / GroupRepository / PartRepository / PersonService / PersonController) 변경 0 — 본 task 는 추가만.

**PartService spec** (`src/user/part.service.spec.ts` 신규 파일):

- [ ] 추가/수정된 모든 public symbol (create / findAll / findById / delete / findPersonsByPartId) 에 대한 **happy-path test 1+ 작성** — 정상 입력 + 정상 반환 검증.
- [ ] 각 symbol 의 **error path test 1+ 작성**:
  - create — `P2002` mock throw 시 ConflictException 변환 + message regex 검증.
  - findById — null 반환 시 NotFoundException 변환.
  - delete — `P2025` mock throw 시 NotFoundException / `P2003` mock throw 시 ConflictException 각각 검증.
  - findPersonsByPartId — Part 부재 시 NotFoundException (findById fail) propagate / PersonRepository.findByPartId throw 시 propagate.
- [ ] **branch test 1+ 작성** — delete 의 두 Prisma error 분기 (P2025 vs P2003) 각각 cover.
- [ ] **negative cases 충분 cover** (R-112 negative 분기마다):
  - create 의 name="" / undefined / 매우 긴 string — DTO layer 의 책임이나 service unit-test 에서 invalid name 통과 시도 시 PartRepository.create mock 으로 그대로 forward (validation 책임 분리 검증).
  - findById 의 id="" / undefined / non-existent id — null 분기 + NotFoundException.
  - delete 의 id 부재 / FK 위반 / 정상 (3 분기).
  - findPersonsByPartId 의 Part 없는 partId / Part 있으나 Person 0 행 / Part 있고 Person 다수.
- [ ] 각 test 의 mock 호출 인자 (call shape contract) 검증 — `expect(partRepoMock.create).toHaveBeenCalledWith({ name: "..." })`.
- [ ] `buildPrismaError` helper reuse (PersonService spec 의 동일 helper, 또는 inline 재정의) — `P2002 / P2025 / P2003` 3 error code 분기 cover.

**PartController spec** (`src/user/part.controller.spec.ts` 신규 파일):

- [ ] 각 endpoint (create / findAll / findById / findPersons / delete) 에 대한 **happy-path test 1+ 작성** — PartService mock return 값을 controller 가 그대로 반환 검증.
- [ ] 각 endpoint 의 **error path test 1+** — PartService mock throw 시 controller 가 catch 없이 propagate (NestJS exception filter 가 처리).
- [ ] **branch test** — delete 의 두 분기 (P2025 → NotFound / P2003 → Conflict) 가 service-layer 책임이므로 controller-layer 에서는 propagate only, 분기 자체는 service spec 에서 cover (controller spec 은 forwarding 만 검증).
- [ ] **negative cases** — `@Param("id")` 가 empty / 매우 긴 string / non-existent id 시 service mock throw → propagate 검증.

**Test / lint / build / CI** (5종 grand gate):

- [ ] `pnpm lint` 통과 (eslint + prettier — env CRLF skip 정책 적용).
- [ ] `pnpm build` 통과 (TypeScript compile + NestJS 의존성 graph 검증 — UserModule 안 새 wiring 정합).
- [ ] `pnpm test` 통과 — 신규 test (PartService spec + PartController spec) + 기존 172+ test 모두 pass.
- [ ] `pnpm test:cov` 통과 — coverage threshold (line ≥ 80% AND function ≥ 80%) global + part.service.ts / part.controller.ts 두 신규 파일 line/function 100% 목표.
- [ ] `pnpm test:smoke` 통과 — 기존 11 smoke test unchanged (PartController smoke 확장은 별도 follow-up).
- [ ] `pnpm test:e2e` 통과 — 기존 13 e2e test unchanged (PartController e2e 확장은 별도 follow-up).
- [ ] CI workflow (GitHub Actions) green — push 후 `gh run list --limit 1` conclusion=success. reviewer-gate race 가 fail 발생 시 rerun.

**PR / reviewer / integrator** (4-게이트):

- [ ] feature branch `claude/T-0046-part-service-controller-dto-backbone` 으로 작업.
- [ ] PR title / body 한국어 (§12). body 에 task 파일 링크 + 본 Acceptance Criteria 체크리스트 포함.
- [ ] reviewer round 1 APPROVE + `gh pr comment` 외부 post (4-게이트 #2).
- [ ] integrator 4-게이트 (APPROVE / comment 외부 / self-check 6항목 / CI green) 모두 true 시 `gh pr merge --squash --delete-branch`.

**Commit / trail** (§11):

- [ ] commit subject ≤ 70 char, type=feat scope=user — `feat(user): PartService + PartController + Part DTO + module wiring (T-0046)`.
- [ ] commit body 의 agent-trail blob 에 ARCHITECT (skip 가능 — 패턴 reuse) / IMPLEMENTER (files / loc / notes) / TESTER (added / result / coverage) / INTEGRATOR (pr / round / ci) / ACCEPTANCE 섹션 포함.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupService + GroupController + Group DTO backbone** — Part 와 대칭의 Group 책임. 별도 backbone task (T-0047 후보). 본 task 머지 후 진입 — Group 은 N:M (PersonGroupMembership) 으로 더 복잡, ~280 LOC / cap tight.
- **Part 의 update (PATCH) endpoint** — Part 의 mutation 은 본 task 의 CRUD 중 C/R/D 만 책임. PATCH 는 후속 task (별도 ~50 LOC follow-up) — service.update + controller.patch + UpdatePartDto + spec 분기 추가.
- **Person.partId NOT NULL 전환 + default Part seed migration** — T-0039 §Follow-ups 의 별도 schema task. 본 task 는 service-layer invariant 만 추가, schema 변경 0.
- **PartController smoke + e2e 확장** — T-0043 / T-0044 의 person smoke / e2e 패턴 reuse. 본 task 머지 후 별도 test-quality task (~150 LOC 각각).
- **api.md endpoint 행 갱신** — `/api/parts` endpoint 행은 이미 T-0030 시점에 박제. 본 task 는 contract 구현만, api.md 변경 0. mismatch 발견 시 별도 doc-only follow-up.
- **p3-implementation-plan.md §2 표 row 추가** — 본 task 의 row (T-0046) 박제는 별도 doc-only direct follow-up (T-0045 패턴 재실행).
- **data-model.md 갱신** — T-0040 이 이미 Group/Part/PersonGroupMembership row 박제 완료. 본 task 는 data-model.md 변경 0.
- **PartService 의 invariant 검증 확장** — 예: Part name regex (한글/영문/숫자 만) / 길이 상한 / case-insensitive 중복 검증. 본 task 는 schema `@unique` 의 raw propagate 만 (P2002 → Conflict). 정교한 validation 은 후속 task.
- **REQ-028 의 "임의 group 다중 소속" 부분 cover** — Group 책임 (별도 GroupService task). 본 task 는 "정확히 1 Part" 부분만.
- **AssessmentModule / AuthModule / LlmModule 의 PartService 호출** — 후속 phase 책임. 본 task 는 UserModule 안 self-contained.
- **PersonService 에 partId 의 mandatory invariant 추가** — Person 생성 시 partId 필수 강제. T-0039 §Follow-ups 의 별도 task 책임. 본 task 는 Part service-layer 만, Person 변경 0.
- **PartRepository.update 추가** — Part 의 name 변경 같은 mutation. 본 task scope 외. Repository 차원 추가는 별도 (T-0041 패턴) follow-up.
- **PartService.findByName(name)** 같은 추가 query — 본 task 는 5 메서드 (create / findAll / findById / delete / findPersonsByPartId) 만.

## Suggested Sub-agents

`architect → implementer → tester` (pr-mode 표준 chain).

- **architect**: 결정 박제 사항이 거의 없음 — T-0036 (PersonService) 의 패턴을 직접 reuse + PartRepository (T-0039) wrapping. 옵션 결정 1 건: `findPersonsByPartId` 에서 Part 존재 검증을 (a) findById 재호출 후 NotFound (b) PersonRepository.findByPartId 의 빈 배열 = Part 없음 가정 (불완전 — 실 Part 없음과 Person 0 행 구별 불가) 중 (a) 선택 권장 + 1 줄 JSDoc 박제. ADR 신설 불요. architect 호출 자체 옵션 (간단하면 implementer 가 직접 결정).
- **implementer**: part.service.ts + part.controller.ts + dto/create-part.dto.ts + user.module.ts 갱신 + 2 spec 의 file edit. PersonService / PersonController 패턴 직접 reuse. cap ≤300 / 5 파일 보존 검산.
- **tester**: 5종 grand validation (`pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`) + coverage line/function ≥ 80% 검증 + global threshold 통과.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **GroupService + GroupController + Group DTO backbone** — Part 와 대칭, N:M membership add/remove 책임. 별도 backbone task (~280 LOC / cap tight).
- [ ] **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse. 별도 test-quality task 2 종.
- [ ] **Part 의 update (PATCH) endpoint** — service.update + controller.patch + UpdatePartDto + spec 추가. 별도 follow-up.
- [ ] **Person.partId NOT NULL 전환 + default Part seed migration** — T-0039 §Follow-ups 의 별도 schema task.
- [ ] **p3-implementation-plan.md §2 표 T-0045 ~ T-0046 row 추가** — T-0045 가 §2 정합성 회복했으나 T-0046 진입 후 row 박제 doc-only direct follow-up.
- [ ] **PersonService 에 partId mandatory invariant** — Person create / update 시 partId 검증 (PartService.findById 호출로 존재 강제). 별도 follow-up.
- [ ] **shared test helper 추출 모듈** — buildMockPrismaService / buildPersonFixture / buildPrismaError 가 T-0043 + T-0044 + 본 T-0046 에서 3 회 누적 — 4 회 이상 시 추출 (`test/helpers/*.ts`) 검토. 아직 추출 임계 미달, 본 task 도 inline 재사용 유지.
