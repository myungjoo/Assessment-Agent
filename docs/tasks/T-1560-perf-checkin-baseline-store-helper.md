---
id: T-1560
title: perf 체크인 baseline 경로 helper 박제 (ADR-0056 Follow-up (a) 선행 slice)
phase: P5
status: DONE
completedAt: 2026-08-11T00:49:27Z
prNumber: 1241
mergeCommit: ea62686cb0ba5e97a66f6ffa9333a908f823b50c
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-10
createdAt: 2026-08-10T23:41:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1559]
touchesFiles:
  - test/perf/checkin-baseline-store.ts
  - test/perf/checkin-baseline-store.spec.ts
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (a) 의 최소 선행 slice: 체크인 baseDir 경로 해석 단일 진입점 (신규 helper + colocated spec × 1.5)"
---

# T-1560 — perf 체크인 baseline 경로 helper 박제

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 1` 은 체크인 baseline 의
저장 위치를 **`test/perf/baselines/` 단일 baseDir** 로 못 박았으나, 그 경로는 현재 **어느 코드에도
박제돼 있지 않다** — 다섯 measure→confirm spec 은 전부 `dirOf("baselines")` / `baselineDir("baselines")`
로 **임시 디렉토리** 를 만들 뿐이다 ([test/perf/README.md](../../test/perf/README.md) `1132~1150 행`
"다섯 baseline 모두 임시 디렉토리 1 회성").

ADR 의 Follow-up **(a) 체크인 JSON 최초 생성** 과 **(b) `ci.yml` 편입** 이 각자 경로 문자열을 따로
적으면 그 순간 drift 가 생긴다. 그래서 본 task 는 두 후속 slice 가 공유할 **경로 해석 단일 진입점**
을 순수 helper 1 개로 먼저 박제한다. 파일명 규약(prefix `baseline-` + `env.label` slug + `.json`)은
`§Decision 1` 이 명시한 대로 기존 `resolveBaselinePath` → `resolveBaselineFilename` 에 **전적으로
위임** 하며 재구현하지 않는다.

본 slice 는 **경로만** 다룬다 — 실제 baseline 수치 확정은 `§Consequences (d)` 대로 측정 환경에서 찍힌
값의 타당성 확인이 전제라 별도 slice 몫이고, 그때 이 helper 를 그대로 쓰면 된다. 완료 선언 0 —
[PLAN.md](../PLAN.md) `142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 1`(저장 위치 · baseDir 위임 · 재구현 0) · `§Follow-ups (a)(b)` · `§Out of scope`
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) `708~795 행` — `resolveBaselineFilename` · `resolveBaselinePath` 의 계약(예외 종류 · POSIX 결합 · 결정성)과 `BaselineEnvMeta` 타입
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) `311~330 행` — `baselineFileExists` 시그니처(본 task 는 **호출하지 않는다** — 중복 추가 방지 확인용)
- [CLAUDE.md](../../CLAUDE.md) `§3.2`(R-110 ~ R-112) · `§12`(언어 정책)

## Acceptance Criteria

- [ ] 신규 `test/perf/checkin-baseline-store.ts` 가 다음 3 개를 export 한다.
  - `CHECKIN_BASELINE_DIR` — repo root 기준 POSIX **상대** 경로 상수 `"test/perf/baselines"` (ADR `§Decision 1`).
  - `resolveCheckinBaselineDir(repoRoot: string): string` — `repoRoot` 와 위 상수를 `path.posix.join` 으로 결정적 결합. `repoRoot` 가 non-string 이면 `TypeError`, 빈/공백-only 이면 `RangeError` (`resolveBaselinePath` 의 `baseDir` 계약과 동형).
  - `resolveCheckinBaselinePath(env: BaselineEnvMeta, repoRoot: string): string` — `resolveBaselinePath(env, resolveCheckinBaselineDir(repoRoot))` 위임. `env` 관련 `TypeError` / `RangeError` 는 **그대로 전파**(재검증·중복 throw 금지).
- [ ] **재구현 0 검증** — 새 파일에 파일명 규약 리터럴이 등장하지 않는다: `grep -nE "baseline-|\.json\"|toLowerCase|replace\(" test/perf/checkin-baseline-store.ts` 결과가 **0 건**.
- [ ] **부작용 0 검증** — 새 파일이 `fs` 를 import 하지 않는다: `grep -n "from \"fs\"\|require(\"fs\")" test/perf/checkin-baseline-store.ts` 결과 0 건. 환경변수 read · 디렉토리 생성 · 존재 검사 없음.
- [ ] colocated spec `test/perf/checkin-baseline-store.spec.ts` 를 추가하고 아래를 모두 cover 한다.
  - **happy-path** — 3 export 각각 1+ test: 상수 값 일치 / 상대 `repoRoot` 와 절대 `repoRoot` 각각에서 결과가 `test/perf/baselines/baseline-<slug>.json` 로 끝남.
  - **error path** — `repoRoot` non-string(number · null · undefined) → `TypeError`, 빈 string · 공백-only → `RangeError`, `env` 형태 불량(필드 누락 · concurrency non-number) → `TypeError` 전파, `env.label` 빈/공백-only 및 slug 이 빈 string 이 되는 label(구분자-only 등) → `RangeError` 전파.
  - **분기 cover** — `repoRoot` 후행 슬래시 유무(`"/a/b"` vs `"/a/b/"`) · 중복 슬래시(`"//"`) 가 **동일 결과** 로 정규화됨, 대소문자만 다른 `env.label` 이 **동일 파일명** 을 낳음(결정성), 같은 입력 반복 호출이 항상 같은 문자열을 냄.
  - **negative cases 충분 cover** — 위 예외 유형 **각 1+** 에 더해: 결과 경로가 절대경로로 **강제되지 않음**(상대 `repoRoot` 는 상대 경로 유지), Windows 역슬래시 `repoRoot` 를 주어도 예외 없이 결정적 결과를 냄(플랫폼 무관), 두 서로 다른 `env.label` 이 서로 다른 경로를 낳음(파일 충돌 부재).
- [ ] `pnpm test` 출력에 새 spec 파일이 실행된 것이 보인다(unit jest `testRegex` 가 `.*\.spec\.ts$` 라 별도 config 편집 불요 — `test/perf/latency-baseline.spec.ts` 와 동일 경로 규약).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일 **2 개** · diff ≤ 300 LOC (cap 준수). 초과 조짐이 보이면 spec 의 중복 case 를 줄여 cap 안에서 끝낸다.

## Out of Scope

- **`test/perf/baselines/` 아래 실제 baseline JSON 생성·commit** — ADR Follow-up (a) 본체. 본 task 는 디렉토리도 만들지 않는다(`.gitkeep` 추가 금지).
- **`.github/workflows/ci.yml` 편집** — Follow-up (b).
- 기존 measure→confirm perf-spec 5 개의 `baseDir` 교체 · 흐름 변경 · retire.
- `test/perf/latency-baseline.ts` · `latency-baseline-io.ts` 수정, fs 계열 헬퍼(`checkinBaselineExists` · `readCheckinBaseline` 등) 추가.
- 부하계획 `§ 3` 임계 수치 확정 · `§ 5` item 4/5 본문 갱신 · PLAN `142 행` · REQ-048 재판정(전부 doc-sync 별건).
- 신규 dependency 추가 · 임계값 `DEFAULT_P95_MAX_MS = 3000` 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## 결과 (2026-08-11 완료)

- **DONE** — `pr` mode PR **#1241** squash merge (`ea62686c`). 변경 **2 파일 `+285/-0`** (cap `300 LOC / 5 파일` 이내).
- 산출: `test/perf/checkin-baseline-store.ts` (신규 helper 3 export — `CHECKIN_BASELINE_DIR` 상수 · `resolveCheckinBaselineDir` · `resolveCheckinBaselinePath`) + colocated spec `test/perf/checkin-baseline-store.spec.ts` (29 case, happy/error/branch/negative 4 종).
- 파일명 규약은 기존 `resolveBaselinePath` 에 위임 — **재구현 0** (파일명 리터럴 grep 0 건), **부작용 0** (`fs` import grep 0 건).
- 4-게이트 충족 — reviewer APPROVE (round 1) PR comment 외화 + integrator 자체 점검 + PR CI 2 job pass + squash merge.
- R-110/R-112 충족: unit 430 suite / 12331 test pass, `test:cov` line 99.95% · function 100% (임계 80% 충족).
- Out of Scope 보존 — `test/perf/baselines/` 실제 baseline JSON 생성 0 · `ci.yml` 편집 0 · 기존 perf-spec 5 개 미변경.
