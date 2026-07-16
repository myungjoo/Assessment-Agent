---
id: T-1027
title: daily-step issue descriptor body-focus 가드(T-1026)를 `-body-consistency` 로 개명해 요약축과 파일명·심볼까지 완전 동형화 (naming isomorphism 마무리)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts
independentStream: realdata-e2e-daily-report-issue-descriptor
plannerNote: "P5 §109 test-hardening — T-1026 이 body-focus 로 좁힌 daily combined 가드를 `-body-consistency`/`...DescriptorBodyConsistent` 로 개명해 요약축(-body-consistency)과 파일명·심볼까지 완전 동형화(T-1026 Follow-up ①). pre-check grep origin/main: 파일명 `-consistency`·심볼 `...DescriptorConsistent` 잔존(가드 본문 11행은 이미 'body-consistency 역할' 자기서술) → 개명 gap 실재, make-work 아님. behavior 변경 0 순수 rename. pr test-only 5파일 dep[] stage5b."
---

# T-1027 — daily-step issue descriptor body-focus 가드 `-body-consistency` 개명 (요약축 naming isomorphism 마무리)

## Why

[PLAN.md](../PLAN.md) 109행(실 github 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 구조를 요약축(`result-issue-*`)과 완전 동형으로 맞추는 thread 의 마무리 slice 다. 직전 T-1026(PR #920, squash 56e204a8)이 daily combined 가드(T-0988)를 **body-focus 로 좁혀** title·marker 재유도를 identity oracle(T-1024/T-1025)에 위임함으로써 daily 축은 이미 요약축과 **structurally 동형**인 body/identity disjoint 2-가드 구조로 복원됐다. 그러나 파일명과 export 심볼은 아직 미동형이다 — 요약축은 `realdata-e2e-result-issue-descriptor-**body-consistency**.ts` / `assertRealDataResultIssueDescriptor**Body**Consistent` 인 반면, daily 축 body-focus 가드는 여전히 `...-issue-descriptor-**consistency**.ts` / `assertRealDataDailyStepDualLegRunReportIssueDescriptor**Consistent**`(combined 시절 이름 잔류)다. 본 task 는 이 이름을 `-body-consistency` / `...DescriptorBodyConsistent` 로 개명해 daily↔요약 두 축이 파일명·심볼까지 완전 동형인 매칭 쌍(`-body-consistency` + `-identity-consistency`)이 되게 한다(T-1026 Follow-up ①).

가치: 향후 cross-axis 구조 감사(T-1026 Follow-up ② 가 예고한 활동)에서 `-body-consistency` 로 grep 하면 두 축이 모두 잡히도록 하는 discoverability 봉합. 현재는 daily 축만 `-consistency` 로 이름이 어긋나 grep trap 이 남아 있다. 실제로 daily 가드 본문 주석(11행)은 이미 자신을 "body-consistency 역할" 로 자기서술하고 있어, 파일명·심볼만 combined 시절 이름을 물려받은 채 뒤처져 있다.

issue-still-relevant pre-check(origin/main grep, 본 planner 확인): 파일 `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` 는 origin/main 에서 `export function assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent`(138행) 심볼과 `-consistency.ts` 파일명을 그대로 유지하며, 요약축 body 가드 심볼은 `assertRealDataResultIssueDescriptorBodyConsistent`(`-body-consistency.ts`) 로 확인됨 → **개명 gap 실재**(make-work 아님). 본 task 는 behavior 를 전혀 바꾸지 않는 순수 rename 이며 기존 spec 이 그대로 green 이어야 한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` (T-0988→T-1026 body-focus 가드, 본 task 개명 대상) — 1행 파일명 자기참조 주석 + 138행 `export function assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(...)`. 11행이 이미 "본 가드(body-consistency 역할)" 로 자기서술. `git mv` 로 `-body-consistency.ts` 로 파일 개명 + 심볼 `...DescriptorConsistent` → `...DescriptorBodyConsistent` + 1행 파일명 주석 동기.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts` (T-0988 colocated spec, 본 task 개명 대상) — 심볼 참조 35 회 + import path 2 회. `git mv` 로 `-body-consistency.spec.ts` 로 개명 + import path + describe/it 문자열의 심볼·"combined" 표현을 body-focus 로 동기.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896 producer — 개명 반영만) — 80행 import path(`./...-descriptor-consistency`) + 165행 self-wire 호출 심볼 + 72~73행 주석 참조. import path·심볼명만 갱신, **self-wire 배선 구조·arg order·producer 산출 descriptor 는 byte-identical 불변**.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` (T-0896 producer spec — 개명 반영만) — 심볼 참조 6 회 + import path 1 회. self-wire 검증 test 의 assertion 의미는 불변, 참조 심볼명만 갱신.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts` (T-1024 identity oracle — 주석 1행만) — 9행이 combined 시절 심볼 `...DescriptorConsistent` 를 disjoint 관계 설명 주석에서 언급. 개명된 심볼·파일명으로 주석 갱신(본체 로직·export 불변, read-only 취급하되 주석 정확성 위해 1행 수정).

## Acceptance Criteria

- [ ] `git mv` 로 `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` → `...-descriptor-body-consistency.ts` 개명(git rename 추적). export 심볼 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent` → `assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent` 로 개명. 1행 파일명 자기참조 주석 동기. 요약축 `assertRealDataResultIssueDescriptorBodyConsistent` 명명 규약과 정확히 동형.
- [ ] `git mv` 로 colocated spec `...-descriptor-consistency.spec.ts` → `...-descriptor-body-consistency.spec.ts` 개명 + import path·심볼 35 참조 전부 갱신. describe/it 문자열에 남은 "combined" 표현을 body-focus 로 동기(T-1026 이 이미 body-focus 로 좁힘 — 명명 잔류만 정정).
- [ ] producer `...-descriptor.ts` 의 import path(80행)·self-wire 호출 심볼(165행)·주석(72~73행)을 개명된 이름으로 갱신. **self-wire 배선 순서·arg order(report, descriptor)·producer 반환 descriptor byte-identical 불변** — 개명 외 로직 변경 0.
- [ ] producer spec `...-descriptor.spec.ts` 의 심볼 참조 6 회·import path 1 회를 개명 반영. self-wire 검증 assertion 의미 불변.
- [ ] identity 가드 `...-identity-consistency.ts` 9행 주석의 combined 시절 심볼·파일명 참조를 개명된 이름으로 갱신(주석 정확성). identity 가드 export·본체 로직 변경 0.
- [ ] **Happy-path unit test 보존**: 개명된 `...DescriptorBodyConsistent` 가드의 기존 정상-report 통과 test 가 개명 후 그대로 green(심볼명만 갱신, 검증 로직 무변경). 새 happy-path 추가 불요 — 개명이므로 기존 커버리지 승계 확인 1+.
- [ ] **Error path unit test 보존**: body drift → RangeError, descriptor 구조 결손 → TypeError, 비식별 gitSha/dateToken → assertNonBlank Error 등 기존 error path test 가 개명된 심볼로 그대로 green.
- [ ] **Flow / branch coverage 보존**: 개명 대상 가드의 각 분기(구조 TypeError / 비식별 Error / body RangeError / 정상 void) test 가 개명 후 전부 유지·green. 분기 추가·삭제 0(T-1026 에서 title 분기는 이미 제거됨 — 본 task 는 rename 만).
- [ ] **Negative cases 충분 cover 보존**: T-1026 이 심은 negative test(body markdown drift / 빈 줄 구분 결손 / marker-첫라인 불일치 / 빈·공백 식별자 / body 비-string 구조 결손)가 개명된 심볼로 전부 green. **회귀 방지**: 개명 후에도 이 5 종 분기 test 가 모두 존재·pass 함을 확인(개명 누락으로 인한 import 실패·심볼 미해결 0).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 개명된 가드 파일 cov 보존(T-1026 수준 유지, 가급적 100%). 전체 unit suite green — 심볼 미해결·import path 오타로 인한 컴파일/런타임 실패 0.

## Out of Scope

- 가드 **behavior 변경 0** — 본 task 는 순수 rename(파일명 + export 심볼 + 참조 + 주석). body 검증 로직·TypeError/RangeError 정책·throw 전파·fail-fast 순서·marker-첫라인 대조 규약 전부 T-1026 상태 그대로 보존.
- identity 가드(T-1024) 본체 로직·export 시그니처 변경 0 — 9행 주석 참조 1줄만 정확성 위해 갱신.
- producer(T-0896) self-wire 배선 구조·호출 순서·arg order·산출 descriptor byte-identical 변경 0 — import path·심볼명만 갱신.
- 마크다운 renderer(T-0895)·컴포저(T-0894) 본문 수정 0 — 미참조.
- 요약축 가드(`realdata-e2e-result-issue-descriptor-body-consistency.ts` 등) 변경 0 — 본 task 는 daily 축을 요약축 명명에 맞출 뿐, 요약축은 read-only 선례.
- publish-plan(T-1016~T-1023)·command-plan·command-args·search·outcome-report seam 변경 0 — 별도 seam.
- 종단 post-execution gh-command-plan(T-0997) seam 변경 0 — 별개 leg.
- 실 gh 호출 / `gh search issues` 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- `src/` production code 변경 / DB write·migration / live LLM 호출 / 외부 dependency 도입 — 전부 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: descriptor 축 body/identity disjoint 2-가드 구조가 파일명·심볼까지 완전 동형화됐으므로(T-1026 structural + T-1027 naming), 요약축 대비 아직 구조·명명이 미동형인 다른 issue-박제 sub-helper vein(예: command-plan·publish-plan seam 의 잔여 미동형 축) 재survey — build-time chain 정합 봉합이 거의 완결이라 다음 자연 stream 은 live 도달(§109 credential/env 게이트) 쪽으로 기운다. 예상 후속 ②: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉(§5 게이트, 사용자 승인 필요).

## Result (DONE — 2026-07-16T07:05Z)

PR #921 round 1/7 APPROVE 4-게이트 통과 squash 머지(f630b9e2), branch delete.
daily-step body-focus 가드를 `-body-consistency`/`...DescriptorBodyConsistent` 로 순수 개명(git mv 2 + 참조 3파일, +55/-54, behavior 0). 요약축(-body-consistency)과 파일명·심볼까지 완전 동형화 달성. 403 suite/10927 test green, 개명 가드 cov 100%, 전역 cov ≥80% 무회귀. reviewer MINOR 1건(command-args-body-marker.ts:29 구 stage명 주석 참조 — out-of-scope, T-1028 로 큐잉).
