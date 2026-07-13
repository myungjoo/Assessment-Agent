---
id: T-0957
title: daily-test step_rediscovery() run-leg jest-spawn argv invocation contract 정적 smoke
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 400
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0790(step_eval run-leg argv parity)·collect run-leg argv parity·T-0955(step_redeploy invocation, 360 LOC) 동형. R-112 4종 cover 위한 다수 assert(구조·순서·negative mutant a~e) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·daily-test.sh 미변경."
independentStream: realdata-e2e-daily-test-step-rediscovery-run-leg-jest-argv-invocation-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-daily-test-step-rediscovery-run-leg-jest-argv-invocation-contract.smoke-spec.ts]
created: 2026-07-13
plannerNote: "P5 §109 step④ — 서두 bootstrap(T-0956)까지 봉함 뒤 남은 유일 미봉 run-leg. step_eval(T-0790)·step_collect run-leg argv parity 두 형제는 봉했으나 뒤늦게 추가된(T-0943) step_rediscovery run-leg jest argv 는 미봉 — 그 세 번째 leg 을 봉함."
---

# T-0957 — daily-test step_rediscovery() run-leg jest-spawn argv invocation contract 정적 smoke

## Why

`deploy/daily-test.sh` 계약 표면을 하나씩 봉해온 chain(T-0944~T-0956)에서 서두 부트스트랩(T-0956)까지 봉함이 끝났다. 남은 유일한 미봉 표면은 **`step_rediscovery()`(237~251행)의 run-leg jest-spawn 호출 argv 계약**이다. 형제 스텝 `step_eval`(T-0790)·`step_collect`(collect run-leg argv parity)는 각각 full-vector run-leg argv drift smoke 로 봉했으나, 뒤늦게 추가된(T-0943) `step_rediscovery`(read-only 재발견 검색 leg)의 run-leg jest argv(243~245행)에는 대응 smoke 가 없다(origin/main 확인 — NONE). run-leg argv 가 reorder / flag-변경 / spec 경로 오타로 정본과 silent 분기하면 nightly e2e 가 잘못된 jest 를 spawn → 무인 모니터링 false 신호. 본 task 는 그 세 번째 run-leg 을 봉해 eval/collect/rediscovery run-leg 삼형제 계약을 완결한다(PLAN.md 109행 step④ realdata-e2e nightly runner).

## Required Reading

- `deploy/daily-test.sh` 237~251행 (`step_rediscovery()` 정의 — run-leg jest 호출 라인 243~245 포함) 및 187~200행(`step_eval()` 동형 run-leg 참조).
- `test/smoke/realdata-e2e-daily-test-step-eval-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts` — 형제 step_eval run-leg argv parity smoke 패턴(readFileSync 추출·ordered-vector 대조·negative mutant 구조).
- `test/smoke/realdata-e2e-daily-test-curl-code-helper-status-code-only-body-discard-maxtime-hang-guard-argv-passthrough-captured-substitution-contract.smoke-spec.ts` — T-0954 정적 contract smoke 구성(readFileSync 앵커·pure 함수 동형 모델링·describe 구조) 참조.
- `docs/decisions/ADR-0045-*.md` (있으면 파일명 glob) — write publish/step_report deferred 경계 확인(본 leg 은 read-only, mutation 0).

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-daily-test-step-rediscovery-run-leg-jest-argv-invocation-contract.smoke-spec.ts` 신설. `deploy/daily-test.sh` 를 `readFileSync` 로 읽어 `step_rediscovery()` 함수 본문(243~245행 run-leg)에서 jest 호출 토큰을 정적 추출한다(실행/source/실 jest spawn 0).
- [ ] **Happy-path**: run-leg 호출 계약 불변식 각각에 대해 성공 assert 1+ —
  - 서브셸 격리 `( cd "$REPO_DIR" && pnpm exec jest ... )`,
  - ordered argv `--config ./test/jest-smoke.json --runTestsByPath <spec>`(flag↔value 순서·길이),
  - `--runTestsByPath` value == `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts`(T-0942 rediscovery-search-live spec 경로 byte-identical),
  - append-redirect `>>"$LOG_FILE"` + stderr-병합 `2>&1`,
  - exit-code → `return 0`(OK) / `return 1`(FAIL) 분기,
  - 참조 spec 경로가 실재하는 파일(`fs.existsSync`)임(오타·dangling 경로 방지).
- [ ] **삼형제 single-source 동형**: 추출한 rediscovery run-leg argv 가 `step_eval`·`step_collect` run-leg 와 spec 경로만 제외하고 shape-identical(subshell·cd·pnpm exec jest·config flag+value·redirect·2>&1) 임을 대조하는 assert 1+.
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 shell 로 not-match 단언 각 1+ (최소 a~e 5종):
  - (a) `--runTestsByPath` value 를 eval/collect spec 경로로 바꾼 mutant → rediscovery 계약과 not.toEqual,
  - (b) `--config`/`--runTestsByPath` 순서 뒤집힌 mutant → not.toEqual,
  - (c) `--runTestsByPath` flag 누락 mutant → argv 가 계약 벡터와 not.toEqual,
  - (d) append `>>` 를 overwrite `>` 로 바꾼 mutant → redirect 계약 위반 검출,
  - (e) `2>&1` 누락 mutant → stderr-병합 계약 위반 검출.
- [ ] **Flow/branch cover**: run-leg 의 성공(return 0)·실패(return 1) 두 분기, 그리고 gating-caller 가 아닌 run-leg-만-담당 경계(함수 내부에 gating 판정 없음)를 각 test 로 분리.
- [ ] **§9 secret-safety**: argv 에 credential/실값 0(spec 경로 + config flag 만)임을 단언하는 test 1+. `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 jest spawn / 실 redeploy·health·gh·git·네트워크 0, `deploy/daily-test.sh` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/daily-test.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- `step_eval`/`step_collect` run-leg argv parity smoke(T-0790·collect) 재구현/변경 0 — 상보적 세 번째 leg.
- rediscovery live smoke(T-0942) 자신의 검색 round-trip 로직 재검증 0 — 본 task 는 daily-test.sh 의 그 spec 을 spawn 하는 호출 계약만.
- write publish / step_report 배선(ADR-0045 deferred) 0.
- 새 canonical TS command-plan helper 신설 0(eval/collect 는 helper 존재하나 rediscovery 는 미존재 — 본 task 는 helper 도입이 아니라 daily-test.sh run-leg 계약을 정적 앵커로 봉함만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)

---

**Status: DONE** (2026-07-13T13:52Z) — PR #851 squash-merged (97dc0230). executor→implementer→tester→integrator: test-only 단일 smoke-spec (+435/-0) `test/smoke/realdata-e2e-daily-test-step-rediscovery-run-leg-jest-argv-invocation-contract.smoke-spec.ts`. 22 test green(happy/branch/삼형제 single-source 동형/negative mutant a~e/§9 secret-safety/결정론), reviewer APPROVE round 1/7, 4-게이트 PASS, production 0 LOC·daily-test.sh 미변경. eval(T-0790)/collect/rediscovery run-leg 삼형제 계약 완결.
