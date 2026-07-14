---
id: T-1010
title: daily-step dual-leg run report issue command-args labels·title 정합 순수 가드 신설 (assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent — createArgs/updateArgs title byte-identical descriptor.title + createArgs.labels 고정-상수 exact match + labels 무공유 불변식, 요약축 T-0651 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 740
estimatedFiles: 2
created: 2026-07-15
sizeExempt: true
exemptReason: "순수 가드 helper + colocated R-112 spec 은 atomic(helper 는 spec 없이 merge 불가 — R-112). 요약축 선례(T-0651) 가드 228 LOC + spec 509 LOC = 737 LOC 를 daily-step 축으로 동형 이식. helper+spec 분리 불가라 T-1008 처럼 atomic sizeExempt. base ~490 × 1.5(R-112 4-카테고리 backbone) ≈ 740 LOC. entity @unique 없음(test helper — P2002 sub-multiplier 무해당)."
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.spec.ts
plannerNote: "P5 §109 test-hardening — daily-step 축 command-args labels·title 정합 가드 신설(요약축 T-0651 mirror, T-1008/T-1009 Follow-up ①). issue-still-relevant pre-check(grep origin/main): daily-step helpers 에 LabelsTitle/labels-title 어휘 0건 확인(genuine gap) + 요약축 T-0651 template(guard 228+spec 509) 박제됨. 대상 빌더 labels 상수(DUAL_LEG_RUN_REPORT_ISSUE_LABELS)·createArgs/updateArgs title 전파 둘 다 main 박제. pr test-only 2파일 신설 file-disjoint dep[] stage5b 병렬."
---

# T-1010 — daily-step command-args labels·title 정합 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** command-args 구조 무결성 가드 사슬의 연속 slice. daily-step 축의 **command-args body 축**(marker-first 전파·searchQuery 정합)은 직전 T-1008(가드 신설)·T-1009(빌더 self-wire)로 요약축과 완전 동형화됐다. 그 두 task 의 Follow-up ① 이 명시한 자연 후속 seam — **labels·title 축** — 을 본 task 가 연다(가드 신설).

daily-step 빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` (`...command-args.ts`)는 `descriptor.title` 을 `createArgs.title`·`updateArgs.title` **양쪽 모두에 그대로 전달**하고, 고정 결정론 상수 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS = ["realdata-e2e", "daily-step-dual-leg-run-report"]` 의 **새 배열 복제**(`[...DUAL_LEG_RUN_REPORT_ISSUE_LABELS]`)를 `createArgs.labels` 로 전달한다. 그러나 이 두 정합 불변식 — ① create/update title 이 둘 다 descriptor.title 과 byte-identical(어느 경로로 박제하든 동일 제목 → 멱등 식별) / ② createArgs.labels 가 고정 상수와 순서·원소·개수까지 정확히 일치하고 상수 자체 참조와 무공유(빌더가 복제) — 은 빌더 본문 주석과 command-args spec happy-path 단언으로만 박제돼 있고 **런타임에서 강제되는 독립 불변식 가드가 부재**하다.

기존 body marker 가드(`assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor`, T-1008)는 **body marker-first 구조와 searchQuery 정합만** 검증한다 — labels·title 축은 닿지 않는다. 본 task 는 그 가드가 미커버하는 두 불변식을 검증하는 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(args, descriptor, expectedLabels)` 를 신설해, 제목이 갈라지거나 label 이 누락·추가·순서변경·무공유 위반된 명령-args 가 gh issue 실배선·rolling 이슈 surface 로 새기 전 fail-fast throw 로 차단한다. 요약축 `assertRealDataResultIssueCommandArgsLabelsTitleConsistent`(T-0651, `realdata-e2e-result-issue-command-args-labels-title.ts`)의 daily-step mirror — 인자·타입만 daily-step 축으로 치환하고 불변식·에러 정책·메시지 포맷을 동형으로 옮긴다. **가드 신설만** — 빌더 산출 직전 self-wire 배선은 후속 slice(요약축 T-0652 mirror).

issue-still-relevant pre-check(origin/main grep): daily-step helpers 에 `LabelsTitle`·`labels-title` 어휘 0건 + `...command-args-labels-title.ts` 파일 부재 확인(`git grep -l -i 'command-args-labels-title|LabelsTitle' origin/main -- 'test/helpers/*daily-step*'` = 0) → genuine gap, 중복 아님. 검증 대상 빌더(`buildRealDataDailyStepDualLegRunReportIssueCommandArgs`) 및 labels 상수·descriptor(`{title, marker, body}`) 둘 다 main 박제됨. 요약축 template(T-0651 guard 228 + spec 509)도 main 박제.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — 검증 대상 빌더. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` (L144~). 산출 shape 인터페이스 `RealDataDailyStepDualLegRunReportIssueCommandArgs {searchQuery; createArgs: {title, body, labels}; updateArgs: {title, body}}`(L114~), `...IssueCreateArgs {title, body, labels}`(L92~), `...IssueUpdateArgs {title, body}`(L102~). 고정 labels 상수 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS: readonly string[] = ["realdata-e2e", "daily-step-dual-leg-run-report"]`(L83~86, **module-private — export 안 함**, 가드는 이 값을 `expectedLabels` 인자로 받음). `createArgs.title = descriptor.title`·`updateArgs.title = descriptor.title`(L155/L161)·`createArgs.labels = [...DUAL_LEG_RUN_REPORT_ISSUE_LABELS]`(L158, 매 호출 새 배열 복제) 전파 확인. **본 task 는 이 파일을 변경하지 않는다** — 출력 타입 `import type` 재사용만(신규 type 0). 빌더 self-wire 도 본 task 범위 밖(Follow-up).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — descriptor 원 정의. `RealDataDailyStepDualLegRunReportIssueDescriptor {title: string; marker: string; body: string}`. 가드의 title 정합 검증 기준(descriptor.title). `import type` only, 본문 변경 0.
- **패턴 선례 (직접 template)**: `test/helpers/realdata-e2e-result-issue-command-args-labels-title.ts`(T-0651, 요약축 — main 박제, 228 LOC) 의 `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args, descriptor, expectedLabels): void`. 불변식 (1) createArgs.title byte-identical descriptor.title / (2) updateArgs.title byte-identical descriptor.title / (3) createArgs.labels 가 expectedLabels 와 순서·원소·개수 exact match(부분집합/초과집합·순서변경·공백/대소문자 drift 거부, trim·case-fold 0) / (4) createArgs.labels !== expectedLabels(무공유). 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast. 내부 helper `assertCommandArgsStructure`·`assertDescriptorStructure`·`assertExpectedLabelsStructure`(3 구조 가드) + main assert 함수 구조. body/searchQuery 검증 0(그 축은 body marker 가드가 cover). 본 가드는 그 daily-step mirror — 인자·타입만 치환하고 불변식·에러 정책·메시지 포맷·JSDoc 톤을 동형으로 옮긴다.
- **패턴 선례 (spec template)**: `test/helpers/realdata-e2e-result-issue-command-args-labels-title.spec.ts`(T-0651, 요약축 — main 박제, 509 LOC) 의 describe 구조(정상 void·각 불변식 위반별 throw·결정성·무공유·빈 labels 경계·부분 일치 거부·공백/대소문자 민감 negative 분기 cover). daily-step 축으로 이식.
- **신규 colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.spec.ts` (가드 옆 colocated — R-112 spec).
- **직전 daily-step 축 선례 (동형 형태 참조만)**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts`(T-1008) — 같은 daily-step 축 command-args 순수 가드의 형태(정상 void·위반 fail-fast throw·한국어 명세형 에러·import type 재사용·runtime cycle 0). **본문 변경 0**(참조만). 본 가드는 그 body 축의 labels·title-side 형제(비중복 분담).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(args: RealDataDailyStepDualLegRunReportIssueCommandArgs, descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor, expectedLabels: readonly string[]): void`. 다음 4 불변식을 검증: (1) `args.createArgs.title` 이 `descriptor.title` 과 byte-identical, (2) `args.updateArgs.title` 이 `descriptor.title` 과 byte-identical, (3) `args.createArgs.labels` 가 `expectedLabels` 와 순서·원소·개수까지 정확히 일치(exact match — 부분집합/초과집합·순서변경·공백/대소문자 drift 거부, trim·case-fold 0), (4) `args.createArgs.labels !== expectedLabels`(무공유 — 빌더가 상수를 복제하지 않고 직접 반환하면 후속 호출 labels mutate 가 상수·다음 호출로 누설). 정합이면 void, 위반 시 throw. 출력 타입·descriptor 타입은 `import type` only(재정의 0). body marker-first / searchQuery 검증 0(그 축은 body marker 가드 T-1008 이 cover — 본 가드는 labels·title 축만, 비중복).
- [ ] **에러 정책 — 구조 결손=TypeError / 값 정합 위반=RangeError 구분**(요약축 T-0651 mirror): (a) `args`/`descriptor`/`expectedLabels` null/undefined, `args.createArgs`/`args.updateArgs` 부재, `createArgs.title`/`updateArgs.title`/`descriptor.title` 비-string, `createArgs.labels`/`expectedLabels` 비-배열 또는 원소 비-string → 한국어 TypeError. (b) 불변식 (1)~(4) 중 하나라도 위반 → 한국어 RangeError(메시지에 어느 불변식·어느 위치가 expected vs actual 로 drift 됐는지 포함). silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 불변식에서 throw). 검사 순서: 구조 → (1) create title → (2) update title → (3) labels 내용 exact match → (4) labels 무공유. 파일 상단 주석에 책임(command-args labels·title 정합 검증)·불변식 목록·에러 정책·순수성·body marker 가드와의 비중복 분담·R-59 raw 미접촉·dependency-free 를 한국어로 박제.
- [ ] **비변형 / 순수**: `args`·`descriptor`·`expectedLabels`(전부 읽기·비교만) mutate 0. 부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0·env/network/credential/gh 실행 0. 동일 입력 → 동일 동작(정합이면 항상 void, drift 면 항상 동일 불변식에서 throw). 같은 디렉토리 타입 import 라 runtime cycle 0.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title.spec.ts` 신설 — R-112 4종:
  - **Happy-path 1+**: 실제 빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` 산출 args + 원 descriptor + 올바른 expectedLabels(빌더 상수와 동일 내용의 별도 배열)를 가드에 넘기면 throw 0(void). 빌더 실제 산출물이 가드를 round-trip 으로 통과함 확인. gitSha/dateToken/leg status 다양성으로 descriptor 여러 조합 1+.
  - **Error path 1+**: 각 불변식을 하나씩 깬 손상 args 를 가드에 넘기면 RangeError — (1) createArgs.title 변조, (2) updateArgs.title 변조, (3) createArgs.labels 원소 불일치(누락/추가) 및 순서변경, (4) createArgs.labels 를 expectedLabels 와 동일 참조로 전달(무공유 위반) 각 1+. 메시지에 해당 불변식·expected·actual 노출 검증.
  - **Flow/branch cover**: 구조 결손 분기(TypeError: `args` null / `descriptor` null / `expectedLabels` null / `createArgs` 부재 / `updateArgs` 부재 / `createArgs.title` 비-string / `updateArgs.title` 비-string / `createArgs.labels` 비-배열 / `descriptor.title` 비-string / `expectedLabels` 비-배열 / `expectedLabels` 원소 비-string)와 값 정합 위반 분기(RangeError: 불변식 (1)~(4) 각각, labels 개수 불일치 분기와 원소 불일치 분기 분리) 각 1+ test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 불변식 (1)~(4) 각 위반 → RangeError(각 1+), (b) `args`/`descriptor`/`expectedLabels` null/undefined → TypeError(각 1+), (c) `args.createArgs`/`args.updateArgs` 부재 또는 title/labels 필드 type 위반(예: title 숫자, labels 문자열) → TypeError(각 1+), (d) **빈 labels 경계** — expectedLabels 가 빈 배열이고 createArgs.labels 도 빈 배열이면 void, createArgs.labels 가 비지 않으면 throw, (e) **부분 일치 거부** — createArgs.labels 가 expectedLabels 의 진부분집합/초과집합이면 throw(정확 일치만 통과), (f) **공백·대소문자 민감** — label 문자열은 byte-identical 비교(trim·case-fold 0) 검증, (g) 동일 입력 두 번 호출 deterministic(같은 결과), (h) 입력 비변형(`args`/`descriptor`/`expectedLabels` mutate 0, 호출 전후 deep-equal) 각 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0 assert(R-59).
- [ ] `src/` 무변경(test helper 단독 — 빌더·descriptor 타입 import 재사용만). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%). 신규 가드 파일 line/branch/function 100% 목표. 전체 unit suite green(기존 빌더·descriptor·body marker 가드 helper spec 무회귀).

## Out of Scope

- **가드의 빌더 self-wire 배선** — 본 task 는 가드 신설만. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 산출 직전 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 를 expectedLabels 로 넘겨 self-assert 하는 배선은 별도 후속 slice(요약축 T-0652 mirror, Follow-up ①).
- 빌더(command-args) 또는 descriptor 본문·시그니처·labels 상수·에러 메시지 수정 0 — 본 task 는 가드 **신설만**, 빌더·descriptor 는 산출물 그대로 사용(출력 타입 import 재사용만).
- body marker-first / searchQuery 정합 검증 — 그 축은 body marker 가드(T-1008)가 이미 cover. 본 가드는 labels·title 축만(비중복 분담).
- 다른 realdata-e2e seam(publish-plan·search-hit-shape·search-json-fields 등)의 추가 가드 또는 mirror — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / `gh issue create`/`edit`/`search` 실 실행 · 실 이슈 박제(step ④ live wiring — credential 게이트). 본 가드는 build-time 순수 검증만.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).
- 자동 복구·정규화·기본값 채움·label 자동 보정·title 자동 교정·silent 수선 — 가드는 위반 검출 시 fail-fast throw 만.
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지. JSON schema / zod·ajv 도입 0(순수 string·배열 비교만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 task 닫히면 daily-step command-args 의 labels·title 정합 불변식이 순수 가드로 박힌다 — body marker 가드(T-1008)와 함께 command-args 구조 무결성의 두 축 완결, 요약축 T-0649/T-0651 두 축 완결의 daily-step mirror.) 예상 후속 ①: 본 가드를 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 산출 직전 self-wire 배선(`DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 를 expectedLabels 로 self-assert — 요약축 T-0652 mirror, 기존 body marker 가드 self-wire 옆에 나란히). ②: §109 잔여 미미러 seam(publish-plan·search-hit-shape·search-json-fields) mirror. ③: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.
