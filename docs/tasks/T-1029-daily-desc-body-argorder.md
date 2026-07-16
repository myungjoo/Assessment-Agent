---
id: T-1029
title: daily-step descriptor body-consistency 가드 인자 순서를 (descriptor, report) 로 정규화
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032]
estimatedDiff: 70
estimatedFiles: 4
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.spec.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts
independentStream: realdata-e2e-daily-report-issue-descriptor
plannerNote: "P5 test-hardening — daily body 가드 (report,descriptor) 를 (descriptor,report) 로 정규화, identity 가드·요약축 body 가드와 signature 동형화, T-1025 flagged arg-order footgun 해소."
---

# T-1029 — daily-step descriptor body-consistency 가드 인자 순서를 (descriptor, report) 로 정규화

## Why

T-1024~T-1028 로 daily-step issue descriptor 축이 body/identity disjoint 2-가드 구조 + 파일명·심볼까지 요약축(`result-issue-descriptor-*`)과 동형화됐다. 그러나 **signature(인자 순서) 한 축만 아직 비동형**이다. 현재:

- daily body 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent(report, descriptor)` — **report-first**.
- daily identity 가드 `...DescriptorIdentityConsistent(descriptor, report)` — descriptor-first.
- 요약축 body 가드 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` — descriptor-first.

즉 daily 축의 sibling 두 가드가 서로 **반대 인자 순서**를 갖고, daily body 가드만 요약축 convention 과도 어긋난다. 이 intra-axis arg-order 불일치는 T-1025 journal note 가 이미 `⚠️ arg order (descriptor, report) — combined 가드 (report, descriptor) 반대 … spy+TS swap 방지` 로 명시 경고한 footgun 이다. daily body 가드를 **descriptor-first `(descriptor, report)`** 로 정규화하면 (a) daily 축 두 가드 인자 순서 통일 → self-wire·spy·향후 caller 의 swap 실수 제거, (b) 요약축 body 가드와 signature 동형화 완결. behavior 변경 0 순수 signature 정규화다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.ts` — 정규화 대상 가드. 138~140행 signature `(report, descriptor)` 및 내부 param 사용부(named 참조라 선언 순서만 swap 하면 behavior 불변). 파일 상단 § 주석의 arg-order 서술 유무 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — producer self-wire 호출부(165행 근처 body 가드 호출 `(report, descriptor)` → `(descriptor, report)`, 179행 identity 호출은 이미 `(descriptor, report)` — 정규화 후 두 호출 인자 순서 통일 확인).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.spec.ts` — 가드를 직접 호출하는 happy/error/negative test 전부(약 30 test)의 인자 순서 갱신 대상.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` — producer self-wire spy 검증 `expect(spy).toHaveBeenCalledWith(report, descriptor)` → `(descriptor, report)` 갱신 대상.
- `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts` — 요약축 body 가드 signature `(descriptor, summary)` (정규화 목표 convention 의 mirror 근거, 참고용).

## Acceptance Criteria

- [ ] `...descriptor-body-consistency.ts` 의 `assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent` signature 를 `(report, descriptor)` → `(descriptor, report)` 로 swap. 내부 로직은 named param 참조라 선언 순서만 바꾸고 body 는 불변 — 구조 검증·byte-identical 비교·TypeError/RangeError throw 정책·fail-fast 순서 100% 보존.
- [ ] producer `...descriptor.ts` 의 self-wire 호출을 `...BodyConsistent(descriptor, report)` 로 갱신 → sibling identity 호출 `...IdentityConsistent(descriptor, report)` 과 인자 순서 통일. 산출 descriptor 는 byte-identical 불변.
- [ ] `...descriptor-body-consistency.spec.ts` 의 모든 가드 호출을 새 인자 순서로 갱신 — 기존 happy-path test 유지(정상 descriptor 통과 검증 1+), 기존 error-path test 유지(descriptor null/undefined·비객체·marker/body 부재·비-string → TypeError, report gitSha/dateToken drift → RangeError 각 1+), 기존 negative/경계 test 유지(각 예외 분기별 1+ — 단일 negative 로 축소 금지). 분기 신규 추가 0.
- [ ] `...descriptor.spec.ts` 의 body 가드 self-wire spy 검증을 `toHaveBeenCalledWith(descriptor, report)` 로 갱신(정확히 1 회 호출·인자 순서 검증 유지), identity 가드 spy 검증은 불변.
- [ ] `git grep -nE "BodyConsistent\((report|report,)" -- 'test/**'` 결과 0건 — daily body 가드를 report-first 로 호출하는 잔존 site 없음 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` green — daily-step 및 요약축 가드 spec 전부 통과, 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — signature swap 이라 coverage 영향 0, body-consistency 가드 파일 100% 유지.

## Out of Scope

- 가드 로직·비교 순서·throw 정책·에러 메시지 문구 변경 (인자 순서 정규화만).
- identity 가드(`...descriptor-identity-consistency.ts`) 의 signature 또는 로직 변경 — 이미 descriptor-first 로 목표 convention 준수.
- 요약축(`result-issue-descriptor-*`) 파일 변경 — 본 task 는 daily 축 signature 정규화만 (요약축은 이미 descriptor-first, 참고 근거일 뿐).
- identity 가드 파일 내 body 가드 cross-reference 주석(9·14행) 은 역할 서술이라 arg-order 를 명시하지 않으면 손대지 않는다 — 단 arg-order 를 명시한 stale 문구가 있으면 그 한 줄만 정정.
- 다른 daily 가드(action / command-args / command-plan / publish-plan 등) 의 signature 감사 — 본 task 는 descriptor body 축 1건만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

## Result (DONE)

- 완료: 2026-07-16, PR #923 squash-merge (`7e214f5f`), reviewer round 1 APPROVE (finding 0).
- daily body-consistency 가드 signature `(report, descriptor)` → `(descriptor, report)` 정규화 — identity 가드·요약축 body 가드와 descriptor-first 동형. producer self-wire 두 호출 + stale 반대 경고 주석 정정 + spec 가드 호출·spy 대조 전부 갱신. +51/-48, test-only 4파일.
- behavior 0 순수 signature 정규화. 403 suite/10927 test green, 전역 cov line 99.95% / function 100% / branch 99.25% (임계 line≥80 AND function≥80 무회귀). git grep BodyConsistent report-first 잔존 0.
- Follow-up: T-1030 (daily command-args-consistency 가드 인자순서 정규화 — 유일 source-first outlier) planner 큐잉.
