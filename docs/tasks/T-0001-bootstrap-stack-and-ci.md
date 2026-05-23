---
id: T-0001
title: ADR-0001 stack 결정 + NestJS 프로젝트 골격 + 기본 CI
phase: P0
status: SUPERSEDED
commitMode: pr
estimatedDiff: 250
estimatedFiles: 5
created: 2026-05-23
supersededBy: [T-0002, T-0003, T-0004, T-0005]
supersededAt: 2026-05-23
---

# T-0001 — ADR-0001 stack 결정 + NestJS 프로젝트 골격 + 기본 CI

## Why

자동 루프가 작동하려면 기본적인 빌드/테스트/CI 토대가 있어야 한다.
[CLAUDE.md](../../CLAUDE.md) §1 에서 확정한 스택(Node.js + NestJS + TypeScript + pnpm + Jest + GitHub Actions)을 ADR-0001로 박제하고, "비어있지만 통과하는" NestJS 프로젝트와 CI를 만든다.

[PLAN.md](../PLAN.md) Phase P0 의 유일한 task다. 이게 끝나야 P1(use case 분해)로 진입할 수 있다.

## Required Reading

- [README.md](../../README.md) 88–93행 (성능 특성 — 너무 무거운 stack 선택을 피하기 위함)
- [README.md](../../README.md) 106–116행 (구현 과정 제약 — test, CI 요구사항)
- [CLAUDE.md](../../CLAUDE.md) §1, §3, §8
- 없음 (NestJS 처음 도입이므로 기존 코드 없음)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0001-stack.md` 가 존재하고 status: ACCEPTED, NestJS / TypeScript / pnpm / Jest / GitHub Actions 선택과 근거가 기록되어 있다.
- [ ] `package.json` 이 존재하고 `pnpm install` 이 lockfile을 생성한다.
- [ ] `pnpm build` 가 성공한다 (`tsc -p tsconfig.build.json` 또는 nest build).
- [ ] `pnpm test` 가 성공한다 (적어도 1개의 sanity test: `1+1===2` 수준이라도).
- [ ] `pnpm lint` 가 성공한다 (eslint 기본 셋팅).
- [ ] `.github/workflows/ci.yml` 이 PR/푸시에서 lint·build·test 를 모두 돌린다.
- [ ] `.gitignore` 에 `node_modules/`, `dist/`, `coverage/`, `.env*` 가 포함된다.
- [ ] README에 위 명령어 (`pnpm install/build/test/lint`) 사용법 한 단락이 추가된다.
- [ ] 위 모든 것이 단일 commit으로 staged 되어있다 (CLAUDE.md §3).

## Out of Scope

- 실제 도메인 코드 (Assessment, User, GitHub integration 등) — Phase P1 이후
- DB 연결 / Prisma / TypeORM 설치 — ADR-0002 이후
- Frontend (React/Vite 등) — 별도 ADR 후
- Docker / Dockerfile
- E2E test 인프라 (smoke만 OK, e2e는 별도 task)
- 신규 라이브러리 추가 (NestJS 기본 세트 외) — CLAUDE.md §5 BLOCKED

## Suggested Sub-agents

`architect` (ADR-0001 작성) → `implementer` (프로젝트 골격 + CI) → `tester` (sanity test 1개 + suite 실행)

## Follow-ups

- driver/planner 정책 보강: humanQuestion 의 `decision` 값을 보고 planner가 자동으로 split task들을 생성하도록 planner.md 확장. 현재는 사람이 수동으로 split task 파일들을 작성. (`docs/tasks/T-0001` 의 split은 사람이 직접 수행했다.)
- size cap 자체의 적정성 재검토: 단일 commit 기준 ≤300 LOC / ≤5 파일이 부트스트랩성·CI workflow 추가성 task에는 빠듯할 수 있음. 별도 ADR로 task type별 cap 정의 가능성 검토.

## Resolution (2026-05-23)

- HQ-0001 결정: **split** (사용자 결정 A 선택).
- 본 task는 SUPERSEDED. 다음 4개 task로 대체:
  - [T-0002](T-0002-adr-0001-stack.md) — ADR-0001 stack 결정 (NestJS / TS / pnpm / Jest / GitHub Actions)
  - [T-0003](T-0003-project-config.md) — pnpm + tsconfig + lint + .gitignore base config
  - [T-0004](T-0004-nestjs-skeleton-and-sanity-test.md) — NestJS minimal src skeleton + 첫 sanity test
  - [T-0005](T-0005-ci-workflow.md) — GitHub Actions CI workflow + README 명령어 단락
- 의존성 chain: T-0002 → T-0003 → T-0004 → T-0005.
- driver의 직전 시도 작업물: `git stash apply stash@{0}` 으로 복구 가능. 다만 4개 task로 잘리면서 file별로 적절한 task에 흩어져야 하므로, 각 task의 implementer는 stash를 reference로만 활용하고 처음부터 새로 작성하는 것이 안전하다. stash는 후속 task가 모두 끝난 뒤 `git stash drop stash@{0}` 으로 정리한다.
