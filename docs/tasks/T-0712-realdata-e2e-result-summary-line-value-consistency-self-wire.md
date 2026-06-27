---
id: T-0712
title: realdata-e2e result-summary-line 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — T-0711 값-정합 가드(assertRealDataResultSummaryLineConsistentWithSummary)를 formatRealDataResultSummaryLine 단일 return 직전 self-assert 배선(가드 짝 닫기). 가드가 RESULT_LINE_PREFIX 를 value 로 import 하므로 lazy require(T-0708 mirror)로 순환 의존 해소"
independentStream: realdata-e2e-result-summary-line-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-line.ts
  - test/helpers/realdata-e2e-result-summary-line.spec.ts
  - test/helpers/realdata-e2e-result-summary-line-consistency.spec.ts
---

# T-0712 — realdata-e2e result-summary-line 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ④ 결과 요약 표현 surface 의 build-time consistency-guard sweep 의 짝 닫기 task 다. T-0711(PR #627, squash bfb1426f)이 NO-GUARD leaf 컴포저 `formatRealDataResultSummaryLine`(`test/helpers/realdata-e2e-result-summary-line.ts`)의 **값-정합 가드** `assertRealDataResultSummaryLineConsistentWithSummary(line, summary)`(summary 필드만으로 라인을 컴포저 재호출 없이 독립 재합성 → byte-identical 대조, 값 drift fail-fast)를 신설했다. 그러나 컴포저 자신의 단일 return 사이트는 아직 **형태 가드**(`assertRealDataResultSummaryLineFormatShape`)만 self-wire 하고 있어, 본 신설 값-정합 가드는 spec 에서만 호출되고 컴포저 산출 라인에는 배선되지 않았다(origin/main grep 0). 본 task 는 T-0711 가드를 컴포저 단일 return 직전 self-assert 로 배선해, 컴포저가 실제로 내보내는 모든 라인이 summary 필드 값과 single-source 정합임을 build-time 에 보장한다(T-0702/T-0710 self-wire mirror). REQ-059(결과 요약 raw 미보유·결정적 표현) + REQ-032(이슈 표면 정합) 가드층을 마저 닫는다.

## 순환 의존 주의 (T-0708 lazy require precedent — 필독)

값-정합 가드 `realdata-e2e-result-summary-line-consistency.ts` 는 prefix single-source 재사용을 위해 컴포저의 **runtime 상수** `RESULT_LINE_PREFIX` 를 **value 로 top-level import** 한다(`import { RESULT_LINE_PREFIX } from "./realdata-e2e-result-summary-line"`, type-only 아님). 따라서 컴포저가 본 가드를 **top-level import** 하면 `composer → guard → composer(RESULT_LINE_PREFIX)` CommonJS 순환 의존이 생긴다(T-0708 에서 동일 패턴으로 실제 발생, lazy require 로 해소). 본 self-wire 는 **반드시 함수 본문 안에서 lazy `require`** 로 가드를 로드해야 한다 — top-level import 금지. T-0710(result-issue-descriptor identity self-wire)은 가드가 type-only import 라 top-level import 가능했으나, 본 가드는 value import 라 그 길이 막혀 있고 **T-0708(live-gating self-wire)의 lazy require 가 정확한 mirror** 다.

권장 배선 형태(`test/helpers/realdata-e2e-live-gating.ts` 의 self-wire 동형):

```ts
// 반환 직전 값-정합 self-guard — 본 가드가 컴포저의 RESULT_LINE_PREFIX 를 value 로
// import 하므로, 컴포저가 가드를 top-level import 하면 CommonJS 순환 의존이 생긴다.
// 이를 피해 lazy require 로 호출 사이트 직전에 로드해 라인↔summary 값 drift 를 차단한다.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- 순환 의존 해소용 lazy require(가드가 본 모듈의 RESULT_LINE_PREFIX 를 top-level value 로 사용하므로 top-level import 불가)
const { assertRealDataResultSummaryLineConsistentWithSummary } =
  require("./realdata-e2e-result-summary-line-consistency") as typeof import("./realdata-e2e-result-summary-line-consistency");
assertRealDataResultSummaryLineConsistentWithSummary(line, summary);
return line;
```

## Required Reading

- `test/helpers/realdata-e2e-result-summary-line.ts` — self-wire 대상 컴포저. 단일 `return line;`(현 line ~146) 직전에 이미 `assertRealDataResultSummaryLineFormatShape(line)` 형태 가드가 배선돼 있다. 본 task 는 그 **다음(또는 직전)** 에 값-정합 가드 self-assert 1 블록을 추가한다(형태→값 두 가드가 모두 라인을 읽기만, 출력 byte-identical 불변).
- `test/helpers/realdata-e2e-result-summary-line-consistency.ts` — T-0711 신설 값-정합 가드. export 심볼 `assertRealDataResultSummaryLineConsistentWithSummary(line, summary)`. **`RESULT_LINE_PREFIX` 를 value 로 import** 함을 확인(순환 의존 근거).
- `test/helpers/realdata-e2e-live-gating.ts` — **lazy require self-wire mirror 선례(T-0708)**. value-import 가드를 컴포저 본문에서 lazy `require` 로 로드해 순환 의존을 해소하는 정확한 패턴. 본 task 는 단일 return 이라 양분기가 아닌 1 사이트에만 배선(T-0708 은 2 분기).
- `test/helpers/realdata-e2e-result-summary-line.spec.ts` (colocated) — 컴포저 spec. self-wire 후 컴포저가 정상 입력에 라인을 그대로 반환(byte-identical)하고, **드리프트 입력 시 가드가 throw** 함을 검증하는 self-wire describe 를 추가한다.

## Acceptance Criteria

- [ ] `formatRealDataResultSummaryLine` 의 단일 `return line;` 직전에 `assertRealDataResultSummaryLineConsistentWithSummary(line, summary)` 를 self-assert 로 배선한다. 가드 로드는 **함수 본문 안 lazy `require`**(위 권장 형태) 로 하며 top-level import 를 추가하지 않는다(순환 의존 회피).
- [ ] 컴포저의 라인 출력은 **byte-identical 불변**(가드는 line·summary 를 읽기만). 기존 형태 가드(`assertRealDataResultSummaryLineFormatShape`) self-wire 는 유지(대체·삭제 금지) — 형태 가드와 값 가드 둘 다 호출.
- [ ] 가드 본체(`realdata-e2e-result-summary-line-consistency.ts`) 와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path test 1+** — 정상 summary(빈 batch count=0 슬롯 포함·일반 batch)에 대해 self-wire 된 컴포저가 throw 0 으로 기존과 동일 라인을 반환(byte-identical) 검증.
- [ ] **Error path / negative cases 충분 cover** — self-wire 가 실제로 값 drift 를 잡는지: 가드 단언이 컴포저 산출 라인과 summary 사이 정합을 강제함을 확인하는 test(예: 가드를 통한 호출 경로가 정상 라인에서 통과, 그리고 가드 자체의 RangeError/TypeError 분기는 T-0711 colocated spec 이 이미 cover — 본 spec 은 self-wire 호출 경로가 가드를 거친다는 사실을 검증). 컴포저에 잘못된 summary(byDifficulty 누락 등)를 주면 가드가 TypeError 로 fail-fast 함을 1+ test.
- [ ] **Flow / branch coverage** — 단일 return 사이트라 컴포저 분기는 없으나(빈/일반 batch 입력 두 경우 모두 정상 통과), 형태 가드·값 가드 두 self-assert 가 모두 호출 경로에 있음을 cover.
- [ ] lazy `require` 가 정상 동작(가드 심볼 로드 후 호출)함을 self-wire describe 가 검증 — 순환 의존 없이 컴포저·가드·spec 가 모두 import 가능(빌드/test green 자체가 cycle 부재 증명).
- [ ] (선택) `realdata-e2e-result-summary-line-consistency.spec.ts` 에 self-wire 호출수/경로 동기가 필요하면 갱신(가드 본체 무변경 전제 — describe 문자열·호출 count assert 정도). 불필요하면 생략하고 touchesFiles 에서 빼도 무방.
- [ ] `pnpm lint && pnpm build` 통과(lazy require eslint-disable 주석 포함).
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test 무회귀 — 특히 T-0711 colocated spec·기존 컴포저 spec).

## Out of Scope

- 값-정합 가드 본체(`realdata-e2e-result-summary-line-consistency.ts`) 로직 수정 — 본 task 는 self-wire 배선만(가드는 T-0711 에서 완결).
- `formatRealDataResultSummaryLine` formatter 본문·라인 출력 byte 변경 금지(가드는 읽기만 — 출력 불변).
- 형태 가드(`assertRealDataResultSummaryLineFormatShape`) self-wire 제거/대체 금지(형태·값 두 가드 공존).
- top-level import 로 가드 배선 금지 — **반드시 lazy require**(순환 의존 회피, T-0708 precedent).
- `result-summary-markdown`·`result-summary` 등 다른 NO-GUARD 후보 신설/self-wire 는 별도 task.
- `src/` 변경 0(test-only).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, T-0708 lazy require mirror 라 architect 불요).

## Follow-ups

- 잔여 NO-GUARD leaf 후보 재survey — `renderRealDataResultSummaryMarkdown`(result-summary-markdown) 등 상위 가드 deep-재유도 cover 여부 case-by-case 확인 후 신설/self-wire 짝 큐잉.
