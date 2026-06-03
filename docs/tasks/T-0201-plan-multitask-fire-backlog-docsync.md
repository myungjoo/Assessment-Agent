---
id: T-0201
title: PLAN 운영 정책 backlog 의 multi-task fire 검토 bullet 을 ADR-0020 활성 완결 반영으로 doc-sync
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 6
estimatedFiles: 1
actualDiff: 2
actualFiles: 1
completedAt: 2026-06-03T19:04:00+09:00
created: 2026-06-03
plannerNote: P4 운영 backlog L143 stale — ADR-0020 가 multi-task fire 검토·활성 완결했는데 bullet 은 '검토 예정/ADR-NNNN' 인 채. direct doc-sync.
---

# T-0201 — PLAN 운영 정책 backlog 의 multi-task fire 검토 bullet doc-sync

## Why

[docs/PLAN.md](../PLAN.md) §"운영 정책 review backlog" L143 의 첫 bullet "cron 1-fire 1-task 정책 완화 검토" 는 multi-task chaining 가능성을 "ADR-NNNN (cron multi-task fire policy) 로 **검토 예정**" 이라고 forward-looking 으로 적고 있다. 그러나 ADR-0020 (`docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md`, ACCEPTED, main f21f13f) 이 그 검토를 완결했고, 4-step rollout (T-0197 ADR / T-0198 STATE flag / T-0199 LOOP.md [7.5] cron chain 분기 / T-0200 §10 재조정 + `flags.multiTaskFire: true` 토글) 으로 **이미 N=2 cron-fire 활성화까지 끝났다**. bullet 의 `[ ]` 미완 상태 + placeholder "ADR-NNNN" 텍스트는 stale 이다. 순수 문서 정합 (새 dependency 0 / credential 0 / §5 미발화) 이라 commitMode `direct`.

## Required Reading

- `docs/PLAN.md` — L139~146 "운영 정책 review backlog" 절 (특히 L143 첫 bullet)
- `docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md` — 활성 결정·N=2·cron 한정·30일 dogfood (frontmatter status 와 §6 rollout step 표만 확인하면 충분, 전문 정독 불요)

## Acceptance Criteria

- [ ] `docs/PLAN.md` L143 bullet 의 체크박스를 `- [ ]` → `- [x]` 로 flip.
- [ ] bullet 본문의 stale forward-looking 표현 ("...가능성을 ADR-NNNN (cron multi-task fire policy) 로 검토 예정") 을 ADR-0020 활성 완결 반영으로 교체. 다음 사실이 텍스트에 포함돼야 한다: (1) [ADR-0020](decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) 로 검토·결정 완결, (2) N=2 cron-fire 한정 활성 (`/loop`·human 은 1-task/turn 불변), (3) `STATE.json` `flags.multiTaskFire: true` 토글로 활성, (4) 30일 dogfood 관찰 window 진행 중 (1회 재발 시 flag false rollback). CLAUDE.md §2.5 + ADR-0020 §6 의 실제 내용과 모순 없게 작성.
- [ ] bullet 이 가리키던 placeholder "ADR-NNNN" 가 더 이상 미해소 placeholder 로 남지 않는다 (실제 ADR-0020 링크로 대체 — `grep -n "ADR-NNNN" docs/PLAN.md` 결과에서 본 bullet 라인이 빠짐. L145 PLAN-split bullet 의 별도 "ADR-NNNN" 는 본 task 대상 아님 — 건드리지 않는다).
- [ ] 같은 절의 나머지 두 bullet (L144 길이 mitigation / L145 PLAN 분리) 은 **건드리지 않는다** (본 task scope 밖 — Follow-ups 참조).
- [ ] 변경 후 `docs/PLAN.md` 의 markdown 구조 (heading / 리스트 들여쓰기) 가 깨지지 않는다 (육안 확인).

## Out of Scope

- L144 "CLAUDE.md / LOOP.md 길이 mitigation" bullet 의 체크/수정 — 그 LOC 트리거 (두 문서 합 ≥ 800) 가 현재 충족 (461+444=905) 되었고 candidate (a) cheat sheet (§0.5) 는 이미 존재하나, candidate (b) DRIVER_PROMPT.md 분리 여부는 판단이 필요한 별건 결정이므로 본 doc-sync 와 분리한다 (Follow-ups 로).
- L145 "PLAN.md 단계별 분리" bullet — 트리거 (PLAN.md ≥ 350 LOC) 미충족 (현재 155 LOC). 변경 없음.
- ADR-0020 본문 / `STATE.json` / `CLAUDE.md` / `LOOP.md` 수정 — 본 task 는 PLAN.md 1 파일 doc-sync 만.
- 새 dependency / credential / DB schema / HITL-gated milestone 작업 일체 (§5 게이트).

## Suggested Sub-agents

direct doc-only 1 파일 1 줄 수정 — sub-agent 불요. driver-direct 로 처리 (STATE single-writer 와 동일 패턴, R-110 면제 = doc-only direct).

## Follow-ups

- (관찰) L144 "CLAUDE.md / LOOP.md 길이 mitigation" 의 LOC 트리거 (합 ≥ 800) 가 충족됨 (현재 905). candidate (a) cheat sheet 는 §0.5 로 이미 안착. candidate (b) LOOP.md §1 표준 prompt 의 `docs/DRIVER_PROMPT.md` 분리를 실제로 진행할지 — 또는 (a) 만으로 mitigation 충분하다 보고 bullet 을 resolved 처리할지 — 는 별도 planner 판단/사용자 결정 대상. 본 task 와 분리.
