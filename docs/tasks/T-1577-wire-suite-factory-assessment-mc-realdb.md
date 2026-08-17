---
id: T-1577
title: assessment measure→confirm 실 DB perf-spec 에 체크인 baseline 배선 factory 얹기
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 1
created: 2026-08-17
createdAt: 2026-08-17T00:38:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1576]
touchesFiles:
  - test/perf/assessment-measure-confirm-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 확산 slice: realdb 계열 두 번째 소비자에 factory 호출 1 회(신규 로직 0, ~55 LOC)"
---

# T-1577 — assessment measure→confirm 실 DB perf-spec 에 체크인 baseline 배선 factory 얹기

## Why

ADR-0056 `§Follow-ups (b)` 의 체크인 baseline 확인 배선은 현재 mock 기반 `*-measure-confirm`
perf-spec 4 개(summary · assessment · contribution · app-root)와 실 DB 계열 **1 개**
(T-1576 이 연 `summary-measure-confirm-realdb`)에만 얹혀 있다. 나머지 `*-realdb` 계열은
미배선이라, **period optional 분기처럼 서로 다른 query 형태**의 실 DB 표본에서도 배선이 동일하게
동작하는지(토글 off 무동작 · 토글 on 판정 · exit code 불변)가 여전히 미관측이다. T-1576
Follow-ups 의 "나머지 `*-realdb` · `*-read` 계열 배선 확산" 항목 중 **소비자 1 개**만 여는
연속 slice 다(PLAN P5 성능 검증 / REQ-048 조회 p95 < 3s 계열).

배선은 공유 factory `registerCheckinBaselineWiringSuite` **호출 1 회**로 끝난다 — 국면 판정 ·
경로 · 로그 · seed 는 전량 helper 위임이라 spec 에는 고유분(`envMeta` · 측정 조립 · 임시
디렉토리)만 주입한다(지역 사본 0).

## Required Reading

- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` — 본 task 가 유일하게 수정하는 파일
  (기존 `env`(`realdb-assess-mc`) / `tmpRoot` / `dirOf` / `read` 조립을 그대로 재사용).
- `test/perf/summary-measure-confirm-realdb.perf-spec.ts` 의 파일 끝 factory 호출부 + `stepClock`
  정의 + `WIRING_ITER` 상수 — **직전 slice(T-1576)의 실 DB 배선 관용구 선례**. 본 task 는 같은
  관용구를 그대로 따른다.
- `test/perf/checkin-baseline-spec-suite.ts` — factory 계약(`CheckinBaselineWiringSuiteOptions`
  의 `envMeta` · `measure` · `tempDir` · `title`, 국면 10 개 = happy 3 · error 2 · 분기 2 ·
  negative 3, 등록 시점 인자 검사).
- `test/perf/latency-collector.ts` 의 `measureBaselineCandidate` 시그니처(주입 `now` 로 표본
  결정론화).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 2` · `§Decision 3 (b)` ·
  `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` 파일 끝(최상위 describe 안)에서
      `registerCheckinBaselineWiringSuite` 를 **1 회** 호출한다 — `envMeta` 는 기존 `env`
      (`realdb-assess-mc`), `tempDir` 은 기존 `dirOf` 기반 임시 경로, `measure` 는
      `measureBaselineCandidate(<실 인증 조회 RequestFn>, env, { iterations, now: stepClock(stepMs) })`
      조립. 국면 본문 · 판정 · 경로 문자열 · 로그 형식의 **지역 재구현 0**.
- [ ] 실 DB 반복 비용을 감안해 factory 주입 `measure` 의 `iterations` 는 소규모(2~3)로 고정하고,
      주입 clock 으로 표본을 결정론화한다(wall-clock 대소 단언 0). 배선용 조회는 seed 와 무관한
      매칭 0 건 query(예: `?personId=checkin-wiring-probe`)로 태워 기존 국면의 seed 수량 단언
      (`TOTAL_ROWS` · `WEEK_ROWS`)에 간섭하지 않는다.
- [ ] **happy-path** — 토글 off / 토글 on × 존재 / 토글 on × 기본 바인딩 국면(factory happy 3 개)이
      본 spec 에서 전부 실행돼 pass. `pnpm test:perf` 로
      `assessment-measure-confirm-realdb.perf-spec.ts` 실행 시 배선 describe 의 국면 **10 개**가
      추가로 보고된다.
- [ ] **error path** — factory error 국면 2 개(`envMeta.label` 빈 값 → `RangeError` + 파일 미생성,
      seed 에 저장소 실경로 → `RangeError` + 실 목록 불변)가 본 spec 환경에서도 동일하게 성립.
      잘못된 `options`(non-object · non-function)로 인한 등록 시점 `TypeError` 국면은 factory
      colocated spec(`checkin-baseline-spec-suite.spec.ts`) 책임이라 **중복 작성하지 않는다**.
- [ ] **분기 cover** — factory 분기 국면 2 개(토글 on × 부재 → `skipped/absent` + 비교 미호출,
      기본 바인딩 존재-조회 위임 토글 on 1 회 / off 0 회)가 실행된다.
- [ ] **negative cases 충분 cover** — factory negative 국면 3 개(회귀에도 throw 0 = exit code
      불변, 토글 off 위임 0 회, 기본 바인딩 on/off 연속 → 저장소 실경로 write 0)가 실행되고,
      실행 전후 `test/perf/baselines` 가 **생성되지 않음**(저장소 오염 0)을 확인한다.
- [ ] 전역 토글 저장 · 원복은 factory 의 `beforeEach` / `afterEach` 소관 — 본 spec 에 지역
      `savedFlag` 처리를 두지 않는다(이중 원복 0). 기존 `tmpRoot` 생성 · 삭제와 `truncateAll` +
      인증 actor 재seed 순서는 변경 0.
- [ ] `pnpm lint --max-warnings=0` · `pnpm build` · `pnpm test` (전체 unit suite) 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 기존 국면(happy ① · ② · 분기 · error · negative 전량)의 제목 · 단언 · 순서 **불변** — diff
      hunk 는 import 추가 · `stepClock` 등 측정 조립 helper · 파일 끝 factory 호출 · 주석에 한정.

## Out of Scope

- 다른 `*-realdb` · `*-read` perf-spec 배선(본 task 는 소비자 **1 개**만 —
  `contribution` · `app-root` · `person` realdb 는 후속 slice).
- `checkin-baseline-*.ts` helper · factory 본체(`checkin-baseline-spec-suite.ts`) 의 동작 변경 ·
  국면 추가 · label 변경.
- `test/perf/baselines/*.json` 최초 생성 · commit(ADR-0056 `§Follow-ups (a)`).
- `.github/workflows/ci.yml` perf step 토글 on 편입(`§Follow-ups (b)` 본체).
- 임계값(`p95MaxMs` 등) 갱신 · `PLAN.md` · REQ-048 상태 갱신 등 완료 선언.
- production code(`src/`) · Prisma schema 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
