---
id: T-0352
title: P6 frontend ↔ backend API 소비 계약 prep doc
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-038, REQ-042, REQ-048, REQ-044, REQ-045, REQ-046]
estimatedDiff: 175
estimatedFiles: 2
independentStream: p6-frontend
dependsOn: []
touchesFiles:
  - docs/architecture/frontend-api-contract.md
  - docs/architecture/INDEX.md
created: 2026-06-11
plannerNote: "Q-0035 = P6 진입. ADR-0040(stack) PROPOSED·사용자 검토 대기 중 dependency-free prep — stack flip 비의존 API 소비 계약 + gap 박제. 새 dep 0·backend 변경 0. doc-only."
---

# T-0352 — P6 frontend ↔ backend API 소비 계약 prep doc

## Why

Q-0035 RESOLVED — 사용자가 P6 frontend 진입을 선택했고, T-0351 이 [ADR-0040](../decisions/ADR-0040-frontend-stack.md) (Frontend stack: React+Vite SPA) 을 PROPOSED 로 작성했다. ADR-0040 의 실 frontend impl (scaffold·컴포넌트) 은 (a) ADR-0040 PROPOSED → ACCEPTED flip (사용자 검토) + (b) React/Vite 새 runtime dependency 승인 ([CLAUDE.md](../../CLAUDE.md) §5 BLOCKED 게이트) 의 **두 human 게이트** 뒤에 있다.

그 승인을 기다리는 동안 진행 가능한 **dependency-free prep** 으로, ADR-0040 §2 "SPA 는 기존 `/api/*` REST contract 의 순수 소비자" 결정을 화면 단위로 구체화한 소비 계약 문서를 박제한다. 이 prep 은 **새 dependency 0 · backend(`src/`) 변경 0 · ADR-0040 flip 비의존** — 어떤 SPA 든 같은 `/api/*` contract 를 소비하므로 stack 최종 결정과 무관하게 유효하다. P6 impl task 의 입력 (화면별 endpoint 맵 + 인증 소비 패턴 + backend 선행 gap) 을 미리 외화해 ACCEPTED 후 impl 의 re-derivation 비용을 줄인다.

## Required Reading

- [docs/decisions/ADR-0040-frontend-stack.md](../decisions/ADR-0040-frontend-stack.md) — §2 (NestJS 경계·순수 소비자) / §6 (R-78 frontend 책임)
- [docs/architecture/api.md](../architecture/api.md) — `/api/*` endpoint 표 (소비 대상 source-of-truth)
- [docs/PLAN.md](../PLAN.md) "Phase P6 — Web UI" (4 화면) + Phase P5/P7 (gap 의 backend 선행 phase)

## Acceptance Criteria

- [x] `docs/architecture/frontend-api-contract.md` 신설 — P6 4 화면별 소비 endpoint 맵 + 인증 cookie 소비 패턴 + R-78 배너 데이터 소스 + RBAC↔가시성 + backend 선행 gap 5종 박제.
- [x] 모든 endpoint 인용이 [api.md](../architecture/api.md) reality 와 일치 (허위 endpoint 0) — gap 항목은 "미구현/deferred" 로 명시 분리.
- [x] ADR-0040 flip 비의존성 명시 (stack 최종 결정과 무관하게 유효한 prep).
- [x] [docs/architecture/INDEX.md](../architecture/INDEX.md) 에 신 문서 등재.

## Out of Scope

- 화면 컴포넌트 트리 / 라우팅 / 상태관리·차트 라이브러리 선택 (ADR-0040 deferred).
- `web/` 실 scaffold / `directory.md` 갱신 (ADR-0040 ACCEPTED 후 별도 task).
- gap endpoint 의 실 backend 구현 (각 P5/P7 task).

## Follow-ups

- ADR-0040 PROPOSED → ACCEPTED flip (사용자 검토) 후: scaffold task chain (새 dep 승인 동반).
- gap 1 (평가 실행 상태 조회 endpoint) — R-78 배너의 hard dependency, P5/P7 backend task.

## Result

dependency-free prep doc 완성. ADR-0040 stack 승인 대기 중에도 P6 impl 입력을 미리 확보. 새 dependency 0 · backend 변경 0.

**전달 경로 메모**: 본 task 는 doc-only `direct` 이나, 본 작업이 수행된 web `/loop` 세션은 harness 가 branch `claude/loop-turn-cap-10-pmqggi` 에 고정해 main 직접 push 불가 → 변경을 해당 branch 로 push 후 draft PR 로 사용자 머지에 위임 (loop@cloud-82SQk / PR #237 선례 동형). 사용자의 "문서/코멘트 변경 = direct commit merge" 지시에 따라 PR 머지는 reviewer round 없이 진행 가능.
