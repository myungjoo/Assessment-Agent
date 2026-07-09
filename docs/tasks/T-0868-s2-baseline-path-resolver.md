---
id: T-0868
title: S2 latency baseline 디렉토리 경로 조립 순수 함수 신설 (resolveBaselinePath)
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline.ts
  - test/perf/latency-baseline.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #4·#5(baseline 확정) — baseDir + resolveBaselineFilename basename → 결정적 baseline 파일 경로 순수 함수. T-0867 Out-of-Scope 'path.join 디렉토리 조립' slice, fs I/O 0. R-112 backbone×1.5 → est 150."
---

# T-0868 — S2 latency baseline 디렉토리 경로 조립 순수 함수 신설 (resolveBaselinePath)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #4·#5 는 "baseline 확정 + 임계 fix"를 위해 저장 baseline 을 **디스크 harness** 로 읽고 쓰는 단계를 요구한다. 지난 7개 슬라이스(T-0861~T-0867)가 baseline harness 의 순수 함수 primitive 를 전부 신설했다: 리포트 조립·포맷(`buildBaselineReport`/`formatBaselineLine`), 비교(`compareBaselineReports`), JSON 영속화·복원(`serializeBaselineReport`/`parseBaselineReport`), 비교 결과 포맷(`formatComparisonReport`), 저장 JSON 합성 진입점(`compareBaselineJson`), 그리고 직전 T-0867 이 env-meta label → 결정적·FS-safe **파일명 basename** 유도(`resolveBaselineFilename`).

다만 T-0867 의 Out of Scope 가 명시했듯 "`path.join` 디렉토리 조립"은 아직 없다 — disk harness 가 `serializeBaselineReport` 결과를 **어느 디렉토리 아래** 그 basename 으로 쓸지, `compareBaselineJson` 이 어느 디렉토리에서 기준 baseline 을 읽을지 결정할 **결정적 경로 조립 규약**이 필요하다. 본 slice 는 그 규약을 **순수 함수 하나**로 박제한다: baseline 디렉토리(`baseDir`)와 `resolveBaselineFilename` 이 유도한 basename 을 결정적으로 결합해 baseline 파일의 전체 경로 문자열을 만들되, 실제 파일 I/O(`fs` 호출)는 전혀 하지 않는다. 순수 string-in/string-out 이라 unit test 로 완전 cover 가능하며, 이후 disk harness slice(fs read/write)가 이 함수를 경로 결정 진입점으로 import 한다.

## Required Reading

- `test/perf/latency-baseline.ts` — 입력 타입 `BaselineEnvMeta`(19행) + 형태 가드 `isValidEnvMeta` + 직전 신설 `resolveBaselineFilename`(728행, env → basename 유도, `BASELINE_FILENAME_PREFIX`/`BASELINE_FILENAME_EXT` 상수 683·685행) + `slugifyLabel` 헬퍼. 본 task 가 여기에 `resolveBaselinePath` 를 추가한다(`resolveBaselineFilename` 을 재사용, fs I/O 0).
- `test/perf/latency-baseline.spec.ts` (colocated spec) — 기존 spec 구조를 따라 새 함수 spec 을 여기에 추가한다(신규 spec 파일 만들지 말 것 — colocated 우선).
- `test/perf/README.md` §"baseline 리포트 (`latency-baseline.ts`)" 절(24행~, `resolveBaselineFilename` 항목 39행) — 새 함수 항목 1~2줄 추가.
- `docs/ops/load-resilience-test-plan.md` §5 #4·#5 — 저장 baseline 로드→비교→리포트 harness 및 파일 저장·디렉토리 맥락.

## 설계 요지

- `resolveBaselinePath(env: BaselineEnvMeta, baseDir: string): string` — baseline 디렉토리와 env-meta 로부터 baseline JSON 파일의 전체 경로를 결정적으로 유도한다:
  1. `resolveBaselineFilename(env)` 를 호출해 basename 을 얻는다(env 형태 불량 → `TypeError`, 빈/공백-only·slug 빈 label → `RangeError` 은 그대로 전파 — 별도 재검증·중복 throw 금지).
  2. `baseDir` 이 string 이 아니면 `TypeError`, 빈 string 또는 공백-only 이면 `RangeError` throw(경로 유의미성 보장 — filename 계약과 동형).
  3. `baseDir` 과 basename 을 **결정적으로** 결합해 경로 문자열을 만든다. 결합 규약은 **POSIX-style 결정성**을 우선한다(플랫폼 무관 동일 결과 보장 — CI/로컬 경로 일치의 핵심). 예: `baseDir` 후행 구분자 유무를 정규화한 뒤 단일 `/` 로 basename 을 잇는다. `path.posix.join` 을 쓰거나 직접 정규화하되, **`fs` 호출·환경 read·절대경로 강제·경로 존재 검사 없음**.
- **결정성(determinism)** — 같은 (`env`, `baseDir`) 는 항상 같은 경로를 낳는다. `baseDir` 의 후행 슬래시 유무(`"a/b"` vs `"a/b/"`)가 결과에 영향을 주지 않도록 정규화(중복 구분자 축약).
- **basename 위임 불변** — 파일명 규약은 전적으로 `resolveBaselineFilename` 에 위임한다. 본 함수는 디렉토리 결합만 책임진다(파일명 slug 규칙 재구현 금지 — DRY).
- **순수·부작용 0** — `fs`·환경 read 없음. `path`(정규화용)만 허용. 판정 로직·기존 primitive 서명·동작 변경 0.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline.ts` 에 `resolveBaselinePath(env: BaselineEnvMeta, baseDir: string): string` 함수를 export 추가. `resolveBaselineFilename(env)` 로 basename 을 유도(예외는 그대로 전파)하고 `baseDir` 을 검증한 뒤 POSIX-결정적으로 결합한다. 파일 I/O·환경 read 없음(순수), 파일명 slug 규칙 재구현 금지.
- [ ] Happy-path unit test 1+ — 정상 (`env`, `baseDir`)이면 결정적 경로 반환(예: `env.label:"ci-linux-x64"`, `baseDir:"test/perf/baselines"` → `test/perf/baselines/baseline-ci-linux-x64.json`). 같은 인자를 두 번 호출하면 동일 문자열 반환(결정성). basename 부분이 `resolveBaselineFilename(env)` 와 정확히 일치함을 assert(위임 검증).
- [ ] Error path unit test 1+ — 각 예외 검증: (1) `env` 형태 불량(예: `null`·`concurrency` non-number) → `TypeError` 전파, (2) `env.label` 빈/공백-only → `RangeError` 전파, (3) `baseDir` 이 non-string(예: `null`·숫자·객체) → `TypeError`, (4) `baseDir` 이 빈 string(`""`)·공백-only(`"   "`) → `RangeError`.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) `baseDir` 후행 구분자 있음(`"a/b/"`) vs 없음(`"a/b"`)이 동일 결과로 수렴하는 정규화 분기, (2) `baseDir` 이 단일 세그먼트(`"baselines"`)인 경우와 다중 세그먼트(`"a/b/c"`)인 경우, (3) `resolveBaselineFilename` 이 던지는 예외가 재검증 없이 그대로 전파되는 분기(env 불량 → `resolveBaselinePath` 도 동일 `TypeError`).
- [ ] Negative cases 충분 cover — 각 1+ test: `env` = `undefined` → `TypeError`, `baseDir` = `undefined` → `TypeError`, `baseDir` 이 오직 구분자·공백으로만 구성(`"   "`·`"/"` 정규화 결과 유의미성 판정은 spec 에 명시) → 규약이 정한 결정적 처리(`RangeError` 또는 결정적 경로 — 어느 쪽이든 spec 에 명시·assert), 반환 경로가 basename(`baseline-...json`)으로 끝나고 중복 구분자(`//`)를 포함하지 않는지 검증, 서로 다른 `baseDir` 이 동일 basename 을 서로 다른 경로로 매핑함을 검증.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 `resolveBaselinePath` 항목 1~2줄 추가(baseDir + `resolveBaselineFilename` basename → 결정적 baseline 파일 경로 유도·순수·fs I/O 0·파일명 규약은 `resolveBaselineFilename` 위임·disk harness 가 경로 결정 진입점으로 import 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- 실제 파일 I/O(`fs` read/write/exists/mkdir), 디렉토리 생성, baseline 디렉토리 실 레이아웃 확정·commit, CI job 편입, 실 Postgres 실측 — 전부 별도 follow-up(§5 #4·#5 disk harness). 본 task 는 경로(문자열) 유도만.
- `resolveBaselineFilename` / `serializeBaselineReport` / `parseBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `compareBaselineJson` / `buildBaselineReport` / `assertS2Threshold` / collector 판정·계산·서명 변경 금지 — 본 task 는 신규 순수 경로 함수 1개만 추가.
- 파일명 slug 규칙(소문자화·하이픈 치환 등) 재구현 금지 — 전적으로 `resolveBaselineFilename` 에 위임.
- 새 error 타입·새 옵션 필드·새 env-meta 필드·`baseDir` 을 env 로 override 하는 설정 경로 신설 금지 — 기존 `TypeError`/`RangeError` 계약과 인자 서명 그대로.
- 절대경로 강제·플랫폼별 구분자 분기(Windows `\`) 도입 금지 — POSIX-결정적 단일 규약(플랫폼 무관 동일 결과).
- 신규 외부 dependency 추가 금지(supertest/jest/Node builtin 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
