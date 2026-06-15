---
id: ADR-0042
title: "@nestjs/schedule 도입 결정 (P7 스케줄링 인프라 — cron 주기 · manual trigger · 신규 인원 1년치)"
status: ACCEPTED
date: 2026-06-15
relatedTask: T-0410
supersedes: null
---

# ADR-0042 — @nestjs/schedule 도입 결정 (P7 스케줄링 인프라)

## Context

[PLAN.md](../PLAN.md) Phase P7 (Scheduling & operations) 의 다음 세 요구사항은 모두 **평가 실행을 주기/트리거 기반으로 구동하는 스케줄링 인프라**를 전제한다 — 평가는 더 이상 수동 호출만으로 굴러가지 않고, 시간 기반·이벤트 기반 구동 축이 필요하다.

- **REQ-039 / R-72** ([README.md](../../README.md) 72행, [requirements.md](../requirements.md)): Admin 이 **cron 주기를 런타임 지정** (예: KST 02:00) — 정적 빌드타임 cron 표현식이 아니라 운영 중 변경 가능한 동적 등록이 핵심이다.
- **REQ-040 / R-73** ([README.md](../../README.md) 73행, [requirements.md](../requirements.md)): Admin **manual trigger** — 주기와 무관하게 즉시 1회 평가를 발화하는 경로.
- **REQ-027 / R-50** ([README.md](../../README.md) 50행, [requirements.md](../requirements.md)): **신규 인원 추가 시 1년치 평가 1회** — 일반 인원의 매일 1주 단위 평가와 분리된, 인원 추가 이벤트에 묶인 1회성 백필(backfill).

사용자가 2026-06-15 새 외부 dependency `@nestjs/schedule` 도입을 **명시적으로 승인**했다 ([CLAUDE.md](../../CLAUDE.md) §5 "새 외부 dependency = BLOCKED, 사람 승인 필요" 게이트 해소). [CLAUDE.md](../../CLAUDE.md) §3.1 규칙 4 + §9 "코드보다 ADR이 먼저다" 에 따라 P7 stream 의 **첫 산출물은 도입 ADR** 이고, 실 패키지 추가·wiring·서비스/엔드포인트 구현은 본 ADR ACCEPTED 후 별도 후속 task 다.

**기존 backend 자산 위의 경계**: 본 시스템은 monolithic 단일 NestJS process ([ADR-0003](ADR-0003-deployment.md), [deployment.md](../architecture/deployment.md)) 로 운영되며, collection / evaluation 도메인이 이미 shipped 되어 있다. 스케줄러는 이 자산 위에 **얇게 얹히는 구동 layer** — 시간/이벤트가 도래하면 **기존 평가 실행 경로를 호출**하는 trigger 일 뿐, 도메인 로직을 재구현하지 않는다. 단일 process in-memory 스케줄러라는 점이 multi-instance 확장 경계를 규정한다 (아래 Consequences).

본 ADR 은 **결정 전용 0 LOC** — 실 패키지 추가는 본 ADR ACCEPTED 후 별도 task (아래 "범위 밖").

## Decision

### 1. `@nestjs/schedule` 채택

P7 스케줄링 인프라의 기반으로 **`@nestjs/schedule`** (NestJS 공식 패키지) 을 채택한다. 근거:

- **NestJS 공식 패키지** — DI 컨테이너·모듈 시스템·테스트 유틸(`Test.createTestingModule`)과 1급 통합된다. 별도 어댑터/수동 wiring 없이 provider 로 주입되어 [ADR-0001](ADR-0001-stack.md) 의 TypeScript / NestJS convention 정합이 그대로 유지된다 (에이전트 환각·재추론 비용 절감).
- **declarative 데코레이터 + 동적 registry 양면 제공** — `@Cron()` / `@Interval()` / `@Timeout()` declarative 데코레이터로 정적 job 을, **`SchedulerRegistry`** 로 런타임 동적 cron job 등록/삭제/조회를 모두 다룬다. R-72 의 "Admin 런타임 주기 지정" 이 정확히 이 동적 registry 경로에 대응한다.
- **internal cron 엔진** (`cron` 라이브러리 wrapping) 으로 OS crontab·외부 스케줄러 없이 process 내부에서 시간 구동이 완결된다 — monolithic 1-process ([ADR-0003](ADR-0003-deployment.md)) 운영 표면과 정합.

### 2. 통합 방식 (방향성 — 구체 구현은 후속 task)

본 ADR 은 wiring 의 **방향성만** 결정하고 실 코드는 후속 task 로 분리한다.

- **ScheduleModule import 위치**: `ScheduleModule.forRoot()` 를 AppModule (root) 에 1회 import 한다. 이로써 `SchedulerRegistry` 가 전역 주입 가능해지고 declarative 데코레이터가 활성화된다. (실 import 추가 = 후속 dep/wiring task.)
- **R-72 (cron 주기 런타임 지정)**: Admin 이 지정한 cron 표현식을 받아 **`SchedulerRegistry.addCronJob()` 으로 동적 등록**하고, 변경 시 기존 job 을 `deleteCronJob()` 후 재등록한다. 정적 데코레이터가 아니라 동적 registry 가 책임 — 빌드 재배포 없이 주기 변경.
- **R-73 (manual trigger)**: 스케줄과 무관하게 **동일한 평가 실행 진입 함수를 즉시 1회 호출**하는 경로. 스케줄러 service 가 cron callback 과 manual trigger 가 같은 내부 함수를 공유하도록 추상화한다 (중복 구동 로직 방지).
- **R-50 (신규 인원 1년치 1회)**: 주기 cron 이 아니라 **인원 추가 이벤트에 묶인 1회성 backfill** — `@Timeout` 류 1회 실행 또는 service 가 직접 호출하는 one-shot 경로로, 일반 인원의 매일/주 단위 주기 평가와 **분리된 코드 경로**로 둔다.
- 위 셋은 모두 스케줄러 service 의 **단일 추상(평가 실행 진입점) 위에 얹히는 trigger 차이** 일 뿐 — cron 등록 / manual 즉시 / one-shot backfill 의 3 진입이 같은 하위 실행 경로로 수렴한다. 구체 service / 엔드포인트 / DTO 는 후속 task.

## Consequences

### 긍정

- NestJS 공식 패키지라 **DI·모듈·테스트 경로가 정합** — provider 주입·`Test.createTestingModule` 기반 unit test 가 표준 경로로 성립 (R-112 후속 적용 용이).
- `SchedulerRegistry` 동적 등록으로 **R-72 런타임 주기 변경**이 재배포 없이 충족된다.
- cron / manual / one-shot 3 진입이 **단일 실행 추상으로 수렴**해 구동 로직 중복이 없다.
- OS crontab·외부 큐 없이 **process 내부 완결** — monolithic 1-process 운영 표면 추가 0.

### 부정

- **단일 process in-memory 스케줄러** — process 재시작 시 동적 등록된 job 이 휘발한다. 영속화(예: 등록 cron 을 DB 저장 후 부팅 시 재등록)는 후속 task 의 책임으로 분리하며, **multi-instance 수평 확장 시 중복 발화** 문제(인스턴스마다 같은 cron 발화)는 본 패키지 범위 밖 — 그 시점에 분산 락 또는 외부 스케줄러로 **재결정(별도 ADR)** 한다.
- 새 dependency 1개 추가 — 표면 증가이나 §5 게이트(사용자 승인 완료)와 공식 패키지 신뢰도로 수용.

### 중립

- 동적 cron 등록·삭제·조회 책임은 전적으로 `SchedulerRegistry` 에 집중된다 — 스케줄러 service 가 이 registry 의 thin wrapper 로 설계된다.
- cron 표현식 검증·timezone(KST) 처리·등록 cron 영속화 방식은 본 ADR 미결정 — 후속 task 에서 결정.

## Alternatives considered

### node-cron (대안 1)

경량 cron 라이브러리. 그러나 **NestJS DI 와 미통합** — provider 주입·테스트 모듈·lifecycle hook 과 수동 wiring 이 필요해 boilerplate 와 재추론 비용이 늘고, 동적 등록도 자체 관리 구조를 직접 구축해야 한다. 공식 `@nestjs/schedule` 이 동일 엔진(`cron`)을 DI 통합으로 감싸므로 이점이 없다 — **기각**.

### node-schedule (대안 2)

유연한 스케줄링이나 마찬가지로 NestJS 통합 부재 + `@nestjs/schedule` 대비 NestJS 생태계 정합·문서 표준성 열위. 에이전트 친화성(공식 convention) 사유로 **기각**.

### 외부 cron (OS crontab / GitHub Actions) (대안 3)

OS crontab 또는 GitHub Actions schedule 로 외부에서 엔드포인트를 호출하는 방식. 그러나 **R-72 "Admin 런타임 주기 지정"** 은 애플리케이션 내부에서 동적으로 변경 가능해야 하는데, 외부 cron 은 인프라 변경(crontab/workflow 파일 수정)이 필요해 런타임 변경과 맞지 않는다. 배포·secret·인증 표면도 분산된다 — **기각**.

### BullMQ 류 큐 / 분산 스케줄러 (대안 4)

Redis 기반 작업 큐로 영속·분산·재시도가 강력하나, **single-operator monolith ([ADR-0003](ADR-0003-deployment.md)) 규모에서 Redis 의존 + 큐 인프라는 표면 과다**다. multi-instance 확장이 실제 필요해지는 시점에 본 ADR 을 SUPERSEDE 하며 재검토한다 — 현 시점 **기각**.

## 범위 밖 (deferred)

- `package.json` / `pnpm-lock.yaml` 에 `@nestjs/schedule` 실 추가 (후속 dep task — 본 ADR ACCEPTED 선행 의존).
- `ScheduleModule.forRoot()` AppModule import / wiring (후속).
- 스케줄러 service · `SchedulerRegistry` 동적 cron 등록/삭제 로직 (후속).
- R-72 cron 주기 지정 엔드포인트 · R-73 manual trigger 엔드포인트 · R-50 신규 인원 1년치 평가 구동 로직 (각 후속 task).
- 등록 cron 영속화 · timezone(KST) 처리 · multi-instance 확장(분산 락/외부 스케줄러) — 각 별도 결정(후속/별도 ADR).
- ADR status PROPOSED → ACCEPTED flip — reviewer/사용자 검토 후 별도 direct task (1줄 수정, [CLAUDE.md](../../CLAUDE.md) §3.1 규칙 4).

## References

- [CLAUDE.md](../../CLAUDE.md) §1 (기술 스택) / §3.1 (commitMode) / §5·§9 (new-dep 게이트) / §12 (언어 정책)
- [README.md](../../README.md) 50행 (R-50) / 72행 (R-72) / 73행 (R-73)
- [docs/requirements.md](../requirements.md) — REQ-027 / REQ-039 / REQ-040
- [docs/PLAN.md](../PLAN.md) Phase P7 — Scheduling & operations
- [ADR-0001](ADR-0001-stack.md) — TypeScript / NestJS 스택 근거
- [ADR-0003](ADR-0003-deployment.md) / [deployment.md](../architecture/deployment.md) — monolithic 1-process (in-memory 스케줄러 전제)
- [ADR-0040](ADR-0040-frontend-stack.md) — 결정 전용 0 LOC ADR + §5 게이트 + PROPOSED→ACCEPTED flip 패턴의 직전 동형 선례
- `@nestjs/schedule` docs: <https://docs.nestjs.com/techniques/task-scheduling>
