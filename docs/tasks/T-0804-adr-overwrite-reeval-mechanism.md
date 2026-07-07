---
id: T-0804
title: ADR — overwrite / 이미 영속화된 평가문 재평가 mechanism 결정 (first-write-wins supersede)
phase: P5
status: DONE
completedAt: 2026-07-07T06:12:00Z
result: ADR-0053 ACCEPTED (overwrite/재평가 mechanism — 명시 mode reset-and-recreate 재사용, ADR-0037 §D3 조건분기 supersede, schema 0). PR #718 round1 4-게이트 PASS, squash merge 667ad68c.
commitMode: pr
coversReq: [REQ-037, REQ-041, REQ-064]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-07
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0053-overwrite-reeval-mechanism.md
independentStream: p5-overwrite-reeval
plannerNote: "P5 line 107 overwrite/재평가 DEFERRED 해제(Q-0051 옵션5) — ADR-first: replace-existing semantics + ADR-0037 §D3 first-write-wins supersede 결정만, 코드 0"
---

# T-0804 — ADR: overwrite / 이미 영속화된 평가문 재평가 mechanism

## Why

오너가 2026-07-07 Q-0051 에서 PLAN line 107 "(DEFERRED) overwrite / 이미 영속화된 평가문 재평가" 의 DEFERRED 를 해제하고 재개를 승인했다 (권장 착수 1순위 = 옵션 5). 본 vein 은 **ADR 선행** 이 명시된 방향 — Q-0032 로 확정됐던 first-write-wins v1 결정 ([ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Decision 3) 을 해제하고, 이미 영속화된 좌표 `(personId, period, scope, periodStart)` 에 대해 **덮어쓰기/재평가** 를 어떻게 표현할지의 mechanism 을 결정한다. 본 task 는 그 결정 ADR 을 작성하는 **decision-only** slice 이며, 구현 코드·DB migration 은 후속 task 로 분해된다 (Follow-ups).

## Required Reading

- [docs/PLAN.md](../PLAN.md) line 107 (본 bullet 의 DEFERRED 해제 annotation + Q-0051 오너 승인)
- [docs/decisions/ADR-0037-period-collection-evaluate-bridge.md](../decisions/ADR-0037-period-collection-evaluate-bridge.md) — §Decision 3 (first-write-wins read-through, 본 ADR 이 supersede 할 대상) + §Follow-ups slice 3/5 (좌표 중복 호출 = 기존 반환 계약)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) — §Decision 3 (Assessment 단위 reset-and-recreate + fill/reeval 모드 분기 + partial-reset semantics, `@@unique([personId, period, scope, periodStart])` 재사용) — 재평가 write semantics 의 이미-박제된 source
- [docs/decisions/ADR-0048-default-model-id-source.md](../decisions/ADR-0048-default-model-id-source.md) — §Decision 1/2 (재평가 시 modelId source = `LlmProviderConfig` row, 다중-row default 정책 deferred) — 재평가 mechanism 과의 상호작용 지점
- [docs/STATE.json](../STATE.json) humanQuestions[id=Q-0051].decision (5) — 오너 승인 세부

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0053-overwrite-reeval-mechanism.md` 신설 (frontmatter: id ADR-0053, title, status `PROPOSED`, date, relatedTask [T-0804], relatedReq [REQ-037, REQ-041, REQ-064], supersedes/augments 명시). 표준 ADR 구조 — **Context / Decision / Consequences / Alternatives considered / References / Follow-ups** 5 섹션 모두 포함.
- [ ] **Context**: Q-0051 옵션 5 오너 승인 배경 + 현재 first-write-wins (ADR-0037 §D3) 가 왜 overwrite 를 막는지 + ADR-0033 §D3 reeval semantics 가 이미 write-layer 에 존재한다는 핵심 사실 (bridge 진입점만 first-write-wins 로 막고 있음) 을 박제.
- [ ] **Decision**: 다음을 명시 결정 — (1) **replace-existing semantics** — 이미 영속화된 좌표에 재평가가 들어올 때 ADR-0033 §D3 의 reset-and-recreate (delete-if-exists → create, 단일 `$transaction`) 를 재사용할지 여부와 진입 경로. (2) **idempotency 경계** — overwrite 모드에서 같은 입력 재실행 시 row 수 불변 보장 (ADR-0033 idempotency key 재사용). (3) **partial reset 경계** — `personId`+`period` prefix 부분 재평가 시 다른 좌표 보존 규칙. (4) **ADR-0037 §Decision 3 supersede 관계** — first-write-wins read-through 를 어떻게 대체/조건분기 (예: 명시 `mode: reeval|overwrite` flag 시에만 write, 무플래그 default 는 여전히 first-write-wins read-through 보존인지) 하는지 명시. (5) **ADR-0048 defaultModelId source 상호작용** — 재평가 시 modelId 를 `LlmProviderConfig` row 에서 재해석하는지 명시.
- [ ] **§5 schema 게이트 처리**: 본 ADR 결정이 **DB schema 변경을 요구하는지 판정**. 요구하지 않으면 "새 schema migration 0 — ADR-0033 의 기존 `@@unique` + reset-and-recreate 재사용" 을 명시 박제. **schema 변경이 필요하다고 판단되면** 본 ADR 은 decision-only 를 유지하되 그 변경을 CLAUDE.md §5 게이트로 flag 하고 "구현 task 진입 시 재확인" 을 §Consequences 에 명시 (본 task 에서 migration 을 만들지 않음).
- [ ] **Consequences**: 긍정 / 부정·trade-off / Cross-Module Impact 3 소절. versioning 미채택 시 이력 미보존 risk 재확인 (ADR-0033 §Alternatives B homolog).
- [ ] **Alternatives considered**: 최소 2 안 미채택 근거 (예: A. versioning append 안, B. in-place update 안 — Assessment immutable 과 충돌).
- [ ] **Follow-ups**: 본 ADR 이 unblock 하는 실제 overwrite/reeval 구현 task 를 dependency-free chain 으로 나열 (bridge 진입점 overwrite 분기 slice / e2e idempotency slice / PLAN line 107 status sync direct slice 등). 각 slice 는 checkbox `[ ]` + ≤300 LOC / ≤5 파일 + R-112 명시.
- [ ] 본 task 는 **코드·DB migration·PLAN status 변경 0** — ADR 파일 1 개만 생성 (PLAN line 107 status 갱신은 별도 direct follow-up task).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 확인 (ADR 은 doc 이나 pr-mode 이므로 tester 가 CI green 확인 — production code 변경 0 이어도 R-110 준수).

> 본 task 는 ADR (doc) task 이므로 R-112 unit test 4 종은 **적용 대상 코드 0 → 생략** (분기 있는 production code 없음). tester 는 CI 의 lint/build/test 가 ADR 추가로 깨지지 않는지만 확인.

## Out of Scope

- overwrite/reeval **구현 코드** (bridge 진입점 분기, write service overwrite 모드, orchestrator/controller wiring) — 전부 Follow-ups 후속 task 로 defer.
- **DB schema migration** — 본 ADR 이 schema 변경 필요 여부를 판정만 하고, 실제 migration SQL 은 만들지 않는다 (필요 시 §5 게이트로 flag → 구현 task 진입 시 재확인).
- **PLAN.md line 107 status 갱신** ([ ] → 진행/완료 표기) — 별도 `commitMode: direct` follow-up task (본 ADR 은 pr-mode 라 direct doc 변경과 mixed chain 금지, CLAUDE.md §3.1 rule 3).
- ADR-0037 / ADR-0033 / ADR-0048 **본문 수정** — 본 ADR 은 supersede 관계를 신설 ADR 에서 선언만, 대상 ADR 의 status/본문 amend 는 하지 않는다 (필요 시 후속).
- Summary 영속화 overwrite / P7 Scheduler / P6 frontend ReEvaluationTriggerPanel 배선 — 전부 별도 vein.

## Suggested Sub-agents

`architect → tester` — architect 가 ADR 을 PROPOSE (Q-0051 옵션 5 오너 결정을 mechanism 으로 박제), tester 가 CI green (lint/build/test 무손상) 확인.

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 여기 append. 참고: 본 ADR 자체의 Follow-ups 는 ADR 파일 안 §Follow-ups 에 실제 구현 chain 으로 박제된다.)
