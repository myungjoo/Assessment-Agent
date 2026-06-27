---
id: T-0706
title: realdata-e2e result-summary 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 PLAN L109 — T-0705 result-summary 가드 짝 닫기, buildRealDataResultSummary 단일 return self-wire (T-0701→T-0702 / T-0703→T-0704 mirror)
independentStream: realdata-e2e-result-summary-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary.ts
  - test/helpers/realdata-e2e-result-summary.spec.ts
---

# T-0706 — realdata-e2e result-summary 컴포저 self-wire 배선

## Why

P5(PLAN L109) realdata-e2e build-time consistency guard chain 의 후속이다. T-0705(PR #621, squash 35f58509)가 `assertRealDataResultSummaryConsistentWithInputs(summary, results)` 정합 가드를 신설했으나 컴포저 `buildRealDataResultSummary`(T-0580) 가 아직 그 가드를 호출하지 않는다 — 가드는 spec 에서만 검증되고 production-path(컴포저 return) 에는 미배선이다. 본 task 는 컴포저의 단일 return 사이트 직전에 가드를 self-assert 로 배선해, 집계(count/byDifficulty/byContribution/totalVolume) drift 를 build-time fail-fast 로 차단한다(REQ-032 raw 미저장 정합 / REQ-059 요약 무raw). T-0701→T-0702 / T-0703→T-0704 self-wire 짝 닫기 cadence 와 동형이다.

## Required Reading

- `test/helpers/realdata-e2e-result-summary.ts` — 대상 컴포저. `buildRealDataResultSummary(results)` 의 **단일 return 사이트**(현 origin/main 기준 116행 부근 `return { count, byDifficulty, byContribution, totalVolume }`) 직전에 self-assert 를 삽입한다. 기존 import 블록(47~52행 부근)에 가드 import 1줄 추가.
- `test/helpers/realdata-e2e-result-summary-consistency.ts` — 호출할 가드 시그니처: `assertRealDataResultSummaryConsistentWithInputs(summary: RealDataResultSummary, results: EvaluationResult[]): void`. 구조 결손 → TypeError, 값 부정합 → RangeError 를 throw. (읽기만 — 본 task 에서 수정 금지.)
- `test/helpers/realdata-e2e-result-summary.spec.ts` — colocated spec. self-wire 배선 검증 describe 를 추가한다.
- `test/helpers/realdata-e2e-result-report-plan.ts` + `.spec.ts` — self-wire 선례(T-0700). 단일 return 직전 self-assert + import 패턴 + spec 의 호출수/통과·throw 검증 방식 참고.
- `test/helpers/realdata-e2e-result-issue-action.ts`(있다면) — T-0704 self-wire 선례(양분기). 본 task 는 단일 return 이라 더 단순.

## Acceptance Criteria

- [ ] `buildRealDataResultSummary` 의 단일 return 사이트 직전에 `const summary = { count, byDifficulty, byContribution, totalVolume }` 로 결과를 묶고 `assertRealDataResultSummaryConsistentWithInputs(summary, results)` 를 self-assert 한 뒤 `return summary` 한다. import 1줄을 기존 import 블록에 추가.
- [ ] Happy-path test: 정상 `results` 입력 시 self-assert 가 throw 없이 통과하고 기존 반환 객체(count/byDifficulty/byContribution/totalVolume)가 self-wire 전과 byte-identical 임을 검증하는 test 1+ (빈 배열·단일·다수 원소 케이스 포함).
- [ ] Error path test: self-assert 가 실제로 호출됨을 증명 — `assertRealDataResultSummaryConsistentWithInputs` 를 jest spy/mock 으로 가로채 `buildRealDataResultSummary` 가 그것을 1회 호출함을 검증하는 test 1+. (spy 미설치 시 호출수 단언 불가하므로 호출 증명을 명시적으로.)
- [ ] Branch/flow test: 분기는 빈 배열 vs 비어있지 않은 배열의 누적 루프 2 경로 — 각 경로에서 self-assert 통과 + 반환 정합 검증 1+ test. (컴포저 자체에 if 분기 신규 추가 없음 — 루프 0회 vs N회 분기를 cover.)
- [ ] Negative cases 충분 cover: (1) 손상된 집계를 강제 주입했을 때 가드가 RangeError 로 fail-fast 함을 컴포저 경유로 재현(예: 가드를 spy 로 throw 시키면 `buildRealDataResultSummary` 가 전파함) test 1+, (2) 가드가 TypeError 를 throw 하는 구조 결손 시나리오 전파 test 1+ — 즉 self-wire 가 throw 를 삼키지 않고 호출부로 전파함을 negative 분기마다 cover.
- [ ] 기존 `realdata-e2e-result-summary.spec.ts` 의 기존 test 가 회귀 없이 모두 통과 (self-wire 가 정상 입력에서 반환값/순수성을 바꾸지 않음).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 `realdata-e2e-result-summary.ts` cov 100% 보존.

## Out of Scope

- `realdata-e2e-result-summary-consistency.ts`(가드 본체)·그 spec 수정 금지 — T-0705 에서 완결됨. 본 task 는 배선만.
- 가드 로직(재유도·deep-equal·throw 메시지) 변경 금지.
- 다른 NO-GUARD leaf 컴포저(live-gating `resolveRealDataE2eLiveGating` / result-issue-descriptor)의 가드 신설·배선 금지 — 별도 task.
- `src/` production code 변경 금지 (본 task 는 test/helpers 한정 test-only).
- 집계 알고리즘(byDifficulty/byContribution 슬롯 초기화·누적) 동작 변경 금지 — 반환 결과 byte-identical 보존.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
