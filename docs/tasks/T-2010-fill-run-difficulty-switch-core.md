---
id: T-2010
title: fill-run 난이도 스위치 하단 2 층 배선 — buildFillRunScoringOptions + runUnevaluatedFillRunCore (ADR-0066 Follow-ups (b) 1/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 250
estimatedFiles: 4
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2008, T-2009]
touchesFiles:
  - src/assessment-evaluation/dto/build-fill-run-scoring-options.ts
  - src/assessment-evaluation/dto/build-fill-run-scoring-options.spec.ts
  - src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts
  - src/assessment-evaluation/dto/run-unevaluated-fill-run-core.spec.ts
plannerNote: P5 · ADR-0066 Follow-ups (b) 1/3 — fill-run 축 하단(순수 factory + core)에 스위치 pass-through, 10 파일 축을 3 slice 로 split
---

# T-2010 — fill-run 난이도 스위치 하단 2 층 배선 (buildFillRunScoringOptions + runUnevaluatedFillRunCore)

## Why

[ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) `§ Decision 2` 가 사전 난이도 routing 스위치의 배선 좌표를 **`POST /evaluate` 와 fill-run 2 종** 으로 확정했다. 첫 좌표(`POST /evaluate`)는 T-2009 가 머지했고(main `f37a315d`), 남은 것이 `## Follow-ups` (b) **fill-run 축** 이다. 본 task 는 그 축의 **하단 2 층** — 순수 factory [buildFillRunScoringOptions](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) 와 그 유일 소비처 [runUnevaluatedFillRunCore](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) — 을 닫아 [requirements.md](../requirements.md) `69 행` REQ-050 잔여 "운영 발화 0 축" 의 나머지 절반을 향한 첫 slice 를 집행한다.

**issue-still-relevant pre-check (origin/main `a768ca67` 실측)** — fill-run 축은 아직 **0 % 안착** 이다:

- `git grep -n "useInputDifficultyRouting" origin/main -- src/ web/ test/` 히트 전수 중 fill-run 사슬 6 파일(`unevaluated-fill-run-request.dto.ts` · 그 spec · `build-fill-run-scoring-options.ts` · 그 spec · `run-unevaluated-fill-run-core.ts` · 그 spec) 의 히트는 **0** 이다. 히트는 전부 T-2009 가 닫은 `POST /evaluate` 축(`assessment-evaluation.controller.ts` `297 행` · 그 spec) 과 종전 scoring service 축(`evaluation-scoring.service.ts` `54 행` 선언 · `108 행` `=== true` 게이트)에 국한된다.
- [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~110 행` 시그니처는 여전히 `(requestModelId, defaultModelId)` **2 인자** 이고, 반환 `116 행` · `123 행` 은 `{ modelId }` **단일 키** 다.
- [run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) `116~122 행` 시그니처는 **5 인자** 이고 `125 행` 위임은 2 인자 호출 그대로다.

**split 근거(수치)** — ADR-0066 `## Follow-ups` (b) 는 "5 파일" 로 적었으나 실측 축은 **10 파일** 이다: DTO(`unevaluated-fill-run-request.dto.ts` + spec) · orchestrator([unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) `107~111 행` `run` 3 인자 + spec) · controller(`723 행` `@Post("unevaluated-fill-run")` + spec) · core(+ spec) · helper(+ spec). CLAUDE.md §3 cap(≤ 5 파일)을 넘으므로 3 slice 로 split 하고 본 task 는 **하단 helper + 그 유일 소비처 core** 4 파일만 집행한다. §3 소비처 동반 의무는 **본 slice 안에서 충족** 된다 — 확장되는 helper 의 유일한 production 소비처가 core `125 행` 이고 그 배선을 같은 PR 에 넣기 때문이다. 상단 2 slice 는 `## Follow-ups` 에 파일 · 배선 단위로 명시한다.

## Required Reading

- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — `§ Decision 2` 배선 좌표 표(fill-run 행) · `§ Decision 3`(미지정 = OFF = 문자 단위 동일, HTTP 밖 caller 의 비-boolean 은 **throw 없이 OFF 환원**) · `## Follow-ups` (b)
- [src/assessment-evaluation/dto/build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) — `57 행` `normalizeModelId`(modelId 전용 fail-fast) · `108~131 행` 본체(반환 `116 행` · `123 행`, fallback 불가 throw `126~130 행`)
- [src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) — `116~122 행` 시그니처 · `125 행` helper 위임 · `133 행` batch 위임
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) — `47~56 행` `ScoringOptions`(스위치 필드 `useInputDifficultyRouting?: boolean` 선언) · `107~113 행` `=== true` ON 게이트 삼항
- [src/assessment-evaluation/dto/build-fill-run-scoring-options.spec.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.spec.ts) — `8 행` · `30 행` · `56 행` · `70 행` · `90 행` · `106 행` 6 개 describe 블록 구조. 신규 케이스는 이 구조에 describe 1 개를 덧붙이는 형태로 넣는다
- [src/assessment-evaluation/dto/run-unevaluated-fill-run-core.spec.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.spec.ts) — `47~64 행` mock `resolvePerson` / `persist` fixture · `124~162 행` "options modelId 채택 분기" describe(신규 케이스가 mirror 할 harness)
- [src/assessment-evaluation/dto/evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) — T-2009 가 박제한 스위치 필드 주석 문체(층 간 표현 일치용 참조)

## Acceptance Criteria

- [ ] `buildFillRunScoringOptions` 가 **3 번째 선택 인자** `useInputDifficultyRouting` 을 수용한다. 인자 이름은 `ScoringOptions` `54 행` · `EvaluateActivitiesDto` 와 **동일 철자** 로 고정한다 (ADR-0066 `§ Decision 1` 의 층 간 이름 일치).
- [ ] **OFF 시 반환 shape 무변경** — 인자가 `true` 가 **아닌** 모든 경우(미지정 / `undefined` / `null` / `false` / 비-boolean) 반환은 `{ modelId }` **단일 키** 그대로다. `useInputDifficultyRouting: false` 키를 얹지 않는다 (ADR-0066 `§ Decision 3` "미지정 = OFF = 문자 단위 동일" — 기존 `toEqual({ modelId })` 단언 전량이 무수정 통과해야 한다).
- [ ] **ON 시에만 키가 실린다** — 인자가 `=== true` 일 때만 반환에 `useInputDifficultyRouting: true` 가 포함된다. `evaluation-scoring.service.ts` `108 행` 과 동일한 **엄격 비교** 를 쓰고 truthy coercion 을 도입하지 않는다.
- [ ] **비-boolean 은 throw 하지 않는다** — helper 는 modelId 축의 `normalizeModelId` fail-fast 를 스위치 인자에 **적용하지 않고** OFF 로 환원한다 (ADR-0066 `§ Decision 3` service 경계 규칙). modelId 축의 기존 `TypeError` 4 종은 문구 · 조건 모두 무변경.
- [ ] `runUnevaluatedFillRunCore` 가 **6 번째 선택 인자** 로 같은 스위치를 받아 `125 행` helper 호출에 그대로 전달한다. 인자는 **선택** 이라 기존 5 인자 호출자(orchestrator `136~142 행` 및 spec 전량)가 무수정으로 컴파일된다.
- [ ] 도출 순서 불변 — 스위치 유무와 무관하게 options 도출이 dedup · batch **앞** 에 남는다(기존 `163~195 행` describe 가 무수정 통과).
- [ ] happy-path unit test 1+ — 변경된 public symbol 2 개 각각에 대해 ON 요청이 `useInputDifficultyRouting: true` 로 실린 `ScoringOptions` 를 만들고(core 는 `runUnevaluatedFillBatch` 가 받은 options 로 관측) 결과가 정상 반환된다.
- [ ] error path unit test 1+ — 스위치 ON 상태에서도 modelId 축의 실패(`request`·`default` 모두 빈 값 → 한국어 `TypeError`)가 **그대로 전파** 되고, 스위치가 그 차단을 우회하지 못함을 단언한다.
- [ ] 분기별 test 1+ — 스위치 분기 3 갈래(`true` ON / `false` 명시 OFF / 미지정 OFF)를 helper · core 양쪽에서 각각 분리 단언. modelId 채택 분기(request 우선 / default fallback) × 스위치 ON 조합 1+ 도 포함해 두 축이 독립임을 고정한다.
- [ ] negative case 를 예외 분기마다 1+ — (1) `null` (2) 문자열 `"true"` (3) 숫자 `1` (4) 객체 — 각각 **throw 없이** OFF 로 환원되고 반환에 스위치 키가 **부재** 함을 단언 (비-boolean truthy 가 조용히 ON 으로 접히지 않음이 load-bearing).
- [ ] 비변형 유지 — 스위치 인자를 받아도 입력 mutate 0 이고 반환은 매 호출 새 객체임을 단언 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] PR diff 가 `touchesFiles` 4 개와 정확히 일치하고 diff ≤ 300 LOC (task 파일 `status:` 플립은 driver bookkeeping commit 소관 — PR 에 넣지 않는다).

## Out of Scope

- [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) 에 DTO 필드 추가 — 상단 slice 소관(아래 Follow-ups (b-2)).
- [unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) `run` 시그니처 확장 · [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `723 행` route 전사 — 상단 slice 소관.
- period bridge 경로(`545 행` · `616 행`) · 요약 경로(`905 행`) 배선 — ADR-0066 `§ Decision 2` 가 배선 규칙 밖으로 판정.
- `evaluation-scoring.service.ts` · `llm-http-gateway.service.ts` · `difficulty-mapping.service.ts` 무접촉 (ON 경로 4xx 는 종전 그대로 전파).
- `prisma/schema.prisma` · `package.json` · `.github/workflows/` 무접촉 (새 dependency 0 — CLAUDE.md §5).
- [requirements.md](../requirements.md) `69 행` REQ-050 재판정 — ADR-0066 `## Follow-ups` (e) 의 once-rule 대로 fill-run 축 **전량 머지 후 1 회만**.
- 주석 확장 절제 — 본 slice 는 기존 파일의 서술 문체를 따르되 신규 doc comment 를 각 파일 15 줄 이내로 유지한다. 그래도 300 LOC 초과가 예상되면 helper 축만 남기고 core 축을 후속 slice 로 분리한 뒤 `Follow-ups` 에 수치와 함께 적는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(b-2) fill-run DTO + orchestrator 축** — [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) `54 행` 클래스에 `@IsOptional() @IsBoolean() useInputDifficultyRouting?: boolean` 추가 · 그 spec · [unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) `107~111 행` `run` 에 4 번째 선택 인자 추가 + `136~142 행` core 위임 전사 · 그 spec. **4 파일**.
- **(b-3) fill-run controller 전사** — [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `723 행` `@Post("unevaluated-fill-run")` 핸들러에서 `dto.useInputDifficultyRouting` 을 orchestrator `run` 으로 전사 · 그 controller spec(비-boolean 400 negative 포함). **2 파일**.
