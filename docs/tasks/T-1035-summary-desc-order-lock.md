---
id: T-1035
title: summary(result-issue) descriptor self-wire 두 가드 호출 순서(Body→Identity)를 invocationCallOrder 순서-lock test 로 못박기 (daily descriptor T-1034 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor.spec.ts
independentStream: realdata-e2e-result-issue-descriptor
plannerNote: "P5 test-hardening — descriptor 축 command-args mirror 완결의 요약축 leg. T-1034 가 daily descriptor 순서-lock(Body→Identity, invocationCallOrder) canonical 확립. 요약축 descriptor spec 은 순서-lock 부재(invocationCallOrder 0건). T-1033 이 command-args 를 daily→summary mirror 한 것과 동형으로 descriptor 도 summary 로 mirror. pr test-only 1파일."
---

# T-1035 — summary(result-issue) descriptor self-wire 호출 순서(Body→Identity) invocationCallOrder 순서-lock test 추가

## Why

PLAN.md P5 line 109(🟢 실 평가 e2e = github.com myungjoo/leemgs 공개 활동, step ④ daily-test 결과 이슈 박제)의 결과-박제 surface 무결성 조각(REQ-059·REQ-032). 방금 완료한 T-1034 는 **daily** descriptor self-wire 두 가드 호출 순서(Body→Identity)를 `invocationCallOrder` 순서-lock test 로 못박아 descriptor 축의 **canonical daily** 를 확립했다. 이는 command-args 축에서 daily 가 canonical(spec L832)을 먼저 갖고 T-1033 이 summary 로 mirror 한 것과 동형 순서다.

T-1034 Out-of-Scope 가 Follow-up 으로 명시한 **요약축(result-issue) descriptor spec 의 동일 순서-lock mirror** 를 착수한다(T-1034 Out-of-Scope 61행: "요약축 mirror 는 별도 Follow-up task(T-1035 후보)").

pre-check(`git show origin/main:...` grep, 본 planner 확인):

- **T-1034 머지 확인**: daily descriptor spec(`...daily-step-dual-leg-run-report-issue-descriptor.spec.ts`)의 `invocationCallOrder` 등장 3건(순서-lock canonical 존재).
- **요약축 producer self-wire** (`realdata-e2e-result-issue-descriptor.ts`): `buildRealDataResultIssueDescriptor(summary, run)` 반환 직전 self-wire 가 body-consistency(`assertRealDataResultIssueDescriptorBodyConsistent`, L147, 인자 `({title,marker,body}, summary)`) → identity-consistency(`assertRealDataResultIssueDescriptorIdentityConsistent`, L159, 인자 `({title,marker,body}, run)`) 순서로 두 가드를 self-assert 한다 — daily 와 동일한 **Body→Identity** 순서. (주의: daily 는 두 가드 모두 `(descriptor, report)` 인자였으나, 요약축은 Body 가 `(descriptor, summary)`, Identity 가 `(descriptor, run)` 로 두 번째 인자가 다르다.)
- **요약축 descriptor spec 현행** (`realdata-e2e-result-issue-descriptor.spec.ts` L753 test "body-consistency 가드와 identity 가드를 둘 다 정확히 1 회씩 호출한다"): 두 가드가 **각각 1회 호출됨**만 lock(`toHaveBeenCalledTimes(1)`)한다. **두 가드 사이의 상대 호출 순서(Body 가 Identity 보다 먼저)는 lock 하지 않는다** — `invocationCallOrder` assertion 부재(grep 결과 요약축 descriptor spec 전체에 `invocationCallOrder` 0건).

즉 (a) command-args 축은 두 축 모두 순서-lock 이 있고, descriptor 축은 canonical daily(T-1034)만 있으며 요약축은 없다 — make-work 아님, 실 비대칭. command-args 를 daily→summary 로 mirror 한 것(T-1033)과 정확히 같은 패턴으로 descriptor 도 **요약축 mirror 를 추가**해 두 축·두 leg 모두 순서-lock parity 를 달성한다.

본 task 는 요약축 descriptor spec 에 daily descriptor 순서-lock(T-1034)을 mirror 한 `invocationCallOrder` **순서-lock test 를 추가**해, 기존 self-wire 순서(Body→Identity)를 못박는다. 근거: body-consistency 가드는 body 3-블록 구조(marker 라인 → 빈 줄 → markdown) 무결성을, identity 가드는 title·marker 의 run 식별자 재유도 정합을 검증한다 — 현행 Body-first 순서를 그대로 lock 해 회귀 시 fail-fast 순서 의미가 두 leg 간 결정적으로 동형이 되게 한다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` — 순서-lock test 추가 대상. 특히 self-wire spy 검증 describe 블록의 **combined test(현행 L753~772)** "body-consistency 가드와 identity 가드를 둘 다 정확히 1 회씩 호출한다": 두 module alias(`bodyConsistencyModule`.`assertRealDataResultIssueDescriptorBodyConsistent`, `identityConsistencyModule`.`assertRealDataResultIssueDescriptorIdentityConsistent`)를 `jest.spyOn` 으로 감싸 producer 1회 호출 후 각 `toHaveBeenCalledTimes(1)` 만 검증. 이 test 바로 뒤(또는 combined test 확장)에 순서-lock test 를 추가한다. 두 module alias 와 `makeSummary`/`HAPPY_RUN` fixture 는 이 파일에 이미 존재(L753~772 사용).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — self-wire 순서 참고(L147 Body → L159 Identity; Body 인자 `(descriptor, summary)`, Identity 인자 `(descriptor, run)`, read-only).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` — T-1034 가 추가한 순서-lock test 구조 참고(mirror 원본 패턴: 두 spy 를 감싸 `bodySpy.mock.invocationCallOrder[0] < identitySpy.mock.invocationCallOrder[0]` 2자 부등식으로 Body→Identity 순서 보존 검증 + Body-first throw 시 identity 미도달 fail-fast test). read-only.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-descriptor.spec.ts` 에 순서-lock test 1개 추가: body-consistency 가드와 identity-consistency 가드를 각각 `jest.spyOn` 으로 감싸(실 구현 통과 유지) producer `buildRealDataResultIssueDescriptor(summary, HAPPY_RUN)` 를 1회 호출한 뒤, (a) 두 spy 각 `toHaveBeenCalledTimes(1)` + (b) `bodySpy.mock.invocationCallOrder[0] < identitySpy.mock.invocationCallOrder[0]` 부등식으로 **Body → Identity 순서 보존**을 검증한다. describe/it 문자열에 "self-wire 두 가드 호출 순서 보존(Body→Identity)" 취지를 한국어로 명시.
- [ ] 추가 test 는 기존 self-wire spy 검증 describe 블록(combined test L753 근방) 안에 배치해 seam 응집 유지. 기존 combined test(둘 다 1회 호출)는 그대로 두거나, 순서 검증을 통합할 경우 기존 `toHaveBeenCalledTimes(1)` assertion 을 보존한다(회귀 0).
- [ ] **Happy-path test 1+**: 정상 summary(예: `makeSummary({count, byDifficulty, byContribution, totalVolume})` 섞임) + `HAPPY_RUN` 에 대해 두 가드가 모두 void 통과하고 순서 부등식이 성립하는 happy test(위 순서-lock test 가 이를 겸함).
- [ ] **Error-path test 1+**: body-consistency spy 가 throw 하도록 mock → producer 가 throw 전파 + identity 가드 **미도달**(identitySpy `not.toHaveBeenCalled`) 검증 test 1+. Body-first fail-fast 순서를 못박는다. (기존 spec 의 각 가드 throw-전파 test 는 재확인만.)
- [ ] **Flow/branch coverage**: 순서-lock 부등식 성립 분기(정상) 1+ 와 Body-first throw 시 Identity 미호출 분기(fail-fast) 1+ — 각 test 로 cover.
- [ ] **Negative cases 충분 cover**: (a) 순서 부등식이 역전(Identity 가 먼저)되면 fail 함을 보장하는 명시 assertion(2자 부등식 방향); (b) producer 가 입력 summary/run 을 mutate 하지 않음(비변형) 재확인 test 1+(또는 기존 test 로 커버됨을 명시); (c) 순서-lock test 가 실 구현 spy(호출 pass-through)를 쓰므로 산출 descriptor byte-identical 회귀 0 확인. 단일 negative 로 축소 금지.
- [ ] `pnpm lint && pnpm build && pnpm test` green — 추가 순서-lock test 통과, 요약축 descriptor·daily descriptor·기타 spec 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — 요약축 descriptor producer cov 100% 근접 보존, 전역 임계 무회귀.
- [ ] 검증: `git show HEAD:test/helpers/realdata-e2e-result-issue-descriptor.spec.ts | grep -c "invocationCallOrder"` 결과가 1건 이상(순서-lock 존재 확인, 이전엔 0건).

## Out of Scope

- 요약축 descriptor self-wire **순서 변경** — 본 task 는 기존 Body→Identity 순서를 **lock 만** 한다(재배치 아님; 이미 daily 정본과 동일한 순서, T-1034 와 동형). 순서 자체를 바꿀 근거 검토는 별도 seam.
- daily descriptor spec(`...daily-step-dual-leg-run-report-issue-descriptor.spec.ts`) 일체 변경 — T-1034 canonical 은 read-only mirror source.
- 두 가드 본체(`-descriptor-body-consistency` / `-descriptor-identity-consistency`) 로직·signature·인자 순서·에러 정책 변경(read-only, 확정 불변).
- 요약축 descriptor producer(`...result-issue-descriptor.ts`) 조립 규칙·self-wire 배선 변경.
- command-args 축(`...command-args*`) 파일 일체 변경(read-only, T-1033 확정 mirror source).
- 실 gh 호출 / `deploy/daily-test.sh` step ④ 배선 / live LLM — LAN/credential gate deferred(PLAN 108~109행).
- `src/` production code / package.json / CI workflow / 새 dependency 변경 — 전부 0(test helper spec 단독).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)
