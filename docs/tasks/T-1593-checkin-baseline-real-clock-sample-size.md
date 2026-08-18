---
id: T-1593
title: 체크인 baseline 실측 축 표본 수 상향 (REAL_CLOCK_ITER 3 → 20) + 표본 수 계약 가드
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 120
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T04:45:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1591, T-1592]
touchesFiles:
  - test/perf/person-read-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Decision 5 / §Follow-ups (c) 선행: 3 표본 degenerate p95/p99 를 20 표본으로 안정화"
---

# T-1593 — 체크인 baseline 실측 축 표본 수 상향 (REAL_CLOCK_ITER 3 → 20)

## Why

T-1592 가 첫 체크인 baseline (`test/perf/baselines/baseline-ci-realdb-person-read.json`) 을 확정해
CI `perf test` step 의 실측 축이 `outcome=compared` 로 떨어지기 시작했다. 그러나 그 baseline 은
**`count=3`** 로 만들어졌고, 지금도 실측 국면은 `REAL_CLOCK_ITER = 3` 으로 측정한다. 표본 3 개에서는
p95 · p99 가 사실상 **최댓값 1 개와 동일**해져 [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md)
`§Decision 3 (b)` 가 말한 "공유 runner 의 wall-clock 비결정성" 이 그대로 지표에 실린다 — 즉 회귀
관찰이 잡음에 지배된다. T-1592 의 Follow-up 도 같은 판정을 남겼다 ("현 baseline 은 `count=3` 3 표본이라
이후 `regressed=true` 관측이 잦을 수 있다").

본 task 는 그 잡음원을 먼저 제거한다 — 실측 축 반복수를 20 으로 올려 run 하나의 p50/p95 가 순위
기반으로 의미를 갖게 만든다. 이는 `§Decision 5` 1 항(표본 축적) 과 `§Follow-ups (c)`(임계 재산정) 의
**선행 조건**이며, tolerance 재산정 자체는 20 run 절차 소관이라 본 task 범위 밖이다.

측정 조건이 바뀌므로 체크인된 baseline (count=3) 과 candidate (count=20) 사이에 `regressed=true` 가
관측될 수 있다. 이는 `§Decision 3 (b)`(상대 회귀는 관찰만 · exit code 불변) 대로 **CI 를 red 로 만들지
않으며**, baseline 갱신은 `§Decision 2 (b)/(c)`(측정 조건 변경) 절차대로 새 실측 줄을 CI 로그에서 확보한
뒤 **별도 `pr` task** 가 갱신 사유 · 이전/이후 수치를 PR 본문에 박제하며 수행한다 (아래 Follow-ups).

비용 영향: 20 회 실 DB 왕복 ≈ 수십 ms 로, `§Decision 4` 가 못 박은 "CI 비용 증가 사실상 0" 을 유지한다.

## Required Reading

- `test/perf/person-read-realdb.perf-spec.ts` — 353 행부터의 `describe("체크인 baseline 실측 clock 관찰(ci-realdb-person-read)")`
  블록 (수정 대상은 이 블록 **하나뿐**). 상수 `REAL_CLOCK_ITER` · helper `measureRealClock` ·
  `checkWithLogs` · `expectEnabledOutcome` · `metricsLineOf` · 국면 5 개.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 3 (b)` (상대 회귀 관찰만),
  `§Decision 5` (다중 run 분포 기반 승격), `§Follow-ups (c)`.
- `docs/tasks/T-1591-checkin-baseline-real-clock-candidate.md` — 실측 국면이 왜 전용 상수를 쓰는지
  (`ITERATIONS` · `WIRING_ITER` 재사용 금지 근거).
- `test/perf/baselines/baseline-ci-realdb-person-read.json` — 현 체크인 값 (읽기만, **수정 금지**).

## Acceptance Criteria

- [ ] `REAL_CLOCK_ITER` 를 `3` → `20` 으로 올리고, 주석에 (1) 3 표본에서 p95/p99 가 최댓값으로
      degenerate 한다는 근거, (2) 20 표본에서도 p99 는 여전히 최댓값에 가깝다는 한계, (3) 20 회
      실 DB 왕복의 비용 규모를 각각 한 줄로 박제한다.
- [ ] **happy-path test** — 실 clock candidate 를 토글 on 으로 태우면 예외 0 · 로그 정확히 1 회 ·
      `candidate.count === REAL_CLOCK_ITER` (20) 임을 단언한다 (기존 happy 국면을 상수 기준으로
      유지 — 리터럴 `3` 하드코딩이 남아 있지 않아야 한다).
- [ ] **error path test** — 실패하는 request 로 측정했을 때도 표본 수가 20 으로 유지되고
      `errorRate` 가 실패 비율을 그대로 반영함을 단언한다 (기존 error 국면 확장).
- [ ] **분기 test** — 토글 on 국면의 `compared` / `skipped(absent)` 두 분기를 모두 수용하는 기존
      `expectEnabledOutcome` 계약이 20 표본에서도 그대로 성립함을 단언 (어느 쪽도 하드코딩 금지).
      토글 off (`disabled`) 분기 1 개도 유지.
- [ ] **negative cases 충분 cover** — 최소 3 종: (a) `REAL_CLOCK_ITER` 가 20 미만으로 되돌아가면
      fail 하는 표본 수 하한 회귀 가드, (b) 반복수 0/음수 같은 비정상 입력에서 측정 helper 가
      기존 계약대로 거동함, (c) 실측 값이 비결정적이라도 `p50 <= p95 <= p99` 순서 계약이 깨지지
      않음. 기존 negative 국면과 중복되면 삭제 대신 상수 기준으로 재사용한다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이므로 coverage 수치 변동은
      없어야 한다.
- [ ] 대상 perf-spec 실행 (`pnpm test:perf` 또는 해당 spec 지정 실행) 이 전량 pass 하고, CI 로그에
      `count=20` 이 찍힌 candidate 줄이 남는다. PR 본문에 그 줄을 그대로 인용한다 (다음 baseline
      갱신 task 의 승인 입력).
- [ ] 변경 파일은 `test/perf/person-read-realdb.perf-spec.ts` **1 개**뿐이다.

## Out of Scope

- `test/perf/baselines/baseline-ci-realdb-person-read.json` 갱신 (측정 조건 변경 후 CI 실측 줄을
  확보한 뒤 별도 `pr` task — ADR-0056 `§Decision 2 (b)/(c)` 절차).
- `test/perf/checkin-baseline-file.spec.ts` 의 `count` 단언 수정 (체크인 파일이 안 바뀌므로 불필요).
- tolerance 재산정 · 상대 회귀의 fail 승격 (`§Decision 5` 20 run 절차 소관).
- `.github/workflows/ci.yml` · `scripts/daily-test.sh` 수정 (daily-test leg 를 건드리면 drift-guard
  smoke spec 3 개가 동반돼 5 파일 cap 이 터진다 — T-1122 전례).
- 다른 perf-spec 의 실측 축 추가 · factory 배선 확산.
- `src/` 프로덕션 코드 · `test/perf/checkin-baseline-*.ts` helper 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (예고) 본 task 의 CI 로그에서 `count=20` 실측 줄을 확보한 뒤, `baseline-ci-realdb-person-read.json`
  을 20 표본 값으로 갱신하는 별도 `pr` task — 갱신 사유 · 이전/이후 수치를 PR 본문에 박제하고
  `checkin-baseline-file.spec.ts` 의 `count` 단언을 함께 맞춘다.
