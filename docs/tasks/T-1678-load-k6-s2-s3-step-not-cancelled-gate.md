---
id: T-1678
title: load-k6.yml S2 · S3 step 을 앞 leg 실패에도 실행되게 배선 (`if: ${{ !cancelled() }}` + drift guard)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 150
estimatedFiles: 2
independentStream: load-k6-s2-baseline
dependsOn: [T-1677]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
created: 2026-08-25
plannerNote: P5 R-91 chain 59/N — T-1674 ③ → T-1676 ② → T-1677 승계 Follow-up (S1 red 시 S2·S3 skip 구조 결함 차단, 코드 pr slice)
---

# T-1678 — load-k6.yml S2 · S3 step 을 앞 leg 실패에도 실행되게 배선

## Why

S2 축 첫 dispatch([T-1674](T-1674-load-k6-s2-first-measurement.md), run `32746598803`) 는 **S2 수치를 한 개도 남기지 못했다** — S1 leg 가 관찰용 게이트 `p(95)<900` 을 넘어 k6 가 exit `99` 를 냈고, [`load-k6.yml`](../../.github/workflows/load-k6.yml) `195 행` S2 step 과 `206 행` S3 step 에 `if:` 가 없어 **둘 다 `skipped`** 로 떨어졌기 때문이다(경위는 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` `S2 1 회차` `764~766 행`). 같은 문서 `817 행` 은 이 얽힘을 "**S1 step 이 fail 하는 한 S2 step 은 계속 skip**" 으로 명시한다. [T-1676](T-1676-s1-stub-baseline-threshold-code-sync.md) 이 S1 관찰용 임계를 `1100ms` 로 재확정했지만 그건 **이번 표본에서 우연히 green 이 될 가능성**을 높일 뿐, 구조적 결함(앞 leg 한 개가 red 면 뒤 시나리오 측정이 통째로 증발) 은 그대로다. 본 slice 는 그 구조를 닫는다 — S2 · S3 step 을 `if: ${{ !cancelled() }}` 로 바꿔 **앞 step 실패와 무관하게 실행**되되 **job 취소 시에는 실행되지 않게** 한다. `always()` 를 쓰지 않는 이유는 아래 Acceptance Criteria 1 에 박제한다. PLAN `140~141 행` R-91 chain, [T-1677](T-1677-s1-stub-baseline-threshold-doc-sync.md) Follow-up 승계.

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `193~210 행` — S2 실행 step(`195 행` 이름 · `196~200 행` 주석/env `K6_BASE_URL` · `K6_SEED_PERSONS: "30"` · `201 행` run) 과 S3 실행 step(`202~205 행` 주석 · `206 행` 이름 · `207~208 행` env · `209 행` run). 본 slice 가 넣는 것은 각 step 의 `if:` 한 줄 + 그 위 사유 주석뿐이다.
- 같은 파일 `148~155 행` — S1 실측 기록 step 의 `if: always()` 와 그 위 사유 주석. **본 slice 는 이 step 을 건드리지 않는다**(참고용 선례 — "수치가 남아야 baseline 을 잡을 수 있다" 는 동기가 S2 · S3 에도 그대로 적용되지만, 그 step 은 취소 시에도 요약을 남기는 게 맞아 `always()` 가 정당하다).
- 같은 파일 `211~214 행` — 정리(teardown) step 의 `if: always()`. 취소 시에도 컨테이너를 지워야 하므로 `always()` 유지. **무변경**.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `40~92 행` — `unquote` / `extractStepBlock`(헤더보다 깊은 들여쓰기가 이어지는 동안 수집, 부재면 `null`, non-string 이면 `TypeError`) / `extractKey`(블록에서 `<key>:` 로 시작하는 **첫 행**의 값, 부재면 `null`) / `extractStep`. 새 단언은 이 helper 만 재사용한다 — **새 helper 신설 금지**.
- 같은 파일 `25~26 행`(`BOOT_STEP_NAME` · `TEARDOWN_STEP_NAME`), `435 행`(`S2_RUN_STEP_NAME`), `1081 행`(`S3_RUN_STEP_NAME`), `1760 행`(`S1_RUN_STEP_NAME`), `2184 행`(`S1_SUMMARY_STEP_NAME`) — step 이름 상수. 새 describe 는 이 상수들을 재사용한다.
- 같은 파일 `403~410 행` — `it("(5) 정리 step 이 if: always() 를 가진다...")`. `extractKey(block, "if")` 단언의 기존 형태(새 단언이 따를 표기).
- 같은 파일 `1975~1990 행` — `it("(e) S1 step 에 if: / continue-on-error 우회 flag 가 없다")`. **S1 step 은 `if` 가 `null` 이어야 한다는 기존 불변식이 본 slice 후에도 그대로 성립해야 한다**(S1 은 게이트 그 자체라 우회 금지). 같은 test 의 "정리 step 만 always() 를 갖는다" 단언도 무변경으로 통과해야 한다 — 그래서 S2 · S3 에는 `always()` 가 아니라 `!cancelled()` 를 쓴다.
- 같은 파일 `459~546 행`(T-1622 S2 배선 drift) · `1124~1214 행`(T-1625 S3 배선 drift) — 기존 S2 · S3 단언 군. `run` · env · step 순서만 보므로 `if:` 추가로 깨지지 않아야 한다(회귀 확인 대상).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `758~818 행` — `§3.1` `S2 1 회차` 소절. 특히 `764~766 행`(skip 원인 진단) 과 `817 행`(두 축이 엮여 있다는 결론). **본 slice 는 이 문서를 편집하지 않는다** — 문서 반영은 뒷단 `direct` slice 소관.

## Acceptance Criteria

- [ ] [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) 의 **S2 실행 step**(`k6 S2 조회 부하 시나리오 실행`) 에 `if: ${{ !cancelled() }}` 한 줄을 추가하고, 그 위에 사유 주석 2~3 줄을 단다 — ① 앞 leg(S1) 가 임계 위반으로 exit 해도 S2 수치는 남아야 baseline 을 잡을 수 있다(T-1674 `S2 1 회차` 가 skip 으로 0 수치를 실증) ② `always()` 를 쓰지 않는 이유는 job 취소 시까지 부하 발생기를 돌리지 않기 위함이고, 취소 시 실행돼야 하는 것은 요약 기록 · 정리 step 뿐이다.
- [ ] 같은 파일의 **S3 실행 step**(`k6 S3 동시 요청 내성 시나리오 실행`) 에도 동일하게 `if: ${{ !cancelled() }}` 추가(주석은 S2 를 가리키는 1 줄로 축약 가능).
- [ ] 두 step 의 `name` · `env`(S2 의 `K6_BASE_URL` · `K6_SEED_PERSONS: "30"`, S3 의 `K6_BASE_URL`) · `run`(`k6 run test/load/s2-read.js` · `k6 run test/load/s3-concurrent.js`) · **step 순서** 는 문자 단위 무변경. S1 실행 step · S1 요약 기록 step · seed step · 정리 step · 트리거 선언 · `inputs` 는 **전부 무변경**.
- [ ] [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 끝에 `T-1678` describe 블록을 추가한다(파일 상단 기존 helper 재사용, 새 helper 0). **happy-path**: S2 · S3 두 step 의 `extractKey(block, "if")` 가 정확히 `${{ !cancelled() }}` 이고, 두 step 이 여전히 S1 실행 step 뒤 · 정리 step 앞 순서를 지키며, `run` 경로가 `package.json` 의 `test:load:s2` · `test:load:s3` 와 parity 인지 단언(1+ test).
- [ ] **error path**: 대상 step 이 없는 합성 YAML 에서 `extractStepBlock` 이 `null`, `extractStep` 이 미발견 정규형(`found:false`), `stepIndexOf` 가 `-1` 을 돌려주고 **throw 하지 않는** 것 + non-string 입력에 `TypeError` 가 나는 것을 S2 · S3 상수로 각각 단언(1+ test).
- [ ] **flow / 분기 cover**: `if` 키가 **있는 갈래**(실 workflow) 와 **없는 갈래**(합성 YAML → `extractKey` 가 `null`), 값에 따옴표가 **있는 갈래 / 없는 갈래**(`unquote` 정규화로 같은 결과), step 블록이 **다음 헤더에서 끊기는 갈래 / EOF 에서 끊기는 갈래** 를 각각 test 로 분리(각 1+).
- [ ] **negative cases 충분 cover** — 최소 5 종 각 1+ test: (1) S1 실행 step 은 여전히 `if` · `continue-on-error` 가 **둘 다 `null`**(게이트 우회 차단), (2) S2 · S3 step 에 `continue-on-error` 가 **없다**(실패 은닉 차단 — `!cancelled()` 는 실행 여부만 바꿀 뿐 job 결과를 green 으로 만들지 않는다), (3) S2 · S3 의 `if` 값이 `always()` 가 **아니다**(취소 시 부하 발생기 실행 차단 — `always()` 를 가진 step 은 요약 기록 · 정리 두 개뿐임을 함께 단언), (4) `if` 를 제거한 합성 YAML 에서 본 단언이 실제로 검출되는 mutation test(`extractKey` 가 `null` → 검출력 유실 0), (5) `.github/workflows/ci.yml` 에 S2 · S3 스크립트 경로 · `test:load:s2` · `test:load:s3` 문자열이 여전히 **없다**(부하가 상시 CI 로 새지 않음).
- [ ] 기존 단언 회귀 0 — 특히 `it("(e) S1 step 에 if: / continue-on-error 우회 flag 가 없다")`, `it("(5) 정리 step 이 if: always() 를 가진다...")`, `it("⑤ S2 · S3 · 정리 step 의 run 본문은 본 slice 가 건드리지 않았다")`, T-1622 · T-1625 · T-1636 · T-1640 · T-1659 · T-1660 의 순서 · parity 단언이 **수정 없이** 통과.
- [ ] `pnpm lint` 무경고 · `pnpm build` 성공 · `pnpm test` green(기존 suite 회귀 0) · `pnpm test:smoke` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 전역 coverage 수치는 불변이어야 한다.

## Out of Scope

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) · [docs/PLAN.md](../PLAN.md) 편집 — 문서 반영은 뒷단 `direct` slice(별도 task).
- `gh workflow run load-k6.yml` 실 dispatch 및 `§3.1` 회차 기록 — 배선이 머지된 뒤의 별도 task.
- `K6_SEED_PERSONS` `30` → `133` 상향 검토(설계 ③ 의 "첫 실측 이후 별도 판단" 조건 미충족).
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 의 devset dataset 교체(별도 slice).
- S1 실행 step · S1 요약 기록 step · seed step · 정리 step · 트리거 · `workflow_dispatch` inputs 변경.
- 임계값(`p(95)<3000` · `rate<0.01` · `STUB_BASELINE_P95_MS`) 재산정 — 본 slice 는 숫자 0 변경.
- 컨테이너 기동 step 실패까지 가려내는 정교한 조건식(`steps.<id>.outcome` 게이트) 도입 — step `id` 신설이 필요해 diff 가 커진다. S2 · S3 는 합쳐 최대 ~1 분대라 기동 실패 시에도 낭비가 작다(필요하면 follow-up).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (작성 시 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
