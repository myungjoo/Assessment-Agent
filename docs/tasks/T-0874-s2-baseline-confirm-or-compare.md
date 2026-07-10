---
id: T-0874
title: S2 latency baseline confirm-or-compare 오케스트레이션 harness 신설 (confirmOrCompareBaseline)
phase: P8
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 135
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline-io.ts
  - test/perf/latency-baseline-io.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — baselineFileExists→(부재 write / 존재 readCompare) confirm-or-compare 오케스트레이션. disk io primitive 6종 위 실 harness 진입점. R-112 backbone×1.5 → est 135."
---

# T-0874 — S2 latency baseline confirm-or-compare 오케스트레이션 harness 신설 (confirmOrCompareBaseline)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "**최초 실측으로 baseline 을 확정**하고 candidate(새 측정)와 비교해 회귀를 탐지"하는 실 harness 를 요구한다("baseline 후 fix" 임계를 실 수치로 확정 — §3 표). 앞선 slice 들이 이 harness 가 조립할 disk io primitive 를 모두 갖췄다: 경로 결정(`resolveBaselinePath`), write(`writeBaselineFile`), read(`readBaselineFile`), compose 3종(`readCompareBaselineFile` 기준-only-disk / `compareBaselineFiles` both-disk / `compareBaselineJson` both-JSON), 그리고 존재 predicate(`baselineFileExists`, T-0873).

§5 #5 의 "최초 실측으로 baseline 확정" = **first-run write**, 이후 = **compare** 라는 두 국면은 결국 **"기준 baseline 파일이 이미 확정 저장돼 있는가?"** 를 판정해 (a) **없으면** candidate 를 기준으로 **최초 확정 write** 하고 (b) **있으면** 로드해 **비교** 하는 **confirm-or-compare 오케스트레이션**으로 귀결된다. 그 선행 precondition 인 `baselineFileExists` 가 T-0873 으로 안착했으므로, 본 slice 는 그 predicate 를 write/compose primitive 와 얇게 조립해 **실 harness 진입점 `confirmOrCompareBaseline(env, baseDir, candidate, options?)`** 를 io 모듈에 박제한다:

```
if (baselineFileExists(env, baseDir))  → readCompareBaselineFile(env, baseDir, candidate, options)  // 존재: 로드·비교
else                                   → writeBaselineFile(candidate, env, baseDir)                 // 부재: 최초 확정 write
```

반환은 두 국면을 구별하는 **discriminated union** 으로, 호출측(§5 #5 실 harness / CI step)이 "이번이 최초 확정이었나, 비교였나"를 결정적으로 분기할 수 있게 한다. 이 함수가 있으면 후속 실 harness·CI job 은 measure→confirmOrCompare 한 줄로 baseline 확정/회귀탐지 양쪽을 흡수한다.

## 설계 요지

- **기존 모듈 `test/perf/latency-baseline-io.ts` 에 함수 추가** — 신규 파일 신설 없이 io 함수 목록 끝(`baselineFileExists` 옆)에 오케스트레이션을 추가한다. 필요한 import(`baselineFileExists`·`writeBaselineFile`·`readCompareBaselineFile`·`BaselineEnvMeta`·`BaselineReport`·`BaselineComparison`·`CompareOptions`)는 대부분 이미 존재하며, 부족한 타입만 기존 `./latency-baseline` import 목록에 추가한다.
- **반환 타입 — discriminated union** — 두 국면을 `outcome` 판별자로 구별한다:
  ```ts
  export type ConfirmOrCompareResult =
    | { outcome: "established"; path: string }
    | { outcome: "compared"; comparison: BaselineComparison; report: string };
  ```
  - `"established"` — baseline 이 부재라 candidate 를 기준으로 최초 확정 write 한 경우. `path` 는 `writeBaselineFile` 이 반환한 쓴 파일 전체 경로.
  - `"compared"` — baseline 이 존재해 로드·비교한 경우. `{ comparison, report }` 는 `readCompareBaselineFile` 반환을 그대로 전달(회귀 여부는 `comparison.regressed`).
- `confirmOrCompareBaseline(env, baseDir, candidate, options?): ConfirmOrCompareResult` — 절차(신규 판정·계산 0 — 하위 primitive 를 조립만):
  1. `baselineFileExists(env, baseDir)` 로 기준 baseline 존재 여부를 판정한다(경로 결정 단계 예외 `TypeError`/`RangeError` 는 그대로 전파 — fs 접근 전 부작용 0).
  2. **부재 분기** — `false` 면 `writeBaselineFile(candidate, env, baseDir)` 로 최초 확정 write, `{ outcome: "established", path }` 반환(candidate 형태 불량 → 직렬화 `TypeError` 전파).
  3. **존재 분기** — `true` 면 `readCompareBaselineFile(env, baseDir, candidate, options)` 로 로드·비교, `{ outcome: "compared", comparison, report }` 반환(파일 부재 `ENOENT`·내용 불량 `SyntaxError`/`TypeError`·tolerance 무효 `RangeError` 등 하위 예외 그대로 전파).
- **순서 계약** — 존재 판정(순수 경로 결정 + read-only `existsSync`)을 write/compare **전에** 완료한다. `baselineFileExists` 가 throw 하면 write·compare 가 일어나지 않는다.
- **판정·io 위임 불변** — 존재 판정은 `baselineFileExists`, write 부작용은 `writeBaselineFile`, 로드·비교·포맷은 `readCompareBaselineFile` 에 전적으로 위임한다(재구현 금지 — DRY). 본 함수는 predicate → 분기 → (write | readCompare) 의 얇은 조립만 책임진다.
- **관찰·리포트 전용** — `assertS2Threshold`/collector·metrics 판정 로직 불변. 본 오케스트레이션은 baseline 확정/회귀 탐지 관찰 용도이며 S2 pass/fail 임계를 바꾸지 않는다(회귀 여부는 `comparison.regressed` 로 관찰만 노출, throw 하지 않음).
- **동기 fs 사용** — 하위 primitive 가 동기(`*Sync`)이므로 async 미도입, 결정성 유지.
- **신규 dependency 0** — `fs` builtin 및 기존 io/primitive 함수만 사용. 새 외부 dep 추가 없음.

## Required Reading

- `test/perf/latency-baseline-io.ts` — `writeBaselineFile`(66행)·`readBaselineFile`(117행)·`readCompareBaselineFile`(174행)·`compareBaselineFiles`(247행)·`baselineFileExists`(307행)이 이미 있는 io 모듈. import 패턴(`fs`/`path` builtin + `./latency-baseline` primitive)·"경로 결정(순수, 예외 시 fs 접근 0) 을 fs 접근 **전에** 완료" 순서 계약·하위 예외 그대로 전파 컨벤션·동기 `*Sync` 통일·JSDoc 스타일을 그대로 따른다. 본 task 는 이 모듈에 오케스트레이션 1개를 **추가**하며, 특히 `readCompareBaselineFile`(174행~)의 `{ comparison, report }` 반환 형태와 `baselineFileExists`(307행~)의 predicate 계약을 조립 재료로 삼는다.
- `test/perf/latency-baseline.ts` — 재사용할 타입: `BaselineEnvMeta`, `BaselineReport`, `BaselineComparison`(164행~ — `regressed: boolean` 종합 회귀 플래그 포함), `CompareOptions`. 본 task 는 이를 **import 만** 하고 순수 primitive 파일에 새 함수를 추가하지 않는다(순수 primitive 파일 오염 금지).
- `docs/ops/load-resilience-test-plan.md` §5 #5(baseline 확정 + 임계 fix, 122행~) + §3 표(74행~, S2 "baseline 후 fix (관찰용)") — first-run write / 이후 compare 두 국면의 근거, 관찰 전용 성격.
- `test/perf/README.md` §"disk io harness (`latency-baseline-io.ts`)" 절(42행~, `baselineFileExists` 항목 50행) — 오케스트레이션 항목 1~2줄을 io 함수 목록 끝에 추가할 위치.
- `test/perf/latency-baseline-io.spec.ts` — `writeBaselineFile`/`readBaselineFile`/`baselineFileExists` 등의 colocated spec. 임시 디렉토리 셋업/정리(`fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-io-"))` + `afterEach` 재귀 삭제) 패턴과, `writeBaselineFile` 로 기준을 먼저 저장한 뒤 상태를 확인하는 셋업 관용구, `fullReport()`/`fullEnv()` 같은 fixture helper 를 그대로 재사용해 오케스트레이션 spec 을 같은 파일 끝에 추가한다.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline-io.ts` 모듈에 `ConfirmOrCompareResult` 판별 union 타입(`"established"`|`"compared"`)과 `confirmOrCompareBaseline(env, baseDir, candidate, options?): ConfirmOrCompareResult` 함수를 export 추가. `baselineFileExists` → 분기 → (`writeBaselineFile` | `readCompareBaselineFile`) 조립으로 구현. 존재 판정·write·compare 로직 재구현 금지(전적 위임 DRY), fs builtin·기존 io 함수만 사용(신규 dep 0), 기존 io 함수(`writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile`/`compareBaselineFiles`/`baselineFileExists`)·순수 primitive 서명 변경 0.
- [ ] Happy-path unit test 1+ — 격리된 임시 디렉토리에서 (1) **최초 확정 분기**: 아직 baseline 이 없는 (env, baseDir) 에 `confirmOrCompareBaseline` 호출 시 `outcome === "established"` 이고 `path` 가 `resolveBaselinePath(env, baseDir)` 와 일치하며 실제 파일이 생성됨을 assert, (2) **비교 분기**: 그 직후 같은 (env, baseDir) 에 다시 호출 시 `outcome === "compared"` 이고 `comparison`·`report` 가 존재하며 동일 리포트 재비교 시 `comparison.regressed === false`(자기 비교 → 회귀 0) 임을 assert. 각 test 는 `afterEach`/`afterAll` 에서 임시 디렉토리를 정리한다.
- [ ] Error path unit test 1+ — 각 예외가 부작용 없이 그대로 전파됨을 검증: (1) `env` 형태 불량(예: `null`) → 경로 결정 primitive `TypeError` 전파(존재 판정·write·compare 미도달, 파일 미생성), (2) `env.label` 이 빈/공백-only 라 slug 가 비면 → `RangeError` 전파, (3) `baseDir` 빈/공백-only → `RangeError` 전파, (4) 존재 분기에서 저장 파일 내용을 손상시킨 뒤 호출 시 `readCompareBaselineFile` 경유 `SyntaxError`/`TypeError` 전파(래핑 없이 그대로).
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) baseline 부재 → `"established"` write 분기, (2) baseline 존재 → `"compared"` readCompare 분기, (3) 경로 결정 단계(env·baseDir 예외)에서 존재 판정 전에 실패하는 분기. `outcome` 판별자별로 반환 shape(`path` vs `comparison`/`report`)가 배타적으로 채워짐을 describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: `env`=`undefined` → `TypeError` 전파, `baseDir`=`undefined` → `TypeError`/`RangeError` 전파(하위 계약대로), 비교 분기에서 회귀가 있는 candidate(예: p95 tolerance 초과 증가)를 넘기면 `outcome === "compared"` 이면서 `comparison.regressed === true` 를 반환(예외 아님 — 관찰 전용, throw 하지 않음) 을 assert, 존재하던 baseline 파일을 제거한 뒤 다시 호출하면 `"compared"` → `"established"` 로 국면이 전이됨(존재→부재 전이 반영)을 assert, `options` 미지정 시 `readCompareBaselineFile` 기본 tolerance 로 위임됨을 assert.
- [ ] `test/perf/README.md` 의 disk io harness 절에 오케스트레이션(`confirmOrCompareBaseline`) 항목 1~2줄을 io 함수 목록 끝에 추가(`baselineFileExists` → 분기 → `writeBaselineFile`(부재:`"established"`+path) | `readCompareBaselineFile`(존재:`"compared"`+comparison/report) 조립·판별 union 반환·판정/io 위임(DRY)·순서 계약·하위 예외 그대로 전파·관찰 전용(회귀는 `comparison.regressed` 로 노출만·throw 안 함)·§5 #5 실 harness 진입점 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- 실 measure loop(supertest 반복 호출로 실 latency 수집 → `buildBaselineReport` 로 candidate 조립) 구현 — §5 #2("S2 조회 latency 경량 harness") 별도 slice. 본 task 는 confirm-or-compare 오케스트레이션 1개만 추가하고, candidate 는 in-memory `BaselineReport` 로 받는다(측정은 호출측 책임).
- 실 baseline 디렉토리 레이아웃 확정·commit(repo 에 baseline JSON 파일 체크인), CI job 편입(부하 harness workflow §5 #4), 실 Postgres 실측·§3 "baseline 후 fix" 임계 실수치 확정 — 전부 별도 follow-up(§5 #4·#5).
- `writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile`/`compareBaselineFiles`/`baselineFileExists` 재수정·서명 변경 — 이미 T-0869~T-0873 로 main 안착. 본 task 는 오케스트레이션 1개만 추가하고 기존 함수는 조립 재료·spec 셋업으로만 재사용.
- `resolveBaselinePath`/`resolveBaselineFilename`/`parseBaselineReport`/`serializeBaselineReport`/`compareBaselineReports`/`formatComparisonReport`/`compareBaselineJson`/`buildBaselineReport`/`assertS2Threshold`/collector·metrics 판정·계산·서명 변경 금지 — 본 task 는 io 모듈에 오케스트레이션 1개만 추가하고 기존 순수 primitive 는 import 만 한다.
- 존재 판정·write·compare 로직 재구현 금지 — 전적으로 `baselineFileExists` + `writeBaselineFile` + `readCompareBaselineFile` 위임(DRY).
- 회귀 발견 시 throw / process.exit / assertion 금지 — 본 함수는 관찰 전용으로 `comparison.regressed` 를 반환 union 에 노출만 하고 pass/fail 을 강제하지 않는다(임계 강제는 별도 assertS2Threshold 책임).
- async/Promise fs API 도입 금지 — 기존 동기 스타일과 통일(`*Sync`).
- 신규 외부 dependency 추가 금지(Node builtin `fs`/`os`/`path` + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: `confirmOrCompareBaseline` 를 실 measure loop(§5 #2 supertest 반복 → `buildBaselineReport`)과 배선한 end-to-end S2 harness slice / 실 baseline JSON 파일을 repo 에 확정·체크인 / 부하 harness CI job 편입 §5 #4 / §3 "baseline 후 fix" 임계 실수치 확정 §5 #5)
