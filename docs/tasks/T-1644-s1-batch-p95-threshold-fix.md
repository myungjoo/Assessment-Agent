---
id: T-1644
title: S1 batch p95 stub-조건 baseline 임계 확정 (§3 표 숫자 fix)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-08-22
createdAt: 2026-08-22T00:00:00Z
independentStream: load-k6-s1
dependsOn: [T-1643]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
plannerNote: "P5 성능 검증(R-91) — T-1643 이 판정 (a) 로 연 임계 확정 slice 를 문서 축에서 1 회 집행"
---

# T-1644 — S1 batch p95 stub-조건 baseline 임계 확정 (§3 표 숫자 fix)

## Why

[PLAN.md](../PLAN.md) `140~141 행` "성능 검증 · R-91" bullet 의 잔여 중 **임계 fix** 축을 닫는다.
T-1641 ~ T-1643 이 실 scale 표본(`s1_persons=133`) 반복 run 3 개(760.91 → 730.81 → 711.23ms)를
쌓아 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 잔여 ② 가
**판정 (a) — 임계 확정 별도 slice 착수 가능** 으로 갱신됐다. 본 task 가 그 "별도 slice" 이며,
같은 판정이 지시한 대로 평균 기반의 빡빡한 숫자 대신 **마진 임계**를 문서 `§3` 표에 확정하고
그 임계가 **stub 조건 baseline** 임을 함께 박제한다. 측정은 더 하지 않는다 — 남은 지배적
불확실성이 분산이 아니라 작업부하 대표성이라 반복을 더 쌓아도 줄지 않기 때문이다(`§5` item 5 ㉢).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§3` 임계 표 +
  각주("임계 fix 시점") + `§3.1` 3·4·5 회차(표본 133 실측 3 건) + `§5` item 5 잔여 ②
- [docs/PLAN.md](../PLAN.md) `140~141 행` (성능 검증 / R-91 bullet)
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md)
  — `D1`(LLM stub) · `D4`(선형 외삽 산식) 만 확인. 결정 변경 없음
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `25~55 행` — 현행 `BATCH_P95_MS` 산식과
  `thresholds` 블록을 **읽기만** 한다(본 task 는 스크립트를 수정하지 않는다)

## Acceptance Criteria

- [ ] `§3` 임계 표에 S1 **관찰용 latency 임계 행**을 추가한다 —
      지표 `http_req_duration{route:batch}` p95, 임계 **≤ 900ms (stub 조건 baseline, 표본 133)**.
      도출식을 표 아래(또는 각주)에 1~2 줄로 명시: 평균 **734.32ms** + 3 × 표본표준편차 **25.02ms**
      = **809.38ms** 를 100ms 단위 올림 → **900ms**, 실측 max **760.91ms** 보다 크다.
- [ ] 같은 행/각주에 **REQ-047 판정 임계가 아님**을 명시한다 — REQ-047 판정은 1h 예산
      (`3,600,000ms`, 스크립트 `FULL_RUN_BUDGET_MS`) 그대로 유지하고, 본 900ms 는 LLM stub
      (ADR-0057 `D1`) · 수집 왕복 0 · 단일 iteration 조건의 **회귀 관찰용** 기준선임을 적는다.
- [ ] `§3` 표의 **S1 배치 실패·재시도율 행**에서 `(baseline 후 fix)` 태그를 해제하고
      `error rate < 1%` 로 확정한다 — 5 회 run 모두 `http_req_failed` **0.00%**
      (0/26 · 0/26 · 0/272 · 0/272 · 0/272) 라는 근거를 표 아래 문장에 남긴다.
- [ ] S2 · S3 행의 `baseline 후 fix` 표기는 **무변경** — 해당 축은 baseline 실측이 아직 0 이라
      본 slice 범위 밖임을 각주 1 줄로 밝힌다.
- [ ] `§3` 각주("임계 fix 시점")를 갱신한다 — S1 축 임계 fix 가 본 회차로 **완료**됐고,
      3 표본이 단조 감소라 추세 성분을 배제할 수 없어 `max` 가 아닌 **평균 + 3σ 마진**을
      택했다는 근거를 1~2 줄로 박제한다.
- [ ] `§5` item 5 의 **잔여 ②** 를 "해소 — 임계 확정 완료(본 task)" 로 갱신하고,
      **잔여 ①(실 dataset seed · 실 수집 왕복)** 은 그대로 존치한다.
- [ ] [PLAN.md](../PLAN.md) `141 행`(R-91 bullet)에 임계 확정 사실과 확정 숫자를 반영한다.
      `140 행` 의 checkbox 는 `[ ]` 유지 — 실 수집 축(잔여 ①)이 아직 미검증이다.
- [ ] doc-only 임을 검증한다: `git diff --name-only` 결과가
      `docs/ops/load-resilience-test-plan.md` 와 `docs/PLAN.md` **2 개뿐**이어야 하며
      `test/load/*` · `.github/workflows/*` · `package.json` 이 포함되면 안 된다.
- [ ] 본 task 는 **doc-only direct commit** 이라 CLAUDE.md §3.2 R-112 4 종 test 항목이
      적용되지 않는다(production code 변경 0 LOC · 신규 public symbol 0). 그 사실을
      commit trail 의 `TESTER: added: none` 또는 생략으로 반영한다.

## Out of Scope

- [test/load/s1-batch.js](../../test/load/s1-batch.js) 의 `thresholds` / `BATCH_P95_MS` 배선 변경
  — 확정된 900ms 를 스크립트 게이트로 태우는 일은 **pr-mode 별도 task**(아래 Follow-ups).
- `load-k6.yml` workflow · `package.json` script 수정, 신규 run dispatch.
- S2(조회 지연 p50/throughput) · S3(동시성 error rate) 의 `baseline 후 fix` 임계 확정.
- 실 dataset seed(133 명 `Person` + github `ServiceIdentity` + 실 수집 왕복) — `§5` item 5 잔여 ①.
- ADR-0054 / ADR-0057 의 결정 본문 수정(결정 변경 아님 — 수정 필요 시 pr-mode 별도 task).

## Suggested Sub-agents

`implementer` (문서 편집 단독). architect · tester 호출 불요 — 결정 변경 0, 코드 변경 0.

## Follow-ups

- (신설 후보) 확정된 stub-조건 관찰 임계 **900ms** 를 `test/load/s1-batch.js` 의
  `thresholds` 에 `route:batch` 관찰 게이트로 배선 — pr-mode, 표본 133 조건에서만 적용되도록
  분기 + spec 필요.

---

## 완료 기록

- **완료 시각**: 2026-08-22T02:52Z (direct commit `f7bf6761`, 2 파일 +40/-21)
- **결과 요약**: 실 scale 표본 3 개(760.91 / 730.81 / 711.23ms, 평균 734.32ms · 표본표준편차
  25.02ms)에서 **평균 + 3σ = 809.38ms → 100ms 올림 = p95 ≤ 900ms** 를 도출해
  `load-resilience-test-plan.md` `§3` 표에 **S1 관찰용 latency** 행으로 확정. max 대신 평균+3σ 를
  쓴 이유(3 표본 단조 감소 추세 성분 흡수)와 실측 max 대비 여유 139.09ms 를 도출식과 함께 병기.
  같은 표의 **S1 실패·재시도율**은 "baseline 후 fix" 해제 → **error rate < 1%** 확정(근거 = 5 회 run
  전부 `http_req_failed` 0.00%). 본 임계가 **관찰용 baseline 이지 REQ-047 판정 임계가 아님**을 명시
  (REQ-047 판정은 1h 예산 `FULL_RUN_BUDGET_MS` 유지) + **stub 조건(ADR-0057 `D1`) · 표본 인원 133**
  전제 병기. S2 · S3 행 무변경, `§3` 각주 "S1 fix 완료" 갱신, `§5` item 5 잔여 ② **해소** ·
  잔여 ① 존치, PLAN `141 행` 반영 · `140 행` checkbox `[ ]` 유지.
- **CI**: main run `32547132889` conclusion `success` (본 turn 안에서 확인 — R-114 충족).
