---
id: ADR-0048
title: "defaultModelId 의 source — LlmProviderConfig DB row 의 modelId (단일-row 운용 + 다중-row 분기는 후속 ADR 로 deferred)"
status: ACCEPTED
date: 2026-06-21
relatedTask: [T-0567, T-0568, T-0569, T-0570]
relatedPR: [482, 483, 484]
supersedes: null
augments: [ADR-0045]
relatedReq: [REQ-037, REQ-051]
---

# ADR-0048 — defaultModelId 의 source (LlmProviderConfig DB row 에서 해석)

> 본 ADR 은 **ACCEPTED** — P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가") Q-0045 옵션1 run-side 사슬의 마지막 미해결 결정인 **"defaultModelId 를 어디서·어떻게 해석하는가"** 를 박제한다. 결정안의 구현 사슬은 resolver(T-0568, PR #482) · controller resolver wiring(T-0569, PR #483) · request body `defaultModelId` 필드 제거(T-0570, PR #484 squash c2e7c0c)로 전부 머지돼 닫혔으며, 남은 후속은 REQ-051 다중-row default 정책 ADR(deferred) + 비어있지-않은 좌표 live-LLM round-trip 1회(LAN 수동 검증)뿐이다. [ADR-0045](ADR-0045-llm-provider-deployment-config.md) §Decision 1 ("LLM provider = 배포-환경 설정, source = `LlmProviderConfig` row") 을 보강(augment)한다.

## Context

### 트리거 — request body 의 `defaultModelId` 가 ADR-0045 원칙과 충돌한다

Q-0045 옵션1 run-side 사슬은 T-0556~T-0566 으로 순수 조각 → orchestrator → controller route → e2e 까지 닫혔다. 현재 `POST /api/assessment-evaluation/unevaluated-fill-run` 의 [UnevaluatedFillRunRequestDto](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) 는 `defaultModelId` 를 **request body 의 필수 필드**(`@IsString + @IsNotEmpty`, line 80~82)로 받는다 — 즉 클라이언트(caller)가 매 호출마다 default model 을 넘기는 구조다.

그러나 [ADR-0045 §Decision 1](ADR-0045-llm-provider-deployment-config.md) 은 **"LLM provider(및 model 선택)는 코드/caller 선택이 아니라 배포-환경 설정이며 그 source 는 `LlmProviderConfig` DB row(Admin 지정 endpoint/key/model)"** 라고 확정했다. 현재 설계는 이 원칙과 충돌한다 — default model 의 source 가 caller(request body)가 아니라 배포 설정(LlmProviderConfig row)이어야 한다.

또한 직전 slice 인 [`buildFillRunScoringOptions`](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) (T-0561) 의 fail-fast 정책 — request modelId 가 비어있으면 default 로 fallback, default 도 비어있으면 한국어 `TypeError` — 은 **defaultModelId 가 항상 채워져 있다는 invariant** 를 전제로 한다. 그 invariant 의 source 를 본 ADR 이 박제한다.

### 핵심 사실 — LlmProviderConfig 는 다중-row 모델이다 (그러나 현재는 단일-row 운용)

[LlmProviderConfigRepository](../../src/llm/llm-provider-config.repository.ts) 의 `LlmProviderConfig` entity 는 schema 상 `@unique` / `@@unique` 가 정의되지 않은 **다중-row 모델**이다 (line 14~17 의 명시 박제: "각 provider 별 1+ row, custom 은 3 model 슬롯 — REQ-051"). 즉 한 deployment 안에 N 개의 row 가 공존할 수 있고, 어느 row 를 "default" 로 해석할지의 정책이 schema 자체에는 표현돼 있지 않다.

[REQ-051](../requirements.md) (custom LLM 3 model 슬롯) 은 향후 한 custom provider 안에서 3 개의 model 을 동시 운용하는 기능이며, 그 phase 에 진입하면 LlmProviderConfig row 수가 명확히 ≥ 3 이 된다. **그러나 현재 P5 진행 시점에서는 LlmProviderConfig 의 실배치 row 수가 0~1 인 단일-row 운용 단계** 다 (P4 milestone-1 에서 `LlmHttpGateway` provider dispatch 만 머지됐고, 다중-model 슬롯 운용 task 는 아직 미진입 — PLAN.md P5 bullet 99 REQ-051 PLANNED 상태).

### 외력

- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / 새 mandated credential 은 BLOCKED. 본 결정의 채택안은 **schema migration 0 / 새 env 0 / 새 dependency 0** 로 §5 게이트를 어느 축도 발화하지 않는다. 단 §Alternatives B (`isDefault` column 추가) 는 schema migration 을 트리거하므로 본 ADR 이 미채택 + 후속 ADR (REQ-051 진입 시) 의 검토 대상으로 명시한다.
- **[ADR-0045](ADR-0045-llm-provider-deployment-config.md) §Decision 1** — "provider = 배포 설정, source = LlmProviderConfig row" 의 상위 원칙. 본 ADR 은 그 원칙을 default model 해석 경로로 구체화한다 (폐기 0, augment).
- **[REQ-037](../requirements.md)** — P5 의 "평가 없는 부분 일괄 평가" 기능. Q-0045 옵션1 run-side 사슬이 이 REQ 를 cover 하며, defaultModelId 의 source 가 결정돼야 본 REQ 의 LLM 호출 경로가 caller-free 로 닫힌다.
- **[REQ-051](../requirements.md)** — custom LLM 3 model 슬롯. 본 ADR 은 단일-row 운용을 전제로 결정하되, REQ-051 진입 시 다중-row default 선택 정책을 별도 follow-up ADR 로 박제할 것을 명시(§Decision 2).

## Decision

### Decision §1 — defaultModelId 의 source 는 LlmProviderConfig DB row 의 `modelId` 필드

**채택: `POST /api/assessment-evaluation/unevaluated-fill-run` 의 defaultModelId 는 request body 가 아니라 [LlmProviderConfigRepository](../../src/llm/llm-provider-config.repository.ts) 가 노출하는 LlmProviderConfig row 의 `modelId` 필드에서 해석된다. 해석은 controller 또는 그 위의 thin resolver layer 가 request 처리 진입 시점에 1 회 수행해 service 호출에 inject 한다.**

- **흐름**: HTTP request 진입 → controller 가 `LlmProviderConfigResolver`(이름은 후속 구현 task 책임) 1 회 호출 → resolver 가 `LlmProviderConfigRepository.findMany()` 로 row 조회 후 §Decision 2 의 단일-row 정책에 따라 `modelId` 추출 → 추출된 modelId 가 `defaultModelId` 인자로 `UnevaluatedFillRunOrchestratorService.run(rawBridges, requestModelId, defaultModelId)` 에 그대로 흐른다 (orchestrator·core·`buildFillRunScoringOptions` 는 무변경).
- **caller 책임 0**: caller (Admin UI / 내부 batch trigger / 외부 client) 는 default model 을 알 필요가 없다 — provider/key/model 모두 배포 설정 표면에 산다 (ADR-0045 §Decision 1). caller 는 선택적 `modelId` override 만 제공한다 (request 우선 분기 — `buildFillRunScoringOptions` (a) 정책 유지).
- **resolver layer 위치**: controller 또는 별도 `LlmProviderConfigResolver` `@Injectable` (후속 구현 task 가 결정 — 본 ADR 은 layer 위치를 박제하지 않고 "controller 진입 시 1 회 호출" 만 박제). orchestrator·core layer 는 resolver 를 보지 않는다 — 순수성 보존 (`buildFillRunScoringOptions` 는 `@Injectable` 0 / Prisma import 0 — 본 결정 후에도 불변).

### Decision §2 — 다중-row 분기는 후속 ADR (REQ-051 진입 시) 로 deferred — 현 단계는 **단일-row 운용 가정 + 비단일 시 fail-fast**

**채택: 본 ADR 시점의 운용은 LlmProviderConfig row 수가 정확히 1 임을 전제한다. resolver 가 `findMany()` 결과의 length 를 점검해 다음 3 분기를 한국어 메시지로 fail-fast 한다 — (a) length === 1 → 그 row 의 `modelId` 채택, (b) length === 0 → "LLM provider 가 설정되지 않았다" (운영자 설정 누락), (c) length ≥ 2 → "LlmProviderConfig 다중-row 운용 — 명시적 default 선택 정책 미박제 (후속 ADR 필요)". 다중-row default 선택 정책 (예: schema `isDefault` flag / env var pointer / `updatedAt` 최신 / per-provider default) 의 택1 결정은 [REQ-051](../requirements.md) (custom 3 model 슬롯) 실구현 진입 시 별도 follow-up ADR 로 박제한다.**

- **단일-row 운용 가정의 근거**: 본 ADR 시점 (2026-06-21) 의 실배치 LlmProviderConfig row 수는 0~1 이다 (PLAN.md P5 bullet 99 REQ-051 PLANNED 상태 — 다중-model 슬롯 운용 task 미진입). 따라서 단일-row 가정은 **현실 운용 상태의 박제**이지 future-restriction 이 아니다 — REQ-051 진입 시점에 본 가정이 자연스럽게 깨지므로 그 시점에 후속 ADR 이 다중-row 정책을 박제하면 된다 (YAGNI — 현재 필요한 결정만).
- **(c) 분기 = "다중-row 운용 = 미박제 운영 사고" 의 명시화**: REQ-051 미진입 단계에서 LlmProviderConfig row 가 ≥ 2 가 되는 경우는 **운영자가 정책 없이 row 를 추가한 사고**이다. 후속 ADR 이 다중-row 정책을 박제하기 전까지 그 row 들 중 어느 것을 default 로 해석해도 임의적이므로, "선택하지 말고 fail-fast 하라" 는 정책이 안전하다 (silent 임의 선택은 운영자 의도와 어긋나 평가 결과의 reproducibility 를 깬다).
- **(b) 분기 = "LLM provider 설정 누락"**: row 0 은 운영자가 LLM provider 를 한 번도 설정하지 않은 상태이며 — Admin UI 의 provider config 화면 (별도 controller / UX task 책임) 으로 row 를 추가하기 전까지 unevaluated-fill-run 호출은 정상적으로 실패해야 한다. resolver 의 fail-fast 한국어 메시지가 운영자가 즉시 인지할 수 있는 진단을 제공한다.
- **후속 ADR 의 검토 대상** (REQ-051 진입 시): (i) schema 에 `isDefault: Boolean @default(false)` 컬럼 추가 + `@@unique` 으로 정확히 1 row 강제 (CLAUDE.md §5 schema migration 게이트 — BLOCKED 사유 명시 + 사용자 승인 후 진행), (ii) env var `LLM_DEFAULT_PROVIDER_CONFIG_ID` 로 row id 명시 pointer (새 env 도입 — CLAUDE.md §5 검토), (iii) `updatedAt DESC` 자동 선택 (admin 이 row 갱신으로 default 변경 — schema 변경 0 이지만 변경 직관성 약함), (iv) per-provider default + caller 가 provider 명시. 본 ADR 은 이들 중 택1 하지 않고 follow-up ADR 의 검토 대상으로 박제만 한다.

### Decision §3 — request body 의 `defaultModelId` 는 **제거** (deprecated-optional override 채택 안 함)

**채택: `UnevaluatedFillRunRequestDto` 의 `defaultModelId!` 필드는 **제거**한다. request body 는 선택적 `modelId` (override) 만 보유하고, default 의 source 는 server-side resolver (Decision §1) 가 단일하게 결정한다. deprecated-optional override (request body 에 남기되 무시 / fallback override) 는 채택하지 않는다.**

- **제거의 정당화**: ADR-0045 §Decision 1 "provider = 배포 설정" 원칙은 caller 가 default 를 매 호출마다 넘기는 구조 자체를 부정한다. deprecated-optional 로 남기면 caller 가 옛 인자를 계속 보내며 그 값이 silent 하게 무시되는 혼동이 생긴다 — 정책의 명시성을 깬다. 제거가 더 깔끔하고, breaking change 의 비용도 낮다 (아래).
- **breaking change 비용**: 본 endpoint 는 P5 bullet 106 의 신규 endpoint (T-0566 e2e 머지 직후 = 2026-06-20) 로, 외부 클라이언트 (frontend / 외부 API consumer) 의 production 사용 사례가 아직 0 이다. 내부 batch trigger 도 후속 task 가 도입 예정 (현재 caller 0). 따라서 DTO 의 필드 제거가 영향을 미치는 surface 는 spec / e2e 의 fixture 뿐이며, follow-up 구현 task 에서 함께 갱신된다.
- **선택적 `modelId` override 는 유지**: `UnevaluatedFillRunRequestDto.modelId?` (`@IsOptional + @IsString + @IsNotEmpty`, line 71~74) 는 그대로 유지된다 — caller 가 특정 호출에서 default 와 다른 model 을 쓰고 싶을 때 (예: A/B 비교 / 운영자 ad-hoc 실험) 의 override 표면. `buildFillRunScoringOptions` 의 (a) request 우선 분기가 이 override 를 흡수한다 — 본 ADR 후에도 무변경.
- **HTTP semantic 으로의 매핑**: 본 변경 후 request body 는 `{ rawBridges: PeriodBridgeDto[], modelId?: string }` 로 단순화된다. 400 BadRequest 분기는 `rawBridges` 검증 + (제공 시) `modelId` 빈/형식 검증만 — defaultModelId 누락 400 분기는 사라진다 (이 분기는 후속 e2e 갱신 task 가 cover).

### Decision §4 — schema migration 0 / 새 env 0 / 새 dependency 0 (CLAUDE.md §5 게이트 어느 축도 미발화)

**채택: 본 ADR 의 채택안 (단일-row 운용 가정 + resolver layer 도입 + DTO 필드 제거) 은 schema migration 0, 새 외부 dependency 0, 새 mandated credential / env 0 으로 완결된다. [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 (새 dep / 새 credential / schema migration) 를 어느 축도 발화하지 않는다.**

- **schema migration 0**: LlmProviderConfig schema 는 무변경 — `@unique` 추가도, `isDefault` 컬럼 추가도 본 ADR 의 결정 범위 밖이다 (Decision §2 가 그 결정을 후속 ADR 로 deferred). prisma migration 파일 추가 0.
- **새 dependency 0**: resolver layer 는 기존 `LlmProviderConfigRepository.findMany()` 1 회 호출 + length 점검 + row 추출 (Nest `@Injectable` 1 개 / 기존 NestJS / class-validator / TypeScript 외 import 0). package.json 변경 0.
- **새 mandated env / credential 0**: 본 ADR 은 새 env var (예: `LLM_DEFAULT_PROVIDER_CONFIG_ID`) 를 도입하지 않는다 — 단일-row 운용 가정이 env 없이 자체 결정 가능하기 때문이다. 다중-row 진입 시의 env 도입 검토는 Decision §2 의 후속 ADR 책임 (그 시점에 §5 게이트 재평가).

## Consequences

### 긍정

- **ADR-0045 원칙 정합**: caller 가 default 를 매 호출마다 넘기는 구조가 사라지고 default 의 source 가 배포 설정 표면 (LlmProviderConfig row) 으로 단일화 — ADR-0045 §Decision 1 "provider = 배포 설정" 원칙이 P5 unevaluated-fill-run 경로 전체에서 일관되게 적용된다.
- **CLAUDE.md §5 게이트 미발화**: schema migration 0 / 새 env 0 / 새 dependency 0 — 본 ADR 의 채택안 구현은 BLOCKED 사유 없이 후속 task 로 분해 가능 (PR 검토 normal flow).
- **caller 의 인지 부담 감소**: 외부/내부 caller 는 deployment 별 default model 값을 알 필요가 없다 — 운영자가 LlmProviderConfig row 만 관리하면 caller 변경 없이 model 교체 가능 (provider drift 차단, ADR-0045 §Consequences 정합).
- **fail-fast 진단성**: row 0 / 다중-row 분기가 한국어 메시지로 즉시 실패해 운영자가 misconfiguration 을 진단 가능 — silent 임의 선택의 reproducibility 손상을 막는다.
- **REQ-051 진입 경로 보존**: 다중-row 정책을 후속 ADR 로 deferred — REQ-051 실구현 시 그 ADR 이 schema / env / 선택 정책 중 하나를 박제 가능. 본 ADR 이 어느 정책도 선점하지 않아 미래 결정의 자유도가 보존된다.

### 부정 / trade-off

- **request body breaking change**: 기존 `defaultModelId` 필드가 사라져 옛 caller (test fixture / 임시 caller) 가 400 으로 실패한다. mitigation: 본 endpoint 는 신규 (2026-06-20 e2e 머지 직후, production caller 0) 이고 follow-up 구현 task 가 spec / e2e fixture 를 동시 갱신한다 (breaking surface 가 repo 내부에 한정).
- **단일-row 운용 가정의 기간 한정**: REQ-051 진입 시점에 본 가정이 깨지므로 후속 ADR 이 반드시 필요하다 — 본 ADR 은 그 ADR 의 trigger 와 검토 대상을 §Decision 2 에 박제하지만, 정책 자체를 박제하진 않는다. 이는 "현재 필요한 결정만" 의 YAGNI 정합이며 mitigation 은 PLAN.md / ADR 자체에서 REQ-051 도입 task 의 prerequisite 으로 본 후속 ADR 을 명시하는 것 (별도 follow-up doc-sync).
- **resolver layer 도입 = 신규 `@Injectable` 1 개**: NestJS module wiring 이 1 곳 늘어난다 (assessment-evaluation.module 에 resolver provider 추가). mitigation: layer 1 개 추가는 cross-module impact 가 아니며 (`LlmHttpGateway` / orchestrator / core 의 contract 무변경), reviewer 점검 표면은 controller wiring + resolver spec (R-112 4 종 cover) 한 PR slice 로 닫힌다.
- **다중-row fail-fast 의 운영 마찰**: 운영자가 정책 없이 LlmProviderConfig row 를 ≥ 2 로 만들면 unevaluated-fill-run 이 즉시 실패한다 — 운영자가 본 정책을 인지하지 못하면 혼동 가능. mitigation: fail-fast 한국어 메시지가 "후속 ADR 필요" 를 명시해 진단성을 보장 + Admin UI 의 provider config 화면이 multi-row 입력을 시각적으로 차단하도록 후속 UX task 박제 (별도 follow-up).

### NON-goal (명시 금지 — 박제)

- **다중-row default 선택 정책 박제 0** — 본 ADR 은 (a) length === 1 만 채택 분기, (b) length === 0 / ≥ 2 는 fail-fast. 다중-row 정책 (isDefault flag / env pointer / updatedAt / per-provider) 의 택1 은 REQ-051 진입 시 별도 follow-up ADR 책임.
- **schema migration 동반 0** — 본 ADR 의 채택안은 schema 무변경. 후속 구현 task 도 schema 변경 없이 resolver + DTO + controller 배선만 다룬다.
- **새 env var 도입 0** — 단일-row 운용 가정이 env 없이 자체 결정 가능하므로 본 ADR 시점에 새 env 를 박지 않는다.
- **caller 의 default override 표면 도입 0** — request body 의 `modelId?` override 는 유지하되, default 자체를 override 하는 별도 표면 (header / query param / 별도 endpoint) 은 도입하지 않는다 (override 는 단일 path).
- **provider 자체 (custom / azure 등) 의 caller 선택 0** — caller 는 modelId 만 override 할 수 있고 provider 는 LlmProviderConfig row 에서 model→provider 가 자동 결정된다 (1 row → 1 provider). 다중-row 진입 시 provider 선택 정책도 후속 ADR 의 검토 대상.

### Cross-Module Impact

본 결정은 **public API contract 의 한 표면 (request body 의 defaultModelId 필드 제거) 만 변경**하며, 그 외 layer (orchestrator·core·`buildFillRunScoringOptions`·repository·gateway) 의 contract 는 무변경이다.

- **DTO 변경 표면**: `UnevaluatedFillRunRequestDto.defaultModelId!` 제거 (filed 1 개 deletion). spec 에서 동일 필드를 사용하는 fixture 갱신.
- **controller wiring 변경 표면**: `AssessmentEvaluationController.runUnevaluatedFill` 에서 resolver 호출 후 service 의 `defaultModelId` 인자 inject 추가 (1 line 변경 + resolver provider DI).
- **resolver 신규**: `LlmProviderConfigResolver` (또는 동등 이름) `@Injectable` + spec. line 수 ~50 LOC + spec ~80 LOC (R-112 4 종 cover — happy path / 0 row / 2+ row / non-string modelId fail-fast / negative cases).
- **변경 없는 layer**: `UnevaluatedFillRunOrchestratorService.run` 시그니처 (`rawBridges, requestModelId, defaultModelId`) 그대로. `buildFillRunScoringOptions(requestModelId, defaultModelId)` 그대로. `LlmHttpGateway.generate` 그대로. `LlmProviderConfigRepository.findMany()` 그대로. core 순수 조각 무변경.

영향 표면이 controller + DTO + 신규 resolver layer 1 곳에 국한돼 cross-module impact (public API / shared symbol contract 의 광범위 변경) 는 발화하지 않는다 — DTO 한 필드 제거가 유일한 외부 surface 이며, 그 caller 가 repo 내부 spec/e2e 뿐이라 변경 면이 닫힌다.

## Alternatives considered

### A. defaultModelId 의 source 를 LlmProviderConfig row 의 `modelId` 로 박제 + 단일-row 가정 + DTO 필드 제거 (채택)

본 ADR 의 채택안. ADR-0045 §Decision 1 정합 + schema migration 0 + 새 env 0 + 새 dependency 0 + 다중-row 정책을 REQ-051 진입 시 후속 ADR 로 deferred. 단일-row 가정은 현 운용 상태의 박제이며 future-restriction 이 아니다 (REQ-051 진입 시 자연스럽게 후속 ADR 이 박제). request body 의 defaultModelId 필드는 제거 — caller 인지 부담 0 + ADR-0045 원칙 일관 적용.

### B. schema 에 `isDefault: Boolean` 컬럼 + `@@unique` 추가 (지금 박제) (미채택 — 현 단계)

LlmProviderConfig schema 에 `isDefault Boolean @default(false)` 컬럼 추가 + `@@unique` 로 isDefault=true row 가 정확히 1 임을 강제하는 안. 미채택 — (1) CLAUDE.md §5 schema migration 게이트 발화 (BLOCKED 사유 필요 + 사용자 승인 후 진행) 으로 본 ADR 의 follow-up 구현 task 가 즉시 BLOCKED, (2) 현재는 단일-row 운용이라 schema 강제가 시급하지 않다 (YAGNI), (3) 다중-row 정책의 택1 (isDefault flag vs env var vs updatedAt vs per-provider) 자체가 REQ-051 의 사용 패턴에 의존하므로 그 phase 진입 전에 선점하면 후속 변경 비용이 발생할 수 있다. 본 옵션은 REQ-051 진입 시 follow-up ADR 의 검토 대상으로 박제 (§Decision 2).

### C. env var `LLM_DEFAULT_PROVIDER_CONFIG_ID` 로 row id pointer 도입 (미채택 — 현 단계)

배포 환경의 env var 가 LlmProviderConfig row 의 id 를 가리키는 안 — 다중-row 환경에서도 명시적 default 선택 가능. 미채택 — (1) CLAUDE.md §5 새 mandated env 게이트 발화 (운영자가 env 를 설정하지 않으면 fail), (2) 단일-row 운용 시점에는 env 가 불필요한 redundancy (row 가 1 개면 자동 결정 가능), (3) env 와 DB row 의 일치 검증이 추가 표면 (운영자가 env 의 id 를 실수로 잘못 입력 → silent fail). 본 옵션도 REQ-051 진입 시 후속 ADR 의 검토 대상.

### D. request body 의 `defaultModelId` 를 deprecated-optional 로 유지 (미채택)

DTO 의 `defaultModelId` 필드를 제거하지 않고 `@IsOptional` 로 유지하되 server-side resolver 가 항상 LlmProviderConfig row 에서 해석해 silent 하게 무시하는 안. 미채택 — (1) caller 가 옛 인자를 계속 보내며 그 값이 silent 무시돼 정책의 명시성을 깬다 ("이 값이 왜 안 먹지?" 운영 혼동), (2) deprecated 표시를 codebase 내내 유지해야 하는 cleanup 부채 (CLAUDE.md "backwards-compatibility shims 금지" 정합), (3) 본 endpoint 의 production caller 가 0 이라 deprecation 단계 자체가 불필요. 명시적 제거가 더 깔끔.

### E. defaultModelId 의 source 를 env var 만으로 (LlmProviderConfig 무시) (미채택)

`LLM_DEFAULT_MODEL_ID` 같은 env var 로 default model 을 직접 박는 안 — DB row 무관. 미채택 — (1) ADR-0045 §Decision 1 "source = LlmProviderConfig row" 원칙 위반 (env 가 새로운 단일 source 가 됨, DB row 와 분리), (2) LlmProviderConfig row 가 갖는 endpoint/key/model 의 일관성이 깨진다 (env 의 modelId 가 어느 row 의 endpoint/key 와 매칭되는지 불명), (3) 운영자가 model 을 바꾸려면 process restart 가 필요 (DB row 갱신만으로 적용되는 ADR-0045 §Decision 1 원칙과 충돌). 본 옵션은 ADR-0045 와 정면 충돌하므로 검토에서 즉시 기각.

## Out of scope

본 ADR 은 **결정(원칙)만 박제**한다 — 다음은 후속 task / 별도 ADR 책임:

- **resolver layer 실구현 (`LlmProviderConfigResolver` `@Injectable` + R-112 4 종 spec)** — 본 ADR 이 박제한 §Decision 1·2 의 단일-row 정책 + fail-fast 한국어 메시지 + happy / 0-row / 2+ row / type mismatch negative cases 를 cover 하는 1 slice (≤ 300 LOC / ≤ 5 파일).
- **`UnevaluatedFillRunRequestDto.defaultModelId` 필드 제거 + spec 갱신** — DTO 변경 + 본 DTO 가 사용되는 spec / e2e fixture 동시 갱신. 1 slice (≤ 5 파일).
- **controller wiring 변경 (resolver 호출 + service inject)** — `AssessmentEvaluationController.runUnevaluatedFill` 에서 resolver 1 회 호출 후 service `defaultModelId` 인자 채움. 1 slice (controller spec 의 happy / 0-row 503 / 2-row 503 / non-string fail-fast 분기 cover).
- **resolver 의 row 부재 시 HTTP status 매핑** — 본 ADR 은 한국어 `TypeError` / Exception 까지만 박제하고 HTTP status (503 ServiceUnavailable / 500 / 400) 의 택1 은 후속 controller wiring task 책임.
- **REQ-051 (custom 3 model 슬롯) 진입 시 다중-row default 정책 ADR** — 본 ADR §Decision 2 의 4 검토 대상 (isDefault flag / env pointer / updatedAt / per-provider) 중 택1 박제. REQ-051 실구현 task 의 prerequisite 으로 PLAN.md / 본 ADR Follow-ups 에 박제.
- **Admin UI 의 multi-row 입력 시각적 차단** — provider config 화면이 LlmProviderConfig row 가 ≥ 2 가 되는 입력을 시각적으로 막거나 명시 경고를 띄우도록 UX 변경. 별도 frontend task (P6 phase).
- **PLAN.md doc-sync** — P5 bullet 106 의 chain 완결 표기 + REQ-051 진입 시 본 ADR 후속이 prerequisite 임을 명시. 별도 direct doc commit.

## References

- [docs/decisions/ADR-0045-llm-provider-deployment-config.md](ADR-0045-llm-provider-deployment-config.md) §Decision 1 — "LLM provider = 배포-환경 설정, source = LlmProviderConfig row" (본 ADR 이 default model 해석 경로로 구체화)
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — `LlmProviderConfigRepository.findMany()` (본 ADR resolver 의 호출 대상) + 다중-row 모델 명시 박제 (line 14~17)
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) — 현재 `defaultModelId!` 를 request body 필수로 받는 DTO (line 76~82, 본 ADR 의 변경 대상 surface)
- [src/assessment-evaluation/dto/build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) — request/default fallback 정책 (T-0561). 본 ADR 후 시그니처 무변경 (`buildFillRunScoringOptions(requestModelId, defaultModelId)`).
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `runUnevaluatedFill` route. 본 ADR 후 resolver 호출 + service inject wiring 추가 (후속 task).
- [docs/architecture/deployment.md](../architecture/deployment.md) "지원 LLM 환경 = 배포 config" 단락 — 본 ADR 의 link 1 줄 동기 (defaultModelId 가 LlmProviderConfig row 에서 해석됨).
- [docs/requirements.md](../requirements.md) REQ-037 (평가 없는 부분 일괄 평가) / REQ-051 (custom LLM 3 model 슬롯) — 본 ADR 의 cover REQ.
- [CLAUDE.md §3.1 / §5](../../CLAUDE.md) — ADR-first(rule 4) / BLOCKED 게이트(새 dep / 새 credential / schema migration — 본 ADR 채택안은 어느 축도 미발화).

Refs: ADR-0045, REQ-037, REQ-051, T-0567, Q-0045
