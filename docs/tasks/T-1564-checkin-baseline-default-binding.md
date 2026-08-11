---
id: T-1564
title: 체크인 baseline 기본값 바인딩 어댑터 박제 (fs 존재 조회 + 기본 compare 결선)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T07:40:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560, T-1561, T-1562, T-1563]
touchesFiles:
  - test/perf/checkin-baseline-adapter.ts
  - test/perf/checkin-baseline-adapter.spec.ts
completedAt: 2026-08-11T09:00:58Z
prNumber: 1245
mergeCommit: "f6941358"
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b) 배선 직전 slice: 조립 진입점의 exists/compare/repoRoot 기본값 결선 (helper+spec × 1.5)"
---

# T-1564 — 체크인 baseline 기본값 바인딩 어댑터 박제

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 의 실제 배선을
위해 조립 진입점(T-1563 `runCheckinBaselineCheck`)까지는 박제됐다. 그런데 그 진입점은 순수성을
지키려고 **`processEnv` · `repoRoot` · `exists` · 비교 함수를 전부 주입받는다**. 즉 perf-spec 이
이 진입점을 쓰려면 매 spec 이 스스로 `process.env` 를 읽고, repo root 를 계산하고,
`baselineFileExists` 를 호출하고, `readCompareBaselineFile` 을 넘겨야 한다 — 배선 slice 가
5 개 spec 에 그 4 줄을 각자 적는 순간 repo root 계산식과 존재 조회 시점이 spec 마다 갈린다.

본 task 는 그 **기본값 결선 한 겹**만 책임진다 — 실 환경 바인딩(전역 환경변수 · 모듈 위치 기반
repo root · `fs` 존재 조회 · 기본 비교 함수)을 모듈 1 개로 모아, 배선 slice 의 spec 당 변경을
호출 1 줄로 줄인다. **판정 · 조립 · 로그 · 경로 계산은 전량 위임**이라 신규 판정 로직이 0 이고,
토글이 꺼져 있으면 `fs` 조회 자체를 하지 않는다. 기준 파일이 없어도 **write 는 일어나지
않는다**(ADR-0056 `§Decision 2` — 체크인 디렉토리에 자기 승인 `established` 분기 부재).

완료 선언 0 — [PLAN.md](../PLAN.md) `140~142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 1`(저장 위치는 `baseDir` 값 하나) · `§Decision 2`(갱신 주체 — CI 자동 write 비채택) · `§Decision 3 (b)`(관찰 비-fail · exit code 불변) · `§Follow-ups (b)`
- [test/perf/checkin-baseline-run.ts](../../test/perf/checkin-baseline-run.ts) — `CheckinBaselineRunInput` · `CheckinBaselineCompareFn` · `CheckinBaselineRunOutcome` · `runCheckinBaselineCheck` (조립 순서 재구현 금지 — 위임 대상)
- [test/perf/checkin-baseline-plan.ts](../../test/perf/checkin-baseline-plan.ts) — `isCheckinBaselineEnabled` · `CHECKIN_BASELINE_ENV_FLAG` (토글 판정 재구현 금지)
- [test/perf/checkin-baseline-store.ts](../../test/perf/checkin-baseline-store.ts) — `resolveCheckinBaselineDir(repoRoot)` (존재 조회용 baseDir 산출)
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) `178~192 행` (`readCompareBaselineFile` 시그니처 · 예외 계약) · `311~325 행` (`baselineFileExists(env, baseDir)` 동기 조회 · 부재는 예외 아닌 `false`) — 본 task 는 이 파일을 **수정하지 않는다**
- [test/perf/checkin-baseline-run.spec.ts](../../test/perf/checkin-baseline-run.spec.ts) — colocated spec 의 서술 · 케이스 배치 · `it.each` 병합 스타일 참조
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-110 ~ R-112 test 의무

## Acceptance Criteria

- [ ] 신규 파일 `test/perf/checkin-baseline-adapter.ts` 가 다음 4 개를 export 한다.
  - `resolveRepoRootFromPerfDir(perfDir: string): string` — `test/perf` 디렉토리 절대 경로에서 repo root 를 산출(`path.resolve(perfDir, "..", "..")`). `perfDir` non-string 은 `TypeError`, 빈 문자열·공백-only 는 `RangeError`.
  - `defaultCheckinRepoRoot(): string` — 위 함수에 본 모듈의 `__dirname` 을 넘겨 산출. **module load 시점 계산 금지**(호출 시점 계산 — 상수 export 아님).
  - `CheckinBaselineDefaultsInput` — `{ envMeta, candidate, options?, repoRoot?, processEnv?, compare? }`. `exists` 는 **입력에 없다**(본 모듈이 조회한다).
  - `runCheckinBaselineCheckWithDefaults(input): CheckinBaselineRunOutcome` — 반환 타입은 T-1563 의 union 을 **그대로 재사용**(재선언 금지).
- [ ] 결선 순서가 아래 그대로다(신규 판정 로직 0 — 전부 위임).
  1. `input` 이 object 가 아니거나 `null` 이면 `TypeError`.
  2. 기본값 결선 — `processEnv ?? process.env` · `repoRoot ?? defaultCheckinRepoRoot()` · `compare ?? readCompareBaselineFile`. 명시 값이 있으면 그 값이 우선한다.
  3. `isCheckinBaselineEnabled(processEnv)` 가 `false` 면 `exists` 를 `false` 로 두고 **`fs` 조회를 하지 않는다**(토글 off 국면의 부작용 0).
  4. `true` 면 `exists = baselineFileExists(envMeta, resolveCheckinBaselineDir(repoRoot))`.
  5. `runCheckinBaselineCheck({ processEnv, envMeta, repoRoot, exists, candidate, options }, compare)` 반환을 **가공 없이 그대로** 낸다.
- [ ] 위임 예외는 **래핑 없이 그대로 전파** — 판정 helper(`TypeError`/`RangeError`) · 경로 helper · `baselineFileExists` · 주입/기본 비교 함수(`Error`(`ENOENT` 계열) · `SyntaxError`) 전부.
- [ ] **write 부재** — 본 모듈에 `writeBaselineFile` · `confirmOrCompareBaseline` · `fs.writeFileSync` · `mkdir` 계열 호출이 **0 건**이다(ADR-0056 `§Decision 2`). `grep -n "write\|mkdir\|confirmOrCompare" test/perf/checkin-baseline-adapter.ts` 결과에 호출이 없다(주석 언급은 무방).
- [ ] **exit code 불변** — `comparison.regressed === true` 인 비교 결과에도 throw 하지 않고 `status: "compared"` · `regressed: true` 를 낸다(ADR-0056 `§Decision 3 (b)`).
- [ ] colocated spec `test/perf/checkin-baseline-adapter.spec.ts` 가 happy-path 를 cover — (a) 토글 on + 임시 repo root 아래 baseline 파일 **존재** + 주입 `compare` mock → `status: "compared"` 와 `regressed` 전달, (b) 토글 on + 파일 **부재** → `skipped`/`absent`, (c) 토글 **off** → `skipped`/`disabled`. 세 국면 모두 `log` 가 체크인 로그 prefix 로 시작한다.
- [ ] error path test 1+ — (a) `input` non-object·`null` 시 `TypeError`, (b) `envMeta.label` 무효로 위임 helper 가 던지는 `TypeError`/`RangeError` 가 그대로 전파, (c) `repoRoot` 를 빈 문자열로 **명시** 하면 경로 helper 예외가 그대로 전파, (d) 주입 `compare` 가 throw(`Error` · `SyntaxError`) 하면 래핑 없이 전파, (e) `resolveRepoRootFromPerfDir` 의 non-string `TypeError` · 공백-only `RangeError`.
- [ ] 분기 cover — 토글 on/off × 파일 존재/부재 4 갈래 각 1+, `repoRoot` 명시/미지정 각 1+, `processEnv` 명시/미지정 각 1+(미지정 시 전역 환경변수를 쓰되 테스트 종료 시 원복), `compare` 명시/미지정 각 1+(미지정 국면은 임시 repo root 에 유효 baseline JSON 을 두고 기본 비교 함수가 실제로 파일을 읽어 `compared` 를 내는지 확인), `options` 지정/미지정 각 1+(지정 시 비교 함수의 4 번째 인자로 그대로 전달), `regressed` true/false 각 1+.
- [ ] negative cases 충분 cover — (a) `skip` 두 국면에서 비교 함수 호출 횟수 **0**, (b) 토글 off 국면에서 `fs.existsSync` 호출 횟수 **0**(spy 로 검증), (c) 어떤 국면에서도 baseline 파일이 **생성되지 않음**(호출 전후 `test/perf/baselines` 디렉토리 내용 불변 — 부재 국면에서도 디렉토리·파일 미생성), (d) `compared` 국면에서 비교 함수 호출 횟수가 정확히 **1**, (e) 같은 입력 반복 호출이 항상 같은 결과(결정성) 이고 `input` · `candidate` 객체를 변형하지 않음(입력 불변), (f) `defaultCheckinRepoRoot()` 가 절대 경로이며 그 아래 `test/perf` 가 실재함(경로 계산이 cwd 가 아니라 모듈 위치 기반임을 확인 — cwd 를 바꿔도 값이 같다).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 총 diff ≤ 300 LOC / 변경 파일 ≤ 2 개 유지 — 초과 우려 시 JSDoc 을 간결히 하고 spec 의 유사 케이스를 `it.each` 로 묶되 위 R-112 4 종은 전부 남긴다.

## Out of Scope

- 기존 measure→confirm perf-spec(slice 25~29) 5 개에 본 어댑터를 실제로 호출하는 배선 — 다음 slice.
- `.github/workflows/ci.yml` 편집 — ADR-0056 `§Decision 4` 는 기존 `perf test` step 재사용이라 workflow 변경 자체가 불필요.
- 체크인 baseline JSON 파일의 실제 생성·commit(`test/perf/baselines/` 디렉토리 · `.gitkeep` 포함) — ADR-0056 `§Follow-ups (a)`, 실측 + 사람 눈 확인이 전제인 별도 task.
- `test/perf/latency-baseline.ts` · `latency-baseline-io.ts` · `checkin-baseline-store.ts` · `checkin-baseline-report.ts` · `checkin-baseline-plan.ts` · `checkin-baseline-run.ts` 수정 — 전부 위임 대상이며 재구현 0.
- 비교 tolerance 기본값 변경 · 절대 임계(`assertS2Threshold`) 손질 — ADR-0056 `§Decision 3 (a)` 현행 유지.
- `scripts/daily-test.sh` leg 추가 및 그에 딸린 drift-guard smoke spec 동반 수정 — 파일 수가 cap 을 넘긴다(Q-0054 선례).
- 부하계획 `§ 3` 임계 수치 확정 · `§ 5` 본문 갱신 · PLAN `140~142 행` · REQ-048 재판정 — 별도 doc-sync task(완료 선언 0 유지).
- slice 30(남은 route 축) 신규 perf-spec 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 요약 (2026-08-11)

`pr` mode PR **#1245** squash merge `f6941358` — **2 파일 `+296/-0`**(cap `300 LOC / 5 파일`
이내). `test/perf/checkin-baseline-adapter.ts` 4 종 export(`resolveRepoRootFromPerfDir` ·
`defaultCheckinRepoRoot` · `CheckinBaselineDefaultsInput` · `runCheckinBaselineCheckWithDefaults`) +
colocated spec 18 case(happy 3 국면 · error 5 종 · 토글×존재 4 갈래 · repoRoot/processEnv/compare/
options 명시·미지정 · regressed true/false · negative 6 종). 기본값 결선 = `process.env` ·
모듈 위치 기반 repo root · `readCompareBaselineFile` 이며, **토글 on 일 때만** `baselineFileExists`
를 조회한 뒤 T-1563 조립 진입점에 위임한다(반환 가공 0 · write 국면 0).

**신규 판정 로직 0** · **부작용 최소** — 토글 off 면 `fs.existsSync` 호출 **0 회**(spy 검증),
어떤 국면에서도 파일 · 디렉토리 미생성, 위임 예외는 래핑 없이 전파, `regressed=true` 여도
throw 0(ADR-0056 `§Decision 3 (b)` 관찰 비-fail 유지).

4-게이트 충족 — reviewer APPROVE(round 1) PR comment 외화 + integrator 자체 점검 +
PR CI 2 job(`기본 검사` 5m00s · `배포 산출물 검증` 1m17s) pass(run `31475369012`) + squash merge.
R-110/R-112 — unit 전량 **434 suite / 12441 test** pass, `test:cov` line·function 임계 80% 통과.
**완료 선언 0 유지** — PLAN · REQ-048 상태 미변경, `ci.yml` 편집 **0** · baseline JSON 생성 **0** ·
기존 perf-spec 배선 **0**(Out of Scope 전부 보존).
