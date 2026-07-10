---
id: T-0881
title: app-root compared 분기 perf-spec 를 주입 clock 으로 결정론화
phase: P5
status: DONE
mergedAs: 67955a76f287895fe82be5b0b7172c4b2a896f0b
prNumber: 775
reviewRounds: 1
completedAt: 2026-07-10T10:53:17Z
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-07-10
plannerNote: PR #774(T-0880) unblock 선행 — compared 분기 wall-clock flake 제거. T-0881 merge 후 driver 가 PR #774 rebase+re-CI 로 resume.
independentStream: perf-spec-determinism
dependsOn: []
touchesFiles: [test/perf/app-root-measure-confirm.perf-spec.ts]
---

# T-0881 — app-root compared 분기 perf-spec 를 주입 clock 으로 결정론화

## Why

`test/perf/app-root-measure-confirm.perf-spec.ts`(T-0877) 의 "compared" 분기 test(약 198~223행)는 동일 endpoint 를 **주입 clock 없이 두 번 실 wall-clock 실측**(iterations:3)해 2차가 1차 baseline 대비 회귀 아님(`second.comparison.regressed === false`)을 단언한다. 시스템 부하가 오르면(T-0880 이 추가한 두 번째 통합 perf-spec 이 동시 부하 유발) 2차 실측이 1차보다 느려져 `regressed=true` 로 flake 한다. PR #774(T-0880) 의 CI `test:perf` 가 이 pre-existing fragility 때문에 2회 연속 fail 했다(동일 head_sha 의 main CI 는 green — T-0880 코드 결함 아님). 본 task 는 이 compared test 를 주입 clock 으로 결정론화해 REQ-048 조회 perf 검증의 timing-비결정성을 제거하고 PR #774 를 unblock 한다.

## Required Reading

- `test/perf/app-root-measure-confirm.perf-spec.ts` — 수정 대상. 특히 `stepClock(stepMs)` helper(152~165행) 관용구와 compared 분기 test(198~223행), 그리고 flow/negative 섹션의 기존 주입 clock 사용례(336~356행, 358~376행, 414~433행)를 참조해 동일 관용구로 정합화.
- `test/perf/latency-collector.ts` — `measureAndConfirmBaseline`/`measureBaselineCandidate`/`MeasureBaselineOpts` 서명. 특히 `opts.measure.now`(NowFn 주입 지점, 273~275행 + 316~321행)로 measure 표본 latency 를 결정론화하는 계약. **이 파일은 수정 금지 — 호출만.**
- `test/perf/summary-measure-confirm.perf-spec.ts`(참조 전용) — T-0880 이 차용한 stepClock 관용구의 sibling 사용례. **건드리지 마라 — PR #774 소관.**

## Acceptance Criteria

- [ ] compared 분기 happy-path test(198~223행)의 1차·2차 `measureAndConfirmBaseline` 호출에 `measure.now: stepClock(<동일 stepMs>)` 를 주입해 두 실측이 **동일 합성 latency** 를 보게 만든다. 그 결과 `second.comparison.regressed === false`, `second.comparison.errorRate.regressed === false`, `second.report` 가 `regressed=false` 를 포함함이 **wall-clock 무관하게 결정론적으로** 성립. (happy-path — 무회귀 분기 결정론)
- [ ] 회귀(regressed=true) 분기도 별도 합성 latency 로 커버 — 1차 대비 2차를 인위로 느린 `stepClock`(더 큰 stepMs) + `compare.latencyTolerance: 0` 로 주입해 `regressed=true` 도 결정론적으로 재현(기존 flow/negative 섹션의 336~356행·414~433행 관용구와 정합). 이 회귀 분기가 이미 충분히 커버돼 있으면 중복 신설 대신 기존 test 가 주입 clock 을 쓰는지 확인만 하고 본 항목 충족 note. (error/negative — 회귀 검출 분기)
- [ ] 부재→established / 존재→compared 두 분기 도달 판정(outcome)은 주입 clock 무관하게 유지 — 결정론화가 outcome 분기 자체를 바꾸지 않음을 확인(branch coverage: established write 발생 vs compared read-only). (flow/branch)
- [ ] negative — 실행 순서·시스템 부하와 무관한 재현성: compared test 가 실 `performance.now()` 표본에 의존하지 않음을(주입 clock 만 사용) 코드 인스펙션으로 확인. 잘못된 입력(음수 iterations 등) error path test 는 기존 것 유지(회귀시키지 않음).
- [ ] `pnpm test:perf` 전체 green — 본 spec 및 sibling perf-spec 이 모두 통과(반복 실행에서도 flake 0). 로컬에서 최소 2회 연속 green 확인.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 단 본 task 는 test/ 파일만 수정하고 production src 0 LOC 이므로 coverage 임계는 기존 대비 하락 없음을 확인(신규 src 미도입).
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- `test/perf/latency-collector.ts` / `latency-baseline.ts` / `latency-baseline-io.ts` / `latency-metrics.ts` 등 collector·io·baseline 모듈 `.ts` 수정 — 호출만, 서명 변경 0.
- `test/perf/summary-measure-confirm.perf-spec.ts`(T-0880/PR #774 소관) 및 다른 perf-spec 파일 수정.
- production `src/` 변경 — 본 task 는 test 결정론화 1건이며 동작 변경 0 LOC.
- 새 endpoint 배선 / CI job 편입 / 실 baseline JSON 체크인 / 새 dependency 추가.
- error path·negative 섹션의 기존 test 재작성(이미 결정론적 — 회귀시키지 마라). compared happy-path 및 관련 회귀 분기만 대상.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)
