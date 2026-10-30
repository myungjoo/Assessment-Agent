---
id: T-2073
title: 최근 N일 재수집 ⑤ — 기본 provider 의 config id 로 평가해 활동 있는 좌표가 실제로 저장되게 한다
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 9e888f07
prNumber: 1634
reviewRounds: 2
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 90
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2072]
touchesFiles: [src/llm/llm-provider-config-resolver.service.ts, src/llm/llm-provider-config-resolver.service.spec.ts, src/scheduling/recent-deletion-runner.service.ts, src/scheduling/recent-deletion-runner.service.spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑤. e2e 작성 중 발견한 결함. 설계 결정은 T-2069
---

# T-2073 — config id 로 평가

## Why

T-2074 e2e 를 쓰다 활동 있는 좌표가 언제나 실패하는 것을 재현했다. `LlmProviderConfigResolver.resolveDefaultModelId()` 는 row 의 `modelId` (예: `test-model`) 를 돌려주는데, `LlmHttpGateway.generate` 는 difficulty 가 없으면 `options.modelId` 를 **config id** 로 조회한다 (`llm-http-gateway.service.ts` `112~122 행`). 그래서 `LLM provider config 를 찾을 수 없습니다 (id: test-model)` 로 실패한다. 수집이 끝나도 평가가 실패하므로 재수집은 활동 있는 좌표를 하나도 교체하지 못한다.

이 흐름에는 config id 를 돌려주는 `resolveDefaultConfigId()` 를 쓴다. 판정 규칙 (슬롯 우선 · row 수 fallback) 은 그대로 공유한다.

## Required Reading

- `src/llm/llm-provider-config-resolver.service.ts`, `src/llm/llm-http-gateway.service.ts` `99~122 행`.

## Acceptance Criteria

- [ ] `resolveDefaultConfigId` 는 `resolveDefaultModelId` 와 같은 row 를 골라 그 `id` 를 돌려주고, 같은 오류를 낸다.
- [ ] `resolveDefaultModelId` 의 동작은 바뀌지 않는다.
- [ ] 재수집 runner 는 `{ modelId: <config id> }` 로 평가한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- tick · fill-run 호출부 수정. 오너 지시 범위 밖이라 아래 Follow-up 으로 남긴다.

## Follow-ups

- (owner, 높음) `EvaluationTickRunnerService` (`88 행`) 와 `POST /unevaluated-fill-run` (`assessment-evaluation.controller.ts` `784 행`) 은 여전히 `resolveDefaultModelId` 를 gateway 의 config id 자리에 넘긴다. config id 와 modelId 가 같지 않으면 **활동 있는 좌표의 자동 평가가 모두 실패** 한다. `deploy/seed-llm-config.sh` 의 기본값은 id `seed-local-llm` 이라 둘이 다르다. 기존 e2e 는 "쓸 수 있는 LLM 이 없어 실패" 를 기대값으로 삼아 드러나지 않았다. 호출부를 `resolveDefaultConfigId` 로 바꾸면 고쳐진다.
