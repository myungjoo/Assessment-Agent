---
id: T-1841
title: RunStatusService + RunStatusModule 신설 — 실행 상태 in-memory 카운터 (ADR-0060 (a1))
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 370
estimatedFiles: 4
estimatedFilesNote: run-status.service.ts + run-status.service.spec.ts + run-status.module.ts + run-status.module.spec.ts (module 신설은 scripts/check-spec-presence.sh 상 module.spec.ts 동반이 강제)
sizeExempt: true
exemptReason: "R-112 backbone × 1.5 = 370 LOC — 4 파일 중 2 개(≈ 250 LOC, 전체의 약 65%)가 spec 이고, service·module 은 DI 한 단위라 쪼개면 provider 없는 service 만 남는다. 파일 수 4 는 cap(5) 이내"
created: 2026-09-02
completedAt: 2026-09-02T01:52:35Z
prNumber: 1446
mergeCommit: 1d7118d1
independentStream: r78-polling
dependsOn: [T-1840]
touchesFiles: [src/run-status/run-status.service.ts, src/run-status/run-status.service.spec.ts, src/run-status/run-status.module.ts, src/run-status/run-status.module.spec.ts]
plannerNote: P6 ADR-0060 §Follow-ups (a1) 상태 service+module — cap-bend pre-justified R-112 backbone ×1.5=370 LOC (T-0071 패턴)
---

# T-1841 — RunStatusService + RunStatusModule 신설 (ADR-0060 (a1))

## Why

[ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) 이 `3a3fde4e` 로 머지되며 R-78 polling 의 선행 gap (평가/수집 실행 상태 조회 endpoint) 의 **결정 5 축**을 코드 0 LOC 로 닫았고, 그 `§Follow-ups` 가 (a) → (b) → (d) → (e) → (f) chain 을 박제했다. 본 task 는 그 chain 의 첫 항목 (a) 중 **상태 보유 자산** 부분을 집행한다 — `§Decision 1` 이 채택한 "프로세스 in-memory 실행 카운터 서비스" 를 실제 provider 로 만든다. 새 외부 dependency 0 · `prisma/schema.prisma` 변경 0 이라 [CLAUDE.md](../../CLAUDE.md) `§5` 의 new-dep · DB schema 게이트 어느 쪽에도 걸리지 않는다 ([ADR-0042](../decisions/ADR-0042-nestjs-schedule-adoption.md) `57 행` 의 단일 process in-memory 선례와 같은 경계선).

**issue-still-relevant pre-check 실측 (origin/main `b58337c6`)**: `git ls-tree -r origin/main` 상 `src/run-status/` 는 **존재하지 않고** (`run-status` 문자열이 걸리는 것은 `docs/decisions/ADR-0060-*.md` 와 `docs/tasks/T-1840-*.md` 두 문서뿐), `src` · `web` · `test` 에서 `RunStatus` 를 grep 하면 무관한 `unevaluated-fill-run-result*` 3 파일 (`UnevaluatedFillRunStatus` 류 식별자) 만 걸린다. `docs/tasks/` 최신 id 는 T-1840 이고 chain 의 어떤 slice 도 선점되지 않았다 — **중복 큐잉 아님**.

## 소비처 동반 의무 (CLAUDE.md §3) — 분리 사유를 수치로 제시

[CLAUDE.md](../../CLAUDE.md) `§3` 은 순수 helper 신설 slice 에 **그 helper 를 실제로 호출하는 소비처 배선을 같은 PR 에** 담을 것을 요구하며, cap 초과가 **수치로 제시된** 경우에만 분리를 허용한다. 본 task 는 그 예외에 해당하며 근거는 다음과 같다 (전부 origin/main `b58337c6` 실측).

- **파일 수 7 → cap(5) 초과**: 평가 축 소비처까지 담으면 본 task 의 4 파일에 더해 ① [assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) (`RunStatusModule` import) ② [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) (ctor 주입 + 3 handler) ③ [assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 가 **불가피하게** 추가돼 7 파일이 된다. ③ 은 선택이 아니다 — 그 spec 은 `new AssessmentEvaluationController(` 를 **위치 인자로 4 곳** (`143 행` · `244 행` · `346 행` · `2481 행`) 에서 직접 생성하므로, ctor 에 필수 param 하나가 늘면 같은 commit 에서 4 곳을 고치지 않는 한 `pnpm build` 가 깨진다.
- **LOC ≈ 670 → cap(300) 의 2 배 초과**: 소비처 몫만 약 300 LOC 다. `finally` 로 감싸면 handler 본문이 통째로 재들여쓰기돼 삭제+추가로 계상되기 때문이다 — `evaluate` `212~276 행` (약 64 줄) · `period` `343~357 행` (약 15 줄) · `runUnevaluatedFill` `603~645 행` (약 43 줄) 합 122 줄 × 2 ≈ 244 LOC, 여기에 ctor param · module import · spec 4 site 수정 약 60 LOC 가 더해진다.

따라서 소비처 배선은 아래 `## Follow-ups` 에 **어느 파일의 어느 배선인지까지** 박제해 분리한다 (§3 이 요구하는 형식).

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `59~84 행` (§Decision 1 — 보유 방식과 채택 근거) · `86~115 행` (§Decision 2 — 응답 필드 표와 불변식) · `133~158 행` (§Decision 4 — 전이 규칙 · 동시 N 건 · 재시작 복구) · `262~269 행` (§Follow-ups (a) — 본 slice 의 범위) · `210~213 행` (§Consequences (e) — schema 승격 금지)
- [src/persistence/persistence.module.ts](../../src/persistence/persistence.module.ts) `17 행` 파일 전체 — 최소 module 형태 참조
- [src/persistence/persistence.module.spec.ts](../../src/persistence/persistence.module.spec.ts) — module spec 이 무엇을 검증하는지의 형태 참조 (provider 해석 · export)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `208 행` · `339 행` · `599 행` — **읽기만** (후속 slice 의 소비처 지점. 본 task 에서 이 파일을 수정하지 않는다)
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-112 4 항목과 coverage 임계

## Acceptance Criteria

- [ ] `src/run-status/run-status.service.ts` 신설 — `@Injectable()` `RunStatusService` 가 축별 (`"evaluation"` · `"collection"`) 실행 카운터를 프로세스 메모리에만 보유하고, 다음 public 표면을 갖는다: `begin(axis)` (카운터 1 증가 + 시작 시각 기록) · `end(axis)` (1 감소) · `snapshot()`. DB · 파일 · 외부 store 접근 0 (ADR-0060 `§Decision 1`).
- [ ] `snapshot()` 반환 타입이 ADR-0060 `§Decision 2` 표의 **필드명·타입 그대로** 다 — `active` · `evaluation.active` · `evaluation.runningCount` · `evaluation.startedAt` (ISO-8601 UTC `string` 또는 `null`) · `collection.*` 동형 · `observedAt`. 타입 (`RunAxis` · `RunStatusSnapshot` 등) 은 후속 (b) controller 가 응답 타입으로 재사용하도록 **export** 한다.
- [ ] `src/run-status/run-status.module.ts` 신설 — `RunStatusService` 를 provider 로 등록하고 **export** 한다 (후속 slice 가 `RunStatusModule` import 만으로 주입받도록). `AppModule` 등록은 하지 않는다 (Out of Scope).
- [ ] **happy-path test** — `begin` · `end` · `snapshot` 각 public symbol 1+ 씩: 비실행 상태 `snapshot()` 이 `active: false` · `runningCount: 0` · `startedAt: null` 을 주고, `begin("evaluation")` 후 `active: true` · `runningCount: 1` · `startedAt` 이 ISO-8601 문자열이며, `end("evaluation")` 후 원상 복귀함.
- [ ] **error path test** — `begin` 없이 `end(axis)` 를 호출해도 `runningCount` 가 **음수가 되지 않고** 0 으로 유지된다 (불균형 `end` 2 회 연속도 동일). 타입 밖 axis 값을 런타임 cast 로 넘겼을 때의 동작 (무시 또는 명시 거부 — 구현이 택한 쪽) 을 test 로 고정한다.
- [ ] **분기 cover** — `active` 산출 분기 (`runningCount > 0` 인 경우 / 0 인 경우), 두 축 조합 4 상태 (둘 다 idle / evaluation 만 / collection 만 / 둘 다), `startedAt` 의 `null` 분기와 값 분기를 각각 1+ test 로 덮는다.
- [ ] **negative cases 충분 cover** — 최소 다음 각각 1+ test: ① 동시 N 건 (`begin` 3 회 후 `end` 1 회 → `runningCount: 2` · `active` 여전히 `true`, 마지막 1 건이 끝나야 `false`) ② **out-of-order 종료** — 나중에 시작한 실행이 먼저 끝나도 `startedAt` 이 *아직 실행 중인 것들의 실제 최솟값* 이다 ③ **축 격리** — `begin("evaluation")` 이 `collection` 의 어떤 필드도 바꾸지 않는다 ④ **불변식** `active === (evaluation.active || collection.active)` 와 각 축 `active === (runningCount > 0)` 이 위 모든 상태에서 성립 ⑤ **예외 경로 감소** — 호출자가 `begin` 후 throw 하고 `finally` 에서 `end` 하는 시나리오에서 카운터가 0 으로 복원됨 (ADR-0060 `§Decision 4` 의 stuck 방지 계약을 service 단위로 고정) ⑥ `observedAt` 이 호출마다 갱신되는 ISO-8601 문자열임.
- [ ] `src/run-status/run-status.module.spec.ts` 로 module 이 `RunStatusService` 를 해석·export 하는지 검증 (provider 미등록 회귀 차단). 신규 production `.ts` 2 개 각각에 colocated spec 이 존재하므로 `BASE_REF=origin/main scripts/check-spec-presence.sh` 가 통과한다.
- [ ] `pnpm lint` warning 0 · `pnpm build` 성공 · `pnpm test` 전체 green.
- [ ] `pnpm test:cov` 통과 — coverage line ≥ 80% / function ≥ 80% 임계 유지 (`package.json` 의 `coverageThreshold.global`).
- [ ] `git diff --stat origin/main` 상 변경 파일이 `src/run-status/` 4 개뿐이다 — `prisma/schema.prisma` · `package.json` · lockfile · `.github/workflows/` 변경 **0** (ADR-0060 `§Consequences (e)`: schema 승격이 필요하다고 판단되면 즉시 중단하고 `BLOCKED` → notifier 를 거친다. 본 task 의 권한으로 schema 를 바꾸지 않는다).

## Out of Scope

- **`GET /api/run-status` route · controller · guard 부착** — ADR-0060 `§Follow-ups (b)` 몫. 본 task 는 route 를 0 개 추가한다.
- **`src/app.module.ts` 등록** — (b) 와 함께 간다. 지금 등록하면 소비처 없는 module 이 부팅에 매달린다.
- **평가 축 controller 배선** (`assessment-evaluation.controller.ts` 의 `208 행` · `339 행` · `599 행` 및 `assessment-evaluation.module.ts`) — 위 `## 소비처 동반 의무` 의 수치 근거대로 분리. 본 task 에서 이 두 파일을 **수정하지 않는다**.
- **수집 축 배선** ((c)) · **e2e** ((d)) · **web polling** ((e)) · **doc-sync 와 REQ-083 재판정** ((f)).
- **`prisma/schema.prisma` 변경 · migration** — 채택안이 schema 를 필요로 하지 않는다.
- **진행률 · 취소 · 실행 이력 · TTL · 강제 해제 endpoint** — ADR-0060 `§Decision 4` · `§Consequences (c)` 가 명시적으로 제외했다 (재시작 자체가 복구 수단).
- **[requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 · [PLAN.md](../PLAN.md) `133 행` 마커 변경 · [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 표기 변경** — 전부 (f) 몫이며, chain 완주 전 배너는 계속 비활성이다 (ADR-0060 `§Consequences (a)` 의 false-success 경고).

## Suggested Sub-agents

`implementer → tester`

(architect 불요 — ADR-0060 이 보유 방식 · 필드 shape · 전이 규칙을 이미 확정했으므로 본 task 는 집행만 한다.)

## Follow-ups

- **(a2) 평가 축 소비처 배선** — [assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) 의 `imports` 에 `RunStatusModule` 추가, [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) ctor 에 `RunStatusService` 주입 후 `208 행` `@Post("evaluate")` · `339 행` `@Post("period")` · `599 행` `@Post("unevaluated-fill-run")` 3 handler 를 `begin("evaluation")` + `finally { end("evaluation") }` 로 감싼다 (`538 행` `@Post("unevaluated-fill-plan")` 은 dry-run 이라 **제외** — ADR-0060 `§Decision 4`). [assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 의 `new AssessmentEvaluationController(` 4 site (`143 행` · `244 행` · `346 행` · `2481 행`) 에 mock 주입 추가 + 예외 경로 감소 test. LOC 근거상 handler 3 개를 한 PR 에 담으면 cap 압박이 크므로 필요 시 (a2-1) `period` + (a2-2) `evaluate` · `unevaluated-fill-run` 로 다시 쪼갠다.
- **(b) ~ (f)** — ADR-0060 `§Follow-ups` `270~294 행` 그대로.
