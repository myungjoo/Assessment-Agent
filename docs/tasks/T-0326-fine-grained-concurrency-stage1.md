---
id: T-0326
title: ADR-0036 fine-grained concurrency rollout stage 1 — flags 자리 박제 + planner 독립-stream 분해 정책
phase: P5
status: DONE
commitMode: direct
coversReq: [TBD]
estimatedDiff: 90
estimatedFiles: 3
created: 2026-06-10
independentStream: stage1-fine-grained
dependsOn: []
touchesFiles: [docs/STATE.json, .claude/agents/planner.md, docs/PLAN.md]
plannerNote: "ADR-0036 §rollout stage 1(direct) — flags.fineGrainedConcurrency 자리 + planner 독립-stream 분해 정책. 사용자 2026-06-10 rollout 승인. forward-looking, 토글 OFF."
---

# T-0326 — ADR-0036 fine-grained concurrency rollout stage 1 (flags 자리 + planner 독립-stream 분해 정책)

## Why

사용자가 2026-06-10 ADR-0036 fine-grained concurrency(critical-section-only lock + claim 기반 task 소유, driver=2 동시 진행) rollout 시작을 승인 — stage 1(flags 자리 + planner 독립-stream 분해 정책) 큐잉 지시. cron driver 가 stale lock 탈취 후 큐잉.

ADR-0036 §rollout 1 은 (a) `flags.fineGrainedConcurrency` 자리 박제(ADR-0020 multiTaskFire 선례 mirror)와 (b) planner 가 task 생성 시 동시 claimable 한 독립 task 를 frontmatter(`independentStream`/`dependsOn`/`touchesFiles`)로 사전 인코딩하는 정책 명문화를 묶는다. 본 stage 의 break-even 은 "한 시점 독립 task ≥ 2 실증" 이며, 그 전까지 §Decision 0 상 throughput 이득 0 이므로 stage 2(claim registry) 진입은 보류한다. 본 task 는 forward-looking spec 만 박제 — driver 동작은 바뀌지 않는다(토글 OFF).

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md (특히 §Decision 0, §rollout 1)
- docs/STATE.json (`flags` 객체 — 현재 `multiTaskFire: true` 만 존재)
- .claude/agents/planner.md (특히 "coversReq frontmatter 룰" §, 새 정책을 그 뒤에 추가)
- docs/PLAN.md (운영 정책 review backlog §142~149 — ADR-0036 rollout 추적 한 줄 추가 + T-0325 보존 메모)

## Acceptance Criteria

- [ ] docs/STATE.json 의 `flags` 객체에 `fineGrainedConcurrency: false` 필드를 자리-박제한다(ADR-0020 multiTaskFire 선례 mirror). 기본값 `false`. 기존 `multiTaskFire: true` 는 보존.
- [ ] .claude/agents/planner.md 에 **"독립-stream 분해 정책 (ADR-0036 stage 1)"** § 를 신설하여 다음을 명문화한다:
  - task frontmatter 에 `independentStream: <id>`, `dependsOn: [T-...]`, `touchesFiles: [...]` 3 필드를 도입한다.
  - **동시 claimable 조건** — (a) 파일-disjoint(두 task 의 `touchesFiles` 가 겹치지 않음, 특히 `src/`), (b) 의존성 없음(`dependsOn` 의 모든 task 가 머지됨), (c) 같은 `commitMode` 권장. 셋 모두 충족한 task 만 동시 claim 허용.
  - planner 는 task 생성 시 위 3 필드를 박제해 동시성 안전을 **큐잉 단계에서 사전 인코딩**한다(런타임 충돌 탐지 대신 큐잉 단계 회피).
- [ ] 같은 § 에 **break-even gate** 를 명시한다: "한 시점 독립 task ≥ 2 가 실증되기 전까지 stage 2(claim registry 구현) 진입 보류"(ADR-0036 §Status / §Decision 0 그대로). stage 1 은 `flags.fineGrainedConcurrency` 를 켜지 않으며 driver 동작을 바꾸지 않는다(forward-looking spec). 토글 ON 은 stage 5.
- [ ] docs/PLAN.md 운영 정책 review backlog 에 ADR-0036 fine-grained concurrency staged rollout 추적 항목 한 줄을 추가한다(stage 1 진행 중, stage 2~5 보류 + break-even 조건 명시).
- [ ] 분기 없음(doc/STATE schema 박제만) — R-112 happy/error/branch/negative test 항목은 코드 변경 0 이라 생략(direct doc-only commit, CLAUDE.md §3.2 R-110 면제).

## Out of Scope

- claim registry schema(`claims.json`) / select+claim critical-section 구현 — stage 2(pr).
- §1 driver loop 재작성 + CLAUDE §10 / LOOP §4 동기 — stage 3(direct).
- `.github` per-PR concurrency group — stage 4(pr).
- `flags.fineGrainedConcurrency = true` 토글 ON — stage 5(direct).
- `src/`, `web/`, `test/`, CI workflow, package.json 변경 일체 금지(본 task 는 doc/STATE 만).

## Suggested Sub-agents

implementer (direct doc/STATE 편집만 — architect/tester 불요, 코드 변경 0).

## Follow-ups

- stage 2 (pr): claim registry schema + select+claim critical-section 구현 — break-even(독립 task ≥ 2 실증) 충족 후.
- stage 3 (direct): §1 loop 재작성 + CLAUDE §10 / LOOP §4 동기.
- stage 4 (pr): `.github` per-PR concurrency group.
- stage 5 (direct): `flags.fineGrainedConcurrency = true` 토글(1~4 머지 + 30일 dogfood 후).
