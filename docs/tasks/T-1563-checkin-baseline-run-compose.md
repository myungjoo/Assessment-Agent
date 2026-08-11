---
id: T-1563
title: 체크인 baseline 판정→비교→로그 조립 진입점 박제 (ADR-0056 Follow-up (b) 배선 선행)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T05:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560, T-1561, T-1562]
touchesFiles:
  - test/perf/checkin-baseline-run.ts
  - test/perf/checkin-baseline-run.spec.ts
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b): plan+compare+format 을 잇는 순수 조립 진입점 (helper+spec × 1.5)"
---

# T-1563 — 체크인 baseline 판정→비교→로그 조립 진입점 박제

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 는 체크인
baseline 비교를 기존 `perf test` step 에 편입하되 상대 회귀를 **로그로 가시화만 하고 exit code 는
바꾸지 않는다**(`§Decision 3 (b)`)고 못 박았다. 그 집행에 필요한 조각은 세 slice 로 이미 박제됐다 —
경로 해석(T-1560 `checkin-baseline-store.ts`) · 로그 표기(T-1561 `checkin-baseline-report.ts`) ·
비교 진입 판정(T-1562 `checkin-baseline-plan.ts`). 그런데 셋을 **어떤 순서로 잇는지**가 아직 어디에도
없어, 실제 배선 slice 가 perf-spec 안에서 `if (plan.mode === "compare") ...` 를 각자 적으면 그 순간
순서 · skip 국면 로그 표기가 spec 마다 갈린다.

본 task 는 그 조립 순서를 모듈 1 개로 모은다 — 판정 위임 → (compare 국면에서만) 비교 함수 호출 →
로그 문자열 산출. **비교 자체는 주입받은 함수에 전적으로 위임**하므로 파일 시스템 접근이 0 이고,
회귀(`regressed === true`) 에도 throw 하지 않아 exit code 계약이 유지된다. 실제 perf-spec 배선 ·
`ci.yml` 편입 · baseline JSON 최초 생성은 본 task 밖이다.

완료 선언 0 — [PLAN.md](../PLAN.md) `140~142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 2`(CI 는 baseline 을 쓰지 않는다) · `§Decision 3 (b)`(관찰 비-fail · exit code 불변) · `§Follow-ups (b)`
- [test/perf/checkin-baseline-plan.ts](../../test/perf/checkin-baseline-plan.ts) — `planCheckinBaselineCheck` · `CheckinBaselinePlan` union 계약(판정 재구현 금지)
- [test/perf/checkin-baseline-report.ts](../../test/perf/checkin-baseline-report.ts) — `CHECKIN_LOG_PREFIX` 상수 · `formatCheckinOutcomeBlock` (로그 문자열 재조립 금지 — 상수·포매터 참조)
- [test/perf/checkin-baseline-store.ts](../../test/perf/checkin-baseline-store.ts) — `resolveCheckinBaselineDir(repoRoot)` (비교 함수에 넘길 baseDir 산출)
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) `178~192 행` — `readCompareBaselineFile(env, baseDir, candidate, options?)` 시그니처 · 반환 `{ comparison, report }` · 예외 계약(본 task 는 이 파일을 수정하지 않는다)
- [test/perf/checkin-baseline-plan.spec.ts](../../test/perf/checkin-baseline-plan.spec.ts) — colocated spec 의 서술 · 케이스 배치 스타일 참조
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-110 ~ R-112 test 의무

## Acceptance Criteria

- [ ] 신규 파일 `test/perf/checkin-baseline-run.ts` 가 다음 4 개를 export 한다.
  - `CheckinBaselineCompareFn` — 주입할 비교 함수 타입. `readCompareBaselineFile` 과 구조적으로 호환(`(env: BaselineEnvMeta, baseDir: string, candidate: BaselineReport, options?: CompareOptions) => { comparison: BaselineComparison; report: string }`).
  - `CheckinBaselineRunInput` — `{ processEnv, envMeta, repoRoot, exists, candidate, options? }`.
  - `CheckinBaselineRunOutcome` — 판별 union. `{ status: "compared"; regressed: boolean; log: string }` 또는 `{ status: "skipped"; reason: "disabled" | "absent"; log: string }`. **write / establish 국면은 union 에 존재하지 않는다**(ADR-0056 `§Decision 2`).
  - `runCheckinBaselineCheck(input, compare)` — 위 union 을 낸다.
- [ ] 조립 순서가 아래 그대로다(신규 판정 로직 0 — 전부 위임).
  1. `planCheckinBaselineCheck({ processEnv, envMeta, repoRoot, exists })` 로 판정한다. 그 예외(`TypeError`/`RangeError`)는 **그대로 전파**하고 재검증하지 않는다.
  2. `plan.mode === "skip"` → 비교 함수를 **호출하지 않고** `{ status: "skipped", reason, log }` 를 낸다. `log` 는 `CHECKIN_LOG_PREFIX` 상수를 참조해 `disabled` 는 경로 없이, `absent` 는 `plan.baselinePath` 를 실어 만든다(prefix 문자열을 새로 적지 않는다).
  3. `plan.mode === "compare"` → `compare(envMeta, resolveCheckinBaselineDir(repoRoot), candidate, options)` 를 **정확히 1 회** 호출하고, 그 반환으로 `{ outcome: "compared", comparison, report }` 를 만들어 `formatCheckinOutcomeBlock` 에 넘겨 `log` 를 얻는다. `regressed` 는 `comparison.regressed` 를 그대로 싣는다.
- [ ] `compare` 가 함수가 아니면 `TypeError`. 단 이 검사는 **`skip` 국면에서 단락된 뒤가 아니라 비교 진입이 확정된 시점**에만 적용해도 되며, 어느 쪽을 택했는지 JSDoc 에 명시한다.
- [ ] **exit code 불변** — `comparison.regressed === true` 입력에도 throw 하지 않고 `regressed: true` 와 로그만 낸다(ADR-0056 `§Decision 3 (b)`).
- [ ] `fs` · `path` 직접 조작 · `process.env` 직접 접근이 본 모듈에 **0 건**이다. `grep -n "from \"fs\"\|require(\"fs\")\|from \"path\"\|process\.env" test/perf/checkin-baseline-run.ts` 결과 0 줄.
- [ ] colocated spec `test/perf/checkin-baseline-run.spec.ts` 가 happy-path 를 cover — `compared`(regressed false) · `skipped(disabled)` · `skipped(absent)` 3 국면 각 1+, 반환 `log` 가 `CHECKIN_LOG_PREFIX` 로 시작하는지 각 1+.
- [ ] error path test 1+ — (a) `input` non-object 시 `TypeError`, (b) `processEnv`/`envMeta`/`repoRoot` 무효로 판정 helper 가 던지는 `TypeError`/`RangeError` 가 **그대로** 전파, (c) 주입 `compare` 가 throw(예: `ENOENT` 계열 `Error` · `SyntaxError`) 하면 래핑 없이 그대로 전파, (d) `compare` 가 함수가 아닐 때 `TypeError`.
- [ ] 분기 cover — 토글 on/off × `exists` true/false 4 갈래 각 1+, `regressed` true/false 각 1+, `options` 지정/미지정 각 1+(지정 시 주입 함수의 4 번째 인자로 그대로 전달되는지 확인).
- [ ] negative cases 충분 cover — (a) `skip` 두 국면에서 주입 `compare` 가 **한 번도 호출되지 않음**(mock 호출 횟수 0), (b) 반환 union 에 write/establish 계열 status 가 없음, (c) `compared` 국면에서 `compare` 호출 횟수가 정확히 1(중복 호출 0), (d) 같은 입력 반복 호출이 항상 같은 결과(결정성), (e) 호출이 `input` · `candidate` 객체를 변형하지 않음(입력 불변), (f) 서로 다른 `envMeta.label` 이 `absent` 로그의 경로를 서로 다르게 만듦.
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 총 diff ≤ 300 LOC / 변경 파일 ≤ 2 개 유지 — 초과 우려 시 JSDoc 을 간결히 하고 spec 은 유사 케이스를 `it.each` 로 묶되 위 R-112 4 종은 전부 남긴다.

## Out of Scope

- 기존 measure→confirm perf-spec(slice 25~29) 5 개에 본 진입점을 실제로 배선하는 것 — 다음 slice.
- `.github/workflows/ci.yml` 편집 — ADR-0056 `§Decision 4` 는 기존 `perf test` step 재사용이라 workflow 변경 자체가 불필요.
- 체크인 baseline JSON 파일의 실제 생성 · commit(`test/perf/baselines/` 디렉토리 · `.gitkeep` 포함) — ADR-0056 `§Follow-ups (a)`, 실측 + 사람 눈 확인이 전제인 별도 task.
- `test/perf/latency-baseline.ts` · `latency-baseline-io.ts` · `checkin-baseline-store.ts` · `checkin-baseline-report.ts` · `checkin-baseline-plan.ts` 수정 — 전부 위임 대상이며 재구현 0.
- 비교 tolerance 기본값 변경 · 절대 임계(`assertS2Threshold`) 손질 — ADR-0056 `§Decision 3 (a)` 현행 유지.
- `scripts/daily-test.sh` leg 추가 및 그에 딸린 drift-guard smoke spec 동반 수정 — 파일 수가 cap 을 넘긴다(Q-0054 선례).
- 부하계획 `§ 3` 임계 수치 확정 · `§ 5` 본문 갱신 · PLAN `140~142 행` · REQ-048 재판정 — 별도 doc-sync task(완료 선언 0 유지).
- slice 30(남은 route 축) 신규 perf-spec 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
