---
id: T-0762
title: realdata-e2e publish-plan↔report-plan 두 composer(buildRealDataResultIssuePublishPlan·buildRealDataResultReportPlan) single-source (results,run) report convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step④ publish-plan 의 내포 report 와 standalone report-plan 이 동일 (results,run) single-source 로 byte-identical 수렴함을 묶는 cross-composer smoke 0 gap; git grep 두 composer 동시-호출 convergence 부재 확인(report-plan smoke 는 publish-plan 을 '별개 family' 코멘트로만 언급)"
independentStream: realdata-e2e-publish-plan-report-plan-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-composer·guard-order·negative 분기 다수 + no-mutation/credential/결정론) = ~290 LOC 1파일, T-0761/T-0760/T-0756 sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). 300 미만이나 sweep sibling 이 일관히 cap 근접/초과(T-0758 459 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-publish-plan-report-plan-convergence-assembly.smoke-spec.ts
---

# T-0762 — realdata-e2e publish-plan↔report-plan 두 composer single-source (results,run) report convergence non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 결과 이슈 박제는 pre-실행 build-time chain 의 단일 진입점 `buildRealDataResultIssuePublishPlan(results, run)` 가 `{report, commandArgs, searchArgv}` 을 산출한다. 이 진입 composer 의 첫 위임 결과인 **`publishPlan.report`**(`{summary, descriptor}`)는 별도 standalone composer **`buildRealDataResultReportPlan(results, run)`** 가 동일 입력으로 산출하는 report 와 **byte-identical 단일 source 로 수렴**해야 한다 — 즉 한 평가 run 의 결과 집계·이슈 descriptor 가 "publish chain 안에서 내포 산출된 report" 와 "standalone 으로 산출된 report" 사이에서 절대 drift 하면 안 된다. 두 경로가 같은 `(results, run)` source 에서 다른 report 를 내면(예: standalone report 는 totalVolume X 인데 publish chain 의 내포 report 는 totalVolume Y), step④ 가 commandArgs/searchArgv 로 박는 이슈 본문과 별도 리포트 산출물(summary-markdown·report-plan 소비처)이 **같은 run 인데 서로 다른 결과 수치를 외화**해 결과 리포트 단일성·재실행 정합(REQ-037)이 깨진다.

기존 sweep 은 두 composer 를 **각각 따로** 닫았다: report-plan 은 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts`(T-0593/T-0699·T-0700, summary↔descriptor 내부 cross + plan↔inputs 재유도 단독), publish-plan 은 `realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts`(T-0755, report·commandArgs·searchArgv tri-leg 내부 수렴 단독). 그러나 **publish-plan 진입 composer 의 내포 `report` 와 standalone report-plan composer 의 산출이 동일 `(results, run)` single-source 로 byte-identical 수렴**함을 박제한 smoke 는 NONE 이다 — `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` 는 publish-plan 을 본문 코멘트(`buildRealDataResultIssuePublishPlan(T-0595 / T-0729) 진입 — 별개 composer family`)로만 언급할 뿐 cross-composer 수렴을 단언하지 않는다(git grep `buildRealDataResultReportPlan` AND `buildRealDataResultIssuePublishPlan` 동시-호출 + 수렴 단언 smoke 0 확인 — origin/main). 직전 머지된 T-0761 이 pipeline-plan↔evaluation-plan stage 간 modelId 정책 수렴을 닫았다면, 본 task 는 step④ post-eval publish 진입 composer 와 standalone report composer 가 **단일 (results,run) report source** 로 수렴함을 닫는 sweep 의 cross-composer 대칭이다. live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultIssuePublishPlan AND buildRealDataResultReportPlan 둘 다 실제 호출 + publishPlan.report toEqual reportPlan 수렴 단언) 여부; done` — **두 composer 를 동일 (results,run) 으로 동시 호출해 report single-source 수렴을 단언한 smoke 파일 0** 확인. publish-plan↔report-plan cross-composer report-convergence 전용 smoke 부재.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — publish 진입 composer. L135 `export function buildRealDataResultIssuePublishPlan(results, run)` → `RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`. L142 `buildRealDataResultIssueCommandPlan(results, run)` 위임 → `{report, commandArgs}`, report 는 그 안에서 `buildRealDataResultReportPlan(results, run)` 와 동일 위임 chain 으로 산출. L124 run.gitSha/dateToken 빈/공백 → command-plan 단계(= report 단계)에서 throw 전파(searchArgv 미도달).
- `test/helpers/realdata-e2e-result-report-plan.ts` — standalone report composer. L111 `export function buildRealDataResultReportPlan(results, run)` → `RealDataResultReportPlan {summary, descriptor}`. L117 `buildRealDataResultSummary(results)`(빈 results 도 정상 집계) → L122 `buildRealDataResultIssueDescriptor(summary, run)`(run.gitSha/dateToken 빈/공백 throw 전파). 합성 순서: summary 는 run guard 무관·먼저 집계, descriptor 단계에서 run guard 평가(잘못된 run → plan 미산출).
- `test/helpers/realdata-e2e-result-summary.ts` — L64 `interface RealDataResultSummary {count, byDifficulty, byContribution, totalVolume}` + L105 `buildRealDataResultSummary(results)` shape 참조(빈 입력 → count 0·전 슬롯 0·totalVolume 0). EvaluationResult[] 합성용.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — L73 `interface RealDataResultIssueRunRef {gitSha, dateToken}`(run source) + L85 `interface RealDataResultIssueDescriptor {title, marker, body}` shape 참조. descriptor.body 는 marker→한 줄 요약→markdown 합성(R-59: 식별자·요약 본문만 보유, raw 활동 본문 0).
- `test/smoke/realdata-e2e-pipeline-evaluation-plan-modelid-convergence-assembly.smoke-spec.ts` (T-0761) — 직전 머지된 sibling cross-stage convergence smoke. 두 composer 동시-호출·single-source 수렴 단언·negative throw 전파·결정론/무공유/no-mutation/credential 누출 0 패턴 참고(구조 sibling-consistent — 본 task 는 publish-plan↔report-plan cross-composer report 수렴 대칭).
- `test/smoke/realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0593/T-0699/T-0700) — report-plan 내부(summary↔descriptor cross + plan↔inputs 재유도) convergence smoke. 중복 회피 — 본 task 는 publish-plan↔report-plan **composer 간** report 수렴만, report-plan 내부 summary↔descriptor 수렴 재단언 금지(T-0699/T-0700 cover).
- `test/smoke/realdata-e2e-result-issue-publish-plan-tri-leg-convergence-assembly.smoke-spec.ts` (T-0755) — publish-plan 내부 tri-leg(report·commandArgs·searchArgv) convergence smoke. 중복 회피 — 본 task 는 publish-plan 의 report leg 가 standalone report-plan 과 수렴함만, publish-plan 내부 commandArgs/searchArgv tri-leg 재단언 금지(T-0755 cover).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-publish-plan-report-plan-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: 단일 `(results, run)` source 1개(synthetic `EvaluationResult[]` literal + 유효 `RealDataResultIssueRunRef {gitSha, dateToken}`)를 확보한 뒤 — `publishPlan = buildRealDataResultIssuePublishPlan(results, run)`, `reportPlan = buildRealDataResultReportPlan(results, run)` 를 동일 입력으로 호출 — 두 산출물 정상(publishPlan: `{report, commandArgs, searchArgv}`, reportPlan: `{summary, descriptor}`) happy test 1+.
- [ ] **cross-composer report single-source 수렴(branch — 핵심 불변식)**: `publishPlan.report` 가 standalone `reportPlan` 과 동일 single-source 로 byte-identical 함을 묶어 단언 1+ test — `expect(publishPlan.report).toEqual(reportPlan)`(deep-equal) AND `expect(publishPlan.report).not.toBe(reportPlan)`(무공유 복제 — 두 경로가 같은 값이되 객체 공유 0). 추가로 `publishPlan.report.summary`↔`reportPlan.summary`(`toEqual`) 와 `publishPlan.report.descriptor`↔`reportPlan.descriptor`(`toEqual`) 를 각각 묶어 단언해 summary·descriptor 두 sub-필드가 모두 동일 source 임을 박제(composer 간 report drift 0).
- [ ] **multi-result 집계 분기에서도 report 동형 수렴(branch)**: `results` 가 2+ 원소(다양 difficulty / contribution 등급 분포)를 가진 입력으로 두 composer 호출 → `publishPlan.report.summary.count` / `byDifficulty` / `byContribution` / `totalVolume` 가 `reportPlan.summary` 의 대응 필드와 **전부** 일치 + `publishPlan.report.descriptor.body`===`reportPlan.descriptor.body`(byte-identical) 1+ test — 다수 result 집계에서도 두 경로가 동일 분포·동일 본문으로 수렴(일부 슬롯만 drift 0).
- [ ] **partial-thread 격리(branch)**: 서로 다른 `results`(또는 다른 `run`) 입력으로 두 composer 를 함께 호출 → `publishPlan.report` 와 `reportPlan` 이 **함께** 동형 변화(두 경로가 같은 source 따라 동시 이동, drift 0) 1+ test — 한 경로만 stale source 를 쓰면 publish 본문≠standalone 리포트 회귀를 그물로 박제. 또한 빈 `results`(`[]`) + 유효 run 이면 두 경로 모두 `report.summary.count === 0` AND 전 difficulty/contribution 슬롯 0 AND `totalVolume === 0` 이되 descriptor 는 정상 합성(throw 0)되고 `publishPlan.report` toEqual `reportPlan` 보존 1+(경계값 — 빈 입력에서도 두 경로 report 수렴).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(두 composer 모두 빈/공백 run 식별자 거부 — guard 대칭 박제):
  - 빈 문자열 `run.gitSha = ""` → publish-plan composer(`buildRealDataResultIssuePublishPlan`) throw 전파(descriptor 단계, searchArgv 미도달).
  - 빈 문자열 `run.gitSha = ""` → report-plan composer(`buildRealDataResultReportPlan`) throw 전파(descriptor 단계).
  - 공백-only `run.dateToken = "   "` → 두 composer 모두 throw 전파(각 composer 별 1+ test) — guard 대칭(publish 경로·standalone 경로 양쪽이 동일 빈/공백 run 식별자를 거부)을 명시 박제.
  - 공백-only `run.gitSha = "  "` → 두 composer 모두 throw 전파 1+ test(gitSha·dateToken 두 식별자 축 각각 negative 경로 분리 박제).
- [ ] **flow / branch — guard 우선순위 cross-composer 정합(branch)**: 빈 `results`(`[]`) + 빈/공백 `run.gitSha` 경계에서 두 composer 모두 summary 집계(빈 results 도 정상)는 무관하게 **descriptor 단계의 run guard 가 throw** 됨을 단언(빈 results 라도 run guard 우선) 1+ test — publish-plan 은 command-plan(=report) 단계, report-plan 은 descriptor 단계에서 동일하게 throw 해 두 경로의 run guard 우선순위가 정합함(둘 다 run 식별자 미결정을 막음)을 박제.
- [ ] **credential 누출 0(branch)**: 두 산출물(`publishPlan`·`reportPlan`) 어느 출력에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth` 등) 미포함 단언(§9 정합) + raw 외부 활동 데이터(commit/PR/issue 본문) 미포함(R-59 정합 — 식별자·집계 카운트·분포 enum·요약 렌더 본문만) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (`results`/`run`)로 두 composer 각각 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(publishPlan·reportPlan 참조 각각 `not.toBe`) + 입력 `results`(중첩 result 원소)·`run`(gitSha/dateToken string 원시) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 composer/가드도 수정하지 않고 두 기존 composer(publish 진입 publish-plan·standalone report-plan)를 동일 단일 `(results, run)` source 로 묶은 cross-composer report 수렴 불변식(report byte-identical 단일 source 일치·multi-result 동형·partial-thread 격리·두 composer guard 대칭/우선순위 throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 report-convergence/multi-result/partial-thread/guard-order/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts`·`...-result-report-plan.ts`·`...-result-summary.ts`·`...-result-issue-descriptor.ts` 또는 어떤 composer/가드 helper 의 로직 변경(composer 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- report-plan 내부 summary leg↔descriptor leg cross 수렴 + plan↔inputs 재유도 전수 재단언(T-0593/T-0699/T-0700 이미 cover — 본 task 는 cross-composer report 수렴만).
- publish-plan 내부 report·commandArgs·searchArgv tri-leg 수렴 전수 재단언(T-0755 이미 cover — 본 task 는 publish-plan 의 report leg↔standalone report-plan 수렴만).
- summary 의 개별 집계 shape(count·byDifficulty·byContribution·totalVolume slot 전수) / descriptor body 의 marker→한 줄 요약→markdown 합성 구조 전수 재단언(T-0580/T-0582/T-0642/T-0644 이미 cover).
- 실 github.com 네트워크 fetch / 실 활동 수집(`collectForPerson`) / 실 `prisma.upsert` / 실 LLM scoring round-trip / 실 gh CLI 실행(create/edit) / placeholder 치환 runner(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa/prisma client 등 0).
- 기존 publish-plan/report-plan unit·tri-leg/내부 convergence spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
