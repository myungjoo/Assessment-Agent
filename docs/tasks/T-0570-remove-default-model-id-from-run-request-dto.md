---
id: T-0570
title: UnevaluatedFillRunRequestDto 의 defaultModelId 필드 제거 (request body) + spec·e2e fixture 갱신
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-051]
estimatedDiff: 130
estimatedFiles: 4
independentStream: q0045-run-side-default-model
dependsOn: [T-0569]
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
  - test/e2e/unevaluated-fill-run.e2e-spec.ts
created: 2026-06-22
plannerNote: P5 bullet106 ADR-0048 §Decision3 chain item(2) — request body defaultModelId 필드 제거; T-0569 머지로 controller 가 dto.defaultModelId 미참조라 안전
---

# T-0570 — UnevaluatedFillRunRequestDto 의 defaultModelId 필드 제거

## Why

[ADR-0048 §Decision 3](../decisions/ADR-0048-default-model-id-source.md) 은 `UnevaluatedFillRunRequestDto.defaultModelId!` 필드를 **제거**하기로 확정했다 — default modelId 의 source 는 caller(request body)가 아니라 server-side resolver(`LlmProviderConfigResolver`)가 `LlmProviderConfig` DB row 에서 단일 해석한다(ADR-0045 §Decision 1 정합). 직전 chain item(3) T-0569(PR #483 squash b50accb, **머지 완료**)가 controller 를 resolver 로 배선해 `runUnevaluatedFill` 이 더 이상 `dto.defaultModelId` 를 읽지 않으므로, 본 필드 제거가 안전해졌다. 본 task 는 P5 bullet 106 / Q-0045 옵션1 run-side 사슬의 chain item(2)다.

## Required Reading

- `docs/decisions/ADR-0048-default-model-id-source.md` (§Decision 3 필드 제거 + §Implementation "DTO 필드 제거 + spec 갱신 — 1 slice")
- `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts` (제거 대상 필드 + decorator + 주석)
- `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts` (colocated spec — defaultModelId 관련 케이스 제거/갱신 대상)
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` (`makeRunDto` builder ~L2174, ValidationPipe negative 블록 ~L2487, "dto.defaultModelId source 아님" 테스트 ~L2277)
- `test/e2e/unevaluated-fill-run.e2e-spec.ts` (`validEmptyBody()` ~L91, defaultModelId 누락 400 negative 테스트 ~L189, fixture 박제 주석 ~L87)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` L526~569 (참조: controller 가 이미 `resolvedDefaultModelId` 만 쓰고 `dto.defaultModelId` 미참조임을 확인 — 변경 불요)

## Acceptance Criteria

- [ ] `unevaluated-fill-run-request.dto.ts` 에서 `defaultModelId!` 필드 + 그 `@IsString`/`@IsNotEmpty` decorator + 관련 주석을 제거한다. 결과 DTO 는 `rawBridges`(필수 nested 배열) + `modelId?`(선택) 2 축만 보유. 미사용 import 정리(필요 시).
- [ ] DTO 상단 문서 주석에서 defaultModelId 를 3 축으로 설명하던 부분을 2 축(rawBridges/modelId) 으로 갱신하고, default 의 source 는 server-side resolver(ADR-0048)임을 1 줄 명시한다.
- [ ] **Happy-path test**: `unevaluated-fill-run-request.dto.spec.ts` 에서 rawBridges + modelId 유효 payload → error 0 (defaultModelId 없이도 통과)을 검증.
- [ ] **Error path test**: rawBridges 누락 / non-array / nested PeriodBridgeDto 위반 / modelId 빈 문자열 케이스가 여전히 error 를 내는지 유지. **defaultModelId 누락/빈 문자열/non-string 케이스는 제거**(필드가 없어졌으므로) — 단, payload 에 defaultModelId 를 넣어도 더 이상 error 없이 무시(또는 controller-scope whitelist 거부)됨을 negative 로 1+ 추가.
- [ ] **Branch/flow test**: modelId 미지정 vs 지정 vs null / rawBridges 빈 배열 vs 다수 분기 케이스 유지.
- [ ] **Negative cases**: ① defaultModelId 를 보내도 DTO 단독 validate() 는 무시(unknown 처리)함 1+, ② controller.spec 의 ValidationPipe 블록에서 정의 외 필드(이제 defaultModelId 포함) 가 whitelist+forbidNonWhitelisted 로 거부되는지 검증(controller-scope pipe 계약) 1+. 단일 negative 금지 — 예외 분기마다 cover.
- [ ] `assessment-evaluation.controller.spec.ts` 의 `makeRunDto` fixture 에서 `defaultModelId` 제거. "dto.defaultModelId 값과 무관하게 resolver 반환값 forward" 테스트는 resolver source 권위 검증 의도를 유지하되 dto 에 defaultModelId 를 넣지 않는 형태로 갱신(또는 의도가 중복이면 제거하고 happy 테스트가 resolved source 검증을 cover 하는지 확인). ValidationPipe negative 블록의 defaultModelId 누락/빈 문자열 케이스를 제거하고 defaultModelId 가 unknown field 로 거부되는 케이스로 재정의.
- [ ] `test/e2e/unevaluated-fill-run.e2e-spec.ts` 의 `validEmptyBody()` + 모든 fixture 에서 `defaultModelId` 제거. "defaultModelId 누락 시 400" negative 테스트는 제거(필드가 없어졌으므로 그 400 분기 소멸 — ADR-0048 §Decision 3 명시). row 부재 → 503 / happy 200 케이스의 body 는 defaultModelId 없이도 동작하는지 확인(controller 가 server-side 해석하므로 영향 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] tester 가 e2e(`pnpm test:e2e`) 의 unevaluated-fill-run spec 도 green 확인 (R-113).

## Out of Scope

- controller.ts(`runUnevaluatedFill`) 변경 — 이미 T-0569 가 `resolvedDefaultModelId` 만 사용하고 `dto.defaultModelId` 미참조라 변경 불요. 만지지 말 것.
- orchestrator/core/`buildFillRunScoringOptions`/repository/gateway 의 `defaultModelId` 인자 — server-side path 의 인자명이라 그대로 유지(ADR-0048 §Consequences "변경 없는 layer").
- `LlmProviderConfigResolver` 변경 — 별개 slice(T-0568 머지 완료).
- PLAN.md bullet 106 chain 완결 doc-sync — chain item(5), 본 task 머지 후 별도 direct task.
- REQ-051 다중-row default 정책 후속 ADR — chain item(4), deferred.
- 비어있지-않은 좌표 live-LLM round-trip 1회 — chain item(6), 수동/LAN 후속.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(생성 시 비어있음)
