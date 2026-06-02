---
id: T-0167
title: LlmGenerateOptions.difficulty JSDoc 를 T-0165 난이도 routing wiring reality 로 정합
phase: P4
status: DONE
commitMode: pr
prNumber: 154
mergedAs: 2e5d725
reviewRounds: 1
completedAt: 2026-06-02T14:15:00+09:00
coversReq: [REQ-097]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 dependency-free 잔여 마지막 — T-0165 머지로 difficulty 가 active routing 입력이 됐으나 interface JSDoc 가 "placeholder·매핑 로직 0" 로 stale. comment-only, §5 미발화.
---

# T-0167 — LlmGenerateOptions.difficulty JSDoc 를 T-0165 난이도 routing wiring reality 로 정합

## Why

[PLAN.md](../PLAN.md) Phase P4 L86 "**3가지 난이도 모델 할당** (R-97 / REQ-097)" 의 런타임 wiring 은 T-0165 (PR-153, 머지 commit `78fa7e7`) 로 완결됐다. `LlmHttpGateway.generate()` 가 이제 `options.difficulty` 가 주어지면 `DifficultyMappingService.resolveModel(difficulty)` 로 그 난이도 슬롯의 `configId` 를 해석해 config 를 routing 한다 — `difficulty` 는 더 이상 placeholder 가 아니라 **active routing 입력**이다.

그러나 [llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) L50~52 의 `LlmGenerateOptions.difficulty` JSDoc 은 여전히 *"DifficultyMapping (T-0136) 연동의 placeholder. 본 task 는 매핑 로직 0, 옵션 shape 만 박제"* 로 기술한다. 이는 머지된 reality 와 **정면으로 모순**된다 ("매핑 로직 0" → 실제로는 gateway 가 이 필드로 routing 수행). `LlmGateway` interface 는 gateway 를 건드리는 모든 코드의 DI 계약이자 가장 먼저 읽히는 symbol 이므로, 이 comment drift 는 향후 평가 파이프라인 wiring 시 "placeholder 라 미구현" 으로 오독돼 이미 존재하는 routing 을 재구현하는 비용을 유발할 수 있다. 본 task 는 그 단일 JSDoc 절을 reality 로 정합하는 comment-only 수정이다.

이 작업은 **dependency-free** — comment-only edit, 새 외부 dependency 0 / 외부 credential 0 / schema 변경 0 / 동작 (런타임) 변경 0 / 새 public symbol 0 / §5 미발화.

## Required Reading

- `src/llm/llm-gateway.interface.ts` L44~53 — 수정 대상 `LlmGenerateOptions` 와 `difficulty?` JSDoc (현재 "placeholder ... 매핑 로직 0" 문구).
- `src/llm/llm-http-gateway.service.ts` L93~117 (머지된 reality, commit `78fa7e7`) — `generate()` 의 `options.difficulty === undefined ? options.modelId : resolveModel(...).configId` routing 분기. 정합 문구의 정확성 근거.
- `docs/tasks/T-0165-llm-gateway-difficulty-routing.md` — T-0165 의 정확한 변경 범위 (resolve hop 연결만, interface 시그니처 불변).

## Acceptance Criteria

- [ ] `src/llm/llm-gateway.interface.ts` 의 `difficulty?` 필드 JSDoc 을 reality 로 정합: `difficulty` 가 제공되면 gateway 구현 (`LlmHttpGateway`) 이 `DifficultyMappingService.resolveModel(difficulty)` 로 그 난이도 슬롯의 `configId` 를 해석해 routing 하고, 미제공 시 `options.modelId` 를 직접 사용함을 명시 (T-0165, REQ-097). "placeholder" / "매핑 로직 0" 같은 stale 표현 제거.
- [ ] `difficulty?: string` 의 **타입 / optional 여부 / 필드명은 불변** — 시그니처 변경 0 (comment 본문만 수정).
- [ ] 동작 (런타임) 변경 0 / 새 public symbol 0 / 새 분기 0 — comment-only. 따라서 신규 unit test 불요 (분기 없음 — R-112 happy/error/branch/negative 항목은 새 symbol·새 분기 부재로 해당 사항 없음, 본 task 본문에 "동작 변경 0 — 신규 test 면제" 명시 근거). 기존 spec 회귀만 보장.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (R-110 — pr-mode 는 production code 변경 0 LOC 여도 tester 가 lint/build/test 결과 확인 의무). 기존 coverage line ≥ 80% / function ≥ 80% 유지 (comment 수정이라 coverage 수치 영향 0).
- [ ] 다른 파일 변경 0 — `llm-gateway.interface.ts` 1 파일만 수정. interface spec (`llm-gateway.interface.spec.ts`) 의 describe/it 문자열이 "placeholder" 를 인용하지 않으면 무변경; 인용 시에만 동일 정합 (그 경우에도 동일 파일군 cap 내).

## Out of Scope

- `LlmGenerateOptions` 에 새 필드 추가 (예: temperature / maxTokens) — 별도 follow-up.
- `difficulty` 를 string → 전용 union/enum (`"easy" | "medium" | "hard"`) 으로 타입 강화 — 시그니처 변경이라 별도 task (난이도 검증은 현재 `DifficultyMappingService.resolveModel` 의 `isDifficulty` 가 런타임 담당, interface 타입 강화는 독립 결정).
- gateway 구현 (`llm-http-gateway.service.ts`) / spec / schema / 다른 doc 파일 수정 — 본 task 는 interface JSDoc 정합만.
- 실 LLM HTTP 통합 / credential / env 주입 (§5 게이트, 미승인 유지).
- modules.md / api.md 추가 수정 — T-0166 (modules.md) 이 이미 difficulty routing 을 박제했고 api.md 는 endpoint-level 변경 없음.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — T-0135 interface + T-0165 routing 결정 이미 박제, 본 task 는 comment 정합만. commitMode pr 이므로 R-110 에 따라 tester 가 lint/build/test 확인 의무).

## Follow-ups

(생성 시 비어 있음. sub-agent 가 발견 시 append:)
