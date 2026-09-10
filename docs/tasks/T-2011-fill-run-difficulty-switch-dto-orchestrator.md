---
id: T-2011
title: fill-run 난이도 스위치 DTO + orchestrator 배선 — UnevaluatedFillRunRequestDto + run 4 번째 인자 (ADR-0066 Follow-ups (b) 2/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 260
estimatedFiles: 4
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2010]
touchesFiles:
  - src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts
  - src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts
  - src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts
  - src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.spec.ts
plannerNote: P5 · ADR-0066 Follow-ups (b) 2/3 — fill-run 축 중단(DTO 필드 + orchestrator run 4 번째 인자)으로 core 까지 사슬 연결
---

# T-2011 — fill-run 난이도 스위치 DTO + orchestrator 배선

## Why

[ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) `§ Decision 2` 가 사전 난이도 routing 스위치의 배선 좌표를 `POST /evaluate` 와 fill-run 2 종으로 확정했다. `POST /evaluate` 축은 T-2009 가(main `f37a315d`), fill-run 축의 **하단 2 층**(helper + core)은 T-2010 이(main `ac2e5b8f`) 닫았다. 본 task 는 [T-2010 `## Follow-ups` (b-2)](T-2010-fill-run-difficulty-switch-core.md) 가 파일 · 배선 단위로 명시한 **중단 2 층** — HTTP request DTO 와 orchestrator — 을 이어 붙여 이미 머지된 core 6 번째 인자까지 사슬을 연결하고, [requirements.md](../requirements.md) `69 행` REQ-050 잔여 "운영 발화 0 축" 을 좁힌다.

**issue-still-relevant pre-check (origin/main `0a82d4b6` 실측)** — 중단 2 층은 여전히 **0 % 안착** 이다:

- `git grep -n "useInputDifficultyRouting" origin/main -- src/ web/ test/` 히트 전수(총 4 개 production 파일 + 6 개 spec) 중 `unevaluated-fill-run-request.dto.ts` · 그 spec · `unevaluated-fill-run-orchestrator.service.ts` · 그 spec 의 히트는 **0** 이다. production 히트는 `evaluate-activities.dto.ts` `199 행` · `assessment-evaluation.controller.ts` `297 행`(T-2009) 과 `build-fill-run-scoring-options.ts` `140 행` · `run-unevaluated-fill-run-core.ts` `126 행`(T-2010) 및 종전 `evaluation-scoring.service.ts` `54 행` · `108 행` 에 국한된다.
- [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) 는 80 행 전량에서 `54 행` 클래스가 `rawBridges`(`66~69 행`) + `modelId`(`76~79 행`) **2 축** 만 보유한다.
- [unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) `107~111 행` `run` 은 여전히 **3 인자** 이고, `136~142 행` core 위임은 **5 인자** 호출이라 T-2010 이 만든 6 번째 인자가 **아직 아무 caller 도 채우지 못한다**.

**cap 준수 근거(수치)** — 본 slice 는 4 파일 · 예상 260 LOC(R-112 4-카테고리 backbone × 1.5; 직전 동형 slice 실측 T-2009 = 268 LOC / 4 파일, T-2010 = 271 LOC / 4 파일). §3 소비처 동반 의무의 예외를 적용한다 — 새 DTO 필드 · 새 `run` 인자의 최종 HTTP 소비처는 [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `723 행` `@Post("unevaluated-fill-run")` 이지만, 그 파일과 controller spec 을 같은 PR 에 넣으면 **6 파일**(cap 5 초과)이 되고 T-2009 의 controller spec 증분 실측 +162 LOC 를 더하면 **~420 LOC**(cap 300 초과)가 된다. 따라서 controller 전사는 아래 `## Follow-ups` (b-3) 에 파일 · 배선 단위로 남긴다. 단 **orchestrator 축의 소비처 배선은 본 slice 안에서 충족** 된다 — 새 인자가 `136~142 행` core 호출로 그대로 전사되기 때문이다.

## Required Reading

- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — `§ Decision 1`(층 간 필드명 동일 철자) · `§ Decision 2` 배선 좌표 표(fill-run 행) · `§ Decision 3`(미지정 = OFF = 문자 단위 동일, HTTP 경계는 비-boolean 거부 / 서비스 경계는 throw 없이 OFF 환원)
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) — `43~50 행` import 목록(`IsBoolean` 미포함 상태) · `54 행` 클래스 · `71~79 행` `modelId` 의 `@IsOptional` 주석 문체(신규 필드가 mirror 할 형태)
- [src/assessment-evaluation/dto/evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) — `177~199 행` T-2009 가 박제한 스위치 필드 + 주석. **필드명 · decorator 조합 · 주석 문체를 그대로 mirror** 한다
- [src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) — `96~105 행` `run` 의 `@param` / `@throws` jsdoc · `107~111 행` 시그니처 · `134~142 행` core 위임
- [src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) — `109 행` jsdoc · `126 행` 6 번째 선택 인자 `useInputDifficultyRouting?: boolean | null` · `133 행` helper 전달(본 slice 가 채울 대상)
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.spec.ts) — `54 행` `plainToInstance` harness · `58 행` 최상위 describe · `112 행` · `126 행` `modelId` 선택/`null` 분기 · `150~176 행` unknown-field negative 군. 신규 케이스는 이 구조 끝에 덧붙인다
- [src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.spec.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.spec.ts) — `87 행` 최상위 describe · `88~134 행` happy(DI + core 위임) · `135~185 행` flow / 분기 · `186~220 행` error path · `221~317 행` negative 군 · `98 행` · `127 행` `service.run(...)` 호출 harness
- [src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.spec.ts) — `128~196 행` T-2009 가 박제한 스위치 DTO 케이스 6 종(happy / 명시 OFF / 미지정 / 비-boolean 거부 / `null` 흡수 / 오타 필드명). 본 slice 의 DTO spec 이 mirror 할 원본

## Acceptance Criteria

- [ ] `UnevaluatedFillRunRequestDto` 에 `@IsOptional() @IsBoolean() useInputDifficultyRouting?: boolean` 필드를 추가한다. 필드명은 `EvaluateActivitiesDto` `199 행` · `ScoringOptions` `54 행` 과 **동일 철자** 이고, `class-validator` 의 `IsBoolean` 을 `43~50 행` import 목록에 알파벳 순으로 넣는다 (새 dependency 0 — class-validator 는 이미 의존).
- [ ] **HTTP 경계는 비-boolean 을 거부한다** — `EvaluateActivitiesDto` 와 동일하게 `@IsBoolean()` 만 쓰고 `@Transform` / coercion 을 도입하지 않는다 (ADR-0066 `§ Decision 3`). `null` 은 `@IsOptional` 이 미지정과 동일하게 흡수한다.
- [ ] `UnevaluatedFillRunOrchestratorService.run` 이 **4 번째 선택 인자** `useInputDifficultyRouting?: boolean | null` 을 받아 `136~142 행` core 호출의 6 번째 인자로 **그대로 전사** 한다. 변환 · 정규화 · `=== true` 판정을 orchestrator 에서 **하지 않는다** (판정은 helper 단독 책임 — 이중 게이트 0).
- [ ] **인자는 선택** 이라 기존 3 인자 호출자(controller `723 행` 핸들러 및 orchestrator spec 전량)가 **무수정으로 컴파일** 된다. `pnpm build` 로 확인.
- [ ] `run` 의 jsdoc `96~105 행` 에 새 `@param` 한 줄을 추가하되 기존 `@param` · `@throws` 문구는 무변경.
- [ ] happy-path unit test 1+ — (1) DTO: `useInputDifficultyRouting: true` payload 가 error 0 (2) orchestrator: `run(bridges, undefined, DEFAULT_MODEL, true)` 호출 시 core → batch 가 받은 `ScoringOptions` 에 `useInputDifficultyRouting: true` 가 실린다.
- [ ] error path unit test 1+ — 스위치 ON 상태에서도 modelId 축 실패(`request` · `default` 모두 빈 값)의 한국어 `TypeError` 가 orchestrator 를 **흡수 없이 통과** 하고, 스위치가 그 fail-fast 를 우회하지 못함을 단언 (`186~220 행` describe mirror).
- [ ] 분기별 test 1+ — 스위치 3 갈래(`true` ON / `false` 명시 OFF / 미지정 OFF)를 DTO · orchestrator 양쪽에서 각각 분리 단언. OFF 2 갈래는 batch 가 받은 options 에 스위치 키가 **부재**(`"useInputDifficultyRouting" in options === false`) 함을 단언해 T-2010 이 고정한 "OFF 시 반환 shape 무변경" 을 층 너머로 재확인한다.
- [ ] negative case 를 예외 분기마다 1+ — DTO: (1) 문자열 `"true"` (2) 숫자 `1` (3) 객체 → 각각 `isBoolean` 위반 (4) `null` → `@IsOptional` 흡수 + `=== true` 가 false (5) 오타 필드명 `useInputDifficultyRoutingg` 는 DTO 단독 `validate()` 가 무시함을 `150~176 행` unknown-field 관행대로 단언. orchestrator: 비-boolean(`"true"` · `1`)을 넘겨도 **throw 없이** OFF 로 환원돼 options 에 스위치 키가 부재함을 단언 (ADR-0066 `§ Decision 3` 서비스 경계 규칙 — HTTP 밖 caller 안전 degrade).
- [ ] 축 독립성 단언 1+ — 스위치 ON × modelId 채택 분기(request 우선 / default fallback) 조합에서 modelId 결과가 스위치와 무관하게 종전과 동일함을 단언.
- [ ] 기존 단언 무수정 통과 — orchestrator spec `88~334 행` 전량과 DTO spec `58~178 행` 전량이 수정 없이 green (신규 describe 를 덧붙이는 형태로만 변경).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] PR diff 가 `touchesFiles` 4 개와 정확히 일치하고 diff ≤ 300 LOC (task 파일 `status:` 플립은 driver bookkeeping commit 소관 — PR 에 넣지 않는다).

## Out of Scope

- [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `723 행` `@Post("unevaluated-fill-run")` 핸들러의 전사 · 그 controller spec — 아래 `## Follow-ups` (b-3) 소관 (cap 근거는 `## Why` 의 6 파일 / ~420 LOC 수치).
- [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) · [run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) 무접촉 — T-2010 이 이미 머지했다. 본 slice 는 그 인자를 **채우기만** 한다.
- `evaluation-scoring.service.ts` · `llm-http-gateway.service.ts` · `difficulty-mapping.service.ts` 무접촉 (ON 경로 4xx 는 종전 그대로 전파).
- period bridge 경로(`545 행` · `616 행`) · 요약 경로(`905 행`) 배선 — ADR-0066 `§ Decision 2` 가 배선 규칙 밖으로 판정.
- `web/` · e2e · smoke 무접촉 — HTTP 계약 노출은 (b-3) 머지 후 별도 판단.
- `prisma/schema.prisma` · `package.json` · `.github/workflows/` 무접촉 (새 dependency 0 — CLAUDE.md §5).
- [requirements.md](../requirements.md) `69 행` REQ-050 재판정 — ADR-0066 `## Follow-ups` (e) 의 once-rule 대로 fill-run 축 **전량 머지 후 1 회만**.
- 주석 확장 절제 — 신규 doc comment 는 파일당 15 줄 이내. 그래도 300 LOC 초과가 예상되면 DTO 축만 남기고 orchestrator 축을 후속 slice 로 분리한 뒤 `Follow-ups` 에 수치와 함께 적는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(b-3) fill-run controller 전사** — [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `723 행` `@Post("unevaluated-fill-run")` 핸들러(`727~729 행`)에서 `dto.useInputDifficultyRouting` 을 orchestrator `run` 의 4 번째 인자로 전사 · 그 controller spec(ValidationPipe 비-boolean 400 negative + 오타 필드명 `forbidNonWhitelisted` 거부 포함, T-2009 의 `1293~1370 행` 군 mirror). **2 파일**.
