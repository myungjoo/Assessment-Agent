---
id: T-1787
title: PLAN 129 행 계정 생성 UX 오너 지시 bullet 마커 승격 (R-158~R-160 closure)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-067, REQ-068, REQ-069]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-08-30
independentStream: plan-owner-directive-closure
dependsOn: []
touchesFiles:
  - docs/PLAN.md
plannerNote: P5 — REQ-067~069 전량 DONE 인데 PLAN 129 행 오너 지시 bullet 만 미완료 마커로 남은 drift 를 닫는 doc-only direct slice
---

# T-1787 — PLAN 129 행 계정 생성 UX 오너 지시 bullet 마커 승격 (R-158~R-160 closure)

## Why

[T-1786](T-1786-requirements-req067-069-signup-ux-rejudge.md) 머지로 [docs/requirements.md](../requirements.md)
`86~88 행` 의 REQ-067 · REQ-068 · REQ-069 세 row 가 shipped 실측 근거와 함께 전부 `DONE` 으로 승격됐다.
그런데 그 세 REQ 의 상위 오너 지시인 [docs/PLAN.md](../PLAN.md) `129 행` (계정 생성 UX — R-158~R-160) bullet 은
아직 `- [ ]` 미완료 마커에 "planner: README 신규 R-158~R-160 을 requirements.md REQ row 로 동기 후 task 분해"
라는 **미착수 시점 서술** 그대로다 — 실측과 PLAN 사이의 drift 다.

본 slice 는 그 drift 만 닫는다. 직전 선례인 [T-1785](T-1785-adr0058-plan-closure.md) 가 `132 행` 을
동일 패턴 (마커 `[x]` 승격 + 승격 근거 문장 1 개 추가) 으로 닫았으므로 본 task 는 그 형식을 그대로 승계한다.
PLAN 의 **결정 내용·다른 bullet 은 1 자도 바꾸지 않고** 진행 상태 표기만 갱신하므로
[CLAUDE.md §3.1](../../CLAUDE.md) 표의 `docs/PLAN.md` 행에 따라 `commitMode: direct` 다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `129 행` — 승격 대상 오너 지시 bullet (R-158~R-160). `132 행` 은 **승격 문장 형식의 참고 선례** (본 task 가 모방할 표기)
- [docs/requirements.md](../requirements.md) `86~88 행` — REQ-067 / REQ-068 / REQ-069 row. **shipped slice ID 목록의 정본** (본 task 가 인용할 task ID 는 전부 이 세 row 에서 가져온다)
- [docs/tasks/T-1786-requirements-req067-069-signup-ux-rejudge.md](T-1786-requirements-req067-069-signup-ux-rejudge.md) — 직전 재판정 slice 의 Out of Scope 절 (본 task 가 이어받는 잔여 범위)
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit mode) · §12 (언어 정책 · 행 좌표 표기 `R1` / `R4`)

## Acceptance Criteria

- [ ] [docs/PLAN.md](../PLAN.md) `129 행` bullet 의 마커가 `- [ ]` → `- [x]` 로 승격돼 있다 (`grep -n "오너 지시 2026-08-26\] 계정 생성 UX" docs/PLAN.md` 결과 행이 `- [x]` 로 시작).
- [ ] 같은 행 끝에 **승격 근거 문장 1 개** 가 추가돼 있다. 근거 문장은 다음 3 요소를 포함한다 — ① [docs/requirements.md](../requirements.md) `86~88 행` 의 REQ-067 · REQ-068 · REQ-069 가 모두 `DONE` 이라는 사실, ② 그 shipped 를 만든 slice ID 범위 (requirements.md 세 row 의 "구현 위치" 컬럼에 적힌 T-1710 ~ T-1716 실측값을 그대로 인용 — 임의 ID 창작 금지), ③ 승격 주체가 본 task (T-1787) 라는 표기. `132 행` 의 "**2026-08-30 승격** — …" 문장 형식을 그대로 따른다.
- [ ] 근거 문장 안에서 **줄 단위 구분 표시 (REQ-084) 는 본 bullet 소관이 아니라 `133 행` 소관** 임을 한 구절로 명시해 과대 판정을 차단한다.
- [ ] 인용한 행 좌표 (`86~88 행` 등) 와 task ID 를 실제 파일에서 **전수 대조** 했고, task 본문의 예시 좌표와 실측이 다르면 실측값을 채택했다.
- [ ] `129 행` 외의 다른 행 (`130` · `131` · `132` · `133` · `156` · `160` 행 오너 지시 bullet 포함) 은 diff 에 나타나지 않는다 (`git diff --stat` 이 `docs/PLAN.md` 1 파일, 변경 행 1 줄).
- [ ] 표기 규약 준수 — 행 범위 구분자는 물결 `~` 하나, `L` prefix 미사용 ([CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" `R1` / `R5`).
- [ ] doc-only direct 라 코드 변경 0 LOC — R-110 tester 의무 · R-112 4 항목 (happy / error / branch / negative) 은 **적용 대상 없음** (production symbol 추가·수정 0). 본 항목은 "적용 대상 없음" 을 명시적으로 확인하는 것으로 충족한다.

## Out of Scope

- `docs/requirements.md` 재편집 — REQ-067~069 row 는 [T-1786](T-1786-requirements-req067-069-signup-ux-rejudge.md) 가 이미 확정했다. 본 task 는 읽기만 한다.
- `130` · `131` · `133` · `156` · `160` 행 오너 지시 bullet 의 상태 재판정 — 각각 별도 slice 소관.
- REQ-084 (폼 오류 여러 줄 구분 표시) 의 판정·구현 — `133 행` (R-187~R-191) 소관.
- 새 ADR 신설 또는 기존 ADR 본문 변경 — 계정 생성 UX chain 에 대응하는 ADR 은 존재하지 않으며 본 task 가 신설하지도 않는다.
- `web/` · `src/` · `test/` 어떤 코드 변경도 하지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 단일 행 편집 — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 후속 작업을 발견하면 여기에 추가)
