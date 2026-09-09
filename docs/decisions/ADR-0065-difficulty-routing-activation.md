---
id: ADR-0065
title: 평가 경로 난이도 모델 routing 발화 설계 — 항목→난이도 사전 결정 규칙 · 주입 지점 · 미설정 회귀 가드
status: ACCEPTED
date: 2026-09-09
relatedTask: [T-2003]
relatedReq: [REQ-050, REQ-049]
supersedes: null
augments: [ADR-0011, ADR-0032]
---

# ADR-0065 — 평가 경로 난이도 모델 routing 발화 설계 (R-97)

## Status

**ACCEPTED**. 본 slice 는 **결정만 박제** 하고 코드를 1 LOC 도 만들지 않는다 — 이 slice 의 diff 는 본 문서와 [ADR-0032](ADR-0032-p5-evaluation-contract.md) pointer 1 줄뿐이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` 변경이 **0** 이다 ([ADR-0064](ADR-0064-algorithm-research-contribution-uplift.md) · [ADR-0063](ADR-0063-commit-content-fingerprint-dedup.md) 의 doc-only ADR 선례 동형). 집행(코드 배선)은 전부 `§ Follow-ups` 로 이월한다.

본 ADR 은 [ADR-0011](ADR-0011-difficulty-model-assignment.md) 과 [ADR-0032](ADR-0032-p5-evaluation-contract.md) 를 **augment** 한다 — ADR-0011 `28 행` 은 자신을 "routing 의 정적 매핑 backbone" 으로 한정했고 실 routing 호출을 후속에 넘겼으며, ADR-0032 `56 행` 은 주입을 **의도로 서술** 했을 뿐 발화 설계를 결정하지 않았다. 두 ADR 의 §1 · §2 · §3 결정 내용은 **뒤집지 않는다**(supersede 0).

## Context

### 공백 — 난이도 routing 이 지어져 있으나 발화하지 않는다

[REQ-050](../requirements.md) `69 행` 은 `IN_PROGRESS` 이고 잔여는 두 축이다. 실측(origin/main `8888456a`, `git grep` 재현 가능):

1. **결정 규칙 부재** — "어떤 항목이 어떤 난이도인지" 를 정하는 규칙이 코드에도 ADR 에도 없다. `git grep -l "항목→난이도" -- docs/decisions/` 결과 0 파일.
2. **주입 0** — [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `97~101 행` 의 유일한 평가 `generate` 호출은 `modelId` 만 넘기며, 바로 위 주석이 `difficulty 미주입(narrative 산물이라 사전 미상)` 이라고 스스로 자인한다. 난이도는 그 **뒤** `104 행` `classifyNarrative(narrative)` 에서야 얻어진다 — 즉 호출 시점에는 미상이다.
3. **요약 경로도 동일** — [summary-narrative.service.ts](../../src/assessment-evaluation/summary-narrative.service.ts) `104~108 행` 주석 역시 `difficulty 미주입(좌표 요약이라 사전 난이도 routing` + `대상 아님)` 으로 같은 사실을 자인한다.
4. **기능은 지어졌고 스위치가 꺼져 있다** — [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `100~120 행` 은 `options.difficulty === undefined` 면 `options.modelId` 를, 아니면 `DifficultyMappingService.resolveModel(options.difficulty)` 의 `configId` 를 쓰는 분기를 이미 갖는다. production 은 전자만 밟는다. 결과적으로 Admin 이 easy / medium / hard 3 슬롯을 지정해도 평가는 항상 단일 `modelId` 로 나간다.
5. **계약 문서와 실측의 drift** — [ADR-0032](ADR-0032-p5-evaluation-contract.md) `56 행` 은 "이 값이 generate 호출 전 `options.difficulty` 로 주입" 된다고 단언하지만 2~4 와 어긋난다. 그 문장은 **의도 서술** 이며 실 발화 설계의 정본은 본 ADR 이다(원문은 삭제하지 않고 pointer 만 add-only 로 붙인다).

### 왜 구현이 아니라 ADR 이 먼저인가

REQ-050 은 요구표상 `Constraint` · 검증 위치 `policy + unit + e2e` · P4 **"ADR 필수"** 다. 그리고 난이도가 LLM 응답 파싱 산물이라는 사실 자체가 설계 분기를 강제한다 — 사전 난이도를 **어디서 얻을 것인가** 를 정하지 않으면 배선을 시작할 수 없다. 나아가 주입을 켜는 순간 [ADR-0011](ADR-0011-difficulty-model-assignment.md) `60~64 행` 의 fail-fast 와 곱해져 **회귀 위험** 이 생기므로(`§ Decision 3`), 그 가드를 정하기 전의 코드 slice 는 안전하지 않다.

### 게이트

새 외부 dependency 0 · credential 0 · `prisma/schema.prisma` 변경 0 (CLAUDE.md §5). 본 ADR 은 그 셋을 요구하는 안을 **채택하지 않는다**.

## Decision

### § Decision 1 — 항목→난이도 사전 결정 규칙: ㉠ metadata 기반 결정적 규칙 채택

후보 3 종에 조건 (a)~(d) 를 전부 대입한다.

| 후보 | (a) `generate` 호출 배수 | (b) 결정성 | (c) ADR-0011 §3 fail-fast 상호작용 | (d) 자율 집행(새 dep · credential · schema 0) |
| --- | --- | --- | --- | --- |
| ㉠ metadata 기반 결정적 규칙 | **× 1**(증가 0) | **결정적** — 동일 입력 → 동일 난이도 | 항상 3 슬롯 중 1 개를 지목 → 미설정 슬롯이면 4xx, 가드 필요(`§ Decision 3`) | **가능** — 순수 함수 1 개, 셋 다 0 |
| ㉡ 2-pass LLM 분류 선행 호출 | × 2 (분류 1 + 평가 1) | 비결정적 — 같은 입력이 호출마다 다른 난이도 | 분류 pass 자체도 model 이 필요해 **닭-달걀**(분류용 슬롯을 또 정해야 함) | 가능하나 비용 · 지연 2 배 |
| ㉢ 사전 결정 없음(현행 유지) | × 1 | 해당 없음 | 발화 0 이라 4xx 회귀도 0 | 가능하나 REQ-050 잔여 **미해소** |

**결론(1 값): ㉠ 채택.** 입력면은 이미 평가 layer 가 보유한 typed surface 로 한정한다 — [evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) `56~75 행` 의 `contributionKind` · `sourceType` · `metadata`(scalar map, [activity.ts](../../src/assessment-collection/domain/activity.ts) `38~43 행` 계약) 뿐이며, raw 본문은 애초에 존재하지 않는다(REQ-032). 규칙은 **순수 함수 1 개**(`resolveInputDifficulty`)로 표현하고, 신호가 없거나 미인식이면 [evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `32 행` 의 `DEFAULT_DIFFICULTY = "medium"` 과 **같은 중앙값** 으로 환원한다(throw 0). 구체 임계 · 가중은 집행 slice 가 정하되 위 입력면과 환원 default 는 본 ADR 이 고정한다. [activity-contribution.mapper.ts](../../src/assessment-collection/domain/activity-contribution.mapper.ts) `39 행` 의 `PLACEHOLDER_DIFFICULTY = "easy"` 는 수집 시점 transient 값이라 평가 사전 난이도로 **재사용하지 않는다**(의미가 다르고 중앙값도 아니다).

### § Decision 2 — 주입 지점과 입력/출력 난이도 충돌 규칙

- **(i) 주입 지점(좌표 고정)** — [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `97~101 행` 의 `gateway.generate` 호출 인자 **한 곳뿐** 이다. `§ Decision 1` 의 순수 함수를 그 직전에 호출해 `difficulty` 를 옵션에 얹는다. gateway · prompt · mapper 는 건드리지 않는다 — 게이트웨이 분기(`100~120 행`)가 이미 완성돼 있으므로 **호출자만 바뀐다**.
- **(ii) 충돌 규칙(1 값)** — 사전 난이도와 사후 `classifyNarrative`(`104 행`) 결과가 다를 때 `EvaluationResult.difficulty` 에는 **사후 `classifyNarrative` 결과를 기록한다**. 사전 난이도는 **routing 전용 신호** 이며 결과 필드에 남기지 않는다. 근거 — [ADR-0032](ADR-0032-p5-evaluation-contract.md) `56 행` 이 정의한 `difficulty` 의 의미는 "난이도 **분류 결과**" 이고, 그 의미를 사전 추정값으로 바꾸면 output 계약이 변경돼 augment 범위를 넘는다. 즉 난이도는 **입력(routing 신호)과 출력(관측 분류)이 서로 다를 수 있는 두 값** 이며, 이 비대칭을 본 ADR 이 명시적으로 허용한다.

### § Decision 3 — 슬롯 미설정 회귀 가드: 명시적 opt-in 채택

주입을 켜면 [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `99~125 행` 의 `resolveModel` fail-fast chain(슬롯 row 부재 / FK null / 가리킨 config 부재 → `BadRequestException`)이 **모든 평가 호출에** 걸린다. 슬롯이 셋업되지 않은 환경에서는 종전에 정상 동작하던 평가가 **전량 4xx** 로 죽는다(ADR-0011 `60~64 행` × 신규 주입).

후보 — (A) 무가드 즉시 주입 · (B) `resolveModel` 실패를 catch 해 `modelId` 로 fallback · (C) **명시적 opt-in 스위치 뒤에서만 주입**.

**결론(1 값): (C) 채택.** 집행 slice 는 `ScoringOptions`([evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `46~49 행`)에 선택 boolean 필드 1 개를 더해 **기본값 OFF** 로 둔다. OFF 이면 종전 `modelId` 단일 경로 그대로라 회귀가 **구조적으로 0** 이다. ON 인 경로에서 발생한 슬롯 미설정 4xx 는 **가리지 않고 그대로 전파** 한다 — silent fallback 은 ADR-0011 §3 이 이미 기각한 축이라 (B) 를 채택하면 그 결정을 뒤집게 되어 augment 범위를 벗어난다. (A) 는 회귀를 그대로 떠안아 기각. ON 전환의 운영 선행 조건은 `POST /api/llm/difficulty-mappings/seed`([difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `116~121 행`, T-1998)로 3 슬롯 row 를 멱등 확보한 뒤 슬롯별 `LlmProviderConfig` 를 지정하는 것이다.

### § Decision 4 — 요약 경로(`summary-narrative.service.ts`) 취급: 범위 밖

**결론(1 값): 범위 밖.** 사유 — 요약은 이미 산출된 결과 다수의 좌표 batch 라 "항목" 이 단수로 정의되지 않아 `§ Decision 1` 의 입력면(단위 1 건의 `contributionKind` · `metadata`)이 성립하지 않는다. [summary-narrative.service.ts](../../src/assessment-evaluation/summary-narrative.service.ts) `104~108 행` 의 현행 `modelId` 단일 경로를 그대로 유지한다.

## Consequences

- **`generate` 호출 수: `× 1` 유지.** `§ Decision 1` 이 ㉠(결정적 규칙)을 채택했으므로 LLM 호출이 **늘지 않는다** — 평가 단위 1 건당 1 회라는 [ADR-0032](ADR-0032-p5-evaluation-contract.md) `48 행` batch 경계가 그대로 보존된다. 호출 수가 늘어나는 안(㉡, `× 2`)은 채택하지 않았으므로 그에 따른 음의 비용 항목이 발생하지 않는다.
- **얻는 것**: Admin 이 지정한 3 슬롯 model 이 평가에서 실제로 쓰이는 경로가 열려 REQ-050 · REQ-049 의 잔여 두 축이 집행 slice 머지 후 재판정 대상이 된다.
- **치르는 것(오분류 위험)**: 사전 규칙이 metadata scalar 만 보므로 실제 난이도와 어긋난 슬롯으로 routing 될 수 있다. 완화 — 미인식은 중앙값 `"medium"` 으로 환원하고, 결과 필드에는 여전히 사후 분류가 기록돼(`§ Decision 2` (ii)) **평가 결과의 의미는 훼손되지 않는다**.
- **치르는 것(운영 부담)**: ON 전환 전에 3 슬롯 셋업이 선행돼야 한다. OFF 기본값이라 미셋업 환경의 회귀는 0 이지만, 켜는 시점의 셋업 누락은 4xx 로 표면화된다(의도된 fail-fast).
- **경계**: 본 ADR 은 ADR-0011 §1(3 슬롯) · §2(resolve) · §3(fail-fast)의 결정식과 gateway `100~120 행` 분기, `classifyNarrative` 의 marker · default 를 **한 줄도 바꾸지 않는다**.

## Alternatives considered

- **㉡ 2-pass LLM 분류 선행 호출** — 기각. `generate` 호출이 평가 단위당 `× 2` 로 늘어 비용 · 지연이 배증하고, 분류 pass 자체가 비결정적이라 동일 입력이 호출마다 다른 슬롯으로 routing 된다. 결정적으로, 분류 pass 도 model 이 필요해 "분류용 난이도" 를 또 정해야 하는 닭-달걀에 빠진다.
- **㉢ 사전 결정 없음(현행 유지)** — 기각. 회귀 위험은 0 이지만 REQ-050 의 잔여 두 축이 그대로 남고, ADR-0011 이 박제한 3 슬롯 매핑이 영구 미발화로 사문화된다.
- **(B) `resolveModel` 4xx 를 catch 해 `modelId` 로 silent fallback** — 기각. ADR-0011 `60~64 행` 이 "결과 신뢰성 훼손 · 운영 가시성 상실 · REQ-049 명시 지정 의도와 어긋남" 을 이유로 이미 기각한 축이라, 채택하면 augment 가 아니라 supersede 가 된다.
- **(A) 무가드 즉시 주입** — 기각. 슬롯 미설정 환경의 평가가 전량 4xx 로 죽는 회귀를 그대로 떠안는다.
- **사전 난이도를 `EvaluationResult.difficulty` 에 기록** — 기각. [ADR-0032](ADR-0032-p5-evaluation-contract.md) `56 행` 이 정의한 output 필드 의미("분류 결과")를 바꾸므로 augment 범위를 넘는다.
- **난이도를 신규 테이블 · 컬럼으로 영속** — 기각. `prisma/schema.prisma` 변경은 CLAUDE.md §5 schema 게이트 BLOCKED 사유다. 사전 난이도는 in-memory routing 신호로 충분해 영속이 불요하다.
- **외부 난이도 분류 라이브러리 · 서비스 도입** — 기각. 새 외부 dependency · credential 은 CLAUDE.md §5 상 BLOCKED 사유이고, `§ Decision 1` 의 입력면이면 순수 함수 1 개로 족하다.

## Follow-ups

집행(코드 배선)은 **후속 pr slice 소관** 이다 — 본 task 는 코드 0 LOC 이라 신규 spec 0 이 정당하고, R-112 의 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)은 아래 (a) · (b) 가 진다. 각 slice ≤ 300 LOC / ≤ 5 파일, CLAUDE.md §3 소비처 동반 의무 포함.

- **(a) 사전 난이도 규칙 helper 신설 + 소비처 배선** — 신설 `src/assessment-evaluation/domain/evaluation-input-difficulty.ts`(`resolveInputDifficulty(input: EvaluationInput): Difficulty` + 임계 상수) · 그 `.spec.ts` · [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `46~49 행` `ScoringOptions` 에 opt-in boolean 추가 + `97~101 행` 주입 배선 · 그 spec. **4 파일**. 소비처 동반 충족(helper + 유일 소비처 동반).
- **(b) opt-in ON 경로의 fail-fast 전파 회귀 test** — [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) 의 spec 에 (i) OFF 기본값 → `modelId` 경로 유지 (ii) ON + 슬롯 미설정 → 4xx **그대로 전파**(swallow 0) (iii) ON + 정상 → 사후 `classifyNarrative` 값이 결과에 기록됨(`§ Decision 2` (ii)) 을 박제. 필요 시 e2e 1 종.
- **(c) doc-sync (direct)** — [requirements.md](../requirements.md) `69 행` REQ-050 재판정. [PLAN.md](../PLAN.md) `183 행` once-rule 대로 (a) · (b) 전량 머지 후 **1 회만** 수행한다(T-2002 가 소진한 회차와 별개 회차).
- **(확장 지점, task 아님)** 요약 경로의 난이도 routing(`§ Decision 4` 로 범위 밖) · 사전 난이도의 운영 설정화 · 사전/사후 난이도 괴리율 관측 — 각각 본 ADR 을 augment 하는 후속 ADR 이 선행한다.

## References

- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 IN_PROGRESS 판정문(잔여 두 축)
- [ADR-0011](ADR-0011-difficulty-model-assignment.md) `28 행`(backbone 자기 한정) · `47~51 행`(§1 3 슬롯) · `60~64 행`(§3 fail-fast) — 본 ADR 이 augment
- [ADR-0032](ADR-0032-p5-evaluation-contract.md) `48 행`(단위당 generate 1 회 batch 경계) · `56 행`(주입 의도 서술) — 본 ADR 이 augment
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `46~49 행` · `97~101 행` · `104 행` — 주입 지점과 사후 분류
- [src/assessment-evaluation/summary-narrative.service.ts](../../src/assessment-evaluation/summary-narrative.service.ts) `104~108 행` — 범위 밖 판정 대상
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `100~120 행` — 이미 지어진 difficulty 분기
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `99~125 행` — `resolveModel` fail-fast chain
- [src/assessment-evaluation/domain/evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `32 행`(`DEFAULT_DIFFICULTY`) · `50 행`(`DIFFICULTY_MARKER`) · `155~168 행`(`classifyNarrative`)
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) `56~75 행` — 사전 규칙의 입력면
- [src/assessment-collection/domain/activity-contribution.mapper.ts](../../src/assessment-collection/domain/activity-contribution.mapper.ts) `39 행` — `PLACEHOLDER_DIFFICULTY`(재사용 안 함)

Refs: ADR-0065, ADR-0011, ADR-0032, REQ-050, REQ-049, T-2003
