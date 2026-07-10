---
id: T-0870
title: S2 latency baseline 디스크 read harness 함수 신설 (readBaselineFile)
phase: P8
status: DONE
completedAt: 2026-07-10T00:58:41Z
mergedAs: 502075f9adf58896112f4bd057797480075016d6
prNumber: 764
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
plannerNote: "P8 load-resilience §5 #4·#5(baseline 확정 disk harness) — writeBaselineFile 의 대칭 read 방향. fs.readFile→parseBaselineReport 조립. T-0869 Follow-up slice. R-112 backbone×1.5 → est 150."
---

# T-0870 — S2 latency baseline 디스크 read harness 함수 신설 (readBaselineFile)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #4·#5 는 "baseline 확정 + 임계 fix"를 위해 저장 baseline 을 **디스크 harness** 로 읽고 쓰는 단계를 요구한다. 직전 T-0869 가 write 방향(`writeBaselineFile` = `resolveBaselinePath` + `serializeBaselineReport` → `fs.mkdirSync`/`fs.writeFileSync`)을 신규 io 모듈 `test/perf/latency-baseline-io.ts` 에 박제했고, 그 Out of Scope·Follow-ups 가 **read 방향을 대칭 slice 로 명시**했다.

본 slice 는 그 read 방향만 박제한다: baseline 디렉토리(`baseDir`)와 env-meta(`env`)를 받아 `resolveBaselinePath` 로 저장 경로를 결정하고, 그 경로의 파일을 **UTF-8 로 읽어** `parseBaselineReport` 로 `BaselineReport` 로 복원한다. write 함수와 정확히 짝을 이뤄, `writeBaselineFile` 로 저장한 baseline 을 `readBaselineFile` 로 다시 로드하면 원본과 동치(round-trip, NaN 지표 포함)가 된다. 이후 실 baseline harness(§5 #5)가 measure 결과를 write 함수로 저장하고 본 read 함수로 로드해 `compareBaselineJson` 에 먹인다. 경로 규약·파싱 규칙은 전적으로 기존 primitive(`resolveBaselinePath`/`parseBaselineReport`)에 위임하고, 본 함수는 **fs read 부작용(파일 읽기)만** 책임진다.

## Required Reading

- `test/perf/latency-baseline-io.ts` — write 방향(`writeBaselineFile`)이 이미 있는 io 모듈. import 패턴(`fs`/`path` builtin + `latency-baseline` 순수 primitive)과 순서 계약(경로 결정→fs 접근) 컨벤션을 그대로 따른다. 본 task 는 이 모듈에 read 함수 1개를 **추가**한다.
- `test/perf/latency-baseline.ts` — 재사용할 순수 primitive: `BaselineReport`(38행) 타입, `BaselineEnvMeta` 타입, `resolveBaselinePath`(env+baseDir → 전체 경로), `parseBaselineReport`(438행, 유효 JSON 문자열 → `BaselineReport`, NaN sentinel 복원·형태 불량 시 throw). 본 task 는 이들을 **import 만** 하고 새 함수를 추가하지 않는다(순수 primitive 파일 오염 금지).
- `docs/ops/load-resilience-test-plan.md` §5 #4·#5 — 저장 baseline 로드→비교→리포트 harness 및 파일 저장·디렉토리 맥락.
- `test/perf/README.md` §"baseline 리포트" 절(24행~) 및 46행 부근(`writeBaselineFile` 항목) — read 함수 항목 1~2줄을 write 항목 옆에 추가할 위치.
- `test/perf/latency-baseline-io.spec.ts` — write 함수의 colocated spec. 임시 디렉토리 셋업/정리(`os.tmpdir()` 하위 test-unique dir + `afterEach`/`afterAll` 정리) 패턴을 그대로 재사용해 read spec 을 같은 파일에 추가한다.

## 설계 요지

- **기존 모듈 `test/perf/latency-baseline-io.ts` 에 함수 추가** — 신규 파일 신설 없이 write 함수 옆에 read 함수를 추가한다. `latency-baseline.ts` 의 `parseBaselineReport`/`resolveBaselinePath`/`BaselineReport`/`BaselineEnvMeta` 를 import(이미 일부 import 되어 있으면 추가만).
- `readBaselineFile(env: BaselineEnvMeta, baseDir: string): BaselineReport` — baseline 파일을 디스크에서 읽어 리포트로 복원한다:
  1. `resolveBaselinePath(env, baseDir)` 로 읽을 경로를 결정한다(env/baseDir 형태·빈값 예외는 `resolveBaselinePath` 계약대로 그대로 전파 — 재검증·중복 throw 금지).
  2. 그 경로의 파일을 **UTF-8 로 읽는다**(`fs.readFileSync(path, "utf8")`). 파일 부재 등 fs 오류(예: `ENOENT`)는 그대로 전파한다(존재 검사·친절한 래핑 금지 — 계약 최소화).
  3. 읽은 문자열을 `parseBaselineReport(json)` 로 `BaselineReport` 로 복원해 반환한다(JSON 형태 불량·리포트 형태 불량 예외는 그대로 전파).
- **순서 계약** — 경로 결정(순수, 예외 시 fs 접근 0)을 fs 접근 **전에** 완료한다. 즉 `resolveBaselinePath` 가 throw 하면 파일 읽기가 일어나지 않는다(부작용 없이 실패).
- **write 와의 round-trip 대칭** — `readBaselineFile(env, baseDir)` 는 `writeBaselineFile(report, env, baseDir)` 가 쓴 파일을 정확히 읽어 원본 `report` 와 동치(NaN 지표 포함)를 복원해야 한다(두 함수가 동일 `resolveBaselinePath` 경로 규약을 공유하므로 경로 일치 보장).
- **경로·파싱 규약 위임 불변** — 읽을 경로·파일명 규칙은 전적으로 `resolveBaselinePath`(→ `resolveBaselineFilename`)에, 역직렬화 규칙은 `parseBaselineReport` 에 위임한다(재구현 금지 — DRY).
- **동기 fs 사용** — 기존 io 모듈·harness 가 동기 스타일이므로 `*Sync` API 로 통일한다(async 미도입, 테스트 결정성 유지).
- **부작용 최소** — `fs` builtin 만 사용(신규 dependency 0). 읽기 외 다른 파일·환경 변경 없음. `latency-baseline.ts`·`writeBaselineFile`·collector/metrics 판정·서명 변경 0.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline-io.ts` 모듈에 `readBaselineFile(env, baseDir): BaselineReport` 함수를 export 추가. `resolveBaselinePath(env, baseDir)` 로 경로 결정 → `fs.readFileSync(path, "utf8")` 로 파일 읽기 → `parseBaselineReport(json)` 로 복원 → `BaselineReport` 반환. 경로 규약·파싱 규칙 재구현 금지(전적 위임), fs builtin 만 사용(신규 dep 0), `writeBaselineFile` 및 순수 primitive 서명 변경 0.
- [ ] Happy-path unit test 1+ — 격리된 임시 디렉토리에 `writeBaselineFile` 로 baseline 을 먼저 저장한 뒤, 같은 (`env`, `baseDir`)로 `readBaselineFile` 을 호출하면 원본 `report` 와 동치(round-trip, NaN 지표 포함)임을 assert. 각 test 는 `afterEach`/`afterAll` 에서 임시 디렉토리를 정리한다.
- [ ] Error path unit test 1+ — 각 예외가 **부작용 없이(파일 읽기 시도 없이 또는 fs 오류 그대로) 전파**됨을 검증: (1) `env` 형태 불량(예: `null`) → `resolveBaselinePath` 의 `TypeError` 전파, (2) `env.label` 빈/공백-only → `RangeError` 전파, (3) `baseDir` non-string → `TypeError` 전파, (4) `baseDir` 빈/공백-only → `RangeError` 전파, (5) 존재하지 않는 경로(파일 미생성 상태) → `fs.readFileSync` 의 오류(`ENOENT` 계열) 전파, (6) 파일 내용이 유효 JSON 이 아니거나 리포트 형태 불량 → `parseBaselineReport` 의 예외(`SyntaxError`/`TypeError`) 전파.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) 존재하는 유효 baseline 파일 읽기 성공 분기, (2) 경로 결정 예외로 fs 접근 전 실패하는 분기(위 error case), (3) fs 읽기는 성공하나 파싱 단계에서 실패하는 분기(내용 불량). 분기가 위 3 흐름으로 구성됨을 spec describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: `env`=`undefined` → `TypeError` 전파, `baseDir`=`undefined` → `TypeError` 전파, `writeBaselineFile` 로 저장한 뒤 서로 다른 `env.label`(즉 서로 다른 파일)로 `readBaselineFile` 하면 그 경로 미존재로 `ENOENT` 계열 오류(파일 분리 저장 확인), 빈 파일(0바이트) 을 읽으면 `parseBaselineReport` 가 던지는 예외 전파.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 read 함수(`readBaselineFile`) 항목 1~2줄을 `writeBaselineFile` 항목 옆에 추가(`resolveBaselinePath`+`parseBaselineReport` 조립·UTF-8 read·`BaselineReport` 반환·write 의 대칭 read 방향·fs 오류 그대로 전파 명시). write 항목의 "read 방향은 별도 follow-up" 문구는 "구현됨(`readBaselineFile`)"으로 갱신.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- write 방향(`writeBaselineFile`) 재수정·서명 변경 — 이미 T-0869 로 main 안착. 본 task 는 read 함수 1개만 추가하고 write 는 spec round-trip 셋업으로만 재사용.
- 실 baseline 디렉토리 레이아웃 확정·commit(repo 에 baseline JSON 파일 체크인), CI job 편입(부하 harness workflow), 실 Postgres 실측·baseline 수치 fix — 전부 별도 follow-up(§5 #4·#5).
- `resolveBaselinePath` / `resolveBaselineFilename` / `parseBaselineReport` / `serializeBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `compareBaselineJson` / `buildBaselineReport` / `assertS2Threshold` / collector·metrics 판정·계산·서명 변경 금지 — 본 task 는 io 모듈에 read 함수 1개만 추가하고 기존 순수 primitive 는 import 만 한다.
- 경로·파일명·역직렬화 규칙 재구현 금지 — 전적으로 기존 primitive 위임(DRY).
- 파일 부재를 친절히 래핑(커스텀 에러 메시지·null 반환 등) 금지 — fs 오류를 그대로 전파해 계약을 최소화한다(래핑 필요 시 별도 follow-up).
- async/Promise fs API 도입 금지 — 기존 동기 스타일과 통일(`*Sync`).
- 신규 외부 dependency 추가 금지(Node builtin `fs`/`os`/`path` + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: write+read 를 조립해 실 baseline JSON 파일을 repo 에 확정·체크인하는 §5 #5 harness slice)
