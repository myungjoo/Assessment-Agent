---
id: T-2014
title: 난이도 routing 스위치 ON 경로 e2e 잠금 — POST /evaluate stub 왕복 + fill-run HTTP 계약 (REQ-050 잔여 e2e 축)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-050]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2012]
touchesFiles:
  - test/e2e/assessment-evaluation-evaluate.e2e-spec.ts
  - test/e2e/unevaluated-fill-run.e2e-spec.ts
plannerNote: P5 · REQ-050 잔여 e2e 축 — 스위치 ON 발화 경로 2 종을 실 부팅 e2e 로 잠근다 (test-only, production 0 LOC)
---

# T-2014 — 난이도 routing 스위치 ON 경로 e2e 잠금

## Why

T-2013(main `ed954ca0`)이 [requirements.md](../requirements.md) `69 행` REQ-050 을 재판정하면서 status 를 **IN_PROGRESS 로 유지** 했고, 그 사유를 "검증 위치 `policy + unit + e2e` 중 **e2e 축이 스위치 경로에서 미충족**" 하나로 특정했다. ADR-0066 `## Follow-ups` (a) · (b) 가 T-2009~T-2012 로 전량 머지돼 HTTP 요청이 스위치를 켜는 경로가 2 종(`POST /evaluate` · `POST /unevaluated-fill-run`) 실재하지만, 그 경로를 실 부팅(guard · ValidationPipe · DI · Prisma · 응답 직렬화)으로 지나가며 잠그는 회귀 가드가 없다. 본 task 는 기존 e2e spec 2 개에 스위치 describe 를 덧붙여 그 잔여 축 1 개를 닫는다. production 코드는 0 LOC 다.

**issue-still-relevant pre-check (origin/main `fef5d7fa` 실측, 재현 가능)** — 잔여 축은 **0 % 안착** 이다.

- `git grep -n "useInputDifficultyRouting" origin/main -- test/` → **0 hit**. 같은 명령을 `-- src web test` 로 넓히면 **15 파일** 이 잡히고 전부 `src/assessment-evaluation/` 아래(spec 8 · production 7)라 e2e · smoke · perf 어디에도 스위치를 켠 요청이 없다.
- `git log origin/main --oneline -8 -- test/e2e/` 의 최신 commit 은 `c8c7c5cc`(T-1998, 난이도 seed endpoint)이고, 스위치 arc 4 commit(`f37a315d` · `ac2e5b8f` · `a491d9fe` · `94d8abef`)은 `test/e2e/` 를 건드리지 않았다.
- [assessment-evaluation-evaluate.e2e-spec.ts](../../test/e2e/assessment-evaluation-evaluate.e2e-spec.ts)(298 행, T-1982)의 `116~124 행` `validBody` 는 `modelId` · `activities` · `personId` · `period` · `scope` · `periodStart` 6 축뿐이고, [unevaluated-fill-run.e2e-spec.ts](../../test/e2e/unevaluated-fill-run.e2e-spec.ts)(296 행, T-0566)의 `91~94 행` `validEmptyBody` 는 `rawBridges` · `modelId` 2 축뿐이다.

**관측 가능성 근거 (실측 — 본 e2e 가 성립하는 이유)** — evaluate e2e 는 `70~85 행` 에서 app 부팅 **전** 에 `LOAD_TEST_STUB=1` 을 세워 `LLM_GATEWAY` 를 [LlmStubGateway](../../src/llm/llm-stub-gateway.service.ts) 로 고른다. 그 stub 은 `94~97 행` 에서 `options.difficulty` 가 주어질 때만 narrative 에 ` difficulty=<값>` 표기를 붙이고(`100 행` 조립) 미제공이면 붙이지 않는다. 즉 **스위치 ON → `evaluation-scoring.service.ts` `108~111 행` 주입 → gateway 인자 → 응답 narrative** 까지 HTTP 로 관측된다. 사전 난이도는 [resolveInputDifficulty](../../src/assessment-evaluation/domain/evaluation-input-difficulty.ts) 규칙(`20~33 행` 상수)과 [evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) `33~38 행`(github `issue` → document, 그 외 → code)로 결정적이라 기대값을 fixture 만으로 고정할 수 있다 — github commit + `titleLength: 12` → `medium`(code 1 + LOW 0), github commit + `titleLength: 100` → `hard`(code 1 + HIGH 2). stub 표기는 `=` 이고 사후 분류 regex [evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `50 행` `DIFFICULTY_MARKER` 는 `:` 만 매칭하므로 사전 난이도가 결과 `difficulty` 필드로 새지 않는다(ADR-0065 `§ Decision 2` 비대칭을 e2e 로도 확인 가능).

fill-run 은 비어 있지 않은 `rawBridges` 가 collection → 실 LLM 을 요구해(spec 헤더 `16~27 행`) ON 의 gateway 도달을 e2e 로 관측할 수 없다. 따라서 fill-run 쪽은 **HTTP 계약 축**(whitelist 가 필드를 받아 200 · 비-boolean 400 · 스위치가 resolver 503 fail-fast 를 우회하지 못함)만 잠그고, 이 한계를 describe 주석에 명시한다.

**cap 근거 (수치)** — 2 파일 · 예상 230 LOC (evaluate 쪽 describe 1 개 ~140 LOC + fill-run 쪽 describe 1 개 ~80 LOC + fixture 확장 ~10 LOC). test-only 라 production multiplier 비적용, 직전 동형 e2e 신설 T-1982 가 단일 파일 298 행이었다. helper 신설 0 이라 §3 소비처 동반 의무는 비해당.

## Required Reading

- [docs/requirements.md](../requirements.md) — `69 행` REQ-050 의 "status 재판정 결과는 `IN_PROGRESS` 유지" 이하 잔여 e2e 축 서술(본 task 가 닫는 축 · 범위 밖 3 종 구분)
- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — `84~90 행` `§ Decision 3`(미지정 = OFF · ON 경로 4xx 비은폐 · HTTP 경계 비-boolean 400 / coercion 미부여)
- [src/llm/llm-stub-gateway.service.ts](../../src/llm/llm-stub-gateway.service.ts) — `42 행` `LLM_STUB_NARRATIVE_PREFIX` · `66~69 행` difficulty 2 분기 계약 · `90~103 행` 표기 조립
- [src/assessment-evaluation/domain/evaluation-input-difficulty.ts](../../src/assessment-evaluation/domain/evaluation-input-difficulty.ts) — `17 행` 환원값 · `20~33 행` 임계 상수 · `52 행` 이하 규칙
- [src/assessment-evaluation/domain/evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) — `33~38 행` kind → contributionKind · `46~48 행` unitId 합성 형식(응답 `results` 를 unitId 로 대응시킬 때 사용)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `159~164 행` controller-scope ValidationPipe · `295~298 행` evaluate 전사 · `325~329 행` 응답 shape(`results` = `EvaluationResult[]`) · `786 행` fill-run 전사
- [src/assessment-evaluation/dto/evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) — `177~199 행` 스위치 필드 · `195~196 행` `null` 흡수 주석
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) — `83~102 행` 스위치 필드
- [test/e2e/assessment-evaluation-evaluate.e2e-spec.ts](../../test/e2e/assessment-evaluation-evaluate.e2e-spec.ts) — `44~55 행` `activity()` fixture · `70~96 행` stub env 세팅 · 복원 · `98~114 행` person seed / truncate + actor 재-seed · `116~130 행` `validBody` · `postAs` · `132~140 행` `evaluationActive` · `142~166 행` happy · `218~251 행` negative `it.each` · `260~289 행` RBAC `it.each` (**mirror 원본**)
- [test/e2e/unevaluated-fill-run.e2e-spec.ts](../../test/e2e/unevaluated-fill-run.e2e-spec.ts) — `16~27 행` live-LLM 경계 · `60~94 행` `messageText` · fixture · `132~140 행` LlmProviderConfig 단일 row seed · `143~165 행` happy · `250~273 행` 503 fail-fast (**mirror 원본**)

## Acceptance Criteria

**evaluate 축** — [assessment-evaluation-evaluate.e2e-spec.ts](../../test/e2e/assessment-evaluation-evaluate.e2e-spec.ts) 의 기존 최상위 describe 안에 스위치 전용 describe 1 개를 **덧붙인다**(app 부팅 · actor 쿠키 · stub env 재사용, 새 app 부팅 0).

- [ ] `activity()` fixture 가 `metadata` override 를 받도록 확장하되, 인자 미지정 시 기존 `{ titleLength: 12 }` 를 그대로 반환해 **기존 it 의 요청 body 가 한 글자도 바뀌지 않는다**.
- [ ] happy-path test 1+ — Admin + `useInputDifficultyRouting: true` + github commit 2 건(`titleLength: 12` · `titleLength: 100`) → 200, `contributionCount` 2, `results` 를 **unitId 로 대응시켜** 각 narrative 가 `LLM_STUB_NARRATIVE_PREFIX + " difficulty=medium"` · `LLM_STUB_NARRATIVE_PREFIX + " difficulty=hard"` 부분문자열을 포함한다(단위별 routing 이 상수가 아님을 2 종 이상의 값으로 증명). 실 DB 에 Assessment 1 + Contribution 2 row. 기대값을 규칙 상수(`evaluation-input-difficulty.ts` `20~33 행`)로 도출한 근거를 주석 1 줄로 남긴다.
- [ ] 분기별 test 1+ (스위치 갈래를 각각 분리 단언) — 명시 `false` · 미지정 · `null` 세 요청 모두 200 이고 narrative 에 `LLM_STUB_NARRATIVE_PREFIX + " difficulty="` 부분문자열이 **없다**. `null` 은 `@IsOptional` 흡수로 OFF 환원된다 — ADR 산문의 400 표기와 실제 층이 다름을 DTO `195~196 행` 이 명시하므로 **실제 동작인 200 + OFF** 를 잠근다.
- [ ] 비대칭 단언 1+ — 같은 활동 집합의 ON 응답과 OFF 응답에서 `results[i].difficulty`(unitId 대응)가 **동일** 하다(사전 난이도가 결과 필드로 새지 않음 — ADR-0065 `§ Decision 2`). 두 번째 호출은 `mode: "reeval"` 또는 별도 personId 좌표를 써서 idempotent no-op(`contributionCount` 0)을 피한다.
- [ ] error path test 1+ — 스위치 ON 이어도 기존 500 경로(`scope: "bogus"`)가 그대로 500 이고 row 0 · `evaluationActive()` false (스위치가 persist 오류 표면을 바꾸지 않음).
- [ ] negative case 를 예외 분기마다 1+ — (1) 문자열 `"true"` (2) 숫자 `1` (3) 객체 `{}` (4) 배열 `[]` → 각각 **400** + `assessmentId` 부재 + Assessment row 0 (coercion 미부여 확인) (5) 오타 필드명 `useInputDifficultyRoutingg: true` → `forbidNonWhitelisted` **400** (6) 400 직후 `evaluationActive()` false (begin 미진입) (7) 스위치 ON 요청이어도 cookie 부재 **401** · User **403** 이고 row 0 (스위치가 guard 를 우회하지 못함).

**fill-run 축** — [unevaluated-fill-run.e2e-spec.ts](../../test/e2e/unevaluated-fill-run.e2e-spec.ts) 의 기존 describe 안에 스위치 전용 describe 1 개를 덧붙인다(beforeEach 의 단일 LlmProviderConfig seed 재사용).

- [ ] happy-path test 1+ — Admin + `validEmptyBody()` + `useInputDifficultyRouting: true` → 200 + 빈 `outcomes` · 4 count 0 · `totalEvaluatedRecords` 0 (whitelist 가 필드를 받아 사슬 끝까지 통과). 명시 `false` · `null` 도 각각 200 (분기별).
- [ ] error path test 1+ — 스위치 ON + LlmProviderConfig row 부재(`deleteMany`) → **503** 이고 `messageText` 가 `/LLM provider/` 매칭 (스위치가 resolver fail-fast 를 우회하지 못함).
- [ ] negative case 를 예외 분기마다 1+ — 문자열 `"true"` · 숫자 `1` · 객체 `{}` → 각각 **400** 이고 `messageText` 가 `/useInputDifficultyRouting/` 매칭. 스위치 ON + User 토큰 → **403**.
- [ ] describe 주석에 "fill-run 은 좌표 0 이라 gateway 도달을 관측하지 못하며 routing 도달은 evaluate 축이 잠근다" 는 한계를 3 줄 이내로 명시한다.

**공통**

- [ ] 기존 it 의 이름 · 단언 · fixture 기본값은 **무수정** (신규 describe 덧붙이기만). 두 spec 의 기존 it 이 전부 그대로 green.
- [ ] production(`src/` · `web/` · `prisma/`) 변경 **0 LOC** — 신규 public symbol 0 이라 R-112 unit 축은 기존 spec 이 그대로 진다. `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%, 수치 무변동 예상).
- [ ] CI 의 `pnpm test:e2e` step 이 green 이고 신규 it 이 실행 목록에 포함된다(로컬 `DATABASE_URL` 부재 시 e2e 실검증은 CI 에 위임 — PR body 에 명시).
- [ ] PR diff 가 `touchesFiles` 2 개와 정확히 일치하고 diff ≤ 300 LOC (task 파일 `status:` 플립은 driver bookkeeping commit 소관 — PR 에 넣지 않는다).

## Out of Scope

- `src/` 전체 무접촉 — 스위치 배선은 T-2009~T-2012 가 닫았다. 테스트가 production 결함을 드러내면 고치지 말고 `Follow-ups` 에 좌표와 함께 적고 해당 it 은 만들지 않는다.
- LlmStubGateway 가 아닌 실 `LlmHttpGateway` 경로의 ON + 슬롯 미설정 400 fail-fast e2e — `LOAD_TEST_STUB` 판정이 module 초기화 1 회라 별도 app 부팅(별도 spec 파일)이 필요하다. 필요성은 본 slice 머지 후 판단(Follow-ups 후보).
- period bridge 경로(controller `545 행` · `616 행`) · 요약 경로 — ADR-0066 `## Follow-ups` (c) · ADR-0065 `§ Decision 4` 범위 밖.
- ADR-0066 `§ Decision 4` 운영자 표면(ON + 빈 슬롯 안내) — 범위 밖.
- [requirements.md](../requirements.md) `69 행` REQ-050 재판정 — 본 slice 머지 **후** 별도 direct task 1 회만([PLAN.md](../PLAN.md) `183 행` once-rule, CLAUDE.md §3.1).
- smoke · perf spec · `test/helpers/` · `package.json` · `.github/workflows/` 무접촉.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
