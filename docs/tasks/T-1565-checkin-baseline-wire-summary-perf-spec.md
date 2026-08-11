---
id: T-1565
title: 체크인 baseline 확인을 summary measure→confirm perf-spec 에 첫 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 170
estimatedFiles: 1
created: 2026-08-11
createdAt: 2026-08-11T09:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560, T-1561, T-1562, T-1563, T-1564]
touchesFiles:
  - test/perf/summary-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b) 본체 첫 배선 slice: route 1 개(GET /api/summaries) 만 어댑터에 태움 (spec 1 파일)"
---

# T-1565 — 체크인 baseline 확인을 summary measure→confirm perf-spec 에 첫 배선

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 가 요구하는
배선의 **부품은 T-1560 ~ T-1564 로 전부 박제됐다** — 경로 해석 · 로그 포매터 · 진입 판정 ·
조립 진입점 · 기본값 바인딩 어댑터. 그런데 그 어댑터를 **실제로 호출하는 perf-spec 이 아직
0 개** 라, 체크인 baseline 경로는 지금까지 어느 run 에서도 실행되지 않는다(부품만 있고 배선 0).

본 task 는 그 배선을 **route 1 개 — slice 25 의 `GET /api/summaries`
([test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts))
에만** 건다. 나머지 4 개 measure→confirm perf-spec 은 손대지 않아 배선 형태가 리뷰에서
한 번 확정된 뒤 후속 slice 가 그 형태를 복제하게 한다. 배선은 `runCheckinBaselineCheckWithDefaults`
호출 1 회 + 로그 출력이며, 토글(`CHECKIN_BASELINE` 계열 환경변수)이 꺼진 기본 상태에서는
`fs` 조회조차 하지 않으므로 CI 의 기존 `perf test` step 동작은 **바뀌지 않는다**
(ADR-0056 `§Decision 3 (b)` 관찰 비-fail · exit code 불변, `§Decision 2` write 국면 부재).

완료 선언 0 — [PLAN.md](../PLAN.md) `140~142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 2`(write 는 pr-mode task 에서만 — spec 이 체크인 디렉토리에 쓰지 않는다) · `§Decision 3 (b)`(상대 회귀는 관찰 · exit code 불변) · `§Decision 4`(기존 `perf test` step 재사용) · `§Follow-ups (b)`
- [test/perf/checkin-baseline-adapter.ts](../../test/perf/checkin-baseline-adapter.ts) — `CheckinBaselineDefaultsInput` · `runCheckinBaselineCheckWithDefaults`(본 task 가 호출할 유일한 진입점)
- [test/perf/checkin-baseline-run.ts](../../test/perf/checkin-baseline-run.ts) — `CheckinBaselineRunOutcome` union(`compared` / `skipped`) — 반환 해석용
- [test/perf/checkin-baseline-plan.ts](../../test/perf/checkin-baseline-plan.ts) — `CHECKIN_BASELINE_ENV_FLAG` 상수 · `isCheckinBaselineEnabled`(토글 이름을 리터럴로 다시 적지 말 것)
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) — 배선 대상. 특히 `env`(`BaselineEnvMeta` fixture) · `tmpRoot` / `baselineDir()` 격리 관용구 · `measureAndConfirmBaseline` 호출부 · `afterEach` 재귀 삭제
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) `380 행` 부근 — `measureAndConfirmBaseline` 반환 형태(체크인 확인에 넘길 candidate 리포트 출처)

## Acceptance Criteria

- [ ] `test/perf/summary-measure-confirm.perf-spec.ts` 안에서 방금 측정한 candidate 리포트를 `runCheckinBaselineCheckWithDefaults` 에 **정확히 1 회** 넘기는 배선이 추가되고, 반환 `outcome.log` 를 그대로 출력한다(로그 문자열 재조립 금지 — 포매터 위임).
- [ ] happy path 1+ — 토글이 꺼진 기본 상태에서 배선이 `status: "skipped"` · `reason: "disabled"` 를 내고 log 가 `CHECKIN_LOG_PREFIX` 로 시작함을 검증.
- [ ] happy path 1+ — 토글을 켜고 `repoRoot` 를 임시 디렉토리로 주입해 baseline 이 **존재하는** 국면에서 `status: "compared"` 와 `regressed` boolean 이 나옴을 검증(비교 대상 파일은 임시 디렉토리 안에서만 만든다).
- [ ] error path 1+ — 잘못된 입력(예: `envMeta.label` 빈 문자열 / `input` non-object)에서 위임 예외(`TypeError` · `RangeError`)가 **래핑 없이** 전파되고 그 국면에 파일이 생성되지 않음을 검증.
- [ ] 분기 cover — 토글 off / 토글 on × baseline 부재(`skipped` · `absent`) / 토글 on × baseline 존재(`compared`) **3 국면 각 1+ test**.
- [ ] negative cases 충분 cover — 각 1+ test: (a) `regressed=true` 여도 spec 이 fail 하지 않음(exit code 불변), (b) 토글 off 국면에서 `fs` 존재 조회가 0 회(spy 로 확인), (c) 어떤 국면에서도 저장소 실경로 `test/perf/baselines/` 아래에 파일·디렉토리가 생성되지 않음, (d) 배선 추가 후에도 기존 `established` / `compared` 임시 baseDir round-trip 검증이 그대로 통과(회귀 없음).
- [ ] `pnpm test:perf` 로 본 perf-spec 이 통과(`npx jest -c test/perf/jest-perf.json -t` 로 대상 spec 만 돌려도 무방하나 최종 확인은 스위트 전체).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일 1 개 · diff ≤ 300 LOC 유지(초과 조짐이 보이면 JSDoc 축약 · `it.each` 병합으로 줄이되 위 4 종 test 를 빼지 말 것).

## Out of Scope

- **나머지 4 개 measure→confirm perf-spec 배선**(assessment · contribution · app-root · person 계열) — 본 slice 에서 확정된 형태를 후속 slice 가 복제한다.
- **체크인 baseline JSON 최초 생성·commit**(ADR-0056 `§Follow-ups (a)`) — 저장소 `test/perf/baselines/` 에 파일을 만들지 않는다. 실측 + 사람 눈 확인이 전제라 별도 task.
- **`.github/workflows/ci.yml` 편집** — `§Decision 4` 대로 기존 `perf test` step 을 그대로 쓴다(신규 job · step · 환경변수 주입 0).
- **`test/perf/checkin-baseline-*.ts` 5 모듈 수정** — 부족한 점이 보이면 Follow-ups 에만 적는다.
- **`latency-*.ts` primitive · `daily-test.sh` leg 추가 · drift-guard smoke spec 수정** — 파일 cap 을 깨는 축이라 진입 금지.
- **PLAN `140~142 행` · REQ-048 · 부하계획 `§ 3` 임계 수치 갱신** — 별도 doc-sync task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
