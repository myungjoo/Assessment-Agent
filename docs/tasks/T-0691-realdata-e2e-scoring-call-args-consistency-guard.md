---
id: T-0691
title: realdata-e2e evaluate-side scoring-call-args leaf 컴포저 산출 ↔ single-source 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step③ — scoring-call-args leaf 컴포저 정합 가드 신설(T-0687 seed-collect-call-args 가드의 evaluate-side mirror). guard category × 1.5 × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-scoring-call-args-consistency.ts
  - test/helpers/realdata-e2e-scoring-call-args-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-consistency-guard
---

# T-0691 — realdata-e2e evaluate-side scoring-call-args leaf 컴포저 산출 ↔ single-source 재유도 정합 순수 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e)의 build-time consistency 가드 사슬에서 **seed-side** leaf 사슬(run-plan→pipeline-plan→collect-call-args→collect-input)은 가드 신설→self-wire 짝이 모두 닫혔다(T-0677~T-0690). 그러나 **evaluate-side** 의 가장 깊은 호출-args 컴포저 `buildRealDataScoringCallArgs(inputs, modelId)`(T-0579, `realdata-e2e-scoring-call-args.ts`)는 아직 독립 정합 가드가 부재하다(그 파일은 `assertRealData*Consistent` import 0, 가드 파일도 main 에 미존재 — grep 0 확인). 이 컴포저는 평가 입력 `EvaluationInput[]` 의 각 원소에 동일 modelId 를 담은 새 `options` 객체를 페어링해 `{ input, options: { modelId } }`(`RealDataScoringCallArgs`) 로 감싸는 evaluate-side leaf 경계인데 — input reference 누락/뒤섞임, modelId 정책 어긋남(원소마다 다른 modelId·빈/공백 modelId 통과), 원소 drop/추가, options 객체 잉여 필드 누출 같은 합성 회귀를 잡을 가드가 없다. 본 task 는 그 빈칸을 채운다 — seed-side `assertRealDataCollectCallArgsConsistentWithSources`(T-0687) 의 **evaluate-side mirror** 로, 손상된 scoring 호출-args 가 step ③ live runner(scoreUnit 호출)로 새기 전 build-time 에 fail-fast throw 로 차단한다. self-wire 배선은 별도 후속 task(T-0692, dependsOn 본 task)로 짝을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-scoring-call-args.ts` — 가드 대상 evaluate-side leaf 컴포저 `buildRealDataScoringCallArgs(inputs, modelId)`. `RealDataScoringCallArgs` 타입(`{ input: EvaluationInput; options: ScoringOptions }`) + modelId 빈/공백 guard + `inputs.map((input) => ({ input, options: { modelId } }))` 매핑 정책 확인. **본 task 는 이 파일 본문을 수정하지 않는다**(가드는 외부 독립 검증만; self-wire 는 T-0692).
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts` — 신설 가드의 직접 mirror 선례(T-0687). 책임 주석 구조·describe 타입 라벨·구조 가드(TypeError)/값 정합 가드(RangeError) 2-분기 에러 정책·deriveExpected 재유도·deep-equal 비교·fail-fast 순서 패턴을 본 task 와 동형으로 차용. **차이점**: (a) 재유도 source 가 production-위임 매퍼 호출이 아니라 `inputs` reference 직접 페어링(scoring-call-args 는 input 을 복제 않고 reference 그대로 페어링하므로 `expected[i].input === inputs[i]` reference 동등까지 검증 가능), (b) modelId 는 정책 상수가 아니라 **인자로 주입된 단일 값**이라 `callArgs[i].options.modelId === modelId` 동형 적용 + 빈/공백 modelId 시 컴포저와 동일 throw 정책 대조, (c) options 잉여 필드 누출(`{ modelId }` 외) 검사 추가.
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` — 가드 spec 선례(T-0687 colocated spec). describe/it 구성·구조 TypeError·값 RangeError·재유도 throw 전파·happy void·negative 분기별 분리 패턴 차용.
- `src/assessment-evaluation/domain/evaluation-input.ts` — `EvaluationInput` 타입(가드 시그니처 import 재사용, 본문 불변).
- `src/assessment-evaluation/evaluation-scoring.service.ts` — `ScoringOptions` 타입(`{ modelId }`, import 재사용, 본문 불변).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-scoring-call-args-consistency.ts` 신설. `export function assertRealDataScoringCallArgsConsistentWithInputs(callArgs: RealDataScoringCallArgs[], inputs: EvaluationInput[], modelId: string): void` 를 둔다(이름/시그니처는 mirror 선례 명명 규약 정합). 검증 불변식: (1) `callArgs.length === inputs.length`, (2) 각 `callArgs[i].input` 이 `inputs[i]` 와 **reference 동등**(컴포저가 input 을 복제하지 않고 reference 페어링하므로 — deep-equal 이 아니라 `===` 로 reference 보존까지 검증), (3) 각 `callArgs[i].options.modelId === modelId`(주입 modelId 동형 적용), (4) 각 `callArgs[i].options` 가 `{ modelId }` 외 잉여 키 0(options 객체 누출 검사). 재유도/비교만 — 컴포저·production 매퍼 본문 재구현 0. `RealDataScoringCallArgs` 타입은 컴포저 모듈에서 import 재사용(중복 정의 0).
- [ ] 에러 정책 — 구조 결손 = TypeError / 값 정합 위반 = RangeError 2-분기(mirror 선례 정합). `callArgs` 비-배열(null/undefined 포함) · `inputs` 비-배열 · `callArgs` 원소가 객체 아님 · `options` 가 객체 아님 → 한국어 TypeError. 길이 불일치 · input reference drift · modelId 정책 위반 · options 잉여 필드 누출 → 한국어 RangeError(메시지에 어긋난 index/필드 정보 포함). modelId 빈/공백 인자 → 컴포저와 동일 정책으로 throw(빈-가드 정책 drift 0). silent 통과(위반인데 정상 void) 0, fail-fast(가장 먼저 위반한 지점에서 throw).
- [ ] read-only / 순수 계약 — `callArgs` / `inputs` / `modelId` 를 읽기·비교만 한다(mutate 0). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 callArgs 면 항상 void, drift 면 항상 동일 지점에서 throw).
- [ ] happy-path unit test 1+ — colocated spec(`test/helpers/realdata-e2e-scoring-call-args-consistency.spec.ts`)에서 `buildRealDataScoringCallArgs(inputs, modelId)` 의 정상 산출을 본 가드에 통과시키면 void(throw 0)임을 검증. 단일 input / 다수 input / 빈 inputs 배열 각각에 대해(빈 배열 → callArgs 빈 배열 → 가드 void).
- [ ] error path unit test 1+ — 구조 결손 각 분기(callArgs 비-배열·inputs 비-배열·callArgs 원소가 객체 아님·options 가 객체 아님)에서 TypeError throw 검증. 각 분기 1+ test.
- [ ] flow / branch cover — 구조 가드 분기(TypeError 4종)·값 정합 분기(RangeError: 길이 불일치/input reference drift/modelId 정책 위반/options 잉여 필드 누출)·modelId 빈-공백 throw·정상 void 분기마다 test 1+ 로 분리.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) 길이 불일치(callArgs 원소 drop/추가) → RangeError, (2) `callArgs[i].input` 이 `inputs[i]` 와 다른 reference(input drift) → RangeError, (3) `callArgs[i].options.modelId` 가 주입 modelId 와 다른 값 → RangeError, (4) `options` 에 `{ modelId }` 외 잉여 키 주입 → RangeError, (5) modelId 빈/공백 인자 → throw, (6) `options` 가 객체 아님(null/문자열) → TypeError — 각 1+ test. RangeError 메시지에 어긋난 index/필드가 포함되는지도 1+ test 로 검증.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신설 helper line/branch/func/stmt 100% 목표(guard mirror-family 선례대로), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-scoring-call-args-consistency.spec.ts`(가드와 colocated). 새 공용 mock helper 추출 불요 — 기존 EvaluationInput fixture 또는 spec 내부 인라인 fixture + mirror 선례(T-0687) spec 패턴 재사용.

## Out of Scope

- **`buildRealDataScoringCallArgs` 컴포저 본문 수정 / self-wire 배선** — 본 task 는 외부 독립 가드 신설만. 컴포저 반환 직전 self-assert 배선은 별도 후속 task(T-0692, dependsOn 본 task — T-0687→T-0688 짝 패턴 mirror).
- **production `src/` 코드 변경** — `EvaluationInput` / `ScoringOptions` 타입은 import 재사용만(본문 불변). evaluation-scoring.service.ts 등 변경 0.
- **자동 복구 / 재합성 / 정규화 / 기본값 채움** — 손상 callArgs 를 고치거나 silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
- **JSON schema / 외부 validation 라이브러리(zod·ajv) 도입** — 순수 비교만(새 dependency 0).
- **seed-side 가드/컴포저(T-0687/T-0688 등) 변경** — 본 task 는 evaluate-side scoring-call-args seam 만.
- **live execFile / 실 scoreUnit / Ollama / live-LLM(ADR-0045) / 실 modelId resolver 호출(ADR-0048) / credential wiring** — build-time 순수 가드만. 실 평가 실행은 본 task 와 직교.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

architect → implementer → tester (가드 에러 정책 mirror 일관성 점검 후 구현; mirror 선례 명확하면 architect 생략하고 implementer → tester)

## Follow-ups

- T-0692(후속): 본 신설 가드를 `buildRealDataScoringCallArgs` 반환 직전 self-assert 로 배선해 짝 닫기(evaluate-side scoring-call-args self-wire, dependsOn 본 task). T-0688 seed-collect-call-args self-wire 의 evaluate-side mirror.
