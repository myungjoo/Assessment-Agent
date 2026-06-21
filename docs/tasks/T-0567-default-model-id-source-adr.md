---
id: T-0567
title: defaultModelId source 결정 ADR 작성 — LlmProviderConfig row 에서 default model 해석 (run-side chain config slice)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-051]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-22
independentStream: q0045-run-side-chain
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0048-default-model-id-source.md
  - docs/architecture/deployment.md
plannerNote: "P5 bullet 106 R-64/REQ-037·038 Q-0045 옵션1 run-side chain — defaultModelId source(LlmProviderConfig row, ADR-0045 원칙) 결정 ADR. ADR-first(구현 전 결정 박제)."
---

# T-0567 — defaultModelId source 결정 ADR 작성 (LlmProviderConfig row 에서 default model 해석)

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가") 의 Q-0045 옵션1 run-side chain 은 T-0556~T-0566 으로 순수 조각·orchestrator·controller route·e2e 까지 닫혔다. 남은 후속(backlogNote)은 **LLM config source (defaultModelId) 배선 slice — 새 config 결정 ADR 후보**다.

현재 `POST /api/assessment-evaluation/unevaluated-fill-run` 의 `UnevaluatedFillRunRequestDto` 는 `defaultModelId` 를 **request body 의 필수 필드**로 받는다 (`unevaluated-fill-run-request.dto.ts` line 76~82). 그러나 [ADR-0045](../decisions/ADR-0045-llm-provider-deployment-config.md) §Decision1 은 **"LLM provider(및 model 선택)는 코드/caller 선택이 아니라 배포-환경 설정이며 그 source 는 `LlmProviderConfig` DB row"** 라고 확정했다 — 즉 default model 은 caller 가 매 호출마다 넘기는 값이 아니라 설정 표면에서 해석돼야 한다. 현재 설계는 ADR-0045 원칙과 충돌하므로, **구현(배선) 전에 "defaultModelId 를 어디서·어떻게 해석하는가" 를 ADR 로 박제**한다 (CLAUDE.md §3.1 rule 4: 새 ADR 자체는 pr; ADR-first — 결정을 코드보다 먼저).

본 task 는 **결정 박제만** — 실제 resolver/배선 코드는 본 ADR 이 분해할 후속 task 책임 (§Out of Scope).

## Required Reading

- `docs/decisions/ADR-0045-llm-provider-deployment-config.md` — "LLM provider = 배포-환경 설정, source = LlmProviderConfig row" 원칙 (본 ADR 이 보강/구체화하는 상위 결정)
- `src/llm/llm-provider-config.repository.ts` — `LlmProviderConfig` row 의 `modelId` 필드 + `findMany()`(다중 row 모델, `@unique` 미정의) — default 해석 대상 표면
- `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts` — 현재 `defaultModelId` 를 request body 필수로 받는 DTO (변경 대상이 아니라 결정 근거; 본 task 는 코드 수정 0)
- `src/assessment-evaluation/dto/build-fill-run-scoring-options.ts` — `buildFillRunScoringOptions(requestModelId, defaultModelId)` request→default fallback 정책 (defaultModelId 소비 지점)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` (line 482~530) — run route 가 `dto.defaultModelId` 를 그대로 forward 하는 현재 배선 (후속 배선 task 의 변경 대상)
- `docs/architecture/deployment.md` — "외부 네트워크 boundary" / provider 설정 표면 단락 (ADR-0045 가 참조; 본 ADR 한 단락 동기)
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` 의 frontmatter — ADR frontmatter 표준 형식 참고

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0048-default-model-id-source.md` 신설 (status: PROPOSED). frontmatter 표준 형식 (id / title / status / date / augments: [ADR-0045] / relatedReq: [REQ-037, REQ-051]).
- [ ] **Context** — 현재 `unevaluated-fill-run` route 가 `defaultModelId` 를 request body 필수로 받는 사실 + 그것이 ADR-0045 §Decision1 "model = 배포 설정(LlmProviderConfig row)" 원칙과 충돌하는 점을 명시.
- [ ] **Decision** — defaultModelId 의 source 를 `LlmProviderConfig` row 의 `modelId` 로 확정. 다중 row 모델(`@unique` 미정의, custom 3 model 슬롯 REQ-051)에서 **어느 row 를 default 로 해석하는가** 의 정책을 명시적으로 결정 (예: 단일 row 환경 가정 / 명시적 default 표식 / 선택 정책 중 하나를 근거와 함께 택1 — 미정/모호 금지). request body `defaultModelId` 의 거취(제거 vs deprecated-optional override)도 결정.
- [ ] **Consequences + Alternatives considered** — 최소 2개 대안 (예: request body 유지 vs config row 해석 vs env var) 의 trade-off + 기각 사유 명시. CLAUDE.md §5 게이트 점검 (새 dependency 0 / schema migration 필요 여부 — 필요하면 BLOCKED 사유 명시).
- [ ] **Out of scope / Follow-ups** — 실제 resolver 코드 + DTO 변경 + controller 배선 + spec 을 후속 task 로 분해 (본 ADR 은 결정만). resolver 가 row 부재 시 처리 정책(throw vs fallback)도 후속 구현 task 로 명시 위임.
- [ ] `docs/architecture/deployment.md` 의 provider 설정 표면 단락에 본 ADR 링크 한 줄 동기 (defaultModelId 가 LlmProviderConfig row 에서 해석됨을 1 문장 박제).
- [ ] **본 task 는 ADR + doc 한 단락만** — `src/` 코드 변경 0, schema/migration 변경 0, DTO/controller 변경 0. (이 항목이 곧 분기-없음 근거: 본 task 는 production code symbol 을 추가/수정하지 않으므로 happy/error/branch/negative unit test 항목은 N/A — 코드 0.)
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test:cov` 를 실행해 기존 green 유지 확인 (R-110 — pr-mode 는 코드 변경 0 이어도 tester 호출 의무; coverage 영향 0 이어야 함, line ≥ 80% / function ≥ 80% 유지).

> R-112 4종 unit test 항목 주석: 본 task 는 새 production symbol 0 (ADR 문서 + deployment.md 한 단락) 이므로 happy-path / error-path / branch / negative cases 단위 테스트는 **분기 없음 — 적용 N/A**. 단 pr-mode 이므로 tester 가 기존 suite green 을 반드시 재확인한다 (위 마지막 항목). 실제 resolver 의 R-112 4종 cover 는 본 ADR 이 분해하는 후속 구현 task 책임.

## Out of Scope

- defaultModelId resolver 서비스/헬퍼 **구현** (LlmProviderConfig row → modelId 해석 코드) — 본 ADR 이 분해하는 후속 task.
- `UnevaluatedFillRunRequestDto` 의 `defaultModelId` 필드 **제거/변경** — 후속 배선 task.
- `assessment-evaluation.controller.ts` 의 run route **배선 변경** (resolver 주입) — 후속 배선 task.
- `LlmProviderConfig` schema/migration 변경 (예: `isDefault` 컬럼 추가) — 결정에서 그 방향을 택하면 별도 schema task 로 분해 (DB schema 변경은 CLAUDE.md §5 BLOCKED 게이트 대상 — ADR 에서 필요성만 박제).
- live-LLM round-trip 검증 (LAN=AKIHA 192.168.0.5 — cloud cron 무경로, standing 게이트).
- provider 선택 운영 UX / Admin UI.

## Suggested Sub-agents

architect → tester (코드 변경 0 이지만 pr-mode R-110 준수 위해 tester 가 기존 suite green 확인)

## Follow-ups

(작성 시점 비어있음 — sub-agent 가 관련 작업 발견 시 append)
