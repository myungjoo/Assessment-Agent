---
id: T-0878
title: CI 에 test:perf step 배선 (perf-spec 스위트 CI 자동 실행)
phase: P8
status: DONE
completedAt: 2026-07-10T05:26:06Z
mergedAs: 9910e8b1fd739c52efd93e0e69a2d9148d93fdbf
prNumber: 772
reviewRounds: 1
commitMode: pr
coversReq: [REQ-111, REQ-113]
estimatedDiff: 20
estimatedFiles: 2
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles: [.github/workflows/ci.yml, README.md]
plannerNote: "P8 §5 #4 — 30+ perf-spec 이 CI 미실행(reviewer standing MAJOR) → ci.yml 에 test:perf step 추가로 R-111/R-113 enforce"
---

# T-0878 — CI 에 test:perf step 배선 (perf-spec 스위트 CI 자동 실행)

## Why

P8 load-resilience-test-plan §5 follow-up #4 대응. `test:perf` script (`jest --config ./test/perf/jest-perf.json`) 는 이미 존재하고 T-0855~T-0877 로 30+ perf-spec (191 test) 이 로컬에서 green 이지만, `.github/workflows/ci.yml` 에는 `test:perf` step 이 **없어** 이 전 harness 가 CI 로 강제되지 않는다. 여러 slice PR 에서 reviewer 가 반복적으로 지적한 standing MAJOR ("perf-spec 이 CI 에서 안 돈다 — 모든 perf-spec 공통") 를 retire 하고, README 110–114행 R-111 (모든 test 는 CI 자동 실행) / R-113 (smoke + e2e 외 추가 스위트도 CI 에서) 를 perf 스위트에도 적용하는 것이 본 task 다.

## Required Reading

- `.github/workflows/ci.yml` — 기존 job step 구조. 특히 L168 `Prisma migrate deploy`, L177 `테스트 + 커버리지 검사`, L182 `스모크 테스트`, L187 `e2e test` step 배치. perf-spec 은 live NestJS + PostgreSQL 위에서 부트하므로 `migrate deploy` **이후** 에 배치해야 한다.
- `package.json` L22 — `"test:perf": "jest --config ./test/perf/jest-perf.json"` script 정의.
- `test/perf/jest-perf.json` — perf jest config (`testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`, `passWithNoTests: true`, `testEnvironment: node`).
- `README.md` — R-111 / R-113 관련 CI 서술 절 (perf 스위트 CI 실행 여부 문구 갱신 대상 확인).

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 의 `ci` job 에 `perf test` (또는 동등 이름) step 을 추가한다. `run: pnpm test:perf` 를 실행하며, live NestJS + PostgreSQL 의존 perf-spec 이 부팅되도록 **`e2e test` step 이후** (즉 `migrate deploy` 및 DB 의존 step 뒤) 에 배치한다.
- [ ] step 에 한국어 주석으로 목적 (R-111/R-113 perf 스위트 CI 실행, T-0878) + 배치 근거 (live app + DB 부팅 의존이라 migrate deploy 이후) 를 명시한다 (§12 언어 정책 — 주석 한국어, 명령/경로 영어).
- [ ] step 이 unit(`test:cov`) / smoke(`test:smoke`) / e2e(`test:e2e`) step 과 **별개 jest 실행** 으로 격리됨을 확인 (perf config 는 `test/perf/jest-perf.json` — 기존 config 와 독립).
- [ ] `pnpm test:perf` 를 로컬에서 실행해 30+ suite / 191 test 가 green 임을 확인 (tester 가 실행 로그 첨부). CI step 추가가 기존 green 스위트를 새로 fail 시키지 않음을 검증.
- [ ] `pnpm lint && pnpm build` green 유지 (본 task 는 src/ 코드 변경 0 이므로 기존 green 무회귀 확인).
- [ ] `README.md` 의 R-111/R-113 관련 CI 서술에서 perf 스위트가 "CI 미실행" 또는 이에 준하는 문구가 있으면 "CI 에서 실행됨" 으로 1줄 갱신 (해당 문구가 없으면 이 항목은 생략하고 그 사실을 PR 본문에 명시).
- [ ] **분기 없음** — 본 task 는 YAML step 추가 + doc 1줄 갱신뿐이라 production code 의 새 public symbol / 분기 추가가 0 이다. R-112 의 happy/error/branch/negative unit test 항목은 신규 코드가 없어 적용 대상 없음 (perf-spec 자체가 이미 R-112 를 만족하는 test 자산이며 본 task 가 그것을 CI 로 실행시키는 것). 이 사실을 PR 본문에 명시한다.
- [ ] **coverage 게이트 무회귀**: 본 task 는 src/ 를 건드리지 않으므로 `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 는 기존 그대로 유지됨을 tester 가 확인 (perf-spec 은 `collectCoverageFrom=src/**` 대상 밖이라 coverage 수치에 영향 0).

## Out of Scope

- perf-spec 신규 추가 / 기존 perf-spec 수정 (본 task 는 **실행 배선만** — test 자산 변경 0).
- perf 스위트의 latency 임계 CI-gating 강화 (현재 관찰 전용 harness — 임계 위반 시 CI fail 시키는 강제 게이트는 별도 §5 slice).
- `deploy-artifacts` job 에 perf 추가 (perf 는 배포 산출물 검증과 무관 — `ci` job 에만 배선).
- perf 실행 시간 최적화 / 병렬화 (`maxWorkers` 조정 등) — 현 config 유지.
- README 의 R-111/R-113 서술 대량 재작성 (해당 1줄 갱신만).

## Suggested Sub-agents

`implementer → tester` (아키텍처 결정 불요 — 기존 script/config 를 CI step 으로 배선하는 것뿐. architect 생략).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
