---
id: T-1696
title: S1 stub baseline 임계 1100ms → 1200ms 코드 동기 (규칙 ④ split 앞단, 스크립트 + drift guard 동시)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 50
estimatedFiles: 2
independentStream: load-k6-s1-baseline
dependsOn: [T-1695]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
created: 2026-08-25
plannerNote: P5 R-91 chain — T-1695 Follow-up ① (T-1668 규칙 ④ 2 task split 앞단 코드 pr, 상수 + drift guard 대조군 동시 갱신)
---

# T-1696 — S1 stub baseline 임계 1100ms → 1200ms 코드 동기 (규칙 ④ split 앞단)

## Why

[T-1695](T-1695-s1-15-s2-5-log-reread.md) 가 회수한 S1 15 회차(run `32843613484`)에서 관찰용 게이트가 `✗ 'p(95)<1100' p(95)=1.15s` 로 크로스해 [T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 재확정 규칙의 트리거 **①-(a)** 와 **①-(b)** 가 **둘 다 발화**했고, 규칙 ②(실 scale 표본 전량 12 개 · outlier 제거 0 · 평균 `824.73ms` + 3 × 표본표준편차 `124.70ms` = `1198.83ms` → 100ms 올림)로 새 관찰용 임계 **`1200ms`** 가 기계 산정됐다. T-1695 는 규칙 ④ 대로 **산출 4 종만** 박제하고 숫자는 한 글자도 바꾸지 않았다. 본 slice 는 그 **앞단(코드 `pr`)** 으로, `test/load/s1-batch.js` 의 `STUB_BASELINE_P95_MS` 와 그 값을 문자열로 대조하는 drift guard smoke 의 `S1_STUB_BASELINE_P95_MS` · mutation 대조군을 **같은 commit** 에서 동기한다(분리하면 drift guard 가 즉시 red). 직전 집행 900 → 1100 의 선례는 T-1676(PR #1334 → main `ebe6d8f8`) 이다. PLAN `140~141 행` R-91 chain.

## Required Reading

- [test/load/s1-batch.js](../../test/load/s1-batch.js) `39~46 행` — `STUB_BASELINE_PERSONS = 133;` / `STUB_BASELINE_P95_MS = 1100;` 선언과 그 위 6 줄 주석(“REQ-047 판정 임계가 아니라 회귀 감시용” 성격 구분 + T-1675 재확정 근거). 본 slice 가 바꾸는 것은 **숫자 1 개 + 주석의 근거 pointer** 뿐이다.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `59~78 행` — `export const options` 의 `summaryTrendStats`(T-1688 `p(99)` 열) 와 `thresholds` 의 `http_req_duration{route:batch}` 배열(외삽 원소 + `filter` 로 표본 133 에만 얹는 baseline 원소), `http_req_failed: ["rate<0.01"]`. **구조 · 조건식 · 판정 임계 · percentile 열은 전부 무변경**.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1318~1323 행` — `S1_STUB_BASELINE_PERSONS` / `S1_STUB_BASELINE_P95_MS = 1100` 상수와 그 JSDoc(`표본 133 · p95 1100ms`, T-1676 재확정 pointer).
- 같은 파일 `1412~1425 행` 부근 `baselineWiringIntact()` — 스크립트 원문에 `const STUB_BASELINE_P95_MS = <값>;` 이 있는지 문자열 대조하는 불변식. 상수만 바꾸면 자동으로 따라온다(로직 수정 불요).
- 같은 파일 `1471~1488 행` `it("(T-1645) batch 임계 배열이 외삽 + 표본 133 stub baseline 1100ms 2 종이다", ...)` — **it 제목의 `1100ms` 문자열**도 함께 갱신 대상.
- 같은 파일 `1673~1700 행` `it("(T-1645) baseline 배선 mutation 4 종이 전부 검출된다", ...)` — mutation ① 이 `"STUB_BASELINE_P95_MS = 1100;"` → `"...= 1500;"`, ①-b 가 `"...= 800;"` 리터럴 치환이라 **원본 리터럴을 새 값으로 바꾸지 않으면 `replace` 가 no-op 이 되어 검출력이 조용히 사라진다**(`expect(shifted).not.toBe(script)` · `expect(lowered).not.toBe(script)` 가 이를 잡는다). 변조 후 값(`1500` · `800`)은 새 baseline 과 달라야 한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `248~281 행` — T-1668 규칙 ① ~ ④ 와 “성격 구분 불변”. 특히 ④ 의 2 task split 경로, ③ 의 하향 금지 · outlier 제거 금지 · 새 산정식 금지.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `1170~1190 행` — `#### 15 회차` 의 트리거 발화 판정과 **산정 결과 4 종**(표본 12 개 · 평균 `824.73ms` · 표본표준편차 `124.70ms` · 올림 전 `1198.83ms` → 올림 후 `1200ms`). 본 slice 는 이 문서를 **편집하지 않는다**(뒷단 doc `direct` slice 소관) — 값 인용용으로만 읽는다.

## Acceptance Criteria

- [ ] [test/load/s1-batch.js](../../test/load/s1-batch.js) 의 `const STUB_BASELINE_P95_MS = 1100;` → `= 1200;` 로 **숫자 1 개만** 변경. `STUB_BASELINE_PERSONS = 133` · `EXTRAPOLATION_PERSONS` · `FULL_RUN_BUDGET_MS` · `BATCH_P95_MS` 산식 · `http_req_failed: ["rate<0.01"]` · `filter` 조건식 · `summaryTrendStats` 배열은 **문자 단위 무변경**(판정 게이트와 관찰 게이트의 성격 구분 불변).
- [ ] 같은 선언 위 주석의 재확정 근거를 **이번 회차 기준으로 갱신**(1~2 줄 증가 이내) — T-1668 규칙 ①-(a)·①-(b) 동시 발화(S1 15 회차 `p(95)=1.15s` 크로스) · T-1695 산정(실 scale 표본 12 개 평균 + 3σ = `1198.83ms` → 100ms 올림) · 성격은 그대로 관찰용 회귀 감시라는 점. 주석은 한국어(§12), 새 산정식 서술 · 하향 언급 0. 기존 T-1675/1030.18ms 서술은 **이력으로 남기거나 새 근거로 치환** 중 하나를 택하되 사실 왜곡 0.
- [ ] [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 의 `const S1_STUB_BASELINE_P95_MS = 1100;` → `= 1200;` + 그 JSDoc 의 `1100ms` 표기 갱신(재확정 출처로 T-1695 pointer 1 구절 포함).
- [ ] 같은 파일의 **`1100` 잔재 전수 정리** — `it("(T-1645) batch 임계 배열이 … stub baseline 1100ms 2 종이다")` 제목, mutation ① 주석(`① 1100 → 다른 숫자로 변조`), mutation ① · ①-b 의 원본 리터럴 `"STUB_BASELINE_P95_MS = 1100;"` 를 모두 새 값 기준으로 갱신. baseline 과 무관한 다른 숫자 fixture(예: `["avg<900"]` 합성 문자열 · 외삽 고정 리터럴 `270676`)는 **무변경**임을 확인.
- [ ] **happy-path 검증** — `baselineWiringIntact(s1Script())` 가 여전히 `true`, `routeP95Expressions(script, "batch")` 가 `["${BATCH_P95_MS}", "${STUB_BASELINE_P95_MS}"]` 2 종 그대로, `thresholdKeys(script)` 가 `S1_THRESHOLD_KEYS` 2 종 그대로임을 기존 spec 이 통과로 증명.
- [ ] **error path / negative 검증** — mutation 4 종(① 값 상향 변조 · ①-b 값 하향 변조 · ② baseline 표현식 삭제 · ③ 외삽 리터럴 고정 · ④ 조건식 제거)이 **전부 `baselineWiringIntact() === false`** 로 검출되고, ① · ①-b 의 `expect(...).not.toBe(script)` 가 통과(치환이 실제로 일어났음 = 검출력 유실 0)함을 확인. 변조 후 값(`1500` · `800`)이 새 baseline `1200` 과 우연히 같지 않은지도 확인.
- [ ] **branch cover** — baseline 원소가 표본 133 일 때만 얹히는 두 갈래(`SAMPLE_PERSONS === STUB_BASELINE_PERSONS` 참/거짓)를 고정하는 기존 `it("(T-1645) baseline 원소의 두 갈래가 표본 133 비교식 하나로만 갈린다")` 가 새 값에서도 통과. 본 slice 는 **새 분기를 만들지 않는다** — 분기 신설 0 임을 PR 본문에 1 줄 명시.
- [ ] **negative cases 충분 cover** — 위 mutation 5 종 외에 임계 리터럴 고정 검출(`임계가 리터럴 상수로 굳어있지 않다`), 임계 key 목록 · 순서 불변, `rate<0.01` 재산정 0 단언, `summaryTrendStats` 열 구성 단언(T-1688 배선)이 모두 green.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전량 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 slice 는 `src/` 를 건드리지 않으므로 coverage 수치 변동 0 이어야 한다.
- [ ] 변경 파일 **2 개** 유지. `docs/` · `.github/workflows/load-k6.yml` · `scripts/daily-test.sh` · `package.json` · `src/` 는 무변경(문서 숫자 갱신은 뒷단 `direct` slice).

## Out of Scope

- **문서 숫자 갱신** — [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 임계 표 · 도출식 각주 · T-1668 규칙 소절(`248~281 행`) · `§5` item 5 의 `1100ms` 표기는 본 slice 에서 **손대지 않는다**. 규칙 ④ 의 뒷단 `direct` slice 소관이며, 한 task 로 합치면 `commitMode` 가 갈린다(CLAUDE.md §3.1 rule 3).
- **새 산정식 · outlier 제거 · 임계 하향 재검토** — 규칙 ② · ③ 이 명시 금지. 본 slice 는 T-1695 가 이미 기계 산정한 `1200` 을 **대입만** 한다(재계산 0).
- **판정 임계(`FULL_RUN_BUDGET_MS` / `BATCH_P95_MS` 외삽 산식) 변경** — REQ-047 판정 게이트는 별개 성격이라 불변.
- **새 `workflow_dispatch` · rerun · 재시도** — 본 slice 는 부하 job 을 발화하지 않는다. 새 값이 실 run 에서 `✓` 로 도는지 확인은 다음 dispatch slice 소관.
- **`scripts/daily-test.sh` leg 추가 · 변경** — leg 를 건드리면 drift-guard smoke spec 3 개(T-0791 · T-0944 · T-0947) 동기가 강제돼 5 파일 cap 을 깬다(Q-0054 선례). 본 slice 는 leg 를 손대지 않는다.
- **`latency cliff` 판정 근거 서술 · 설계 조항 ⑥ 표시 수단(후보 A · B) 결정** — T-1694 Follow-up ① 로 대기 중인 별도 doc slice.
- **`K6_SEED_PERSONS` 상한 상향 · S3 축 dataset 교체 · S2 재 dispatch** — 각각 별도 slice.
- **helper 신설 · spec 구조 리팩터** — 기존 `baselineWiringIntact` / `routeP95Expressions` / `thresholdKeys` 계약 위에서만 작업(신규 helper 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
