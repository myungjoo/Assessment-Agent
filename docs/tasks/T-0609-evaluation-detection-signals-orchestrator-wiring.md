---
id: T-0609
title: 평가 detection 5-신호 inline chain → computeEvaluationAdjustmentSignals 단일 호출 wiring
phase: P5
status: DONE
commitMode: pr
prNumber: 523
mergedAs: f494c12
reviewRounds: 1
coversReq: [REQ-026, REQ-040, REQ-037, REQ-041, REQ-027, REQ-025]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-24
plannerNote: "T-0608 detection composer 추출 닫음 — orchestrator L177~205 inline 5-detection chain 을 단일 호출 wiring(T-0607 post-scoring wiring 의 detection-side 대칭 pair)"
independentStream: p5-evaluation-detection-signals
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/evaluation-orchestrator.service.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
---

# T-0609 — 평가 detection 5-신호 inline chain → computeEvaluationAdjustmentSignals 단일 호출 wiring

## Why

P5(Evaluation pipeline)의 평가 detection 5종 단일 진입 순수 composer
`computeEvaluationAdjustmentSignals(deduped)` 는 T-0608(머지 3441bd6, PR #522)이
`src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` 에 추출해
박제했다. 그러나 `EvaluationOrchestratorService.evaluateActivities` 본문은 아직 이
composer 를 호출하지 않고, inline 5-detection chain(L177~205 — `computeAbuseSignal` /
`computeUpdateCountNeutralization` / `computeContributionQualitySignal` /
`computeUnderPerformerSignal` / `computeNotableContributionSignal` 5개 호출 + 각
신호를 담은 5 지역 변수)으로 신호를 산출한 뒤 L224~230 에서 객체 리터럴로 풀어
`applyEvaluationAdjustments(entries, {...})` 에 넘긴다.

본 slice 는 T-0607 이 post-scoring 5-adjuster inline chain →
`applyEvaluationAdjustments(entries, signals)` 단일 호출로 닫은 wiring 의 **detection-side
대칭 pair** 다. inline 5-detection 호출과 객체 리터럴 조립을 단일 호출
`const signals = computeEvaluationAdjustmentSignals(deduped)` 1 표현으로 교체한다.
T-0608 composer 가 반환하는 `EvaluationAdjustmentSignals` 컨테이너가
`applyEvaluationAdjustments` 의 두 번째 인자 type 과 동일하므로 변환 0 — `signals` 를
그대로 `applyEvaluationAdjustments(entries, signals)` 에 thread 한다. 이로써
`evaluateActivities` 본문은 `inputs → deduped → signals =
computeEvaluationAdjustmentSignals(deduped) → results loop → applyEvaluationAdjustments
(entries, signals)` 의 2-composer thread 로 완전히 압축되고(T-0608 Follow-ups 박제),
산출은 byte-identical 로 보존된다(기존 orchestrator spec 이 regression 보호).

## Required Reading

- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — 본 task 의 유일한
  prod 변경 대상. 다음 4 영역을 모두 손댄다:
  - L83~98 import 블록 — `computeAbuseSignal` / `computeUpdateCountNeutralization` /
    `computeContributionQualitySignal` / `computeUnderPerformerSignal` /
    `computeNotableContributionSignal` 5 detection import **제거** + `computeEvaluationAdjustmentSignals`
    (`./domain/evaluation-detection-signals-pipeline`) import **추가**. `applyEvaluationAdjustments`
    import 는 그대로 유지(post-scoring composer — T-0607 이 이미 wiring).
  - L174~205 inline 5-detection 호출(`const signal = computeAbuseSignal(deduped)` 등
    5 지역 변수 + 각 JSDoc-style 주석 (3)~(3e)) — **단일 호출
    `const signals = computeEvaluationAdjustmentSignals(deduped)` 1 표현으로 교체**.
    5 detection 주석 5 문단을 detection composer 단일 호출 1 문단으로 압축.
  - L224~230 의 `applyEvaluationAdjustments(entries, { abuse: signal, updateCount:
    neutralization, ... })` 객체 리터럴 풀이 → `applyEvaluationAdjustments(entries,
    signals)` 단일 변수 참조로 교체.
  - L1~51 머리 주석 block 의 §3~§3e 다섯 detection 문단 — detection composer 단일
    진입 1 문단으로 압축(§4 dedup / §2 scoring / §5 post-scoring 문단은 불변).
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` —
  `computeEvaluationAdjustmentSignals(deduped: EvaluationInput[]): EvaluationAdjustmentSignals`
  시그니처 + 반환 컨테이너 5 필드(`abuse` / `updateCount` / `quality` /
  `underPerformer` / `notableContribution`)·throw 계약(null/undefined deduped →
  TypeError, 위임 throw 전파) 확인. **변경 금지** — 본 task 는 이 composer 를 호출만.
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` L91~234 —
  `EvaluationAdjustmentSignals` interface + `applyEvaluationAdjustments(entries, signals)`
  시그니처 확인. composer 산출 컨테이너가 그대로 두 번째 인자가 됨(변환 0). **변경 금지**.
- `src/assessment-evaluation/evaluation-orchestrator.service.spec.ts` — 기존
  orchestrator spec(detection/post-scoring 산출 검증) 구조 파악. 본 wiring 의 신규
  spec 을 여기 colocated 로 추가(R-112 colocated-spec ordering hint). 기존 산출
  검증 케이스는 byte-identical 보존 regression 보호로 그대로 PASS 해야 함.

## Acceptance Criteria

- [ ] `evaluation-orchestrator.service.ts` 의 inline 5-detection 호출(L174~205) 이
  단일 호출 `const signals = computeEvaluationAdjustmentSignals(deduped)` 1 표현으로
  교체됨 — 5 지역 변수(`signal` / `neutralization` / `qualitySignal` /
  `underPerformerSignal` / `notableContributionSignal`) 와 5 detection import 제거,
  `computeEvaluationAdjustmentSignals` import 1개 추가(파일 검사로 확인).
- [ ] `applyEvaluationAdjustments(entries, signals)` 가 단일 변수 `signals` 를 그대로
  thread — 객체 리터럴 `{ abuse: ..., updateCount: ..., ... }` 풀이 제거됨. entries
  조립(`deduped.map((input, i) => ({ author, result }))`)·scoring loop·dedup(§4)·
  post-scoring composer(§5) 책임은 불변.
- [ ] 머리 주석 block 의 §3~§3e 다섯 detection 문단 + 본문 (3)~(3e) 주석이 detection
  composer 단일 진입 1 문단으로 압축됨(§12 한국어). detection 5종 산출 의미는
  composer JSDoc 으로 single-source 화됐음을 참조.
- [ ] **Happy-path unit test 1+**: 정상 활동 다수 fixture 에서 `evaluateActivities`
  호출 산출(`EvaluationResult[]`)이 wiring 전(직접 5 detection 호출 +
  `applyEvaluationAdjustments`)과 deep-equal — byte-identical 보존. composer 를 spy
  하여 `computeEvaluationAdjustmentSignals(deduped)` 가 정확히 1회, deduped(시간적
  중복/self-follow-up 제거 후)로 호출됨 검증.
- [ ] **Error path unit test 1+**: `computeEvaluationAdjustmentSignals` 가 throw 하는
  경우(composer spy 가 throw mock, 또는 malformed `EvaluationInput` 으로 위임 detection
  throw 유발) → `evaluateActivities` 가 그 error 를 자체 try/catch 없이 그대로 전파(부분
  결과 위장 0). scoringService throw 시 await 전파도 기존 케이스로 보존됨 확인.
- [ ] **Flow / branch 분기 cover**: (a) 빈 activities → deduped `[]` → composer 가
  빈 신호 컨테이너 반환 → 빈 `EvaluationResult[]` 산출(throw 0), (b) 정상 활동 다수 +
  다수 author fixture 에서 5 신호가 모두 반영된 산출(abuse 감점/underperformer/notable
  annotation 등 적용 확인), (c) scoring reject 분기(한 단위 reject → 전체 전파) 기존
  보존 검증 각 1+ test.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, wiring 경계마다 분리:
  (1) composer spy 가 `TypeError` throw → `evaluateActivities` 가 전파(자체 try/catch 0),
  (2) scoringService.scoreUnit reject → await 전파(부분 결과 0, 기존 보존),
  (3) 빈 activities → 빈 산출(throw 0, composer 1회 호출),
  (4) composer 호출 인자가 deduped(원본 inputs 아님)임을 spy 인자 검증으로 확인 —
    dedup 순서 보존(misalignment 0),
  (5) composer 산출 `signals` 가 그대로 `applyEvaluationAdjustments` 두 번째 인자로
    전달됨을 spy 인자 검증으로 확인(객체 리터럴 재조립 0) 각 1+ test.
- [ ] **기존 orchestrator spec regression 보존**: `evaluation-orchestrator.service.spec.ts`
  의 기존 산출 검증 케이스(detection 신호 반영·post-scoring 적용·entries 매핑 정합)가
  wiring 후에도 전부 PASS — byte-identical 산출 보장.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `evaluation-orchestrator.service.ts`
  변경 분기 전 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `evaluation-detection-signals-pipeline.ts`(T-0608 composer) 변경 금지 — 본 task 는
  호출 wiring 만. composer 의 5 detection 위임 로직·throw 계약·반환 shape 변경 0(이미
  T-0608 colocated spec 이 100% cover).
- `evaluation-adjustments-pipeline.ts`(T-0606 post-scoring composer) 변경 금지 —
  `EvaluationAdjustmentSignals` interface·`applyEvaluationAdjustments` 시그니처 모두
  불변. 본 wiring 은 composer 산출을 그대로 두 번째 인자로 thread 만.
- 5 detection helper(`evaluation-*-signal.ts` / `evaluation-update-count-neutral.ts`)
  변경 금지 — orchestrator import 에서 제거만(파일 자체 불변). composer 가 이미 위임.
- detection 적용 **순서 정책 변경** 금지 — composer 가 v1 고정 순서(abuse →
  update-count → quality → underperformer → notable)를 박제. 본 wiring 은 산출
  byte-identical 보존(순서·계약 mirror).
- dedup(§4)·scoring loop(§2)·entries 조립·post-scoring(§5) 로직 변경 금지 — 본 task 는
  detection 진입 1 표현 교체만.
- 신규 도메인 type / 신규 외부 dependency 0(기존 composer/type import 재사용만).
- DB / 네트워크 / LLM / env 접근 변경 0 — 본 wiring 은 build-time 순수 호출 교체
  (cloud-safe·dependency-free, dependsOn []).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- detection composer(T-0608) + post-scoring composer(T-0606) + 양 wiring(T-0607/본
  task) 모두 닫힌 뒤, `evaluateActivities` 본문은 2-composer thread 로 완전 압축됨.
  P5 다음 갭은 PLAN 96~111 의 미체크 bullet 과 대조해 다음 task 로 — 예: 단위
  commit/document 평가, 일/주/월 요약 평가(R-61), 사용자 지정 기간 평가문(R-9),
  시간적 중복(R-21) 추가 정책 등.
