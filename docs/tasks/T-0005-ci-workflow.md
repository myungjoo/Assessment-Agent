---
id: T-0005
title: GitHub Actions CI workflow + README 명령어 단락
phase: P0
status: PENDING
commitMode: pr
estimatedDiff: 80
estimatedFiles: 2
created: 2026-05-23
plannerNote: T-0001 split의 마지막 task. lint/build/test 를 자동 실행하는 CI 와 사용자용 명령어 안내. Phase P0 완료의 마무리.
dependsOn: [T-0004]
blocks: []
---

# T-0005 — GitHub Actions CI workflow + README 명령어 단락

## Why

[T-0004](T-0004-nestjs-skeleton-and-sanity-test.md) 까지 끝나면 `pnpm build`·`pnpm test`·`pnpm lint` 가 로컬에서 통과한다. 본 task 가 이를 GitHub Actions 로 자동화하여, 모든 PR 과 main push 마다 검증되도록 한다.

이게 끝나면 Phase P0 완료 — LOOP.md §1 [5] CI 검증 단계가 진짜로 동작하기 시작하고, driver 가 안전하게 long-horizon 으로 진입할 수 있다.

## Required Reading

- [T-0003](T-0003-project-config.md) 의 acceptance criteria (사용 가능한 pnpm script 들)
- [T-0004](T-0004-nestjs-skeleton-and-sanity-test.md) 의 acceptance criteria
- [README.md](../../README.md) 110–114행 (CI 통한 자동 실행 요구사항)
- [CLAUDE.md](../../CLAUDE.md) §11 (commit-trail CI 연계), §12 (README 단락 한국어)
- 없음 (기존 CI workflow 없음)

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 존재. 다음 trigger: `push` (모든 branch), `pull_request` (target: main).
- [ ] job 이름 `ci`. runs-on `ubuntu-latest`. Node 버전은 `package.json` 의 `packageManager` / `engines` 와 일치 (LTS 22 또는 그 시점 LTS).
- [ ] step 순서: checkout → setup pnpm → setup-node with cache: 'pnpm' → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm build` → `pnpm test`.
- [ ] 각 step 이름은 한국어로 (예: `name: "의존성 설치"`). action 이름·flag 는 영어 유지 (§12).
- [ ] PR 에서 CI 가 실패하면 reviewer 점검 전에 명확히 보이도록 default branch protection 가정 (실제 protection rule 설정은 사람이 GitHub UI 에서 — 본 task 의 일이 아님; 단 README 에 한 줄 안내).
- [ ] [README.md](../../README.md) 끝에 새 섹션 (예: `# 로컬 빌드 / 테스트`) 한 단락 추가: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint` 사용법 한국어로 한 줄씩.
- [ ] 단일 commit 으로 staged 된다 (2 파일).

## Out of Scope

- main branch protection rule 설정 — GitHub UI 작업이라 본 task 범위 밖. README 에 안내 한 줄로 갈음.
- E2E 테스트 (`pnpm test:e2e`) — 별도 task (Phase P1 또는 P0.5).
- Coverage 리포트 / Codecov 업로드 — 별도 task.
- 다중 Node 버전 matrix — LTS 1개로 충분 (필요 시 후속 ADR).
- Cache 최적화 (Turbo, Nx 같은 추가 도구) — 후속 task.

## Suggested Sub-agents

`implementer` (ci.yml 작성, README 단락 추가) → `tester` (없음 — workflow 자체는 push 후 GitHub Actions 가 검증. 단, yamllint / actionlint 가 있으면 로컬 정합성 체크는 유익하나 새 dev dependency 가 되므로 본 task 에서는 건너뛴다)

본 task 의 push 직후 CI 가 처음으로 실제 동작. driver 의 LOOP.md §1 [5] 검증이 의미 있는 결과를 받기 시작.

## Follow-ups

- main branch protection rule 설정 안내 follow-up (사람 작업) — 본 task 끝나고 사용자에게 안내.
- `actionlint` / `yamllint` 도입 ADR — 새 dev dep 1개로 GitHub Actions YAML 정합성을 PR 단계에서 잡을 수 있음.
- E2E / coverage / multi-Node matrix 등은 Phase P0.5 또는 P1 초반에 planner 가 검토.
