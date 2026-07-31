---
id: T-1347
title: PLAN.md P6 의 재평가·스케줄 패널 "미마운트 defer" 서술을 실 배선과 정합 (120 · 123 행)
phase: P6
status: DONE
completedAt: 2026-07-31T11:47:00Z
commitMode: direct
coversReq: [REQ-049, REQ-039, REQ-040, REQ-041]
estimatedDiff: 20
estimatedFiles: 2
created: 2026-07-31
independentStream: p6-plan-residual-resync
dependsOn: []
touchesFiles:
  - docs/PLAN.md
  - docs/tasks/T-1347-plan-p6-panel-mount-residual-resync.md
plannerNote: "P6 120·123 행이 이미 마운트된 SchedulePanel·ReEvaluationTriggerPanel 을 여전히 defer 로 적어 planner 판단을 오도"
---

# T-1347 — PLAN.md P6 의 재평가·스케줄 패널 "미마운트 defer" 서술을 실 배선과 정합 (120 · 123 행)

## Why

[T-1346](T-1346-uc05-difficulty-mapping-route-parity.md) 이 UC-05 route parity 를 닫으며 "UC-05 안에는 같은 부류 gap 이 더 없다" 고 종결했다. planner 가 다음 축을 찾으며 [docs/PLAN.md](../PLAN.md) P6 절을 실측한 결과, **planner 자신이 매 turn 읽는 마스터 플랜에 stale 서술 2 곳** 이 남아 있다 — doc-parity 축 중 가장 파급이 큰 부류다 (틀린 defer 표기는 이미 끝난 일을 backlog 로 오인시키거나, 반대로 진짜 잔여를 가린다).

실측: `web/src/views/AdminView.tsx` **4493 행 `<SchedulePanel …>`** · **4525 행 `<ReEvaluationTriggerPanel …>`** 가 주석이 아닌 실 JSX 로 마운트돼 있고, 배선 commit 도 박제돼 있다 ([T-0885](T-0885-wire-schedule-panel-adminview.md) SchedulePanel↔`PUT·GET /api/schedules` + `POST /api/schedules/trigger`, [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) ReEvaluationTriggerPanel↔`POST /api/schedules/recent-deletion/:personId`, squash `532df2d3`). backend 계약도 P7 133 ~ 135 행이 shipped 로 적은 `cron-schedule.controller.ts` · `recent-deletion.controller.ts` 그대로다 — **defer 사유가 소멸했다.**

그런데 PLAN **120 행** 은 여전히 `재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel) 은 backend 계약 미shipped 로 미마운트 defer` 라 적고, **123 행** 은 그 둘을 deferred 잔여 목록 첫 항목으로 유지한 채 `남은 2 항목만이 실제 defer` 로 집계한다. [T-1313](T-1313-p6-deferred-residual-list-resync.md) 이 같은 목록을 한 번 resync 하며 멤버 mutation · import 결과 상세를 내렸지만 본 2 패널은 놓쳤다 — 본 slice 가 그 잔여를 닫는다. 실제 남는 defer 는 **EvaluationGuardBanner 자동 polling 1 항목뿐** 이며 이는 여전히 유효하다 (`web/src/views/DashboardView.tsx` 94 행 주석이 "계약 미shipped 라 자동 polling 파생은 Out of Scope" 로 실증).

## Required Reading

- `docs/PLAN.md` **120 행** — 수정 대상 1. P6 세 번째 `- [x]` bullet (`Admin 패널 (인원·그룹·재평가·import/export·스케줄)`). 대상은 **끝 문장 하나** 뿐이다: `단 **재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel) 은 backend 계약 미shipped 로 미마운트 defer**(아래 deferred 잔여 참조).` 앞부분 (`- [x]` 체크박스 · `**(부분 완료 — shipped 계약 범위)**` 마커 · `AdminView(④a~④h, T-0385~T-0392)…조립 완료(REQ-049).`) 은 **전부 불변**.
- `docs/PLAN.md` **123 행** — 수정 대상 2. `- **deferred 잔여 (backend 계약 확정 후 배선)**` 하위 bullet. 대상 3 요소: (a) 잔여 목록 안의 `ReEvaluationTriggerPanel·SchedulePanel 미마운트(api.md 94~97 …새 dep)` 항목, (b) `**목록에서 내린 항목 (배선 완료)**` 문장에 본 2 패널 추가, (c) 끝의 `남은 2 항목만이 실제 defer 다.` 집계. **bullet 머리 문구 (`다음은 make-work 가 아니라 backend-contract 미shipped 로 의도적 defer:`) · 멤버 mutation/import 결과 상세 나열과 그 task 링크 · `EvaluationGuardBanner 자동 polling(assessments rows status 필드 부재)` 항목은 불변.**
- `docs/PLAN.md` **121 행** — 읽기 전용 대조. `자동 polling 은 backend status 계약 미shipped 로 defer` 서술은 **여전히 참** 이라 손대지 않는다 (본 slice 가 남기는 유일한 defer 와 정합).
- `docs/PLAN.md` **133 ~ 135 행** — 읽기 전용 pointer. P7 의 `cron-schedule.controller.ts` (`@Get`/`@Put`/`@Delete(":name")`/`@Post("trigger")`) · `recent-deletion.controller.ts` (`@Post("recent-deletion/:personId")`) shipped 서술 = 120 행이 "미shipped" 라 적은 backend 계약의 반증. **수정 금지.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "<SchedulePanel\|<ReEvaluationTriggerPanel" -- web/src/views/AdminView.tsx` → **2 hit** (4493 · 4525 행, 실 JSX 마운트).
  - `git log --oneline --all --grep="T-0886" | head -3` → `532df2d3 feat(web): ReEvaluationTriggerPanel 을 AdminView 에 배선 (T-0886) (#780)` 확인.
  - `grep -n "미마운트\|남은 2 항목" docs/PLAN.md` → 편집 전 **2 hit (120 · 123 행)**. 행 번호 drift 시 실측 행 번호를 따르고 Follow-ups 에 기록.
  - `git grep -n "자동 polling" -- web/src/views/DashboardView.tsx` → 94 행 주석 1 hit (polling defer 존치 근거).

## Acceptance Criteria

- [x] **120 행 끝 문장 교체** — `단 **재평가(…)·스케줄(…) 은 backend 계약 미shipped 로 미마운트 defer**(아래 deferred 잔여 참조).` 를 **배선 완료 서술** 로 바꾼다: 두 패널이 AdminView 에 마운트됐다는 사실 + 배선 task 링크 (`T-0885` SchedulePanel / `T-0886` ReEvaluationTriggerPanel) + 소비 endpoint (`PUT·GET /api/schedules` · `POST /api/schedules/trigger` · `POST /api/schedules/recent-deletion/:personId`) + defer 사유 소멸 근거 pointer (`P7 133~135 행 shipped`) 를 한 문장으로 인라인 박제. **행 분할 금지** — 120 행은 편집 후에도 **한 줄**.
- [x] **`(부분 완료 — shipped 계약 범위)` 마커 불변** — 120 행의 이 마커는 건드리지 않는다. LLM provider 관리 UI mutation 등 다른 미판정 잔여가 있을 수 있어 마커 재평가는 별도 축이다 (Out of Scope, 필요 시 Follow-ups 한 줄).
- [x] **123 행 3 요소 수정** — (a) 잔여 목록에서 `ReEvaluationTriggerPanel·SchedulePanel 미마운트(…)` 항목과 그 괄호 사유 (`api.md 94~97 /run·bulk DELETE·/reeval·/reset 미구현; SchedulePanel 은 SchedulerModule = P7 + @nestjs/schedule 새 dep`) 를 **삭제**, (b) `**목록에서 내린 항목 (배선 완료)**` 나열에 두 패널을 [T-0885](T-0885-wire-schedule-panel-adminview.md) · [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) 링크와 함께 **추가** (기존 멤버 mutation · import 결과 상세 나열과 링크는 불변), (c) 끝 집계를 `남은 2 항목만이 실제 defer 다` → `남은 1 항목(EvaluationGuardBanner 자동 polling)만이 실제 defer 다` 로 갱신. **행 분할 금지** — 123 행도 편집 후 **한 줄**.
- [x] **polling 잔여 존치** — 편집 후 123 행에 `EvaluationGuardBanner 자동 polling(assessments rows status 필드 부재)` 항목이 **그대로 남아 있고**, `grep -c "자동 polling" docs/PLAN.md` 가 편집 전후 동일하다 (121 행 + 123 행). polling 을 shipped 로 적는 것은 **명백한 오기** — `DashboardView.tsx` 94 행이 반증한다.
- [x] **구조 무손상** — 편집 후 `wc -l docs/PLAN.md` 가 **173** 으로 편집 전과 동일하고, `grep -c "^- \[x\]\|^- \[ \]" docs/PLAN.md` 가 편집 전후 동일 (체크박스 증감 0 · bullet 병합/분할 0). 120 행 `- [x]` · 123 행 들여쓴 `  - ` 접두는 그대로.
- [x] **검증 grep** — (a) `grep -n "미마운트" docs/PLAN.md` 가 **0 hit**, (b) `grep -c "남은 1 항목" docs/PLAN.md` = **1** 이고 `grep -c "남은 2 항목" docs/PLAN.md` = **0**, (c) `grep -c "T-0885\|T-0886" docs/PLAN.md` ≥ **2** (배선 task 링크 박제), (d) `git diff --stat` 이 `docs/PLAN.md` · 본 task 파일 **2 개만** 보이고 PLAN 의 `git diff` hunk 가 **120 행 · 123 행 2 개뿐** 이다.
- [x] **다른 절 불변** — 87 행 · 116 행 · 118 · 119 행 · 121 행 · 122 행 · 124 · 125 행 · P7 133 ~ 135 행 · 운영 정책 review backlog (157 ~ 163 행) 는 diff 에 등장하지 않는다.
- [x] `src/` · `web/` · `test/` · `prisma/` · `docs/architecture/*` · `docs/use-cases/*` · `docs/requirements.md` · `docs/STATE.json` 은 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만, STATE 는 driver 소관). `git status --porcelain` 결과가 위 2 파일뿐 (driver 의 STATE/journal bookkeeping 제외).
- [x] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) ~ [T-1346](T-1346-uc05-difficulty-mapping-route-parity.md) 선례) — 대신 위 검증 grep + 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`web/` 코드 수정 일체** — 본 slice 는 **문서를 이미 shipped 된 현실에 맞추는 것** 이다. AdminView · SchedulePanel · ReEvaluationTriggerPanel 은 한 글자도 건드리지 않는다.
- **EvaluationGuardBanner 자동 polling 배선** — backend status 계약이 여전히 미shipped 라 진짜 defer 다. 배선은 계약 확정 후 별도 `pr` task.
- **120 행 `(부분 완료 — shipped 계약 범위)` 마커 재판정** — LLM provider 관리 UI mutation 등 다른 잔여 유무를 전수 확인해야 하는 별도 축. 본 slice 에서 마커까지 손대면 diff 축이 흐려진다.
- **124 · 125 행 게이트된 backlog (web vitest CI 배선 · web coverage threshold) 재검토** — credential / 새 dependency 게이트 대상이라 planner 단독 판단 밖 (§5).
- **P6 이외 절 (P5 106 · 108 · 109 행 미완 bullet · P7 138 행 성능 검증 · P8 149 행 부하 테스트) 의 stale 여부 전수 감사** — 축이 다르고 크기 상한을 넘긴다. 같은 부류 stale 이 눈에 띄면 Follow-ups 에 1 줄만 남긴다.
- **`docs/architecture/api.md` 94 ~ 97 행 (`/run` · bulk DELETE · `/reeval` · `/reset`) 실재 재검증** — 123 행에서 삭제할 괄호 사유가 인용하던 대상이지만, 그 endpoint 들의 문서 표기 정합은 별개 slice 소관이다.

## Suggested Sub-agents

`implementer` (doc-only · PLAN.md 2 행 인라인 수정 — architect · tester 불요, T-1313 · T-1340 ~ T-1346 선례)

## Follow-ups

- **120 행 `(부분 완료 — shipped 계약 범위)` 마커 재판정** — 본 slice 로 P6 Admin 패널의 deferred 잔여가 0 이 됐으나 마커는 Out of Scope 라 그대로 뒀다. LLM provider 관리 UI mutation 등 다른 미판정 잔여 유무를 전수 확인한 뒤 `(완료)` 승격 여부를 판단하는 별도 축이 필요하다.
- **실측 행 번호 drift 없음** — Required Reading 이 지목한 120 · 123 행이 편집 전후 모두 실제 대상 행과 일치했다 (`wc -l` 173 불변, PLAN hunk 2 개).
- **같은 부류 stale 후보 (P6 116 행)** — 오너 승인 인용문이 아직 `deferred 잔여 배선(ReEvaluationTriggerPanel·SchedulePanel·polling 등) 재개 승인` 으로 세 항목을 나열한다. 오너 발화 원문이라 본 slice 에서 손대지 않았으나, 원문 보존과 stale 표기 정합 중 무엇을 우선할지 별도 판단이 필요하다.
