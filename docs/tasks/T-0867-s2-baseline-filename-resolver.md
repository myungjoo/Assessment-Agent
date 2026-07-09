---
id: T-0867
title: S2 latency baseline 파일명 규약 순수 함수 신설 (resolveBaselineFilename)
phase: P8
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 195
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline.ts
  - test/perf/latency-baseline.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — env-meta label→결정적·FS-safe baseline 파일명 순수 함수. T-0866 Out-of-Scope '파일 경로 규약' slice, fs I/O 0. R-112 backbone×1.5 → est 195."
---

# T-0867 — S2 latency baseline 파일명 규약 순수 함수 신설 (resolveBaselineFilename)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "baseline 확정 + 임계 fix — 최초 실측으로 §3 임계를 실 수치로 확정"을 요구한다. 지난 6개 슬라이스(T-0861~T-0866)가 baseline harness 의 순수 함수 primitive 를 전부 신설했다: `buildBaselineReport`/`formatBaselineLine`(리포트 조립·포맷), `compareBaselineReports`(두 리포트 비교), `serializeBaselineReport`/`parseBaselineReport`(JSON 영속화·복원), `formatComparisonReport`(비교 결과 포맷), `compareBaselineJson`(저장 두 JSON 합성 진입점). 이제 이 primitive 들을 **디스크 harness** 로 잇는 단계인데, T-0866 의 Out of Scope 가 명시했듯 "baseline 파일 경로 규약"이 아직 없다 — 저장 harness 가 `serializeBaselineReport` 결과를 어디에(어떤 파일명으로) 쓰고, `compareBaselineJson` 이 어떤 파일명에서 기준 baseline 을 읽을지 결정하는 **결정적(deterministic)·파일시스템-안전(FS-safe) 파일명 규약**이 필요하다.

본 slice 는 그 규약을 **순수 함수 하나**로 박제한다: `BaselineEnvMeta`(특히 `label`)로부터 baseline JSON 파일명(디렉토리 없는 basename)을 결정적으로 유도하되, label 의 임의 문자를 FS-safe slug 으로 정규화한다(공백·구분자·대문자 등 처리). 실제 파일 I/O(`fs` 호출)·디렉토리 경로 조립·CI 배선은 전혀 하지 않는다 — 순수 string-in/string-out 이라 unit test 로 완전 cover 가능하며, 이후 disk harness slice(fs read/write)가 이 함수를 파일명 결정 진입점으로 import 한다.

## Required Reading

- `test/perf/latency-baseline.ts` — 입력 타입 `BaselineEnvMeta`(19행: `label`(빈/공백-only 금지)·`concurrency`·optional cpu/memoryMb/dataScale) + 형태 가드 `isValidEnvMeta`(56행, label string·concurrency number 검증) + `serializeBaselineReport`(390행)/`parseBaselineReport`(436행)/`compareBaselineJson`(667행)이 소비할 파일명 규약의 맥락. 본 task 가 여기에 `resolveBaselineFilename` 을 추가한다(파일 I/O 0 — 순수 문자열 유도만).
- `test/perf/latency-baseline.spec.ts` (colocated spec) — 기존 spec 구조를 따라 새 함수 spec 을 여기에 추가한다(신규 spec 파일 만들지 말 것 — colocated 우선).
- `test/perf/README.md` §"baseline 리포트 (`latency-baseline.ts`)" 절 — 새 함수 항목 1~2줄 추가.
- `docs/ops/load-resilience-test-plan.md` §5 #4·#5 — 저장 baseline 로드→비교→리포트 harness 및 파일 저장 맥락.

## 설계 요지

- `resolveBaselineFilename(env: BaselineEnvMeta): string` — env-meta 로부터 baseline JSON 파일명(디렉토리 없는 basename, 예: `baseline-ci-linux-x64.json`)을 결정적으로 유도한다:
  1. `env` 가 유효 `BaselineEnvMeta` 형태가 아니면(`isValidEnvMeta` 재사용) `TypeError` throw.
  2. `env.label` 이 빈 string 또는 공백-only 이면 `RangeError` throw(buildBaselineReport 의 label 계약과 동형 — 파일명의 유의미성 보장).
  3. `label` 을 FS-safe slug 으로 정규화: 소문자화 + 영숫자·하이픈 외 문자(공백·`/`·`\`·`:`·`.` 등)를 단일 하이픈으로 치환 + 선행/후행 하이픈 trim + 연속 하이픈 축약. 정규화 결과가 빈 string 이 되는 label(예: 구분자로만 구성)은 `RangeError`(유의미한 파일명 유도 불가).
  4. 고정 prefix + slug + `.json` 확장자로 basename 조립(예: `baseline-<slug>.json`). prefix·확장자는 상수로 고정.
- **결정성(determinism)** — 같은 label(정규화 후 동일 slug)은 항상 같은 파일명을 낳는다. 대소문자만 다른 label(`CI-Linux` vs `ci-linux`)도 같은 slug 으로 수렴함을 보장(저장·조회 파일명 일치의 핵심).
- **순수·부작용 0** — `fs`·`path` 조인·디렉토리 조립·환경 read 없음. 오직 문자열 유도만. 디렉토리 결합(예: `test/perf/baselines/<name>`)은 본 함수 밖(disk harness slice) 책임.
- **판정 로직 불변** — S2 pass/fail·임계·지표 계산과 무관한 순수 명명 유틸. 기존 primitive 서명·동작 변경 0.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline.ts` 에 `resolveBaselineFilename(env: BaselineEnvMeta): string` 함수를 export 추가. `isValidEnvMeta` 를 재사용해 형태 검증 후 `label` 을 FS-safe slug(소문자·영숫자/하이픈만·연속/선후행 하이픈 정리)으로 정규화하고 고정 prefix + slug + `.json` 으로 basename 을 조립한다. 파일 I/O·디렉토리 조립 없음(순수).
- [ ] Happy-path unit test 1+ — 정상 label(예: `label: "ci-linux-x64"`)이면 결정적 basename(예: `baseline-ci-linux-x64.json`) 반환. 같은 env 를 두 번 호출하면 동일 문자열 반환(결정성). 공백·특수문자 포함 label(예: `"Local MacBook / M1"`)이 FS-safe slug(예: `baseline-local-macbook-m1.json`, 소문자·단일 하이픈·확장자 `.json`)로 정규화됨을 assert.
- [ ] Error path unit test 1+ — 각 예외 검증: (1) `env` 가 유효 `BaselineEnvMeta` 형태 아님(예: `null`·`label` 누락·`concurrency` non-number) → `TypeError`, (2) `label` 이 빈 string(`""`) 또는 공백-only(`"   "`) → `RangeError`, (3) label 이 구분자로만 구성돼 정규화 slug 이 빈 string 이 되는 경우(예: `"///"`) → `RangeError`.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) slug 정규화가 실제로 문자를 치환하는 label vs 이미 slug-safe 라 변형 없는 label(`"ci-linux"` 그대로) 분기, (2) 대소문자만 다른 두 label(`"CI-Linux"` vs `"ci-linux"`)이 동일 slug/파일명으로 수렴하는 분기, (3) 연속 특수문자·선행/후행 구분자가 단일 하이픈 축약·trim 되는 분기.
- [ ] Negative cases 충분 cover — 각 1+ test: `env` = `undefined` → `TypeError`, `label` 이 숫자·객체 등 non-string → `TypeError`(isValidEnvMeta 경유), 오직 공백/구분자로만 이뤄져 slug 이 비는 label(`"  --  "`) → `RangeError`, 유니코드·비-ASCII 문자만으로 이뤄져 slug 이 비는 label → `RangeError`(또는 정규화 규약이 정한 결정적 처리 — spec 에 명시), 반환 basename 이 디렉토리 구분자(`/`·`\`)를 포함하지 않고 `.json` 으로 끝나는지 검증(FS-safe 보장).
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 `resolveBaselineFilename` 항목 1~2줄 추가(env-meta label → 결정적·FS-safe baseline 파일명 basename 유도·순수·파일 I/O 0·disk harness 가 파일명 결정 진입점으로 import 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- 실제 파일 I/O(`fs` read/write/exists), `path.join` 디렉토리 조립, baseline 디렉토리 레이아웃 결정, CI job 편입, 실 Postgres 실측 — 전부 별도 follow-up(§5 #4·#5 disk harness). 본 task 는 파일명(basename) 문자열 유도만.
- `serializeBaselineReport` / `parseBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `compareBaselineJson` / `buildBaselineReport` / `assertS2Threshold` / collector 판정·계산·서명 변경 금지 — 본 task 는 신규 순수 명명 함수 1개만 추가.
- 새 error 타입·새 옵션 필드·새 env-meta 필드 신설 금지 — 기존 `TypeError`/`RangeError` 계약과 `BaselineEnvMeta` 형태를 그대로 사용.
- 파일명 prefix/확장자 규약을 env 로 override 하는 설정 경로 금지 — 상수 고정(harness 확장은 별도 task).
- 신규 외부 dependency 추가 금지(supertest/jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

---

## 결과 (DONE)

- **완료 시각**: 2026-07-09T21:49Z (server-time)
- **PR**: #761, squash-merge `c634b414`, reviewer APPROVE round 1/7, 4-게이트 PASS, CI green.
- **변경**: `resolveBaselineFilename(env: BaselineEnvMeta): string` + 내부 `slugifyLabel` 헬퍼를 `test/perf/latency-baseline.ts` 에 추가(순수·fs/path I/O 0). colocated spec 19 case(happy/error/branch/negative 충분 cover), README baseline 절 항목 추가. +67/-0.
- **검증**: `pnpm lint && pnpm build && pnpm test:cov` 통과, test:cov line 99.95%/func 100%/branch 99.25%(≥80/80 무회귀), 전체 134/9254 pass. 신규 함수 ~100%.
- **AC**: 전부 ok(8/8). 신규 외부 dependency 0, 판정 로직 불변.
