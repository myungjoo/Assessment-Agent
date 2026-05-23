---
id: T-0001
title: ADR-0001 stack 결정 + NestJS 프로젝트 골격 + 기본 CI
phase: P0
status: PENDING
commitMode: pr
estimatedDiff: 250
estimatedFiles: 5
created: 2026-05-23
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

(빈 칸 — 작업하면서 발견되는 후속 작업은 여기에 적기)
