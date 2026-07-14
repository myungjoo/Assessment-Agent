---
id: T-0995
title: daily-step dual-leg run report issue-action leaf resolver 에 sibling -consistency drift-guard 신설 (resolveRealDataDailyStepDualLegRunReportIssueAction 산출 action 을 (searchHits, marker) single-source 독립 재유도 대조)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-07-14
independentStream: realdata-e2e-daily-report-issue-gh-command-plan
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — issue-gh-command-plan consistency(T-0994) 완결 뒤 T-0994 Follow-ups 잔여 consistency-미봉 sibling 1순위(-issue-action) 봉합. 요약축 선례 T-0703(assertRealDataResultIssueActionConsistentWithInputs) mirror — leaf resolver 라 로직 독립 재유도(재호출 0). producer 무변경. pr-mode test-only 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0995 — daily-step dual-leg run report issue-action leaf resolver sibling consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈의 `gh search issues` 응답(hits) + 멱등 marker 를 입력받아 create-or-update 분기를 결정하는 **leaf resolver** `resolveRealDataDailyStepDualLegRunReportIssueAction`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts`, T-0898)에는 **sibling 관례인 `-consistency` drift-guard 짝이 없다**. issue-gh-command-plan 종단 컴포저는 방금 consistency(T-0994, PR #888 squash 3930ab80)가 완결됐고, T-0994 Follow-ups 가 명시한 잔여 consistency-미봉 sibling 목록(`-issue-action` / `-issue-search-argv` / `-issue-outcome-parse-shape`)의 **1순위** `-issue-action` 을 본 task 가 봉한다.

이 resolver 는 (1) marker 빈/공백 guard + 각 hit.number 양의 정수 guard, (2) body 가 marker 를 부분 문자열로 포함하는 후보 추출, (3) 후보 0건 → `{action:'create'}` / 1+건 → `{action:'update', issueNumber: 최소 number}`(가장 오래된 이슈, 멱등 회귀 보호)의 분기를 순수 함수로 닫는다. 문제는 이 후보 필터링·최소 선택·create/update 경계가 오직 자기 colocated spec 이 커버할 때만 검증된다는 점이다. 누군가 로직을 편집(예: 최소 대신 최대 issueNumber 선택, `body.includes` 후보 판정 기준 변경, create↔update 경계 오류, number guard 완화)하면서 spec 을 함께 고치지 않으면, 손상 action 이 step ④ live wiring 으로 새어나가 잘못된 이슈에 갱신하거나 중복 이슈를 생성할 수 있다.

본 task 는 요약축 선례 T-0703(`assertRealDataResultIssueActionConsistentWithInputs`, `realdata-e2e-result-issue-action-consistency.ts`)와 정확히 동형으로, 입력 `(searchHits, marker)` 를 single-source 로 삼아 **후보 추출·최소 선택·create/update 분기를 가드 안에서 독립 재구현**(컴포저 재호출 0 — 재호출은 동일 로직 drift 를 양방향 상쇄해 잡지 못함)해 expected action 을 재유도하고, resolver 가 산출한 `action`(분기 종류 create/update + update issueNumber deep equal)을 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs` + colocated R-112 spec 을 신설한다. 이 helper 는 delegate 위임이 없는 **leaf resolver** 이므로, gh-command-plan 종단 컴포저(T-0994, 위임 helper 재호출)와 달리 로직을 의도적으로 재구현한다(재유도가 핵심). marker/number input guard 도 동형으로 재실행해 컴포저와 같은 위반을 같은 throw 로 전파한다.

이는 T-0988(issue-descriptor consistency)·T-0990(issue-command-args consistency)·T-0992(issue-gh-argv consistency)·T-0994(issue-gh-command-plan consistency) 패턴의 action-leg mirror 이자, 요약축의 T-0703 을 daily-step 축으로 옮긴 판이다. **producer(T-0898) 본문은 무변경** — self-wire(resolver 반환 직전 자가 호출)는 후속 slice 로 분리한다. 가드는 resolver(T-0898)를 import 하지 않고(oracle 독립성 — 로직 재구현) hit/action 타입만 `import type` 로 참조하므로, 나중에 producer 에 value import 로 배선돼도 런타임 순환 의존이 생기지 않는다. producer(T-0898)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` (T-0898) — 대조 대상 leaf resolver. `resolveRealDataDailyStepDualLegRunReportIssueAction(searchHits: RealDataDailyStepDualLegRunReportIssueSearchHit[], marker: string): RealDataDailyStepDualLegRunReportIssueAction`. marker 빈/공백 guard + hit.number 양의 정수 guard 후 `body.includes(marker)` 후보 추출 → 0건 `{action:'create'}` / 1+건 `{action:'update', issueNumber: Math.min(...후보 number)}`. 출력 타입 `RealDataDailyStepDualLegRunReportIssueAction = {action:'create'} | {action:'update'; issueNumber:number}`, 입력 타입 `RealDataDailyStepDualLegRunReportIssueSearchHit = {number, title, body}`. **가드는 이 파일을 import 하지 않는다** — 로직을 독립 재구현한다(타입만 `import type`).
- `test/helpers/realdata-e2e-result-issue-action-consistency.ts` (T-0703, 요약축 선례 — main 박제) — **신설 가드의 직접 형태 선례**. `assertRealDataResultIssueActionConsistentWithInputs(action, searchHits, marker): void` 의 재유도 방식(`deriveExpectedAction` 이 후보 추출·`Math.min`·create/update 분기를 컴포저 재호출 없이 재구현), 구조 검증(`assertActionStructure` / `assertSearchHitsStructure` / marker string 검사 = TypeError), 값 정합 위반 RangeError(deep-equal byte-identical 비교, 기대 vs 실측 노출), input guard 동형 전파(marker 빈/공백·hit number 비-양정수 = Error), `describe`/`deepEqual` 헬퍼, 한국어 JSDoc·책임 경계 주석 스타일을 그대로 daily-step 축으로 옮긴다.
- `test/helpers/realdata-e2e-result-issue-action-consistency.spec.ts` (T-0703 spec — main 박제) — 신설 consistency spec 의 R-112 배치(happy round-trip / 구조 결손 TypeError / create·update 분기 cover / drift mutant RangeError negative) 관례 참고.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.spec.ts` (T-0898) — producer 기존 spec. fixture(searchHits + marker) 구성 형태·happy/error/negative 배치 관례를 참고(가드 spec 은 별도 colocated 파일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs(action, searchHits, marker): void` export. 입력 `(searchHits, marker)` 로 **후보 추출(`body.includes(marker)`)·최소 number 선택(`Math.min`)·create/update 분기를 가드 안에서 독립 재구현**해 expected action 을 single-source 재유도한 뒤, 입력 `action` ↔ expected(분기 종류 create/update 일치 + update 시 issueNumber deep equal byte-identical)을 대조. **로직 재구현(컴포저 재호출 0)**. **resolver producer(T-0898) 를 import 하지 않는다**(재호출 금지 — 양방향 drift 상쇄 방지). hit/action 타입은 `import type` 재사용만.
- [ ] 에러 정책 — 구조 결손(action null/undefined·비객체·배열; action.action `'create'`/`'update'` 외 값; update 인데 issueNumber 부재·비-number·비-양정수; searchHits 비-배열·원소 비객체·hit.number 비-number·hit.body 비-string; marker 비-string) = 한국어 `TypeError`(재유도 자체 불가 또는 구조 결손). 값 정합 위반(create↔update 분기 오매핑, update issueNumber 재유도 최소값과 불일치, 후보 다수 시 최소 아닌 값) = 한국어 `RangeError`(기대 vs 실측 JSON 노출, drift 식별). marker 빈/공백·hit.number 0/음수/비정수 등 컴포저 input guard 동형 위반은 재유도 단계에서 동일 `Error` 로 전파(가드 자체 try/catch 0). silent 통과(위반인데 정상 void) 0, fail-fast(가장 먼저 위반한 지점에서 throw). 검사 순서 = 구조(action → searchHits → marker) → 재유도(input guard 포함) → deep-equal 대조.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action-consistency.spec.ts` 신설 — R-112 4종 커버(colocated):
  - **Happy-path**: 정합 `(searchHits, marker)` → producer(T-0898) 실제 호출로 얻은 action 을 가드가 throw 0 으로 통과시킴을 assert 1+(oracle ↔ producer 로직 일치 증명하는 round-trip case). create 분기(후보 0건: hits `[]` / marker 미포함 hits)·update 분기(후보 1건, 후보 다수 → 최소 number) 각각.
  - **Error path**: 구조 결손 각 유형(action null·비객체, action.action 분기값 오류, update issueNumber 부재·비-number, searchHits 비-배열·hit.number 비-number·hit.body 비-string, marker 비-string) 이 각각 `TypeError` 를 던짐 1+.
  - **Flow/branch cover**: create 분기(후보 0건 → `{action:'create'}`)·update 분기(후보 1+건 → `{action:'update', issueNumber}`) 각각에 대해 정합 통과 + drift throw 를 각 1+ 로 분리 검증. 두 분기 모두 커버.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: drift mutant 각각이 `RangeError`(또는 input guard 동형 위반 시 `Error`)를 던짐 — (a) action 을 create↔update 로 오매핑, (b) update action.issueNumber 를 재유도 최소값과 다른 값으로 변조, (c) 후보 다수 시 최소 아닌(예: 최대) issueNumber, (d) 후보 0건인데 update, (e) 후보 1+건인데 create. 추가 input guard 동형 위반: (f) marker 빈/공백-only → `Error`, (g) hit.number 0/음수/비정수 → `Error`. 각 mutant 독립 case. 가드가 action·searchHits·marker 입력을 mutate 하지 않음(비변형) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 action·hits·marker 구조만 재유도) assert.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts`(T-0898) 본문 수정 0 — 신설 가드는 별도 파일. producer self-wire 배선은 후속 slice(본 task 범위 밖).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer resolver `resolveRealDataDailyStepDualLegRunReportIssueAction`(T-0898) 반환 직전 가드 self-wire 배선 0 — 후속 slice. 본 task 는 consistency 가드 **신설**만.
- issue-gh-command-plan leg(T-0902/T-0994) · issue-gh-argv leg(T-0899/T-0992/T-0993) · issue-command-args leg(T-0897/T-0990/T-0991) · issue-descriptor leg(T-0896/T-0988/T-0989) 의 재수정 0 — 이미 삼단/짝 완결.
- 잔여 consistency-미봉 sibling(`-issue-search-argv` / `-issue-outcome-parse-shape`) 의 consistency/self-wire 신설 0 — 별도 순차 slice.
- gh search response 의 실 JSON 파싱 / `--json` 옵션 합성 재현 0 — 가드는 caller 가 `JSON.parse` 해 넘긴 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 구조만 다룬다.
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh issue create/edit/search 실 호출 wiring 0(운영/env 층 §5 게이트).
- 자동 복구/재유도/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드 신설 후 후속 slice: producer `resolveRealDataDailyStepDualLegRunReportIssueAction`(T-0898) 반환 직전 `assertRealDataDailyStepDualLegRunReportIssueActionConsistentWithInputs` self-wire — 배선으로 issue-action leaf 도 producer→consistency→self-wire 삼단 완결.
- daily-report issue-박제 vein 잔여(consistency 미봉 sibling, 순차 mirror 후보): `-issue-search-argv` / `-issue-outcome-parse-shape`.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제하도록 재배선.
