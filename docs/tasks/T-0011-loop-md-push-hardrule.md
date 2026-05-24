---
id: T-0011
title: LOOP.md §4 보강 — driver push hard rule (feature→main 직접 push 금지)
phase: P0.5
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 45
actualDiff: 18
estimatedFiles: 1
created: 2026-05-24
completedAt: 2026-05-24T01:49+09:00
completedCommit: 65ed3a5
plannerNote: P0.5 안전장치 follow-up — T-0007 driver-misroute (feature→main fast-forward) 재발 방지. doc-only, R-110 면제.
dependsOn: []
blocks: []
hqOrigin: HQ-0003
---

# T-0011 — LOOP.md §4 보강: driver push hard rule

## Why

2026-05-24 01:12 KST, driver(loop session #3) 가 T-0007 BLOCKED bookkeeping commit (1a0dbb9) 을 feature branch `claude/T-0007-ci-spec-presence-check` 에서 작성한 후 `git push origin HEAD:main` 명령으로 main 에 직접 push 했다. 이때 feature branch 의 parent chain 인 d484955 (T-0007 production code) 가 fast-forward 로 main 에 같이 들어가 GitHub 가 PR-8 head sha 를 main 에서 발견 → 자동 MERGED 표시. **결과적으로 T-0007 production code 가 CI 검증 없이 main 에 박혔다** (STATE.counters.tasksAccidentalMerge=1).

LOOP.md §4 의 push 절차는 commit-rebase-push 만 다루고 **"어느 branch 에서 어느 target 으로 push 할 수 있는가"** 의 명시적 hard rule 이 없었다. 본 task 는 [LOOP.md](../LOOP.md) §4 에 다음 hard rule 을 명문화해 같은 사고가 재발하지 않도록 한다:

1. `commitMode: direct` 인 doc-only task 는 반드시 **main branch 의 working tree 에서** commit + push 한다. feature branch 에서 작업 중이면 먼저 `git switch main` 후 변경을 cherry-pick / re-apply 해 commit.
2. `commitMode: pr` 인 task 는 반드시 **`claude/T-NNNN-<slug>` feature branch 의 working tree 에서** commit + push 한다. push target 은 그 feature branch 만 허용; `git push origin HEAD:main` 같은 명령은 **절대 금지**.
3. driver 가 어떤 branch 위에 있는지 commit 직전에 `git branch --show-current` 로 검증하고, 의도한 target 과 일치하지 않으면 즉시 BLOCKED (reason: `wrong-source-branch`).

본 보강은 README 105–108행의 "agent 자율성 + 사람 감시 균형" 원칙의 sub-rule 로, README 직접 지시는 아니지만 driver 자가 운영 규약의 안전장치다. coversReq 는 [docs/requirements.md](../requirements.md) 의 운영정책 REQ (REQ-057 재수집 정책 / REQ-058 backup) 와는 직접 매핑되지 않으므로 placeholder 로 둠.

## Required Reading

- [docs/LOOP.md](../LOOP.md) §4 (전체) — 현 commit-rebase-push 절차 확인
- [docs/STATE.json](../STATE.json) `humanQuestions[2]` (HQ-0003) — 사고 본문
- [docs/progress/journal-2026-05-24.md](../progress/journal-2026-05-24.md) line 6 — 사고 직후 진단
- [CLAUDE.md](../../CLAUDE.md) §3.1 — direct vs pr 분류, "한 task 가 두 종류를 모두 건드려야 한다면 task 를 두 개로 split" 원칙

## Acceptance Criteria

- [ ] [docs/LOOP.md](../LOOP.md) §4 의 "Commit · Push 충돌 처리" subsection 직전 또는 직후에 새 subsection **"Push source/target 매칭 hard rule"** 추가.
- [ ] 새 subsection 본문에 다음 3개 hard rule 명문화:
  1. `commitMode: direct` 작업은 반드시 main branch 의 working tree 에서 commit + push.
  2. `commitMode: pr` 작업은 반드시 `claude/T-NNNN-<slug>` feature branch 의 working tree 에서 commit, push target 도 해당 feature branch 만.
  3. `git push origin <ref>:<other-ref>` 형태 (source 와 target 이 다른 push) 는 일반적으로 금지. 예외는 사용자가 직접 시행하는 hotfix 만.
- [ ] 새 subsection 에 사고 사례 (HQ-0003 / 2026-05-24 01:12 KST) 1줄 인용 — "왜 이 hard rule 이 박혔는지" 후속 reader 가 알 수 있도록.
- [ ] driver 가 commit 직전에 `git branch --show-current` 로 현재 branch 검증하라는 step 을 §1 [4] (COMMIT MODE 분기) 의 (i) 단계 앞에 prerequisite 으로 1줄 추가.
- [ ] 잘못된 source branch 검출 시 새 BLOCKER reason `wrong-source-branch` 사용. §4 BLOCKED reason 목록에 추가.
- [ ] 변경 후 markdown 렌더 점검 — 새 subsection 의 들여쓰기·번호·코드블록이 깨지지 않음 (육안 점검 또는 `pnpm dlx markdownlint-cli` 같은 도구 — 후자는 dependency 추가라 BLOCKED 위험. 본 task scope 에선 육안만).

**R-110~114 적용 면제 사유**: 본 task 는 `docs/LOOP.md` 단일 doc 파일만 수정. production code (`src/`) 0 LOC 변경. CLAUDE.md §3.1 표 `direct` 컬럼에 해당. CLAUDE.md §3.2 R-110 본문 "direct-mode doc-only commit 만 본 규칙 면제" 에 따라 tester 호출 불요. R-111~114 도 production code 없으므로 적용 없음.

## Out of Scope

- driver agent 의 자동 검증 hook 구현 (`git branch --show-current` 를 driver 가 매 turn 실제로 실행하게 하는 코드 변경) — 본 task 는 doc rule 박제만. 실 구현은 별도 task (driver prompt 의 step 추가는 LOOP.md §1 [4] 1줄 명문화로 충분; agent 가 그 명문화를 매 turn 따른다는 자체 규약).
- T-0007 production code 의 사후 CI 검증 — 다음 PR 의 CI run trigger 여부 확인 task 는 별도 follow-up (T-0012+).
- ci.yml 의 workflow_dispatch trigger 추가 — HQ-0003 옵션 (b) 의 인프라 대응. 본 task scope 밖.
- 새 ADR 작성 — 본 보강은 LOOP.md 1 파일 안의 운영규칙 명문화로 충분. ADR 가 필요한 architecture 결정 아님.
- CLAUDE.md 본문 수정 — §3.1 표는 이미 commit mode 분류를 정확히 명시. 본 task 는 LOOP.md 의 push 절차 sub-rule 보강만. CLAUDE.md 변경은 별도 task 가 필요하면 그때 신설.

## Suggested Sub-agents

implementer (doc 편집만) — architect 불필요 (architecture 결정 아님), tester 불필요 (direct doc-only).

## Follow-ups

(작성 시점엔 비어있음. sub-agent 가 본 task 진행 중 추가 관련 작업 발견 시 여기 1줄 append.)
