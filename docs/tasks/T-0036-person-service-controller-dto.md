---
id: T-0036
title: P3 — PersonService + PersonController + DTO (class-validator stack 도입)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-045]
estimatedDiff: 280
estimatedFiles: 5
created: 2026-05-25
plannerNote: P3 넷째 task. p3-implementation-plan.md §2 row 4 (T-0036 의 service+controller+DTO 슬라이스). HQ-0005 resolved=standard-class-validator-stack — `pnpm add class-validator class-transformer` 후 PersonService/Controller/DTO + UserModule wire + @UsePipes controller-scope ValidationPipe. main.ts global wire + 전용 e2e 는 T-0036.5 로 split.
dependsOn: [T-0034, T-0035]
blocks: [T-0037]
hqOrigin: HQ-0005
humanApprovalGate: false
---

# T-0036 — P3 넷째 task: PersonService + PersonController + DTO + class-validator stack 도입

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 단락 (L51 — "평가 대상 인원 관리 (CRUD, group, deactivate/activate)") + [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 row 4 (T-0036 의 Person CRUD service/controller 슬라이스) + [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) §5 main flow. 직전 T-0034 ([087b322](https://github.com/myungjoo/Assessment-Agent/commit/087b322)) + T-0035 ([f14a84f](https://github.com/myungjoo/Assessment-Agent/commit/f14a84f)) 머지로 Person + ServiceIdentity Prisma model + PersonRepository (6 CRUD primitive) + ServiceIdentityRepository (4 CRUD primitive) + UserModule skeleton + 두 migration 이 박제됨. 본 task 는 그 위에 **도메인 service / REST controller / request DTO / response shape** 까지의 HTTP-facing layer 를 박제한다.

본 task 의 정당성 + scope:

- **HQ-0005 resolved**: 사용자 결정 `standard-class-validator-stack` — [STATE.json:73–80](../STATE.json) 박제 완료. `pnpm add class-validator class-transformer` (latest stable: class-validator@^0.14 + class-transformer@^0.5, NestJS 10 공식 권장 stack) 도입 승인. ADR 신설 미필요 (ADR-0001 의 NestJS 채택이 본 standard sub-package 도입을 conceptual cover — Validator pipe 는 NestJS 표준 patterns/techniques 문서가 권장).
- **DO (본 task)**: (1) `pnpm add class-validator class-transformer` 실행 + lockfile 갱신 ([package.json](../../package.json) dependencies 에 두 항목 추가). (2) `src/user/dto/create-person.dto.ts` 신규 — `CreatePersonDto` class + `@IsString` / `@IsEmail` / `@MaxLength` 등 decorator. (3) `src/user/dto/update-person.dto.ts` 신규 — `UpdatePersonDto` 가 `PartialType(CreatePersonDto)` (NestJS `@nestjs/mapped-types` 가 이미 transitive 로 깔려있지 않다면 inline `Partial<T>` + manual decorator 도 가능 — architect 가 판단). (4) `src/user/person.service.ts` 신규 — `@Injectable()` class 가 `PersonRepository` 를 생성자 주입받고 `create / findActive / findAll / findById / update / deactivate / reactivate` 7 메서드 노출. (5) `src/user/person.controller.ts` 신규 — `@Controller('/api/persons')` + 5 endpoint (GET list, GET :id, POST, PATCH :id, DELETE :id 의 hard delete) + class-level `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. (6) `src/user/user.module.ts` 수정 — providers/exports 에 `PersonService` 추가, controllers 에 `PersonController` 추가.
- **DO NOT (후속 task 책임)**: (a) **global ValidationPipe wire in `src/main.ts`** (`app.useGlobalPipes(...)`) — T-0036.5 책임 (split 사유: 본 task production 파일 5 cap 안 보존). 본 task 는 controller-scope `@UsePipes` 로 동일 검증 효과 달성. (b) **dedicated validation e2e** (`test/e2e/person-validation.e2e-spec.ts` — supertest 로 ValidationPipe 의 negative 5 종 검증 + global pipe 가 다른 controller 까지 cover 함을 검증) → T-0036.5. (c) **ServiceIdentity CRUD service/controller + nested endpoint (`/api/persons/:id/service-identities` + `/api/persons/:id/service-identities/:sid/primary`)** → T-0036.5 또는 T-0037 (architect 판단). 본 task 는 Person DTO 에 ServiceIdentity 매핑 미포함 — primary key 지정 / 서비스 ID 추가는 후속. (d) **Group / Part entity Prisma model + 관계 + invariant** → T-0037. (e) **신규 인원 추가 시 1년치 평가 1회 trigger (REQ-027 NewPersonEvent emit)** → T-0037 또는 후속 (UC-03 §6.3 의 emit 대상 AssessmentModule 이 아직 존재하지 않음). 본 task 의 `create` 메서드는 trigger emit 없음 — Follow-ups 박제. (f) **isPrimary 의 service-layer 1-row invariant 강제** — ServiceIdentity 다루는 task 책임 (T-0036.5 / T-0037). 본 task scope 외. (g) **AuthModule guard** (Admin+/User+ 권한 분리) — T-0038 이후 (User entity + Auth 도입 후). 본 task 는 controller endpoint 만 노출, guard 미적용. (h) **NewPersonEvent emit 의 EventEmitterModule wiring** → P4 또는 별도 task.

본 split 결정의 정당성: **`@UsePipes` controller-scope wire** 로 본 task 의 5 production 파일 cap 보존 + ValidationPipe 의 검증 효과 (whitelist / forbidNonWhitelisted / transform) 는 controller 의 endpoint 5 종에 동일 적용 — REQ-023/024/025 의 payload 검증 + REQ-028 invariant pre-check 모두 통과. T-0036.5 가 main.ts global wire + 전용 e2e 로 격상 시 application-wide 가 됨 (다른 controller 추가 시 자동 cover). **REST endpoint convention** 은 [docs/architecture/api.md L71–75](../architecture/api.md) 와 정확히 일치: GET list / POST / GET :id / PATCH :id (soft deactivate 는 `active=false` payload 의 PATCH 로) / DELETE :id (hard delete). UC-03 §3 의 "Deactivate" sub-trigger 는 PATCH `active=false` 로 cover — `POST /persons/:id/reactivate` 같은 별도 endpoint 는 본 task scope 외 (api.md 박제 외).

산출물 (5 production 파일 + 2 test 파일 = 7 파일):

1. **package.json + pnpm-lock.yaml** (수정 — 1 파일로 count, dependencies 2 항목 추가). +3 LOC dep.
2. **src/user/dto/create-person.dto.ts** (신규) — CreatePersonDto class + decorators. ~30 LOC.
3. **src/user/dto/update-person.dto.ts** (신규) — UpdatePersonDto. ~20 LOC.
4. **src/user/person.service.ts** (신규) — PersonService class + 7 메서드. ~120 LOC.
5. **src/user/person.controller.ts** (신규) — PersonController + 5 endpoint + @UsePipes ValidationPipe. ~90 LOC.
6. **src/user/user.module.ts** (수정) — providers/exports/controllers 갱신. +3/-1 LOC.
7. **src/user/person.service.spec.ts** (신규) — Service unit test (R-112 4 항목). ~150 LOC.
8. **src/user/person.controller.spec.ts** (신규) — Controller unit test (R-112 4 항목 + @UsePipes 검증). ~110 LOC.

**Production 파일 count = 5** (item 1 package.json 은 dep 변경만, 1 파일로 count; item 2–6 = production 5; test 는 별도 — T-0034/T-0035 precedent 따라 production 만 cap 계산). **Production LOC ≈ 260; total LOC ≈ 520**. T-0034 (~240) / T-0035 (~260) precedent 와 동일 LOC 범위.

cap 검산 (architect 가 첫 read 직후 재검산 — 실제 production LOC > 300 또는 production 파일 > 5 면 planner 호출하여 추가 split 예: DTO 만 + Service+Controller 분리). 추정 초과 시 즉시 split.

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 (L51) — "평가 대상 인원 관리 (CRUD, group, deactivate/activate)" bullet
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 row 4 (T-0036) + footnote (LOC discipline split)
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) §3 sub-trigger 6 종 + §5 main flow + §6.1 Deactivate vs Delete + §6.4 Group invariant + §7 error flows
- [docs/architecture/api.md](../architecture/api.md) §3 row `/api/persons` (L71–75) — endpoint contract 5 종 + auth tier (본 task 는 guard 미적용, tier 박제만)
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 row 1 Person entity columns + §3 관계
- [docs/architecture/modules.md](../architecture/modules.md) UserModule 항목 (책임 + 의존성)
- [docs/architecture/directory.md](../architecture/directory.md) `src/<module>/dto/` sub-directory 규약
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS 채택 (class-validator standard sub-package 도입 정당성)
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — Prisma + adapter-pg
- [docs/requirements.md](../requirements.md) REQ-023 / REQ-024 / REQ-025 / REQ-026 / REQ-027 / REQ-045 row
- [docs/STATE.json](../STATE.json) — HQ-0005 entry (L73–80) + `decision: standard-class-validator-stack` 박제 (본 task 의 dependency-add 정당성 source)
- [docs/tasks/T-0035-service-identity-entity-and-repository.md](T-0035-service-identity-entity-and-repository.md) Out of Scope §128–134 (T-0036 책임 명시)
- [docs/tasks/T-0034-person-repository-and-user-module-skeleton.md](T-0034-person-repository-and-user-module-skeleton.md) — PersonRepository 시그니처 + UserModule wiring 패턴
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — 6 메서드 시그니처 (findMany activeOnly default true / findById null / create / update / softDelete / restore) — PersonService 가 forward 할 대상
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) — 4 메서드 시그니처 (본 task 에서 직접 호출 안 함, 후속 task 책임 참조용)
- [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) — PrismaService mock 패턴 (PersonService spec 이 동일 패턴 적용)
- [src/user/user.module.ts](../../src/user/user.module.ts) — providers/exports/controllers 추가 위치
- [prisma/schema.prisma](../../prisma/schema.prisma) — Person model 필드 (fullName / email / active / 등) — DTO 의 source-of-truth
- [package.json](../../package.json) — postinstall (`prisma generate`) / 기존 dependencies / jest coverageThreshold (line ≥ 80% / function ≥ 80%)
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr) / §3.2 (R-110~R-114 + R-112 4 항목 happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80%) / §5 (HITL — 본 task 의 dependency add 는 HQ-0005 로 사전 승인)

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) (R-110~R-114) 강제 항목 포함.

### A. 의존성 추가

- [ ] **첫 단계로** `pnpm add class-validator class-transformer` 실행. NestJS 10 권장 호환 version (class-validator@^0.14 + class-transformer@^0.5 이상) 자동 설치. `package.json` dependencies 에 두 항목 추가 + `pnpm-lock.yaml` 갱신.
- [ ] `pnpm install` 후 `postinstall` hook 의 `prisma generate` 가 자동 실행되어 `@prisma/client` type 이 정상 생성됨 (regression 없음).
- [ ] `package.json` 의 `dependencies` 정렬은 pnpm 의 default 정렬 따름 (수동 reorder 안 함).
- [ ] HQ-0005 의 결정 (`standard-class-validator-stack`) 이 본 task 의 dependency add 정당성. ADR 신설 미필요 (ADR-0001 NestJS 채택의 표준 sub-package).

### B. DTO 코드

- [ ] `src/user/dto/create-person.dto.ts` 신규 — `CreatePersonDto` class export. 다음 필드 + decorator:
  - `fullName: string` — `@IsString()` + `@IsNotEmpty()` + `@MaxLength(255)` (또는 합리적 상한 — architect 판단). Prisma 의 `fullName String` 컬럼과 정합.
  - `email: string` — `@IsEmail()` + `@MaxLength(255)`. Prisma 의 `email String @unique` 와 정합.
  - (선택) `active?: boolean` — `@IsBoolean()` + `@IsOptional()`. default 는 Prisma 의 `@default(true)` 가 cover 하므로 DTO 차원 default 미설정.
- [ ] `src/user/dto/update-person.dto.ts` 신규 — `UpdatePersonDto` class export. 모든 필드 optional (PATCH semantics). 두 가지 구현 옵션 (architect 선택):
  - (i) `@nestjs/mapped-types` 의 `PartialType(CreatePersonDto)` 사용 — 단 본 패키지가 dependencies 에 없으면 별도 `pnpm add @nestjs/mapped-types` 필요 (3 번째 새 dep — **HQ-0005 scope 외이므로 회피**).
  - (ii) **권장**: manual decorate — 각 필드를 `@IsOptional()` 와 함께 decorator 재정의. 추가 dep 없음.
- [ ] DTO 파일은 class + decorator 만 — Prisma type 직접 import 안 함 (DTO 와 entity 의 책임 분리).

### C. PersonService 코드

- [ ] `src/user/person.service.ts` 신규 — `@Injectable()` class 가 `PersonRepository` 를 생성자 주입받고 다음 7 메서드 공개:
  - `create(dto: CreatePersonDto): Promise<Person>` — `PersonRepository.create({ fullName, email })` forward. Prisma `P2002` (email 중복) 를 catch 하여 `ConflictException('email already in use')` 변환 throw.
  - `findActive(): Promise<Person[]>` — `PersonRepository.findMany({ activeOnly: true })` forward (REQ-026 default).
  - `findAll(): Promise<Person[]>` — `PersonRepository.findMany({ activeOnly: false })` forward (admin 의 deactivated view 용 — 단 본 task 는 controller endpoint 미노출, future query param 의 source).
  - `findById(id: string): Promise<Person>` — `PersonRepository.findById(id)` 호출. null 시 `NotFoundException('person not found: ${id}')` throw.
  - `update(id: string, patch: UpdatePersonDto): Promise<Person>` — `PersonRepository.update(id, patch)` forward. Prisma `P2025` 를 catch 하여 `NotFoundException` 변환. `P2002` (email 중복) catch 하여 `ConflictException`.
  - `deactivate(id: string): Promise<Person>` — `PersonRepository.softDelete(id)` forward (REQ-026 soft). `P2025` → `NotFoundException`.
  - `reactivate(id: string): Promise<Person>` — `PersonRepository.restore(id)` forward (REQ-026 activate). `P2025` → `NotFoundException`.
- [ ] 본 service 는 **isPrimary invariant / Group/Part invariant / NewPersonEvent emit / ServiceIdentity 관련 로직** 일절 포함 안 함 (후속 task 책임).
- [ ] Prisma error catch 패턴 통일: try-catch + `error instanceof Prisma.PrismaClientKnownRequestError` 또는 `error.code` 검사. 추상화 helper 신설은 over-engineering — 7 메서드 안에 inline 으로 명시적 작성 (architect 판단 시 1 private helper 정도는 허용).

### D. PersonController 코드

- [ ] `src/user/person.controller.ts` 신규 — `@Controller('/api/persons')` class export. 다음 endpoint:
  - `@Get()` `findActive(): Promise<Person[]>` — PersonService.findActive() forward. 200 OK + JSON 배열.
  - `@Get(':id')` `findOne(@Param('id') id: string): Promise<Person>` — PersonService.findById(id). 404 시 NotFoundException 자동 status mapping.
  - `@Post()` `@HttpCode(201)` `create(@Body() dto: CreatePersonDto): Promise<Person>` — PersonService.create(dto). 201 Created + body. 409 시 ConflictException (email 중복).
  - `@Patch(':id')` `update(@Param('id') id: string, @Body() patch: UpdatePersonDto): Promise<Person>` — PersonService.update(id, patch). 404 / 409 자동 변환.
  - `@Delete(':id')` `@HttpCode(204)` `remove(@Param('id') id: string): Promise<void>` — **hard delete** — `PersonRepository.delete` 가 현재 없음 → PersonService 에 `delete(id)` 메서드 추가 (PersonRepository 의 `softDelete` 가 아닌 별도 `prisma.person.delete({ where: { id } })` 호출). 또는 architect 가 본 endpoint 를 본 task scope 외로 판단 시 endpoint 만 skeleton 으로 작성 + 501 NotImplemented throw + Follow-ups 박제. **api.md 의 DELETE 는 hard delete 박제이므로 본 task 에서 cover 권장.**
- [ ] Class-level `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` decorator 적용 — 5 endpoint 모두 자동 cover.
- [ ] AuthModule guard 미적용 (T-0038+ 책임). 본 controller 의 endpoint 는 인증 없이 호출 가능 — Out of Scope 명시.
- [ ] **Soft deactivate / reactivate 는 PATCH `{ active: false }` / PATCH `{ active: true }` 로 cover** (api.md 박제 + UC-03 §6.1) — 별도 endpoint 신설 안 함.

### E. UserModule wiring

- [ ] `src/user/user.module.ts` 수정 — `providers` 배열에 `PersonService` 추가 (PersonRepository / ServiceIdentityRepository 와 나란히), `exports` 에 `PersonService` 추가, **`controllers` 배열 신설 + `PersonController` 추가** (기존 module 에 controllers key 없으므로 신규 추가).
- [ ] `src/app.module.ts` 는 수정 안 함 (T-0034 에서 이미 UserModule import 됨).

### F. Unit test (R-112 강제)

- [ ] `src/user/person.service.spec.ts` 신규 — PersonRepository 를 Jest mock (`jest.fn()`) 으로 대체. R-112 4 항목 cover:
  - **Happy path × 7 메서드**: create / findActive / findAll / findById / update / deactivate / reactivate 각 1 test (PersonRepository mock 호출 인자 + return 값 검증).
  - **Error path**: create 가 PersonRepository.create 의 `P2002` propagate 시 `ConflictException` 변환 throw 1 test / findById 가 null 반환 시 `NotFoundException` 1 test / update 가 `P2025` propagate 시 `NotFoundException` 1 test / update 가 `P2002` propagate 시 `ConflictException` 1 test / deactivate 가 `P2025` 시 `NotFoundException` 1 test / reactivate 동일 1 test. 총 6 error test.
  - **Branch**: findActive (activeOnly=true) vs findAll (activeOnly=false) 의 2 분기 각 1 test (이미 happy 에서 cover — branch coverage 자동) + Prisma error 의 `P2002` vs `P2025` vs unknown error (catch 안 함, raw propagate) 의 3 분기 각 1 test.
  - **Negative**: create 의 dto 가 빈 객체일 때 Prisma 호출 인자 forward 검증 (validator 는 controller pipe 책임, service 는 raw pass-through) 1 test / update 의 patch 가 빈 객체일 때 Prisma update no-op 검증 1 test / findById 의 id 가 empty string 일 때 Prisma 의 native 처리에 의존 (P2023 등) raw propagate 1 test / Prisma 의 unknown error code (`P9999` 등 catch 안 하는 코드) 는 그대로 throw 1 test. 4 negative.
- [ ] `src/user/person.controller.spec.ts` 신규 — PersonService 를 Jest mock 으로 대체. R-112 4 항목 cover:
  - **Happy path × 5 endpoint**: findActive / findOne / create / update / remove 각 1 test (service mock 호출 인자 + return 값 검증).
  - **Error path**: findOne 의 service 가 NotFoundException throw 시 그대로 propagate 1 test / create 의 service 가 ConflictException throw 시 그대로 propagate 1 test / update 동일 2 test (NotFound / Conflict).
  - **Branch**: HTTP method 매핑 분기는 nest framework 책임이므로 본 spec 에서는 service 호출 인자 분기 (id param 유무 / body 유무) 검증 — happy 에서 이미 cover.
  - **Negative**: ValidationPipe 통과 실패 시 — controller 의 `@UsePipes` 가 ValidationPipe 를 적용함을 확인 (decorator metadata 검사 또는 별도 spec 으로 `nestjs/testing` 의 `createNestApplication` + `useGlobalPipes` 없이도 controller-scope pipe 가 활성화됨을 검증). negative payload (missing fullName / wrong type number for fullName / extra unknown field `foo` / fullName length > 255 / invalid email format) 5 종 — controller spec 에서는 metadata 만 검증 + 실제 negative integration 은 T-0036.5 의 e2e 책임으로 위임. **본 spec 에서는 5 negative 케이스 의 시도 + ValidationPipe metadata 박제 1 test 만 cover (수가 부족하면 spec 안에 supertest 로 직접 검증 1 case 추가 권장).**
- [ ] `pnpm test:cov` 실행 결과 PersonService + PersonController 의 line ≥ 80% AND function ≥ 80% (jest `coverageThreshold.global` 강제). 미달 시 jest exit 1 → CI red.

### G. Lint / build / unit / smoke / e2e (R-111 / R-113)

- [ ] `pnpm lint` 통과 (새 파일 0 lint error).
- [ ] `pnpm build` 통과 (TypeScript 컴파일 성공 + class-validator decorator 의 metadata 인식).
- [ ] `pnpm test` 통과 (모든 unit test green — 기존 PersonRepository / ServiceIdentityRepository / UserModule spec 포함 regression 없음).
- [ ] `pnpm test:cov` 통과 (coverage threshold line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 (기존 smoke 가 regression 없이 통과 — 본 task 는 신규 smoke test 추가 안 함, T-0036.5 책임).
- [ ] `pnpm test:e2e` 통과 (기존 e2e 가 regression 없이 통과 — 본 task 는 신규 e2e 추가 안 함, T-0036.5 책임).
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green.

### H. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE 또는 결함 사항 후속 round 처리.
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 또는 MCP `add_issue_comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-112 coverage / 4 항목) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 또는 MCP `merge_pull_request --squash` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline):

- **Global ValidationPipe wire in `src/main.ts`** (`app.useGlobalPipes(...)`) → T-0036.5. 본 task 는 controller-scope `@UsePipes` 로 동일 검증 효과 (PersonController 의 5 endpoint 한정).
- **Dedicated validation e2e** (`test/e2e/person-validation.e2e-spec.ts` 등 — supertest 로 ValidationPipe negative 5 종 + global pipe 가 다른 controller 까지 cover 함을 검증) → T-0036.5.
- **ServiceIdentity CRUD service/controller + nested endpoint** (`/api/persons/:id/service-identities` + `/primary` set) → T-0036.5 또는 T-0037.
- **Group / Part entity Prisma model + relation + invariant (REQ-028 Group 정책)** → T-0037.
- **신규 인원 추가 시 1년치 평가 1회 trigger (REQ-027 NewPersonEvent emit)** → AssessmentModule 도입 후 별도 task (현재 AssessmentModule 미존재).
- **isPrimary service-layer 1-row invariant 강제** → ServiceIdentityService 책임 (T-0036.5+).
- **User (로그인 계정) entity + AuthModule + RBAC guard** — `Admin+` / `User+` tier 분리 → T-0038+.
- **Person↔ServiceIdentity 응답 DTO 의 nested embedding** (`GET /api/persons/:id` 응답에 serviceIdentities 포함) — 본 task 는 PersonRepository.findById 의 raw return 만 (Prisma include 없음). 후속 task 가 ServiceIdentity controller / DTO 도입 시 nested embedding 결정.
- **`POST /api/persons/:id/reactivate` 별도 endpoint** — api.md 박제 외. 본 task 는 PATCH `{active: true}` 로 cover (UC-03 §6.1 + api.md L74).
- **`DELETE` 의 cascade 정책 결정 ADR** — Person hard delete 시 ServiceIdentity 는 schema-level `onDelete: Cascade` 가 이미 박제 (T-0035). Assessment / Contribution 등 후속 entity 의 cascade 정책은 entity 도입 시점 (T-0038+) 결정.
- **API 응답 shape 표준화** (예: `{ data: ..., meta: ... }` envelope) — 본 task 는 Prisma return 그대로 (raw object). envelope 도입은 별도 ADR.
- **Pagination / filtering / sorting query param** — 본 task 의 GET list 는 전체 active 반환만. pagination 은 별도 task.
- **OpenAPI / Swagger 자동 문서 생성** — 별도 ops task.
- **PostgreSQL container CI service container 도입** — 본 task 의 unit test 는 PersonRepository / PersonService mock 으로 cover (DB 실연결 불필요). 실제 DB integration test 는 별도 ops task.
- **HQ-0005 외 추가 dependency 도입** — `@nestjs/mapped-types` 등 추가 패키지 도입 시 CLAUDE.md §5 BLOCKED 게이트 재발화. 본 task 는 class-validator + class-transformer 2 종만.

## Suggested Sub-agents

`architect → implementer → tester` — architect 가 본 task 첫 read 직후 (a) cap 재검산 (실제 production LOC > 300 또는 production 파일 > 5 면 split 요청 — 예: DTO 만 + Service+Controller 별도) (b) UpdatePersonDto 구현 옵션 (manual decorate 권장 — `@nestjs/mapped-types` 추가 dep 회피) 확정 (c) DELETE endpoint 가 hard delete (api.md 박제) 인 점 + PersonRepository 에 `delete` 메서드 미존재 → PersonService 에 inline Prisma 호출 vs PersonRepository 확장 결정 (architect 판단; **권장**: PersonRepository 에 `hardDelete(id)` 메서드 1 줄 추가, 6 → 7 메서드 — T-0034 의 §B 6 메서드 박제 약간 확장) (d) ValidationPipe wire 의 controller-scope vs main.ts global 결정 (split 안 으로 controller-scope 확정 박제) (e) Prisma error 매핑 패턴 (try-catch + code 검사 vs custom Nest exception filter) — 본 task 는 try-catch inline. implementer 가 `pnpm add` 실행 + DTO 2 + Service + Controller + UserModule edit + (선택) PersonRepository.hardDelete. tester 가 service.spec + controller.spec + lint/build/test:cov/smoke/e2e 검증.

## Follow-ups

(architect / implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **T-0036.5 후보** — `src/main.ts` 의 `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` global wire + 전용 validation e2e (`test/e2e/person-validation.e2e-spec.ts` — supertest 로 negative 5 종: missing required / wrong type / extra unknown field / max length 초과 / invalid email format 각 1 case + global pipe 가 다른 controller 까지 cover 함을 sanity-check 1 case). production 파일 1 (main.ts) + e2e 파일 1 = 2 파일 / ~60 LOC.
- **T-0037 후보** — Group + Part entity Prisma model + Person↔Group N:M + Person↔Part N:1 mandatory invariant (REQ-028) + GroupService / PartService + 관계 endpoint. p3-implementation-plan.md §2 의 T-0035 책임이 cron #5 split 으로 한 자리 뒤로 shift 한 결과.
- **NewPersonEvent emit 도입 task 후보** — REQ-027 의 "신규 인원 추가 시 1년치 평가 1회 trigger" — AssessmentModule 도입 후 (T-0038+) PersonService.create 끝에 EventEmitter inject + emit. P4 의 AssessmentModule 실제 평가 파이프라인과 연결.
- **ServiceIdentity controller / DTO 도입 task 후보** — `/api/persons/:id/service-identities` POST/GET/DELETE + `/primary` set endpoint + isPrimary 1-row invariant service-layer 강제. ServiceIdentityRepository 위에 ServiceIdentityService + controller 박제.
- **cap LOC 정책 ADR 후보** — T-0034 / T-0035 / T-0036 의 3 연속 task 가 모두 production LOC ~260 + test LOC ~150 = total ~410 LOC 로 §3 의 300 LOC cap 을 초과하나 production-only 기준으로 통과. test LOC 분리 정책의 명문화 (별도 ADR) 권장. session #5 turn 5 의 hotfix 790cabc 가 entrypoint LOC 예외 박제와 동일 패턴.
- **partial unique index ADR 후보** — REQ-024 isPrimary 의 PostgreSQL `WHERE isPrimary=true` partial unique index raw SQL migration 도입. T-0035 의 schema-level `@@unique([personId, service])` 는 service 중복 방지만 cover, "정확히 1 row 의 isPrimary=true" invariant 는 service-layer + partial index 양쪽 cover 권장.
- **.gitattributes CRLF 정책 ADR 후보** — Windows local CRLF vs CI Linux LF 의 `pnpm lint` 차이 (local fail / CI pass) — `.gitattributes` 의 `* text=auto eol=lf` 박제 + 기존 파일 normalize follow-up task.
- **PersonRepository.hardDelete 추가 박제 (architect 결정 시)** — 본 task 의 DELETE endpoint 구현 위해 PersonRepository 에 7 번째 메서드 `hardDelete(id: string): Promise<Person>` 추가. T-0034 의 §B 6 메서드 박제의 자연 확장.
- **OpenAPI / Swagger 자동 문서 생성 task 후보** — `@nestjs/swagger` dependency 추가 + ValidationPipe + DTO decorator 와 자연 연동. 별도 ADR + task.
