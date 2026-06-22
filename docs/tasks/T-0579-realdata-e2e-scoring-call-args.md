---
id: T-0579
title: 실 평가 e2e EvaluationInput[] → scoreUnit 호출-args 묶음 순수 빌더
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-22
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-scoring-call-args.ts
  - test/helpers/realdata-e2e-scoring-call-args.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step③ 경계 — EvaluationInput[] + modelId → scoreUnit(input, options) 호출-args 묶음 순수 빌더. cloud-safe·dependency-free."
---

# T-0579 — 실 평가 e2e EvaluationInput[] → scoreUnit 호출-args 묶음 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 **step ③(평가) 경계**를 순수 함수로 분해하는 chain 의 다음 slice 다. 직전 slice 들(T-0573 ~ T-0578)은 step ①(seed) → step ②(수집 호출-args / personId 치환) → step ②→③ 경계(`Activity[]` → `EvaluationInput[]`) 까지 build-time 결정론적으로 박제했다. T-0578 helper 가 산출하는 `EvaluationInput[]` 은 step ③ `EvaluationScoringService.scoreUnit(input, options)` 의 **첫 인자** 만 채울 뿐, 두 번째 인자 `options: ScoringOptions = { modelId: string }` 은 caller(상위 orchestrator)가 결정해 주입해야 한다(`evaluation-scoring.service.ts` L42~49 박제 — modelId 는 입력 단위가 아니라 평가 정책 차원의 선택).

ADR-0048(ACCEPTED, T-0567/T-0571) 가 modelId 의 source 를 server-side `LlmProviderConfigResolver` 단일 source 로 결정했으므로, build-time 에는 그 resolver 가 돌려줄 단일 modelId 값(또는 placeholder) 을 받아 **각 `EvaluationInput` 에 동일 modelId 를 매핑**한 `Array<{ input, options }>` 호출-args 묶음을 산출하면 된다. 이는 T-0577 의 `collectForPerson(person, since, assessmentId)` 호출-args 빌더와 동형 패턴 — step ③ runner 가 받을 호출-args 형태를 build-time 에 미리 고정해 검증 가능하게 만든다.

본 task 는 그 순수 빌더 `buildRealDataScoringCallArgs(inputs: EvaluationInput[], modelId: string): RealDataScoringCallArgs[]` 를 추가한다. 입력 `EvaluationInput[]` 의 각 원소 마다 동일 modelId 를 담은 `ScoringOptions` 를 페어링해 새 배열을 반환한다. 실 LLM round-trip(Ollama LAN=AKIHA 192.168.0.5)·`scoreUnit` 호출·gateway 주입·credential 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env 접근 0 의 순수 매퍼라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0578-realdata-e2e-evaluation-inputs.md` — 직전 chain slice 의 패턴·범위 경계·문서 스타일.
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — 동형 패턴 helper(호출-args 묶음 빌더). 헤더 주석 구조·순수성/무공유 박제·import 재사용 컨벤션·placeholder 처리(본 helper 의 modelId 정책 박제 시 mirror).
- `test/helpers/realdata-e2e-evaluation-inputs.ts` — 본 task 의 입력(`EvaluationInput[]`) source 인 직전 slice 의 helper. 산출물 shape 와 import 경로 확인.
- `src/assessment-evaluation/evaluation-scoring.service.ts` (L37~L100) — 본 task 가 args 를 build 할 대상 함수 `scoreUnit(input, options)` 의 시그니처 + `ScoringOptions` interface(L46~L49, `modelId: string` 단일 필드) + modelId source 정책(L42~L49 주석, ADR-0032 §2).
- `src/assessment-evaluation/domain/evaluation-input.ts` (L52~L75) — `EvaluationInput` interface(7 필드). 입력 타입 import 경로(중복 정의 금지).
- `docs/decisions/ADR-0048-default-model-id-source.md` — modelId 의 source 가 server-side `LlmProviderConfigResolver` 단일 source 임을 박제한 ADR. 본 helper 가 받는 `modelId` 는 그 resolver 결정값(또는 build-time placeholder)임을 본문/주석에서 박제.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-scoring-call-args.ts` 에 순수 함수 `buildRealDataScoringCallArgs(inputs: EvaluationInput[], modelId: string): RealDataScoringCallArgs[]` 추가. 입력 `EvaluationInput[]` 의 각 원소에 대해 `{ input, options: { modelId } }` 형태의 호출-args 묶음을 생성해 새 배열로 반환한다. 순서 보존 의무.
- [ ] `RealDataScoringCallArgs` interface 박제 — `{ input: EvaluationInput; options: ScoringOptions }` shape(`scoreUnit(input, options)` 시그니처와 1:1 정합). `ScoringOptions` 는 production `evaluation-scoring.service.ts` 에서 import 재사용(중복 정의 0).
- [ ] **타입 재사용** — `EvaluationInput` 은 `src/assessment-evaluation/domain/evaluation-input.ts` 에서, `ScoringOptions` 는 `src/assessment-evaluation/evaluation-scoring.service.ts` 에서 import 재사용한다(새 type 정의 0).
- [ ] **입력 mutate 0 / 무공유 보장** — 매 호출이 새 배열 + 새 `options` 객체를 반환하고, 입력 `inputs` 배열·원소·문자열 modelId 를 변형하지 않는다. spec 으로 입력 참조 불변 + 반환 배열 / `options` 객체가 호출마다 다른 reference 임을 검증.
- [ ] **modelId 정책 박제** — 헤더 주석에 ADR-0048 server-side resolver 단일 source 정책 + 본 helper 는 그 resolver 결정값(또는 build-time placeholder)을 받는 build-time 매퍼라는 책임 경계를 명시. 본 helper 안에서 실 resolver 호출은 하지 않음(Out of Scope).
- [ ] **빈/공백 modelId guard** — modelId 가 빈 문자열 또는 공백만으로 구성된 경우 명시적 throw(조용한 통과 차단, T-0575/T-0576 의 placeholder/identity guard 패턴 mirror). spec 으로 throw 검증.
- [ ] **Happy-path unit test 1+** — 다양한 `Activity` 종(github commit/pr/issue + confluence page)을 섞은 `EvaluationInput[]` fixture 입력에 대해 각 원소가 `{ input: <원소 그대로>, options: { modelId: <전달값> } }` 로 변환되고 순서·길이가 보존됨을 검증.
- [ ] **Error/negative path test** — (a) 빈 입력 배열(`[]` → `[]` 반환), (b) 단일 원소 배열, (c) modelId 빈 문자열 throw, (d) modelId 공백만 throw 등 각 분기/경계마다 cover. 단일 negative 만으로 부족.
- [ ] **Flow / branch coverage** — `inputs` 비어있음 / 단일 / 다수 분기 + modelId guard 분기(유효 / 빈 / 공백)가 전부 cover. 본 helper 자체의 추가 분기는 modelId guard 1 개 외 없음(배열 매핑만)을 spec 주석으로 명시.
- [ ] **무공유 회귀 test** — 반환된 `options` 객체를 mutate(예: `options.modelId = "tampered"`)한 뒤 동일 입력으로 재호출 시 결과 불변(공유 mutable 상태 노출 0) + 두 호출의 `options` reference 가 서로 다름 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 매퍼 + guard 만이므로 100% 지향.

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / scoring 실행 / `EvaluationResult` 산출(step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- `LlmProviderConfigResolver` 실 호출 / DB lookup / modelId 실 결정(ADR-0048 server-side resolver — 본 helper 는 build-time 에 결정값을 인자로 받기만 함).
- 평가 결과 영속화 / `EvaluationResult` → `Contribution` row 매핑 / Prisma write(별도 후속 slice / §5 schema 게이트).
- 난이도별 routing(R-97) — 본 helper 는 단일 modelId 를 모든 unit 에 동형 적용. 난이도별 routing 은 별도 후속 slice(input 별 difficulty 사전 확정 필요).
- 실 LLM round-trip / `LlmGateway` mock 주입 / scoring service test(별도 unit / e2e test 책임).
- `deploy/daily-test.sh` 의 `step_eval` wiring(step ④, ADR-0045 LAN gate).
- production `src/` 코드 변경(`evaluation-scoring.service.ts` 등) — 본 task 는 test helper 단독(타입·interface import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
