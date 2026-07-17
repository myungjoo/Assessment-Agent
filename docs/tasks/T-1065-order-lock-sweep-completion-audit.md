---
id: T-1065
title: realdata-e2e delegate 재유도/self-wire 순서-lock sweep 완료 audit — 적격 guard/producer 소진 확정 기록 + "order-lock 불요" 단일-delegate 목록 박제 + 다음 P5 test-hardening 축 pre-check 핸드오프 (sweep leg 12 — 완료 audit)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - docs/progress/details/T-1065-order-lock-sweep-completion-audit.md
independentStream: realdata-e2e-order-lock-sweep-audit
plannerNote: "P5 test-hardening — consistency-guard/producer 재유도 순서-lock sweep(legs T-1054~T-1064)의 완료 audit leg. planner 전역 pre-check 결과: realdata-e2e 의 2+ distinct sub-composer 재유도 guard 11종(result-report-plan/evaluation-plan/result-issue-*/daily-step-dual-leg-* + step-args) 및 대응 producer/aggregator(T-1046/T-1007/step-args aggregator) 전량 invocationCallOrder 순서-lock + fail-fast 배선 완료(각 spec ico≥2, 대다수 ≥7). 단일-delegate 재유도(run-plan/pipeline-plan/evaluation-step-args/result-*-step-args/seed-collect-call-args/daily-step-collect·eval-command-plan/evaluation-inputs/result-summary/eval-chain)는 order-lock 불요. 非-realdata composer family 에 2+ delegate ico=0 gap 0. → delegate 재유도/self-wire 순서-lock 축 소진 확정. doc-only 완료 기록 + 다음 축 pre-check 핸드오프. direct 1파일 file-disjoint dep[] stage5b(direct-only) 병렬-claimable."
---

# T-1065 — realdata-e2e delegate 재유도/self-wire 순서-lock sweep 완료 audit + 다음 축 핸드오프

## Why

P5 test-hardening sweep(legs T-1054~T-1064)은 realdata-e2e helper 의 consistency-guard 재유도 경로와 producer self-wire 경로에서 2+ distinct sub-composer 위임의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. T-1064(leg 11)가 step-args aggregator guard 의 aggregator fail-fast-sequential(evaluation → publish) 순서-lock 을 추가하며, 데이터-의존 chain 계열과 aggregator fail-fast 계열을 모두 소진했다.

T-1064 Follow-up 은 leg 12 를 "나머지 delegate 기반 guard 를 pre-check 로 재판정 → 단일 delegate 재유도·inline 독립 재유도·게이트 없는 병렬 재유도는 'order-lock 불요' 확정 기록 → 적격 guard 가 realdata-e2e 전역에서 소진 확인되면 sweep 완료 선언 + 다음 축 전환"으로 지시했다. 본 task 는 그 지시를 이행하는 **완료 audit leg** 다 — planner 전역 pre-check 로 소진을 실증하고, 그 증거·불요 목록·다음 축 후보를 durable 하게 박제해 다음 planner turn 이 이 audit 을 재유도하지 않고 바로 다음 축 leg 를 큐잉하도록 핸드오프한다(CLAUDE.md §7.3 "결정은 doc 로 — 두 번 추론하지 않는다"). production·test 코드 무변경, doc-only.

## Required Reading

- `docs/tasks/T-1064-step-args-eval-publish-order-lock.md` — 직전 leg 11 정의서(특히 Why 의 "데이터-의존 chain vs aggregator fail-fast-sequential" 구분 + Follow-ups 의 leg 12 pre-check 지시). 본 audit 이 이행할 지시의 원본.
- `docs/progress/journal-2026-07-17.md` — legs T-1057~T-1064 의 DONE 기록(각 leg 이 cover 한 guard·ico 배선 결과·squash SHA). audit 표의 leg↔guard 매핑 근거.
- (스캔 대상, read 아닌 grep — 본문에 경로만) `test/helpers/realdata-e2e-*-consistency.ts` 및 대응 producer `test/helpers/realdata-e2e-*.ts` + 각 `.spec.ts` — 본 audit 은 아래 Acceptance Criteria 의 재현 가능한 grep 명령으로 소진을 실증하고 결과를 표로 박제한다. **개별 파일 광범위 read 금지**(context 보호) — grep 집계 결과만 기록.

## Acceptance Criteria

본 task 는 `direct` doc-only 이므로 R-112 test 4종(happy/error/branch/negative + coverage)은 **면제**된다(CLAUDE.md §3.2 "direct-mode doc-only commit 만 본 규칙 면제" — 코드·spec 변경 0). 대신 아래 audit 산출물의 정확성·재현성을 검증 기준으로 삼는다.

- [ ] **신규 audit doc 작성**: `docs/progress/details/T-1065-order-lock-sweep-completion-audit.md` 1파일 생성. 내용은 아래 4개 섹션 필수(모두 한국어 §12).
- [ ] **섹션 A — 적격 guard/producer 순서-lock 배선 확정표**: 2+ distinct sub-composer 재유도를 가진 realdata-e2e consistency-guard 11종 + 대응 producer/aggregator 를 표로 나열하고, 각각 (재유도 sub-composer 목록 · 담당 leg(T-NNNN 또는 T-1046/T-1007/이전) · spec `invocationCallOrder` 배선 여부)를 기록. 표는 아래 재현 명령의 출력과 일치해야 한다:
  - `for f in $(ls test/helpers/realdata-e2e-*-consistency.ts); do body=$(awk '/^export function assert/{p=1} p' "$f"); n=$(echo "$body" | grep -oE "(buildRealData|resolveRealData|parseRealData)[A-Za-z0-9]+\(" | sort -u | grep -c .); [ "$n" -ge 2 ] && echo "$(basename $f) delegates=$n ico=$(grep -c invocationCallOrder "${f%.ts}.spec.ts")"; done` — 결과: 11 guard 전량 `ico ≥ 7`.
  - producer/aggregator 축: `realdata-e2e-step-args.spec.ts`(aggregator, evaluation→publish + fail-fast bidirectional, ico=6), `realdata-e2e-result-issue-command-plan.spec.ts`(T-1046 reportPlan→commandArgs), `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts`(parse→build + fail-fast) 등 producer-body 순서-lock 존재 확인.
- [ ] **섹션 B — "order-lock 불요 확정" 단일-delegate/재구현 목록**: pre-check 결과 order-lock 대상이 아닌 producer/guard 를 사유와 함께 박제 — (1) 단일 delegate 재유도: `buildRealDataE2eRunPlan`(pipeline-plan 1개), `buildRealDataPipelinePlan`(collect-call-args 1개 + modelId 직접 대조), `buildRealDataEvaluationStepArgs`(evaluation-plan 1개), `buildRealDataResultPublishStepArgs`(publish-plan 1개), `buildRealDataResultOutcomeStepArgs`(outcome-report 1개), `buildRealDataCollectCallArgs`(collect-input 1개), `buildRealDataDailyStepCollectCommandPlan`·`buildRealDataDailyStepEvalCommandPlan`(각 `resolveRealDataE2eLiveGating` 1개); (2) inline 독립 재구현(위임 재호출 0): `buildRealDataResultSummary`·`buildRealDataEvaluationInputs`·eval-chain 계열. 각 항목에 "sub-composer 1개 이하 → 상대 순서 개념 부재 → order-lock 불요" 사유 1줄.
- [ ] **섹션 C — 소진 실증**: (1) 위 재현 명령으로 2+ distinct delegate guard/producer 중 `ico=0` 인 것이 **0건**임을 기록. (2) 非-realdata test helper 계열에도 2+ distinct composer + `ico=0` gap 이 **0건**임을 기록(`ls test/helpers/*.ts | grep -v realdata-e2e` 대상 동형 스캔). → "realdata-e2e delegate 재유도/self-wire 순서-lock 축 소진" 결론 명시.
- [ ] **섹션 D — 다음 축 pre-check 핸드오프(leg 13 후보)**: 다음 planner turn 이 바로 착수할 수 있도록 구체 스캔 지침을 담은 2~3개 후보 축 제시(각 후보에 "적격 판정용 grep 1줄 + 예상 산출물 형태"). 예: (a) **구조-guard 선행성 order-lock** — 각 consistency-guard 가 `assertStructure`/TypeError 구조 검사를 값 재유도(`build*`)보다 **먼저** 수행함을 `invocationCallOrder`/spy 로 못박는 축(현 sweep 이 값 재유도 상호 순서만 lock, 구조-검사 → 값-재유도 순서는 미lock 가능성); (b) **call-count exactly-once 완결성** — 각 order-locked spec 이 sub-composer `toHaveBeenCalledTimes` 를 assert 해 중복 재유도 회귀를 막는지 완결성 감사; (c) e2e 흐름 커버리지 확장. **본 task 는 다음 축을 단정하지 않는다** — 후보 나열 + pre-check 지침만 박제하고 실제 선택·leg 화는 다음 planner turn 이 수행.
- [ ] **정확성 재확인**: 섹션 A~C 의 수치(guard 11종, ico 값, 불요 목록)는 audit 작성 시점에 위 grep 을 **실제 실행**해 얻은 값이어야 한다(추정 금지). 만약 실행 중 `ico=0` 인 2+ distinct delegate guard/producer 가 **발견되면** → 소진 결론 대신 그 guard 를 섹션 D 최상단에 "leg 13 최우선 — 적격 미소진 발견" 으로 박제하고 audit 은 "부분 소진" 으로 결론(안전 장치 — 잘못된 완료 선언 방지).
- [ ] **doc-only 확인**: `src/`·`test/`·`prisma/`·기타 코드 diff 0. 오직 신규 audit doc 1파일만 추가.

## Out of Scope

- 실제 다음 축 leg(leg 13)의 test 작성 — 본 task 는 audit + 핸드오프만. 다음 축 선택·구현은 다음 planner turn + 후속 executor.
- 기존 order-lock spec 의 수정·보강(call-count 추가, 구조-guard 선행성 추가 등) — 발견 시 섹션 D 후보로 박제만.
- `docs/architecture/*` 또는 ADR 신설 — 본 audit 은 progress/details 의 실행 기록(진행상황 문서)으로 충분(durable 결정이 서면 향후 별도 ADR). architecture/decisions 신설은 pr commitMode 라 본 direct task 범위 밖.
- `docs/PLAN.md`·`docs/STATE.json` 의 phase/bullet 변경 — 본 audit 결론이 sweep 종료를 확정해도 PLAN bullet 변경은 별도(driver/planner 소관). 본 task 는 audit doc 1파일만.
- consistency-guard/producer 의 `.ts` production 로직 변경 — 코드 무변경 audit.

## Suggested Sub-agents

`implementer` (audit doc 작성 — grep 실행 + 결과 표 박제). test-only 아님·doc-only direct 이므로 `tester` 불요(§3.2 direct doc 면제). architect 불요.

## Follow-ups

- (leg 13, 다음 planner turn) 본 audit 의 섹션 D 후보 축 중 pre-check 로 실제 gap 이 확인되는 것을 leg 13 으로 큐잉. 우선순위: (a) 구조-guard 선행성 order-lock 이 미lock 이면 최우선(현 sweep 과 동형의 defense-in-depth, 단일 spec test-only pr 로 clean 하게 scope 가능) → (b) call-count exactly-once 완결성 감사 → (c) e2e 흐름 커버리지. audit 이 "부분 소진" 으로 끝났으면 발견된 적격 guard 를 leg 13 최우선으로.
