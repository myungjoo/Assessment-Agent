---
id: T-1642
title: load-k6 를 s1_persons=133 으로 재 dispatch — 같은 조건 run-to-run 분산 확보 후 부하계획 §3.1·§5 item 5 갱신
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-08-21
dependsOn: [T-1641]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 23/N — 133 표본 2 번째 run 으로 같은 조건 run-to-run 분산 확보(§5 item 5 잔여 ② 첫 절반)."
---

# T-1642 — `s1_persons=133` 재 dispatch 로 같은 조건 run-to-run 분산 확보

## Why

[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 잔여 ②(**반복 run 기반 임계 fix** — 같은 표본 조건의 run-to-run 분산을 확보한 뒤에야 `§3` 표 임계를 확정) 가 그대로 남아 있다. 현재 실측 3 회는 표본 10 이 2 회(T-1637 · T-1639) + 표본 133 이 **1 회뿐**(T-1641, run `32524618230`)이라, 외삽 계수 1 로 1h 예산과 직접 대조되는 **실 scale 축에는 반복 표본이 없다**. 본 slice 는 T-1640 이 연 `s1_persons` input 을 **같은 값 `133` 으로 한 번 더** 사용해 실 scale 축의 첫 run-to-run 쌍을 만들고 수치를 박제한다 (워크플로·스크립트·임계 변경 0 — 순수 측정 + doc-sync).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1`(1·2·3 회차 소제목 구조 — 본 slice 가 4 회차를 덧붙일 자리) 과 `§3` 표 각주(over-fitting 방지로 임계 숫자 무변경) 과 `§5` item 5(잔여 ①②).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `25~52 행` — `SAMPLE_PERSONS`(`__ENV.K6_S1_PERSONS`) · `EXTRAPOLATION_PERSONS = 133` · `BATCH_P95_MS = FULL_RUN_BUDGET_MS × (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS)` 산식과 `vus: 1, iterations: 1`. **표본 133 은 외삽 계수 1** 이며 **단일 iteration 이라 p95 가 곧 단일 표본값** 이라는 점이 본 slice 수치 해석의 전제다.
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `10~20 행`(input `s1_persons` 정의·default `"10"`) 과 S1 실행 step · "S1 실측 요약 기록" step(`tee -a` 메타 7 항목).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 실측 상태 서술(본 slice 가 갱신할 문장).
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D1`·`D4` — LLM stub 격리와 축소 표본 외삽의 한계(반복 run 이어도 남는 미검증 축을 정확히 적기 위함).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 3`). 재 dispatch·재시도 금지 — 실패해도 그 사실을 기록한다.
- [ ] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). **45 분** 넘게 미종료면 대기를 중단하고 그 사실(진행 중이던 step 포함)을 기록한다.
- [ ] `gh run view <id> --log` 로 "S1 실측 요약 기록" step 의 **표본 인원 행이 `133`** 임을 확인한다 — `10` 이면 input 주입 실패이므로 결함으로 기록하고 워크플로는 고치지 않는다(Follow-ups 로 넘긴다).
- [ ] 같은 로그에서 4 회차 수치(`http_req_duration{route:batch}` p95 · `http_req_failed` rate 와 분자/분모 · `iteration_duration` · `http_reqs`)와 환경 메타 7 항목(커널·아키텍처·vCPU·메모리·DB image·대상 image·표본 인원)을 회수한다. 임계 위반으로 k6 가 exit 1 이어도 `if: always()` 기록 step 이 남긴 수치를 그대로 회수해 적는다.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 기존 1~3 회차 소제목을 **삭제·수정 없이** 두고 `#### 4 회차 (T-1642, run <id>, 표본 133 반복)` 소제목을 덧붙인다. 3 회차와 **같은 표본 조건**이므로 batch p95 의 두 값과 그 차이(절대·상대)를 명시하고, 이것이 실 scale 축의 **첫 run-to-run 쌍(표본 2 개)** 임을 적는다.
- [ ] 같은 문서 `§5` item 5 의 잔여 ② 를 결과에 맞게 갱신한다 — 133 축 run-to-run 쌍 확보는 반영하되, **표본 2 개로는 분산 추정이 불충분해 `§3` 표 임계 숫자는 여전히 무변경**임을 명시한다(§3 각주 취지 승계). 잔여 ①(실 dataset seed + `ServiceIdentity` 실 수집)은 그대로 존치.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` R-91 실측 서술을 "baseline 실측 4 회(그중 실 scale 표본 133 이 2 회)" 형태로 갱신한다. `140 행` REQ-047 checkbox 는 `[ ]` **유지** — LLM stub · 수집 왕복 0 · 단일 iteration 한계가 그대로이므로 승격 금지.
- [ ] 변경 파일 2 개(`docs/ops/load-resilience-test-plan.md`, `docs/PLAN.md`) 를 넘지 않는다. 코드·워크플로·스크립트 변경 0 이라 CLAUDE.md §3.2 R-112 unit test 4 항목은 **비적용**(doc-only direct commit) — 대신 위 로그 회수 항목이 검증 수단이다.

## Out of Scope

- `.github/workflows/load-k6.yml` · `test/load/s1-batch.js` · `package.json` 수정 (본 slice 는 측정·기록만).
- `§3` 표의 임계 숫자 확정·변경 (표본 2 개로는 부족 — 별도 slice).
- `s1-batch.js` 의 `iterations` 파라미터화 / VU 프로파일 변경 (별도 pr-mode slice 후보).
- 실 dataset seed(133 명 `Person` + github `ServiceIdentity` 실 수집) 및 LLM stub 해제 — 잔여 ① 은 손대지 않는다.
- PLAN `140 행` checkbox 승격, REQ-047 완료 선언.
- 2 회 이상 dispatch 또는 실패 run 재시도.

## Suggested Sub-agents

`implementer` (dispatch + 로그 회수 + doc 갱신) → 코드 변경 0 이라 `tester` 불요 (direct doc-only, R-110 면제 경로).

## Follow-ups

(작성 시점 비어 있음)
