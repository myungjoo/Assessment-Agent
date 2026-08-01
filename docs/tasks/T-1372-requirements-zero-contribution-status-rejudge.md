---
id: T-1372
title: requirements.md 37 행 REQ-018 단순 보고·copy-paste 로그 zero-contribution 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-018]
estimatedDiff: 22
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1372-requirements-zero-contribution-status-rejudge.md
plannerNote: "requirements-status-resync 18 번째 slice — REQ-018 은 quality-signal/quality-adjust 심볼 쌍이 실재해 근거 밀도가 잔여 PLANNED row 중 가장 높다"
---

# T-1372 — requirements.md 37 행 REQ-018 단순 보고·copy-paste 로그 zero-contribution 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 37 행 REQ-018 (README 37 행 — "단순 보고성 자료는 질적으로 낮게 평가한다. 단순 로그 작성, 특히 copy-paste로 볼 수 있는 로그 붙이기는 zero-contribution으로 간주한다") 은 아직 상태 컬럼이 `PLANNED` 이지만, `evaluation-quality-signal.ts` 의 `computeContributionQualitySignal` 과 `evaluation-quality-adjust.ts` 의 `applyContributionQualityFloor` (+ `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"`) 가 실재하고 detection / adjustments 두 pipeline 에 wiring 돼 있어 표가 코드베이스와 어긋날 가능성이 크다. 같은 평가 목표 문단의 이웃 REQ-012 · REQ-021 (abusing) 은 이미 `DONE` 으로 재판정돼 있어 본 row 만 stale 로 남아 있다. `requirements-status-resync` stream 의 18 번째 slice 로 표를 requirements 추적의 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 37 행 (REQ-018) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum. 인접 REQ-012 (26 행) · REQ-021 (40 행) 의 `DONE` 상태 문자열은 이웃 축과의 중복 서술을 피하기 위한 참고용
- `docs/tasks/T-1371-requirements-issue-self-followup-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다. 그 Result 절의 실측값은 다른 REQ 축이므로 본 task 의 근거로 인용하지 않는다
- `README.md` 37 행 — REQ-018 의 원문 지시 (축 = (a) 단순 보고성 자료를 질적으로 낮게 평가, (b) 단순 로그 작성 · copy-paste 로그 붙이기를 zero-contribution 으로 간주)
- `src/assessment-evaluation/domain/evaluation-quality-signal.ts` — 파일 상단 책임 주석, `CONTRIBUTION_QUALITY_TITLE_FLOOR` (52 행) 상수, `ContributionQualityEntry` (55 행) · `ContributionQualitySignal` (70 행) 타입, `computeContributionQualitySignal` (115 행) 의 실 signature 와 저품질 판정 휴리스틱 실측
- `src/assessment-evaluation/domain/evaluation-quality-adjust.ts` — `CONTRIBUTION_QUALITY_FLOOR_LEVEL` (62 행) 값, `ContributionQualityAdjustEntry` (69 행), `applyContributionQualityFloor` (119 행) 의 강등 대상 필드 · 멱등성 · 비파괴 여부 실측
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` — 51 · 108 행 (`computeContributionQualitySignal(deduped)`) 의 신호 산출 배선 실측
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` — 75 · 100~101 행 및 `applyContributionQualityFloor` 호출 지점 (adjuster 순서 포함) 실측
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — 위 두 composer 가 평가 본류에서 호출되는 지점 실측
- `src/assessment-evaluation/domain/evaluation-quality-signal.spec.ts` · `src/assessment-evaluation/domain/evaluation-quality-adjust.spec.ts` — 검증 위치 컬럼 `unit` 의 실 근거 (파일별 `it(` 개수) 실측

## Acceptance Criteria

- [x] **저품질 판정 축 (README 37 행 앞절)** 을 실측한다 — `computeContributionQualitySignal` 의 export signature (인자 타입 · 반환 타입) 와 저품질 판정식 (어떤 입력 필드를 보는지, `CONTRIBUTION_QUALITY_TITLE_FLOOR` 가 어떤 비교에 쓰이는지, `contributionKind` 필터 유무, 입력이 null/undefined 이거나 빈 배열일 때의 가드) 을 한 절로 요약해 인용한다. 추측한 심볼명·필드명·상수값을 적지 않는다.
- [x] **zero-contribution 강등 축 (README 37 행 뒷절)** 을 별도로 판정한다 — `applyContributionQualityFloor` 가 실제로 어떤 필드를 어떤 값 (`CONTRIBUTION_QUALITY_FLOOR_LEVEL` 실측값) 으로 강등하는지, 강등이 멱등 · 비파괴인지, 다른 adjuster (abuse · notable · underperformer) 와 직교하는지를 파일·행 인용으로 명시한다. "copy-paste 로그" 를 실제 내용 비교 (본문 유사도 · diff) 로 검출하는 로직이 있는지 확인하고, 제목 길이 등 휴리스틱뿐이면 그 사실을 명시한다.
- [x] **wiring 축을 별도로 판정한다** — `grep -rn "computeContributionQualitySignal\|applyContributionQualityFloor" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) detection pipeline 에서 신호가 산출되는지 (b) adjustments pipeline 에서 소비되는지 (adjuster 순서 포함) (c) orchestrator 본류에서 두 composer 가 호출되는지를 파일·행으로 인용한다. 정의만 있고 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [x] **결과 노출 경로**를 확인한다 — 강등 결과가 점수 필드로 남는지 narrative 문자열로만 남는지, 그리고 `prisma/schema.prisma` 에 대응 영속 필드가 있는지 (`grep -n "quality\|contributionLevel" prisma/schema.prisma` 등으로 실측) 를 한 절로 적는다. 영속 필드가 없으면 그 사실을 그대로 적는다.
- [x] **검증 위치 컬럼 `unit` 의 실 근거**를 확인한다 — `evaluation-quality-signal.spec.ts` · `evaluation-quality-adjust.spec.ts` 의 `it(` 개수를 각각 실측해 spec 경로와 개수를 상태 문자열에 인용한다. 본 축을 cover 하는 e2e / smoke 가 따로 있는지도 확인하고, 없으면 한계로 적는다.
- [x] REQ-018 (37 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 제목 길이 휴리스틱의 튜닝 근거 · 오탐 시 사람이 강등을 해제하는 개입 경로 · copy-paste 내용 비교 부재로 인한 미검출 범위) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-018" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-017 · REQ-019) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 1 차 편집에서 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). copy-paste 내용 비교 검출이 부재하더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- 인접 REQ-019 (38 행 새 알고리즘·외부 연구 소개 = 높은 contribution, `evaluation-notable-contribution-adjust.ts` 축) 재판정 — 다음 slice 대상이다.
- 이미 `DONE` 인 REQ-012 (26 행) · REQ-021 (40 행) 의 abusing 축 재서술 — 본 task 는 quality floor 축만 다룬다.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-018 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Result (2026-08-02 완료)

`docs/requirements.md` 37 행 REQ-018 상태 컬럼을 `PLANNED` → `DONE (implemented-on-main — ...)` 으로 재판정했다. 실측 요약:

- **저품질 판정 축** — `src/assessment-evaluation/domain/evaluation-quality-signal.ts` 115~117 행 `computeContributionQualitySignal(inputs: EvaluationInput[]): ContributionQualitySignal`. 136~139 행이 182 행 `resolveTitleLength` 로 `metadata.titleLength` **단일 필드** 만 읽어 52 행 `CONTRIBUTION_QUALITY_TITLE_FLOOR = 1` 과 137 행 `<=` 비교. `contributionKind` 필터 없음 (96 행 JSDoc 명시). 가드 3 종 — null/undefined 입력은 119~122 행 한국어 `TypeError` (유일 throw), 빈 배열은 빈 신호, 비-number/비유한 titleLength 는 183~194 행에서 0 흡수.
- **zero-contribution 강등 축** — `evaluation-quality-adjust.ts` 119~122 행 `applyContributionQualityFloor`. 강등 필드는 `result.contribution` 하나, 값은 62 행 `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"`. 대상 판정 138~141 행 3 조건 AND, 149~152 행 새 객체 복제로 비파괴 · 멱등 · 단조 비상향. abuse/update-count(`volume`) · underperformer/notable(`narrative`) 과 필드 직교. **copy-paste 내용 비교(유사도·diff) 로직 부재** — titleLength 휴리스틱 1 종뿐 (20~28 행 자인).
- **wiring 축** — detection `evaluation-detection-signals-pipeline.ts` 51 · 108 행, adjustments `evaluation-adjustments-pipeline.ts` 74 · 211~214 행 (adjuster 3 번째), 본류 `evaluation-orchestrator.service.ts` 76/158 행 · 71/177 행. dead code 아님.
- **결과 노출** — `evaluation-result.persist.mapper.ts` 147 행 `contributionLevelToScore` (zero 0 / low 1 / medium 2 / high 3, 74~79 행) → `prisma/schema.prisma` 336 행 `contributionScore Decimal` 영속 + `summary-aggregate.ts` 101 행 평균 반영. 등급 문자열 전용 영속 컬럼은 없음.
- **검증 위치 `unit` 근거** — `evaluation-quality-signal.spec.ts` 20 it · `evaluation-quality-adjust.spec.ts` 24 it (합 44 it). 본 축 cover e2e/smoke 0 (`test/` 전수 `applyEvaluationAdjustments` 참조 0).
- **표 불변식** — `wc -l docs/requirements.md` 97 (편집 전후 동일), `grep -c "^| REQ-"` 66 (동일), 36 · 37 · 38 행 `|` 필드 수 모두 9 로 동일, 상태 문자열 내 리터럴 `|` 0.

## Follow-ups

- copy-paste 로그를 본문 유사도 · diff · content hash 로 검출하는 v2 휴리스틱 (현 v1 은 `titleLength <= 1` 만 — 제목이 정상 길이인 copy-paste 는 미검출). `ActivityMetadata` 에 변경 라인 수 등 정량 신호 enrich 가 선행돼야 한다.
- `CONTRIBUTION_QUALITY_TITLE_FLOOR` 임계값의 dogfood 실측 기반 튜닝 (현재 값 1 은 보수적 추정).
- 오탐으로 `"zero"` 강등된 단위를 사람이 해제하는 개입 경로 (현재 `src/` 에 부재).
- quality floor 축을 cover 하는 e2e / smoke 추가.
