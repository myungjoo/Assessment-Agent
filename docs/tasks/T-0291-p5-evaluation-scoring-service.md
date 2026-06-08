---
id: T-0291
title: P5 평가 scoring service — EvaluationInput → prompt → generate(mock) → EvaluationResult 조립
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-025, REQ-037, REQ-038, REQ-097, REQ-032, TBD]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-06-09
dependsOn: [T-0287, T-0288, T-0290]
plannerSource: "ADR-0032 Follow-ups §2 (LLM scoring service slice) 의 service 부분 — 선행 piece(T-0287 매퍼 / T-0288 result+volume / T-0290 prompt+classify) 가 전부 MERGED, 본 slice 가 그것을 compose 하는 @Injectable scoring service"
plannerNote: "P5 다섯 번째 impl slice — ADR-0032 §2 scoring service. 기존 순수 함수 4종 + LlmGateway.generate(test mock) compose. dep 0, live call 0, R-112 4종. controller/DTO·영속화는 deferred."
---

# T-0291 — P5 평가 scoring service (EvaluationInput → EvaluationResult)

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) 의 Follow-ups §2 (LLM scoring service slice — `EvaluationInput` → prompt 조립 → `LlmHttpGateway.generate`(difficulty routing) → `EvaluationResult`) 의 **service 부분**을 박제한다. 선행 dependency-free piece 가 전부 MERGED 됐다 — T-0287(`Activity`→`EvaluationInput` 매퍼), T-0288(`EvaluationResult` 타입 + `calculateEvaluationVolume` 결정적 volume), T-0289(평가-side dedup), T-0290(`buildEvaluationPrompt` + `classifyNarrative` 순수 함수). 본 task 는 그 순수 함수들과 기존 `LlmGateway.generate` 를 **조립(compose)** 하는 단 하나의 `@Injectable` scoring service 를 박제한다 — ADR-0032 §2 가 박제한 "평가 단위 1 건당 `generate(prompt, options)` 1 회 호출" 계약을 실제 호출 경로로 구현하되, gateway 는 **test 에서 mock** 한다(실 LLM 호출 0 / live credential 0 / 새 외부 dependency 0).

핵심 가치 — (1) ADR-0032 §2/§3 의 scoring 흐름(`buildEvaluationPrompt` → `generate(prompt, { difficulty })` → `classifyNarrative(narrative)` → `calculateEvaluationVolume(input)` → `EvaluationResult` 5 필드 조립)을 in-process 로 완결한다. 지금까지 `LlmHttpGateway` 는 자기 test 외 caller 가 0 이었는데, 본 service 가 첫 평가-layer caller 가 된다. (2) 본 slice 는 **thin orchestration** — 새 알고리즘이 아니라 이미 검증된 순수 함수 5 종의 compose 다. 따라서 `classifyNarrative` 의 difficulty 결과를 `generate` 호출의 `options.difficulty` 로 주입해 R-97 난이도 routing(ADR-0011)을 그대로 driving 하는 순서(분류 전에 routing 을 위해 난이도가 필요한가 vs 분류는 narrative 산물인가)의 결정만 본 service 가 명확히 박제한다. (3) gateway 를 `LlmGateway` interface(DI token) 로 주입받아 test 에서 mock `generate` 로 검증 — live endpoint / API key 불필요, CI 비용/flaky 0, §5 게이트 미발화.

본 slice 는 **service 1 + module 등록 + colocated spec** 만 — 실 LLM 호출 0 / live credential 0 / 새 외부 dependency 0 / DB schema·Prisma migration 0 / controller·DTO·endpoint 0 (CLAUDE.md §5 게이트 미발화). gateway 는 기존 `LlmGateway` 계약을 그대로 재사용(interface 확장 0), test 에서 mock 주입.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — **§Decision (2) LLM scoring 입력 shape** + **(3) 난이도·기여도·양 output 산출** + **§Follow-ups (LLM scoring service slice)** (정독 — 본 task 계약 source). 핵심 박제: (a) 평가 단위 1 건당 `generate(prompt, options)` 1 회 호출 default(단순·결정적·실패 격리). (b) `generate` 시그니처 무변경 재사용 — `options.difficulty` 에 분류 결과 주입(R-97 routing). (c) `difficulty`·`contribution` 은 LLM 정성 출력 + 분류 산물, `volume` 은 metadata 결정적 수치. 셋을 한 `EvaluationResult` 로 묶음. (d) batch/aggregate 평가(일·주·월)는 상위 layer 후속 slice — 본 task 는 단위 1 건만.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — service 의 입력 타입 `EvaluationInput`(7 필드). `unitId` 가 `EvaluationResult.unitId` 로 전사돼야 함(결과 ↔ 입력 trace).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — service 의 출력 타입 `EvaluationResult`(5 필드: `unitId`/`narrative`/`difficulty`/`contribution`/`volume`). neue 타입 정의 0 — 이 타입을 그대로 조립.
- [src/assessment-evaluation/domain/evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) — compose 대상 순수 함수 2 종. `buildEvaluationPrompt(input): string` + `classifyNarrative(narrative): { difficulty, contribution }`. service 는 이 둘을 import 해 호출만 — 재구현 0.
- [src/assessment-evaluation/domain/evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) — compose 대상 순수 함수 `calculateEvaluationVolume(input): number`. service 가 `volume` 필드 산출에 호출.
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — `LlmGateway`(DI 계약 — `generate(prompt, options): Promise<LlmGenerateResult>`) + `LlmGenerateOptions`(`modelId` 필수 + `difficulty?` 선택) + `LlmGenerateResult`(`narrative`/`provider`/`modelId`). **service 는 이 `LlmGateway` interface 를 DI 로 주입받는다**(구현체 `LlmHttpGateway` 직접 의존 대신 interface 의존 — test mock 용이). `options.difficulty` 에 `classifyNarrative` 의 difficulty 를 주입할지, 별도 사전 분류가 필요한지 본 service 가 결정·박제.
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — `LlmHttpGateway` 가 `LlmGateway` 계약 구현체로 등록·export 됨(L36/L58/L66 참조). 본 service 의 module 이 `LlmModule` 을 import 하고 `LlmHttpGateway` 를 `LlmGateway` DI token 으로 주입받는 wiring 패턴 확인. (gateway provider 등록 / DI token 선언 방식은 implementer 가 기존 module 패턴 mirror — 새 token 도입이 ADR-worthy 라 판단되면 architect 선행, 단 기존 `LlmHttpGateway` export 재사용이면 ADR 불요.)
- [src/assessment-evaluation/domain/evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) — 평가 layer 머리 주석 / 책임 경계 표기 스타일 mirror(설계 맥락 이해용).

## Acceptance Criteria

### 신규 파일 박제

- [ ] **`src/assessment-evaluation/evaluation-scoring.service.ts` 신설** — `@Injectable` scoring service. `LlmGateway` interface 를 생성자 주입(구현체 `LlmHttpGateway` 직접 import 의존 금지 — interface/DI token 의존으로 test mock 용이). 단일 public 메서드(예: `scoreUnit(input: EvaluationInput): Promise<EvaluationResult>`):
  - **흐름(ADR-0032 §2/§3 compose)**: `buildEvaluationPrompt(input)` 로 prompt 조립 → `gateway.generate(prompt, options)` 1 회 호출(`options.modelId` 필수 + `options.difficulty` 주입 정책 박제 — 분류가 narrative 산물이므로 사전 난이도가 없으면 `options.difficulty` 미주입 또는 service 정책에 따라 결정, 그 결정을 JSDoc 에 명시) → 반환 `narrative` 를 `classifyNarrative(narrative)` 로 `{ difficulty, contribution }` 추출 → `calculateEvaluationVolume(input)` 로 `volume` 산출 → `EvaluationResult` 5 필드(`unitId`(=input.unitId 전사) / `narrative` / `difficulty` / `contribution` / `volume`) 조립 반환.
  - **modelId 결정 정책**: `generate` 가 요구하는 `options.modelId` 를 무엇으로 채울지 박제(예: input 에서 도출 불가하므로 메서드 파라미터로 받거나 service 설정값). 본 slice 가 단위 1 건 scoring 책임이므로 modelId source 를 JSDoc 으로 명시(난이도 routing 과의 관계 포함). 단순화를 위해 `scoreUnit(input, options?)` 형태로 caller 가 modelId/difficulty 를 넘기게 하는 것도 허용 — 단 그 계약을 JSDoc 에 박제.
  - **순수 함수 재구현 금지**: prompt 조립 / 분류 / volume 은 기존 함수 import 호출만. service 는 compose + gateway 호출만 담당.
  - 파일 머리 주석에 ADR-0032 §2/§3 / Follow-up §2(service) 정합 + 책임 경계(controller/DTO·영속화·batch 는 후속 slice) 명시.
- [ ] **`src/assessment-evaluation/assessment-evaluation.module.ts` 신설(또는 기존 평가 module 이 없으므로 신설)** — `EvaluationScoringService` 를 provider 등록 + export. `LlmModule`(또는 `LlmHttpGateway` export 모듈) 을 import 해 `LlmGateway` 주입 해소. NestJS module 패턴(`llm.module.ts`) mirror. 본 module 은 평가 service 만 등록 — controller 등록 0(후속 slice).
- [ ] **`src/assessment-evaluation/evaluation-scoring.service.spec.ts` 신설(colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2). gateway 는 **mock 객체**(`{ generate: jest.fn() }` 형태 또는 `Test.createTestingModule` + `overrideProvider`)로 주입 — **실 LLM 호출 0 / 실 네트워크 0 / live credential 0**:
  - **happy-path** — mock `generate` 가 `{ narrative: "difficulty: hard, contribution: high", provider, modelId }` 반환 시 `scoreUnit` 이 `unitId`/`narrative`/`difficulty: "hard"`/`contribution: "high"`/`volume`(metadata 기반) 5 필드를 올바르게 조립함 1+ test (code 입력 / document 입력 각 1+).
  - **gateway 호출 검증** — `generate` 가 정확히 1 회 호출되고(ADR-0032 §2 단위 1 건당 1 회), prompt 인자가 `buildEvaluationPrompt(input)` 결과와 일치하며, `options.modelId`(+ difficulty 주입 정책대로) 가 전달됨 1+ test.
  - **error path** — mock `generate` 가 reject(network/timeout/non-2xx → throw) 시 `scoreUnit` 의 동작(전파 throw 인지 fallback 인지)을 박제·검증 1+ test. service 의 error 정책을 JSDoc 과 일치하게 단언.
  - **branch/negative** — (i) `narrative` 가 marker 부재 자유 산문이면 `classifyNarrative` default(`medium`/`low`)로 조립됨 1+. (ii) `metadata.titleLength` 부재/비-number 면 `volume === 0` 으로 조립됨 1+. (iii) 미인식 difficulty/contribution marker → default fallback 으로 조립됨 1+. (iv) `unitId` 가 input 그대로 전사됨(빈 문자열 등 경계 입력) 1+.
  - **branch cover** — contributionKind code vs document 분기, difficulty 주입 정책 분기(있으면) 각 1+.
  - **determinism / no-side-effect** — 동일 input + 동일 mock 응답 → 동일 `EvaluationResult` 2 회 호출 1+.

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/evaluation-scoring.service.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 service 의 line/function/branch 높은 커버리지 목표(thin compose 라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 회귀 0 확인 — 실 LLM 호출 없으므로 smoke/e2e 영향 0).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)) + approval-gate (CI step "reviewer agent approval 검증") 통과.
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **실 LLM 호출 / live endpoint / 실 provider API key / LLM_APIKEY_ENC_KEY 주입** — gateway 는 test 에서 **mock** 만. 실 네트워크 round-trip / live credential 은 §5 credential 게이트(미승인) → 별도 후속 task(deferred). 본 slice 는 mocked `generate` 로만 검증해 CI 비용/flaky 0.
- **새 외부 dependency 추가** — `LlmGateway`(기존 interface) + 기존 순수 함수 4 종 + NestJS 만. octokit/axios/sdk 등 추가 0 (§5 dependency 게이트 미발화).
- **`LlmGateway.generate` 시그니처 / interface 변경** — 무변경 재사용(ADR-0032 §2). gateway 확장 0.
- **평가 controller / DTO / endpoint / R-9 사용자 지정 기간** — ADR-0032 Follow-up §5(별도 후속 slice). 본 slice 는 service 만 — HTTP layer 0.
- **평가 결과 영속화 / Prisma migration / `EvaluationResult` → Assessment·Contribution row 매핑** — §5 schema 게이트 deferred(ADR-0032 §Consequences). 본 slice 는 in-memory `EvaluationResult` 반환만 — DB write 0.
- **batch / aggregate 평가(일·주·월, PLAN P5 L97)** — 단위 1 건 scoring 만. aggregate batch prompting 은 상위 layer 후속 slice(ADR-0032 §2 batch 경계 박제).
- **평가-side dedup / self-follow-up 제외 적용** — T-0289 의 순수 함수는 별도 layer(여러 단위의 사전 필터). 본 service 는 단위 1 건 scoring 만 — dedup 호출은 상위 orchestrator 후속 slice 책임.
- **`Activity` → `EvaluationInput` 매핑 호출** — T-0287 매퍼는 본 service 입력 준비 단계(상위 orchestrator). 본 service 는 이미 정규화된 `EvaluationInput` 을 받음.
- **`EvaluationInput`/`EvaluationResult`/`Difficulty`/순수 함수 시그니처 변경** — 전부 박제 완료(import 만, neue 정의 0).
- **PLAN.md L96(단위 평가 bullet) `[ ]`→`[x]` flip** — 본 slice 1 건으로 P5 단위 평가 종료 아님(controller + 영속화 후속 필요). 후속 slice 완결 후 별도 doc-sync.

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 §2/§3/§Follow-ups 가 박제 완료, service 는 기존 순수 함수 + gateway 의 thin compose). 단 implementer 가 `LlmGateway` 주입을 위해 **신규 DI token 도입**(기존 `LlmHttpGateway` export 재사용이 아니라 별도 provide token)이 필요하다고 판단하면 그 결정만 architect ADR 선행(기존 module export 재사용이면 ADR 불요). implementer 가 `evaluation-scoring.service.ts` + `assessment-evaluation.module.ts` 신설, tester 가 colocated spec 작성 + mock gateway + R-112 4 종 + negative cover + coverage 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
