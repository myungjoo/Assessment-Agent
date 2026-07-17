---
id: T-1098
title: realdata-e2e result-report-plan 재유도 delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg1
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 35
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 test-hardening §D 후보 (c) 소진 후 후보 2(인자-충실도) leg1 — result-report-plan 재유도 2-delegate 의 toHaveBeenCalledWith payload 충실도 lock. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1098 — realdata-e2e result-report-plan 재유도 delegate 인자-충실도 완결 (§D 후보 2 leg1)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. 후보 (a) struct-precede(legs T-1080~T-1088)·(b) call-count exactly-N(legs T-1089~T-1095)에 이어, [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 박제한 (c) e2e 흐름 커버리지의 종단-시퀀스 order-lock gap 은 [T-1097](T-1097-terminal-sequence-order-lock-flow-smoke.md) leg1 로 해소됐다.

이제 T-1096 audit 섹션 D **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성**으로 전환한다. call-count(호출 횟수)·순서(invocationCallOrder)는 소진됐으나, 각 order-locked spy 가 **어떤 인자 payload 로** 호출됐는지의 완결성은 별도 축이다. 본 leg 은 그 sweep 의 leg1 로 `result-report-plan` consistency-guard 의 재유도 2-delegate 를 대상으로 한다.

pre-check(planner, 2026-07-18, origin/main HEAD=eed6b67a): 대상 spec `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 가드 소스 `test/helpers/realdata-e2e-result-report-plan.ts` L117/L122 실증: 재유도 경로가 `buildRealDataResultSummary(results)`(단일 인자 = 가드의 `results` 입력) → `buildRealDataResultIssueDescriptor(summary, run)`(= 산출 summary + 가드의 `run`) 두 delegate 를 호출한다. 그러나 현재 happy-path it(L557~586)은 `summarySpy` 의 **입력 인자 payload 를 전혀 assert 하지 않고**(호출 횟수·순서만), `descriptorSpy` 도 canonical `toHaveBeenCalledWith` 대신 수동 `.mock.calls[0][0]`/`[1]` reference 로만 검사한다. → 진성 인자-충실도 gap.

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 D 후보 2만.** 인자-충실도 축의 적격 판정 grep·근거.
- `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` — **happy-path 재유도 it(L557~586)과 그 주변 describe(L532~ )만.** 기존 `summarySpy`/`descriptorSpy` spyOn 인프라(L563~570)·수동 reference 검사(L583~585) 를 재사용한다. 파일 전량(899줄) 광범위 read 금지 — 대상 it 블록과 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-result-report-plan.ts` — **L117·L122 재유도 call site 2줄만.** `buildRealDataResultSummary(results)` / `buildRealDataResultIssueDescriptor(summary, run)` 의 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-result-report-plan-consistency.spec.ts`) 에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit) 로 본 spec 실행.

- [ ] **summary delegate 인자-충실도(happy-path)**: 재유도 happy-path it 에서 `expect(summarySpy).toHaveBeenCalledWith(results)` 를 추가해, summary 위임이 가드의 **정확한 `results` 입력 배열**로 호출됨(payload 누락/치환 없음)을 canonical matcher 로 lock. (기존 `toHaveBeenCalledTimes(1)` 는 유지 — 횟수+인자 둘 다.)
- [ ] **descriptor delegate 인자-충실도(happy-path)**: `expect(descriptorSpy).toHaveBeenCalledWith(producedSummary, run)` 를 추가해 descriptor 위임이 (산출 summary + 가드의 `run`) payload 로 호출됨을 canonical matcher 로 lock. 기존 수동 reference 검사(`.mock.calls[0][0]` `toBe` producedSummary / `[1]` `toBe` run, L583~585)는 **reference-identity 보증으로 유지**(shape 동일 + 참조 동일 둘 다 못박음).
- [ ] **negative — shape/payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 대조 assert 1+. 예: `expect(summarySpy).not.toHaveBeenCalledWith(expect.arrayContaining([{ ...results[0], /* 변조 */ }]))` 또는 잘못된 인자(빈 배열·다른 run)로는 매칭되지 않음을 보이는 negative 1+. 이미 존재하는 값-drift RangeError 대조 describe 를 재사용하지 말고 **인자-충실도 축 negative** 로 별도 명시.
- [ ] **negative — 인자 개수/여분 인자**: descriptor 가 정확히 2 인자로 호출됨(여분 인자 0)을 `.mock.calls[0].length` 또는 `toHaveBeenCalledWith(producedSummary, run)` 의 정확 매칭으로 확인하는 assert 1+.
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` ≥ 2(본 leg 이 result-report-plan seam 인자-충실도를 최초 lock — audit 후보 2 leg1 착수 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 it 45+ green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-result-report-plan.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 result-report-plan **한 seam** 만. 나머지 seam(evaluation-plan·result-issue-command-plan 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **struct-precede·call-count exactly-N 재유도** — (a)/(b) 는 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder` assert 제거·변경 금지(유지만).
- **§D 후보 (c) 종단-시퀀스 smoke(T-1097) 수정** — 별개 파일.
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 기존 sweep 패턴의 인자-충실도 축 확장). implementer 는 기존 happy-path 재유도 it 의 spy 인프라를 재사용해 `toHaveBeenCalledWith` 인자-충실도 assert + 인자-축 negative 를 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 result-report-plan seam 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 seam(evaluation-plan·result-issue-command-plan·result-issue-publish-plan 등 `toHaveBeenCalledWith` count 낮은 consistency spec) 또는 P5 의 다른 PLAN bullet 로 전환.
