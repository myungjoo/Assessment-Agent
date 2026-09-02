---
id: T-1842
title: 평가 축 period handler 에 RunStatus 배선 — RunStatusModule import + ctor 주입 + finally 감소 (ADR-0060 (a2-1))
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 330
estimatedFiles: 3
estimatedFilesNote: assessment-evaluation.module.ts + assessment-evaluation.controller.ts + assessment-evaluation.controller.spec.ts — module.spec.ts 는 손대지 않아도 회귀가 잡힌다 (아래 Why 참조)
sizeExempt: true
exemptReason: "R-112 backbone × 1.5 = 291 LOC 에 T-1841 실측 오차(사전 370 → 실제 576, +56%, 초과분 전량 spec)를 반영해 330 으로 상향. base 194 LOC 내역 = spec 165(ctor 4 site 24 + R-112 test 7 종 약 141) + controller 25 + module 4. 파일 수 3 은 cap(5) 이내이며, 이보다 작게 자르면 소비처 없는 ctor 주입만 남아 CLAUDE.md §3 소비처 동반 의무 위반"
created: 2026-09-02
completedAt: 2026-09-02T02:55:21Z
prNumber: 1447
mergeCommit: 6d239280
independentStream: r78-polling
dependsOn: [T-1841]
touchesFiles: [src/assessment-evaluation/assessment-evaluation.module.ts, src/assessment-evaluation/assessment-evaluation.controller.ts, src/assessment-evaluation/assessment-evaluation.controller.spec.ts]
plannerNote: P6 ADR-0060 §Follow-ups (a2-1) — period 축 소비처 배선. cap-bend pre-justified R-112 ×1.5 + T-1841 실측 +56% = 330 LOC
---

# T-1842 — 평가 축 `period` handler 에 RunStatus 배선 (ADR-0060 (a2-1))

## Why

[T-1841](T-1841-run-status-service-module.md) 이 `1d7118d1` 로 머지되며 `RunStatusService` / `RunStatusModule` 을 신설했으나 **호출자가 0** 이다. 본 task 는 그 task 파일 `78~80 행` 의 `## Follow-ups` 가 파일·행까지 박제한 **(a2) 평가 축 소비처 배선** 중 `339 행` `@Post("period")` 한 handler 를 집행해, [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 4` 의 "`begin(axis)` 후 `finally` 에서 `end(axis)`" 전이 계약을 실제 진입점에 부착한다. 이것이 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무가 요구하는 **helper 의 실호출자** 배선이다 (T-1841 은 그 의무의 수치 예외로 분리됐고, 본 task 가 그 부채를 갚기 시작한다).

**issue-still-relevant pre-check 실측 (origin/main `5317ea70`)**: `git grep -n "RunStatus" origin/main -- src/assessment-evaluation src/app.module.ts` 결과가 전부 무관한 `UnevaluatedFillRunStatus` 계열 (`dto/unevaluated-fill-run-result*.ts` · `dto/unevaluated-fill-run-response.mapper.ts`) 이며 **`RunStatusService` · `RunStatusModule` 을 참조하는 줄은 0** 이다. `src/assessment-evaluation/assessment-evaluation.module.ts` `73 행` 의 `imports` 는 `[LlmModule, AssessmentCollectionModule, UserModule]` 뿐이고, controller ctor (`147~196 행`) 의 주입 param 은 9 개로 `RunStatusService` 가 없다. `docs/tasks/` 최신 id 는 T-1841 이라 (a2) 를 선점한 slice 도 없다 — **중복 큐잉 아님**.

**`assessment-evaluation.module.spec.ts` 를 touch 하지 않는 근거**: 그 spec 은 `154 행` · `162 행` 등에서 `Test.createTestingModule({ imports: [PersistenceModule, AssessmentEvaluationModule] })` 로 module 을 실제 구성하므로, `RunStatusModule` import 를 빠뜨린 채 controller ctor 에 `RunStatusService` 를 넣으면 NestJS 가 의존 해석에 실패해 기존 test 가 곧바로 red 가 된다. 즉 import 누락 회귀는 **새 assertion 없이도** 이미 덮여 있다.

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `133~158 행` (§Decision 4 — 켜는 진입점 4 개 · 켜지 않는 `unevaluated-fill-plan` · `finally` 감소가 계약의 핵심인 이유 · 동시 N 건) · `262~269 행` (§Follow-ups (a) — 배선 대상 파일 목록)
- [docs/tasks/T-1841-run-status-service-module.md](T-1841-run-status-service-module.md) `78~80 행` — (a2) 배선 지점의 선행 박제 (본 task 는 그중 `period` 만 집행)
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) `10~41 행` (`RunAxis` · `RunAxisStatus` · `RunStatusSnapshot` export 타입) · `66~96 행` (`begin` / `end` 의 실제 계약 — 짝 없는 `end` 는 warn 후 무시, 카운터 음수 불가)
- [src/run-status/run-status.module.ts](../../src/run-status/run-status.module.ts) 전체 (13 행) — `RunStatusService` 를 provider 등록 + export 하는 최소 module
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `147~196 행` (ctor 9 param — 마지막이 `userService`) · `339~356 행` (`@Post("period")` 데코레이터 4 개 + role dispatch 본문)
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) `34~56 행` (import 블록 — 알파벳 정렬 관행 확인) · `73 행` (`imports` 배열)
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) `143 행` · `244 행` · `346 행` · `2481 행` (`new AssessmentEvaluationController(` 위치 인자 4 site — ctor param 이 늘면 4 곳 모두 수정 필수) · `918~1076 행` (User self-only ephemeral describe) · `1077~1257 행` (Admin full-persist describe) · `1719~1893 행` (reevaluate dispatch describe — 403 fail-closed 경로)
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-112 4 항목과 coverage 임계

## Acceptance Criteria

- [ ] `src/assessment-evaluation/assessment-evaluation.module.ts` 의 `imports` 배열에 `RunStatusModule` 을 추가한다 (기존 3 개 뒤). import 문은 파일의 기존 정렬 관행을 따른다.
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.ts` 의 ctor 에 `private readonly runStatus: RunStatusService` 를 **마지막 param** 으로 추가한다 (기존 9 개의 위치·순서 불변 — spec 의 위치 인자 호출을 최소 충격으로 유지).
- [ ] `339~356 행` `@Post("period")` handler 본문을 `this.runStatus.begin("evaluation")` 직후 `try { ... } finally { this.runStatus.end("evaluation") }` 로 감싼다. **role dispatch 분기 (`persistForAdmin` / `ephemeralForUser`) 를 모두 포함**하도록 handler 최상단에서 감싸며, `begin` 은 `try` 밖 (또는 `try` 첫 줄) 에 두어 `begin` 1 회 ↔ `end` 1 회가 어떤 경로에서도 정확히 짝지어지게 한다 (ADR-0060 `§Decision 4`).
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 의 `new AssessmentEvaluationController(` **4 site 전부** (`143 행` · `244 행` · `346 행` · `2481 행`) 에 `RunStatusService` mock 을 마지막 인자로 주입한다 — `pnpm build` · 기존 test 가 깨지지 않아야 한다. `period` 를 다루지 않는 builder 의 mock 은 호출 시 throw 하는 격리 mock 으로 두어, 다른 handler 가 실수로 카운터를 건드리면 즉시 잡히게 한다 (같은 파일 `130~141 행` 의 `userService` throw mock 선례).
- [ ] **happy-path test** — Admin 분기와 User ephemeral 분기 각각에서 `period()` 정상 반환 시 `begin` 이 `"evaluation"` 인자로 정확히 1 회, `end` 가 `"evaluation"` 인자로 정확히 1 회 호출된다. 위임 결과 (`EvaluationResult[]` / `PeriodBridgeAdminResponse`) 자체는 기존 test 와 동일하게 보존됨을 함께 확인한다.
- [ ] **error path test** — 위임 service 가 reject/throw 하는 경로 (예: `adminBridge` 가 throw) 에서 예외가 **그대로 전파**되면서도 `end("evaluation")` 이 1 회 호출된다 (`finally` 보장). 최소 2 종: ① 위임 service throw ② `userService.findById` throw (timezone 조회 실패 — `§Decision 4` 의 "service-layer raw 전파 예외" 경로).
- [ ] **분기 cover** — `isAdminRole(actor?.role)` 의 두 분기 (Admin → `persistForAdmin` / 비-Admin → `ephemeralForUser`) 각각에서 `begin` · `end` 가 1 회씩 호출됨을 별도 test 로 덮는다.
- [ ] **negative cases 충분 cover** — 최소 다음 각각 1+ test: ① **재평가 fail-closed 403** — 비-Admin 이 `reevaluate: true` 로 호출해 `ForbiddenException` 이 나는 조기 차단 경로에서도 `begin` 과 `end` 가 **각각 1 회로 균형**을 이룬다 (stuck 0). ② **self-only 위반 차단** — principal `sub` 과 `dto.personId` 불일치로 거부되는 경로에서도 `begin`/`end` 균형. ③ **축 격리** — `period()` 어느 경로에서도 `begin("collection")` · `end("collection")` 이 호출되지 않는다. ④ **순서 불변식** — `end` 는 위임 호출이 끝난 뒤에 불린다 (`jest.fn` 의 `mock.invocationCallOrder` 또는 위임 mock 안에서 `end` 미호출 확인). ⑤ **dry-run 미배선 보존** — `538 행` `@Post("unevaluated-fill-plan")` 경로는 `begin`/`end` 를 **호출하지 않는다** (`§Decision 4` 의 "켜지 않는 진입점"). ⑥ **중복 호출 없음** — 한 번의 `period()` 가 `begin` 을 2 회 이상 부르지 않는다 (동시 N 건 카운터를 오염시키지 않음).
- [ ] `pnpm lint` warning 0 · `pnpm build` 성공 · `pnpm test` 전체 green (기존 `assessment-evaluation.module.spec.ts` 포함 — `RunStatusModule` import 누락 시 이 spec 이 red 가 되므로 회귀 게이트로 활용).
- [ ] `pnpm test:cov` 통과 — coverage line ≥ 80% / function ≥ 80% 임계 유지 (`package.json` 의 `coverageThreshold.global`).
- [ ] `BASE_REF=origin/main scripts/check-spec-presence.sh` 통과 (신규 production 파일 0 — 기존 colocated spec 수정뿐).
- [ ] `git diff --stat origin/main` 상 변경 파일이 `src/assessment-evaluation/` 3 개뿐이다 — `prisma/schema.prisma` · `package.json` · lockfile · `.github/workflows/` · `src/run-status/` 변경 **0**.

## Out of Scope

- **`evaluate` · `unevaluated-fill-run` 두 handler 배선** — `208 행` `@Post("evaluate")` (본문 약 64 줄) 와 `599 행` `@Post("unevaluated-fill-run")` (본문 약 43 줄) 은 `finally` 래핑 시 본문이 통째로 재들여쓰기돼 삭제+추가 약 214 LOC 로 계상된다. 아래 `## Follow-ups` (a2-2) 로 분리.
- **`538 행` `@Post("unevaluated-fill-plan")`** — dry-run 이라 ADR-0060 `§Decision 4` 가 명시적으로 제외. 본 task 는 이 handler 를 **수정하지 않으며**, 미호출을 test 로 고정만 한다.
- **수집 축 배선** ((c) — `assessment-collection.controller.ts` `54 행`) · **조회 route + `AppModule` 등록** ((b)) · **e2e** ((d)) · **web polling** ((e)) · **doc-sync 와 REQ-083 재판정** ((f)).
- **`src/run-status/` 파일 수정** — service 계약은 T-1841 에서 확정됐다. 배선 중 계약 변경이 필요해 보이면 고치지 말고 `## Follow-ups` 에 적는다.
- **`prisma/schema.prisma` 변경 · migration · 새 dependency** — 본 배선은 기존 DI 조립뿐이라 어느 쪽도 필요 없다. 필요하다고 판단되면 즉시 중단하고 `BLOCKED` → notifier ([CLAUDE.md](../../CLAUDE.md) `§5`).
- **[requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 · [PLAN.md](../PLAN.md) `133 행` 마커 · [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 표기** — 전부 (f) 몫 ([CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 — 구현 머지 후 1 회).

## Suggested Sub-agents

`implementer → tester`

(architect 불요 — ADR-0060 `§Decision 4` 가 전이 시점 · 진입점 목록 · 예외 경로 계약을 이미 확정했고 T-1841 이 service 표면을 고정했으므로 본 task 는 배선 집행만 한다.)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append.)

- **(a2-2) 잔여 평가 축 handler 배선** — [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) 의 `208 행` `@Post("evaluate")` 와 `599 행` `@Post("unevaluated-fill-run")` 를 본 task 와 동형으로 `begin("evaluation")` + `finally { end("evaluation") }` 로 감싸고, [assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 의 `makeController` (`76 행`) · `makeFillController` (`267 행`) · `makeRunController` (`2410 행`) 빌더 mock 을 throw mock 에서 관측 mock 으로 바꿔 R-112 4 종을 덮는다. 본 task 에서 ctor 주입과 module import 는 이미 끝나 있으므로 (a2-2) 는 handler 2 개 + 그 spec 만 남는다. cap 압박 시 `evaluate` 와 `unevaluated-fill-run` 을 다시 쪼갠다.
- **(b) ~ (f)** — [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` `270~294 행` 그대로.
