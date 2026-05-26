---
id: ADR-0004
title: smoke/e2e CI DB mode policy — mock vs real PostgreSQL 의 trade-off + 선택 사유 + cleanup 정책
status: ACCEPTED
date: 2026-05-26
relatedTask: T-0051
supersedes: null
amendments: []
---

# ADR-0004 — smoke/e2e CI DB mode policy

## Context

본 ADR 은 [PLAN.md L66](../PLAN.md) 가 2026-05-26 사용자 commit `d27a47d` 로 추가한 P3 test-quality bullet — **"CI smoke/e2e real PostgreSQL 전환"** — 을 정식 의사결정으로 박제한다. 해당 bullet 본문이 "**ADR 동반** — mock vs real 의 trade-off (CI 속도 vs 통합 정확도) 박제 + 선택 사유 + 후속 e2e cleanup (`afterEach` truncate) 정책" 을 명시 요구한다.

현재 상태:

- [T-0043](../tasks/T-0043-smoke-test-persons-domain-endpoint-expansion.md) (smoke `/api/persons` 5 endpoint, commit `e7bb95a`) 와 [T-0044](../tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md) (e2e `/api/persons` HTTP contract depth, commit `2b9131d`) 는 [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) 의 `PrismaService` `Test.overrideProvider` mock 으로 실 DB 없이 supertest 를 돌린다. 결과: **CI 빠르고 isolation 강하나, 실 PostgreSQL 의 동작 검증은 0**.
- mock 의 한계: Prisma adapter / pg driver / DB constraint (unique / foreign key / cascade) / connection pool 의 실 동작이 어떤 layer 에서도 검증되지 않는다. mock 안에서 throw 된 `P2002` / `P2025` 는 박제된 에러일 뿐 실 PostgreSQL 이 같은 조건에서 같은 에러를 실제로 발화하는지 확인 불가.

외력:

- **REQ-029** ([README.md](../../README.md) 56 행 — 평가 자료 **non-volatile 저장**): 실 DB 통합 검증 0 은 REQ-029 정합의 사각지대. 실 PostgreSQL durability path 가 CI 안에서 한 번이라도 발화돼야 정합 검증이 의미를 갖는다.
- **REQ-058** ([README.md](../../README.md) 운영 정책 underlying — 운영 시 사람이 개입하지 않고 코드 평가 자동화): test 정책의 자동화는 ADR 박제로만 long-horizon 일관성이 보장된다.
- **사용자 정책 변경 2026-05-26** ([PLAN.md L66](../PLAN.md), commit `d27a47d`): mock 이 아닌 **실 PostgreSQL 을 CI 안에서 직접 띄워 통합 검증** 으로 정책 전환. 본 ADR 의 1 차 trigger.

[ADR-0002](ADR-0002-db.md) reference: PostgreSQL + Prisma 채택의 기반 ADR. **본 ADR 은 ADR-0002 의 supersede 가 아닌 test layer 의 보강** — ADR-0002 는 production / dev / 운영 DB 선택, 본 ADR 은 CI 의 smoke/e2e test 가 그 DB 위에서 어떻게 돌지의 정책.

## Decision

smoke / e2e test 는 CI 안에서 **실 PostgreSQL 16 container** 위에서 실행한다. mock PrismaService override 는 **unit test 만 사용** (unit-only 보조 위상으로 유지).

구체:

- **CI container**: GitHub Actions `services:` block 의 `postgres:16-alpine` image. ADR-0002 §1 의 "Docker container 또는 host 직접 설치" 와 정합 — CI 는 container path 채택.
- **DB 부트 stabilize**: `services.postgres.options` 의 `--health-cmd "pg_isready"` + `--health-interval 5s` + `--health-retries 10` 으로 부트 시간 stabilize. flakiness mitigation 의 1 차 layer.
- **migration**: `pnpm prisma migrate deploy` step 을 test 실행 직전에 추가. schema 의 source of truth 는 `prisma/schema.prisma` (ADR-0002 §Decision 5 와 정합).
- **smoke/e2e 모드**: PrismaService override 제거, 실 DATABASE_URL 주입. unit 은 mock 그대로 유지.

근거 (5 항목):

1. **REQ-029 (non-volatile 저장) 정합** — 실 DB 의 WAL + fsync durability path 가 CI 에서 한 번이라도 발화돼야 REQ-029 의 정합 검증이 의미를 갖는다. mock 으로는 본질적으로 cover 불가능한 layer.
2. **Prisma adapter / pg driver 의 real-world 동작 검증** — connection pool / transaction (`$transaction`) / cascade (`onDelete: Cascade`) / unique constraint (`P2002`) / foreign key (`P2003`) / record not found (`P2025`) 의 실 발화 path. mock 은 박제된 에러 객체일 뿐 — Prisma 의 error code 변환 로직 (pg error → Prisma error code) 자체를 검증 못 한다.
3. **flakiness mitigation 박제 가능** — `services:` block 의 `health-cmd "pg_isready"` + `health-interval 5s` + `health-retries 10` 으로 container 부트 시간 stabilize. 본 ADR 채택과 동시에 flakiness 의 mitigation layer 도 1 급으로 박제.
4. **infra 복잡도 acceptable** — `.github/workflows/ci.yml` 의 약 10-15 LOC 추가 (services block + DATABASE_URL env + migrate deploy step) 로 충분. 별도 docker-compose CI mount / managed service / 외부 dependency 도입 0.
5. **격리 정책 충분 박제 가능** — `afterEach` truncate 전략 (아래 §Cleanup 정책 박제) 으로 test 간 state leak 0. unit 의 mock 격리와 동등 수준의 isolation 확보 가능.

**mock 의 위상 결정**: **unit-only 보조 유지** (deprecated 아님).

- 이유 1: unit test 가 실 DB 부트 비용 회피 가능 — unit 은 빠르게 도는 게 가치.
- 이유 2: mock 이 Prisma error code 변환 분기 (P2002 / P2025 / P2003 / unknown) 의 explicit 박제로 R-112 negative case cover 에 유리 — 실 DB 로는 강제로 unknown error 를 발생시키기 어렵다.
- 이유 3: unit / smoke / e2e 의 layer 책임 분리가 명확해진다 — unit = 로직 단위 (mock), smoke = bootstrap 정합 (real), e2e = HTTP contract (real).

**`TEST_DB_MODE` env var 분기 미적용**: 단순화 우선. smoke/e2e = real 고정, unit = mock 고정. 사용자가 unit 만 돌리고 싶으면 `pnpm test`, smoke/e2e 는 `pnpm test:smoke` / `pnpm test:e2e` 의 분리된 jest config 가 그 역할을 이미 한다 — env var 분기는 중복.

## Consequences

### 양의

1. **REQ-029 정합 검증** — 실 PostgreSQL durability path 가 CI 마다 발화. 본 ADR 의 1 차 목표 달성.
2. **Prisma adapter / pg driver / DB constraint 실 동작 cover** — `P2002` / `P2003` / `P2025` 의 실 발화 + Prisma error 변환 path 의 실 검증. mock 이 cover 못 하던 layer.
3. **cascade 정책 실 동작 검증** — `PersonGroupMembership.onDelete: Cascade` 등 schema 의 cascade 가 실 PostgreSQL 에서 의도대로 동작하는지 e2e 단계에서 자연스럽게 검증.
4. **unit / smoke / e2e 의 layer 책임 명확** — unit = mock (로직), smoke = real (bootstrap 정합), e2e = real (HTTP contract). 각 layer 의 책임이 1 차원적으로 분리.
5. **ADR-0002 의 후속 박제 완성** — ADR-0002 가 "PostgreSQL 채택" 까지 박제, 본 ADR 이 "CI 에서 그 DB 를 어떻게 쓸지" 까지 박제. test layer 의 ADR coverage 가 ADR-0002 와 같은 수준으로 올라온다.

### 음의

1. **CI 시간 +30-60s 증가** — container 부트 + migrate deploy + test 실행. 단 본 시점 CI 의 전체 wall time (~3-5 min) 대비 비율 작음 — long-horizon agent 의 turn 간격 (KST 02:00·14:00 cron) 대비 무시 가능.
2. **flakiness risk** — container 부트 / 네트워크 / port conflict. mitigation: `health-cmd "pg_isready"` + `health-interval` + `health-retries` 명시 (위 §Decision 참조).
3. **DB state cleanup 책임** — test 간 state leak 방지 의무 발생. `afterEach` truncate 로 처리 (아래 §Cleanup 정책 박제).
4. **CI runner 의 메모리 / CPU 부담 약간 증가** — postgres 16-alpine container 가 standard runner 의 7 GB RAM 안에서 충분 — production-scale workload 가 아니므로 영향 미미.

### Migration 의무 (후속 task)

본 ADR 머지 후 후속 **T-0052** 의 implementer 가 다음 5 항목을 박제한다:

1. `.github/workflows/ci.yml` 에 `services.postgres:16-alpine` block 추가 (health-cmd / health-interval / health-retries 포함).
2. `.github/workflows/ci.yml` 의 `test:smoke` / `test:e2e` step 에 `DATABASE_URL` env var 주입.
3. `.github/workflows/ci.yml` 에 `pnpm prisma migrate deploy` step 추가 (test step 직전).
4. smoke/e2e test 파일의 `Test.overrideProvider(PrismaService)` 제거 — real PrismaService 가 실 container 에 연결.
5. `test/helpers/db-truncate.ts` helper 신설 + `test/jest-smoke.json` / `test/jest-e2e.json` 의 `afterEach` 또는 `globalSetup` 에서 호출.

본 ADR 자체는 위 5 항목을 **결정만** 박제 — 실 구현은 후속 task.

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(a) mock 유지** (status quo) | CI 가장 빠름 / infra 0 | **REQ-029 정합 0** — 사용자 정책 변경 무시 / Prisma adapter / pg driver / DB constraint 실 동작 검증 0 | 기각 |
| **(b) docker-compose mount** | docker-compose.yml 1 파일로 모든 서비스 박제 가능 | GitHub Actions runner 의 docker daemon 부담 + setup step 복잡 / services block 보다 LOC 증가 / runner 의 docker-compose 버전 의존성 | 기각 |
| **(c) `TEST_DB_MODE` env var 분기** | mock/real 양쪽 mode 병행 — 개발자가 빠른 iteration 선택 가능 | 단순화 vs 유연성 trade-off — 본 ADR 은 단순화 우선 / jest config 가 이미 unit/smoke/e2e 의 분리를 제공하므로 env 추가 분기 중복 | 기각 |
| **(d) ephemeral managed DB (예: Neon Branch)** | 운영급 PostgreSQL 환경에서 검증 / branch isolation 자동 | 외부 dependency 추가 + credentials 관리 의무 / [CLAUDE.md §5](../../CLAUDE.md) "외부 자격증명 필요" BLOCKED 게이트 발화 / 비용 발생 | 기각 (단일 operator 운영 회피 정책) |
| **(e) sqlite fallback** (Prisma SQLite provider 토글) | DB 부트 0 / file 1 개 / CI 가장 단순 | schema 의 cascade / unique constraint 동작이 PostgreSQL 와 달라 — Prisma provider 차이로 인한 false positive/negative / ADR-0002 의 PostgreSQL 채택 결정과 명백히 어긋남 | 기각 |
| **(채택) real PostgreSQL 16 services container** | REQ-029 정합 / Prisma adapter / pg driver / DB constraint 실 동작 cover / ADR-0002 와 정합 / infra 복잡도 acceptable | CI 시간 +30-60s / flakiness mitigation 필요 / cleanup 책임 발생 — 모두 mitigation 박제 가능 | **✓ 채택** |

## Cleanup 정책 박제

**strategy**: `afterEach` 에서 truncate.

```sql
TRUNCATE TABLE persons, parts, groups, person_group_memberships, service_identities
  RESTART IDENTITY CASCADE;
```

- **`TRUNCATE` vs `DELETE`**: `TRUNCATE` 가 더 빠름 (table scan 0, MVCC overhead 없음) + sequence reset 동반 가능.
- **`CASCADE`**: foreign key 가 걸린 자식 테이블도 함께 truncate. 순서 무관 — 명시적 의존성 정렬 불요.
- **`RESTART IDENTITY`**: serial / identity sequence 를 1 로 reset. test 간 id 충돌 방지 + 매 test 가 결정적 id 부여 받음 → assertion 박제 단순화.

**helper 위치**: `test/helpers/db-truncate.ts` (후속 T-0052 에서 신설). PrismaService 의 `$executeRawUnsafe` 사용. 본 ADR 은 **위치 + signature 박제만** — 실 코드는 T-0052.

```ts
// test/helpers/db-truncate.ts (후속 T-0052 신설 예정)
export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE persons, parts, groups, person_group_memberships, service_identities RESTART IDENTITY CASCADE',
  );
}
```

**alternative — `globalTeardown` 에 DROP SCHEMA + CREATE SCHEMA**: 더 강력하나 매 test 마다 migrate deploy 재실행 부담 — 기각, `afterEach` truncate 채택.

**alternative — jest `globalSetup` 에 1 회 truncate**: test 간 state leak 발생 가능 (이전 test 의 dirty data 가 다음 test 에 영향) — 기각.

## References

- [ADR-0001](ADR-0001-stack.md) — Jest + supertest test stack (본 ADR 의 jest hook 사용 source)
- [ADR-0002](ADR-0002-db.md) — PostgreSQL + Prisma 채택 (본 ADR 의 기반, supersede 0 / 보강)
- [ADR-0003](ADR-0003-deployment.md) — Monolith / 단일 DB 인스턴스 (본 ADR 의 CI service container 단일성과 정합)
- [PLAN.md L66](../PLAN.md) — 사용자 추가 bullet (commit `d27a47d`, 본 ADR 의 1 차 trigger)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 현 CI 워크플로우 (후속 T-0052 변경 대상)
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — mock 패턴 (unit-only 보조 유지 결정)
- [test/jest-smoke.json](../../test/jest-smoke.json) / [test/jest-e2e.json](../../test/jest-e2e.json) — jest config (후속 T-0052 의 cleanup hook 부착 대상)
- [docs/tasks/T-0043-smoke-test-persons-domain-endpoint-expansion.md](../tasks/T-0043-smoke-test-persons-domain-endpoint-expansion.md) — 현 smoke 의 mock 사용 source
- [docs/tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md](../tasks/T-0044-e2e-test-persons-domain-endpoint-expansion.md) — 현 e2e 의 mock 사용 source
- [docs/requirements.md](../requirements.md) — REQ-029 (non-volatile 저장) / REQ-058 (운영 정책 underlying)
- [CLAUDE.md](../../CLAUDE.md) §3.2 (R-110~R-114 test/CI 규칙) / §12 (한국어 본문)

Refs: T-0051, ADR-0002, REQ-029, REQ-058
