---
id: T-1374
title: requirements.md 38 행 REQ-019 새 알고리즘·외부 연구 소개 = 높은 contribution 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-019]
estimatedDiff: 22
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1374-requirements-algorithm-research-contribution-status-rejudge.md
plannerNote: "requirements-status-resync 20 번째 slice — T-1373 Out of Scope 가 별도 slice 로 지목한 REQ-019, quality 심볼 쌍 주석이 R-38 을 자기 책임으로 명시해 근거 밀도 최상"
---

# T-1374 — requirements.md 38 행 REQ-019 새 알고리즘·외부 연구 소개 = 높은 contribution 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 38 행 REQ-019 (README 38 행 — "새로운 알고리즘의 설계, 새로운 일거리의 구상, 외부 연구 도입을 위해 타 개발자들이 참고할 수 있도록 소개 자료를 정리하는 활동은 높은 contribution 으로 간주한다") 는 아직 상태 컬럼이 `PLANNED` 이지만, `evaluation-quality-signal.ts` · `evaluation-quality-adjust.ts` 두 파일의 상단 주석이 스스로 `R-37 / R-38` 을 책임 범위로 명시하고 (`R-38` = README 38 행 = 본 REQ-019), `evaluation-result.ts` 28 행이 `"high"` 등급의 의미를 "새 알고리즘 / 외부 연구 도입" 으로 정의하며, `evaluation-prompt.ts` 109 행이 LLM 에게 `contribution: <zero|low|medium|high>` 산출을 요구한다. 직전 T-1372 가 같은 심볼 쌍으로 REQ-018 (R-37 = zero-contribution 축) 을 `DONE` 으로 재판정했으므로, 그 쌍둥이 축인 R-38 (상향 축) 이 실제로 구현돼 있는지 — 아니면 quality floor 가 **강등만** 하고 상향은 LLM 산출 신뢰에 맡기는지 — 를 `requirements-status-resync` stream 의 20 번째 slice 로 실측해 표를 코드베이스에 되돌린다. T-1373 의 Out of Scope 도 본 축을 "별도 slice" 로 명시했다.

## Required Reading

- `docs/requirements.md` — 38 행 (REQ-019) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum. 인접 REQ-018 (37 행) · REQ-021 (40 행) 의 상태 문자열은 서술 포맷 참고용이며 그 실측값을 본 task 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용)
- `docs/tasks/T-1373-requirements-notable-contribution-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 38 행 — REQ-019 의 원문 지시 (축 = (a) 새 알고리즘 설계 · 새 일거리 구상 · 외부 연구 소개 자료 **식별**, (b) 그 활동에 **높은 contribution** 부여)
- `src/assessment-evaluation/domain/evaluation-quality-signal.ts` — 2~3 행 책임 주석 (`R-37 / R-38 / REQ-037 / REQ-038` 표기), 89~91 행 알고리즘 주석, `computeContributionQualitySignal` 의 실 signature 와 판정식. **본 helper 가 상향(`high` 부여) 을 하는지 강등(floor) 만 하는지** 를 판정식 원문으로 확정
- `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` — 2~3 행 · 16 행 · 82 행 주석, `applyContributionQualityFloor` 가 실제로 바꾸는 필드와 방향 (강등 전용인지 양방향인지). 16 행이 abuse 감점 / update-count 중립과의 차이를 자인하는 대목 실측
- `src/assessment-evaluation/domain/evaluation-result.ts` — 28 행 `"high"` 등급의 의미 정의 주석 (`새 알고리즘 / 외부 연구 도입 등 높은 난이도·창의 기여`) 및 `contribution` 필드의 타입·허용 집합
- `src/assessment-evaluation/domain/evaluation-prompt.ts` — 109 행 LLM 지시 문자열 (`contribution: <zero|low|medium|high>`), 129~165 행 `contribution` marker 파싱 · 미인식 값 default 처리. 상향 판정이 LLM 산출에만 의존하는지 확인
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` 38 · 65 행 + `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` 29 · 100 행 — R-37/R-38 신호의 산출·소비 배선 실측
- `src/assessment-evaluation/domain/evaluation-quality-signal.spec.ts` · `src/assessment-evaluation/domain/evaluation-quality-adjust.spec.ts` — 검증 위치 컬럼의 실 근거 (파일별 `it(` 개수) 실측

## Acceptance Criteria

- [ ] **식별 축 (README 38 행 앞절)** 을 실측한다 — "새 알고리즘 설계 · 새 일거리 구상 · 외부 연구 소개 자료" 를 판별하는 **결정적 detection 심볼이 코드에 존재하는지** 를 `grep -rn "computeContributionQualitySignal" src --include=*.ts | grep -v spec` 및 domain 디렉토리 전수 확인으로 판정한다. `computeContributionQualitySignal` 의 판정식이 실제로 무엇을 세는지 (어떤 필드 · 어떤 임계 · 어떤 방향) 를 파일·행 인용과 함께 한 절로 요약하고, 그것이 **zero-contribution 후보 식별 (R-37 하향)** 인지 **high-contribution 후보 식별 (R-38 상향)** 인지를 명확히 확정한다. 추측한 심볼명·필드명·상수값을 적지 않는다.
- [ ] **높은 contribution 부여 축 (README 38 행 뒷절)** 을 별도로 판정한다 — `applyContributionQualityFloor` 가 `contribution` 등급을 **어느 방향으로만** 바꾸는지 (floor 강등 전용인지, `high` 상향 경로가 있는지) 를 파일·행 인용으로 확정한다. 상향 경로가 결정적 코드에 없고 LLM 산출 (`evaluation-prompt.ts` 109 행 지시 + marker 파싱) 에만 의존하면 그 사실을 그대로 적는다. `evaluation-result.ts` 28 행의 `"high"` 의미 정의가 **문서 주석뿐인지 실행 로직인지** 도 구분해 적는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "computeContributionQualitySignal\|applyContributionQualityFloor" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) detection pipeline 산출 (b) adjustments pipeline 소비 (5-adjuster 중 몇 번째인지 포함) (c) orchestrator 본류 호출 을 파일·행으로 인용한다. 정의만 있고 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [ ] **주석의 REQ 매핑 어긋남**을 확인한다 — 두 quality 파일 주석의 `REQ-037 / REQ-038` 표기가 `docs/requirements.md` 의 실제 REQ-037 (64 행 일괄 평가 + Reset & Reeval) · REQ-038 (68-71 행 UI 조회) 과 다른 대상을 가리키는지 (즉 주석이 README 행 번호 R-37/R-38 을 REQ ID 로 오기했는지) 를 실측해 한 절로 적는다. 코드 주석은 본 task 에서 고치지 않고 Follow-ups 로만 남긴다.
- [ ] **결과 노출·영속 경로**를 확인한다 — `contribution` 등급이 `prisma/schema.prisma` 의 어떤 컬럼으로 남는지 (`grep -n "contribution\|difficulty\|narrative" prisma/schema.prisma` 로 실측) 를 한 절로 적는다. R-38 전용 컬럼·플래그가 없으면 그 사실을 그대로 적는다.
- [ ] **검증 위치 컬럼의 실 근거**를 확인한다 — 두 quality spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 검증 위치 컬럼이 `unit + manual` 인데 `manual` 축의 실 근거 (문서화된 수동 검증 절차) 가 `docs/` 에 있는지 확인하고 없으면 한계로 적는다. 본 축을 cover 하는 e2e / smoke 유무도 확인한다.
- [ ] REQ-019 (38 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: "새 알고리즘·외부 연구 소개" 를 식별하는 결정적 기준 부재 · 상향 판정이 LLM 비결정성에 노출되는 한계 · marker 미인식 시 `contribution: "medium"` default 로 상향이 조용히 소실되는 경로 · 사람이 상향을 강제하는 개입 경로 부재) 는 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-019" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-018 · REQ-020) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 1 차 편집에서 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다. `manual` 축 근거 부재를 발견해도 컬럼 값 자체는 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only). 주석의 `REQ-037 / REQ-038` 오기를 발견해도 본 task 에서 고치지 않는다 — Follow-ups 로만 남긴다.
- 상향 (`high` 부여) 결정적 helper 신규 구현 — 미충족으로 판정되더라도 본 task 에서 구현하지 않는다.
- 인접 REQ-020 (39 행 조직 기여 큰 인원 → 높은 점수) 재판정 — 별도 slice 이며, 본 task 에서 확인한 quality 심볼 쌍이 그 축까지 cover 하는지는 판단하지 않는다.
- 이미 `DONE` 인 REQ-018 (37 행 zero-contribution) 재서술 — 본 task 는 그 대칭인 R-38 상향 축만 다룬다.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-019 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- 두 quality 파일 (`src/assessment-evaluation/domain/evaluation-quality-signal.ts` 2~3 행 · `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` 2~3 행) 주석의 `REQ-037 / REQ-038` 표기는 본 표의 실제 REQ-037 (64 행 일괄 평가 + Reset & Reeval) · REQ-038 (68-71 행 UI 조회) 과 다른 대상을 가리키는 **오기** 다 (README 행 번호 `R-37 / R-38` 을 REQ ID 로 잘못 적음). 올바른 대응은 `REQ-018 / REQ-019` 다. 주석 수정은 코드 변경이라 `commitMode: pr` slice 로 별도 박제 필요 (같은 오기가 다른 domain 파일에도 있는지 전수 확인 포함).
- R-38 상향 축의 결정적 helper (예: `computeHighContributionSignal`) 신규 구현 여부 결정 — 현재 상향은 LLM 산출 단일 경로라 비결정적이고 marker 미인식 시 `"low"` 로 조용히 소실된다. 결정적 상향 신호를 도입할지, LLM 단일 경로를 유지하되 marker 미인식을 관측 가능하게 (로그 · 카운터) 만들지 ADR 로 판단.
- REQ-019 검증 위치 컬럼 (`unit + manual`) 재판정 — `manual` 축을 뒷받침하는 문서화된 수동 검증 절차가 `docs/` 에 부재함을 본 task 가 실측했다. 절차를 문서화하거나 컬럼 값을 조정하는 별도 slice.

## 완료 기록

- 완료 시각: 2026-08-01T18:40Z
- 결과: `docs/requirements.md` 38 행 REQ-019 상태를 `PLANNED` → `IN_PROGRESS (등급 정의 축 · LLM 산출 축 · 점수 영속 축 실재 / 상향을 결정하는 결정적 식별 축 · 부여 축 부재 ...)` 로 갱신.
- 실측 요약:
  - 식별 축 = **부재**. `computeContributionQualitySignal` (`evaluation-quality-signal.ts` 115 행) 의 판정식은 137 행 `titleLength <= CONTRIBUTION_QUALITY_TITLE_FLOOR` (52 행 상수 `= 1`) 로 `metadata.titleLength` 단일 필드의 **임계 이하** 만 세므로 zero-contribution 후보 식별 (R-37 하향) 전용. high 후보 식별 분기는 domain 전수 0.
  - 부여 축 = **강등 전용**. `applyContributionQualityFloor` (`evaluation-quality-adjust.ts` 119 행) 의 대입 값은 62 행 `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"` 뿐 (단조 비상향), 37 · 60 · 110~111 행 주석이 상향 비담당을 자인. `high` 상향은 `evaluation-prompt.ts` 109 행 지시 + 155~170 행 `classifyNarrative` marker 파싱의 LLM 경로뿐이고 미인식 시 33 행 `DEFAULT_CONTRIBUTION = "low"` 로 환원 (task 가설의 `"medium"` default 는 **오류** — 실측값은 `"low"`). `evaluation-result.ts` 28 행 `"high"` 의미 정의는 문서 주석뿐, 실행 로직은 32 · 37 · 48 행 멤버십 검증까지.
  - wiring 축 = 실재. detection `evaluation-detection-signals-pipeline.ts` 51 · 108 행 → adjustments `evaluation-adjustments-pipeline.ts` 74 · 211~214 행 (5-adjuster 중 3 번째) → 본류 `evaluation-orchestrator.service.ts` 158 · 177 행. 상향의 실 배선은 `evaluation-scoring.service.ts` 104 행.
  - 영속 = R-38 전용 컬럼 없음. `high` 는 `evaluation-result.persist.mapper.ts` 147 행 → 70~78 행 매핑 (high 3) 을 거쳐 `Contribution.contributionScore Decimal` (schema 336 행) 숫자로만 남음.
  - 검증 위치 실 근거 = `evaluation-quality-signal.spec.ts` 20 it · `evaluation-quality-adjust.spec.ts` 24 it · `evaluation-prompt.spec.ts` 37 it. `manual` 축 문서 절차 부재, e2e / smoke 0.
- 표 불변 검증: `wc -l docs/requirements.md` = 97 (편집 전후 동일), `grep -c "^| REQ-"` = 66 (동일), REQ-018 · REQ-019 · REQ-020 의 `|` 필드 수 = 9 로 동일. 상태 문자열에 리터럴 `|` 없음.
