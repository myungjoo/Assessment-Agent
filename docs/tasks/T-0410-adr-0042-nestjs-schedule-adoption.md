---
id: T-0410
title: ADR-0042 작성 — @nestjs/schedule 도입 결정 (P7 스케줄링 인프라)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-027, REQ-039, REQ-040]
estimatedDiff: 150
estimatedFiles: 1
created: 2026-06-15
independentStream: p7-scheduling
dependsOn: []
touchesFiles: [docs/decisions/ADR-0042-nestjs-schedule-adoption.md]
plannerNote: P7 entry — 사용자 6/15 @nestjs/schedule dep 승인(§5 게이트 해소) → ADR-first(코드보다 ADR 먼저). 실 dep 추가/wiring 은 후속 task.
---

# T-0410 — ADR-0042 작성 — @nestjs/schedule 도입 결정 (P7 스케줄링 인프라)

## Why

[PLAN.md](../PLAN.md) Phase P7 (Scheduling & operations) 의 R-72 (REQ-039, Admin cron 주기 지정 — 예: KST 02:00) · R-73 (REQ-040, Admin manual trigger) · R-50 (REQ-027, 신규 인원 추가 시 1년치 평가 1회) 는 모두 **평가 실행을 주기/트리거 기반으로 구동하는 스케줄링 인프라**를 전제한다. 사용자가 2026-06-15 새 외부 dependency `@nestjs/schedule` 도입을 **명시적으로 승인**했다 ([CLAUDE.md](../../CLAUDE.md) §5 "새 외부 dependency = BLOCKED, 사람 승인 필요" 게이트 해소). [CLAUDE.md](../../CLAUDE.md) §3.1 규칙 4 + §9 "코드보다 ADR이 먼저다" 에 따라 P7 stream 의 **첫 task 는 도입 ADR** 이어야 하며, 실 패키지 추가·ScheduleModule wiring·스케줄러 서비스/엔드포인트 구현은 본 ADR ACCEPTED 후 별도 후속 task 다.

## Required Reading

- [docs/decisions/ADR-0040-frontend-stack.md](../decisions/ADR-0040-frontend-stack.md) — "결정 전용 0 LOC ADR + §5 new-dep 게이트 절차 + status PROPOSED→ACCEPTED flip 이 승인 경로" 패턴의 직전 동형 선례. 본 ADR 의 형식·논조를 그대로 따른다.
- [docs/PLAN.md](../PLAN.md) Phase P7 단락 (125~135행) — R-72/73/74/50 항목과 P7 범위.
- [README.md](../../README.md) 50행 (R-50 신규 인원 1년치 1회) · 72행 (R-72 cron 주기) · 73행 (R-73 manual trigger) — 요구사항 원문.
- [docs/requirements.md](../requirements.md) REQ-027 / REQ-039 / REQ-040 행 — REQ↔README 매핑 확인.
- [CLAUDE.md](../../CLAUDE.md) §1 기술 스택 표 · §3.1 commitMode · §5 new-dep 게이트 · §9 — 도입 절차·언어 정책.
- [docs/decisions/ADR-0036-fine-grained-concurrency.md](../decisions/ADR-0036-fine-grained-concurrency.md) status/frontmatter 1개만 — ADR frontmatter 표준 필드 형식 참조 (전문 read 금지, 첫 10행만).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` 1개 신설. frontmatter 는 기존 ADR 형식 (`id`, `title`, `status`, `date`, `relatedTask: T-0410`, `supersedes: null`).
- [ ] `status: PROPOSED` 로 시작 (ACCEPTED flip 은 본 task 범위 밖 — reviewer/사용자 검토 후 별도 direct task).
- [ ] **Context**: R-72 (REQ-039) · R-73 (REQ-040) · R-50 (REQ-027) 가 스케줄링 인프라를 요구함을 명시 + 사용자 2026-06-15 `@nestjs/schedule` 도입 승인 사실 박제 + 기존 backend 자산 (monolithic 단일 NestJS process [ADR-0003], 기존 collection/evaluation 도메인) 위에 스케줄러가 얹히는 경계 명시.
- [ ] **Decision**: `@nestjs/schedule` 채택 + 통합 방식 — ScheduleModule import 위치, cron 주기를 Admin 이 런타임 지정 (R-72) / manual trigger (R-73) / 신규 인원 1년치 1회 (R-50) 를 어떻게 스케줄러 추상 위에 얹을지의 방향성 (구체 구현은 후속 task 로 분리 명시). `@nestjs/schedule` 은 NestJS 공식 패키지로 cron/interval/timeout declarative 데코레이터 + 동적 SchedulerRegistry 를 제공함을 근거로.
- [ ] **Consequences** (긍정/부정/중립): 공식 패키지라 NestJS DI·테스트 경로 정합 / 단일 process 내 in-memory 스케줄러라 multi-instance 확장 시 재결정 필요 / 동적 cron 등록은 SchedulerRegistry 책임 등.
- [ ] **Alternatives considered**: `node-cron` (NestJS DI 비통합·수동 wiring) · `node-schedule` · 외부 cron (OS crontab / GitHub Actions) · BullMQ 류 큐 — 각 기각 사유 (단일 operator monolith 규모에서 표면 과다 / DI 미통합 등).
- [ ] **범위 밖 (deferred)** 섹션에 package.json 실 추가 · ScheduleModule wiring · 스케줄러 서비스/엔드포인트 구현 · multi-instance 확장이 후속 task 임을 명시.
- [ ] 본문은 한국어, 식별자/패키지명/경로는 영어 (§12). 기존 ADR 의 markdown link 형식 (`[텍스트](상대경로)`) 사용.
- [ ] pr-mode 이지만 production code 변경 0 LOC (ADR 문서 신설만) — tester 는 `pnpm lint && pnpm build && pnpm test` 가 기존대로 green 인지 (ADR 신설이 빌드/테스트에 영향 없음) 확인. R-112 unit test 신규 작성 대상 없음 (코드 symbol 추가 0) — Acceptance 본문에 "코드 symbol 추가 0 → 신규 unit test 대상 없음, 기존 test suite green 유지로 충족" 명시.

분기 없음 (문서 신설 단일 산출물) — R-112 happy/error/branch/negative test 항목은 코드 symbol 부재로 본 task 에서 생략. 후속 dep 추가/wiring task 에서 R-112 full 적용.

## Out of Scope

- `package.json` / `pnpm-lock.yaml` 에 `@nestjs/schedule` 실 추가 (후속 Follow-up ②).
- `ScheduleModule.forRoot()` import / AppModule wiring (후속).
- 스케줄러 서비스 · SchedulerRegistry 동적 cron 등록 로직 (후속).
- R-72 cron 주기 지정 엔드포인트 · R-73 manual trigger 엔드포인트 · R-50 신규 인원 1년치 평가 구동 로직 구현 (각 후속 task).
- ADR status PROPOSED → ACCEPTED flip (reviewer/사용자 검토 후 별도 direct task — 1줄 수정).
- 그 어떤 `src/` 코드 변경, 테스트 코드 신설, CI workflow 변경, PLAN.md/requirements.md 갱신 (후속/별도 task).

## Suggested Sub-agents

`architect → tester` — architect 가 ADR 작성 (도입 결정 문서), tester 가 기존 lint/build/test green 유지 확인 (코드 변경 0 이므로 회귀 없음 검증).

## Follow-ups

- (planner 가 후속 큐잉 예정) ② `package.json` 에 `@nestjs/schedule` 추가 + `pnpm-lock.yaml` 갱신 + `ScheduleModule.forRoot()` AppModule import (pr-mode, 본 ADR ACCEPTED 선행 의존).
- ③ R-72 (REQ-039) Admin cron 주기 지정 — SchedulerRegistry 동적 등록 서비스 + 엔드포인트 (pr).
- ④ R-73 (REQ-040) manual trigger 엔드포인트 (pr).
- ⑤ R-50 (REQ-027) 신규 인원 추가 시 1년치 평가 1회 구동 — 일반 인원 매일 1주 단위와 분리 (pr).
- 본 ADR ACCEPTED flip (direct, 1줄 status 수정).
