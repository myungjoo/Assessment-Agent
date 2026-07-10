---
id: T-0873
title: S2 latency baseline 파일 존재 여부 predicate 신설 (baselineFileExists)
phase: P8
status: DONE
completedAt: 2026-07-10T02:53:00Z
mergedAs: bbfb1bca3ffbc32e7a15e4b3b749fa1874b03f76
prNumber: 767
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 105
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline-io.ts
  - test/perf/latency-baseline-io.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — resolveBaselinePath+fs.existsSync 로 baseline 파일 존재 predicate. confirm-or-compare 오케스트레이션의 선행 precondition slice. R-112 backbone×1.5 → est 105."
---

# T-0873 — S2 latency baseline 파일 존재 여부 predicate 신설 (baselineFileExists)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "최초 실측으로 baseline 을 확정하고 candidate(새 측정)와 비교해 회귀를 탐지"하는 실 harness 를 요구한다. 앞선 slice 들이 compose surface 3 종(both in-memory JSON `compareBaselineJson` / 기준만 disk `readCompareBaselineFile` / 양쪽 disk `compareBaselineFiles`)과 디스크 io(`writeBaselineFile`/`readBaselineFile`)를 갖췄다.

§5 #5 의 실 harness 는 결국 **"기준 baseline 파일이 이미 확정 저장돼 있는가?"** 를 판정해 (a) 없으면 candidate 를 기준으로 **최초 확정 write**, (b) 있으면 로드해 **비교**하는 **confirm-or-compare 오케스트레이션**으로 귀결된다(§5 #5 "최초 실측으로 baseline 을 확정" = first-run write, 이후 compare). 그 오케스트레이션의 **선행 precondition** 은 baseline 파일의 존재 여부를 결정적으로 판정하는 predicate 다. 본 slice 는 그 최소 primitive `baselineFileExists(env, baseDir): boolean` 를 io 모듈에 박제한다: `resolveBaselinePath(env, baseDir)` 로 경로를 결정한 뒤 `fs.existsSync` 로 존재 여부를 boolean 으로 반환한다. 경로 규약은 `resolveBaselinePath` 에 전적 위임(DRY)하고, 경로 결정 단계의 형태·빈값 예외(`TypeError`/`RangeError`)는 그대로 전파한다. 이 predicate 가 있으면 후속 confirm-or-compare harness 는 `if (baselineFileExists(...)) { readBaselineFile → compare } else { writeBaselineFile }` 분기를 얇게 조립할 수 있다.

## Required Reading

- `test/perf/latency-baseline-io.ts` — `writeBaselineFile`(66행)·`readBaselineFile`(117행)·`readCompareBaselineFile`(174행)·`compareBaselineFiles`(247행)이 이미 있는 io 모듈. import 패턴(`fs`/`os`/`path` builtin + `latency-baseline` 순수 primitive)·순서 계약(경로 결정→fs 접근)·하위 예외 그대로 전파 컨벤션·동기 `*Sync` 통일을 그대로 따른다. 본 task 는 이 모듈에 predicate 1개를 **추가**하며, 특히 `readBaselineFile`(117행~)의 "경로 결정(순수, 예외 시 fs 접근 0) 을 fs 접근 **전에** 완료" 순서 계약과 JSDoc 스타일을 참조 모델로 삼는다.
- `test/perf/latency-baseline.ts` — 재사용할 순수 primitive: `BaselineEnvMeta` 타입, `resolveBaselinePath(env, baseDir)`(경로 결정 — env 형태 불량 `TypeError`, baseDir 빈/공백 `RangeError`). 본 task 는 이를 **import 만** 하고 새 함수를 추가하지 않는다(순수 primitive 파일 오염 금지).
- `docs/ops/load-resilience-test-plan.md` §5 #5 — baseline 확정 + candidate 비교로 회귀 탐지 harness 맥락(confirm-or-compare 오케스트레이션의 선행 precondition 근거).
- `test/perf/README.md` §"disk io harness (`latency-baseline-io.ts`)" 절(42행~, `compareBaselineFiles` 항목 49행) — predicate 항목 1~2줄을 io 함수 목록 끝에 추가할 위치.
- `test/perf/latency-baseline-io.spec.ts` — `writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile`/`compareBaselineFiles` 의 colocated spec. 임시 디렉토리 셋업/정리(`os.tmpdir()` 하위 test-unique dir + `afterEach`/`afterAll` 정리) 패턴과, `writeBaselineFile` 로 기준을 먼저 저장한 뒤 존재를 확인하는 셋업 관용구를 그대로 재사용해 predicate spec 을 같은 파일에 추가한다.

## 설계 요지

- **기존 모듈 `test/perf/latency-baseline-io.ts` 에 함수 추가** — 신규 파일 신설 없이 io 함수 목록 끝(`compareBaselineFiles` 옆)에 predicate 를 추가한다. 필요한 import(`resolveBaselinePath` + `BaselineEnvMeta` + `fs` builtin)는 이미 존재하므로 추가 불요.
- `baselineFileExists(env: BaselineEnvMeta, baseDir: string): boolean` — baseline 파일이 확정 저장돼 있는지 판정한다:
  1. `resolveBaselinePath(env, baseDir)` 로 baseline 파일의 전체 경로를 결정한다(env 형태 불량 `TypeError`, baseDir 빈/공백-only `RangeError` 는 그대로 전파 — 경로 결정 단계 예외는 fs 접근 전이라 부작용 0).
  2. `fs.existsSync(path)` 로 그 경로의 존재 여부를 boolean 으로 반환한다.
- **순서 계약** — 경로 결정(순수, 예외 시 fs 접근 0)을 `fs.existsSync` **전에** 완료하므로 primitive 예외(`TypeError`/`RangeError`)는 부작용 없이 그대로 전파된다. `readBaselineFile`/`compareBaselineFiles` 와 동형.
- **write/read 짝과의 대칭** — `writeBaselineFile`(경로 결정→write)·`readBaselineFile`(경로 결정→read)이 같은 경로 규약을 쓰므로, `baselineFileExists` 도 동일 `resolveBaselinePath` 를 써 "쓴 파일은 존재로, 안 쓴 파일은 부재로" 판정한다(round-trip 정합: `writeBaselineFile` 후 `baselineFileExists`===true, write 전 false).
- **신규 판정·계산 0** — 경로 규약은 전적으로 `resolveBaselinePath` 에 위임(재구현 금지 — DRY). 본 함수는 경로 결정 → `existsSync` 의 얇은 조립만 책임진다.
- **관찰·리포트 전용** — `assertS2Threshold`/collector·metrics 판정 로직 불변. 본 predicate 는 baseline 파일 존재 판정 용도이며 S2 pass/fail 임계를 바꾸지 않는다.
- **동기 fs 사용** — 기존 io 모듈이 동기 스타일(`*Sync`)이므로 async 미도입, 결정성 유지.
- **부작용 0** — `fs.existsSync` 는 read-only 조회. 파일·환경 변경 없음. 신규 dependency 0(`fs` builtin). `latency-baseline.ts`·기존 io 함수 서명·collector/metrics 판정 변경 0.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline-io.ts` 모듈에 `baselineFileExists(env, baseDir): boolean` 함수를 export 추가. `resolveBaselinePath(env, baseDir)` 로 경로 결정 → `fs.existsSync(path)` 반환 으로 조립. 경로 규약 재구현 금지(전적 위임), fs builtin 만 사용(신규 dep 0), 기존 io 함수(`writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile`/`compareBaselineFiles`)·순수 primitive 서명 변경 0.
- [ ] Happy-path unit test 1+ — 격리된 임시 디렉토리에 `writeBaselineFile` 로 baseline 을 저장한 뒤 `baselineFileExists(env, baseDir)` 가 `true` 를 반환함을 assert. 또한 아직 아무것도 쓰지 않은 (env, baseDir) 에 대해 `baselineFileExists` 가 `false` 를 반환함을 assert. 각 test 는 `afterEach`/`afterAll` 에서 임시 디렉토리를 정리한다.
- [ ] Error path unit test 1+ — 각 예외가 부작용 없이 그대로 전파됨을 검증: (1) `env` 형태 불량(예: `null`) → `resolveBaselinePath` 의 `TypeError` 전파(`existsSync` 미도달), (2) `env.label` 이 빈/공백-only 라 slug 가 비면 → `RangeError` 전파, (3) `baseDir` 빈/공백-only → `RangeError` 전파. 예외가 던져질 때 파일 시스템 조회·변경이 일어나지 않음(경로 결정 전 실패)을 명시.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) 경로가 존재하는 분기 → `true`, (2) 경로가 부재하는 분기 → `false`, (3) 경로 결정 단계(env·baseDir 예외)에서 `existsSync` 전에 실패하는 분기. spec describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: `env`=`undefined` → `TypeError` 전파, `baseDir`=`undefined` → `TypeError`/`RangeError` 전파(`resolveBaselinePath` 계약대로), 존재하지 않는 다중 depth 경로(상위 디렉토리 자체 부재)에 대해 `false` 반환(예외 아님 — `existsSync` 는 부재를 false 로 조회), `writeBaselineFile` 후 파일을 제거하면 다시 `false` 로 판정됨(존재→부재 전이 확인).
- [ ] `test/perf/README.md` 의 disk io harness 절에 predicate(`baselineFileExists`) 항목 1~2줄을 io 함수 목록 끝에 추가(`resolveBaselinePath`+`fs.existsSync` 조립·boolean 반환·경로 규약 위임(DRY)·경로 결정 예외 그대로 전파·`writeBaselineFile`/`readBaselineFile` 와 동일 경로 규약 공유(round-trip 정합)·confirm-or-compare 오케스트레이션의 선행 precondition·관찰 전용 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- confirm-or-compare 오케스트레이션 함수(파일 존재 시 로드·비교 / 부재 시 최초 write) 자체 구현 — 본 task 는 그 선행 predicate 1개만 추가하고, 오케스트레이션은 별도 follow-up slice(§5 #5).
- `writeBaselineFile`/`readBaselineFile`/`readCompareBaselineFile`/`compareBaselineFiles` 재수정·서명 변경 — 이미 T-0869~T-0872 로 main 안착. 본 task 는 predicate 1개만 추가하고 기존 함수는 spec 셋업으로만 재사용.
- 실 baseline 디렉토리 레이아웃 확정·commit(repo 에 baseline JSON 파일 체크인), CI job 편입(부하 harness workflow), 실 Postgres 실측·baseline 수치 fix — 전부 별도 follow-up(§5 #4·#5).
- `resolveBaselinePath` / `resolveBaselineFilename` / `parseBaselineReport` / `serializeBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `compareBaselineJson` / `buildBaselineReport` / `assertS2Threshold` / collector·metrics 판정·계산·서명 변경 금지 — 본 task 는 io 모듈에 predicate 1개만 추가하고 기존 순수 primitive 는 import 만 한다.
- 경로 규약·존재 판정 로직 재구현 금지 — 전적으로 `resolveBaselinePath` + `fs.existsSync` 위임(DRY).
- 경로 결정 예외를 친절히 래핑(커스텀 에러 메시지·null 반환 등) 금지 — 그대로 전파해 계약을 최소화한다. fs 접근 오류를 boolean 으로 흡수하는 것은 `existsSync` 의 본래 계약이므로 예외(부재=false)임에 유의.
- async/Promise fs API 도입 금지 — 기존 동기 스타일과 통일(`*Sync`).
- 신규 외부 dependency 추가 금지(Node builtin `fs`/`os`/`path` + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: `baselineFileExists` predicate + `writeBaselineFile`/`readBaselineFile`/compose 함수를 조립해 "파일 부재 시 최초 확정 write / 존재 시 로드·비교"하는 confirm-or-compare 오케스트레이션 harness slice(§5 #5 실 harness 핵심) / 실 baseline JSON 파일을 repo 에 확정·체크인 / 부하 harness CI job 편입 §5 #4)
