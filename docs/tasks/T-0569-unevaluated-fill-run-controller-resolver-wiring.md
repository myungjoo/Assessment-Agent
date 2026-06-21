---
id: T-0569
title: runUnevaluatedFill controller wiring — resolver inject + defaultModelId 해석 (DTO 필드 미제거)
phase: P5
status: DONE
mergedAs: b50accb
prNumber: 483
reviewRounds: 2
completed: 2026-06-21T20:32:16Z
commitMode: pr
coversReq: [REQ-037, REQ-051]
independentStream: q0045-run-side-default-model
dependsOn: [T-0568]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-21
plannerNote: P5 bullet106 R-64/REQ-037 — ADR-0048 chain item(3) controller wiring(resolver 호출+503/400 매핑). item(2) DTO 제거 전 선행(controller dto.defaultModelId 참조 제거 필요). R-112 backbone ×1.5
---

# T-0569 — runUnevaluatedFill controller wiring (resolver inject + defaultModelId 해석)

## Why

[ADR-0048](../decisions/ADR-0048-default-model-id-source.md) §Decision 1·2 가 박제한 "defaultModelId 의 source = LlmProviderConfig row 의 modelId (단일-row + 비단일 fail-fast)" 결정을 `AssessmentEvaluationController.runUnevaluatedFill` 진입점에 배선하는 chain item (3) 이다. PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가") Q-0045 옵션1 run-side 사슬의 controller wiring slice이며, 직전 머지된 `LlmProviderConfigResolver` (T-0568, PR #482 squash f1dcc7f) 를 controller 가 1 회 호출해 default modelId 를 server-side 에서 해석하도록 바꾼다.

**ordering 결정 (item 3 이 item 2 보다 선행)**: 현재 controller 는 `dto.defaultModelId` 를 직접 읽어 orchestrator 에 forward 한다 (controller.ts line 527). chain item (2) 의 `UnevaluatedFillRunRequestDto.defaultModelId` 필드 제거를 먼저 하면 이 참조가 TS compile error 로 build 를 깨뜨린다. 따라서 본 task (item 3) 가 controller 의 `dto.defaultModelId` 참조를 resolver 호출로 교체한 **뒤**에야 DTO 필드 제거(item 2)가 안전해진다. 본 task 는 DTO 를 건드리지 않으므로 (필드는 남되 controller 가 더 이상 읽지 않음) build·spec 양쪽 안전하다.

## Required Reading

- `docs/decisions/ADR-0048-default-model-id-source.md` — §Decision 1 (controller 진입 시 resolver 1 회 호출 후 service inject) / §Decision 2 (단일-row + 0-row·2+row fail-fast) / §Out of scope 3·4 항목 (controller wiring task = resolver 호출 + row 부재/비단일 HTTP status 매핑 책임) / §Cross-Module Impact (orchestrator.run 시그니처 무변경)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — line 143~175 생성자 DI (resolver 주입 추가 위치) + line 512~529 `runUnevaluatedFill` (resolver 호출 + `dto.defaultModelId` → resolved 교체 대상)
- `src/llm/llm-provider-config-resolver.service.ts` — T-0568 머지된 `LlmProviderConfigResolver` 의 public 메서드 시그니처 (`resolveDefaultModelId(): Promise<string>` — row 0/2+ 시 한국어 throw, 빈/non-string modelId fail-fast). controller 가 호출할 대상
- `src/assessment-evaluation/assessment-evaluation.module.ts` — line 69 `imports: [LlmModule, ...]` (이미 LlmModule import 됨 → resolver 는 LlmModule 이 export 하므로 **module 배선 변경 0**, 생성자 주입만으로 inject 가능)
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — line 2130~2330 의 `runUnevaluatedFill` 기존 spec (orchestrator mock { run } 주입 패턴, happy/negative 분기). resolver mock 추가 + defaultModelId source 변경에 맞춰 갱신할 대상

## Acceptance Criteria

- [ ] `AssessmentEvaluationController` 생성자에 `LlmProviderConfigResolver` 를 DI 주입 (LlmModule 이 이미 import·export 됨 → module 파일 변경 0). 주입 의도 한국어 주석 1~2 줄 (resolver 가 default modelId 의 server-side source, ADR-0048 §Decision 1).
- [ ] `runUnevaluatedFill` 를 변경 — request 진입 시 `await this.llmProviderConfigResolver.resolveDefaultModelId()` 1 회 호출로 default modelId 를 해석한 뒤, orchestrator 에 `dto.modelId` (override) + 해석된 defaultModelId 를 forward 한다. **`dto.defaultModelId` 직접 참조 제거** (line 527) — 이후 production code 에서 DTO 의 defaultModelId 를 읽는 곳이 0 이 되어 chain item (2) DTO 필드 제거가 안전해진다.
- [ ] resolver 가 throw 하는 경우 (0-row / 2+row / 빈·non-string modelId) 를 HTTP status 로 매핑 — ADR-0048 §Out of scope: row 부재/비단일 시 **503 ServiceUnavailable** (운영자 LLM provider 미설정/다중-row 미박제 = 일시적 서비스 불가) 로 매핑. resolver 의 한국어 메시지를 status 에 담아 진단성 보존. (resolver 가 던지는 plain Error/TypeError 를 controller 가 catch → `ServiceUnavailableException` 으로 re-throw, 또는 resolver 가 이미 Nest HttpException 을 던지면 그대로 전파 — 구현 시 resolver 의 실제 throw 타입을 보고 결정. 매핑 방식은 한국어 주석으로 박제.)
- [ ] **Happy-path unit test**: 단일-row resolve 성공 시 (resolver mock 이 modelId 반환) `runUnevaluatedFill` 이 orchestrator.run 을 `(rawBridges, dto.modelId, resolvedDefaultModelId)` 로 호출하고 결과를 그대로 반환하는 test 1+. resolver·orchestrator 둘 다 jest mock — 실 LLM/DB/네트워크 0.
- [ ] **Error path unit test**: resolver 가 reject/throw 할 때 (0-row / 2+row) controller 가 503 (ServiceUnavailableException) 으로 매핑하고 orchestrator.run 을 **호출하지 않는** test 1+ 씩 (resolver fail 시 평가 사슬 미진입).
- [ ] **Flow / branch coverage**: (a) resolver 성공 → orchestrator 호출 분기, (b) resolver throw → 503 매핑 + orchestrator 미호출 분기, (c) `dto.modelId` 지정 vs 미지정(undefined) override 분기 (resolved default 와 무관하게 dto.modelId 가 그대로 forward 됨) 각 1+ test.
- [ ] **Negative cases 충분 cover**: (i) resolver 0-row throw → 503, (ii) resolver 2+row throw → 503, (iii) resolver 가 빈/non-string modelId 로 throw → 503, (iv) resolver 성공했으나 orchestrator.run 이 reject → raw 전파 (swallow 0, resolver fail 과 구분), (v) dto.modelId === undefined 일 때 resolved default 만으로 정상 호출 각 1+ test. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] 기존 `runUnevaluatedFill` spec 의 `defaultModelId` 를 dto 에서 읽던 fixture/assertion 갱신 — 이제 source 가 resolver 이므로 orchestrator.run 의 3 번째 인자는 dto.defaultModelId 가 아니라 resolver 가 반환한 값임을 검증 (line 2207·2243 류 assertion 수정). DTO 자체는 변경하지 않으므로 DTO spec (`unevaluated-fill-run-request.dto.spec.ts`) 은 본 task 에서 건드리지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — controller wiring 변경이 coverage threshold 를 미달시키지 않음.

## Out of Scope

- `UnevaluatedFillRunRequestDto.defaultModelId` 필드 제거 + `unevaluated-fill-run-request.dto.spec.ts` 갱신 — **chain item (2)** (별도 pr-mode task, 본 task merge 후 큐잉). 본 slice 는 DTO 무변경 (필드는 남되 controller 가 더 이상 읽지 않음 — item 2 가 안전하게 제거).
- e2e fixture (`*.e2e-spec.ts`) 의 `defaultModelId` body 필드 갱신 — item (2) 가 DTO 제거와 함께 동시 처리 (본 task 는 controller unit spec 까지만, e2e 무변경).
- resolver 자체 구현/수정 — T-0568 에서 이미 머지됨. 본 task 는 resolver 를 **호출만** 한다 (resolver 의 분기 로직 재구현 0).
- HTTP status 를 503 이 아닌 다른 값 (500 / 400) 으로 매핑하는 정책 변경 — ADR-0048 §Out of scope 이 "503/500/400 중 택1 은 controller wiring task 책임" 으로 위임했고 본 task 가 503 으로 박제. 다른 status 로의 변경은 별도 결정.
- schema 변경 / 새 env / 새 dependency — ADR-0048 §Decision 4: 어느 축도 미발화. 절대 건드리지 않는다 (CLAUDE.md §5 게이트).
- 다중-row default 선택 정책 구현 — REQ-051 진입 시 별도 follow-up ADR 책임 (본 task 는 2+row 를 503 fail-fast 로만 처리).
- live-LLM round-trip 배선검증 — LAN 수동 1 회 (ADR-0045), cloud cron 무경로. 본 task 의 build·unit 은 resolver/orchestrator mock 으로 LLM 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (chain item 2) `UnevaluatedFillRunRequestDto.defaultModelId` 필드 제거 + dto.spec / e2e fixture 갱신 (pr-mode). 본 task merge 후 큐잉 — controller 가 더 이상 dto.defaultModelId 를 읽지 않으므로 안전.
- (REQ-051 진입 시) 다중-row default 선택 정책 후속 ADR (ADR-0048 §Decision 2 의 4 검토 대상 중 택1).
- PLAN.md P5 bullet 106 chain 완결 doc-sync (별도 direct doc commit) — item 2·3 머지 후.

## Result (DONE)

- **완료**: 2026-06-21T20:32:16Z · PR [#483](https://github.com/myungjoo/Assessment-Agent/pull/483) squash merge `b50accb` · reviewRounds=2.
- **round 1** (`ba0aecb`): controller 에 `LlmProviderConfigResolver` DI 주입 + `runUnevaluatedFill` 가 `resolveDefaultModelId()` 를 orchestrator 위임 전 1 회 await + `dto.defaultModelId` 직접 참조 제거 + resolver throw(0-row/2+row/빈·non-string) → 503 `ServiceUnavailableException`(한국어 메시지·cause 보존). reviewer round1 APPROVE 였으나 CI 게이트(d) red — wiring 변경이 T-0566 e2e 의 구 계약(빈 좌표 200 / whitespace defaultModelId 500)을 깨뜨림(e2e DB 에 `LlmProviderConfig` row 0 → resolver throw 503).
- **round 2** (`1fd19a5`): e2e 를 새 계약에 정합 — `beforeEach` 단일 `LlmProviderConfig` row seed(→ 200 happy path 회복) + obsolete whitespace→500 케이스를 "row 부재 → 503 resolver fail-fast" 로 재정의 + reviewer MINOR nit(non-Error catch 분기 미커버) 를 unit test 로 cover(controller.ts 100%). 4-게이트 PASS → merge.
- **DTO 필드 미제거** (의도) — chain item 2 가 안전하게 제거 가능해짐 (controller 가 더 이상 읽지 않음).
