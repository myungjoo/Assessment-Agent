---
id: T-0127
title: "LOOP.md 에 ADR-0009 ref-CAS lock 프로토콜 반영 (§1[1] + §4)"
phase: P3
status: PENDING
commitMode: direct
coversReq: []
estimatedDiff: 120
estimatedFiles: 1
created: 2026-06-01
dependsOn: [T-0126]
plannerNote: "ADR-0009 operationalization #1 — 라이브 driver prompt(§1[1])와 lock 규약(§4)을 약한 인메모리 mutex → 전용 ref refs/locks/driver 의 --force-with-lease CAS 로 교체. read 전 fetch 의무 + feature-worktree driver 금지 + session 필수 박제. CLAUDE.md §10 개정과 STATE schema session 필수화는 별도 task. doc-only direct."
---

# T-0127 — LOOP.md 에 ADR-0009 ref-CAS lock 프로토콜 반영

## Why

[ADR-0009](../decisions/ADR-0009-strong-ref-cas-lock.md)(PROPOSED) 의 결정을 라이브 운영 문서에 반영하는 첫 operationalization task. 현 [LOOP.md](../LOOP.md) §1 [1] 은 lock 을 인메모리로 점검·설정하고 작업 끝에 push 하는 약한 mutex — read-then-push race + stale worktree 무위 종료(T-0126 직전 2회 발생) 취약. 본 task 가 §1 [1] 과 §4 를 **전용 ref `refs/locks/driver` 의 `--force-with-lease` CAS** 로 교체하고, **read 전 fetch 의무 + feature-worktree driver 실행 금지 + session 필수** 를 박는다.

doc-only direct ([CLAUDE.md](../../CLAUDE.md) §3.1 direct 컬럼 — LOOP.md). CLAUDE.md §10 개정 + STATE schema `session` 필수화 + ADR ACCEPTED 전이는 별도 후속 task.

## Required Reading

- `docs/tasks/T-0127-loop-ref-cas-protocol.md` (본 파일)
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` — 반영할 결정 원본
- `docs/LOOP.md` §1 [1] (lines ~17-28) + §4 (lines ~273-332) — 편집 대상

## Acceptance Criteria

- [ ] **§1 [1] STATE & LOCK 블록 교체** — (a) read 전 `git fetch origin main +refs/locks/driver:...` 의무 명시, (b) feature-branch worktree(`.claude/worktrees/*`)에서 깨어나면 즉시 종료(stale-worktree), (c) lock 획득을 ref-CAS(`--force-with-lease`)로, (d) lock blob 스키마(holder/session 필수/since) + STATE.json.lock 은 비권위 human mirror 명시, (e) session 기반 loopSessionTurnCount reset.
- [ ] **§4 intro** — "약한 mutex" 서술에 ADR-0009 강한 ref-CAS 전환 명시(약한 mutex 역사 note 보존).
- [ ] **§4 Lock 형태 + session note** — `session` 필수화 + ref 저장 명시.
- [ ] **§4 획득/해제** — ref-CAS(`--force-with-lease`) 절차로 교체. stale 탈취도 CAS, human lock 도 60분 stale 대상 명시.
- [ ] **§4 worktree 정책** — driver loop 는 origin/main 추적 체크아웃에서만 실행, feature-worktree driver 금지 + read 전 fetch 의무 cross-ref.
- [ ] 편집은 `docs/LOOP.md` 1 파일만. src/ test/ 변경 0.
- [ ] BLOCKER reason 카테고리에 `stale-worktree` 추가.

## Out of Scope

- **CLAUDE.md §10 개정** — 별도 task (T-0128 후보).
- **STATE.json schema `session` 필수화 + data-model 동기** — 별도 task.
- **ADR-0009 PROPOSED→ACCEPTED 전이** — 위 후속 doc task 들 머지 후 별도 direct.
- **cron 환경 gh/MCP 복구** — 별도 ADR.
- **실제 ref CAS 동작 자동 검증 스크립트 / CI** — 본 task 는 프로토콜 문서화만.

## Suggested Sub-agents

driver inline (doc-only direct, T-0096/T-0097 패턴). architect/implementer/tester 미호출.

## Follow-ups

- (planner 예약) T-0128: CLAUDE.md §10 multi-entry strong-mutex 모델 개정.
- (planner 예약) STATE.json schema `session` 필수화 + data-model 동기.
- (planner 예약) ADR-0009 ACCEPTED 전이.
- (planner 예약) cron 환경 gh/MCP 복구 ADR.
