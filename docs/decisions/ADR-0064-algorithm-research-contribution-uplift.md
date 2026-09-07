---
id: ADR-0064
title: 새 알고리즘·새 일거리 구상·외부 연구 소개 기여의 결정적 상향 정책 — mapper 경계 파생 신호 + 단조 상향 adjuster
status: PROPOSED
date: 2026-09-07
relatedTask: T-1948
relatedReq: [REQ-019, REQ-032]
supersedes: null
augments: [ADR-0032]
---

# ADR-0064 — 새 알고리즘·외부 연구 소개 기여의 결정적 상향 정책 (R-38)

## Status

**PROPOSED**. 본 slice 는 **정책만 박제** 하며 코드를 1 LOC 도 만들지 않는다 — diff 는 본 문서 1 개뿐이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 **0** 이다. 파생 신호 산출 · detection helper · uplift adjuster · pipeline 배선은 전부 `§ Follow-ups` 로 이월한다 ([ADR-0063](ADR-0063-commit-content-fingerprint-dedup.md) · [ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) 의 doc-only ADR 선례 동형). ACCEPTED 승격은 `§ Follow-ups` (a)~(c) 전량 머지 뒤 (d) doc-sync 가 수행한다.

본 ADR 은 [ADR-0032](ADR-0032-p5-evaluation-contract.md) 를 **augment** 한다 — 그 `25 행` 은 R-37 / R-38 을 평가 계약의 scope 로 **나열만** 했고 상향 규칙을 결정하지 않았다. 기존 결정을 뒤집는 부분은 없다 (supersede 0).

## Context

### 공백 — R-38 의 상향 축이 코드에 없다

[README.md](../../README.md) `38 행` 은 "새로운 알고리즘의 설계, 새로운 일거리의 구상, 외부 연구 도입을 위해 타 개발자들이 참고할 수 있도록 소개 자료를 정리하는 활동" 을 **높은 contribution** 으로 간주하라고 지시한다. [requirements.md](../requirements.md) `38 행` REQ-019 는 이를 `IN_PROGRESS` 로 판정하며 **식별 축 · 부여 축이 둘 다 부재** 함을 실측 박제했다.

- **식별 축 부재** — 결정적 등급 신호의 유일 후보인 [evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) 는 `137 행` `titleLength <= CONTRIBUTION_QUALITY_TITLE_FLOOR` (`52 행` 상수 = 1) 로 **임계 이하** 단위만 모으므로 방향이 하향이다. `algorithm` · `research` · `arxiv` · `paper` 어느 문자열도 `src/assessment-evaluation/domain/` 전수에서 매칭 0 이다.
- **부여 축 부재** — [evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `119 행` `applyContributionQualityFloor` 의 대입 값은 `62 행` `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"` 하나뿐이라 **floor 강등 전용 · 단조 비상향** 이다.
- **파이프라인 부재** — [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `116~121 행` 의 신호 6 종 (abuse / updateCount / quality / underPerformer / notableContribution / documentContribution) 중 R-38 축은 없다. 상향은 [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) step (6) 코드 축 · step (7) 문서 **분량** 축뿐이며, 둘 다 "무엇을 썼는가" 가 아니라 "얼마나 많이 · 상대적으로 많이 썼는가" 를 본다.

즉 현재 `high` 부여는 LLM 산출에만 의존하고, [evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `155 행` `classifyNarrative` 가 marker 미인식 시 `33 행` `DEFAULT_CONTRIBUTION = "low"` 로 **경고 없이 환원** 하므로 실제 high 기여가 조용히 소실된다.

### 왜 구현이 아니라 ADR 이 먼저인가

평가 layer 가 볼 수 있는 입력이 극히 좁아, 결정 대상이 구현 방식이 아니라 **정책** 이기 때문이다.

1. **판별 입력 자체가 없다.** [evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) `74 행` 의 `metadata: ActivityMetadata` 가 유일한 정량 창구이고, `src` 전수에서 실제로 채워지는 키는 `titleLength` ([github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `137 행` · [confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `99 행`) · `contentFingerprint` (mapper `145 행`) · Confluence `version` **3 계열뿐** 이다. `EvaluationInput` 에 title 문자열 필드는 **없다**. 파생 신호를 어느 경계에서 만들지가 선결이다.
2. **오탐 비용이 비대칭이다.** 지문 dedup 의 오탐이 기여 **삭제** 였다면 (ADR-0063 `§ Decision 4`), 여기서의 오탐은 **부당한 등급 상향** 이라 다른 기여자의 상대 순위를 깎는다. 임계는 코드보다 먼저 못박아야 한다.
3. **기존 하향 축과의 우선순위** 도 정책이다 — `"zero"` floor 와 `"high"` uplift 가 같은 `contribution` 필드를 다투므로 순서가 곧 결과다.

### 게이트

새 외부 dependency **0** (판별은 문자열 매칭 · Node 내장만), Prisma schema 변경 **0**, 기존 ADR 충돌 **0** (ADR-0032 를 augment). CLAUDE.md `§ 5` 게이트 3 종 미해당.

## Decision

### § Decision 1 — 신호 산출 경계: 수집 mapper 의 raw→typed 경계

**채택: 파생 신호는 두 mapper 의 `buildMetadata` 경계에서 산출하고, `ActivityMetadata` 의 scalar 1 개 `algorithmResearchHits: number` 로만 노출한다.**

- 산출 위치는 [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `129 행` `buildMetadata` 와 [confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `95 행` `buildMetadata` — raw title 이 손 안에 있는 **유일한** 지점이다. 판별 로직은 mapper 본문이 아니라 **순수 helper 파일 1 개** 로 분리하고 mapper 는 호출만 한다 (ADR-0063 `§ Decision 1` 의 helper 분리 관행 승계).
- 값은 `§ Decision 2` 가 정의한 **matched marker 그룹 수** (0 이상 정수) 다. `0` 이면 키 자체를 담지 않는다 — `contentFingerprint` 가 하한 미달 시 키를 생략하는 것 (mapper `144~146 행`) 과 동형이다.
- **boolean 이 아니라 number** 인 이유: 임계는 dogfood 실측 후 조정될 값인데, boolean 으로 굳히면 판별 정책이 수집 layer 에 박제돼 평가 layer 가 임계를 바꿀 수 없다. number 는 mapper 를 사실 수집기로, 평가 layer 를 판정자로 남긴다.
- **기각한 대안 A — 평가 domain 에서 산출.** `EvaluationInput` 에 title 문자열이 없으므로 (`evaluation-input.ts` `74 행` 이 metadata 만 전사) 판별 입력을 새로 실어 나르려면 raw title 을 평가 layer 까지 운반해야 하고, 이는 REQ-032 raw 미저장 표면을 넓히는 정반대 방향이다.
- **기각한 대안 B — `ActivityMetadata` 에 marker 배열 · 객체 노출.** [activity.ts](../../src/assessment-collection/domain/activity.ts) `42 행` `ActivityMetadataValue = string | number | boolean | null` 계약 위반이며, raw 객체 그래프 유입을 막는 방어선을 스스로 뚫는다.

### § Decision 2 — 판별 규칙: 대상 kind · 입력 · 임계

**채택: 대상은 `contributionKind === "document"` 단위 한정, 입력은 title 문자열, 임계는 "소개·정리 축 필수 ∧ 주제 축 1+" 인 `ALGORITHM_RESEARCH_MIN_HITS = 2`.**

- **marker 그룹 3 축** — (A) 주제·알고리즘: `algorithm` · `알고리즘` · `heuristic` · `설계안`, (B) 주제·외부 연구: `research` · `연구` · `arxiv` · `paper` · `논문` · `SOTA`, (C) 형식·소개: `소개` · `도입` · `정리` · `introduction` · `survey` · `tutorial`. 대소문자 무시 · 부분 문자열 매칭.
- **(C) 는 필수 조건이다.** R-38 의 문언은 "타 개발자들이 참고할 수 있도록 **소개 자료를 정리하는** 활동" 이라, 주제어 하나만 스친 회의록 · 진행 로그를 배제해야 한다. 따라서 `hits` 는 (C) 매칭이 있을 때만 1 이상이 되고, (A) 또는 (B) 가 함께 매칭돼야 임계 2 에 도달한다.
- **대상 kind 를 document 로 좁힌 이유**: R-38 의 산출물은 문서다. 코드 축 상향은 이미 [evaluation-notable-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) 의 step (6) 이 담당하므로, code 단위까지 대상에 넣으면 같은 등급을 두 축이 다투게 된다 (`§ Decision 3` 의 멱등 수렴으로 값은 같지만 귀속 근거가 흐려진다).
- **보수 임계를 택한 이유**: 오탐 1 건 = **부당한 등급 상향** 이고, `contributionScore` 가 등간격 매핑 (`§ Decision 5`) 이라 상향 1 건이 그 author 의 평균 점수를 즉시 끌어올려 다른 기여자의 상대 순위를 깎는다. 미탐 (실 high 를 놓침) 은 LLM 축이 여전히 잡을 수 있는 반면, 오탐은 되돌릴 개입 경로가 없다. 따라서 **미탐 쪽으로 편향** 시킨다.
- **기각한 대안 C — 본문 (page body / commit message 전문) 기반 판별.** 정확도는 오르지만 raw 본문을 mapper 밖으로 끌고 나가거나 per-item 상세 호출 (N+1) 을 유발해 REQ-032 표면과 API 비용을 함께 키운다. title 은 이미 mapper 가 보는 값이라 표면 증가가 0 이다.
- **기각한 대안 D — LLM 에 판별 위임.** REQ-019 가 지적한 결함이 정확히 "상향이 LLM 비결정성에만 노출됨" 이다. 같은 축을 다시 LLM 에 맡기면 공백이 닫히지 않는다.

### § Decision 3 — 부여 축: 단조 상향 전용 adjuster + 삽입 위치

**채택: `applyAlgorithmResearchUplift` 를 신설해 `ALGORITHM_RESEARCH_UPLIFT_LEVEL: ContributionLevel = "high"` 를 대입하고, [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 현행 8 step 뒤 **step (9)** 로 삽입한다 (flatten 은 (10) 으로 밀린다).**

- **단조 상향 전용 계약**: 대입 값은 고정 목표 등급 `"high"` 하나뿐이며 하향 분기는 존재하지 않는다. 한 등급씩 올리는 step 방식은 재적용 시 비멱등이라 기각한다 ([evaluation-document-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) `39 행` 의 고정 목표 등급 관행 승계). 입력 배열은 비변형 — 항상 새 객체를 복제해 길이 · 순서를 보존한다.
- **`"zero"` floor 우선**: 현재 등급이 `CONTRIBUTION_QUALITY_FLOOR_LEVEL` ([evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `62 행`) 이면 **무변경** 이다. R-37 의 zero 판정은 "제목이 사실상 없음" 을 뜻하는데 그런 단위가 marker 임계를 넘길 수는 없고, 넘겼다면 그것이 곧 오탐 신호다. 하한이 상향보다 강하다.
- **삽입 위치 근거**: (a) step (3) quality floor **뒤** 라야 `"zero"` 하한이 우선 보존되고, (b) step (6) 코드 축 · step (7) 문서 분량 축과 목표 등급이 `"high"` 로 같고 셋 다 멱등이라 한 author 가 여러 축에 걸려도 산출이 `"high"` 로 수렴하며, (c) narrative 만 손대는 step (4) (5) (8) 과 **필드 직교** 라 marker 접두를 훼손하지 않는다.
- **기각한 대안 E — step (3) 앞 삽입.** floor 가 상향을 덮어써 R-38 이 R-37 에 삼켜진다 — 우선순위 결정을 순서 우연에 맡기는 셈이다.
- **기각한 대안 F — `evaluation-quality-adjust.ts` 안에 상향 분기 추가.** 그 파일은 `36~37 행` 주석이 floor 강등의 **단조 비상향** 을 계약으로 못박고 `110~111 행` 주석이 "등급 상향은 본 helper 의 책임이 아니다" 를 자인한 **강등 전용** helper 다. 한 helper 가 양방향을 갖게 되면 "무엇이 등급을 바꿨는가" 의 추적이 무너진다.
- **narrative marker 접두는 v1 미포함** — 점수 축을 먼저 닫는다 (`§ Follow-ups` 확장 지점).

### § Decision 4 — LLM 산출과의 관계

**채택: 결정적 상향은 LLM 산출을 보완하되 덮어쓴다. 이미 `"high"` 면 no-op 이다.**

- `classifyNarrative` ([evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `155 행`) 는 `51 행` `CONTRIBUTION_MARKER` 로 값 토큰을 뽑고, 미인식 · marker 부재 시 `33 행` `DEFAULT_CONTRIBUTION = "low"` 로 조용히 환원한다. 본 adjuster 는 그 환원으로 소실된 R-38 기여를 **post-scoring 단계에서 되살린다** — LLM 을 대체하지 않고 하한을 보증한다.
- LLM 이 이미 `"high"` 를 낸 경우 대입 값이 동일하므로 **멱등** 이다 (관측 가능한 변화 0). `"low"` · `"medium"` 이면 `"high"` 로 상향한다 — 결정적 신호가 켜졌다는 것은 `§ Decision 2` 의 보수 임계를 통과했다는 뜻이라, LLM 의 비결정 산출보다 우선한다.
- `"zero"` 인 경우만 예외로 무변경이다 (`§ Decision 3` floor 우선). 그 값이 LLM 산출인지 floor 강등 결과인지 post-scoring 단계에서 구분할 수 없으므로 보수적으로 통일한다.

### § Decision 5 — 영속 · 불변 영향

**채택: 영속 표면 증가 0.**

- **REQ-032 raw 미저장 불변 유지** — 저장되는 것은 title 문자열이 아니라 매칭 그룹 **수 (정수)** 이며, `titleLength` 와 같은 계열의 파생 typed 보조값이다. raw 본문 필드 신설 **0**.
- **[prisma/schema.prisma](../../prisma/schema.prisma) 컬럼 신설 0** — `algorithmResearchHits` 의 수명은 `수집 → mapper → 평가 입력 → adjuster → 폐기` 로 **in-memory 전용** 이다 (ADR-0063 `§ Decision 3` 과 동형).
- **`contributionScore` 등간격 매핑 재사용** — [evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) `74 행` `CONTRIBUTION_SCORE_BY_LEVEL` (zero 0 / low 1 / medium 2 / high 3) 과 `147 행` 대입을 그대로 쓴다. 상향은 `3` 으로 영속되고 [summary-aggregate.ts](../../src/assessment-evaluation/domain/summary-aggregate.ts) `101 행` 합산을 거쳐 `metricScore` 에 반영된다. 새 매핑 · 새 가중치 **0**.

## Consequences

- **얻는 것**: README `38 행` 의 상향 축을 LLM 무관 결정적 경로로 닫는다. REQ-019 의 "식별 축 · 부여 축 부재" 실측 문장이 구현 chain 머지 후 재판정 대상이 된다.
- **오탐 위험 (부당 상향)**: title 에 marker 를 형식적으로 넣은 저품질 문서가 `"high"` 를 받으면 그 author 의 평균 점수가 부당하게 오르고 동료의 상대 순위가 깎인다. **완화** — (i) `§ Decision 2` 의 (C) 필수 + 임계 2 보수 규칙, (ii) `"zero"` floor 우선 (`§ Decision 3`), (iii) document kind 한정, (iv) `§ Follow-ups` (c) 의 상향 건수 관측 로그로 과잉 발동을 수치로 인지.
- **미탐 위험 (실 high 기여 누락)**: marker 어휘 밖 표현 (영문 약어 · 사내 용어 · 제목이 주제만 담고 형식어가 없는 경우) 은 잡히지 않는다. **완화** — LLM 축이 여전히 병행 동작하고 (`§ Decision 4`), 미탐은 현행 대비 **악화가 아니다** (현행이 곧 전량 미탐). 어휘 확장은 상수 1 곳 수정으로 끝나도록 helper 를 분리한다.
- **치르는 것**: mapper 가 활동당 문자열 매칭 수 회를 더 수행한다 (수집 규모 대비 무시 가능). 임계 · 어휘가 바뀌면 과거 수집분과 신호가 달라지지만 in-memory 전용이라 마이그레이션 부담 0.
- **경계**: 본 ADR 은 기존 하향 축 ([evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) · [evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts)) 의 판정식 · 상수를 건드리지 않는다. 두 파일 주석의 `REQ-037 / REQ-038` 오기 (README 행 번호를 REQ ID 로 적은 drift) 정정도 본 ADR 범위 밖이다.

## Follow-ups

구현 chain 을 파일 · 심볼 단위로 박제한다 (각 slice ≤ 300 LOC / ≤ 5 파일, CLAUDE.md `§ 3` 소비처 동반 의무 판정 포함). 본 slice 는 코드 0 LOC 이라 신규 spec 0 이 정당하며, R-112 의 4 축 (happy-path / error path / 분기별 / 예외 분기마다 negative) 은 **아래 (a)~(c) 가 진다** — 각 slice 에 축별 요구를 선박제한다.

- **(a) mapper 파생 신호 slice** — 신설 `src/assessment-collection/domain/algorithm-research-signal.ts` (`ALGORITHM_RESEARCH_MIN_HITS` · marker 그룹 3 상수 · `computeAlgorithmResearchHits(title: unknown): number`) · 그 `.spec.ts` · [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `buildMetadata` 배선 · [confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `buildMetadata` 배선 · mapper spec 1 종. **5 파일 / ~200 LOC**. 소비처 동반: **충족** (helper + 유일 소비처 2 mapper 동반). R-112 — happy: (C)+(A) title → hits 2. error: 비-string · undefined title → 0 (throw 0). 분기: (C) 단독 / (A) 단독 / 대소문자 / 한영 혼용. negative: hits 0 이면 `metadata.algorithmResearchHits` **키 미포함**.
- **(b) detection helper + detection pipeline 배선** — 신설 `src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts` (`computeAlgorithmResearchSignal(inputs)` — document kind 필터 + 임계 비교 + author 별 대상 `unitId` 수집) · 그 spec · [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `116~121 행` container 에 7 번째 필드 추가 · 그 spec. **4 파일 / ~230 LOC**. 소비처 동반: **충족**. R-112 — happy: 임계 이상 document → 대상. error: `inputs` null/undefined → 한국어 `TypeError`. 분기: code kind 제외 / 임계 미달 / metadata 키 부재 / 비-number 값. negative: 빈 입력 → 빈 신호 (`detected === false`).
- **(c) uplift adjuster + adjustments pipeline 배선 + 관측 로그** — 신설 `src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts` (`ALGORITHM_RESEARCH_UPLIFT_LEVEL` · `applyAlgorithmResearchUplift`) · 그 spec · [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) step (9) 배선 + signals 계약 guard · 그 spec. **4 파일 / ~250 LOC**. 소비처 동반: **충족**. R-112 — happy: 대상 단위 `contribution` → `"high"`. error: `signals` 필드 null/undefined → 한국어 `TypeError`. 분기: 미대상 author passthrough / step (3) floor 뒤 `"zero"` 보존 / step (6) (7) 과의 `"high"` 수렴. negative: 입력 배열 비변형 + 길이 · 순서 보존, 이미 `"high"` 면 멱등.
- **(d) doc-sync (direct)** — 본 ADR status PROPOSED → ACCEPTED, [requirements.md](../requirements.md) `38 행` REQ-019 재판정 ([PLAN.md](../PLAN.md) `183 행` once-rule 대로 (a)~(c) 전량 머지 후 **1 회만**), PLAN 품질 분류 bullet 서술 갱신. **문서 전용 / cap 무관**.
- **(확장 지점, task 아님)** narrative marker 접두 (`[연구소개] ` 계열) · 본문 축 편입 · marker 어휘의 운영 설정화 — 각각 본 ADR 을 augment 하는 후속 ADR 이 선행한다.

## References

- [README.md](../../README.md) `38 행` — R-38 원문 (본 ADR 이 닫는 축)
- [docs/requirements.md](../requirements.md) `38 행` — REQ-019 IN_PROGRESS 판정문 (식별 축 · 부여 축 부재 실측)
- [ADR-0032](ADR-0032-p5-evaluation-contract.md) `25 행` — R-37 / R-38 scope 나열 (본 ADR 이 augment)
- [ADR-0063](ADR-0063-commit-content-fingerprint-dedup.md) — mapper 경계 파생 scalar · 오탐 하한 · 순서 결정의 직전 선례
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~43 행` — `ActivityMetadataValue` scalar 계약
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `129 행` · `137 행` · `145 행` — `buildMetadata` 산출 지점
- [src/assessment-collection/domain/confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `95 행` · `99 행` — 문서 축 `buildMetadata`
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) `74 행` — 평가 입력의 유일한 metadata 창구
- [src/assessment-evaluation/domain/evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `62 행` · `119 행` — `"zero"` floor 상수와 강등 전용 계약
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) — 현행 8 step 순서 (step (9) 삽입 대상)
- [src/assessment-evaluation/domain/evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `33 행` · `155 행` — LLM 환원 default 와 `classifyNarrative`
- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) `74 행` · `147 행` — 등간격 점수 매핑

Refs: ADR-0064, ADR-0032, ADR-0063, REQ-019, REQ-032, T-1948
