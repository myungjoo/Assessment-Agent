---
id: T-0412
title: "@nestjs/schedule dep 추가 + ScheduleModule.forRoot() AppModule import (P7 ②)"
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-039, REQ-040, REQ-027]
estimatedDiff: 60
estimatedFiles: 4
created: 2026-06-15
independentStream: P7-scheduling
dependsOn: [T-0411]
touchesFiles:
  - package.json
  - pnpm-lock.yaml
  - src/app.module.ts
  - src/app.module.spec.ts
plannerNote: "P7 stream ② — ADR-0042 §범위밖 첫 후속(dep add + ScheduleModule.forRoot import). 사용자 승인 완료(commit 8931ef9)라 new-dep 미차단."
---

# T-0412 — @nestjs/schedule dep 추가 + ScheduleModule.forRoot() AppModule import (P7 ②)

## Why

[ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) (ACCEPTED) §Decision 2 가 결정한 P7 스케줄링 인프라의 **실 패키지 도입 + root wiring** 첫 후속이다. ADR-0042 §"범위 밖" 의 첫 두 항목(`package.json`/`pnpm-lock.yaml` 에 `@nestjs/schedule` 실 추가, `ScheduleModule.forRoot()` AppModule import)을 본 task 가 완결한다. 본 wiring 으로 `SchedulerRegistry` 가 전역 주입 가능해져 후속 ③ cron service(R-72 REQ-039) · ④ manual trigger(R-73 REQ-040) · ⑤ 신규 인원 1년치 backfill(R-50 REQ-027) 의 선행 조건이 닫힌다.

새 dependency `@nestjs/schedule` 는 사용자가 2026-06-15 명시 승인했고(git log "사용자 P7 @nestjs/schedule dep 승인", commit 8931ef9) ADR-0042 가 ACCEPTED 이므로, [CLAUDE.md](../../CLAUDE.md) §5 new-dep 게이트는 **이미 해소** 된 상태다 — 본 task 는 BLOCKED 사유가 아니다.

## Required Reading

- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` — §Decision 1(채택)·2(통합 방향)·Consequences(단일 process in-memory 전제)
- `src/app.module.ts` — 현 root module imports 배열(여기 `ScheduleModule.forRoot()` 추가)
- `package.json` — `dependencies` 의 `@nestjs/*` 버전(`@nestjs/common`/`core` 10.4.4 정합 버전 선택), `coverageThreshold.global` 확인
- `@nestjs/schedule` docs: <https://docs.nestjs.com/techniques/task-scheduling> — NestJS 10.x 호환 버전(4.x 계열) 확인

## Acceptance Criteria

- [ ] `package.json` `dependencies` 에 `@nestjs/schedule` 추가 — NestJS 10.4.x 와 호환되는 버전(4.x 계열, 예: `^4.1.2`). `pnpm install` 로 `pnpm-lock.yaml` 동기.
- [ ] `src/app.module.ts` 의 `@Module({ imports: [...] })` 에 `ScheduleModule.forRoot()` 추가 (`@nestjs/schedule` 에서 import). 주석 1줄로 의도(ADR-0042 §Decision 2 — SchedulerRegistry 전역 주입 활성화) 명시.
- [ ] `src/app.module.spec.ts` 신설(colocated) — `Test.createTestingModule({ imports: [AppModule] }).compile()` 로 모듈이 정상 컴파일되고, `app.get(SchedulerRegistry)` 가 정의된 인스턴스를 반환(전역 주입 wiring 검증)하는 happy-path test 1+.
- [ ] **Happy-path test**: 위 AppModule 컴파일 성공 + SchedulerRegistry 주입 가능 검증 1+.
- [ ] **Error path / negative test**: SchedulerRegistry 주입 결과가 undefined 가 아님(ScheduleModule 미import 시 fail 하도록) 단언 + 부팅 직후 동적 cron job 0(`getCronJobs().size === 0`, declarative 데코레이터 미사용 상태) 같은 경계 단언 1+. 본 task 는 분기 코드를 추가하지 않으므로(선언적 import 1줄) "분기 없음 — flow/branch 항목은 위 부팅 상태 단언으로 갈음" 명시 가능.
- [ ] **negative cases 충분 cover** — 부팅 시 동적 등록 job 부재(0개) 경계 + SchedulerRegistry 가 빈 registry 로 시작함을 단언해, 후속 ③ 가 의존하는 초기 상태 계약을 박제.
- [ ] `pnpm lint && pnpm build` 통과 (tester 가 실행 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `coverageThreshold.global` 강제). app.module.spec.ts 가 AppModule 부팅 경로를 cover.
- [ ] CI 에서 unit(`pnpm test`) + smoke(`pnpm test:smoke`) + e2e(`pnpm test:e2e`) 3종 green — 기존 부팅 경로에 ScheduleModule 추가 후에도 회귀 0.

## Out of Scope

- 스케줄러 service / `SchedulerRegistry.addCronJob()` 동적 cron 등록·삭제 로직 (후속 ③ T-NNNN).
- R-72 cron 주기 지정 엔드포인트 / R-73 manual trigger 엔드포인트 / R-50 신규 인원 1년치 backfill 구동 로직 (각 후속 ④⑤).
- declarative `@Cron()`/`@Interval()` 데코레이터 사용 (현 단계는 동적 registry 활성화만 — 정적 job 미정의).
- 등록 cron 영속화 / timezone(KST) 처리 / multi-instance 분산 락 (ADR-0042 §Consequences — 후속/별도 ADR).
- 새 endpoint / DTO / controller 추가.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
