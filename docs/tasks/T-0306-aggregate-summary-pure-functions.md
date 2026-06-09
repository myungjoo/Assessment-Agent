---
id: T-0306
title: aggregate Summary 집계 매퍼 + isPeriodEvaluable 시점 판정 (순수 함수, ADR-0035 §Decision 1·3 구현 slice)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-034, REQ-035, REQ-036]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-06-09
plannerNote: ADR-0035 §Follow-ups 두 번째 구현 slice — 일·주·월 Summary 의 (a) deterministic metricScore 집계 순수 함수(unit Contribution[]/EvaluationResult[] → metricScore Decimal, ADR-0035 §Decision 1) + (b) isPeriodEvaluable(period, periodStart, now) 시점 판정 순수 함수(§Decision 3). 둘 다 LLM·DB·side-effect 0 의 순수 함수라 mocked 없이 R-112 100% 검증 가능. metricScore 축약 수식은 implementer 가 결정·문서화(REQ-036 상대 비교 의미 보존), reviewer 가 validate. narrative(LLM batch)·DB write·배선은 후속 slice. T-0299(ADR-0033 mapper) 패턴 동형, architect 불요(ADR §Decision 1·3 가 규칙 박제) → implementer→tester. dep0/credential0.
---

# T-0306 — aggregate Summary 집계 매퍼 + isPeriodEvaluable 시점 판정 (순수 함수)

## Why

ADR-0035 (da8089e 머지) §Follow-ups 의 dependency-free 구현 chain 두 번째 slice 다. 첫 slice(T-0305)가 `Summary @@unique` schema backbone 을 박제했고, 본 slice 는 그 위에서 aggregate 평가의 **순수 계산 layer** 2 개를 구현한다 — DB write·LLM 호출 없이 결정적으로 검증 가능한 부분을 먼저 닫는다(ADR-0035 §Decision 1 의 "두 축 독립성" — metricScore deterministic 집계는 LLM mock 없이 독립 검증):

1. **deterministic metricScore 집계 순수 함수** (ADR-0035 §Decision 1) — 한 (person, period, periodStart) 좌표의 단위 결과(`Contribution[]` 또는 `EvaluationResult[]`)를 단일 `metricScore` Decimal 로 축약. `mapEvaluationResultsToAssessment`(T-0299)의 deterministic 집계(volume Σ / difficulty max / contributionScore avg) precedent 를 mirror 하되, 다신호 → 1 Decimal 축약 수식을 결정한다.
2. **`isPeriodEvaluable(period, periodStart, now): boolean` 시점 판정 순수 함수** (ADR-0035 §Decision 3) — 평가 대상 구간 `[periodStart, periodEnd)` 가 완전히 종료된 후(`now ≥ periodEnd`)에만 true. day→다음 자정 / week→다음 주 / month→다음 달.

이 두 순수 함수가 닫혀야 후속 chain(aggregate write service = reset-and-recreate + batch LLM narrative → orchestrator/controller batch endpoint → doc-sync)이 이들을 조립해 진입할 수 있다. 둘 다 `now`/입력을 주입받는 결정적 순수 함수라 mocked-LLM·DB 없이 R-112 4 종 + negative 를 100% cover 한다.

## Required Reading

- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` — 특히 §Decision 1(Summary 집계 규칙: metricScore deterministic / narrative LLM 분리, 집계 source = 영속 `Contribution[]` 우선) + §Decision 3(시점 경계 `isPeriodEvaluable`, day/week/month periodEnd, timezone Q-0026 의존) + §Decision 2(Summary 영속화 매핑 — 좌표·granularity). 본 slice 의 결정 source.
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` — deterministic 집계 precedent(volume Σ / difficulty max / contributionScore avg). 본 slice 의 metricScore 축약이 mirror·재사용할 패턴.
- `src/assessment-evaluation/domain/evaluation-result.ts` — 단위 `EvaluationResult` shape(집계 입력 타입).
- `src/assessment-evaluation/domain/evaluation-volume.ts` — volume aggregate 패턴.
- `prisma/schema.prisma` Summary 모델(L341–361) — 집계 출력의 target field(`personId` / `period` / `periodStart` / `metricScore` Decimal / `narrative`(본 slice 밖)).
- `src/user/assessment.service.ts` L40 `VALID_PERIODS = ["day","week","month"]` — period granularity literal(재사용 / 알 수 없는 period negative test source).
- `src/assessment-evaluation/domain/` 디렉토리의 기존 순수 함수 + colocated spec 패턴(파일 명명·describe/it idiom).
- `README.md` L61~L63 — 시점 경계(자정/주/월) + "Metric 수치" 요구의 source.

## Acceptance Criteria

- [ ] **순수 함수 1 — deterministic metricScore 집계**: 한 좌표의 단위 결과(`Contribution[]` 또는 `EvaluationResult[]` — ADR-0035 §Decision 1 의 "영속 source 우선") → 단일 `metricScore`(Prisma `Decimal` 호환 표현, 예: `Prisma.Decimal` 또는 string/number → 변환) 로 축약하는 순수 함수를 `src/assessment-evaluation/domain/` 에 신규 추가. **LLM·DB·side-effect 0**, 입력만으로 결정적. 축약 수식(가중합 / 정규화 / 대표값 등)은 implementer 가 선택하되 **주석으로 근거 문서화** — volume/difficulty/contributionScore 신호를 어떻게 1 Decimal 로 합치는지 + **REQ-036 상대 비교 의미를 왜곡하지 않음**(같은 규칙이 모든 person 에 동일 적용되어 per-person metricScore 비교가 유의미)을 명시. `evaluation-result.persist.mapper.ts` 의 집계 헬퍼(volume Σ / difficulty ordinal / score avg) 재사용 가능하면 재사용.
- [ ] **순수 함수 2 — `isPeriodEvaluable(period, periodStart, now): boolean`**: `src/assessment-evaluation/domain/` 에 신규 추가. `now ≥ periodEnd` 일 때만 true. periodEnd = periodStart + 1 granularity(day = +1일, week = +1주, month = +1달 — 달력 month 가변 일수 처리). 알 수 없는 period 는 throw(또는 정의된 거부). **순수·결정적**(`now` 주입). timezone 경계는 주입 파라미터 또는 문서화된 default 로 처리하고 **Q-0026(SinceDerivation timezone) 의존을 주석에 명시**(ADR-0035 §Decision 3).
- [ ] 두 함수 모두 colocated `*.spec.ts` 신규 작성.
- [ ] **R-112 happy path**: (1) 정상 단위 묶음 → 기대 metricScore 산출 1+ test. (2) 완전히 종료된 구간 → `isPeriodEvaluable` true 1+ test(day/week/month 각 1+).
- [ ] **R-112 error path**: (1) 빈 단위 묶음(`[]`) 의 metricScore 정의된 동작(0 또는 명시 규칙) 1+ test. (2) `isPeriodEvaluable` 에 알 수 없는 period 입력 → throw 1+ test.
- [ ] **R-112 branch / negative cases 충분 cover**: (a) 진행 중 구간(`now < periodEnd`) → `isPeriodEvaluable` false 1+ test, (b) 경계값 `now == periodEnd` → true(반열림 `[start,end)` 종료 직후) 1+ test, (c) `now == periodEnd - 1ms`(직전) → false 1+ test, (d) day/week/month 각 periodEnd 산술이 정확(특히 month 의 가변 일수: 1월말→2월, 2월말 등) 1+ test, (e) metricScore 가 단일 신호 편중되지 않음(volume 만 크고 score 0 등 mixed 입력)의 결정적 산출 1+ test.
- [ ] **R-112 coverage 통과**: `pnpm test:cov` line ≥ 80% AND function ≥ 80%(순수 함수라 100% 목표). 신규 함수/spec 이 기존 coverage 를 떨어뜨리지 않음.
- [ ] `pnpm lint` / `pnpm build` / `pnpm test` 통과.
- [ ] PR 본문에 ADR-0035 §Decision 1·3 / 축약 수식 선택 근거(REQ-036 보존) / 새 dep 0 / credential 0 / narrative·DB·배선은 후속 slice 명시.

## Out of Scope

- LLM batch narrative 생성(`LlmHttpGateway.generate` 호출) — aggregate write service slice(ADR-0035 §Decision 5).
- Summary DB write / reset-and-recreate / fill·reeval / partial-reset — write service slice(§Decision 4).
- orchestrator / controller batch 평가 endpoint 배선 — 배선 slice.
- `data-model.md` / `modules.md` / `api.md` doc-sync — doc-sync slice(direct).
- ADR-0035 status PROPOSED → ACCEPTED flip — 별도 task(구현 chain 검증 후 마지막).
- 실제 scheduler 자동화(@nestjs/schedule) — §5 새 dep, P7(ADR-0035 §Decision 3 OUT).
- timezone(Asia/Seoul vs UTC) 확정 — Q-0026 동행 결정. 본 slice 는 주입 파라미터/default 로 처리하고 의존만 명시.
- 새 외부 dependency / credential — §5 게이트, 본 slice 미해당(내장 + 기존 도메인 헬퍼만).

## Suggested Sub-agents

`implementer → tester`

(architect 호출 불필요 — ADR-0035 §Decision 1·3 이 집계 규칙·시점 경계 규칙을 박제했다. metricScore 축약 수식은 본 slice 의 결정적 순수 함수 micro-decision 으로 implementer 가 선택·문서화하고 reviewer 가 REQ-036 보존을 validate. 만약 implementer 가 축약 수식이 ADR-worthy design 결정이라 판단하면 BLOCKED 처리로 escalate.)

## Follow-ups

(비어 있음 — 매 sub-agent 가 작업 중 발견한 관련 항목을 여기 append.)
