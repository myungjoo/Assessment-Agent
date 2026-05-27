---
id: T-0065
title: gh pr merge worktree race + reviewer-gate race-fix lessons doc 박제
phase: P3
status: DONE
completedAt: 2026-05-27
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-05-27
plannerNote: cap-close 안전 doc-only direct — 7 회차 worktree race + issue_comment race-fix 패턴 lessons 박제, ADR 신설 0 (P3 cap-close)
---

# T-0065 — gh pr merge worktree race + reviewer-gate race-fix lessons doc 박제

## Why

session #14 turn 6 ~ session #19 turn 3 누적으로 다음 2 종 race pattern 이 **각각 7 회차** dogfood 박제됨 — 본 task 가 그 lessons 를 **단일 architecture doc** 으로 박제:

1. **gh pr merge worktree race (7 회차)** — T-0048/T-0056/T-0057/T-0059/T-0060/T-0061/T-0062 에서 integrator 의 `gh pr merge <num> --squash --delete-branch` 가 **local exit 1** 반환하지만 **remote merge SUCCESS** 인 패턴 누적. 원인: gh CLI 의 post-merge 작업 (local branch delete · remote prune) 이 worktree 가 다른 branch 에 있거나 stale 일 때 fail 하지만 squash merge action 자체는 GitHub 측에서 정상 수행. 처리: integrator 가 `gh api repos/<owner>/<repo>/pulls/<num>` 로 merged=true 재확인 + manual remote branch delete (`gh api -X DELETE`).

2. **reviewer-gate race-fix (7 회차)** — T-0036/T-0039/T-0041/T-0042/T-0044/T-0046/T-0047 의 first run reviewer-gate race + T-0061 의 issue_comment trigger main-HEAD-context 의존 박제. CI 의 `reviewer agent approval 검증` step 이 reviewer comment post 전에 실행되면 fail (race) → reviewer comment post 후 issue_comment-triggered second run 이 자동 발화하여 green. 단 issue_comment trigger 가 main HEAD context 위에서 발화하므로 feature branch CI run 안 도는 경우 발생 — `gh run rerun <firstRunId>` fallback 으로 우회 (T-0061 첫 dogfood SUCCESS).

본 2 종 race 의 처리 절차는 [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 에 부분 박제되어 있으나 **7 회차 누적 데이터 + observed pattern 의 explicit 박제** 가 architecture doc 차원에 없음. 본 task 가 `docs/architecture/race-patterns.md` 신설 + INDEX.md row 추가 + integrator.md 의 L52-69 단락에 본 doc 의 cross-reference 1 줄 추가.

본 task 는 **doc-only direct** — 코드 변경 0, ADR 신설 0 (P3 cap-close 안전), 새 외부 dependency 0. `STATE.phase` 변경 0. cap envelope ≤ 110 LOC / 3 파일 (계산: race-patterns.md 신설 ~95 LOC + INDEX.md row 1 줄 + integrator.md cross-reference 1 줄). doc-only enumerated-section × 1.6 multiplier 적용 시 estimate 110 의 cap-safe envelope.

**cap-close 안전성**: 본 task 는 doc-only direct 이므로 PR / reviewer / integrator / CI cycle 부재. turn 9 에서 단일 commit 으로 완료, turn 10 에서 STATE/journal bookkeeping cap-close. **반드시 1 turn 안에서 execute 가능**.

## Required Reading

- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — gh pr merge worktree race 박제 + reviewer-gate race-fix 절차 박제 source. 본 task 가 L52-69 단락 끝에 race-patterns.md cross-reference 1 줄 추가.
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — 본 task 가 race-patterns.md row 1 줄 추가 source.
- [docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) §2 progress source — race pattern 의 cumulative observation 박제 source 의 sister doc.
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — T-0061 / T-0062 race-fix `gh run rerun` 첫 dogfood SUCCESS 박제 source.
- [docs/progress/journal-2026-05-26.md](../progress/journal-2026-05-26.md) — T-0059 / T-0060 worktree race 4-5 회차 dogfood 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (doc-only direct 정책) + §3.3 (4-게이트 정책) — 본 task 가 doc-only direct 인 근거 source.

## Acceptance Criteria

본 task 는 doc-only direct (R-110 면제 — production code 변경 0).

- [ ] `docs/architecture/race-patterns.md` 신설 — 7 단락 enumerated 구조:
  - §1 개요 — 본 doc 의 범위 (gh pr merge worktree race + reviewer-gate race-fix 2 종 race pattern 의 7 회차 누적 박제, 결정 신설 0, observation 박제만).
  - §2 gh pr merge worktree race (7 회차) — T-0048 / T-0056 / T-0057 / T-0059 / T-0060 / T-0061 / T-0062 의 7 회차 enumeration + 원인 (gh CLI post-merge local branch delete · remote prune fail vs squash merge action remote success) + 처리 (gh api merged=true 재확인 + manual remote branch delete).
  - §3 reviewer-gate race-fix (7 회차) — T-0036 / T-0039 / T-0041 / T-0042 / T-0044 / T-0046 / T-0047 의 first run reviewer-gate race 4 회차 + T-0061 의 issue_comment main-HEAD-context 의존 dogfood 3 회차 enumeration + 원인 (CI step reviewer comment 조회 timing vs reviewer sub-agent post timing) + 처리 (issue_comment-triggered second run / fallback `gh run rerun`).
  - §4 integrator agent 의 race-aware 평가 절차 — L52-69 의 5 step 체크리스트 의 cross-reference (본 doc 가 detailed elaboration, integrator.md 가 procedural source).
  - §5 anti-pattern — `close+reopen` 사용 금지 (Hard rules), `gh pr merge --force` 사용 금지, `--no-verify` 사용 금지.
  - §6 observed cumulative — 7+7=14 회차 데이터 누적, 다음 회차 시점 update 책임 (architect agent follow-up).
  - §7 References.
- [ ] `docs/architecture/INDEX.md` 의 "문서 목록" 표에 race-patterns.md row 1 줄 추가 (책임 / 생성 task / 상태 컬럼 정합).
- [ ] `.claude/agents/integrator.md` L52-69 단락 끝에 race-patterns.md cross-reference 1 줄 추가 (예: "→ 본 race pattern 의 7+7=14 회차 누적 박제는 [docs/architecture/race-patterns.md](../../docs/architecture/race-patterns.md) 참조.").
- [ ] 본 task 는 R-112 면제 (doc-only direct, production code 변경 0, spec 신설 의무 0). 분기 없음 — 이 항목 생략.
- [ ] cap envelope: estimatedDiff=110 / estimatedFiles=3. doc-only enumerated × 1.6 multiplier 적용 결과 (base 70 × 1.6 ≈ 112 LOC). 초과 시 frontmatter `sizeExempt: true` + `exemptReason` 박제 의무 (planner pre-justified).
- [ ] direct-mode commit (parent main, source=target=main) — PR / reviewer / integrator / CI cycle 0.

## Out of Scope

- **ADR 신설 0** — 본 task 는 observation 박제만, decision 박제 0. ADR-0005 (cross-cutting field) / ADR-0006 (LLM key encryption) / ADR-0007 (audit log schema) / ADR-0008 (auth credential) 신설은 별도 follow-up task.
- **integrator.md L52-69 procedure 변경 0** — 본 task 는 cross-reference 1 줄 추가만. 실제 procedure 갱신은 별도 follow-up task (race 발견 추가 회차 누적 후).
- **CI workflow 변경 0** — `.github/workflows/ci.yml` 변경 0 (issue_comment trigger 정책 변경은 별도 ADR + PR-mode task).
- **STATE.phase 변경 0** — P3-in-progress 유지. P4 advance 결정은 HQ-pending (T-0063 evaluation doc 의 3 옵션 중 사용자 선택).
- **새 외부 dependency 0** — package.json 변경 0.
- **production code 변경 0** — src/ 변경 0, test/ 변경 0.
- **R-110 / R-112 / R-113 면제** — doc-only direct, code 변경 0.

## Suggested Sub-agents

`implementer` (doc 편집 단독) → tester 호출 skip (doc-only direct, R-110 면제). architect 호출 0 (observation 박제만, 새 의사결정 0). reviewer / integrator 호출 0 (direct-mode, PR 없음).

## Follow-ups

(생성 시점 empty — sub-agent 가 발견 시 append)
