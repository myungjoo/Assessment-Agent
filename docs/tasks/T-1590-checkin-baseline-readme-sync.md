---
id: T-1590
title: 체크인 baseline 게이트의 로그·토글 규약을 test/perf/README.md 에 doc-sync
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 90
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T01:30:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1589]
touchesFiles:
  - test/perf/README.md
plannerNote: "P5 성능 검증 — PLAN 142 행(REQ-048) 축, T-1589 Follow-ups 이월분: absent 2 줄 로그·토글 규약이 README 에 0 줄"
---

# T-1590 — 체크인 baseline 게이트의 로그 · 토글 규약을 `test/perf/README.md` 에 doc-sync

## Why

직전 [T-1589](T-1589-checkin-baseline-absent-candidate-log.md) 가 `formatCheckinCandidateLine`
포매터와 `absent` 국면 2 줄 로그를 머지하면서 **5 번째 파일이 되는 `test/perf/README.md`
doc-sync 를 명시적으로 이월**했다 (해당 task 의 `Follow-ups` 첫 항목). 실제로 현재 README 는
1167 행 중 체크인 baseline 게이트를 **한 줄도 기술하지 않는다** — `grep -n
"checkin-baseline\|formatCheckinCandidateLine\|PERF_CHECKIN_BASELINE" test/perf/README.md`
가 0 건이다. 그 결과 CI 로그에 무엇이 어떤 조건에서 찍히는지가 코드에만 있고 harness 계약
문서에는 없다.

이 공백은 [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)`
(baseline JSON 최초 생성 · 사람 눈 승인) 의 직접적인 걸림돌이다 — `§Decision 2` 가 CI 자동
commit 을 비채택했으므로 사람이 **CI 로그 한 줄을 읽고** 값을 승인해야 하는데, 그 로그의 키
집합 · 국면별 출력 형태 · 토글 값 규약이 문서화돼 있지 않으면 승인자가 코드를 읽어야 한다.
본 task 는 PLAN `142 행`(R-92 / REQ-048 조회 3 초 축) 의 harness 문서를 실제 코드 계약과
맞추는 **문서 전용 slice** 이며 코드 변경은 0 이다.

## Required Reading

- `test/perf/README.md` — 특히 `## 표본 수집기 (latency-collector.ts)` 절(56 행 부근)과
  `### disk io harness (latency-baseline-io.ts)` 절(42 행 부근). **기술 톤 · 항목 형식 ·
  "위임 · 순서 계약 · 예외 전파 · 관찰 전용" 서술 관례를 그대로 따른다.**
- `test/perf/checkin-baseline-report.ts` — `CHECKIN_LOG_PREFIX`(24 행),
  `formatCheckinOutcomeLine`(90 행), `formatCheckinOutcomeBlock`(124 행),
  `formatCheckinCandidateLine`(152 행) 의 정확한 출력 표기와 키 순서.
- `test/perf/checkin-baseline-run.ts` — `CheckinBaselineRunInput` · `CheckinBaselineRunOutcome`
  union · `runCheckinBaselineCheck` 의 3 국면(`skipped/disabled` 한 줄, `skipped/absent` 2 줄,
  `compared`) 과 "compare 형태 검증은 비교 진입 확정 후" 계약.
- `test/perf/checkin-baseline-plan.ts` — `CHECKIN_BASELINE_ENV_FLAG` 상수(23 행) 와 토글 on 으로
  인정하는 값 집합(`"1"` / `"true"` / `"yes"`, trim + 소문자화 기준, 모호하면 off).
- `.github/workflows/ci.yml` — `PERF_CHECKIN_BASELINE: "1"`(249 행) 이 걸린 step (읽기만; 수정 금지).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 2`(CI 자동 commit 비채택),
  `§Decision 3 (b)`(exit code 불변), `§Consequences (d)`(사람 눈 값 타당성 확인), `§Follow-ups`.
- `docs/tasks/T-1589-checkin-baseline-absent-candidate-log.md` — 이월된 `Follow-ups` 항목.
- `CLAUDE.md` `§3`(cap · Nit-in-PR closure) · `§3.2`(R-110 ~ R-114) · `§12`(언어 정책).

## Acceptance Criteria

- [ ] `test/perf/README.md` 에 체크인 baseline 게이트 절을 **1 개** 추가한다 (기존 절 사이에
      자연스럽게 배치 — `## 표본 수집기` 이후 · `## 실 endpoint 배선 perf-spec` 이전 권장).
      절 안에는 다음이 **전부** 들어간다:
  - [ ] **토글** — `CHECKIN_BASELINE_ENV_FLAG` = `PERF_CHECKIN_BASELINE`, on 으로 인정하는 값은
        trim + 소문자화 후 `"1"` / `"true"` / `"yes"` 뿐이고 미설정 · 빈값 · `"0"` / `"false"` ·
        non-string 은 전부 off (모호하면 off) 임을 명시. CI 는 `ci.yml` 에서 `"1"` 로 켜져 있음을 기술.
  - [ ] **3 국면** — `runCheckinBaselineCheck` 가 내는 `CheckinBaselineRunOutcome` union 을
        `skipped(disabled)` / `skipped(absent)` / `compared` 로 나눠 각 국면의 **로그 줄 수** 와
        **비교 함수 호출 횟수**(disabled · absent = 0 회, compared = 정확히 1 회) 를 명시.
  - [ ] **로그 표기** — `CHECKIN_LOG_PREFIX`(`[perf][checkin-baseline]`) 와 `absent` 국면 2 줄의
        정확한 형태(1 줄째 `outcome=skipped reason=absent path=...`, 2 줄째
        `candidate label= concurrency= p50= p95= p99= throughput= errorRate= count= pass=`) 를
        **키 순서 그대로** 기술. 키 이름이 영어 고정(grep 축) 임도 함께.
  - [ ] **전사 전용 계약** — `formatCheckinCandidateLine` 은 재계산 · 반올림 · 단위 변환 · 임계
        판정을 하지 않고 표본 0 국면의 `NaN` 도 거르지 않으며, 회귀는 `regressed` 로 노출만 하고
        **throw 하지 않는다**(exit code 불변, ADR-0056 `§Decision 3 (b)`) 는 점을 명시.
  - [ ] **왜 write 국면이 없는가** — ADR-0056 `§Decision 2`(CI 자동 commit 비채택) 와
        `§Consequences (d)`(사람이 CI 로그 값을 확인 후 승인) 로 링크해, `absent` 가 baseline 을
        **쓰지 않고 후보 수치만 노출** 하는 이유를 1 ~ 2 문장으로 박제.
- [ ] 문서에 적은 **모든 식별자 · 상수 문자열 · 키 이름** 이 실제 코드와 일치한다 —
      `grep -n "PERF_CHECKIN_BASELINE\|CHECKIN_LOG_PREFIX\|formatCheckinCandidateLine\|runCheckinBaselineCheck" test/perf/*.ts`
      결과와 대조해 오탈자 0 임을 확인.
- [ ] **R-112 (1) happy-path** — 본 task 는 **코드 변경 0 · 신규 public symbol 0** 이라 신규
      happy-path unit test 대상이 없다. 대신 문서가 기술한 정상 국면(`compared`) 서술이
      `test/perf/checkin-baseline-run.spec.ts` 의 기존 happy-path test 와 일치함을 대조 확인한다.
- [ ] **R-112 (2) error path** — 신규 symbol 0 이라 신규 error test 대상 없음. 문서가 기술한 예외
      전파 서술(candidate 형태 불량 → `TypeError` / `RangeError` 가 `absent` 국면에서 전파,
      `disabled` 는 candidate 를 보지 않아 무관) 이 `checkin-baseline-report.spec.ts` ·
      `checkin-baseline-run.spec.ts` 의 기존 error test 와 일치함을 대조 확인한다.
- [ ] **R-112 (3) 분기 cover** — 신규 분기 0. 문서의 3 국면 서술이 코드의 실제 분기 3 개와
      1:1 대응함을 확인(누락 · 날조 분기 0).
- [ ] **R-112 (4) negative cases** — 신규 코드 0 이라 신규 negative test 대상 없음. 문서에
      negative 규약(토글 모호값 → off, 비교 진입 전 `compare` 무효여도 예외 없음, 회귀 시에도
      throw 0) 이 빠짐없이 들어갔는지 확인한다.
- [ ] **R-110 / R-113 / R-114** — `pnpm lint && pnpm build && pnpm test` 전량 통과(문서 변경만이라
      실패 0 이어야 함). `pnpm test:perf` 는 기존과 동일 결과.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (코드 변경 0 이므로 직전 수치 유지).
- [ ] `§12` 준수 — 본문 한국어, 식별자 · 키 · 경로 · 상수 문자열은 영어 그대로.

## Out of Scope

- **`test/perf/*.ts` 코드 수정 전면 금지** — 본 task 는 문서 전용이다. 문서화 중 코드 결함을
  발견하면 고치지 말고 `Follow-ups` 에 적는다.
- ADR-0056 `§Follow-ups (a)` 본체 — baseline JSON 최초 생성 · 값 승인 · commit (별도 slice).
- ADR-0056 `§Follow-ups (c)` 임계 fix 갱신 (별도 slice).
- `checkin-baseline-store.ts` / `-adapter.ts` / `-plan.ts` / `-spec-suite.ts` / `-spec-wiring.ts`
  의 **상세** API 문서화 — 본 절에서는 이름 · 역할 한 줄 pointer 까지만. 상세는 별도 slice.
- `.github/workflows/ci.yml` 수정, `docs/PLAN.md` · `docs/requirements.md` 갱신 (후자는 별도
  `direct` doc-sync 소관 — T-1585 전례).
- README 기존 절의 문장 재작성 · 대량 정규화 — 신규 절 추가와 그에 필요한 최소 연결 문장만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 없음 — sub-agent 가 발견 시 여기에 append)
