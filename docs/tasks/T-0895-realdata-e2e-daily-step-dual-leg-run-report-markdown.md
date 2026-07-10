---
id: T-0895
title: realdata-e2e daily-step dual-leg run report descriptor → rolling-issue 마크다운 본문 순수 렌더러 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: [T-0894]
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts
plannerNote: "P5 §109 step④ — T-0894 dual-leg run report descriptor 를 rolling-issue 박제용 결정론적 마크다운 본문으로 렌더하는 표현 layer 순수 함수 신설(T-0581 summary-markdown 렌더러 mirror). 실 gh 박제는 credential-gate 별도 slice. test-only pr 2파일 dep[T-0894 머지]."
---

# T-0895 — realdata-e2e daily-step dual-leg run report descriptor → rolling-issue 마크다운 본문 순수 렌더러 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 박제**하라 지시한다.

바로 앞 slice(T-0894)는 두 leg 의 run outcome(run→pass / run→fail / skip)을 하나의 결정론적 `RealDataDailyStepDualLegRunReport` descriptor(per-leg `{action,status}` + `overallStatus` + byte-identical `summaryLine`)로 묶는 순수 컴포저를 박제했다. 그러나 그 descriptor 를 **rolling-issue 본문으로 박제할 마크다운 문자열로 렌더링하는 표현 layer 는 아직 부재**하다.

이는 T-0580(summary descriptor 집계) → T-0581(summary descriptor → 마크다운 렌더러)로 이어진 선례와 정확히 동형이다. summary 축은 이미 표현 layer(`realdata-e2e-result-summary-markdown.ts`)를 가졌으나, 두 leg run outcome 축(T-0894)은 descriptor 만 있고 마크다운 렌더러가 없다. 향후 step④ live wiring(credential gate)이 rolling-issue body 를 조립하려면 descriptor → 마크다운 문자열을 결정론적으로 산출하는 build-time layer 가 선행돼야 한다.

본 task 는 그 gap 을 순수 함수로 메운다 — `RealDataDailyStepDualLegRunReport` → rolling-issue 박제용 **결정론적 마크다운 본문 문자열**. 실 jest spawn / 실 gh 박제 / credential 은 일절 없이 build-time 완결(dependency-free, cloud cron 자율 실행 가능).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts`(T-0894) — 입력 descriptor `RealDataDailyStepDualLegRunReport`(gitSha/dateToken/eval{action,status}/collect{action,status}/overallStatus/summaryLine) 와 status enum(`RealDataDailyStepLegStatus` = pass|fail|skip, `RealDataDailyStepDualLegOverallStatus` = all-pass|some-fail|all-skip|partial) 정의. 본 렌더러의 입력 type 을 `import type` 으로 **재사용**(중복 정의 0). 재구현/재호출 0 — 이미 만들어진 descriptor 를 문자열로 표현만 한다.
- `test/helpers/realdata-e2e-result-summary-markdown.ts`(T-0581) — descriptor → daily-test 이슈 마크다운 본문 **렌더러 스타일 mirror 템플릿**. 결정론적 출력(동일 입력→byte-identical)·슬롯 고정 순서·무공유(입력 mutate 0)·type 재사용(SSOT)·dependency-free(내장 template literal 만)·순수 문자열 렌더링 서술 패턴을 그대로 차용.
- `test/helpers/realdata-e2e-result-summary-markdown.spec.ts`(T-0581 colocated spec) — 마크다운 렌더러의 colocated `.spec.ts` R-112 4 종(happy/error/branch/negative) + 결정론·무공유·mutate 0·credential echo 0 단언 패턴을 그대로 차용.

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.ts`(순수 렌더러) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts`. production `src/`·T-0894 컴포저·기존 result-summary 렌더러·gating helper 수정 0.
- [ ] **렌더러 신설** — `renderRealDataDailyStepDualLegRunReportMarkdown(report: RealDataDailyStepDualLegRunReport): string` 순수 함수. `RealDataDailyStepDualLegRunReport` 는 T-0894 에서 `import type` 재사용(중복 정의 0). 마크다운 본문은 최소한 (1) run 식별자(gitSha/dateToken), (2) per-leg 표기(eval/collect 의 action + status), (3) overallStatus, (4) descriptor 의 `summaryLine` 을 결정론적 고정 순서·고정 공백·고정 줄바꿈으로 렌더링. enum 토큰(pass/fail/skip/all-pass 등)은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **Happy-path unit test 1+** — overallStatus `"all-pass"`(eval pass & collect pass) 완전 descriptor → 마크다운 문자열이 gitSha/dateToken/두 leg status/overallStatus/summaryLine 을 모두 포함하고, 동일 descriptor 재렌더 시 byte-identical.
- [ ] **Error path unit test 1+** — descriptor 무결성 guard 분기 각 1+: (1) `report.gitSha` 빈/공백-only → throw, (2) `report.dateToken` 빈/공백-only → throw, (3) `report.summaryLine` 빈/공백-only → throw. 조용한 통과 0(각 명시적 Error). (guard 는 T-0894 컴포저 산출 정합을 렌더 시점에 재확인 — mislabel 된 raw descriptor 방어.)
- [ ] **Flow / branch cover** — overallStatus 4 분기(`all-pass` / `some-fail` / `all-skip` / `partial`) 각 1+ test 로 렌더 결과가 그 판정을 정확히 표기하는지 확인 + per-leg status 3 분기(pass/fail/skip)가 마크다운에 각각 정확히 표기되는지 각 1+ test.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (a) 두 leg 모두 skip(`all-skip`) → 마크다운이 skip/skip 및 all-skip 을 정확 표기, (b) eval fail & collect pass(`some-fail`) → some-fail 정확 표기, (c) eval pass & collect skip(`partial`) → partial 정확 표기, (d) **credential echo 0**(§9) — descriptor 에 token-like placeholder 를 심어도(단, descriptor 는 leg status·run 식별자만 보유하므로 gitSha/dateToken 에 심어 검증) 마크다운이 그 외 어떤 secret 형태도 노출하지 않음(정규식 단언 1+), (e) **결정론·무공유** — 동일 descriptor 두 번 렌더 시 문자열 동일 + 반환은 매번 새 문자열, (f) **입력 mutate 0** — `report` 및 하위 `eval`/`collect` 객체가 렌더 전후 deep-equal(읽기만) — 각 1+ test.
- [ ] **build-time 완결·dependency-free** — 실 jest spawn / 실 gh 박제 / 실 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 템플릿 엔진·라이브러리(zod 등) 0. 순수 문자열 렌더링(내장 template literal + 수동 검증만). `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — T-0894 descriptor type `import type` 외 신규 import 없음.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 렌더러 파일 branch/func/line 100% 목표(모든 분기·guard 를 spec 이 도달).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown.spec.ts`(T-0894 컴포저 spec·result-summary-markdown spec 과 동일 디렉토리·convention). 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `deploy/daily-test.sh` bash 배선 / 실 jest 프로세스 spawn / 실 leg outcome 캡처 / 실 gh 이슈 박제(`gh issue create`/`comment`) / credential wiring** — 본 task 는 (dual-leg run report descriptor) → 마크다운 문자열 순수 함수만. live wiring 은 credential gate 별도 slice.
- **T-0894 컴포저(`realdata-e2e-daily-step-dual-leg-run-report.ts`) 수정 / leg outcome 재파생 / status 재계산** — descriptor 는 이미 status·overallStatus 를 확정 보유. 본 렌더러는 재계산 0, 표현만. import type 재사용만.
- **eval leg 의 `EvaluationResult[]` 집계·마크다운(T-0580/T-0581) / 단일 issue-post outcome-report(T-0590) 수정** — 재구현/재호출 0. 본 task 는 두 leg run report 축의 마크다운 표현 layer 신설만.
- **두 leg command-plan 컴포저 / gating helper / consistency 가드 / 조립·수렴 smoke 수정** — 개념 참조만, import/호출 0.
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (마크다운 렌더러 선례(T-0581)와 입력 descriptor(T-0894)가 명확 — architect 생략. dual-leg run report descriptor → 결정론적 마크다운 본문 순수 함수 + colocated R-112 spec 를 신설.)

## Follow-ups

(없음 — 본 task 머지로 dual-leg run report 축의 표현 layer(descriptor → 마크다운 본문)가 닫힌다. 이후 P5 잔여 갭: 본 마크다운 본문을 rolling-issue 로 실제 박제하는 step④ live wiring(credential gate) / daily-test bash 가 두 leg outcome 을 캡처해 T-0894 컴포저 → 본 렌더러로 넘기는 배선 재survey — 별도 슬라이스로 planner 가 큐잉.)
