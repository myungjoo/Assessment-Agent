---
id: T-0292
title: P5 평가 orchestrator — Activity[] → 매퍼 → 평가-side dedup → scoreUnit → EvaluationResult[]
phase: P5
status: DONE
completedAt: 2026-06-09T02:40:00+09:00
prNumber: 244
mergedAs: 5923943
reviewRounds: 1
commitMode: pr
coversReq: [REQ-009, REQ-021, REQ-030, REQ-025, REQ-037, REQ-038, REQ-097, REQ-032, TBD]
estimatedDiff: 165
estimatedFiles: 3
created: 2026-06-09
dependsOn: [T-0287, T-0289, T-0291]
plannerSource: "ADR-0032 Follow-ups — scoring service slice(T-0291) 의 상위 layer. 단위 1 건 scoreUnit 위에 '여러 단위의 사전 필터(매퍼 + 평가-side dedup) → 단위별 scoring' 을 묶는 thin orchestrator. ADR-0032 §1 매퍼(T-0287) + §4 dedup(T-0289) + §2 scoreUnit(T-0291) 의 compose 빈자리."
plannerNote: "P5 여섯 번째 impl slice — 평가 orchestrator. mapActivityToEvaluationInput(T-0287)+dedup 2종(T-0289)+scoreUnit(T-0291) compose. dep 0, LLM/service mock, R-112 4종. controller/DTO·영속화는 deferred."
---

# T-0292 — P5 평가 orchestrator (Activity[] → EvaluationResult[])

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) 의 backbone 을 구현하는 평가 layer 의 **상위 compose slice** 다. 지금까지 P5 의 dependency-free piece 가 전부 MERGED 됐다 — T-0287(`Activity`→`EvaluationInput` 정규화 매퍼), T-0288(`EvaluationResult` 타입 + `calculateEvaluationVolume`), T-0289(평가-side dedup 순수 함수 2 종 — `dedupTemporalDuplicates` R-21 / `excludeSelfFollowUps` R-30), T-0290(`buildEvaluationPrompt` + `classifyNarrative`), T-0291(`EvaluationScoringService.scoreUnit` — 단위 1 건 scoring). 그러나 이들은 **단위 1 건** 또는 **순수 함수 조각**일 뿐이라, "수집된 `Activity` 목록을 받아 평가 입력으로 정규화 → 평가-side dedup/self-follow-up 제외 적용 → 남은 단위마다 scoring → 결과 목록 반환" 의 **전체 흐름을 묶는 layer 가 0** 이다. `EvaluationScoringService` 의 머리 주석이 명시하듯 "평가-side dedup / self-follow-up 제외 적용 … 여러 단위 사전 필터는 상위 orchestrator 책임", "`Activity` → `EvaluationInput` 매핑 … 입력 준비 단계(상위 orchestrator)" 가 바로 본 slice 의 빈자리다.

핵심 가치 — (1) ADR-0032 의 4 결정(§1 통합 평가 입력 정규화 / §2 단위 1 건당 generate 1 회 / §3 난이도·기여도·양 output / §4 평가-side dedup) 을 **하나의 end-to-end 평가 경로**로 in-process 완결한다. T-0287~T-0291 이 만든 부품을 처음으로 한 흐름에 배선한다. (2) 본 slice 는 **thin orchestration** — 새 알고리즘 0, 이미 검증된 매퍼 + dedup 2 종 + `scoreUnit` 의 compose 다. dedup 적용 순서(`dedupTemporalDuplicates` → `excludeSelfFollowUps`, 혹은 그 역)와 매핑·scoring 의 결합 순서만 본 orchestrator 가 명확히 박제한다. (3) `EvaluationScoringService` 를 생성자 주입(NestJS DI)받아 test 에서 mock `scoreUnit` 으로 검증 — 실 LLM 호출 0 / live credential 0 / 새 외부 dependency 0 / CI 비용·flaky 0, §5 게이트 미발화.

본 slice 는 **orchestrator service 1 + module provider 추가(controller 0) + colocated spec** 만 — 실 LLM 호출 0 / live credential 0 / 새 외부 dependency 0 / DB schema·Prisma migration 0 / controller·DTO·endpoint 0 (CLAUDE.md §5 게이트 미발화). 기존 매퍼·dedup 순수 함수와 `EvaluationScoringService` 를 그대로 재사용(시그니처 변경 0), test 에서 scoring service mock 주입.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — **§Decision (1) 평가 단위 계약(`Activity`→`EvaluationInput` 정규화)** + **(4) dedup + self-follow-up 제외 위치(평가-side)** + **§Follow-ups** (정독 — 본 task 가 묶는 흐름의 계약 source). 핵심 박제: (a) 평가 layer 는 수집을 재구현하지 않고 `Activity` 를 consume 만 함(ADR-0029 SRP 경계 존중). (b) self-follow-up 제외 + 시간적 중복(R-21)은 평가-side 순수 도메인 로직. (c) batch/aggregate 평가(일·주·월)는 상위 layer 후속 slice — 본 task 는 **단위 단위(per-unit) scoring 의 목록 처리**만, 일/주/월 집계는 범위 밖.
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) — orchestrator 가 주입받아 단위마다 호출할 `EvaluationScoringService.scoreUnit(input: EvaluationInput, options: ScoringOptions): Promise<EvaluationResult>` + `ScoringOptions`(`modelId: string`). **머리 주석의 책임 경계** — "여러 단위 사전 필터 = 상위 orchestrator 책임", "`Activity`→`EvaluationInput` 매핑 = 상위 orchestrator" — 가 본 task 가 채울 빈자리임을 확인.
- [src/assessment-evaluation/domain/evaluation-input.mapper.ts](../../src/assessment-evaluation/domain/evaluation-input.mapper.ts) — compose 대상 순수 함수 `mapActivityToEvaluationInput(activity: Activity): EvaluationInput`. orchestrator 가 `Activity[]` 를 `map` 으로 정규화하는 첫 단계. 재구현 0 — import 호출만.
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) — compose 대상 순수 함수 2 종 `dedupTemporalDuplicates(inputs): EvaluationInput[]`(R-21 earliest-wins) + `excludeSelfFollowUps(inputs): EvaluationInput[]`(R-30 self-follow-up 제외). orchestrator 가 정규화 후 적용. **적용 순서**(둘의 합성 순서)를 본 orchestrator 가 박제 — 두 함수 모두 입력 비변형·결정적이라 순서 선택의 결과를 JSDoc 으로 명시(권장: `dedupTemporalDuplicates` → `excludeSelfFollowUps`, 단 implementer 가 결정적 결과를 spec 으로 박제).
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — `EvaluationInput`(매퍼 출력 / dedup·scoring 입력 타입).
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) — `EvaluationResult`(scoreUnit 출력 / orchestrator 가 목록으로 반환).
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) — orchestrator 입력 타입 `Activity = GithubActivity | ConfluenceActivity`(L83) + `GithubActivity`(L65)/`ConfluenceActivity`(L74). orchestrator 는 이 typed surface 만 받는다(raw 본문 0, REQ-032).
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) — 본 module 에 orchestrator service 를 provider 추가 + export. 기존 `EvaluationScoringService` provider/export 패턴 mirror. controller 등록 0.

## Acceptance Criteria

### 신규/변경 파일 박제

- [ ] **`src/assessment-evaluation/evaluation-orchestrator.service.ts` 신설** — `@Injectable` orchestrator service. `EvaluationScoringService` 를 생성자 주입(NestJS class provider). 단일 public 메서드(예: `evaluateActivities(activities: Activity[], options: ScoringOptions): Promise<EvaluationResult[]>`):
  - **흐름(ADR-0032 §1/§4/§2 compose)**: (1) `activities.map(mapActivityToEvaluationInput)` 로 `Activity[]` → `EvaluationInput[]` 정규화. (2) 평가-side dedup 적용 — `dedupTemporalDuplicates` 와 `excludeSelfFollowUps` 를 박제한 순서로 합성(권장 `dedupTemporalDuplicates(inputs)` → `excludeSelfFollowUps(...)`). 적용 순서와 그 결정 근거를 JSDoc 에 명시. (3) 남은 각 `EvaluationInput` 에 대해 `scoringService.scoreUnit(input, options)` 호출 → `EvaluationResult[]` 수집 반환.
  - **scoring 직렬/병렬 정책 박제**: 단위별 `scoreUnit` 호출을 순차(for-await) 또는 병렬(`Promise.all`) 중 무엇으로 할지 JSDoc 에 명시(권장: 결정적·실패 격리 단순화를 위해 순차, 단 결과 순서는 dedup 후 입력 순서를 보존). ADR-0032 §2 의 "실패 격리" 정합 — 한 단위 scoring 실패 시 동작(전파 throw vs skip)을 박제·JSDoc 명시.
  - **빈 입력 / 전부 dedup 제거 경계**: `activities` 가 빈 배열이면 빈 `EvaluationResult[]` 반환(scoreUnit 호출 0). dedup 으로 전 항목이 합쳐져도 결정적 결과.
  - **순수 함수·service 재구현 금지**: 매핑/ dedup/ scoring 은 기존 import 호출만. orchestrator 는 compose + 순서 결정만 담당. `Activity`→`EvaluationInput`·dedup·`scoreUnit` 시그니처 변경 0.
  - 파일 머리 주석에 ADR-0032 §1/§4/§2 정합 + 책임 경계(controller/DTO·영속화·일/주/월 집계 batch 는 후속 slice) 명시. 기존 평가 layer 주석 스타일 mirror.
- [ ] **`src/assessment-evaluation/assessment-evaluation.module.ts` 갱신** — `EvaluationOrchestratorService` 를 provider 등록 + export(후속 controller/orchestrator-상위 slice 가 inject). `EvaluationScoringService` 가 이미 provider 라 추가 import 0(같은 module 내 DI resolve). LlmModule import 등 기존 wiring 변경 0. module compile 자기충족(module.spec 으로 검증).
- [ ] **`src/assessment-evaluation/evaluation-orchestrator.service.spec.ts` 신설(colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2). `EvaluationScoringService` 는 **mock**(`{ scoreUnit: jest.fn() }` 또는 `Test.createTestingModule` + `overrideProvider`)으로 주입 — **실 LLM 호출 0 / 실 네트워크 0 / live credential 0**:
  - **happy-path** — `Activity[]`(github commit + github issue + confluence page 혼합 ≥2 건) 입력 시 매핑 → dedup → scoreUnit 호출 → `EvaluationResult[]` 가 올바른 순서·개수로 반환됨 1+ test. scoreUnit mock 이 호출된 input 의 `unitId`/`contributionKind`(code/document 정규화) 가 매퍼 결과와 일치함 단언.
  - **scoreUnit 호출 검증** — dedup 후 남은 단위 수만큼 정확히 `scoreUnit` 이 호출되고, 각 호출에 정규화된 `EvaluationInput` + 전달된 `options`(modelId) 가 넘어감 1+ test.
  - **dedup 적용 검증(branch)** — (i) 동일 `unitId` 가 서로 다른 timestamp 로 중복된 `Activity` 입력 시 `dedupTemporalDuplicates` 효과로 earliest 1 건만 scoring 됨 1+ (R-21). (ii) 같은 issue(document) 의 동일 author self-follow-up 입력 시 `excludeSelfFollowUps` 효과로 최초 기여만 scoring 됨 1+ (R-30). (iii) 다른 author 의 동일 베이스 단위는 모두 보존됨 1+.
  - **error path** — mock `scoreUnit` 이 reject(특정 단위에서 throw) 시 orchestrator 의 동작(전파 throw vs skip)이 JSDoc 박제 정책과 일치함 1+ test.
  - **branch/negative** — (i) 빈 `Activity[]` → 빈 `EvaluationResult[]` 반환 + `scoreUnit` 호출 0 (1+). (ii) code 기여만(self-follow-up 부적용 분기) 입력 시 dedup 으로 누락 0 (1+). (iii) contributionKind code vs document 분기 각 1+. (iv) dedup 으로 모든 항목이 1 건으로 합쳐지는 경계(동일 unitId 다수) 1+.
  - **determinism / no-side-effect** — 동일 `Activity[]` + 동일 mock 응답 → 동일 `EvaluationResult[]`(순서·내용) 2 회 호출 1+. 입력 배열 비변형 단언 1+.
  - **branch cover** — dedup 적용 순서 분기 / scoring 직렬·실패 격리 분기(있으면) 각 1+.

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/evaluation-orchestrator.service.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 orchestrator 의 line/function/branch 높은 커버리지 목표(thin compose 라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 회귀 0 확인 — 실 LLM 호출 없으므로 smoke/e2e 영향 0).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)) + approval-gate (CI step "reviewer agent approval 검증") 통과.
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **평가 controller / DTO / HTTP endpoint / R-9 사용자 지정 기간 요청** — ADR-0032 Follow-up(평가 controller / DTO slice). 본 orchestrator 가 controller 의 호출 대상이 되지만, controller 배선 자체는 별도 후속 slice. 본 slice 는 service layer 만 — HTTP 0.
- **일/주/월 aggregate 평가 / batch prompting(PLAN P5 L97)** — 본 orchestrator 는 **단위별(per-unit) scoreUnit 의 목록 처리**만. 일/주/월 집계·요약 평가는 상위 layer 후속 slice(ADR-0032 §2 batch 경계 박제).
- **실 LLM 호출 / live endpoint / 실 provider API key / LLM_APIKEY_ENC_KEY 주입** — `EvaluationScoringService` 는 test 에서 **mock** 만. 실 네트워크 round-trip / live credential 은 §5 credential 게이트(미승인) → 별도 후속 task(deferred).
- **새 외부 dependency 추가** — 기존 매퍼·dedup 순수 함수 + `EvaluationScoringService` + NestJS 만. octokit/axios/sdk 등 추가 0 (§5 dependency 게이트 미발화).
- **평가 결과 영속화 / Prisma migration / `EvaluationResult` → Assessment·Contribution row 매핑** — §5 schema 게이트 deferred(ADR-0032 §Consequences). 본 orchestrator 는 in-memory `EvaluationResult[]` 반환만 — DB write 0.
- **수집 mapper 확장 / issue comment thread 수집** — self-follow-up comment-level 정밀 검출용 수집 확장(ADR-0029 경계)은 별도 Follow-up slice. 본 slice 는 T-0289 의 issue 단위 휴리스틱 dedup 을 그대로 적용만.
- **`Activity`→`EvaluationInput` 매퍼 / dedup 순수 함수 / `scoreUnit` / `ScoringOptions` 시그니처 변경** — 전부 박제 완료(import·주입 호출만, neue 정의 0). 새 타입 도입이 정말 필요하면(예: orchestrator 옵션 타입) 최소 1 개만, 기존 `ScoringOptions` 재사용 우선.
- **PLAN.md L96(단위 평가 bullet) `[ ]`→`[x]` flip** — 본 slice 1 건으로 P5 단위 평가 종료 아님(controller + 영속화 후속 필요). 후속 slice 완결 후 별도 doc-sync.
- **ADR-0032 PROPOSED→ACCEPTED status flip + §2/§3 difficulty 주입 문구 doc-sync** — T-0291 reviewer MINOR follow-up. ADR status 전환은 별도 direct doc task — 본 코드 slice 와 분리(§3.1 commitMode mix 금지).

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 §1/§4/§2/§Follow-ups 가 박제 완료, orchestrator 는 기존 매퍼 + dedup + scoring service 의 thin compose). dedup 적용 순서·scoring 직렬/실패 격리 정책은 implementer 가 결정적 결과를 spec 으로 박제하는 수준이라 ADR 불요(새 도메인 결정 0 — 기존 부품 합성 순서만). implementer 가 `evaluation-orchestrator.service.ts` 신설 + `assessment-evaluation.module.ts` provider 추가, tester 가 colocated spec 작성 + mock scoring service + R-112 4 종 + dedup branch cover + negative cover + coverage 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
