---
id: T-0751
title: realdata-e2e summary→descriptor title·marker run-token identity-confluence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step③→④ descriptor identity-side(title·marker 공유 run-token confluence) 조립 smoke. T-0750 body 3-블록 confluence 의 title·marker 짝. issue-still-relevant: title↔marker run-token threading·summary-independence 단언 grep 0 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-summary-descriptor-identity-confluence-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-summary-descriptor-identity-confluence-assembly.smoke-spec.ts]
---

# T-0751 — realdata-e2e summary→descriptor title·marker run-token identity-confluence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step③→④ 경계의 결과 이슈 descriptor 합성** 종단 컴포저 `buildRealDataResultIssueDescriptor(summary, run)` (T-0582) 는 `RealDataResultSummary`(집계) 와 `RealDataResultIssueRunRef`(`{gitSha, dateToken}`) 를 받아 `RealDataResultIssueDescriptor`(`{title, marker, body}`) 3 필드를 합성한다. 이 descriptor 는 **두 개의 독립 confluence 축**을 가진다:

1. **body-side confluence** — `body = [marker, '', formatRealDataResultSummaryLine(summary), '', renderRealDataResultSummaryMarkdown(summary)].join('\n')`. 이 3-블록 합류는 **T-0750** 이 직접-체인 smoke 로 박제 완결했다 (한 줄 블록↔직접 line renderer·markdown 블록↔직접 markdown renderer byte-identical·블록 순서/구분 무결성).
2. **identity-side confluence** — `title = ${ISSUE_TITLE_PREFIX} ${token}` 와 `marker = ${ISSUE_MARKER_PREFIX} ${token} -->` 가 **동일한 `runToken(run) = ${run.dateToken}@${run.gitSha}` 단일 source** 로부터 서로 다른 고정 prefix 로 합성된다. title 과 marker 는 **summary 무관**(동일 run + 다른 summary → 동일 title·marker, body 만 변함) 이며, 멱등 search-or-update 의 기반(동일 run → 동일 marker → 같은 이슈 갱신, 서로 다른 run → 다른 marker → 다른 이슈)이다.

그러나 이 **identity-side(title·marker 공유 run-token) confluence 를 직접-체인으로 묶은 non-gated build-time smoke 는 부재**다. T-0750 의 confluence smoke 는 `descriptor.body` 의 3-블록(marker 라인 포함)만 검증할 뿐, **title 과 marker 가 같은 `dateToken@gitSha` 토큰을 공유**한다는 단언·**title·marker 의 summary-독립성**·**run-identifier 단일 source threading(서로 다른 run → 서로 다른 title·marker, 동일 run → 동일)** 은 0 이다 (`git grep` 으로 `descriptor.title.*toContain` / `runToken` / title↔marker run-token threading 단언이 test/smoke/ 에 부재 확인 — T-0750 happy-path 도 title 미접촉, command-plan/report-plan smoke 는 title/marker non-empty 만 단언).

즉 run-token drift(title 은 token 을 담는데 marker 는 다른 token·prefix 변형으로 둘이 어긋남)·summary-누출(title·marker 가 summary 에 의존해 멱등 marker 가 흔들림)·run 분리 실패(서로 다른 run 인데 동일 marker 산출 → 다른 run 의 이슈를 잘못 갱신)·동일-run 멱등 실패(동일 run 인데 호출마다 다른 marker) 회귀는 public CI 에서 직접 발화되지 않고, descriptor 컴포저 unit/identity-consistency 가드 또는 step④ live gh-gated search-or-update runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — body-side(T-0750) 와 대칭인 **identity-side 직접-체인 smoke** 로, `EvaluationResult[]`→summary→descriptor 종단 조립에서 **title·marker 가 동일 run-token 단일 source 로부터 합류**하고 **summary 무관·run 별 멱등**임을 public CI 그물로 박제해, descriptor 의 두 confluence 축(body·identity)을 모두 직접-체인으로 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — 종단 컴포저 `buildRealDataResultIssueDescriptor(summary, run)` → `RealDataResultIssueDescriptor`(`{title, marker, body}`). `runToken(run) = ${dateToken}@${gitSha}` 단일 source·`title = ${ISSUE_TITLE_PREFIX} ${token}`·`marker = ${ISSUE_MARKER_PREFIX} ${token} -->`·gitSha/dateToken 빈/공백 throw guard·`RealDataResultIssueRunRef`(`{gitSha, dateToken}`)·`RealDataResultIssueDescriptor` interface 정의. **ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 는 private const(export 0)** — smoke 는 literal prefix 가 아니라 **구조적 단언**(둘 다 `dateToken@gitSha` 토큰 포함·서로 다른 prefix·summary-독립) 으로 박제할 것
- `test/helpers/realdata-e2e-result-summary.ts` — `buildRealDataResultSummary(results)` → `RealDataResultSummary`. summary 가 title·marker 에 무영향임을 보이려면 동일 run + 서로 다른 summary 가 필요하므로 다른 results 로 다른 summary 구성용
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` interface(`{narrative, difficulty, contribution, volume}`) + `CONTRIBUTION_LEVELS`. synthetic EvaluationResult literal 구성용
- `src/llm/difficulty.ts` — `DIFFICULTIES` value + `Difficulty` type. synthetic literal 의 difficulty 슬롯 참고
- `test/smoke/realdata-e2e-summary-descriptor-body-confluence-assembly.smoke-spec.ts` — body-side 대칭 sibling smoke(T-0750). non-gated describe·synthetic EvaluationResult literal·`assembleViaChain`·validRun fixture·빈/단일/다수 results flow·결정론·무공유·no-mutation·run 결손 guard 전파·raw 누출 0 패턴의 mirror 템플릿
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-summary-descriptor-identity-confluence-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper·spec 수정 0).
- [ ] **Happy-path test** — synthetic `EvaluationResult[]` literal + 유효 `run`(`{gitSha, dateToken}` non-blank) → `buildRealDataResultSummary(results)` → `buildRealDataResultIssueDescriptor(summary, run)` 종단 chain 을 한 번에 실행. (a) `descriptor.title`·`descriptor.marker` 가 string·non-empty 이고 둘 다 합성 run-token `${run.dateToken}@${run.gitSha}` 를 `toContain` 1+ test. (b) `descriptor.title !== descriptor.marker`(서로 다른 prefix·서로 다른 문자열) 이면서 동일 token 공유(공유 substring `${run.dateToken}@${run.gitSha}` 가 양쪽에 등장) 1+ test. (c) `descriptor.marker` 가 `descriptor.body` 첫 줄로 정확히 1 회 등장(identity↔body 정합, T-0750 과 비중복인 marker-위치 단언은 생략 가능하나 marker round-token 정합 확인) 1+ test.
- [ ] **identity-confluence 단일 source 단언** — 동일 `run` 으로 title·marker 가 **`runToken` 단일 source 로부터 합류**: title 에서 공유 token 을 잘라낸 나머지(고정 title prefix)와 marker 에서 공유 token 을 잘라낸 나머지(고정 marker prefix·`-->` suffix)가 호출 간 불변(결정론적 고정 prefix) + 양쪽이 동일 `${run.dateToken}@${run.gitSha}` substring 을 thread 함을 단언 1+ test. (literal prefix 하드코딩 대신 `title.split(token)` / `marker.split(token)` 으로 token 경계를 구조적으로 검증.)
- [ ] **summary-독립성 단언 (핵심)** — **동일 run + 서로 다른 summary**(서로 다른 results 로 빌드): `buildRealDataResultIssueDescriptor(buildRealDataResultSummary(resultsA), run).title` === `...(resultsB), run).title` 이고 `.marker` 도 동일(title·marker 는 summary 무관·run 만의 함수) 1+ test. 같은 두 호출의 `.body` 는 **달라야** 함(summary 가 body 에는 반영 — title/marker 와 body 의 의존 분리 단언) 1+ test.
- [ ] **run-별 멱등·분리 단언** — (a) **동일 run 두 번**(summary 무관) → `.title`·`.marker` byte-identical(멱등 search-or-update 토큰 안정) 1+ test. (b) **서로 다른 run**(다른 gitSha 또는 다른 dateToken) → `.title`·`.marker` 서로 다름(다른 run 의 이슈를 잘못 갱신하지 않음 — 분리 보장) 1+ test. gitSha 만 다른 경우·dateToken 만 다른 경우 분기마다 분리.
- [ ] **Error/negative path test** — (a) `run.gitSha` 빈 문자열/공백-only → descriptor 합성 단계 gitSha guard throw 가 조립 경로로 그대로 전파(자체 try/catch 없이 `expect(() => assembleViaChain(...)).toThrow`) 1+ test. (b) `run.dateToken` 빈 문자열/공백-only → dateToken guard throw 전파(gitSha 유효해도 — 필드별 분기) 1+ test. (c) 두 guard 가 **각 필드 독립 분기**임을 별개 test 로 분리(단일 negative 금지).
- [ ] **Flow / branch coverage** — (a) raw 본문/narrative 누출 0: synthetic `EvaluationResult.narrative` 에 sentinel 문자열을 넣고 `descriptor.title`·`descriptor.marker` 에 sentinel 미등장(title·marker 는 run-token 만, narrative 무관 — R-59/REQ-059 정합) 1+ test. (b) 빈 results → 빈-summary 여도 title·marker 정상 합성(run 만으로 도출, summary 무관) 1+ test. (c) 다수 results(분포 다양) → 동일 run 이면 title·marker 불변(분포 무관) 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) gitSha 빈/공백 throw, (b) dateToken 빈/공백 throw, (c) 서로 다른 run → 서로 다른 marker(분리), (d) summary-누출 0(동일 run·다른 summary → 동일 title·marker), (e) raw narrative 누출 0(sentinel 미등장), (f) **결정론·무공유**: 동일 (results, run) 두 번 chain 호출 시 title·marker byte-identical + 매 호출 새 descriptor 객체(반환 참조 비동일), (g) **no-mutation**: 입력 results 배열·원소·run 객체가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic EvaluationResult literal + run literal 직접 주입).
- [ ] live leg (실 scoring / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / 실 네트워크 / DB 접근 / 실 git sha·timestamp 읽기 / 실 jest spawn / 실 gh) 복제 0 — results→summary→descriptor identity-side 조립 surface 만 검증 (synthetic literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-summary-descriptor-body-confluence-assembly.smoke-spec.ts` (T-0750, descriptor.body 3-블록 confluence) 의 재검증 — 본 task 는 descriptor 의 **title·marker identity-side(run-token confluence)** 만 책임 (body-side 와 별개 절단면, body 블록 byte-identical 단언 중복 0).
- 기존 `realdata-e2e-result-summary-markdown-assembly.smoke-spec.ts` (T-0748) / `realdata-e2e-result-summary-line-assembly.smoke-spec.ts` (T-0749) / `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740) / command-plan·gh-command-plan·publish 계열 smoke — 본 task 는 title·marker run-token threading 만, 별개 절단면.
- 실 scoring 실행 / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / DB 접근 / 실 gh / 실 git sha·timestamp 읽기 / 실 jest spawn / 실 네트워크.
- 컴포저 소스(`realdata-e2e-result-issue-descriptor.ts` / `realdata-e2e-result-summary.ts`) / identity-consistency·body-consistency 가드 / EvaluationResult·Difficulty·CONTRIBUTION_LEVELS 정의 수정 — test-only (신규 smoke spec 1 파일).
- `ISSUE_TITLE_PREFIX` / `ISSUE_MARKER_PREFIX` 를 export 로 바꾸거나 import 해 literal 비교 — private const 유지, smoke 는 구조적(token 경계 split) 단언만.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0750 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
