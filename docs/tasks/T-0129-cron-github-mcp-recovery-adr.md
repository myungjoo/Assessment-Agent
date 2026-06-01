---
id: T-0129
title: "cron 환경 GitHub MCP 경로로 pr-mode 완주 보장 ADR (ADR-0010)"
phase: P3
status: PENDING
commitMode: pr
coversReq: []
estimatedDiff: 130
estimatedFiles: 1
created: 2026-06-01
dependsOn: [T-0126]
plannerNote: "ADR-0009 결정 5(역할 분리 없음)의 전제 — cron 클라우드는 gh CLI 부재(HQ-0006/8/9/10/13 5+회)라 pr-mode 를 머지까지 완주 못 함. 본 ADR 이 cron pr-mode 를 GitHub MCP(mcp__github__*) 경로로 확정(ADR-0005 Path A 연장) + MCP 부재 시 graceful degradation(pr-mode 미claim, direct 우선/stand down) 결정. 신규 ADR → pr-mode."
---

# T-0129 — cron 환경 GitHub MCP 경로로 pr-mode 완주 보장 ADR

## Why

[ADR-0009](../decisions/ADR-0009-strong-ref-cas-lock.md) 결정 5 는 cron 과 `/loop` 의 **역할 분리 없음**(동일 task 후보)을 정했으나, 그 전제로 "cron 클라우드가 pr-mode 를 머지까지 완주할 수 있어야 함" 을 별도 ADR 로 미뤘다. 현실 제약: cron 은 Anthropic 클라우드에서 발화되며 **`gh` CLI 가 부재**(`which gh` exit 1)다 — HQ-0006/8/9/10/13 로 5회 이상 재발한 systemic breakage. gh 부재 시 cron 은 PR open / reviewer comment post / squash merge 를 수행 못 해 pr-mode task 에서 BLOCKED 되거나 stale PR 을 양산한다(T-0098 의 13 PR cleanup 이 그 잔재였다).

[ADR-0005](../decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) 가 이미 PR review flow 를 gh / GitHub MCP unified 로 정당화했다(driver 가 `mcp__github__add_issue_comment` / `merge_pull_request` / `list_check_runs` 등 직접 호출). 본 ADR 은 그 Path 를 **cron pr-mode 완주의 표준**으로 확정하고, MCP 마저 부재한 cron fire 의 **graceful degradation** 을 결정한다.

신규 architecture/운영 결정 → `commitMode: pr`([CLAUDE.md](../../CLAUDE.md) §3.1 rule 4).

## Required Reading

- `docs/tasks/T-0129-cron-github-mcp-recovery-adr.md` (본 파일)
- `docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md` — gh/MCP unified Path A 박제 (본 ADR 의 토대)
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` — 결정 5(역할 분리 없음)의 전제로 본 ADR 예고
- `CLAUDE.md` §4 (driver 외부 API call 예외 — MCP 직접 호출 + raw payload discard) + §5 (새 dependency BLOCKED)
- `docs/LOOP.md` §4 (gh 호출 지점 — PR open / comment / merge)

## Acceptance Criteria

- [ ] **`docs/decisions/ADR-0010-cron-github-mcp-pr-mode.md` 신설** (Status / Context / Decision / Consequences / Alternatives). 본문 한국어.
- [ ] **Status** = ACCEPTED (운영 결정, 즉시 적용 — gh→MCP 는 ADR-0005 가 이미 도구 path 정당화, 본 ADR 은 cron 적용 확정).
- [ ] **Context** — cron 클라우드 gh 부재(HQ-0006/8/9/10/13) + ADR-0009 결정 5 전제 + ADR-0005 Path 토대.
- [ ] **Decision** 명문화:
  - [ ] (1) cron 의 pr-mode 외부 연산(PR open / reviewer comment post / CI 확인 / squash merge / branch delete)은 **GitHub MCP 도구(`mcp__github__*`) 경로**를 표준으로 한다(gh CLI 비의존). 도구 매핑 명시(open=`create_pull_request`, comment=`add_issue_comment`, checks=`list_check_runs`, merge=`merge_pull_request`, delete=`delete_branch`).
  - [ ] (2) **MCP 가용성 probe** — cron driver 는 pr-mode task 를 claim 하기 전 GitHub MCP 가용 여부를 가벼운 호출로 확인. 가용 → pr-mode 진행. 부재 → 아래 (3).
  - [ ] (3) **graceful degradation** — cron fire 에서 gh·MCP 둘 다 부재면 cron 은 pr-mode task 를 claim 하지 않는다(lock 즉시 해제). 대신 direct task 우선 처리 또는 stand down(작업 없음 종료). pr-mode task 는 `/loop`(gh 보유 기기) 또는 MCP 가용 cron fire 가 집어가도록 nextTask 유지. **BLOCKED 양산·stale PR 생성 금지**(과거 13 PR 잔재 반복 차단).
  - [ ] (4) `/loop`(로컬 기기)은 gh CLI 우선, 부재 시 MCP — 기존 ADR-0005 Path 유지.
- [ ] **Consequences** — ADR-0009 결정 5(동일 역할)가 MCP 가용 시 실현 / cron 의존성 0(새 install 불요로 §5 BLOCKED 회피) / probe 비용 / MCP grant 가 cron fire 마다 다를 수 있는 불확실성은 (3) degradation 으로 흡수.
- [ ] **Alternatives** — (a) cron 에 gh CLI 설치(§5 새 dependency + 클라우드 설치 보장 불가 — 기각), (b) cron 을 direct-only 로 영구 제한(ADR-0009 결정 5 역할무분리와 충돌 — 기각), (c) 외부 CI 서비스로 merge 위임(복잡도/권한 — 기각).
- [ ] doc-only ADR — production code 0. `commitMode: pr` (reviewer 점검). tester 는 lint/build/test/smoke/e2e green 확인(R-110).
- [ ] CI 전 step green + reviewer 4-게이트 PASS.

## Out of Scope

- **LOOP.md §4 의 gh→MCP 도구 매핑 실제 치환 개정** — ADR 머지 후 별도 direct task(LOOP.md §4 의 gh 명령을 MCP 대안과 병기). 본 task 는 결정만.
- **MCP probe 헬퍼 / cron prompt 분기 코드** — 별도 task.
- **gh CLI 를 cron 에 설치** — 기각된 대안(§5). 시도 0.
- **production code / src 변경** — 0.

## Suggested Sub-agents

`architect`(ADR 1건) → `tester`(코드 0 이나 R-110 green 확인). implementer 미호출.

## Follow-ups

- (planner 예약) LOOP.md §4 gh→MCP 도구 매핑 병기 개정 — direct.
- (planner 예약) cron driver MCP probe + graceful degradation 분기 명세 강화 — direct.
