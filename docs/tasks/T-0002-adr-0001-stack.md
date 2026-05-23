---
id: T-0002
title: ADR-0001 stack 결정 박제 (NestJS / TypeScript / pnpm / Jest / GitHub Actions)
phase: P0
status: DONE
commitMode: pr
estimatedDiff: 80
estimatedFiles: 1
created: 2026-05-23
completedAt: 2026-05-23T20:48:00+09:00
mergedAs: 8c6defe
prNumber: 2
reviewRounds: 1
plannerNote: T-0001 split의 첫 task. 코드 작성 전 stack 결정을 ADR로 박제한다. T-0003~T-0005의 전제 문서.
dependsOn: []
blocks: [T-0003, T-0004, T-0005]
---

# T-0002 — ADR-0001 stack 결정 박제

## Why

[T-0001](T-0001-bootstrap-stack-and-ci.md) 의 1번 acceptance criterion이었던 부분을 단독 task로 분리.
이후 T-0003 (config) / T-0004 (src) / T-0005 (CI) 가 모두 이 ADR을 근거로 한다. 코드보다 결정 문서가 먼저(CLAUDE.md §1).

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) §1 (스택 확정 표), §11 (ADR 관련 commit-trail), §12 (언어 정책)
- [README.md](../../README.md) 88–93행 (성능 특성 — 너무 무거운 stack을 피하기 위함)
- [README.md](../../README.md) 106–116행 (CI / test 요구사항)
- 없음 (기존 ADR 없음, 본 ADR이 최초)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0001-stack.md` 파일이 존재하고 다음 frontmatter 를 가진다: `id: ADR-0001`, `status: ACCEPTED`, `date: 2026-05-23`, `relatedTask: T-0002`, `supersedes: null`.
- [ ] ADR 본문에 NestJS / TypeScript / pnpm / Jest / GitHub Actions 5가지 선택과 각각의 근거 (한국어) 가 1~2문단씩 기재된다.
- [ ] Alternatives 섹션에 최소 2개 이상 (예: Express + tsx, Fastify, npm, vitest 등) 후보와 기각 사유가 한국어로 기재된다.
- [ ] Consequences 섹션에 긍정·부정·중립 결과가 모두 기록된다 (CLAUDE.md §11 architect.md 의 ADR 템플릿 따름).
- [ ] DB / Frontend / 패키지 매니저 외 라이브러리 선택은 본 ADR 범위 밖으로 명시 (별도 ADR로).
- [ ] 단일 commit 으로 staged 된다.

## Out of Scope

- 실제 `package.json` 작성 — [T-0003](T-0003-project-config.md) 의 일.
- DB 선택 — 별도 ADR-0002 (Phase P2 진입 시).
- Frontend 선택 — 별도 ADR (Phase P5 직전).
- ADR INDEX 갱신 — INDEX 파일이 아직 없음. 첫 ADR이라 INDEX 도입은 후속 task.

## Suggested Sub-agents

`architect` → (코드 변경 없음이므로 `implementer`, `tester` 생략)

`architect` 가 ADR을 작성하고, executor 는 staging 후 driver 에게 trail 반환. tester 는 호출하지 않는다 (테스트 대상 코드가 없음).

## Follow-ups

(빈 칸 — 작업하면서 발견되는 후속 작업을 적기)
