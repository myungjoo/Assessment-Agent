---
id: T-1008
title: daily-step dual-leg run report issue command-args body marker-first 정합 순수 가드 신설 (assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor — createArgs.body/updateArgs.body byte-identical + marker-first + searchQuery=marker 불변식, 요약축 T-0649 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 660
estimatedFiles: 2
created: 2026-07-15
sizeExempt: true
exemptReason: "순수 가드 helper + colocated R-112 spec 은 atomic(helper 는 spec 없이 merge 불가 — R-112). 요약축 선례(T-0649) 가드 202 LOC + spec 471 LOC = 673 LOC 를 daily-step 축으로 동형 이식. helper+spec 분리 불가라 T-1003/T-1005 처럼 atomic sizeExempt. base ~440 × 1.5(R-112 4-카테고리 backbone) ≈ 660 LOC."
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.spec.ts
plannerNote: "P5 §109 test-hardening — daily-step 축 command-args body marker-first 정합 가드 신설(요약축 T-0649 mirror). issue-still-relevant pre-check(grep origin/main): daily-step helpers 에 CommandArgsBodyPreservesDescriptor/command-args-body-marker 0건 확인 → genuine gap, 중복 아님. 대상 빌더(command-args)·descriptor(marker/body) 둘 다 main 박제됨. pr test-only 2파일 신설 file-disjoint dep[] stage5b 병렬."
---

# T-1008 — daily-step command-args body marker-first 정합 순수 가드 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time 정합 가드 사슬의 연속 slice. daily-step 축의 **outcome-report 계열**(base T-1000 → summary-line/output/from-output consistency + self-wire T-1001~T-1007)은 이제 요약축과 완전 동형화됐다. 남은 미미러 seam 중 첫 슬라이스로 **command-args 구조 무결성** 축을 닫는다.

daily-step 축은 이미 명령-args 빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `{searchQuery, createArgs:{title, body, labels}, updateArgs:{title, body}}` (`...issue-command-args.ts`)를 갖는다. 이 빌더는 `descriptor.body`(marker 라인 + markdown 본문)를 `createArgs.body`·`updateArgs.body` **양쪽 모두에 그대로 전달**하고, `descriptor.marker` 를 `searchQuery` 로 전달한다 — create 든 update 든 marker 라인이 양 경로에 보존돼야 gh issue search-or-update 멱등성이 성립한다. 그러나 이 멱등 정합 불변식은 빌더 본문 주석과 command-args spec happy-path 단언으로만 박제돼 있고 **런타임에서 강제되는 독립 불변식 가드가 부재**하다.

본 task 는 그 빈칸을 채우는 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` 를 신설해, 부정합 명령-args 가 gh issue 실배선·rolling 이슈 surface 로 새기 전 fail-fast throw 로 차단한다. 요약축 `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`(T-0649, `realdata-e2e-result-issue-command-args-body-marker.ts`)의 daily-step mirror — descriptor.body/marker 를 single-source 로 삼아 body 전파·marker-first·searchQuery 정합만 검증한다(summary 재유도 0). **가드신설만** — 빌더 산출 직전 self-wire 배선은 후속 slice(요약축 계열).

issue-still-relevant pre-check(origin/main grep): daily-step helpers 에 `CommandArgsBodyPreservesDescriptor` 어휘 0건 + `...command-args-body-marker.ts` 파일 부재 확인(`git grep -l -i 'CommandArgsBodyPreservesDescriptor|command-args-body-marker' origin/main -- 'test/helpers/*daily-step*'` = 0) → genuine gap, 중복 아님. 검증 대상 빌더(`buildRealDataDailyStepDualLegRunReportIssueCommandArgs`) 및 descriptor(`{title, marker, body}`) 둘 다 main 박제됨.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — 검증 대상 빌더. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor): RealDataDailyStepDualLegRunReportIssueCommandArgs`. 산출 shape 인터페이스 `RealDataDailyStepDualLegRunReportIssueCommandArgs {searchQuery: string; createArgs: {title, body, labels}; updateArgs: {title, body}}`(L113~), `...IssueCreateArgs`(L91~), `...IssueUpdateArgs`(L101~). `searchQuery = descriptor.marker`, `createArgs.body = descriptor.body`, `updateArgs.body = descriptor.body` 전파 확인(L151~161). `import type` only 로 command-args 타입 소비(재정의 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — descriptor 원 정의. `RealDataDailyStepDualLegRunReportIssueDescriptor {title: string; marker: string; body: string}`(L99~102). **body 구조**: marker 라인 + `renderRealDataDailyStepDualLegRunReportMarkdown(report)` 본문, 두 블록은 빈 줄 1개로 구분(L95~97) → **body 의 첫 라인이 곧 marker(marker-first)**. single-source. `import type` only.
- **패턴 선례 (직접 template)**: `test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts`(T-0649, 요약축 — main 박제, 202 LOC) 의 `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor): void`. 불변식 (1) createArgs.body byte-identical descriptor.body / (2) updateArgs.body byte-identical descriptor.body / (3) 두 body 의 첫 라인 === descriptor.marker(marker-first) / (4) searchQuery byte-identical descriptor.marker. 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast. summary import 0(descriptor-only). 본 가드는 그 daily-step mirror — 인자·타입만 daily-step 축으로 치환하고 불변식·에러 정책·메시지 포맷을 동형으로 옮긴다.
- `docs/tasks/T-0649-realdata-result-command-args-body-marker-guard.md`(존재 시) 또는 요약축 가드 파일 상단 주석 — 재유도 재구현 0·에러 정책·순수성 acceptance 형태의 직접 참조.
- **신규 colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.spec.ts` (가드 옆 colocated — R-112 spec). 요약축 선례 spec `realdata-e2e-result-issue-command-args-body-marker.spec.ts`(471 LOC) 의 describe 구조를 daily-step 축으로 이식.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(args: RealDataDailyStepDualLegRunReportIssueCommandArgs, descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor): void`. 다음 4 불변식을 검증: (1) `args.createArgs.body` 가 `descriptor.body` 와 byte-identical, (2) `args.updateArgs.body` 가 `descriptor.body` 와 byte-identical, (3) `args.createArgs.body`·`args.updateArgs.body` 의 첫 라인이 `descriptor.marker`(marker-first), (4) `args.searchQuery` 가 `descriptor.marker` 와 byte-identical. 정합이면 void, 위반 시 throw. 두 타입은 `import type` only(재정의 0). `RealDataDailyStepDualLegRunReport`·summary·markdown 렌더러 import 0(descriptor-only — full body 재유도는 descriptor 단계 책임, 본 가드는 명령-args 전파·marker-first·searchQuery 정합만).
- [ ] **에러 정책 — 구조 결손=TypeError / 값 정합 위반=RangeError 구분**(요약축 T-0649 mirror): (a) `args`/`descriptor` null/undefined, `args.createArgs`/`args.updateArgs` 부재, `createArgs.body`/`updateArgs.body`/`searchQuery`/`descriptor.body`/`descriptor.marker` 비-string → 한국어 TypeError. (b) 불변식 (1)~(4) 중 하나라도 위반 → 한국어 RangeError(메시지에 어느 불변식·어느 위치가 expected vs actual 로 drift 됐는지 포함). silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 불변식에서 throw). 파일 상단 주석에 책임(command-args body 멱등 정합 검증)·불변식 목록·에러 정책·순수성·descriptor-only(summary 미import)·dependency-free 를 한국어로 박제.
- [ ] **비변형 / 순수**: `args`(읽기·비교만)·`descriptor`(읽기·비교만) mutate 0. 부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0·env/network/credential/gh 실행 0. 동일 입력 → 동일 동작(정합이면 항상 void, drift 면 항상 동일 불변식에서 throw). 내부 생성 객체(있으면)는 전부 새 참조.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.spec.ts` 신설 — R-112 4종:
  - **Happy-path 1+**: 실제 빌더 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` 산출 args + 원 descriptor 를 가드에 넘기면 throw 0(void). 빌더 실제 산출물이 가드를 round-trip 으로 통과함 확인. gitSha/dateToken/leg status 다양성으로 descriptor 여러 조합 1+.
  - **Error path 1+**: 각 불변식을 하나씩 깬 손상 args 를 가드에 넘기면 RangeError — (1) createArgs.body 변조, (2) updateArgs.body 변조, (3) body 첫 라인이 marker 아니게 변조(marker-first 위반), (4) searchQuery 를 marker 와 다르게 변조 각 1+. 메시지에 해당 불변식·expected·actual 노출 검증.
  - **Flow/branch cover**: 구조 결손 분기(TypeError: `args` null / `descriptor` null / `createArgs` 부재 / `updateArgs` 부재 / `searchQuery` 비-string / `descriptor.body` 비-string / `descriptor.marker` 비-string)와 값 정합 위반 분기(RangeError: 불변식 (1)~(4) 각각) 각 1+ test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 불변식 (1)~(4) 각 위반 → RangeError(각 1+), (b) `args`/`descriptor` null/undefined → TypeError(각 1+), (c) `args.createArgs`/`args.updateArgs` 부재 또는 body/searchQuery 필드 type 위반(예: body 숫자, searchQuery null) → TypeError(각 1+), (d) 정상 정합 → throw 0, (e) 동일 입력 두 번 호출 deterministic(같은 결과), (f) 입력 비변형(`args`/`descriptor` mutate 0, 호출 전후 deep-equal) 각 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0 assert.
- [ ] `src/` 무변경(test helper 단독 — 빌더·descriptor 타입 import 재사용만). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%). 신규 가드 파일 line/branch/function 100% 목표. 전체 unit suite green(기존 빌더·descriptor helper spec 무회귀).

## Out of Scope

- **가드의 빌더 self-wire 배선** — 본 task 는 가드신설만. `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 산출 직전 self-assert 배선은 별도 후속 slice(요약축 계열, Follow-up ①).
- 빌더(command-args) 또는 descriptor 본문·시그니처·에러 메시지 수정 0 — 본 task 는 가드 **신설만**, 빌더·descriptor 는 산출물 그대로 사용.
- descriptor.body 3-블록(marker → markdown) full 재유도 — descriptor 단계 책임. 본 가드는 명령-args 전파·marker-first·searchQuery 정합만(summary/markdown 렌더러 미import).
- **labels·title 축 정합 가드**(요약축 T-0651 `...command-args-labels-title.ts` mirror) — 별도 후속 slice. 본 task 는 body 축만.
- 다른 realdata-e2e seam(publish-plan·search-hit-shape·search-json-fields 등)의 추가 가드 또는 mirror — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit·박제(step ④ live wiring — credential 게이트). 본 가드는 build-time 순수 검증만.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: 본 가드를 `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 산출 직전 self-wire 배선(요약축 producer self-wire mirror). ②: labels·title 축 정합 가드 신설(요약축 T-0651 mirror — title 3자 정합·labels 고정-상수 정합·무공유). ③: §109 잔여 미미러 seam(publish-plan·search-hit-shape·search-json-fields) mirror. ④: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.
