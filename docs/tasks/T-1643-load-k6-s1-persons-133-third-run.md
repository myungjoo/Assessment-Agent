---
id: T-1643
title: load-k6 를 s1_persons=133 으로 3 번째 dispatch — 실 scale 표본 3 개로 기술통계 산출 후 임계 fix 착수 판정
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-08-22
dependsOn: [T-1642]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 24/N — 133 축 3 번째 반복 run 으로 표본 3 개 확보, 분산 추정 가능성과 임계 fix 착수 여부를 판정."
---

# T-1643 — `s1_persons=133` 3 번째 dispatch 로 실 scale 표본 3 개 확보

## Why

[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 잔여 ②(**반복 run 기반 임계 fix**)는 T-1642 가 실 scale 축의 첫 run-to-run **쌍**(760.91ms → 730.81ms)까지만 진전시켰고, "표본 2 개로는 표준편차·신뢰구간을 말할 수 없다"는 이유로 `§3` 표 임계 숫자는 여전히 무변경이다. 본 slice 는 같은 조건(`s1_persons=133`)으로 **세 번째** run 을 1 회 dispatch 해 실 scale 축 표본을 **3 개**로 만들고, 3 표본 기술통계(평균·범위·표준편차)를 박제한 뒤 **임계 fix 착수가 가능한지 / 표본을 더 쌓아야 하는지를 문서에 명시적으로 판정**한다. 오너 지시(PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 24/N 이며, 워크플로·스크립트·임계 숫자 변경 0 인 순수 측정 + doc-sync 다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1`(1~4 회차 소제목 구조 — 본 slice 가 5 회차를 덧붙일 자리, 특히 `190~226 행` 의 4 회차 서술 형식) + `§3` 표 각주(over-fitting 방지로 임계 숫자 무변경) + `§5` item 5(잔여 ①②).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `25~52 행` — `SAMPLE_PERSONS`(`__ENV.K6_S1_PERSONS`) · `EXTRAPOLATION_PERSONS = 133` · `BATCH_P95_MS = FULL_RUN_BUDGET_MS × (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS)` 산식과 `vus: 1, iterations: 1`. **표본 133 은 외삽 계수 1**, **단일 iteration 이라 p95 가 곧 단일 표본값** 이라는 점이 본 slice 통계 해석의 전제다.
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `10~20 행`(input `s1_persons` 정의·default `"10"`) 과 S1 실행 step · "S1 실측 요약 기록" step(`tee -a` 메타 7 항목).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 실측 상태 서술(본 slice 가 갱신할 문장), `144 행` 오너 지시.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D1`·`D4` — LLM stub 격리와 축소 표본 외삽의 한계(반복 run 이어도 남는 미검증 축을 정확히 적기 위함).

## Acceptance Criteria

- [x] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 3`). 재 dispatch·재시도 금지 — 실패해도 그 사실을 기록한다.
- [x] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). **45 분** 넘게 미종료면 대기를 중단하고 그 사실(진행 중이던 step 포함)을 기록한다.
- [x] `gh run view <id> --log` 로 "S1 실측 요약 기록" step 의 **표본 인원 행이 `133`** 임을 확인한다 — `10` 이면 input 주입 실패이므로 결함으로 기록하고 워크플로는 고치지 않는다(Follow-ups 로 넘긴다).
- [x] 같은 로그에서 5 회차 수치(`http_req_duration{route:batch}` p95 · `http_req_failed` rate 와 분자/분모 · `iteration_duration` · `http_reqs`)와 환경 메타 7 항목(커널·아키텍처·vCPU·메모리·DB image·대상 image·표본 인원)을 회수한다. 임계 위반으로 k6 가 exit 1 이어도 `if: always()` 기록 step 이 남긴 수치를 그대로 회수해 적는다. 메타 7 항목이 3·4 회차와 **다른 항목이 있으면 그 차이를 명시**한다(비교 가능성 판단의 전제).
- [x] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 기존 1~4 회차 소제목을 **삭제·수정 없이** 두고 `#### 5 회차 (T-1643, run <id>, 표본 133 3 회째)` 소제목을 덧붙인다. 소제목 제목의 회차 수와 `§3.1` 헤더의 "N 회분" 표기를 함께 맞춘다.
- [x] 같은 5 회차 항목에 **실 scale 표본 3 개(3·4·5 회차)의 기술통계**를 batch p95 기준으로 적는다 — 세 값 나열 · 평균 · 범위(max−min) · 표준편차(표본표준편차, 계산식 또는 계산 근거 1 줄 포함) · 평균 대비 상대 변동폭(%). `iteration_duration` 과 `http_req_failed` 도 세 회차 값을 함께 나열한다.
- [x] 같은 문서 `§5` item 5 의 잔여 ② 를 결과에 맞게 갱신하되, **임계 fix 착수 가능 여부를 명시적으로 판정**한다 — (a) 3 표본 분산이 충분히 작아 `§3` 표 임계 확정을 별도 slice 로 착수한다, 또는 (b) 표본을 더 쌓아야 한다, 둘 중 하나를 **판정 근거(위 표준편차·범위 수치)와 함께** 한 문장 이상으로 적는다. 잔여 ①(실 dataset seed + `ServiceIdentity` 실 수집)은 그대로 존치.
- [x] [docs/PLAN.md](../PLAN.md) `141 행` R-91 실측 서술을 "baseline 실측 5 회(그중 실 scale 표본 133 이 3 회)" 형태로 갱신하고 본 run id·기술통계 요약(평균·범위)을 한 구절로 반영한다. `140 행` REQ-047 checkbox 는 `[ ]` **유지** — LLM stub · 수집 왕복 0 · 단일 iteration 한계가 그대로이므로 승격 금지.
- [x] 변경 파일 2 개(`docs/ops/load-resilience-test-plan.md`, `docs/PLAN.md`) 를 넘지 않고 diff ≤ 300 LOC. 코드·워크플로·스크립트 변경 0 이라 CLAUDE.md §3.2 R-112 unit test 4 항목은 **비적용**(doc-only direct commit) — 대신 위 로그 회수 항목이 검증 수단이다.

## Out of Scope

- `.github/workflows/load-k6.yml` · `test/load/s1-batch.js` · `package.json` 수정 (본 slice 는 측정·기록·판정만).
- `§3` 표의 임계 **숫자 확정·변경** — 본 slice 는 착수 가능 여부 판정까지만이고, 실제 fix 는 별도 slice.
- `s1-batch.js` 의 `iterations`·VU 프로파일 파라미터화 (별도 pr-mode slice 후보).
- 실 dataset seed(133 명 `Person` + github `ServiceIdentity` 실 수집) · LLM stub 해제 — 잔여 ① 은 손대지 않는다.
- PLAN `140 행` checkbox 승격, REQ-047 완료 선언.
- R-92 per-route perf-spec 신규 slice (오너 지시로 큐잉 금지 유지).
- 2 회 이상 dispatch 또는 실패 run 재시도.

## Suggested Sub-agents

`implementer` (dispatch + 로그 회수 + 기술통계 산출 + doc 갱신) → 코드 변경 0 이라 `tester` 불요 (direct doc-only, R-110 면제 경로).

## Follow-ups

(작성 시점 비어 있음)

## 결과 (2026-08-22 완료)

**Status: DONE.** `gh workflow run load-k6.yml --ref main -f s1_persons=133` 을 **정확히 1 회** dispatch 해 run **32540981922**(head sha `a9a08e43`, job 00:38:26Z~00:40:45Z 약 2분 19초) 를 얻었고 **conclusion `success`**(전 step success, 45 분 대기 임계 훨씬 이내) 였다. "S1 실측 요약 기록" step 로그의 표본 인원 행이 `| 표본 인원 (K6_S1_PERSONS) | 133 |` 이라 input 주입 성공(주입 실패 `10` 없음).

5 회차 수치: `http_req_duration{route:batch}` p95 **711.23ms**(임계 `p(95)<3600000ms` 통과) · `http_req_failed` **0.00%(0/272)** · `iteration_duration` **712.30ms**(iterations 1) · `http_reqs` **272**(194.61 req/s). 환경 메타 7 항목은 3·4 회차와 **전부 동일**(커널 `Linux 6.17.0-1022-azure` · `x86_64` · vCPU 4 · 메모리 15Gi · `postgres:16-alpine` · `assessment-agent:load` · 표본 133) — 다른 항목 없음.

실 scale 표본 3 개(3·4·5 회차) batch p95 기술통계: 760.91 · 730.81 · 711.23ms → **평균 734.32ms · 범위 49.68ms · 표본표준편차 25.02ms**(편차 제곱합 1252.49 / 자유도 2 = 626.25 의 제곱근) · 범위 상대폭 6.77% · **변동계수 3.41%**. `iteration_duration` 은 761.86 · 731.89 · 712.30ms(평균 735.35ms), `http_req_failed` 은 세 회 모두 0.00%(0/272).

**판정: (a) 임계 확정을 별도 slice 로 착수 가능.** 근거 — 산포가 평균의 3~7% 로 작고, 세 값 모두 1h 예산의 약 0.02% 라 여유가 3 자릿수 배수이며, 남은 지배적 불확실성은 분산이 아니라 stub 조건의 **작업부하 대표성**이라 같은 조건 반복으로는 줄지 않는다. 다만 세 값이 단조 감소라 추세 성분을 배제할 수 없어, fix slice 는 **max 또는 평균+k·표준편차 형태의 마진 임계** + "stub 조건 baseline" 명시로 잡아야 한다. 본 slice 는 판정까지이고 `§3` 표 숫자는 무변경. 잔여 ①(실 dataset seed + `ServiceIdentity` 실 수집) 존치, PLAN `140 행` checkbox `[ ]` 유지. 워크플로·스크립트 변경 0.
