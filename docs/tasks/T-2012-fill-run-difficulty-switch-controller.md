---
id: T-2012
title: fill-run 난이도 스위치 controller 전사 — POST /unevaluated-fill-run 핸들러 4 번째 인자 (ADR-0066 Follow-ups (b) 3/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2011]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: P5 · ADR-0066 Follow-ups (b) 3/3 — fill-run 축 최상단 controller 전사로 HTTP 요청 → helper 사슬을 닫는다
---

# T-2012 — fill-run 난이도 스위치 controller 전사

## Why

[ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) `§ Decision 2` 가 사전 난이도 routing 스위치의 배선 좌표를 `POST /evaluate` 와 fill-run 2 종으로 확정했다. `POST /evaluate` 축은 T-2009 가(main `f37a315d`), fill-run 축의 하단 2 층(helper + core)은 T-2010 이(main `ac2e5b8f`), 중단 2 층(request DTO + orchestrator)은 T-2011 이(main `a491d9fe`) 닫았다. 본 task 는 [T-2011 `## Follow-ups` (b-3)](T-2011-fill-run-difficulty-switch-dto-orchestrator.md) 가 파일 · 배선 단위로 지목한 **최상단 1 층 — HTTP controller** 를 이어 붙여, 사람이 보낸 요청 본문이 실제로 helper 의 `=== true` 게이트에 도달하게 만든다. 이 slice 가 머지되면 ADR-0066 `## Follow-ups` (a) · (b) 가 전량 닫히고 [requirements.md](../requirements.md) `69 행` REQ-050 의 잔여 "운영 발화 0 축" 이 소진되어 (e) 재판정 조건이 성립한다.

**issue-still-relevant pre-check (origin/main `cea89400` 실측)** — (b-3) 은 여전히 **0 % 안착** 이다:

- `git grep -c "useInputDifficultyRouting" origin/main -- src/ web/ test/` 는 **15 파일** 을 잡고, 그중 [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) 는 히트가 **정확히 1 개** 다 — `297 행` 의 `useInputDifficultyRouting: dto.useInputDifficultyRouting` 이고 이는 T-2009 가 박제한 **`POST /evaluate` 축** 이다. fill-run 핸들러 영역의 히트는 **0**.
- 같은 파일 `723 행` `@Post("unevaluated-fill-run")` → `727~730 행` `runUnevaluatedFill(@Body() dto: UnevaluatedFillRunRequestDto)` → `773~777 행` `this.unevaluatedFillRunOrchestrator.run(dto.rawBridges, dto.modelId, resolvedDefaultModelId)` 은 여전히 **3 인자** 호출이다.
- [unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) `116 행` 은 T-2011 이 만든 **4 번째 선택 인자** `useInputDifficultyRouting?: boolean | null` 을 보유하고 `150 행` 에서 core 로 전사하지만, 그 인자를 **채우는 HTTP caller 가 0** 이다. [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) `102 행` 의 필드 역시 **읽는 쪽이 0** 이라 현재는 DTO 에 실려 들어와도 그대로 버려진다.
- [assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) 의 스위치 히트 26 개는 행 번호가 `702` ~ `1365` 에 전량 몰려 있어(최댓값 `1365 행`) `/evaluate` describe 2 군 안이다. fill-run describe 4 군(`3695 행` 위임 · `3942 행` RunStatus · `4219 행` ValidationPipe · `4346 행` RBAC)은 전부 `3695 행` 이후라 스위치 히트가 **0** 이다.

**실측으로 발견한 배선 제약(구현 전 확정 사항)** — controller 가 4 번째 인자를 **무조건** 전사하면 `run` 의 arity 가 3 → 4 로 바뀐다. jest 의 `toHaveBeenCalledWith` 는 호출 인자 배열을 길이까지 비교하므로 `run(a, b, c, undefined)` 는 3 인자 기대와 **불일치로 fail** 한다. spec 의 기존 `runSpy` 3 인자 단언은 `3714` · `3741` · `3858` · `3876` · `3896` · `3934` · `3959` · `4068` · `4079 행` 의 **9 개** 이고, 이들은 본 slice 에서 4 인자 형태로 **함께 갱신돼야** green 이 유지된다. 이 9 줄 갱신은 계약 변경이 아니라 arity 정합이며, 본 task 의 diff 에 계상돼 있다.

**cap 준수 근거(수치)** — **2 파일 · 예상 200 LOC**(R-112 4-카테고리 backbone × 1.5; 직전 동형 slice 실측 T-2009 = 268 LOC / 4 파일, T-2010 = 271 LOC / 4 파일, T-2011 = 233 LOC / 4 파일 — 본 slice 는 production 변경이 전사 1 줄뿐이라 그보다 작다). §3 **소비처 동반 의무는 본 slice 안에서 충족** 된다 — 새 배선의 소비처가 이미 머지된 orchestrator `116 행` 이고 본 slice 가 그 마지막 빈 인자를 채우기 때문이다.

## Required Reading

- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — `§ Decision 2` 배선 좌표 표(fill-run 행) · `§ Decision 3`(미지정 = OFF = 문자 단위 동일 / HTTP 경계는 비-boolean 400 거부 · coercion 미부여 / 서비스 경계는 throw 없이 OFF 환원)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `291~298 행` T-2009 가 박제한 `/evaluate` 전사(주석 문체 · 필드명 mirror 원본, `297 행`) · `693~722 행` fill-run 핸들러 doc comment(`708 행` 이 "3 인자" 로 서술 — 갱신 대상) · `723~730 행` route · 시그니처 · `765~777 행` orchestrator 위임 주석과 3 인자 호출
- [src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) — `102~107 행` 4 번째 인자 jsdoc(해석 · 정규화 0 · OFF 환원 규칙) · `113~117 행` 시그니처 · `144~151 행` core 전사
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) — `83~102 행` T-2011 이 박제한 `@IsOptional() @IsBoolean() useInputDifficultyRouting?: boolean`
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) — `3623~3646 행` `makeRunDto` fixture 빌더(overrides 지원) · `3695 행` 위임 describe · `3714` · `3741` · `3858` · `3876` · `3896` · `3934` · `3959` · `4068` · `4079 행` 9 개 `runSpy` 3 인자 단언(arity 갱신 대상) · `3942 행` RunStatus describe · `4219~4250 행` fill-run ValidationPipe describe 와 `makePipe` / `meta` / `validPayload` harness · `4346 행` RBAC describe
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) — `702~770 행` T-2009 의 `/evaluate` 스위치 위임 케이스 4 종 · `1293~1370 행` T-2009 의 ValidationPipe 스위치 케이스 군. **본 slice 의 신규 케이스가 mirror 할 원본**

## Acceptance Criteria

- [ ] `runUnevaluatedFill` 이 `773~777 행` orchestrator 위임에 **4 번째 인자 `dto.useInputDifficultyRouting` 을 전사 1 줄로** 추가한다. controller 에서 `=== true` 판정 · 기본값 채움 · 정규화 · 분기를 **하지 않는다** (판정은 `buildFillRunScoringOptions` 단독 책임 — 이중 게이트 0). `/evaluate` `297 행` 의 전사 형태를 mirror 한다.
- [ ] 인자는 **무조건 전사** 한다 (미지정이면 `undefined` 가 그대로 넘어간다) — 조건부 전달로 arity 를 가변시키지 않는다.
- [ ] `693~722 행` 핸들러 doc comment 와 `765~772 행` 위임 주석의 "3 인자" · "3 축" 서술을 실제 배선(4 인자 · 스위치 포함)과 **정합** 시킨다. 그 외 기존 주석 문구(RBAC · resolver 503 매핑 · thin delegate 근거)는 **무변경**.
- [ ] `dto.defaultModelId` 미참조 · resolver 우선 fail-fast · `RunStatus.begin/end` 짝 구조는 **무변경** — 스위치 추가가 `738 행` 이후 try/finally 구조에 영향 0.
- [ ] **arity 정합** — spec 의 기존 `runSpy` 3 인자 단언 9 개(`3714` · `3741` · `3858` · `3876` · `3896` · `3934` · `3959` · `4068` · `4079 행`)를 4 인자 형태로 갱신한다(스위치 미지정 케이스는 4 번째를 `undefined` 로 명시). **그 9 곳과 인접 stale 주석 외의 기존 단언은 한 줄도 수정하지 않는다** — 신규 케이스는 describe 를 덧붙이는 형태로만 추가한다.
- [ ] happy-path unit test 1+ — `makeRunDto({ useInputDifficultyRouting: true })` 요청 시 `runSpy` 가 `(rawBridges, "gpt-4o-mini", "resolved-default", true)` 4 인자로 정확히 1 회 호출되고 반환은 가공 0 으로 deep-equal.
- [ ] error path unit test 1+ — (1) 스위치 ON 요청이어도 resolver throw 시 **503 `ServiceUnavailableException` 매핑이 유지** 되고 `runSpy` 가 **호출되지 않는다**(평가 사슬 미진입 — 스위치가 fail-fast 를 우회하지 못함). (2) 스위치 ON 상태에서 orchestrator 가 reject 하면 controller 가 **흡수 없이 raw 전파** 하고 `endSpy` 가 정확히 1 회(짝 없는 end 0).
- [ ] 분기별 test 1+ — 스위치 3 갈래를 각각 분리 단언한다: `true`(4 번째 인자 `true`) / 명시 `false`(4 번째 인자 `false` — `=== true` 게이트 false 임을 함께 단언) / 미지정(4 번째 인자 `undefined`).
- [ ] negative case 를 예외 분기마다 1+ — fill-run ValidationPipe describe(`4219 행`)에 T-2009 의 `1293~1370 행` 군을 mirror 해 (1) 문자열 `"true"` (2) 숫자 `1` (3) 객체 → 각각 `isBoolean` 위반으로 **400 거부**(coercion 미부여 확인) (4) `null` → `@IsOptional` 흡수로 통과하되 `=== true` 가 false (5) 오타 필드명 `useInputDifficultyRoutingg` → `forbidNonWhitelisted` 가 **400 거부** (6) 명시 `true` / `false` 는 transform 후에도 boolean 그대로 유지.
- [ ] 축 독립성 단언 1+ — 스위치 ON × modelId 지정 / 미지정(`undefined`) 조합에서 2 · 3 번째 인자(modelId · resolved default)가 스위치와 무관하게 종전과 동일함을 단언.
- [ ] RBAC 무변경 단언 — `4346 행` RBAC / HttpCode metadata describe 가 **수정 없이** green (스위치 추가가 `@Roles("Admin")` · `@UseGuards` · `@HttpCode(200)` 에 영향 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] PR diff 가 `touchesFiles` 2 개와 정확히 일치하고 diff ≤ 300 LOC (task 파일 `status:` 플립은 driver bookkeeping commit 소관 — PR 에 넣지 않는다).

## Out of Scope

- [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) · [unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) · [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) · [run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) **무접촉** — T-2010 · T-2011 이 이미 머지했다. 본 slice 는 최상단에서 값을 **넣기만** 한다.
- `evaluation-scoring.service.ts` · `llm-http-gateway.service.ts` · `difficulty-mapping.service.ts` 무접촉 (ON 경로 4xx 는 종전 그대로 전파 — ADR-0066 `§ Decision 3`).
- `POST /evaluate` 축(`291~298 행`) 재수정 — T-2009 가 닫았다. 본 slice 는 그 형태를 **읽어서 mirror** 만 한다.
- period bridge 경로(`545 행` · `616 행`) · 요약 경로(`905 행`) 배선 — ADR-0066 `§ Decision 2` 가 배선 규칙 밖으로 판정(각각 `## Follow-ups` (c) · ADR-0065 `§ Decision 4`).
- `web/` · e2e · smoke · [api.md](../architecture/api.md) 계약 문서 무접촉 — HTTP 계약 표면화는 본 slice 머지 후 별도 판단.
- `prisma/schema.prisma` · `package.json` · `.github/workflows/` 무접촉 (새 dependency 0 — CLAUDE.md §5).
- [requirements.md](../requirements.md) `69 행` REQ-050 재판정 — ADR-0066 `## Follow-ups` (e) 의 once-rule 대로 **본 slice 머지 후 별도 direct task 1 회** ([PLAN.md](../PLAN.md) `183 행`).
- 주석 확장 절제 — 신규 doc comment 는 파일당 15 줄 이내. 그래도 300 LOC 초과가 예상되면 ValidationPipe negative 군을 후속 slice 로 분리한 뒤 `Follow-ups` 에 수치와 함께 적는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
