---
id: T-0008
title: CI 에 pnpm test:cov 통합 + 최소 coverage threshold
phase: P0.5
status: PENDING
commitMode: pr
estimatedDiff: 50
estimatedFiles: 3
created: 2026-05-23
plannerNote: spec 파일이 있다고 해서 test 가 충실하다는 보장은 없다. T-0007 의 후속으로 line/branch coverage threshold 를 CI 게이트로 둔다. 처음엔 낮게 시작 (50%), 안정화되면 단계적 상향.
dependsOn: [T-0007]
blocks: []
---

# T-0008 — Coverage threshold 를 CI 게이트로

## Why

[T-0007](T-0007-ci-spec-presence-check.md) 가 spec 파일의 *존재* 를 강제하지만 *내용* 은 검증 안 한다. 빈 `describe.skip()` 으로도 통과한다.

본 task 는 jest 의 coverageThreshold 를 도입해 line / branch coverage 의 최소 비율을 CI 게이트로 둔다. coverage 가 threshold 미만이면 jest exit code non-zero → CI fail → merge 차단.

처음엔 낮게 시작 (50%) — 도메인 코드가 아직 거의 없는 상태에서 너무 높게 잡으면 false positive. 안정화되면 별도 ADR / task 로 상향.

## Required Reading

- `package.json` 의 jest 설정 (T-0006 patch 후)
- `.github/workflows/ci.yml` (T-0005 / T-0007 갱신 후)
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-112

## Acceptance Criteria

- [ ] `package.json` 의 jest 블록에 `coverageThreshold` 추가:
  - global: `{ branches: 50, functions: 50, lines: 50, statements: 50 }` (시작값).
  - 향후 단계적 상향은 별도 ADR/task.
- [ ] `package.json` 의 `test:cov` script 가 이미 정의됨 — 그대로 사용.
- [ ] `.github/workflows/ci.yml` 의 test step 을 `pnpm test:cov` 로 교체 (또는 별도 step 추가). step name 한국어 (예: `name: 테스트 + 커버리지 검사`).
- [ ] coverage 결과를 GitHub Actions artifact 로 업로드 (선택 — diff 검토용. 시간 / 복잡도 부담되면 skip 하고 follow-up 으로).
- [ ] **R-112 자체 test**: jest coverageThreshold 가 미달이면 `pnpm test:cov` 가 exit 1 인지 로컬에서 확인 — README / task body 에 검증 절차 한 단락.
- [ ] [README.md](../../README.md) 의 "로컬 빌드 / 테스트" 단락에 `pnpm test:cov` 사용법 한 줄 추가.
- [ ] 단일 commit, ≤300 LOC / ≤3 파일.

## Out of Scope

- 50% 초과의 threshold 상향 — 별도 ADR + task. 도메인 코드가 충분히 쌓인 후 (예: P2 끝나는 시점).
- per-file threshold (전역만, 처음엔).
- Codecov / Coveralls 등 외부 서비스 연동 — 별도 ADR.
- Mutation testing (stryker 등) — 장기 ADR.

## Suggested Sub-agents

`implementer` (package.json + ci.yml) → `tester` (R-112 자체 test + threshold 미달 시 fail 검증)

## Follow-ups

(빈 칸)
