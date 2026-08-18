---
id: T-1596
title: 체크인 baseline compared 국면 3 줄 로그 계약을 test/perf/README.md 에 doc-sync
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T07:10:00Z
independentStream: perf-checkin-baseline
dependsOn: [T-1590, T-1595]
touchesFiles:
  - test/perf/README.md
plannerNote: "P5 성능 검증 — PLAN 142 행(REQ-048) 축, T-1595 Follow-ups 첫 항목: compared 국면이 3 줄이 됐는데 README 는 2 줄 시절 서술"
---

# T-1596 — 체크인 baseline `compared` 국면 3 줄 로그 계약을 `test/perf/README.md` 에 doc-sync

## Why

직전 [T-1595](T-1595-checkin-baseline-compared-candidate-log.md) 가 `runCheckinBaselineCheck`
의 `compared` 국면 로그 끝에 `formatCheckinCandidateLine` 줄을 이어 붙이면서, 3 번째 파일이
되는 `test/perf/README.md` doc-sync 를 **명시적으로 이월**했다 (해당 task 의 `Follow-ups` 첫
항목). 그 결과 [T-1590](T-1590-checkin-baseline-readme-sync.md) 이 박제한 harness README 의
체크인 baseline 절이 **코드보다 한 세대 뒤처졌다** — 3 국면 표의 `compared` 행은 로그 줄 수를
"1 줄 + 상세 비교 본문" 으로 적고 (`149~153 행`), 로그 표기 절은 "`compared` 국면은 4 번째 줄
뒤에 상세 비교 본문이 붙는다" 로 끝나며 (`176 행` 부근), negative 규약은 candidate 형태 불량의
예외 전파를 `absent` 국면에만 귀속시킨다 (`191 행` 부근). 셋 다 현재 코드와 불일치다.

이 drift 는 단순 오탈자가 아니라 **판독 계약의 drift** 다 —
[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 상대 회귀를
CI fail 로 올리지 않고 **로그를 읽는 사람·agent 의 판독** 에 맡기고, `§Decision 5` 1 항은 임계
승격의 표본 축적 원천을 그 로그 줄로 지정한다. 판독자가 "마지막 줄이 늘 candidate 줄" 이라는
계약을 문서에서 확인할 수 없으면 grep 축을 코드에서 다시 읽어야 한다. 본 task 는 PLAN
`142 행`(REQ-048 조회 3 초 축) harness 문서를 실제 코드 계약과 다시 맞추는 **문서 전용
slice** 이며 코드 변경은 0 이다.

## Required Reading

- `test/perf/README.md` `108~200 행` — `## 체크인 baseline 게이트 (checkin-baseline-*.ts)` 절
  전체. 특히 `### 3 국면 (CheckinBaselineRunOutcome)` 표 (`149~153 행`) · 그 아래 국면별 bullet
  (`155~162 행`) · `### 로그 표기` 의 코드 블록과 뒤 문단 (`165~180 행`) · `### 전사 전용 계약`
  의 negative 규약 bullet (`186~193 행`) 4 곳이 수정 대상이다. **기술 톤 · 표 형식 · "위임 ·
  순서 계약 · 예외 전파 · 관찰 전용" 서술 관례를 그대로 따른다.**
- `test/perf/checkin-baseline-run.ts` — `runCheckinBaselineCheck` 의 JSDoc(“`absent` 로그는
  2 줄 · `compared` 로그는 3 줄 — 각각 기존 로그 뒤에 `formatCheckinCandidateLine` 결과를 개행
  1 개로 잇는다(마지막 줄이 늘 candidate 줄)”)과 `compared` 국면 조립부. **본 파일은 읽기만
  한다.**
- `test/perf/checkin-baseline-run.spec.ts` — `compared` 국면 줄 순서 · 줄 수 회귀 가드 test 와
  negative 5 종. 문서 서술이 이 spec 의 단언과 1:1 인지 대조하는 기준이다.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 3 (b)`(상대 회귀는 관찰만 ·
  exit code 불변) · `§Decision 5` 1 항(동일 `env.label` 20 run 표본 축적).

## Acceptance Criteria

- [ ] **3 국면 표 갱신** — `compared` 행의 `로그 줄 수` 칸이 현재 계약(요약 1 줄 + 상세 비교
      본문 + candidate 1 줄, **마지막 줄이 candidate 줄**)을 기술한다. `disabled` 1 줄 ·
      `absent` 2 줄 · 비교 함수 호출 횟수(0 회 / 0 회 / 정확히 1 회) 칸은 **변경하지 않는다**.
- [ ] **국면 bullet 갱신** — `compared` bullet 이 "`formatCheckinOutcomeBlock` 블록 뒤에
      `formatCheckinCandidateLine` 결과를 개행 1 개로 잇는다" 는 조립 순서와 **본문 재계산 ·
      재정렬 0 · 포매터 재사용(신규 포매터 0)** 을 함께 명시한다.
- [ ] **로그 표기 절 갱신** — 코드 블록 뒤 문단이 `compared` 국면의 실제 줄 순서
      (`outcome=compared regressed=<bool>` → 상세 비교 본문 → `candidate label=... count=...`)
      를 기술하고, `absent` · `compared` **두 국면 모두 마지막 줄이 candidate 줄** 이라는 공통
      계약을 1 문장으로 박제한다. 기존 코드 블록의 4 줄 예시 자체는 유지(키 순서 계약 불변).
- [ ] **negative 규약 갱신** — candidate 형태 불량의 예외 전파가 `absent` 뿐 아니라 `compared`
      국면에서도 성립하며(단 `compared` 는 **비교를 1 회 마친 뒤** 시점), `disabled` 만
      candidate 를 보지 않아 무관함을 명시한다. 회귀(`regressed === true`) 입력에도 throw 0 ·
      exit code 불변(ADR-0056 `§Decision 3 (b)`) 서술은 유지.
- [ ] **축적 축 1 문장** — candidate 줄이 ADR-0056 `§Decision 5` 1 항(동일 `env.label` 최소
      20 run 지표 축적)의 grep 축임을 1 ~ 2 문장으로 잇는다(임계 수치는 적지 않는다).
- [ ] **식별자 대조** — 문서에 적은 모든 식별자 · 상수 · 키 이름이 실제 코드와 일치한다.
      `grep -n "CHECKIN_LOG_PREFIX\|formatCheckinCandidateLine\|formatCheckinOutcomeBlock\|runCheckinBaselineCheck" test/perf/*.ts`
      결과와 대조해 오탈자 0 임을 확인.
- [ ] **R-112 (1) happy-path** — 본 task 는 **코드 변경 0 · 신규 public symbol 0** 이라 신규
      happy-path unit test 대상이 없다. 대신 문서의 `compared` 3 줄 서술이
      `test/perf/checkin-baseline-run.spec.ts` 의 기존 happy-path(줄 순서) test 단언과 일치함을
      대조 확인한다.
- [ ] **R-112 (2) error path** — 신규 symbol 0 이라 신규 error test 대상 없음. 문서의 예외 전파
      서술(`compared` 는 비교 1 회 후 포매터 예외 전파, `disabled` 는 무관)이 같은 spec 의 기존
      error test 와 일치함을 대조 확인한다.
- [ ] **R-112 (3) 분기 cover** — 신규 분기 0. 문서의 3 국면 서술이 코드의 실제 분기 3 개와
      1:1 대응함을 확인(누락 · 날조 분기 0).
- [ ] **R-112 (4) negative cases 충분 cover** — 신규 코드 0 이라 신규 negative test 대상 없음.
      문서의 negative 규약이 spec 의 negative 축(토글 모호값 → off · `skip` 국면에서 `compare`
      무효여도 예외 0 · `NaN` 전사 · 수치 non-number · 회귀 입력 throw 0)을 빠짐없이 반영했는지
      항목별로 확인한다.
- [ ] **R-110 / R-113 / R-114** — `pnpm lint && pnpm build && pnpm test` 전량 통과(문서 변경만
      이라 실패 0 이어야 함). `pnpm test:perf` 결과는 기존과 동일.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% (코드 변경 0 이므로 직전 수치 유지).
      PR 본문에 `src/` 변경 0 · coverage 변동 0 임을 명시.
- [ ] `§12` 준수 — 본문 한국어, 식별자 · 키 · 경로 · 상수 문자열은 영어 그대로.

## Out of Scope

- **`test/perf/*.ts` 코드 수정 전면 금지** — 본 task 는 문서 전용이다. 문서화 중 코드 결함을
  발견하면 고치지 말고 `Follow-ups` 에 적는다.
- `test/perf/README.md` `1132~1150 행` 의 **잔여 4 축 서술**("다섯 baseline 이 전부 임시 디렉토리
  1 회성") 갱신 — T-1592 의 baseline 체크인 이후 stale 해졌으나 성격이 다른 절이라 별도 slice
  (Follow-ups 참조).
- ADR-0056 `§Follow-ups (c)` 임계 fix — 동일 `env.label` 20 run 축적이 아직 채워지지 않았으므로
  본 task 에서 어떤 임계 수치도 확정 · 인용하지 않는다.
- `.github/workflows/ci.yml` · `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` ·
  `docs/requirements.md` 갱신 — 각각 별도 slice 소관.
- README 기존 절의 문장 재작성 · 대량 정규화 · 다른 절 표기 정리 — 위 4 개 지점과 축적 축
  1 문장 외 변경 금지(diff 최소화).
- `*-read` / `*-realdb` 계열 perf-spec 의 factory 배선 확산 · 신규 baseline label 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `test/perf/README.md` `1132~1150 행` 잔여 4 축 서술을 T-1592 ~ T-1595 이후 현실(체크인 baseline
  1 건 존재 · `compared` 상시 진입)에 맞게 doc-sync (`pr`, 1 파일).
- 동일 `env.label` 20 run 축적 후 ADR-0056 `§Follow-ups (c)` — 부하계획 `§ 3` "baseline 후 fix"
  행을 확정 임계로 승격(근거 run 수 · `env.label` 각주 동반, doc-sync).
