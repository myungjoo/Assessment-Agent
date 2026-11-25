---
id: T-2092
title: POST /unevaluated-fill-run 이 기본 provider 의 config id 로 평가해 활동 있는 좌표가 실제로 저장되게 한다
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-11-24
independentStream: evaluation-tick-llm-config
dependsOn: [T-2091]
touchesFiles: [src/assessment-evaluation/assessment-evaluation.controller.ts, src/assessment-evaluation/assessment-evaluation.controller.spec.ts, src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts, test/e2e/schedules-cron.e2e-spec.ts, test/e2e/unevaluated-fill-run.e2e-spec.ts]
plannerNote: P7 · T-2091 Follow-up — fill-run controller 가 modelId 를 config id 자리에 넘겨 활동 있는 좌표 평가가 실패하는 버그 수정
---

# T-2092 — POST /unevaluated-fill-run 의 LLM config id 정정

## Why

T-2091 의 planner Follow-up 이다. `LlmHttpGateway.generate` 는 difficulty 가 없으면 `options.modelId` 를 **config id** 로 조회한다 (`src/llm/llm-http-gateway.service.ts` `109 행` ~ `125 행`). 그런데 `POST /api/assessment-evaluation/unevaluated-fill-run` handler 는 `resolveDefaultModelId()` 가 돌려준 row 의 `modelId` 를 default 로 orchestrator 에 넘긴다 (`src/assessment-evaluation/assessment-evaluation.controller.ts` `782 행` ~ `785 행`). config id 와 modelId 가 다르면 (`deploy/seed-llm-config.sh` 기본 id 는 `seed-local-llm`) 활동 있는 좌표의 평가가 모두 "LLM provider config 를 찾을 수 없습니다" 로 실패한다. README `64 행` (평가 없는 부분 일괄 평가, REQ-037) 의 수동 진입점이 결과를 남기지 못하는 상태다. 자동 tick (T-2091) 과 재수집 runner (T-2073) 는 이미 `resolveDefaultConfigId()` 로 고쳤다. 본 task 는 같은 선례를 controller 에 적용한다.

`dto.modelId` override 계약 판단 (T-2091 Follow-up 이 요구한 확인): override 값은 core 의 `buildFillRunScoringOptions` 를 거쳐 가공 없이 gateway 의 `options.modelId` 로 간다. `POST /evaluate` 의 `EvaluateActivitiesDto.modelId` (`src/assessment-evaluation/dto/evaluate-activities.dto.ts` `118 행` ~ `123 행`) 도 같은 방식으로 gateway 에 그대로 간다. 즉 두 route 모두 사실상 config id 를 받는다. web 에는 fill-run 호출처가 없다 (`git grep "unevaluated-fill-run" -- web/src` 0 건). 그래서 override 동작은 바꾸지 않고, default 출처만 config id 로 바꾸며, DTO 주석에 "gateway 가 config id 로 조회한다" 는 사실만 적는다. 버그 수정이고 기존 ADR (ADR-0048) 범위 안이며 새 dependency · schema 변경이 없어 §5 자동 진행 대상이다.

issue-still-relevant 확인 (origin/main `6620e01d`): `git grep -n "resolveDefaultModelId" origin/main -- src/assessment-evaluation/assessment-evaluation.controller.ts` 결과가 `228 행` (주석) · `784 행` (호출) 이다. `test/e2e/schedules-cron.e2e-spec.ts` `617 행` ~ `631 행` 의 대조군 test 도 아직 `failedCount` 1 을 기대한다. 아직 고쳐지지 않았으므로 본 task 는 유효하다.

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` `216 행` ~ `230 행` (생성자 주석) · `743 행` ~ `815 행` (`runUnevaluatedFill`) — 고칠 곳.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` (colocated spec — 고칠 곳). `158 행` · `288 행` · `411 행` 의 throw mock, `3509 행` ~ `3540 행` 의 `makeRunController`, `3700 행` ~ `3830 행` 의 `runUnevaluatedFill` describe.
- `src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts` `1 행` ~ `45 행` · `73 행` ~ `81 행` — 머리 주석과 `modelId` 필드 주석 (고칠 곳, 주석만).
- `src/llm/llm-provider-config-resolver.service.ts` `37 행` ~ `60 행` — `resolveDefaultModelId` 와 `resolveDefaultConfigId` 의 계약 (읽기만).
- `src/scheduling/evaluation-tick-runner.service.ts` 의 `resolveDefaultConfigId` 호출부 — T-2091 선례 (읽기만).
- `test/e2e/schedules-cron.e2e-spec.ts` `400 행` ~ `425 행` (config 생성, id ≠ modelId) · `561 행` ~ `631 행` (fill-run describe, 대조군 test) — 고칠 곳.
- `test/e2e/unevaluated-fill-run.e2e-spec.ts` `20 행` ~ `95 행` — `resolveDefaultModelId` · "default modelId" 를 서술하는 머리 주석 (고칠 곳, 주석만).

## Acceptance Criteria

- [ ] `runUnevaluatedFill()` 가 `resolveDefaultModelId()` 대신 `resolveDefaultConfigId()` 를 호출하고, 그 값을 `unevaluatedFillRunOrchestrator.run` 의 3 번째 인자로 넘긴다. 지역 변수 이름은 `resolvedDefaultConfigId` 처럼 의미를 드러낸다. orchestrator · core 의 매개변수 이름 (`defaultModelId`) 은 바꾸지 않는다.
- [ ] resolver 실패 시 동작은 바뀌지 않는다 — 503 (`ServiceUnavailableException`) 매핑, 한국어 메시지 보존, non-Error reject 시 fallback 메시지, orchestrator 미호출, run status 실패 1 건 기록.
- [ ] 생성자 주석 (`222 행` ~ `229 행`) 과 handler 주석 (`767 행` ~ `772 행`) 에서 "row 의 modelId 를 … 결정" 서술을 "row 의 id (config id) 를 … 결정, gateway 가 config id 로 조회" 로 고친다. ADR-0048 · T-0568 같은 역사 사실은 남긴다.
- [ ] DTO 주석: `modelId` 필드 주석에 "값은 gateway 가 LlmProviderConfig 의 id 로 조회한다 (`POST /evaluate` 와 같은 계약)" 를 한 줄 더하고, 머리 주석의 default 출처 서술을 config id 로 고친다. decorator · 필드 이름 · 검증 동작은 바꾸지 않는다.
- [ ] (happy-path unit) colocated spec `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 의 `makeRunController` 가 `resolveDefaultConfigId` 를 mock 하고, 기존 happy test 가 orchestrator 3 번째 인자로 resolver 반환값을 받음을 그대로 단언한다.
- [ ] (regression) 같은 spec 에 test 1+ 추가 — resolver mock 이 `resolveDefaultModelId` 와 `resolveDefaultConfigId` 에 서로 다른 값을 돌려줄 때 orchestrator 3 번째 인자가 config id 이고 `resolveDefaultModelId` 는 호출되지 않음을 단언한다. 결함이 되돌아오면 이 test 가 실패해야 한다.
- [ ] (error path · negative) 기존 resolver 실패 test 4 개 (0-row · 2+row · TypeError · non-Error reject → 503) 를 `resolveDefaultConfigId` reject 로 옮겨 그대로 통과시킨다. 삭제하지 않는다.
- [ ] (분기) handler 의 분기 (resolver 성공 / resolver 실패 → 503 / orchestrator reject raw 전파 / run status begin · end) 에 대한 기존 test 가 모두 통과한다. 분기 추가는 없다 — 신규 분기가 생기면 분기마다 test 1+ 를 더한다.
- [ ] (negative · 격리) 다른 route 용 throw mock 3 곳 (`158 행` · `288 행` · `411 행`) 의 키를 `resolveDefaultConfigId` 로 바꿔, 다른 route 가 resolver 를 잘못 호출하면 여전히 실패하게 한다.
- [ ] (e2e regression) `test/e2e/schedules-cron.e2e-spec.ts` 의 대조군 test "기간 끝 직전 활동은 좌표의 평가 대상이다_n" 의 기대를 `failedCount` 0 · `evaluatedCount` 1 이상 · assessment row 1 건 저장으로 바꾸고, 위의 "아직 config id 자리에 modelId 를 넘겨" 주석을 새 사실 (창 안 활동이 LLM 까지 가서 저장된다) 로 고친다. 수정 전 코드에서는 이 test 가 실패해야 한다.
- [ ] `test/e2e/unevaluated-fill-run.e2e-spec.ts` 머리 주석의 `resolveDefaultModelId()` 서술을 `resolveDefaultConfigId()` 로 고친다. 이 spec 의 test 기대값은 좌표 0 이라 바뀌지 않아야 한다.
- [ ] 검증 명령: `git grep -n "resolveDefaultModelId" -- src/assessment-evaluation test/e2e` 결과에 regression test 의 "호출되지 않음" 단언 외 hit 가 없다.
- [ ] R-110 — tester 가 `pnpm lint && pnpm build && pnpm test` 를 돌려 green 을 확인한다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] PR CI 의 unit · smoke · e2e 가 모두 green (R-113).
- [ ] 5 파일 외 변경 0. 행 범위 표기는 §12 규칙 (`~`, `N 행`, `L` prefix 금지) 을 새로 쓴 주석에만 적용한다.

## Out of Scope

- `LlmProviderConfigResolver` · `LlmHttpGateway` 변경. `resolveDefaultModelId` 메서드 삭제도 하지 않는다 (소비처가 0 이 되면 별도 task 로 판단).
- orchestrator (`unevaluated-fill-run-orchestrator.service.ts`) · core (`run-unevaluated-fill-run-core.ts`) · `buildFillRunScoringOptions` 의 매개변수 이름 변경.
- `dto.modelId` override 를 modelId 로 해석하도록 바꾸는 계약 변경 (API 계약 변경이라 별도 판단).
- `POST /evaluate` · `POST /period` 등 다른 route 의 modelId 처리.
- `docs/` 변경 (REQ-037 재판정은 하지 않는다 — §3.1 상 구현 arc 후 1 회 규칙과 무관한 단일 버그 수정이다).

## Suggested Sub-agents

implementer → tester (기존 ADR 범위 안의 버그 수정이라 architect 불필요).

## Follow-ups
