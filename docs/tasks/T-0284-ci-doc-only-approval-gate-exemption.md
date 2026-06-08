---
id: T-0284
title: CI reviewer-approval 게이트 doc-only PR 면제
phase: P4
status: IN_PROGRESS
commitMode: pr
coversReq: []
origin: user-directed (loop@cloud-82SQk session, PR #237 CI-fail 대응 AskUserQuestion option 3)
created: 2026-06-08
---

# T-0284 — CI reviewer-approval 게이트 doc-only PR 면제

## Why

`.github/workflows/ci.yml` 의 마지막 step "reviewer agent approval 검증"(CLAUDE.md §3.3 4-게이트 (b))은 **모든** PR 이 reviewer 승인(formal APPROVED 또는 approve 어휘 comment) 전까지 CI 를 red 로 만든다. 이는 pr-mode 코드 PR 에는 옳지만, **doc-only driver bookkeeping**(planner 의 nextTask queue, PLAN 체크박스 doc-sync 등 — §3.1 상 PR 없이 main 에 direct commit 하는 변경)이 web harness 등으로 PR 로 라우팅되면 reviewer 승인이 구조적으로 불필요한데도 게이트가 red 를 강제한다.

사용자 결정(loop@cloud-82SQk session, PR #237 CI-fail 대응 AskUserQuestion → option 3): 게이트를 doc-only PR 에 한해 면제하도록 수정한다. 이는 새 정책이 아니라 **§3.1 의 기존 direct/pr 경계를 CI 에 그대로 옮긴 것**이다.

## 변경 내용

- `scripts/check-doc-only-pr.sh` — 변경 파일 목록(stdin)이 전부 direct-mode 문서 allowlist(STATE/PLAN/PLAN_archive/LOOP/requirements/progress/tasks/use-cases/CLAUDE/README/.claude)에 속하면 exit 0, 하나라도 pr-mode 영역(src·test·ADR·architecture·CI·config·prisma 등)이면 exit 1. 네트워크/의존성 0(순수 bash+grep), 호출측이 파일 목록 주입 → 단위 test 가능. 빈 입력은 보수적 exit 1(fail-safe).
- `scripts/check-doc-only-pr.test.sh` — happy(전부 doc)/negative(코드·ADR·architecture·CI·config·lockfile·prisma 혼합)/edge(prefix 우회·빈 입력·공백) 19 case self-test.
- `.github/workflows/ci.yml` — (1) "doc-only 판정 script 자체 test" step 추가(spec-presence self-test 와 동형). (2) approval-gate step 최상단에 doc-only 면제 분기: `gh pr view <n> --json files` → `check-doc-only-pr.sh` 가 exit 0 이면 게이트 skip(green). helper 부재 / 비-doc PR 이면 기존 (a)/(b) reviewer-approval 검사로 진행.

## Acceptance Criteria

- [x] doc-only PR 의 approval-gate 가 면제되어 CI green (helper 가 면제 판정 시 exit 0).
- [x] 코드/ADR/architecture/CI/config 를 포함한 PR 은 여전히 reviewer 승인 필요(게이트 유지).
- [x] check-doc-only-pr.sh happy/negative/edge(빈 입력·prefix 우회) self-test 통과(R-112 negative cases 충분 cover).
- [x] CI 에 self-test step 추가 — 게이트 logic regression 자동 검출.
- [x] ci.yml 은 여전히 valid YAML, 기존 lint/build/test/smoke/e2e step 불변.

## Out of Scope

- 본 PR(#237) 자체는 `.github/workflows/` + `scripts/` 를 건드리므로 doc-only 가 아님 → 본 면제의 대상이 아니다(reviewer 검토를 거쳐야 함, governance-sensitive). 면제 효력은 **차기 doc-only PR** 부터.
- §3.3 4-게이트의 (a) formal review / (b) comment 매칭 logic 자체는 불변.
- ADR 화: 본 변경이 §3.3 게이트 동작을 좁히므로 향후 ADR 로 정식 박제 가능(사용자 판단). 본 task 는 §3.1 경계의 CI 반영에 한정.

## Follow-ups

- (선택) 본 면제를 ADR 로 박제 — §3.3 게이트 예외를 historical record 화.
- (선택) STATE bookkeeping(counters.tasksCompleted++, mostRecentTasks)은 PR merge 후 driver turn 에서 정합.
