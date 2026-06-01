# ADR-0010 — cron 환경 GitHub MCP 경로로 pr-mode 완주 보장

## Status

ACCEPTED (2026-06-01)

> gh CLI → GitHub MCP 도구 path 는 [ADR-0005](ADR-0005-mcp-tools-for-pr-review-flow.md) 가 이미
> 정당화했다. 본 ADR 은 그 path 를 **cron 환경 pr-mode 완주의 표준**으로 확정하고 MCP 부재 시
> graceful degradation 을 결정하는 운영 ADR 이므로 즉시 ACCEPTED.

## Context

[ADR-0009](ADR-0009-strong-ref-cas-lock.md) 결정 5 는 cron 과 `/loop` 의 **역할 분리 없음**(둘 다 모든 task 후보)을 정했다. 그러나 그 전제 — "cron 이 pr-mode task 를 머지까지 완주할 수 있어야 함" — 은 별도 ADR 로 미뤄졌고, 본 ADR 이 이를 결정한다.

현실 제약:

- cron 은 Anthropic 클라우드에서 발화되며 **`gh` CLI 가 부재**(`which gh` exit 1)다. HQ-0006 / 0008 / 0009 / 0010 / 0013 으로 **5회 이상 재발한 systemic breakage**.
- gh 부재 시 cron 은 PR open / reviewer comment post / CI 확인 / squash merge / branch delete 를 수행하지 못한다. 결과적으로 pr-mode task 에서 BLOCKED 되거나, draft PR·stale branch 를 양산했다 (T-0098 이 정화한 13 stale PR + 13 branch 가 그 잔재).
- [ADR-0005](ADR-0005-mcp-tools-for-pr-review-flow.md) 는 PR review flow 를 **gh / GitHub MCP unified** 로 정당화했다 — driver 가 `mcp__github__add_issue_comment` / `merge_pull_request` / `list_check_runs` 등을 직접 호출하고 raw payload 는 즉시 discard ([CLAUDE.md](../../CLAUDE.md) §4 driver 외부 API call 예외). 게이트 평가는 도구 path 무관(외부 fact 의 boolean 만이 기준).
- 단, sub-agent / cron fire 환경의 **MCP grant 는 fire 마다 unknown** 일 수 있다 ([CLAUDE.md](../../CLAUDE.md) §4 — "cron env 에서 sub-agent 환경의 MCP grant unknown"). 따라서 "MCP 가 항상 있다" 고 가정할 수 없다.

## Decision

### (1) cron pr-mode 외부 연산의 표준 = GitHub MCP 도구

cron 의 pr-mode 외부 연산은 **GitHub MCP 도구(`mcp__github__*`) 경로를 표준**으로 한다(gh CLI 비의존). 도구 매핑:

| 연산 | MCP 도구 |
| --- | --- |
| PR open | `mcp__github__create_pull_request` |
| reviewer comment post | `mcp__github__add_issue_comment` |
| CI conclusion 확인 | `mcp__github__list_check_runs` (ref=head_sha) |
| review comment 조회(게이트 2) | `mcp__github__list_issue_comments` |
| squash merge | `mcp__github__merge_pull_request` (merge_method=squash) |
| branch delete | `mcp__github__delete_branch` |

driver 는 raw MCP response 에서 핵심 결과(boolean / SHA / id 1~2개)만 남기고 raw payload 는 즉시 discard ([CLAUDE.md](../../CLAUDE.md) §4 self-enforce).

### (2) MCP 가용성 probe

cron driver 는 **pr-mode task 를 claim 하기 전** GitHub MCP 가용 여부를 가벼운 호출(예: `mcp__github__get_me` 또는 대상 repo 의 `list_check_runs` 1회)로 확인한다. 가용 → pr-mode 진행. 부재 → (3).

### (3) MCP 부재 시 graceful degradation

cron fire 에서 **gh·MCP 둘 다 부재**면:

- cron 은 그 pr-mode task 를 **claim 하지 않는다** (lock 을 잡았다면 즉시 해제).
- 대신 **direct task 를 우선** 처리하거나(현재 nextTask 가 direct 면), 적절한 direct 작업이 없으면 **stand down**(작업 없음으로 종료).
- 해당 pr-mode task 는 `nextTask` 로 유지되어 `/loop`(gh 보유 기기) 또는 MCP 가용한 다음 cron fire 가 집어간다.
- **BLOCKED 양산·draft/stale PR 생성 금지** — 과거 13 PR 잔재 반복을 차단한다. gh·MCP 부재는 BLOCKED(humanQuestion)가 아니라 **무해한 no-op 종료**로 처리한다(반복 systemic 조건이므로 사람 개입 불요).

### (4) `/loop`(로컬 기기)은 기존 path 유지

`/loop` 는 gh CLI 우선, 부재 시 MCP — [ADR-0005](ADR-0005-mcp-tools-for-pr-review-flow.md) Path 그대로. 로컬 Windows env 는 gh 가용하므로 변화 없음.

## Consequences

**장점**

- ADR-0009 결정 5(동일 역할)가 **MCP 가용 시 실제로 실현** — cron 도 pr-mode 를 머지까지 완주.
- **새 dependency 0** — gh CLI 를 cron 에 설치하지 않으므로 [CLAUDE.md](../../CLAUDE.md) §5 "새 dependency BLOCKED" 를 회피.
- **stale PR 양산 차단** — (3) graceful degradation 이 과거 13 PR 잔재 패턴을 구조적으로 막는다.

**비용 / 잔여**

- pr-mode claim 마다 MCP probe 1회 비용(가벼움).
- MCP grant 가 cron fire 마다 다를 수 있는 불확실성은 (3) 으로 흡수 — 단, MCP 가 자주 부재하면 cron 의 pr-mode throughput 이 0 에 수렴(그 경우 pr-mode 는 `/loop` 기기가 전담). 운영 점검 대상.
- 후속: [LOOP.md](../LOOP.md) §4 의 gh 명령에 MCP 대안 병기 + cron driver probe/degradation 분기 명세 강화(별도 direct task).

## Alternatives

- **(a) cron 에 gh CLI 설치** — 기각. [CLAUDE.md](../../CLAUDE.md) §5 "새 외부 dependency" 판정 + Anthropic 클라우드 fire 환경에 설치 영속 보장 불가(매 fire fresh). MCP path 가 install 0 으로 동등 기능.
- **(b) cron 을 direct-only 로 영구 제한** — 기각. ADR-0009 결정 5(역할 분리 없음)와 정면 충돌. MCP 가용 시 cron 이 pr-mode 를 할 수 있는데 영구 제한은 throughput 손해.
- **(c) 외부 CI 서비스/봇에 merge 위임** — 기각. 권한 모델 복잡 + 새 외부 의존 + 자동 merge 책임이 분산되어 4-게이트 추적성 저하.
