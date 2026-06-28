---
id: T-0748
title: realdata-e2e result-summary→markdown 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T07:30Z
mergedSha: 65becf25
prNumber: 663
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step③→④ post-eval 결과 요약 렌더 leg 직접 조립 buildRealDataResultSummary→renderRealDataResultSummaryMarkdown smoke. issue-still-relevant: git grep renderRealDataResultSummaryMarkdown test/smoke/=NONE(컴포저 unit+consistency spec 만) 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-result-summary-markdown-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-summary-markdown-assembly.smoke-spec.ts]
---

# T-0748 — realdata-e2e result-summary→markdown 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step③→④ 경계의 post-eval(평가-후) 결과 요약 렌더링 side** build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1) `buildRealDataResultSummary(results)` (T-0705/T-0706) 가 `EvaluationResult[]`(scoring 산출)을 결과 요약 descriptor `RealDataResultSummary`(`{count, byDifficulty, byContribution, totalVolume}`)로 집계하고, (2) `renderRealDataResultSummaryMarkdown(summary)` (T-0714) 가 그 요약 descriptor 를 daily-test 이슈 본문용 **결정론적 마크다운 문자열**(총 단위 수 헤더 + difficulty 분포 표 + contribution 분포 표 + 총 volume)로 렌더한다.

이 result-summary→markdown leg 는 step③(scoring)→step④(결과 이슈 박제)로 넘어가는 길목에서 **사람이 읽는 결과 요약 본문**을 합성하는 종단 변환이다. 그러나 **이 두 컴포저(summary→markdown)를 직접 chain 으로 묶은 non-gated build-time smoke 는 부재**다. 기존 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740) 는 `buildRealDataResultReportPlan`(results→summary→descriptor) 진입으로 summary 의 issue-descriptor side 만 검증할 뿐, summary 의 **markdown 본문 렌더 side**(분포 표 골격·슬롯 순서·count/totalVolume 토큰 보간·집계↔렌더 정합)를 두 helper 직접 chain 으로 묶은 단언은 0 이다 (`git grep renderRealDataResultSummaryMarkdown test/smoke/` = NONE — 직접 chain smoke 파일 부재, 컴포저 unit + consistency + markdown-shape spec 만 존재 확인).

즉 집계 drift(difficulty/contribution 슬롯 +1 오류·totalVolume 누적 오류·count↔length drift)·markdown 골격 drift(헤더/표 고정 리터럴·DIFFICULTIES/CONTRIBUTION_LEVELS 슬롯 순서·count↔totalVolume 토큰 교차·표 row 구분자)·빈 results 빈-summary(count 0·전 슬롯 0·totalVolume 0) 분기·집계↔렌더 정합(동일 results → summary → markdown 의 분포 값이 byte-identical 전파)·결정론(동일 results → byte-identical markdown)·raw narrative 누출 0(R-59/REQ-059) 분기는 public CI 에서 직접 발화되지 않고 report-plan wrapper 또는 step④ live gh-gated runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — report-plan leg(T-0740) 의 issue-descriptor side 와 대칭인 **markdown-본문 side 직접-체인 smoke** 로, EvaluationResult[]→summary→markdown 종단 조립 surface 회귀를 public CI 그물로 박제해 결과 요약의 양 출력 경로(issue descriptor·markdown 본문)를 모두 직접-체인으로 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-summary.ts` — 위임 (1) `buildRealDataResultSummary(results)` → `RealDataResultSummary`(`{count, byDifficulty, byContribution, totalVolume}`). 빈/단일/다수 results 분기·슬롯 +1 누적·totalVolume 누적·매 호출 새 객체(+ 새 byDifficulty/byContribution 하위 객체, 무공유)·입력 results 비변형 규칙. `RealDataResultSummary` interface 정의도 여기
- `test/helpers/realdata-e2e-result-summary-markdown.ts` — 위임 (2) `renderRealDataResultSummaryMarkdown(summary)` → 결정론 마크다운 문자열. 고정 헤더(`## 실 평가 e2e 결과 요약`)·`- 평가 단위 수: ${count}`·`- 총 volume: ${totalVolume}`·difficulty 표(DIFFICULTIES 순서)·contribution 표(CONTRIBUTION_LEVELS 순서)·summary 비변형·byte-identical 반환 규칙
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` interface(`{narrative, difficulty, contribution, volume}`) + `CONTRIBUTION_LEVELS` value. synthetic EvaluationResult literal 구성용 필드·등급 집합 참고
- `src/llm/difficulty.ts` — `DIFFICULTIES` value + `Difficulty` type. synthetic literal 의 difficulty 슬롯·렌더 표 순서 참고
- `test/smoke/realdata-e2e-result-report-plan-assembly.smoke-spec.ts` — issue-descriptor side 대칭 sibling smoke(T-0740). non-gated describe·deep-equal 단일 source 대조·빈/단일/다수 results flow·결정론·무공유·no-mutation·non-gated 패턴의 mirror 템플릿
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-summary-markdown-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — synthetic `EvaluationResult[]` literal(여러 difficulty/contribution 슬롯 + volume 혼합) → `buildRealDataResultSummary(results)` → `renderRealDataResultSummaryMarkdown(summary)` 종단 chain 을 한 번에 실행. (a) 산출 markdown 이 고정 헤더(`## 실 평가 e2e 결과 요약`)·`- 평가 단위 수: <count>`·`- 총 volume: <totalVolume>`·`### difficulty 분포`·`### contribution 분포` 골격을 보유 1+ test. (b) markdown 이 expected literal(count=results.length·totalVolume=volume 합·각 difficulty/contribution 슬롯 카운트가 DIFFICULTIES/CONTRIBUTION_LEVELS 순서대로 표 row 에 보간)과 정확히 일치(toBe deep string) 1+ test. (c) markdown 안의 difficulty/contribution 표 카운트가 중간 summary(build 산출)의 byDifficulty/byContribution 값과 동일하게 전파(재집계 없이 위임 산출만 thread) 1+ test.
- [ ] **단일 source 조립 단언** — 동일 results 에 대해 직접 chain 산출 markdown 이 `renderRealDataResultSummaryMarkdown(buildRealDataResultSummary(results))` 와 toBe 동일(중간 summary 단일 source 전파, 재합성 없이 위임 산출만 옮김) 1+ test. markdown 의 `- 평가 단위 수`·`- 총 volume` 토큰이 summary.count·summary.totalVolume 과 정합(집계↔렌더 토큰 정합) 1+ test.
- [ ] **Error/negative path test** — (a) **빈 results** → summary(count 0·전 difficulty/contribution 슬롯 0·totalVolume 0) → markdown 이 `- 평가 단위 수: 0`·`- 총 volume: 0`·전 슬롯 0 표 를 보유(빈-입력 분기 종단 렌더) 1+ test. (b) **단일 results** → 해당 슬롯 1·나머지 0·totalVolume=그 volume 의 정확한 종단 markdown 1+ test. (c) **모든 원소가 동일 difficulty/contribution** → 그 슬롯만 count·나머지 슬롯 0 의 종단 markdown(슬롯 집중 분기) 1+ test.
- [ ] **Flow / branch coverage** — (a) raw 본문/narrative 누출 0: 산출 markdown 에 `EvaluationResult.narrative`(LLM 정성 텍스트)·token/secret/raw narrative 패턴 미포함(count/volume 토큰·난이도/기여도 슬롯 라벨·고정 표 골격만, R-59/REQ-059 정합) 1+ test — synthetic narrative 에 sentinel 문자열을 넣고 markdown 에 미등장 단언. (b) 슬롯 순서 결정론: 입력 results 의 difficulty/contribution 등장 순서를 섞어도 markdown 표는 항상 DIFFICULTIES/CONTRIBUTION_LEVELS single-source 순서로 렌더 1+ test. (c) totalVolume 정수 합 보간: 여러 volume(0 포함)이 합산돼 `- 총 volume` 토큰에 정확히 보간 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 results → 빈-summary 종단 markdown, (b) 단일 results → 단일 슬롯 종단 markdown, (c) 슬롯 집중 results → 집중 슬롯 종단 markdown, (d) **raw narrative 누출 0**(sentinel 미등장), (e) **결정론·무공유**: 동일 results 두 번 chain 호출 시 toBe 동일 markdown 문자열 + 매 호출 새 summary 객체(build 반환 참조 비동일), (f) **no-mutation**: 입력 results 배열·원소가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic EvaluationResult literal 직접 주입).
- [ ] live leg (실 scoring / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / 실 네트워크 / DB 접근 / 실 jest spawn / 실 gh) 복제 0 — results→summary→markdown 조립 surface 만 검증 (synthetic EvaluationResult literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740, `buildRealDataResultReportPlan` results→summary→descriptor) 의 재검증 — 본 task 는 summary 의 **markdown-본문 렌더 side** 직접 chain 만 책임 (issue-descriptor side 와 별개 절단면, 중복·재검증 0).
- 기존 `realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` (T-0741) / `realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` (T-0742) / outcome-report·publish 계열 smoke — 본 task 는 summary→markdown 렌더 leg 만, 별개 절단면.
- 실 scoring 실행 / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / DB 접근 / 실 gh / 실 jest spawn / 실 네트워크.
- 컴포저 소스(`realdata-e2e-result-summary.ts` / `realdata-e2e-result-summary-markdown.ts`) / 위임 consistency·summary-line·markdown-shape 가드 / EvaluationResult·Difficulty·CONTRIBUTION_LEVELS 정의 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0747 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
