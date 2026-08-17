---
id: T-1586
title: person 조회 perf-spec 에 체크인 baseline 배선 factory 얹기 (*-read 계열 첫 소비자)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 75
estimatedFiles: 1
created: 2026-08-17
createdAt: 2026-08-17T20:40:52Z
independentStream: perf-baseline-checkin
dependsOn: [T-1584]
touchesFiles:
  - test/perf/person-read.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 확산: measure→confirm top loop 없는 *-read 계열 첫 소비자에 factory 호출 1 회(신규 로직 0)"
---

# T-1586 — person 조회 perf-spec 에 체크인 baseline 배선 factory 얹기 (`*-read` 계열 첫 소비자)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 의 확산 slice.
T-1576 ~ T-1580 으로 **measure→confirm 계열 9 개(mock 4 + 실 DB 5)** 는 전부 배선됐고
T-1584 가 `ci.yml` 토글을 켰으므로, 이제 배선 국면이 CI 에서 실제로 돈다. 남은 미배선 표면은
[STATE `backlogNoteResolved`](../STATE.json) 가 후보 ① 로 지목한 **`*-read` 계열**이다.

본 slice 의 고유 축은 **"measure→confirm top loop 이 없는 spec 도 같은 배선을 태울 수 있는가"**
다. 기존 소비자 9 개는 전부 `measureAndConfirmBaseline` 을 자기 본문에 쓰고 있어 factory 가
쓰는 seam(`measureBaselineCandidate` + 주입 clock)이 이미 spec 안에 있었다. `person-read`
(mock `PersonService`, guard 미부착 `GET /api/persons`)는 `collectLatencySamples` /
`assertS2Threshold` 만 쓰는 **순수 관찰형 spec** 이라, 배선이 spec 의 기존 조립에 의존하지 않고
factory 호출 1 회로 성립함을 처음 관측한다. REQ-048 의 "조회 p95 < 3s" 가 실제로 매달린 것이
`*-read` 계열이므로, 향후 `§Follow-ups (a)` 의 체크인 baseline 이 앉을 자리를 미리 여는 의미도
있다.

## Required Reading

- `test/perf/person-read.perf-spec.ts` — 본 task 가 유일하게 수정하는 파일(219 행, 기존 `it` 6
  개). `readRequest`(`RequestFn` **값**) · mock `service.findActive` · `beforeEach` 의
  `jest.clearAllMocks()` 위치를 확인할 것. `fs` · `os` · `path` import 는 **현재 없다**.
- `test/perf/app-root-measure-confirm.perf-spec.ts` 의 `stepClock` alias import(84~85 행) ·
  `tmpRoot` 생성(127 행) · `baselineDir` 헬퍼(136 행) · 파일 끝 factory 호출부 — **mock 계열
  배선 관용구의 직전 선례**. 구조는 동형으로 따르되 주석 문구 복제는 최소화한다.
- `test/perf/checkin-baseline-spec-suite.ts` — factory 계약
  (`CheckinBaselineWiringSuiteOptions` 의 `envMeta` · `measure(stepMs)` · `tempDir(name)` ·
  `title`, 국면 10 개 = happy 3 · error 2 · 분기 2 · negative 3, 등록 시점 인자 형태 검사,
  전역 토글 저장 · 원복 소관, 등록 ≠ 실행).
- `test/perf/latency-collector.ts` 의 `measureBaselineCandidate` 시그니처 — 주입 `now` 로 표본
  결정론화.
- `test/perf/step-clock.ts` — `createStepClock(stepMs)` (T-1581 승격 공유 helper).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 3 (b)` · `§Follow-ups (a)/(b)`.

## Acceptance Criteria

- [ ] `test/perf/person-read.perf-spec.ts` 최상위 `describe` 안 파일 끝에서
      `registerCheckinBaselineWiringSuite` 를 **1 회** 호출한다 — `envMeta` 는 본 spec 고유
      label(예: `ci-person-read`, `concurrency: 1`), `tempDir` 은 `fs.mkdtempSync` 로 만든
      저장소 **밖** 임시 root 하위 경로, `measure` 는
      `measureBaselineCandidate(readRequest, env, { iterations: <소규모 고정>, now: createStepClock(stepMs) })`
      조립. 판정 · baseline 경로 조립 · 로그 형식 · 토글 저장/원복의 **지역 재구현 0**(전량
      helper 위임).
- [ ] happy path — factory 의 happy 국면 3 개(토글 off 무동작 · 토글 on 확정 write · 재실행 비교)
      가 본 소비자에서 전부 통과. `measure` 람다가 **자기 안에서** `service.findActive` 의 반환을
      세팅해(외곽 `beforeEach` 의 `jest.clearAllMocks()` 이후에도) 200 응답이 결정론적으로 나오는지
      확인.
- [ ] error path — factory 의 error 국면 2 개(손상 baseline 파일 · 무효/접근 불가 경로 계열)가
      동일하게 통과하고, 주입한 `measure` 가 예외를 삼키지 않고 국면으로 전파함을 확인.
- [ ] 분기 cover — factory 의 분기 국면 2 개(established ↔ compared, `repoRoot` 지정 ↔ 어댑터
      기본 바인딩)가 모두 실행된다. 본 task 는 spec 에 새 분기를 **추가하지 않으므로**(호출 1 회)
      분기 cover 는 factory 국면 등록으로 충족한다.
- [ ] negative 충분 cover — factory 의 negative 국면 3 개(토글 값 비정상 · 임시 경로 부재 · 무효
      인자 형태)가 전부 등록·통과하고, **기존 `it` 6 개의 제목 · 단언 · 순서가 불변** 이며 본 파일의
      수집 test 수가 정확히 `6 → 16` 으로 늘어난다. 배선 국면이 기존 mock 호출 횟수 단언
      (`toHaveBeenCalledTimes`)에 간섭하지 않음을 확인.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(기존 unit suite 무회귀) + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] perf 대상 실행으로 본 spec 16 test 전량 pass — 실행 명령과 결과를 PR 본문에 명시. mock
      spec 이라 Postgres 불요.
- [ ] 저장소 실경로 오염 0 — 본 spec 실행 후 `test/perf/baselines/` 에 파일이 생기지 않는다
      (`tempDir` 이 매 test 격리 임시 root 아래만 쓰는지 확인, `afterAll` 정리 포함).

## Out of Scope

- ADR-0056 `§Follow-ups (a)` — 체크인 기준 baseline JSON 최초 생성 · commit(실측 + 사람 눈 확인
  전제 + `env.label` 축 확정 필요, 별도 task).
- ADR-0056 `§Follow-ups (c)` — 부하계획 `§ 3` 임계 fix 갱신(doc-sync, 별도 task).
- 다른 `*-read` / `*-scale` / `*-detail-read` perf-spec 으로의 배선 확산 — 본 slice 는 **1 개
  spec** 만.
- 기존 국면 6 개의 문구 · 단언 · 반복수 변경, `assertS2Threshold` 임계 조정, wall-clock 대소
  단언 추가(T-0877 / T-0880 flaky 재발 차단 원칙 유지).
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, `test/perf/jest-perf.json` · `ci.yml` 변경,
  `deploy/daily-test.sh` 계열 접촉(drift-guard smoke 동반 수정으로 파일 cap 이 깨진 T-1122 전례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
