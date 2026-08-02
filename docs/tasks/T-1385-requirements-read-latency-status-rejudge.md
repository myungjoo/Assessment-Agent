---
id: T-1385
title: requirements.md 67 행 REQ-048 조회·시각화 3초 이내 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1385-requirements-read-latency-status-rejudge.md
plannerNote: "requirements-status-resync 31 번째 slice — T-1384 가 남긴 잔여 PLANNED row 중 perf 축 (REQ-048), harness·CI·임계·web 4 축 전수 실측 가능, doc-only direct"
---

# T-1385 — requirements.md 67 행 REQ-048 조회·시각화 3초 이내 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 67 행 REQ-048 (README 92 행 — 조회·시각화 3초 이내) 는 kind = `NFR`, 구현 위치 = `P6 + P7`, 검증 위치 = `perf test` 인데 상태 컬럼이 아직 `PLANNED` 다. 그러나 main 에는 `test/perf/` 하위에 read 계열 perf-spec 30 개 + latency 측정 primitive 4 종이 이미 머지돼 있고, `.github/workflows/ci.yml` 234~243 행의 `perf test` step 이 `pnpm test:perf` 를 CI 에서 강제하고 있어 표-저장소 drift 가 남아 있다. 직전 slice T-1384 (REQ-050 재판정) 은 Out of Scope 에 "REQ-047 · REQ-048 등 남은 `PLANNED` row 재판정 — 각각 별도 slice" 를 명시해 본 slice 를 남겨뒀다. `requirements-status-resync` stream 의 31 번째 slice 로 **조회 측정 harness 축 · CI 강제 축 · 3 초 절대 임계 축 · 시각화(web) 축** 을 각각 직접 실측해 표를 저장소 사실에 되돌린다.

## Required Reading

- `docs/requirements.md` — 67 행 (REQ-048) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-047 (66 행, `PLANNED` 유지) · REQ-049 (68 행, 이미 `DONE`) 은 필드 수 비교용으로만 쓴다.
- `docs/tasks/T-1384-requirements-difficulty-model-policy-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 그것은 난이도 모델 축 (REQ-050) 의 근거다. 본 task 는 처음부터 직접 실측한다.
- `README.md` 92 행 — REQ-048 원문. 축 분해 = (a) **조회 측정 harness 축**: 조회 endpoint 의 latency 를 실제로 측정하는 spec·primitive 가 실재하는지, (b) **CI 강제 축**: 그 측정이 CI 에서 자동 실행돼 fail 이 red 로 이어지는지, (c) **3 초 절대 임계 축**: "3초 이내" 라는 절대 임계가 assertion 으로 박제됐는지 아니면 상대 baseline 비교뿐인지, (d) **시각화 축**: README 의 "시각화" (web 렌더) 쪽 latency 측정 경로가 실재하는지.
- `test/perf/README.md` — harness 의 자기 서술. 1~5 행이 REQ-048 을 명시적으로 참조하고 `p95 < 3s` 를 목표로 적는다. 측정 primitive 절에서 `percentile` · `summarizeLatency` · `errorRate` · `throughput` 4 함수의 서술을 행 인용한다. **문서 서술은 그 자체로 구현 근거가 아니다** — 아래 소스 실측과 어긋나면 어긋난 사실을 그대로 적는다.
- `test/perf/latency-metrics.ts` — 측정 primitive 축. `percentile` (18 행) · `summarizeLatency` (62 행) · `errorRate` (78 행) · `throughput` (112 행) 의 정의 행과 `LatencySummary` (48 행) 의 필드 (p50 / p95 / p99 등) 를 행 인용으로 확정한다.
- `test/perf/latency-baseline.ts` · `test/perf/latency-baseline-io.ts` — baseline 비교 축. `compareBaselineReports` · `compareBaselineFiles` · `ConfirmOrCompareResult` 등의 정의 행을 인용하고, 이 경로가 **절대 임계 판정인지 직전 baseline 대비 상대 회귀 판정인지** 를 한 줄로 확정한다.
- `test/perf/*-read.perf-spec.ts` 중 **임의로 고르지 말고 대표 2 개** (`test/perf/person-read.perf-spec.ts` · `test/perf/summary-read.perf-spec.ts`) — 실제 assertion 축. 각 파일에서 (i) 측정 대상 route, (ii) p95 를 비교하는 expect 행, (iii) 비교 대상이 리터럴 임계 (예: 3000) 인지 baseline 값인지를 행 인용으로 확정한다.
- `.github/workflows/ci.yml` 234~243 행 (`perf test` step) + `package.json` 22 행 (`test:perf` script) + `test/perf/jest-perf.json` — CI 강제 축. step 이름 · `run` 명령 · jest config 경로를 행 인용한다.
- `docs/ops/load-resilience-test-plan.md` — 계획 축. §5 follow-up 과 임계 표에서 REQ-048 에 대응하는 임계 (p95 < 3s 등) 서술을 행 인용한다. 파일이 없으면 "부재" 로 적는다.
- 시각화 축 실 근거용 — `web/` 하위에 렌더 latency 를 측정하는 경로가 실재하는지 `grep -rn "performance.now\|p95\|latency" web/src` 로 확인한다. 0 건이면 0 으로 적고 축을 충족으로 판정하지 않는다.

## Acceptance Criteria

- [x] **조회 측정 harness 축** 을 실측한다 — `ls test/perf | grep -c "read.perf-spec.ts"` 개수와 `test/perf/latency-metrics.ts` 의 primitive 4 함수 정의 행을 인용한다. 개수는 실행 결과 그대로 적고 반올림·추정하지 않는다.
- [x] **CI 강제 축** 을 실측한다 — `.github/workflows/ci.yml` 의 `perf test` step 이름 · `run: pnpm test:perf` 행 번호와 `package.json` 의 `test:perf` script 정의 행, `test/perf/jest-perf.json` 실재 여부를 인용한다.
- [x] **3 초 절대 임계 축** 을 실측한다 — 대표 perf-spec 2 개 (`person-read` · `summary-read`) 의 p95 비교 expect 행을 인용하고, 비교 대상이 **리터럴 3000ms 임계인지 직전 baseline 상대 비교인지** 를 한 줄로 확정한다. 저장소 전체에서 절대 임계 상수 사용처를 `grep -rn "3000" test/perf --include=*.ts` 로 확인해 건수를 적는다. 절대 임계 assertion 이 0 이면 본 축을 충족으로 판정하지 않는다.
- [x] **시각화(web) 축** 을 실측한다 — `web/src` 에 렌더 latency 측정 경로가 실재하는지 grep 결과 건수를 적는다. 0 이면 "시각화 축 부재" 를 상태 문자열에 그대로 적고 상태를 `DONE` 으로 올리지 않는다.
- [x] **검증 위치 컬럼 (`perf test`) 의 실 근거** 를 확인한다 — perf 스위트의 test 개수를 `grep -rc "^\s*it(" test/perf/*.perf-spec.ts` 합계 (또는 동등 실측) 로 인용한다. spec 실행 결과 수치를 인용할 경우 실제 실행한 것만 적고, 실행하지 않았으면 정적 개수임을 명시한다.
- [x] REQ-048 (67 행) 의 상태 컬럼을 실측 결과에 따라 `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 파일 경로 4 개 이상 (perf-spec · primitive · ci.yml · package.json) 이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: web 시각화 측정 부재 · 절대 임계 미박제 · 실 scale 데이터 부재 · CI runner 성능 편차) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-048" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-047 · REQ-049) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **perf spec · primitive · CI workflow 수정** — 절대 임계 미박제 · web 측정 부재 등 공백을 발견해도 코드 · workflow 를 고치지 않는다. 발견 사항은 Follow-ups 에만 적는다.
- **perf 스위트 실행 (`pnpm test:perf`)** — live NestJS app + PostgreSQL 부팅이 필요해 본 doc-only slice 범위를 넘는다. 정적 실측 (파일 · 행 · 개수) 만 한다.
- **REQ-047 (66 행) 재판정** — 100~200명 / 50~100 repo / 1h 이내 scale 축은 measurement 근거가 다르므로 별도 slice.
- **`docs/ops/load-resilience-test-plan.md` · `docs/architecture/*` 수정** — 서술 drift 를 발견해도 인용 · 부기만 한다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice.
- REQ-001 (20 행) · REQ-056 (75 행) 등 남은 `PLANNED` row 재판정 — 각각 별도 slice.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- T-1384 Follow-ups (난이도 routing 미발화 · 항목→난이도 규칙 미박제 · 3 슬롯 seed 부재) 의 구현 또는 재서술.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## 완료 기록

- 완료 시각: 2026-08-02 (UTC)
- 판정: REQ-048 (`docs/requirements.md` 67 행) 상태 `PLANNED` → **`IN_PROGRESS`** (4 축 중 3 축 충족).
- 실측값 (정적 실측 — `pnpm test:perf` 미실행, Out of Scope):
  - **조회 측정 harness 축 (충족)** — `ls test/perf` 중 `read.perf-spec.ts` 로 끝나는 파일 **30 개**. 측정 primitive 4 함수는 `test/perf/latency-metrics.ts` 18 행 `percentile` · 62 행 `summarizeLatency` · 78 행 `errorRate` · 112 행 `throughput`, 48 행 `LatencySummary` 가 p50 / p95 / p99 보유.
  - **CI 강제 축 (충족)** — `.github/workflows/ci.yml` 234 행 `- name: perf test` + 243 행 `run: pnpm test:perf`, `package.json` 22 행 `"test:perf": "jest --config ./test/perf/jest-perf.json"`, `test/perf/jest-perf.json` 실재 (278 bytes).
  - **3 초 절대 임계 축 (충족)** — `test/perf/latency-collector.ts` 167 행 `const DEFAULT_P95_MAX_MS = 3000` → 182 행 `assertS2Threshold` 기본 상한 → 244~245 행 fail 사유 문자열에 `(REQ-048)` 명시. 대표 spec 2 개가 그 판정을 expect: `test/perf/person-read.perf-spec.ts` 117 행 · 156 행, `test/perf/summary-read.perf-spec.ts` 114 행 · 152 행. 즉 **리터럴 3000ms 절대 임계** 이며 baseline 경로 (`latency-baseline.ts` 270 행 `compareBaselineReports`, `latency-baseline-io.ts` 251 행 `compareBaselineFiles` · 331 행 `ConfirmOrCompareResult` · 381 행 `confirmOrCompareBaseline`) 는 `latency-baseline-io.ts` 362~364 행이 못박은 대로 **상대 회귀 관찰·리포트 전용** (임계 불변, throw 없음). `grep -rn "3000" test/perf --include=*.ts` = **73 건**, 주석 제외 **8 건**, 그 중 판정에 쓰이는 정의는 167 행 1 건.
  - **시각화(web) 축 (미충족)** — `web/src` 에서 `performance.now` · `p95` · `latency` 3 패턴 grep = **0 건**. `web/src` 자체는 10 entry 로 실재 → web 미구현이 아니라 렌더 latency 측정 미도입.
  - **검증 위치 `perf test` 근거** — 행두 `it(` 기준 `test/perf/*.perf-spec.ts` **34 파일 268 it** (정적 개수).
  - **계획 축 정합** — `docs/ops/load-resilience-test-plan.md` 58 행 (목표 p95 < 3s) · 83 행 임계 표 행 (S2 조회 지연 / p95 latency / < 3s / REQ-048).
- 표 무결성: `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-"` = **66**, 66 · 67 · 68 행 `|` 필드 수 모두 **9** (7 컬럼) 로 편집 전후 불변. 상태 문자열 안에 리터럴 `|` 없음 (T-1370 · T-1375 재발 방지).
- 한계 부기: 측정은 mock service 기반 서버 endpoint 배선 latency 뿐 (실 DB · 실 scale 부하 미검증), CI runner 성능 편차 · p95 표본 수 의존성 잔여.

## Follow-ups

- **시각화(web) 렌더 latency 측정 경로 부재** — README 92 행의 "시각화" 절반이 측정 밖이다. `web/src` 에 `performance.now` 기반 렌더 latency 수집 + 3 초 임계 assertion 을 도입하는 별도 slice 필요 (본 task 는 Out of Scope 로 코드 미수정).
- **perf-spec 의 mock service 의존** — 30 개 read perf-spec 이 모두 mock service 즉시 반환 위에서 p95 를 재므로 실 DB 왕복 · 실 scale 데이터 하의 3 초 충족이 미검증. REQ-047 (100~200명 / 50~100 repo) scale seed 위의 perf 측정 slice 와 함께 다루면 좋다.
- **REQ-048 상태의 `DONE` 승격 조건** — 위 2 건 (web 측정 도입 + 실 scale 측정) 중 web 축이 충족되면 `DONE` 재판정 slice 를 연다.
