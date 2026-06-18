---
id: T-0492
title: ImportJobService.createJob 에 evaluateImportRaceGuard(T-0460) 실호출 배선 — 45 helper 배선 chain step2
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0487]
touchesFiles:
  - src/import/import-job.service.ts
  - src/import/import-job.service.spec.ts
plannerNote: "P7 helper-배선 chain step2 — evaluateImportRaceGuard(T-0460 순수 helper, 어디서도 미호출) 를 ImportJobService.createJob 에 실호출 배선. T-0491 의 import 측 대칭. 새 dep/schema/auth/multipart 0."
---

# T-0492 — ImportJobService.createJob 에 evaluateImportRaceGuard 실호출 배선

## Why

P7 export/import 실 배선 chain 의 "45 helper(T-0437~T-0483) 실 호출 배선" 단계에서, [T-0491](T-0491-export-job-service-scope-validate-wire.md) 이 export 측 첫 helper(`validateExportScope`)를 `ExportJobService.createJob` 에 실호출 배선해 merge 됐다(`79910b0`). 본 task 는 그 **import 측 대칭 slice** — chain step2 다.

`evaluateImportRaceGuard` ([T-0460](T-0460-import-race-guard.md), `src/export/import-race-guard.ts`) 는 UC-07 §4 precondition 4 + §6.4 의 race precondition(Import / Restore 호출 시 진행 중 import 작업이 있으면 proceed / defer / timeout 판정)을 산출하는 순수 helper 인데, `git grep evaluateImportRaceGuard -- src/**/*.service.ts src/**/*.controller.ts` 결과 **자기 spec 외 어디서도 호출되지 않는다**. 반면 현행 `ImportJobService.createJob` 은 `assertModeInvariant`(requestedById 필수 / mode enum 검증)만 검사할 뿐, **이미 RUNNING 인 import job 이 있는 상태에서도 새 destructive import job 을 무조건 생성**한다 — UC-07 §6.4 의 "진행 중 작업과의 race" precondition 이 코드 차원에서 비어 있다.

본 task 는 `evaluateImportRaceGuard` 를 `createJob` 에 실호출 배선해, createJob 이 자기 `findRunning()`(이미 존재하는 query) 로 관측한 진행 중 import 작업 상태를 helper 가 요구하는 `InProgressOperationState` descriptor 로 변환·판정하게 한다. helper verdict 가 `blocking: true`(defer / timeout) 면 새 job 생성을 막고 `ConflictException`(409)으로 사람-친화 message 를 반환한다. 이로써 (1) 미호출 helper 1 종이 실 path 에 연결되고(REQ-030 Import), (2) raw 미저장 invariant(REQ-032) 는 그대로 유지되며(helper 는 race state 만 판정, raw 본문 미접근), (3) Admin 전용 destructive 경로(REQ-045)의 진행 중-작업 안전성이 강화된다.

본 task 는 **persistence 동작 변경 없이(race 통과 시 기존 createJob 그대로) 진행 중-작업 게이트만 추가**한다 — 새 외부 dependency / DB schema / auth-flow / multipart 표면 0(helper·findRunning 이미 존재, import 만 추가).

## Required Reading

- `src/import/import-job.service.ts` 전체 — 배선 대상. `createJob` 의 현행 `assertModeInvariant` 분기(requestedById 필수 / mode ImportMode enum 검증)와 `CreateImportJobInput` shape(`mode?: ImportMode` / `requestedById: string`), 그리고 이미 존재하는 `findRunning()`(status=RUNNING ImportJob[] 반환) 을 정확히 파악.
- `src/export/import-race-guard.ts` 전체 — 호출할 순수 helper. `evaluateImportRaceGuard(state: InProgressOperationState, options?: ImportRaceOptions): ImportRaceVerdict`. **입력 state shape** 은 `{ active: boolean, operation?: "UC01-pipeline"|"UC06-destructive", startedAt?: Date }` 다(active=true 일 때 operation·startedAt 필수). 반환 verdict 의 `blocking`(verdict !== 'proceed' 와 동치) / `verdict`(proceed/defer/timeout) / `reason` / `headline` / `detailLines` 를 사용. active=false 면 항상 `proceed + blocking=false`.
- `test/helpers/prisma-mock.ts` 의 `importJob` delegate mock — spec 에서 `findMany`(findRunning 의 backing) / `create` 를 stub 하기 위해 재사용. (race 통과·차단 두 경로 모두 mock 으로 시뮬레이션.)
- `src/import/import-job.service.spec.ts` 전체 — colocated spec. 본 task 의 새 race 분기 test 를 여기에 추가(신규 spec 파일 생성 금지 — colocated 우선).

## Acceptance Criteria

배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 호출은 의무):

- [ ] `ImportJobService.createJob` 이 `assertModeInvariant` 통과 후 **DB create 전에** `evaluateImportRaceGuard` 를 호출한다. 진행 중-작업 state 는 service 가 `findRunning()`(이미 존재) 결과로 derive — RUNNING import job 이 1+ 면 `{ active: true, operation: "UC06-destructive", startedAt: <가장 오래된 RUNNING job 의 startedAt 또는 createdAt> }`, 0 이면 `{ active: false }`. (operation 라벨은 import=destructive 이므로 "UC06-destructive" 매핑이 자연스럽다 — 단 라벨 선택 근거를 코드 주석으로 1줄 박제.)
- [ ] helper verdict 의 `blocking === true`(defer / timeout) 면 `ConflictException`(409) 을 throw 하고, message 는 `verdict.headline`(+ 필요 시 `detailLines` 결합)을 사람-친화로 forward. `blocking === false`(proceed) 면 기존 `prisma.importJob.create` 흐름 그대로 진행(persistence 동작 불변).
- [ ] race state 가 `active: true` 일 때 helper 의 `onConflict` 정책은 **`defer`(default)** 로 둔다(실 중단 배선 없이 진행 중 작업과의 충돌을 차단만 — UC-07 §6.4 (i) default). `now`/`timeoutMs` 는 helper default 에 위임(옵션 미전달 또는 명시적 default) — 단 선택 근거 주석 1줄.
- [ ] [R-112 happy] `findRunning()` 이 빈 배열(진행 중 import 없음) 일 때 `createJob` 이 helper proceed verdict 로 정상적으로 ImportJob(status=PENDING) 을 생성하는 test 1+. mode 미지정·REPLACE·MERGE 각 happy 경로 회귀(기존 test 유지) 1+.
- [ ] [R-112 error path] `findRunning()` 이 RUNNING job 1+ 을 반환할 때 `createJob` 이 `ConflictException`(409) 을 throw 하고 `prisma.importJob.create` 가 호출되지 않는(create stub 미호출) test 1+.
- [ ] [R-112 flow/branch] createJob 의 각 분기 cover: (a) requestedById 누락 → BadRequestException(기존), (b) 비유효 mode → BadRequestException(기존), (c) race blocking → ConflictException(신규), (d) race proceed → create 성공(신규). 각 분기 1+ test.
- [ ] [R-112 negative cases 충분 cover] 예외 상황 각 1+: (1) RUNNING job 이 startedAt=null 인 edge(createdAt fallback 또는 방어) 시 helper TypeError 가 service 밖으로 새지 않도록 처리되는지(또는 fallback 동작 명시) test, (2) 다수 RUNNING job 중 가장 오래된 것을 startedAt 으로 고르는지 test, (3) race blocking 시 message 가 helper headline 을 포함하는지(empty/raw stack 아님, REQ-032) test, (4) findRunning DB 오류 propagate(create 미도달) test.
- [ ] `evaluateImportRaceGuard` 가 자기 spec 외에 실 service 에서 호출됨을 검증 — `git grep evaluateImportRaceGuard -- src/import/import-job.service.ts` 가 1+ 매칭.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. 신규/변경 코드 `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — import-job.service.ts 변경 부분 cover.

## Out of Scope

- **multipart 파일 수신 / 실 artifact upload·파싱** (multer / FileInterceptor) — 새 infra 표면, §5 BLOCKED 인접. 본 task 는 job record 생성 시점의 race 게이트만.
- **실 atomic transaction 복원 로직**(ADR-0044 §3 REPLACE `$transaction` reset-and-recreate / MERGE conflict resolution) — Q-0040 범위 밖, 별도 §5/§9 게이트. 본 task 는 status/race 판정만.
- **`evaluateImportRaceGuard` 자체 로직 수정** — helper 는 호출만(T-0460 박제 그대로). 새 verdict 종류·옵션 추가 금지.
- **ImportController / CreateImportDto 변경** — controller 는 service raw forward 정책 유지(T-0489 박제). 본 task 는 service layer 만 touch(touchesFiles 2 파일).
- **실 onConflict='interrupt'(진행 중 작업 중단) 배선** — UC-07 §6.4 (ii) 는 실 cancellation protocol 이 필요(별도 P5/후속). 본 task 는 default `defer` 로 차단만.
- **`evaluateImportRaceGuard` 를 export 측·다른 helper 로 추가 배선** — chain 의 후속 slice. 한 task 1 helper 배선 원칙.
- **STATE.json / journal / PLAN 등 doc 변경** — direct-mode 별 task. 본 task 는 코드+spec pr-mode 만.

## Suggested Sub-agents

`implementer → tester`

(아키텍처 결정 0 — 기존 helper·service·mock 재사용, 새 ADR 불요. architect 생략.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append — 예: 나머지 import 측 미호출 helper(`validateImportDumpStructure`·`validateImportDumpSize`·`detectImportMergeConflicts` 등) 의 배선 slice, multipart upload infra task.)
