---
id: T-2004
title: 사전 난이도 규칙 helper 신설 + 평가 scoring 주입 배선 (ADR-0065 §Follow-ups (a), opt-in 기본 OFF)
phase: P5
status: DONE
commitMode: pr
prNumber: 1572
coversReq: [REQ-050, REQ-049]
estimatedDiff: 285
estimatedFiles: 4
created: 2026-09-10
independentStream: llm-difficulty
dependsOn: [T-2003]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-input-difficulty.ts
  - src/assessment-evaluation/domain/evaluation-input-difficulty.spec.ts
  - src/assessment-evaluation/evaluation-scoring.service.ts
  - src/assessment-evaluation/evaluation-scoring.service.spec.ts
plannerNote: "P5 REQ-050 잔여 — ADR-0065 §Decision 1·2·3 집행 slice (a): 사전 난이도 순수 함수 + 유일 소비처 주입 동반"
---

# T-2004 — 사전 난이도 규칙 helper 신설 + 평가 scoring 주입 배선

## Why

[docs/requirements.md](../requirements.md) `69 행` REQ-050 의 잔여 두 축(① 항목→난이도 결정 규칙 부재 ② `options.difficulty` production 전수 미주입)에 대해 [ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) 가 **결정을 이미 내렸다** — §Decision 1 = metadata 기반 결정적 순수 함수 채택(`generate` 호출 × 1 유지), §Decision 2 = 주입 지점을 `evaluation-scoring.service.ts` 의 `generate` 호출 인자 한 곳으로 좌표 고정 + 결과 `difficulty` 는 사후 `classifyNarrative` 값 유지, §Decision 3 = 슬롯 미설정 4xx 회귀를 **기본 OFF opt-in 스위치**로 차단. 본 task 는 그 결정의 **집행 slice (a)** 로, ADR-0065 `§ Follow-ups (a)` 가 파일 · 배선 단위로 지목한 4 파일 그대로다. helper 신설과 그 **유일 소비처 배선을 같은 PR 에 포함**해 오너 지시([docs/PLAN.md](../PLAN.md) `182 행` 소비처 동반 의무)를 충족한다.

**issue-still-relevant pre-check (origin/main `e4bec929` 기준, 2026-09-10 실측)**

1. `git ls-tree origin/main src/assessment-evaluation/domain/ | grep -i difficult` = **0 파일** — 사전 난이도 helper 가 main 에 없다(파일명 충돌 0).
2. `git grep -n "resolveInputDifficulty" origin/main -- src test` = **0 hit** — 동일 symbol 이 어디에도 박제되지 않았다.
3. `src/assessment-evaluation/evaluation-scoring.service.ts` `97~101 행` 의 유일 production `generate` 호출이 여전히 `{ modelId: options.modelId }` 만 넘기고, `72~77 행` · `97 행` 주석이 "본 slice 는 `options.difficulty` 를 **미주입**한다(undefined)" 를 자인한다 — 주입 **0** 상태 그대로.
4. `ScoringOptions`([같은 파일](../../src/assessment-evaluation/evaluation-scoring.service.ts) `46~49 행`)는 현재 `modelId: string` **단일 필드**라 opt-in boolean 이 아직 없다.
5. `git log origin/main -5 -- src/assessment-evaluation/evaluation-scoring.service.ts` 최신 touch 는 T-0565 계열이며 난이도 주입 축과 무관 — 직전 chain([T-1998](T-1998-difficulty-slot-seed-endpoint.md)~[T-2001](T-2001-difficulty-slot-seed-contract-guard.md))은 슬롯 seed · 안내 · guard 축이라 본 배선과 파일이 겹치지 않는다.
6. REQ-050 요구표 재판정은 [T-2002](T-2002-req050-seed-path-readjudication.md) 가 once-rule 1 회를 소진했고 ADR-0065 `§ Follow-ups (c)` 가 집행 전량 머지 후로 미뤘으므로 본 task 는 [docs/requirements.md](../requirements.md) 를 **건드리지 않는다**(오너 [docs/PLAN.md](../PLAN.md) `183 행`).

## Required Reading

- [docs/decisions/ADR-0065-difficulty-routing-activation.md](../decisions/ADR-0065-difficulty-routing-activation.md) — `§ Decision 1`(입력면 = `contributionKind` · `sourceType` · `metadata` 뿐, 신호 부재 시 중앙값 `medium` 환원, throw 0) · `§ Decision 2`(주입 지점 좌표 · 결과 `difficulty` 는 사후 분류값 유지) · `§ Decision 3`(기본 OFF opt-in, ON 경로 4xx 그대로 전파) · `§ Decision 4`(요약 경로 범위 밖) · `§ Follow-ups (a)`.
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `46~49 행`(`ScoringOptions`) · `72~77 행`(difficulty 미주입 정책 주석 — 갱신 대상) · `97~101 행`(주입 지점 `gateway.generate` 인자, `97 행` 인라인 주석 포함) · `104 행`(사후 `classifyNarrative`).
- [src/assessment-evaluation/evaluation-scoring.service.spec.ts](../../src/assessment-evaluation/evaluation-scoring.service.spec.ts) `125~145 행` — `gateway.generate.mock.calls[0]` 와 `expect(optionsArg).toEqual({ modelId })` 로 prompt / options 인자를 검사하는 기존 assertion 패턴(신규 test 가 mirror 할 대상).
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) `40~50 행`(`CONTRIBUTION_KINDS` · `isContributionKind`) · `52~75 행`(`EvaluationInput` 7 필드 = 규칙의 입력면).
- [src/assessment-evaluation/domain/evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) `1~45 행` — **동형 mirror 대상**: 의존성 0 · throw 0 · 부수효과 0 인 metadata 기반 결정적 순수 함수의 파일 서식 · 주석 밀도 · `metadata.titleLength` 정규화(비-number / 비유한 / 음수 → 0) 선례.
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) `20 행` — `Difficulty = "easy" | "medium" | "hard"` 및 같은 파일의 `DIFFICULTIES` · `isDifficulty`. import 경로는 `../../llm/difficulty`([evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `22~23 행` 선례).
- [src/assessment-evaluation/domain/evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `32 행` — `DEFAULT_DIFFICULTY: Difficulty = "medium"` 이 **module-private(export 아님)** 이라는 사실. 본 task 는 이 파일을 수정하지 않고 helper 안에 같은 값의 상수를 별도 정의한다.
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~43 행` — `ActivityMetadata = Record<string, string | number | boolean | null>` scalar 계약(raw 본문 금지, REQ-032).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-input-difficulty.ts` 가 신설되고 순수 함수 `resolveInputDifficulty(input: EvaluationInput): Difficulty` 를 export 한다. 파일은 [evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) 와 동형으로 **NestJS `@Injectable` · Prisma · LLM 호출 0**, throw 0, 부수효과 0 이며 import 는 type import(`EvaluationInput` · `Difficulty`) 뿐이다. 검증: `git grep -n "Injectable\|PrismaService\|gateway" src/assessment-evaluation/domain/evaluation-input-difficulty.ts` 가 **0 hit**.
- [ ] 규칙 입력면이 ADR-0065 `§ Decision 1` 대로 `contributionKind` · `sourceType` · `metadata` **로만** 한정된다 — `narrative` · raw 본문 · 외부 조회 0. 임계값 · 가중치는 파일 상단의 **named 상수로 export** 되어 test 가 매직넘버 없이 경계를 짚을 수 있다.
- [ ] 신호 부재 · 미인식 · 비정상 scalar(`titleLength` 가 string / boolean / null / `NaN` / `Infinity` / 음수)에서 **throw 하지 않고 `"medium"` 으로 환원**한다(ADR-0065 `§ Decision 1` 중앙값 환원). 반환값은 항상 `Difficulty` 집합 멤버다.
- [ ] `evaluation-input-difficulty.spec.ts` (colocated: `src/assessment-evaluation/domain/evaluation-input-difficulty.spec.ts`) 가 R-112 4 축을 cover 한다 — (1) happy-path: `easy` · `medium` · `hard` **3 값 각각을 반환하는 입력** 1+ (2) error path: 위 비정상 scalar 시나리오가 throw 0 + `"medium"` (3) 분기별: 임계 상수 **경계값 바로 위 / 정확히 경계 / 바로 아래** 각 1+, `contributionKind` 2 값(`code` / `document`) 각 1+ (4) negative: `metadata` 빈 객체 · 미인식 key 만 존재 · 동일 입력 2 회 호출 결과 동일(결정성) 각 1+.
- [ ] `ScoringOptions`([evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `46~49 행`)에 **선택 boolean 필드 1 개**가 추가되고 주석에 기본값이 OFF(미지정 = 종전 경로)임과 ADR-0065 `§ Decision 3` 근거가 명시된다. `modelId` 필드 계약은 무변경.
- [ ] `scoreUnit` 의 `gateway.generate` 호출(`97~101 행`)이 **opt-in 이 true 일 때만** `difficulty: resolveInputDifficulty(input)` 를 옵션에 얹는다. false / 미지정이면 인자가 종전과 **정확히 동일**(`{ modelId }` 단일 키)하다. `generate` 호출 횟수는 두 경로 모두 **정확히 1 회**(ADR-0032 `48 행` batch 경계 · ADR-0065 `§ Consequences` × 1 유지).
- [ ] 결과 조립은 무변경 — `EvaluationResult.difficulty` 에는 여전히 **사후 `classifyNarrative`(`104 행`) 결과**가 기록되고 사전 난이도는 결과에 새지 않는다(ADR-0065 `§ Decision 2` (ii)).
- [ ] `72~77 행` 의 "본 slice 는 `options.difficulty` 를 미주입한다" 주석이 현행 동작과 일치하도록 갱신된다(ADR-0065 참조 + opt-in 경계 서술). stale 주석 잔존 0 — 검증: `git grep -n "미주입" src/assessment-evaluation/evaluation-scoring.service.ts` 가 갱신 후 문맥과 모순되지 않는다.
- [ ] `evaluation-scoring.service.spec.ts` 에 배선 test 가 추가된다 — (1) happy-path: opt-in ON → `generate` 인자 두 번째 객체에 `difficulty` 가 `resolveInputDifficulty` 와 같은 값으로 실린다 (2) 분기: opt-in 미지정 / false → 두 번째 인자에 `difficulty` **키 자체가 없다**(`"difficulty" in optionsArg === false`) (3) error path: opt-in ON 인 상태에서 `gateway.generate` 가 reject 하면 error 가 **swallow 없이 그대로 전파**된다(ADR-0065 `§ Decision 3` — silent fallback 금지) (4) negative: opt-in ON 이어도 결과 `difficulty` 는 mock narrative 의 `classifyNarrative` 값이며 사전 난이도로 덮이지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(R-110 — implementer 후 tester 필수).
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(`package.json` `coverageThreshold.global`).
- [ ] `git diff --name-only origin/main` 결과가 frontmatter `touchesFiles` **4 파일** 과 정확히 일치한다(`prisma/` · `package.json` · `web/` · `docs/requirements.md` 변경 0).

## Out of Scope

- **opt-in 을 켜는 호출자 배선 금지** — controller · orchestrator · fill-run factory 등 상위 caller 에서 새 boolean 을 true 로 넘기는 변경은 하지 않는다. 본 slice 의 production 기본 동작은 **종전과 100% 동일**하다.
- `src/llm/` 수정 전량 — gateway 의 difficulty 분기([llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `100~120 행`)와 `resolveModel` fail-fast([difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `99~125 행`)는 **이미 완성**돼 있어 호출자만 바뀐다(ADR-0065 `§ Decision 2` (i)).
- [evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) 수정 — `DEFAULT_DIFFICULTY` 를 export 로 승격하거나 `classifyNarrative` 를 건드리지 않는다.
- 요약 경로([summary-narrative.service.ts](../../src/assessment-evaluation/summary-narrative.service.ts) `104~108 행`) — ADR-0065 `§ Decision 4` 가 **범위 밖**으로 확정.
- e2e / smoke spec 신설 — ADR-0065 `§ Follow-ups (b)` 의 fail-fast 전파 회귀 slice 소관(본 task 는 unit 경계).
- [docs/requirements.md](../requirements.md) REQ-050 상태 칸 재판정 — 오너 [docs/PLAN.md](../PLAN.md) `183 행` once-rule + ADR-0065 `§ Follow-ups (c)`(집행 전량 머지 후 1 회).
- `prisma/schema.prisma` · migration(§5), 새 외부 dependency(§5), `web/` 변경, perf spec 신설(오너 [docs/PLAN.md](../PLAN.md) `158 행`).
- ADR-0065 · ADR-0011 · ADR-0032 의 **결정 내용 변경** — 본 task 는 결정의 집행일 뿐이다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
