---
id: T-0879
title: perf-spec 스위트 empty-suite silent-pass 가드 (passWithNoTests 제거)
phase: P8
status: DONE
completedAt: 2026-07-10T05:52:00Z
resultSummary: "PR #773 merged (squash b1683f4b). jest-perf.json passWithNoTests 제거 + README gating 1줄. positive gate 31 suite/209 green, negative gate exit 1(silent-pass 제거). reviewer APPROVE r1/7, 4-게이트 PASS. +2/-2 · 2 files. counters→871."
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: [T-0878]
touchesFiles: [test/perf/jest-perf.json, README.md]
plannerNote: P8 §5 #4 perf-gating — T-0878 이 test:perf 를 CI 배선한 직후, jest-perf.json passWithNoTests:true 제거로 empty-suite silent-pass 가드 (PR #772 MINOR closure)
---

# T-0879 — perf-spec 스위트 empty-suite silent-pass 가드 (passWithNoTests 제거)

## Why

T-0878(PR #772)이 `.github/workflows/ci.yml` 에 `pnpm test:perf` step 을 배선해 perf-spec 스위트가 CI 에서 자동 실행되도록 했다. 그러나 `test/perf/jest-perf.json` 의 `passWithNoTests: true` 때문에, 만약 perf-spec 파일이 실수로 전부 rename/삭제되거나 `testRegex` 가 아무 파일도 매칭하지 못하면 jest 가 test 0개로도 **green 을 반환**한다 — perf-gating 이 조용히 무력화되는 구멍(PR #772 리뷰에서 flag 된 non-blocking MINOR). 본 task 는 이 flag 를 제거해 perf-spec 부재 시 CI 가 fail 하도록 한다. P8 load-resilience-test-plan §5 #4(perf 측정 CI enforce)의 gating 완결 slice.

## Required Reading

- `test/perf/jest-perf.json` — 제거 대상 `passWithNoTests: true` 를 포함한 jest 설정 (변경 대상)
- `.github/workflows/ci.yml` (196~205행 부근, `test:perf` step) — CI 배선 확인용 (변경 없음, 컨텍스트)
- `package.json` (`"test:perf"` script 정의) — 실행 커맨드 확인용 (변경 없음)
- `README.md` (perf-spec / 측정 harness 언급 절) — gating 문구 동기화 대상

## Acceptance Criteria

- [ ] `test/perf/jest-perf.json` 에서 `passWithNoTests: true` 항목을 제거(또는 명시적으로 `false`)한다. 나머지 필드(`testRegex`, `maxWorkers` 등)는 불변.
- [ ] 현재 31개 perf-spec 이 존재하는 상태에서 `pnpm test:perf` 가 여전히 green (perf-spec 매칭·실행되어 test count > 0). 커맨드로 검증: `pnpm test:perf`.
- [ ] **Negative gate 검증**: perf-spec 이 하나도 매칭되지 않는 상황(예: 존재하지 않는 임시 `--testPathPattern`)에서 jest 가 exit code 1(fail)을 반환함을 수동/일회성으로 확인하고 그 결과를 PR 본문에 명시. 예: `pnpm test:perf --testPathPattern '__no_such_perf_spec__'` 가 non-zero exit — empty-suite 가 더 이상 silent-pass 하지 않음을 입증.
- [ ] 회귀 방지: 본 변경이 perf-spec 실행 자체(191+ test)를 깨지 않음을 `pnpm test:perf` 실행 결과로 확인.
- [ ] `pnpm lint && pnpm build` green (설정 파일 JSON 유효성 포함).
- [ ] `README.md` 의 perf-spec / 측정 harness 절에 "perf-spec 부재 시 CI fail(passWithNoTests 미허용)" 한 줄 gating 규약을 추가한다.
- [ ] 분기 없음(설정 flag 1개 제거 + JSON 유효성) — R-112 의 happy/error/branch 신규 unit test 대상 production symbol 이 없다. 본 task 는 jest 설정 자산 변경이며 검증은 위 `pnpm test:perf` empty/non-empty 두 실행(positive: 31 spec green / negative: 매칭 0 → fail)으로 대체한다. 이 두 실행이 R-112 의 happy(non-empty green)·negative(empty fail) cover 역할을 한다. src/ production code 변경 0이라 `test:cov` coverageThreshold 영향 없음(무회귀만 확인).

## Out of Scope

- `test/perf/jest-perf.json` 의 다른 설정 튜닝(`maxWorkers` 조정, coverage 계측 추가 등) — 별도 slice.
- perf-spec 의 실제 latency 임계 강화(fail-on-regression 게이팅) — 관찰 전용 유지, 별도 task.
- `test/jest-e2e.json` / 루트 jest 설정 등 다른 jest config 의 `passWithNoTests` 검토 — 본 task 는 perf 스위트에 한정.
- `.github/workflows/ci.yml` 변경 — T-0878 에서 이미 배선 완료, 본 task 는 config 파일만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 없음 — sub-agent 가 관련 작업 발견 시 여기에 append)
