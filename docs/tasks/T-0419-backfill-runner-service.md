---
id: T-0419
title: 신규 인원 backfill 실행 runner service (P7 ⑤ slice 2)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-027]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-15
independentStream: p7-backfill
dependsOn: [T-0418]
touchesFiles:
  - src/scheduling/backfill-runner.service.ts
  - src/scheduling/backfill-runner.service.spec.ts
  - src/scheduling/scheduling.module.ts
hqOrigin:
plannerNote: "P7 ⑤(R-50 REQ-027) backlogNote slice 2 1차 sub-slice — buildBackfillPlan 출력을 CollectionTriggerService 로 소비하는 runner service + 1회만 idempotency, pr"
---

# T-0419 — 신규 인원 backfill 실행 runner service (P7 ⑤ slice 2)

## Why

PLAN.md Phase P7 의 "신규 인원 추가 시 1년치 평가 1회 (R-50 / REQ-027) — 일반 인원의 매일 1주일 단위 평가와 분리" bullet 의 두 번째 slice. slice 1(T-0418, merged)이 **무엇을 평가할지**(주 단위 window 목록)를 산출하는 순수 helper `buildBackfillPlan` 을 박제했다. 본 task 는 그 출력을 **실제로 실행**하는 runner service 를 박제한다 — `buildBackfillPlan` 으로 산출한 각 주 window 를 `CollectionTriggerService.triggerCollection` 으로 순차 소비하고, "신규 인원 1회만 backfill"(중복 backfill 방지) idempotency 결정을 담당한다. 

slice 2 전체(PersonService create-hook 배선 + manual backfill REST endpoint + DTO)는 cap(≤300 LOC / ≤5 파일)을 초과하므로 본 task 는 **runner service + module provider 배선까지**만 다루고, "신규 인원 추가" 이벤트 hook 과 REST endpoint 노출은 아래 Follow-ups(slice 2 후속 sub-slice)로 분리한다. slice 1 이 pure helper 를 먼저 분리한 패턴과 동형 — runner 의 조립/순회/idempotency 분기를 단위 테스트로 완전 cover 한 뒤 후속 sub-slice 가 이 runner 를 진입점에 연결한다.

## Required Reading

- `docs/PLAN.md` (Phase P7 — "신규 인원 추가 시 1년치 평가 1회 (R-50)" bullet)
- `docs/requirements.md` (REQ-027 행 — "신규 인원 1년치 평가 1회 (일반은 1주 단위)")
- `docs/tasks/T-0418-backfill-plan-helper.md` (slice 1 정의 + Follow-ups — 본 task 가 그 후속)
- `src/scheduling/backfill-plan.ts` — `buildBackfillPlan(reference, weeks?)` 시그니처/반환(`PeriodRange[]`, 시간순 index 0=最古). 본 runner 가 소비할 입력.
- `src/assessment-collection/collection-trigger.service.ts` — `CollectionTriggerService.triggerCollection(dto)` 시그니처 + `CollectTriggerDto`(personId/period/scope/periodStart) + `CollectionTriggerSummary` 반환 shape. 본 runner 가 window 당 1회 호출하는 building block (재구현 0 — 호출만).
- `src/assessment-collection/dto/collect-trigger.dto.ts` — `CollectTriggerDto` 필드(특히 `periodStart` 가 ISO string, window.start 를 여기에 매핑).
- `src/common/period-boundary.ts` — `PeriodRange` 타입(`{ start: Date; end: Date }`). 본 runner 는 boundary 산술을 직접 하지 않고 `buildBackfillPlan` 출력의 `start` 만 ISO 로 변환한다.
- `src/scheduling/scheduling.module.ts` — 본 runner 를 provider 로 등록할 module(현 provider 구성 참고).

## Acceptance Criteria

- [ ] `src/scheduling/backfill-runner.service.ts` 신설 — `@Injectable() BackfillRunnerService`. 생성자에 `CollectionTriggerService` 주입(building block 재구현 0, 호출만). public 메서드 `runBackfill(personId: string, reference?: Date, weeks?: number): Promise<BackfillRunResult>` 1개. 동작:
  - `buildBackfillPlan(reference ?? new Date(), weeks)` 로 주 window 목록 산출(slice 1 helper 재사용 — boundary 산술 직접 금지). `weeks` 미지정 시 helper 기본값(52) 위임.
  - 산출한 window 를 **시간순(가장 오래된 주부터)** 으로 순회하며, 각 window 마다 `collectionTriggerService.triggerCollection({ personId, period: "weekly", scope, periodStart: window.start.toISOString() })` 를 호출한다(period 는 "weekly" 고정 — 주 단위 backfill, scope 는 상수 또는 기본값 박제 + 주석 근거).
  - 순회는 순차(`for ... of` + `await`) — 동일 personId 의 동시 다중 Assessment 생성 race 회피. 반환 `BackfillRunResult` 는 처리한 window 수 + 각 window 의 요약(personId/총 window 수/성공 수 등 요약 shape, 1~2 필드면 충분 — 전문 Contribution 반환 금지, slice 1·trigger service 의 요약 반환 convention 동형).
- [ ] **idempotency("1회만") 분기**: 이미 backfill 된 personId 의 재호출을 식별하는 분기를 둔다. schema 변경 없이 결정 가능한 방식으로 — 본 sub-slice 에서는 **runner 내부 결정 메서드**(예: `shouldSkip(...)` 또는 주입형 `alreadyBackfilled` 판정자)를 분리해 분기를 단위 테스트 가능하게 한다. 이미 backfill 됨으로 판정되면 `triggerCollection` 을 한 번도 호출하지 않고 skip 결과를 반환(중복 backfill 방지, REQ-027 "1회"). 영속 flag/DB 기반 판정(예: 직전 Assessment 존재 여부 조회)은 schema 게이트가 걸리면 본 task 밖 — 그 경우 판정자를 **주입형 인터페이스**로 두고 기본은 "skip 안 함"(false), 실 영속 판정 배선은 Follow-up 으로 명시.
- [ ] **error path**: 중간 window 의 `triggerCollection` 이 throw(Person 404 / P2002 409 / collect reject)하면 그 에러를 삼키지 않고 전파(fail-fast) — 또는 명시적으로 "부분 성공 + 실패 window 기록 후 계속" 정책 중 하나를 **주석 근거와 함께 택1**하고 그 분기를 spec 으로 박제. (planner 권고: fail-fast 전파 — trigger service 의 fail-fast 동형, 부분 backfill 상태 모호 회피. 부분-계속 정책 채택 시 그 근거를 명시.)
- [ ] `src/scheduling/scheduling.module.ts` 에 `BackfillRunnerService` 를 provider 등록 + `CollectionTriggerService` 의존성 주입 가능하도록 배선(필요 시 해당 module/provider import). module wiring 변경은 provider 추가 최소 범위로 한정 — controller/endpoint 추가 0(Follow-up).
- [ ] colocated spec `src/scheduling/backfill-runner.service.spec.ts` 신설. mock `CollectionTriggerService` 주입(실 수집/실 DB 0). R-112 4종 + negative cover:
  - happy-path: 신규 personId 로 `runBackfill` 호출 시 `triggerCollection` 이 정확히 window 수만큼 호출되고, 호출 순서가 시간순(가장 오래된 window 의 `periodStart` 가 첫 호출), 각 호출의 `periodStart` 가 해당 window.start 의 ISO 와 일치, period="weekly" 단언.
  - error-path: 중간 window 의 `triggerCollection` 이 reject → 채택한 정책(fail-fast 전파 권고)대로 `runBackfill` 이 reject/표면화하는지 단언. `personId` 가 빈 문자열/비정상 → 거부 또는 전파 단언.
  - flow/branch: `weeks` 명시(예: 1, 4) 케이스로 호출 횟수 분기 cover. idempotency 분기 — "이미 backfill 됨" 판정 true → `triggerCollection` 0회 호출(skip) 단언, false → 정상 순회 단언(각 분기 1+).
  - negative 충분 cover: weeks=1(단일 window) 경계, idempotency 판정자 미주입(기본 false=skip 안 함) 경로, 빈 window 산출 불가 케이스(buildBackfillPlan 이 항상 weeks 개 반환하므로 weeks 검증 throw 전파) 등 예외 분기마다 1+.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 본 파일 분기 전수 cover 로 100% 목표).

## Out of Scope

- "신규 인원 추가" 이벤트 hook / PersonService create 연동 — PersonService 의 인원 생성 시점에 `runBackfill` 을 자동 호출하는 배선은 별도 Follow-up sub-slice. 본 task 는 `src/user/` 무변경(runner 는 personId 를 인자로만 받음).
- manual backfill REST endpoint(controller/DTO) 노출 — Admin 이 명시적으로 backfill 을 트리거하는 진입점은 별도 sub-slice(T-0417 cron-schedule.controller 패턴 mirror). 본 task 는 controller 0.
- DB persistence / Prisma schema 변경 — backfill 1회 완료 표식(flag/row)을 어디에 영속화할지는 schema 게이트 동반 별도 sub-slice. 본 task 는 schema 무변경 — idempotency 판정자를 주입형으로 두고 실 영속 판정은 Follow-up.
- `buildBackfillPlan` 자체 수정 — slice 1 helper 는 재사용만(시그니처 불변).
- `CollectionTriggerService` / collection building block 재구현 — 호출만(시그니처 불변).
- timezone 재논의 — KST 는 ADR-0039 로 확정, boundary 는 slice 1 helper 가 도출.
- 실 live/credentialed 수집 — Q-0025 / Q-0022 deferred. 본 runner 는 mock-testable, 실 token·실 DB 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
- (slice 2 후속 a) PersonService create hook — 신규 인원 생성 시점에 `BackfillRunnerService.runBackfill` 1회 자동 호출 배선 + "1회만" 보장 결선(idempotency 판정자 실 구현).
- (slice 2 후속 b) manual backfill REST endpoint(예: POST /api/schedules/backfill/:personId, Admin+ RBAC) — `runBackfill` 노출, T-0417 controller 패턴 mirror.
- (slice 3) backfill 1회 완료 영속화 표식(flag/row) + 일반 주기와의 분리 표식 — schema 게이트 재확인.
- (slice 4) api.md / data-model.md doc-sync.
