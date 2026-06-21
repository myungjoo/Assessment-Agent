---
id: T-0568
title: LlmProviderConfigResolver 실구현 (단일-row + fail-fast) + spec
phase: P5
status: DONE
prNumber: 482
completedAt: 2026-06-21T19:25:00Z
mergeSha: f1dcc7fba563da07aa5bc437a270f40d44bb1b4f
commitMode: pr
coversReq: [REQ-037, REQ-051]
independentStream: q0045-run-side-default-model
dependsOn: []
touchesFiles:
  - src/llm/llm-provider-config-resolver.service.ts
  - src/llm/llm-provider-config-resolver.service.spec.ts
  - src/llm/llm.module.ts
  - src/llm/llm.module.spec.ts
estimatedDiff: 180
estimatedFiles: 4
created: 2026-06-22
plannerNote: P5 bullet106 R-64/REQ-037 — ADR-0048 §Decision1·2 resolver 실구현(단일-row+fail-fast), chain item(1) dependency-free, R-112 backbone ×1.5
---

# T-0568 — LlmProviderConfigResolver 실구현 (단일-row + fail-fast) + spec

## Why

[ADR-0048](../decisions/ADR-0048-default-model-id-source.md) §Decision 1·2 가 박제한 "defaultModelId 의 source = LlmProviderConfig DB row 의 `modelId`, 단일-row 운용 가정 + 비단일 시 fail-fast" 결정을 실코드로 옮기는 첫 slice 다. PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가") Q-0045 옵션1 run-side 사슬의 ADR-이후 첫 구현 조각이며, 후속 DTO 필드 제거(item 2)·controller wiring(item 3)이 본 resolver 에 의존한다 (본 slice 는 dependency-free upstream). ADR-0048 §Out of scope 의 첫 항목 ("resolver layer 실구현 — `@Injectable` + R-112 4 종 spec, ≤300 LOC / ≤5 파일") 을 그대로 cover 한다.

## Required Reading

- `docs/decisions/ADR-0048-default-model-id-source.md` — 본 task 가 구현할 결정 (특히 §Decision 1 흐름 / §Decision 2 의 3 분기 단일-row + fail-fast / §Out of scope 첫 항목 / §Decision 4 새 dep·env·migration 0)
- `src/llm/llm-provider-config.repository.ts` — resolver 가 호출할 `LlmProviderConfigRepository.findMany()` (다중-row 모델, `@unique` 미정의 — line 14~17·69~73)
- `src/llm/llm-provider-config.service.ts` — 기존 `@Injectable` service 패턴 (생성자 DI / repository forward / 한국어 메시지 throw) 의 mirror 대상
- `src/llm/llm.module.ts` — provider/export 등록 위치 (resolver 를 providers + exports 에 추가)
- `src/llm/llm.module.spec.ts` — module 배선 spec 의 기존 형태 (resolver provider 가 DI resolve 되는지 검증 항목 추가)
- `@prisma/client` 의 `LlmProviderConfig` type — row shape (`modelId: string` 필드)

## Acceptance Criteria

- [ ] `src/llm/llm-provider-config-resolver.service.ts` 신설 — `@Injectable() LlmProviderConfigResolver` class. 생성자로 `LlmProviderConfigRepository` 를 DI 주입. public 메서드 1 개 (예: `async resolveDefaultModelId(): Promise<string>`) 가 `repository.findMany()` 호출 후 ADR-0048 §Decision 2 의 3 분기를 구현:
  - (a) `length === 1` → 그 row 의 `modelId` 반환
  - (b) `length === 0` → 한국어 메시지로 throw (운영자 LLM provider 설정 누락 — 예: "LLM provider 가 설정되지 않았다")
  - (c) `length >= 2` → 한국어 메시지로 throw (다중-row 운용 — 명시적 default 선택 정책 미박제, 후속 ADR 필요)
- [ ] 단일-row 의 `modelId` 가 비어있는 경우 (빈 문자열 / non-string) 도 fail-fast — `buildFillRunScoringOptions` 의 invariant (defaultModelId 가 항상 채워져 있음) 를 깨지 않도록 빈/형식 위반 시 한국어 throw (ADR-0048 §Decision 2·§Out of scope: type mismatch negative case).
- [ ] `src/llm/llm.module.ts` 에 `LlmProviderConfigResolver` 를 `providers` 와 `exports` 양쪽에 등록 (assessment-evaluation 의 controller wiring task(item 3)가 LlmModule import 로 inject 받을 수 있도록). 등록 의도 한국어 주석 1~2 줄.
- [ ] **Happy-path unit test**: `resolveDefaultModelId()` 가 단일-row (length 1) 일 때 그 row 의 `modelId` 를 반환하는 test 1+. repository 는 Jest mock (`findMany` mock return) — DB 실연결 불필요.
- [ ] **Error path unit test**: (b) length 0 throw / (c) length ≥ 2 throw 각각의 한국어 메시지·throw 를 검증하는 test 1+ 씩.
- [ ] **Flow / branch coverage**: 위 3 분기 (length 1 / 0 / ≥2) + modelId 빈/형식 위반 분기 각각 별도 test 로 cover (분기마다 1+).
- [ ] **Negative cases 충분 cover**: (i) length 0, (ii) length ≥ 2 (예: 2 와 3 중 1+), (iii) length 1 이지만 modelId === "" (빈 문자열), (iv) repository.findMany 가 reject (DB 장애 — 의존성 실패 propagate) 각 1+ test. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] `src/llm/llm.module.spec.ts` 에 `LlmProviderConfigResolver` 가 module 에서 정상 DI resolve 됨을 검증하는 항목 1+ 추가.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 resolver 가 coverage threshold 를 미달시키지 않음.

## Out of Scope

- `UnevaluatedFillRunRequestDto.defaultModelId` 필드 제거 — **chain item (2)** (별도 pr-mode task). 본 slice 는 DTO 무변경.
- `AssessmentEvaluationController.runUnevaluatedFill` 의 resolver 호출 + service inject wiring — **chain item (3)** (별도 pr-mode task). 본 slice 는 controller 무변경.
- resolver 의 row 부재/비단일 시 HTTP status (503 / 500 / 400) 매핑 — ADR-0048 §Out of scope: controller wiring task(item 3) 책임. 본 slice 는 한국어 Exception/TypeError throw 까지만 (HTTP status 변환 0).
- schema 변경 / `isDefault` 컬럼 / `@@unique` 추가 — ADR-0048 §Decision 4: schema migration 0. 절대 건드리지 않는다 (CLAUDE.md §5 게이트).
- 새 env var (예: `LLM_DEFAULT_PROVIDER_CONFIG_ID`) / 새 dependency 도입 — ADR-0048 §Decision 4: 새 env 0 / 새 dep 0.
- 다중-row default 선택 정책 (isDefault / env pointer / updatedAt / per-provider) 구현 — REQ-051 진입 시 별도 follow-up ADR 책임.
- resolver layer 를 repository 가 아닌 `LlmProviderConfigService` 위에 얹는 변형 — ADR-0048 §Decision 1 이 명시적으로 `LlmProviderConfigRepository.findMany()` 호출을 박제했으므로 repository 직접 의존으로 구현 (service 의 apiKey redaction view 는 modelId resolve 에 불필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (chain item 2) `UnevaluatedFillRunRequestDto.defaultModelId` 필드 제거 + spec/e2e fixture 갱신 (pr-mode). 본 resolver merge 후 큐잉.
- (chain item 3) `AssessmentEvaluationController.runUnevaluatedFill` wiring 변경 — resolver 1 회 호출 후 `unevaluatedFillRunOrchestrator.run(rawBridges, modelId, resolvedDefaultModelId)` 로 inject + resolver row 부재/비단일 시 HTTP status (503/400) 매핑 (pr-mode). item 2 후 큐잉.
- (REQ-051 진입 시) 다중-row default 선택 정책 후속 ADR (ADR-0048 §Decision 2 의 4 검토 대상 중 택1).
- PLAN.md P5 bullet 106 chain 완결 doc-sync (별도 direct doc commit) — 위 3 item 머지 후.
