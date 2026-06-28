---
id: T-0757
title: realdata-e2e command-args 컴포저 tri-leg(searchQuery·createArgs·updateArgs) single-source descriptor convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step④ 최내곽 descriptor→command-args 투영 컴포저 buildRealDataResultIssueCommandArgs tri-leg convergence — publish-plan(T-0755)·command-plan(T-0741) 아래 layer; gap git grep 확인"
independentStream: realdata-e2e-command-args-tri-leg-descriptor-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-command-args-tri-leg-descriptor-convergence-assembly.smoke-spec.ts
---

# T-0757 — realdata-e2e command-args 컴포저 tri-leg(searchQuery·createArgs·updateArgs) single-source descriptor convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) step ④(결과 이슈 박제) 의 **최내곽 descriptor→command-args 투영** 컴포저 `buildRealDataResultIssueCommandArgs(descriptor)` 는 단일 `RealDataResultIssueDescriptor` 입력으로부터 **세 leg 를 동시 수렴**시킨다 — (1) `searchQuery` leg(`descriptor.marker` 전파), (2) `createArgs` leg(`{title, body, labels}`), (3) `updateArgs` leg(`{title, body}`). 이 세 leg 는 별도 sub-컴포저 위임이 아니라 **단일 descriptor 의 inline 투영**이며, 멱등 search-or-update 정합을 위해 cross-leg 불변식 — `searchQuery === descriptor.marker`, `createArgs.title === updateArgs.title === descriptor.title`, `createArgs.body === updateArgs.body === descriptor.body`, `createArgs.labels === 고정 RESULT_ISSUE_LABELS 복제` — 를 유지해야 한다.

T-0755(publish-plan tri-leg report·commandArgs·searchArgv)·T-0741(command-plan dual-leg report·commandArgs)·T-0742(gh-command-plan dual-leg action·argv) 가 **상위 plan 컴포저**들의 leg-level convergence 를 직접-체인 byte-identical 로 닫았다. 본 task 는 그 아래 **최내곽 투영 layer** 의 single-source convergence 를 박제한다 — 상위 plan 들이 소비하는 command-args 자체가 단일 descriptor 로부터 세 leg 로 일관 수렴함을 public CI 그물로 외화한다. live leg(실 gh 호출·실 LLM·DB·네트워크·jest spawn) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): 기존 `test/helpers/realdata-e2e-result-issue-command-args.spec.ts`(unit) 와 consistency 가드(body-marker T-0649·labels-title T-0651) 는 cross-leg 불변식을 **unit 레벨**(`pnpm test`)에서만 단언하고, `test/smoke/realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts`(T-0746) 는 `descriptor → command-args → search-gh-argv` **search-argv leg chain** 에 초점이 있어 `searchQuery` 만 downstream 으로 thread 할 뿐 **createArgs/updateArgs leg 의 descriptor 단일 source 정합**(title/body 3자 일치 + labels 고정상수 복제 + 무공유)을 tri-leg convergence 로 묶은 smoke 는 NONE 이다(`git grep buildRealDataResultIssueCommandArgs test/smoke/` = 3 파일이 command-args 를 import 하나 어느 것도 tri-leg single-source descriptor convergence 전용 단언 부재 — command-plan(T-0741)/gh-command-plan(T-0742) 은 상위 plan 의 dual-leg convergence, search-gh-argv(T-0746) 는 search-argv chain). 본 smoke 가 그 회귀 그물을 non-gated build-time public CI 에 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 본 task 가 검증할 최내곽 투영 컴포저. L60 `import type RealDataResultIssueDescriptor`, L64 `const RESULT_ISSUE_LABELS`(고정 labels 상수), L70 `interface RealDataResultIssueCreateArgs`, L79 `interface RealDataResultIssueUpdateArgs`, L90 `interface RealDataResultIssueCommandArgs`, L119 `export function buildRealDataResultIssueCommandArgs`. 합성: searchQuery=marker(L128)·createArgs{title,body,labels 복제}(L129-134)·updateArgs{title,body}(L135-138), guard 는 title/marker assertNonBlank(L123-124), self-wire body-marker + labels-title 가드(L147/L156).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — descriptor fixture 합성용. L85 `interface RealDataResultIssueDescriptor`({title, marker, body} 3 필드), L118 `export function buildRealDataResultIssueDescriptor(summary, run)` — synthetic descriptor literal 생성 또는 직접 호출로 입력 descriptor 확보.
- `test/smoke/realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts` (T-0755 산출) — tri-leg convergence smoke 구조 참고(colocated 스타일·describe 골격·byte-identical(`toEqual`)/`not.toBe` 무공유/partial-thread/cross-leg 단언 패턴 대칭). 본 task 의 직접 구조 모델.
- `test/smoke/realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts` (T-0746 산출) — descriptor fixture 합성 패턴·`MODEL_ID`/synthetic 입력 상수·import 위치 참고(중복 회피용 — 본 task 는 search-argv leg 미재단언).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-command-args-tri-leg-descriptor-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0). 다음을 모두 만족한다:

- [ ] **Happy-path**: `buildRealDataResultIssueCommandArgs(descriptor)` 의 정상 합성 — 반환 `{ searchQuery, createArgs, updateArgs }` 세 leg 모두 정의·shape 정합 happy test 1+(유효 synthetic descriptor literal 입력, createArgs={title,body,labels:string[]}·updateArgs={title,body}).
- [ ] **searchQuery leg single-source(branch)**: `args.searchQuery` 가 `descriptor.marker` 와 **byte-identical**(`toBe`) — searchQuery leg 가 descriptor.marker 단일 source 임을 단언 1+ test.
- [ ] **createArgs leg single-source(branch)**: `args.createArgs.title === descriptor.title` AND `args.createArgs.body === descriptor.body`(각 `toBe`) + `args.createArgs.labels` 가 고정 RESULT_ISSUE_LABELS 와 `toEqual`(deep) 이되 새 배열(`not.toBe`, 무공유 복제) 1+ test.
- [ ] **updateArgs leg single-source(branch)**: `args.updateArgs.title === descriptor.title` AND `args.updateArgs.body === descriptor.body`(각 `toBe`) 1+ test.
- [ ] **cross-leg 멱등 정합(branch)**: `args.createArgs.title === args.updateArgs.title`(3자 일치 title) AND `args.createArgs.body === args.updateArgs.body === descriptor.body`(marker 라인 두 경로 보존 — create/update 양쪽 body 동일) 1+ test — 세 leg 가 단일 descriptor 로부터 일관 수렴함을 박제.
- [ ] **partial-thread 격리(branch)**: 다른 `descriptor.marker`(같은 title/body) → `searchQuery` 만 변하고 createArgs/updateArgs title·body 불변(각 단일 source 정합 유지) 1+ test / 다른 `descriptor.body`(같은 title/marker) → createArgs.body·updateArgs.body 만 변하고 searchQuery·title 불변 1+ test(각 leg 가 자기 descriptor 필드 단일 source 로부터 합류함을 박제).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test:
  - `descriptor.title` 빈 문자열 → assertNonBlank("title") throw 전파.
  - `descriptor.title` 공백만 → throw 전파.
  - `descriptor.marker` 빈 문자열 → assertNonBlank("marker") throw 전파.
  - `descriptor.marker` 공백만 → throw 전파.
  - title·marker 동시 빈/공백 → 첫 guard(title) 가 차단(조용한 통과 0).
- [ ] **flow / guard-ordering(branch)**: title guard 가 marker guard 보다 먼저 평가됨 — title 빈 + marker 유효 시 title throw, title 유효 + marker 빈 시 marker throw 각 1+ test(분기 분리).
- [ ] **결정론·무공유·no-mutation**: 동일 descriptor 두 번 호출 → deep-equal 산출(`toEqual`) + 새 args 객체(`not.toBe`) + `args.createArgs`/`args.updateArgs`/`args.createArgs.labels` 참조 각각 비공유(`not.toBe`) + 입력 `descriptor` 객체 mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 컴포저 자체를 수정하지 않고 기존 분기(title/marker guard 순서·tri-leg cross 멱등 정합·descriptor 단일 source 투영·labels 무공유 복제)를 외부 non-gated smoke 로 박제하므로, 위 cross-leg/partial-thread/guard-ordering/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-command-args.ts` 또는 어떤 컴포저/가드 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- search-argv leg(`buildRealDataResultIssueSearchGhArgv(commandArgs)`) downstream chain 재단언(T-0746 이미 cover — 본 task 는 descriptor→command-args 투영 convergence 만).
- 상위 command-plan(T-0741)/gh-command-plan(T-0742)/publish-plan(T-0755) convergence 재단언(이미 cover).
- 실 github.com 네트워크 fetch / 실 gh 호출 / `execFile('gh', argv)` / 실 LLM round-trip / 실 이슈 search·create·edit wiring(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 command-args unit spec(`realdata-e2e-result-issue-command-args.spec.ts`)·consistency 가드 spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
