---
id: T-0729
title: realdata-e2e result-issue publish 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 644
mergedAs: e001cb18
reviewRounds: 1
coversReq: [REQ-037, REQ-059]
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts
independentStream: realdata-e2e-result-issue-publish-assembly-smoke
estimatedDiff: 130
estimatedFiles: 1
created: 2026-06-28
plannerNote: P5 §109 실 평가 e2e — result-issue publish 조립 체인(buildRealDataResultIssuePublishPlan) non-gated smoke. T-0728 seed-assembly 와 file-disjoint 병렬 stream.
---

# T-0729 — realdata-e2e result-issue publish 조립 체인 non-gated build-time smoke 신설

## Why

PLAN §109 "🟢 실 평가 e2e" 의 build-time consistency-guard sweep(T-0584~T-0726) 종결 후, 개별 컴포저의 정합 가드는 모두 닫혔으나 **여러 컴포저를 묶은 조립 체인 단위의 build-time smoke** 는 아직 부분적이다. T-0728 이 seed→run-plan→step-args 조립 체인의 non-gated smoke 를 신설 중인 것과 **병렬 sibling** 으로, 본 task 는 result-issue publish 조립 체인(`buildRealDataResultIssuePublishPlan` — command-plan + search-argv 합성의 단일 진입점, T-0666 self-wire 포함)을 입력 `EvaluationResult[]` + run 으로부터 끝까지 조립해 `{ report, commandArgs, searchArgv }` 산출을 build-time(live-LLM 0·네트워크 0)으로 검증하는 smoke 를 박제한다. 결과 이슈 publish 경로(REQ-037 평가 결과 산출·REQ-059 raw 미저장)의 조립 회귀를 CI 단계에서 잡는 그물이다.

## Required Reading

- `docs/tasks/T-0729-realdata-e2e-result-issue-publish-assembly-smoke.md` (본 파일)
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — `buildRealDataResultIssuePublishPlan(results, run)` 단일 진입점. 반환 shape `RealDataResultIssuePublishPlan { report, commandArgs, searchArgv }`(L103~107), 합성 순서(command-plan → search-argv)·빈 results 분기·run.gitSha/dateToken 빈/공백 throw 전파(L120~128).
- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — `buildRealDataResultIssueCommandPlan(results, run)` 위임 대상. 반환 `{ report, commandArgs }`, run 식별자 타입 `RealDataResultIssueRunRef`.
- `test/smoke/realdata-e2e-live.smoke-spec.ts` — 기존 realdata-e2e smoke 의 헤더 주석·describe 구조·import 경로 규약 참고(단, 본 task 는 **non-gated** 라 describe.skip gating·live gateway·Ollama 배선 일절 사용 안 함).
- `test/jest-smoke.json` 및 `package.json` 의 `test:smoke` script — smoke suite 가 어떻게 수집·실행되는지(rootDir `test/smoke/`, 파일명 `*.smoke-spec.ts` 패턴).

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` **1 개 파일** 신설. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-LLM 0·네트워크 0·result-issue publish 조립 체인 범위) 작성.
- [ ] **Happy-path**: 유효한 `EvaluationResult[]`(1+ 건) + 유효 run(`gitSha`·`dateToken` 비공백)을 `buildRealDataResultIssuePublishPlan` 에 넘겨 `{ report, commandArgs, searchArgv }` 세 필드가 모두 산출되고, `report.summary` 의 count·집계가 입력 result 수와 정합하며 `searchArgv` 가 비어있지 않은 string[] 임을 검증하는 test 1+.
- [ ] **Error path**: run.gitSha 또는 dateToken 이 빈 문자열/공백일 때 `buildRealDataResultIssuePublishPlan` 이 throw 하고(command-plan 단계 전파, searchArgv 단계 미도달) 그 throw 가 발생함을 검증하는 test 1+(각 빈-필드 케이스).
- [ ] **분기 cover**: 빈 `results` 배열 + 유효 run → throw 0 + `report.summary` count 0·전 슬롯 0·`commandArgs`/`searchArgv` 정상 합성됨을 검증하는 test 1+(L120~123 빈-배열 분기). 단일 vs 다수 result 분기 각 1+ test.
- [ ] **negative cases 충분 cover**: 예외 상황을 분기마다 cover — (i) gitSha 빈/공백, (ii) dateToken 빈/공백, (iii) 빈 results, (iv) 동일 입력 2회 호출 시 산출이 deep-equal 하고 참조 무공유(결정론·무공유, L130~134)임을 검증하는 test 각 1+. 단일 negative 만 작성 금지.
- [ ] **결정론·무공유**: 같은 (results, run) 으로 두 번 호출한 두 plan 이 deep-equal 이면서 최상위·중첩 객체(report/commandArgs/searchArgv) 참조가 공유되지 않음(`not.toBe`)을 검증하는 test 1+.
- [ ] live-LLM·네트워크·DB·credential 사용 0 — 파일 내 fetch/gateway/Ollama/env-gating/describe.skip 배선 일절 없음(순수 build-time in-memory 검증만).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke suite green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 파일 추가라 production 커버리지 영향 0, 기존 임계 유지 확인.

## Out of Scope

- T-0728 의 seed→run-plan→step-args 조립 체인 smoke 파일(`test/smoke/realdata-e2e-assembly.smoke-spec.ts`) 은 절대 건드리지 않는다(file-disjoint 병렬 stream 보장).
- 새 컴포저·consistency 가드 helper 신설 0(consistency-guard sweep 은 T-0726 에서 종결됨 — T-0727 doc §5 의 "추가 value-consistency 가드 신설 금지" 준수).
- 실 LLM round-trip·실 github 수집·env-gated live 실행 leg(이는 §109 step④ daily-test 후속 책임).
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` 등 기존 컴포저 소스 수정(본 task 는 smoke spec 추가만 — 컴포저는 read-only 검증 대상).
- `src/`·`package.json`·`.github/workflows/`·schema 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
