---
id: T-1571
title: contribution · app-root perf-spec 에 체크인 baseline 배선 suite factory 호출 얹기
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T21:40:00Z
completedAt: 2026-08-11T22:51:30Z
prNumber: 1252
mergeCommit: 046d2161b5a2e80b5a33dbccd4ad81b06a518f4f
independentStream: perf-baseline-checkin
dependsOn: [T-1568, T-1569, T-1570]
touchesFiles:
  - test/perf/contribution-measure-confirm.perf-spec.ts
  - test/perf/app-root-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 확산 slice: 미배선 2 spec 에 factory 호출 1 회씩(신규 로직 0, spec 당 ~20 LOC)"
---

# T-1571 — contribution · app-root perf-spec 에 체크인 baseline 배선 suite factory 호출 얹기

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 의 체크인
baseline 확인 배선은 현재 `summary`(T-1569) · `assessment`(T-1570) 두 perf-spec 에만 얹혀
있다. [T-1568](T-1568-checkin-baseline-wiring-suite-factory.md) 이 국면 7 개를 공유 factory
`registerCheckinBaselineWiringSuite` 로 추출해 **소비자 추가 비용을 spec 당 ~20 LOC** 로 낮췄고,
T-1569 · T-1570 이 그 호출 형태를 2 회 실증했다. 본 slice 는 아직 미배선인
`contribution` · `app-root` measure→confirm perf-spec 2 개에 **같은 factory 호출 1 회씩**을 얹어
배선 적용 범위를 넓힌다. 판정 · 경로 · 로그 · seed 로직은 전량 기존 helper 위임이라 **신규
로직 0 줄**이며, 토글 off 기본 상태에서는 `fs` 조회 0 · write 0 · exit code 불변이라 기존
`perf test` step 동작도 바뀌지 않는다.

## Required Reading

- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — factory 계약(`CheckinBaselineWiringSuiteOptions`: `envMeta` · `measure` · `tempDir` · `title`), 등록 국면 7 개, 토글 저장·원복 hook
- [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) — 표준 호출 형태 (파일 끝 `registerCheckinBaselineWiringSuite({ ... })` 블록 + 그 앞 주석). 본 task 가 복제할 관용구의 정본
- [test/perf/contribution-measure-confirm.perf-spec.ts](../../test/perf/contribution-measure-confirm.perf-spec.ts) — 배선 대상 1. 재사용할 지역 헬퍼: `env`(`BaselineEnvMeta`) · `baselineDir()` · `stepClock()` · `readRequest()` · `measureBaselineCandidate`
- [test/perf/app-root-measure-confirm.perf-spec.ts](../../test/perf/app-root-measure-confirm.perf-spec.ts) — 배선 대상 2. `readRequest` 가 함수 호출이 아니라 **값**(`RequestFn`)인 점이 contribution 과 다르므로 주입 시 형태를 맞출 것
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 3 (b)`(관찰 전용 · exit code 불변) · `§Follow-ups (b)`

## Acceptance Criteria

- [x] `test/perf/contribution-measure-confirm.perf-spec.ts` 와 `test/perf/app-root-measure-confirm.perf-spec.ts` 각각에 `registerCheckinBaselineWiringSuite({ envMeta, measure, tempDir })` **호출 1 회**를 최상위 `describe` 안에 추가한다. `measure` 는 각 spec 의 `measureBaselineCandidate(readRequest…, env, { iterations, now: stepClock(stepMs) })` 위임, `tempDir` 은 지역 `baselineDir(name)` 위임.
- [x] **happy-path**: 두 spec 모두에서 factory 가 등록한 happy 국면 2 개(토글 off → `skipped`/`disabled` + prefix 로그, 토글 on × 존재 → `compared`/`regressed=false`)가 pass 한다 (`pnpm test:perf` 출력에서 두 spec 의 배선 describe 국면 확인).
- [x] **error path**: 등록된 error 국면 2 개(`envMeta.label` 빈 값 → `RangeError` + 파일 미생성, seed 에 저장소 실경로 → `RangeError` + 실 목록 불변)가 두 spec 에서 pass 한다.
- [x] **분기 cover**: 토글 on × baseline 부재 → `skipped`/`absent` + 비교 미호출 분기가 두 spec 에서 pass 한다 (factory 국면 (c)).
- [x] **negative cases 충분 cover**: 등록된 negative 국면 2 개(회귀 `regressed=true` 여도 throw 0 → exit code 불변, 토글 off 시 `baselineFileExists` 위임 0 회)가 두 spec 에서 pass 한다. 잘못된 `options` 로 인한 **등록 시점 `TypeError`** 국면은 factory colocated spec (`checkin-baseline-spec-suite.spec.ts`) 책임이라 본 spec 들에서 중복 작성하지 않는다 — 그 이유를 주석 1 줄로 명시.
- [x] 실 저장소 경로 `test/perf/baselines/` 가 **생성되지 않음**을 확인: `pnpm test:perf` 실행 후 `git status --porcelain test/perf/baselines` 출력이 비어 있고 디렉토리가 없어야 한다.
- [x] `pnpm lint --max-warnings=0` · `pnpm build` · `pnpm test` 통과. 미사용 import 0.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [x] `pnpm test:perf` 전체 통과, 대상 perf-spec 파일 수 불변(28), 두 spec 의 기존 국면은 **1 개도 삭제·수정되지 않음**(추가만).
- [x] 각 spec 헤더 주석 또는 호출부 앞에 "체크인 baseline 확인 배선 — ADR-0056 §Follow-ups (b), factory 위임(지역 사본 0)" 취지의 한국어 주석 블록 1 개 추가.

## Out of Scope

- `test/perf/checkin-baseline-*.ts` helper · factory 본체 및 그 colocated spec 수정 (본 task 는 **호출만**).
- spec 고유 통합 국면 추가 (assessment/summary 가 가진 `negative (c)/(d)` 형태) — 본 slice 는 factory 국면 7 개 배선까지만. 필요 시 Follow-ups 로.
- `*-realdb.perf-spec.ts` 계열 및 나머지 `*-read.perf-spec.ts` 배선.
- ADR-0056 `§Follow-ups (a)` — 실 baseline JSON 생성·commit (실측 + 사람 눈 확인 전제).
- `.github/workflows/ci.yml` 편집, `docs/PLAN.md` · REQ-048 상태 갱신 (완료 선언 0 유지).
- `src/` production 코드 변경, 임계 fix 갱신, 부하계획 문서 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

## 결과 (2026-08-11T22:51:30Z, DONE)

- PR **#1252** squash merge `046d2161` — `test/perf/contribution-measure-confirm.perf-spec.ts` · `test/perf/app-root-measure-confirm.perf-spec.ts` **2 파일 `+47/-0`** (cap `300 LOC / 5 파일` 이내). 기존 국면 삭제 · 수정 **0 줄** — 순수 추가.
- 각 spec 최상위 `describe` 안에 `registerCheckinBaselineWiringSuite({ envMeta, measure, tempDir })` **호출 1 회**씩 + 한국어 주석 블록 1 개. `measure` 는 지역 `measureBaselineCandidate` 위임, `tempDir` 은 지역 `baselineDir(name)` 위임 — **신규 판정 · 경로 · 로그 로직 0 줄**. `app-root` 는 `readRequest` 가 값(`RequestFn`)이라 호출 없이 주입, `contribution` 은 `readRequest()` 형태로 차이 흡수.
- 등록 시점 `TypeError` 국면은 factory colocated spec (`checkin-baseline-spec-suite.spec.ts`) 책임이라 중복 작성하지 않음을 주석 1 줄로 명시.
- R-110/R-112 — 두 spec 배선 국면 pass, 비-realdb perf **34 suite / 300 test** pass, unit **436 suite / 12475 test** pass, `test:cov` line **99.95%** · function **100%**, `lint --max-warnings=0` 통과(미사용 import 0). 실행 후 저장소 실경로 `test/perf/baselines` **미생성**.
- 4-게이트 충족 — reviewer APPROVE(round 1) PR comment 외화(`pull/1252#issuecomment-5259732351`) + integrator 자체 점검 + PR CI green + squash merge · branch 삭제.
- **완료 선언 0 유지** — PLAN · REQ-048 상태 미변경, `ci.yml` 편집 **0** · baseline JSON 생성 **0** · `*-realdb` 계열 등 잔여 perf-spec 미변경(Out of Scope 전부 보존).
