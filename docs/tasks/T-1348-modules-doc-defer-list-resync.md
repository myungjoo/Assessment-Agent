---
id: T-1348
title: modules.md 239 행 · directory.md 164 행의 "패널 미마운트 defer" 서술을 실 배선과 정합
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-042, REQ-039, REQ-041]
estimatedDiff: 22
estimatedFiles: 3
created: 2026-07-31
independentStream: p6-plan-residual-resync
dependsOn: [T-1347]
touchesFiles:
  - docs/architecture/modules.md
  - docs/architecture/directory.md
  - docs/tasks/T-1348-modules-doc-defer-list-resync.md
plannerNote: "T-1347 이 PLAN 을 정합시켰으나 modules.md 239·directory.md 164 는 여전히 두 패널을 미마운트 defer 로 박제 — 중복 task 유발 축"
---

# T-1348 — modules.md 239 행 · directory.md 164 행의 "패널 미마운트 defer" 서술을 실 배선과 정합

## Why

[T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) (머지 `2c3b2164`) 이 [docs/PLAN.md](../PLAN.md) 120 · 123 행의 `ReEvaluationTriggerPanel` · `SchedulePanel` "미마운트 defer" stale 서술을 닫으며, 실제 남는 defer 는 **EvaluationGuardBanner 자동 polling 1 항목뿐** 임을 박제했다. 그런데 같은 주장을 담은 **architecture doc 2 곳이 갱신되지 않은 채 남아 있다** — [docs/architecture/modules.md](../architecture/modules.md) **239 행** 과 [docs/architecture/directory.md](../architecture/directory.md) **164 행** 이 여전히 두 패널을 "backend endpoint 미shipped 로 미마운트" 로 적는다.

이 잔여는 단순 표기 불일치가 아니라 **modules.md 239 행 자신이 경고한 실패 모드** 다 — 그 문단은 defer 박제의 취지를 "**양방향**" 이라 명시하며 "이미 shipped 된 표면을 미배선으로 오판해 **중복 task 로 큐잉하지 않게** 한다" 고 적어 두었는데, 정작 그 목록이 shipped 표면 2 개를 담고 있어 스스로의 목적을 뒤집고 있다. architecture doc 은 planner 가 "무엇이 남았나" 를 판단할 때 PLAN 다음으로 읽는 index 라 파급이 크다.

실측 근거: `web/src/views/AdminView.tsx` **4493 행 `<SchedulePanel …>`** · **4525 행 `<ReEvaluationTriggerPanel …>`** 가 실 JSX 로 마운트돼 있고 배선 commit 도 박제돼 있다 ([T-0885](T-0885-wire-schedule-panel-adminview.md) SchedulePanel↔`PUT`·`GET /api/schedules` + `POST /api/schedules/trigger`, [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) ReEvaluationTriggerPanel↔`POST /api/schedules/recent-deletion/:personId`, squash `532df2d3`). backend 계약도 PLAN P7 133 ~ 135 행이 shipped 로 박제한 `cron-schedule.controller.ts` · `recent-deletion.controller.ts` 그대로다. 반면 polling defer 는 **여전히 유효** 하다 (`web/src/views/DashboardView.tsx` 94 행 주석 "계약 미shipped 라 자동 polling 파생은 Out of Scope").

본 slice 는 [T-1313](T-1313-p6-deferred-residual-list-resync.md) 이 같은 문단에서 멤버 mutation · import 결과 상세 2 항목을 내렸던 것과 **정확히 같은 편집 패턴** 을 세 번째 항목에 적용한다.

## Required Reading

- `docs/architecture/modules.md` **239 행** — 수정 대상 1 (한 문단, 한 줄). 현재 문장 구조: `**의도적 defer (…)**: … 미배선으로 둔다 — `ReEvaluationTriggerPanel` · `SchedulePanel` 미마운트 / `EvaluationGuardBanner` 자동 polling. 근거: [api.md](api.md) 94~97 (…) + SchedulerModule (P7, `@nestjs/schedule` 새 dep). … 그래서 종전 나열에 있던 다음 **2** 항목은 shipped 확인 후 본 목록에서 **내렸다** ([T-1313](../tasks/T-1313-p6-deferred-residual-list-resync.md)):`. 수정 요소는 (a) 잔여 나열, (b) 근거 절, (c) `다음 2 항목` 집계 3 개뿐. **문단 머리의 `**의도적 defer (make-work 아님 — backend 계약 확정 후 배선)**` 라벨과 "양방향" 취지 문장은 불변.**
- `docs/architecture/modules.md` **241 · 242 행** — 읽기 전용 서식 본. 이미 "내린" 2 항목이 `- <대상> — [T-NNNN](../tasks/…) (…) 으로 완결.` 형태의 bullet 로 적혀 있다. 본 slice 가 추가할 세 번째 bullet 은 **이 서식을 그대로 따른다** (경로 접두 `../tasks/`, 링크 + squash sha + 소비 endpoint).
- `docs/architecture/directory.md` **164 행** — 수정 대상 2 (한 줄). `backend endpoint 미shipped 로 의도적 defer 된 잔여 (`ReEvaluationTriggerPanel` · `SchedulePanel` 미마운트, auto-polling) 는 [modules.md](modules.md) "WebModule 의 frontend 분리" 단락이 이미 박제 — 본 directory.md 범위 밖이라 중복 박제하지 않는다.` 괄호 안 열거만 손대고, **"modules.md 가 이미 박제 — 중복 박제하지 않는다" 는 위임 구조는 불변** (directory.md 는 목록의 소유자가 아니다).
- `docs/PLAN.md` **123 행** — 읽기 전용 정본 대조. T-1347 이 박제한 최종 문구 (`남은 1 항목(EvaluationGuardBanner 자동 polling)만이 실제 defer 다`) 와 본 slice 편집 결과가 **같은 사실** 을 말해야 한다. **PLAN.md 수정 금지.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "<SchedulePanel\|<ReEvaluationTriggerPanel" -- web/src/views/AdminView.tsx` → **2 hit** (4493 · 4525 행, 실 JSX 마운트).
  - `git grep -n "자동 polling" -- web/src/views/DashboardView.tsx` → 94 행 주석 **1 hit** (polling defer 존치 근거).
  - `grep -n "미마운트" docs/architecture/modules.md docs/architecture/directory.md` → 편집 전 **2 hit** (modules 239 · directory 164). 행 번호 drift 시 실측 행 번호를 따르고 Follow-ups 에 기록.
  - `git log --oneline --all --grep="T-0885" | head -3` → `74d00f40` SchedulePanel 배선 squash 확인 (bullet 에 적을 sha 근거).

## Acceptance Criteria

- [ ] **modules.md 239 행 (a) 잔여 나열 축소** — 미배선 나열에서 `` `ReEvaluationTriggerPanel` · `SchedulePanel` 미마운트 / `` 를 제거해 잔여가 `` `EvaluationGuardBanner` 자동 polling `` **1 항목** 만 남게 한다. 편집 후 239 행은 여전히 **한 줄** (행 분할 금지).
- [ ] **modules.md 239 행 (b) 근거 절 정합** — 현재 근거 (`api.md` 94~97 `/run` · bulk DELETE · `/reeval` · `/reset` 미구현 + SchedulerModule P7 `@nestjs/schedule` 새 dep) 는 **삭제된 두 패널의 defer 사유** 였으므로, 남은 polling 항목의 실 사유 (`assessments` rows 의 status 필드 부재 — `web/src/views/DashboardView.tsx` 94 행 주석이 실증) 로 교체한다. PLAN 123 행이 적은 사유 표현과 어긋나지 않아야 한다.
- [ ] **modules.md 239 행 (c) 집계 갱신** — `다음 **2** 항목은 … 내렸다 ([T-1313](…))` 를 `다음 **3** 항목` + 근거 task 링크 확장 (`T-1313` 유지 + [T-0885](T-0885-wire-schedule-panel-adminview.md) · [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) 또는 [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) pointer) 으로 갱신한다.
- [ ] **modules.md 세 번째 bullet 추가** — 242 행 다음에 241 · 242 행과 **동일 서식** 의 bullet 1 개를 추가한다: 대상 = `ReEvaluationTriggerPanel` · `SchedulePanel` 마운트, 근거 = [T-0885](../tasks/T-0885-wire-schedule-panel-adminview.md) (SchedulePanel↔`PUT`·`GET /api/schedules` + `POST /api/schedules/trigger`, squash `74d00f40`) · [T-0886](../tasks/T-0886-wire-reevaluation-trigger-panel-adminview.md) (ReEvaluationTriggerPanel↔`POST /api/schedules/recent-deletion/:personId`, squash `532df2d3`), 배선 위치 = `web/src/views/AdminView.tsx` 4493 · 4525 행. **bullet 1 개만 추가** — 241 · 242 행 기존 bullet 은 한 글자도 수정하지 않는다.
- [ ] **directory.md 164 행 열거 축소** — 괄호 안 열거에서 두 패널을 제거해 `auto-polling` 만 남긴다. 위임 문구 (`[modules.md](modules.md) "WebModule 의 frontend 분리" 단락이 이미 박제 — 본 directory.md 범위 밖이라 중복 박제하지 않는다`) 는 **불변**. 편집 후 164 행도 **한 줄**.
- [ ] **polling 잔여 존치** — 편집 후 `grep -c "자동 polling" docs/architecture/modules.md` ≥ **1**, `grep -c "auto-polling" docs/architecture/directory.md` = **1**. polling 을 shipped 로 적는 것은 **명백한 오기** — `DashboardView.tsx` 94 행이 반증한다.
- [ ] **검증 grep** — (a) `grep -c "미마운트" docs/architecture/modules.md docs/architecture/directory.md` 가 **양쪽 0**, (b) `git grep -c "ReEvaluationTriggerPanel" -- docs/architecture/modules.md` ≥ **1** (내린 항목 bullet 안에 남는다 — 완전 삭제가 아니라 **이동**), (c) `git grep -n "ReEvaluationTriggerPanel\|SchedulePanel" -- docs/architecture/directory.md` **0 hit**, (d) `grep -c "T-0885\|T-0886" docs/architecture/modules.md` ≥ **2**.
- [ ] **구조 무손상** — 편집 후 `wc -l docs/architecture/modules.md` = 편집 전 **256 + 1 = 257** (bullet 1 줄 추가만), `wc -l docs/architecture/directory.md` = **182 불변**. `grep -c "^## " docs/architecture/modules.md` · `grep -c "^- " docs/architecture/directory.md` 는 편집 전후 동일 (섹션 증감 0 · directory bullet 증감 0). `docs/architecture/modules.md` 의 `## References` 절 (244 행 이하) 은 diff 에 등장하지 않는다.
- [ ] **diff 축 한정** — `git diff --stat` 이 `docs/architecture/modules.md` · `docs/architecture/directory.md` · 본 task 파일 **3 개만** 보이고, modules.md hunk 는 **239 행 근처 + bullet 추가 2 개 이내**, directory.md hunk 는 **164 행 1 개뿐**.
- [ ] `src/` · `web/` · `test/` · `prisma/` · `docs/PLAN.md` · `docs/architecture/api.md` · `docs/use-cases/*` · `docs/requirements.md` · `docs/STATE.json` 은 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만, STATE 는 driver 소관). `git status --porcelain` 결과가 위 3 파일뿐 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) ~ [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) 선례) — 대신 위 검증 grep + 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`web/` · `src/` 코드 수정 일체** — 본 slice 는 **문서를 이미 shipped 된 현실에 맞추는 것** 이다. AdminView · SchedulePanel · ReEvaluationTriggerPanel · DashboardView 는 한 글자도 건드리지 않는다.
- **EvaluationGuardBanner 자동 polling 배선** — backend status 계약이 여전히 미shipped 라 진짜 defer 다. 배선은 계약 확정 후 별도 `pr` task.
- **`docs/PLAN.md` 재수정** — 120 · 123 행은 [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) 이 이미 정합시켰다. 본 slice 는 PLAN 을 **읽기 전용 정본** 으로만 참조한다. PLAN 116 행 (오너 승인 인용문 안의 stale 패널 열거) 도 별도 축 — 원문 보존 vs 편집 주 부기 판단이 걸려 있어 손대지 않는다.
- **`docs/architecture/api.md` 94 ~ 97 행 (`/run` · bulk DELETE · `/reeval` · `/reset`) 실재 재검증** — modules.md 239 행에서 삭제할 근거 절이 인용하던 대상이지만, 그 endpoint 들의 문서 표기 정합은 별개 slice 소관이다.
- **modules.md 237 행 composition-wiring 요약 · WebModule 절 나머지 서술의 stale 전수 감사** — 축이 다르고 크기 상한을 넘긴다. 같은 부류 stale 이 눈에 띄면 Follow-ups 에 1 줄만 남긴다.
- **PLAN 120 행 `(부분 완료 — shipped 계약 범위)` 마커 재판정** — [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) Follow-ups 가 남긴 별도 축 (LLM provider 관리 UI mutation 등 잔여 전수 확인 필요).

## Suggested Sub-agents

`implementer` (doc-only · architecture doc 2 행 인라인 수정 + bullet 1 줄 추가 — architect · tester 불요, [T-1313](T-1313-p6-deferred-residual-list-resync.md) · [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) ~ [T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) 선례)

## Follow-ups

- **구조 무손상 기준치 off-by-one (실측이 정본)** — AC 가 인용한 편집 전 `wc -l` 값 (modules.md 256 · directory.md 182) 은 실측과 1 씩 어긋났다. 실측 편집 전 = modules.md **255** · directory.md **181** (파일 끝 개행 유무 차이). 본 slice 편집 후 실측 = modules.md **256** (bullet 1 줄 추가) · directory.md **181** (불변) 으로, AC 가 의도한 "bullet 1 줄만 증가 · directory 불변" 조건은 그대로 충족한다. 이후 slice 가 같은 문단을 인용할 때는 실측 값을 기준으로 쓴다.
