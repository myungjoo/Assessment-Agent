---
id: T-1645
title: S1 batch stub-조건 baseline 900ms 를 k6 thresholds 에 배선
phase: P5
status: DONE
commitMode: pr
prNumber: 1316
coversReq: [REQ-047]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-08-22
createdAt: 2026-08-22T00:00:00Z
completedAt: 2026-08-22T04:53:54Z
independentStream: load-k6-s1
dependsOn: [T-1644]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: "P5 성능 검증(R-91) — T-1644 가 문서에 확정한 900ms baseline 을 스크립트 게이트로 배선 (외삽 산식 존치)"
---

# T-1645 — S1 batch stub-조건 baseline 900ms 를 k6 thresholds 에 배선

## Why

[PLAN.md](../PLAN.md) `141 행` 이 T-1644 결과를 박제하며 남긴 잔여 한 줄 — "확정된 900ms 를 스크립트
`thresholds` 게이트로 태우는 배선은 pr-mode 별도 task 로 남는다" — 를 집행한다. 현재
[`test/load/s1-batch.js`](../../test/load/s1-batch.js) 의 batch 임계는 1h 예산 선형 외삽
(`FULL_RUN_BUDGET_MS × SAMPLE_PERSONS / 133`) 하나뿐이라, 실 scale run(`s1_persons=133`)에서 임계가
3,600,000ms 로 넓어져 **실측 700~760ms 대의 회귀를 전혀 잡지 못한다**. T-1644 가
[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 표에 확정한 **stub 조건 ·
표본 133 baseline p95 ≤ 900ms** 를 스크립트가 실제로 게이트하게 만들어, R-91 chain 의 관찰 축을
문서에서 실행 게이트로 끌어올린다.

## 설계 결정 (구현자는 이 판단을 재론하지 않는다)

- **선형 외삽 산식은 대체하지 않고 존치**한다. 외삽 임계는 REQ-047 **판정** 게이트(1h 예산)이고
  900ms 는 stub 조건 **관찰용 baseline** 이라 성격이 다르다 (T-1644 가 §3 표에 명시). 둘을 하나로
  합치면 판정 근거가 stub 대표성에 오염된다.
- 따라서 `"http_req_duration{route:batch}"` 의 값 배열에 **두 번째 표현식**을 더한다 — 임계 key 개수는
  2 종 그대로 유지(전역 `http_req_failed` + batch), 배열 원소만 1 → 2.
- baseline 표현식은 **표본 인원이 133 일 때만** 활성화한다 (`SAMPLE_PERSONS === 133`). 기본 표본 10
  같은 축소 run 이나 다른 scale run 에 stub baseline 을 적용하면 근거 없는 red 가 된다. 조건 표현은
  기존 스크립트 규약(분기문 대신 식)을 따라 삼항 + `concat` 또는 배열 spread 로 쓴다.
- 상수는 리터럴 산재 대신 이름 있는 상수 2 개로 둔다 — 예: `STUB_BASELINE_PERSONS = 133`,
  `STUB_BASELINE_P95_MS = 900`. 주석에 "T-1644 §3 표 확정 · stub(ADR-0057 D1) 조건 · REQ-047 판정
  임계 아님" 을 1~2 줄로 남긴다.

## Required Reading

- [docs/tasks/T-1644-s1-batch-p95-threshold-fix.md](T-1644-s1-batch-p95-threshold-fix.md) — 900ms 도출식과 적용 전제.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 표의 S1 행 (임계 정본).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `20~55 행` — `SAMPLE_PERSONS` 정규화 · `BATCH_P95_MS` 산식 · `options.thresholds`.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 다음 지점이 현행 표현을 텍스트로 고정하고 있어 함께 갱신 대상: `routeP95Expression` 헬퍼 정의(`1329 행` 부근)와 그 자체 unit test, `"임계 key 2 종이 목록·순서까지 일치하고 상한이 외삽 산식으로 계산된다"`(`1377 행` 부근), `1432`·`1505 행` 부근 mutation 검출 케이스, `"⑤ S1 임계 산식 상수(133 · 3600000)와 산식 형태가 무변경이다"`(`1956 행` 부근).
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `15 행`·`112 행` — `s1_persons` input 기본값과 주입 경로 (기본 10 이면 baseline 비활성이라는 사실 확인용).

## Acceptance Criteria

- [ ] `test/load/s1-batch.js` 의 `options.thresholds` 에서 `"http_req_duration{route:batch}"` 값이
      외삽 표현식 + (표본 133 일 때만) stub baseline `p(95)<900` 두 원소를 갖는다. 임계 key 목록·순서는
      기존 2 종 그대로이고 `http_req_failed: ["rate<0.01"]` 는 무변경.
- [ ] 외삽 상수·산식(`EXTRAPOLATION_PERSONS = 133`, `FULL_RUN_BUDGET_MS = 3600000`,
      `Math.round(FULL_RUN_BUDGET_MS * (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS))`)이 문자 그대로 남아 있다.
- [ ] **happy path test 1+** — drift-guard smoke spec 에 "표본 133 일 때 batch 임계 배열이 외삽 + 900ms
      2 종" 을 검증하는 케이스 추가 (기존 `s1Script()` 텍스트 파싱 방식 승계).
- [ ] **error path / 방어 test 1+** — `routeP95Expression` (또는 새로 도입한 파서 헬퍼) 이 임계 행 부재 ·
      `p(95)` 아닌 집계자(`avg<`) · thresholds 블록 부재 같은 비정상 입력에서 throw 없이 미발견 정규형을
      돌려주는지 검증 (기존 동형 케이스 승계 · 확장).
- [ ] **분기 cover** — 스크립트의 조건식 두 갈래를 각각 cover: ① 표본 133 → baseline 표현식 포함,
      ② 기본 표본 10 등 133 이 아닌 값 → baseline 표현식 미포함. 스크립트를 실행할 수 없으므로 조건식
      텍스트가 `STUB_BASELINE_PERSONS` 비교를 담고 있음을 고정하는 assertion 으로 대체 가능하되, 그 경우
      비교 대상 상수 2 개(`133` · `900`)와 비교 연산자 형태를 모두 assert 한다.
- [ ] **negative cases 충분 cover** — 최소 4 종 mutation 이 검출돼 fail 하는 것을 확인: ① 900 → 다른 숫자로
      변조, ② baseline 표현식 삭제, ③ 외삽 표현식을 리터럴로 굳힘(기존 `1505 행` 케이스 유지), ④ 조건식을
      제거해 baseline 이 무조건 활성화되는 변조.
- [ ] 기존 drift-guard 케이스 중 본 변경으로 깨지는 것(임계 배열 원소 1 개 가정)이 **모두 갱신**되고,
      `pnpm test:smoke` 가 green.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 coverage 수치 불변임을 확인.
- [ ] 변경 파일 ≤ 5 개 · diff ≤ 300 LOC.

## Out of Scope

- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 의 "게이트 미배선" 서술 갱신 — direct-mode
  doc-sync 로 후속 slice (§3.1 mixed 금지).
- k6 재 dispatch 실측 run (배선이 실제 run 에서 통과하는지 확인) — 별도 slice.
- S2 · S3 행의 `baseline 후 fix` 임계 — 해당 축 실측 0 회라 손대지 않는다.
- `load-k6.yml` · `package.json` 수정 (`s1_persons` 기본값 변경 포함).
- 133 명 실 dataset seed · `ServiceIdentity` 실 수집 축 (PLAN `147~148 행`).
- R-92 per-route perf-spec 신규 slice (오너 지시로 큐잉 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음)
