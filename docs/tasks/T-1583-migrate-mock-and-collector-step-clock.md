---
id: T-1583
title: 잔여 stepClock 소비자 5 개(mock 4 + collector 원본)를 공유 helper 로 이관
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-08-17T15:47:49Z
mergedAs: 3b89c10e876d234c211c54c52fe2fef024b71ead
prNumber: 1264
reviewRounds: 1
coversReq: [REQ-048]
estimatedDiff: 95
estimatedFiles: 5
created: 2026-08-17
createdAt: 2026-08-17T12:10:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1582]
touchesFiles:
  - test/perf/app-root-measure-confirm.perf-spec.ts
  - test/perf/assessment-measure-confirm.perf-spec.ts
  - test/perf/contribution-measure-confirm.perf-spec.ts
  - test/perf/summary-measure-confirm.perf-spec.ts
  - test/perf/latency-collector.spec.ts
plannerNote: "P5 성능 검증 — T-1582 가 realdb 계열을 0 으로 마감한 뒤 남은 mock 4 + collector 원본을 이관해 stepClock 관용구 복제를 전면 0 으로 마감"
---

# T-1583 — 잔여 stepClock 소비자 5 개(mock 4 + collector 원본)를 공유 helper 로 이관

## Why

T-1581 이 `test/perf/step-clock.ts` 의 `createStepClock` 공유 helper 를 승격하고, T-1582 가
`*-realdb` 계열 소비자의 관용구 복제를 0 으로 마감했다. 그러나 두 slice 모두 파일 수 cap 준수를
위해 **mock 계열 4 개**(`app-root` · `assessment` · `contribution` · `summary` 의 non-realdb
perf-spec) 와 관용구의 **원본**(`test/perf/latency-collector.spec.ts`, T-0881 이 확정) 을 명시적
Out of Scope 로 미뤄뒀다. 본 slice 는 그 5 개를 이관해 저장소 전체의 `stepClock` 지역 정의를
**전면 0** 으로 마감한다 (PLAN `140 행` 성능 검증 / REQ-048 조회 p95 < 3s 계열, ADR-0056
`§Follow-ups (b)` 확산).

이관은 기계적이다 — 지역 `function stepClock` 정의와 그 주석 블록을 삭제하고
`import { createStepClock as stepClock } from "./step-clock";` 을 추가한다. **신규 판정 로직 0**,
국면 제목 · 단언 · 순서 · 반복수 전부 불변이다.

**alias import 를 쓰는 이유** — 5 파일의 `stepClock(...)` 호출부가 합계 약 100 개라 T-1582 처럼
호출부를 전량 `createStepClock(...)` 으로 치환하면 diff 가 300 LOC cap 을 위협하고 실질 변경
(정의 삭제) 이 noise 에 묻힌다. 따라서 호출부는 손대지 않고 이름만 helper 에 alias 로 붙인다.
그 근거는 각 파일의 import 줄 위 한국어 주석 1 줄로 박제한다.

## Required Reading

- `test/perf/step-clock.ts` — `createStepClock` 계약 (홀수 호출 = 구간 시작, 짝수 호출 = `stepMs` 전진, 검증은 clock 생성 전 완료).
- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` — T-1582 가 이관한 **정본 패턴** (import 위치 · 주석 문구).
- `test/perf/app-root-measure-confirm.perf-spec.ts` — 이관 대상 1 (지역 정의 `154 행` 부근).
- `test/perf/assessment-measure-confirm.perf-spec.ts` — 이관 대상 2 (지역 정의 `208 행` 부근).
- `test/perf/contribution-measure-confirm.perf-spec.ts` — 이관 대상 3 (지역 정의 `192 행` 부근).
- `test/perf/summary-measure-confirm.perf-spec.ts` — 이관 대상 4 (지역 정의 `212 행` 부근).
- `test/perf/latency-collector.spec.ts` — 이관 대상 5, 관용구 **원본** (지역 정의 `34 행` 부근).
- `docs/tasks/T-1582-migrate-remaining-realdb-step-clock.md` — 직전 slice 의 Out of Scope · Follow-ups (본 task 의 근거).

## Acceptance Criteria

- [ ] 대상 5 파일에서 지역 `function stepClock` 정의와 그 주석 블록이 삭제되고,
      `import { createStepClock as stepClock } from "./step-clock";` 이 추가된다. 호출부
      (`stepClock(10)` 등 약 100 곳) 는 **한 글자도 바뀌지 않는다**.
      검증: `git grep -n "function stepClock" -- test/perf` 결과 **0 건**.
- [ ] happy-path — `createStepClock` 의 진행 계약(`[0, 5, 5, 10, 10, 15]`) 은 기존 colocated
      `test/perf/step-clock.spec.ts` 가 이미 cover 한다. **신규 public symbol 이 0 개** 이므로 본
      task 는 helper 와 그 spec 을 수정하지 않고, 이관 후 `pnpm test test/perf/step-clock.spec.ts`
      가 그대로 pass 함을 확인한다 (happy-path 회귀 확인).
- [ ] error path — helper 의 `TypeError`(non-number) · `RangeError`(NaN · ±Infinity · 음수) 분기도
      `step-clock.spec.ts` 가 이미 cover 하며, 본 task 가 새 error path 를 만들지 않음을 확인한다.
      이관 대상 5 파일의 실제 인자값이 전부 **양의 유한 상수 또는 양수 `stepMs` 변수** 임을 점검해
      (`git grep -no "stepClock([^)]*)" -- test/perf`) 지역 정의에는 없던 helper 검증 분기가 기존
      국면을 throw 로 바꾸지 않음을 보인다.
- [ ] flow / 분기 cover — 본 task 의 변경은 **분기가 없는 정의 삭제 + import 추가** 다. 새 분기가
      0 임을 diff 로 확인하고 이 항목은 "분기 없음 — 항목 생략" 으로 명시한다.
- [ ] negative cases 충분 cover — 이관으로 기존 국면이 **약화되지 않았음** 을 검증한다:
      (a) 5 개 spec 의 describe/it 제목 · 국면 수 · 단언 개수 · 실행 순서가 이관 전과 동일,
      (b) `git diff` 의 삭제분이 지역 정의 블록과 그 주석에만 한정,
      (c) `latency-collector.spec.ts` 의 실패 요청 · 0 회 반복 같은 기존 negative 국면이 전부 그대로
      pass (collector 원본 이관이 회귀를 만들지 않음).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` 전부 pass (suite 수 · test 수가 이관 전 대비
      감소하지 않음을 실행 결과 수치로 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% threshold).
- [ ] `pnpm test:perf` 로 perf suite 실행 — 로컬 Postgres 부재로 실 DB 국면이 skip 되면 그 사실을
      PR 본문에 명시하고 **CI 의 실 DB perf step** conclusion 으로 대체 확인한다.

## Out of Scope

- `test/perf/step-clock.ts` · `test/perf/step-clock.spec.ts` 본문 수정 (helper 계약 불변).
- 호출부 식별자를 `createStepClock` 로 rename 하는 작업 — 본 slice 는 alias import 만. rename 이
  필요하면 별도 follow-up (diff cap 사유는 Why 참조).
- `test/perf/README.md` · `docs/PLAN.md` 의 perf primitive 파일 목록 doc-sync — 코드와 같은 commit
  에 섞지 않는다 (CLAUDE.md `§3.1` rule 3, 별도 `direct` task).
- ADR-0056 `§Follow-ups (a)` 체크인 baseline JSON 최초 생성 · commit.
- ADR-0056 `§Follow-ups (b)` 의 `.github/workflows/ci.yml` perf step 토글 편입.
- 국면 반복수(`ITER` · `WIRING_ITER`) 조정, wall-clock 대소 단언 추가(T-0877/T-0880 flaky 재발
  차단 원칙 유지), 기존 국면 문구 변경.
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, perf jest config 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
