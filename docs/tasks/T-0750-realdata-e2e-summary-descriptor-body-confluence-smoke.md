---
id: T-0750
title: realdata-e2e summary→descriptor body 3-블록 confluence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-109]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-06-28
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-summary-descriptor-body-confluence-assembly.smoke-spec.ts]
independentStream: realdata-e2e-summary-descriptor-body-confluence-assembly-smoke
plannerNote: P5 PLAN §109 실 평가 e2e — buildRealDataResultSummary→buildRealDataResultIssueDescriptor 직접 체인의 body 3-블록(marker+line+markdown) confluence smoke. T-0748/T-0749 render 트리오 종결. dependsOn [] file-disjoint stage5b 병렬.
---

# T-0750 — realdata-e2e summary→descriptor body 3-블록 confluence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 🟢 실 평가 e2e(P5)의 step ③(평가)→step ④(결과 이슈 박제) 경계에서, post-eval 결과 요약을 이슈 본문으로 합성하는 종단 컴포저 `buildRealDataResultIssueDescriptor(summary, run)` 는 body 를 **3 블록 confluence** 로 합성한다 — `marker 라인` + `formatRealDataResultSummaryLine(summary)`(한 줄 요약) + `renderRealDataResultSummaryMarkdown(summary)`(markdown 본문), 빈 줄 1 개 구분. 즉 descriptor 는 한 줄 렌더(T-0749)와 markdown 렌더(T-0748)가 **같은 summary 로부터 동시에** 합류하는 confluence 지점이다.

그러나 이 confluence 를 public 조립 레벨에서 cover 하는 smoke 가 부재다. T-0748/T-0749 는 각 renderer 를 summary 대비 **고립** 검증할 뿐 descriptor body 안 합류는 보지 않고, T-0740(report-plan) smoke 는 `descriptor` 를 `buildRealDataResultIssueDescriptor(summary, run)` 직접 호출과 deep-equal 만 할 뿐 `body.length>0` + `body.toContain(marker)` 외에 body 를 쪼개 한 줄 블록↔`formatRealDataResultSummaryLine(summary)`·markdown 블록↔`renderRealDataResultSummaryMarkdown(summary)` 정합·단일 source·블록 순서/구분 빈 줄 무결성을 단언하지 않는다. 본 task 가 `buildRealDataResultSummary(results) → buildRealDataResultIssueDescriptor(summary, run)` 직접 2-컴포저 체인 smoke 로 그 confluence gap 을 public CI 그물로 박제해 결과 요약 렌더 트리오(markdown T-0748·line T-0749·descriptor-body confluence T-0750)를 종결한다.

issue-still-relevant 확인: `git grep` 으로 summary+descriptor+(line OR markdown renderer) 를 함께 import 하는 smoke 0(report-plan smoke 는 summary+descriptor 만, line/markdown renderer 미import — body 쪼개기 0), descriptor body 블록 confluence 단언 부재 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` (종단 컴포저 `buildRealDataResultIssueDescriptor` — body 3-블록 합성 L130-140, 입력 `RealDataResultSummary` + `RealDataResultIssueRunRef`)
- `test/helpers/realdata-e2e-result-summary.ts` (`buildRealDataResultSummary(results)` — `EvaluationResult[]`→`RealDataResultSummary`)
- `test/helpers/realdata-e2e-result-summary-line.ts` (`formatRealDataResultSummaryLine(summary)` — 한 줄 블록 직접 비교용)
- `test/helpers/realdata-e2e-result-summary-markdown.ts` (`renderRealDataResultSummaryMarkdown(summary)` — markdown 블록 직접 비교용)
- `test/smoke/realdata-e2e-result-summary-line-assembly.smoke-spec.ts` (T-0749 — synthetic `EvaluationResult` literal 주입·non-gated·import 스타일 reference)
- `test/smoke/realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740 — descriptor body 를 어디까지만 단언하는지 확인용, 본 task 가 채우는 gap 의 경계)

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-summary-descriptor-body-confluence-assembly.smoke-spec.ts` 1개만 추가. 모두 synthetic `EvaluationResult[]` literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / jest spawn / DB / 네트워크 0 복제), `process.env` 읽기 0, gating 0(non-gated 항상 실행, R-113). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12).

- [ ] **Happy-path**: `buildRealDataResultSummary(results)` → `buildRealDataResultIssueDescriptor(summary, run)` 종단 조립 후 `descriptor.body` 가 string·non-empty 이고 `marker` 라인을 정확히 1 회 포함(멱등 search-or-update 기반).
- [ ] **Confluence — 한 줄 블록 단일 source**: `descriptor.body` 를 줄/빈 줄로 쪼갰을 때 한 줄 요약 블록이 동일 summary 의 직접 `formatRealDataResultSummaryLine(summary)` 결과와 byte-identical(같은 summary 단일 source thread, 중복 0·정확히 1 회 등장).
- [ ] **Confluence — markdown 블록 단일 source**: `descriptor.body` 의 markdown 블록이 동일 summary 의 직접 `renderRealDataResultSummaryMarkdown(summary)` 결과와 byte-identical(가공 0 합성).
- [ ] **블록 순서·구분 무결성**: body 가 `[marker, "", line, "", markdown].join("\n")` 구조 — marker 직후 한 줄 요약, 그 뒤 markdown, 각 블록 빈 줄 1 개 구분(순서/구분자 회귀 가드).
- [ ] **단일 source 교차 단언**: 동일 `results`·`run` 으로 두 번 조립 시 `descriptor.body` 결정론 동일, 그리고 `buildRealDataResultSummary(results)` 를 한 번만 만들어 직접 renderer 2 개에 통과시킨 블록과 descriptor body 내 블록이 일치(중간 summary 단일 source).
- [ ] **Error path / negative — 충분 cover**(예외 분기마다 1+): (1) `run.gitSha` 빈/공백 throw 전파, (2) `run.dateToken` 빈/공백 throw 전파, (3) 빈 `results`(빈-summary) 분기에서도 body 가 3-블록 구조·marker 포함(빈 summary 에서 line/markdown 블록이 직접 renderer 와 여전히 일치), (4) raw narrative / credential 류 누출 0(body 에 token/secret 어휘 미등장 단언).
- [ ] **Flow / 분기**: 빈·단일·다수 `results` 분포에 대해 각각 confluence(line/markdown 블록 직접 renderer 일치) 성립.
- [ ] **결정론·무공유·no-mutation**: 동일 입력 반복 조립이 byte-identical, 조립이 입력 `results`/`run` 객체를 mutate 하지 않음(입력 deep-freeze 또는 before/after 스냅샷 비교).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green. 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — 신규 spec 자체가 기존 컴포저 line/function coverage 를 떨어뜨리지 않음을 `pnpm test:cov` 또는 smoke 격리 실행으로 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일).
- 새 컴포저·새 helper·새 type 신설 금지 — 기존 `buildRealDataResultSummary` / `buildRealDataResultIssueDescriptor` / `formatRealDataResultSummaryLine` / `renderRealDataResultSummaryMarkdown` import 만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / 실 jest spawn / DB / 네트워크 호출 0 — synthetic literal 만.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).
- T-0748(markdown 고립)·T-0749(line 고립)·T-0740(report-plan aggregator) 의 기존 단언 중복 복제 금지 — 본 task 는 descriptor body 안 **confluence**(두 renderer 합류·단일 source) 만 책임.
- title·marker identity 정합(T-0709 가드 영역)·command-args / search-argv 후속 leg 는 본 task 범위 밖.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
