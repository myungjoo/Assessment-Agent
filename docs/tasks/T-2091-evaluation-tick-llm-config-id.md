---
id: T-2091
title: 자동 평가 tick 이 기본 provider 의 config id 로 평가해 활동 있는 좌표가 실제로 저장되게 한다
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-040]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-11-22
independentStream: evaluation-tick-llm-config
dependsOn: []
touchesFiles: [src/scheduling/evaluation-tick-runner.service.ts, src/scheduling/evaluation-tick-runner.service.spec.ts, test/e2e/schedules-cron.e2e-spec.ts]
plannerNote: P7 · T-2073 Follow-up (높음) — 자동 tick 이 modelId 를 config id 자리에 넘겨 활동 있는 좌표 평가가 전부 실패하는 버그 수정
---

# T-2091 — 자동 평가 tick 의 LLM config id 정정

## Why

T-2073 의 Follow-up (높음) 이다. `LlmHttpGateway.generate` 는 difficulty 가 없으면 `options.modelId` 를 **config id** 로 조회한다 (`src/llm/llm-http-gateway.service.ts` `109 행` ~ `119 행`). 그런데 자동 평가 tick (`EvaluationTickRunnerService`) 은 `resolveDefaultModelId()` 가 돌려준 row 의 `modelId` (예: `test-model`) 를 그 자리에 넘긴다. config id 와 modelId 가 다르면 (`deploy/seed-llm-config.sh` 기본값은 id `seed-local-llm` 이라 다르다) **활동 있는 좌표의 자동 평가가 모두 "LLM provider config 를 찾을 수 없습니다" 로 실패**한다. README `64 행` (평가 없는 부분 일괄 평가) · `72 행` ~ `73 행` (cron · manual trigger) 이 실제로 결과를 남기지 못하는 상태다. 기존 e2e 는 활동 없는 좌표만 저장 경로로 검증해서 드러나지 않았다.

재수집 runner 는 T-2073 에서 같은 결함을 `resolveDefaultConfigId()` 로 고쳤다. 본 task 는 그 선례를 tick 에 적용한다. 버그 수정이고 기존 ADR 범위 안이며 새 dependency · schema 변경이 없어 §5 자동 진행 대상이다.

issue-still-relevant 확인 (origin/main `785ca1fe`): `src/scheduling/evaluation-tick-runner.service.ts` `88 행` 이 아직 `const modelId = await this.resolver.resolveDefaultModelId();` 이고, `100 행` · `197 행` 에서 그 값을 `{ modelId }` 로 `generateAndPersistIfCollected` 에 넘긴다. 아직 고쳐지지 않았으므로 본 task 는 유효하다.

## Required Reading

- `src/scheduling/evaluation-tick-runner.service.ts` `84 ~ 110 행` · `163 ~ 210 행` (고칠 곳).
- `src/scheduling/evaluation-tick-runner.service.spec.ts` (colocated spec — 고칠 곳). 특히 `18 ~ 40 행` setup mock, `85 행` 의 `{ modelId: "m" }` 단언, `117 ~ 124 행` · `248 ~ 262 행` 의 resolver 실패 test.
- `src/llm/llm-provider-config-resolver.service.ts` `37 ~ 60 행` — `resolveDefaultModelId` 와 `resolveDefaultConfigId` 의 계약 (읽기만).
- `src/scheduling/recent-deletion-runner.service.ts` `114 ~ 125 행` — T-2073 선례 (읽기만).
- `test/e2e/schedules-cron.e2e-spec.ts` `20 ~ 30 행` (머리 주석), `132 ~ 175 행` (fetch 대체), `395 ~ 500 행` (tick describe · beforeEach 의 LlmProviderConfig 생성 · `triggerAndWait`) — 고칠 곳.
- `test/e2e/schedules-recent-refresh.e2e-spec.ts` `125 ~ 180 행` — LLM host 응답 stub 과 apiKey 암호화 생성 선례 (읽기만).

## Acceptance Criteria

- [ ] `EvaluationTickRunnerService.execute()` 가 `resolveDefaultModelId()` 대신 `resolveDefaultConfigId()` 를 호출하고, 그 값을 `generateAndPersistIfCollected` 의 `{ modelId: <config id> }` 로 넘긴다. 지역 변수 · 매개변수 이름은 `configId` 로 바꿔 의미를 드러낸다 (gateway 옵션 키 `modelId` 는 그대로).
- [ ] resolver 실패 시 동작은 바뀌지 않는다 — 작업 없이 멈추고 reject 하지 않으며, `평가 실행 중단: <message>` 로 기록하고 run status 에 실패 1 건을 남긴다.
- [ ] (happy-path unit) colocated spec `src/scheduling/evaluation-tick-runner.service.spec.ts` 의 setup mock 을 `resolveDefaultConfigId` 로 바꾸고, `generateAndPersistIfCollected` 3 번째 인자가 `{ modelId: <config id> }` 임을 단언한다.
- [ ] (regression, error path) 같은 spec 에 test 1+ 추가 — resolver mock 이 `resolveDefaultModelId` 와 `resolveDefaultConfigId` 에 서로 다른 값을 돌려줄 때 평가에 config id 가 쓰이고 `resolveDefaultModelId` 는 호출되지 않음을 단언한다. 결함이 되돌아오면 이 test 가 실패해야 한다.
- [ ] (error path · negative) 기존 resolver 실패 test 2 개 (`117 ~ 124 행` · `248 ~ 262 행`) 를 `resolveDefaultConfigId` reject 로 옮겨 그대로 통과시킨다. reject 값이 Error 가 아닌 경우 등 기존 negative 분기 test 는 삭제하지 않는다.
- [ ] (분기) `execute()` · `fillPerson()` 의 기존 분기 test (활성 인원 0 · 식별자 0 · 수집 불완전 null · 저장 실패 · 종료 중단) 가 그대로 통과한다. 분기 추가는 없다 — 신규 분기가 생기면 분기마다 test 1+ 를 더한다.
- [ ] (e2e regression) `test/e2e/schedules-cron.e2e-spec.ts` 의 tick describe 에서 LlmProviderConfig 를 암호화된 apiKey 로 만들고, fetch 대체가 LLM host 요청에 정상 응답 stub 을 돌려주게 한다 (recent-refresh e2e 선례). 그리고 **창 안 활동이 있는 닫힌 일 좌표**에 대해 trigger 후 assessment row 가 저장되고 run status 의 `evaluatedCount` 가 1 이상, `failedCount` 가 0 임을 단언하는 test 1 개를 추가한다. 수정 전 코드에서는 config 조회 실패로 이 test 가 실패해야 한다.
- [ ] e2e 머리 주석 `24 ~ 25 행` 의 "LLM 은 … 호출되지 않으며" 서술을 새 사실로 고친다. `POST /unevaluated-fill-run` 의 대조군 test (`589 ~ 602 행`, failedCount 1 기대) 는 본 task 에서 건드리지 않는다 — controller 경로는 아직 modelId 를 넘기므로 여전히 실패하는 것이 맞다. 그 test 의 주석만 실패 이유 (config id 자리에 modelId) 가 드러나게 고쳐도 된다.
- [ ] R-110 — tester 가 `pnpm lint && pnpm build && pnpm test` 를 돌려 green 을 확인한다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] PR CI 의 unit · smoke · e2e 가 모두 green (R-113).
- [ ] 3 파일 외 변경 0. 행 범위 표기는 §12 규칙 (`~`, `N 행`, `L` prefix 금지) 을 새로 쓴 주석에만 적용한다.

## Out of Scope

- `POST /unevaluated-fill-run` (`src/assessment-evaluation/assessment-evaluation.controller.ts` `784 행`) 의 같은 결함. controller 는 `dto.modelId` override 와 orchestrator 의 `defaultModelId` fallback 이 얽혀 있어 API 계약 판단이 따로 필요하다. Follow-ups 로 남긴다.
- `LlmProviderConfigResolver` · `LlmHttpGateway` 변경 (`resolveDefaultConfigId` 는 T-2073 에서 이미 있다).
- `src/scheduling/recent-deletion-runner.service.ts` (이미 고쳐짐).
- 자동 tick 의 최근 1 주 재수집 · 재수집 후 Summary 재생성 (T-2069 Follow-ups 의 owner 항목).
- `docs/` 변경 (REQ 재판정은 하지 않는다 — §3.1 상 구현 arc 후 1 회 규칙과 무관한 단일 버그 수정이다).

## Suggested Sub-agents

implementer → tester (기존 ADR 범위 안의 버그 수정이라 architect 불필요).

## Follow-ups

- (planner) `POST /unevaluated-fill-run` 도 `resolveDefaultModelId` 를 gateway 의 config id 자리에 넘긴다 (`assessment-evaluation.controller.ts` `784 행`). `dto.modelId` override 가 config id 인지 modelId 인지 계약을 먼저 확인한 뒤 별도 `pr` task 로 고친다. 그때 `schedules-cron.e2e-spec.ts` 의 fill-run 대조군 test 기대값도 함께 바뀐다.
