---
id: ADR-0005
title: MCP tools 를 PR review / merge flow 의 1 급 도구로 박제 — Path A (driver fallback) 영구화
status: ACCEPTED
date: 2026-05-27
relatedTask: T-0072
supersedes: null
amendments: []
---

# ADR-0005 — MCP tools 를 PR review / merge flow 의 1 급 도구로 박제 (Path A 영구화)

## Context

본 ADR 은 [HQ-0006](../STATE.json) (T-0039 / 2026-05-26 05:27) / [HQ-0008](../STATE.json) (T-0061 / 2026-05-27 12:50) / [HQ-0009](../STATE.json) (T-0066 / 2026-05-27 14:10) / [HQ-0010](../STATE.json) (T-0071 / 2026-05-27 16:05) 의 **4 회차 동일 사유 반복** 을 정식 의사결정으로 박제한다 — Anthropic 클라우드 cron 발화 env 의 `gh` CLI 부재로 reviewer/integrator agent 의 4-게이트 ([CLAUDE.md §3.3](../../CLAUDE.md)) 자동 진행이 차단되고 매 회차 사용자 개입 (`use-local-env-gh`) 우회로만 unblock 되었다. 4 회차 누적으로 **cron backbone 의 실효 부재** 가 systemic 확정 — 본 시스템의 long-horizon 핵심 인프라 (cron 발화 = 사람 critical path 없이 자동 진행) 자체가 막힘.

### 4 회차 박제

| 회차 | HQ | task | 박제 일자 | unblock path |
| --- | --- | --- | --- | --- |
| 1 | HQ-0006 | T-0039 | 2026-05-26 05:27 | use-local-env-gh (1 회차) |
| 2 | HQ-0008 | T-0061 | 2026-05-27 12:50 | use-local-env-gh (2 회차) |
| 3 | HQ-0009 | T-0066 | 2026-05-27 14:10 | use-local-env-gh (3 회차) |
| 4 | HQ-0010 | T-0071 | 2026-05-27 16:05 | use-local-env-gh (4 회차) |

매 회차 사용자 결정 동일 — local /loop 환경 (`where gh` → `C:\Program Files\GitHub CLI\gh.exe v2.88.1` Active=true) 으로 진입 후 reviewer/integrator 자연 진행. 4 회차의 평균 turn-loss ~1.5 turn / BLOCKED. cron 발화 시점의 `which gh` 결과는 `exit 1` (gh 미설치) — Anthropic 클라우드 runner image 에 gh 가 기본 포함되지 않음.

### T-0032 MCP 첫 dogfood evidence (2026-05-25 12:35, cron #1 turn 1)

[journal-2026-05-25.md](../progress/journal-2026-05-25.md) 박제 — T-0032 PR-31 round 3 의 머지에서 driver 가 다음 MCP tool 들을 직접 호출하여 end-to-end review-amend-merge 를 cron env 에서 성공 시연:

- `mcp__github__add_issue_comment(issue_number=31, body=<review verdict>)` — reviewer round 3 verdict 외화
- `mcp__github__merge_pull_request(pull_number=31, merge_method="squash")` — squash merge 실행
- `mcp__github__delete_branch(ref="claude/T-0032-...")` — feature branch cleanup

본 시점에 cron env 에서도 driver 가 MCP tool 을 통해 GitHub API 와 직접 통신 가능함을 검증 — **기술적으로는 이미 가용**, 영구화 (정책 박제) 만 미수행 상태가 4 회차 누적 사유.

### Sub-agent 의 MCP grant 불확실성

[T-0032 journal](../progress/journal-2026-05-25.md) 박제 — 본 시스템의 sub-agent (reviewer / integrator 등) 환경에서 `mcp__github__add_issue_comment` 가 노출되지 않은 negative evidence 1 건. Claude Code 의 sub-agent 가 부모 process 의 MCP server 상속을 어떻게 처리하는지 본질적 mechanism unknown — 별도 throwaway 검증 task (본 ADR 의 Alternatives §(2) 참조) 가 필요하나, 본 ADR 의 결정은 **검증 결과에 의존하지 않는 Path A 채택** 으로 진행한다.

### REQ 외력

- **REQ-057** ([README.md](../../README.md)) — planner / size cap 정책 자체 박제 (정책 REQ). 본 ADR 은 review/merge flow 자체의 1 급 도구를 박제 — 정책의 머신리더블 backbone 영구화.
- **REQ-058** ([README.md](../../README.md)) — REST 표준. `gh` CLI 와 `mcp__github__*` MCP tool 은 동일 GitHub REST API 의 두 client — 본 ADR 이 양 path 의 1:1 mapping 을 unified 명세 박제.

## Decision

본 시스템의 PR review / merge flow 도구로 **`gh` CLI 와 `mcp__github__*` MCP tool 을 1 급 동등** 으로 박제한다. 단 sub-agent 환경의 MCP grant mechanism 이 unknown 인 현 시점 (2026-05-27) 의 default path 는 다음과 같다:

### Path A — driver fallback 영구화 (default)

reviewer / integrator sub-agent 는 **verdict / finding 본문만 driver 에 return** ([CLAUDE.md §4](../../CLAUDE.md) ≤200 char SUMMARY + 자기 trail section 룰 정합). driver 가 본 verdict 를 받아 `mcp__github__*` tool 로 GitHub API 직접 호출:

- reviewer 의 `gh pr comment` post → driver 가 `mcp__github__add_issue_comment` 로 대체
- integrator 의 `gh pr merge --squash --delete-branch` → driver 가 `mcp__github__merge_pull_request(merge_method="squash")` + `mcp__github__delete_branch` 로 대체
- integrator 의 `gh pr checks` / `gh pr view --json comments` → driver 가 `mcp__github__list_check_runs(ref=head_sha)` / `mcp__github__list_issue_comments(issue_number)` 로 대체

### Path A 의 fallback path — local /loop 환경 (gh 가용)

driver 가 local 환경 (`which gh` exit 0 / gh v2.88.x Active) 에서 발화될 때는 reviewer / integrator 가 **직접 `gh pr comment` / `gh pr merge` 호출 가능** ([CLAUDE.md §3.3](../../CLAUDE.md) 게이트 #2 "PR comment 외부 존재" 는 어느 path 든 결과만 보면 됨). 4-게이트 평가 도구는 양 path unified — 게이트 자체 불변.

### Path B — sub-agent MCP grant (deferred)

reviewer.md frontmatter `tools:` 에 `mcp__github__add_issue_comment` 명시 → sub-agent 가 직접 MCP tool 호출. 본 ADR 의 채택 path 가 아님 — Claude Code 의 sub-agent MCP 상속 mechanism unknown 으로 본 task 의 변경 surface 0 (별도 throwaway 검증 task 로 분리, 본 ADR 의 Alternatives §(2) 참조).

### 본 ADR 채택 근거 (5 항목)

1. **즉시 가용** — T-0032 (2026-05-25 12:35 cron #1 turn 1) 에서 driver 의 `mcp__github__add_issue_comment` + `mcp__github__merge_pull_request` end-to-end 호출 성공 dogfood 완료. 추가 검증 / setup / credential 관리 0.
2. **PAT 보관 risk 회피** — install-gh-cli-in-cron-env path 의 PAT (Personal Access Token) 보관 의무가 [CLAUDE.md §5](../../CLAUDE.md) "외부 자격증명 필요" BLOCKED 게이트 발화 + secret 노출 risk 증가. MCP tool 은 Claude Code session 의 OAuth flow 와 통합 — driver 가 별도 token 관리 불요.
3. **4 회차 누적 사유 영구 해소** — HQ-0006/8/9/10 의 root cause (cron env gh 부재) 가 본 ADR 채택으로 영구 우회. 5 회차 발생 0 보장.
4. **cron / loop / local 어디서나 동일 동작** — MCP tool 은 환경 의존 0 (Anthropic 클라우드 cron 발화 / local /loop / headless `claude -p` 모두 동일 호출). long-horizon 일관성 보장.
5. **sub-agent 변경 surface 0** — reviewer / integrator 의 frontmatter `tools:` 미변경 (Path B 의 sub-agent MCP grant 불확실성 회피). 본 ADR 의 변경은 **reviewer.md / integrator.md 의 문서 본문 amend + driver 책임 분담 박제** 만 — agent 실행 환경 변경 없음.

### 4-게이트 평가 도구의 unified 박제

[CLAUDE.md §3.3](../../CLAUDE.md) 의 4-게이트는 도구 path 와 무관하게 평가 — 게이트 자체 불변:

| 게이트 | 평가 항목 | gh path 도구 | MCP path 도구 |
| --- | --- | --- | --- |
| (a) | reviewer.VERDICT == APPROVE | sub-agent SUMMARY 의 VERDICT 라인 | (동일) |
| (b) | PR 에 reviewer comment 외부 존재 | `gh pr view <num> --json comments` 결과에서 header `Agent review — written by` 매칭 1+ | `mcp__github__list_issue_comments(issue_number)` 결과에서 동일 header 매칭 1+ |
| (c) | integrator self-check | sub-agent 의 logic, 도구 무관 | (동일) |
| (d) | CI green | `gh pr checks <num>` conclusion == success (latest comment-trigger run) | `mcp__github__list_check_runs(ref=head_sha)` 의 모든 check_run.conclusion == success |

CI workflow (`.github/workflows/ci.yml`) 의 `reviewer agent approval 검증` step 은 미변경 — PR comment 외부 사실만 보기 때문에 gh / MCP path 어느 쪽이 post 했든 통과 정합.

## Consequences

### 양의

1. **HQ-0006/8/9/10 root cause 영구 해소** — cron env gh 부재가 systemic blocker 에서 제거. 5 회차 발생 0 보장 + cron backbone 의 실효 회복.
2. **PAT 보관 risk 영구 회피** — install-gh-cli-in-cron-env path 의 token 관리 의무 0. [CLAUDE.md §9](../../CLAUDE.md) "secret 코드·journal·task 파일에 절대 적지 않는다" 정합 강화.
3. **cron / loop / local 어디서나 동일 동작** — long-horizon 일관성 보장. ScheduleWakeup ([CLAUDE.md §10](../../CLAUDE.md)) cron 발화의 자동 진행 보장.
4. **sub-agent 변경 surface 0** — reviewer.md / integrator.md 의 frontmatter `tools:` 미변경. Path B 의 sub-agent MCP grant 불확실성 (Claude Code mechanism unknown) 영향 회피.
5. **dogfood evidence 누적** — T-0032 PR-31 round 3 의 driver MCP merge (cron #1 turn 1) + 본 T-0072 의 PR 머지 자체 (Path A 영구화 첫 박제 dogfood) → MCP path 의 production reliability data 누적.
6. **T-0073 후속 task 의 backbone** — 본 ADR 의 Tool mapping 표가 integrator.md amend (T-0073) + CLAUDE.md amend (T-0073) 의 single source of truth — 후속 task 의 reference baseline 박제.

### 음의

1. **driver context 에 raw MCP response 누적 risk** — MCP tool 호출 결과 (e.g. `mcp__github__list_check_runs` 의 모든 check_run JSON) 가 driver 의 conversation 안에 그대로 들어오면 [CLAUDE.md §4](../../CLAUDE.md) ≤200 char SUMMARY 룰 위반 가능. **mitigation**: driver 가 MCP response 를 받자마자 자체 self-enforce — response 의 핵심 결과 (예: `conclusion == success` 여부 boolean 1 개) 만 남기고 raw JSON 은 즉시 discard. context 외화 의무는 driver 책임.
2. **MCP server 의존** — Anthropic MCP server (또는 Claude Code 의 MCP runtime) 가 일시 불가용하면 본 path 도 BLOCKED. **mitigation**: local /loop fallback path 박제 (gh 가용 환경에서 reviewer/integrator 가 직접 호출 가능). MCP server outage 의 long-horizon 발생 빈도가 cron env 의 gh 부재 (4 회차 / 2 일) 보다 본질적으로 낮음.
3. **driver 의 책임 surface 증가** — reviewer / integrator sub-agent 의 일부 책임 (외부 사실 박제) 이 driver 로 이전 → driver prompt / loop 절차의 복잡도 증가. **mitigation**: 본 책임 분담을 reviewer.md / integrator.md / CLAUDE.md §3.3 / §4 에 명시 박제 (T-0072 + T-0073).
4. **4-게이트 평가 도구의 dual-path 유지 비용** — gh / MCP 양 path 모두 1 급 박제로 sub-agent 본문이 길어짐 (양 path 동등 명세 의무). **mitigation**: 본 ADR 의 Tool mapping 표 (아래 §Tool mapping) 가 single source — 각 agent 본문은 표 reference + path 별 차이만 명시.
5. **`mcp__github__list_check_runs` 의 race 평가 복잡도** — `gh pr checks` 의 latest comment-trigger run 평가 (integrator.md L57-69 박제) 와 MCP `list_check_runs` 의 평가 방식 차이. **mitigation**: T-0073 (integrator.md amend) 에서 MCP path 의 race 평가 절차 명시 박제.

### Migration 의무 (후속 task)

본 ADR 머지 후 후속 **T-0073** 의 implementer 가 다음 항목을 박제한다:

1. `.claude/agents/integrator.md` 의 14+ `gh ...` occurrence 매핑 — 각 명령 라인에 MCP equivalent 인라인 표기 + driver fallback 책임 분담 명시.
2. `CLAUDE.md §4` 의 "driver 의 직접 외부 API call 예외" 신설 단락 — driver 가 reviewer / integrator 의 verdict 를 받아 `mcp__github__*` 호출하는 패턴을 정식 박제.
3. `CLAUDE.md §3.3` 의 4-게이트 평가 도구 unified 명세 — gh / MCP path 양 도구 박제.
4. `CLAUDE.md §11` 의 agent-trail blob 에 `tool: gh|mcp` 1 줄 표기 추가 (stretch, T-0073 의 optional).

본 ADR 자체는 위 4 항목을 **결정만** 박제 — 실 amend 는 후속 T-0073 책임.

본 ADR 의 1/2 split (T-0072) 의 변경 범위: `docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md` 신설 + `.claude/agents/reviewer.md` amend (Post 의무 단락 driver fallback path 박제 + MCP equivalent occurrence 매핑) 2 파일.

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) install-gh-cli-in-cron-env** | gh CLI 의 기존 reviewer/integrator 본문 무수정 / 단일 도구 path / 학습 비용 0 | **PAT 보관 의무 발생** — [CLAUDE.md §5](../../CLAUDE.md) "외부 자격증명 필요" BLOCKED 게이트 발화 / token rotation 책임 / secret 노출 risk / 매 cron 발화 setup overhead (gh install + auth 검증) / Anthropic 클라우드 runner image 변경 시 break / 4 회차 누적 사유의 환경 변경에 의존 (control 0) | 기각 |
| **(2) Path B — sub-agent 에 MCP grant** | reviewer / integrator 가 직접 MCP tool 호출 — driver 책임 surface 증가 0 / 기존 sub-agent 자율성 유지 | Claude Code 의 sub-agent MCP server 상속 mechanism 이 본질적 unknown — T-0032 journal 의 "본 sub-agent 환경에서 MCP add_issue_comment 미노출" negative evidence 1 건 / 검증 task (frontmatter `tools:` 에 MCP tool 명시 → cron throwaway invocation) 가 별도 필요 / 검증 fail 시 본 ADR fallback path 무의미 | **기각 (deferred)** — 별도 throwaway 검증 task 로 분리, 검증 성공 시 본 ADR 의 supersede 가능성 open |
| **(3) cron 폐기** (local /loop only 운영) | gh 부재 문제 root 해소 / 별도 ADR 무관 | **long-horizon driver 의 핵심 인프라 폐기** = [CLAUDE.md §10](../../CLAUDE.md) "진정한 long-horizon 은 cron (또는 headless) 만이 보장" 의 본질 부정 / 사람 critical path 무관 자동 진행 책임 위반 / REQ-058 (REST 표준 unified 명세) 책임 위반 | 기각 |
| **(4) Path A + Path B 병행** | gh path / MCP path / sub-agent MCP path 3 path 모두 1 급 박제 → 가장 견고 | 각 path 의 검증 / 박제 / 유지 비용 3x / sub-agent MCP grant 불확실성 (위 (2)) 가 본 path 의 1 차 채택을 막음 / 본 ADR 1 회 통과 후 T-0073 amend 까지의 surface 가 과대 | 기각 (Path B 검증 후 별도 ADR 의 supersede 로 자연 진입) |
| **(채택) Path A (driver fallback) 영구화** | 즉시 가용 (T-0032 dogfood) / PAT risk 0 / 4 회차 사유 영구 해소 / cron/loop/local unified / sub-agent 변경 surface 0 | driver context 누적 risk (mitigation 박제) / MCP server 의존 (local fallback path 박제) / driver 책임 surface 증가 (reviewer.md / integrator.md amend 박제) | **✓ 채택** |

## Tool mapping (gh ↔ MCP unified 명세)

본 표는 reviewer.md / integrator.md 의 14+ `gh ...` occurrence 의 MCP equivalent 를 single source of truth 로 박제. T-0072 (본 task) 는 reviewer.md amend 만 수행, T-0073 (후속) 가 integrator.md amend 에 본 표 인용.

| gh subcommand | MCP tool | 책임 단계 | 박제 위치 (gh) |
| --- | --- | --- | --- |
| `gh pr diff <num>` | `mcp__github__get_pull_request_diff(pull_number)` | reviewer 8-check (PR diff 분석) | [reviewer.md L24](../../.claude/agents/reviewer.md), [reviewer.md L97](../../.claude/agents/reviewer.md) |
| `gh pr view <num>` | `mcp__github__get_pull_request(pull_number)` | integrator PR state 조회 | [integrator.md L12](../../.claude/agents/integrator.md) |
| `gh pr view <num> --json comments` | `mcp__github__list_issue_comments(issue_number)` | 게이트 (b) PR comment 외부 존재 검증 | [integrator.md L12](../../.claude/agents/integrator.md), [integrator.md L46](../../.claude/agents/integrator.md) |
| `gh pr comment <num> --body-file <path>` | `mcp__github__add_issue_comment(issue_number, body)` | reviewer 의 verdict 외부 박제 (Post 의무 / 게이트 (b) 충족) | [reviewer.md L85](../../.claude/agents/reviewer.md), [reviewer.md L106](../../.claude/agents/reviewer.md), [reviewer.md L141](../../.claude/agents/reviewer.md) |
| `gh pr checks <num>` | `mcp__github__list_check_runs(ref=head_sha)` | 게이트 (d) CI green 평가 | [integrator.md L12](../../.claude/agents/integrator.md), [integrator.md L48](../../.claude/agents/integrator.md), [integrator.md L54](../../.claude/agents/integrator.md) |
| `gh pr checks <num> --watch` | `mcp__github__list_check_runs(ref=head_sha)` polling + driver 의 sleep loop | CI 시작 확인 / conclusion 대기 | [integrator.md L20](../../.claude/agents/integrator.md) |
| `gh pr create --title <t> --body <b>` | `mcp__github__create_pull_request(title, body, head, base)` | PR open | [integrator.md L19](../../.claude/agents/integrator.md) |
| `gh pr merge <num> --squash --delete-branch` | `mcp__github__merge_pull_request(pull_number, merge_method="squash")` + `mcp__github__delete_branch(ref="claude/T-NNNN-...")` | 게이트 4 통과 후 squash merge + branch cleanup | [integrator.md L75](../../.claude/agents/integrator.md) |
| `gh run list --workflow=ci.yml --branch=<branch> --limit 5` | `mcp__github__list_workflow_runs(workflow_id="ci.yml", branch=<branch>, per_page=5)` | comment-triggered run 식별 (게이트 (d) race 평가) | [integrator.md L66](../../.claude/agents/integrator.md) |
| `gh run watch <runId>` | `mcp__github__get_workflow_run(run_id)` polling + driver 의 sleep loop | run conclusion 대기 | [integrator.md L67](../../.claude/agents/integrator.md) |
| `gh run view <runId> --log-failed` | `mcp__github__get_workflow_run_logs(run_id)` + driver 의 fail step filter | CI fail finding 분석 | [integrator.md L68](../../.claude/agents/integrator.md), [integrator.md L86](../../.claude/agents/integrator.md) |
| `gh run rerun <firstRunId>` | `mcp__github__rerun_workflow_run(run_id)` | comment-trigger 후 ~60 초 안 second run 미발생 시 self-heal (지양, race-patterns.md fallback) | [integrator.md L69](../../.claude/agents/integrator.md) |
| `gh pr review --approve` (금지) | `mcp__github__create_pending_pull_request_review` + `mcp__github__submit_pending_pull_request_review` (동일 금지) | reviewer 의 formal approve 호출 금지 (4-게이트 합의 위반) | [reviewer.md L140](../../.claude/agents/reviewer.md) |
| `gh pr close + reopen` (금지) | (MCP 등가 없음, 동일 금지) | CI retrigger 안티 패턴 | [integrator.md L143](../../.claude/agents/integrator.md) |
| `gh api -X DELETE /repos/.../git/refs/heads/<branch>` | `mcp__github__delete_branch(ref="claude/T-NNNN-...")` | worktree race 후 branch cleanup fallback ([race-patterns.md](../architecture/race-patterns.md) §2) | T-0066/T-0067/T-0068/T-0069/T-0071 5 회차 fallback 누적 |

### 책임 분담 (Path A default)

| 도구 라인 | gh path (local /loop fallback) | MCP path (Path A default) |
| --- | --- | --- |
| reviewer verdict 외부 박제 | reviewer 자체 `gh pr comment` 호출 (sub-agent context) | reviewer return verdict + body → driver 가 `mcp__github__add_issue_comment` 호출 |
| PR open | integrator 자체 `gh pr create` 호출 | integrator return title + body → driver 가 `mcp__github__create_pull_request` 호출 |
| 4-게이트 (b) PR comment 외부 검증 | integrator 자체 `gh pr view --json comments` 호출 | integrator return PR number → driver 가 `mcp__github__list_issue_comments` 호출 |
| 4-게이트 (d) CI green 평가 | integrator 자체 `gh pr checks` / `gh run list / watch` 호출 | integrator return PR number / head_sha → driver 가 `mcp__github__list_check_runs` / `list_workflow_runs` 호출 |
| squash merge + branch cleanup | integrator 자체 `gh pr merge --squash --delete-branch` 호출 | integrator return merge decision → driver 가 `mcp__github__merge_pull_request(squash)` + `mcp__github__delete_branch` 호출 |

각 줄의 path 선택은 driver 의 환경 ([driver self-diagnosis] `which gh` exit 0 / 1) 으로 결정. cron env (gh 부재) → MCP path. local /loop env (gh 가용) → gh path 또는 MCP path 자유 — 단 cron env dogfood 누적 위해 default MCP 권장.

## References

- [README.md](../../README.md) 110–128행 — R-110~R-114 test/CI 규칙 + 116행 reviewer/committer 이중 합의 + 117–128행 8 check
- [CLAUDE.md §3.3](../../CLAUDE.md) — Reviewer + Committer 이중 합의 + 4-게이트 정의
- [CLAUDE.md §4](../../CLAUDE.md) — Sub-agent dispatch + driver context 누적 방지 룰
- [CLAUDE.md §9](../../CLAUDE.md) — secret / credential 관리 hard rule
- [CLAUDE.md §10](../../CLAUDE.md) — long-horizon 실행 모드 (cron / loop / headless)
- [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) — reviewer agent 본문 (본 ADR 의 amend 대상, T-0072 split 1/2)
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) — integrator agent 본문 (T-0073 split 2/2 amend 대상)
- [docs/STATE.json](../STATE.json) — HQ-0006 / HQ-0008 / HQ-0009 / HQ-0010 4 entry
- [docs/progress/journal-2026-05-25.md](../progress/journal-2026-05-25.md) — T-0032 PR-31 round 3 의 driver MCP merge 첫 dogfood evidence
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — HQ-0008 / HQ-0009 / HQ-0010 dogfood 박제
- [ADR-0001](ADR-0001-stack.md) — backend / language / package manager / test / CI stack (본 ADR 의 환경 baseline)
- [docs/requirements.md](../requirements.md) — REQ-057 (planner / size cap 정책) / REQ-058 (REST 표준)
- [docs/tasks/T-0072-adapt-agents-to-mcp.md](../tasks/T-0072-adapt-agents-to-mcp.md) — 본 ADR 의 relatedTask + split 1/2
- [docs/tasks/T-0073](#) — split 2/2 (integrator.md + CLAUDE.md amend, 본 ADR 머지 후 planner queue)

Refs: T-0072, HQ-0006, HQ-0008, HQ-0009, HQ-0010, REQ-057, REQ-058
