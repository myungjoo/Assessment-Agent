---
id: T-0608
title: 평가 detection 5-신호 단일 진입 순수 composer computeEvaluationAdjustmentSignals 추출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-040, REQ-037, REQ-041, REQ-027, REQ-025]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "T-0607 wiring 닫힌 후 P5 다음 slice — orchestrator L177~205 inline 5-detection chain 을 detection-side 순수 composer 1개로 추출(post-scoring composer 의 대칭 pair)"
independentStream: p5-evaluation-detection-signals
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts
---

# T-0608 — 평가 detection 5-신호 단일 진입 순수 composer computeEvaluationAdjustmentSignals 추출

## Why

P5(Evaluation pipeline)의 평가 detection 5종 — abuse(R-26/R-40, PLAN 101행) ·
update-count 중립화(R-41, PLAN 102행) · 기여 품질(R-37/R-38, PLAN 103행) · 저성과자
(R-27, PLAN 105행) · 중요·어려운 기여(R-25, PLAN 104행) — 은 각각 의존성 0 의 순수
helper(`computeAbuseSignal` / `computeUpdateCountNeutralization` /
`computeContributionQualitySignal` / `computeUnderPerformerSignal` /
`computeNotableContributionSignal`) 로 박제돼 있다. 다섯 helper 의 시그니처는 정확히
동형 — 모두 `(deduped: EvaluationInput[]) => SignalType` 형태로, 입력은 dedup 후
`EvaluationInput[]` 단 하나를 공유한다. 그러나 5 detection 호출을 묶는 로직이
`EvaluationOrchestratorService.evaluateActivities` 메서드 본문 안에 inline(L177~205,
약 30 LOC 본문 + JSDoc step 3~3e 다섯 문단) 으로만 존재한다. 이 inline 5-호출은
`@Injectable` service 안에 묶여 LLM scoring mock 주입 없이는 순수 단위로 검증하기
어렵다.

본 slice 는 T-0606 이 post-scoring 5-adjuster 에 적용한 "단일 진입 순수 composer
추출" 패턴을 detection-side 의 **대칭 pair** 로 적용한다. `deduped: EvaluationInput[]`
하나만 받아 5 detection 을 호출한 뒤 **기존
`EvaluationAdjustmentSignals` 컨테이너** (`evaluation-adjustments-pipeline.ts` L95~107
에 이미 정의됨)를 그대로 반환하는 순수 함수
`computeEvaluationAdjustmentSignals(deduped)` 를 신규 도메인 파일로 추출한다. 본
task 는 **composer + colocated spec 신설만** — orchestrator 가 본 composer 를
호출하도록 배선하는 것은 별도 follow-up(파일 disjoint·동시성 보존). 추출 후
orchestrator 의 `evaluateActivities` 본문은 `inputs → deduped → signals =
computeEvaluationAdjustmentSignals(deduped) → results loop → applyEvaluationAdjustments
(entries, signals)` 의 2-composer thread 로 완전 압축된다(T-0606 박제 composer 의
입력 container 와 본 composer 산출 container 가 동일해 변환 0).

## Required Reading

- `src/assessment-evaluation/evaluation-orchestrator.service.ts` L175~205 — 추출 대상
  inline 5-detection chain (abuse → update-count → quality → underperformer → notable).
  **변경 금지 — 순서·계약을 그대로 mirror 하는 source-of-truth**. 본 task 는 이 파일
  미변경(배선은 follow-up). L83~98 import 블록도 참조 — 5 detection import 가 본 task
  composer 안에서 단일 import 로 옮겨가는 대상.
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` L91~107 —
  `EvaluationAdjustmentSignals` interface 정의 (abuse / updateCount / quality /
  underPerformer / notableContribution 5 필드). **본 task 의 composer 가 그대로 반환**.
  재정의 0 — 동일 type 을 `import type` 으로 재사용해 single-source 화. L158~234 의
  `applyEvaluationAdjustments(entries, signals)` 시그니처도 참조 — 본 task 산출이 그
  signals 인자의 source 가 되는 대칭 pair.
- `src/assessment-evaluation/domain/evaluation-abuse-signal.ts` L1~50 — `AbuseSignal`
  type + `computeAbuseSignal(inputs: EvaluationInput[]): AbuseSignal` 시그니처
  (throw 0, 입력 비변형, 빈 입력 → 빈 신호).
- `src/assessment-evaluation/domain/evaluation-update-count-neutral.ts` L1~50 —
  `UpdateCountNeutralization` type + `computeUpdateCountNeutralization(inputs)` 시그니처.
- `src/assessment-evaluation/domain/evaluation-quality-signal.ts` L42~120 —
  `ContributionQualitySignal` type + `computeContributionQualitySignal(inputs)` 시그니처.
- `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` L58~135 —
  `UnderPerformerSignal` type + `computeUnderPerformerSignal(inputs)` 시그니처.
- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` L62~140 —
  `NotableContributionSignal` type + `computeNotableContributionSignal(inputs)` 시그니처.
- `src/assessment-evaluation/domain/evaluation-input.ts` L1~80 — `EvaluationInput` type
  (5 detection 의 공통 입력 타입).

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` 추가:
  - 한국어 머리 주석 — 본 composer 의 책임 경계(5 detection 위임만, 재구현 0) + 본
    composer 가 post-scoring `applyEvaluationAdjustments` 의 입력 signals container
    를 산출하는 detection-side 대칭 pair 임 + 결정적 순수(LLM 무관) 명시(§12).
  - `EvaluationAdjustmentSignals` 를 `./evaluation-adjustments-pipeline` 에서
    `import type` 으로 재사용 — **신규 type 정의 0**(single-source).
  - 순수 함수
    `computeEvaluationAdjustmentSignals(deduped: EvaluationInput[]): EvaluationAdjustmentSignals`
    — orchestrator L177~205 와 **동일 순서**(abuse → update-count → quality →
    underperformer → notable)로 5 detection helper 를 호출한 뒤 그 5 산출을
    `EvaluationAdjustmentSignals` 컨테이너 5 필드(`abuse` / `updateCount` /
    `quality` / `underPerformer` / `notableContribution`)에 동명 매핑해 반환. **위임만
    — 신호 산출 로직 재구현 0**.
  - `deduped` 가 null/undefined 일 때 한국어 `TypeError` throw(메시지에 "deduped"
    토큰 포함). 위임 helper 가 throw 하면 try/catch 없이 그대로 전파(투명성).
  - JSDoc 으로 5 detection 의 책임·각 신호의 의미(abuse 감점·update-count 중립·
    quality floor·underperformer annotation·notable annotation)·결정성·무공유·입력
    비변형 명시. 본 composer 는 dedup 자체를 수행하지 않음(dedup 은 호출 전 단계의
    책임, orchestrator 의 §4 layer)도 명시 — T-0606 composer 의 책임 경계 mirror.
- [ ] 신규 spec `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.spec.ts`
  추가 — **colocated**(R-112 colocated-spec ordering hint).
- [ ] **Happy-path unit test 1+**: 5 detection 신호가 모두 정상인 fixture에서
  `computeEvaluationAdjustmentSignals(deduped)` 가 5 detection helper 의 직접 호출
  결과와 deep-equal 한 `EvaluationAdjustmentSignals` 를 반환(`signals.abuse` ===
  `computeAbuseSignal(deduped)` 와 같은 산출, 5 필드 모두).
- [ ] **Error path unit test 1+**: `deduped` 가 null/undefined → 한국어 `TypeError`
  throw(메시지에 "deduped" 포함). 위임 helper 중 하나가 throw 하는 fixture(예:
  잘못된 `EvaluationInput` shape 가 helper 내부에서 throw) → 그 error 가 본
  composer 를 통해 전파(자체 try/catch 0).
- [ ] **Flow / branch 분기 cover**: (a) 빈 `deduped: []` → 5 필드 모두 빈 신호
  (`computeAbuseSignal([])` 등의 빈 산출) 가 채워진 컨테이너 반환 — throw 0,
  (b) 정상 활동 다수 + 다수 author 의 happy-path 한 fixture에서 5 필드 모두 비-빈
  신호 채워짐 검증, (c) 단일 author 단일 unit 입력에서 5 detection 의 경계값(min-unit
  threshold, 단일 author 평균 → underperformer/notable disjoint 등)을 cover 하는
  fixture 1+ 각 1+ test.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 5 위임 경계마다 분리:
  (1) `deduped` 가 null → TypeError 전파,
  (2) `deduped` 가 undefined → TypeError 전파,
  (3) `deduped` 가 배열 아닌 값(객체/문자열) → 위임 helper guard 에서 throw 전파(본
    composer 의 별도 array check 없음 명시 — 위임 transparent),
  (4) 위임 helper 중 한 detection 이 throw 하는 입력(예: malformed
    `EvaluationInput`) → 그 error 가 그대로 전파(자체 try/catch 0 검증),
  (5) `deduped` 안에 author 가 1 종뿐인 경계(평균이 자기 자신과 같아 underperformer/
    notable 모두 false) → 5 필드 모두 정상 산출, throw 0 각 1+ test.
- [ ] **무변형·결정론·무공유 검증**: 동일 입력 2 회 호출 시 deep-equal(byte-identical)
  산출 + 입력 `deduped` mutate 0(not-same-ref + 입력 원소 mutate 0) + 산출 컨테이너
  객체가 입력과 not-same-ref.
- [ ] **byte-identical 보존 검증**: 임의 fixture 에서 5 detection 을 직접 5 번 호출한
  결과와 본 composer 1 번 호출 결과의 5 필드가 각각 deep-equal — composer 가 위임
  외 어떤 변환도 하지 않음을 박제.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 composer 전 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `evaluation-orchestrator.service.ts` 변경 금지 — orchestrator 가 본 composer 를
  호출하도록 하는 배선은 별도 follow-up slice(파일 disjoint 유지·동시성 보존). 본
  task 는 composer 신설만(T-0606 → T-0607 시퀀스 mirror).
- 5 detection helper(`evaluation-*-signal.ts` / `evaluation-update-count-neutral.ts`)
  변경 금지 — 위임만(재구현 0). 5 helper 의 알고리즘·임계·signal shape 변경 0.
- `evaluation-adjustments-pipeline.ts` 변경 금지 — `EvaluationAdjustmentSignals`
  interface 정의를 `import type` 으로 재사용만(single-source 보존, 재정의 0).
- detection 적용 **순서 정책 변경** 금지 — orchestrator 의 v1 고정 순서(abuse →
  update-count → quality → underperformer → notable)를 그대로 mirror. 5 detection 은
  서로 입력만 공유하고 산출 필드가 직교(필드명도 disjoint)라 순서 무관하지만 v1 순서
  를 박제해 호출부 가독성·미래 분기 분석을 단순화.
- dedup 자체 수행 금지 — 본 composer 는 dedup 후 `EvaluationInput[]` 을 입력으로
  받기만 한다(dedup 은 호출 전 단계의 책임, orchestrator 의 §4 layer).
- DB / 네트워크 / LLM / env 접근 0 — build-time 순수 함수(cloud-safe·dependency-free).
- 새 외부 dependency 0(기존 도메인 type / helper import 재사용만).
- `evaluation-orchestrator.service.spec.ts` 변경 금지 — orchestrator 배선 follow-up
  task 의 책임. 본 task 는 신규 composer 의 colocated spec 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- orchestrator 배선: `EvaluationOrchestratorService.evaluateActivities` 의 inline
  5-detection 호출(L177~205, 5개 `const signal = compute...(deduped)`) 을 본 composer
  `computeEvaluationAdjustmentSignals(deduped)` 단일 호출 1줄 + signals 사용처(L224~230
  의 `applyEvaluationAdjustments` 인자) 의 객체 리터럴 풀이를 단일 변수 참조로 교체.
  5 detection import 제거 + 본 composer import 추가 + JSDoc step 3~3e 다섯 문단을
  한 문단으로 압축. 별도 pr-mode slice — 본 task 머지 후 dependsOn: [T-0608],
  orchestrator service + spec touch.
- 본 composer + post-scoring composer + orchestrator 배선 모두 닫힌 뒤 P5 다음 갭
  (예: PLAN 96~111 의 미체크 bullet 중 단위 commit/document 평가(R-?)·일/주/월 요약
  평가(R-61)·사용자 지정 기간 평가문(R-9)·시간적 중복(R-21) 등) 을 PLAN.md 와 대조해
  다음 task 로.
