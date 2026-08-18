---
id: T-1595
title: 체크인 baseline compared 국면에도 candidate 지표 줄 박제 (20 run 표본 축적 입력 확보)
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-08-18T06:52:13Z
prNumber: 1275
mergeCommit: 60940288
coversReq: [REQ-048]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-18
independentStream: perf-checkin-baseline
dependsOn: [T-1589, T-1592]
touchesFiles:
  - test/perf/checkin-baseline-run.ts
  - test/perf/checkin-baseline-run.spec.ts
plannerNote: P5 perf — ADR-0056 §Decision 5 표본 축적의 입력이 compared 진입 후 소실됨. absent 국면(T-1589)과 대칭으로 candidate 줄 복원.
---

# T-1595 — 체크인 baseline compared 국면에도 candidate 지표 줄 박제

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 5` 1 항은 임계 fix 승격의 선행 조건으로 **동일 `env.label` 로 최소 20 run 의 지표 축적**을 요구하고, 그 축적 원천을 "`perf test` step 로그"로 지정한다. T-1589 가 `skip(absent)` 국면에 `formatCheckinCandidateLine` 2 번째 줄을 박아 그 입력을 열었으나, T-1592 가 baseline JSON 을 체크인한 뒤로 CI 는 항상 `compared` 분기로 떨어진다 — 그런데 `runCheckinBaselineCheck` 의 `compared` 로그는 `outcome=compared regressed=<bool>` + 비교 본문뿐이라 **`label=` 축도 `count=` 도 실리지 않는다**. 즉 20 run 축적의 입력이 baseline 체크인과 동시에 다시 닫혔다.

본 slice 는 `absent` 국면과 **대칭으로** `compared` 국면 로그 끝에 candidate 지표 줄 1 개를 이어, run 마다 `label` 기준으로 grep 가능한 고정 축 한 줄이 남게 한다. 이것이 ADR-0056 `§Follow-ups (c)`(부하계획 `§ 3` 임계 fix) 착수의 마지막 기계적 선행 조건이다.

## Required Reading

- `test/perf/checkin-baseline-run.ts` — 변경 대상. `runCheckinBaselineCheck` 5~6 단계(`compare` 위임 → `formatCheckinOutcomeBlock` 로그 조립)와 3 단계 `absent` 국면의 2 줄 조립 선례.
- `test/perf/checkin-baseline-run.spec.ts` — 변경 대상 colocated spec. 기존 `outcome=compared regressed=false\n본문` 단언 2 곳이 본 변경으로 갱신 대상이 된다.
- `test/perf/checkin-baseline-report.ts` — `CHECKIN_LOG_PREFIX` · `formatCheckinCandidateLine`(전사 전용 · 순수 · `NaN` 통과) · `formatCheckinOutcomeBlock` 계약. **본 파일은 수정하지 않는다.**
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 3 (b)`(상대 회귀는 관찰만 · exit code 불변) · `§Decision 5` 1 항(20 run 표본 축적) · `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] `runCheckinBaselineCheck` 의 `compared` 국면 로그가 기존 블록(`formatCheckinOutcomeBlock` 결과) **뒤에** 개행 1 개로 `formatCheckinCandidateLine(input.candidate)` 결과를 잇는다. 기존 블록 문자열은 **재조립·재포맷하지 않는다**(포매터 위임 유지 — `checkin-baseline-report.ts` 수정 0).
- [ ] `skipped(disabled)` 한 줄 · `skipped(absent)` 2 줄 · 반환 union(`status` / `reason` / `regressed`) · `compare` 정확히 1 회 호출 · 입력 객체 불변 · 결정성 계약은 **불변**. 회귀(`regressed === true`) 입력에도 throw 0(ADR-0056 `§Decision 3 (b)` exit code 불변).
- [ ] happy-path test 1+ — `compared` 국면 로그가 `outcome=compared regressed=false` 줄 + 비교 본문 + `candidate label=... count=...` 줄 순서로 조립되고, candidate 줄이 `CHECKIN_LOG_PREFIX` 로 시작함을 단언.
- [ ] error path test 1+ — `compared` 국면에서 `input.candidate` 형태가 불량일 때(`env.label` 빈 문자열 등) 포매터 예외(`TypeError` / `RangeError`)가 **래핑 없이 전파**되고, 그 시점에도 `compare` 는 1 회만 호출됐음을 단언.
- [ ] 분기 cover — `compared`(회귀 false) · `compared`(회귀 true, throw 0 · candidate 줄 동일 부착) · `skipped(absent)`(2 줄 유지) · `skipped(disabled)`(1 줄 유지 · candidate 무접근) 4 분기 각 1+ test.
- [ ] negative cases 충분 cover 4 종 이상 — (a) `input` non-object/`null`, (b) `compare` non-function(비교 진입 확정 후에만 `TypeError`), (c) 성공 표본 0 으로 `p50`/`p95`/`p99` 가 `NaN` 인 candidate 도 거르지 않고 그대로 전사, (d) candidate 수치 필드 non-number, (e) `disabled` 국면에서는 candidate 가 불량이어도 예외 0(판정 단락 우선 회귀 가드).
- [ ] 로그 줄 수 회귀 가드 1+ — `compared` 로그를 개행으로 split 했을 때 마지막 줄이 candidate 줄이고, `disabled` 로그는 정확히 1 줄임을 단언(줄 수 계약 고정).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이므로 coverage 변동 0 임을 PR 본문에 명시.
- [ ] PR 본문에 본 변경 후 CI `perf test` step 이 실제로 찍는 `compared` 로그 3 줄(또는 그 candidate 줄)을 인용해, `§Decision 5` 1 항 축적이 재개됐음을 근거로 박제.

## Out of Scope

- `test/perf/checkin-baseline-report.ts` 수정 — 포매터는 그대로 재사용만 한다(신규 포매터 · 시그니처 변경 0).
- `test/perf/baselines/baseline-ci-realdb-person-read.json` 값 갱신 — T-1594 가 확정한 20 표본 레코드를 건드리지 않는다.
- tolerance 재산정 · 상대 회귀의 CI fail 승격(ADR-0056 `§Follow-ups (c)` · `§Decision 3` 승격) — 20 run 축적 후 별도 task.
- `.github/workflows/ci.yml` · `scripts/daily-test.sh` 편집 — drift-guard smoke spec 3 종 동반으로 5 파일 cap 이 터진다(T-1122 전례).
- `test/perf/README.md` doc-sync — 3 번째 파일이 되고 성격이 달라 별도 slice 로 이월(Follow-ups 참조).
- `*-read` / `*-realdb` 계열 perf-spec 의 factory 배선 확산 · 신규 실측 축 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `test/perf/README.md` 의 체크인 baseline 절에 `compared` 국면 로그가 3 줄(요약 · 비교 본문 · candidate)임을 doc-sync (`pr`, 1 파일).
- 20 run 축적 후 ADR-0056 `§Follow-ups (c)` — 부하계획 `§ 3` "baseline 후 fix" 행을 확정 임계로 승격(근거 run 수 · `env.label` 각주 동반, doc-sync).

## 결과 요약 (2026-08-18)

PR [#1275](https://github.com/myungjoo/Assessment-Agent/pull/1275) squash merge `60940288` (2 파일 `+65/-13`, `src/` 0 LOC). `compared` 국면 6 단계 로그를 `블록 + "
" + formatCheckinCandidateLine(candidate)` 로 확장했고 `checkin-baseline-report.ts` 포매터는 수정 0. 반환 union · `skip` 2 국면 로그 줄 수 · `compare` 1 회 호출 · 결정성 · exit code(회귀에도 throw 0) 전부 불변. 438 suite / 12551 test pass, `test:cov` line/function 임계 통과.

CI `perf test` step 실측 확인 — `[perf][checkin-baseline] candidate label=ci-realdb-person-read concurrency=1 p50=2.083 p95=2.579 p99=2.679 throughput=465.12 errorRate=0 count=20 pass=true`. ADR-0056 `§Decision 5` 1 항의 20 run 표본 축적 입력이 `compared` 진입 이후 처음으로 재개됐다.
