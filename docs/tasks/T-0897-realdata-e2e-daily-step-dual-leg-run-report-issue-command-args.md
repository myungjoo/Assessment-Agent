---
id: T-0897
title: realdata-e2e daily-step dual-leg run report 이슈 descriptor → gh issue 멱등 명령-args 순수 빌더 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts
plannerNote: "P5 §109 step④ — T-0896 이슈 descriptor 다음 자연 경계(명령 layer, T-0583 mirror). descriptor{title,marker,body} → gh issue 멱등 search-or-update 명령-args{searchQuery,createArgs,updateArgs} 순수 빌더. 실 gh 호출 deferred. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0897 — realdata-e2e daily-step dual-leg run report 이슈 descriptor → gh issue 멱등 명령-args 순수 빌더 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다.

dual-leg run report 축의 build-time chain 은 이미 (1) 두 leg run outcome → `RealDataDailyStepDualLegRunReport` 순수 컴포저(T-0894) → (2) 그 report → 결정론적 마크다운 본문 렌더러(T-0895) → (3) 그 report → rolling-issue 식별자/본문 `RealDataDailyStepDualLegRunReportIssueDescriptor`{title, marker, body} 순수 빌더(T-0896)까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 명령 layer** — 를 순수 함수로 분해한다.

이는 summary 축의 선례와 정확히 동형이다 — summary 축은 T-0582(이슈 descriptor) 다음에 **T-0583** 으로 `buildRealDataResultIssueCommandArgs(descriptor)` 를 추가해 descriptor{title, marker, body} → gh issue 멱등 search-or-update 명령-args{searchQuery, createArgs, updateArgs} 를 산출했다(실 gh 호출은 여전히 deferred). dual-leg 축은 descriptor(T-0896)까지만 있고 그 명령 layer(T-0583 mirror)가 없다.

본 task 는 그 gap 을 순수 함수로 메운다 — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor): RealDataDailyStepDualLegRunReportIssueCommandArgs` 는 T-0896 의 descriptor 를 입력받아 daily-test dual-leg 결과 이슈의 멱등 search-or-update 에 필요한 (a) `searchQuery`(marker 기반 — 동일 run 의 기존 이슈를 찾는 검색 문자열), (b) `createArgs`(`gh issue create` 의 title/body/labels), (c) `updateArgs`(기존 이슈 발견 시 `gh issue edit` 의 title/body) 를 묶은 명령-args descriptor 를 산출한다. marker 가 createArgs/updateArgs 양쪽 body 에 포함됨을 보장해 later live wiring 의 search-or-update 멱등성을 떠받친다.

실 gh issue 호출 / `deploy/daily-test.sh` step wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 명령-args 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`(T-0896) — 입력 타입 `RealDataDailyStepDualLegRunReportIssueDescriptor`(`{ title; marker; body }`) + `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 정의. 본 빌더의 입력 type 을 `import type` 으로 **재사용**(중복 정의 0). marker 의 search-or-update 멱등 역할 서술 재확인.
- `docs/tasks/T-0583-realdata-e2e-result-issue-command-args.md` — summary 축의 동형 선례(`buildRealDataResultIssueCommandArgs` → `{searchQuery, createArgs, updateArgs}`). 결정론·멱등 marker 정합·빈/공백 guard·입력 mutate 0·무공유·고정 labels·R-59 정합·dependency-free 서술 패턴을 그대로 차용. 본 task 는 그 dual-leg 축 mirror.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` + colocated spec(T-0583) — 명령-args 빌더 + colocated `.spec.ts` R-112 4 종(happy/error/branch/negative) + 결정론·멱등 searchQuery·무공유·mutate 0 단언 패턴의 mirror 템플릿.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 명령-args 가 descriptor 의 title/marker/body 만 전달(narrative/raw 미보유)하는 근거.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts`(순수 빌더) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts`. production `src/`·T-0894 컴포저·T-0895 렌더러·T-0896 descriptor·기존 summary-축 helper 수정 0.
- [ ] **빌더 신설** — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor): RealDataDailyStepDualLegRunReportIssueCommandArgs` 순수 함수. 산출 명령-args 는 (a) `searchQuery`(descriptor.marker 기반 — 동일 run 의 기존 이슈를 찾는 검색 문자열), (b) `createArgs`(`{title, body, labels}` — `gh issue create` 인자), (c) `updateArgs`(`{title, body}` — 기존 이슈 발견 시 `gh issue edit` 인자) 를 담는다. 신규 타입은 출력 `RealDataDailyStepDualLegRunReportIssueCommandArgs`(+ 내부 `createArgs`/`updateArgs` shape)만 정의. enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **타입 재사용** — 입력 `RealDataDailyStepDualLegRunReportIssueDescriptor` 는 T-0896 helper 에서 `import type` 재사용(새 type 정의 0). descriptor.title/marker/body 는 그대로 전달만(재계산·재렌더 0).
- [ ] **marker 멱등 정합** — `searchQuery` 가 `descriptor.marker`(또는 그로부터 결정론적으로 도출된 안정 토큰)를 포함해, later live wiring 이 동일 run 의 기존 이슈를 marker 로 검색할 수 있음을 spec 으로 검증. `createArgs.body` 와 `updateArgs.body` 모두 marker 라인을 포함(descriptor.body 그대로 전달 — 멱등 검색 토큰이 양쪽 경로에 보존)을 검증.
- [ ] **Happy-path unit test 1+** — 정상 `descriptor`(비어있지 않은 title/marker/body) → `searchQuery`(marker 포함) / `createArgs`(title=descriptor.title, body=descriptor.body, labels=고정 결정론 집합) / `updateArgs`(title=descriptor.title, body=descriptor.body)가 정확히 산출됨 + 동일 descriptor 재호출 시 결과 byte-identical.
- [ ] **Error path unit test 1+** — 빈/공백-only 식별자 guard 분기 각 1+: (a) 빈 `title` throw, (b) 공백-only `title` throw, (c) 빈 `marker` throw, (d) 공백-only `marker` throw — 각각 별도 case. 조용한 통과 0(비식별 이슈 명령 생성 차단). 단일 negative 만으로 부족(필드별·빈/공백별 분기마다 cover).
- [ ] **Flow / branch cover** — guard 분기(title 빈/공백, marker 빈/공백)와 정상 경로 각 1+ test. createArgs/updateArgs 양쪽 body 에 marker 라인이 정확히 포함(누락 0) 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) **멱등 searchQuery 안정성** — 동일 descriptor.marker 면 두 번 호출한 searchQuery 가 동일, (b) **결정론적 labels** — labels 는 고정 결정론 집합(호출마다 동일, 시각·랜덤·env 의존 0), (c) **결정론·무공유** — 동일 descriptor 두 번 빌드 시 결과 동일 + 반환은 매번 새 객체(중첩 `createArgs`/`updateArgs`/`labels` 배열도 새로 생성), (d) **입력 mutate 0** — `descriptor` 가 빌드 전후 deep-equal(읽기만), (e) **무공유 회귀** — 반환 `createArgs.labels` 배열에 push 해도 다음 호출 결과 labels·입력에 누설 0 — 각 1+ test.
- [ ] **R-59 정합** — 본 명령-args 는 descriptor 의 title/marker/body 만 전달한다(narrative 본문·raw 활동 본문 입력 0 — 받지도 못함). 헤더 주석에 R-59 정합 + step ④ 박제 경계 + "실 gh 호출은 deferred(본 helper 는 명령-args 만 산출)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh issue 호출(`gh issue create`/`edit`/`list`/`search`) / 실 jest spawn / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 템플릿·CLI·해시 라이브러리 0. 순수 문자열 합성(내장 template literal + 수동 검증만). `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — T-0896 descriptor type `import` 외 신규 import 없음.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 빌더 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.spec.ts`(T-0896 descriptor spec·summary-축 command-args spec 과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 gh 이슈 호출(`gh issue create`/`edit`/`list`/`search`/search-or-update 실 분기 실행) / credential wiring** — 본 task 는 (이슈 descriptor) → 명령-args 순수 함수만. live wiring 은 credential gate 별도 slice.
- **search-or-update 의 실 분기 실행**(기존 이슈 존재 여부 판단·실 issue number 해석) — 본 helper 는 create/update 양쪽 args 를 모두 산출만; 어느 쪽을 실행할지는 caller 의 live wiring 책임.
- **T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor 수정 / marker·title·body 재계산·재렌더** — 이미 확정. 본 빌더는 descriptor 전달 + searchQuery/labels 합성만. import 재사용만.
- **summary 축(T-0580~T-0583) / 단일 issue-post outcome-report(T-0590) 수정** — 재구현/재호출 0. 본 task 는 dual-leg 축의 명령 layer 신설만.
- **repo slug(`owner/repo`) 결정 / `--repo` 인자 / gh auth** — 실 wiring 의 환경 책임(본 helper 는 title/body/labels/searchQuery 만).
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
