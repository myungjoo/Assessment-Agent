---
id: T-1587
title: person 실 DB 조회 perf-spec 에 체크인 baseline 배선 factory 얹기 (*-read-realdb 계열 첫 소비자)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 80
estimatedFiles: 1
created: 2026-08-17
createdAt: 2026-08-17T22:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1586]
touchesFiles:
  - test/perf/person-read-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 확산: 실 DB × 관찰형(measure→confirm 없음) 조합의 첫 소비자에 factory 호출 1 회(신규 로직 0)"
---

# T-1587 — person 실 DB 조회 perf-spec 에 체크인 baseline 배선 factory 얹기 (`*-read-realdb` 계열 첫 소비자)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 확산의 다음 slice.
T-1576 ~ T-1580 이 measure→confirm 계열 9 개(mock 4 + 실 DB 5)를, T-1586 이 `*-read` 계열
첫 소비자(mock `person-read`)를 배선했다. 남은 미배선 표면 중 아직 한 번도 관측하지 않은 조합은
**실 DB round-trip × measure→confirm top loop 부재**(순수 관찰형) 다 — `person-read-realdb` 가
그 첫 표본이며, `afterEach(truncateAll)` 로 매 test 도메인 테이블이 비는 환경에서도 factory 의
배선 국면 10 개가 기존 국면에 간섭 없이 성립하는지를 처음 확인한다.
REQ-048 의 "조회 p95 < 3s" 가 실제로 매달린 실 query 경로이므로, `§Follow-ups (a)` 의 체크인
baseline 이 앉을 자리를 실 DB 축에서도 미리 여는 의미가 있다.

## Required Reading

- `test/perf/person-read-realdb.perf-spec.ts` — 본 task 가 유일하게 수정하는 파일(276 행, 기존
  `it` 8 개). `seedPersons(count, active)`(89~102 행) · `listRequest`(`RequestFn` **값**, 108 행) ·
  `detailRequest(id)` · `beforeAll` 의 `createE2EApp()` + `truncateAll` · `afterEach(truncateAll)` ·
  `afterAll` 의 `app.close()` + `prisma.$disconnect()` 를 확인할 것. `fs` · `os` · `path` import 는
  **현재 없다**.
- `test/perf/person-measure-confirm-realdb.perf-spec.ts` — **실 DB 계열 배선 관용구의 직전 선례**.
  `tmpRoot` 선언(65 행) · `fs.mkdtempSync(path.join(os.tmpdir(), ...))`(77 행) · `afterEach` 재귀
  삭제(80 행) · `dirOf(seg)` POSIX 결합 헬퍼(88~90 행) · 파일 끝 factory 호출부(마지막 20 행).
  구조는 동형으로 따르되 주석 문구 복제는 최소화한다.
- `test/perf/person-read.perf-spec.ts` 파일 끝 factory 호출부 — T-1586 이 확정한 **관찰형 spec**
  배선 형태(measure 람다가 자기 안에서 응답 조건을 갖춘다).
- `test/perf/checkin-baseline-spec-suite.ts` — factory 계약
  (`CheckinBaselineWiringSuiteOptions` 의 `envMeta` · `measure(stepMs)` · `tempDir(name)` ·
  `title`, 국면 10 개 = happy 3 · error 2 · 분기 2 · negative 3, 등록 시점 인자 형태 검사,
  전역 토글 저장 · 원복 소관, 등록 ≠ 실행).
- `test/perf/latency-collector.ts` 의 `measureBaselineCandidate` 시그니처 — 주입 `now` 로 표본
  결정론화.
- `test/perf/step-clock.ts` — `createStepClock(stepMs)` (T-1581 승격 공유 helper).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 2` · `§Decision 3 (b)` ·
  `§Follow-ups (a)/(b)`.

## Acceptance Criteria

- [ ] `test/perf/person-read-realdb.perf-spec.ts` 최상위 `describe` 안 파일 끝에서
      `registerCheckinBaselineWiringSuite` 를 **1 회** 호출한다 — `envMeta` 는 본 spec 고유
      label(예: `ci-realdb-person-read` 계열과 충돌하지 않는 배선 전용 label, `concurrency: 1`),
      `tempDir` 은 `fs.mkdtempSync` 로 만든 저장소 **밖** 임시 root 하위 경로(`dirOf` 동형 헬퍼),
      `measure` 는 `measureBaselineCandidate(listRequest, env, { iterations: <소규모 고정>, now: createStepClock(stepMs) })`
      조립. 판정 · baseline 경로 조립 · 로그 형식 · 토글 저장/원복의 **지역 재구현 0**(전량
      helper 위임).
- [ ] happy path — factory 의 happy 국면 3 개(토글 off 무동작 · 토글 on 확정 write · 재실행 비교)
      가 본 소비자에서 전부 통과. `GET /api/persons` 는 guard 미부착이라 cookie 없이 200 이고,
      `afterEach(truncateAll)` 로 seed 가 비어도 **빈 배열 200 · errorRate 0** 이므로 배선 국면이
      seed 에 의존하지 않음을 확인한다.
- [ ] error path — factory 의 error 국면 2 개(손상 baseline 파일 · 무효/접근 불가 경로 계열)가
      동일하게 통과하고, 주입한 `measure` 가 실 DB 왕복 중 발생하는 예외를 삼키지 않고 국면으로
      전파함을 확인.
- [ ] 분기 cover — factory 의 분기 국면 2 개(established ↔ compared, `repoRoot` 지정 ↔ 어댑터
      기본 바인딩)가 모두 실행된다. 본 task 는 spec 에 새 분기를 **추가하지 않으므로**(호출 1 회)
      분기 cover 는 factory 국면 등록으로 충족한다.
- [ ] negative 충분 cover — factory 의 negative 국면 3 개(토글 값 비정상 · 임시 경로 부재 · 무효
      인자 형태)가 전부 등록·통과하고, **기존 `it` 8 개의 제목 · 단언 · 순서가 불변** 이며 본 파일의
      수집 test 수가 정확히 `8 → 18` 로 늘어난다. 배선 국면이 기존 `lastListBody` 대조 단언과
      `truncateAll` 순서에 간섭하지 않음을 확인한다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(기존 unit suite 무회귀) + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] perf 대상 실행으로 본 spec 18 test 전량 pass — 로컬 Postgres 부재 시 CI 의 실 DB perf step
      결과로 확인하고, 실행 명령과 결과를 PR 본문에 명시한다.
- [ ] 저장소 실경로 오염 0 — 본 spec 실행 후 `test/perf/baselines/` 에 파일이 생기지 않는다
      (임시 root 가 매 test 격리되고 `afterEach` 또는 `afterAll` 재귀 정리가 걸려 있는지 확인).

## Out of Scope

- ADR-0056 `§Follow-ups (a)` — 체크인 기준 baseline JSON 최초 생성 · commit(실측 + 사람 눈 확인
  전제, 별도 task).
- ADR-0056 `§Follow-ups (c)` — 부하계획 `§ 3` 임계 fix 갱신(doc-sync, 별도 task).
- 다른 `*-read` / `*-read-realdb` / `*-scale` / `*-detail-read` perf-spec 으로의 확산 — 본 slice 는
  **1 개 spec** 만.
- 기존 국면 8 개의 문구 · 단언 · 반복수 변경, `SEED_ROWS` · `ITERATIONS` 조정,
  `assertS2Threshold` 임계 조정, wall-clock 대소 단언 추가(T-0877 / T-0880 flaky 재발 차단 원칙).
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, `test/perf/jest-perf.json` · `.github/workflows/ci.yml`
  변경, `deploy/daily-test.sh` 계열 접촉(drift-guard smoke 동반 수정으로 파일 cap 이 깨진 T-1122 전례).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
