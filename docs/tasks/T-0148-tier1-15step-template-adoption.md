---
id: T-0148
title: 15-step template Tier 1 차용 — planner / architect / tester / integrator / CLAUDE.md 5 amend
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-058]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-06-02
completedAt: 2026-06-02
sizeExempt: true
exemptReason: meta-policy 동기 적용 — 4 agent file + CLAUDE.md 의 cross-reference 정합 보존을 위해 atomic 단일 commit 필요. split 시 중간 inconsistency window (agent A 가 §X 참조하나 §X 미박제 상태) 발생 risk.
plannerNote: 사용자 대면 검토 conversation 안 결정 (15-step prompt template 의 step 1·5·6·11·14 Tier 1 도입). PR-105/107 race + cross-module silent break + follow-up 양산 + CI sneak-in 4 가지 누적 risk 직접 해결.
---

# T-0148 — 15-step template Tier 1 차용

## Why

사용자가 제시한 외부 15-step 개발 prompt template 의 4 항목 (`§1` issue-still-relevant / `§5+6` cross-module impact + regression / `§11` Nit-in-PR closure / `§14` non-trivial CI fix re-review) 을 본 시스템의 sub-agent 정의에 차용. 본 conversation 안에서 사용자 explicit 결정 (Tier 1 즉시 도입).

직접 동기 (관찰된 사고 / 패턴):

- **PR-105 vs PR-107 T-0106 race** (2026-05-31) — 두 cron invocation 이 같은 T-0106 GET /api/auth/me 를 병행 박제. PR-107 가 race winner merge, PR-105 4-게이트 통과 후 duplicate 로 close. planner 의 issue-still-relevant pre-check 부재가 직접 원인.
- **PR-55 / PR-59 / PR-76 / PR-103 / PR-104 / PR-106 누적 stale PR** — cron designated-branch 부산물 + planner queue race. 본 conversation 초중반에 7건 일괄 close + branch 28건 cleanup 수행.
- **cross-module silent break risk** — 현 R-112 4 카테고리는 변경 영역 자체만 cover, inbound caller 의 가정 깨짐 detect 못 함.
- **follow-up task 양산** — reviewer Nit/Low finding 이 follow-up 으로 누적. PLAN.md 운영 정책 backlog 가 누적되는 추세.
- **CI fix sneak-in risk** — reviewer round 1 APPROVE 후 큰 CI fix 가 reviewer 재호출 없이 main 진입 가능한 path.

## Required Reading

- 본 conversation 의 직전 4 turn (15-step template 검토 + revised 안 재분석)
- `.claude/agents/planner.md` (Pre-check 구조)
- `.claude/agents/architect.md` (Hard rules)
- `.claude/agents/tester.md` (R-112 4 카테고리)
- `.claude/agents/integrator.md` (Workflow B 4-게이트 + self-check)
- `CLAUDE.md` §3 (follow-up 정책)

## Acceptance Criteria

- [x] `.claude/agents/planner.md` — Pre-check 절 신설 (issue-still-relevant 검증 5 단계, race 직접 차단)
- [x] `.claude/agents/architect.md` — Hard rules 에 Cross-module impact analysis 의무 추가 (modules.md dependency graph scan + caller ≥3 시 BLOCKED 옵션)
- [x] `.claude/agents/tester.md` — Workflow §6 에 Cross-module regression test 5번째 카테고리 추가
- [x] `.claude/agents/integrator.md` — self-check 6 항목 뒤에 §5 CI fix re-review 의무 신설 (≥3 LOC / 새 파일 / dep 변경 / production code 변경 시 reviewer 재호출)
- [x] `CLAUDE.md` §3 — Nit-in-PR closure 의무 추가 (4 종 nit fix 의 follow-up 금지 + 본 PR 완결)
- [x] T-0148 본 task 파일 (sizeExempt=true + exemptReason 박제)
- [x] STATE.json counters +1 (origin+1) + mostRecentTasks prepend + lastCommit + lastActivity 갱신
- [x] journal-2026-06-02.md entry append (Tier 1 도입 milestone 박제)

## Out of Scope

본 차용에서 제외 (별도 ADR / 후속 task 책임):

- **step 2 사용자 합의 임계 명시화** (Tier 2 — architect HITL 임계 ADR 필요)
- **step 7 code+test self-review** (Tier 2 — executor 내부 mini-review step ADR)
- **step 9+15 Draft PR + DONOTMERGE 또는 Rebase-and-Merge** (Tier 3 — §10 자동 merge 정책 / commit history shape ADR 필요)
- **Model split Opus/Sonnet** (별도 ADR — cost / quality trade-off)
- 외부 prompt template 의 step 3·4·8·10·12·13 (이미 박제 — implementer / tester / integrator / reviewer chain 정합)

## Follow-ups

- **Tier 2 도입 ADR** — step 2 (사용자 합의 임계) + step 7 (self-review) + Model split 의 3 항목 ADR 후보
- **Tier 3 도입 ADR** — step 9+15 의 merge 정책 결정 (auto-merge 유지 / DONOTMERGE 부분 / hybrid risk-비례 / 전면 수동)
- 본 Tier 1 amend 의 실 ROI 측정 — 다음 10 turn 안 race-prevent / cross-module catch / nit-in-PR / CI fix re-review 트리거 빈도 추적
- planner.md 의 신규 pre-check 거짓 양성 risk 측정 — grep 정밀도 부족 시 false abort 빈도 추적

## TRAIL

본 task 는 사용자 conversation 안 결정 → driver 가 직접 수행 (planner / executor / tester chain 미경유 — direct meta-policy amend). architect 호출 0 (정책 amend 만, ADR 신설 0 — 본 추후 Tier 2/3 ADR 시 본 amend 도 cross-reference). reviewer / integrator 호출 0 (direct mode).
