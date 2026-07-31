---
id: T-1349
title: components.md 113 행 Web UI 행의 "ReEval/Schedule 마운트 잔여" 서술을 실 배선과 정합
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-038, REQ-026, REQ-044, REQ-049]
estimatedDiff: 10
estimatedFiles: 2
created: 2026-07-31
independentStream: p6-plan-residual-resync
dependsOn: [T-1348]
touchesFiles:
  - docs/architecture/components.md
  - docs/tasks/T-1349-components-doc-panel-mount-resync.md
plannerNote: "T-1347(PLAN)·T-1348(modules·directory) 이후 남은 마지막 stale locus — components.md 113 행이 두 패널을 아직 잔여로 박제"
---

# T-1349 — components.md 113 행 Web UI 행의 "ReEval/Schedule 마운트 잔여" 서술을 실 배선과 정합

## Why

[T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) (머지 `2c3b2164`, [docs/PLAN.md](../PLAN.md) 120 · 123 행) 과 [T-1348](T-1348-modules-doc-defer-list-resync.md) (머지 `7a449534`, [modules.md](../architecture/modules.md) 239 행 · [directory.md](../architecture/directory.md) 164 행) 이 `ReEvaluationTriggerPanel` · `SchedulePanel` 의 "미마운트 defer" stale 서술을 닫고, **실제 남는 defer 는 `EvaluationGuardBanner` 자동 polling 1 항목뿐** 임을 세 문서에 박제했다. 그런데 같은 주장을 담은 **마지막 locus 가 미갱신으로 남아 있다** — [docs/architecture/components.md](../architecture/components.md) **113 행** (Component table 의 **Web UI** 행) 이 여전히 `일부 잔여 표면 (ReEval/Schedule 마운트 · auto-polling 등) 은 backend 계약 확정 후 배선` 이라고 적는다.

이 잔여가 파급이 있는 이유는 두 가지다. (1) components.md 의 Web UI 행은 shipped 컴포넌트를 **열거하는 index** 인데 그 열거에 두 패널이 빠져 있어, 문서만 읽는 planner 에게는 "미배선 표면" 으로 보인다 — modules.md 239 행이 경고한 "이미 shipped 된 표면을 미배선으로 오판해 **중복 task 로 큐잉**" 하는 실패 모드 그대로다. (2) 같은 행이 `— [modules.md](modules.md) 의 defer 서술 참조` 로 **modules.md 에 위임** 하고 있는데, 그 위임 대상은 T-1348 로 이미 1 항목까지 줄었다 — 즉 components.md 는 자기 위임처와 어긋난 요약을 들고 있다.

실측 근거: `web/src/views/AdminView.tsx` **4493 행 `<SchedulePanel`** · **4525 행 `<ReEvaluationTriggerPanel`** 가 실 JSX 로 마운트돼 있고 ([T-0885](T-0885-wire-schedule-panel-adminview.md) · [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md)), backend 계약도 PLAN P7 133 ~ 135 행이 shipped 로 박제한 `cron-schedule.controller.ts` · `recent-deletion.controller.ts` 그대로다. 반면 polling defer 는 **여전히 유효** 하다 (`web/src/views/DashboardView.tsx` 94 행 주석). 본 slice 는 T-1348 이 modules.md 에 적용한 편집 패턴을 **표 행 1 줄** 에 축소 적용해 P6 잔여-서술 stream 을 종결한다.

## Required Reading

- `docs/architecture/components.md` **113 행** — 유일한 수정 대상. `## Component table` (109 행) 의 첫 데이터 행이며 **5 컬럼 파이프 표 한 줄** (`| component | 책임 | 입력/출력 contract | 관련 REQ | 관련 ADR / 문서 |`, 112 행이 구분자). 수정 요소는 2 개뿐: (a) 2 번째 컬럼 "책임" 안의 **shipped 컴포넌트 열거** (`… · `AdminView` (`GroupMemberList` 조회 · `DifficultyModelSelector` · export/import · RBAC gating)`), (b) 같은 컬럼 끝의 **잔여 문장** (`일부 잔여 표면 (ReEval/Schedule 마운트 · auto-polling 등) 은 backend 계약 확정 후 배선 — [modules.md](modules.md) 의 defer 서술 참조.`). **4 · 5 번째 컬럼 (관련 REQ · 관련 ADR / 문서) 은 불변.**
- `docs/architecture/modules.md` **239 행 근처 문단** — 읽기 전용 정본. [T-1348](T-1348-modules-doc-defer-list-resync.md) 이 박제한 최종 상태 (잔여 = `EvaluationGuardBanner` 자동 polling 1 항목, 내린 항목 bullet 에 T-0885 · T-0886 근거) 와 본 slice 의 편집 결과가 **같은 사실** 을 말해야 한다. **modules.md 수정 금지** — components.md 는 위임하는 쪽이지 목록의 소유자가 아니다.
- `docs/PLAN.md` **123 행** — 읽기 전용 정본 대조 (`남은 1 항목(EvaluationGuardBanner 자동 polling)만이 실제 defer 다`). **PLAN.md 수정 금지.**
- 실측 명령 3 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "<SchedulePanel\|<ReEvaluationTriggerPanel" -- web/src/views/AdminView.tsx` → **2 hit** (4493 · 4525 행).
  - `git grep -n "자동 polling" -- web/src/views/DashboardView.tsx` → 94 행 주석 **1 hit** (polling defer 존치 근거).
  - `grep -n "ReEval/Schedule 마운트" docs/architecture/components.md` → 편집 전 **1 hit** (113 행). 행 번호 drift 시 실측 행 번호를 따르고 Follow-ups 에 기록.

## Acceptance Criteria

- [x] **(a) shipped 열거 보강** — 113 행 "책임" 컬럼의 `AdminView` 괄호 안 열거에 **`SchedulePanel` · `ReEvaluationTriggerPanel` 마운트** 를 추가한다 (기존 `GroupMemberList` 조회 · `DifficultyModelSelector` · export/import · RBAC gating 항목은 문구 그대로 보존, 추가만). 근거 task 링크 [T-0885](../tasks/T-0885-wire-schedule-panel-adminview.md) · [T-0886](../tasks/T-0886-wire-reevaluation-trigger-panel-adminview.md) 를 함께 박제한다.
- [x] **(b) 잔여 문장 축소** — `일부 잔여 표면 (ReEval/Schedule 마운트 · auto-polling 등) 은 backend 계약 확정 후 배선` 을 **잔여가 `EvaluationGuardBanner` 자동 polling 1 항목뿐** 이라는 서술로 교체한다. 끝의 위임 절 (`— [modules.md](modules.md) 의 defer 서술 참조`) 은 **불변 유지** (링크 텍스트 · 상대 경로 모두 그대로).
- [x] **표 구조 무손상** — 편집 후 `awk -F'|' 'NR==113{print NF}' docs/architecture/components.md` = **7** (5 컬럼 · 파이프 6 개 불변), 113 행은 여전히 **한 줄** (행 분할 · 셀 안 개행 금지), 셀 안에 **파이프 문자 신규 도입 금지** (표가 깨진다).
- [x] **polling 잔여 존치** — 편집 후 `grep -c "polling" docs/architecture/components.md` ≥ **1**. polling 을 shipped 로 적는 것은 **명백한 오기** — `web/src/views/DashboardView.tsx` 94 행이 반증한다.
- [x] **검증 grep** — (a) `grep -c "ReEval/Schedule 마운트" docs/architecture/components.md` = **0**, (b) `grep -c "SchedulePanel" docs/architecture/components.md` ≥ **1** (잔여 목록에서 shipped 열거로 **이동** — 완전 삭제 아님), (c) `grep -c "ReEvaluationTriggerPanel" docs/architecture/components.md` ≥ **1**, (d) `grep -c "T-0885\|T-0886" docs/architecture/components.md` ≥ **1**, (e) `grep -c "modules.md" docs/architecture/components.md` = **2 불변** (위임 링크 보존 확인).
- [x] **파일 구조 무손상** — 편집 후 `wc -l docs/architecture/components.md` = **190 불변** (줄 증감 0), `grep -c "^| " docs/architecture/components.md` = **29 불변**, `grep -c "^## " docs/architecture/components.md` = **7 불변**.
- [x] **diff 축 한정** — `git diff --stat` 이 `docs/architecture/components.md` · 본 task 파일 **2 개만** 보이고, components.md hunk 는 **113 행 1 개뿐** (114 행 이하 Backend API / Worker / DB Persistence 행은 diff 에 등장하지 않는다).
- [x] `src/` · `web/` · `test/` · `prisma/` · `docs/PLAN.md` · `docs/architecture/modules.md` · `docs/architecture/directory.md` · `docs/architecture/api.md` · `docs/use-cases/*` · `docs/requirements.md` · `docs/STATE.json` 은 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만, STATE 는 driver 소관). `git status --porcelain` 결과가 위 2 파일뿐 (driver 의 STATE/journal bookkeeping 제외).
- [x] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) · [T-1348](T-1348-modules-doc-defer-list-resync.md) 선례) — 대신 위 검증 grep + 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`web/` · `src/` 코드 수정 일체** — 본 slice 는 **문서를 이미 shipped 된 현실에 맞추는 것** 이다. AdminView · SchedulePanel · ReEvaluationTriggerPanel · DashboardView 는 한 글자도 건드리지 않는다.
- **`EvaluationGuardBanner` 자동 polling 배선** — backend status 계약 (`assessments` rows 의 진행 status 필드) 이 여전히 미shipped 라 진짜 defer 다. 배선은 계약 확정 후 별도 `pr` task.
- **`docs/architecture/modules.md` · `directory.md` 재수정** — [T-1348](T-1348-modules-doc-defer-list-resync.md) 이 이미 정합시켰다. 본 slice 는 두 문서를 **읽기 전용 정본** 으로만 참조한다.
- **`docs/PLAN.md` 116 행 (오너 승인 인용문 안의 stale 패널 열거)** — 인용문 원문 보존 vs 편집 주 부기 판단이 걸린 별도 축 ([T-1348](T-1348-modules-doc-defer-list-resync.md) Out of Scope 가 이미 분리).
- **components.md 나머지 28 개 표 행 · 다이어그램 절의 stale 전수 감사** — 축이 다르고 크기 상한을 넘긴다. 같은 부류 stale 이 눈에 띄면 Follow-ups 에 1 줄만 남긴다.
- **Web UI 행의 `관련 REQ` · `관련 ADR / 문서` 컬럼 보강** (예: REQ-072 ~ REQ-074 · ADR-0042 추가) — 타당해 보여도 본 slice 의 축이 아니다. 필요 시 Follow-ups 에 남기고 별도 slice 로 판단한다.

## Suggested Sub-agents

`implementer` (doc-only · architecture doc 표 1 행 인라인 수정 — architect · tester 불요, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) · [T-1348](T-1348-modules-doc-defer-list-resync.md) 선례)

## Follow-ups

- `components.md` **113 행 Web UI 행의 `관련 REQ` · `관련 ADR / 문서` 컬럼** 은 이번에도 불변으로 뒀다 (Out of Scope 그대로). REQ-072 ~ REQ-074 · ADR-0042 보강 타당성은 별도 slice 판단 대상.
- 실측 시점 행 번호 drift 없음 — `components.md` 113 행 · `AdminView.tsx` 4493 · 4525 행 · `DashboardView.tsx` 94 행 모두 task 본문 서술과 일치했다.

## 결과 요약 (2026-07-31T13:38Z DONE)

- [docs/architecture/components.md](../architecture/components.md) **113 행 1 줄만** 수정 (`+1/-1`, hunk 1 개 `@@ -113 +113 @@`). (a) `AdminView` 괄호 열거에 `SchedulePanel` 마운트 ([T-0885](T-0885-wire-schedule-panel-adminview.md)) · `ReEvaluationTriggerPanel` 마운트 ([T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md)) 를 근거 링크와 함께 추가, (b) `일부 잔여 표면 (ReEval/Schedule 마운트 · auto-polling 등) …` 을 `남은 잔여 표면은 EvaluationGuardBanner 자동 polling 1 항목뿐 …` 으로 교체하고 위임 절 `— [modules.md](modules.md) 의 defer 서술 참조.` 는 그대로 보존했다.
- 실측 3 종 재확인 (실측 = 정본): `<SchedulePanel` · `<ReEvaluationTriggerPanel` 2 hit (AdminView.tsx 4493 · 4525 행), `자동 polling` 1 hit (DashboardView.tsx 94 행 — polling defer 존치 근거), 편집 전 `ReEval/Schedule 마운트` 1 hit (113 행).
- 구조 self-check 전부 통과: `awk NR==113 NF` = 7, `wc -l` = 190, `^| ` = 29, `^## ` = 7, `modules.md` = 2 (위임 링크 보존), `polling` = 1, `ReEval/Schedule 마운트` = 0, `SchedulePanel` · `ReEvaluationTriggerPanel` · `T-0885|T-0886` 각 ≥ 1. 파이프 신규 도입 0 · 행 분할 0.
- doc-only 라 R-110 tester 면제 (production code 0 LOC) — 위 grep + 구조 검증으로 대체. `docs/STATE.json` · `docs/progress/journal-*.md` 는 driver 소관이라 미수정 (§9 STATE single-writer).
- 이로써 P6 잔여-서술 stream ([T-1313](T-1313-p6-deferred-residual-list-resync.md) → [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) → [T-1348](T-1348-modules-doc-defer-list-resync.md) → 본 slice) 의 마지막 stale locus 가 닫혔다 — PLAN · modules · directory · components 네 문서가 "실 defer = `EvaluationGuardBanner` 자동 polling 1 항목" 으로 일치한다.
