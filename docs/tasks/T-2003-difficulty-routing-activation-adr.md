---
id: T-2003
title: ADR-0065 신설 — 평가 경로 난이도 모델 routing 발화 설계 (항목→난이도 사전 결정 규칙 · 주입 지점 · 미설정 회귀 가드)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-09-09
independentStream: llm-difficulty
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0065-difficulty-routing-activation.md
  - docs/decisions/ADR-0032-p5-evaluation-contract.md
plannerNote: "P5 REQ-050 잔여 2 축(난이도 결정 규칙 부재 · options.difficulty 미주입)을 ADR-first 로 결정 — 코드 0 LOC"
---

# T-2003 — 평가 경로 난이도 모델 routing 발화 설계 ADR 신설

## Why

[docs/requirements.md](../requirements.md) `69 행` REQ-050 은 `IN_PROGRESS` 이고, 그 상태 칸이 남긴 잔여는 **두 축**이다 — ① "어떤 항목이 어떤 난이도인지" 를 정하는 **결정 규칙이 코드에도 ADR 에도 없다**, ② 분류 결과가 model 선택으로 되먹임되지 않아 **`options.difficulty` 가 production 전수에서 한 번도 주입되지 않는다**. 두 축은 사실상 같은 매듭이다: 난이도가 LLM 응답 파싱 산물이라 호출 **전** 에는 미상이고, 그래서 [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) 이 박제한 3 슬롯 routing 이 평가 경로에서 **미발화** 다 — Admin 이 easy / medium / hard 3 모델을 지정해도 실제 평가는 항상 `options.modelId` 단일 경로로 나간다. REQ-050 은 요구표상 `Constraint` · 검증 위치 `policy + unit + e2e` · P4 **"ADR 필수"** 이고, ADR-0011 은 `28 행` 에서 자신을 "routing 의 정적 매핑 backbone" 으로만 한정했으므로 이 결정은 **아직 아무 ADR 도 내리지 않았다**. 따라서 다음 slice 는 코드가 아니라 결정(ADR-first)이다.

**issue-still-relevant pre-check (origin/main `8888456a` 기준, 2026-09-09 실측)**

1. `git grep -l "항목→난이도\|항목 → 난이도" origin/main -- docs/decisions/` = **0 파일** — 항목→난이도 결정 규칙을 내린 ADR 이 없다.
2. `git ls-tree origin/main docs/decisions/ | grep -c ADR-0065` = **0** — 번호 충돌 없음(현 ADR 62 개, 최신 [ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md)).
3. `git grep -n "\.generate(" origin/main -- "src/**/*.service.ts"` 의 production 호출은 **2 곳뿐**이고 (`evaluation-scoring.service.ts` `99 행` · `summary-narrative.service.ts` `106 행`) **둘 다 `{ modelId }` 만 넘긴다** — `difficulty` 주입 **0**. 각 호출 바로 위 주석(`97 행` · `104 행`)이 "difficulty 미주입" 을 스스로 자인한다.
4. `src/llm/llm-http-gateway.service.ts` `104~116 행` 의 difficulty 분기는 실재하지만 `options.difficulty === undefined` 경로만 발화 중이다 — 즉 **기능은 지어졌고 스위치가 꺼져 있다**.
5. 직전 chain([T-1998](T-1998-difficulty-slot-seed-endpoint.md)~[T-2001](T-2001-difficulty-slot-seed-contract-guard.md))은 **슬롯 seed · 소비처 · 안내 · guard** 축이라 본 결정 축과 겹치지 않는다. [T-2002](T-2002-req050-seed-path-readjudication.md) 가 REQ-050 재판정 once-rule 을 소진했으므로 본 task 는 요구표를 **건드리지 않는다**(CLAUDE.md §3.1 + 오너 [docs/PLAN.md](../PLAN.md) `183 행`).

부가로 [ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md) `56 행` 은 "이 값이 generate 호출 전 `options.difficulty` 로 주입되어 난이도 모델 routing 을 driving 한다" 고 단언하는데 이는 위 3 · 4 실측과 어긋난다 — 본 ADR 이 그 발화 설계의 결정 정본이 되므로 같은 PR 에서 `56 행` 아래에 **add-only pointer 1 줄** 을 붙여 drift 를 닫는다(원문 삭제 금지).

## Required Reading

- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) `24~28 행`(REQ 외력 · 본 ADR 이 backbone 만 cover 한다는 자기 한정) · `47~51 행`(§1 3 row 고정) · `60~64 행`(§3 미설정 슬롯 fail-fast 4xx).
- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) `50~58 행` — `### (3) 난이도·기여도·양 output 산출`, 특히 정정 대상 `56 행`.
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `90~110 행` — `scoreUnit()` 의 (1) prompt 조립 `95 행` → (2) `generate` 1 회 `97~101 행`(미주입 주석) → (3) 사후 `classifyNarrative` `104 행` → (4) volume `107 행` 순서.
- [src/assessment-evaluation/summary-narrative.service.ts](../../src/assessment-evaluation/summary-narrative.service.ts) `104~108 행` — 요약 경로의 동일 미주입 주석.
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `100~120 행` — `options.difficulty` 유무로 갈리는 configId 결정 분기(`resolveModel` 4xx 전파 포함).
- [src/assessment-evaluation/domain/evaluation-prompt.ts](../../src/assessment-evaluation/domain/evaluation-prompt.ts) `28~32 행`(`DEFAULT_DIFFICULTY = "medium"`) · `48~50 행`(`DIFFICULTY_MARKER`) · `109 행`(난이도 요구 instruction) · `155~168 행`(`classifyNarrative`).
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~83 행` — 사전 규칙이 쓸 수 있는 입력면(`ActivityMetadata` 는 scalar map, `sourceType` / `kind` / `version` tag 실재, raw 본문 금지 REQ-032).
- [src/assessment-collection/domain/activity-contribution.mapper.ts](../../src/assessment-collection/domain/activity-contribution.mapper.ts) `37~39 행` — 수집 경로가 이미 쓰고 있는 `PLACEHOLDER_DIFFICULTY = "easy"` 상수(사전 난이도의 현행 대체물).
- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `1~14 행` — 신설 ADR frontmatter 8 키 서식 mirror 대상.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0065-difficulty-routing-activation.md` 가 신설되고 frontmatter 8 키가 ADR-0064 `1~9 행` 서식과 동형이다 — `id: ADR-0065` · `status: ACCEPTED` · `date: 2026-09-09` · `relatedTask: [T-2003]` · `relatedReq: [REQ-050, REQ-049]` · `supersedes: null` · `augments: [ADR-0011, ADR-0032]`. 검증: `sed -n '1,12p' docs/decisions/ADR-0065-*.md`.
- [ ] `## Context` 가 위 Why 의 실측 좌표를 **파일 + 행 좌표로** 인용한다 — 최소 4 개(`evaluation-scoring.service.ts` `97~101 행` · `104 행`, `summary-narrative.service.ts` `104~108 행`, `llm-http-gateway.service.ts` `100~120 행`, `ADR-0032` `56 행`). 각 인용은 `git grep` 으로 재확인 가능한 문자열이어야 한다(없는 근거 창작 금지).
- [ ] `## Decision` 의 **§Decision 1 — 항목→난이도 사전 결정 규칙** 이 후보 3 종(㉠ metadata 기반 결정적 규칙 · ㉡ 2-pass LLM 분류 선행 호출 · ㉢ 사전 결정 없음=현행 유지)에 조건 4 개를 **전부 대입**한 뒤 결론을 **1 값** 으로 확정한다. 조건 = (a) `generate` 호출 수 증가 배수 (b) 결정성(동일 입력 → 동일 난이도) (c) [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §3 fail-fast 와의 상호작용 (d) 자율 집행 가능성(새 dependency · credential · schema 변경 0).
- [ ] **§Decision 2 — 주입 지점과 입력/출력 난이도 충돌 규칙** 이 (i) 주입 지점을 `evaluation-scoring.service.ts` `97~101 행` 으로 좌표 고정하고 (ii) 사전 난이도와 사후 `classifyNarrative`(`104 행`) 결과가 **다를 때 `EvaluationResult.difficulty` 에 무엇을 기록하는지** 를 1 값으로 확정한다.
- [ ] **§Decision 3 — 슬롯 미설정 회귀 가드** 가 "주입을 켜면 슬롯 미설정 환경에서 평가 전량이 4xx 가 된다"(ADR-0011 `60~64 행` fail-fast × 신규 주입)는 회귀를 명시하고, 처리 방식을 후보 열거 후 **1 값** 으로 확정한다.
- [ ] **§Decision 4 — 요약 경로(`summary-narrative.service.ts`) 취급** 을 1 값으로 확정한다(범위 안/밖 중 하나 + 사유 1 줄).
- [ ] `## Consequences` 가 채택안의 **`generate` 호출 수 변화를 배수 숫자로** 명시한다(예: `× 1` 유지 또는 `× 2`). 호출 수가 늘어나는 안을 채택했다면 그 비용을 음의 항목으로 별도 박제한다.
- [ ] `## Alternatives considered` 에 기각 후보의 기각 사유가 후보당 1+ 줄로 남는다. 새 외부 dependency · credential · `prisma/schema.prisma` 변경을 요구하는 안은 **채택하지 않고**(CLAUDE.md §5) 기각 사유에 그 사실을 적는다.
- [ ] `## Follow-ups` 에 집행(코드 배선) slice 가 **파일 · 배선 단위** 로 1+ 항목 명시된다 — 본 task 는 코드 0 LOC 이므로 집행은 후속 pr slice 소관임이 문장으로 드러나야 한다.
- [ ] [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) `56 행` 계열에 **add-only 1 줄** pointer 가 붙어 그 서술이 의도 서술이며 실 발화 설계의 정본이 ADR-0065 임을 밝힌다. 검증: `git diff origin/main -- docs/decisions/ADR-0032-p5-evaluation-contract.md` 가 **추가 줄만** 보이고 삭제 줄 `0` 이다.
- [ ] 코드 · spec 무변경 — `git diff --name-only origin/main` 결과가 `docs/decisions/` 아래 **2 파일뿐** 이다(`src/` · `web/` · `test/` · `prisma/` · `package.json` 변경 0).
- [ ] R-110 준수 — `pnpm lint && pnpm build && pnpm test` 를 실행해 통과를 확인한다(production 0 LOC 여도 면제 없음).
- [ ] R-112 (1)~(4) 는 **신규 public symbol 0 · 신규 분기 0** 이라 본 task 에 해당 없음 — 그 사실을 PR body 에 1 줄로 명시한다(coverage 게이트는 기존 `pnpm test` 경로가 그대로 강제).

## Out of Scope

- **코드 배선 금지** — `options.difficulty` 실제 주입, `scoreUnit` 시그니처 변경, gateway · prompt · mapper 수정은 전부 후속 slice. 본 task 의 `src/` diff 는 **0 LOC**.
- `prisma/schema.prisma` · migration 변경 (§5 schema 게이트).
- 새 외부 dependency 도입 (§5).
- [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) 의 §1 · §2 · §3 **결정 내용 변경** — 본 ADR 은 그 위에 얹는 발화 설계만 결정한다(`augments`, `supersedes` 아님).
- [docs/requirements.md](../requirements.md) REQ-050 상태 칸 재판정 — once-rule 1 회를 T-2002 가 이미 소진했다. 승격 판단은 **집행 slice 머지 후** 별도 task.
- `web/` 변경 · 난이도 슬롯 UI 수정.
- [ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md) 의 `56 행` 원문 문장 **삭제 · 재작성** (add-only pointer 만 허용).

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
