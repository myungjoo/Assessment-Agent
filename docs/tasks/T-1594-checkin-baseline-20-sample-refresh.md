---
id: T-1594
title: Refresh checkin baseline JSON with 20-sample measurement + sample-count guard
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-08-18
independentStream: perf-checkin-baseline
dependsOn: [T-1592, T-1593]
touchesFiles:
  - test/perf/baselines/baseline-ci-realdb-person-read.json
  - test/perf/checkin-baseline-file.spec.ts
prNumber: 1274
completedAt: 2026-08-18T05:57:46Z
mergeCommit: 47a9850f
plannerNote: P5 ADR-0056 §Decision 2 갱신 절차 — 3 표본 degenerate baseline 을 T-1593 의 20 표본 실측으로 교체 + 표본 수 하한 가드
---

# T-1594 — 체크인 baseline JSON 을 20 표본 실측값으로 갱신 + 표본 수 하한 가드

## Why

T-1592 가 확정한 첫 체크인 baseline `test/perf/baselines/baseline-ci-realdb-person-read.json` 은 `count=3` 으로 만들어졌다. 3 표본에서는 p95 · p99 가 사실상 **최댓값 1 개와 동일**해져 baseline 쪽 분포가 degenerate 하다 (현 파일: p95 `3.2266…` · p99 `3.2507…` — 두 값이 붙어 있다). 반면 T-1593 이 실측 국면 반복 수를 20 으로 올렸으므로, 지금 CI 의 `compared` 분기는 **20 표본 candidate 를 3 표본 baseline 과 비교** 하는 비대칭 상태다 — ADR-0056 `§Decision 3 (b)` 가 우려한 잡음이 baseline 쪽에 그대로 남아 회귀 관찰의 신호 대 잡음비를 떨어뜨린다.

본 slice 는 baseline 레코드를 T-1593 머지 run 이 CI 로그에 남긴 **20 표본 실측 줄로 전사 교체** 해 그 비대칭을 없앤다. ADR-0056 `§Decision 2` 가 요구하는 "명시적 `commitMode: pr` task 에서만 갱신 · PR 본문에 갱신 사유와 이전 · 이후 수치 명기" 절차를 그대로 밟는다. 동시에 가드 spec 에 **표본 수 하한** 단언을 넣어, 앞으로 degenerate 표본으로 만든 baseline 이 조용히 다시 체크인되지 못하게 한다. 이로써 ADR-0056 `§Decision 5`(연속 20 run 표본 축적) · `§Follow-ups (c)`(임계 재산정) 의 관측 입력이 의미를 갖는다.

**`env.label` 은 바꾸지 않는다.** `§Decision 2` 의 (b) "측정 환경 교체 시 label 을 바꿔 새 파일로" 는 runner 이미지 · DB 버전 · seed 규모 변경을 가리키며, 본 변경은 그 셋이 전부 불변 (`SEED_ROWS=20` 그대로) 이고 **측정 반복 수만** 늘어난 경우다. 오히려 `§Decision 3 (b)` 말미가 "승격 대신 tolerance 를 넓히거나 **측정 반복 수를 늘리는** 쪽을 먼저 시도한다" 고 반복 수 상향을 제자리 조정으로 예정해 두었다. label 을 바꾸면 stale 파일 1 개가 남아 `§Consequences (a)` 누적 문제를 만든다.

## Required Reading

- `test/perf/baselines/baseline-ci-realdb-person-read.json` — 갱신 대상 (단일 행 JSON 1 개).
- `test/perf/checkin-baseline-file.spec.ts` — 가드 spec. 특히 happy 국면의 `expect(report.count).toBe(3)` (61 행 부근) 과 negative `(b)` `(c)`.
- `test/perf/person-read-realdb.perf-spec.ts` `360~500 행` — 실측 축 nested describe. `REAL_CLOCK_ITER = 20` · `REAL_CLOCK_ITER_MIN = 20` · `SEED_ROWS = 20` · `dataScale` 표기.
- `test/perf/latency-baseline.ts` `500~540 행` — `formatBaselineLine` (latency 소수 1 자리 · throughput 2 자리 반올림) · `serializeBaselineReport` · `parseBaselineReport`.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 2` (갱신 정당 조건 · PR 본문 의무) · `§Decision 3` (관찰 전용 · 승격 정량 조건) · `§Consequences (a) (d)`.

## Acceptance Criteria

- [ ] **갱신값의 출처가 실측 CI 로그** — `gh run list --workflow=ci.yml --branch main` 로 T-1593 머지 commit `7979bb2b` 이후의 run 을 찾아 `perf test` step 로그에서 label `ci-realdb-person-read` 이고 `count=20` 인 줄을 확보한다. 확보 실패 시 `docs/progress/journal-2026-08-18.md` 05:05 driver 항목에 박제된 줄 (`p50=2.1ms p95=3.5ms p99=5.5ms tput=400.00req/s err=0.00% count=20 pass=true`) 을 대체 출처로 쓴다. **어느 쪽을 썼는지와 원문 줄 · run 링크를 PR 본문에 그대로 인용** 한다.
- [ ] **JSON 갱신** — `test/perf/baselines/baseline-ci-realdb-person-read.json` 의 `p50` · `p95` · `p99` · `throughput` · `errorRate` · `count` · `pass` 를 위 줄의 값으로 **전사만** 한다 (재계산 · 임의 보정 0). `env.label` · `env.concurrency` · `env.dataScale` 는 불변. 파일은 종전대로 **후행 개행 포함 단일 행** 이며 `serializeBaselineReport(parseBaselineReport(body)) === body` 를 만족해야 한다.
- [ ] **PR 본문에 갱신 사유 + 이전 · 이후 수치 표** — ADR-0056 `§Decision 2` 마지막 문장 의무. 이전 (`count=3`, p50 2.955 / p95 3.227 / p99 3.251) 과 이후 값을 나란히 적고, p99 가 완화되는 방향임과 그 이유 (3 표본 p99 는 최댓값 1 개라 과소 추정) 를 한 줄로 밝힌다. 로그 반올림으로 유효 자릿수가 줄어드는 점도 명시 (`formatBaselineLine` 이 latency 1 자리 · throughput 2 자리).
- [ ] **happy-path test** — 가드 spec 의 happy 국면이 리터럴 `3` 대신 spec 안에 새로 둔 표본 수 상수 (예: `CHECKIN_SAMPLE_COUNT = 20`) 기준으로 `report.count` 를 단언하고, 예외 0 으로 복원 · 원문이 정본 직렬화 형태와 문자열 동일 · 경로 유도값 일치까지 종전 단언이 그대로 통과한다.
- [ ] **error path test** — 미체크인 label 의 `readBaselineFile` 이 `ENOENT` 를 래핑 없이 전파하고 `baselineFileExists=false` 인 기존 국면이 갱신 후에도 통과한다 (회귀 0).
- [ ] **분기 test** — 갱신된 baseline 을 자기 자신과 비교하면 무회귀, `p95` 를 10 배로 키운 candidate 는 회귀 표기인 두 방향이 모두 통과한다 (in-memory 조작만 — wall-clock 실측 0).
- [ ] **negative cases 충분 cover (각 1+)** — (a) 표본 0 (`NaN` · `count=0`) candidate 비교 시 throw 0 + 회귀 표기, (b) `env.dataScale` 이 `^\d+ persons$` 형태, (c) 체크인 디렉토리의 `.json` 이 정확히 1 개 (stale label 누적 0), (d) **신규** — `report.count >= CHECKIN_SAMPLE_MIN` (= 20) 로 degenerate 표본 baseline 재체크인 차단, (e) **신규** — `p50 <= p95 <= p99` 단조성과 `throughput > 0` · `0 <= errorRate <= 1` 값 범위. (d) 는 갱신 전 파일 (`count=3`) 에서 실제로 FAIL 함을 확인해 장식 test 가 아님을 PR 본문에 기록한다.
- [ ] **spec 상단 주석 갱신** — 가드 대상이 20 표본 baseline 이며 표본 수 하한 단언이 왜 있는지 (ADR-0056 `§Decision 3 (b)` · `§Decision 5`) 를 2~3 줄로 박제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 건드리지 않으므로 coverage 수치 변동은 0 이어야 한다.
- [ ] CI 의 `perf test` step 이 갱신 후 run 에서 `outcome=compared` 로 떨어지고 `regressed` 값이 로그에 그대로 보인다 (`§Decision 3 (b)` — exit code 불변, 회귀여도 red 아님).

## Out of Scope

- **tolerance 재산정 · 상대 회귀의 CI fail 승격** — ADR-0056 `§Decision 3` 의 연속 20 run 절차 소관. 본 task 는 baseline 레코드 1 개만 갱신한다.
- **`env.label` 변경 · 새 baseline 파일 추가** — Why 절의 근거대로 label 은 불변. 다른 축 (`app-root-read` 등) 의 baseline 체크인도 하지 않는다.
- **`.github/workflows/ci.yml` · `scripts/daily-test.sh` 수정** — ADR-0056 `§Follow-ups (b)` 소관이며, `daily-test.sh` leg 를 건드리면 drift-guard smoke spec 3 개가 동반돼 5 파일 cap 이 터진다 (T-1122 전례).
- **`test/perf/person-read-realdb.perf-spec.ts` 수정** — `REAL_CLOCK_ITER` 는 T-1593 이 확정했다. 반복 수 재조정 금지.
- **`test/perf/latency-baseline.ts` · `checkin-baseline-report.ts` · `checkin-baseline-store.ts` 등 primitive 수정** — 포매터 정밀도 상향 (소수 자릿수 확대) 은 별도 slice.
- **`test/perf/README.md` · `docs/ops/load-resilience-test-plan.md` doc-sync** — 별도 slice (파일 cap 보호).
- **`docs/PLAN.md` · `docs/requirements.md` 갱신** — ADR-0056 `§Follow-ups (d)` 소관의 `direct` slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

---

## Result (2026-08-18)

**DONE** — `pr` mode, PR [#1274](https://github.com/myungjoo/Assessment-Agent/pull/1274) squash merge `47a9850f`, reviewer round 1 APPROVE, 4-게이트 4/4 PASS.

- `test/perf/baselines/baseline-ci-realdb-person-read.json` — T-1593 머지 run(`32101314456`, main `7979bb2b`) 의 20 표본 실측 줄을 **재계산 없이 전사만** 교체. `env.label` · concurrency · dataScale 불변, 단일 행 round-trip 유지.
- `test/perf/checkin-baseline-file.spec.ts` — `CHECKIN_SAMPLE_COUNT` / `CHECKIN_SAMPLE_MIN` 상수 도입(happy 단언이 리터럴 3 대신 상수 기준), negative (d) 표본 수 하한 · (e) 단조성/값 범위 2 종 추가. (d) 는 갱신 전 파일(`count=3`)에서 실제 FAIL 함을 확인해 PR 본문에 기록.
- 2 파일 `+43/-2`, `src/` 0 LOC. 438 suite · 12548 test pass, lint · build green, `test:cov` line 99.95% / func 100%.
- CI `perf test` step 이 `compared` 로 떨어지고 `regressed=false` · `count=20` candidate 확인 — 20 표본 candidate 대 3 표본 baseline 비대칭이 해소됐다.
