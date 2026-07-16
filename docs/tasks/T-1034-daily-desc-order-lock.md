---
id: T-1034
title: daily descriptor self-wire 두 가드 호출 순서(Body→Identity)를 invocationCallOrder 순서-lock test 로 못박기 (command-args 순서-lock 패턴 mirror, canonical daily 확립)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts
independentStream: realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor
plannerNote: "P5 test-hardening — command-args 축은 두 축 모두 invocationCallOrder 순서-lock 보유(daily L832 canonical, summary T-1033 mirror). descriptor 축은 daily·summary 모두 self-wire 상대 호출 순서(Body→Identity) lock test 부재. canonical daily 먼저 확립. pr test-only 1파일."
---

# T-1034 — daily descriptor self-wire 호출 순서(Body→Identity) invocationCallOrder 순서-lock test 추가

## Why

PLAN.md P5 line 109(🟢 실 평가 e2e = github.com myungjoo/leemgs 공개 활동, step ④ daily-test 결과 이슈 박제)의 결과-박제 surface 무결성 조각(REQ-059·REQ-032). 방금 완료한 T-1031→T-1032→T-1033 은 요약축(result-issue) command-args 를 daily 축과 동일한 triple-oracle defense-in-depth parity 로 끌어올렸고, T-1033 이 그 self-wire **호출 순서**를 daily 정본(broad-first)으로 정규화하며 `invocationCallOrder` 순서-lock test 까지 추가했다. 그 결과 **command-args 축은 두 축 모두** self-wire 상대 호출 순서를 test 로 못박고 있다(daily spec L832 canonical, summary spec T-1033 mirror).

T-1033 Out-of-Scope 가 Follow-up 으로 남긴 **descriptor 축 self-wire 순서 감사**를 착수한다.

pre-check(`git show origin/main:...` grep, 본 planner 확인):

- **daily descriptor 정본** (`realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` L166/L180): self-wire 가 body-consistency(`...DescriptorBodyConsistent`) → identity-consistency(`...DescriptorIdentityConsistent`) 순서로 두 가드를 반환 직전 self-assert 한다(둘 다 인자 `(descriptor, report)`, T-1029 정규화).
- **daily descriptor spec 현행** (`...descriptor.spec.ts` L643 test "(c) combined 가드와 identity 가드가 둘 다 … 1 회씩 호출됨"): 두 가드가 **각각 호출됨 + 인자 순서**만 lock(`toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(descriptor, report)`)한다. **두 가드 사이의 상대 호출 순서(Body 가 Identity 보다 먼저)는 lock 하지 않는다** — `invocationCallOrder` assertion 부재(grep 결과 daily descriptor spec 전체에 `invocationCallOrder` 0건).

즉 (a) command-args 축은 순서-lock 이 있는데 descriptor 축은 없고, (b) canonical 인 daily descriptor 조차 부재다 — make-work 아님, 실 비대칭. command-args 는 daily 가 canonical(L832)로 먼저 갖고 있었고 T-1033 이 summary 로 mirror 했으므로, descriptor 도 **canonical daily 를 먼저 확립**하는 것이 옳은 mirroring 순서다(요약축 mirror 는 별도 Follow-up task).

본 task 는 daily descriptor spec 에 command-args 순서-lock(daily spec L812/L832~837, summary T-1033) 을 mirror 한 `invocationCallOrder` **순서-lock test 를 추가**해, 기존 self-wire 순서(Body→Identity)를 못박는다. 근거: body-consistency 가드는 body 2-블록 구조(marker 라인 → 빈 줄 → markdown byte-identical)를, identity 가드는 title·marker 식별자 재유도를 검증한다 — 현행 Body-first 순서를 그대로 lock 해 회귀 시 두 축의 fail-fast 순서 의미가 결정적이 되게 한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` — 순서-lock test 추가 대상. 특히 self-wire flow/branch describe 블록의 **test "(c)"(현행 L643~661)**: 두 namespace(`issueDescriptorConsistency`.`assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent`, `issueDescriptorIdentityConsistency`.`assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent`)를 `jest.spyOn` 으로 감싸 producer 1회 호출 후 각 `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(descriptor, report)` 를 검증. 이 test 바로 뒤(또는 test (c) 확장)에 순서-lock test 를 추가한다. 두 namespace import 는 이 파일에 이미 존재(L644~651 사용).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — self-wire 순서 참고(L166 Body → L180 Identity, 둘 다 `(descriptor, report)`, read-only).
- `test/helpers/realdata-e2e-result-issue-command-args.spec.ts` — T-1033 이 추가한 순서-lock test 구조 참고(mirror 원본 패턴: 세 spy 를 감싸 `mock.invocationCallOrder[0]` 부등식으로 순서 보존 검증). descriptor 는 가드가 **2개**뿐이므로 2자 부등식으로 축소 적용, read-only.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts` — command-args daily 정본 순서-lock(L812 describe "순서 보존" + L832~837 `invocationCallOrder` 부등식) 원형 참고, read-only.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` 에 순서-lock test 1개 추가: body-consistency 가드와 identity-consistency 가드를 각각 `jest.spyOn` 으로 감싸(실 구현 통과 유지) producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 를 1회 호출한 뒤, (a) 두 spy 각 `toHaveBeenCalledTimes(1)` + (b) `bodySpy.mock.invocationCallOrder[0] < identitySpy.mock.invocationCallOrder[0]` 부등식으로 **Body → Identity 순서 보존**을 검증한다. describe/it 문자열에 "self-wire 두 가드 호출 순서 보존(Body→Identity)" 취지를 한국어로 명시.
- [ ] 추가 test 는 기존 self-wire flow/branch describe 블록(test (c) 근방) 안에 배치해 seam 응집 유지. 기존 test "(c)"(둘 다 호출 + 인자 순서)는 그대로 두거나, 순서 검증을 (c) 에 통합할 경우 기존 인자-순서 assertion 을 보존한다(회귀 0).
- [ ] **Happy-path test 1+**: 정상 report(예: `overallStatus: "all-pass"`)에 대해 두 가드가 모두 void 통과하고 순서 부등식이 성립하는 happy test(위 순서-lock test 가 이를 겸함).
- [ ] **Error-path test 1+**: body-consistency spy 가 throw 하도록 mock → producer 가 throw 전파 + identity 가드 **미도달**(identitySpy `not.toHaveBeenCalled`) 검증 test 1+. Body-first fail-fast 순서를 못박는다. (기존 spec 의 각 가드 throw-전파 test 는 재확인만.)
- [ ] **Flow/branch coverage**: 순서-lock 부등식 성립 분기(정상) 1+ 와 Body-first throw 시 Identity 미호출 분기(fail-fast) 1+ — 각 test 로 cover.
- [ ] **Negative cases 충분 cover**: (a) 순서 부등식이 역전(Identity 가 먼저)되면 fail 함을 보장하는 명시 assertion(2자 부등식 방향); (b) producer 가 입력 report/descriptor 를 mutate 하지 않음(비변형) 재확인 test 1+(또는 기존 test 로 커버됨을 명시); (c) 순서-lock test 가 실 구현 spy(호출 pass-through)를 쓰므로 산출 descriptor byte-identical 회귀 0 확인. 단일 negative 로 축소 금지.
- [ ] `pnpm lint && pnpm build && pnpm test` green — 추가 순서-lock test 통과, daily descriptor·기타 spec 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — daily descriptor producer cov 100% 근접 보존, 전역 임계 무회귀.
- [ ] 검증: `git show HEAD:test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts | grep -n "invocationCallOrder"` 결과가 1건 이상(순서-lock 존재 확인, 이전엔 0건).

## Out of Scope

- daily descriptor self-wire **순서 변경** — 본 task 는 기존 Body→Identity 순서를 **lock 만** 한다(재배치 아님, T-1033 command-args 재배치와 달리 이미 정본 순서). 순서 자체를 broad-first 로 바꿀 근거 검토는 별도 seam(원하면 Follow-up).
- 요약축(`result-issue-descriptor-*`) descriptor spec 에 동일 순서-lock mirror — 본 task 는 canonical daily 만 확립. 요약축 mirror 는 별도 Follow-up task(T-1035 후보).
- 두 가드 본체(`-descriptor-body-consistency` / `-descriptor-identity-consistency`) 로직·signature·인자 순서·에러 정책 변경(read-only, T-1029 확정 불변).
- daily descriptor producer(`...descriptor.ts`) 조립 규칙·self-wire 배선 변경.
- command-args 축(`...command-args*`) 파일 일체 변경(read-only mirror source).
- 실 gh 호출 / `deploy/daily-test.sh` step ④ 배선 / live LLM — LAN/credential gate deferred(PLAN 108~109행).
- `src/` production code / package.json / CI workflow / 새 dependency 변경 — 전부 0(test helper spec 단독).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)
