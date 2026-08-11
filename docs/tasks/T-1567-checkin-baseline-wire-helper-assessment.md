---
id: T-1567
title: 체크인 baseline 배선을 summary 는 helper 위임으로 교체하고 assessment perf-spec 에 첫 복제
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T13:10:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560, T-1561, T-1562, T-1563, T-1564, T-1565, T-1566]
touchesFiles:
  - test/perf/summary-measure-confirm.perf-spec.ts
  - test/perf/assessment-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b) 배선 적용 slice: summary 지역 관용구 제거 + assessment 첫 복제 (perf-spec 2 개)"
---

# T-1567 — 체크인 baseline 배선을 summary 는 helper 위임으로 교체하고 assessment perf-spec 에 첫 복제

## Why

[T-1566](T-1566-checkin-baseline-spec-wiring-helper.md) 이
[test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) 에
배선 관용구 helper 2 개(`checkCheckinBaselineForSpec` · `seedCheckinBaselineFixture`)를 박제했지만
**아직 어떤 perf-spec 도 그 helper 를 호출하지 않는다**. 동시에
[test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts)
`605~636 행` 에는 T-1565 가 만든 **같은 관용구의 지역 사본**(`checkCheckinBaseline` ·
`seedCheckinBaseline`)이 그대로 남아 있다. 이 상태에서 잔여 spec 이 복제를 시작하면 helper 판본과
지역 판본이 병존해 drift 표면이 오히려 늘어난다.

본 task 는 ADR-0056 `§Follow-ups (b)` 의 **배선 적용 첫 slice** 로, (1) summary spec 의 지역 사본
2 개를 helper 위임으로 교체해 판본을 하나로 모으고, (2) 같은 helper 를 써서
[test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts)
에 배선 describe 를 **첫 복제** 한다. helper 가 실 spec 2 곳에서 동작함을 확인해야 잔여 3 spec
(contribution · app-root · person 계열) 묶음 복제가 안전하다.

**판정 · 경로 · 로그 재구현 0** — 전량 T-1560 ~ T-1566 모듈 위임이며, 토글
(`PERF_CHECKIN_BASELINE`) 이 꺼진 기본 상태에서는 `fs` 조회 0 · write 0 · exit code 불변이라 기존
`perf test` step 동작은 바뀌지 않는다(ADR-0056 `§Decision 2` · `§Decision 3 (b)`).

## Required Reading

- [test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) — 본 task 가 사용할 helper 2 개의 시그니처 · 예외 계약 · 실경로 오염 가드.
- [test/perf/checkin-baseline-spec-wiring.spec.ts](../../test/perf/checkin-baseline-spec-wiring.spec.ts) — helper 계약이 이미 cover 하는 국면(중복 test 를 spec 쪽에 다시 쓰지 않기 위해).
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) `579~774 행` — 교체 대상 describe 전체(지역 함수 2 개 + test 8 개 + import 블록 `88~105 행`).
- [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) — 복제 대상. 특히 `env`(`ci-assessment-read`) · `baselineDir()` · `readRequest()` · `stepClock()` · import 블록.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 2` · `§Decision 3 (b)` · `§Follow-ups (b)`.
- [docs/tasks/T-1565-checkin-baseline-wire-summary-perf-spec.md](T-1565-checkin-baseline-wire-summary-perf-spec.md) — 확정된 배선 형태(복제 원본)의 의도.

## Acceptance Criteria

- [ ] summary spec 의 지역 `checkCheckinBaseline` / `seedCheckinBaseline` 정의가 **삭제** 되고 호출부가 전부 `checkCheckinBaselineForSpec` / `seedCheckinBaselineFixture` 위임으로 바뀐다 — `grep -n "function checkCheckinBaseline\|function seedCheckinBaseline" test/perf/summary-measure-confirm.perf-spec.ts` 결과 **0 줄**.
- [ ] 교체로 미사용이 된 import 는 정리한다 — `pnpm lint` 가 `--max-warnings=0` 로 통과.
- [ ] assessment spec 에 체크인 baseline 배선 describe 가 **1 개** 추가되고, 그 안에서 helper 2 개를 호출한다 — `grep -n "checkCheckinBaselineForSpec" test/perf/assessment-measure-confirm.perf-spec.ts` 결과 **1 줄 이상**.
- [ ] **happy-path** — 두 spec 각각 (a) 토글 off 기본 상태 → `status === "skipped"` · `reason === "disabled"` · `log` 가 `CHECKIN_LOG_PREFIX` 로 시작, (b) 토글 on × 임시 `repoRoot` 에 seed 된 baseline 존재 → `status === "compared"` · `regressed === false` test 각 1+.
- [ ] **error path** — 두 spec 각각 (1) `envMeta.label` 빈 문자열 → `RangeError` 가 래핑 없이 전파되고 baseline 디렉토리 **미생성**, (2) `seedCheckinBaselineFixture` 에 저장소 실경로(`defaultCheckinRepoRoot()`)를 넘기면 `RangeError` + write 0 회, test 각 1+.
- [ ] **분기 cover** — 토글 off(`disabled`) · 토글 on × 부재(`absent`, 비교 함수 미호출) · 토글 on × 존재(`compared`) 3 국면을 두 spec 각각 test 로 분리.
- [ ] **negative cases 충분 cover** — 두 spec 각각 (a) `regressed === true` 여도 throw 0(exit code 불변), (b) 토글 off 국면에서 `baselineFileExists` spy 호출 **0 회**, (c) 저장소 실경로 `test/perf/baselines` 목록이 전 국면 통과 후에도 불변, (d) 배선을 끼워도 기존 임시 `baseDir` established→compared round-trip 이 그대로 통과, 각 1+.
- [ ] 전역 토글은 `beforeEach` / `afterEach` 로 원복한다 — 다른 describe 에 누출 0(helper 는 jest hook 무의존이므로 spec 책임).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:perf` 로 두 perf-spec 이 통과하고, 실행 후 `test/perf/baselines` 디렉토리가 **생성되지 않았음**(또는 기존 내용 불변)을 확인.
- [ ] 총 diff ≤ 300 LOC · 변경 파일 2 개 유지 — 주석은 helper 의 JSDoc 을 참조하는 짧은 문장으로 축약하고, 같은 국면 test 는 `it.each` 로 묶어 분량을 줄인다.

## Out of Scope

- 잔여 measure→confirm perf-spec (`contribution` · `app-root` · `person` · `*-realdb` 계열) 배선 — 후속 slice.
- 체크인 baseline JSON 최초 생성·commit (ADR-0056 `§Follow-ups (a)`) — 실측 환경 + 사람 눈 확인 전제.
- `.github/workflows/ci.yml` 편집 · 신규 job 추가 · `scripts/daily-test.sh` leg 추가(drift-guard smoke 3 종 동반 수정으로 파일 cap 파괴).
- `checkin-baseline-*.ts` helper 5 종의 시그니처 · 동작 수정(본 task 는 소비자 측만 변경).
- 측정 로직 · tolerance 기본값 · endpoint 추가 등 perf harness 자체 변경.
- PLAN `140~142 행` 체크박스 · REQ-048 상태 변경(완료 선언 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
