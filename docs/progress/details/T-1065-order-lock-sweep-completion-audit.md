# T-1065 — realdata-e2e delegate 재유도/self-wire 순서-lock sweep 완료 audit

P5 test-hardening sweep(legs T-1054~T-1064)의 완료 audit leg. 2+ distinct
sub-composer 재유도를 가진 realdata-e2e consistency-guard 및 대응 producer/aggregator
전량이 `invocationCallOrder` 순서-lock + fail-fast 로 배선됐음을 재현 가능한 grep 으로
실증하고, order-lock 불요 단일-delegate 목록·다음 축 후보를 durable 하게 박제한다.
production·test 코드 무변경(doc-only). 아래 수치는 audit 시점(2026-07-17) 실행 결과다(추정 없음).

## 섹션 A — 적격 guard/producer 순서-lock 배선 확정표

재현 명령:

```
for f in $(ls test/helpers/realdata-e2e-*-consistency.ts); do
  body=$(awk '/^export function assert/{p=1} p' "$f");
  n=$(echo "$body" | grep -oE "(buildRealData|resolveRealData|parseRealData)[A-Za-z0-9]+\(" | sort -u | grep -c .);
  [ "$n" -ge 2 ] && echo "$(basename $f) delegates=$n ico=$(grep -c invocationCallOrder "${f%.ts}.spec.ts")";
done
```

2+ distinct sub-composer 재유도 consistency-guard 11종 — 전량 `ico ≥ 7`:

| # | guard (realdata-e2e-*-consistency) | delegates | 담당 leg | spec ico |
| --- | --- | --- | --- | --- |
| 1 | result-report-plan | 2 | T-1054 (leg 1) | 7 |
| 2 | evaluation-plan | 2 | T-1055 (leg 2) | 8 |
| 3 | result-issue-command-plan | 2 | T-1056 (leg 3) | 7 |
| 4 | result-issue-publish-plan | 2 | T-1057 (leg 4) | 7 |
| 5 | daily-step-dual-leg-run-report-issue-command-plan | 2 | T-1058 (leg 5) | 7 |
| 6 | daily-step-dual-leg-run-report-issue-publish-plan | 2 | T-1059 (leg 6) | 7 |
| 7 | daily-step-dual-leg-run-report-issue-gh-command-plan | 3 | T-1060 (leg 7) | 11 |
| 8 | daily-step-dual-leg-run-report-issue-outcome-report-from-output | 2 | T-1061 (leg 8) | 7 |
| 9 | result-issue-outcome-report-from-output | 2 | T-1062 (leg 9) | 7 |
| 10 | result-issue-gh-command-plan | 3 | T-1063 (leg 10) | 12 |
| 11 | step-args | 2 | T-1064 (leg 11) | 8 |

producer/aggregator 축(guard 가 아닌 producer-body 순서-lock) — 전량 `ico ≥ 2` 존재:

| spec | 역할 | 순서-lock | ico |
| --- | --- | --- | --- |
| realdata-e2e-step-args.spec.ts | aggregator | evaluation → publish + fail-fast bidirectional | 6 |
| realdata-e2e-result-issue-command-plan.spec.ts | producer (T-1046) | reportPlan → commandArgs | 5 |
| realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts | producer | parse → build + fail-fast | 2 |

→ 적격 guard 11종 + producer/aggregator 축 모두 `invocationCallOrder` 순서-lock 배선 확정.

## 섹션 B — "order-lock 불요 확정" 단일-delegate/재구현 목록

pre-check 결과 order-lock 대상이 아닌 producer/guard. 사유는 공통 —
**sub-composer 1개 이하 → 상대 호출 순서 개념 자체가 부재 → order-lock 불요**.

(1) 단일 delegate 재유도(위임 1개 → 순서 부등식 성립 불가):

- `buildRealDataE2eRunPlan` — pipeline-plan 1개 위임. 단일 → order-lock 불요.
- `buildRealDataPipelinePlan` — collect-call-args 1개 + modelId 직접 대조. 단일 → 불요.
- `buildRealDataEvaluationStepArgs` — evaluation-plan 1개 위임. 단일 → 불요.
- `buildRealDataResultPublishStepArgs` — publish-plan 1개 위임. 단일 → 불요.
- `buildRealDataResultOutcomeStepArgs` — outcome-report 1개 위임. 단일 → 불요.
- `buildRealDataCollectCallArgs` — collect-input 1개 위임. 단일 → 불요.
- `buildRealDataDailyStepCollectCommandPlan` — `resolveRealDataE2eLiveGating` 1개. 단일 → 불요.
- `buildRealDataDailyStepEvalCommandPlan` — `resolveRealDataE2eLiveGating` 1개. 단일 → 불요.

(2) inline 독립 재구현(위임 재호출 0 → 위임 순서 개념 부재):

- `buildRealDataResultSummary` — inline 재구현, 위임 0 → 불요.
- `buildRealDataEvaluationInputs` — inline 재구현, 위임 0 → 불요.
- eval-chain 계열 — inline 재구현, 위임 0 → 불요.

## 섹션 C — 소진 실증

(1) **realdata-e2e 2+ distinct delegate guard/producer 중 `ico=0` = 0건**. 섹션 A 표의
guard 최소 ico=7(11종 전부 ≥7), producer/aggregator 축 최소 ico=2(3종 전부 ≥2). ico=0 없음.

(2) **非-realdata test helper 계열 2+ distinct composer + `ico=0` gap = 0건**. 스캔:

```
for f in $(ls test/helpers/*.ts | grep -v realdata-e2e | grep -v '\.spec\.ts'); do
  n=$(grep -oE "(build|resolve|parse)[A-Za-z0-9]+\(" "$f" | sort -u | grep -c .);
  [ "$n" -ge 2 ] && echo "$(basename $f) composers=$n";
done
```

유일 매치 `prisma-mock.ts`(composers=3)는 **false positive** — 매치 토큰이
`buildMockPrismaService` / `buildPersonFixture` / `buildPrismaError` 로 mock/fixture
factory 이며, `^export function assert` guard 부재(0) + realData 접두 delegate 재유도 0.
sub-composer 정합-재유도 guard 가 아니므로 order-lock 대상 아님 → 진성 gap 0.

→ **결론: realdata-e2e delegate 재유도/self-wire 순서-lock 축 소진(full exhaustion)**.
적격 미소진(ico=0 인 2+ distinct delegate guard/producer)은 발견되지 않았다 —
"부분 소진" 안전 장치는 발동하지 않으며 sweep 완료를 확정한다.

## 섹션 D — 다음 축 pre-check 핸드오프(leg 13 후보)

본 audit 은 다음 축을 단정하지 않는다. 아래 후보 나열 + 적격 판정용 grep + 예상 산출물만 박제하고,
실제 선택·leg 화는 다음 planner turn 이 수행한다.

- (a) **구조-guard 선행성 order-lock** — 현 sweep 은 값 재유도(`build*`) 상호 순서만 lock 했고,
  각 guard 의 구조 검사(`assertStructure`/`TypeError`)가 값 재유도보다 **먼저** 수행됨은 미lock 가능성.
  적격 grep: `grep -lE "assertStructure|TypeError" test/helpers/realdata-e2e-*-consistency.ts` 로 구조
  검사 보유 guard 를 추리고, 해당 spec 에 구조-검사 ico < 값-재유도 ico 부등식이 없으면 적격.
  예상 산출물: guard 별 "구조 검사 invocationCallOrder < 첫 build 재유도" 부등식 spec 1파일 test-only pr.

- (b) **call-count exactly-once 완결성 감사** — 각 order-locked spec 이 sub-composer 를
  `toHaveBeenCalledTimes(1)` 로 assert 해 중복 재유도 회귀를 막는지 감사.
  적격 grep: `for f in test/helpers/realdata-e2e-*-consistency.spec.ts; do echo "$f $(grep -c toHaveBeenCalledTimes "$f")"; done` — 0 인 spec 이 적격.
  예상 산출물: 누락 spec 에 exactly-once assert 추가 test-only pr(부분 소진 시 leg 화 후보).

- (c) **e2e 흐름 커버리지 확장** — 위 두 축이 모두 소진이면 realdata-e2e 상위 flow(run→report→publish
  종단 시퀀스) 자체의 커버리지 확장으로 전환. 적격 grep 은 flow-level spec 부재 경로 스캔.
  예상 산출물: 종단 e2e 시퀀스 spec.

우선순위: (a) 구조-guard 선행성이 미lock 이면 최우선(현 sweep 동형 defense-in-depth, 단일 spec
test-only pr 로 clean scope) → (b) call-count 완결성 → (c) e2e 커버리지.
