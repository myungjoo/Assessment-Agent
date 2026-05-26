---
id: T-0051
title: ADR-0004 — smoke/e2e CI DB mode policy (mock vs real PostgreSQL trade-off 박제) (pr-mode)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-058]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-05-26
plannerNote: P3 user-added bullet (d27a47d, PLAN.md L66) 의 ADR 동반 박제 — mock vs real PostgreSQL 의 trade-off + 선택 사유 + 후속 e2e cleanup 정책. 실 CI infra 변경은 후속 T-0052 책임 (cap 보존 + risk 분리).
dependsOn: [T-0043, T-0044, T-0050]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/PLAN.md L66 (d27a47d 사용자 추가 bullet — "[테스트 품질] CI smoke/e2e real PostgreSQL 전환 ... ADR 동반 — mock vs real 의 trade-off (CI 속도 vs 통합 정확도) 박제 + 선택 사유 + 후속 e2e cleanup (`afterEach` truncate) 정책") + docs/decisions/ADR-0002-db.md (기존 ACCEPTED — Prisma + PostgreSQL 채택, 본 ADR 의 reference) + .github/workflows/ci.yml L24-80 (현재 CI 8 step + smoke + e2e step) + test/helpers/prisma-mock.ts (현 mock PrismaService override 패턴 — T-0043/T-0044 사용) + 사용자 정책 변경 (2026-05-26, PLAN.md L66 본문 "사용자 정책 변경" 명시) + driver-supplied 후보 (c) "d27a47d real PostgreSQL CI 전환" — driver recommendation 우선순위 1. **분리 효과**: 본 task = ADR 박제 (~120 LOC / 2 파일, 의사결정만) → 후속 T-0052 = 실 CI infra 변경 (`.github/workflows/ci.yml` 의 services.postgres / DATABASE_URL env / pnpm prisma migrate deploy step + smoke/e2e 의 override 제거 또는 `TEST_DB_MODE` 분기) — ~200 LOC / 4-5 파일 pr-mode. ADR-first 가 (i) 의사결정의 reviewer 점검 분리 (ii) 실 infra task 가 ADR reference 만으로 self-contained 진행 (iii) 본 cap-close 직전 turn 의 risk 최소화 — 큰 CI infra 변경을 next session executor 의 fresh context 에 위임. coversReq: REQ-029 (non-volatile 저장 — 실 DB 통합 검증의 정합) + REQ-058 (운영 정책 — test 정책 박제).
---

# T-0051 — ADR-0004 — smoke/e2e CI DB mode policy (mock vs real PostgreSQL)

## Why

[PLAN.md L66](../PLAN.md) 가 2026-05-26 사용자 commit d27a47d 로 새 P3 test-quality bullet 을 추가했다: **"CI smoke/e2e real PostgreSQL 전환"**. 본문이 "**ADR 동반** — mock vs real 의 trade-off (CI 속도 vs 통합 정확도) 박제 + 선택 사유 + 후속 e2e cleanup (`afterEach` truncate) 정책" 을 명시 요구.

현재 상황:

- [T-0043](T-0043-smoke-test-persons-domain-endpoint-expansion.md) (smoke `/api/persons` 5 endpoint, e7bb95a) 와 [T-0044](T-0044-e2e-test-persons-domain-endpoint-expansion.md) (e2e `/api/persons` HTTP contract depth, 2b9131d) 는 [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) 의 `PrismaService` `Test.overrideProvider` mock 으로 실 DB 없이 supertest 실행. CI 빠르고 isolation 강하나, 실 PostgreSQL 동작 검증 0.
- 사용자 정책 변경 (PLAN.md L66 본문 명시): mock 이 아닌 **실 PostgreSQL 을 CI 안에서 직접 띄워 통합 검증**.

본 task 는 **ADR-0004 신설만** — 의사결정 박제. 실 CI 인프라 변경은 **후속 T-0052 책임** (cap 보존 + risk 분리):

1. **ADR 분리의 이유** ([CLAUDE.md §3.1](../../CLAUDE.md)): 새 ADR 자체는 pr-mode (reviewer 의 architecture 점검 대상). 코드 변경 동반하면 cap 초과 (~330 LOC / 6-7 파일) 위험.
2. **위험 분리**: CI infra 변경 (`.github/workflows/ci.yml` services.postgres + migrate deploy + smoke/e2e override 제거) 은 fresh-context next session executor 가 ADR reference 로 self-contained 진행. 본 cap-close 직전 turn 의 risk 최소화.
3. **ADR-first 가 task 시퀀스의 cleanest 분리**: ADR 박제 → reviewer round 1 의사결정 확정 → 후속 코드 task 의 implementer/tester 가 ADR 의 trade-off 표 / 선택 사유 / cleanup 정책을 참조하여 1:1 박제.

본 ADR 의 의사결정 axis:

| axis | mock (현재) | real (제안) |
| --- | --- | --- |
| **CI 속도** | 빠름 (~30s smoke + ~60s e2e, DB 부트스트랩 0) | 느림 (~+30-60s container 부트스트랩 + migrate deploy) |
| **통합 정확도** | 낮음 (Prisma adapter / pg driver / DB constraint 동작 0 검증) | 높음 (실 P2002 / P2003 / cascade / unique constraint 실 발화) |
| **격리** | 강함 (mock instance 매 test 새로 생성, leakage 0) | 약함 (DB state 가 test 간 leak 가능 — `afterEach` truncate 필수) |
| **debugging** | 단순 (mock 이 throw 직접 박제) | 복잡 (DB error 가 driver 경유) |
| **flakiness 위험** | 매우 낮음 | 중간 (container 부트 시간 / 네트워크 / port conflict) |
| **infra 복잡도** | 0 (mock 만) | 중간 (services.postgres + DATABASE_URL + migrate deploy) |

본 ADR 의 권장 선택은 **real PostgreSQL** (사용자 정책 변경 PLAN.md L66 의 의도) — 단, mock 도 unit-only 보조로 유지 가능 여부 + cleanup 정책 + flakiness mitigation 박제.

REQ 매핑: [REQ-029](../requirements.md) (평가 자료 non-volatile 저장 — 실 DB 통합 검증의 정합) + [REQ-058](../requirements.md) (운영 정책 underlying).

## Required Reading

- [docs/PLAN.md](../PLAN.md) L66 — 본 ADR 의 1차 source. 사용자 추가 bullet 의 본문 (ADR 동반 요구 / mock vs real trade-off / 선택 사유 / cleanup 정책).
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — 기존 ACCEPTED ADR. PostgreSQL + Prisma 채택의 근거. 본 ADR 은 ADR-0002 위에서 "CI 안에서 실 DB 통합 검증" 의 정책을 결정 — supersede 아닌 보강.
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — Jest + supertest test stack. 본 ADR 의 e2e cleanup 정책 (jest hook `afterEach` 또는 `beforeEach`) source.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Monolith / 단일 DB 인스턴스. 본 ADR 의 CI service container 선택이 ADR-0003 의 단일 DB 가정과 정합.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) L24-80 — 현재 CI 8 step (checkout / spec-presence / pnpm / Node / install / lint / build / test:cov / test:smoke / test:e2e / reviewer-gate). 본 ADR 의 후속 task (T-0052) 가 변경할 step (`services:` 블록 신설 / DATABASE_URL env / migrate deploy step 추가 / test:smoke + test:e2e 의 env 주입). 본 task 는 본 파일 변경 0.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 현 mock PrismaService override 패턴. 본 ADR 이 결정할 "mock 의 위상" (unit-only 보조 vs deprecated vs `TEST_DB_MODE` 분기) source.
- [test/jest-smoke.json](../../test/jest-smoke.json) + [test/jest-e2e.json](../../test/jest-e2e.json) — 현 jest config. 본 ADR 의 cleanup 정책 (jest globalSetup / globalTeardown / afterEach) reference.
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — PrismaService 박제. 본 ADR 이 결정할 "real DB 모드 에서 onModuleInit() $connect / onModuleDestroy() $disconnect 정책" reference.
- [prisma/schema.prisma](../../prisma/schema.prisma) — schema 파일. 본 ADR 의 후속 task (T-0052) 의 migrate deploy step 의 source.
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §4 ADR 신설 후보 — 본 ADR 은 §4 표의 5 후보 (ADR-0002 보강 / ADR-0004 auth / ADR-0005 cross-cutting / ADR-0006 LLM key / ADR-0007 audit) 와 별도 신설 (test 정책 차원, P3 의 6 번째 ADR 후보로 자연 추가).
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 인덱스. 본 ADR 의 reference 만 — ADR 은 INDEX.md 아닌 ADR-NNNN 자체로 박제.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — 새 ADR 신설) / §3.2 (R-110~R-114) / §11 (trail blob) / §12 (한국어 본문).
- [docs/tasks/T-0050-group-service-crud.md](T-0050-group-service-crud.md) — 직전 머지 task (4ed4321). 본 task 의 dependsOn (cap-close 직전 turn 의 직전 머지 reference).

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0051-adr-0004-smoke-e2e-db-mode-policy` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `docs/decisions/ADR-0004-smoke-e2e-db-mode-policy.md` 신규 (~110 LOC, 7 표준 단락)**:

- [ ] **frontmatter**:
  - `id: ADR-0004`
  - `title: smoke/e2e CI DB mode policy — mock vs real PostgreSQL 의 trade-off + 선택 사유 + cleanup 정책`
  - `status: ACCEPTED` (본 task 머지 시점 정식 ACCEPTED — 후속 T-0052 의 implementer 가 본 ADR 의 결정에 따라 진행)
  - `date: 2026-05-26`
  - `relatedTask: T-0051`
  - `supersedes: null`
  - `amendments: []` (초기)
- [ ] **§ Context** — 다음을 박제 (~25 LOC):
  - PLAN.md L66 사용자 정책 변경 (2026-05-26, d27a47d commit) — 본 ADR 의 1차 trigger.
  - 현재 상태: T-0043 (smoke) + T-0044 (e2e) 가 test/helpers/prisma-mock.ts 의 mock PrismaService override 사용 — 실 PostgreSQL 동작 검증 0.
  - 외력: REQ-029 (non-volatile 저장) — 실 DB 통합 검증이 REQ-029 의 정합 보강. REQ-058 (운영 정책) — test 정책의 ADR 박제 의무.
  - ADR-0002 reference — Prisma + PostgreSQL 채택의 기반. 본 ADR 은 supersede 가 아닌 test layer 의 보강.
- [ ] **§ Decision** — 다음을 박제 (~30 LOC):
  - **선택**: smoke / e2e test 가 CI 안에서 **실 PostgreSQL 16 container** (GitHub Actions `services:` block 의 `postgres:16-alpine` image) 위에서 실행. mock PrismaService override 는 **unit test 만 사용** (unit-only 보조 위상).
  - 근거 5 항목 — 각 1-2 줄:
    1. **REQ-029 (non-volatile 저장) 정합** — 실 DB 동작 검증 0 의 risk 해소.
    2. **Prisma adapter / pg driver 의 real-world 동작 검증** — mock 이 cover 못 하는 layer (connection pool / transaction / cascade / unique constraint 실 발화).
    3. **flakiness mitigation 박제 가능** — `services:` block 의 `health-cmd` (`pg_isready`) + `health-interval` + `health-retries` 로 부트 시간 stabilize.
    4. **infra 복잡도 acceptable** — `.github/workflows/ci.yml` 의 ~10-15 LOC 추가 (services block + DATABASE_URL env + migrate deploy step) 로 충분, 별도 docker-compose CI mount 불요.
    5. **격리 정책** — `afterEach` truncate 전략 (TRUNCATE TABLE ... CASCADE) 으로 test 간 state leak 0. unit 의 mock 격리와 동등 수준.
  - **mock 의 위상 결정**: unit-only 보조 (deprecated 아님, 유지). 이유: unit test 가 실 DB 부트 비용 회피 가능 + mock 이 Prisma error code 변환 분기 (P2002 / P2025 / P2003 / unknown) 의 explicit 박제로 negative case cover 에 유리.
  - **`TEST_DB_MODE` env var 분기 미적용** — 단순화 위해. smoke/e2e = real 고정, unit = mock 고정.
- [ ] **§ Consequences** — 다음을 박제 (~25 LOC):
  - **양의**: (1) REQ-029 정합 검증 (2) Prisma adapter / pg driver / DB constraint 실 동작 cover (3) cascade 정책 (PersonGroupMembership onDelete: Cascade 등) 의 실 동작 검증 (4) unit / smoke / e2e 의 layer 책임 명확 (unit = mock / smoke = real bootstrap / e2e = real HTTP contract).
  - **음의**: (1) CI 시간 +30-60s 증가 (container 부트 + migrate deploy + test 실행) (2) flakiness risk (mitigation: health check) (3) DB state cleanup 책임 (`afterEach` truncate) (4) CI runner 의 메모리 / CPU 부담 약간 증가.
  - **migration 의무**: 본 ADR 머지 후 후속 T-0052 의 implementer 가 `.github/workflows/ci.yml` 에 services.postgres block + DATABASE_URL env + migrate deploy step 추가 + smoke/e2e 의 PrismaService override 제거 + `afterEach` truncate helper 도입.
- [ ] **§ Alternatives considered** — 다음을 박제 (~15 LOC):
  - **(a) mock 유지** (status quo) — REQ-029 정합 0, 사용자 정책 변경 무시 — 기각.
  - **(b) docker-compose mount** — GitHub Actions runner 가 docker-compose 실행, smoke/e2e 가 그 위에서 동작. CI runner 의 docker daemon 부담 + setup 복잡 — services block 보다 LOC 증가 — 기각.
  - **(c) `TEST_DB_MODE` env var 분기** — smoke/e2e 가 mode 별로 mock 또는 real 분기. 단순화 vs 유연성 trade-off — 본 ADR 은 단순화 우선 — 기각.
  - **(d) ephemeral managed DB (예: Neon Branch)** — 외부 dependency 추가 + credentials 관리 — 기각 (단일 operator 운영 회피 정책).
  - **(e) sqlite fallback** — Prisma 의 sqlite + postgresql provider 변경 부담 + schema 차이 (cascade / unique constraint 동작 차이) — 기각.
- [ ] **§ Cleanup 정책 박제** — 다음을 박제 (~10 LOC):
  - **strategy**: `afterEach` 에 truncate (TRUNCATE TABLE persons, parts, groups, person_group_memberships, service_identities CASCADE). DELETE 보다 빠름 + sequence reset 동반 (RESTART IDENTITY).
  - **helper 위치**: `test/helpers/db-truncate.ts` (후속 T-0052 신설). 본 ADR 은 위치 박제만, 신설은 T-0052.
  - **TRUNCATE 순서**: cascade 가 자동 처리하므로 순서 무관. 단, sequence reset 위해 RESTART IDENTITY 명시.
  - **alternative**: jest `globalTeardown` 에 DROP SCHEMA + CREATE SCHEMA — 더 강력하나 매 test 마다 migrate deploy 재실행 부담 — `afterEach` truncate 채택.
- [ ] **§ References** — 다음 박제 (~5 LOC):
  - [ADR-0001](ADR-0001-stack.md) — Jest + supertest stack
  - [ADR-0002](ADR-0002-db.md) — PostgreSQL + Prisma
  - [ADR-0003](ADR-0003-deployment.md) — Monolith / 단일 DB
  - [PLAN.md L66](../../docs/PLAN.md) — 사용자 추가 bullet (d27a47d)
  - [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 현 CI 워크플로우 (T-0052 변경 대상)
  - [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — mock 패턴 (unit-only 보조 유지)
  - [docs/tasks/T-0043, T-0044](../tasks/) — 현 smoke/e2e 의 mock 사용 source
- [ ] 본문 한국어 (§12 의무).
- [ ] frontmatter status `ACCEPTED` — 후속 T-0052 의 implementer 가 본 ADR 의 결정에 따라 즉시 진행 가능.

**B. `docs/architecture/INDEX.md` 갱신 (~5 LOC) — optional**:

- [ ] ADR-0004 의 row 추가 (decisions/ INDEX 가 있다면). 단 본 repo 의 INDEX.md 는 ADR 인덱스 보유 안 함 — 본 항목 적용 안 됨 (skip).

**C. `docs/PLAN.md` L66 bullet 갱신 (~3 LOC)**:

- [ ] L66 bullet 끝에 `**ADR-0004 박제 완료 (T-0051) — 후속 T-0052 가 본 ADR 의 결정에 따라 .github/workflows/ci.yml services.postgres + DATABASE_URL env + migrate deploy step + smoke/e2e override 제거 + afterEach truncate helper 추가.**` append.
- [ ] PLAN.md 변경은 본 task 의 pr-mode commit 안에서 함께 처리 — direct/pr split 안 함 (ADR 신설 자체가 pr-mode 이므로 같은 PR 안에서 사용자-facing bullet update).

**D. R-110~R-114 cover**:

- [ ] **R-110 (코드 검토 + test + 실행)** — 본 task 는 production code 변경 0 / test 변경 0 — doc-only. tester 는 `pnpm lint && pnpm build && pnpm test && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 6 명령 실행하여 regression 0 확인 (R-110 의 검증 단계 — doc-only ADR 머지가 어떤 코드 흐름도 깨지 않음).
- [ ] **R-111 (CI fail = merge 차단)** — CI 의 8 step 모두 green 유지. ADR 신설은 CI 의 어떤 step 도 변경 안 함 (regression 0 expectation).
- [ ] **R-112 (happy/error/branch/negative)** — 본 task 는 production 코드 추가 0 — R-112 의 4 카테고리 cover 의무 면제 (doc-only ADR). Acceptance §D 의 R-112 검산에서 "production 코드 0 — doc-only ADR, R-112 cover 의무 면제" 명시.
- [ ] **R-113 (smoke + e2e)** — 본 task 는 smoke/e2e test 변경 0 — 기존 smoke/e2e regression 0 확인 (위 R-110 의 6 명령에 포함).
- [ ] **R-114 (CI 수행)** — push 후 driver 가 `gh run list` 로 CI conclusion 확인 (LOOP.md §1 [5]).

**E. 검증 명령**:

- [ ] `pnpm lint` pass (0 error).
- [ ] `pnpm build` pass (TypeScript 컴파일 — ADR 변경은 src/ 영향 0).
- [ ] `pnpm test` pass — regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold 통과 (line ≥ 80% / function ≥ 80%, regression 0).
- [ ] `pnpm test:smoke` pass — regression 0.
- [ ] `pnpm test:e2e` pass — regression 0.

**F. PR / commit / push**:

- [ ] feature branch `claude/T-0051-adr-0004-smoke-e2e-db-mode-policy` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `docs(adr): ADR-0004 smoke/e2e CI DB mode policy 박제 (T-0051)`.
- [ ] commit body 본문 한국어 (§12) — why / 결정 요약 / mock vs real 표 / 후속 T-0052 책임 명시 ~5-7 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added: none / result: pass / coverage: regression 0) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함. ARCHITECT 섹션 생략 (architect 호출 안 함 — ADR 자체가 architect 의 산출물이나 implementer 가 직접 박제).
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~F 체크리스트 + ADR-0004 mock vs real 표 inline (reviewer 의 의사결정 확인 용이).
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **`.github/workflows/ci.yml` 의 services.postgres / DATABASE_URL env / migrate deploy step 추가** — 후속 T-0052 책임. 본 ADR 의 결정에 따라 박제.
- **test/helpers/prisma-mock.ts 의 unit-only 보조 deprecation 표기 또는 위상 변경** — 후속 T-0052 책임. 본 ADR 의 "unit-only 보조 유지" 결정 reference.
- **test/helpers/db-truncate.ts 의 helper 신설** — 후속 T-0052 책임. 본 ADR 의 "`afterEach` truncate" 정책 reference.
- **test/jest-smoke.json / test/jest-e2e.json 의 globalSetup / globalTeardown / afterEach hook 추가** — 후속 T-0052 책임.
- **smoke/e2e test 파일 (`test/smoke/*.smoke-spec.ts` / `test/*.e2e-spec.ts`) 의 PrismaService override 제거 + real DB query 동작 검증** — 후속 T-0052 책임.
- **새 외부 dependency** — ADR 박제 만, 패키지 추가 0.
- **새 ADR 추가 (예: ADR-0005 cross-cutting field)** — 본 task 는 ADR-0004 단일. ADR-0005~0007 후보는 [p3-implementation-plan.md §4](../architecture/p3-implementation-plan.md) 의 별도 follow-up task 책임.
- **ADR-0002 boundary 변경** — 본 ADR 은 ADR-0002 위 보강, supersede 0.
- **GroupController + Group DTO + REST endpoints** — driver-supplied 후보 (a2). 후속 T-0052 또는 T-0053 책임. 본 task 와 별도 backbone task.
- **GroupService.addMember / removeMember N:M ops** — driver-supplied 후보 (b2). 별도 후속 task 책임.
- **phase 2 src/user/*.spec.ts migration to prisma-mock.ts helper** — driver-supplied 후보 (d). 별도 후속 task 책임.
- **p3-implementation-plan.md §2 표 T-0046~T-0051 row 추가** — driver-supplied 후보 (e). 별도 doc-only direct follow-up.
- **REQ-COVERAGE-AUDIT.md 갱신** — REQ-029 / REQ-058 cover 의 박제 갱신은 별도 doc-only follow-up.

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (ADR 신규) + §C (PLAN.md L66 bullet append) 2 파일 staging. ADR 본문은 상기 7 단락 박제. PLAN.md 갱신은 한 줄 append 만. 한국어 본문 (§12).
- **tester**: §E 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + regression 0 확인. spec 추가 없음 (doc-only ADR).
- **architect** 호출 안 함 — 본 ADR 자체가 architect 의 산출물이나 driver-supplied 후보 + planner pre-fill 의 7 단락 박제 + driver 의 trade-off 표 supply 로 implementer 직접 박제 가능 (자유도 낮음). 만약 implementer 가 §Decision 의 trade-off 표 / 근거 5 항목 / Alternatives 5 종 박제 중 추가 의사결정 발생 시 architect 호출 후 재진입.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]). T-0048 race-fix 패턴 reuse — comment-triggered rerun 자동 absorption 기대 (`gh run rerun` 0 회 목표 — T-0049 / T-0050 패턴 지속 검증).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **T-0052 (예상): CI smoke/e2e real PostgreSQL 전환 실 구현** — 본 ADR 의 결정에 따라 (a) `.github/workflows/ci.yml` services.postgres:16-alpine block + health-cmd + DATABASE_URL env (b) migrate deploy step 추가 (c) test/helpers/db-truncate.ts helper 신설 (d) test/jest-smoke.json + test/jest-e2e.json 에 afterEach truncate hook (e) smoke/e2e 의 PrismaService override 제거 + real query 동작 검증. ~200-250 LOC / 4-5 파일 pr-mode.
- [ ] **GroupController + Group DTO + REST endpoints** (driver-supplied 후보 a2) — `/api/groups` 5 endpoint + CreateGroupDto + class-validator + module wiring + controller spec. PartController (T-0046) 1:1 mirror. ~350-400 LOC / 4-5 파일 pr-mode. T-0050 §Follow-ups L173 reference.
- [ ] **GroupService.addMember / removeMember N:M ops** (driver-supplied 후보 b2) — PersonGroupMembershipRepository (T-0049) 호출 + spec + controller endpoint. ~200 LOC / 2-3 파일.
- [ ] **phase 2 src/user/*.spec.ts migration to test/helpers/prisma-mock.ts** (driver-supplied 후보 d) — 5 spec 파일 mechanical migration. T-0047 helper 의 본격 활용. ~150 LOC / 5 파일 pr-mode (cap-borderline — split 가능성).
- [ ] **p3-implementation-plan.md §2 표 T-0046~T-0051 row 추가** (driver-supplied 후보 e) — T-0045 패턴 재실행. doc-only direct ~40-50 LOC.
- [ ] **directory.md `src/user/group.service.ts` 박제** — T-0050 §Follow-ups L177 reference. doc-only direct ~5 LOC.
- [ ] **ADR-0004 후속 amendment** — T-0052 머지 후 ADR-0004 의 amendments[] 에 mergeCommit + 실 적용된 services.postgres 정확 image tag / health-cmd interval / migrate step 박제. 1-2 LOC ADR frontmatter 직접 갱신 (`amendments[].date/task/decision` 추가) — doc-only direct, ADR status 변경 0 따라 §3.1 rule 4 의 단순 갱신 = direct.
- [ ] **T-0048 race-fix 3 회차 dogfood 검증** — T-0049 (1 회차 SUCCESS) + T-0050 (2 회차 SUCCESS) 후 본 task 가 3 회차. integrator 의 comment-triggered rerun 자동 absorption 의 지속 동작 monitoring. `gh run rerun` 0 회 목표.
