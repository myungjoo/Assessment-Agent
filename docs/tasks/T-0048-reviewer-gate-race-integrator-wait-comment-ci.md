---
id: T-0048
title: reviewer-gate race fix — integrator 가 comment-triggered CI run 을 기다리도록 절차 박제 (doc-only direct)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-058]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-05-26
plannerNote: T-0047 §Follow-ups + journal 7 회 연속 race 패턴 박제 — integrator.md Workflow B 의 게이트 (d) CI green 검사를 comment-triggered run 까지 wait 하도록 절차 갱신. direct (.claude/ meta).
dependsOn: []
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/progress/journal-2026-05-26.md (13:19 driver entry "reviewer-gate race 7 회 연속" 누적 박제) + T-0036/T-0039/T-0041/T-0042/T-0044/T-0046/T-0047 mostRecentTasks 7 pr-mode 연속 패턴 + .github/workflows/ci.yml L13-16 (issue_comment trigger 이미 박제됨, comment 추가 시 CI 자동 재실행) + .claude/agents/integrator.md Workflow B "게이트 (d) CI green" (현 정책이 push 직후 CI 결과를 기다리되 reviewer post 이후 자동 재실행 fact 미 박제) + driver-supplied 후보 (c) "reviewer/integrator timing patch". 본 task 는 doc-only direct — `.claude/agents/integrator.md` 의 Workflow B 게이트 (d) 절차에 "첫 push CI run 이 reviewer-gate race 로 fail 일 가능성" + "reviewer post 후 issue_comment trigger 로 자동 재실행되는 fact" + "재실행 run 의 conclusion 까지 wait 후 게이트 평가" 박제. 그래도 fail 시 기존 `gh run rerun` ad-hoc fallback 유지. ROI: 매 pr-mode task 의 ~1-2 min × 향후 backbone task 모든 PR 누적 비용 절감.
---

# T-0048 — reviewer-gate race fix (integrator 가 comment-triggered CI run 을 기다리도록 절차 박제)

## Why

[2026-05-26 journal](../progress/journal-2026-05-26.md) 의 13:19 driver entry 가 **reviewer-gate race 7 회 연속** 발생을 박제했다 — T-0036, T-0039, T-0041, T-0042, T-0044, T-0046, T-0047 의 매 pr-mode task PR 의 **첫 CI run 이 모두 `reviewer agent approval 검증` step 에서 fail**, ad-hoc `gh run rerun` 으로 second run green 회복. 본 패턴은 다음 race 의 결과:

1. integrator 가 feature branch push → GitHub 가 `pull_request` event → CI 즉시 시작.
2. CI 의 `reviewer agent approval 검증` step (`.github/workflows/ci.yml` L82-115) 이 PR 의 comments 를 조회 — 아직 reviewer 가 post 안 한 시점 → matches 0 → step fail → CI red.
3. reviewer sub-agent 가 약 10-30 초 후 `gh pr comment` 로 review post.
4. GitHub 의 `issue_comment: [created]` trigger (`.github/workflows/ci.yml` L13-16) 가 발화 → CI **자동 재실행** → 이제 comment 1+ 존재 → step pass → CI green.

**중요**: 4 단계의 CI 자동 재실행이 이미 박제되어 있다 — workflow 의 `issue_comment` trigger 가 이를 보장. 그러나 integrator.md 의 Workflow B 게이트 (d) "CI green" 절차는 이 사실을 박제하지 않아서 integrator 가 **첫 run fail 을 보고 `gh run rerun` 수동 ad-hoc fallback** 으로 매번 대응 — 이는 (a) 한 번의 reviewer post → 두 번의 CI run (auto issue_comment + manual rerun) 으로 CI compute 1.5x 낭비 (b) integrator 절차의 race 인지 부재로 자체 점검 6 항 의 게이트 (d) 평가가 첫 fail run 을 기준으로 잘못 평가될 위험 (c) 누적 비용 ~1-2 min × 매 pr-mode task = 향후 backbone task 진척에 비례 증가.

본 task 는 **doc-only direct** — `.claude/agents/integrator.md` 의 Workflow B 게이트 (d) 절차에 다음을 박제:

1. 첫 push 직후 CI run 의 conclusion 을 evaluate 하기 **전에**, reviewer sub-agent 의 `gh pr comment` post 완료 fact 와 그 comment 가 trigger 한 `issue_comment` event 의 CI run (latest run) 의 conclusion 을 기다린다.
2. 첫 run 이 `reviewer agent approval 검증` step 에서 fail 이고 second run (comment-triggered) 이 green 이면 게이트 (d) PASS 로 평가.
3. second run 도 fail 또는 second run 자체가 30 초 안에 trigger 안 되면 기존 `gh run rerun` ad-hoc fallback.

`.claude/agents/reviewer.md` 도 한 줄 박제 — reviewer 가 `gh pr comment` post 한 직후 driver/integrator 에게 "comment post 됨 → CI 자동 재실행 trigger 됨 → 다음 latest run conclusion 을 기다려야 함" 을 SUMMARY 에 명시 권고 (의무화는 안 함, reviewer.md 의 Output 형식 단순성 보존).

본 task 는 코드 / test / production 변경 0 / 새 외부 dependency 0 / schema 변경 0 / migration 0 / CI workflow YAML 변경 0 — agent definition 의 절차 박제 단일 책임. `.claude/agents/` 는 [CLAUDE.md §3.1](../../CLAUDE.md) 의 direct table (`.claude/` 메타 변경) 에 해당하므로 commitMode: direct.

REQ 매핑: [REQ-058](../requirements.md) (운영 정책 / 테스트 격리 / non-volatile underlying REQ — 본 race fix 는 운영 정책 차원).

## Required Reading

- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) Workflow B (L25-77) — 본 task 의 갱신 대상. 게이트 (d) CI green 절차 (L48 + L65) 에 race 인지 + comment-triggered run wait 박제.
- [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) Output 섹션 (L122-131) — 본 task 의 한 줄 권고 박제 대상. reviewer 가 comment post 후 SUMMARY 또는 별도 라인에 "CI auto-rerun pending" 명시 권고.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) L7-22 (trigger 정의) + L82-115 (reviewer approval 검증 step) — race 의 근본 source. 본 task 는 본 파일 변경 안 함 — 그 fact 를 integrator 절차에 박제만.
- [docs/progress/journal-2026-05-26.md](../progress/journal-2026-05-26.md) 의 13:19 driver entry — 7 회 연속 패턴의 박제 source. 본 task 의 plannerSource 인용 자료.
- [docs/STATE.json](../STATE.json) loopSession.note + ci.note — 본 race 누적 박제 source.
- [docs/tasks/T-0047-shared-test-helpers-extraction-prisma-mock.md](T-0047-shared-test-helpers-extraction-prisma-mock.md) §Follow-ups — 본 task 의 박제 source 한 줄 (reviewer-gate race 누적).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode 분기 — `.claude/` 메타 direct) / §3.3 (4-게이트 — 본 task 의 게이트 (d) 절차 갱신 source) / §11 (trail blob — direct commit 도 trail blob 의무) / §12 (한국어 본문).
- [docs/LOOP.md](../LOOP.md) §1 [5] (push 후 CI conclusion 확인 절차) — 본 task 가 integrator 절차로 박제할 race 인지의 driver-level 참조 (변경 안 함).

## Acceptance Criteria

본 task 는 **doc-only direct commit task** — main 브랜치에 직접 commit + `git push origin HEAD:main` (worktree branch alias). PR / reviewer / integrator 4-게이트 안 거침 ([CLAUDE.md §3.1](../../CLAUDE.md)).

**`.claude/agents/integrator.md` 갱신** (Workflow B 게이트 (d) CI green 절차 박제, ~50 LOC 추가):

- [ ] Workflow B 의 게이트 표 (L43-49) 아래 새 단락 추가 — **"게이트 (d) CI green 의 reviewer-gate race 인지"** subsection. 다음 박제:
  - first push 직후 CI 자동 trigger (pull_request event).
  - `reviewer agent approval 검증` step 이 첫 run 에서 comment 0 매칭 → fail 가능 (race).
  - reviewer sub-agent 의 `gh pr comment` post 가 `issue_comment: created` event 를 발화 → CI 자동 재실행 ([.github/workflows/ci.yml](../../.github/workflows/ci.yml) L13-16 의 박제된 trigger).
  - 따라서 integrator 의 게이트 (d) 평가는 **reviewer post 이후의 latest CI run (= second run, comment-triggered)** 의 conclusion 으로 한다. 첫 run fail 만 보고 게이트 (d) fail 판정 금지.
- [ ] 평가 절차 박제 (체크리스트):
  1. reviewer sub-agent SUMMARY 에서 COMMENT_URL 확인 (post 완료 fact).
  2. `gh run list --workflow=ci.yml --branch=<feature-branch> --limit 5` 로 최근 run 목록 조회 — comment-triggered run (event=issue_comment) 의 존재 확인.
  3. comment-triggered run 이 존재하면 `gh run watch <runId>` 또는 polling 으로 conclusion 대기 (timeout 5 min).
  4. 그 run 의 conclusion=success → 게이트 (d) PASS. conclusion=failure → 게이트 (d) FAIL (실제 코드 결함 가능성, ad-hoc fallback 전 finding 분석).
  5. comment post 후 ~60 초 안에 comment-triggered run 이 trigger 안 되면 기존 `gh run rerun <firstRunId>` ad-hoc fallback (현 정책 유지 — fallback safety net).
- [ ] L65 의 "게이트 (d) CI failed" 행 갱신 — 기존 `gh run view <runId> --log-failed` 직전에 "first run fail 이 reviewer-gate race 인지 확인 (step name = `reviewer agent approval 검증`) — 그렇다면 comment-triggered run 의 conclusion 으로 재평가" 한 줄 박제.
- [ ] Hard rules (L118-127) 에 한 줄 추가 — "**Never** evaluate gate (d) on the first CI run when reviewer-gate race is suspected — always wait for the comment-triggered run (auto-fired by `issue_comment` trigger) and evaluate that conclusion."
- [ ] 본 추가는 기존 절차 변경 0 (additive only) — 기존 6 항 자체 점검 / 4-게이트 표 / Workflow A/C / Output 형식 모두 그대로 유지.

**`.claude/agents/reviewer.md` 갱신** (Output 섹션 권고 한 줄 박제, ~10 LOC 추가):

- [ ] Output 섹션 (L122-131) 아래 새 한 줄 박제 — "**Post-comment note**: `gh pr comment` post 직후 본 PR 의 CI 가 `issue_comment` trigger 로 자동 재실행된다 ([.github/workflows/ci.yml](../../.github/workflows/ci.yml) L13-16). integrator 가 게이트 (d) 를 평가할 때 본 재실행 run 의 conclusion 을 기준으로 한다." 권고 (의무화는 안 함, SUMMARY 형식 단순성 보존).
- [ ] reviewer 의 Output 형식 (SUMMARY / VERDICT / FINDINGS / ROUND / COMMENT_URL / STATUS) 6 라인 본문 변경 0 — 본 한 줄은 본문 외 권고 박제.

**Markdown rendering 검증**:

- [ ] 두 갱신 파일을 read 후 markdown 구조 (heading 계층 / 리스트 들여쓰기 / 링크 형식) 정상 렌더링 (visual diff 검산).
- [ ] 한국어 문장의 자연스러움 (§12 한국어 정책) — code fence / 명령어 / 식별자 / enum 토큰은 영어 유지.
- [ ] 새 cross-reference 링크 (`.github/workflows/ci.yml` 등) 의 상대 경로 정확.

**out of scope guard**:

- [ ] `.github/workflows/ci.yml` 변경 0 — CI workflow YAML 은 pr-mode task scope, 본 task 는 doc-only direct.
- [ ] reviewer.md 의 hard rule 추가 / 의무화 0 — 권고 한 줄 박제만.
- [ ] integrator.md 의 4-게이트 자체 변경 0 — race 인지 절차 추가만, 게이트 표 / 6 항 self-check 정의 변경 안 함.
- [ ] CLAUDE.md / LOOP.md / PLAN.md 변경 0 — 본 task 는 `.claude/agents/` 만.

**분기 / negative cases 적용 평가**:

- 본 task 는 doc-only direct — code 분기 없음. R-112 4 항목 (happy / error / branch / negative test) 적용 불가, 본 항목 면제 정당 (code 0 LOC).
- 본 task scope 에는 unit test 추가 없음 — test/spec 파일 변경 0.
- coverage threshold 영향 0 (production code 변경 0).

**Trail / commit / push** (direct commit 의 §11 의무):

- [ ] commit message subject ≤ 70 char, type=docs scope=agents — `docs(agents): reviewer-gate race 인지 + comment-triggered CI run wait 절차 박제 (T-0048)`.
- [ ] commit body 본문 한국어 (§12) — 본 task 의 why / 갱신 항목 / 검증 요약 ~5 줄.
- [ ] commit body 의 agent-trail blob 에 PLANNER (한 줄 — 본 task 의 plannerNote 동일) + IMPLEMENTER (files: `.claude/agents/integrator.md, .claude/agents/reviewer.md`, loc: +X/-Y, notes: race 인지 절차 박제 doc-only) + ACCEPTANCE 섹션 포함. ARCHITECT / TESTER / INTEGRATOR 섹션 생략 (호출 안 함 — direct doc-only).
- [ ] `git push origin HEAD:main` (worktree branch alias 패턴 — cron #7 / session #9~#12 선례 동일).
- [ ] push 후 `gh run list --limit 1` 로 main CI conclusion 확인 (doc-only direct 의 main CI 도 GitHub Actions 자동 실행).
- [ ] STATE.json 갱신 (driver 책임 — 본 task 머지 후 mostRecentTasks prepend / lastCommit / counters.tasksCompleted++ / 본 task frontmatter status DONE + completedAt + mergedAs).

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **`.github/workflows/ci.yml` 의 reviewer approval 검증 step timing 변경** — 예: step 을 wait-for-comment loop 으로 변경 / job 순서 재배치 / step 을 separate workflow 로 분리. CI workflow YAML 은 pr-mode task scope. 본 race 가 doc-level 박제로 충분히 mitigable 한지 본 task 머지 후 monitoring 결과 + 누적 비용 재평가 후 별도 task 책임.
- **reviewer agent 의 comment post timing 을 PR open 직후로 앞당기는 패턴** — 예: reviewer 가 PR open trigger 와 동시에 placeholder comment post → 분석 후 verdict 갱신. reviewer.md 의 Workflow 자체 변경 — 본 task 는 한 줄 권고만, 본 reordering 은 별도 task.
- **integrator 의 4-게이트 평가 자체 재설계** — 게이트 (d) 외 (a)/(b)/(c) 평가 절차 변경. 본 task 는 게이트 (d) race 인지만 추가.
- **GroupService + GroupController + Group DTO backbone** — Part 와 대칭의 Group 책임. 별도 backbone task (~280 LOC / cap tight, N:M PersonGroupMembership 책임 박제 동반). 본 task 머지 후 진입 후보.
- **phase 2 src/user/*.spec.ts 5 spec migration** — T-0047 §Follow-ups 의 helper 외화 phase 2. fixture variant 결정 동반. 본 task 와 무관한 별도 task.
- **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse. 별도 test-quality task 책임.
- **p3-implementation-plan.md §2 표 T-0047 ~ T-0048 row 추가** — T-0046 row 박제와 함께 별도 doc-only direct follow-up task. 본 task 는 plan 변경 0.
- **PERSON_DTO_FIELDS / messageText / expectDtoFields 추출** — e2e spec local 3 helper. 별도 follow-up.
- **새 ADR 신설** — 본 task 는 mechanical 절차 박제. 본 패턴이 광범위 정책화 필요해지면 별도 ADR (예: ADR-0008 agent-CI-race 정책) — 본 task scope 외.
- **production 코드 / DTO / repository / service / module / schema / test / dependency 변경** — 일절 금지. 본 task 는 `.claude/agents/` 두 파일만.
- **`docs/LOOP.md` §1 [5] 의 driver-level CI 확인 절차 변경** — driver context 의 CI 확인은 별도 layer. 본 task 는 integrator agent 절차만.
- **reviewer.md 의 Hard rules 에 comment post 후 CI wait 의무화** — 권고 한 줄만, 의무화는 별도 task (reviewer.md Output 형식 변경 동반).

## Suggested Sub-agents

`implementer` 만 (direct doc-only — architect / tester / reviewer / integrator 호출 안 함).

- **implementer**: `.claude/agents/integrator.md` Workflow B 게이트 (d) subsection 추가 (~50 LOC) + Hard rule 한 줄 추가 + `.claude/agents/reviewer.md` Output 권고 한 줄 추가 (~10 LOC). markdown rendering 검산 + 한국어 자연스러움 검산. cap ≤300 LOC / ≤2 파일 보존 안전 (실 ~60 LOC / 2 파일).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **본 절차 박제 후 모니터링 결과 평가** — 본 task 머지 후 다음 pr-mode task 3-5 회 의 PR 에서 reviewer-gate race 가 (a) 자연 해소 (integrator 가 comment-triggered run 평가로 ad-hoc rerun 0 회) (b) 부분 해소 (rerun 1-2 회로 감소) (c) 미해소 (rerun 빈도 변동 없음) 중 어느 결과인지 측정. (c) 시 CI workflow YAML 변경 (pr-mode task) 으로 escalate.
- [ ] **GroupService + GroupController + Group DTO backbone** — Part 와 대칭, N:M membership add/remove 책임. 별도 backbone task (~280 LOC / cap tight). 본 task 머지 후 진입 후보 (P3 backbone 진행 자연 다음 단계).
- [ ] **phase 2 — src/user/*.spec.ts 5 spec migration** — T-0047 §Follow-ups. fixture variant 결정 + 5 spec 의 helper inline 제거. 별도 task.
- [ ] **reviewer.md 의 Output 형식에 COMMENT_TRIGGERED_CI_RUN_URL 라인 추가** — 의무화. 본 task 는 권고만, 의무화는 별도 task (reviewer.md Output 6 라인 → 7 라인 확장).
- [ ] **CI workflow YAML 의 reviewer approval 검증 step 을 separate workflow / job 으로 분리** — 본 race 의 근본 해소 후보. pr-mode task + 새 workflow 신설 동반.
- [ ] **directory.md `.claude/agents/` 트리 박제** — `.claude/agents/integrator.md` / `.claude/agents/reviewer.md` 책임 한 줄 박제. doc-only direct ~5 LOC.
- [ ] **p3-implementation-plan.md §2 표 T-0046 ~ T-0048 row 추가** — T-0045 패턴 재실행 doc-only direct.
- [ ] **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse. 별도 test-quality task.
