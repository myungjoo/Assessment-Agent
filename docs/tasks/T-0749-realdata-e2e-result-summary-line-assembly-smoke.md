---
id: T-0749
title: realdata-e2e result-summary→line 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T07:50:00Z
result: "DONE — PR #664 squash 131ae48a. result-summary→line 직접 조립 체인 smoke 1파일(+278/-0) 신설, reviewer round1 APPROVE(0 findings), 4-게이트 PASS, CI green(reviewer-approval step timing rerun 후). 신규 15 it: happy 한-줄 골격·byte-identical expected·슬롯 값 summary 전파·chain↔direct 단일 source·count/volume 토큰 정합·빈/단일/집중 results 분기·raw narrative 누출 0·슬롯 순서 결정론·totalVolume 합·개행 0·무공유·no-mutation·non-gated."
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step③→④ post-eval 결과 요약 한-줄 렌더 leg 직접 조립 buildRealDataResultSummary→formatRealDataResultSummaryLine smoke. T-0748 markdown-본문 side 의 단일-라인 side 대칭. issue-still-relevant: git grep formatRealDataResultSummaryLine test/smoke/=NONE 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-result-summary-line-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-summary-line-assembly.smoke-spec.ts]
---

# T-0749 — realdata-e2e result-summary→line 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step③(평가)→step④(결과 이슈 박제) 경계의 post-eval 결과 요약 단일-라인 렌더 side** build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1) `buildRealDataResultSummary(results)` (T-0580/T-0706) 가 `EvaluationResult[]`(scoring 산출)을 결과 요약 descriptor `RealDataResultSummary`(`{count, byDifficulty, byContribution, totalVolume}`) 로 집계하고, (2) `formatRealDataResultSummaryLine(summary)` (T-0642) 가 그 요약 descriptor 를 daily-test 이슈 title / rolling 이슈 본문 상단 한 줄 / journal/log / CI step_eval stdout 용 **결정론적 한국어 단일 라인**(`실 평가 e2e 결과: count=N · volume=V · 난이도(easy/medium/hard)=a/b/c · 기여도(zero/low/medium/high)=p/q/r/s`, 개행 0) 으로 렌더한다.

이 result-summary→line leg 는 직전 머지 T-0748 (`buildRealDataResultSummary` → `renderRealDataResultSummaryMarkdown` markdown-본문 side) 의 **단일-라인 side 대칭 sibling** 이다 — 둘 다 동일한 summary descriptor 를 입력으로 받지만 markdown 측은 다행 표 (이슈 본문), 단일-라인 측은 한 줄 (이슈 title / journal / stdout) 을 산출한다. step③→step④ 경계의 양 렌더 surface 가운데 markdown side 는 직접 chain smoke 가 박혔으나 **단일-라인 side 는 직접 chain smoke 부재** 다 (`git grep formatRealDataResultSummaryLine test/smoke/` = NONE, `git grep result-summary-line test/smoke/` = NONE — 컴포저 unit + format-shape + consistency spec 만 존재하고, 두 컴포저를 직접 chain 으로 묶은 smoke 파일은 부재 확인).

즉 집계 drift(difficulty/contribution 슬롯 +1 오류 · totalVolume 누적 오류 · count↔length drift) · 단일-라인 골격 drift(prefix `실 평가 e2e 결과: ` 라벨 변경 · `count=` / `· volume=` 토큰 누락 · DIFFICULTIES / CONTRIBUTION_LEVELS 슬롯 순서 뒤바뀜 · `난이도(.../...)` / `기여도(.../...)` 슬롯 라벨 drift · 개행 혼입) · 빈 results 빈-summary(count 0 · 전 슬롯 0 · totalVolume 0) 분기 · 집계↔렌더 정합(동일 results → summary → line 의 슬롯 값이 byte-identical 전파) · 결정론(동일 results → byte-identical line) · raw narrative 누출 0(R-59/REQ-059) 분기는 public CI 에서 직접 발화되지 않고 markdown side 또는 step④ live gh-gated runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — T-0748 의 markdown-본문 side 와 대칭인 **단일-라인 side 직접-체인 smoke** 로, `EvaluationResult[]` → summary → line 종단 조립 surface 회귀를 public CI 그물로 박제해 결과 요약의 양 표현 경로(markdown 본문 · 단일-라인) 를 모두 직접-체인으로 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-summary.ts` — 위임 (1) `buildRealDataResultSummary(results)` → `RealDataResultSummary`(`{count, byDifficulty, byContribution, totalVolume}`). 빈/단일/다수 results 분기 · 슬롯 +1 누적 · totalVolume 누적 · 매 호출 새 객체(+ 새 byDifficulty/byContribution 하위 객체, 무공유) · 입력 results 비변형 규칙. `RealDataResultSummary` interface 정의도 여기
- `test/helpers/realdata-e2e-result-summary-line.ts` — 위임 (2) `formatRealDataResultSummaryLine(summary)` → 결정론 한국어 단일 라인 문자열. 고정 prefix `RESULT_LINE_PREFIX = "실 평가 e2e 결과: "` · `count=${count} · volume=${totalVolume}` · `난이도(easy/medium/hard)=a/b/c` (DIFFICULTIES 순서) · `기여도(zero/low/medium/high)=p/q/r/s` (CONTRIBUTION_LEVELS 순서) · 개행 0 · summary 비변형 · byte-identical 반환 규칙
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` interface(`{unitId, narrative, difficulty, contribution, volume}`) + `CONTRIBUTION_LEVELS` value. synthetic EvaluationResult literal 구성용 필드 · 등급 집합 참고
- `src/llm/difficulty.ts` — `DIFFICULTIES` value + `Difficulty` type. synthetic literal 의 difficulty 슬롯 · 렌더 라인 슬롯 순서 참고
- `test/smoke/realdata-e2e-result-summary-markdown-assembly.smoke-spec.ts` — markdown-본문 side 대칭 sibling smoke(T-0748). non-gated describe · synthetic EvaluationResult literal 빌더 · 빈/단일/다수 results flow · 결정론 · 무공유 · no-mutation · non-gated 패턴의 mirror 템플릿
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-summary-line-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/` · 기존 컴포저 · helper 수정 0).
- [ ] **Happy-path test** — synthetic `EvaluationResult[]` literal(여러 difficulty/contribution 슬롯 + volume 혼합) → `buildRealDataResultSummary(results)` → `formatRealDataResultSummaryLine(summary)` 종단 chain 을 한 번에 실행. (a) 산출 line 이 고정 prefix `"실 평가 e2e 결과: "` · `count=<count>` · `· volume=<totalVolume>` · `· 난이도(easy/medium/hard)=<a>/<b>/<c>` · `· 기여도(zero/low/medium/high)=<p>/<q>/<r>/<s>` 골격을 모두 보유 1+ test. (b) line 이 expected literal(count=results.length · totalVolume=volume 합 · 각 difficulty/contribution 슬롯 카운트가 DIFFICULTIES/CONTRIBUTION_LEVELS 순서대로 슬래시-join 되어 보간) 과 정확히 일치(toBe deep string) 1+ test. (c) line 안의 difficulty/contribution 슬롯 값이 중간 summary(build 산출) 의 byDifficulty/byContribution 값과 동일하게 전파(재집계 없이 위임 산출만 thread) 1+ test.
- [ ] **단일 source 조립 단언** — 동일 results 에 대해 직접 chain 산출 line 이 `formatRealDataResultSummaryLine(buildRealDataResultSummary(results))` 와 toBe 동일(중간 summary 단일 source 전파, 재합성 없이 위임 산출만 옮김) 1+ test. line 의 `count=` · `· volume=` 토큰이 summary.count · summary.totalVolume 과 정합(집계↔렌더 토큰 정합) 1+ test.
- [ ] **Error/negative path test** — (a) **빈 results** → summary(count 0 · 전 difficulty/contribution 슬롯 0 · totalVolume 0) → line 이 `count=0 · volume=0 · 난이도(easy/medium/hard)=0/0/0 · 기여도(zero/low/medium/high)=0/0/0/0` 골격을 보유(빈-입력 분기 종단 렌더) 1+ test. (b) **단일 results** → 해당 difficulty/contribution 슬롯 1 · 나머지 0 · totalVolume=그 volume 의 정확한 종단 line 1+ test. (c) **모든 원소가 동일 difficulty/contribution** → 그 슬롯만 count · 나머지 슬롯 0 의 종단 line(슬롯 집중 분기) 1+ test.
- [ ] **Flow / branch coverage** — (a) raw 본문/narrative 누출 0: 산출 line 에 `EvaluationResult.narrative`(LLM 정성 텍스트) · token/secret/raw narrative 패턴 미포함(count/volume 토큰 · 난이도/기여도 슬롯 라벨 · 고정 prefix 만, R-59/REQ-059 정합) 1+ test — synthetic narrative 에 sentinel 문자열을 넣고 line 에 미등장 단언. (b) 슬롯 순서 결정론: 입력 results 의 difficulty/contribution 등장 순서를 섞어도 line 슬롯은 항상 DIFFICULTIES/CONTRIBUTION_LEVELS single-source 순서(easy → medium → hard · zero → low → medium → high)로 렌더 1+ test. (c) totalVolume 정수 합 보간: 여러 volume(0 포함) 이 합산돼 `· volume=` 토큰에 정확히 보간 1+ test. (d) **개행 0**: 산출 line 이 `\n` 0 개 보유(단일 라인 형태 정합) 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 results → 빈-summary 종단 line, (b) 단일 results → 단일 슬롯 종단 line, (c) 슬롯 집중 results → 집중 슬롯 종단 line, (d) **raw narrative 누출 0**(sentinel 미등장), (e) **결정론 · 무공유**: 동일 results 두 번 chain 호출 시 toBe 동일 line 문자열 + 매 호출 새 summary 객체(build 반환 참조 비동일), (f) **no-mutation**: 입력 results 배열 · 원소가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic EvaluationResult literal 직접 주입).
- [ ] live leg (실 scoring / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / 실 네트워크 / DB 접근 / 실 jest spawn / 실 gh) 복제 0 — results→summary→line 조립 surface 만 검증 (synthetic EvaluationResult literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-result-summary-markdown-assembly.smoke-spec.ts` (T-0748, `buildRealDataResultSummary` → `renderRealDataResultSummaryMarkdown` markdown-본문 side) 의 재검증 — 본 task 는 summary 의 **단일-라인 side** 직접 chain 만 책임 (markdown-본문 side 와 별개 절단면, 중복 · 재검증 0).
- 기존 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740, `buildRealDataResultReportPlan` results→summary→descriptor) / `realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` (T-0741) / outcome-report · publish 계열 smoke — 본 task 는 summary→line 한-줄 렌더 leg 만, 별개 절단면.
- 실 scoring 실행 / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / DB 접근 / 실 gh / 실 jest spawn / 실 네트워크.
- 컴포저 소스(`realdata-e2e-result-summary.ts` / `realdata-e2e-result-summary-line.ts`) / 위임 consistency · format-shape · summary-line-consistency 가드 / EvaluationResult · Difficulty · CONTRIBUTION_LEVELS 정의 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0748 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
