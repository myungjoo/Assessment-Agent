---
id: T-0420
title: backfill idempotency 판정자 실 구현 (P7 ⑤ slice 2 후속 a-1)
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-027]
estimatedDiff: 200
estimatedFiles: 4
created: 2026-06-15
independentStream: p7-backfill
dependsOn: [T-0419]
touchesFiles:
  - src/scheduling/assessment-backfill-checker.service.ts
  - src/scheduling/assessment-backfill-checker.service.spec.ts
  - src/scheduling/scheduling.module.ts
hqOrigin:
plannerNote: "P7 ⑤ slice 2 후속 a split — 후속 a 의 schema-free·cycle-free 부분(idempotency 판정자 실 구현)만. PersonService hook 은 module 순환 게이트로 분리, pr"
---

# T-0420 — backfill idempotency 판정자 실 구현 (P7 ⑤ slice 2 후속 a-1)

## Why

PLAN.md Phase P7 의 "신규 인원 추가 시 1년치 평가 1회 (R-50 / REQ-027)" bullet 의 slice 2 후속 a 를 split 한 첫 sub-slice. T-0419(slice 2, merged)가 `BackfillRunnerService` 와 함께 **주입형 idempotency 판정자 인터페이스** `AlreadyBackfilledChecker`(DI token `ALREADY_BACKFILLED_CHECKER`)를 박제했으나, 기본 미주입이라 항상 `false`(= "skip 안 함")로 동작한다 — 즉 "신규 인원 1회만 backfill"(중복 backfill 방지, REQ-027 "1회")의 실 보장이 아직 비어 있다. 본 task 는 그 판정자의 **실 구현**을 박제한다.

backlogNote 의 "slice 2 후속 a(PersonService create hook 자동 호출 배선 + idempotency 판정자 실 구현)" 는 두 책임의 묶음인데, 그중 **PersonService create hook 배선**은 module 순환 의존 게이트를 동반한다(아래 Out of Scope 의 근거 참조 — `UserModule → SchedulingModule → AssessmentCollectionModule → UserModule` 순환). 따라서 후속 a 를 split 해, **schema 변경 0·module 순환 0** 으로 안전히 진행 가능한 "idempotency 판정자 실 구현" 만 본 task 로 먼저 박제하고, hook 배선은 architect 가 순환 해소 방안을 결정한 뒤의 별도 task(Follow-up)로 분리한다.

실 판정은 **기존 read primitive 재사용**으로 schema 게이트 없이 가능하다 — `SinceDerivationService.deriveSince(personId)`(AssessmentCollectionModule export, SchedulingModule 이 이미 import) 가 직전 Assessment 가 0건이면 `undefined`, 1건 이상이면 정의된 ISO 문자열을 반환한다. 즉 "이미 Assessment 가 존재함" ⟺ "이미 backfill(또는 일반 평가)됨" 으로 판정해 중복 backfill 을 차단한다(신규 인원 = Assessment 0건 = backfill 진행, 기존 인원 = skip). schema flag/row 신설(slice 3) 없이 동작하며, 그 정교한 영속 표식은 slice 3 의 책임으로 유지한다.

## Required Reading

- `docs/PLAN.md` (Phase P7 — "신규 인원 추가 시 1년치 평가 1회 (R-50)" bullet)
- `docs/requirements.md` (REQ-027 행 — "신규 인원 1년치 평가 1회 (일반은 1주 단위)")
- `docs/tasks/T-0419-backfill-runner-service.md` (slice 2 정의 + Follow-ups — 본 task 가 후속 a 의 split)
- `src/scheduling/backfill-runner.service.ts` — `AlreadyBackfilledChecker` 인터페이스 + `ALREADY_BACKFILLED_CHECKER` DI token + `@Optional()` 주입 지점. 본 task 가 이 token 으로 실 provider 를 override 주입한다(인터페이스 시그니처 `isAlreadyBackfilled(personId: string): Promise<boolean>` 준수).
- `src/scheduling/scheduling.module.ts` — `BackfillRunnerService` 의 provider 등록 + `AssessmentCollectionModule` import 현황. 본 task 가 `ALREADY_BACKFILLED_CHECKER` provider 를 여기에 바인딩한다.
- `src/assessment-collection/since-derivation.service.ts` — `SinceDerivationService.deriveSince(personId): Promise<string | undefined>` 시그니처/반환(직전 Assessment 0건 → `undefined`, 1건+ → 최신 periodStart ISO). 본 판정자가 재사용하는 read primitive(재구현 0 — 호출만).
- `src/assessment-collection/assessment-collection.module.ts` — `SinceDerivationService` 가 export 되어 있음을 확인(exports L134 부근). SchedulingModule 이 이미 `AssessmentCollectionModule` 을 import 하므로 새 import 0 으로 DI resolve 가능.

## Acceptance Criteria

- [ ] `src/scheduling/assessment-backfill-checker.service.ts` 신설 — `@Injectable() AssessmentBackfillChecker` 가 `AlreadyBackfilledChecker` 인터페이스(`backfill-runner.service.ts` export)를 구현한다. 생성자에 `SinceDerivationService`(AssessmentCollectionModule export, 재구현 0 — 호출만) 주입. public 메서드 `isAlreadyBackfilled(personId: string): Promise<boolean>` 1개:
  - `deriveSince(personId)` 가 정의된 값(직전 Assessment 1건 이상 존재)을 반환하면 `true`(이미 평가/backfill 됨 → skip), `undefined`(Assessment 0건, 신규 인원)면 `false`(backfill 진행). 판정 근거를 주석으로 명시(Assessment 존재 = backfill 완료의 보수적 proxy, 정교한 영속 표식은 slice 3).
  - schema 변경 0 — 기존 read primitive 만 호출. 새 Prisma 쿼리/필드/migration 0.
- [ ] `src/scheduling/scheduling.module.ts` 에 `ALREADY_BACKFILLED_CHECKER` token provider 바인딩 추가 — `{ provide: ALREADY_BACKFILLED_CHECKER, useExisting: AssessmentBackfillChecker }`(또는 `useClass`) + `AssessmentBackfillChecker` 를 providers 에 등록. 이로써 `BackfillRunnerService` 의 `@Optional() @Inject(ALREADY_BACKFILLED_CHECKER)` 가 미주입(기본 false) 대신 실 판정자를 resolve 한다. `AssessmentCollectionModule` import 는 이미 존재(L45) — 새 import 0. controller/endpoint 추가 0.
- [ ] colocated spec `src/scheduling/assessment-backfill-checker.service.spec.ts` 신설. mock `SinceDerivationService` 주입(실 DB/실 수집 0). R-112 4종 + negative cover:
  - happy-path: `deriveSince` 가 ISO 문자열(예: 직전 Assessment 존재)을 반환 → `isAlreadyBackfilled` 가 `true` 단언. `deriveSince` 가 `undefined`(신규 인원) → `false` 단언. `deriveSince` 가 정확히 1회 호출되고 인자가 전달된 `personId` 와 일치하는지 단언.
  - error-path: `deriveSince` 가 reject(의존성 실패)하면 `isAlreadyBackfilled` 가 에러를 삼키지 않고 그대로 전파(fail-fast, deriveSince 동형)하는지 단언. `personId` 가 빈 문자열/비정상 → deriveSince 로 그대로 전달(판정자는 검증 책임 없음)되는지 단언.
  - flow/branch: `undefined` 분기(false) / 정의된 값 분기(true) 각 1+ test — `isAlreadyBackfilled` 의 두 반환 경로 모두 cover.
  - negative 충분 cover: `deriveSince` 가 빈 문자열 `""` 반환(falsy 이지만 `undefined` 아님)의 경계 처리 단언(정의 여부 판정이 truthiness 가 아니라 `!== undefined` 기준임을 명시 + test) — 즉 빈 문자열이면 `true`(Assessment 존재) 판정. deriveSince reject 경로, personId 비정상 경로 등 예외 분기마다 1+.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 본 파일 분기 전수 cover 로 100% 목표).

## Out of Scope

- **PersonService create hook 배선** — 신규 인원 생성 시점에 `BackfillRunnerService.runBackfill` 을 자동 호출하는 배선은 **module 순환 의존 게이트**를 동반하므로 본 task 밖. 근거: `UserModule(PersonService)` 가 `SchedulingModule(BackfillRunnerService)` 를 import 하려면, 현재 `SchedulingModule → AssessmentCollectionModule → UserModule` 단방향(ADR-0029 §1) 위에 `UserModule → SchedulingModule` 가 더해져 3-module 순환이 생긴다. 이 순환의 해소 방안(event-emitter 디커플링 / `forwardRef` / 전용 orchestration module / 별도 진입점)은 architect 결정 사항 → 별도 design/ADR task. 본 task 는 `src/user/` 무변경.
- **manual backfill REST endpoint**(controller/DTO) — backlogNote 후속 b. 본 task 는 controller 0.
- **backfill 1회 완료 영속화 표식(flag/row) + schema 변경** — backlogNote slice 3, schema 게이트 동반. 본 task 의 판정은 "Assessment 존재 여부" 보수적 proxy 로 schema 무변경. 정교한 전용 표식(예: `Person.backfilledAt` column)은 slice 3.
- `BackfillRunnerService` / `AlreadyBackfilledChecker` 인터페이스 / `SinceDerivationService` / `buildBackfillPlan` 자체 수정 — 전부 재사용만(시그니처 불변).
- 실 live/credentialed 수집 — Q-0025 / Q-0022 deferred. 본 판정자는 mock-testable, 실 token·실 DB 0.
- api.md / data-model.md doc-sync — backlogNote slice 4, 별도 direct doc-only task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
- (slice 2 후속 a-2, **게이트**) PersonService create hook — 신규 인원 생성 시점에 `BackfillRunnerService.runBackfill` 1회 자동 호출 배선. **module 순환 의존(`UserModule → SchedulingModule → AssessmentCollectionModule → UserModule`) 해소 방안 architect 결정 선행** — design/ADR task 필요(event-emitter 디커플링 후보).
- (slice 2 후속 b) manual backfill REST endpoint(예: POST /api/schedules/backfill/:personId, Admin+ RBAC) — `runBackfill` 노출, T-0417 controller 패턴 mirror.
- (slice 3) backfill 1회 완료 영속화 표식(flag/row, 예: `Person.backfilledAt`) + 일반 주기와의 분리 표식 — schema 게이트(Prisma migration §5 BLOCKED) 재확인. 본 task 의 proxy 판정을 전용 표식으로 정교화.
- (slice 4) api.md / data-model.md doc-sync.

## Status

**DONE** — 2026-06-15T15:18Z (cron@local-aa15-79a6f4839 fire, stage 5b claim 경로).
PR #339 squash merge `60fb264`. `AssessmentBackfillChecker` 신설(`SinceDerivationService.deriveSince` 재사용으로 Assessment 0건⟺신규 인원 판정, schema 0) + `scheduling.module` 에 `ALREADY_BACKFILLED_CHECKER` useExisting 바인딩. 신규 파일 line/branch/func 100%, unit 3192 test + smoke + e2e CI green, 신규 dep 0. +64/-3, 3 파일. integrator 4-게이트 PASS(reviewer APPROVE r1/7 + comment 외부 post + self-check + CI green).
