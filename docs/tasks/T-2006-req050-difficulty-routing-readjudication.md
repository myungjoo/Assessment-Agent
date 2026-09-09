---
id: T-2006
title: REQ-050 재판정 — 난이도 routing 발화 arc(ADR-0065 · helper · 배선 · 회귀 spec) 실측 반영
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-050]
estimatedDiff: 40
estimatedFiles: 1
touchesFiles: [docs/requirements.md]
dependsOn: [T-2003, T-2004, T-2005]
independentStream: difficulty-routing-activation
created: 2026-09-10
plannerNote: ADR-0065 §Follow-ups (c) 집행 — (a)T-2004 · (b)T-2005 전량 머지 후 REQ-050 1 회 재판정(direct doc-only 1 파일)
---

# T-2006 — REQ-050 재판정 (난이도 routing 발화 arc 실측 반영)

## Why

[ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) `§ Follow-ups` 의 (a) 규칙 helper + 소비처 배선 = T-2004(main `10f2c18d`), (b) fail-fast 전파 cross-layer 회귀 spec = T-2005(main `4b1a95a6`) 가 **전량 머지** 됐다. 같은 절의 (c) 는 "(a) · (b) 전량 머지 후 [requirements.md](../requirements.md) `69 행` REQ-050 을 **1 회만** 재판정" 이며, [PLAN.md](../PLAN.md) `183 행` once-rule + CLAUDE.md `§3.1` 의 "구현 slice 머지 후 REQ 당 1 회" 규칙에 정확히 부합한다. T-2002 가 소진한 회차는 **T-1998~T-2001 seed 경로 arc** 의 것이라 본 arc(ADR-0065 발화 arc)의 재판정은 **0 회** 다.

issue-still-relevant pre-check (origin/main `594d8e3b`, 전부 재현 가능한 실측):

- `grep -c "ADR-0065" docs/requirements.md` = **0**, `T-2003` / `T-2004` / `T-2005` 각 **0**, `evaluation-input-difficulty` **0**, `useInputDifficultyRouting` **0** — 본 arc 의 어떤 산출물도 요구표에 미박제.
- 반면 요구표 `69 행` 은 여전히 두 가지를 단언한다: ① "미충족은 **항목→난이도 결정 규칙 축**" (규칙이 코드에도 ADR 에도 없다), ② "한계 — … `evaluation-scoring.service.ts` 99~101 행은 `gateway.generate(prompt, { modelId })` 로 difficulty 를 주입하지 않고 … **production 전수에서 `options.difficulty` 를 넘기는 호출 0**".
- 실측은 둘 다 어긋난다 — 규칙은 [evaluation-input-difficulty.ts](../../src/assessment-evaluation/domain/evaluation-input-difficulty.ts) `52 행` `resolveInputDifficulty(input)` 로 실재하고(ADR-0065 는 `docs/decisions/` 에 `ACCEPTED` 로 실재), 주입 배선도 [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `108~114 행` 에 실재한다.
- 단 `grep -rn "useInputDifficultyRouting" src test web` 결과 **true 로 켜는 지점은 spec 2 곳뿐** 이고 production caller 는 **0** 이다([evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) `164 행` 이 받은 `options` 를 그대로 전달할 뿐 플래그를 세우지 않는다). 따라서 status 는 `IN_PROGRESS` **유지** 이며 잔여 축이 "결정 규칙 부재" 에서 "**운영 발화 0**(opt-in 기본 OFF · 활성화 경로 미배선)" 으로 **이동** 한 것을 박제하는 것이 본 task 다.

## Required Reading

- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 행 전문(수정 대상, 단일 행 8,304 자 · 파이프 8 개)
- [docs/requirements.md](../requirements.md) `1~10 행` — 표 헤더 · 컬럼 순서(구조 보존 확인용)
- [docs/decisions/ADR-0065-difficulty-routing-activation.md](../decisions/ADR-0065-difficulty-routing-activation.md) — frontmatter(`status: ACCEPTED` · `date: 2026-09-09` · `augments: [ADR-0011, ADR-0032]`) · `42 행` § Decision 1 · `54 행` § Decision 2 · `59 행` § Decision 3 · `67 행` § Decision 4 · `§ Follow-ups` (c)
- [src/assessment-evaluation/domain/evaluation-input-difficulty.ts](../../src/assessment-evaluation/domain/evaluation-input-difficulty.ts) `17 행`(`DEFAULT_INPUT_DIFFICULTY`) · `20~33 행`(가중치 · 밴드 · 임계 상수) · `52 행`(`resolveInputDifficulty`)
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `47~55 행`(`ScoringOptions` + `useInputDifficultyRouting?: boolean` opt-in) · `108~114 행`(주입 분기 + `generate` 1 회 호출) · `117 행`(사후 `classifyNarrative`)
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `112~116 행` — `options.difficulty` 유무 분기(요구표가 이미 인용 중인 좌표, 변동 없음 확인용)
- [src/assessment-evaluation/domain/evaluation-input-difficulty.spec.ts](../../src/assessment-evaluation/domain/evaluation-input-difficulty.spec.ts) — 131 행 · describe 5 · it 9
- [src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts](../../src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts) — 300 행 · describe 5 · it 8 (T-2005 cross-layer 회귀)
- [docs/PLAN.md](../PLAN.md) `183 행` — REQ 재판정 once-rule(횟수 근거)
- [CLAUDE.md](../../CLAUDE.md) `§3.1` — direct commitMode 판정 근거

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) `69 행` REQ-050 행 **하나만** 수정한다. `git diff --stat` 이 **1 파일** 이고, `git diff -U0 docs/requirements.md` 의 변경 hunk 가 REQ-050 행에 국한됨을 확인(다른 REQ 행 · 헤더 무접촉).
- [ ] 표 구조 보존: 수정 후 `grep -c '^| REQ-' docs/requirements.md` = **84**, `sed -n '69p' docs/requirements.md | tr -cd '|' | wc -c` = **8**, `wc -l < docs/requirements.md` = **121**. 셀 본문에 `|` 문자를 새로 넣지 않는다.
- [ ] **ADR 축 갱신**: 행 안에 [ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) 를 파일 값 그대로 인용(`status: ACCEPTED` · `date: 2026-09-09` · `augments: [ADR-0011, ADR-0032]` · supersede 0)하고, § Decision 1~4 중 본 REQ 에 해당하는 결정(사전 규칙 · 주입 지점 · opt-in 가드 · 요약 경로 범위 밖)을 좌표(`42` · `54` · `59` · `67 행`)와 함께 적는다. `grep -c "ADR-0065" docs/requirements.md` ≥ 1.
- [ ] **결정 규칙 축 정정**: 기존의 "항목→난이도 결정 규칙이 코드에도 ADR 에도 없다" 자인을 실측으로 대체 — `resolveInputDifficulty` 파일 · `52 행` 시그니처, 규칙 입력면(`contributionKind` + `metadata.titleLength`), 임계 상수 좌표(`20~33 행`), 환원 규칙(비-number · 비유한 · 음수 → `DEFAULT_INPUT_DIFFICULTY`, throw 0)을 적는다.
- [ ] **주입 축 정정**: "production 전수에서 `options.difficulty` 를 넘기는 호출 0" 문장을 실측으로 대체 — 배선 좌표 `108~114 행`, opt-in 필드 `54 행` `useInputDifficultyRouting?: boolean`(기본 OFF), ON/OFF 두 경로 모두 `generate` **× 1 유지**, 결과 `difficulty` 는 사후 `classifyNarrative`(`117 행`) 값 유지를 명시.
- [ ] **잔여 축 박제**: status 는 `IN_PROGRESS` **유지** 하고, 잔여를 "운영 발화 0" 으로 서술한다 — 근거는 `grep -rn "useInputDifficultyRouting" src test web` 이 spec 2 파일에서만 `true` 를 세우고 production caller 가 0 이라는 실측, 그리고 [evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) `164 행` 이 옵션을 전달만 한다는 사실. 요약 경로는 ADR-0065 § Decision 4 로 **범위 밖** 임을 함께 적는다.
- [ ] **검증 축 갱신**: unit 축 it 수를 재검산해 적는다 — 새로 더해진 [evaluation-input-difficulty.spec.ts](../../src/assessment-evaluation/domain/evaluation-input-difficulty.spec.ts)(describe 5 · it 9) · [evaluation-scoring.difficulty-routing.spec.ts](../../src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts)(describe 5 · it 8). 수치는 반드시 실행 시점 `grep -c "^\s*it(\|^\s*it\.each" <file>` 로 재확인하고, 실측과 다르면 **실측을 적는다**(task 파일 수치를 그대로 옮겨 적지 않는다).
- [ ] 기존 행이 이미 담고 있는 seed 경로 4 축(T-1998~T-2001) · e2e 좌표(`test/e2e/difficulty-mappings.e2e-spec.ts` describe 3 · it 19) · perf 좌표 서술은 **삭제하지 않고 보존** 한다(add-only 정정 원칙). 삭제는 위 두 정정 대상 문장에 한한다.
- [ ] 인용한 모든 신규 좌표를 `sed -n '<n>p' <file>` 또는 `grep -n` 으로 1 건씩 재현 확인한다. 재현되지 않는 좌표는 적지 않는다(없는 근거를 만들지 않는다).
- [ ] R-110 / R-112: 본 task 는 `direct` **doc-only** 이며 `src/` · `web/` · `test/` 변경 0 이라 tester 호출과 R-112 4 축(happy / error / 분기별 / 예외 분기 negative)이 **면제** 다. 그 사유를 commit body 에 1 줄 박제하고, 대신 위 grep · sed 기계 검증으로 대체한다. 신규 helper · 소비처 신설 0 이라 CLAUDE.md `§3` 소비처 동반 의무도 무저촉임을 함께 적는다.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` · `package.json` 의 어떤 변경도 하지 않는다(본 task 는 doc-only `direct`).
- `useInputDifficultyRouting` 을 production 에서 ON 으로 켜는 배선(orchestrator · 설정 경로) — ADR-0065 를 augment 하는 후속 결정이 선행해야 한다.
- [ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) · [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) · [ADR-0032](../decisions/ADR-0032-p5-evaluation-contract.md) 본문 수정(결정 내용 변경은 `pr` mode 대상).
- [docs/PLAN.md](../PLAN.md) 체크박스 · 다른 REQ 행 재판정 — REQ-050 **1 행** 외 접촉 금지. 본 arc 재판정은 이 1 회로 소진된다.
- 요약 경로(`summary-narrative.service.ts`) 난이도 routing 서술 확장 — ADR-0065 § Decision 4 로 범위 밖.
- 새 e2e · smoke spec 신설, 기존 spec 본문 수정.

## Suggested Sub-agents

`implementer` (doc 편집 + grep · sed 기계 검증). tester 는 direct doc-only 라 면제.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
