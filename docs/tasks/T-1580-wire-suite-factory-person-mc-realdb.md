---
id: T-1580
title: person measure→confirm 실 DB perf-spec 에 체크인 baseline 배선 factory 얹기
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 1
created: 2026-08-17
createdAt: 2026-08-17T06:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1579]
touchesFiles:
  - test/perf/person-measure-confirm-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 확산 마지막 slice: measure→confirm 계열 유일 미배선 소비자(guard 0 × 실 SELECT)에 factory 호출 1 회(신규 로직 0, ~55 LOC)"
---

# T-1580 — person measure→confirm 실 DB perf-spec 에 체크인 baseline 배선 factory 얹기

## Why

ADR-0056 `§Follow-ups (b)` 의 체크인 baseline 확인 배선은 현재 mock 계열 4 개
(`summary` · `assessment` · `contribution` · `app-root`) 와 실 DB 계열 4 개
(T-1576 `summary-...-realdb`, T-1577 `assessment-...-realdb`, T-1578
`contribution-...-realdb`, T-1579 `app-root-...-realdb`) 총 8 소비자에 얹혀 있다. `origin/main`
재확인 결과 `*-measure-confirm*` 계열에서 **아직 미배선인 spec 은
`person-measure-confirm-realdb` 단 1 개** 이며, 이 표본은 **guard 가 없으면서 요청 경로가 실
SELECT 를 발화하는 유일한 조합**(T-1579 의 app-root 는 guard 0 이지만 DB 미접촉, T-1576~T-1578 은
guard 통과 + DB 접촉) 이라 배선 seam 이 인증 layer 없이 실 query 를 태우는 환경에서도 동일하게
동작하는지(토글 off 무동작 · 토글 on 판정 · exit code 불변) 가 미관측이다. 본 slice 는 T-1579
Follow-ups 의 "나머지 `*-realdb` 계열 배선 확산" 을 **소비자 1 개**로 마감하는 연속 slice 다
(PLAN P5 성능 검증 / REQ-048 조회 p95 < 3s 계열). 배선이 끝나면 measure→confirm 계열 9 spec 전부가
같은 factory seam 을 통과한다.

배선은 공유 factory `registerCheckinBaselineWiringSuite` **호출 1 회**로 끝난다 — 국면 판정 ·
경로 · 로그 · 토글 저장·원복은 전량 helper 위임이라 spec 에는 고유분(`envMeta` · 측정 조립 ·
임시 디렉토리)만 주입한다(지역 사본 0 · 신규 프로덕션 로직 0).

## Required Reading

- `test/perf/person-measure-confirm-realdb.perf-spec.ts` — 본 task 가 유일하게 수정하는 파일
  (255 행). 기존 `env`(`realdb-person-mc`) · `tmpRoot` · `dirOf` · `read` · `run` 조립을 그대로
  재사용한다. 현재 `measureAndConfirmBaseline` 만 import 하므로 `measureBaselineCandidate`
  import 추가가 필요하다. `read()` 는 인자 없이 호출하면 Cookie 미부착 `GET /api/persons` 이며
  seed 가 없어도 200 + 빈 배열이라 배선 국면은 seed 에 의존하지 않는다.
- `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` 의 `WIRING_ITER` 상수(54 행) ·
  `stepClock` 정의(61~73 행) · 파일 끝 factory 호출부(285~297 행) — **실 DB 배선 관용구의 직전
  선례**. 본 task 는 같은 구조를 따른다(문구 복제는 최소화하되 구조는 동형).
- `test/perf/checkin-baseline-spec-suite.ts` — factory 계약
  (`CheckinBaselineWiringSuiteOptions` 의 `envMeta` · `measure` · `tempDir` · `title`, 국면 10 개
  = happy 3 · error 2 · 분기 2 · negative 3, 등록 시점 인자 형태 검사, 전역 토글 저장 · 원복
  소관).
- `test/perf/latency-collector.ts` 의 `measureBaselineCandidate` 시그니처(주입 `now` 로 표본
  결정론화).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 2` · `§Decision 3 (b)` ·
  `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] `test/perf/person-measure-confirm-realdb.perf-spec.ts` 최상위 `describe` 안 파일 끝에서
      `registerCheckinBaselineWiringSuite` 를 **1 회** 호출한다 — `envMeta` 는 기존 `env`
      (`realdb-person-mc`), `tempDir` 은 기존 `dirOf` 기반 임시 경로, `measure` 는
      `measureBaselineCandidate(read(), env, { iterations: WIRING_ITER, now: stepClock(stepMs) })`
      조립. 국면 판정 · baseline 경로 · 로그 · 토글 원복 로직의 **지역 재구현 0** (helper 위임만).
- [ ] happy path — factory 가 등록한 happy 국면 3 개가 실 DB 부트스트랩 하에서 통과. 즉 토글 off
      무동작 · 토글 on 확정 write · 재실행 비교 국면이 `realdb-person-mc` env 로 그대로 성립.
- [ ] error path — factory 의 error 국면 2 개(손상 baseline 파일 · 접근 불가/무효 경로 계열)가
      본 소비자에서도 동일하게 통과. 추가로 `measure` 주입 함수가 실패를 삼키지 않는지
      (예외가 국면으로 전파) 를 기존 국면 대조로 확인.
- [ ] 분기 cover — factory 의 분기 국면 2 개(established ↔ compared 분기, `repoRoot` 지정 ↔
      기본 바인딩 분기)가 모두 실행돼 각 분기 1+ test 로 남는다. 본 task 가 spec 에 새 분기를
      **추가하지는 않는다**(호출 1 회이므로) — 분기 cover 는 factory 국면 등록으로 충족.
- [ ] negative 충분 cover — factory 의 negative 국면 3 개(토글 값 비정상 · 임시 경로 부재 ·
      무효 인자 형태) 가 전부 등록·통과하고, **기존 국면 11 개의 제목 · 단언 · 순서가 불변** 이며
      수집 test 수가 정확히 `11 → 21`(배선 10 국면 추가) 로 늘어난다. 배선 국면이
      `truncateAll` · `prisma.person` seed 대조 단언에 간섭하지 않음을 확인(배선 국면은
      Cookie 미부착 · seed 무의존).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(기존 unit suite 무회귀) + `pnpm test:cov` 통과(line ≥ 80% / function
      ≥ 80%).
- [ ] perf 대상 실행으로 본 spec 이 21 test 전량 pass — 로컬 Postgres 부재 시 그 사실을 PR 본문에
      명시하고 CI 의 실 DB perf step 결과로 대체 확인(선례: T-1576~T-1579).
- [ ] 저장소 실경로 오염 0 — 본 spec 실행 후 체크인 baseline 실 디렉토리에 파일 증감이 없음
      (`tempDir` 이 매 test 격리 `tmpRoot` 아래만 쓰는지 확인).

## Out of Scope

- ADR-0056 `§Follow-ups (a)` — 체크인 기준 baseline JSON 최초 생성 · commit (실측 + 사람 눈 확인
  전제, 별도 task).
- ADR-0056 `§Follow-ups (b)` 의 **본체 `.github/workflows/ci.yml` perf step 토글 on 편입** —
  별도 task.
- `*-read` / `*-scale` 계열 perf-spec 으로의 배선 확산 (measure→confirm 계열 마감이 본 slice 의
  경계).
- `stepClock` 관용구의 공유 helper 승격 (T-1579 reviewer MINOR 이월분 — 별도 task).
- 기존 국면 11 개의 문구 · 단언 · 반복수 변경, `ITER` 값 조정, wall-clock 대소 단언 추가
  (T-0877/T-0880 flaky 재발 차단 원칙 유지).
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, perf jest config 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
