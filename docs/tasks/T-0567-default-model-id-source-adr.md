---
id: T-0567
title: defaultModelId source 결정 ADR 작성 — LlmProviderConfig row 에서 default model 해석 (run-side chain config slice)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-051]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-22
completedAt: 2026-06-21T18:04:02Z
fireOverride: direct (사용자 명시 — "문서나 코멘트 변경에 대해서는 PR이나 리뷰 프로세스 없이 direct commit merge")
independentStream: q0045-run-side-chain
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0048-default-model-id-source.md
  - docs/architecture/deployment.md
plannerNote: "P5 bullet 106 R-64/REQ-037·038 Q-0045 옵션1 run-side chain — defaultModelId source(LlmProviderConfig row, ADR-0045 원칙) 결정 ADR. ADR-first(구현 전 결정 박제)."
doneSummary: "ADR-0048 PROPOSED 신설(+296 LOC) + deployment.md '지원 LLM 환경' 단락에 ADR-0048 링크 1 문장 동기. 결정: (§1) defaultModelId source = LlmProviderConfig row 의 modelId 필드 (server-side resolver layer, controller 진입 시 1 회 호출). (§2) 다중-row 분기는 REQ-051 진입 시 후속 ADR 로 deferred — 현 단계는 단일-row 운용 가정 + (0 row / 2+ row) fail-fast 한국어 메시지. (§3) request body 의 defaultModelId 필드 제거 (deprecated-optional override 미채택 — 정책 명시성 우선, production caller 0). (§4) schema migration 0 / 새 env 0 / 새 dependency 0 — CLAUDE.md §5 게이트 어느 축도 미발화. Alternatives 5 종(A 채택 / B isDefault schema migration / C env pointer / D deprecated-optional / E env-only source) 검토 + 기각 사유 박제. **본 fire 는 사용자 명시 override 로 PR/review 우회 direct commit** — 원래 commitMode=pr 의 architect/reviewer/integrator chain 대신 단일 direct commit 으로 main 머지. 후속 task: resolver 구현 + DTO 필드 제거 + controller wiring + REQ-051 진입 시 다중-row ADR (별도 planner-dispatch chain)."
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

- [x] `docs/decisions/ADR-0048-default-model-id-source.md` 신설 (status: PROPOSED). frontmatter 표준 형식 (id / title / status / date / augments: [ADR-0045] / relatedReq: [REQ-037, REQ-051]).
- [x] **Context** — 현재 `unevaluated-fill-run` route 가 `defaultModelId` 를 request body 필수로 받는 사실 + 그것이 ADR-0045 §Decision1 "model = 배포 설정(LlmProviderConfig row)" 원칙과 충돌하는 점을 명시.
- [x] **Decision** — defaultModelId 의 source 를 `LlmProviderConfig` row 의 `modelId` 로 확정 (§Decision 1). 다중 row 모델 (`@unique` 미정의, custom 3 model 슬롯 REQ-051) 에서 **어느 row 를 default 로 해석하는가** 의 정책을 명시 결정: **단일-row 운용 가정 + (0 row / 2+ row) fail-fast** 채택, 다중-row 정책 택1 (isDefault flag / env pointer / updatedAt / per-provider) 은 REQ-051 진입 시 후속 ADR 로 deferred (§Decision 2). request body `defaultModelId` 거취: **제거** (deprecated-optional override 미채택 — §Decision 3, 정책 명시성 + production caller 0).
- [x] **Consequences + Alternatives considered** — 5 종 대안 (A 채택 / B isDefault schema migration / C env pointer / D deprecated-optional / E env-only source) 의 trade-off + 기각 사유 명시. CLAUDE.md §5 게이트 점검 (새 dependency 0 / schema migration 0 — §Decision 4 어느 축도 미발화). 후속 다중-row ADR 진입 시 B/C 가 검토 대상 (§Decision 2).
- [x] **Out of scope / Follow-ups** — 실제 resolver 코드 + DTO 변경 + controller 배선 + spec + 후속 REQ-051 진입 시 다중-row ADR + PLAN.md doc-sync + Admin UI multi-row 입력 차단 UX 를 후속 task 로 분해 (본 ADR 은 결정만). resolver 가 row 부재 시 처리 정책: 한국어 `TypeError`/Exception fail-fast 박제, HTTP status 매핑 (503 vs 500 vs 400 택1) 은 후속 controller wiring task 책임.
- [x] `docs/architecture/deployment.md` 의 provider 설정 표면 단락에 본 ADR 링크 한 줄 동기 (defaultModelId 가 LlmProviderConfig row 에서 해석됨을 1 문장 박제, "default modelId 의 source 도 동일하게 LlmProviderConfig row 의 modelId 필드에서 해석된다…[ADR-0048] PROPOSED").
- [x] **본 task 는 ADR + doc 한 단락만** — `src/` 코드 변경 0, schema/migration 변경 0, DTO/controller 변경 0. (이 항목이 곧 분기-없음 근거: 본 task 는 production code symbol 을 추가/수정하지 않으므로 happy/error/branch/negative unit test 항목은 N/A — 코드 0.)
- [x] **본 fire 는 사용자 명시 override 로 PR/review 우회 direct commit** — 원래 commitMode=pr 의 architect/reviewer/integrator chain 대신 단일 direct commit 으로 main 머지. tester 의 `pnpm lint && pnpm build && pnpm test:cov` 실행은 본 fire 에서는 production code 변경 0 (ADR + doc 단락만) 이라 기존 main green (T-0566 머지 30514d8 시점 green + 직전 fire 들 conclusion=success) 위에서 누적 영향 0. coverage line/function ≥ 80% 유지 (production code 변경이 없어 변동 없음). 후속 resolver 구현 task 가 R-112 4 종 + pr-mode 정식 chain 으로 진행.

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
