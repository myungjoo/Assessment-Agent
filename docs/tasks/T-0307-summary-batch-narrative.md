---
id: T-0307
title: Summary batch 정성 narrative 생성 서비스 (한 person-period unit 묶음 → 1 LLM 호출, ADR-0035 §Decision 5 구현 slice)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-034, REQ-035, REQ-036]
estimatedDiff: 200
estimatedFiles: 4
created: 2026-06-10
plannerNote: ADR-0035 §Follow-ups write service slice를 cap(300 LOC/5파일) 초과 회피 위해 2 분할한 첫 조각 — batch 정성 narrative 생성(§Decision 5). 한 (person, period, periodStart) 좌표의 단위 묶음(Contribution[]/EvaluationResult[])을 typed surface(raw 0)로 batch prompt 조립 → LlmHttpGateway.generate 1회(mocked-LLM unit) → narrative string. cross-person 묶음 금지. DB write·metricScore 결합·reset-and-recreate 는 다음 slice(T-0308 write service). 단위 평가 chain 의 prompt+classify(T-0290) 분리 패턴 동형. architect 불요(ADR-0035 §Decision 5 가 batch 경계 박제), implementer→tester. dep0/credential0(기존 LlmHttpGateway + mocked-fetch).
---

# T-0307 — Summary batch 정성 narrative 생성 서비스

## Why

ADR-0035 (97b253e 머지된 순수 함수 slice 까지 완료) §Follow-ups 의 "aggregate 평가 write service" 는 (a) batch 정성 narrative 생성(LLM) + (b) reset-and-recreate Summary write(DB) 를 함께 담으면 cap(300 LOC / 5 파일)을 초과한다. 그래서 단위 평가 chain 이 prompt+classify(T-0290) ↔ scoring(T-0291) ↔ orchestrator(T-0292) 로 나눴던 것과 동형으로 **2 분할**한다. 본 task 가 첫 조각 — **LLM 정성 narrative 생성**이다(ADR-0035 §Decision 1 의 "narrative = LLM 정성 batch", §Decision 5 의 batch 경계).

한 (person, period, periodStart) 좌표의 단위 묶음을 입력받아 **1 회 LLM `generate` 호출**로 그 구간의 요약 평가문(narrative)을 생성한다. 다음 slice(T-0308 write service)가 이 narrative 와 `aggregateMetricScore`(T-0306) 의 metricScore 를 결합해 `Summary` 에 reset-and-recreate write 한다.

## Required Reading

- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` — 특히 §Decision 5(batch prompt 경계: 한 person-period unit 묶음 = 1 호출, cross-person 금지, typed surface 만 raw 0, mocked-LLM unit 검증, live 는 §5 후속) + §Decision 1(narrative = LLM 정성 batch) + §Decision 2(R-59 raw 미저장).
- `src/llm/llm-gateway.interface.ts` — `LlmHttpGateway` / `generate` 시그니처 + `LlmGenerateResult`(narrative field) 구조. **변경 0** 으로 재사용.
- `src/llm/llm-http-gateway.service.ts` — `generate` 호출 + 주입(@Optional FetchLike) 패턴 + unit 에서 mock 주입 방법(기존 spec 참조).
- `src/assessment-evaluation/` 의 **단위 평가 prompt 조립 + LLM 호출 서비스**(T-0290 prompt+classify 결과물 — 예: prompt builder / evaluation 호출 서비스)를 찾아 mirror(prompt 조립 idiom·gateway 주입·mock 패턴).
- `src/assessment-evaluation/domain/evaluation-result.ts` + `evaluation-result.persist.mapper.ts` — 단위 묶음 입력 타입(narrative/difficulty/contribution/volume typed surface).
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` §2 — gateway 무변경 재사용 + prompt shape 선례.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/` 에 batch narrative 생성 서비스/함수 신규 추가 — 입력: 한 (person, period, periodStart) 좌표의 단위 묶음(`Contribution[]` 또는 `EvaluationResult[]`) + context(personId/period/periodStart). 출력: narrative string(또는 `{narrative}`). 처리: (1) **typed surface 만으로 batch prompt 조립**(per-unit narrative/difficulty/contribution/volume — raw 본문 commit message/diff/issue body/page HTML 0, §Decision 2/5), (2) `LlmHttpGateway.generate(prompt, options)` **1 회 호출**, (3) 결과 `narrative` 반환.
- [ ] **batch 경계 강제**: 1 호출 입력은 정확히 1 좌표(한 person 의 한 period)의 unit 들. cross-person 묶음 불가(시그니처/구현이 단일 person-period 만 받음).
- [ ] gateway 시그니처 **변경 0**(ADR-0032 §2 mirror). 새 외부 dependency 0(기존 `LlmHttpGateway`), 새 credential 0(mocked-LLM unit, live 는 §5 후속).
- [ ] **R-112 happy path**: 정상 단위 묶음 → prompt 가 typed surface 로 조립되고 gateway mock 이 반환한 narrative 가 그대로 반환됨 1+ test.
- [ ] **R-112 error path**: (1) gateway 가 throw/reject(네트워크·non-2xx) → 서비스가 그대로 전파(또는 정의된 처리) 1+ test, (2) 빈 단위 묶음 입력의 정의된 동작(빈 prompt 회피 또는 명시 규칙) 1+ test.
- [ ] **R-112 branch / negative cases 충분 cover**: (a) prompt 에 raw 본문이 포함되지 않음(typed surface 만) 검증 1+ test, (b) gateway 가 빈/누락 narrative 반환 시 정의된 처리 1+ test, (c) 단일 unit vs 다수 unit 묶음 모두 1 호출로 처리 1+ test, (d) gateway 호출이 정확히 1 회(batch — N unit 에 N 호출 아님) 1+ test(mock call count).
- [ ] **R-112 coverage 통과**: `pnpm test:cov` line ≥ 80% AND function ≥ 80%(신규 서비스). mocked-LLM 이라 DB·실 network 불요.
- [ ] `pnpm lint` / `pnpm build` / `pnpm test` 통과.
- [ ] PR 본문에 ADR-0035 §Decision 5 / batch 경계(1 person-period = 1 호출) / typed surface raw 0 / 새 dep 0 / credential 0 / write·metricScore 결합은 T-0308 명시.

## Out of Scope

- `Summary` DB write / reset-and-recreate / fill·reeval / partial-reset — 다음 slice(T-0308 write service)가 본 narrative + `aggregateMetricScore`(T-0306) metricScore 를 결합해 수행.
- metricScore 계산 — 이미 T-0306 `aggregateMetricScore` 가 담당(본 slice 는 narrative 만).
- `isPeriodEvaluable` 시점 게이트 적용 — write service / orchestrator slice 책임(이미 T-0306 함수 존재).
- orchestrator / controller batch endpoint 배선 — 후속 slice.
- live LLM 실 호출 — §5 credential, 후속(본 slice 는 mocked-LLM unit).
- doc-sync / ADR-0035 ACCEPTED flip — 후속.
- 새 외부 dependency / credential — §5 게이트, 본 slice 미해당.

## Suggested Sub-agents

`implementer → tester`

(architect 호출 불필요 — ADR-0035 §Decision 5 가 batch 경계[1 person-period = 1 호출, cross-person 금지, typed surface raw 0]를 박제했다. prompt 문구 micro-decision 은 implementer 가 단위 평가 prompt builder mirror 로 결정, reviewer 가 raw 미포함·batch 경계 validate. 만약 prompt 설계가 ADR-worthy 라 판단되면 BLOCKED escalate.)

## Follow-ups

(비어 있음 — write service 는 T-0308 로 별도 큐잉 예정.)
