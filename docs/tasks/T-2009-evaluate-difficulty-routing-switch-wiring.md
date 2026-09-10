---
id: T-2009
title: POST /evaluate 에 사전 난이도 routing opt-in 스위치 배선 (ADR-0066 Follow-ups (a))
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2008]
touchesFiles:
  - src/assessment-evaluation/dto/evaluate-activities.dto.ts
  - src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: P5 · ADR-0066 Follow-ups (a) — REQ-050 잔여 "운영 발화 0" 축을 POST /evaluate 스위치 배선으로 닫는 첫 slice
---

# T-2009 — POST /evaluate 에 사전 난이도 routing opt-in 스위치 배선

## Why

[ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) `§ Decision 1` 이 사전 난이도 routing 의 발화 스위치를 **요청 DTO 의 선택 boolean 필드** `useInputDifficultyRouting` 으로 확정했고, `§ Decision 2` 가 배선 좌표를 `POST /evaluate` 와 fill-run 2 종으로 좁혔다. 본 task 는 그중 첫 좌표인 `POST /evaluate` 를 집행해 [requirements.md](../requirements.md) `69 행` REQ-050 이 남긴 잔여 **"운영 발화 0 축"** 을 절반 닫는다 (fill-run 축은 ADR-0066 `## Follow-ups` (b) 의 후속 slice).

**issue-still-relevant pre-check (origin/main `fc02206e` 실측)** — 아직 미해소가 확인됐다:

- `git grep -n "useInputDifficultyRouting" origin/main -- src/ web/ test/` 히트 **7 개 전수** 중 production 은 3 개뿐이고 모두 **선언 · 주석 · 읽기** 다: [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `54 행`(`ScoringOptions` 선택 필드 선언) · `81 행`(주석) · `108 행`(`=== true` ON 게이트). 나머지 4 개는 spec 파일(`evaluation-scoring.difficulty-routing.spec.ts` `38 행` · `251 행`, `evaluation-scoring.service.spec.ts` `269 행` · `299 행`)이라 **`true` 로 켜는 production 호출자는 0** 이다.
- [evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) `115~175 행` `EvaluateActivitiesDto` 에 스위치 필드가 **없고**, `IsBoolean` import 도 없다 (`23~34 행` import 목록 실측).
- [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `291 행` 의 조립 리터럴은 여전히 `modelId: dto.modelId,` 단일 키다.

즉 ADR-0066 `## Follow-ups` (a) 는 main 에 **0 % 안착** 이며 중복 slice 위험이 없다.

## Required Reading

- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — `§ Decision 1`(스위치 source · 필드명 고정) · `§ Decision 2`(배선 좌표 표) · `§ Decision 3`(미지정=OFF · 잘못된 값의 층별 취급) · `## Follow-ups` (a)
- [src/assessment-evaluation/dto/evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) — `23~34 행` import 목록 · `115 행` `EvaluateActivitiesDto` 클래스 선언
- [src/assessment-evaluation/dto/period-bridge.dto.ts](../../src/assessment-evaluation/dto/period-bridge.dto.ts) — `29 행` `IsBoolean` import · `73~84 행` `@IsOptional() + @IsBoolean()` 선택 boolean 필드 선례 (coercion 미부여 관행 포함). 본 task 는 이 패턴을 1:1 mirror 한다
- [src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts) — `16~24 행` `plainToInstance` + `validate` 직접 호출 harness, `26~45 행` valid payload fixture. 신규 케이스는 이 harness 재사용
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `159~163 행` controller-scope `ValidationPipe` 3 설정 · `263~267 행` Admin 가드 · `286~292 행` `orchestrator.evaluateActivities(activities, { modelId: dto.modelId })` 조립 리터럴 (배선 지점)
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) — `643 행` delegation describe (스위치 전사 검증 위치) · `1081 행` `EvaluateActivitiesDto (ValidationPipe negative cases)` describe (400 negative 추가 위치)
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) — `47~55 행` `ScoringOptions` · `107~113 행` ON/OFF 삼항 (본 task 는 **읽기만**, 수정 금지)

## Acceptance Criteria

- [ ] [evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) 의 `EvaluateActivitiesDto` 에 `@IsOptional()` + `@IsBoolean()` 로 검증되는 선택 필드 `useInputDifficultyRouting?: boolean` 가 추가되고, 필드명이 `ScoringOptions` `54 행` 과 **문자 단위로 동일** 하다 (ADR-0066 `§ Decision 1` 층 간 이름 일치).
- [ ] `@Type(() => Boolean)` 등 **coercion decorator 를 붙이지 않는다** — ADR-0066 `§ Decision 3` 이 임의 truthy 접기를 명시 기각. 파일 inspect 로 확인.
- [ ] [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `291 행` 조립 리터럴에 `useInputDifficultyRouting: dto.useInputDifficultyRouting` 전사 1 줄이 추가되고, 그 외 조립·위임·응답 shape 은 무변경이다.
- [ ] **happy-path 1+** — DTO spec: `useInputDifficultyRouting: true` / `false` / **필드 미지정** 3 payload 가 각각 validation error 0 으로 통과. controller spec(`643 행` describe): `dto.useInputDifficultyRouting === true` 인 요청에서 `evaluateActivities` 의 2 번째 인자가 `{ modelId, useInputDifficultyRouting: true }` 로 전사됨을 spy 인자로 확인.
- [ ] **error path 1+** — controller spec: 스위치가 `true` 인 요청에서 `orchestrator.evaluateActivities` 가 reject 하면 그 error 가 **그대로 전파** 되고 (swallow 0) `RunStatus.end` 가 1 회 호출됨을 확인 (`853~892 행` 기존 패턴 재사용).
- [ ] **분기별 1+** — 스위치 값 3 갈래(`true` / `false` / 미지정) 각각에 대해 controller 가 orchestrator 에 넘기는 옵션 객체를 분리 검증한다. 특히 **미지정 경로의 옵션이 `useInputDifficultyRouting: undefined` 여도 `=== true` 게이트가 false 로 남아 OFF 가 보존됨** 을 명시 검증 (ADR-0066 `§ Decision 3` "미지정 = OFF").
- [ ] **예외 분기마다 negative 1+** — `1081 행` `EvaluateActivitiesDto (ValidationPipe negative cases)` describe 에 비-boolean 값 **각각** 1 케이스씩 400 거부 확인: 문자열 `"true"` · 숫자 `1` · `null` · 객체/배열 중 1 종. 추가로 오타 필드명(예: `useInputDifficultyRoutingg`)이 `forbidNonWhitelisted` 로 400 거부됨 1 케이스.
- [ ] 기존 client 회귀 0 — 스위치 필드를 보내지 않는 기존 요청 payload spec 이 전부 종전과 동일하게 통과하고, 그 경로의 `generate` 인자 계약(`{ modelId }` 단일 키)이 변하지 않음을 [evaluation-scoring.difficulty-routing.spec.ts](../../src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts) 무수정 green 으로 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green (R-110).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`).
- [ ] PR diff 가 frontmatter `touchesFiles` 4 개와 정확히 일치하고 ≤ 300 LOC.

## Out of Scope

- **fill-run 축 배선** — [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) · [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) · [run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) 무접촉. ADR-0066 `## Follow-ups` (b) 의 별도 slice.
- **period bridge(`545 행` · `616 행`) · 요약(`905 행`) 경로** — ADR-0066 `§ Decision 2` 가 배선 규칙 밖으로 판정. 리터럴 무변경.
- [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) · [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) · [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) **수정 금지** — 주입 분기는 이미 실재하며 본 task 는 스위치를 세우는 축만 연다.
- `web/` · `prisma/` · `.github/workflows/` · `package.json` 무접촉. 새 외부 dependency 0.
- **e2e spec 추가 금지** — 4 파일 cap 보존. e2e 축은 (a)·(b) 전량 머지 후 별도 slice.
- [api.md](../architecture/api.md) 의 `POST /evaluate` 계약 문서 갱신 — 5 번째 파일이 되므로 본 PR 밖. Follow-ups 로 이관.
- [requirements.md](../requirements.md) `69 행` REQ-050 재판정 — [PLAN.md](../PLAN.md) `183 행` once-rule 대로 (a)·(b) **전량 머지 후 1 회만** (ADR-0066 `## Follow-ups` (e)).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
