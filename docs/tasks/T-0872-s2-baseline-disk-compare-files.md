---
id: T-0872
title: S2 latency baseline 양쪽-디스크 compare harness 함수 신설 (compareBaselineFiles)
phase: P8
status: DONE
commitMode: pr
prNumber: 766
mergedAs: aba9989633109b863c331f2b33eb4879ba90eef7
reviewRounds: 1
completedAt: 2026-07-10T02:23:00Z
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
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — 기준·candidate 둘 다 디스크 로드 compare. readCompareBaselineFile follow-up(file-input 변형)·compareBaselineJson 의 both-disk 짝. R-112 backbone×1.5 → est 135."
---

# T-0872 — S2 latency baseline 양쪽-디스크 compare harness 함수 신설 (compareBaselineFiles)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "최초 실측으로 baseline 을 확정하고 candidate(새 측정)와 비교해 회귀를 탐지"하는 실 harness 를 요구한다. 앞선 slice 들이 순수 비교(`compareBaselineReports`/`formatComparisonReport`/`compareBaselineJson`)·디스크 io(`writeBaselineFile`/`readBaselineFile`)·기준만 디스크에서 로드하는 compose(`readCompareBaselineFile` = 기준 disk + candidate in-memory)까지 갖췄다.

남은 조립 진입점은 **기준·candidate 를 둘 다 디스크에서 로드해 비교**하는 함수다. `readCompareBaselineFile`(T-0871)은 candidate 를 in-memory 로 받는 반면, 실 CI/배치 harness 는 (a) 확정 저장된 기준 baseline 파일 + (b) 별도 저장된 candidate baseline 파일 **둘 다 디스크에서** 로드해 비교하는 경로가 필요하다(예: 이전 run 과 새 run 을 각각 파일로 남긴 뒤 후속 스텝이 두 파일을 비교). 본 slice 는 그 both-disk 진입점 `compareBaselineFiles(baselineEnv, baselineDir, candidateEnv, candidateDir, options?)` 를 io 모듈에 박제한다: `readBaselineFile` ×2 로 두 baseline 을 로드 → `compareBaselineReports` → `formatComparisonReport` 로 `{ comparison, report }` 를 조립한다. 이는 T-0871 Follow-ups 가 명시한 **file-input 변형**이자 `compareBaselineJson`(both in-memory JSON)의 **both-disk 짝**으로, 이로써 compose surface 3 종(both in-memory JSON / 기준만 disk / 양쪽 disk)이 완성된다.

## Required Reading

- `test/perf/latency-baseline-io.ts` — `writeBaselineFile`·`readBaselineFile`·`readCompareBaselineFile`(기준 disk + candidate in-memory compose)이 이미 있는 io 모듈. import 패턴(`fs`/`path` builtin + `latency-baseline` 순수 primitive)·순서 계약(경로 결정→fs 접근→비교→포맷)·하위 예외 그대로 전파 컨벤션을 그대로 따른다. 본 task 는 이 모듈에 compose 함수 1개를 **추가**하며, 특히 `readCompareBaselineFile`(37~185행)의 조립 순서·반환 형태·JSDoc 스타일을 참조 모델로 삼는다.
- `test/perf/latency-baseline.ts` — 재사용할 순수 primitive: `BaselineReport`/`BaselineEnvMeta` 타입, `BaselineComparison`/`CompareOptions` 타입(`CompareOptions` = `latencyTolerance?`/`errorRateTolerance?`, 130~141행), `compareBaselineReports`(baseline↔candidate 비교, tolerance 음수·NaN 시 `RangeError`), `formatComparisonReport`(`BaselineComparison`→문자열), `compareBaselineJson`(조립 순서·반환 형태 `{ comparison, report }`·예외 propagate 컨벤션의 참조 모델). 본 task 는 이들을 **import 만** 하고 새 함수를 추가하지 않는다(순수 primitive 파일 오염 금지).
- `docs/ops/load-resilience-test-plan.md` §5 #5 — baseline 확정 + candidate 비교로 회귀 탐지 harness 맥락.
- `test/perf/README.md` §"disk io harness" 절(42행~, `readCompareBaselineFile` 항목 48행) — compose 함수 항목 1~2줄을 `readCompareBaselineFile` 항목 옆에 추가할 위치.
- `test/perf/latency-baseline-io.spec.ts` — `writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile` 의 colocated spec. 임시 디렉토리 셋업/정리(`os.tmpdir()` 하위 test-unique dir + `afterEach`/`afterAll` 정리) 패턴과, `writeBaselineFile` 로 기준을 먼저 저장한 뒤 로드해 비교하는 셋업 관용구를 그대로 재사용해 both-disk compose spec 을 같은 파일에 추가한다.

## 설계 요지

- **기존 모듈 `test/perf/latency-baseline-io.ts` 에 함수 추가** — 신규 파일 신설 없이 `readCompareBaselineFile` 옆에 compose 함수를 추가한다. 필요한 import(`readBaselineFile`(모듈 내부 함수) + `compareBaselineReports`/`formatComparisonReport`/`BaselineComparison`/`CompareOptions`/`BaselineEnvMeta`)는 이미 대부분 존재하므로 추가만.
- `compareBaselineFiles(baselineEnv: BaselineEnvMeta, baselineDir: string, candidateEnv: BaselineEnvMeta, candidateDir: string, options?: CompareOptions): { comparison: BaselineComparison; report: string }` — 기준·candidate 를 둘 다 디스크에서 로드해 비교한다:
  1. `readBaselineFile(baselineEnv, baselineDir)` 로 저장 기준 baseline 을 로드한다(env/baseDir 형태·빈값 예외 및 fs 오류(`ENOENT`)·파싱 예외는 `readBaselineFile` 계약대로 그대로 전파 — 재검증·중복 throw·친절한 래핑 금지).
  2. `readBaselineFile(candidateEnv, candidateDir)` 로 저장 candidate baseline 을 로드한다(동일 계약으로 예외 그대로 전파). **순서 계약** — 기준 로드가 throw 하면 candidate 로드가 일어나지 않는다(기준 먼저).
  3. 로드한 두 리포트를 `compareBaselineReports(baseline, candidate, options)` 로 비교한다(tolerance 음수/NaN 예외는 그대로 전파).
  4. `formatComparisonReport(comparison)` 로 사람-친화 리포트 문자열을 만들어 `{ comparison, report }` 로 반환한다.
- **`compareBaselineJson`·`readCompareBaselineFile` 과의 대칭** — `compareBaselineJson` 이 in-memory JSON 문자열 2개를, `readCompareBaselineFile` 이 기준만 디스크·candidate in-memory 를 받는 반면, 본 함수는 **양쪽 다 디스크에서 로드**한다. 반환 형태 `{ comparison, report }`·조립 순서(로드→비교→포맷)·하위 예외 propagate 컨벤션은 두 sibling 과 동형으로 맞춘다. 이로써 compose 진입점이 both-JSON / 기준-only-disk / both-disk 3 종으로 완성된다.
- **서로 다른 (env, dir) 지원** — 기준과 candidate 가 다른 label(예: 이전 run vs 새 run) 또는 다른 디렉토리에 저장될 수 있으므로 두 (env, dir) 쌍을 각각 받는다. 두 파일이 같은 경로여도 정상 동작(자기 자신과 비교 → 회귀 0).
- **신규 판정·계산 0** — 회귀 판정·delta 계산·임계는 전적으로 `compareBaselineReports` 에, 리포트 렌더링은 `formatComparisonReport` 에 위임한다(재구현 금지 — DRY). 본 함수는 read ×2 → compare → format 의 얇은 조립만 책임진다.
- **관찰·리포트 전용** — `assertS2Threshold`/collector·metrics 판정 로직 불변. 본 함수는 회귀 탐지 관찰·리포트 용도이며 S2 pass/fail 임계를 바꾸지 않는다.
- **동기 fs 사용** — 기존 io 모듈이 동기 스타일(`readBaselineFile` = `*Sync`)이므로 async 미도입, 결정성 유지.
- **부작용 최소** — `fs` builtin 만(신규 dependency 0). 디스크 read 외 파일·환경 변경 없음. `latency-baseline.ts`·`writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile` 서명·collector/metrics 판정 변경 0.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline-io.ts` 모듈에 `compareBaselineFiles(baselineEnv, baselineDir, candidateEnv, candidateDir, options?): { comparison, report }` 함수를 export 추가. `readBaselineFile(baselineEnv, baselineDir)` → `readBaselineFile(candidateEnv, candidateDir)`(기준 먼저) → `compareBaselineReports(baseline, candidate, options)` → `formatComparisonReport(comparison)` 로 조립. 회귀 판정·delta 계산·리포트 렌더링 재구현 금지(전적 위임), fs builtin 만 사용(신규 dep 0), `readBaselineFile`/`readCompareBaselineFile`/순수 primitive 서명 변경 0.
- [ ] Happy-path unit test 1+ — 격리된 임시 디렉토리에 `writeBaselineFile` 로 기준·candidate 두 baseline 을 각각 저장한 뒤(서로 다른 label 또는 dir), `compareBaselineFiles(baselineEnv, baselineDir, candidateEnv, candidateDir)` 를 호출하면 `compareBaselineReports(로드된 기준, 로드된 candidate)` 와 동치 `comparison` + `formatComparisonReport` 와 동치 `report` 를 반환함을 assert. 회귀 없는 candidate(예: 같은 파일 자기 비교) 와 회귀 있는 candidate(예: p95 tolerance 초과) 둘 다 최소 1회씩 — `comparison.regressed` 가 각각 false/true. 각 test 는 `afterEach`/`afterAll` 에서 임시 디렉토리를 정리한다.
- [ ] Error path unit test 1+ — 각 예외가 부작용 없이 그대로 전파됨을 검증: (1) `baselineEnv` 형태 불량(예: `null`) → `readBaselineFile`→`resolveBaselinePath` 의 `TypeError` 전파(candidate 로드·비교 시도 없음), (2) `baselineDir` 빈/공백-only → `RangeError` 전파, (3) 기준 파일 미저장(존재하지 않는 경로) → `readBaselineFile` 의 `ENOENT` 계열 fs 오류 전파(candidate 로드·비교 단계 미도달), (4) 기준은 저장됐으나 `candidateEnv` 형태 불량/`candidateDir` 빈 → candidate 로드 단계의 `TypeError`/`RangeError` 전파(비교 미도달), (5) candidate 파일 미저장 → candidate `readBaselineFile` 의 `ENOENT` 전파, (6) 저장된 기준 또는 candidate 파일 내용 불량(유효 JSON 아님/리포트 형태 불량) → `parseBaselineReport` 의 `SyntaxError`/`TypeError` 전파, (7) `options.latencyTolerance`/`errorRateTolerance` 음수/NaN → `compareBaselineReports` 의 `RangeError` 전파.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) 두 파일 모두 유효 로드 성공 → 비교·포맷 성공 분기(회귀 없음/있음 각각), (2) 기준 로드 단계(경로 예외·`ENOENT`·파싱 실패)에서 candidate 로드 전 실패하는 분기, (3) 기준은 성공하나 candidate 로드 단계에서 실패하는 분기, (4) 두 로드는 성공하나 비교 단계(tolerance 무효)에서 실패하는 분기. 분기가 위 흐름으로 구성됨을 spec describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: `baselineEnv`=`undefined` → `TypeError` 전파, `candidateEnv`=`undefined`(기준 로드 성공 후) → candidate 로드 `TypeError` 전파, `options` 미지정(default) 호출이 기본 tolerance 로 정상 동작(옵션 optional 확인), 기준·candidate 가 같은 (env, dir)(같은 파일 자기 비교)이면 `comparison.regressed`===false, NaN 지표(빈 표본) 포함 파일 비교 시 해당 지표가 판정 제외/회귀 표기로 방어되고 `report` 에 "n/a" 로 렌더링됨(하위 primitive 위임 정합 확인).
- [ ] `test/perf/README.md` 의 disk io harness 절에 compose 함수(`compareBaselineFiles`) 항목 1~2줄을 `readCompareBaselineFile` 항목 옆에 추가(`readBaselineFile`×2+`compareBaselineReports`+`formatComparisonReport` 조립·`{ comparison, report }` 반환·`compareBaselineJson` 의 both-disk 짝·`readCompareBaselineFile` 의 file-input 변형·기준 먼저 로드 순서 계약·하위 예외 그대로 전파·관찰 전용 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- `writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile` 재수정·서명 변경 — 이미 T-0869/T-0870/T-0871 로 main 안착. 본 task 는 compose 함수 1개만 추가하고 세 함수는 import·spec 셋업으로만 재사용.
- 실 baseline 디렉토리 레이아웃 확정·commit(repo 에 baseline JSON 파일 체크인), CI job 편입(부하 harness workflow), 실 Postgres 실측·baseline 수치 fix — 전부 별도 follow-up(§5 #4·#5).
- `resolveBaselinePath` / `resolveBaselineFilename` / `parseBaselineReport` / `serializeBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `compareBaselineJson` / `buildBaselineReport` / `assertS2Threshold` / collector·metrics 판정·계산·서명 변경 금지 — 본 task 는 io 모듈에 compose 함수 1개만 추가하고 기존 순수 primitive 는 import 만 한다.
- 회귀 판정·delta 계산·리포트 렌더링 규칙 재구현 금지 — 전적으로 기존 primitive 위임(DRY).
- 하위 예외를 친절히 래핑(커스텀 에러 메시지·null 반환 등) 금지 — 그대로 전파해 계약을 최소화한다.
- async/Promise fs API 도입 금지 — 기존 동기 스타일과 통일(`*Sync`).
- 신규 외부 dependency 추가 금지(Node builtin `fs`/`os`/`path` + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: compose surface 3 종(both-JSON/기준-only-disk/both-disk)을 조립해 실 baseline JSON 파일을 repo 에 확정·체크인하고 새 측정과 비교하는 §5 #5 실 harness slice / 부하 harness CI job 편입 §5 #4)
