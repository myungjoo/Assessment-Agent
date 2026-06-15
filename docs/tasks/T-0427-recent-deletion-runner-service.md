---
id: T-0427
title: 최근 N일 결과 manual delete 실행 runner service (P7 ⑤ slice 2)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-16
independentStream: p7-recent-deletion
dependsOn: [T-0426]
touchesFiles:
  - src/scheduling/recent-deletion-runner.service.ts
  - src/scheduling/recent-deletion-runner.service.spec.ts
  - src/scheduling/scheduling.module.ts
hqOrigin:
plannerNote: "P7 ⑤(R-74 REQ-041) slice 2 — buildRecentDeletionPlan 출력을 주입형 deleter 로 삭제 후 CollectionTriggerService 재수집, T-0419 runner 패턴 mirror(주입형으로 schema/cycle 게이트 회피), pr"
---

# T-0427 — 최근 N일 결과 manual delete 실행 runner service (P7 ⑤ slice 2)

## Why

PLAN.md Phase P7 의 "Admin 최근 N일 결과 manual delete → 재수집 (R-74 / REQ-041)" bullet 의 실행 slice. 순수-helper 3 slice — slice 1(T-0424, `buildRecentDeletionWindow`) + slice 1b(T-0425, `selectInDeletionWindow`) + slice 1c(T-0426, `buildRecentDeletionPlan`) — 가 "무엇을 지우고 무엇을 남길지"(`{window, toDelete, toKeep}` plan)를 산출하는 순수 building block 을 모두 박제·머지했다. 본 task 는 그 plan 을 **실제로 실행**하는 runner service 를 박제한다 — `buildRecentDeletionPlan` 으로 산출한 `toDelete` instant 들을 삭제하고, 삭제 후 같은 기간을 `CollectionTriggerService.triggerCollection` 으로 재수집한다(REQ-041 "delete → 재수집").

T-0419(backfill runner)가 증명한 패턴을 그대로 mirror 한다 — runner 가 **주입형 인터페이스**(`RecentDeletionDeleter`)로 실 삭제를 위임하고, 실 repository delete / Prisma schema / PersonService 배선은 후속 sub-slice 로 분리한다. 이렇게 하면 본 task 는 module 순환 / schema 게이트 없이 runner 의 조립·순회·재수집·분기 로직을 단위 테스트로 완전 cover 할 수 있다(T-0419 가 `ALREADY_BACKFILLED_CHECKER` 주입형으로 schema 게이트를 회피한 것과 동형). 따라서 slice 2 전체(실 deleter provider 바인딩 + manual delete REST endpoint + DTO + PersonService 연동)는 cap 을 초과하므로 본 task 는 **runner service + module provider 배선까지**만 다룬다.

## Required Reading

- `docs/PLAN.md` (Phase P7 — "Admin 최근 N일 결과 manual delete → 재수집 (R-74)" bullet)
- `docs/requirements.md` (REQ-041 행 — "Admin 최근 N일 결과 manual delete → 재수집")
- `src/scheduling/recent-deletion-plan.ts` — `buildRecentDeletionPlan(reference, days, instants)` 시그니처 + `RecentDeletionPlan{window, toDelete, toKeep}` 반환 shape. 본 runner 가 소비할 입력(재구현 0 — 호출만).
- `src/scheduling/backfill-runner.service.ts` — **본 task 가 mirror 할 레퍼런스 패턴**. `@Injectable()` runner + 주입형 인터페이스(`AlreadyBackfilledChecker`) + DI token(`ALREADY_BACKFILLED_CHECKER`) + `@Optional()` 기본값 + 요약 반환 shape(`BackfillRunResult`) + fail-fast error 정책 + 순차 `for...of await` 순회 convention 을 그대로 차용.
- `src/scheduling/backfill-runner.service.spec.ts` — mock 주입 + R-112 4종 cover 패턴 레퍼런스.
- `src/assessment-collection/collection-trigger.service.ts` — `triggerCollection(dto)` 시그니처 + `CollectTriggerDto`(`personId`/`period`/`scope`/`periodStart`) + 반환 shape. 본 runner 가 삭제 후 재수집을 위해 호출하는 building block(재구현 0 — 호출만). period enum 허용값 `["day","week","month"]`(VALID_PERIODS), scope 허용값 `["commit","document","aggregate"]`(VALID_SCOPES) 주의.
- `src/scheduling/scheduling.module.ts` — 본 runner 를 provider 로 등록할 module(현 provider/exports 구성 + `AssessmentCollectionModule` import 가 `CollectionTriggerService` 를 resolve 하는 패턴 참고).
- `src/common/period-boundary.ts` — `PeriodRange` 타입(`{ start: Date; end: Date }`). 본 runner 는 boundary 산술을 직접 하지 않고 plan 의 `window.start` 만 ISO 로 변환해 재수집 `periodStart` 에 매핑.

## Acceptance Criteria

- [ ] `src/scheduling/recent-deletion-runner.service.ts` 신설:
  - `RecentDeletionDeleter` 인터페이스 박제 — `deleteInstants(personId: string, instants: ReadonlyArray<Date>): Promise<number>`(삭제한 결과 수 반환). 실 repository delete 는 후속 sub-slice 가 이 token 으로 override 주입(T-0419 의 `AlreadyBackfilledChecker` 동형). 미주입 시 기본 deleter 는 **삭제 0**(skip — 신규/미배선 환경 안전 기본값) 으로 두고 그 근거를 주석에 명시.
  - DI token `RECENT_DELETION_DELETER = Symbol(...)` 박제(후속 sub-slice override 진입점).
  - `@Injectable() RecentDeletionRunnerService` — 생성자에 `CollectionTriggerService` 주입(building block 재구현 0, 호출만) + `@Optional() @Inject(RECENT_DELETION_DELETER)` deleter 주입.
  - public 메서드 `runRecentDeletion(personId: string, instants: ReadonlyArray<Date>, reference?: Date, days?: number): Promise<RecentDeletionRunResult>`. 동작:
    1. `buildRecentDeletionPlan(reference ?? new Date(), days ?? <기본값>, instants)` 로 `{window, toDelete, toKeep}` 산출(slice 1c helper 재사용 — boundary/필터 산술 직접 금지). `days` 기본값은 helper 의 `DEFAULT_DAYS`(1) 위임 또는 명시 상수 + 주석 근거.
    2. `toDelete` 가 비어있으면 재수집/삭제 없이 빈 요약 반환(no-op, error 아님).
    3. `toDelete` 가 있으면 `deleter.deleteInstants(personId, plan.toDelete)` 로 삭제 위임 → 삭제 수 집계.
    4. 삭제 후 같은 기간을 재수집 — `collectionTriggerService.triggerCollection({ personId, period: <상수>, scope: <상수>, periodStart: plan.window.start.toISOString() })` 1회 호출(REQ-041 "delete → 재수집"). period/scope 상수는 VALID_PERIODS/VALID_SCOPES 허용값 중 도메인 근거와 함께 택1 + 주석.
  - 반환 `RecentDeletionRunResult` 요약 shape(전문 Assessment 반환 금지 — 1~3 필드: `personId`, `deletedCount`, `recollected: boolean` 정도, T-0419 `BackfillRunResult` convention 동형).
- [ ] **error path**: `deleteInstants` 또는 `triggerCollection` 이 throw(Person 404 / 삭제 실패 / collect reject)하면 삭제 후 재수집 사이 부분 상태 모호를 피하기 위해 **fail-fast 전파**(에러 삼키지 않음) — T-0419 동형. 정책을 주석 근거와 함께 박제하고 분기를 spec 으로 cover. 삭제는 성공했으나 재수집이 실패한 경우의 의미(부분 상태)도 주석에 명시.
- [ ] **인자 검증 위임/전파**: `days`/`reference`/`instants` 검증은 `buildRecentDeletionPlan` 에 위임/전파(자체 중복 검증 금지) — days RangeError / reference·instants TypeError 가 runner 를 통해 표면화되는지 단언.
- [ ] `src/scheduling/scheduling.module.ts` 에 `RecentDeletionRunnerService` 를 provider 등록(+ export — 후속 manual delete controller 가 inject). `CollectionTriggerService` 는 이미 import 된 `AssessmentCollectionModule` 에서 resolve. **새 module import / controller / schema 변경 0** — provider/export 추가 최소 범위만.
- [ ] colocated spec `src/scheduling/recent-deletion-runner.service.spec.ts` 신설. mock `CollectionTriggerService` + mock deleter 주입(실 삭제/실 DB/실 수집 0). R-112 4종 + negative 충분 cover:
  - **happy-path**: `toDelete` 가 1+ 인 instants 로 `runRecentDeletion` 호출 시 `deleteInstants` 가 `plan.toDelete` 와 정확히 동일 instant 집합으로 1회 호출되고, 그 후 `triggerCollection` 이 1회 호출되며 그 `periodStart` 가 `plan.window.start` 의 ISO 와 일치, period/scope 상수 단언, 반환 `deletedCount`/`recollected=true` 단언.
  - **error-path**: `deleteInstants` reject → `runRecentDeletion` 이 전파(재수집 미호출) 단언. `triggerCollection` reject → 전파 단언(삭제는 발생, recollect 실패 표면화). 비정상 `personId`(빈 문자열) / 비정상 `instants`(비-배열·Invalid Date 원소) → `buildRecentDeletionPlan` TypeError 전파 단언.
  - **flow/branch**: `toDelete` 빈 케이스(전부 window 밖) → deleter·trigger 0회 호출 + no-op 요약 단언. deleter 미주입(기본=삭제 0) 경로 → 삭제 0 + 분기 단언. `days` 명시(예: 7, 30) vs 기본값 경로로 window 분기 cover.
  - **negative 충분 cover**: days=0/음수/소수/상한 초과(buildRecentDeletionWindow RangeError 전파), reference 비-Date/Invalid Date(TypeError 전파), 빈 instants 배열(정상 no-op), window 경계 instant(start 포함·end 배타) 등 예외 분기마다 1+.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 본 파일 분기 전수 cover 로 100% 목표).

## Out of Scope

- 실 repository delete provider 바인딩 — `RecentDeletionDeleter` 의 실 구현(Prisma 로 Assessment/Contribution row 삭제)은 schema/repository 게이트 동반 별도 sub-slice. 본 task 는 주입형 인터페이스 + 기본 no-op deleter 만(T-0419 가 idempotency 판정자를 주입형으로 둔 것과 동형).
- manual delete REST endpoint(controller/DTO) 노출 — Admin 이 명시적으로 delete→재수집을 트리거하는 진입점(예: POST /api/schedules/recent-deletion/:personId, Admin+ RBAC)은 별도 sub-slice(T-0421 BackfillController 패턴 mirror). 본 task 는 controller 0.
- PersonService / `src/user/` 연동 — 본 runner 는 `personId`/`instants` 를 인자로만 받음. `src/user/` 무변경.
- DB persistence / Prisma schema 변경 — 삭제 표식/audit 영속화는 schema 게이트 동반 별도 sub-slice. 본 task schema 무변경.
- `buildRecentDeletionPlan` / building block helper 3종 자체 수정 — 재사용만(시그니처 불변).
- `CollectionTriggerService` 재구현 — 호출만(시그니처 불변).
- timezone / KST 재논의 — ADR-0039 확정, boundary 는 helper 가 도출.
- 실 live/credentialed 수집·삭제 — Q-0022(만료 6/30) deferred. 본 runner 는 mock-testable, 실 token·실 DB 0.

## Suggested Sub-agents

`implementer → tester`

## Status

PENDING

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
- (slice 2 후속 a) 실 `RecentDeletionDeleter` provider — Prisma 로 해당 기간 Assessment/Contribution 삭제 + module 바인딩(schema/repository 게이트 재확인).
- (slice 2 후속 b) manual delete REST endpoint(예: POST /api/schedules/recent-deletion/:personId, Admin+ RBAC) — `runRecentDeletion` 노출, T-0421 BackfillController 패턴 mirror.
- (slice 3) 삭제 audit/표식 영속화 — schema 게이트.
- (slice 4) api.md / data-model.md doc-sync.
