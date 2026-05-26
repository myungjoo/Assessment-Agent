---
id: T-0047
title: shared test helper 추출 — test/helpers/prisma-mock.ts + smoke / e2e spec migration
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-058]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-05-26
completedAt: 2026-05-26T13:19:00+09:00
prNumber: 43
mergedAs: 460b302
plannerNote: T-0044 / T-0046 §Follow-ups 박제 후보 — 동일 helper inline 이 5+ spec 누적, 3+ 임계 초과. 2 test/ spec 만 phase 1 migration (cap 보존). src/user/*.spec.ts 5 파일 phase 2 follow-up.
dependsOn: [T-0044, T-0046]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md §Follow-ups L178 ("mock PrismaService helper 디렉토리 신설 — 3 회 이상 시 추출") + docs/tasks/T-0046-part-service-controller-dto-backbone.md §Follow-ups L183 ("shared test helper 추출 모듈 — 4 회 이상 시 추출 검토") + driver-supplied 후보 (d) shared test helper module 추출. 현 인벤토리: buildMockPrismaService / buildPersonFixture / buildPrismaError 가 src/user/person.service.spec / part.service.spec / part.controller.spec / person.controller.spec / person.repository.spec + test/smoke/persons.smoke-spec / test/e2e/persons.e2e-spec 5+ spec 에 inline 중. 본 task 는 phase 1 — test/helpers/prisma-mock.ts 신설 + test/smoke/persons.smoke-spec + test/e2e/persons.e2e-spec 2 파일만 migration (cap 보존, 3 파일). src/user/*.spec.ts 5 파일은 phase 2 follow-up (fixture variant 적합성 검토 동반).
---

# T-0047 — shared test helper 추출 (phase 1: test/helpers/prisma-mock.ts + smoke/e2e migration)

## Why

[T-0044](T-0044-e2e-test-persons-domain-endpoint-expansion.md) §Follow-ups L178 와 [T-0046](T-0046-part-service-controller-dto-backbone.md) §Follow-ups L183 가 동일 helper (`buildMockPrismaService` / `buildPersonFixture` / `buildPrismaError`) 의 inline 중복 누적을 박제했고, 임계 (3+ spec) 가 도달되었다. 현재 인벤토리:

1. [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — `buildMockPrismaService` (L55) + `buildPersonFixture` (L70) + `buildPrismaError` (L86) + `MockPrismaService` type (L41).
2. [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — `buildMockPrismaService` (L23) + `buildPersonFixture` (L36) + `buildPrismaError` (L50) + `MockPrismaService` type (L13).
3. [src/user/part.service.spec.ts](../../src/user/part.service.spec.ts) — `buildPersonFixture` (L37) + Prisma error helper inline. **fixture variant — partId default `"part-default"`** (smoke/e2e 의 `null` 과 다름).
4. [src/user/part.controller.spec.ts](../../src/user/part.controller.spec.ts) — 동일 helper 패턴.
5. [src/user/person.service.spec.ts](../../src/user/person.service.spec.ts) — `buildPrismaError` 패턴 (변종 시그니처 가능).
6. [src/user/person.controller.spec.ts](../../src/user/person.controller.spec.ts) — 변종 fixture.
7. [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) — 변종 fixture.

**본 task 의 phase 1 책임** — `test/helpers/prisma-mock.ts` 신설 + test/ 디렉토리 2 spec (smoke + e2e) 만 migration. 두 spec 의 helper 시그니처 / fixture 가 **사실상 동일** (id 문자열만 `"cuid-smoke-default"` vs `"cuid-e2e-default"`, overrides 인자로 자연 처리) — 무손실 migration 가능. cap 보존 (3 파일).

src/user/*.spec.ts 5 spec migration 은 **phase 2 follow-up task** — partId default 가 `"part-default"` 인 part.service.spec.ts 와 `null` 인 smoke/e2e fixture 간 default policy 결정 (또는 `buildPersonFixtureForRepository` 변종 추가) 동반 → 별도 task 의 architect decision 책임. phase 1 분리로 본 task 의 mechanical migration 단순성 + cap 보존 안전 확보.

본 task 는 production code 변경 0 / schema 변경 0 / migration 신설 0 / 새 외부 dependency 0 — test infrastructure refactor 단일 책임. R-110 (테스트 검증) + R-111 (CI 실행) + R-114 (CI conclusion 확인) 의무 cover, R-112 4 항목 cover 가 **본 task scope 의 helper 함수 자체** 에 적용 (`prisma-mock.ts` 의 3 helper 의 happy / error / branch / negative).

REQ 매핑: [REQ-058](../requirements.md) (평가 자료 non-volatile + 테스트 격리 정책 — test infrastructure 의 격리 / DRY trade-off 의 underlying 운영 REQ).

## Required Reading

- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — migration 대상 1 — L41 ~ L88 의 type + 3 helper inline. import 추가 + inline 삭제.
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — migration 대상 2 — L13 ~ L52 의 type + 3 helper inline. import 추가 + inline 삭제.
- [test/jest-smoke.json](../../test/jest-smoke.json) — `testRegex: .*\.smoke-spec\.ts$` 로 helper 파일 (`prisma-mock.ts`) 미pickup 검증.
- [test/jest-e2e.json](../../test/jest-e2e.json) — `testRegex: .*\.e2e-spec\.ts$` 로 helper 파일 미pickup 검증.
- [package.json](../../package.json) — root jest config 의 `testRegex: .*\.spec\.ts$` + `testPathIgnorePatterns` 가 `test/smoke/` + `test/e2e/` 만 제외, **`test/helpers/`** 디렉토리는 별도 제외 불필요 (`.spec.ts` suffix 아님). `collectCoverageFrom: src/**/*` 로 helper 파일은 coverage 대상 0.
- [src/user/part.service.spec.ts](../../src/user/part.service.spec.ts) L37 — phase 2 의 fixture variant 검증 reference (본 task 는 migration 안 함, 비교 reference 용도만).
- [docs/architecture/directory.md](../architecture/directory.md) §"Top-level 디렉토리 트리" — `test/` 하위 표준 layout. 본 task 가 `test/helpers/` 신설 시 directory.md 갱신 필요 여부 검토 (별도 doc-only follow-up 가능).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr) / §3.2 R-110 ~ R-114 (R-112 4 항목 적용: helper 자체의 happy / error / branch / negative + coverage threshold 면제 — helper 파일은 coverage 대상 아니므로 production threshold 회귀 0) / §3.3 (4-게이트) / §11 (trail blob) / §12 (한국어).
- [docs/tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md](T-0044-e2e-test-persons-domain-endpoint-expansion.md) §Follow-ups L178 — 본 task 의 박제 source.
- [docs/tasks/T-0046-part-service-controller-dto-backbone.md](T-0046-part-service-controller-dto-backbone.md) §Follow-ups L183 — 본 task 의 박제 source + phase 2 trigger reference.
- [docs/requirements.md](../requirements.md) REQ-058 — 테스트 격리 / non-volatile 저장 underlying REQ.

## Acceptance Criteria

본 task 는 **pr-mode test infrastructure refactor task** — feature branch `claude/T-0047-shared-test-helpers-extraction-prisma-mock` → PR open → reviewer round 1 → integrator 4-게이트 → squash merge. [CLAUDE.md §3.2 R-110 ~ R-114](../../CLAUDE.md) 의 test / CI 절대 규칙 cover.

**Schema / migration / dependency**:

- [ ] `prisma/schema.prisma` 변경 0.
- [ ] `prisma/migrations/` 신규 0.
- [ ] 새 외부 dependency 0 — `pnpm add` 실행 안 함.

**신규 helper 모듈** (`test/helpers/prisma-mock.ts` 신규 파일, ~80 LOC):

- [ ] 파일 header 주석 한국어 (§12) — 책임 (smoke + e2e + 후속 spec 의 mock PrismaService + Person fixture + Prisma error helper 단일 source) + 사용 가이드 (import 패턴) + phase 2 follow-up 노트 (src/user/*.spec.ts 의 fixture variant 통합 책임).
- [ ] `export type MockPrismaService` — `person` 속성에 5 jest.Mock (findMany / findUnique / create / update / delete) 보유 type. 기존 smoke/e2e 의 inline type 시그니처와 동일.
- [ ] `export function buildMockPrismaService(): MockPrismaService` — 5 `jest.fn()` 보유한 `person` delegate 객체 반환. 기존 smoke/e2e 의 시그니처와 동일.
- [ ] `export function buildPersonFixture(overrides: Partial<Person> = {}): Person` — schema.prisma 7 컬럼 (id / fullName / email / active / partId / createdAt / updatedAt) 모두 채운 default Person row 반환. default id `"cuid-default"` (smoke/e2e 의 `"cuid-smoke-default"` / `"cuid-e2e-default"` 와 다르지만 overrides 인자로 spec 별 override 가능 — 기존 동작 호환). default partId `null` (smoke/e2e 기존 default 와 동일).
- [ ] `export function buildPrismaError(code: string, message = "prisma-error"): Error` — `Object.assign(new Error(message), { code })` 패턴. duck typing 으로 PersonService.getPrismaErrorCode() 가 인식. 기존 smoke/e2e 시그니처 동일.
- [ ] JSDoc 한국어 — 각 export 의 책임 / 호출 패턴 / fixture default override 정책 / phase 2 follow-up 참조 1-2 줄.
- [ ] `import type { Person } from "@prisma/client"` — type-only import 로 runtime 의존성 0.
- [ ] 파일은 `test/helpers/prisma-mock.ts` 경로 — `.spec.ts` / `.smoke-spec.ts` / `.e2e-spec.ts` suffix 아님 → 어떤 jest config (root / smoke / e2e) 의 testRegex 도 미pickup, ESLint 만 cover.

**smoke spec migration** (`test/smoke/persons.smoke-spec.ts` 수정, ~40 LOC 제거 + 1 LOC import 추가):

- [ ] L31 ~ L38 import block 에 `import { buildMockPrismaService, buildPersonFixture, buildPrismaError, type MockPrismaService } from "../helpers/prisma-mock";` 추가 (자연 정렬 위치 — `import request from "supertest";` 뒤).
- [ ] L41 ~ L49 `type MockPrismaService` block 삭제 (import 로 대체).
- [ ] L51 ~ L65 `function buildMockPrismaService` block 삭제.
- [ ] L67 ~ L81 `function buildPersonFixture` block 삭제.
- [ ] L83 ~ L88 `function buildPrismaError` block 삭제.
- [ ] L1 ~ L30 의 파일 header 주석 보존 — 단 L19-L20 의 "mock helper 는 본 파일 안에 inline" 줄을 "mock helper 는 [test/helpers/prisma-mock.ts](../helpers/prisma-mock.ts) 에서 import (T-0047 추출)" 로 갱신.
- [ ] 기존 9 smoke test 의 동작 변경 0 — `beforeAll` / `afterAll` / `afterEach` / 9 `it` block 본문 unchanged. import 만 변경.
- [ ] migration 후 `pnpm test:smoke` 통과 — 9 smoke test 모두 기존 결과 (pass) 유지.

**e2e spec migration** (`test/e2e/persons.e2e-spec.ts` 수정, ~40 LOC 제거 + 1 LOC import 추가):

- [ ] L4 ~ L11 import block 에 `import { buildMockPrismaService, buildPersonFixture, buildPrismaError, type MockPrismaService } from "../helpers/prisma-mock";` 추가.
- [ ] L13 ~ L21 `type MockPrismaService` block 삭제.
- [ ] L23 ~ L33 `function buildMockPrismaService` block 삭제.
- [ ] L36 ~ L47 `function buildPersonFixture` block 삭제.
- [ ] L50 ~ L52 `function buildPrismaError` block 삭제.
- [ ] L1 ~ L3 파일 header 보존 — "mock / helper / 격리 = T-0043 smoke spec 동일 패턴" 줄을 "mock / helper = [test/helpers/prisma-mock.ts](../helpers/prisma-mock.ts) 공용 (T-0047 추출). 격리 = T-0043 smoke spec 동일 패턴 (beforeAll/afterAll + afterEach jest.clearAllMocks())." 로 갱신.
- [ ] PERSON_DTO_FIELDS / messageText / expectDtoFields 3 spec-local helper (L55 ~ L72) 는 본 task scope 외 — e2e spec 안에 inline 유지 (smoke spec 에 동일 사용처 없음, 별도 helper 모듈 신설 임계 미달).
- [ ] 기존 11 e2e test 의 동작 변경 0 — `beforeAll` / `afterAll` / `afterEach` / 11 `it` block 본문 unchanged. import 만 변경.
- [ ] migration 후 `pnpm test:e2e` 통과 — 13 e2e test (기존 2 app + 신규 11 persons) 모두 기존 결과 유지.

**R-112 4 항목 cover** — 본 task 의 신규 production-like 코드는 `prisma-mock.ts` 의 3 helper 함수. 다음 4 항목을 helper 자체의 unit test 로 cover 할 수 있으나, **helper 의 단순성 (jest.fn() / Object.assign / spread + fixture)** 으로 별도 unit spec 신설 ROI 낮음:

- [ ] **Happy path**: migration 된 smoke + e2e spec 의 기존 9 + 11 = 20 test 가 helper 의 happy path 를 cover (helper return 값이 정상 test 흐름에 사용됨). 별도 prisma-mock.spec.ts 신설 안 함 — 기존 test 가 indirect cover.
- [ ] **Error path**: helper 자체에 throw 분기 0 (Object.assign / spread / jest.fn() 호출만). error path 없음 — 본 항목 면제 정당.
- [ ] **Branch / flow coverage**: helper 분기 없음 (`buildPersonFixture` 의 default-vs-override 정도가 분기인데 overrides default `{}` + spread 로 단일 흐름) — 본 항목 면제 정당.
- [ ] **Negative cases 충분 cover**: migration 된 spec 의 negative test 들이 indirect cover — smoke 의 P2002 → 409 branch 1 + e2e 의 P2002 → 409 / P2025 → 404 / null findUnique → 404 / validation 400 / whitelist 400 = 5 negative case 가 helper 의 normal path 를 negative scenario 흐름에서 검증. 본 항목 cover.
- [ ] **분기 없음 — 본 task 의 helper 는 단순 factory + fixture + Object.assign 으로 분기 0**. R-112 4 항목 중 branch / error path 는 본 task 의 helper 책임 밖. 본 항목 정당화 명시.

**Coverage threshold (R-112)**:

- [ ] `test/helpers/prisma-mock.ts` 는 package.json `collectCoverageFrom: ["src/**/*.(t|j)s"]` scope 밖 — coverage 통계에 포함 0. global threshold (line ≥ 80% AND function ≥ 80%) 회귀 위험 0.
- [ ] migration 으로 smoke/e2e spec 의 production 호출 흐름 변경 0 — production 코드 (src/user/*) 의 coverage 변경 0. `pnpm test:cov` 통과 (기존 그대로).

**Test / lint / build / CI** (5종 grand gate):

- [ ] `pnpm lint` 통과 — 신규 `test/helpers/prisma-mock.ts` 와 migration 된 smoke/e2e spec 모두 lint 0 error (env CRLF skip 정책 유지).
- [ ] `pnpm build` 통과 (TypeScript compile — helper 파일이 build target 영향 0).
- [ ] `pnpm test` 통과 — 기존 221 unit test 모두 pass + 신규 helper 파일 jest pickup 0 검증 (jest output 의 test files 수 변경 0).
- [ ] `pnpm test:cov` 통과 — coverage threshold global 통과 (기존 그대로). src/ 만 cover, helper 영향 0.
- [ ] `pnpm test:smoke` 통과 — 9 + 2 = 11 smoke test 회귀 없음.
- [ ] `pnpm test:e2e` 통과 — 11 + 2 = 13 e2e test 회귀 없음.
- [ ] CI workflow (GitHub Actions) green — push 후 `gh run list --limit 1` conclusion=success. reviewer-gate race 발생 시 `gh run rerun`.

**PR / reviewer / integrator** (4-게이트):

- [ ] feature branch `claude/T-0047-shared-test-helpers-extraction-prisma-mock` 으로 작업.
- [ ] PR title / body 한국어 (§12). body 에 task 파일 링크 + 본 Acceptance Criteria 체크리스트 포함.
- [ ] reviewer round 1 APPROVE + `gh pr comment` 외부 post (4-게이트 #2).
- [ ] integrator 4-게이트 (APPROVE / comment 외부 / self-check 6항목 / CI green) 모두 true 시 `gh pr merge --squash --delete-branch`.

**Commit / trail** (§11):

- [ ] commit subject ≤ 70 char, type=refactor scope=test — `refactor(test): shared PrismaService mock helper 추출 (T-0047)`.
- [ ] commit body 의 agent-trail blob 에 IMPLEMENTER (files / loc / notes) / TESTER (added / result / coverage) / INTEGRATOR (pr / round / ci) / ACCEPTANCE 섹션 포함. ARCHITECT skip 가능 (단순 추출, 결정 박제 0).

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **src/user/*.spec.ts 5 spec migration** — `person.service.spec.ts` / `person.controller.spec.ts` / `person.repository.spec.ts` / `part.service.spec.ts` / `part.controller.spec.ts` 의 inline helper 제거. **phase 2 follow-up task** 책임 — fixture variant 결정 (partId default `"part-default"` vs `null` 정책 / `buildPersonFixtureForRepository` 변종 추가 vs unified default + overrides 인자 강제) architect decision 동반.
- **PERSON_DTO_FIELDS / messageText / expectDtoFields 추출** — e2e spec local 3 helper. smoke spec 에 동일 사용처 없음 — 추출 임계 미달. 별도 helper 모듈 신설은 향후 GroupController / PartController e2e 진입 후 누적 시 follow-up.
- **buildPartFixture 추출** — `part.service.spec.ts` L25 의 Part fixture. 현재 1 spec 만 사용 (part.controller.spec.ts 가 같이 쓰는지 phase 2 검증) — 추출 임계 미달. phase 2 task 가 fixture variant 통합 시 동반 추출 검토.
- **directory.md `test/` 트리 갱신** — `test/helpers/` 디렉토리 신설을 directory.md L40 ~ L44 의 `test/` sub-dir 표에 추가. doc-only direct follow-up 1-2 줄. 본 task scope 외 — main scope 가 test refactor.
- **helper 모듈의 own unit spec 신설** — `test/helpers/prisma-mock.spec.ts` — helper 의 단순성으로 ROI 낮음 + collectCoverageFrom scope 밖. migration 된 smoke/e2e spec 이 indirect cover. 별도 strict policy 가 필요해지면 future task.
- **GroupService / GroupController / Group DTO backbone** — Part 와 대칭, N:M membership 책임. 별도 backbone task (~280 LOC / cap tight). 본 task 머지 후 진입 가능.
- **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse. 본 task 머지 후 helper 가 이미 추출돼 있어 신규 spec 작성 비용 절감 — 별도 test-quality task 책임.
- **Part 의 update (PATCH) endpoint** — service.update + controller.patch + UpdatePartDto + spec 추가. 별도 follow-up.
- **Person.partId NOT NULL 전환 + default Part seed migration** — T-0039 §Follow-ups 의 별도 schema task.
- **p3-implementation-plan.md §2 표 T-0047 row 추가** — T-0046 row 박제와 함께 별도 doc-only direct follow-up task. 본 task 는 plan 변경 0.
- **production 코드 / DTO / repository / service / module 변경 일절 금지** — src/ production 파일 read-only. 본 task 는 test infrastructure 만.
- **새 ADR 신설** — 본 task 는 mechanical refactor. helper 모듈 위치 결정 (test/helpers/) 은 directory.md §"Top-level 디렉토리 트리" 에 이미 자연 fit — ADR 신설 임계 미달.

## Suggested Sub-agents

`implementer → tester` (pr-mode 표준 chain — architect skip).

- **architect**: skip — 본 task 는 mechanical 추출 + migration. 결정 박제 0 (helper 시그니처는 기존 inline 과 동일, 위치는 directory.md test/ layout 에 자연 fit). 단 implementer 가 fixture default id `"cuid-default"` vs spec 별 변종 1 줄 JSDoc 박제.
- **implementer**: `test/helpers/prisma-mock.ts` 신설 + smoke spec inline 삭제 + e2e spec inline 삭제 + 양쪽 import 추가. 3 파일 / ~80 LOC 신규 + ~80 LOC 삭제 = net 작음 (cap 보존 안전). 기존 시그니처 보존 검증.
- **tester**: 6종 grand validation (`pnpm lint && pnpm build && pnpm test && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`) + 기존 221 unit + 11 smoke + 13 e2e test 회귀 없음 검증 + coverage threshold global 통과 (helper 가 coverage scope 밖).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **phase 2 — src/user/*.spec.ts 5 spec migration** — `person.service.spec.ts` / `person.controller.spec.ts` / `person.repository.spec.ts` / `part.service.spec.ts` / `part.controller.spec.ts` 의 inline helper 제거 + fixture variant 통합 (partId default policy 결정). 별도 task 의 architect decision 동반 — `buildPersonFixtureForRepository(overrides)` 변종 신설 또는 unified default + 호출 spec 별 override 강제. cap 보존 (5 spec 수정 / fixture 시그니처 결정 1 ADR-less).
- [ ] **directory.md `test/` 트리 갱신** — `test/helpers/` 디렉토리 신설 박제. doc-only direct ~3 LOC.
- [ ] **buildPartFixture 추출** — `part.service.spec.ts` L25 의 Part fixture. phase 2 또는 GroupService backbone 진입 시 GroupFixture 와 함께 추출.
- [ ] **GroupService + GroupController + Group DTO backbone** — Part 와 대칭의 Group 책임. 별도 backbone task (~280 LOC / cap tight). 본 task 머지 후 helper 가 이미 추출돼 있어 새 spec 비용 절감.
- [ ] **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse + 본 task 의 helper import. 별도 test-quality task 2 종.
- [ ] **PERSON_DTO_FIELDS / messageText / expectDtoFields 추출** — e2e spec local 3 helper. GroupController / PartController e2e 진입 후 누적 시 follow-up.
- [ ] **p3-implementation-plan.md §2 표 T-0046 ~ T-0047 row 추가** — doc-only direct.
- [ ] **PersonService 에 partId mandatory invariant** — Person create / update 시 partId 검증 (PartService.findById 호출로 존재 강제). 별도 follow-up.
