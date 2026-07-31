---
id: T-1354
title: PLAN P7 140~142 행 성능 검증 bullet 에 REQ-048 조회 latency harness shipped 근거 박제
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-08-01
independentStream: p7-perf-status-resync
dependsOn: []
touchesFiles:
  - docs/PLAN.md
  - docs/tasks/T-1354-plan-p7-perf-verification-evidence.md
plannerNote: "P7 140~142 성능 검증 bullet 이 근거 0 — test/perf 34 perf-spec + CI perf step shipped 실측을 박제(checkbox 유지)"
---

# T-1354 — PLAN P7 140~142 행 성능 검증 bullet 에 REQ-048 조회 latency harness shipped 근거 박제

## Why

[T-1347](T-1347-plan-p6-panel-mount-residual-resync.md) ~ [T-1353](T-1353-modules-doc-presentational-count-resync.md) 의 `p6-plan-residual-resync` stream 이 종결돼 P6 축의 문서 drift 는 닫혔다. 이제 남은 **가장 큰 근거-공백**은 [PLAN.md](../PLAN.md) **140~142 행 P7 "성능 검증"** bullet 이다 — 이 bullet 은 R-91 / R-92 두 줄의 목표 수치만 적고 있고, 다른 완료·부분완료 bullet 이 모두 갖춘 `implemented-on-main` 근거 구절이 **0** 이다. 그런데 실측상 REQ-048(조회 3초 이내) 축은 이미 상당량이 shipped 다: [test/perf/](../../test/perf/) 에 `*.perf-spec.ts` **34 개**(T-0830 ~ T-0884 chain) + 순수 primitive(`latency-metrics.ts` · `latency-collector.ts` · `latency-baseline.ts`) + [ci.yml](../../.github/workflows/ci.yml) 의 `perf test` step(`run: pnpm test:perf`, T-0878) 이 CI 강제까지 도달해 있다. 즉 P7 절만 읽는 planner 는 "성능 축은 아무것도 없다" 로 오독하고 이미 있는 harness 를 중복 신설할 위험이 있다.

동시에 **checkbox `[ ]` 는 유지**해야 한다 — 현 perf-spec 은 service 계층 mock + guard override 로 controller↔collector 배선만 측정하고(실 DB round-trip baseline 은 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up 잔여), REQ-047(100~200명 배치 1h) 축은 측정 자체가 미착수다. 따라서 본 slice 는 [T-1350](T-1350-plan-admin-panel-marker-rejudge.md) 의 마커 재판정과 달리 **근거만 박제하고 마커는 그대로 두는** 편집이다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) 140~142 행 (편집 대상) + 151 행 (P8 부하·내성 bullet — 중복 서술 회피 확인용)
- [test/perf/README.md](../../test/perf/README.md) (§ 상단 — REQ-048 p95 < 3s 목표 · 신규 dependency 0 선언)
- [test/perf/summary-read.perf-spec.ts](../../test/perf/summary-read.perf-spec.ts) 1~24 행 (결정론 전략 주석 — service mock / guard override / 임계 3000ms / Out of Scope 실 DB baseline)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 234~243 행 (`perf test` step 주석 + `run: pnpm test:perf`)
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 (follow-up 목록 — 잔여 항목 표기 근거)

## Acceptance Criteria

- [x] 편집은 [docs/PLAN.md](../PLAN.md) **141 · 142 행 두 곳뿐** — 140 행 헤더(`- [ ] **성능 검증**:`) 는 글자 무수정, checkbox `[ ]` 유지. 확인: `grep -n '^- \[ \] \*\*성능 검증\*\*:$' docs/PLAN.md` 가 **정확히 1 hit**.
- [x] 142 행(R-92)에 shipped 근거를 **순수 추가**(기존 문구·수치 보존): (a) [test/perf/](../../test/perf/) 의 `*.perf-spec.ts` **34 개** + primitive 3 파일, (b) [ci.yml](../../.github/workflows/ci.yml) `perf test` step 의 `pnpm test:perf` 로 CI 강제(T-0878), (c) 임계 = p95 **3000ms**(REQ-048), (d) 근거 pointer([test/perf/README.md](../../test/perf/README.md)).
- [x] 142 행에 **잔여**도 함께 명시 — service 계층 mock + guard override 라 실 DB round-trip baseline 은 미실측([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 잔여), 그래서 checkbox 미승격.
- [x] 141 행(R-91)에 한 구절 추가 — 배치 1h 축은 측정 harness·실측 **모두 미착수**(REQ-047 미검증) 임을 명시해 140 행 `[ ]` 의 근거를 행 안에서 읽히게 한다.
- [x] 실측 재확인(편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제): `ls test/perf/*.perf-spec.ts | wc -l` = **34**, `grep -c 'run: pnpm test:perf' .github/workflows/ci.yml` = **1**, `grep -c '"test:perf"' package.json` = **1**. 수치가 다르면 **문서를 실측에 맞추고** 그 사실을 trail 에 남긴다.
  - 실측 결과 3 개 모두 기대치와 일치(34 / 1 / 1). 단 **primitive 파일 수는 Why 절의 3 이 아니라 4** — `test/perf/` 의 non-spec `.ts` 는 `latency-metrics.ts`·`latency-collector.ts`·`latency-baseline.ts` 외에 `latency-baseline-io.ts` 가 더 있어, PLAN 142 행은 실측대로 **4 파일**로 적었다.
- [x] 구조 무손상: `grep -c "" docs/PLAN.md` = **175**(줄 수 불변 — 같은 줄 안 편집), `grep -c '^- \[x\]' docs/PLAN.md` = **60**, `grep -c '^- \[ \]' docs/PLAN.md` = **6** 모두 편집 전후 불변.
- [x] `git diff --name-only` 결과가 [docs/PLAN.md](../PLAN.md) 와 본 task 파일 **2 개뿐** — `src/` · `web/` · `test/` · `.github/` · `docs/architecture/` · `docs/requirements.md` · `docs/STATE.json` 무수정.
- [x] doc-only `commitMode: direct` 라 R-110 tester 면제 — 위 grep 검증으로 대체하고 그 사실을 commit trail 에 명시.

## 결과 (2026-08-01 DONE)

PLAN.md 141 · 142 행 두 줄만 같은 줄 안에서 확장. 141 행은 REQ-047 배치 1h 축이 harness·실측 모두 미착수(ADR-0054 PROPOSED 대기)임을, 142 행은 REQ-048 조회 latency harness 가 perf-spec 34 개 + primitive 4 파일 + CI `pnpm test:perf` 강제로 shipped 이나 실 DB round-trip baseline 미실측이라 checkbox 미승격임을 박제. 140 행 헤더·checkbox·줄 수(175)·마커 수(60/6) 전부 불변.

## Out of Scope

- [docs/requirements.md](../requirements.md) 66~67 행 REQ-047 / REQ-048 의 `PLANNED` status 컬럼 flip — 해당 표는 다수 행이 동일하게 stale 해 한 행만 고치면 표 안에서 새 불일치가 생긴다. 판정 기준·범위가 본 slice 와 달라 별도 slice 책임.
- P8 **151 행** 부하·내성 테스트 bullet 및 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 본문 수정.
- 140 행 checkbox 를 `[x]` 로 승격하거나 `(부분 완료)` 마커를 신설하는 것 — 근거 박제만 하고 마커 판정은 하지 않는다.
- perf harness 코드 변경 · 실 DB baseline 실측 · k6/artillery 등 부하 발생기 도입(새 dependency 게이트).
- 다른 phase bullet · P6 절 · architecture 문서 동기화.

## Suggested Sub-agents

`implementer` (doc-only 단일 편집 — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
