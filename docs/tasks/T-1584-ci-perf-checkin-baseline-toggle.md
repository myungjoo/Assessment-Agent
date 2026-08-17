---
id: T-1584
title: ci.yml perf step 에 체크인 baseline 비교 토글 편입 + drift-guard smoke 신설
phase: P5
status: DONE
completedAt: 2026-08-17T18:04:20Z
prNumber: 1265
mergeCommit: e7b0a3777edd8c7ca88a9cdbe3f28e1154e6f2db
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-08-17
createdAt: 2026-08-17T16:43:32Z
independentStream: perf-baseline-checkin
dependsOn: [T-1583]
touchesFiles:
  - .github/workflows/ci.yml
  - test/smoke/ci-workflow-perf-checkin-baseline-toggle-parity-drift.smoke-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (b) 집행: 기존 perf step 재사용 + PERF_CHECKIN_BASELINE 토글 on, exit code 불변"
---

# T-1584 — ci.yml perf step 에 체크인 baseline 비교 토글 편입 + drift-guard smoke 신설

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 4` 는 체크인 baseline
비교를 **별도 job 신설 없이 기존 `perf test` step 재사용** 으로 CI 에 편입하기로 못 박았고,
`§Follow-ups (b)` 가 그 집행을 남겨뒀다. T-1573 ~ T-1583 이 배선 factory 승격 · 소비자 9 개
배선 · `stepClock` 관용구 정리를 마쳤으므로 **판정·배선 쪽 잔여는 0** 이고, 남은 것은
`.github/workflows/ci.yml` 에서 opt-in 토글 `PERF_CHECKIN_BASELINE` 을 켜는 일뿐이다
(PLAN `140 행` 성능 검증 / REQ-048 조회 p95 < 3s 계열).

토글이 꺼진 지금 CI 의 배선 국면은 전부 `skip`/`disabled` 로 떨어져 **비교 경로가 CI 에서 한
번도 실행되지 않는다**. 토글을 켜면 (a) 체크인 baseline 파일이 아직 없는 동안은
`skip`/`absent` 로그만 남고, (b) `§Follow-ups (a)` 가 baseline JSON 을 체크인한 순간부터
같은 step 이 자동으로 `compared` 경로에 들어간다. 즉 본 slice 는 **(a) 를 기다리지 않고
선행 가능** 하며, ADR `§Follow-ups` 서두의 "각 항목은 서로 의존하지 않는 독립 slice" 판정과
정합한다.

**exit code 는 불변이다** — `§Decision 3 (b)` 대로 상대 회귀는 관찰만 하고 throw 0 이며,
`checkin-baseline-adapter.ts` 에는 write · mkdir 국면이 아예 없어 CI 가 baseline 을 자기
승인하는 경로도 없다. 따라서 본 변경으로 CI 가 새로 red 가 될 수 있는 경로는 **오직 기존
spec 이 ambient 토글 off 를 암묵 가정하고 있었을 경우** 뿐이고, 그 가정 부재를 실증하는 것이
본 task 의 검증 핵심이다.

## Required Reading

- `.github/workflows/ci.yml` `234~243 행` — 편집 대상인 `perf test` step (`run: pnpm test:perf`).
  같은 파일 `250~256 행` 의 `reviewer agent approval 검증` step 이 **`env:` 블록 표기의 정본 예시**.
- `test/perf/checkin-baseline-plan.ts` — `CHECKIN_BASELINE_ENV_FLAG`(= `PERF_CHECKIN_BASELINE`)
  상수와 `isCheckinBaselineEnabled` 의 on 인정 값 3 종(`1` · `true` · `yes`, trim + 소문자화 기준.
  관대한 truthy 해석 금지) · `CheckinBaselinePlan` 의 `compare` / `skip(disabled|absent)` union.
- `test/perf/checkin-baseline-adapter.ts` — 토글 on 일 때만 `baselineFileExists` 를 위임하고
  write · mkdir 국면이 0 인 근거 (CI 자기 승인 경로 부재).
- `test/perf/checkin-baseline-spec-suite.ts` `196~216 행` — 배선 국면의 `beforeEach` 가 FLAG 를
  `delete` 하고 `afterEach` 가 원복하므로 **ambient ON 이 배선 국면 판정을 바꾸지 않는** 근거.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 3` (절대 임계만 fail /
  상대 회귀는 관찰) · `§Decision 4` (기존 step 재사용, 별도 job 금지) · `§Follow-ups (b)`.
- `test/smoke/ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts` —
  신설 smoke 의 **정본 패턴**: 헤더 주석(존재 이유 · 🔥 격리 선언 · Out of Scope), `__dirname`
  기준 `REPO_ROOT` 해석, `readFileSync` 정적 추출, 합성 mutation 으로 drift 변별성 입증,
  Error path / negative 국면 배치.
- `test/jest-smoke.json` — `rootDir: ".."` 이라 smoke spec 에서 `../perf/checkin-baseline-plan`
  import 가 가능하다는 근거 (플래그 이름을 문자열로 재작성하지 말고 상수를 import 해 대조).

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 의 `perf test` step 에 `env:` 블록이 추가되어
      `PERF_CHECKIN_BASELINE: "1"` 을 싣는다. `run: pnpm test:perf` 는 **그대로 유지** 하고,
      새 job · 새 step · `schedule`/`workflow_dispatch` trigger 추가는 0 이다
      (ADR-0056 `§Decision 4`). 토글을 켜는 근거와 exit code 불변 사실을 step 주석에 한국어로
      2~4 줄 박제한다 (ADR-0056 `§Decision 3 (b)` 인용).
      검증: `grep -n "PERF_CHECKIN_BASELINE" .github/workflows/ci.yml` 결과 1 건 이상,
      `git diff --stat` 의 ci.yml 변경이 `perf test` step 범위에 한정.
- [ ] **happy-path** — 신설 smoke `test/smoke/ci-workflow-perf-checkin-baseline-toggle-parity-drift.smoke-spec.ts`
      가 실 `ci.yml` 을 읽어 `perf test` step 의 `env:` 매핑을 정적으로 추출하고, 그 키가
      `checkin-baseline-plan.ts` 의 `CHECKIN_BASELINE_ENV_FLAG` 와 **일치** 하며 값이
      `isCheckinBaselineEnabled` 로 판정해 `true` 임을 단언하는 happy-path test 1+ 를 갖는다
      (플래그 이름 문자열 하드코딩 금지 — 상수 import 로 parity 확보).
- [ ] **error path** — 추출 helper 의 error path test 1+: 존재하지 않는 경로로 `readFileSync`
      호출 시 ENOENT throw (0-byte fallback 으로 false-PASS 하지 않음), 그리고 helper 에
      non-string / 빈 문자열 입력을 넣었을 때의 거동을 단언한다.
- [ ] **flow / 분기 cover** — 추출 helper 의 분기마다 test 1+: (a) `env:` 블록이 있는 step,
      (b) `env:` 블록이 없는 step, (c) 대상 step 이름이 없는 합성 소스. `isCheckinBaselineEnabled`
      의 on 값 3 종(`1` · `true` · `yes`) 과 off 계열(미설정 · `""` · `0` · `false`) 을
      각각 태워 분기를 모두 cover 한다.
- [ ] **negative cases 충분 cover** — 각 1+ test: (a) 합성 소스에서 `env:` 블록을 제거하면
      추출 결과가 비어 토글 부재가 검출되고 **원본 추출은 불변**, (b) 합성 소스의 값을 `"0"` 으로
      바꾸면 토글 off 로 판정, (c) 값 앞뒤 공백 · 대문자(` TRUE `) 도 on 으로 정규화, (d)
      `yes-please` 같은 관대 truthy 오인 값은 off, (e) `perf test` step 을 `pnpm test:perf` 가
      아닌 다른 run 으로 바꾼 합성에서는 계약 위반이 검출된다. 추출 함수가 인자를 mutate 하지
      않음도 단언한다.
- [ ] **ambient 토글 누출 부재 실증 (본 task 의 핵심 회귀 검증)** — 로컬에서
      `PERF_CHECKIN_BASELINE=1 pnpm test` 와 `PERF_CHECKIN_BASELINE=1 pnpm test:perf` 를 실행해
      suite 수 · test 수 · 결과가 토글 미설정 실행과 **동일** 함을 수치로 확인한다. 어느 spec
      이든 ambient off 를 암묵 가정해 fail 하면 그 spec 을 고치지 말고 **BLOCKED 로 보고**
      (토글 편입 자체의 전제가 깨진 것이므로 planner 판단 대상).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` · `pnpm test:smoke` 전부 pass.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% threshold).
- [ ] 로컬 Postgres 부재로 실 DB perf 국면이 skip 되면 그 사실을 PR 본문에 명시하고 **CI 의
      `perf test` step** conclusion 으로 대체 확인한다. PR 본문에 CI perf step 로그의 체크인
      baseline 국면 출력(`skip`/`absent` 프리픽스 로그) 을 1~2 줄 인용해 토글이 실제로 켜졌음을
      외화한다.

## Out of Scope

- ADR-0056 `§Follow-ups (a)` — `test/perf/baselines/` 아래 체크인 baseline JSON 최초 생성 ·
  commit. `§Consequences (d)` 가 값 타당성의 사람 눈 확인을 전제하므로 자율 fire 에서 완결 불가.
- 상대 회귀를 CI fail 로 승격하는 변경 · tolerance 재산정 · 절대 임계 수치 변경
  (`§Decision 3` 의 연속 20 run 조건 미충족).
- `test/perf/*.ts` · `test/perf/*.perf-spec.ts` 본문 수정 — 판정 primitive · 배선 국면 불변
  (신규 perf-spec 0, 국면 제목 · 단언 · 순서 · 반복수 불변).
- 별도 perf job 신설 · `schedule` / `workflow_dispatch` trigger 분리 · runner 변경
  (`§Decision 4` 가 명시적으로 비채택 · `§Alternatives`).
- `test/perf/README.md` · `docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` ·
  요구사항 매핑 표 doc-sync — ADR-0056 `§Follow-ups (c)`/`(d)` 소관의 별도 task
  (CLAUDE.md `§3.1` rule 3 — 코드/워크플로 변경과 같은 commit 에 섞지 않는다).
- `.claude/agents/*.md` · `CLAUDE.md` 운영규칙 수정 (직전 fire 가 남긴 integrator 단일-writer
  금칙 박제 follow-up 은 본 task 와 무관 — 별도 결정 대상).
- `daily-test.sh` leg 추가 · deploy 컨테이너 계약 변경 (drift-guard smoke 3 개 동시 갱신 강제로
  cap 초과 — T-1122 선례).
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가(YAML 파서 금지 — 정규식/문자열 추출), perf
  jest config 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result (2026-08-17)

`DONE` — PR #1265 (reviewer round 1/7 APPROVE) 스쿼시 머지 `e7b0a377`.

- `.github/workflows/ci.yml` 의 `perf test` step 에 `env:` 블록(`PERF_CHECKIN_BASELINE: "1"`) +
  근거 주석 4 줄만 추가 — `run` · job · trigger · runner 불변 (ADR-0056 `§Decision 4` 의
  "기존 step 재사용" 계약 준수).
- `test/smoke/ci-workflow-perf-checkin-baseline-toggle-parity-drift.smoke-spec.ts` 신설 —
  13 test (happy 2 · flow 3 · negative 5 · error 3). 플래그 이름은 상수 import 로 대조해
  하드코딩 0.
- 토글 on/off 실행이 unit 437 suite / 12506 test · perf 63 suite / 658 test 로 수치 동일 —
  ambient 토글 누출 0 을 실증.
- 총 +299/-0, 2 파일 (cap 300 LOC / 5 파일 이내). 새 dependency 0.

