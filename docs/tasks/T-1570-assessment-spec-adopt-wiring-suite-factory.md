---
id: T-1570
title: assessment perf-spec 의 체크인 baseline 배선 describe 를 suite factory 호출로 수렴
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-08-11
createdAt: 2026-08-11T19:38:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1566, T-1567, T-1568, T-1569]
touchesFiles:
  - test/perf/assessment-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 회수 slice 2: T-1569 가 실증한 factory 호출 형태를 assessment spec 에 적용(순삭 diff, 1 파일)"
---

# T-1570 — assessment perf-spec 의 체크인 baseline 배선 describe 를 suite factory 호출로 수렴

## Why

[T-1568](T-1568-checkin-baseline-wiring-suite-factory.md) 이 체크인 baseline 배선 국면 7 개를
공유 factory (`registerCheckinBaselineWiringSuite`) 로 추출했고,
[T-1569](T-1569-summary-spec-adopt-wiring-suite-factory.md) 가 `summary` perf-spec 을 그 첫
소비자로 수렴시켜(`+52/-145` 순삭 diff) **표준 호출 형태를 실증** 했다. 그러나
`assessment` perf-spec 은 아직 T-1567 이 남긴 **평면 복제 describe**
([test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts)
`633~808 행`) 를 그대로 들고 있어 판본이 2 벌(assessment 지역 사본 · factory)로 갈라져 있다.
[T-1566](T-1566-checkin-baseline-spec-wiring-helper.md) 이 좁혀둔 drift 표면이 다시 벌어지는
상태라, 잔여 소비자(`contribution` · `app-root` · `*-realdb` 계열) 배선 전에 회수를 끝내야
한다.

본 task 는 그 **회수의 마지막 남은 평면 복제 1 건** 을 처리한다 — assessment 의 배선 describe
국면 7 개를 factory 호출 1 회로 교체하고, spec 고유 통합 국면 2 개(`negative (c)` 실경로
불변 · `negative (d)` established→compared round-trip) 만 spec 에 남긴다. T-1569 가 확정한
형태(토글을 전역 대신 `processEnv` 주입으로 격리, 지역 `savedFlag` 삭제) 를 그대로 재현하므로
새 설계 판단이 0 이다.

동작 변경은 0 이다 — 판정 · 경로 · 로그 · seed 는 전량 T-1560 ~ T-1566 모듈 위임이고, 토글
(`PERF_CHECKIN_BASELINE`) 이 꺼진 기본 상태에서 `fs` 조회 0 · write 0 · exit code 불변이라 기존
`perf test` step 의 결과가 바뀌지 않는다 (ADR-0056 `§Decision 2` · `§Decision 3 (b)`).

## Required Reading

- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) `575~673 행` — T-1569 가 확정한 **표준 호출 형태**(factory 호출 블록 + 남긴 통합 국면 2 개의 `processEnv` 주입 방식 + 주석 문구). 본 task 는 이 형태를 assessment 에 재현한다.
- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — `registerCheckinBaselineWiringSuite(options)` 시그니처(`envMeta` · `measure(stepMs)` · `tempDir(name)` · 선택 `title`), 등록 국면 7 개 label, 반환값(`string[]`), 전역 토글 저장·원복 위치.
- [test/perf/checkin-baseline-spec-suite.spec.ts](../../test/perf/checkin-baseline-spec-suite.spec.ts) — factory colocated spec 이 이미 cover 하는 국면 목록(등록 시점 `TypeError` 포함). 소비자 spec 이 **중복 작성하지 않도록** 대조용.
- [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) `115~223 행`(공통 fixture — `env` `123 행` · `baselineDir()` `175 행` · `readRequest` `184 행` · `stepClock()` `210 행`) · `633~808 행`(교체 대상 describe 전체).
- [test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) — spec 에 남길 통합 국면이 계속 직접 호출하는 helper 2 개(`checkCheckinBaselineForSpec` · `seedCheckinBaselineFixture`) 의 `processEnv` 주입 계약 · 실경로 오염 가드.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 2` · `§Decision 3 (b)` · `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) 가 `registerCheckinBaselineWiringSuite` 를 **호출 1 회** 로 배선하고, 기존 배선 describe 안의 국면 7 개(`happy (a)` · `happy (b)` · `분기 (c)` · `error (1)` · `error (2)` · `negative (a)` · `negative (b)`) 지역 사본이 **삭제** 된다 — 같은 국면의 지역 `it(` 이 0 개임을 파일 검사로 확인.
- [ ] factory 에 넘기는 options 는 **spec 고유분만** — `envMeta: env`(`ci-assessment-read`) · `measure` 는 기존 `measureBaselineCandidate(readRequest(), env, { iterations: 3, now: stepClock(stepMs) })` 조립 그대로 · `tempDir` 는 기존 `baselineDir()` 위임. spec 안에 경로 문자열 리터럴 · 판정 · 로그 형식 **재구현 0**(`grep -n "baselines\"\|CHECKIN_LOG_PREFIX" test/perf/assessment-measure-confirm.perf-spec.ts` 결과에 신규 추가분 0 줄).
- [ ] **happy-path** — 교체 후 `pnpm test:perf -- assessment-measure-confirm` 실행 시 factory 가 등록한 (a) 토글 off → `skipped`/`disabled`, (b) 토글 on × baseline 존재 → `compared` · `regressed === false` 두 국면이 실제로 등록·통과한다.
- [ ] **error path** — factory 등록 국면 중 (1) `envMeta.label` 빈 문자열 → `RangeError` 전파 + 디렉토리 미생성, (2) seed 에 저장소 실경로 → `RangeError` + 실 baselines 목록 불변 두 국면이 통과한다. 추가로 spec 이 factory 를 **유효 options 로만** 호출함을 보장 — 잘못된 options 로 인한 등록 시점 `TypeError` 는 factory colocated spec 책임이므로 여기서 중복 작성하지 않는다(본문에 그 이유 1 줄 주석).
- [ ] **분기 cover** — 토글 off / 토글 on × 부재(`absent` + 비교 함수 미호출) / 토글 on × 존재(`compared`) 3 분기가 각각 별도 test 로 실행된다(= factory 등록분).
- [ ] **negative cases 충분 cover** — (a) `regressed === true` 여도 throw 0(exit code 불변, factory 등록분), (b) 토글 off 국면에서 `baselineFileExists` 위임 **0 회**(factory 등록분), (c) spec 에 남는 통합 국면 — 전 국면 통과 후 저장소 실경로 `test/perf/baselines` 목록 **불변**, (d) spec 에 남는 통합 국면 — 임시 baseDir established→compared round-trip 이 배선을 끼운 뒤에도 `regressed === false` 로 통과, 각 1+.
- [ ] 배선 국면 test **총 수가 줄지 않는다** — 교체 전 9 개(7 + 통합 2) ≥ 교체 후 9 개(factory 7 + 통합 2). 실행 로그의 test 수로 확인.
- [ ] 전역 토글 원복이 factory 의 `beforeEach` / `afterEach` 로 이관되면서 spec 지역 `savedFlag` 처리(`635~652 행` 부근)가 남아 **이중 원복** 되지 않는다 — 지역 토글 저장·원복 코드가 삭제되고, 남는 통합 국면 2 개는 T-1569 와 같이 `processEnv` 주입으로 토글을 격리한다(전역 `process.env` 미변경).
- [ ] 교체로 사용처가 사라진 import 가 남지 않는다 — `pnpm lint`(`--max-warnings=0`) 통과로 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:perf` 통과 + 실행 후 저장소 실경로 `test/perf/baselines` 가 **생성되지 않았음**(또는 기존 내용 불변) 확인.
- [ ] `git diff --name-only origin/main` 결과가 [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) **1 파일뿐** 이고 총 diff ≤ 300 LOC.

## Out of Scope

- 잔여 measure→confirm perf-spec(`contribution` · `app-root` · `person` · `*-realdb` 계열) 에 배선 추가 또는 factory 호출 — 후속 slice.
- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) 및 `checkin-baseline-*.ts` helper 5 종의 시그니처 · 국면 구성 · 동작 수정(필요가 보이면 Follow-ups 에 적고 진행하지 않는다). T-1569 reviewer 가 남긴 MINOR(`measureCandidate` 기본값 전용 파라미터) 도 여기서 고치지 않는다.
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) 재편집 — T-1569 로 이미 수렴됨.
- assessment perf-spec 의 다른 describe 4 개(happy / error / flow / negative 본체) 의 국면 변경 · 재배치.
- 체크인 baseline JSON 최초 생성·commit (ADR-0056 `§Follow-ups (a)`) — 실측 + 사람 눈 확인 전제.
- `.github/workflows/ci.yml` 편집 · 신규 job 추가 · `scripts/daily-test.sh` leg 추가(drift-guard smoke 3 종 동반 수정으로 파일 cap 파괴).
- 측정 로직 · tolerance 기본값 · endpoint 추가 등 perf harness 자체 변경.
- PLAN `140~142 행` 체크박스 · REQ-048 상태 변경(완료 선언 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- 후속 slice 후보 1 — `contribution` · `app-root` measure→confirm perf-spec 에 factory 호출 배선(spec 당 ~10 LOC 이라 묶음 가능).
- 후속 slice 후보 2 — `*-realdb` 계열 spec 배선. DB 부재 시 skip 게이트와 국면 등록의 상호작용을 먼저 확인할 것.
- 후속 slice 후보 3 — ADR-0056 `§Follow-ups (b)` 의 `ci.yml` 편입(기존 `perf test` step 재사용). drift-guard smoke 동반 수정 여부를 사전 산정할 것.
