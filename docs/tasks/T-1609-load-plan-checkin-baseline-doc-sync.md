---
id: T-1609
title: 부하계획 §5 item 5 의 "체크인 baseline 미착수" 상태 서술 2 곳 현행화
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-08-19
createdAt: 2026-08-19T01:40:25Z
completedAt: 2026-08-19T02:42:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1607, T-1608]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
plannerNote: "P5 성능 검증 — T-1608 이 PLAN·REQ-048 에 박은 5 route 확정 사실을 부하계획 §5 item 5 상태 서술에도 doc-sync, 완료 표기 금지"
---

# T-1609 — 부하계획 §5 item 5 의 "체크인 baseline 미착수" 상태 서술 2 곳 현행화

## Why

직전 T-1608 은 [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (d)` 에
따라 "체크인 baseline JSON 이 `measure→confirm` 5 route 전부로 확정됐고 CI 경로가 `compared` 로
돈다" 는 사실을 `docs/PLAN.md` `142 행` 과 `docs/requirements.md` `67 행` 두 곳에만 반영했다.
그런데 같은 사실을 정면으로 부정하는 **현재형 상태 서술**이
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 에 두 곳 남아 있다:

- `662~664 행` — `§5` item 5 의 자체 상태 문단. "`writeBaselineFile` /
  `confirmOrCompareBaseline` 는 … 다섯 다 **임시 디렉토리 1 회성**" → "저장소 체크인 기준
  baseline 파일 확정은 **여전히 성립하지 않으며**" 라고 단언한다.
- `861~863 행` — 인벤토리 절 결어. 위 문단을 "위 item 5 의 **미완** 서술(baseline 파일 확정 ·
  임계 fix 미착수 · `writeBaselineFile` 은 slice 25 · 26 · 27 · 28 · 29 의 임시 디렉토리 1 회성
  호출뿐)" 로 **재인용**해 같은 사실 주장을 반복한다.

실제로는 `test/perf/baselines/` 에 체크인 baseline JSON 5 개가 존재하고
(`baseline-ci-realdb-person-read.json` · `-assessment-read` · `-contribution-read` ·
`-summary-read` · `-app-root-read`), `.github/workflows/ci.yml` 의 `perf test` step 은
`PERF_CHECKIN_BASELINE: "1"` 토글로 매 run 마다 비교 경로를 탄다. 본 slice 는 그 두 서술만
**인라인 현행화**해 문서 내부 모순을 없앤다. 다만 `§Follow-ups (c)` 임계 fix 는 미완이므로
**item 5 자체는 여전히 "미완"** 이며 어떤 완료 표기도 하지 않는다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `655~670 행`
  (item 5 상태 문단) 과 `856~865 행` (인벤토리 절 결어) — **이 두 구간만** 읽으면 된다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `74~90 행`
  (`§3` 지표·임계 표 — "baseline 후 fix" 3 행이 불변임을 확인하는 용도).
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md)
  `§Decision 3` · `§Decision 4` · `§Follow-ups` — 상대 회귀는 관찰만(exit code 불변) · CI 는 기존
  step 재사용 · 잔여는 (c) 임계 fix.
- [docs/tasks/T-1608-checkin-baseline-five-route-doc-sync.md](T-1608-checkin-baseline-five-route-doc-sync.md)
  — 직전 slice 가 PLAN · requirements 에 쓴 문장(표현을 그대로 승계할 것).

## Acceptance Criteria

- [ ] `662~664 행` 의 item 5 상태 문단을 **현행화**한다. 반드시 포함할 사실 4 개:
      (a) `test/perf/baselines/` 아래 체크인 baseline JSON 이 `measure→confirm` **5 route 전부**
      (`ci-realdb-person-read` · `-assessment-read` · `-contribution-read` · `-summary-read` ·
      `-app-root-read`) 로 확정됐다는 점, (b) 확정 task 좌표(T-1592/T-1594 · T-1601 · T-1603 ·
      T-1605 · T-1607), (c) `.github/workflows/ci.yml` `perf test` step 의
      `PERF_CHECKIN_BASELINE: "1"` 토글(T-1584) 로 CI 경로가 `absent`(skip) 이 아니라 `compared`
      로 돈다는 점, (d) 그럼에도 상대 회귀는 **관찰만** 이고 exit code 는 불변이라
      (ADR-0056 `§Decision 3 (b)`) **item 5 는 여전히 미완** 이고 잔여는 `§3` 임계 fix
      (`§Follow-ups (c)`) 와 측정 endpoint 확대 축이라는 점.
      검증: `grep -c "여전히 성립하지 않으며" docs/ops/load-resilience-test-plan.md` 가 **0** 이고,
      `grep -c "baseline-ci-realdb-app-root-read\|PERF_CHECKIN_BASELINE" docs/ops/load-resilience-test-plan.md`
      가 **1 이상**.
- [ ] `861~863 행` 의 인벤토리 절 결어에서 item 5 를 재인용한 괄호 안 서술
      (`baseline 파일 확정 · 임계 fix 미착수 · writeBaselineFile 은 slice 25 · … 임시 디렉토리
      1 회성 호출뿐`) 을 위 (a)~(d) 와 **모순 없게** 고친다 — 남는 미완은 **임계 fix** 이고,
      "baseline 파일 확정 미착수" · "임시 디렉토리 1 회성 호출뿐" 주장은 삭제한다. 같은 문장의
      나머지 잔여 축(규모 민감도 · 실 scale 부하 · 시각화(web) 렌더 측정)은 **그대로 존치**한다.
      검증: `git diff docs/ops/load-resilience-test-plan.md | grep -c "시각화(web) 렌더 측정"` 이
      0 이거나(해당 행 미변경) 변경 시에도 해당 어구가 `+` 쪽에 그대로 남는다.
- [ ] **완료 표기 금지** — `§3` 지표·임계 표(`82 · 84 · 86 행`) 의 "baseline 후 fix" 3 행은
      **한 글자도 바꾸지 않는다**. item 5 의 "미완" 판정 자체도 유지한다.
      검증: `git diff docs/ops/load-resilience-test-plan.md | grep -c "^[+-]| S[123] "` 이 **0**.
- [ ] 인용한 사실이 실재와 일치한다. 검증 3 종: `ls test/perf/baselines | wc -l` 이 **5**,
      `grep -c 'PERF_CHECKIN_BASELINE' .github/workflows/ci.yml` 이 **1 이상**,
      본문에 적은 label 5 개가 `ls test/perf/baselines` 결과와 1:1 대응.
- [ ] 과거 slice 시점 서술(`526 · 547 · 567 · 593 · 618 · 840 행` 의 "slice 25 는 … 잔여 소진이
      아니다" 류)은 **작성 시점 사실**이므로 손대지 않는다.
      검증: `git diff --stat` 의 변경 행 수가 **≤ 12 행** 이고, 변경 hunk 가 위 두 구간(`~662` ·
      `~861`) 에만 위치한다.
- [ ] 행 좌표 표기가 CLAUDE.md `§12` 규약을 따른다 — 구분자는 물결 `~` 하나, 단일 행은 `662 행`
      형태, `L` prefix 금지.
- [ ] 변경 파일이 정확히 1 개다.
      검증: `git diff --name-only` 결과가 `docs/ops/load-resilience-test-plan.md` 한 줄.
- [ ] 코드 변경 0 — `git diff --name-only` 에 `src/` · `test/` · `.github/` 경로가 없다.
      **R-112 4 항목(happy-path / error path / 분기 / negative cases 충분 cover) 은 코드 변경이
      0 이라 적용 대상 자체가 없다** — 새 public symbol · 분기 · 예외 경로가 생기지 않으므로 본
      task 는 spec 을 추가하지 않는다. 같은 이유로 CLAUDE.md `§3.2` R-110 의 tester 의무도
      direct doc-only commit 면제 대상이다 (T-1585 · T-1608 선례와 동형).

## Out of Scope

- `§3` 지표·임계 표의 "baseline 후 fix" → 확정 임계 승격 (ADR-0056 `§Follow-ups (c)` ·
  `§Decision 5` 의 20 run 표본 요건 미충족 — 별도 task).
- 과거 slice 시점 서술(`526 · 547 · 567 · 593 · 618 · 840 행`) 의 일괄 sweep — 당시 사실이라
  현행화 대상이 아니다. 필요하면 Follow-ups 로.
- 새 slice 서술 추가(slice 30 이후) · perf-spec 계수 갱신 · 인벤토리 (A)/(B)/(C) 재분류.
- `test/perf/README.md` · `docs/PLAN.md` · `docs/requirements.md` 재편집 (T-1597 · T-1598 ·
  T-1608 이 이미 처리).
- 코드 · spec · workflow 변경 일체.

## Suggested Sub-agents

`implementer` (doc 인라인 수정 전용 — architect · tester 불요).

## Follow-ups

(작성 시 비어 있음)

## Result (2026-08-19)

`docs/ops/load-resilience-test-plan.md` 1 파일 `+6/-5`(변경 11 행) direct commit `40f2427d` — main push 완료.
`§5` item 5 상태 문단(`659~665 행` 구간)에서 "저장소 체크인 기준 baseline 확정은 여전히 성립하지 않으며"
단언을 걷어내고 ① `test/perf/baselines/` 5 route 체크인 사실 ② 확정 slice 좌표(T-1592/T-1594 · T-1601 ·
T-1603 · T-1605 · T-1607) ③ `ci.yml` `PERF_CHECKIN_BASELINE: "1"` 토글(T-1584) 로 CI 가 `compared` 로
도는 사실 ④ 그럼에도 ADR-0056 `§Decision 3 (b)` 대로 관찰-only·exit code 불변이라 item 5 는 **미완 유지**
라는 근거를 인라인 서술. 인벤토리 결어(`862~863 행`)의 "임시 디렉토리 1 회성 호출뿐" 재인용도 같은 사실로
교체하되 규모 민감도 · 실 scale 부하 · 시각화(web) 렌더 측정 잔여 축은 그대로 존치. `§3` 지표표의
"baseline 후 fix" 3 행과 item 5 의 미완 판정은 한 글자도 불변(완료 표기 금지 AC 충족).
인용 사실은 driver 가 별도 확인 — `test/perf/baselines/` 5 파일 실재, `ci.yml:256` 토글 1 곳 실재.
코드 변경 0 이라 R-110 tester 의무 면제(T-1585 · T-1608 선례). CI: main run 32209454898 `in_progress`
→ conclusion 은 다음 fire 가 확인(R-114 위임 1).
