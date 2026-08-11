---
id: T-1569
title: summary perf-spec 의 체크인 baseline 배선 describe 를 suite factory 호출로 수렴
phase: P5
status: DONE
completedAt: 2026-08-11T19:05:00Z
prNumber: 1250
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-08-11
createdAt: 2026-08-11T17:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1566, T-1567, T-1568]
touchesFiles:
  - test/perf/summary-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 회수 slice: T-1568 factory 의 첫 소비자로 summary spec 배선 국면 7 개를 호출 1 회로 교체(순삭 diff, 1 파일)"
---

# T-1569 — summary perf-spec 의 체크인 baseline 배선 describe 를 suite factory 호출로 수렴

## Why

[T-1568](T-1568-checkin-baseline-wiring-suite-factory.md) 이 체크인 baseline 배선 국면 7 개를
공유 factory (`registerCheckinBaselineWiringSuite`) 로 추출했지만, **아직 소비자가 0 개** 다 —
factory 는 colocated spec 안에서만 실행되고 실제 perf-spec 두 개
(`summary` · `assessment`) 는 T-1565 · T-1567 이 남긴 **평면 복제 describe** 를 그대로 들고
있다. 부품만 있고 회수가 없으면 판본이 오히려 3 벌(summary · assessment · factory)로 늘어나
[T-1566](T-1566-checkin-baseline-spec-wiring-helper.md) 이 helper 로 좁혀둔 drift 표면이 다시
벌어진다.

본 task 는 그 회수의 **첫 slice** 로, 소비자 한 개
([test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts)
`578~765 행`) 의 배선 describe 를 factory 호출 1 회로 교체한다. 국면 7 개(happy 2 · error 2 ·
분기 1 · negative 2)는 factory 가 등록하고, spec 고유 통합 국면 2 개(`negative (c)` 실경로
불변 · `negative (d)` established→compared round-trip) 만 spec 에 남긴다. 결과는 **순삭 diff**
이며 잔여 소비자(`assessment` → 후속 slice, `contribution` · `app-root` · `*-realdb` 5 종) 가
따를 **표준 호출 형태를 실증** 한다.

동작 변경은 0 이다 — 판정 · 경로 · 로그 · seed 는 전량 T-1560 ~ T-1566 모듈 위임이고, 토글
(`PERF_CHECKIN_BASELINE`) 이 꺼진 기본 상태에서 `fs` 조회 0 · write 0 · exit code 불변이라 기존
`perf test` step 의 결과가 바뀌지 않는다 (ADR-0056 `§Decision 2` · `§Decision 3 (b)`).

## Required Reading

- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — `registerCheckinBaselineWiringSuite(options)` 시그니처(`envMeta` · `measure(stepMs)` · `tempDir(name)` · 선택 `title`), 등록 국면 7 개 label, 반환값(`string[]`), 전역 토글 저장·원복 위치.
- [test/perf/checkin-baseline-spec-suite.spec.ts](../../test/perf/checkin-baseline-spec-suite.spec.ts) — factory 호출 형태와 인자 계약이 이미 cover 하는 국면 목록. 여기서 검증되는 국면을 소비자 spec 이 **중복 작성하지 않도록** 대조용으로 읽는다.
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) `120~223 행`(공통 fixture — `env` · `baselineDir()` · `readRequest()` · `stepClock()`) · `578~765 행`(교체 대상 describe 전체).
- [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) `633~808 행` — 같은 형태의 복제본. 본 task 는 **읽기만** 하고 편집하지 않는다(후속 slice).
- [test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) — spec 에 남길 통합 국면이 계속 직접 호출하는 helper 2 개의 예외 계약 · 실경로 오염 가드.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 2` · `§Decision 3 (b)` · `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) 가 `registerCheckinBaselineWiringSuite` 를 **호출 1 회** 로 배선하고, 기존 배선 describe 안의 국면 7 개(`happy (a)` · `happy (b)` · `분기 (c)` · `error (1)` · `error (2)` · `negative (a)` · `negative (b)`) 지역 사본이 **삭제** 된다 — 같은 국면의 지역 `it(` 이 0 개임을 파일 검사로 확인.
- [ ] factory 에 넘기는 options 는 **spec 고유분만** — `envMeta: env` · `measure` 는 기존 `measureBaselineCandidate(readRequest(), env, { iterations, now: stepClock(ms) })` 조립 그대로 · `tempDir` 는 기존 `baselineDir()` 위임. spec 안에 경로 문자열 리터럴 · 판정 · 로그 형식 **재구현 0**(`grep -n "baselines\"\|CHECKIN_LOG_PREFIX" test/perf/summary-measure-confirm.perf-spec.ts` 결과에 신규 추가분 0 줄).
- [ ] **happy-path** — 교체 후 `pnpm test:perf -- summary-measure-confirm` 실행 시 factory 가 등록한 (a) 토글 off → `skipped`/`disabled`, (b) 토글 on × baseline 존재 → `compared` · `regressed === false` 두 국면이 실제로 등록·통과한다.
- [ ] **error path** — factory 등록 국면 중 (1) `envMeta.label` 빈 문자열 → `RangeError` 전파 + 디렉토리 미생성, (2) seed 에 저장소 실경로 → `RangeError` + 실 baselines 목록 불변 두 국면이 통과한다. 추가로 spec 이 factory 를 **유효 options** 로만 호출함을 보장 — 잘못된 options 로 인한 등록 시점 `TypeError` 는 factory colocated spec 책임이므로 여기서 중복 작성하지 않는다(본문에 그 이유 1 줄 주석).
- [ ] **분기 cover** — 토글 off / 토글 on × 부재(`absent` + 비교 함수 미호출) / 토글 on × 존재(`compared`) 3 분기가 각각 별도 test 로 실행된다(= factory 등록분).
- [ ] **negative cases 충분 cover** — (a) `regressed === true` 여도 throw 0(exit code 불변, factory 등록분), (b) 토글 off 국면에서 `baselineFileExists` 위임 **0 회**(factory 등록분), (c) spec 에 남는 통합 국면 — 전 국면 통과 후 저장소 실경로 `test/perf/baselines` 목록 **불변**, (d) spec 에 남는 통합 국면 — 임시 baseDir established→compared round-trip 이 배선을 끼운 뒤에도 `regressed === false` 로 통과, 각 1+.
- [ ] 배선 국면 test **총 수가 줄지 않는다** — 교체 전 9 개(7 + 통합 2) ≥ 교체 후 9 개(factory 7 + 통합 2). 실행 로그의 test 수로 확인.
- [ ] 전역 토글 원복이 factory 의 `beforeEach` / `afterEach` 로 이관되면서 spec 지역 `savedFlag` 처리가 남아 **이중 원복** 되지 않는다 — 지역 토글 저장·원복 코드가 삭제됐고, spec 의 다른 describe 가 토글 누출 없이 통과.
- [ ] 교체로 사용처가 사라진 import 가 남지 않는다 — `pnpm lint`(`--max-warnings=0`) 통과로 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:perf` 통과 + 실행 후 저장소 실경로 `test/perf/baselines` 가 **생성되지 않았음**(또는 기존 내용 불변) 확인.
- [ ] `git diff --name-only origin/main` 결과가 [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) **1 파일뿐** 이고 총 diff ≤ 300 LOC.

## Out of Scope

- `assessment` measure→confirm perf-spec 의 같은 describe 교체 — 후속 slice(본 task 는 소비자 1 개로 형태를 실증).
- 잔여 measure→confirm perf-spec(`contribution` · `app-root` · `*-realdb` 계열 5 종) 에 배선 추가.
- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) 및 `checkin-baseline-*.ts` helper 5 종의 시그니처 · 국면 구성 · 동작 수정(필요가 보이면 Follow-ups 에 적고 진행하지 않는다). T-1568 이 남긴 `jest.spyOn` `try/finally` nit 도 여기서 고치지 않는다.
- summary perf-spec 의 다른 describe 4 개(happy / error / flow / negative 본체) 의 국면 변경 · 재배치.
- 체크인 baseline JSON 최초 생성·commit (ADR-0056 `§Follow-ups (a)`) — 실측 + 사람 눈 확인 전제.
- `.github/workflows/ci.yml` 편집 · 신규 job 추가 · `scripts/daily-test.sh` leg 추가(drift-guard smoke 3 종 동반 수정으로 파일 cap 파괴).
- 측정 로직 · tolerance 기본값 · endpoint 추가 등 perf harness 자체 변경.
- PLAN `140~142 행` 체크박스 · REQ-048 상태 변경(완료 선언 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- 후속 slice 후보 1 — `assessment` measure→confirm perf-spec 을 같은 형태로 수렴(본 task 가 실증한 호출 형태 재사용).
- 후속 slice 후보 2 — `contribution` · `app-root` measure→confirm perf-spec 에 factory 호출 배선(spec 당 ~10 LOC 이라 묶음 가능).
- 후속 slice 후보 3 — `*-realdb` 계열 5 spec 배선. DB 부재 시 skip 게이트와 국면 등록의 상호작용을 먼저 확인할 것.

## 결과 (2026-08-11 DONE)

`pr` mode PR **#1250** squash merge `8c846ced`. `test/perf/summary-measure-confirm.perf-spec.ts`
**1 파일 `+52/-145`** — 배선 describe 의 국면 7 개를 T-1568 factory
(`registerCheckinBaselineWiringSuite`) 호출 **1 회**로 수렴시킨 순삭 diff.
지역 `savedFlag` 저장·원복을 삭제(이중 원복 0)하고, spec 에 남긴 통합 국면 2 개는
`processEnv` 주입으로 토글을 격리했다. 미사용 import 3 종 제거 —
`lint --max-warnings=0` 통과. **판정·경로·로그 재구현 0 줄**(전량 factory / helper 위임),
등록 시점 `TypeError` 검증은 factory colocated spec 책임임을 본문 주석에 명시.

**test 총수 불변** — 파일 28 test 유지(배선 국면 9 >= 9). 전체 **436 suite / 12475 test**
pass, `test:cov` line **99.95%** · function **100%**. `test:perf` 대상 spec 28 개 전량 통과 +
실행 후 저장소 실경로 `test/perf/baselines` **미생성**(오염 0).

4-게이트 충족 — reviewer APPROVE(round 1, MINOR 1 건 비차단) PR comment 외화 +
integrator 자체 점검 + PR CI pass + squash merge. **완료 선언 0 유지** —
PLAN · REQ-048 상태 미변경, `ci.yml` 편집 **0** · baseline JSON 생성 **0** ·
`assessment` 등 잔여 perf-spec 미변경(Out of Scope 전부 보존).
