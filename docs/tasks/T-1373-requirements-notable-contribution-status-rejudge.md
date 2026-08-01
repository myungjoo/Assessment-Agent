---
id: T-1373
title: requirements.md 30 행 REQ-011 중요·어려운 기여 높은 점수 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-011]
estimatedDiff: 22
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1373-requirements-notable-contribution-status-rejudge.md
plannerNote: "requirements-status-resync 19 번째 slice — notable-contribution 심볼 쌍(R-25 명시)은 REQ-019 가 아니라 REQ-011 축이라 잔여 PLANNED row 중 근거 밀도 최상"
---

# T-1373 — requirements.md 30 행 REQ-011 중요·어려운 기여 높은 점수 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 30 행 REQ-011 (README 25 행 — "중요하고 어려운 기여에 높은 점수를 준다 — 어렵고 남이 못할 일") 은 아직 상태 컬럼이 `PLANNED` 이지만, `evaluation-notable-contribution-signal.ts` 의 `computeNotableContributionSignal` (+ `NOTABLE_RELATIVE_CEILING`) 과 `evaluation-notable-contribution-adjust.ts` 의 `applyNotableContributionAnnotation` (+ `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER`) 이 실재하고 detection / adjustments 두 pipeline 에 wiring 돼 있어 표가 코드베이스와 어긋날 가능성이 크다. 두 파일의 상단 주석이 스스로 "R-25 / REQ-011" 을 책임 범위로 명시하므로 (직전 T-1372 의 Out of Scope 가 이 축을 REQ-019 로 지목한 것은 오지정), `requirements-status-resync` stream 의 19 번째 slice 로 REQ-011 부터 표를 코드 실측에 되돌린다.

## Required Reading

- `docs/requirements.md` — 30 행 (REQ-011) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum. 인접 REQ-013 (32 행) · REQ-018 (37 행) 의 `DONE` 상태 문자열은 서술 포맷 참고용이며 그 실측값을 본 task 근거로 재인용하지 않는다
- `docs/tasks/T-1372-requirements-zero-contribution-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 25 행 — REQ-011 의 원문 지시 (축 = (a) 중요·어려운 기여 식별, (b) 그런 기여에 **높은 점수** 부여)
- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` — 파일 상단 책임 주석, `NOTABLE_RELATIVE_CEILING` 상수값, `NotableContributionEntry` · `NotableContributionSignal` 타입, `computeNotableContributionSignal` 의 실 signature 와 판정식 (비교 모집단 · 임계 · 가드) 실측
- `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts` — `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER` (78 행) 값, `NotableContributionAdjustEntry` (80 행), `applyNotableContributionAnnotation` 이 실제로 어떤 필드를 어떻게 바꾸는지 (멱등 · 비파괴 · 점수 상향 유무) 실측
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` — 50 · 110 행 (`notableContribution: computeNotableContributionSignal(deduped)`) 신호 산출 배선 실측
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` — 72 행 import + 230 행 `applyNotableContributionAnnotation(...)` 호출 지점 (5-adjuster 중 순서 · flatten 위치) 실측
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — 위 두 composer 가 평가 본류에서 호출되는 지점 실측
- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.spec.ts` · `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts` — 검증 위치 컬럼의 실 근거 (파일별 `it(` 개수) 실측

## Acceptance Criteria

- [x] **중요·어려운 기여 식별 축 (README 25 행 앞절)** 을 실측한다 — `computeNotableContributionSignal` 의 export signature (인자 타입 · 반환 타입) 와 판정식 (어떤 필드를 세는지, 비교 모집단이 무엇인지, `NOTABLE_RELATIVE_CEILING` 실측값이 어떤 비교에 쓰이는지, 초과/이상 중 어느 쪽인지, `contributionKind` 필터 유무, 단독 author · 평균 0 · null/undefined · 빈 배열 경계 가드) 를 한 절로 요약해 파일·행 인용과 함께 적는다. 추측한 심볼명·필드명·상수값을 적지 않는다.
- [x] **높은 점수 부여 축 (README 25 행 뒷절)** 을 별도로 판정한다 — `applyNotableContributionAnnotation` 이 실제로 바꾸는 필드가 무엇인지 (`difficulty` / `contribution` / `volume` 같은 **점수 필드** 인지, 아니면 `narrative` 문자열 marker 접두뿐인지) 를 파일·행 인용으로 확정한다. 점수 상향이 실제로 일어나지 않고 marker 접두뿐이면 그 사실을 그대로 적고 상태를 `DONE` 이 아닌 `IN_PROGRESS` 로 판정한다 (README 지시의 "높은 점수" 축 미충족). 멱등 · 비파괴 · 단조 여부와 다른 adjuster (abuse · update-count · quality · underperformer) 와의 필드 직교/충돌 (특히 underperformer 와 같은 `narrative` 를 다룰 때의 marker 중첩) 도 함께 적는다.
- [x] **wiring 축을 별도로 판정한다** — `grep -rn "computeNotableContributionSignal\|applyNotableContributionAnnotation" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) detection pipeline 에서 신호가 산출되는지 (b) adjustments pipeline 에서 소비되는지 (5-adjuster 중 몇 번째인지 포함) (c) orchestrator 본류에서 두 composer 가 호출되는지를 파일·행으로 인용한다. 정의만 있고 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [x] **결과 노출·영속 경로**를 확인한다 — notable 판정 결과가 `prisma/schema.prisma` 의 어떤 컬럼으로 남는지 (`grep -n "narrative\|difficulty\|contributionScore" prisma/schema.prisma` 등으로 실측), notable 전용 컬럼이 있는지 없는지를 한 절로 적는다. 전용 컬럼이 없으면 그 사실을 그대로 적는다.
- [x] **검증 위치 컬럼의 실 근거**를 확인한다 — 두 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 검증 위치 컬럼이 `manual + unit` 인데 `manual` 축의 실 근거 (문서화된 수동 검증 절차) 가 있는지도 확인하고, 없으면 한계로 적는다. 본 축을 cover 하는 e2e / smoke 유무도 확인한다.
- [x] REQ-011 (30 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: `NOTABLE_RELATIVE_CEILING` 임계의 dogfood 튜닝 근거 부재 · "어렵고 남이 못할 일" 의 난이도 의미를 코드 단위 **개수** 로만 근사하는 한계 · batch 구성에 따라 판정이 흔들리는 상대 비교 모집단 문제 · 오탐 시 사람이 marker 를 해제하는 개입 경로) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-011" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-010 · REQ-012) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 1 차 편집에서 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다. `manual` 축 근거 부재를 발견해도 컬럼 값 자체는 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). 점수 상향이 실제로 없더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- 인접 REQ-019 (38 행 새 알고리즘·외부 연구 소개 = 높은 contribution) 재판정 — 별도 slice 이며, 본 task 에서 확인한 notable 심볼 쌍이 그 축까지 cover 하는지는 판단하지 않는다 (두 파일 주석은 R-25 만 명시).
- 이미 `DONE` 인 REQ-013 (32 행 저성과자) 의 underperformer 축 재서술 — 본 task 는 그 대칭인 notable 축만 다룬다.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-011 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- REQ-011 뒷절 "더 높은 점수" 구현 — notable author 의 평가 결과에 실제 점수 상향 (예: `difficulty` 또는 `contribution` 등급 상향, 혹은 별도 notable 가중치 필드) 을 반영하는 소비 helper slice. 현재 `applyNotableContributionAnnotation` 은 `narrative` marker 접두만 하고 점수 필드는 전사한다 (`evaluation-notable-contribution-adjust.ts` 30~32 행 주석이 "점수 반영은 별도 task" 로 자인). 상향 방향·단조성·다른 adjuster 와의 필드 충돌 (quality floor 의 `contribution` 강등과 반대 방향) 은 그 slice 에서 ADR 급 결정 필요.
- `NOTABLE_RELATIVE_CEILING = 1.5` 의 dogfood 실측 calibration — 현재 근거는 주석의 v1 baseline 선언뿐이다 (REQ-013 `UNDERPERFORMER_RELATIVE_FLOOR = 0.5` 도 같은 상태라 두 임계를 한 slice 로 묶어도 된다).
- 검증 위치 컬럼 `manual + unit` 의 `manual` 축 재판정 — 문서화된 수동 검증 절차가 `docs/` 에 부재하다. 컬럼 값 자체 수정은 본 task Out of Scope 였으므로 검증 위치 컬럼 resync slice 에서 처리.
- notable / underperformer marker 를 cover 하는 e2e 또는 smoke 추가 — `test/` 전수에서 `applyEvaluationAdjustments` 참조 0 이라 adjustments pipeline 전 구간이 domain unit spec 으로만 검증된다.

## 완료 기록

- 완료 시각: 2026-08-01T17:41:05Z
- 결과: `docs/requirements.md` 30 행 REQ-011 상태를 `PLANNED` → `IN_PROGRESS (식별 축 · wiring 축 실재 / "더 높은 점수" 부여 축 부재)` 로 재판정했다.
- 실측 근거 요약:
  - 식별 축 실재 — `evaluation-notable-contribution-signal.ts` 128~130 행 `computeNotableContributionSignal(inputs: EvaluationInput[]): NotableContributionSignal`, 150 행 `contributionKind === "code"` 필터, 158~163 행 batch 동료 평균 `meanCodeUnitCount`, 168 행 `ceiling = mean × NOTABLE_RELATIVE_CEILING`, 71 행 상수 `1.5`, 173 행 **초과(strictly greater)** 판정, 167 행 `comparable` 가드 (author ≥ 2 AND 평균 > 0), 131~135 행 null/undefined `TypeError`.
  - 높은 점수 축 부재 — `evaluation-notable-contribution-adjust.ts` 130~133 행 `applyNotableContributionAnnotation` 이 바꾸는 필드는 `result.narrative` 하나뿐 (147~161 행 spread 로 `difficulty`/`contribution`/`volume` 전사), 78 행 marker `"[중요기여] "` 접두 + 170 행 `startsWith` 멱등 + 새 객체 복제 비파괴 + 해제 역방향 0 단조.
  - wiring 축 실재 — detection `evaluation-detection-signals-pipeline.ts` 50/110 행, 소비 `evaluation-adjustments-pipeline.ts` 72/230~233 행 (5-adjuster 중 5 번째, flatten 직전), 본류 `evaluation-orchestrator.service.ts` 71·76·158·177 행.
  - 영속 — notable 전용 컬럼 0. marker 는 `evaluation-result.persist.mapper.ts` 192 행 결합을 거쳐 `prisma/schema.prisma` 303 행 `Assessment.narrative` 로만 남고, `model Contribution` (329~349 행) 에는 narrative 컬럼이 없다.
  - 검증 — domain unit 2 spec 38 it (`...signal.spec.ts` 19 it · `...adjust.spec.ts` 19 it). `manual` 축 문서 절차 부재, 본 축 e2e/smoke 0.
- 표 불변 확인: `wc -l docs/requirements.md` = 97 (편집 전후 동일), `grep -c "^| REQ-"` = 66 (동일), 29~31 행 `|` 필드 수 = 9 로 인접 행과 동일, 상태 문자열 내 리터럴 `|` 0.
