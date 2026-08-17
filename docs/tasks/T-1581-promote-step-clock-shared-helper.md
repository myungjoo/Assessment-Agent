---
id: T-1581
title: perf stepClock 관용구를 공유 helper 로 승격하고 realdb measure→confirm spec 2 개 이관
phase: P5
status: DONE
completedAt: 2026-08-17T09:50:26Z
prNumber: 1262
mergeCommit: 14d6b995856f9727a01b39639b6555e38072f73c
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-08-17
createdAt: 2026-08-17T08:42:36Z
independentStream: perf-baseline-checkin
dependsOn: [T-1580]
touchesFiles:
  - test/perf/step-clock.ts
  - test/perf/step-clock.spec.ts
  - test/perf/app-root-measure-confirm-realdb.perf-spec.ts
  - test/perf/person-measure-confirm-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — reviewer 가 T-1579·T-1580 2 회 연속 MINOR 로 이월한 stepClock 관용구 중복(5 벌 byte-identical) 을 공유 helper 1 개 + colocated spec 으로 승격하고 소비자 2 개 이관"
---

# T-1581 — perf stepClock 관용구를 공유 helper 로 승격하고 realdb measure→confirm spec 2 개 이관

## Why

ADR-0056 `§Follow-ups (b)` 배선 확산(T-1565 · T-1576 ~ T-1580)이 measure→confirm 계열 9 spec
으로 마감되면서, 각 spec 이 복제한 결정론적 clock 관용구 `stepClock` 이 **`*-realdb` 계열
5 벌에서 본문 byte-identical** 로 갈라졌다(mock 계열 4 + `latency-collector.spec.ts` 원본까지
합치면 10 벌). reviewer 는 T-1579 · T-1580 **2 회 연속** 으로 이 중복을 MINOR 로 지적했고 두 번
모두 "별도 task" 로 이월돼 있다. 본 slice 는 그 이월분의 집행이다 — 관용구를 공유 helper
1 개로 승격하고, 지적이 실제로 나온 소비자 2 개(`app-root-...-realdb` · `person-...-realdb`)를
먼저 이관해 seam 이 동작함을 증명한다(PLAN `140 행` 성능 검증 / REQ-048 조회 p95 < 3s 계열).

승격 대상은 **표본 결정론화 clock 하나**뿐이라 신규 판정 로직이 0 이다 — 측정 · 판정 · 경로 ·
로그는 종전대로 전량 기존 모듈 위임이고, 본 task 는 spec 안에 흩어진 순수 함수를 한 곳으로
모아 colocated spec 으로 계약을 박제한다(기존 국면 제목 · 단언 · 순서 불변).

## Required Reading

- `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` — 이관 대상 ①. `stepClock` 정의
  `61~73 행`(주석 `56~60 행`), 유일 호출부는 파일 끝 factory 호출 안 `293 행`
  (`now: stepClock(stepMs)`).
- `test/perf/person-measure-confirm-realdb.perf-spec.ts` — 이관 대상 ②. `stepClock` 정의
  `62~74 행`, 유일 호출부 `301 행`. 두 파일의 함수 **본문은 byte-identical** 이며 주석 한 줄
  (`실 HTTP 왕복` vs `실 DB 왕복`)만 다르다.
- `test/perf/latency-collector.ts` — `measureBaselineCandidate` 의 `now` 주입 계약(홀수 호출 =
  구간 시작, 짝수 호출 = 구간 끝). helper 의 semantic 이 이 계약과 어긋나면 표본이 깨진다.
- `test/perf/latency-collector.spec.ts` — 관용구 원본(T-0881 결정론화). **본 task 의 이관
  대상이 아니다**(후속 slice) — semantic 대조용으로만 읽는다.
- `test/perf/checkin-baseline-spec-suite.ts` 의 `CheckinBaselineWiringSuiteOptions.measure` —
  helper 가 실제로 소비되는 지점(주입 clock 으로 국면 표본을 결정론화).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 3 (b)` · `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] `test/perf/step-clock.ts` 를 신설하고 **함수 1 개**(`createStepClock(stepMs: number):
      () => number`)만 export 한다. semantic 은 기존 5 벌과 동일 — 홀수번째 호출은 현재 값을
      그대로, 짝수번째 호출은 `stepMs` 만큼 전진한 값을 낸다. 인스턴스마다 상태가 독립이며
      전역 상태 · `Date.now` 접근 · fs 접근이 0(순수).
- [ ] happy path — colocated spec `test/perf/step-clock.spec.ts` 에서 `createStepClock(5)` 의
      연속 호출이 `[0, 5, 5, 10, 10, 15]` 시퀀스를 내는지 1+ test, 서로 다른 두 인스턴스가
      상태를 공유하지 않는지 1+ test.
- [ ] error path — 인자 형태 위반이 예외로 드러나는지 각 1+ test: non-number(`string` ·
      `undefined` · `null` · `boolean`) → `TypeError`, `NaN` · `Infinity` 등 비유한 값 →
      `RangeError`, 음수 `stepMs`(monotonic 위배) → `RangeError`. 예외 국면에서 clock 이
      생성되지 않음(부작용 0)도 함께 확인.
- [ ] 분기 cover — 홀수 호출 분기(값 유지)와 짝수 호출 분기(전진) 각 1+ test, 경계값
      `stepMs = 0` 분기(모든 표본이 같은 값 · 비감소 유지) 1+ test.
- [ ] negative cases 충분 cover — 예외 상황마다 1+ test: 반환 clock 에 인자를 넘겨도 무시하고
      같은 시퀀스를 유지, 다회(예: 20 회) 연속 호출에서 값이 **비감소** 로 유지, 큰 `stepMs`
      누적이 부동소수 오차 없이 정확, `object` · 배열 입력 거부.
- [ ] 이관 — 위 2 개 perf-spec 에서 지역 `function stepClock` 정의(및 전용 주석)를 **삭제**
      하고 `createStepClock` import 로 대체한다. 호출부는 `now: createStepClock(stepMs)` 1 줄
      이며, **국면 제목 · 단언 · 순서 · 수집 test 수(각 21)가 불변** 이다. 두 파일에 남은
      `stepClock` 지역 정의가 0 임을 확인(`grep -n "function stepClock"` 결과 없음).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(신설 `step-clock.spec.ts` 포함 · 기존 unit suite 무회귀) +
      `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] perf 대상 실행으로 이관한 2 spec 이 각각 21 test 전량 pass — 로컬 Postgres 부재 시 그
      사실을 PR 본문에 명시하고 CI 의 실 DB perf step 결과로 대체 확인(선례: T-1576~T-1580).

## Out of Scope

- 잔여 소비자 이관 — `assessment-...-realdb` · `contribution-...-realdb` · `summary-...-realdb`
  3 개와 mock 계열 4 개, `latency-collector.spec.ts` 원본은 **후속 slice**(파일 수 cap 준수).
- `test/perf/README.md` · `docs/PLAN.md` 의 perf primitive 파일 목록 doc-sync — 코드와 같은
  commit 에 섞지 않는다(CLAUDE.md `§3.1` rule 3, 별도 direct task).
- ADR-0056 `§Follow-ups (a)` 체크인 baseline JSON 최초 생성 · commit.
- ADR-0056 `§Follow-ups (b)` 의 `.github/workflows/ci.yml` 토글 편입.
- 국면 반복수(`ITER` · `WIRING_ITER`) 조정, wall-clock 대소 단언 추가(T-0877/T-0880 flaky 재발
  차단 원칙 유지), 기존 국면 문구 변경.
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, perf jest config 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 잔여 `stepClock` 관용구 소비자 **8 벌** 이관 — 본 PR 이 seam(`createStepClock`) 을 증명했으므로
  후속 slice 가 cap(5 파일) 단위로 나눠 이관한다. reviewer round 1 은 이를 Out of Scope 로
  인정해 지적 대상에서 제외했다 (MINOR 0).
- ADR-0056 `§Follow-ups (a)` 체크인 baseline JSON 최초 생성 · commit.
- ADR-0056 `§Follow-ups (b)` 의 `.github/workflows/ci.yml` perf step 토글 편입.

## Result (2026-08-17)

- `pr` mode 완주 — PR **#1262** round 1 **APPROVE**(BLOCKER 0 · MAJOR 0 · MINOR 0) → 4-게이트 PASS
  → squash merge `14d6b995`, feature branch 삭제.
- `test/perf/step-clock.ts`(`createStepClock` 단일 export, 순수 함수 · 전역 상태 0) + colocated
  `step-clock.spec.ts` 신설, 소비자 2 개(`app-root-...-realdb` · `person-...-realdb`) 를
  `now: createStepClock(stepMs)` 1 줄 치환으로 이관. 4 파일 · +215/-40, 잔여 지역 정의 0.
- 신설 spec 24 test(happy 3 / error 13 / 분기 3 / negative 4 / collector 계약 1) 전량 pass.
  국면 제목 · 단언 · 순서 불변, 신규 판정 로직 0.
- lint · build · unit 437 suite / 12506 test · `test:cov`(line 99.95% · function 100%) 전부 green.
  실 DB perf 는 로컬 Postgres 부재로 CI 실 DB step 에서 확인(perf 658 test pass).
