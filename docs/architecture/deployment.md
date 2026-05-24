# Deployment view

> **본 문서는 P1 T-A2 의 산출물이다. 본 task ([T-0014](../tasks/T-0014-adr-0002-db-selection.md)) 가 DB 단락만 채운다. 나머지 4 결정 단락 (Monolithic vs worker / Secret 저장 / Scheduler 위치 / 외부 네트워크 boundary) 은 T-0015 (ADR-0003) 에서 추가될 예정.**

## 개요

본 문서는 Assessment-Agent 의 **deployment view** — 어떤 process / 인스턴스 구조로 운영되며, 어떤 외부 자원에 의존하는지 — 를 박제한다. [docs/architecture/INDEX.md](INDEX.md) 의 MVA 원칙에 따라 운영 가능한 최소 결정만 다루고, 구체적인 manifest (Dockerfile / docker-compose.yml / Kubernetes manifest 등) 는 다루지 않는다 — 그것은 P7 (Scheduling & operations) phase 의 운영 task 책임.

본 view 는 [ADR-0002](../decisions/ADR-0002-db.md) (DB) 와 향후 [ADR-0003](../decisions/ADR-0003-deployment.md) (TBD — T-0015) 가 결정한 사항을 view layer 로 모은다. ADR 이 결정의 source of truth 이고, 본 문서는 ADR 결정이 운영 토폴로지에 어떻게 반영되는지의 도식 / 텍스트 설명이다.

## DB / Persistence

본 단락의 결정은 [ADR-0002 — Persistence DB / ORM 선택](../decisions/ADR-0002-db.md) 에서 박제했다. 본 view 는 그 결정을 운영 토폴로지로 풀어낸다.

**채택: PostgreSQL + Prisma**. [ADR-0002](../decisions/ADR-0002-db.md) 참조.

### 배포 토폴로지

- **단일 인스턴스 (initial deployment)**: PostgreSQL 16 이상을 별도 process 로 운영. Backend NestJS process 와 **동일 host 의 다른 process** 또는 **로컬 Docker container** (`postgres:16-alpine`) 형태가 default. [CLAUDE.md](../../CLAUDE.md) §1 의 single-operator 운영 컨텍스트에서는 본 형태가 가장 가볍다.
- **Backend → DB 연결**: 동일 host 의 경우 Unix socket 또는 `localhost:5432`. Docker 의 경우 docker-compose 내부 network 의 service 이름 (예: `db:5432`) 으로 접근. 외부 managed service (RDS / Cloud SQL) 도 connection string 만 교체하면 동작하도록 환경변수화 — 구체 변수 이름은 T-0015 의 secret 단락이 결정 (`DATABASE_URL` 표준 명칭이 Prisma convention).
- **Connection pool**: NestJS Backend process 내부에 PrismaService 의 singleton 으로 보유. Pool 크기와 statement timeout 의 구체 값은 P3 Persistence layer task 에서 결정.
- **Worker 분리 시 확장**: [ADR-0003 (T-0015)](../decisions/ADR-0003-deployment.md) 에서 worker process 분리가 결정되면, worker 도 동일 DB 인스턴스에 동일 connection string 으로 접근. DB schema 는 하나 — 본 ADR 의 결정으로 1 DB 인스턴스 전제.

### Migration 정책

- **도구**: [ADR-0002](../decisions/ADR-0002-db.md) 에 따라 `prisma migrate` 를 사용. 개발 환경은 `prisma migrate dev`, 배포 환경은 `prisma migrate deploy`.
- **Migration 파일 위치**: `prisma/migrations/` 디렉토리에 누적, git 으로 버전 관리.
- **CI 통합**: Migration SQL 의 자동 적용은 P3 phase 의 task 에서 ci.yml step 또는 별도 deployment script 로 도입. 본 task 는 정책만 박제.

### Backup / restore 전략

- **DB-level dump**: PostgreSQL 표준 `pg_dump` / `pg_restore` 로 binary 또는 plain SQL backup 가능. README 57 행 (export / backup / restore) 의 요구사항을 본 표준 도구로 충족 가능.
- **자동화**: cron 또는 NestJS scheduler 기반 자동 backup 은 P7 phase 의 task. 본 task 는 "표준 도구 사용" 정책만 박제.
- **Restore 시나리오**: 평가 자료 reset 또는 환경 이전 시 `pg_restore` 로 새 인스턴스에 적재. Migration history 도 함께 복원되어 schema 상태가 동기.

### Raw data 저장 금지 (REQ-032) 의 schema-level 강제

- [ADR-0002 Decision §2](../decisions/ADR-0002-db.md) 의 정책에 따라, Prisma `schema.prisma` 에 **commit/문서의 raw 본문을 담는 column 을 정의하지 않는다**. 평가 결과 (난이도 / 기여도 / 양 / LLM 평가문 / metric 수치) 만 컬럼화한다.
- Schema PR 의 reviewer agent 는 `String` 타입 column 추가 시 그 의도를 PR 본문에서 확인 — raw text 보관 의도이면 REQ-032 위반으로 REQUEST_CHANGES.
- 구체 column 설계 / 인덱스 / unique constraint 는 P3 Persistence layer task 에서 진행.

### 후속 진행

Schema 컬럼 설계 / 인덱스 정책 / migration 도구 실제 도입 (`prisma` package install) / PrismaService NestJS module 작성은 모두 P3 (Domain core) phase 의 Persistence layer task 에서 진행된다. 본 task 와 본 단락은 결정과 정책만 박제하며, 코드 변경은 0 LOC.

## Monolithic vs worker 분리

TBD — [T-0015](../tasks/T-0015-adr-0003-deployment.md) (ADR-0003) 에서 채울 예정.

## Secret 저장

TBD — T-0015 (ADR-0003) 에서 채울 예정.

## Scheduler 위치

TBD — T-0015 (ADR-0003) 에서 채울 예정.

## 외부 네트워크 boundary

TBD — T-0015 (ADR-0003) 에서 채울 예정.
