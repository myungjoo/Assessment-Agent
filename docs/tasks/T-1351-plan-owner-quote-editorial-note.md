---
id: T-1351
title: PLAN.md 116 행 오너 승인 인용문의 stale 패널 열거에 편집 주 부기 (원문 보존)
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-049, REQ-038]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-07-31
independentStream: p6-plan-residual-resync
dependsOn: [T-1350]
touchesFiles:
  - docs/PLAN.md
  - docs/tasks/T-1351-plan-owner-quote-editorial-note.md
plannerNote: "T-1350 Follow-up ① — 116 행 오너 인용문이 아직 두 패널을 deferred 로 읽히게 함. 원문 보존 + 편집 주 부기로 해소"
---

# T-1351 — PLAN.md 116 행 오너 승인 인용문의 stale 패널 열거에 편집 주 부기 (원문 보존)

## Why

[T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) (`2c3b2164`) → [T-1348](T-1348-modules-doc-defer-list-resync.md) (`7a449534`) → [T-1349](T-1349-components-doc-panel-mount-resync.md) (`ed8cd7d7`) → [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) (`aeb59675`) 으로 이어진 `p6-plan-residual-resync` stream 은 PLAN 120 · 123 행과 `modules.md` · `directory.md` · `components.md` 를 **실 defer = `EvaluationGuardBanner` 자동 polling 1 항목** 이라는 같은 사실로 정합시켰다. 그런데 [T-1350 Follow-up ①](T-1350-plan-admin-panel-marker-rejudge.md) 이 명시적으로 이월한 마지막 locus 가 남아 있다 — [docs/PLAN.md](../PLAN.md) **116 행** 의 오너 승인 인용문이다.

116 행은 `deferred 잔여 배선(ReEvaluationTriggerPanel·SchedulePanel·polling 등) 재개 승인` 이라 적는다. 이는 **2026-07-07 시점의 참인 서술**이지만, 이후 [T-0885](T-0885-wire-schedule-panel-adminview.md) (SchedulePanel ↔ `PUT`·`GET /api/schedules` + `POST /api/schedules/trigger`) · [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) (ReEvaluationTriggerPanel ↔ `POST /api/schedules/recent-deletion/:personId`) 배선으로 두 패널은 shipped 가 됐다 (실측: `web/src/views/AdminView.tsx` **4493** `<SchedulePanel` · **4525** `<ReEvaluationTriggerPanel`). 즉 P6 절을 위에서부터 읽는 planner 는 116 행에서 "두 패널 미배선" 이라는 stale 사실을 먼저 집어들고, 4 행 아래 120 행에서야 반증을 만난다 — `modules.md` 239 행이 경고한 **중복 task 큐잉** 실패 모드의 마지막 진입점이다.

다만 116 행은 **오너 발화의 인용문**이라 본문을 고쳐 쓰면 승인 기록의 원문성이 훼손된다. 따라서 본 slice 는 인용문을 **한 글자도 바꾸지 않고**, 같은 blockquote 안에 편집 주 1 줄을 덧붙여 시점 정보를 박제한다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) — **116 행** (오너 승인 인용문, 편집 대상) + **120 · 121 · 123 행** (정합 목표 사실; 수정 금지)
- [docs/tasks/T-1350-plan-admin-panel-marker-rejudge.md](T-1350-plan-admin-panel-marker-rejudge.md) — Follow-up ① (본 slice 의 발원) + 완료 요약의 실측 수치
- [docs/tasks/T-1347-plan-p6-panel-mount-residual-resync.md](T-1347-plan-p6-panel-mount-residual-resync.md) — 같은 stream 의 defer 축 판정 근거
- `web/src/views/AdminView.tsx` — **4493 · 4525 행** 만 (두 패널 마운트 실측 재확인용; 수정 금지)

## Acceptance Criteria

- [x] **실측 재확인** — `grep -n "<SchedulePanel\|<ReEvaluationTriggerPanel" web/src/views/AdminView.tsx` 가 **2 hit** (4493 · 4525). 불일치 시 편집하지 말고 Follow-ups 에 사실을 적고 종료.
- [x] **인용문 원문 100% 보존** — `git diff -U0 -- docs/PLAN.md` 의 hunk 에 `-` 로 시작하는 삭제 줄이 **0** (순수 추가 diff). 116 행 자체는 문자 단위로 불변.
- [x] **편집 주 삽입 위치·형식** — 116 행 **직후**에 정확히 **2 줄** 추가: (a) 빈 인용 구분줄 `>`, (b) `> **편집 주 (2026-07-31, T-1351)**: ...` 로 시작하는 blockquote 연속줄 1 개. 인용문과 같은 blockquote 안에 붙어 렌더링돼야 한다.
- [x] **편집 주 내용 3 요소** — (1) 위 열거가 **2026-07-07 시점 서술**임을 명시, (2) `ReEvaluationTriggerPanel` · `SchedulePanel` 은 [T-0885](T-0885-wire-schedule-panel-adminview.md) · [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) 로 **배선 완료**임을 명시(두 링크 실재), (3) **실 defer 잔여 = `EvaluationGuardBanner` 자동 polling 1 항목** 이며 근거는 120 · 123 행임을 pointer 로 명시. 승인 자체의 유효성(P6 재개 승인·React+Vite 확정·우선순위 서술)은 부정하지 않는다.
- [x] **구조 불변 검증** — `wc -l < docs/PLAN.md` 가 **173 → 175**, `grep -c "^- \[x\]" docs/PLAN.md` **60 불변**, `grep -c "^- \[ \]" docs/PLAN.md` **6 불변**, `grep -c "^> " docs/PLAN.md` **6 → 7**, `git diff -U0 -- docs/PLAN.md` hunk **1 개**.
- [x] **다른 행 무수정** — `git diff -U0 -- docs/PLAN.md` 의 변경 범위가 116 행 직후 삽입 1 곳뿐이며 **120 · 121 · 123 행은 diff 에 등장하지 않는다**. `grep -c "polling" docs/PLAN.md` 는 **3 → 4** (신설 편집 주 1 회 증가분만).
- [x] **변경 파일 2 개** — `git status --porcelain` 결과가 `docs/PLAN.md` 와 본 task 파일 뿐. `src/` · `web/` · `test/` · `docs/architecture/*` · `docs/decisions/*` 무수정.
- [x] **R-110 tester 면제 근거 명시** — production code 0 LOC 인 doc-only direct commit 이므로 tester 를 호출하지 않는다. 대신 위 grep/`wc`/`git diff` 검증 결과를 task 파일 완료 요약에 박제한다 (R-112 4 종은 코드 변경 0 이라 해당 없음 — 분기 없음).

## Out of Scope

- 116 행 인용문 **본문 수정·삭제·재작성** (오너 발화 원문 보존이 본 slice 의 전제).
- 120 · 121 · 123 행 재편집 — T-1347 ~ T-1350 이 이미 정합시켰다.
- `docs/architecture/components.md` · `modules.md` · `directory.md` 의 패널 열거를 PLAN 120 행의 **패널 10 종 · mutation 러너 26 개** 수치와 대조하는 작업 (T-1350 Follow-up ②, 별도 slice).
- `EvaluationGuardBanner` 자동 polling 의 실제 배선 (backend status 계약 미shipped — 여전히 유효한 defer).
- `web/` · `src/` 코드 변경, 새 ADR 신설, PLAN 의 다른 phase 절 손질.

## Suggested Sub-agents

`implementer` (doc-only 단일 삽입 — architect 불요, tester 면제)

## Follow-ups

- **①** `docs/architecture/components.md` · `modules.md` · `directory.md` 의 패널 열거를 PLAN 120 행의 **패널 10 종 · mutation 러너 26 개** 수치와 대조 (T-1350 Follow-up ② 를 그대로 이월 — 본 slice 는 PLAN 116 행 locus 만 다뤘다).

## 완료 요약 (2026-08-01)

PLAN.md **116 행 오너 승인 인용문을 문자 단위로 보존**한 채, 같은 blockquote 안(117~118 행)에 빈 인용 구분줄 `>` + 편집 주 1 줄을 **순수 추가**로 부기했다. 편집 주는 (1) 열거가 2026-07-07 시점 서술임, (2) `SchedulePanel`=[T-0885](T-0885-wire-schedule-panel-adminview.md) · `ReEvaluationTriggerPanel`=[T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) 배선 완료, (3) 실 defer 잔여 = `EvaluationGuardBanner` 자동 polling 1 항목 (근거 120 · 123 행) 3 요소를 담고, 승인 자체의 유효성은 부정하지 않는다. 이로써 `p6-plan-residual-resync` stream 의 마지막 stale locus 가 닫혔다 — P6 절을 위에서부터 읽어도 두 패널을 미배선으로 오독할 진입점이 0.

**검증 실측** (전부 AC 기대치와 일치):

- 실측 재확인 — `grep -n "<SchedulePanel\|<ReEvaluationTriggerPanel" web/src/views/AdminView.tsx` = **2 hit** (4493 · 4525).
- 원문 보존 — `git diff -U0 -- docs/PLAN.md` 의 삭제 줄 **0**, hunk **1 개** (`@@ -116,0 +117,2 @@` — 116 행 직후 2 줄 삽입, 120 · 121 · 123 행 diff 미등장).
- 구조 불변 — `wc -l` **173 → 175**, `^- \[x\]` **60 불변**, `^- \[ \]` **6 불변**, `^> ` **6 → 7**, `polling` **3 → 4**.
- 변경 파일 — `docs/PLAN.md` + 본 task 파일 **2 개**뿐 (`src/` · `web/` · `test/` · `docs/architecture/*` · `docs/decisions/*` 무수정).
- R-110 — production code **0 LOC** doc-only direct commit 이라 tester 면제, 위 grep/`wc`/`git diff` 검증으로 대체 (R-112 4 종은 분기 0 이라 해당 없음).
