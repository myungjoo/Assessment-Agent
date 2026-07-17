---
id: T-1097
title: realdata-e2e 종단 시퀀스(collect→evaluate→result→publish) order-lock flow-level smoke — §D 후보 (c) leg1
phase: P5
status: DONE
mergedAs: eed6b67a
prNumber: 989
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 150
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-terminal-sequence-collect-evaluate-result-publish-order-lock.smoke-spec.ts
independentStream: realdata-e2e-terminal-sequence-order-lock
plannerNote: "P5 test-hardening §D 후보 (c) e2e 흐름 커버리지 leg1 — T-1096 audit 이 박제한 thin gap(종단 4-seam 순서 통합 spec 부재, smoke 트리 invocationCallOrder=0) 해소. 단일 flow smoke 1파일 test-only pr, file-disjoint dep[] stage5b."
---

# T-1097 — realdata-e2e 종단 시퀀스 order-lock flow-level smoke (§D 후보 (c) leg1)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. 후보 (a) struct-precede(legs T-1080~T-1088)·(b) call-count exactly-N(legs T-1089~T-1095)은 소진됐고, [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 남은 유일 후보 (c) **e2e 흐름 커버리지**의 gap-map 을 박제했다.

그 audit 섹션 C/D 판정: 각 seam 개별 threading(17-way aggregator smoke)·shell-runner 실행 순서 smoke 는 조밀하나, collect→evaluate→result→publish **4-seam 을 한 flow 안에서 순차 실행해 실행 순서(collect < evaluate < result < publish)를 `invocationCallOrder` 로 못박는 단일 종단-시퀀스 flow-level spec 은 부재**(smoke 트리 `invocationCallOrder` 사용 = 0)하다 — thin gap. 본 task 는 그 audit 섹션 D 후보 1(leg1 최우선)을 이행한다. 현 sweep 과 동형 defense-in-depth(단일 spec test-only pr, clean scope)로, seam 재배선/누락 회귀를 CI 에서 종단 순서 수준으로 잡는다. production src 무변경, test-only 신규 smoke 1파일.

pre-check(planner, 2026-07-18, origin/main HEAD 반영): 대상 spec 파일 **부재**(적격), `grep -rlE 'invocationCallOrder' test/smoke/` → **0**(적격 유지), 4-seam builder(`buildRealDataE2eStepArgs`·`buildRealDataEvaluationStepArgs`·`buildRealDataResultOutcomeStepArgs`·`buildRealDataResultPublishStepArgs`) 전량 origin/main 존재.

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 C(축 1~3)·섹션 D(후보 1)만.** 본 leg 의 적격 판정 grep·예상 산출물·touchesFiles 근거.
- `test/smoke/realdata-e2e-assembly.smoke-spec.ts` — build-time 조립 체인(`buildRealDataE2eSeed → buildRealDataE2eRunPlan → buildRealDataE2eStepArgs`)의 import 경로·fixture 형태·synthetic `EvaluationResult` literal 공급 패턴. 본 spec 은 그 조립 surface 를 재사용하되 **spy `invocationCallOrder` 로 종단 순서를 lock** 하는 점이 다르다. header 주석의 "실 LLM 0 / 네트워크 0 / credential 0" 원칙 mirror.
- `test/helpers/realdata-e2e-step-args.ts` — `buildRealDataEvaluationStepArgs`(L96)·`buildRealDataResultOutcomeStepArgs`(L110)·`buildRealDataResultPublishStepArgs`(L113) export 시그니처. 각 seam builder 를 `jest.spyOn(module, ...)` 대상으로 삼을 수 있는지(모듈-레벨 export 여부) 확인.
- `test/helpers/realdata-e2e-run-plan.ts`(`buildRealDataE2eRunPlan` L121)·`test/helpers/realdata-e2e-seed-fixture.ts`(`buildRealDataE2eSeed`) — collect seam 조립 진입점 시그니처.

**개별 helper 파일 광범위 read 금지** — 위 4개 시그니처 확인에 필요한 범위만. 나머지는 assembly smoke 의 조립 패턴을 그대로 mirror.

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 신규 파일 1개(`test/smoke/realdata-e2e-terminal-sequence-collect-evaluate-result-publish-order-lock.smoke-spec.ts`). CI 는 `pnpm test:cov`(unit) + `pnpm test:smoke` 로 본 spec 실행.

- [ ] **종단 순서 order-lock(happy-path)**: 전체 pipeline 을 **한 번** 조립(collect: `buildRealDataE2eSeed`→`buildRealDataE2eRunPlan`→`buildRealDataE2eStepArgs`, evaluate: `buildRealDataEvaluationStepArgs`, result: `buildRealDataResultOutcomeStepArgs`, publish: `buildRealDataResultPublishStepArgs`)하고, 각 seam builder 에 `jest.spyOn` 을 걸어 `mock.invocationCallOrder` 부등식으로 **collect < evaluate < result < publish** 실행 순서를 assert 하는 happy-path it 1+.
- [ ] **seam threading 충실도(happy-path)**: 각 seam 산출이 다음 seam 입력으로 실제 threading 됨(예: collect 산출 runPlan 이 evaluate 입력으로, evaluate 산출 EvaluationResult 가 result 입력으로) 을 값-동일성으로 assert 하는 it 1+. synthetic literal 로 공급(실 LLM/네트워크 0).
- [ ] **error path**: seam builder 중 하나가 throw 하면 종단 조립이 그 지점에서 중단되고 downstream seam builder 가 호출되지 않음(`.not.toHaveBeenCalled()`)을 검증하는 error-path it 1+ (예: evaluate seam 입력 부정합 시 result·publish 미도달).
- [ ] **flow / 분기 cover**: 조립 경로에 분기(예: 빈 activity 배열·빈 result 경계)가 있으면 각 분기 1+ it. 분기 없으면 본문에 "조립 경로 단일 — 분기 없음, 항목 생략" 명시.
- [ ] **negative cases 충분 cover**: 예외 상황 각 1+ — (i) 순서 위반 시 부등식 fail 을 노출하는 대조(중간 seam 을 건너뛰거나 순서를 뒤집은 조립이 assert 를 깨는지) 1+, (ii) threading 누락(한 seam 산출이 다음 입력에 반영 안 됨) 경계 1+, (iii) 빈-입력/경계값 1+. 단일 negative 만 작성 금지 — seam 별로 cover.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 추가라 production coverage 무회귀.
- [ ] **credential/네트워크 0 확인**: 본 spec 은 실 LLM·github·Ollama 호출 0, `fetch` 0, `process.env` gating 0 — public CI 에서 항상 발화(R-113 smoke). gating describe 로 감싸지 않는다(assembly smoke 원칙 mirror).
- [ ] **재현 grep 갱신**: 머지 후 `grep -rlE 'invocationCallOrder' test/smoke/ | wc -l` ≥ 1(본 spec 이 종단 순서 lock 을 최초 도입 — audit 섹션 C 축 2 gap 해소).

## Out of Scope

- **production src/ 변경 금지** — test-only 신규 smoke 1파일. seam builder helper 시그니처 변경·리팩터 금지(기존 export 재사용만).
- **실 LLM round-trip / EvaluationOrchestratorService / LlmHttpGateway / Ollama / 실 github 수집** — synthetic literal 로 평가·수집 leg 우회(조립·순서 surface 만 검증). live leg 는 기존 `realdata-e2e-live.smoke-spec.ts` 책임.
- **§D 후보 2(`toHaveBeenCalledWith` 인자-충실도 완결성)** — 본 leg 은 순서 order-lock 만. 인자-충실도는 후속 leg(다음 planner turn).
- **기존 assembly smoke·17-way threading smoke 수정** — 신규 파일 추가만.
- 새 컴포저/가드/helper 신설 — 기존 build\* 컴포저 import 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 기존 sweep/threading 패턴의 종단 순서 축 확장). implementer 는 assembly smoke 의 import·fixture 패턴을 mirror 해 4-seam spy `invocationCallOrder` 부등식 spec 을 작성. tester 는 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke` 로 본 spec 실행·통과 확인(R-110/R-113/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 종단 순서 order-lock 을 도입해 §D 후보 (c) 축 2 gap 을 해소하면, 다음은 §D 후보 2(`toHaveBeenCalledWith` 인자-충실도 완결성 — 적격 판정 grep: consistency spec 중 `toHaveBeenCalledWith` count 0 인 것) 또는 P5 의 다른 PLAN bullet 로 전환.
