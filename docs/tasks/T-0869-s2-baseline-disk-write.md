---
id: T-0869
title: S2 latency baseline 디스크 write harness 함수 신설 (writeBaselineFile)
phase: P8
status: DONE
completedAt: 2026-07-09T23:58:21Z
mergedAs: e68c2c15
prNumber: 763
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline-io.ts
  - test/perf/latency-baseline-io.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #4·#5(baseline 확정 disk harness) — resolveBaselinePath+serializeBaselineReport 를 조립해 baseline JSON 을 디스크에 쓰는 첫 fs-touching 함수. T-0868 Out-of-Scope 'fs write' slice. R-112 backbone×1.5 → est 150."
---

# T-0869 — S2 latency baseline 디스크 write harness 함수 신설 (writeBaselineFile)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #4·#5 는 "baseline 확정 + 임계 fix"를 위해 저장 baseline 을 **디스크 harness** 로 읽고 쓰는 단계를 요구한다. 지난 8개 슬라이스(T-0861~T-0868)가 baseline harness 의 **순수 함수 primitive** 를 전부 신설했다: 리포트 조립·포맷(`buildBaselineReport`/`formatBaselineLine`), 회귀 비교(`compareBaselineReports`), JSON 영속화·복원(`serializeBaselineReport`/`parseBaselineReport`), 비교 결과 포맷(`formatComparisonReport`), 저장 JSON 합성 진입점(`compareBaselineJson`), 파일명 규약(`resolveBaselineFilename`), 그리고 직전 T-0868 이 baseDir + basename → 전체 경로 조립(`resolveBaselinePath`).

이제 이 primitive 들을 실제 **디스크에 쓰는** 첫 단계가 남았다 — T-0868 의 Out of Scope 가 명시했듯 "실제 파일 I/O(`fs` write/mkdir)"는 아직 없다. 본 slice 는 그 **write 방향**만 박제한다: `BaselineReport` 와 baseline 디렉토리(`baseDir`)를 받아, `resolveBaselinePath` 로 저장 경로를 결정하고 `serializeBaselineReport` 로 직렬화한 JSON 을 그 경로에 기록하되 상위 디렉토리가 없으면 생성한다. 순수 primitive(경로·직렬화)는 전적으로 재사용하고, 본 함수는 **fs 부작용(디렉토리 생성 + 파일 쓰기)만** 책임진다. read 방향(`readBaselineFile` = `fs.readFile` → `parseBaselineReport`)은 대칭 slice 로 별도 follow-up(temp-dir 셋업 spec 을 write/read 각각 집중시켜 diff·spec 을 작게 유지). 이후 실 baseline harness(§5 #5)가 measure 결과를 이 함수로 저장하고 다음 slice 의 read 함수로 로드해 `compareBaselineJson` 에 먹인다.

## Required Reading

- `test/perf/latency-baseline.ts` — 재사용할 순수 primitive: `BaselineReport`(38행) 타입, `serializeBaselineReport`(392행, 리포트 → 유효 JSON 문자열), `resolveBaselinePath`(774행, env+baseDir → 전체 경로). 본 task 는 이들을 import 만 하고 **여기에 새 함수를 추가하지 않는다**(순수 primitive 파일을 fs 로 오염 금지 — 신규 io 모듈 분리).
- `docs/ops/load-resilience-test-plan.md` §5 #4·#5 — 저장 baseline 로드→비교→리포트 harness 및 파일 저장·디렉토리 맥락.
- `test/perf/README.md` §"baseline 리포트 (`latency-baseline.ts`)" 절(24행~) — 새 io 함수 항목 1~2줄 추가할 위치.
- `test/perf/latency-baseline.spec.ts` (colocated spec 컨벤션 참고) — 신규 spec 은 새 파일 `test/perf/latency-baseline-io.spec.ts`(colocated, io 모듈 옆) 로 작성한다.

## 설계 요지

- **신규 모듈 `test/perf/latency-baseline-io.ts`** — fs 부작용을 순수 primitive 파일(`latency-baseline.ts`)에서 격리하기 위해 별도 모듈로 신설한다. `latency-baseline.ts` 의 `serializeBaselineReport`/`resolveBaselinePath`/`BaselineReport` 를 import.
- `writeBaselineFile(report: BaselineReport, env: BaselineEnvMeta, baseDir: string): string` — baseline 리포트를 디스크에 저장하고 **쓴 파일의 전체 경로**를 반환한다:
  1. `resolveBaselinePath(env, baseDir)` 로 저장 경로를 결정한다(env/baseDir 형태·빈값 예외는 `resolveBaselinePath` 계약대로 그대로 전파 — 재검증·중복 throw 금지).
  2. `serializeBaselineReport(report)` 로 리포트를 유효 JSON 문자열로 직렬화한다(리포트 형태 불량 예외는 그대로 전파).
  3. 저장 경로의 **상위 디렉토리를 재귀 생성**한다(`fs.mkdirSync(dir, { recursive: true })` 류 — 이미 있으면 no-op).
  4. 그 경로에 JSON 문자열을 **UTF-8 로 기록**한다(`fs.writeFileSync`). 기록 후 최종 경로 문자열을 반환한다.
- **순서 계약** — 경로 결정·직렬화(순수, 예외 시 fs 접근 0)를 **fs 접근 전에** 완료한다. 즉 `resolveBaselinePath`/`serializeBaselineReport` 가 throw 하면 디렉토리 생성·파일 쓰기가 일어나지 않는다(부작용 없이 실패).
- **경로 규약 위임 불변** — 저장 경로·파일명 규칙은 전적으로 `resolveBaselinePath`(→ `resolveBaselineFilename`)에 위임한다(재구현 금지 — DRY). 직렬화 규칙도 `serializeBaselineReport` 위임.
- **동기 fs 사용** — 기존 harness 가 순수·동기 스타일이므로 `*Sync` API 로 통일한다(async 도입 불요, 테스트 결정성 유지).
- **부작용 최소** — `fs` builtin 만 사용(신규 dependency 0). 기록 외 다른 파일·환경 변경 없음. `latency-baseline.ts` 및 collector/metrics 판정·서명 변경 0.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline-io.ts` 신규 모듈에 `writeBaselineFile(report, env, baseDir): string` 함수를 export 추가. `resolveBaselinePath(env, baseDir)` 로 경로 결정 → `serializeBaselineReport(report)` 로 직렬화 → 상위 디렉토리 재귀 생성 → UTF-8 파일 기록 → 최종 경로 반환. 경로 규약·직렬화 규칙 재구현 금지(전적 위임), fs builtin 만 사용(신규 dep 0).
- [ ] Happy-path unit test 1+ — 유효 (`report`, `env`, `baseDir`)이면 **격리된 임시 디렉토리**(예: `os.tmpdir()` 하위 test-unique dir) 에 baseline JSON 을 쓰고, 반환 경로가 `resolveBaselinePath(env, baseDir)` 와 일치하며, 그 파일을 읽어 `parseBaselineReport` 로 복원하면 원본 `report` 와 동치(round-trip, NaN 지표 포함)임을 assert. 각 test 는 `afterEach`/`afterAll` 에서 임시 디렉토리를 정리한다.
- [ ] Error path unit test 1+ — 각 예외가 **부작용 없이** 전파됨을 검증: (1) `env` 형태 불량(예: `null`) → `resolveBaselinePath` 의 `TypeError` 전파 + 파일 미생성, (2) `env.label` 빈/공백-only → `RangeError` 전파 + 파일 미생성, (3) `baseDir` non-string → `TypeError` + 파일 미생성, (4) `baseDir` 빈/공백-only → `RangeError` + 파일 미생성, (5) `report` 형태 불량(serialize 가 던지는 경우) → 그 예외 전파 + 파일 미생성. 각 case 에서 대상 경로에 파일이 생성되지 않았음을 fs 존재 검사로 assert.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) 상위 디렉토리가 **없는** 경우 재귀 생성 후 기록 성공, (2) 상위 디렉토리가 **이미 있는** 경우(사전 생성)에도 mkdir recursive 가 no-op 이고 기록 성공, (3) 같은 경로에 **두 번 write** 하면 파일이 덮어써져 마지막 report 가 남는 분기(overwrite 결정성).
- [ ] Negative cases 충분 cover — 각 1+ test: `env`=`undefined` → `TypeError` + 파일 미생성, `baseDir`=`undefined` → `TypeError` + 파일 미생성, 다중 세그먼트 `baseDir`(`a/b/c` 처럼 여러 depth 미존재) 도 재귀 생성으로 성공, 서로 다른 `env.label` 이 같은 `baseDir` 안에서 서로 다른 파일로 분리 저장됨을 검증.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 io 함수(`writeBaselineFile`) 항목 1~2줄 추가(신규 `latency-baseline-io.ts` 모듈, resolveBaselinePath+serializeBaselineReport 조립·상위 디렉토리 재귀 생성·UTF-8 write·경로 반환·fs 첫 접점·read 는 후속 slice 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- **read 방향**(`readBaselineFile` = `fs.readFile` → `parseBaselineReport`) 신설 — 대칭 slice 로 별도 follow-up(temp-dir spec 을 write/read 각각 집중). 본 task 는 write 만.
- 실 baseline 디렉토리 레이아웃 확정·commit(repo 에 baseline JSON 파일 체크인), CI job 편입(부하 harness workflow), 실 Postgres 실측·baseline 수치 fix — 전부 별도 follow-up(§5 #4·#5).
- `resolveBaselinePath` / `resolveBaselineFilename` / `serializeBaselineReport` / `parseBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `compareBaselineJson` / `buildBaselineReport` / `assertS2Threshold` / collector·metrics 판정·계산·서명 변경 금지 — 본 task 는 신규 io 모듈에 write 함수 1개만 추가하고 기존 순수 primitive 는 import 만 한다.
- 경로·파일명·직렬화 규칙 재구현 금지 — 전적으로 기존 primitive 위임(DRY).
- async/Promise fs API 도입 금지 — 기존 동기 스타일과 통일(`*Sync`).
- 절대경로 강제·플랫폼별 구분자 분기 도입 금지 — 경로 규약은 `resolveBaselinePath`(POSIX-결정적) 위임 그대로.
- 신규 외부 dependency 추가 금지(Node builtin `fs`/`os`/`path` + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: `readBaselineFile` read 방향 대칭 slice)
