---
id: T-1601
title: 체크인 baseline JSON 두 번째 route(ci-realdb-assessment-read) 확정 + 가드 spec 다중 label 화
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-08-18
independentStream: perf-checkin-baseline
dependsOn: [T-1594, T-1600]
touchesFiles:
  - test/perf/baselines/baseline-ci-realdb-assessment-read.json
  - test/perf/checkin-baseline-file.spec.ts
  - test/perf/README.md
plannerNote: "P5 ADR-0056 §Follow-ups (a) — T-1600 실측 20 표본으로 두 번째 체크인 baseline 확정 + 가드 1-파일 전제 해체"
---

# T-1601 — 체크인 baseline JSON 두 번째 route(ci-realdb-assessment-read) 확정 + 가드 spec 다중 label 화

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의 "체크인 baseline JSON 생성·commit" 축은 현재 `baseline-ci-realdb-person-read.json` **1 건**에서 멈춰 있다. 직전 T-1600 이 `GET /api/assessments` 실측 관찰 국면을 열어 CI 로그에 **20 표본 실측 줄**(`label=ci-realdb-assessment-read … count=20 pass=true`)을 처음 남겼으므로, `§Consequences (d)` 가 요구하는 "값의 타당성을 확인한 뒤 commit" 의 입력이 두 번째 route 에도 갖춰졌다. 본 task 는 그 실측 줄을 **재계산 0 · 전사만** 으로 체크인하고, 그 부작용으로 깨지는 가드 spec 의 **"체크인 파일은 정확히 1 개" 전제** 를 다중 label 표 기반으로 해체한다 (T-1594 가 도입한 표본 수 하한 · 단조성 가드는 두 파일 모두에 그대로 적용).

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 1`(저장 위치 · 파일명은 `resolveBaselinePath` 위임) · `§Decision 2`(pr-mode task 만 갱신, write 국면 부재) · `§Decision 3 (b)`(상대 회귀는 관찰만) · `§Consequences (a)`(stale label 파일 누적) · `§Consequences (d)` · `§Follow-ups (a)`
- `test/perf/baselines/baseline-ci-realdb-person-read.json` — 정본 직렬화 형태(단일 행 · 키 순서)의 유일한 선례
- `test/perf/checkin-baseline-file.spec.ts` — 본 task 가 다중 label 화할 가드 spec 전문 (특히 `CHECKIN_SAMPLE_COUNT` / `CHECKIN_SAMPLE_MIN` 상수와 negative `(b)` `(c)` `(d)` `(e)`)
- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` `308~360 행` — 실측 describe 의 `realClockEnv`(label `ci-realdb-assessment-read` · `concurrency: 1` · `dataScale` = `` `1 person / ${TOTAL_ROWS} assessments` ``, `TOTAL_ROWS = WEEK_ROWS(3) + MONTH_ROWS(2) = 5`) 와 `REAL_CLOCK_ITER = 20`
- `test/perf/checkin-baseline-store.ts` `42~76 행` — `resolveCheckinBaselineDir` / `resolveCheckinBaselinePath`
- `test/perf/README.md` `1254~1266 행` — "체크인 기준 baseline 축은 **1 건 한정으로 착수**" 문장 (본 task 로 2 건이 되어 정정 대상)
- `docs/progress/journal-2026-08-18.md` 의 `12:05 driver` 항목 — T-1600 CI 실측 줄 원문과 근거 run 좌표(PR #1280, run `32133870603`)

## Acceptance Criteria

- [ ] `test/perf/baselines/baseline-ci-realdb-assessment-read.json` 을 신설한다. 값은 T-1600 이 남긴 **CI 실측 줄을 전사** 한 것이며 **재계산·반올림 재산정 0** 이다. 근거로 삼은 run id 와 원문 줄을 PR 본문에 그대로 인용한다 (`gh run view <run-id> --log` 로 재확인 가능하면 로그 원문을 우선하고, 로그 만료 시 journal `12:05 driver` 항목의 인용 줄을 쓰되 어느 쪽을 썼는지 PR 본문에 명시).
- [ ] 파일 내용이 **정본 직렬화 형태** 를 지킨다 — 단일 행 JSON 이고 `serializeBaselineReport(parseBaselineReport(body))` 와 문자열 동일. 파일명·경로는 손으로 조립하지 않고 `resolveCheckinBaselinePath(env, repoRoot)` 유도값과 일치해야 한다.
- [ ] `env` 3 필드가 실측 spec 과 정확히 일치한다 — `label: "ci-realdb-assessment-read"`, `concurrency: 1`, `dataScale: "1 person / 5 assessments"` (spec 의 `TOTAL_ROWS` 유도값). `count` 는 20, `errorRate` 는 0, `pass` 는 `true`.
- [ ] `test/perf/checkin-baseline-file.spec.ts` 를 **다중 label 표 기반** 으로 바꾼다 — label · 표본 수 · `dataScale` 정규식을 담은 상수 배열(예: `CHECKIN_BASELINES`) 1 개를 두고 기존 국면(happy / error / 분기 / negative (a) (b) (d) (e))을 표 순회로 태운다. `CHECKIN_SAMPLE_MIN = 20` 하한은 두 항목 모두에 적용한다. **국면 삭제 0** — 기존 단언은 전부 살아 있어야 한다.
- [ ] negative `(c)`(stale 파일 누적 방지, `§Consequences (a)`)를 **1 파일 전제에서 집합 전제로** 바꾼다 — 디렉토리의 `.json` 목록이 표에서 유도한 파일명 집합(2 개)과 **정확히 같음** 을 단언해, 파일 누락과 미등록 stale 파일 양방향이 모두 fail 하게 한다.
- [ ] happy-path test — 신규 label 의 체크인 파일이 예외 0 으로 `readBaselineFile` 복원되고 원문이 정본 직렬화 형태와 문자열 동일함을 표 순회 국면이 덮는다.
- [ ] error path test — 미체크인 label(`ci-realdb-does-not-exist`)이 `ENOENT` 를 래핑 없이 전파하고 `baselineFileExists === false` 인 국면이 유지된다.
- [ ] 분기 cover — 각 체크인 label 에 대해 동일 수치 candidate(무회귀) / `p95` 를 10 배로 키운 candidate(회귀 표기) 두 방향을 모두 태우고, `compareBaselineReports` 가 **throw 0** 임을 단언한다(`§Decision 3 (b)` — exit code 불변).
- [ ] negative cases 충분 cover — (a) 표본 0(NaN) candidate 비교, (b) `dataScale` 표기 형태(route 별 서로 다른 정규식), (c) 디렉토리 파일 집합 일치, (d) 표본 수 하한(`meetsSampleFloor(3) === false` · 소수 표본 거부 관찰 포함), (e) `p50 <= p95 <= p99` 단조성 + `throughput > 0` + `0 <= errorRate <= 1` 를 **두 label 모두** 에 대해 태운다.
- [ ] 부작용 0 유지 — 가드 spec 은 파일 write · mkdir · 전역 `process.env` 변경을 0 회 하고 read-only 조회만 한다(`§Decision 2` write 국면 부재).
- [ ] `test/perf/README.md` `1254~1266 행` 의 "체크인 기준 baseline 축은 **1 건 한정으로 착수**" / "한 건만" 표현을 **2 건**(person-read · assessment-read) 으로 정정하고 근거 task(T-1601)를 각주로 적는다. **과잉 정정 금지** — 같은 bullet 의 나머지 단언(부하 harness 미착수 · 임계 fix 미착수 · 축 미소진 판정)은 전부 불변.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` 변경 0 이므로 coverage 수치는 직전과 동일해야 한다.
- [ ] PR CI 의 `perf test` step 로그에서 신규 label 이 `compared` 국면으로 진입하고 `count=20` candidate 가 찍히는지 확인해 PR 본문에 기록한다(회귀 관찰만 — exit code 불변).

## Out of Scope

- `test/perf/*.perf-spec.ts` 어떤 파일의 국면 · 상수 · 배선 변경 (T-1600 이 확정한 실측 describe 는 **읽기만**).
- ADR-0056 `§Follow-ups (b)` — `ci.yml` 편입 / perf step 토글 변경 (drift-guard smoke 3 종 동반이라 별도 slice).
- `§Follow-ups (c)` tolerance 임계 재산정 · 부하계획 `§ 3` 임계 fix 승격 (동일 `env.label` 20 run 축적 미달).
- `§Follow-ups (d)` PLAN `142 행` · REQ-048 매핑표 doc-sync.
- 세 번째 route 실측 관찰 국면 확산, `*-realdb` / `*-read` 계열 perf-spec 의 factory 배선.
- `compareBaselineReports` / `resolveBaselinePath` 등 helper 구현 변경 — 본 task 는 데이터 + 가드만 건드린다.
- person-read baseline JSON 의 수치 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
