---
id: T-0377
title: ADR-0041 status PROPOSED → ACCEPTED flip (composition-wiring 전환 게이트)
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-038, REQ-042, REQ-048]
estimatedDiff: 1
estimatedFiles: 1
created: 2026-06-13
plannerNote: P6 composition-wiring 게이트 — ADR-0041 reviewer-APPROVED(PR #308 merged)이므로 §3.1 규칙4 PROPOSED→ACCEPTED 한 줄 direct flip. wiring ① AppShell 은 이 flip 후 next task.
independentStream: p6-frontend-composition
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0041-frontend-composition-wiring.md
---

# T-0377 — ADR-0041 status PROPOSED → ACCEPTED flip

## Why

[ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md)(frontend composition-wiring 전환 — controlled lift-up 조립 · 무라우터 view 전환 · native-fetch hook · R-78 보호 배선 · non-parallel single-claim stream)은 T-0376 으로 박제되어 **reviewer-APPROVE 통과 + PR #308 merge** 까지 끝났고, 현재 main 에서 `status: PROPOSED` 상태로 안착해 있다. CLAUDE.md §3.1 규칙 4 는 "ADR 의 PROPOSED→ACCEPTED status 갱신 한 줄 수정은 reviewer 검토 후 별도 `direct` commit" 으로 규정한다 — 그 reviewer 검토가 이미 끝났으므로 본 task 가 그 한 줄 flip 게이트를 수행한다. 이 flip 이 composition-wiring 코드 chain (① AppShell → ② 인증 게이트 → ③ 대시보드 → ④ Admin → ⑤ R-78 배선) 이 시작되기 전의 **명시적 아키텍처-결정 게이트** 다 ("코드보다 ADR 이 먼저다" — CLAUDE.md §1). flip 으로 ADR 이 ACCEPTED 가 되어야 그 결정에 의존하는 wiring task 들이 정당하게 큐잉될 수 있다.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — frontmatter 의 `status: PROPOSED` 줄(2 행 부근). 본 task 는 이 한 줄만 `status: ACCEPTED` 로 바꾼다. 본문(Context/Decision/Consequences/Alternatives)은 수정하지 않는다.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0041-frontend-composition-wiring.md` 의 frontmatter `status: PROPOSED` → `status: ACCEPTED` 한 줄만 수정. 다른 줄(`id` · `title` · `date` · `relatedTask` · `supersedes` · 본문 전체)은 **불변**.
- [ ] `git diff` 로 변경이 정확히 그 한 줄(`-status: PROPOSED` / `+status: ACCEPTED`)임을 확인 — 다른 hunk 가 섞이면 안 됨.
- [ ] 본 task 는 `commitMode: direct` — main 브랜치에서 `push HEAD:main`. PR · reviewer · CI 게이트 없음(doc status 한 줄 변경, §3.1 규칙 4 의 reviewer 검토는 PR #308 에서 이미 완료).
- [ ] 분기 없음 — doc-only status flip 이라 추가/수정된 public symbol 0. R-110/R-112 unit test 의무 비대상(production code 0 LOC, dependency 0). direct doc-only commit 은 R-110 면제.

## Out of Scope

- ADR-0041 본문 내용 수정 · 새 Decision/Consequences 추가 — 본 task 는 status 한 줄 flip 만. 내용 보강이 필요하면 별도 task.
- composition-wiring 실 코드(`web/src/App.tsx` 조립 · AppShell/레이아웃/인증 게이트/fetch hook 신설) — ADR-0041 §Consequences 의 wiring chain ①~⑤ 책임. 본 task 무관(다음 task 가 wiring ① AppShell).
- 새 dependency(react-router · @tanstack/react-query 등) 도입 — ADR-0041 의 deferred 제안은 §5 new-dep BLOCKED → 사용자 승인 게이트. 본 task 무관.
- `docs/PLAN.md` · `docs/STATE.json` 수정 — STATE 는 driver 가 설정(planner 미수정). PLAN 진입점은 T-0376 에서 이미 박제됨.
- ADR-0041 을 `pr` 로 다시 여는 것 — status flip 은 §3.1 규칙 4 가 명시적으로 `direct` 로 규정.

## Suggested Sub-agents

`implementer` — frontmatter 한 줄 status 변경만 수행(`status: PROPOSED` → `ACCEPTED`). architect/tester 불요(doc-only status flip, 코드 0 · 회귀 0). 사실상 driver 가 직접 Edit 후 direct commit 해도 무방한 trivial 변경.

## Follow-ups

(생성 시 비어있음.) 예상 후속: 본 flip(ADR-0041 ACCEPTED) 직후 **composition-wiring chain 의 첫 task — wiring ① AppShell + 레이아웃 골격**(전역 레이아웃 + view enum 상태 + R-78 배너 슬롯, `commitMode: pr`, `web/src/App.tsx` + 신설 AppShell/layout 컴포넌트 + test, `independentStream: p6-frontend-composition`, `dependsOn: [T-0377]`)을 planner 가 다음 호출에서 큐잉한다. **composition stream 전체는 `web/src/App.tsx` 공유 수정 때문에 single-claim 순차(non-parallel)** — 한 시점 1개 wiring task 만 claim/진행하고 다음은 직전 머지 후 풀린다(ADR-0041 §5 / ADR-0036 §Decision 0).
