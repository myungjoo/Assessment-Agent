---
id: T-0828
title: S2 조회 latency 경량 harness 측정 primitive 신설 (supertest 기반, 신규 dep 0)
phase: P8
status: DONE
commitMode: pr
completedAt: 2026-07-08T07:57:12Z
resultPR: 722
resultSha: a7267f64
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-07-08
independentStream: p8-load-resilience
dependsOn: []
touchesFiles:
  - test/perf/latency-metrics.ts
  - test/perf/latency-metrics.spec.ts
  - test/perf/jest-perf.json
  - test/perf/README.md
  - package.json
plannerNote: "P8 line148 부하·내성 follow-up #2 (load-resilience-test-plan §5) — S2 조회 latency 경량 harness 의 측정 primitive. supertest 기존 devDep 재사용, 신규 dep 0 (BLOCKED 회피). single-helper test × 1.0."
estimatedModel: "single-helper test(percentile 측정 함수 + colocated spec + perf scaffold) × 1.0 = base 130 LOC, T-0058 패턴"
---

# T-0828 — S2 조회 latency 경량 harness 측정 primitive 신설

## Why

PLAN.md P8 line148 (부하·내성 테스트) 은 T-0826 이 계획 문서를, T-0827 이 도구 선택
ADR-0054(k6 권고)를 확정했다. 그 계획의 §5 follow-up 은 실행 순서를 명시하는데,
**#1 (k6 도입)은 신규 dependency 를 요구해 CLAUDE.md §5 상 owner 승인 전까지 BLOCKED**
이지만, **#2 "S2 조회 latency 경량 harness (supertest 기반, 신규 dependency 불요) — 위 1과
독립적으로 먼저 착수 가능한 최소 measure"** 는 기존 `supertest`(package.json devDependency
7.0.0) 로 진행 가능하다. 본 task 는 그 #2 의 **측정 primitive** — 반복 호출로 수집한
latency 표본에서 p50/p95/p99 percentile 과 error rate 를 산출하는 순수 함수 —를 신설해,
REQ-048(조회·시각화 3초 이내 = S2 목표 p95 < 3s) 검증의 재사용 building block 을 만든다.

DB·앱 부트스트랩에 의존하는 실제 조회 endpoint round-trip spec 은 별도 follow-up 으로
남긴다(본 task 는 신규 dep 0 · DB 무의존 · 순수 로직만 — 작은 첫 slice). 이렇게 나누면
percentile 산출 로직을 DB 없이 unit-test 로 완결(R-112)하고, 후속 harness 는 이 primitive
를 import 만 하면 된다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` — §2 S2 (조회 API 응답 지연, p95 < 3s), §3 임계 표
  (p50/p95/p99 · throughput · error rate), §4.1 (supertest 기반 반복 호출 measure), §5
  follow-up #2. 본 primitive 가 back 하는 계획.
- `docs/decisions/ADR-0054-load-resilience-harness-tool.md` — Decision 절 (S2 는 기존
  supertest 2-계층 measure, k6 는 S1/S3 발생기용) — 본 task 가 S2 계층에 해당함을 확인.
- `docs/requirements.md` line 67 (REQ-048 — 조회·시각화 3초 이내, 검증 위치 `perf`).
- `test/jest-e2e.json` — 기존 jest config 포맷(rootDir/testRegex/transform/testEnvironment)
  참고. 본 task 의 `test/perf/jest-perf.json` 은 이 포맷을 mirror 하되 perf 전용 regex 로.
- `package.json` line 17~21 (scripts: test / test:cov / test:smoke / test:e2e 배선) — `test:perf`
  script 추가 위치 참고. line 55/65 (supertest / @types/supertest 기존 devDependency 확인 —
  신규 추가 없음).

## Acceptance Criteria

- [ ] `test/perf/latency-metrics.ts` 신설 — 순수 측정 함수 primitive. 최소 다음 export:
  - [ ] `percentile(samplesMs: number[], p: number): number` — 정렬 후 p-분위수(0~100) 산출.
        빈 배열·경계 p(0/100)·단일 표본 처리 정의.
  - [ ] `summarizeLatency(samplesMs: number[]): { p50: number; p95: number; p99: number; count: number; maxMs: number }`
        — 표본 배열에서 요약 지표 산출(§3 임계 표의 p50/p95/p99 대응).
  - [ ] `errorRate(total: number, failures: number): number` — non-2xx/전체 비율(0~1). total=0 방어.
  - [ ] 함수는 **DB·네트워크·앱 부트스트랩에 의존하지 않는 순수 함수**여야 한다(입력 배열→출력 수치).
- [ ] `test/perf/latency-metrics.spec.ts` 신설(colocated) — R-112 4종 cover:
  - [ ] **happy-path**: 알려진 표본 배열에 대해 `percentile` / `summarizeLatency` / `errorRate` 가
        기대 수치를 반환(예: 100개 표본에서 p95 위치 검증, error rate 0.1 검증) — 각 함수 1+.
  - [ ] **error path**: 빈 배열(`[]`)·`total=0`·음수/NaN 표본 등 잘못된 입력에 대한 정의된 동작
        (throw 또는 방어 반환) 검증 — 각 함수 1+.
  - [ ] **flow/branch**: `percentile` 의 분기(빈 배열 / 단일 표본 / p=0 / p=100 / 보간 필요 경계)
        각 분기 1+ test. `errorRate` 의 total=0 분기 1+.
  - [ ] **negative cases 충분 cover**: 경계값(1개 표본, 모두 동일 값, 정렬 안 된 입력),
        type mismatch(비수치 원소 방어), p 범위 밖(음수/100 초과) 등 예외 상황 **각 1+ test** —
        단일 negative 로 부족, 예외 분기마다 cover.
  - [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 신규 파일 포함 coverage 미달 시 fail.
- [ ] `test/perf/jest-perf.json` 신설 — perf 전용 jest config. `test/jest-e2e.json` 포맷 mirror,
      단 `testRegex` 는 perf spec 만 매칭(예: `.*\\.perf-spec\\.ts$` 또는 `test/perf/.*\\.spec\\.ts$`).
      **본 task 의 `latency-metrics.spec.ts` 는 순수 unit 이므로 기본 `pnpm test`(jest) 에서도 수집됨** —
      perf config 는 후속 DB-backed `*.perf-spec.ts` harness 를 위한 scaffold(현재 매칭 spec 0 이면
      `passWithNoTests: true` 로 두어 빈 실행 허용).
- [ ] `package.json` scripts 에 `"test:perf": "jest --config ./test/perf/jest-perf.json"` 1줄 추가.
      **신규 dependency 0** — `git diff` 로 `dependencies`/`devDependencies`/`pnpm-lock.yaml` 무변경 확인.
- [ ] `test/perf/README.md` 신설(≤ 30줄) — 본 perf 디렉토리 목적(§5 follow-up #2 S2 latency measure),
      primitive 사용법(percentile/summarizeLatency import), 후속 harness(DB-backed `*.perf-spec.ts`)가
      이 primitive 를 재사용함을 명시. load-resilience-test-plan.md §5 cross-link 1줄.
- [ ] `test:perf` 를 **PR CI(`.github/workflows/ci.yml`) 에 배선하지 않는다** — 부하/perf 는
      load-resilience-test-plan §5 follow-up #4(별도 job, 상시 PR CI 와 분리)의 범위. 본 task 는
      CI workflow 를 건드리지 않는다.
- [ ] R-110 준수: pr-mode 이므로 tester 가 `pnpm lint && pnpm build && pnpm test`(및 `test:cov`)
      실행해 신규 파일이 기존 test/build 를 깨지 않음을 확인.
- [ ] 변경 파일 ≤ 5, diff ≤ 300 LOC 확인. secret 실값 0.

## Out of Scope

- **실제 조회 endpoint round-trip 측정 spec 작성 금지** — DB·앱 부트스트랩 의존 `*.perf-spec.ts`
  (createAuthenticatedE2EApp 로 실 GET latency 수집)은 별도 follow-up(본 primitive 를 import).
- **package.json / pnpm-lock.yaml 의 dependency 추가 금지** — supertest 는 기존 devDependency
  재사용. 어떤 새 패키지도 추가하지 않는다(k6/artillery/autocannon 은 owner 승인 후 별도 BLOCKED task).
- **`.github/workflows/ci.yml` 변경 금지** — perf CI job 편입은 follow-up #4 범위.
- **S1(배치 부하) / S3(동시성 내성) harness 구현 금지** — k6 도구 도입(ADR-0054, owner 승인) 후 별도 task.
- **load-resilience-test-plan.md §1~§4 재작성 금지** — 필요 시 §5 에 본 primitive/perf 디렉토리 링크
  1줄만 추가(선택). 계획 본문 무손상.
- **PLAN.md line148 checkbox flip 금지** — S2 primitive 만으로 부하·내성 테스트 완결 아님(harness
  미완성). checkbox `[ ]` 유지.

## Suggested Sub-agents

`implementer → tester` — implementer 가 latency-metrics primitive + perf scaffold + README + script
작성, tester 가 colocated spec(R-112 4종 + negative 충분 cover) 작성 및 `pnpm test:cov`/lint/build
로 회귀 없음 확인. architect 불요(도구 결정은 ADR-0054 에서 이미 확정).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append. 예상 후속: DB-backed S2 조회 endpoint
`*.perf-spec.ts` harness(본 primitive import) / k6 도입 owner 승인 BLOCKED task / perf CI job 편입)
