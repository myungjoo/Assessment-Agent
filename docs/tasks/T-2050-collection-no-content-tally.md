---
id: T-2050
title: 불완전 수집 저장 차단 ① — 빈 repo · issue 비활성 응답을 성공으로 세고 org 열거 실패를 tally 로 노출
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-039]
estimatedDiff: 110
estimatedFiles: 4
created: 2026-10-30
dependsOn: [T-2042]
touchesFiles: [src/assessment-collection/github-collection.service.ts, src/assessment-collection/github-collection.service.spec.ts, src/assessment-collection/github-org-repo-enumerate.service.ts, src/assessment-collection/github-org-repo-enumerate.service.spec.ts]
plannerNote: P7 · 오너 지시 — 불완전 수집 평가 저장 차단 arc ①, T-2051 의 판정 규칙이 쓸 입력 정비
---

# T-2050 — 수집 호출 tally 정확도

## Why

T-2051 은 수집 호출이 하나라도 실패한 좌표를 저장하지 않는다. 그런데 지금 tally 는 빈 repo 의 `commits` 409 와 issue 를 끈 repo 의 `issues` 410 을 실패로 센다 ([T-2042](T-2042-collection-blank-row-guard.md) Follow-ups 의 운영 영향). 이 둘은 영구 응답이라 그대로 두면 org 에 빈 repo 가 하나만 있어도 그 instance 인원 전원이 영원히 저장되지 않는다. 또 org 열거 실패는 반환값이 빈 배열이라 빈 org 와 구분되지 않는다.

## Required Reading

- `src/assessment-collection/github-collection.service.ts`, `github-org-repo-enumerate.service.ts`, `src/github/github-adapter.service.ts` `406~455 행`.

## Acceptance Criteria

- [ ] `commits` 409 · `issues` 410 (`GithubDomainError`) 은 tally 성공으로 센다. 다른 endpoint · status 조합은 실패다.
- [ ] `enumerateRepoSources` 가 선택 인자 tally 에 target 별 성공 · 실패를 센다. 기존 호출과 반환은 그대로다.
- [ ] R-112: happy · error · 분기 · 예외 분기 negative.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- 저장 판정 변경과 tally 소비 — T-2051.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) T-2051 이 `enumerateRepoSources` 의 tally 를 소비한다. 소비처까지 넣으면 `github-collection-spec.service.ts` · `collection-spec.service.ts` · `period-bridge-admin-persist.service.ts` · 그 spec 2 개를 더해 estimatedFiles 9 로 cap 을 넘는다.
