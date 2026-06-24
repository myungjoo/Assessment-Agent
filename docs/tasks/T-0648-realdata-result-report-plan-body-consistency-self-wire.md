---
id: T-0648
title: buildRealDataResultReportPlan 산출 직전 assertRealDataResultIssueDescriptorBodyConsistent self-wire 배선 (T-0647 builder self-wire 의 composer-side mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — report-plan 컴포저가 summary+descriptor 둘 다 in-scope 인 지점에서 body 구조 가드 self-assert. T-0647 builder self-wire 의 composer-side mirror. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan.ts
  - test/helpers/realdata-e2e-result-report-plan.spec.ts
---

# T-0648 — buildRealDataResultReportPlan 산출 직전 body 구조 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 composer-side self-guard 배선 slice. realdata-e2e-result-summary-line stream 은 한 줄 요약을 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·body 3블록 구조 불변식 순수 가드 신설(T-0646, `assertRealDataResultIssueDescriptorBodyConsistent`)·**builder self-wire**(T-0647, `buildRealDataResultIssueDescriptor` 가 descriptor 반환 직전 self-assert)까지 닿았다.

`buildRealDataResultReportPlan(results, run)` 는 그 한 단계 위의 **종단 컴포저** 다 — `buildRealDataResultSummary(results)` 로 `summary` 를 집계하고 `buildRealDataResultIssueDescriptor(summary, run)` 로 `descriptor` 를 합성해 `{ summary, descriptor }` plan 을 반환한다. 즉 이 컴포저는 **`summary` 와 `descriptor` 를 동시에 in-scope 로 갖는 유일한 상위 지점** 이며, body 구조 불변식을 재유도 검증하는 데 필요한 두 입력(summary 로 기대값 재유도 + descriptor 의 실제 body 대조)을 모두 손에 쥐고 있다.

그러나 컴포저는 현재 두 위임 helper 의 산출을 **그대로 묶어 반환할 뿐, 자기 plan 의 `{ summary, descriptor }` 가 body 구조상 정합한지 반환 직전 self-assert 하지 않는다**. T-0647 이 builder 단계에서 self-wire 를 닫았으므로 정상 경로에서는 이미 한 번 검증되지만, 본 컴포저는 자기 **반환 계약** (`summary` 와 `descriptor` 가 서로 정합한 한 묶음이라는 보장) 을 스스로 강제하지 않는다 — 미래에 컴포저 합성 순서·위임 대상이 회귀(예: summary 와 descriptor 가 서로 다른 입력에서 산출되도록 잘못 배선)해도 컴포저는 부정합 plan 을 그대로 반환한다.

본 task 는 그 빈칸을 채운다 — `buildRealDataResultReportPlan` 이 `return { summary, descriptor };` 직전에 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 로 자기 plan 의 두 구성요소가 body 구조상 정합함을 self-assert 한다. 이는 T-0647 이 builder 반환 직전 동일 가드를 self-assert 한 패턴의 **정확한 composer-side mirror** 다 — 같은 "이미 신설된 순수 가드를 산출처 자신이 반환 직전 호출해 자기 산출을 fail-fast 검증" 이고, 대상이 단일 descriptor 가 아니라 `{ summary, descriptor }` plan 의 **상호 정합성** 이다. 정상 합성이면 가드는 void 반환하므로 컴포저 동작·반환값은 byte-identical 보존되고, 회귀가 생기면 컴포저가 부정합 plan 을 반환하기 전에 한국어 명세형 에러로 즉시 throw 한다.

## Required Reading

- [test/helpers/realdata-e2e-result-report-plan.ts](../../test/helpers/realdata-e2e-result-report-plan.ts) — `buildRealDataResultReportPlan(results, run)` (L109~125). 본 task 는 L124 의 `return { summary, descriptor };` 직전에 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 한 줄을 배선한다. import 블록(L61~67)에 `assertRealDataResultIssueDescriptorBodyConsistent` import 1줄 추가. **`summary` 집계·`descriptor` 합성 위임 호출·합성 순서·주석 본문 변경 0** (가드는 두 위임 산출 후 반환 직전에만 끼움). 빈 `results` 정상 집계 동작·run guard 전파 동작 보존.
- [test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts](../../test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts) — `assertRealDataResultIssueDescriptorBodyConsistent(descriptor: RealDataResultIssueDescriptor, summary: RealDataResultSummary): void` (T-0646, L131~). 본 task 가 컴포저 반환 직전 self-wire 할 순수 가드. 본문 변경 0 (import·호출만). **순환 import 주의**: 이 helper 의 import 는 descriptor(type-only)·summary(type-only)·summary-line formatter·summary-markdown renderer 뿐이며 **report-plan 을 import 하지 않는다** → report-plan 컴포저가 이 helper 의 값(함수)을 import 해도 runtime cycle 0 (안전). 빌드 시 `pnpm build` (tsc) 로 순환 부재 확인.
- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `buildRealDataResultIssueDescriptor` (T-0647) self-wire 패턴 **참조만**: builder 가 descriptor 반환 직전 자기 산출을 동일 가드로 self-assert 한 동형 mirror. 본 task 는 그 "산출처 자신이 반환 직전 신설 가드 호출" 패턴을 종단 컴포저 측으로 mirror. 본문 변경 0.
- [test/helpers/realdata-e2e-result-report-plan.spec.ts](../../test/helpers/realdata-e2e-result-report-plan.spec.ts) — 기존 happy/error/branch/negative describe 블록. 본 task 가 "정상 results/run → 컴포저가 self-guard 통과해 정상 `{ summary, descriptor }` 반환 / self-wire 후에도 summary·descriptor byte-identical 회귀 0 / 가드가 컴포저 산출 경로에 실제 배선됐고 정확히 1회·`(descriptor, summary)` 인자로 호출됨" 검증을 append 할 colocated spec. (컴포저가 항상 정합 summary/descriptor 를 합성하므로 self-guard 가 throw 하는 negative 는 컴포저 입력으로 직접 유발 불가 — 그 검증은 T-0646 의 helper-직접 spec 가 이미 cover; 본 spec 은 self-wire 가 컴포저 동작을 깨지 않음 + 가드가 실제 호출 경로에 배선됐음에 집중.)

## Acceptance Criteria

- [ ] `buildRealDataResultReportPlan` 의 `return { summary, descriptor };` 직전에 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)` 호출을 배선 (산출 plan 의 두 구성요소가 body 구조상 정합함을 반환 전 self-assert). 정상 합성이면 void 반환 → 동작·반환값 byte-identical 보존.
- [ ] **import 1줄 추가** — `assertRealDataResultIssueDescriptorBodyConsistent` 를 `./realdata-e2e-result-issue-descriptor-body-consistency` 에서 import. 다른 import·`buildRealDataResultSummary`·`buildRealDataResultIssueDescriptor` 위임 호출·합성 순서 변경 0.
- [ ] **순환 import 부재 확인** — body-consistency helper 가 report-plan 을 import 하지 않으므로 runtime cycle 0. `pnpm build` (tsc) 가 순환·타입 에러 없이 green.
- [ ] **summary·descriptor byte-identical 보존** — self-wire 전/후 정상 입력에 대한 `summary`·`descriptor` 산출 완전히 동일 (가드는 검증만, 합성 0 변경). 기존 spec 의 summary/descriptor 기대 구조 회귀 0.
- [ ] **run guard 전파 보존** — `run.gitSha`/`run.dateToken` 빈/공백 → 위임 `buildRealDataResultIssueDescriptor` 의 `assertNonBlank` throw 가 descriptor 단계에서 먼저 전파(body-consistency self-guard 도달 전). self-wire 가 기존 guard 우선순위·한국어 메시지·동작을 깨지 않음.
- [ ] **순수성·무공유·R-59 보존** — 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장 (R-59 — 가드는 count·volume·분포·markdown 카운트만 비교, narrative/raw 미접촉). 입력 `results`/`run` 읽기만 (mutate 0). 매 호출 새 plan 객체(+새 summary/descriptor 트리) 반환. 외부 validation 라이브러리 도입 0.
- [ ] **Happy-path test 1+**: 정상 results (단일·다수 EvaluationResult, difficulty/contribution 섞임, totalVolume>0) + 정상 run → 컴포저가 self-guard 통과해 정상 `{ summary, descriptor }` 반환 (throw 0). 빈 `results` 배열(count 0·전 슬롯 0·totalVolume 0) + 정상 run 도 정상 통과. 1+.
- [ ] **Error path test 각 1+**: ① 빈/공백-only gitSha run → 위임 한국어 throw (descriptor 단계, body-consistency self-guard 도달 전) ② 빈/공백-only dateToken run → 위임 한국어 throw. 각 1+ (필드별·빈/공백별 분기 — self-wire 가 기존 run guard 우선순위를 깨지 않음 검증).
- [ ] **Flow/branch test**: ① 정상 results → self-guard 통과 → 정상 plan 반환 분기 1 ② 빈 results (count 0, volume 0) → 정상 plan 반환 분기 1 ③ 다수 result·다양한 분포 → 정상 plan 반환 분기 1 ④ gitSha guard throw 분기 1 ⑤ dateToken guard throw 분기 1 — 각 1+ test 로 분기 격리. (컴포저는 항상 정합 summary/descriptor 를 합성 → body-consistency self-guard throw 분기는 컴포저 입력으로 직접 유발 불가, 분기 없음 명시.)
- [ ] **Negative cases 충분 cover (각 1+)**: ① **self-wire 배선 검증** — 가드가 컴포저 산출 경로에 실제 배선됐음을 검증 (예: body-consistency helper 모듈의 export 를 `jest.spyOn` 으로 감시해 컴포저 호출 시 정확히 1회·`(descriptor, summary)` 인자로 호출됨 assert, 또는 동등한 배선 증명). ② **결정성** — 동일 (results, run) 2회 호출 → 둘 다 동일 plan (self-wire 후에도 결정성 보존). ③ **입력 비변형** — 호출 후 results 배열·각 EvaluationResult·run 객체 변경 0 assert. ④ **byte-identical 회귀 0** — self-wire 추가가 summary/descriptor byte 를 바꾸지 않음 assert (정상 입력). ⑤ **무공유** — 반환 plan 의 summary/descriptor mutate 가 입력·다음 호출 결과에 누설되지 않음 assert. ⑥ **R-59** — descriptor.body 가 raw narrative 키/본문을 담지 않음. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec** — 검증은 기존 colocated `test/helpers/realdata-e2e-result-report-plan.spec.ts` 에 append (컴포저의 spec). 신규 spec 파일 신설 불요 (body-consistency helper 자체 spec 은 T-0646 이 이미 신설).
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 파일 line/branch/function/statement 커버 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `assertRealDataResultIssueDescriptorBodyConsistent` (T-0646) 본문·검증 로직·에러 정책·signature 변경 — 본 task 는 import·호출 배선만 (helper 본문 변경 0).
- `buildRealDataResultSummary` (T-0580) · `buildRealDataResultIssueDescriptor` (T-0582/T-0647) · 합성 순서 본문·출력 형태 변경 — 본 task 는 두 위임 산출 후 반환 직전 가드 호출 1지점 배선만.
- 이중 단언 도입 — 컴포저 안에 가드를 중복 호출하거나 builder self-guard(T-0647)·formatter self-guard(T-0644)와 겹치는 검증 추가 0. self-wire 는 컴포저 반환 직전 정확히 1회만.
- `buildRealDataResultIssueCommandArgs` (T-0583) / `buildRealDataResultIssueCommandPlan` (T-0588) / publish-plan / gh-argv 측 body 가드 배선 — 본 task 는 report-plan 종단 컴포저 1지점 self-wire 만. (command-args 측 배선은 자연 follow-up — Follow-ups 참조.)
- 실 gh issue 호출 · `gh issue create`/`comment` · daily-test step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·plan 재합성 — self-guard 가 위반 검출 시 fail-fast throw 전파만 (본 task 는 배선만, 부정합 plan 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 컴포저 self-wire 1지점 배선만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 body 구조 불변식이 신설·builder self-wire·**컴포저 self-wire** 까지 닿는다. 자연 후속 후보: ① `buildRealDataResultIssueCommandArgs` (T-0583) 가 descriptor.body 를 create/update args 로 전파하는 consumer 경계에서 body 정합 재확인 — 단 command-args 는 `summary` 를 in-scope 로 갖지 않아 full body-consistency 가드 직접 배선 불가, descriptor-only 구조 가드(marker-first 등)가 필요하면 별도 slice. ② gh issue 실배선 — `gh issue create`/`comment` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)
