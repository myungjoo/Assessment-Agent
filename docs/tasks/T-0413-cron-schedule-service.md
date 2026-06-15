---
id: T-0413
title: "SchedulerRegistry 기반 동적 cron 등록 service + SchedulingModule (P7 ③ slice 1)"
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-039]
estimatedDiff: 195
estimatedFiles: 4
created: 2026-06-15
independentStream: P7-scheduling
dependsOn: [T-0412]
touchesFiles:
  - src/scheduling/cron-schedule.service.ts
  - src/scheduling/cron-schedule.service.spec.ts
  - src/scheduling/scheduling.module.ts
  - src/scheduling/scheduling.module.spec.ts
plannerNote: "P7 ③ slice 1 — SchedulerRegistry thin wrapper(register/replace/remove/list 동적 cron job + cron 식 검증). controller/엔드포인트·평가 callback 배선은 Follow-up."
---

# T-0413 — SchedulerRegistry 기반 동적 cron 등록 service + SchedulingModule (P7 ③ slice 1)

## Why

[PLAN.md](../PLAN.md) Phase P7 첫 항목 "Admin이 cron 주기 지정 (예: KST 02:00) (R-72)" (REQ-039) 의 backend 코어다. [ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) §Decision 2 "R-72" 가 결정한 대로, **정적 빌드타임 `@Cron()` 데코레이터가 아니라 `SchedulerRegistry` 동적 등록**으로 운영 중 주기 변경(재배포 없이)을 지원하는 경로를 연다.

T-0412 가 `ScheduleModule.forRoot()` 를 AppModule 에 import 해 `SchedulerRegistry` 를 전역 주입 가능하게 만들었다(부팅 시 동적 job 0, 빈 registry — T-0412 가 박제한 초기 계약). 본 task 는 그 registry 를 감싸는 **얇은 service** 를 신설해, 이름 붙은 단일 cron job 을 등록/교체/삭제/조회하고 cron 표현식을 검증한다. 이 service 가 후속 ④(manual trigger) 와 공유될 "평가 실행 진입점" 의 cron 측 trigger 골격이 된다.

본 task 는 P7 ③ 전체가 cap(≤300 LOC / ≤5 파일)을 넘으므로 **slice 1(service + module 골격)** 만 다룬다 — HTTP 엔드포인트(controller/DTO)와 cron callback → 실 평가 실행 경로 배선은 Follow-up 으로 분리한다.

## Required Reading

- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` — §Decision 2 "R-72"(동적 registry 책임)·"R-72/R-73/R-50 단일 추상 수렴")·§Consequences(단일 process in-memory, 영속화·timezone 후속 분리)
- `src/app.module.ts` — `ScheduleModule.forRoot()` 가 이미 등록됨(본 module 은 AppModule import 는 본 task 범위 밖 — Follow-up). 신설 `SchedulingModule` 은 `ScheduleModule` 전역 provider(`SchedulerRegistry`)를 그대로 주입받는다.
- `src/assessment-collection/assessment-collection.module.ts` — NestJS module 신설 패턴(@Module imports/providers/exports) 선례(읽기 전용 참고)
- `src/assessment-collection/collection-trigger.service.ts` — `@Injectable()` service 작성 + colocated spec 패턴(읽기 전용 참고; 본 task 는 이 service 를 호출하지 않음)
- `@nestjs/schedule` docs `SchedulerRegistry` API: <https://docs.nestjs.com/techniques/task-scheduling#dynamic-schedule-module-api> — `addCronJob`/`deleteCronJob`/`getCronJob`/`getCronJobs`/`CronJob` 생성자(`cron` 라이브러리)

## Acceptance Criteria

- [ ] `src/scheduling/cron-schedule.service.ts` 신설 — `@Injectable()` `CronScheduleService`. 생성자에서 `SchedulerRegistry`(@nestjs/schedule) 주입. 다음 4 public 메서드(thin wrapper):
  - `registerOrReplace(name, cronExpression, callback)` — 동일 `name` job 이 이미 있으면 `deleteCronJob(name)` 후 새 `CronJob` 생성+`addCronJob`+`start()`(또는 즉시 시작). cron 식이 유효하지 않으면 등록 전에 throw(아래 검증 항목).
  - `remove(name)` — job 존재 시 `deleteCronJob(name)`, 부재 시 안전 처리(throw 정책은 본문 명시 — 부재 시 no-op 또는 명확한 예외 중 택1, spec 으로 박제).
  - `list()` — 현재 등록된 job 이름 배열 반환(`getCronJobs()` 의 key 들).
  - `exists(name)` — 등록 여부 boolean.
- [ ] **cron 표현식 검증** — `registerOrReplace` 가 빈 문자열/공백/형식 위반 cron 식에 대해 등록을 거부하고 명확한 예외(예: `BadRequestException` 또는 도메인 Error)를 throw. 검증 로직은 분기 있는 순수 함수로 분리(예: `isValidCronExpression(expr): boolean`)해 단위 테스트 가능하게 한다(R-112 §entrypoint helper 분리 원칙 동형).
- [ ] `src/scheduling/scheduling.module.ts` 신설 — `@Module({ providers: [CronScheduleService], exports: [CronScheduleService] })`. `ScheduleModule.forRoot()` 는 AppModule(전역)에 이미 있으므로 본 module 에서 재import 하지 않는다(전역 `SchedulerRegistry` 주입 받음). 의도 주석 1줄(ADR-0042 §Decision 2 참조).
- [ ] **Happy-path test** (`src/scheduling/cron-schedule.service.spec.ts`, colocated) — mock `SchedulerRegistry` 주입으로: 유효 cron 식 등록 시 `addCronJob` 호출 + `list()`/`exists()` 가 등록 반영; 동일 name 재등록 시 `deleteCronJob` 후 재등록; `remove` 시 `deleteCronJob` 호출 각각 1+.
- [ ] **Error path test** — 잘못된 cron 식(빈 문자열·공백·형식 위반) 등록 시 예외 throw + `addCronJob` 미호출 단언 1+. `remove`/조회의 부재 케이스(존재하지 않는 name) 동작이 본문 명시 정책대로임을 단언 1+.
- [ ] **Flow / branch test** — `registerOrReplace` 의 "기존 job 있음 → delete 후 재등록" 분기와 "없음 → 신규 등록" 분기를 각각 1+ test 로 cover. `isValidCronExpression` 의 true/false 분기 각 1+.
- [ ] **negative cases 충분 cover** — 빈 cron 식 · 공백만 · 형식 위반(필드 수 부족 등 최소 1종) · 빈 name · 중복 name 재등록 · 부재 name remove 등 예외 상황을 **각 1+ test** 로 cover(단일 negative 만으로 부족). `SchedulingModule` 컴파일 가능(`Test.createTestingModule`)을 `scheduling.module.spec.ts` 에서 검증하되 — 전역 `ScheduleModule.forRoot()` 의존은 테스트 모듈에서 `ScheduleModule.forRoot()` 를 함께 import 하거나 `SchedulerRegistry` 를 provide 해 충족.
- [ ] `src/scheduling/scheduling.module.spec.ts` 신설(colocated) — `Test.createTestingModule({ imports: [ScheduleModule.forRoot()], providers: [...] })` 또는 동등 구성으로 `CronScheduleService` 가 정상 resolve 됨을 검증하는 happy-path 1+ + 주입 누락 시 fail 하는 단언.
- [ ] `pnpm lint && pnpm build` 통과 (tester 가 실행 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `coverageThreshold.global` 강제). 신설 service/helper 의 모든 분기를 spec 이 cover.
- [ ] CI 에서 unit(`pnpm test`) + smoke(`pnpm test:smoke`) + e2e(`pnpm test:e2e`) 3종 green — 신설 module 은 AppModule 미배선이라 부팅 경로 회귀 0.

## Out of Scope

- HTTP 엔드포인트(controller `PUT/POST /api/schedule` 류) + 요청 DTO(cron 식 입력·검증 pipe) — **Follow-up ③ slice 2**.
- `SchedulingModule` 의 AppModule import 배선(런타임 활성화) — slice 2 controller 와 함께(엔드포인트 없는 module 을 부팅에 미리 얹지 않는다).
- cron callback → 실 평가 실행 경로(CollectionTriggerService / EvaluationOrchestratorService 등) 배선 — 본 task 는 callback 을 **주입형 인자**로만 받고 실 도메인 호출은 연결하지 않는다(④ manual trigger 와 공유 추상 설계 시 함께).
- 등록 cron 영속화(DB 저장 후 부팅 재등록) · timezone(KST) 처리 — ADR-0042 §Consequences, 후속/별도 ADR.
- R-73 manual trigger(REQ-040) · R-50 신규 인원 1년치 backfill(REQ-027) — 각 후속 ④⑤.
- 외부 cron 라이브러리 검증을 위한 새 dependency 추가 — `@nestjs/schedule`(=`cron`)이 이미 제공하는 범위 내에서 처리. 새 dep 필요 판단 시 BLOCKED(§5).

## Suggested Sub-agents

architect(필요 시 callback 추상 경계만 — ADR 신설은 불요, ADR-0042 가 이미 방향 박제) → implementer → tester

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)

- (예약) ③ slice 2: cron 주기 지정 HTTP 엔드포인트(controller + DTO + cron 식 검증 pipe) + `SchedulingModule` AppModule 배선 + e2e.
- (예약) cron callback → 실 평가 실행 경로 배선(④ manual trigger 와 공유 추상).
