---
id: T-1582
title: 잔여 realdb measure→confirm perf-spec 3 개를 공유 stepClock helper 로 이관
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 80
estimatedFiles: 3
created: 2026-08-17
createdAt: 2026-08-17T10:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1581]
touchesFiles:
  - test/perf/assessment-measure-confirm-realdb.perf-spec.ts
  - test/perf/contribution-measure-confirm-realdb.perf-spec.ts
  - test/perf/summary-measure-confirm-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — T-1581 이 증명한 createStepClock seam 으로 잔여 realdb 소비자 3 개를 이관해 *-realdb 계열 관용구 복제를 0 으로 마감"
---

# T-1582 — 잔여 realdb measure→confirm perf-spec 3 개를 공유 stepClock helper 로 이관

## Why

T-1581 이 `test/perf/step-clock.ts` 의 `createStepClock` 공유 helper 를 승격하고 소비자
2 개(`app-root-...-realdb` · `person-...-realdb`)를 이관해 seam 이 동작함을 증명했다. 그러나
`*-realdb` 계열의 나머지 3 개(`assessment` · `contribution` · `summary`)에는 아직 본문
byte-identical 인 지역 `stepClock` 정의가 남아있다 — T-1581 이 파일 수 cap 준수를 위해 명시적
Out of Scope 로 미뤄둔 잔여분이다. 본 slice 는 그 3 개를 이관해 **`*-realdb` 계열의 관용구
복제를 0** 으로 마감한다 (PLAN `140 행` 성능 검증 / REQ-048 조회 p95 < 3s 계열).

이관은 기계적이다 — 지역 정의 삭제 + `import { createStepClock } from "./step-clock";` 추가 +
호출부 `now: stepClock(stepMs)` → `now: createStepClock(stepMs)` 1 줄 치환. **신규 판정 로직
0**, 기존 국면 제목 · 단언 · 순서 · 반복수 전부 불변이다.

## Required Reading

- `test/perf/step-clock.ts` — `createStepClock` 계약 (홀수 호출 = 구간 시작, 짝수 호출 = `stepMs` 전진).
- `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` — T-1581 이 이관한 **정본 패턴** (import 위치 · 주석 문구 · 호출부).
- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` — 이관 대상 1 (지역 정의 `64 행` 부근, 호출부 `310 행` 부근).
- `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` — 이관 대상 2 (지역 정의 `55 행` 부근, 호출부 `315 행` 부근).
- `test/perf/summary-measure-confirm-realdb.perf-spec.ts` — 이관 대상 3 (지역 정의 `63 행` 부근, 호출부 `306 행` 부근).
- `docs/tasks/T-1581-promote-step-clock-shared-helper.md` — 승격 slice 의 Out of Scope · Follow-ups (본 task 의 근거).

## Acceptance Criteria

- [ ] 대상 3 파일에서 지역 `function stepClock` 정의와 그 JSDoc 주석 블록이 삭제되고,
      `import { createStepClock } from "./step-clock";` 이 추가된다. 호출부는
      `now: createStepClock(stepMs)` 로 치환된다.
      검증: `git grep -n "function stepClock" -- "test/perf/*-realdb.perf-spec.ts"` 결과 **0 건**.
- [ ] `createStepClock` 의 happy-path 계약 (`[0, 5, 5, 10, 10, 15]` 진행) 은 기존 colocated
      `test/perf/step-clock.spec.ts` 가 이미 cover 한다 — **신규 public symbol 이 0 개** 이므로
      본 task 는 helper spec 을 수정하지 않는다. 대신 이관 후 `pnpm test test/perf/step-clock.spec.ts`
      가 그대로 pass 함을 확인한다 (happy-path 회귀 확인).
- [ ] error path — helper 의 `TypeError`(non-number) · `RangeError`(NaN/Infinity/음수) 분기 역시
      `step-clock.spec.ts` 가 이미 cover 하며 본 task 가 새 error path 를 만들지 않음을 확인한다
      (이관 대상 spec 은 `stepMs` 로 양의 유한 상수만 넘긴다 — 실제 인자값 점검).
- [ ] flow / 분기 cover — 본 task 의 변경은 **분기가 없는 import + 호출부 1 줄 치환** 이다.
      새 분기가 0 임을 diff 로 확인하고, 이 항목은 "분기 없음 — 항목 생략" 으로 명시한다.
- [ ] negative cases — 이관으로 인해 기존 국면이 **약화되지 않았음** 을 검증한다: 3 개 spec 의
      국면 수 · describe/it 제목 · 단언 개수 · 실행 순서가 이관 전과 동일해야 한다
      (`git diff --stat` 에서 삭제분이 지역 정의 블록에 한정되는지 확인).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` 전부 pass.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% threshold).
- [ ] `pnpm test:perf` 로 perf suite 실행 — 로컬 Postgres 부재로 실 DB 국면이 skip 되면 그 사실을
      PR 본문에 명시하고 **CI 의 실 DB perf step** conclusion 으로 대체 확인한다.

## Out of Scope

- mock 계열 4 개(`app-root` · `assessment` · `contribution` · `summary` 의 non-realdb spec) 와
  `test/perf/latency-collector.spec.ts` 원본의 이관 — **후속 slice** (파일 수 cap 준수).
- `test/perf/step-clock.ts` · `test/perf/step-clock.spec.ts` 본문 수정 (helper 계약 불변).
- `test/perf/README.md` · `docs/PLAN.md` 의 perf primitive 파일 목록 doc-sync — 코드와 같은
  commit 에 섞지 않는다 (CLAUDE.md `§3.1` rule 3, 별도 `direct` task).
- ADR-0056 `§Follow-ups (a)` 체크인 baseline JSON 최초 생성 · commit.
- ADR-0056 `§Follow-ups (b)` 의 `.github/workflows/ci.yml` perf step 토글 편입.
- 국면 반복수(`ITER` · `WIRING_ITER`) 조정, wall-clock 대소 단언 추가(T-0877/T-0880 flaky 재발
  차단 원칙 유지), 기존 국면 문구 변경.
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, perf jest config 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
