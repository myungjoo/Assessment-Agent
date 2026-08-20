---
id: T-1630
title: ADR-0057 에 S1 전제조건(LlmProviderConfig 단일-row seed 경로) D5 결정 박제
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 140
estimatedFiles: 2
independentStream: r91-load-harness
dependsOn: [T-1629]
touchesFiles:
  - docs/decisions/ADR-0057-s1-batch-load-io-isolation.md
  - docs/ops/load-resilience-test-plan.md
created: 2026-08-20
plannerNote: R-91 chain 11/N — S1 스크립트 착수 전 미결 전제조건(provider row 없으면 503) 을 ADR-0057 D5 로 확정
---

# T-1630 — ADR-0057 에 S1 전제조건(LlmProviderConfig 단일-row seed 경로) D5 결정 박제

## Why

오너 지시([docs/PLAN.md](../PLAN.md) `144 행` "R-91 k6 최우선·즉시 착수") chain 의 다음 조각은
[ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `## 범위 밖` 2 번째 항목인
`test/load/s1-batch.js` 신설이다. 그런데 그 스크립트를 지금 쓰면 **부하 job 에서 반드시 실패**한다 —
D2 가 확정한 타격 route([src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts)
`599 행` `@Post("unevaluated-fill-run")`)는 orchestrator 위임 **전에**
`LlmProviderConfigResolver.resolveDefaultModelId()` 를 await 하고, 그 resolver 는
`findMany()` row 가 0 이면 fail-fast Error → controller 가 `ServiceUnavailableException`(503) 으로
매핑한다. 부하 job 의 PostgreSQL service 는 run 마다 빈 DB 라 **모든 batch 호출이 503** 이 되어
D4 의 `http_req_duration{route:batch}` 환산 임계가 무의미해지고 전역 `http_req_failed` 도 오염된다.

ADR-0057 은 이 전제조건을 결정하지 않았다 — D1 은 `LLM_GATEWAY` binding(호출 시점)만 다루고,
resolver 가 요구하는 **DB row 존재**는 어느 D 에도 없다. 게다가 정공법인
`POST /api/llm/providers`([src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts)
`124 행`, Admin+)는 `LlmApiKeyCipher` 가 `LLM_APIKEY_ENC_KEY` env 를 요구하는데
[.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) 의 컨테이너 기동 step 이 주입하는
env 는 `DATABASE_URL` · `AUTH_JWT_SECRET` · `PORT` 3 개뿐이라 그대로는 500 이다. 즉 **스크립트보다
결정이 먼저**다([CLAUDE.md](../../CLAUDE.md) `§1` "코드보다 ADR이 먼저다", ADR-0057 자신이 `##
Consequences` 부정 4 에서 amendment 경로를 예고). 본 slice 는 그 결정 하나만 닫고 스크립트 ·
workflow · script 배선은 후속 slice 로 유지한다(결정-전용 PR 은 T-1626 선례 승계).

## Required Reading

- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) — 개정 대상. 특히 `## Decision` D1~D4, `## Alternatives considered` 표, `## 범위 밖`, `## Consequences` 부정 4
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2` S1 · `§3` 표 S1 두 행 · `§5` Follow-up item 3 (pointer 동기 대상)
- [src/llm/llm-provider-config-resolver.service.ts](../../src/llm/llm-provider-config-resolver.service.ts) — 0-row / 2+row / 빈 modelId 3 분기 fail-fast (단일-row invariant 의 근거)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `599 행` 부근 — resolver 실패의 503 매핑
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) `124 행` 부근 — `POST /api/llm/providers` 의 Admin+ 가드와 service 의 apiKey 암호화 경로
- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) `41~71 행` — `LLM_APIKEY_ENC_KEY` 필수(평문 fallback 금지) 사실
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 컨테이너 기동 step 의 env 3 종(현 사실 인용용, 본 task 는 수정 금지)
- [CLAUDE.md](../../CLAUDE.md) `§5` — secret 처리 / 신규 dependency BLOCKED 경계

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0057-s1-batch-load-io-isolation.md` 의 `## Decision` 에 `### D5. S1 전제조건 — LlmProviderConfig 단일-row seed 경로` 절이 신설되고, 아래 3 후보 중 **정확히 1 개를 채택**한 문장이 있다: ① S1 `setup()` 이 `POST /api/llm/providers` 를 호출 + 부하 job 에 test-only `LLM_APIKEY_ENC_KEY` 주입(기존 `AUTH_JWT_SECRET=ci_load_secret` 더미 선례 범위), ② workflow 가 `psql` 로 row 를 직접 INSERT(더미 ciphertext — stub 아래에서는 복호화가 일어나지 않음), ③ 부하 전용 resolver 우회 분기 신설.
- [ ] 탈락한 2 안이 `## Alternatives considered` 표에 행으로 추가되고 각각 **채택 안 한 이유**가 한 문장 이상으로 적혀 있다(③ 은 ADR-0057 D2 의 "실 배치 경로와 갈라지면 대표성이 무너진다" 논거와 정합해야 한다).
- [ ] D5 가 **단일-row invariant** 를 명시한다 — resolver 가 `0-row` 와 `2+row` 를 모두 fail-fast 로 막으므로 seed 는 정확히 1 row 여야 하고, S1 `setup()` 재실행 · S2/S3 와의 같은 job 공존에서 row 가 2 개가 되지 않도록 하는 방식(멱등 seed 또는 `teardown()` 정리)이 결정에 포함된다.
- [ ] D5 가 **credential 0 유지**를 명시한다 — 채택안이 실 LLM API key · repo secret 신설을 요구하지 않으며, 주입되는 값이 test-only 더미임을 문장으로 못 박는다.
- [ ] `## Consequences` 부정 절에 본 결정의 trade-off 1 항 이상이 추가된다(예: 더미 키·더미 ciphertext 아래에서는 실 복호화 경로가 미검증으로 남는다).
- [ ] frontmatter `relatedTask` 에 `T-1630` 이 추가되고, 본문에 개정 사실(개정일 `2026-08-21` + `T-1630`)이 한 줄로 표기된다. `status: ACCEPTED` 는 유지하고 D1~D4 의 결정 내용은 **변경 0**(문구 재작성 금지 — D5 추가와 부정 1 항 · Alternatives 행 추가만).
- [ ] `docs/ops/load-resilience-test-plan.md` 의 `§5` Follow-up item 3(또는 `§2` S1 주의)에 D5 를 가리키는 pointer 1~2 줄이 추가된다. `§3` 임계 표는 **무수정**(재산정 0).
- [ ] 인용한 파일·행 좌표가 실제와 일치한다(`599 행` route · `124 행` POST · resolver 3 분기 · workflow env 3 종). 행 범위 표기는 `§12` 규약(물결 `~`, `L` prefix 금지)을 따른다.
- [ ] 채택안이 **repo secret 신설 · 프로덕션 secret 처리 변경 · 신규 dependency · DB schema 변경** 중 하나라도 요구하면 ADR 을 쓰지 말고 즉시 BLOCKED 처리 후 notifier 로 넘긴다([CLAUDE.md](../../CLAUDE.md) `§5`).
- [ ] R-112 — 본 task 는 production code 변경 0(문서 2 파일만)이라 신규/수정 public symbol 이 없다. 따라서 ① happy-path unit test, ② error path test, ③ 분기 cover, ④ negative cases 는 **대상 symbol 부재로 해당 없음**이며, 그 사실을 PR 본문에 명시한다(T-1626 선례).
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 문서 변경이 기존 spec 을 깨지 않았음을 확인.

## Out of Scope

- `test/load/s1-batch.js` 신설 — 다음 slice(D2 route 타격 + D3 tag + D4 산식 + D5 seed 적용).
- `.github/workflows/load-k6.yml` 수정 — step 재배치(smoke → S1 → S2 → S3) · env 주입은 다음 slice. 본 task 는 현 사실 **인용만** 한다.
- `package.json` 의 `test:load:s1` script, `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 확장.
- `src/` 변경 일체(resolver · controller · provider config service 무수정).
- `§3` 임계 재산정, 133명 full seed 투입, baseline 실측, REQ-047 status 전이.
- ADR-0057 D1~D4 문구 재작성 · ADR-0048 / ADR-0054 본문 수정 · 신규 ADR 신설.

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
