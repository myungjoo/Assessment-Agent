# T-1096 — call-count 완결성 sweep 완료 audit + 다음 축(§D 후보 (c) e2e 흐름 커버리지) pre-check 핸드오프

P5 test-hardening sweep 의 §D 후보 (b) **call-count exactly-N 완결성**(legs 24~30 =
[T-1089](../../tasks/T-1089-result-report-plan-callcount.md)~[T-1095](../../tasks/T-1095-app-root-perf-getstatus-callcount.md))의 완료 audit leg 다.
tree-wide positive-loose `toHaveBeenCalled()`(`.not.` 제외) 소진(0)을 재현 가능한 grep 으로
실증하고, [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보 중 남은 유일 후보
(c) **e2e 흐름 커버리지**(collect→evaluate→result→publish 종단 시퀀스)의 gap-map 을 박제해,
다음 planner turn 이 audit 재유도 없이 곧바로 첫 (c) leg 를 큐잉하도록 durable 핸드오프한다.
production·test 코드 무변경(doc-only). 아래 수치는 audit 시점(2026-07-18, origin/main
HEAD=48e86c85) 실행 결과다(추정 없음).

## 섹션 A — call-count 완결성 sweep 소진 실증

재현 명령 3종 — 전량 출력 **0**:

```
# (A-1) realdata consistency spec 55개 positive-loose(.not. 제외)
for f in test/helpers/realdata-e2e-*-consistency.spec.ts; do \
  grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' "$f" 2>/dev/null | grep -v '\.not\.'; \
done | wc -l
# → 0

# (A-2) test/helpers 전량 — 각 파일 .not. 제외 positive-loose 잔존 파일 수
for f in $(grep -rlE 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/helpers/ 2>/dev/null); do \
  grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' "$f" | grep -v '\.not\.' | grep -q . && echo "$f"; \
done | wc -l
# → 0

# (A-3) test/ 트리 전량 — 각 파일 .not. 제외 positive-loose 잔존 파일 수
for f in $(grep -rlE 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/ 2>/dev/null); do \
  grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' "$f" | grep -v '\.not\.' | grep -q . && echo "$f"; \
done | wc -l
# → 0
```

| grep | 범위 | positive-loose 잔존 | 판정 |
| --- | --- | --- | --- |
| A-1 | realdata consistency spec 55개 | 0 | 소진 |
| A-2 | test/helpers 전량 | 0 | 소진 |
| A-3 | test/ 트리 전량 | 0 | 소진(tree-wide) |

세 축 모두 0 → positive-loose `toHaveBeenCalled()`(assert 대상 spy 가 exactly-N 이 아닌
느슨한 "한 번 이상" 검사)는 tree-wide 로 소진. 잔존은 전부 `.not.toHaveBeenCalled()`
(negative — 호출 부재 assert, 완결성 대상 아님)뿐이다.

sweep leg 매핑(24~30 = T-1089~T-1095, 각 leg 이 tighten 한 helper/spec):

| leg | task | tighten 대상(consistency spec / perf spec) |
| --- | --- | --- |
| 24 | T-1089 | result-report-plan 재유도 delegate call-count exactly-N |
| 25 | T-1090 | daily-step-collect-command-plan gating delegate call-count |
| 26 | T-1091 | daily-step-eval-command-plan gating delegate call-count |
| 27 | T-1092 | result-issue-publish-plan 2-delegate call-count exactly-N |
| 28 | T-1093 | evaluation-plan 2-delegate call-count exactly-N |
| 29 | T-1094 | result-issue-command-plan 2-delegate call-count exactly-N |
| 30 | T-1095 | app-root perf-spec getStatus call-count exactly-1(tree-wide 마감) |

## 섹션 B — §D 후보 (a)/(b) 소진 확정 + 남은 후보 명시

[T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 가 나열한 3 후보 축의 현재 상태:

- (a) **구조-guard 선행성 order-lock** — legs T-1080~T-1088(struct-precede)로 소진.
  각 consistency-guard 가 구조 검사(`assertStructure`/`TypeError`)를 값 재유도(`build*`)보다
  **먼저** 수행함을 `invocationCallOrder` 부등식으로 못박는 축이 realdata-e2e 전역에서 배선 완료.
- (b) **call-count exactly-N 완결성** — legs T-1089~T-1095(sweep legs 24~30)로 소진(섹션 A 실증).
  positive-loose `toHaveBeenCalled()` tree-wide = 0.
- (c) **e2e 흐름 커버리지** — **미소진(남은 유일 후보)**. 섹션 C 의 gap-map 대상.

→ 남은 §D 후보는 **(c) e2e 흐름 커버리지 단 하나**다. (a)/(b) 는 재유도할 필요 없다.

## 섹션 C — 후보 (c) e2e 흐름 커버리지 gap-map

realdata 상위 flow(collect→evaluate→result→publish 종단 시퀀스)의 flow-level spec
존재/부재를 재현 grep 으로 스캔(개별 파일 광범위 read 없이 집계만):

### 축 1 — 단일-source threading 커버(존재)

```
ls test/smoke/realdata-e2e-aggregator-*-run-plan-threading-*way-*.smoke-spec.ts | wc -l
# → 17
```

17개 N-way(4way~20way 계열) single-source-closure aggregator threading smoke 가 각 slot
(collect-call-args · evaluation-inputs · results-summary · command-args body/title/labels ·
publish-leg · post-leg outcome 등)이 **단일 runPlan source** 로부터 thread 됨을 slot 별로
lock 한다. base assembly `test/smoke/realdata-e2e-assembly.smoke-spec.ts` 는
`buildRealDataE2eSeed → buildRealDataE2eRunPlan → buildRealDataE2eStepArgs` 조립 체인
(seed→run-plan→step-args)이 단일 runPlan source 에서 evaluation/publish 양 측을 동시에
조립함을 happy/결정성/빈-배열 경계로 커버한다(describe: "실 평가 e2e 조립 체인
(seed→run-plan→step-args)"). → **build-time 조립 seam 은 조밀 커버**.

### 축 2 — 종단 시퀀스 order 커버(판정: 부재)

```
# 전체 pipeline 을 한 번 조립해 collect→evaluate→result→publish 4-seam 을
# runtime invocationCallOrder 로 순서-lock 하는 단일 flow-level smoke 존재 여부
for f in $(grep -rlE 'invocationCallOrder' test/smoke/ 2>/dev/null); do \
  echo "$f"; done | wc -l
# → 0 (smoke 트리에 invocationCallOrder 사용 spec 자체가 0)
```

- build-time 조립 커버(축 1)는 각 seam 산출이 다음 seam 입력으로 threading 됨을 **slot 별로
  분해**해 lock 하지만, collect→evaluate→result→publish 4-seam 을 **한 flow 안에서 순차
  실행**해 각 seam 의 실행 순서(collect < evaluate < result < publish)를 `invocationCallOrder`
  로 못박는 **단일 종단-시퀀스 flow-level spec 은 부재**하다(smoke 트리 invocationCallOrder
  사용 = 0). base assembly 도 step-args aggregator 가 evaluation/publish 양 측을 동시
  조립함을 검증할 뿐, 4-seam 실행 순서 부등식은 assert 하지 않는다.
- → **부재 → 후보 (c) leg1 대상**(섹션 D 후보 1). 단, 이는 "thin gap"(각 seam 개별 커버는
  조밀, 종단 순서 통합 spec 만 부재)이다.

### 축 3 — execution-order 커버(존재)

```
ls test/smoke/realdata-e2e-daily-test-step-chain-skip-propagation-*-contract.smoke-spec.ts \
   test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts
```

daily-test.sh nightly runner 의 step-chain SKIP-propagation gate-cascade
(`...step-chain-skip-propagation-gate-cascade-downstream-never-passfail-contract`) +
machine-result json schema **order-driven-steps** parity-drift smoke 가 shell-runner
level 의 **runtime 실행 순서**(step 순서·SKIP 전파·downstream never pass/fail)를 이미 커버한다.
→ **runtime 실행 축은 별도로 조밀 커버**(build-time helper 조립 축과 구분 — 축 2 의 gap 은
"helper 조립 seam 의 종단 순서" 이며 shell-runner 실행 순서와는 다른 layer).

## 섹션 D — 다음 축 pre-check 핸드오프

섹션 C 판정: 후보 (c) 는 **thin gap 존재**(축 2 종단-시퀀스 통합 flow-level spec 부재).
각 seam 개별 threading(축 1) + shell-runner 실행 순서(축 3)는 조밀하나, helper-조립 layer
에서 collect→evaluate→result→publish 4-seam 을 한 flow 로 순서-lock 하는 spec 이 없다.
따라서 **(c) 에 진성(thin) gap 발견** 분기로 첫 (c) code leg 후보를 박제한다. **본 task 는
leg 화하지 않는다** — 후보·pre-check 만 박제하고 실제 선택·큐잉은 다음 planner turn.

### 후보 1 (leg1 최우선) — 종단 시퀀스 order-lock flow-level spec

- 적격 판정 grep(부재 확인 = 적격):
  `grep -rlE 'invocationCallOrder' test/smoke/ | wc -l` → 0 인 한 적격(smoke 트리에 4-seam
  종단 순서 spec 부재).
- 예상 산출물(test-only pr, 1파일): 전체 pipeline 을 **한 번** 조립
  (`buildRealDataE2eSeed → buildRealDataE2eRunPlan → buildRealDataE2eStepArgs` + evaluation·
  result·publish leg)해 collect < evaluate < result < publish seam 실행 순서를 spy
  `invocationCallOrder` 부등식 + 각 seam 산출이 다음 seam 입력으로 실제 threading 됨을 assert
  하는 종단-시퀀스 flow-level spec.
- touchesFiles 후보(1파일): `test/smoke/realdata-e2e-terminal-sequence-collect-evaluate-result-publish-order-lock.smoke-spec.ts`(commitMode `pr`, test-only).

### 후보 2 (대안 / leg1 흡수 시 leg2) — `toHaveBeenCalledWith` 인자-충실도 완결성

- 근거: call-count(호출 횟수)는 소진됐으나 각 order-locked spy 가 **어떤 인자로** 호출됐는지
  (`toHaveBeenCalledWith`)의 완결성은 별도 축. threading spec 이 산출-동일성은 assert 해도
  중간 seam 의 인자 payload 충실도(누락 필드·shape drift)를 exactly 검사하는지 감사.
- 적격 판정 grep:
  `for f in test/helpers/realdata-e2e-*-consistency.spec.ts; do echo "$f $(grep -c toHaveBeenCalledWith "$f")"; done`
  — 0 인 spec 이 적격(인자-충실도 미lock).
- 예상 산출물: 누락 spec 에 `toHaveBeenCalledWith` 인자-충실도 assert 추가 test-only pr.

우선순위: 후보 1(종단 시퀀스 order-lock — 현 sweep 동형 defense-in-depth, 단일 spec test-only
pr 로 clean scope) → 후보 2(인자-충실도 완결성). (c) 축이 후보 1 로 소진되면 다음은 후보 2 또는
P5 의 다른 PLAN bullet 로 전환. 본 audit 은 다음 축을 단정하지 않는다 — 실제 선택·leg 화는
다음 planner turn 이 섹션 C/D 근거로 수행한다.
