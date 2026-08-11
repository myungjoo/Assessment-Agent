---
id: T-1562
title: 체크인 baseline 비교 진입 판정 helper 박제 (ADR-0056 Follow-up (b) 선행 slice)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T03:20:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560, T-1561]
touchesFiles:
  - test/perf/checkin-baseline-plan.ts
  - test/perf/checkin-baseline-plan.spec.ts
completedAt: 2026-08-11T05:02:15Z
prNumber: 1243
mergeCommit: "19049655"
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b) 순수 선행 slice: 체크인 baseline 비교 진입 판정 (helper+spec × 1.5)"
---

# T-1562 — 체크인 baseline 비교 진입 판정 helper 박제

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 2` 는 체크인 baseline
파일을 **명시적 `commitMode: pr` task 에서만** 갱신하고 CI 가 자동으로 쓰는 방식을 비채택했으며,
`§Decision 3 (b)` 는 baseline 대비 상대 회귀를 **관찰(비-fail)** 로 두라고 못 박았다. 그런데
기존 `confirmOrCompareBaseline` 은 baseline 부재 시 **곧바로 write 해 기준을 자기 승인**하는
(`established`) 분기를 갖고 있어, 체크인 디렉토리를 그대로 물리면 CI 가 baseline 을 쓰는 셈이 된다
(`§Consequences (d)` 가 지적한 "첫 run 의 자기 승인" 위험).

따라서 후속 배선 slice 가 필요한 것은 "쓸지 말지"를 매번 `if` 로 재추론하는 코드가 아니라,
**언제 비교에 진입하고 언제 아무 것도 하지 않는지**를 한 곳에서 판정하는 진입점이다. 본 task 는
Follow-up (b) 중 **workflow · 기존 perf-spec · 파일 시스템을 전혀 건드리지 않는 순수 판정 부분**만
떼어 모듈 1 개로 박제한다. 경로 조립은 T-1560 의 `resolveCheckinBaselinePath` 에, 존재 판정 자체는
호출측이 주입하는 boolean 에 위임하므로 **재구현 0** 이다.

완료 선언 0 — [PLAN.md](../PLAN.md) `140~142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 2`(갱신 주체) · `§Decision 3 (b)`(관찰 비-fail) · `§Consequences (d)`(첫 run 자기 승인 위험)
- [test/perf/checkin-baseline-store.ts](../../test/perf/checkin-baseline-store.ts) — `resolveCheckinBaselinePath` 계약(예외 종류 · 결정성). 경로 문자열을 새로 적지 말 것.
- [test/perf/checkin-baseline-report.ts](../../test/perf/checkin-baseline-report.ts) — 형태 검증 예외 계약(`TypeError`/`RangeError`) 표기 관례 참조.
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) — `baselineFileExists` · `ConfirmOrCompareResult` 의 기존 책임 경계(본 task 는 이 파일을 수정하지 않는다).
- [test/perf/checkin-baseline-report.spec.ts](../../test/perf/checkin-baseline-report.spec.ts) — colocated spec 의 서술 · 케이스 배치 스타일 참조.
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-110 ~ R-112 test 의무.

## Acceptance Criteria

- [ ] 신규 파일 `test/perf/checkin-baseline-plan.ts` 가 다음 4 개를 export 한다.
  - `CHECKIN_BASELINE_ENV_FLAG` — 체크인 baseline 비교의 opt-in 토글 환경변수 이름 상수(값 `PERF_CHECKIN_BASELINE`). 다른 곳에 같은 문자열을 다시 적지 않는다.
  - `isCheckinBaselineEnabled(env)` — 주입된 환경변수 record 를 읽어 boolean 을 낸다. `"1"` · `"true"` · `"yes"`(대소문자 무시 · 앞뒤 공백 무시)만 `true`, 미설정 · 빈 문자열 · 그 외 값은 전부 `false`. `env` 가 object 가 아니면 `TypeError`.
  - `CheckinBaselinePlan` — 판별 union 타입. `{ mode: "compare"; baselinePath: string }` 또는 `{ mode: "skip"; reason: "disabled" | "absent"; baselinePath: string | null }`.
  - `planCheckinBaselineCheck(input)` — `{ processEnv, envMeta, repoRoot, exists }` 를 받아 위 union 을 낸다.
- [ ] `planCheckinBaselineCheck` 의 판정이 ADR-0056 을 그대로 집행한다.
  - 토글 off → `{ mode: "skip", reason: "disabled", baselinePath: null }` (경로 조립 없이 단락).
  - 토글 on + `exists === false` → `{ mode: "skip", reason: "absent", baselinePath: <해석된 경로> }`. **write / establish 모드는 union 에 존재하지 않는다**(ADR-0056 `§Decision 2` — CI 는 baseline 을 쓰지 않는다).
  - 토글 on + `exists === true` → `{ mode: "compare", baselinePath: <해석된 경로> }`.
  - 경로는 `resolveCheckinBaselinePath(envMeta, repoRoot)` 위임으로만 얻고, 그 예외(`TypeError`/`RangeError`)는 그대로 전파한다(재검증 · 중복 throw 금지).
- [ ] `fs` · `path` 직접 조작 · `process.env` 직접 접근이 본 모듈에 **0 건**이다(순수 함수 — 환경변수와 존재 여부는 전부 인자로 주입). `grep -n "require(\"fs\")\|from \"fs\"\|process\.env" test/perf/checkin-baseline-plan.ts` 결과 0 줄.
- [ ] colocated spec `test/perf/checkin-baseline-plan.spec.ts` 가 happy-path 를 cover — `isCheckinBaselineEnabled` 의 truthy 값 3 종 각 1+, `planCheckinBaselineCheck` 의 `compare` · `skip(absent)` · `skip(disabled)` 3 국면 각 1+.
- [ ] error path test 1+ — `isCheckinBaselineEnabled(null)` · non-object 인자에 `TypeError`, `planCheckinBaselineCheck` 의 `input` 이 non-object 일 때 `TypeError`, `repoRoot`/`envMeta` 무효 시 위임 예외(`TypeError`/`RangeError`)가 **그대로** 전파되는지 각 1+.
- [ ] 분기 cover — 토글 on/off × `exists` true/false 조합 4 갈래 각 1+ test, `isCheckinBaselineEnabled` 의 미설정 · 빈 문자열 · `"0"` · `"false"` · 대문자 `"TRUE"` · 앞뒤 공백(`" yes "`) 각 1+.
- [ ] negative cases 충분 cover — (a) 토글 off 일 때 `baselinePath` 가 `null` 이고 경로 해석 예외가 발생하지 않음(무효 `repoRoot` 를 줘도 throw 0), (b) 반환 객체에 `write`/`establish` 계열 mode 가 없음, (c) 같은 입력 반복 호출이 항상 같은 결과(결정성), (d) 서로 다른 `envMeta.label` 이 서로 다른 `baselinePath` 를 냄, (e) 호출이 인자 객체를 변형하지 않음(입력 불변).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `.github/workflows/ci.yml` 편집 — ADR-0056 `§Decision 4` 는 기존 `perf test` step 재사용이라 workflow 변경이 필요 없다. 본 task 에서 건드리지 않는다.
- 체크인 baseline JSON 파일의 실제 생성 · commit(`test/perf/baselines/` 디렉토리 · `.gitkeep` 포함) — ADR-0056 `§Follow-ups (a)`, 실측 + 사람 눈 확인이 전제인 별도 pr-mode task.
- 기존 measure→confirm perf-spec(slice 25~29) 5 개의 배선 수정 — 본 helper 를 실제로 물리는 것은 다음 slice.
- `test/perf/latency-baseline.ts` · `latency-baseline-io.ts` · `checkin-baseline-store.ts` · `checkin-baseline-report.ts` 수정 — 전부 위임 대상이며 재구현 0.
- `scripts/daily-test.sh` leg 추가 및 그에 딸린 drift-guard smoke spec 동반 수정 — 파일 수가 cap 을 넘긴다(Q-0054 선례).
- 부하계획 `§ 3` 임계 수치 확정 · `§ 5` 본문 갱신 · PLAN `140~142 행` · REQ-048 재판정 — 별도 doc-sync task(완료 선언 0 유지).
- slice 30(남은 route 축) 신규 perf-spec 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 요약 (2026-08-11)

`pr` mode PR **#1243** squash merge `19049655` — **2 파일 `+300/-0`**(cap `300 LOC / 5 파일` 이내).
`test/perf/checkin-baseline-plan.ts` 4 종 export(`CHECKIN_BASELINE_ENV_FLAG` 상수 ·
`isCheckinBaselineEnabled` · `CheckinBaselinePlan` union · `planCheckinBaselineCheck`) +
colocated spec 44 case. 판정 순서 = input 형태 → 토글 → exists → 경로 위임.
ADR-0056 `§Decision 2` 집행 — **write 모드 부재**(baseline 부재 시 자기 승인 분기 차단) ·
경로 계산은 `checkin-baseline-store.ts` 위임(재구현 0) · `fs` / `path` / 전역 환경변수
직접 접근 **0 건**(grep 0 줄).

4-게이트 충족 — reviewer APPROVE(round 1) PR comment 외화 + integrator 자체 점검 +
PR CI 2 job(`기본 검사` 4m47s · `배포 산출물 검증` 1m34s) pass(run `31460023000`) + squash merge.
R-110/R-112 충족 — unit **432 suite / 12399 test** pass, `test:cov` line **99.95%** ·
function **100%**(임계 80% 충족).

**완료 선언 0 유지** — PLAN · REQ-048 상태 미변경, `ci.yml` 편집 **0** · baseline JSON 생성 **0** ·
기존 perf-spec 미변경 — Out of Scope 전부 보존.
