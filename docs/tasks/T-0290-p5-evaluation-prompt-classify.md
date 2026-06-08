---
id: T-0290
title: P5 평가 prompt 조립 + LLM narrative → 분류(difficulty/contribution) 파싱 순수 함수
phase: P5
status: DONE
completedAt: 2026-06-09T01:40:00+09:00
prNumber: 242
mergedAs: ef139e2
reviewRounds: 2
commitMode: pr
coversReq: [REQ-009, REQ-025, REQ-037, REQ-038, REQ-097, REQ-032, TBD]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-09
dependsOn: [T-0287, T-0288, T-0289]
plannerSource: "ADR-0032 Follow-ups §2 (LLM scoring service slice) 의 dependency-free 선행 분해 — prompt 조립 + narrative 분류 파싱 순수 함수만, generate 호출/DI 는 후속 service slice"
plannerNote: "P5 네 번째 impl slice — ADR-0032 §2 scoring 의 LLM-무관 piece(prompt builder + narrative→difficulty/contribution 파서)를 순수 함수로 박제. dep 0, LLM mock 0, R-112 4종. 후속 service 가 이 위에 generate 배선."
---

# T-0290 — P5 평가 prompt 조립 + LLM narrative 분류 파싱 (순수 함수)

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) 의 Follow-ups §2 (LLM scoring service slice — `EvaluationInput` → prompt 조립 → `LlmHttpGateway.generate`(difficulty routing) → `EvaluationResult`) 를 **dependency-free 선행 piece** 로 분해한다. T-0287 (`Activity`→`EvaluationInput` 매퍼) + T-0288 (`EvaluationResult` 타입 + `calculateEvaluationVolume` 결정적 volume) + T-0289 (평가-side dedup 순수 함수) 가 전부 MERGED 됐고, 본 task 는 scoring 의 **LLM-무관 순수 함수 2 종** — (1) `EvaluationInput` typed 필드 → prompt 문자열 조립(ADR-0032 §2 — raw 본문 0, REQ-032), (2) LLM `narrative` 문자열 → `difficulty`/`contribution` 분류 파싱(R-97/R-37/R-38) — 을 박제한다.

핵심 가치 — (1) ADR-0032 §2 가 "평가 단위 1 건당 `generate(prompt, options)` 1 회 + prompt 는 typed 필드로만 조립" 으로 박제한 계약 중, **prompt 를 무엇으로 조립하는가**(입력 측)와 **LLM 정성 출력을 어떻게 구조화 분류로 환원하는가**(출력 측)의 두 결정적 변환을 순수 함수로 먼저 박제한다. `LlmHttpGateway.generate` 가 `LlmGenerateResult.narrative`(string) 만 반환하므로(gateway 확장 0 — interface 무변경 재사용), `difficulty`/`contribution` enum 산출은 service 가 narrative 를 파싱하는 책임이며, 그 파싱 규칙을 LLM mock 없이 결정적으로 검증 가능한 순수 함수로 분리하는 것이 본 slice 다. (2) T-0288/T-0289 의 순수-함수-우선 분해 패턴(volume / dedup 을 service 보다 먼저 순수 함수로 박제)을 mirror — DI / `@Injectable` / mock `generate` 의 복잡도를 본 slice 에서 배제하고, 후속 scoring service slice 가 이 두 함수 + `calculateEvaluationVolume` + `generate` 를 **조립(compose)** 만 하도록 만든다. (3) prompt 가 typed 필드만 사용함을 spec 으로 단언해 REQ-032 raw-not-stored 를 평가 입력 차원에서 회귀 방어한다.

본 slice 는 **순수 함수 + colocated spec** 만 — dependency 0 / NestJS `@Injectable` 0 / Prisma 0 / 실 LLM 호출 0 / mock `generate` 0 / DB schema 0 / credential 0 (CLAUDE.md §5 게이트 미발화). `evaluation-volume.ts`(순수 함수 + 방어적 입력 처리 + JSDoc 확장 여지) 패턴을 정확히 mirror.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — **§Decision (2) LLM scoring 입력 shape** + **(3) 난이도·기여도·양 output 산출** (정독 — 본 task 계약 source). 핵심 박제: (a) prompt 는 `EvaluationInput` 의 typed 필드(`contributionKind` / `sourceType` / `metadata` scalar 신호 / `timestamp`)로만 조립 — **commit message 전문 / issue body / page 본문 HTML 절대 미포함(REQ-032)**. (b) `generate` 시그니처 무변경 재사용 — `options.difficulty` 에 분류 결과 주입(R-97 routing). (c) `difficulty`·`contribution` 은 LLM 정성 출력 + 분류 산물, `volume` 은 metadata 결정적 수치(본 task 범위 밖 — T-0288). (d) 구체 산출 방식(narrative 파싱 vs 별도 prompt)은 **impl slice 결정** 으로 위임됐다 — 본 task 가 narrative 파싱 휴리스틱을 박제.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — prompt builder 의 입력 타입. 사용 가능 필드 7 종(`unitId` / `contributionKind` / `sourceType` / `instanceKey` / `author` / `timestamp` / `metadata`). **raw 본문 필드 부재** — prompt 에 넣을 신호는 이 typed surface 뿐.
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — parser 의 출력 타입. `ContributionLevel`(zero/low/medium/high) + `CONTRIBUTION_LEVELS` + `isContributionLevel` 재사용(neue union 정의 금지). parser 는 narrative → `{ difficulty, contribution }` 부분 결과를 산출.
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) — `Difficulty`(easy/medium/hard) + `DIFFICULTIES` + `isDifficulty`. parser 의 difficulty 산출이 이 union 으로 좁혀져야 함. prompt builder 가 `options.difficulty` 로 넘길 값도 이 집합.
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — `generate(prompt: string, options: LlmGenerateOptions): Promise<LlmGenerateResult>` 시그니처 + `LlmGenerateResult.narrative`(string). **본 task 는 이 interface 를 import 하지 않고 string in/out 으로만 동작** — gateway 호출은 후속 service slice. narrative 가 string 임을 확인용으로만 read.
- [src/assessment-evaluation/domain/evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) + [evaluation-volume.spec.ts](../../src/assessment-evaluation/domain/evaluation-volume.spec.ts) — **패턴 mirror source**. 순수 함수 + 방어적 입력 처리(typeof 분기 / 부재 fallback / 비정상 입력 → 안전 default) + JSDoc 확장 여지 명시 + colocated spec(R-112 4 종 + negative + determinism) 정확히 mirror. 본 task 의 spec 위치 = `src/assessment-evaluation/domain/evaluation-prompt.spec.ts` (colocated).
- [src/assessment-evaluation/domain/evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) — 순수-함수 매퍼 머리 주석 / contributionKind 분기 스타일 mirror(설계 맥락 이해용).

## Acceptance Criteria

### 신규 파일 박제

- [ ] **`src/assessment-evaluation/domain/evaluation-prompt.ts` 신설** — 순수 함수 2 종. 부수효과 0 / 외부 의존(NestJS / Prisma / LLM gateway) 0 / `@Injectable` 0 / 실 LLM 호출 0. import 는 도메인 타입(`EvaluationInput` / `ContributionLevel`·`CONTRIBUTION_LEVELS`·`isContributionLevel`) + `Difficulty`·`DIFFICULTIES`·`isDifficulty`(src/llm/difficulty) 만. 파일 머리 주석에 ADR-0032 §2/§3 / REQ-032 / R-37·38 / R-97 정합 + service 조립 책임은 후속 slice 명시.
  - **`buildEvaluationPrompt(input: EvaluationInput): string` — prompt 조립(ADR-0032 §2)**: `EvaluationInput` 의 **typed 필드만** 사용해 결정적 prompt 문자열을 조립한다. 포함 신호 = `contributionKind`(code/document) + `sourceType` + `timestamp` + `metadata` 의 scalar 신호(예: `titleLength`). **raw 본문(commit message/issue body/page HTML) 0** — `EvaluationInput` 에 raw 필드가 없으므로 구조적으로 불가하나, parser 가 metadata 의 임의 scalar 값을 직렬화할 때도 raw 인용으로 오인될 키(`body`/`html`/`message`/`diff`/`content`)를 prompt 에 넣지 않음을 보장(metadata 의 그런 키가 들어와도 무시하거나 길이만 사용). 동일 입력 → 동일 prompt(determinism). JSDoc 에 "포함 신호 enumerate + raw 0 보장 + 확장(별도 prompt 전략)은 후속 slice deferred" 명시.
  - **`classifyNarrative(narrative: string): { difficulty: Difficulty; contribution: ContributionLevel }` — LLM 정성 출력 분류 파싱(R-97/R-37/R-38)**: LLM `narrative` 문자열에서 `difficulty`(easy/medium/hard) + `contribution`(zero/low/medium/high)을 **결정적으로** 추출한다. 파싱 휴리스틱(JSDoc 박제) — narrative 안에 박힌 구조적 marker(예: `difficulty: hard` / `contribution: high` 같은 key:value 라인, case-insensitive)를 우선 추출하고, `isDifficulty`/`isContributionLevel` 로 좁힌다. marker 부재 / 미인식 값 → 안전 default(`difficulty: "medium"`, `contribution: "low"`) 로 fallback(throw 0). 동일 narrative → 동일 분류(determinism). JSDoc 에 "v1 은 marker 기반 휴리스틱 — 구조화 JSON 출력 / 별도 prompt 강제는 후속 service slice 가 정밀화 가능, marker 형식은 후속 prompt 와 정합" 명시.
  - **확장 여지 박제(JSDoc)**: "본 두 함수는 LLM 호출 전(prompt)·후(분류)의 결정적 변환만 — `generate` 호출·`options.difficulty` 주입·`EvaluationResult` 조립(narrative + difficulty + contribution + volume)은 후속 scoring service slice(ADR-0032 Follow-up §2 의 service 부분)가 본 함수 + `calculateEvaluationVolume`(T-0288) 을 compose 한다." 명시.

- [ ] **`src/assessment-evaluation/domain/evaluation-prompt.spec.ts` 신설 (colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2). 각 함수별 describe block 분리:
  - **`buildEvaluationPrompt` happy-path** — code 기여 입력 / document 기여 입력 각각에 대해 prompt 가 `contributionKind`·`sourceType` 신호를 포함함 1+ test 각.
  - **`buildEvaluationPrompt` branch/negative** — (i) `metadata.titleLength` 부재 / number 아님(string/boolean/null)일 때도 throw 0 + 결정적 문자열 반환. (ii) metadata 에 `body`/`html`/`message` 등 raw-오인 키가 들어와도 prompt 에 그 **값 전문이 직렬화되지 않음**(REQ-032 회귀 방어) — prompt 문자열에 해당 raw 값 substring 부재 단언. (iii) contributionKind code vs document 분기 각 1+.
  - **`classifyNarrative` happy-path** — `"difficulty: hard\ncontribution: high"` 류 narrative → `{ difficulty: "hard", contribution: "high" }` 추출 1+ test. case-insensitive(`Difficulty: HARD`) 도 인식 1+.
  - **`classifyNarrative` branch/negative** — (i) marker 부재 narrative(자유 산문) → default `{ medium, low }` fallback. (ii) 미인식 difficulty 값(`difficulty: trivial`) → default medium fallback(`isDifficulty` false 분기). (iii) 미인식 contribution 값(`contribution: amazing`) → default low fallback(`isContributionLevel` false 분기). (iv) 빈 문자열 → default. (v) difficulty 만 있고 contribution 부재(또는 그 반대) → 있는 쪽만 추출, 없는 쪽 default.
  - **branch cover** — `buildEvaluationPrompt` 의 metadata 신호 분기(titleLength number vs 아님) 각 1+. `classifyNarrative` 의 difficulty/contribution marker 인식 분기(인식 / 미인식 / 부재) 각 1+.
  - **determinism** — 두 함수 모두 동일 입력 2 회 호출 → 동일 출력. LLM 의존 0 검증.
  - **type-level** — `classifyNarrative` 반환의 difficulty 가 `DIFFICULTIES` 멤버, contribution 이 `CONTRIBUTION_LEVELS` 멤버임 단언(허용 집합 밖 값 미반환).

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/domain/evaluation-prompt.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 파일(순수 함수)의 line/function/branch 100% 목표(순수 함수라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 회귀 0 확인).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)) + approval-gate (CI step "reviewer agent approval 검증") 통과.
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **scoring service / `@Injectable` / DI / `LlmHttpGateway.generate` 실 호출 또는 mock 호출** — ADR-0032 Follow-up §2 의 service 부분(별도 후속 slice). 본 task 는 LLM 호출 전(prompt)·후(분류 파싱)의 순수 함수만 — `generate` 호출, `options.difficulty` 주입, `EvaluationResult`(narrative + difficulty + contribution + volume) 최종 조립은 후속 service 가 본 함수 + `calculateEvaluationVolume`(T-0288)을 compose. mock `generate` 도입 0.
- **`EvaluationResult` 전체 산출** — 본 task 는 `{ difficulty, contribution }` 부분 결과만. `narrative`(LLM 원문 수용) / `volume`(T-0288) / `unitId` 결합은 service slice.
- **prompt 전략 정밀화 / 구조화 JSON 출력 강제** — v1 은 typed 필드 직렬화 + marker 휴리스틱. 별도 structured-output prompt 전략은 service slice 또는 별도 ADR(본 task 는 결정적 baseline 만).
- **batch / aggregate 평가(일·주·월, PLAN P5 L97)** — 단위 1 건 prompt 만. aggregate batch prompting 은 상위 layer 후속 slice(ADR-0032 §2 batch 경계 박제).
- **난이도 routing 실제 resolve(`DifficultyMappingService`) / provider 분기** — `LlmHttpGateway` 내부 책임(이미 머지). 본 task 는 분류 결과 enum 산출만 — 그 값이 어느 config 로 routing 되는지는 gateway.
- **`EvaluationInput` / `EvaluationResult` / `Difficulty` 타입 변경** — T-0287/T-0288 박제 + difficulty.ts 그대로(본 task 는 import 만, neue union 정의 0).
- **NestJS module / providers 등록 / `assessment-evaluation` module 신설** — 순수 함수 → caller 가 직접 import. Module 등록은 service slice 책임.
- **평가 controller / DTO / endpoint / R-9 사용자 지정 기간** — ADR-0032 Follow-up §5.
- **평가 결과 영속화 / Prisma migration** — §5 schema 게이트 deferred(ADR-0032 §Consequences).
- **PLAN.md L96(단위 평가 bullet) `[ ]`→`[x]` flip** — 본 slice 1 건으로 P5 단위 평가 종료 아님(service + controller + 영속화 후속 필요). 후속 slice 완결 후 별도 doc-sync.

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 §2/§3 가 박제 완료, narrative 파싱 휴리스틱은 impl slice 위임 — 본 task 가 baseline 박제). implementer 가 `evaluation-prompt.ts` 신설(순수 함수 2 종 + JSDoc), tester 가 colocated spec 작성 + R-112 4 종 + negative cover + coverage 100% 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
