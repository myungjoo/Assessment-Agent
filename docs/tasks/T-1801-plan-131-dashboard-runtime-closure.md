---
id: T-1801
title: PLAN 131 행 대시보드 실동작 오너 지시 bullet 마커 승격 (R-175~R-178 closure)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-074, REQ-075, REQ-076, REQ-077]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-08-30
independentStream: plan-owner-directive-closure
dependsOn: []
touchesFiles:
  - docs/PLAN.md
plannerNote: P5 — REQ-074~077 4 row 전량 DONE 인데 PLAN 131 행 오너 지시 bullet 만 미완료 마커로 남은 drift 를 닫는 doc-only direct slice
---

# T-1801 — PLAN 131 행 대시보드 실동작 오너 지시 bullet 마커 승격 (R-175~R-178 closure)

## Why

[T-1800](T-1800-requirements-req077-query-axis-rejudge.md) 머지 (main `8ae20264`) 로
[docs/requirements.md](../requirements.md) `93~96 행` 의 REQ-074 · REQ-075 · REQ-076 · REQ-077
**네 row 가 모두** shipped 실측 근거와 함께 `DONE` 이 됐다. 그런데 그 네 REQ 의 상위 오너 지시인
[docs/PLAN.md](../PLAN.md) `131 행` (대시보드 실동작 — R-175~R-178) bullet 은 아직 `- [ ]` 미완료 마커이고,
행 끝에 "**본 bullet 마커는 `[ ]` 유지** — … ④ 의 `DONE` 판정을 만드는 것이 본 slice 자신이라
자기 판정을 근거로 마커를 승격할 수 없다" 는 **T-1800 시점의 보류 서술** 이 그대로 남아 있다.
그 보류 사유 (자기-근거 순환) 는 T-1800 이 머지된 지금 소멸했으므로, 본 slice 가 그 drift 만 닫는다.

승격 절차는 [T-1785](T-1785-adr0058-plan-closure.md) (`132 행`) · [T-1787](T-1787-plan-129-signup-ux-closure.md)
(`129 행`) 두 선례가 확립한 형식 (마커 `[x]` 승격 + 승격 근거 문장 1 개) 을 그대로 승계한다.
PLAN 의 **결정 내용·다른 bullet 은 1 자도 바꾸지 않고** 진행 상태 표기만 갱신하므로
[CLAUDE.md §3.1](../../CLAUDE.md) 표의 `docs/PLAN.md` 행에 따라 `commitMode: direct` 다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `131 행` — 승격 대상 오너 지시 bullet (R-175~R-178). 행 끝의 "본 bullet 마커는 `[ ]` 유지" 문단이 본 task 가 걷어낼 보류 서술이다
- [docs/PLAN.md](../PLAN.md) `129 행` · `132 행` — **승격 문장 형식의 참고 선례** (T-1787 · T-1785 가 남긴 "**2026-08-30 승격** — …" 표기. 본 task 가 모방할 형식)
- [docs/requirements.md](../requirements.md) `93~96 행` — REQ-074 / REQ-075 / REQ-076 / REQ-077 row. **판정값 (`DONE`) 과 shipped slice ID 목록의 정본** (본 task 가 인용할 task ID 는 전부 이 네 row 에서 가져온다)
- [docs/tasks/T-1800-requirements-req077-query-axis-rejudge.md](T-1800-requirements-req077-query-axis-rejudge.md) — 직전 재판정 slice 의 `Follow-ups` 절 (본 task 는 그중 "PLAN `131 행` bullet 마커 승격 slice" 항목만 이어받는다)
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode) · §12 (언어 정책 · 범위 좌표 표기 `R1` / `R4` / `R5`)

## Acceptance Criteria

- [ ] [docs/PLAN.md](../PLAN.md) `131 행` bullet 의 마커가 `- [ ]` → `- [x]` 로 승격돼 있다 (`grep -n "오너 지시 2026-08-26\] 대시보드 실동작" docs/PLAN.md` 결과 행이 `- [x]` 로 시작).
- [ ] 같은 행 끝의 **"본 bullet 마커는 `[ ]` 유지" 보류 문단이 제거** 되고 그 자리에 **승격 근거 문장 1 개** 가 들어가 있다. 근거 문장은 다음 4 요소를 포함한다 — ① [docs/requirements.md](../requirements.md) `93~96 행` 의 REQ-074 · REQ-075 · REQ-076 · REQ-077 이 **모두** `DONE` 이라는 사실, ② 네 축 각각의 재판정 slice ID (①=T-1796 · ②=T-1795 · ③=T-1797 · ④=T-1800 — requirements.md 네 row 실측값과 대조해 인용, 임의 ID 창작 금지), ③ 보류 사유였던 자기-근거 순환이 T-1800 머지로 소멸했다는 사실, ④ 승격 주체가 본 task (T-1801) 라는 표기. `129 행` · `132 행` 의 "**2026-08-30 승격** — …" 문장 형식을 그대로 따른다.
- [ ] 승격 전 **판정 재확인** — `docs/requirements.md` `93~96 행` 네 row 의 판정 컬럼이 실제로 전부 `DONE` 임을 파일에서 직접 확인했다. 하나라도 `DONE` 이 아니면 승격하지 말고 task 를 BLOCKED 로 돌린다 (근거 없는 마커 승격 금지).
- [ ] 인용한 행 좌표 (`93~96 행` 등) 와 task ID 를 실제 파일에서 **전수 대조** 했고, 본 task 본문의 예시 좌표·ID 와 실측이 다르면 **실측값을 채택** 했다.
- [ ] `131 행` 외의 다른 행 (`129` · `130` · `132` · `133` · `156` · `160` 행 오너 지시 bullet 포함) 은 diff 에 나타나지 않는다 (`git diff --stat` 이 `docs/PLAN.md` 1 파일, 변경 행 1 줄).
- [ ] 표기 규약 준수 — 행 범위 구분자는 물결 `~` 하나, 단일 행은 `131 행` 표기, `L` prefix 미사용 ([CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" `R1` / `R4` / `R5`).
- [ ] doc-only direct 라 코드 변경 0 LOC — R-110 tester 의무 · R-112 4 항목 (happy / error / branch / negative 충분 cover) 은 **적용 대상 없음** (production symbol 추가·수정 0, 분기 0). 본 항목은 "적용 대상 없음" 을 명시적으로 확인하는 것으로 충족한다.

## Out of Scope

- `docs/requirements.md` 재편집 — REQ-074~077 네 row 는 [T-1796](T-1796-requirements-req074-person-selector-rejudge.md) · [T-1795](T-1795-requirements-req075-narrative-rejudge.md) · [T-1797](T-1797-requirements-req076-score-scale-rejudge.md) · [T-1800](T-1800-requirements-req077-query-axis-rejudge.md) 가 이미 확정했다. 본 task 는 읽기만 한다.
- `129` · `130` · `132` · `133` · `156` · `160` 행 오너 지시 bullet 의 상태 재판정 — 각각 별도 slice 소관. 특히 `133 행` (UI 기본기 — R-187~R-191) 은 잔여 오너 지시로 그대로 둔다.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 REQ-077 행 동기 — T-1800 Follow-ups 의 별개 항목이며 본 task 는 손대지 않는다.
- T-1800 Follow-ups 의 `periodStart` GET 조회 계약 확장 판단 · `DashboardView.tsx` `936 행` `periodLabel` prop 소비 — 둘 다 코드 slice 라 별도 채번 (`commitMode: pr`).
- 새 ADR 신설 또는 기존 ADR 본문 변경 — 대시보드 실동작 chain 에 대응하는 신규 결정은 본 task 가 만들지 않는다.
- `web/` · `src/` · `test/` 어떤 코드 변경도 하지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 단일 행 편집 — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 후속 작업을 발견하면 여기에 추가)

## 완료 기록

- 완료 시각: 2026-08-30T07:49Z
- 결과: [docs/PLAN.md](../PLAN.md) `131 행` 오너 지시 bullet 마커를 `- [ ]` → `- [x]` 로 승격하고,
  T-1800 시점의 보류 문단을 승격 근거 문장 1 개로 교체했다 (1 파일 `+1/-1`, main `f99eb235`).
- 승격 전 실측 재확인: [docs/requirements.md](../requirements.md) `93~96 행` 의 REQ-074 · REQ-075 ·
  REQ-076 · REQ-077 네 row 판정 컬럼이 **전부 `DONE`**, 축별 재판정 slice 는 `git log` 대조로
  REQ-074=T-1796(`461e4d39`) · REQ-075=T-1795(`46712a81`) · REQ-076=T-1797(`01054125`) ·
  REQ-077=T-1800(`8ae20264`) 임을 확인했다 (task 본문 예시 ID 와 일치 — 정정 불요).
- 코드 0 LOC · production symbol 0 이라 R-110 tester 의무 · R-112 4 항목은 적용 대상 없음.
  main CI run (`58a00517` · `f99eb235`) 둘 다 `success`.
