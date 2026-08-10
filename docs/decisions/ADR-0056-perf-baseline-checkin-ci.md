---
id: ADR-0056
title: perf 체크인 baseline 정책 — 저장 위치 · 갱신 주체 · 회귀 시 CI fail 여부 · CI 편입 방식
status: ACCEPTED
date: 2026-08-10
relatedTask: [T-1559]
relatedReq: [REQ-048, REQ-047]
supersedes: null
---

# ADR-0056 — perf 체크인 baseline 정책

## Status

**ACCEPTED**. 본 ADR 은 **결정만 박제**하며 코드·workflow·baseline 파일을 만들지 않는다
(본 task 의 diff 는 본 문서 1 개뿐 — `src/` · `test/` · `.github/workflows/` · `package.json`
변경 0). [ADR-0054](ADR-0054-load-resilience-harness-tool.md) 가 PROPOSED 로 남은 이유는
신규 dependency(k6) 도입이 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 대상이기 때문인데,
본 ADR 의 결정은 **기존 dependency·기존 primitive 안에서만** 성립하므로(신규 dependency 0)
같은 유보가 필요 없다. 후속 slice 는 본 결정을 재추론하지 않고 그대로 집행한다.

**본 ADR 은 결정만 박제하며 잔여 4 축은 그대로 존속한다** — [PLAN.md](../PLAN.md) `140 행`
성능 검증 bullet 은 `[ ]` 그대로이고 REQ-048 도 현 상태를 벗어나지 않는다. 완료 선언 0.

## Context

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` 는 부하·
내성 검증의 follow-up 을 5 개로 열거하는데, 그중 **#4 CI 통합**과 **#5 baseline 확정 + 임계
fix** 가 미착수로 남아 있다. 그 사이 S2 조회 latency 축은 slice 25 ~ 29 로 route 5 개
(`GET /api/summaries` · `/api/assessments` · `/api/contributions` · `/api` · `/api/persons`)
를 `confirmOrCompareBaseline` 로 태웠으나,
[test/perf/README.md](../../test/perf/README.md) `1132~1150 행` 이 적시하듯 **다섯 baseline 이
전부 임시 디렉토리 1 회성** 이라 저장소에는 baseline JSON 이 한 건도 남지 않는다. 즉 회귀
탐지의 전제인 **기준선이 영속되지 않는다**.

결정이 필요한 축은 서로 얽혀 있다.

- **판정 primitive 는 이미 존재한다** — [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts)
  의 `BaselineEnvMeta`(`label` · `concurrency` 필수) · `BaselineReport`(p50/p95/p99/throughput/
  errorRate/count/pass) · `resolveBaselinePath(env, baseDir)`, 그리고
  [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) 의
  `writeBaselineFile` · `readBaselineFile` · `compareBaselineFiles` · `baselineFileExists` ·
  `confirmOrCompareBaseline`(판별 union `ConfirmOrCompareResult`) 가 이미 write / read /
  비교 / confirm-or-compare 를 전부 담당한다. **본 ADR 은 판정 로직이 아니라 판정 결과의
  저장 위치 · 갱신 주체 · CI 취급을 결정**한다.
- **CI 는 이미 perf 스위트를 상시 실행한다** — [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
  `234 행` 부근의 `perf test` step(`pnpm test:perf`)이 기본 검사 job 안에서
  `services.postgres` + `prisma migrate deploy` + e2e **이후**에 실행된다. 즉 S2 baseline 을
  붙일 자리는 신설이 아니라 **이미 있는 step** 이다.
- **wall-clock 은 공유 runner 에서 비결정적이다** — GitHub Actions 공유 runner 는 CPU steal ·
  I/O 경합으로 같은 코드에서도 latency 가 흔들린다. 상대 회귀를 곧바로 CI fail 로 승격하면
  main CI 가 상시 red 가 되고(과잉), 반대로 아무 신호도 내지 않으면 회귀를 영원히 못 잡는다
  (과소).
- **부하계획 `§ 3` 의 "baseline 후 fix" 임계가 3 행 남아 있다** — S1 error rate · S2
  p50/throughput · S3 error rate. 이들을 언제 · 누가 · 어떤 근거로 확정 임계로 승격하는지가
  미정이라 매 slice 가 같은 질문을 재추론한다.

본 결정 전까지 T-1555 → T-1557 → T-1558 의 Follow-ups 가 **3 연속 동일 판정**("체크인
baseline + CI job 편입 축은 workflow 편집 + 체크인 JSON + 임계 fix + flaky 정책이 한 덩어리라
cap 을 넘는다 — 진입 전 ADR 1 개로 결정을 먼저 박제할 것")을 planner 로 이월했다. 본 ADR 이
그 판정의 집행이다([CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저").

## Decision

### 1. 체크인 baseline 저장 위치 — `test/perf/baselines/`

repo 안 확정 경로를 **`test/perf/baselines/` 하나**로 못 박는다. 이 값은
`resolveBaselinePath(env, baseDir)` 의 **`baseDir` 인자 하나**일 뿐이며, 파일명·경로 조립
규칙(고정 prefix `baseline-` + `env.label` slug + `.json`, POSIX 결정적 결합)은 **전적으로
기존 `resolveBaselinePath` → `resolveBaselineFilename` 규약에 위임**한다. 본 ADR 은 명명
규칙을 재정의·재구현하지 않는다(DRY — 재구현 0).

귀결: `env.label` 이 파일명 slug 축이므로 **환경별로 baseline 파일이 갈린다**. 예컨대 CI
runner label 은 `baseline-ci-linux-x64.json`, 로컬 측정 label 은 `baseline-local-macbook.json`
로 서로 다른 파일이 된다. 이는 부하계획 `§ 3` "환경 고정"(측정은 환경 종속이라 환경 메타를
함께 기록해 비교 가능하게 한다)의 직접적 귀결이며, 서로 다른 환경의 수치를 한 파일에서
비교하는 오염을 구조적으로 막는다. 대가는 관리 대상 파일 수 증가다(§Consequences 참조).

### 2. 갱신 주체 — 명시적 pr-mode task 만

체크인 baseline 파일은 **사람이 승인 경로를 거치는 `commitMode: pr` task 에서만** 갱신한다.
CI 가 측정 결과를 main 에 자동 commit 하는 방식은 **비채택**한다. 근거는
[CLAUDE.md §9](../../CLAUDE.md) 의 단일 writer 원칙과 force push 금지 정신이다 — CI 가 main 에
직접 쓰기 시작하면 (a) driver / planner / notifier 로 좁혀둔 write 주체 집합이 무너지고,
(b) push contention 이 CI runner 라는 비대화형 주체로 확장되며, (c) 그 commit 이 다시 CI 를
trigger 하는 재귀 구조가 생긴다. 무엇보다 **baseline 갱신은 "느려진 것을 정상으로 승인하는"
판단**이라 자동화가 아니라 리뷰 대상이다.

**언제 갱신이 정당한가** — 다음 세 경우에 한한다: (a) **의도적 성능 변화**(최적화로 좋아졌거나,
기능 추가로 인한 지연 증가를 수용하기로 판단한 경우), (b) **측정 환경 교체**(runner 이미지 ·
DB 버전 · seed 데이터 규모 변경 — 이때는 `env.label` 자체를 바꿔 새 파일로 가는 편이 낫다),
(c) **baseline 레코드 형식 변경**(`BaselineReport` 필드 증감). 갱신 PR 은 본문에 **갱신 사유와
이전·이후 수치**를 함께 적어, 회귀를 baseline 갱신으로 덮는 일이 리뷰에서 보이게 한다.

### 3. 회귀 판정 시 CI fail 여부 — 절대 임계는 fail, 상대 회귀는 초기 관찰

두 판정을 **분리**한다.

- **(a) 절대 임계 위반 → CI fail(red)**. REQ-048 의 p95 < 3000ms 와 부하계획 `§ 3` 의
  error rate < 1% 는 요구사항에서 직접 나온 계약이므로 위반 시 `perf test` step 이 fail 한다.
  이는 현행 동작(`assertS2Threshold` → spec assertion)의 **유지**이며 새 게이트가 아니다.
- **(b) baseline 대비 상대 회귀 → 초기에는 관찰(비-fail)**. `compareBaselineFiles` /
  `confirmOrCompareBaseline` 이 낸 `comparison.regressed === true` 는 **로그와 step 요약으로
  가시화만 하고 exit code 를 바꾸지 않는다**. 근거는 공유 runner 의 wall-clock 비결정성이다 —
  기본 tolerance(latency +10% · errorRate +0.01)는 CPU steal 한 번에도 넘길 수 있어, 곧바로
  fail 로 승격하면 flaky red 가 상시화되고 그 결과 red 자체가 무시된다(게이트 무력화).

**관찰 → fail 승격의 정량 조건**(모두 충족 시 별도 pr-mode task 로 승격):

1. 동일 `env.label` 에서 **연속 20 run 이상** 관측하고,
2. 그 구간의 `regressed=true` 중 **실제 코드 변경이 없는 run 에서 발생한 건(= false positive)이 0** 이며,
3. 관측 분포로 tolerance 를 재산정했을 때(예: p95 표본 표준편차 기반) 재산정 값이 기본값과
   **같거나 더 넉넉**하면 그 값으로 고정한다.

2 를 만족하지 못하면 승격 대신 tolerance 를 넓히거나 측정 반복 수를 늘리는 쪽을 먼저 시도한다.

### 4. CI 편입 방식 — 기존 `perf test` step 재사용

부하계획 `§ 5` #4 의 "상시 PR CI 와 분리(부하는 무거움)" 권고를 받되, 그 권고의 대상은
**k6 기반 S1 배치 · S3 동시성 부하**임을 명확히 한다. 본 ADR 이 다루는 **S2 체크인 baseline
confirm/compare 는 부하가 아니라 이미 상시 CI 에서 돌고 있는 supertest 기반 경량 measure** 다.
따라서 **`.github/workflows/ci.yml` `234 행` 부근의 기존 `perf test` step 을 그대로 재사용**하고,
별도 job 신설 · schedule/manual trigger 분리는 하지 않는다(§Alternatives 로 내림). S1/S3
부하 job 을 별도 trigger 로 분리한다는 `§ 5` #4 결정은 **그대로 유효**하다 — 본 결정은 그
분리 대상에서 S2 baseline 만 제외하는 것이다.

**매 PR CI 소요시간 영향**: perf 스위트는 이미 매 PR 에서 실행 중이므로 추가되는 비용은
baseline JSON 파일 read 1 회 + in-memory 비교(수 ms)뿐이다. 즉 **증가분은 사실상 0** 이고,
`perf test` step 이 실패로 PR 을 막는 조건도 §Decision 3 (a) 로 한정돼 현행과 동일하다.

### 5. 임계 fix 절차 — 다중 run 분포 기반 승격

부하계획 `§ 3` 의 "baseline 후 fix" 표기 행(S1 error rate · S2 p50/throughput · S3 error
rate)을 **관찰 지표 → 확정 pass 임계**로 승격하는 절차는 다음과 같다.

1. **표본 축적** — 체크인 baseline 이 존재하는 상태에서 동일 `env.label` 로 **최소 20 run**
   의 지표를 축적한다(`perf test` step 로그 또는 비교 리포트).
2. **후보 산출** — 관측 분포의 최댓값에 여유 계수를 얹어 임계 후보를 낸다(예: p50 은 관측
   최댓값 × 1.5). 평균이 아니라 **최댓값 기준**으로 잡아 정상 변동이 fail 을 내지 않게 한다.
3. **문서 갱신 주체** — 확정된 수치로 부하계획 `§ 3` 표를 갱신하는 주체는 **별도 doc-sync
   task 를 수행하는 driver** 다([CLAUDE.md §3.1](../../CLAUDE.md) rule 3 에 따라 코드 변경과
   같은 commit 에 섞지 않는다). 갱신 시 그 수치의 **근거 run 수와 측정 환경 label 을 표 각주로
   함께 박제**한다.
4. **over-fitting 방지** — **단일 run 으로 임계를 고정하지 않는다.** 위 1 의 최소 run 수를
   채우지 못했거나 측정 환경이 한 종류뿐이면 해당 행은 "baseline 후 fix" 표기를 유지한다.
   이는 [ADR-0054](ADR-0054-load-resilience-harness-tool.md) 및 부하계획 `§ 3` 의 over-fitting
   방지 원칙을 그대로 승계한 것이다.

## Consequences

### 긍정

- **회귀 탐지의 전제 확보** — baseline 이 임시 디렉토리 1 회성에서 벗어나 repo 에 영속되므로,
  다음 PR 의 측정이 **기준과 비교될 수 있는** 상태가 된다(현재는 매 run 이 항상 `established`
  분기로 떨어져 비교가 발생하지 않는다).
- **CI 비용 증가 0** — 기존 step 재사용이라 job 추가 · runner 시간 증가 · workflow 복잡도
  증가가 없다.
- **primitive 재구현 0** — 저장 위치는 `baseDir` 값 하나, 나머지는 기존 `resolveBaselinePath` ·
  `confirmOrCompareBaseline` 위임이라 후속 slice 의 코드량이 작다(cap 준수 용이).
- **결정 재추론 종료** — 3 연속 이월된 질문이 한 문서로 닫혀, 후속 slice 는 집행만 한다.

### 부정 / trade-off

- **(a) 환경별 baseline 파일 분기로 관리 대상 증가** — `env.label` 이 늘 때마다 파일이 1 개씩
  늘고, 더 이상 쓰지 않는 label 의 stale baseline 이 저장소에 남는다. 어떤 파일이 살아 있는
  기준인지 판별하는 부담이 생기며, 정리 자체가 또 하나의 follow-up 이 된다.
- **(b) 상대 회귀 비-fail 의 잔여 위험** — 절대 임계(p95 < 3000ms) 안쪽에서 일어나는 완만한
  성능 악화는 CI 를 red 로 만들지 않으므로, 탐지가 **로그를 읽는 사람·agent 의 판독에 의존**한다.
  아무도 읽지 않으면 회귀는 절대 임계에 닿을 때까지 누적된다. §Decision 3 의 승격 조건이
  이 위험의 종료 조건이지만, 승격 전까지는 위험이 실재한다.
- **(c) PR diff 노이즈** — baseline JSON 이 repo 에 있으므로 갱신 시 수치 diff 가 PR 에 섞인다.
  §Decision 2 가 갱신을 별도 pr-mode task 로 좁혀 노이즈를 격리하지만, 갱신 빈도가 높아지면
  리뷰 피로가 생긴다.
- **(d) 첫 run 의 자기 승인** — `confirmOrCompareBaseline` 의 `established` 분기는 그 시점
  측정을 무조건 기준으로 삼는다. 최초 확정 run 이 비정상적으로 느린 환경에서 찍히면 느슨한
  기준이 박제되므로, 최초 생성 slice 는 값의 타당성을 사람 눈으로 확인해야 한다.

## Alternatives considered

| 대안 | 내용 | 미채택 근거 |
| --- | --- | --- |
| **CI 자동 commit 으로 baseline 갱신** | `perf test` step 이 새 측정치를 main 에 직접 commit·push | [CLAUDE.md §9](../../CLAUDE.md) 단일 writer 원칙 위배(write 주체가 CI runner 로 확장) · commit 이 CI 를 다시 trigger 하는 재귀 · 무엇보다 **회귀를 자동으로 정상으로 승인**해 게이트가 자기 자신을 무력화 |
| **절대·상대 판정을 합쳐 무조건 CI fail** | `comparison.regressed === true` 를 곧바로 exit 1 로 | 공유 runner wall-clock 비결정성으로 flaky red 상시화 → red 무시 문화 → 게이트 실효 상실. §Decision 3 의 정량 조건을 채운 뒤 승격하는 편이 안전 |
| **baseline 을 repo 밖 아티팩트 저장소에 보관** | Actions artifact · 외부 오브젝트 스토리지에 baseline 적재 | artifact 는 보존 기간이 유한하고 PR diff 로 변화가 보이지 않아 §Decision 2 의 "갱신을 리뷰 대상으로" 원칙과 충돌. 외부 스토리지는 credential 이 필요해 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 대상 |
| **별도 job / schedule·manual trigger 신설** | S2 baseline 비교를 상시 PR CI 밖 별도 job 으로 | S2 measure 는 이미 `perf test` step 에서 상시 실행 중인 경량 측정이라 분리 이득이 없고, 분리하면 **PR 시점에 회귀 신호가 보이지 않아** 탐지 지연. `§ 5` #4 의 분리 권고는 k6 기반 S1/S3 부하에 그대로 유지 |
| **baseline 없이 절대 임계만 유지** | 체크인 baseline 자체를 만들지 않음 | 현 상태 그대로이며 `§ 5` #5 가 미착수로 존속. 절대 임계 안쪽의 점진적 악화를 영원히 탐지 못함 |

## Out of scope

- **체크인 baseline JSON 파일의 실제 생성·commit** — 본 ADR 은 위치만 정하고 파일을 만들지 않는다.
- **`.github/workflows/ci.yml` 편집** — 편입 *방식* 만 결정하고 workflow 는 건드리지 않는다.
- **`test/perf/latency-*.ts` 및 기존 perf-spec 수정** — 판정 primitive 재구현 0, 신규 perf-spec 0.
- **부하계획 `§ 3` 임계 수치의 실제 확정 · `§ 5` item 4/5 본문 갱신 · PLAN `142 행` · REQ-048 재판정** — 별도 doc-sync task.
- **신규 dependency 추가(k6 등)** — [ADR-0054](ADR-0054-load-resilience-harness-tool.md) 소관이자 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 대상.
- **REQ-047 실 scale 부하 · web 렌더 측정 축** — 본 ADR 은 S2 조회 baseline 축만 다룬다.
- **mock perf-spec 30 개의 retire 판단** — T-1536 유보 축 그대로.

## References

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§ 3` 측정 지표·임계 표("baseline 후 fix" 3 행) / `§ 5` #4 CI 통합 · #5 baseline 확정 + 임계 fix
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) — `BaselineEnvMeta` · `BaselineReport` · `resolveBaselineFilename` · `resolveBaselinePath`
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) — `writeBaselineFile` · `readBaselineFile` · `compareBaselineFiles` · `baselineFileExists` · `ConfirmOrCompareResult` · `confirmOrCompareBaseline`
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `234 행` — 기존 `perf test` step
- [test/perf/README.md](../../test/perf/README.md) `1132~1150 행` — 잔여 4 축 · "다섯 baseline 모두 임시 디렉토리 1 회성"
- [ADR-0054](ADR-0054-load-resilience-harness-tool.md) — 같은 계획 문서를 상류로 삼는 선례 · over-fitting 방지 원칙
- [CLAUDE.md](../../CLAUDE.md) §3.1 commit mode / §5 HITL / §9 단일 writer · force push 금지 / §12 언어 정책
- [docs/requirements.md](../requirements.md) — REQ-047 / REQ-048

## Follow-ups

각 항목은 서로 의존하지 않는 독립 slice 로 착수 가능하며(순서 강제 없음), **모두
diff ≤ 300 LOC / 변경 파일 ≤ 5 개 cap 을 지키고, 코드 변경을 동반하면
[CLAUDE.md §3.2](../../CLAUDE.md) R-112 4 항목(happy-path / error path / 분기 / negative
cases 충분 cover)을 준수한다.**

- **(a) 체크인 baseline JSON 최초 생성·commit** — §Decision 1 의 `test/perf/baselines/` 아래
  `confirmOrCompareBaseline` 의 `established` 분기로 파일 1 개를 확정한다. §Consequences (d)
  대로 값의 타당성을 확인한 뒤 commit 한다. cap ≤ 300 LOC / ≤ 5 파일 · R-112 준수(spec 변경
  동반 시 negative 분기 포함).
- **(b) `ci.yml` 편입** — §Decision 4 대로 기존 `perf test` step 을 재사용하되, 상대 회귀
  결과를 로그로 가시화한다(exit code 불변 — §Decision 3 (b)). cap ≤ 300 LOC / ≤ 5 파일 ·
  workflow 변경이므로 `pr` mode + R-112 준수.
- **(c) 부하계획 `§ 3` 임계 fix 갱신** — §Decision 5 의 절차대로 표본이 쌓인 행만 확정 임계로
  승격하고 근거 run 수·환경 label 을 각주로 박제한다. doc-sync 이므로 코드 변경 0 · cap
  ≤ 300 LOC / ≤ 5 파일.
- **(d) PLAN `142 행` · REQ-048 doc-sync** — 위 (a) ~ (c) 진행 상황을 PLAN 과 요구사항 매핑
  표에 반영한다. **본 ADR 만으로는 어떤 완료 표기도 하지 않는다.** doc-sync 이므로 코드 변경
  0 · cap ≤ 300 LOC / ≤ 5 파일.

Refs: T-1559, REQ-048, REQ-047
