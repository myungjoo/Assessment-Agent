---
id: T-1254
title: Import interim false-success guard — 복원 미배선 동안 성공 오표기 차단 (ADR-0055 §Follow-up d)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-07-27
independentStream: import-multipart-wiring
dependsOn: [T-1253]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
plannerNote: "P5 import chain — ADR-0055 §Follow-up (d) slice: 복원 엔진 미배선 동안 import 를 성공(PENDING/SUCCEEDED)으로 오표기하지 않도록 interim guard 삽입."
---

# T-1254 — Import interim false-success guard

## Why

[ADR-0055 §Consequences 부정](../decisions/ADR-0055-import-multipart-file-upload.md) 은 오너 지시로 **chain 완주 전 import UI false-success 상태**를 명시 박제했다 — multipart 수신(§Follow-up a, T-1252) + 크기 상한(§Follow-up c, T-1253) 은 배선됐으나 **dump 파싱→실 복원 엔진(§Follow-up b)** 은 아직 미배선이다. 현 [import.controller.ts](../../src/import/import.controller.ts) `create()` 는 파일을 받아 크기만 검증한 뒤 `service.createJob(...)` 로 **status=PENDING job 만** 만들어 반환한다 (buffer 미소비, controller 주석 lines 18-21·147-150 그대로). 이 PENDING job 은 이를 처리할 runner 가 없어 **영원히 PENDING** 이며, UI 는 이를 "import 접수/진행 중"으로 낙관 해석해 실제로는 복원이 일어나지 않는데 성공처럼 보이는 **false-success** 표면이 된다.

본 task 는 §Follow-up (d) slice 로 이 interim 구간에 **명시적 guard** 를 삽입한다 — 복원 엔진이 미배선인 동안 import 요청이 **성공(SUCCEEDED)으로 오표기되거나 끝나지 않는 PENDING 으로 방치되지 않도록**, job 을 생성한 직후 명시적 interim 메시지와 함께 `FAILED` 로 전이해 반환한다. 이로써 UI polling 이 status=FAILED + 사람-친화 사유("복원 엔진 미배선")를 보게 되어 false-success 가 원천 차단된다. [REQ-030](../requirements.md) (Import 정확성) / [REQ-032](../requirements.md) (raw 미저장 — buffer 여전히 미소비 유지) / [REQ-045](../requirements.md) (Admin 전용 불변) cover.

**본 slice 의 경계**: false-success 차단 guard 만. 실 복원 엔진(buffer 역직렬화 → ADR-0044 §3 atomic `$transaction`)은 §Follow-up (b) 별도 task 이며, (b) 착수 시 본 task 가 삽입한 interim `markFailed` 라인이 실 복원 pipeline(markRunning → parse → `$transaction` → markSucceeded/markFailed)으로 **교체**된다 (본 guard 는 명시적으로 reversible 하게 설계).

## Required Reading

- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Consequences 부정 "chain 완주 전 import UI false-success 상태" (오너 지시 박제 = 본 guard 의 직접 근거) + §Out of scope "interim false-success guard 구현 — 후속 slice (d)" + §Follow-ups (d). 본 task 의 상류 결정.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) — 현재 `create()` 는 파일 수신·크기 검증 후 `service.createJob({ mode, requestedById })` 로 PENDING job 만 반환 (lines 155-179). 상단·`create()` 위 주석 block 의 "job record (status=PENDING) 만 생성 / buffer 미소비 / interim false-success 상태 그대로" 서술 (lines 18-21, 147-150) 이 본 guard 로 현행화 대상.
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) — `createJob()` (PENDING 생성) + `markFailed(id, error)` (임의 status → FAILED + finishedAt + error, PENDING→FAILED 도 state-machine guard 없이 동작). 본 task 는 이 두 기존 메서드만 조합하며 **service 시그니처를 바꾸지 않는다** (신규 service 표면 0).
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) — 기존 `create()` unit spec. PENDING job 반환을 기대하는 기존 happy-path test 가 본 guard 도입으로 FAILED 반환 기대로 갱신돼야 함 (기존 test 위치 파악 후 확장).
- [CLAUDE.md §3.1 / §3.2 / §5 / §12](../../CLAUDE.md) — commitMode / R-112 test / BLOCKED 게이트 (새 dependency 금지 — 본 task 새 dep 0) / 언어 정책.

## Acceptance Criteria

- [ ] `import.controller.ts` `create()` 의 guard 삽입: 파일 수신·크기 검증(기존 file undefined → 400 분기 유지) 통과 후 `service.createJob({ mode: dto.mode, requestedById: actorSub })` 로 job 을 생성하고, **곧바로 `service.markFailed(job.id, <interim 메시지>)` 로 전이해 그 결과(status=FAILED)를 반환**한다. 즉 복원 엔진 미배선 동안 반환되는 ImportJob 의 status 는 절대 PENDING/SUCCEEDED 가 아니라 FAILED + 명시 사유다.
- [ ] interim 메시지는 사람-친화 한국어 상수(예: `const INTERIM_RESTORE_UNWIRED_MESSAGE = "복원 엔진 미배선 — dump 파일은 수신됐으나 실제 복원이 아직 구현되지 않았습니다 (ADR-0055 §Follow-up b 대기)."`)로 정의하고, raw stack/외부 본문을 포함하지 않는다 (REQ-032 정합 — 사람-친화 short message 만). 메시지 문구는 구현자 재량이나 "미구현/미배선" 의미가 명확해야 한다.
- [ ] guard 가 reversible 함을 코드 주석으로 박제 — §Follow-up (b) 착수 시 본 `markFailed` interim 라인이 실 복원 pipeline 으로 교체됨을 명시. buffer(`file.buffer`)는 여전히 **미소비** 유지 (파싱·복원 배선은 (b) — 본 task 는 buffer 를 읽지 않는다).
- [ ] controller 상단 comment block + `create()` 위 comment 의 "job record (status=PENDING) 만 생성 / interim false-success 상태 그대로" 서술을 현행화 — 이제 interim guard 로 FAILED 를 명시 반환한다는 사실 반영 (false-success 표면이 닫혔음).
- [ ] **happy-path unit test**: 상한 이하 파일 정상 수신 시 `create()` 가 `createJob` → `markFailed` 순서로 호출하고 반환 job 의 status 가 FAILED + interim 메시지를 담는지 test 1+ (mock service 의 호출 인자·순서 검증).
- [ ] **error path unit test**: 파일 누락(`file === undefined`) 시 기존대로 `BadRequestException`(400) 이 던져지고 `createJob`/`markFailed` 가 **호출되지 않는지** test 1+ (guard 진입 전 차단). `createJob` 이 `ConflictException`(진행 중 race) 등을 던지면 그 예외가 `markFailed` 로 삼켜지지 않고 raw propagate 되는지 test 1+.
- [ ] **flow / branch test**: `create()` 의 분기(file undefined → 400 / file 존재 → createJob+markFailed→FAILED 반환) 각 1+ test.
- [ ] **negative cases 충분 cover**: 반환 job status 가 PENDING 이 아님(false-success 차단 회귀) / SUCCEEDED 로 오표기되지 않음 / interim 메시지가 raw stack 을 포함하지 않음 / 비 Admin 403·미인증 401 이 guard 도입 후에도 보존(guard 는 인증·RBAC 이후 실행) / `createJob` 실패 시 `markFailed` 미호출 각 1+ test. 단일 negative 만 금지 — 분기·불변마다 cover.
- [ ] `tester` 가 R-110 검증: `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **dump buffer 파싱 → 실 복원 엔진** (역직렬화 → ADR-0044 §3 atomic `$transaction` DB load) — §Follow-up (b) slice. 본 task 는 buffer 를 절대 소비하지 않으며, (b) 착수 시 본 interim guard 를 실 pipeline 으로 교체한다.
- **`ImportJobService` 시그니처·메서드 신설/변경** — 기존 `createJob` / `markFailed` 만 조합. 새 service 메서드·필드 0.
- **ImportJob schema/enum 변경** (예: 별도 "NOT_IMPLEMENTED" status 신설) — 본 slice 는 기존 FAILED lifecycle 을 interim 신호로 재사용. 신규 status 도입은 데이터 모델 변경이라 필요 판명 시 별도 ADR/task.
- **크기 상한 / MulterExceptionFilter 재작업** — T-1253 결과 보존, 본 task 는 건드리지 않는다.
- **web/ import UI 의 interim 안내 표시** — 별도 P6/web slice. 본 task 는 backend 응답 정확성만.
- **e2e / supertest 추가** — colocated unit spec 만. e2e 는 복원 엔진 (b) 완주 후 별도 task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **§Follow-up (b) 상류 note**: 복원 엔진 slice 는 본 task 가 삽입한 interim `markFailed` 라인을 실 복원 pipeline(markRunning → buffer 파싱 → `$transaction` → markSucceeded/markFailed)으로 **교체**하는 형태로 착수한다 — 본 guard 는 그 교체를 전제로 reversible 하게 설계됐다.
