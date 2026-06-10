---
id: T-0339
title: period-bridge live-LLM 검증 smoke spec 신설 (env-gated, ADR-0037 §Decision5)
phase: P5
status: DONE
completedAt: 2026-06-11T03:45:00+09:00
mergedAs: 0361ba7
reviewRounds: 1
commitMode: pr
prNumber: 282
coversReq: [REQ-009, REQ-096, REQ-097]
estimatedDiff: 190
estimatedFiles: 1
independentStream: live-llm-bridge-verification
dependsOn: []
touchesFiles: [test/smoke/period-bridge-live.smoke-spec.ts]
created: 2026-06-11
plannerNote: P5 live-LLM 검증(사용자 승인 c40177a, 만료 6/30·격상 6/25) slice 1/2 — env-gated bridge live spec. single-spec × 1.0.
---

# T-0339 — period-bridge live-LLM 검증 smoke spec 신설 (env-gated)

## Why

[ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Decision5 가 deferred 한 live-LLM bridge 검증을 사용자가 승인했다 (PLAN.md P5 bullet, c40177a 박제 — **credential 만료 2026-06-30, 6/25 격상 트리거, 오늘 6/11**). 머지된 mocked-only bridge 의 평가 경로(evaluateActivities → EvaluationScoringService → LlmHttpGateway → narrative)를 **실 네트워크 LLM 1회 round-trip** 으로 검증하기 위한 env-gated live smoke spec 을 신설한다. gating env 부재 시 `describe.skip` → public CI 항상 green (R-113) — T-0228 의 `llm-live-azure.smoke-spec.ts` 패턴을 bridge 수준으로 확장한다.

본 task 는 slice 1/2 (spec 인프라). 실 credential 주입 + 1회 실행 + 결과 박제는 후속 slice 2/2 (T-0230 credentialed-live-run 선례 mirror) — 만료일 임박으로 본 task merge 직후 즉시 큐잉한다. 새 외부 dependency 0 (Node 내장 fetch + 기존 gating helper 재사용) / 본 task 자체의 실 credential 0.

## Required Reading

- `test/smoke/llm-live-azure.smoke-spec.ts` — **mirror 정본** (T-0228). gating 판정(`resolveLiveTestGating`) / `describeLive = gating.enabled ? describe : describe.skip` / `makeLiveGateway()` (repository stub `provider: LlmProvider.AzureOpenai` + `endpointUrl: gating.baseUrl` + `modelId: gating.model`, cipher stub `decrypt → gating.apiKey`, difficultyMappingService throw stub) / §9 격리 (실값 코드 기재 0) / `jest.setTimeout(30000)` 패턴을 그대로 따른다. **provider 라벨 매핑 주의** (gating 내부 라벨 `"azure"` ≠ wire enum `LlmProvider.AzureOpenai = "azure_openai"` — repository stub 에는 반드시 후자).
- `src/llm/llm-live-test-gating.ts` — gating helper (T-0227, 변경 0 소비만). azure 분기 = `LLM_LIVE_PROVIDER=azure_openai` + 5-field (`LLM_LIVE_TEST`/`LLM_LIVE_BASE_URL`/`LLM_LIVE_API_KEY`/`LLM_LIVE_API_VERSION`/`LLM_LIVE_MODEL`) 완전성.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` — 검증 대상 bridge. 생성자 3 collaborator (`CollectionSpecService` / `CollectionOrchestratorService` / `EvaluationOrchestratorService`), `generateEphemeral(person, period, options: ScoringOptions)` 시그니처 (L97~122 — options 가 evaluateActivities 로 pass-through → scoring 의 `gateway.generate(prompt, { modelId })` 로 흐름).
- `src/assessment-evaluation/period-bridge-ephemeral.service.spec.ts` — person fixture (`PeriodBridgePersonInput.serviceIdentities`) + Activity fixture 형태 mirror 출처 (collection stub 이 반환할 synthetic Activity 가 `filterActivitiesByAuthor` 를 통과하도록 author/externalId 정렬 방법).
- `src/assessment-evaluation/evaluation-scoring.service.ts` — `ScoringOptions` 형태 + `gateway.generate(prompt, { modelId })` 정확히 1회 호출 (L56~99). live spec 의 `options.modelId` 는 repository stub config id (예: `"cfg-live-azure-1"`) 여야 modelId 직접 경로를 탄다.
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — `evaluateActivities` 가 deduped input 당 scoring 1회 호출 (L92~101) → **fixture Activity 정확히 1건이어야 실 LLM 호출이 1회로 bound** 됨 (T-0245 bounded-single-request 선례).
- `src/assessment-collection/domain/activity.ts` + `src/assessment-collection/domain/author-filter.ts` — synthetic Activity fixture 의 typed surface + 귀속 매칭 규칙.

## Acceptance Criteria

- [ ] `test/smoke/period-bridge-live.smoke-spec.ts` 신설 — `resolveLiveTestGating(process.env)` 로 gating 판정 후 `gating.enabled ? describe : describe.skip` 패턴 suite 등록. **gating env 부재 시 전 it skip → public CI green** (R-113, T-0228 mirror).
- [ ] **compose 구조**: 실 `LlmHttpGateway` (llm-live-azure 의 `makeLiveGateway()` mirror — repository stub `provider: LlmProvider.AzureOpenai` / `endpointUrl: gating.baseUrl` / `modelId: gating.model`, cipher stub → `gating.apiKey`, difficultyMappingService throw stub) → 실 `EvaluationScoringService(gateway)` → 실 `EvaluationOrchestratorService(scoring)` → `PeriodBridgeEphemeralService(specServiceStub, collectionOrchestratorStub, evaluation)`. **collection leg 는 stub** (실 GitHub/Confluence credential 본 task 밖 — Q-0024/0025): `collectActivities` 가 synthetic `Activity[]` **정확히 1건** 을 반환해 실 LLM round-trip 을 1회로 bound (T-0245 선례).
- [ ] **귀속 정렬**: synthetic Activity 의 author/externalId 가 person fixture 의 `serviceIdentities[].externalId` 와 매칭되어 `filterActivitiesByAuthor` 를 통과 (기존 period-bridge-ephemeral.service.spec.ts fixture mirror) — 평가 입력 1건 보장.
- [ ] **happy-path invariant (live enabled 시 — CI 에서는 skip)**: `generateEphemeral(person, period, { modelId: "<config id>" })` 1회 호출 결과 `EvaluationResult[]` 길이 1, `narrative` 가 비어있지 않은 string, scoring 파생 필드 (score 등 EvaluationResult typed surface) 존재 assert. 내용 의미는 비결정적이라 assert 안 함 (ADR-0025 §2 동형). **평가문 품질·scoring·narrative 경로 확인** = PLAN bullet 충족 지점.
- [ ] **분기 — skip path 검증**: public CI (env 부재) 는 항상 skip 경로. `pnpm test:smoke` 가 본 spec 을 픽업하고 (`.smoke-spec.ts` suffix → `test/jest-smoke.json` testRegex 자동) skip 으로 green 통과. live enabled 경로의 실 호출은 후속 slice 2/2 책임 — 본 task 의 CI 검증 책임은 skip 경로 green 까지.
- [ ] **negative/격리 (§9)**: 실 credential 값 (base URL·API key) 을 spec 파일 어디에도 기재하지 않는다 (env=`gating` 출처만). persist symbol 주입 0 검증 (bridge 구조적 write-0 보존 — collection/spec stub 외 persist service·PrismaService 참조 0). `jest.setTimeout(30000)` 으로 live hang 대비 (skip 시 미발화).
- [ ] **provider 라벨 negative**: repository stub 의 `provider` 에 `gating.provider`(="azure") 를 그대로 넣지 않고 `LlmProvider.AzureOpenai` 를 넣는다 — 혼동 시 gateway "미지원 provider" throw (T-0228 핸드오프 주의 mirror, 주석으로 박제).
- [ ] **smoke spec colocated unit spec 면제**: smoke 파일은 `scripts/check-spec-presence.sh` 제외 대상 — colocated `.spec.ts` 불요. production 코드 변경 0 이므로 R-112 unit 4종은 본 spec 의 invariant assert + skip 분기로 충족 (분기 = gating enabled/skip 2종).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:smoke` 통과 (본 spec env 부재 skip → green, 기존 smoke 회귀 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 코드 변경 0 이라 coverage 영향 0 확인.

## Out of Scope

- **slice 2/2 credentialed live run** — 로컬 `secrets.env` (repo 밖, `AZURE_OPENAI_*` → `LLM_LIVE_*` 매핑, Q-0022 경로 재사용, 만료 2026-06-30) env 주입 후 실 네트워크 1회 실행 + 결과 박제. **절대 본 task 에 포함 금지** (실 credential 주입·실 호출 0). 본 task merge 직후 즉시 후속 큐잉 (만료 6/30·격상 6/25).
- 실 GitHub/Confluence live 수집 — collection leg 는 stub (Q-0024/0025 별도 credential 게이트). bridge live 검증의 목적은 LLM 평가 leg 다.
- `src/llm/llm-live-test-gating.ts` / `LlmHttpGateway` / bridge service 등 production 코드 변경 — 전부 소비만 (변경 0).
- controller (POST /period) HTTP 경유 live e2e — 본 spec 은 service-level compose 검증. HTTP+RBAC 경로는 기존 mocked e2e (T-0318) 가 cover.
- timezone KST ADR (PLAN P5 별도 bullet — 사용자 확정, 시한 없음) — 별도 task.

## Suggested Sub-agents

implementer → tester (architect 불요 — ADR-0037 §Decision5 + ADR-0025 계약 기존재, 신규 결정 0)

## Follow-ups

- (planner, 본 task merge 직후 최우선) slice 2/2 — credentialed live run: 사용자 secrets.env 주입 환경에서 `pnpm test:smoke` (gating env set) 1회 실행, 평가문 품질·scoring·narrative 결과를 journal/details 에 박제 (실값·secret 기재 금지 §9). T-0230 선례 mirror. **deadline 2026-06-30 (만료) / 2026-06-25 (격상 트리거)**.
- (deferred) timezone KST(Asia/Seoul) ADR-first 박제 — PLAN P5 bullet (사용자 결정 2026-06-11), live-LLM chain 종결 후.
