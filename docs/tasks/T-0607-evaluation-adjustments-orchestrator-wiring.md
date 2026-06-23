---
id: T-0607
title: 평가 후처리 5-adjuster inline chain → applyEvaluationAdjustments 단일 호출 wiring
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-040, REQ-037, REQ-041, REQ-027, REQ-025]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-24
plannerNote: "T-0606 composer 추출 닫는 wiring slice — orchestrator L258~315 inline 5-step → applyEvaluationAdjustments(entries, signals) 단일 호출 교체, byte-identical 보존"
independentStream: p5-evaluation-adjustments
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/evaluation-orchestrator.service.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
---

# T-0607 — 평가 후처리 5-adjuster inline chain → applyEvaluationAdjustments 단일 호출 wiring

## Why

T-0606(머지 56993d2)이 평가 후처리 5-adjuster 단일 진입 순수 composer
`applyEvaluationAdjustments(entries, signals)` 를 신규 도메인 파일 박제했으나, 호출부
(`EvaluationOrchestratorService.evaluateActivities` L258~315)는 여전히 **inline 5-step
chain** (entries 조립 → abuse → update-count → quality → underperformer → notable →
flatten) 을 그대로 두고 있다. 본 slice 는 T-0606 의 Follow-ups 가 명시한 "orchestrator
배선" 을 닫아 추출의 ROI(service mock 없이 thread 검증) 를 실현화한다.

본 task 는 inline 5-step chain (L258~315 영역, 약 58 LOC 본문 + 인접 JSDoc step 5~9 단축
가능) 을 단일 `applyEvaluationAdjustments(entries, signals)` 호출 1줄 + entries 조립 1줄
(L258~261 그대로 유지) 로 교체한다. 5 signal 은 기존 `signal` / `neutralization` /
`qualitySignal` / `underPerformerSignal` / `notableContributionSignal` 변수를 그대로
`EvaluationAdjustmentSignals` 객체로 묶어 단일 인자로 전달. **산출 byte-identical 보존**
(기존 orchestrator spec 3354 줄 그대로 PASS) + 5 위임 helper import 제거 + 본 composer
import 추가 + JSDoc step 5~9 한 줄로 압축. 도메인 로직 변경 0 — 호출부 thread 만 단축.

## Required Reading

- `src/assessment-evaluation/evaluation-orchestrator.service.ts` L1~80(imports), L130~205
  (JSDoc step 5~9 — composer 호출 후 한 줄 요약으로 압축할 영역), L255~316(변경 핵심
  영역 — entries 조립 + 5-step inline chain + flatten).
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` L67~107(import +
  `EvaluationAdjustEntry` / `EvaluationAdjustmentSignals` 타입), L158~234(composer 시그니처
  + body — 본 wiring 의 호출 대상).
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts` — 본 task 가
  composer 동작 자체를 다시 테스트하지 않는다는 책임 경계(중복 spec 0 원칙).
- `src/assessment-evaluation/evaluation-orchestrator.service.spec.ts` L1~120(setup +
  imports) + 본 spec 의 abuse/update-count/quality/underperformer/notable 5종 thread
  케이스를 grep(`applyAbuseSignalToVolume`/`applyContributionQualityFloor` 등 5종) 로 위치
  파악 — 본 wiring 후 그대로 PASS 해야 함(regression 보호).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/evaluation-orchestrator.service.ts` 변경:
  - L262~315 의 inline 5-step chain(abuse → update-count → quality → underperformer →
    notable → flatten)을 단일 호출 `applyEvaluationAdjustments(entries, { abuse: signal,
    updateCount: neutralization, quality: qualitySignal, underPerformer: underPerformerSignal,
    notableContribution: notableContributionSignal })` 1 표현으로 교체.
  - L258~261 의 entries 조립(`deduped.map((input, i) => ({ author, result: results[i] }))`)
    은 그대로 유지 — composer 의 첫 인자.
  - 5 위임 helper import(`applyAbuseSignalToVolume` /
    `applyUpdateCountNeutralizationToVolume` / `applyContributionQualityFloor` /
    `applyUnderPerformerAnnotation` / `applyNotableContributionAnnotation`) 제거. 단,
    detection 5종 import (`computeAbuseSignal` 등) 은 그대로 유지 — 신호 산출은 orchestrator
    책임 유지(T-0606 Out of Scope 그대로).
  - `applyEvaluationAdjustments` import 추가.
  - JSDoc 의 step 5~9 다섯 문단을 "5. 평가 후처리 5-adjuster 단일 composer
    `applyEvaluationAdjustments(entries, signals)` 호출 — abuse → update-count → quality
    → underperformer → notable → flatten 을 v1 고정 순서로 thread 후 `EvaluationResult[]`
    반환(T-0606 박제 composer 위임, 본 service 의 재구현 0)." 한 문단으로 압축 — 알고리즘
    설명은 composer 의 JSDoc 으로 single source 화(중복 0).
  - 모든 신호 검증·dedup·scoring(§1~§3·§4) 로직 변경 0 — 본 task 는 (5) 단계 단축만.
- [ ] **Happy-path unit test**(orchestrator spec 신규 1+): `applyEvaluationAdjustments`
  를 jest spy 로 spy 해, 한 번 호출되고 그 인자가 `(entries, { abuse, updateCount,
  quality, underPerformer, notableContribution })` 5 signal 단일 container 형식인지 검증.
  반환값이 orchestrator 의 최종 return 값과 same-ref 여야 한다(중간 변환 0 보장).
- [ ] **Error path unit test**: 위 spy 가 throw 하도록 mock 한 fixture 에서
  `evaluateActivities` 가 그 error 를 자체 try/catch 없이 그대로 전파(투명성). composer
  의 `TypeError` (signals null 등)는 도달 0 — orchestrator 가 모든 signal 을 항상 새
  객체로 만든 뒤 호출하므로 정상 path 에서 guard throw 0(테스트 1+ 로 명시 박제: "signal
  detection 산출이 빈 신호여도 composer 호출은 정상" — 빈 inputs/deduped 경로 1+).
- [ ] **Flow / branch 분기 cover**: (a) 빈 `activities: []` → 빈 `EvaluationResult[]`
  반환 경로(deduped=[], entries=[], composer 빈 산출), (b) 정상 활동 1+ 의 happy path
  (composer 결과가 그대로 return), (c) scoreUnit 한 단위 reject → composer 도달 0 (
  scoring 실패 격리 §2) 각 1+ test.
- [ ] **Negative cases 충분 cover**: (1) `applyEvaluationAdjustments` spy 가 throw → 그
  error 전파, (2) 5 detection 중 하나가 빈 신호여도 composer 정상 호출(throw 0),
  (3) entries 길이가 결과 길이와 같음(매핑 misalignment 0), (4) options 변경이 composer
  인자에 영향 0(scoring 까지만 영향) 각 1+. 단일 negative 금지 — 예외 처리 분기마다 cover.
- [ ] **Regression 보호**: 기존 spec 의 abuse/update-count/quality/underperformer/notable
  5종 thread 케이스 (`applyAbuseSignalToVolume` 등 5종 import 가 spec L1~120 안에 있음) 가
  변경 0 으로 PASS — composer 가 inline chain 과 byte-identical 산출을 보장(T-0606 spec
  에서 이미 검증된 계약). 본 task 가 기존 5 helper import 를 spec 에서 유지하든
  composer-only spy 로 교체하든, **기존 출력 expectation 은 변경 0**.
- [ ] **결정성·무공유 검증**: 동일 fixture 2회 `evaluateActivities` 호출 시 deep-equal
  산출(byte-identical) + 입력 `activities` mutate 0 + composer 반환 배열이 입력과
  not-same-ref(기존 계약 보존).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — orchestrator 의 변경된 wiring
  분기 모두 cover. composer 자체 cover 는 T-0606 spec 이 이미 100% 박제(중복 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `applyEvaluationAdjustments` 자체 변경 금지 — T-0606 박제 그대로 사용(위임만).
- 5 detection helper(`computeAbuseSignal` / `computeUpdateCountNeutralization` /
  `computeContributionQualitySignal` / `computeUnderPerformerSignal` /
  `computeNotableContributionSignal`) 변경 금지 — 신호 산출은 orchestrator 책임 유지.
- 5 adjuster helper(`applyAbuseSignalToVolume` 등) 변경 금지 — composer 의 위임 대상.
- adjuster 적용 **순서 정책 변경** 금지 — composer 가 v1 고정 순서를 박제(T-0606 spec).
- §1~§3·§4 (normalize / dedup / scoring / detection) 로직 변경 0 — 본 task 는 (5) 단계의
  inline thread 를 composer 호출로 축약하는 mechanical wiring 만.
- 도메인 파일(`src/assessment-evaluation/domain/*`) 변경 0 — touch 는 orchestrator service
  + spec 2 파일로 제한.
- DB / 네트워크 / LLM / env 접근 0 — wiring 은 build-time mechanical edit(cloud-safe·
  dependency-free).
- 새 외부 dependency 0(`applyEvaluationAdjustments` 는 같은 도메인 디렉토리 안 import).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 도메인 후처리 chain 의 다음 slice 는 별도 분석 필요 — 본 wiring 닫힌 뒤 P5 다음 갭
  (예: 평가 결과 narrative 표현 정책 R-59 박제 점검, evaluation 후처리 외 P4
  요구사항 잔여) 을 PLAN.md 와 대조해 다음 task 로.
