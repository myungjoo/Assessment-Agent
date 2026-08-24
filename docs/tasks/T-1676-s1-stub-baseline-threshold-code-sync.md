---
id: T-1676
title: S1 stub baseline 임계 900ms → 1100ms 코드 동기 (규칙 ④ split 앞단, 스크립트 + drift guard 동시)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 40
estimatedFiles: 2
independentStream: load-k6-s1-baseline
dependsOn: [T-1675]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
created: 2026-08-24
plannerNote: P5 R-91 chain 57/N — T-1675 Follow-up ① (규칙 ④ split 앞단 코드 pr, 상수 + drift guard 대조군 동시 갱신)
---

# T-1676 — S1 stub baseline 임계 900ms → 1100ms 코드 동기 (규칙 ④ split 앞단)

## Why

[T-1675](T-1675-load-k6-s1-11th-run-recovery.md) 가 S1 11 회차(run `32746598803`)를 회수하면서 [T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 재확정 규칙의 **트리거 ①-(a)** 가 실 run 에서 처음 충족됐고, 규칙 ②(실 scale 표본 전량 · outlier 제거 0 · 평균 + 3σ = `1030.18ms` → 100ms 올림)로 새 관찰용 임계 **`1100ms`** 가 기계 산정됐다. 다만 T-1675 는 **대입 결과만** 박제하고 숫자는 한 글자도 바꾸지 않았다 — 규칙 ④ 가 집행 경로를 **2 task split(코드 `pr` → 문서 `direct`)** 로 못 박았기 때문이다(CLAUDE.md §3.1 rule 3: 한 task 가 `pr`/`direct` 대상을 섞으면 split). 본 slice 는 그 **앞단(코드 `pr`)** 으로, `test/load/s1-batch.js` 의 `STUB_BASELINE_P95_MS` 와 그 값을 대조하는 drift guard smoke 의 `S1_STUB_BASELINE_P95_MS` · mutation 대조군을 **같은 commit** 에서 동기한다(drift guard 가 두 값을 문자열로 대조하므로 분리하면 즉시 red). PLAN `140~141 행` R-91 chain.

## Required Reading

- [test/load/s1-batch.js](../../test/load/s1-batch.js) `38~44 행` — `STUB_BASELINE_PERSONS = 133;` / `STUB_BASELINE_P95_MS = 900;` 선언과 그 위 3 줄 주석(“REQ-047 판정 임계가 아니라 회귀 감시용” 성격 구분). 본 slice 가 바꾸는 것은 **숫자 1 개 + 주석의 근거 pointer** 뿐이다.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `54~72 행` — `options.thresholds` 의 `http_req_duration{route:batch}` 배열(외삽 원소 + `filter` 로 표본 133 에만 얹는 baseline 원소)과 `http_req_failed: ["rate<0.01"]`. **구조 · 조건식 · 판정 임계는 무변경**.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1316~1322 행` — `S1_STUB_BASELINE_PERSONS` / `S1_STUB_BASELINE_P95_MS` 상수와 그 JSDoc(`표본 133 · p95 900ms`).
- 같은 파일 `1412~1422 행` `baselineWiringIntact()` — 스크립트 원문에 `const STUB_BASELINE_P95_MS = <값>;` 이 있는지 문자열 대조하는 불변식. 상수만 바꾸면 자동으로 따라온다(로직 수정 불요).
- 같은 파일 `1466~1490 행` `it("(T-1645) batch 임계 배열이 외삽 + 표본 133 stub baseline 900ms 2 종이다", ...)` — **it 제목의 `900ms` 문자열**도 함께 갱신 대상.
- 같은 파일 `1668~1690 행` `it("(T-1645) baseline 배선 mutation 4 종이 전부 검출된다", ...)` — mutation ① 이 `"STUB_BASELINE_P95_MS = 900;"` → `"...= 1500;"` 리터럴 치환이라 **원본 리터럴을 새 값으로 바꾸지 않으면 `replace` 가 no-op 이 되어 검출력이 조용히 사라진다**(`expect(shifted).not.toBe(script)` 가 이를 잡는다). 변조 후 값(`1500`)은 새 baseline 과 달라야 한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `222~249 행` — T-1668 규칙 ② · ③ · ④. 특히 ④ 의 2 task split 경로와 ③ 의 하향 금지 · 새 산정식 금지. **본 slice 는 이 문서를 편집하지 않는다**(뒷단 doc `direct` slice 소관).

## Acceptance Criteria

- [ ] [test/load/s1-batch.js](../../test/load/s1-batch.js) 의 `const STUB_BASELINE_P95_MS = 900;` → `= 1100;` 로 **숫자 1 개만** 변경. `STUB_BASELINE_PERSONS = 133` · `EXTRAPOLATION_PERSONS` · `FULL_RUN_BUDGET_MS` · `BATCH_P95_MS` 산식 · `http_req_failed: ["rate<0.01"]` · `filter` 조건식은 **문자 단위 무변경**(판정 게이트와 관찰 게이트의 성격 구분 불변).
- [ ] 같은 선언 위 주석에 재확정 근거를 **1~2 줄** 추가 — T-1668 규칙 ①-(a) 트리거 충족 · T-1675 산정(실 scale 표본 전량 평균 + 3σ = `1030.18ms` → 100ms 올림) · 관찰용 회귀 감시라는 성격은 그대로라는 점. 주석은 한국어(§12), 새 산정식 서술 · 하향 언급 0.
- [ ] [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 의 `const S1_STUB_BASELINE_P95_MS = 900;` → `= 1100;` + 그 JSDoc 의 `900ms` 표기 갱신(재확정 출처로 T-1675 pointer 1 구절 포함).
- [ ] 같은 파일의 **`900` 잔재 전수 정리** — `it("(T-1645) batch 임계 배열이 … stub baseline 900ms 2 종이다")` 제목, mutation ① 주석(`① 900 → 다른 숫자로 변조`), mutation ① 의 원본 리터럴 `"STUB_BASELINE_P95_MS = 900;"` 를 모두 새 값 기준으로 갱신. 단 `["avg<900"]` 합성 문자열(`p(95)` 아님 negative fixture)은 baseline 과 무관하므로 **무변경**임을 확인.
- [ ] **happy-path 검증** — `baselineWiringIntact(s1Script())` 가 여전히 `true`, `routeP95Expressions(script, "batch")` 가 `["${BATCH_P95_MS}", "${STUB_BASELINE_P95_MS}"]` 2 종 그대로, `thresholdKeys(script)` 가 `S1_THRESHOLD_KEYS` 2 종 그대로임을 기존 spec 이 통과로 증명.
- [ ] **error path / negative 검증** — mutation 4 종(① 값 변조 · ② baseline 표현식 삭제 · ③ 외삽 리터럴 고정 · ④ 조건식 제거)이 **전부 `baselineWiringIntact() === false`** 로 검출되고, ① 의 `expect(shifted).not.toBe(script)` 가 통과(치환이 실제로 일어났음 = 검출력 유실 0)함을 확인. 변조 후 값이 새 baseline `1100` 과 우연히 같지 않은지도 확인.
- [ ] **branch cover** — baseline 원소가 표본 133 일 때만 얹히는 두 갈래(`SAMPLE_PERSONS === STUB_BASELINE_PERSONS` 참/거짓)를 고정하는 기존 `it("(T-1645) baseline 원소의 두 갈래가 표본 133 비교식 하나로만 갈린다")` 가 새 값에서도 통과. 본 slice 는 **새 분기를 만들지 않는다** — 분기 신설 0 임을 PR 본문에 1 줄 명시.
- [ ] **negative cases 충분 cover** — 위 mutation 4 종 외에 임계 리터럴 고정 검출(`(3) 임계가 리터럴 상수로 굳어있지 않다`), 임계 key 목록·순서 불변, `rate<0.01` 재산정 0 단언이 모두 green. 새 negative 케이스가 필요하면 **값 하향 방향 mutation**(예: `= 800;` 변조 검출) 1 종만 추가 가능(추가 시에도 cap 안).
- [ ] `pnpm lint && pnpm build && pnpm test` green. 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전량 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 slice 는 `src/` 를 건드리지 않으므로 coverage 수치 변동 0 이어야 한다.
- [ ] 변경 파일 **2 개** 유지. `docs/` · `.github/workflows/load-k6.yml` · `package.json` · `src/` 는 무변경(문서 숫자 갱신은 뒷단 `direct` slice).

## Out of Scope

- **문서 숫자 갱신** — [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 임계 표 · 각주 · T-1668 규칙 소절(`222~249 행`) · `§5` item 5 의 `900ms` 표기는 본 slice 에서 **손대지 않는다**. 규칙 ④ 의 뒷단 `direct` slice 소관이며, 한 task 로 합치면 `commitMode` 가 갈린다(§3.1 rule 3).
- **새 산정식 · outlier 제거 · 임계 하향 재검토** — 규칙 ② · ③ 이 명시 금지. 본 slice 는 T-1675 가 이미 기계 산정한 `1100` 을 **대입만** 한다.
- **판정 임계(`FULL_RUN_BUDGET_MS` / `BATCH_P95_MS` 외삽 산식) 변경** — REQ-047 판정 게이트는 별개 성격이라 불변.
- **새 dispatch · rerun** — 본 slice 는 부하 job 을 발화하지 않는다. 값 반영 후 실 run 확인은 뒤의 S2 재 dispatch slice 소관.
- **`.github/workflows/load-k6.yml` 의 `if: always()` 추가 / S2 · S3 skip 해소** — T-1674 Follow-up ③ 별도 판단.
- **`K6_SEED_PERSONS` 상한 상향 · S3 축 dataset 교체** — 각각 별도 slice.
- **helper 신설 · spec 구조 리팩터** — 기존 `baselineWiringIntact` / `routeP95Expressions` 계약 위에서만 작업(신규 helper 0).
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 5 파일 cap 초과(T-1122 / Q-0054 선례).

## Suggested Sub-agents

`implementer` (상수 2 곳 + 주석/제목/mutation 리터럴 동기) → `tester` (`pnpm lint && pnpm build && pnpm test && pnpm test:cov` green · mutation 검출력 유실 0 확인)

## Follow-ups

- **문서 `direct` slice (규칙 ④ split 뒷단)** — `§3` 임계 표 · 각주 · T-1668 규칙 소절 · `§5` item 5 의 `900ms` → `1100ms` 갱신 + 규칙 ② 말미의 "본 규칙 소절에도 함께 박제" 발효. 본 slice 머지 직후 큐잉.
- **S2 재 dispatch** — 위 두 slice 이후. `load-k6.yml` `195 행` S2 step 에 `if: always()` 가 없어 S1 게이트가 red 인 동안 S2 · S3 는 계속 skip 된다(T-1674 Follow-up ③ 승계).
