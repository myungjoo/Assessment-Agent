---
id: T-0678
title: e2e run-plan 최외곽 컴포저 산출 직전 consistency 가드 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: [T-0677]
touchesFiles:
  - test/helpers/realdata-e2e-run-plan.ts
  - test/helpers/realdata-e2e-run-plan.spec.ts
plannerNote: "P5 109행 step① realdata-e2e stream — T-0677 신설 run-plan 가드의 self-wire(buildRealDataE2eRunPlan 반환 직전 self-assert), T-0672 step-args aggregator self-wire 의 한 layer 위 최외곽 run-plan seam mirror — 가드신설+self-wire 짝 닫기"
---

# T-0678 — e2e run-plan 최외곽 컴포저 산출 직전 consistency 가드 self-wire 배선

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 build-time 정합 가드 사슬의 다음 slice. 직전 T-0677 (PR #593 squash 4f10d09) 가 실 평가 e2e build-time chain 의 **최외곽 단일 진입점** `buildRealDataE2eRunPlan(seeds, modelId, run) → { pipeline, run }` (T-0597, `test/helpers/realdata-e2e-run-plan.ts`) 에 대한 순수 consistency 가드 `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run): void` 를 `test/helpers/realdata-e2e-run-plan-consistency.ts` 에 신설했다 — 산출 `{ pipeline, run }` 컨테이너를 single-source 재유도(pipeline 측 `buildRealDataPipelinePlan(seeds, modelId)` 위임 + run 입력 직접 대조) 와 byte-identical 정합 비교로 fail-fast throw. 그러나 그 가드는 신설만 되어 있고 **컴포저 본문에 self-wire 가 부재** — 현재 `buildRealDataE2eRunPlan` 은 `assert*Consistent` import 0, 반환 직전 self-assert 0 (`grep assertRealDataE2eRunPlanConsistentWithSources test/helpers/realdata-e2e-run-plan.ts` empty). 따라서 caller (live runner 직전 — e2e spec / Docker pipeline) 가 의식적으로 가드를 호출하지 않으면 가드가 enforce 되지 않는 상태다.

본 task 는 그 빈칸을 채우는 **self-wire 배선만** 한다 — `buildRealDataE2eRunPlan` 컴포저가 산출 `{ pipeline, run }` 객체를 반환하기 직전에 `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run)` 를 self-assert 하도록 1 import 1 호출 추가 — 단일 반환 지점이므로 분기 0, 정상 합성이면 가드는 void → 반환 byte-identical 보존, 합성 회귀가 손상한 run plan 은 step ① live runner 로 새기 전 차단된다. step-args aggregator 가드 self-wire (T-0672) 의 한 layer 위 최외곽 run-plan seam mirror — T-0677+T-0678 짝으로 run-plan seam 의 가드신설+self-wire 가 닫히고, realdata-e2e build-time consistency 가드 사슬이 (sub-composer → aggregator → 최외곽 run-plan) 3 layer 모두 self-wire 박제된다.

## Required Reading

- `test/helpers/realdata-e2e-run-plan.ts` — self-wire 대상 최외곽 컴포저. `buildRealDataE2eRunPlan(seeds, modelId, run)` (L120~138) 이 (1) `buildRealDataPipelinePlan(seeds, modelId)` → `pipeline`, (2) `assertRunRefNonBlank(run.gitSha / dateToken)` guard 후 `run` 을 새 객체 `{ gitSha, dateToken }` 로 복사 → `{ pipeline, run }` (`RealDataE2eRunPlan`, L74~77) 단일 반환 지점. **self-assert 삽입 위치 = L137 `return` 직전 — `const runPlan = { pipeline, run: { gitSha: run.gitSha, dateToken: run.dateToken } }` 로 분리 → `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run)` 호출 → `return runPlan`**. 정상 합성이면 가드는 void → 반환 byte-identical (관측 불가능하게 동일).
- `test/helpers/realdata-e2e-run-plan-consistency.ts` — T-0677 신설 순수 가드. `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run): void` import 대상. 가드 호출 chain (pipeline single-source 재유도 + run 직접 대조 + 두 구성요소 byte-identical 검증) 은 본 task 에서 재구현 0 — import + 호출 1지점만.
- `test/helpers/realdata-e2e-run-plan.spec.ts` — 컴포저 기존 spec. self-wire 후 정상 호출이 여전히 throw 0 (round-trip) 임을 확인하는 self-wire describe 추가 위치. 기존 happy-path / error-path test 가 self-wire 후에도 unchanged 동작해야 한다 (round-trip 무손실 보존).
- **패턴 선례 (mirror)**: `test/helpers/realdata-e2e-step-args.ts` L80~169 의 T-0672 self-wire 박제 — import 1줄 (L88) + 단일 반환 지점 self-assert (L155~169) 정확한 형태. 본 task 는 그 한 layer 위 (aggregator → 최외곽 run-plan) mirror — 차이점: (a) 가드 인자가 4 개 (`runPlan, seeds, modelId, run`) — step-args 는 (`stepArgs, runPlan, activities, results`), (b) 단일 반환 지점 1 개 (분기 0) — step-args 도 동일, (c) self-wire 가 산출 컨테이너 (`runPlan`) 를 local const 로 분리 → 가드 호출 → 반환 3 줄 패턴 동형.
- `test/helpers/realdata-e2e-step-args.spec.ts` — T-0672 self-wire spec describe/it 구조 동형 참고. self-wire describe block 의 it 패턴 (정상 호출 throw 0 / 가드 호출이 일어남 검증 / 컨테이너 byte-identical 보존).
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-run-plan.ts` 의 `buildRealDataE2eRunPlan(seeds, modelId, run)` 본문 (L120~138) 을 다음과 같이 수정: (1) `import { assertRealDataE2eRunPlanConsistentWithSources } from "./realdata-e2e-run-plan-consistency";` 1줄 추가 (기존 import block 정합 위치), (2) L137 단일 반환 지점에서 `{ pipeline, run: { gitSha: run.gitSha, dateToken: run.dateToken } }` 를 local const `runPlan` 으로 분리, (3) 그 직후 `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run);` 호출, (4) `return runPlan;` 로 반환. 정상 합성이면 가드는 void → 반환 객체 byte-identical (관측 불가능하게 동일).
- [ ] **byte-identical 보존**: self-wire 후 정상 입력 (빈 seeds + 단일/다수 seed 분기) 에서 `buildRealDataE2eRunPlan` 반환 객체가 self-wire 전과 deep-equal (구조 / 필드 / 무공유 보존) 동일. self-wire 가 정상 입력에 부수효과 0 (mutate 0, 새 객체 분기 0). 결정론 보존 (동일 입력 → 동일 객체).
- [ ] **에러 정책 (전파)**: (a) 정상 입력 → 가드 void → 정상 반환, (b) 손상 합성 (예: 만약 컴포저 본문이 미래에 회귀로 pipeline 또는 run 한쪽을 변형/누락하면) → 가드가 throw 해서 caller 가 손상 plan 을 못 받음. (c) 기존 컴포저 본문 guard (`assertRunRefNonBlank`, 위임 `buildRealDataPipelinePlan` 의 modelId/seed guard) throw 는 가드 도달 전 그대로 전파 — self-wire 가 삼키지 않음 (try/catch 0). 즉 self-wire 는 layer 추가만, 기존 throw semantic 보존.
- [ ] **비변형 / 순수**: self-wire 추가가 컴포저의 다른 동작 변경 0 — 위임 호출 순서 / run guard 순서 / 새 객체 복사 / 입력 mutate 0 / 부수효과 0 / `@Injectable` 0 / 새 외부 dependency 0 / 새 import 1줄 (가드 import) 외 변경 0.
- [ ] **Happy-path unit test** (`test/helpers/realdata-e2e-run-plan.spec.ts` 에 self-wire describe block 추가): (a) 정상 (seeds, modelId, run) — 빈 seeds 분기 + 단일/다수 seed 분기 — 호출 시 throw 0 + 반환 객체 deep-equal 예상 plan (self-wire 후에도 round-trip 보존) 각 1+ test, (b) self-wire 가 실제로 일어남 검증 — jest spy 또는 가드 import 가 컴포저에 존재함 확인 (`expect(buildRealDataE2eRunPlan).toBeDefined()` + 가드 throw 동작 round-trip 검증으로 간접 확인 — spy mock 가능하면 명시).
- [ ] **Error path unit test**: (a) 기존 컴포저 guard throw (modelId 빈/공백, externalId 빈/공백 seed, run.gitSha/dateToken 빈/공백) 가 self-wire 전과 동일 throw semantic 보존 — self-wire 가 throw 를 변형 / 삼키지 않음 각 1+ test, (b) self-wire 도달 전 throw 면 가드 미호출 (예: modelId 빈/공백 → 위임 pipeline throw → 가드 도달 0).
- [ ] **Flow / branch cover**: (a) 정상 합성 → 가드 호출 → void → 반환 분기, (b) 위임 throw 전파 분기 (modelId / seed / run guard 별), (c) 가드 자체는 단일 호출 (분기 0) — 컴포저의 분기는 self-wire 전과 동일.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 정상 호출 후 입력 (`seeds`, `run`) deep-equal 보존 (mutate 0), (b) 같은 입력 두 번 호출 deterministic (반환 deep-equal, throw 0), (c) 반환 객체가 입력 / 이전 호출 결과와 무공유 (새 객체 분기 보존), (d) self-wire 후 반환 객체 type (`RealDataE2eRunPlan`) 보존 — TypeScript 컴파일 green, (e) 빈 seeds + 유효 modelId + 유효 run 정상 통과 (가드 void, 반환 `{ pipeline: { collectCallArgs: [], modelId }, run }`), (f) 단일 / 다수 seed 분기 정상 통과 (가드 void) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경된 컴포저 파일 `realdata-e2e-run-plan.ts` 의 변경 부분 (가드 import + self-assert + local const 분리) line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. 가드 import 가 신규 cycle 0 (가드 파일은 컴포저 파일 자체를 import 하지 않으므로 — tsc green 으로 확인).

## Out of Scope

- 가드 본문 (`assertRealDataE2eRunPlanConsistentWithSources` 구현 / 재유도 chain / 에러 분류) 수정 0 — 본 task 는 self-wire 1 import 1 호출만. 가드 동작은 T-0677 박제 그대로.
- `buildRealDataE2eRunPlan` 의 기존 guard (`assertRunRefNonBlank`, 위임 `buildRealDataPipelinePlan` 의 modelId/seed guard) / 위임 호출 순서 / run 객체 복사 / 반환 구조 변경 0 — self-wire 가 layer 추가만, 기존 semantic 보존.
- 자동 복구 / run plan 재합성 / 정규화 / 기본값 채움 0 — 손상 runPlan 을 고치거나 silent 수선하지 않는다 (fail-fast 유지). 복구는 caller 책임.
- JSON schema / 외부 validation 라이브러리 도입 0 — 가드는 순수 비교만.
- 상위 / 하위 다른 seam self-wire (`realdata-e2e-pipeline-plan` 자체 / step-args aggregator / publish step-args / evaluation step-args 등) — 본 task 는 e2e run-plan self-wire 1건만. 다른 seam 은 별도 slice.
- live execFile / gh / 실 수집 / 실 LLM wiring — credential 게이트 deferred, build-time self-wire 만.
- production `src/` 코드 변경 — test helper 단독. 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 도메인 type 정의 0.
- 평가 step-args / publish step-args 의 sub-composer self-wire 갱신 (이미 T-0668 / T-0670 닫힘) — 재방문 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 self-wire 후 realdata-e2e build-time consistency 가드 사슬이 (sub-composer → aggregator → 최외곽 run-plan) 3 layer 모두 self-wire 박제 완결. 다음 자연 후보: ① step ① live execFile / gh / 실 수집 wiring credential 게이트 진입 여부 (PLAN 109행 운영 전제 — github.com read PAT 주입), ② daily-test step_eval 배선 (109행 후반), ③ 또는 새 build-time seam 발굴 시 그쪽 stream — 단 가드 사슬 완결 후이므로 productive 진척 우선 권고.)

## Result

- Status: DONE — 2026-06-26 (cron@aa-local-6409 fire)
- Completed: 2026-06-26T06:50Z, PR #594 squash merge `7bf0169` (4-게이트 PASS, reviewer r1 APPROVE 0 finding, CI green)
- 변경: `test/helpers/realdata-e2e-run-plan.ts` self-wire(import 1줄 + 단일 반환 지점에서 산출 plan 을 `const runPlan` 분리 → `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run)` self-assert → `return runPlan`) + `test/helpers/realdata-e2e-run-plan.spec.ts` self-wire describe 10 it.
- 결과: focused 33 + 전체 330 suite/8004 tests pass, coverage line≥80% AND function≥80% green, lint/build clean. byte-identical 보존(정상 합성 시 가드 void).
