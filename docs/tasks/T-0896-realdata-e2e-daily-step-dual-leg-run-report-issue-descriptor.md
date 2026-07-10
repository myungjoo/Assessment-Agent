---
id: T-0896
title: realdata-e2e daily-step dual-leg run report → rolling-issue 식별자/본문 descriptor 순수 빌더 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts
plannerNote: "P5 §109 step④ — T-0895 dual-leg run report 마크다운 렌더러 다음 자연 경계(식별 layer). report → rolling-issue {title,marker,body} 멱등 descriptor 순수 빌더(T-0582 summary-issue-descriptor mirror). 실 gh 박제는 credential-gate 별도. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0896 — realdata-e2e daily-step dual-leg run report → rolling-issue 식별자/본문 descriptor 순수 빌더 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다.

두 leg run outcome 축의 build-time chain 은 이미 (1) 두 leg run outcome → `RealDataDailyStepDualLegRunReport` descriptor 순수 컴포저(T-0894) → (2) 그 descriptor → rolling-issue 박제용 결정론적 마크다운 본문 렌더러(T-0895)까지 박제됐다. 그러나 **어떤 이슈 제목으로 / 어떤 멱등 marker 로 / 어떤 본문으로 박제할지**를 결정하는 식별 layer 는 아직 부재하다.

이는 summary 축의 선례와 정확히 동형이다 — summary 축은 T-0580(집계 descriptor) → T-0581(마크다운 렌더러) → **T-0582(이슈 식별자/본문 descriptor 빌더)** 로 이어졌고, T-0582 는 순수 함수 `buildRealDataResultIssueDescriptor(summary, run)` 로 `{title, marker, body}` 를 산출해 later live wiring 이 동일 run 의 이슈를 검색→갱신(멱등)할 수 있게 했다. dual-leg run report 축은 T-0894/T-0895(컴포저+렌더러)까지만 있고 그 식별 layer(T-0582 mirror)가 없다.

본 task 는 그 gap 을 순수 함수로 메운다 — `RealDataDailyStepDualLegRunReport`(gitSha/dateToken 를 이미 보유) → daily-test 결과 이슈의 (a) 결정론적 제목, (b) 멱등 검색·갱신용 marker, (c) 본문(T-0895 `renderRealDataDailyStepDualLegRunReportMarkdown` 위임 + marker 라인)을 묶은 descriptor 를 산출한다. report 가 run 식별자(gitSha+dateToken)를 이미 담으므로 별도 run ref 입력은 없다(summary 축과의 유일한 shape 차이). marker 덕에 later live wiring slice 가 동일 run 의 rolling-issue 를 검색→갱신(멱등)할 수 있다.

실 gh issue 호출 / `deploy/daily-test.sh` step wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 문자열 descriptor 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`(T-0894) — 입력 descriptor `RealDataDailyStepDualLegRunReport`(gitSha/dateToken/eval{action,status}/collect{action,status}/overallStatus/summaryLine) + status enum(`RealDataDailyStepLegStatus`, `RealDataDailyStepDualLegOverallStatus`) + `assertNonBlank` guard 규약 정의. 본 빌더의 입력 type 을 `import type` 으로 **재사용**(중복 정의 0). run 식별자(gitSha/dateToken)는 report 가 이미 보유 → 별도 run ref 입력 없음.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts`(T-0895) — 본 빌더가 본문 렌더링을 위임할 `renderRealDataDailyStepDualLegRunReportMarkdown(report)` import 소스(마크다운 렌더 로직 중복 0). 헤더 주석 컨벤션·결정론 정책 mirror.
- `docs/tasks/T-0582-realdata-e2e-result-issue-descriptor.md` — summary 축의 동형 선례(`buildRealDataResultIssueDescriptor` → `{title, marker, body}`). 결정론·멱등 marker 안정성·빈/공백 guard·입력 mutate 0·무공유·R-59 정합·dependency-free 서술 패턴을 그대로 차용. 본 task 는 그 dual-leg 축 mirror.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` + colocated spec(T-0582) — descriptor 빌더 + colocated `.spec.ts` R-112 4 종(happy/error/branch/negative) + 결정론·멱등 marker·무공유·mutate 0 단언 패턴의 mirror 템플릿.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`(순수 빌더) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts`. production `src/`·T-0894 컴포저·T-0895 렌더러·기존 summary-issue-descriptor 수정 0.
- [ ] **빌더 신설** — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueDescriptor` 순수 함수. 산출 descriptor 는 (a) `title`(결정론적 이슈 제목 — 고정 prefix + gitSha/dateToken run 식별 token), (b) `marker`(멱등 검색·갱신용 안정 식별 토큰 — 동일 run 이면 동일 marker), (c) `body`(marker 라인 + `renderRealDataDailyStepDualLegRunReportMarkdown(report)` 본문)를 담는다. 신규 타입은 출력 `RealDataDailyStepDualLegRunReportIssueDescriptor`(`{ title; marker; body }`)만 정의. 입력 `RealDataDailyStepDualLegRunReport` 는 T-0894 에서 `import type` 재사용(중복 정의 0). enum 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **타입 재사용 / 위임** — 입력 type 은 T-0894 에서 import 재사용(새 정의 0), 본문 렌더링은 T-0895 `renderRealDataDailyStepDualLegRunReportMarkdown` 위임(마크다운 렌더 로직 중복 0). marker/title 합성만 본 빌더 고유 로직.
- [ ] **Happy-path unit test 1+** — overallStatus `"all-pass"` 정상 report → `title`(prefix+token 포함) / `marker`(안정 토큰) / `body`(marker 라인 + 렌더 본문 포함)가 정확히 산출됨 + 동일 report 재빌드 시 descriptor byte-identical.
- [ ] **Error path unit test 1+** — 빈/공백-only 식별자 guard 분기 각 1+: (1) `report.gitSha` 빈/공백-only → throw, (2) `report.dateToken` 빈/공백-only → throw. 조용한 통과 0(각 명시적 Error). (비식별 이슈 박제 방지 — 잘못된 run 식별자로 rolling-issue 오염 차단.)
- [ ] **Flow / branch cover** — guard 분기(gitSha 빈/공백, dateToken 빈/공백)와 정상 경로 각 1+ test. `body` 에 marker 라인이 정확히 1회 포함(중복·누락 0). overallStatus 4 분기(`all-pass`/`some-fail`/`all-skip`/`partial`) 중 최소 2 분기(all-pass + 하나 이상 비-all-pass)에서 title/body 가 정확 산출되는지 확인.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) **멱등 marker 안정성** — 동일 run(동일 gitSha+dateToken)이면 report 의 leg status/overallStatus 가 달라도 `marker` 가 동일함, (b) 서로 다른 run(상이 gitSha 또는 dateToken)은 서로 다른 `marker` 를 산출함, (c) **결정론·무공유** — 동일 report 두 번 빌드 시 descriptor 동일 + 반환은 매번 새 객체, (d) **입력 mutate 0** — `report` 및 하위 `eval`/`collect` 객체가 빌드 전후 deep-equal(읽기만), (e) **credential/raw echo 0**(§9·R-59) — descriptor 는 run 식별자(gitSha/dateToken)·leg status·집계 요약(렌더 위임)만 담고 narrative/raw 활동 본문·secret 형태를 노출하지 않음(정규식 단언 1+) — 각 1+ test.
- [ ] **R-59 정합** — 본 descriptor 는 report 의 run 식별자·leg status·overallStatus·summaryLine(렌더 위임)만 담는다. narrative 본문·raw 활동 본문 입력 0(받지도 못함). 헤더 주석에 R-59 정합 + step ④ 박제 경계 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh issue 호출(`gh issue create`/`comment`) / 실 jest spawn / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 템플릿·해시 라이브러리(handlebars/mustache/crypto 외부 패키지 등) 0. 순수 문자열 합성(내장 template literal + 수동 검증만). `process.env` 읽기 0. marker 는 안정 string 합성으로 충분(외부 해시 불요).
- [ ] **새 외부 dependency 0** — T-0894 descriptor type + T-0895 렌더러 `import` 외 신규 import 없음.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 빌더 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts`(T-0894 컴포저 spec·T-0895 렌더러 spec·summary-issue-descriptor spec 과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 gh 이슈 박제(`gh issue create`/`comment`/search-or-update) / credential wiring** — 본 task 는 (dual-leg run report) → 이슈 식별자/본문 descriptor 순수 함수만. live wiring 은 credential gate 별도 slice.
- **T-0894 컴포저 / T-0895 렌더러 수정 / leg outcome 재파생 / status·마크다운 재계산** — descriptor·마크다운은 이미 확정. 본 빌더는 재계산 0, marker/title 합성 + 본문 위임만. import 재사용만.
- **summary 축(T-0580/T-0581/T-0582) / 단일 issue-post outcome-report(T-0590) 수정** — 재구현/재호출 0. 본 task 는 dual-leg run report 축의 식별 layer 신설만.
- **실 run 식별자 도출(실 gitSha·실 timestamp 읽기)** — 본 빌더는 report 가 이미 보유한 run 식별자를 사용; 식별자 source 는 upstream 컴포저(T-0894) 책임.
- **Person 별 / 기간 별 group-by 이슈 분해 / 마크다운 외 포맷(plain text/HTML/JSON) 본문** — 본 빌더는 단일 dual-leg run report 1 이슈 descriptor·마크다운 본문만.
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
