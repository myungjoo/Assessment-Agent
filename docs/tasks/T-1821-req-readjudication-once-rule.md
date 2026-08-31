---
id: T-1821
title: Restrict REQ re-adjudication to a single post-implementation pass
phase: P5
status: DONE
commitMode: direct
coversReq: []
independentStream: driver-process-reform
dependsOn: []
touchesFiles:
  - CLAUDE.md
estimatedDiff: 45
estimatedFiles: 1
created: 2026-08-31
ownerDirective: "2026-08-31 오너 지시 (2) — 구현 전 REQ 재판정 금지"
plannerNote: 재판정 루프(3일 183 commit 중 48건이 재판정·doc-sync) 차단 — 재판정은 구현 후 1회만
---

# T-1821 — REQ 재판정은 구현 후 1 회만 (구현 전 재판정 금지)

## Why

2026-08-31 오너 지시 (2). 2026-08-29 ~ 08-31 3 일간 commit 183 건 중 **48 건이
재판정 · 승격 · 마커 · doc-sync · 정정** 성격이었다. 그 중 기계적으로 반복되는 패턴이 있다:

```
REQ-075 재판정(T-1792) → 슬롯 추가(T-1793) → 배선(T-1794) → REQ-075 재판정(T-1795)
REQ-077 재판정(T-1798) → 배선(T-1799)               → REQ-077 재판정(T-1800)
```

**같은 요구사항을 구현 직전과 직후에 두 번** 재판정하고, 각각이 별도 task 문서 + 별도
`direct` commit + 별도 fire 를 소비한다. 이 중 **구현 전 재판정은 새 정보를 만들지 않는다** —
어차피 직후 재판정이 같은 REQ 를 다시 실측해 덮어쓰기 때문이다. 구현 전에 필요한 것은
"이 REQ 가 아직 유효한가" 라는 **issue-still-relevant pre-check** 이고, 그건 이미 planner 가
task 생성 시 수행해 `plannerNote` / `Why` 에 박제하고 있다 (T-1819 · T-1818 참조). 즉 구현 전
재판정 task 는 planner 의 pre-check 를 **별도 commit 으로 승격시킨 중복**이다.

주의 — 본 룰은 재판정 자체를 줄이자는 게 아니다. `requirements.md` 의 status 가 실제 shipped
상태와 어긋나면 그건 진짜 결함이다. 줄이려는 것은 **한 REQ 를 한 구현 arc 안에서 두 번**
판정하는 왕복이다.

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) `§3.1 Commit mode` 의 판정 규칙 5 개 — 특히 규칙 5
  (기존 `docs/decisions/*` · `docs/architecture/*` 비-결정 수정의 `direct` 판정). 본 task 가
  추가할 룰은 이 규칙들과 같은 자리에 놓인다.
- [docs/tasks/T-1798-req-077-period-ui-readjudication.md](T-1798-req-077-period-ui-readjudication.md)
  와 [docs/tasks/T-1800-req-077-query-axis-readjudication.md](T-1800-req-077-query-axis-readjudication.md) —
  같은 REQ-077 을 T-1799 구현 앞뒤로 두 번 재판정한 실제 왕복 쌍. **두 task 의 `Why` 를 대조해
  구현 전 재판정이 만든 정보가 무엇이었는지 확인**하고, 그 결론을 새 룰 본문 1 줄로 인용한다.
  (파일명이 다르면 `docs/tasks/` 에서 `T-1798` · `T-1800` prefix 로 찾는다.)
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 issue-still-relevant
  pre-check 지침 — 새 룰이 이 pre-check 를 대체 경로로 지목하므로 현행 문구를 정확히 인용해야 한다.

## Acceptance Criteria

1. [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 규칙 목록 끝에 **규칙 6** 을 추가한다:
   - `docs/requirements.md` 의 REQ status 재판정 task 는 **해당 REQ 를 구현하는 slice 가
     머지된 뒤 1 회만** 생성한다. 같은 구현 arc 안에서 구현 **전** 재판정 task 를 별도로
     만드는 것을 금지한다.
   - 구현 전에 필요한 "이 REQ 가 아직 유효한가" 판단은 **planner 의 issue-still-relevant
     pre-check** 로 수행하고 그 결과를 구현 task 의 `Why` / `plannerNote` 에 박제한다 —
     별도 commit 으로 승격하지 않는다.
2. **예외 2 종을 명시**한다 (이 룰이 진짜 결함 수정을 막지 않도록):
   - (a) 구현 arc 와 **무관하게** 발견된 status drift (오래 전 shipped 인데 `PLANNED` 로
     방치된 REQ 등) 의 정정은 언제든 허용.
   - (b) 구현 arc 가 **여러 REQ 에 걸쳐** 있고 중간 REQ 가 먼저 완결된 경우, 그 REQ 의
     재판정은 arc 종료를 기다리지 않아도 된다 (arc 당 1 회가 아니라 **REQ 당 1 회** 가 기준).
3. 근거를 검증 가능하게 남긴다 — 규칙 6 본문에 REQ-075 (T-1792/T-1795) · REQ-077
   (T-1798/T-1800) 왕복 쌍을 사례로 1 줄 인용하고, 3 일 48/183 commit 비율을 함께 적는다.
4. `§0.5 Hard rule 인덱스` 는 **건드리지 않는다** — 본 룰은 §3.1 판정 규칙의 세부이지 8 대
   hard rule 이 아니다 (인덱스 비대화 방지).

## Out of Scope

- 이미 머지된 재판정 commit 의 되돌림 — 소급 적용 금지.
- `docs/requirements.md` 본문 · REQ status 값 자체의 변경.
- `.claude/agents/planner.md` 수정 — pre-check 지침 강화가 필요하면 Follow-ups.
- doc-sync task 일반의 축소 (api.md 동기 · PLAN 마커 승격 등) — 본 task 는 **REQ 재판정**
  한 종류만 다룬다.

## Follow-ups

- planner.md 의 pre-check 지침에 "그 결과를 별도 재판정 task 로 승격하지 말 것" 명문화.
- PLAN 행 마커 승격 task 도 같은 왕복 패턴을 갖는지 실측 (있으면 별도 룰 task).
