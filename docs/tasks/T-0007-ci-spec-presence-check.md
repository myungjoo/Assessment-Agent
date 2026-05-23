---
id: T-0007
title: CI 에 "신규 production .ts → 대응 .spec.ts 필수" 검사 step 추가
phase: P0.5
status: DONE-WITH-CAVEAT
commitMode: pr
estimatedDiff: 80
estimatedFiles: 3
actualDiff: 117
actualFiles: 4
created: 2026-05-23
completedAt: 2026-05-24T01:12:00+09:00
prNumber: 8
mergedAs: d484955
mergedVia: driver-misroute-fast-forward (사고 — 의도된 squash merge 아님)
reviewRounds: 1
caveat: "PR-8 의 CI 가 GitHub Actions 인프라 이슈로 trigger 되지 않은 상태에서 driver=loop session #3 의 BLOCKED bookkeeping commit (1a0dbb9) 을 feature branch 에서 작성 후 `git push origin HEAD:main` 으로 main 에 push. 이때 d484955 (T-0007 code) 도 fast-forward 로 같이 들어가 GitHub 가 PR-8 을 자동 MERGED 처리. **T-0007 코드는 CI 검증 없이 main 에 박힌 상태.** 본 검사 스크립트의 self-test 는 로컬에서 5/5 pass 했으나 ubuntu CI 환경에서의 실제 검증은 다음 PR 의 trigger 가 정상 작동해야 사후 확인 가능."
plannerNote: README 112 / §3.2 R-112 의 "기능 + 예외 + flow + negative test 의무" 가 단순 문서 정책에 머무르지 않고 CI 게이트로 강제되도록 한다. reviewer / integrator 의 catch 누락 보호 layer.
dependsOn: [T-0005]
blocks: []
---

# T-0007 — CI 의 spec-presence 자동 검사

## Why

[T-0003](T-0003-project-config.md) 의 jest.roots 결함이 reviewer round 1 / integrator 양쪽을 통과한 사례 ([HQ-0002](../STATE.json) 참조) — 사람·LLM 의 검토만으로는 R-112 ("기능 / 예외 / flow / negative test") 의 충실 작성을 보장하기 어렵다.

본 task 는 가장 기초적인 자동 강제 layer 를 둔다: PR diff 에 새 production `.ts` 파일이 추가됐는데 대응 spec 이 같이 추가되지 않았으면 CI 가 fail.

이건 R-112 의 완전 강제는 아니다 (spec 의 *내용* 은 검증 안 함). 다만 spec 이 아예 없는 코드가 main 에 들어가는 일은 막는다.

## Required Reading

- `.github/workflows/ci.yml` (T-0005 가 채운 후의 상태)
- `package.json` (jest 설정)
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-112
- [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) (8 check 의 (4) 부분 — 본 task 가 그 자동화)

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 에 신규 step `spec-presence-check` 추가. step name 한국어 (예: `name: spec 파일 동반 여부 검사`).
- [ ] 본 step 의 동작:
  - `gh pr view <pr-num> --json files` 또는 `git diff --name-only origin/main...HEAD` 로 변경 파일 목록 획득.
  - 신규 추가된 `.ts` 파일 중 다음을 제외한 것들을 production 후보로 간주:
    - `*.spec.ts`, `*.test.ts`, `*.e2e-spec.ts`
    - `*/test/**`, `*/__tests__/**`
    - 경로에 `index.ts` 가 단독 re-export 만 하는 경우 (`grep -E "^(export|import) "` 만 통과)
    - `main.ts` (bootstrap entry point — 별도 e2e 가 cover)
  - 각 production 후보에 대해 같은 PR 안에 대응 spec 파일이 존재하는지 확인. 부재 시 step fail (exit 1) + 어떤 파일에 spec 이 없는지 한국어로 echo.
- [ ] step 자체에 대한 **자체 test (R-112)** 작성. shell script 라면 bats 또는 간단한 shell smoke test, JS/TS 라면 jest spec:
  - **happy**: production 파일과 spec 이 모두 있을 때 step 이 exit 0.
  - **error**: production 파일이 있는데 spec 이 없을 때 step 이 exit 1.
  - **branch**: 제외 패턴 (`main.ts`, index re-export, `*.spec.ts` 자체) 이 정상적으로 제외됨.
  - **negative**: spec 만 있고 production 이 없는 경우는 통과 (test 추가는 자유).
  - **regression**: T-0003 에서 spec 없이 들어간 케이스 시뮬레이션 — fail 해야 함.
- [ ] README 끝의 "로컬 빌드 / 테스트" 단락 (T-0005 가 추가) 에 본 검사를 로컬에서 흉내내는 명령 한 줄 추가.
- [ ] 단일 commit, ≤300 LOC / ≤5 파일.

## Out of Scope

- spec 의 *내용* (quality / coverage) 검증 — T-0008 에서.
- Mutation testing — 별도 ADR 필요 (장기).
- Frontend / web 의 spec presence — Phase P5 의 frontend 도입 시 별도 task.
- TypeScript / JS 외 언어 — 본 프로젝트는 TS 전용이라 무관.

## Suggested Sub-agents

`implementer` (ci.yml step + 검사 script + README 단락) → `tester` (R-112 4종 + regression 자체 test 작성·실행)

## Follow-ups

(빈 칸)

## Blocker

- reason: ci-trigger-missing
- humanQuestion: HQ-0003
- prNumber: 8 (OPEN, reviewer round 1/7 APPROVE, MINOR=1)
- 한 줄 요약: GitHub Actions 가 PR head sha `d4849556` 에 대해 35분+ trigger 안 함 (close/reopen 재시도 후에도 workflow_runs=0; main 의 직전 run 은 정상이므로 본 PR sha 만 누락).
