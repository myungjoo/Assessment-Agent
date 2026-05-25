---
id: ADR-0002
title: Persistence DB / ORM 선택 — PostgreSQL + Prisma
status: ACCEPTED
date: 2026-05-24
relatedTask: T-0014
supersedes: null
amendments:
  - date: 2026-05-25
    task: T-0033
    hq: HQ-0004
    decision: accept-latest-stable
    versionPinning:
      prisma: "^7.8.0"
      "@prisma/client": "^7.8.0"
      pg: "^8.21.0"
---

# ADR-0002 — Persistence DB / ORM 선택

## Context

Assessment-Agent 는 평가 자료를 **non-volatile** 하게 보유하고, 100~200 명 / 50~100 GitHub repo / ~1000 Confluence page 규모를 **1 시간 이내** 처리하며, 시각화 조회는 **3 초 이내** 응답해야 한다. 본 결정은 후속 P3 (Domain core), P4 (External integrations), P5 (Evaluation pipeline) 의 모든 persistence 코드가 따라야 하는 1 차 토대이므로 architecture phase (P1) 안에서 박제한다.

선택을 지배하는 외력은 다음과 같다.

- **REQ-029** ([README.md](../../README.md) 56 행) — 평가 자료 **non-volatile 저장**: in-memory / 일회성 file store 는 회피, 검증된 RDBMS 가 자연스러운 fit.
- **REQ-031** ([README.md](../../README.md) 58 행) — 재수집 시 **부분 중복 방지** + 최근 1 주 재수집 OK: unique constraint / upsert (`ON CONFLICT`) 가 표준 지원되어야 함. SQL DB 의 1 급 기능.
- **REQ-032** ([README.md](../../README.md) 59 행) — **raw data 저장 금지**, 평가 결과만 보유: schema-level 로 raw text 컬럼을 두지 않고 정량/정성 평가만 컬럼화. SQL 의 column-typed schema 가 이 정책 enforce 에 자연스럽다.
- **REQ-033** ([README.md](../../README.md) 60 행) — commit / 문서 단위로 기여도·난이도·양 보유: row-per-artifact + 인덱싱 가능한 numeric 컬럼 필요. SQL 의 정규화된 row 모델이 직결된다.
- **REQ-036** ([README.md](../../README.md) 63 행) — 상대 비교 가능 + LLM 정성 + Metric 수치: 동일 metric 컬럼에 대한 `ORDER BY` / `GROUP BY` 가 첫 사용 시점부터 필요. SQL 의 orderable / aggregatable schema 가 정합.
- **REQ-047** ([README.md](../../README.md) 91 행) — 100~200명 × 50~100 repo × 7 일치 commit data 처리량을 1 시간 이내. PostgreSQL 의 B-Tree index + partial index + transaction batching 으로 본 규모는 단일 인스턴스에서 여유 있게 처리 가능.
- **REQ-048** ([README.md](../../README.md) 92 행) — 조회·시각화 3 초 이내. 사전 집계 view + composite index + connection pool 로 충족 가능.

추가 외력:

- **Long-horizon 자율 agent 환경**: ORM 의 generated TS type 이 있으면 LLM 코드 생성 시 환각이 줄어든다. [ADR-0001](ADR-0001-stack.md) 가 TypeScript 를 채택한 이유와 동일한 논리가 ORM 선택에도 적용된다.
- **Single-operator 운영** ([CLAUDE.md](../../CLAUDE.md) §1): 운영자 1 명이 자기 머신에서 long-horizon 으로 굴린다. 외부 managed DB (RDS, Cloud SQL) 비용 부담 회피 — 로컬 Docker container 또는 단일 host 의 PostgreSQL process 로 시작.
- **Agent 친화성**: schema migration 도구가 declarative / type-safe 일수록 architect / implementer 가 schema 변경을 박제하기 쉬움. Prisma 의 `schema.prisma` 단일 파일 모델이 agent 가 schema 전체를 single read 로 파악할 수 있어 context 효율적이다.

## Decision

**Persistence DB 는 PostgreSQL, ORM 은 Prisma** 를 채택한다.

근거:

1. **REQ-047 / REQ-048 NFR 충족 가능성** — PostgreSQL 은 단일 인스턴스 기준 본 규모 (수천 ~ 수만 row / 분 write, 수십 ms 내 indexed read) 를 여유 있게 처리. B-Tree / partial index / `EXPLAIN ANALYZE` 로 hot path 튜닝 표준화.
2. **REQ-032 schema-level 강제** — Prisma `schema.prisma` 에 raw text 컬럼을 정의하지 않으면 reviewer agent 가 PR diff 에서 `String` column 추가를 자동 검출 가능. Schema-as-code 라서 정책 enforce 가 grep 가능.
3. **REQ-031 unique key + upsert** — PostgreSQL 의 `INSERT ... ON CONFLICT ... DO UPDATE` 가 Prisma 의 `upsert({ where, create, update })` 로 1:1 노출. 재수집 부분 중복 방지가 단일 statement 로 표현된다.
4. **Type safety** — Prisma 의 `prisma generate` 가 schema 로부터 TypeScript type 을 생성. NestJS service / controller 코드가 schema 변경에 따라 compile-time 검출. [ADR-0001](ADR-0001-stack.md) §2 (TS 채택) 와의 정합.
5. **Migration UX** — `prisma migrate dev` (개발) / `prisma migrate deploy` (운영) 가 standard path. Migration SQL 파일이 `prisma/migrations/` 에 누적되어 git 으로 버전 관리. README 57 행 (export / restore) 의 backup 단계와도 호환 (`pg_dump` 와 별개로 migration history 자체가 schema 의 source of truth).

## Consequences

### 긍정

- **Orderable / index 가능 schema**: 모든 metric 컬럼이 `ORDER BY` / `GROUP BY` 1 급 대상. REQ-036 (상대 비교) 와 REQ-048 (3 초 조회) 의 구현 path 가 표준 SQL pattern 으로 환원된다.
- **Type-safe data access layer**: Prisma client 가 schema 로부터 자동 생성한 TS type 이 controller / service 까지 흐른다. LLM 환각 비율 감소 + compile-time error 검출.
- **Migration tooling 1 급 지원**: `prisma migrate` 가 schema diff → SQL 생성 자동화. Schema 변경이 PR 단위로 자동 추적되고, reviewer agent 가 diff 의 의도를 파악하기 쉽다.
- **NestJS 생태계 통합**: NestJS docs 에 Prisma 통합 가이드가 first-class. Service / module 위치 결정이 framework convention 안에서 자연스럽다 ([ADR-0001](ADR-0001-stack.md) §1 NestJS 의 layer convention 효과와 동일).
- **REQ-029 non-volatile 충족**: PostgreSQL 의 WAL + fsync 로 durability 가 default. 추가 설정 없이 REQ-029 의 의도 충족.
- **REQ-030 export/restore 호환**: `pg_dump` / `pg_restore` 가 standard. Backup 자동화는 후속 task (P7 phase) 에서 도입.

### 부정 / trade-off

- **Prisma client binary 크기**: Generated client 가 platform 별 query engine binary 를 포함 (~수십 MB). CI 캐시 필요 — `pnpm install` 후 `prisma generate` 결과를 GitHub Actions cache 로 보존하는 step 이 P3 Persistence layer task 에서 추가될 것.
- **외부 DB 인스턴스 의존성**: PostgreSQL 은 별도 process. 개발 단계는 Docker container (예: `postgres:16-alpine`) 또는 host 직접 설치, 운영 단계는 별도 host 또는 managed service. SQLite 처럼 file 1 개로 끝나는 단순성은 없다 — 단 single-operator 환경에서 Docker compose 1 줄로 해결되는 수준이므로 부담 수용.
- **ORM dependency 도입은 별도 task**: 본 ADR 은 **결정만** 박제. 실제 `prisma` / `@prisma/client` 패키지 추가는 [CLAUDE.md](../../CLAUDE.md) §5 의 "새 외부 dependency 추가 BLOCKED" 룰 대상이므로 P3 Persistence layer 진입 시 별도 task 가 사용자 승인 후 도입한다.
- **추후 sharding / horizontal scale 한계**: 본 ADR 의 결정은 단일 PostgreSQL 인스턴스 전제. 사용자 / 대상 규모가 본 ADR Context 의 R-47 NFR (100~200 명) 을 크게 초과하게 되면 별도 ADR (예: read replica / Citus 도입) 필요. 현재 시점에서는 over-design 회피.
- **Prisma 자체의 lock-in**: Schema DSL 이 Prisma 특화. 향후 TypeORM 등으로 전환 시 schema 재작성 필요. 단 본 결정은 ADR 로 supersede 가능하므로 lock-in 은 영구적이지 않다.

### 후속 task 전망

- P3 (Domain core) Persistence layer task 가 본 ADR 을 전제로 (a) `prisma` / `@prisma/client` dependency 도입 task — 사용자 승인 + ADR 갱신 또는 별도 ADR, (b) 첫 `schema.prisma` 작성 task, (c) PrismaService NestJS module 작성 task 로 분할 진행한다.
- 구체 schema (table 컬럼 / 인덱스 / unique constraint) 는 본 ADR 범위 밖. P2 (Use case decomposition) 의 data-model.md 가 conceptual model 을 먼저 박제하고, P3 가 그것을 Prisma schema 로 옮긴다.
- Backup / restore 자동화 (REQ-030) 는 P7 (Scheduling & operations) phase 의 task 가 `pg_dump` 기반으로 구현.

## Alternatives considered

| 대안 | 장점 | 단점 / R-47/R-48/R-29/R-32 적합도 | 채택 여부 |
| --- | --- | --- | --- |
| **PostgreSQL + Prisma** (채택) | type safety / declarative schema / migration UX / NestJS 통합 / SQL orderable | Prisma client binary 크기 / 외부 DB 인스턴스 / ORM lock-in | **✓ 채택** |
| PostgreSQL + TypeORM | NestJS decorator 통합 성숙 / 동일 SQL 강점 (orderable / index / unique) / WAL durability (R-29) / 처리량/조회 NFR (R-47/48) 동일 충족 | Migration UX 가 Prisma 대비 약함 (자동 생성 SQL 의 품질·예측성 낮음) / decorator-on-entity 모델이 schema 의 single source of truth 를 분산시켜 reviewer agent 의 diff 인식 어려움 / generated type 이 Prisma 보다 약함 | 미채택 |
| SQLite + better-sqlite3 (또는 Prisma SQLite provider) | 운영 단순 (file 1 개) / 외부 DB process 불필요 / 개발 onboarding 가장 빠름 / R-29 non-volatile 도 file persist 로 일단 충족 | 동시성 한계 (single-writer lock) 가 R-47 1 h 처리량 NFR 의 worker 병렬화 시 병목 / R-32 schema-level enforce 는 가능하나 type system 약함 / 운영 단계 backup·restore 가 file lock 시점 의존 | 미채택 — **단 개발 stage 초기에 한해 Prisma SQLite provider 로 prototype 가능** (별도 ADR 없이 같은 schema.prisma 의 `provider` 한 줄 토글). 운영은 PostgreSQL. |
| MongoDB (NoSQL document) | flexible schema / horizontal scale 용이 / write throughput 큼 | R-36 의 상대 비교를 위한 ORDER BY / GROUP BY 가 SQL 대비 2급 / R-38 (sort / filter) 의 표준 indexing 이 SQL 보다 복잡 / schema-less 가 R-32 raw 저장 금지 enforce 약화 / agent 가 schema 추론할 single source 없음 | 미채택 — orderable / sort / filter 가 1 급이어야 하는 본 도메인과 어긋남 |
| Embedded (lowdb / nedb / PouchDB / LevelDB) | dependency 0 또는 매우 적음 / 별도 process 불필요 | R-29 durability 보장 약함 (lowdb 는 JSON file write — corruption 위험) / R-47 처리량 NFR 미달 가능성 / production 운영 검증 사례 부족 / R-32 schema 강제 메커니즘 없음 | 미채택 |

## Amendment — 2026-05-25 (T-0033, HQ-0004 해소)

T-0033 (P3 첫 task) 의 `pnpm add prisma @prisma/client pg` 실행 시점 박제. [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트가 발화 → HQ-0004 박제 → 사용자 결정 `accept-latest-stable` (2026-05-25T13:00:00+09:00, resolvedBy: human).

**Version pinning (lockfile 정확 version 은 `pnpm-lock.yaml` 참조)**:

| 패키지 | semver range | 본 commit 시점 resolved | 결정 근거 |
| --- | --- | --- | --- |
| `prisma` | `^7.8.0` | `7.8.0` | npm registry 의 latest stable. 사용자 옵션 `accept-latest-stable` 의 직역. Prisma 7.x 는 5.x 의 후속 major (2025 H2 release line). schema DSL · `prisma generate` · `prisma migrate` API 는 5.x 와 호환. |
| `@prisma/client` | `^7.8.0` | `7.8.0` | prisma CLI 와 minor lock-step. generated type 의 source. |
| `pg` | `^8.21.0` | `8.21.0` | PostgreSQL Node.js driver. Prisma 의 query engine 이 native 로 사용 (Prisma 내부 driver — 추가로 raw `pg` Pool 의 직접 사용은 본 commit scope 외). 단, ADR-0002 §2 "PostgreSQL 16+" 와의 wire-protocol 호환 driver 로 dependency tree 에 명시 박제. |

**선택하지 않은 옵션 (specify-versions / other)**: 사용자가 `accept-latest-stable` 을 명시했으므로 다른 옵션은 적용되지 않음. 향후 specific version pinning (예: security advisory 대응) 필요 시 별도 ADR amendment.

**lockfile 검증**: 본 commit 의 `pnpm-lock.yaml` 갱신이 위 3 패키지의 정확 version + 전이 의존성 (예: `@prisma/engines`, `pg-pool`, `pg-protocol` 등) 을 박제. reviewer agent 가 `pnpm-lock.yaml` diff 의 add-only 성격 (기존 dependency version downgrade 0) 을 점검.

## 범위 밖 (deferred)

- 실제 `prisma` / `@prisma/client` 패키지 도입 — [CLAUDE.md](../../CLAUDE.md) §5 BLOCKED 룰. P3 진입 시 별도 task. **(2026-05-25 T-0033 에서 해소 — 위 Amendment 참조.)**
- 구체 schema (table 컬럼 / 인덱스 / unique constraint / relation) — P2 conceptual data-model.md → P3 schema.prisma.
- Migration 도구 도입 (`prisma migrate` workflow / CI 통합) — P3 별도 task.
- Backup / restore 자동화 (`pg_dump` cron / S3 업로드 등) — P7 task.
- Connection pool 설정 / PrismaService lifecycle (NestJS) — P3 implementer task.
- Read replica / sharding — 본 ADR 범위 외, 필요 시 별도 ADR.

## References

- [CLAUDE.md](../../CLAUDE.md) §1 — 기술 스택 (DB row "별도 ADR 로 결정 — 기본 후보: PostgreSQL via Prisma 또는 TypeORM")
- [CLAUDE.md](../../CLAUDE.md) §5 / §9 — 새 dependency 추가 BLOCKED 룰
- [CLAUDE.md](../../CLAUDE.md) §12 — 언어 정책
- [ADR-0001](ADR-0001-stack.md) — Backend / language / package manager / test / CI 스택 (선행 ADR)
- [README.md](../../README.md) 55–64 행 — 저장 정책 / non-volatile / 재수집 / raw 금지
- [README.md](../../README.md) 88–92 행 — 성능 NFR (1 h 처리 + 3 초 조회)
- [docs/requirements.md](../requirements.md) L48 / L50 / L51 / L52 / L55 / L66 / L67 — REQ-029 / 031 / 032 / 033 / 036 / 047 / 048
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR / view 문서 매핑
- [docs/architecture/deployment.md](../architecture/deployment.md) — 본 ADR 의 view layer
- Prisma docs: <https://www.prisma.io/docs>
- PostgreSQL docs: <https://www.postgresql.org/docs/>

Refs: T-0014, REQ-029, REQ-031, REQ-032, REQ-033, REQ-036, REQ-047, REQ-048
