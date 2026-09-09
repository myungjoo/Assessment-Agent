---
id: T-2005
title: 사전 난이도 routing opt-in 의 fail-fast 전파 cross-layer 회귀 spec (ADR-0065 §Follow-ups (b))
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-09-10
independentStream: llm-difficulty
dependsOn: [T-2004]
touchesFiles:
  - src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts
plannerNote: "P5 REQ-050 — ADR-0065 §Follow-ups (b) 집행: 실 gateway+mapping chain 의 슬롯 미설정 4xx 전파 회귀 spec"
---

# T-2005 — 사전 난이도 routing opt-in 의 fail-fast 전파 cross-layer 회귀 spec

## Why

[ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) `§ Decision 3` 은 "opt-in ON 경로에서 발생한 슬롯 미설정 4xx 를 **가리지 않고 그대로 전파**한다(silent fallback 금지)" 와 "OFF 기본 경로는 슬롯이 미설정이어도 **회귀가 구조적으로 0**" 이라는 두 주장을 얹고 있는데, 집행 slice (a)([T-2004](T-2004-input-difficulty-rule-injection.md), main `10f2c18d`)의 spec 은 **`gateway.generate` 를 통째로 mock 한 reject** 로만 그 주장을 확인했다. 즉 4xx 를 실제로 발생시키는 주체인 [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `99~125 행` `resolveModel` fail-fast chain 과 그 error 를 중계하는 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `112~117 행` routing 분기는 **평가 경로와 한 번도 이어붙여 검증된 적이 없다**. 본 task 는 ADR-0065 `§ Follow-ups (b)` 대로 scoring → gateway → mapping 3 layer 를 실제 객체로 조립한 **spec-only 회귀 slice** 로 그 공백을 닫는다([docs/PLAN.md](../PLAN.md) `183 행` REQ-050 잔여 축).

**issue-still-relevant pre-check (origin/main `5c9560e4` 기준, 2026-09-10 실측)**

1. `git grep -n "new LlmHttpGateway" origin/main -- src test` = 8 hit 이며 전부 (i) [llm-http-gateway.service.spec.ts](../../src/llm/llm-http-gateway.service.spec.ts) `140 행` · `334 행`(gateway 단독, `DifficultyMappingService` 를 mock) 또는 (ii) `test/smoke/*live*` 계열(실 credential gated) 이다 — **평가 layer(`EvaluationScoringService`)와 실 gateway 를 함께 조립한 spec 은 0**.
2. `git ls-tree -r --name-only origin/main | grep -i difficulty` 에 `evaluation-scoring.difficulty-routing.spec.ts` 는 **없다**(파일명 충돌 0).
3. [evaluation-scoring.service.spec.ts](../../src/assessment-evaluation/evaluation-scoring.service.spec.ts) `268~331 행` 의 opt-in 4 test 는 `makeGateway()`(`63~69 행`)가 만든 `{ generate: jest.Mock }` 을 쓴다 — `resolveModel` 은 호출되지 않으므로 4xx **발생원**은 미검증. 본 task 는 그 4 test 를 **중복하지 않고** 실 객체 chain 만 새로 다룬다.
4. [difficulty-mapping.service.spec.ts](../../src/llm/difficulty-mapping.service.spec.ts) 는 `resolveModel` 5 분기를 단독으로 cover 하나 **호출자(평가 경로)로부터의 전파**는 다루지 않는다 — 두 spec 사이의 이음매가 본 task 의 대상이다.
5. ADR-0065 `§ Follow-ups` 의 남은 항목 중 (a) 는 T-2004 로 머지 완료, (c) doc-sync 는 "(a) · (b) 전량 머지 후 1 회" 라 **(b) 가 현 시점 유일한 actionable 잔여**다.

## Required Reading

- [docs/decisions/ADR-0065-difficulty-routing-activation.md](../decisions/ADR-0065-difficulty-routing-activation.md) — `§ Decision 2` (i) 주입 지점 · (ii) 사전/사후 난이도 비대칭 · `§ Decision 3`(기본 OFF opt-in, ON 경로 4xx 그대로 전파 · silent fallback 기각) · `§ Follow-ups (b)`(본 task 가 집행하는 3 항목 (i)(ii)(iii)).
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `47~56 행`(`ScoringOptions.useInputDifficultyRouting`) · `97~116 행`(`scoreUnit` 의 `generateOptions` 삼항 분기와 `gateway.generate` 호출) · `117 행`(사후 `classifyNarrative`).
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `73~91 행`(생성자 4 인자 = repository · cipher · difficultyMappingService · `FetchLike`) · `60~72 행`(`FetchLike` 시그니처) · `100~130 행`(`options.difficulty === undefined` 분기 → `resolveModel().configId` vs `options.modelId`, 이후 `repository.findById`).
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `75~84 행`(생성자 2 repository) · `99~130 행`(`resolveModel` 5 분기 — 미지원 난이도 / 슬롯 row 부재 / FK null / 가리킨 config 부재 → `BadRequestException("difficulty model not configured: <d>")` / happy `ResolvedModel`).
- [src/llm/llm-http-gateway.service.spec.ts](../../src/llm/llm-http-gateway.service.spec.ts) `22~99 행`(provider 별 raw config row fixture 서식 — `apiKey` 는 ciphertext placeholder) · `106~155 행`(`makeGateway` harness: repository / cipher.decrypt / difficultyMappingService / 주입 `fetchFn` mock 조립 패턴) · `160~230 행`(fetch 호출 인자 검사 assertion 패턴). **본 spec 이 mirror 할 harness 원형** — spec 간 import 는 하지 않고 필요한 fixture 를 새 파일 안에 자립적으로 재정의한다.
- [src/llm/difficulty-mapping.service.spec.ts](../../src/llm/difficulty-mapping.service.spec.ts) `27~50 행`(`DifficultyMapping` · `LlmProviderConfig` fixture 5·7 컬럼 서식) · `55~70 행`(collaborator mock factory 패턴).
- [src/assessment-evaluation/evaluation-scoring.service.spec.ts](../../src/assessment-evaluation/evaluation-scoring.service.spec.ts) `20~48 행`(`codeInput` / `documentInput` fixture) · `49 행`(`OPTIONS`) · `52~75 행`(`generateResult` / `makeService`) · `268~331 행`(기존 opt-in 4 test — **중복 금지 경계**).
- [src/assessment-evaluation/domain/evaluation-input-difficulty.ts](../../src/assessment-evaluation/domain/evaluation-input-difficulty.ts) `17~33 행`(export 상수 `DEFAULT_INPUT_DIFFICULTY` · `TITLE_LENGTH_EASY_MAX` · `TITLE_LENGTH_HARD_MIN` · `HARD_SCORE_MIN` 등) · `52 행`(`resolveInputDifficulty`) — routing 대상 난이도를 매직값 없이 산출하는 source.
- [src/assessment-evaluation/domain/evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `50 행`(`DIFFICULTY_MARKER`) · `155~168 행`(`classifyNarrative`) — mock narrative 가 만들 사후 분류값의 근거.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts` 가 신설되고, 그 안에서 **`EvaluationScoringService` · `LlmHttpGateway` · `DifficultyMappingService` 3 개를 실제 class 로 `new`** 하여 조립한다. mock 은 **최말단 2 repository(`DifficultyMappingRepository` · `LlmProviderConfigRepository`) + `LlmApiKeyCipher.decrypt` + 주입 `FetchLike`** 뿐이다. 검증: `git grep -n "new EvaluationScoringService\|new LlmHttpGateway\|new DifficultyMappingService" src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts` 가 3 hit 이상, 같은 파일에 `jest.mock(` 은 0 hit.
- [ ] **happy-path** — opt-in ON + 3 슬롯 정상 설정: `scoreUnit` 이 성공하고 (i) `findByDifficulty` 가 `resolveInputDifficulty(input)` 값으로 **정확히 1 회** 호출 (ii) `repository.findById` 가 **슬롯이 가리킨 configId**(= `options.modelId` 가 **아닌** 값)로 호출 (iii) 주입 `fetchFn` 이 **정확히 1 회** 호출(ADR-0032 `48 행` generate × 1 유지)됨을 각각 assert 한다. `easy` · `hard` 로 routing 되는 입력 각 1+ (임계 상수 `TITLE_LENGTH_EASY_MAX` · `TITLE_LENGTH_HARD_MIN` 을 import 해 매직넘버 0).
- [ ] **error path (예외 분기마다 negative 1+)** — opt-in ON 에서 `resolveModel` 의 3 미설정 분기를 각각 재현해 `scoreUnit` 이 `BadRequestException` 을 **그대로 throw** 함을 확인한다: (i) 슬롯 row 부재(`findByDifficulty` → `null`) (ii) FK null(`llmProviderConfigId: null`) (iii) 가리킨 config 부재(`LlmProviderConfigRepository.findById` → `null`). 각 case 에서 **주입 `fetchFn` 이 0 회 호출**(네트워크 이전 fail-fast)이고 `EvaluationResult` 가 **조립되지 않는다**(부분 결과 위장 0, silent fallback 0 — ADR-0065 `§ Decision 3`).
- [ ] **분기 (OFF 회귀 보호)** — opt-in **미지정** 과 **`false`** 두 경우 각 1+ test 로, 슬롯이 **전부 미설정**(`findByDifficulty` 가 `null` 만 반환)인 환경에서도 `scoreUnit` 이 **성공**하고 `findByDifficulty` 가 **0 회** 호출되며 `findById` 가 `options.modelId` 로 조회됨을 assert 한다(ADR-0065 `§ Decision 3` 의 "회귀 구조적으로 0" 주장의 회귀 test).
- [ ] **negative — 사전/사후 난이도 비대칭** — opt-in ON 이고 routing 난이도가 `hard` 인 입력에 대해 mock narrative 가 `easy` 를 표기하면, `resolveModel` 인자는 `hard` 인 반면 반환 `EvaluationResult.difficulty` 는 **사후 `classifyNarrative` 값(`easy`)** 임을 한 test 에서 동시에 assert 한다(ADR-0065 `§ Decision 2` (ii) — 사전 난이도가 결과로 새지 않음).
- [ ] **negative — 결정성 / 부수효과 0** — 동일 입력으로 `scoreUnit` 을 2 회 호출하면 `findByDifficulty` 인자가 두 호출 모두 동일하고 결과 객체가 `toEqual` 로 같음을 assert 한다.
- [ ] 신규 spec 이 [evaluation-scoring.service.spec.ts](../../src/assessment-evaluation/evaluation-scoring.service.spec.ts) `268~331 행` 의 기존 4 test 를 **복제하지 않는다** — 새 파일의 모든 test 는 `resolveModel` 실 구현을 경유한다(`describe` 문자열에 cross-layer 범위 명시).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(R-110 — implementer 후 tester 필수. production 변경 0 LOC 여도 예외 없음).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(`package.json` `coverageThreshold.global`, branches 90 / statements 90 포함 전역 threshold 유지).
- [ ] `git diff --name-only origin/main` 결과가 frontmatter `touchesFiles` **1 파일** 과 정확히 일치한다(`src/` production · `prisma/` · `package.json` · `web/` · `docs/` 변경 0).

## Out of Scope

- **production 코드 수정 전량** — 본 task 는 **spec-only** 다. [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) · [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) · [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) 를 **한 줄도 고치지 않는다**. spec 이 어떤 결함을 드러내면 고치지 말고 `Follow-ups` 에 적는다(CLAUDE.md `§3`).
- **opt-in 을 켜는 호출자 배선** — controller · orchestrator · fill-run 경로에서 `useInputDifficultyRouting: true` 를 넘기는 변경 금지. 운영 기본값은 OFF 그대로다(ADR-0065 `§ Decision 3`, 운영 설정화는 후속 ADR 선행).
- **e2e / smoke spec 신설** — 실 DB(`test/e2e`) · 실 network(`test/smoke/*live*`) 경로는 본 slice 범위 밖이다. ON 을 켜는 production 호출자가 없어 HTTP 경계에서 재현할 수 없다.
- 기존 spec 파일 수정 — [evaluation-scoring.service.spec.ts](../../src/assessment-evaluation/evaluation-scoring.service.spec.ts) · [llm-http-gateway.service.spec.ts](../../src/llm/llm-http-gateway.service.spec.ts) · [difficulty-mapping.service.spec.ts](../../src/llm/difficulty-mapping.service.spec.ts) 는 **읽기 전용 참고**다(fixture 는 새 파일에 재정의, spec 간 import 금지).
- `test/helpers/` 공용 harness 추출 — 현재 소비처가 1 개뿐이라 추출 근거가 없다(2+ spec 이 공유하게 되면 그때 별도 slice).
- 요약 경로([summary-narrative.service.ts](../../src/assessment-evaluation/summary-narrative.service.ts) `104~108 행`) — ADR-0065 `§ Decision 4` 가 범위 밖으로 확정.
- [docs/requirements.md](../requirements.md) REQ-050 재판정 · [docs/architecture/modules.md](../architecture/modules.md) doc-sync — ADR-0065 `§ Follow-ups (c)` 가 (a) · (b) 전량 머지 후 **1 회** 로 예약(오너 [docs/PLAN.md](../PLAN.md) `183 행` once-rule).
- `prisma/schema.prisma` · migration(§5), 새 외부 dependency(§5), `web/` 변경, perf spec 신설(오너 [docs/PLAN.md](../PLAN.md) `158 행`).

## Suggested Sub-agents

`tester → implementer` (spec-only slice — tester 가 주 작성자, implementer 는 harness 조립 보조)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
