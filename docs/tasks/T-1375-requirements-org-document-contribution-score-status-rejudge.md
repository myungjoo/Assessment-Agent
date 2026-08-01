---
id: T-1375
title: requirements.md 39 행 REQ-020 조직 기여 큰 인원 → 높은 점수·높은 평가 코멘트 상태를 실측 기반 재판정
phase: P7
status: DONE
completedAt: 2026-08-01T19:52:00Z
commitMode: direct
coversReq: [REQ-020]
estimatedDiff: 24
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1375-requirements-org-document-contribution-score-status-rejudge.md
plannerNote: "requirements-status-resync 21 번째 slice — T-1374 Out of Scope 가 별도 slice 로 지목한 REQ-020, notable 신호가 document 단위를 명시 제외해 문서 축 판정 근거 밀도 높음"
---

# T-1375 — requirements.md 39 행 REQ-020 조직 기여 큰 인원 → 높은 점수·높은 평가 코멘트 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 39 행 REQ-020 (README 39 행 — "궁극적으로 보다 조직에 큰 기여를 **문서를 통해** 한 인원에게 **더 높은 점수** 와 **더 높은 평가 코멘트** 가 생성될 수 있어야 한다") 는 아직 상태 컬럼이 `PLANNED` 이지만, 직전 두 slice 가 같은 domain 디렉토리에서 인접 축을 이미 실측했다 — T-1373 이 REQ-011 (R-25 중요·어려운 기여) 을 `computeNotableContributionSignal` / `applyNotableContributionAnnotation` 쌍으로, T-1374 가 REQ-019 (R-38 상향) 를 quality 심볼 쌍으로 재판정했다. 그런데 notable signal 의 헤더 주석은 스스로 **`contributionKind === "code"` 단위만 세고 document 단위는 코드 기여 정량에서 제외한다** 고 자인하고, `src/assessment-evaluation/domain` 전수에서 README 39 행 (`R-39`) 을 자기 책임으로 선언한 심볼은 0 이다. 따라서 REQ-020 의 세 축 — (a) 문서를 통한 조직 기여가 큰 인원의 **식별**, (b) 그 인원에 대한 **더 높은 점수**, (c) **더 높은 평가 코멘트** — 이 실제로 구현돼 있는지, 아니면 code 축만 박제되고 document 축은 LLM 정성 평가에 맡겨져 있는지를 `requirements-status-resync` stream 의 21 번째 slice 로 실측해 표를 코드베이스에 되돌린다. T-1374 의 Out of Scope 도 본 축을 "별도 slice" 로 명시했다.

## Required Reading

- `docs/requirements.md` — 39 행 (REQ-020) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum. 인접 REQ-019 (38 행) · REQ-021 (40 행) 의 상태 문자열은 **서술 포맷 참고용** 이며 그 실측값을 본 task 의 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용).
- `docs/tasks/T-1374-requirements-algorithm-research-contribution-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다. **주의**: 그 task 의 가설이던 marker 미인식 default `"medium"` 은 오류였고 실측값은 `evaluation-prompt.ts` 33 행 `DEFAULT_CONTRIBUTION = "low"` 다 — 본 task 에서 default 를 인용할 일이 있으면 반드시 재실측한다.
- `README.md` 39 행 — REQ-020 의 원문 지시. 축 분해 = (a) **문서를 통한** 조직 기여가 큰 인원 식별, (b) 그 인원에게 **더 높은 점수**, (c) 그 인원에게 **더 높은 평가 코멘트**.
- `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts` — 헤더 주석 (책임 REQ 표기 · 판정 알고리즘 절) 과 `computeNotableContributionSignal` 의 실 signature · 판정식. 특히 **어떤 `contributionKind` 만 세는지**, batch 기준값 (평균) 과 임계 상수의 실명·실값, 단독 author / 전원 0 경계 처리를 행 인용으로 확정.
- `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts` — `applyNotableContributionAnnotation` 이 실제로 바꾸는 필드 (narrative marker 접두인지 점수 필드인지) 와 그 marker 문자열 상수. 주석이 "점수 반영은 별도 task" 로 자인하는 대목을 행 인용으로 확정.
- `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` · `evaluation-underperformer-adjust.ts` — 대칭 (하향) 축이 document 단위를 어떻게 다루는지 비교용. 본 REQ 의 근거로 쓰려면 반드시 직접 인용.
- `src/assessment-evaluation/domain/summary-aggregate.ts` — 단위 결과를 (person, period) 좌표 단일 `metricScore` 로 축약하는 수식과 가중치 상수. **문서 기여가 점수에 반영되는 경로가 kind 구분 없이 합산인지, document 전용 가중치가 있는지** 를 행 인용으로 확정.
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` — `contributionLevelToScore` 등간격 매핑과 `contributionScore` 산출부. 점수 축의 실 영속 경로.
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` 34 · 38 · 59~63 행 + `evaluation-input.ts` 33~42 행 — `"document"` kind 가 어디서 부여되는지 (GitHub issue / Confluence page).
- `prisma/schema.prisma` — `Contribution` · `Summary` model 의 점수·narrative 필드. `grep -n "contributionScore\|metricScore\|narrative\|difficulty" prisma/schema.prisma` 로 실측.
- 검증 위치 실 근거용 spec — `src/assessment-evaluation/domain/evaluation-notable-contribution-signal.spec.ts` · `evaluation-notable-contribution-adjust.spec.ts` · `summary-aggregate.spec.ts` 의 파일별 `it(` 개수를 직접 실측.

## Acceptance Criteria

- [ ] **식별 축 (README 39 행 "문서를 통해 조직에 큰 기여를 한 인원")** 을 실측한다 — `grep -rn "R-39\|REQ-020\|39 행" src --include=*.ts | grep -v spec` 및 `src/assessment-evaluation/domain` 전수 확인으로 **본 REQ 를 자기 책임으로 선언한 심볼이 존재하는지** 를 판정한다. 최근접 후보인 `computeNotableContributionSignal` 이 세는 `contributionKind` 를 판정식 원문·행 번호와 함께 인용하고, **document 단위가 집계에 포함되는지 제외되는지** 를 명확히 확정한다. 추측한 심볼명·필드명·상수값을 적지 않는다.
- [ ] **점수 축 (README 39 행 "더 높은 점수")** 을 별도로 판정한다 — 조직 기여가 큰 인원의 점수를 **상향** 시키는 결정적 경로가 있는지를 (a) 단위 차원 (`contributionScore` / `difficulty` / `volume` 를 상향하는 adjuster 유무) 과 (b) 좌표 차원 (`summary-aggregate.ts` 의 `metricScore` 수식이 문서 기여를 어떻게 반영하는지) 두 층으로 나눠 파일·행 인용으로 확정한다. 상향이 adjuster 가 아니라 "단위 수가 많으면 합산 결과가 자연히 커진다" 는 **간접 효과** 에 불과하면 그 사실을 그대로 적는다.
- [ ] **평가 코멘트 축 (README 39 행 "더 높은 평가 코멘트")** 을 별도로 판정한다 — `applyNotableContributionAnnotation` 이 `narrative` 를 어떻게 바꾸는지 (marker 접두인지 문장 생성인지), 그 대상 author 판정이 **code 단위 수 기반이라 문서 기여만 많은 인원은 대상에서 빠지는지** 를 행 인용으로 확정한다. 문서 기여 기반 코멘트 상향 경로가 LLM 산출 (`evaluation-prompt.ts` 지시 + marker 파싱) 뿐이면 그 사실과 미인식 시 default 환원값을 **재실측한 값** 으로 적는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "computeNotableContributionSignal\|applyNotableContributionAnnotation\|aggregate" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) detection pipeline 산출 (b) adjustments pipeline 소비 (5-adjuster 중 몇 번째인지 포함) (c) orchestrator 본류 호출 (d) summary 집계 호출부 를 파일·행으로 인용한다. 정의만 있고 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [ ] **결과 노출·영속 경로** 를 확인한다 — 조직 기여 크기가 `prisma/schema.prisma` 의 어떤 컬럼으로 남는지 (`Contribution` 의 점수 필드 · `Summary` 의 집계 필드 · narrative) 를 행 인용으로 한 절로 적는다. REQ-020 전용 컬럼·플래그·랭킹 필드가 없으면 그 사실을 그대로 적는다.
- [ ] **검증 위치 컬럼의 실 근거** 를 확인한다 — 관련 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 검증 위치 컬럼이 `manual + unit` 인데 `manual` 축의 실 근거 (문서화된 수동 검증 절차) 가 `docs/` 에 있는지 확인하고 없으면 한계로 적는다. 본 축을 cover 하는 e2e / smoke 유무도 확인한다.
- [ ] REQ-020 (39 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 문서 축 상대비교 신호 부재 · "조직에 큰 기여" 의 결정적 기준 부재 · 점수 상향이 간접 효과에만 의존 · 사람이 조직 기여 판단을 주입하는 개입 경로 부재 · e2e/smoke 0) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-020" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-019 · REQ-021) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 1 차 편집에서 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다. `manual` 축 근거 부재를 발견해도 컬럼 값 자체는 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only). T-1374 가 남긴 quality 파일 주석의 `REQ-037 / REQ-038` 오기 수정은 별도 `commitMode: pr` slice 이며 본 task 에서 손대지 않는다.
- 문서 축 조직 기여 신호 (예: document 단위 수 상대 비교 helper) 신규 구현 — 미충족으로 판정되더라도 본 task 에서 구현하지 않는다. 도입 여부 판단은 ADR slice.
- 이미 재판정된 REQ-011 (25 행 중요·어려운 기여) · REQ-018 (37 행) · REQ-019 (38 행) 재서술 — 본 task 는 R-39 조직 기여 축만 다룬다. 인접 REQ 의 상태 문자열을 근거로 재인용하지 않는다.
- 인접 REQ-021 (40 행 문서 abusing) 재판정 — 이미 `DONE` 이며 본 task 대상 아님.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-020 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- 문서 축 조직 기여 신호 (예: `computeDocumentContributionSignal` — author 별 `contributionKind === "document"` 단위 수 상대 비교) 도입 여부를 ADR 로 판단. 현재 상대 비교 신호 2 종 (`computeNotableContributionSignal` · `computeUnderPerformerSignal`) 이 모두 `"code"` 단위만 세어 문서 기여만 많은 인원은 식별·marker 대상에서 구조적으로 제외된다.
- `EvaluationResult` 에 `contributionKind` 를 전파할지 결정 — 현재 집계 층 (`summary-aggregate.ts`) 이 code/document 를 구분할 수 없어 문서 전용 가중치·문서 축 관측이 불가능하다. 타입 변경 + persist mapper + schema 영향 범위가 커 별도 ADR + `commitMode: pr` slice 필요.
- 옛 번호 체계 잔재 정리 — `docs/decisions/ADR-0003-deployment.md` 22 · 55 · 88 · 168 · 173 행과 `docs/tasks/T-0015-adr-0003-deployment-rest.md` 의 `REQ-020` 언급은 현 표의 REQ-020 (39 행 조직 기여) 이 아니라 "권한 부족 통지 (README 19~22 행)" 를 가리킨다. ADR 본문 정정은 이력 보존 정책과 충돌 가능 — 표기 정정 vs 각주 부기 중 어느 쪽인지 별도 판단.
- REQ-020 검증 위치 컬럼 (`manual + unit`) 재판정 — `manual` 축을 뒷받침하는 문서화된 수동 검증 절차가 `docs/` 에 부재함을 본 task 가 실측했다. 절차를 문서화하거나 컬럼 값을 조정하는 별도 slice.

## 완료 기록

- 완료 시각: 2026-08-02T02:20Z
- 결과: `docs/requirements.md` 39 행 REQ-020 상태를 `PLANNED` → `IN_PROGRESS (문서 기여의 결과 반영 축 · 등급→점수 영속 축 · LLM 정성 코멘트 산출 축 실재 / 문서 축 조직 기여 식별 축 · 결정적 점수 상향 축 · 문서 기반 코멘트 상향 축 부재 …)` 로 갱신.
- 실측 요약:
  - 식별 축 = **부재**. `src` 이하 `*.ts` (spec 제외) 에서 `R-39` · `REQ-020` · "39 행" 검색 0 행. 최근접 `computeNotableContributionSignal` (`evaluation-notable-contribution-signal.ts` 128~130 행) 은 150~152 행 `if (input.contributionKind === "code")` 로 code 단위만 세고 21~23 · 77 행 주석이 document 제외를 자인. 판정식 167~173 행 (71 행 `NOTABLE_RELATIVE_CEILING = 1.5` 초과), 대칭 하향 `evaluation-underperformer-signal.ts` 146 행 · 67 행 (`= 0.5`) 도 동일하게 document 제외.
  - 점수 축 = **간접 효과뿐**. 5-adjuster 중 상향 0 (adjust 파일 30~32 행이 "점수 반영은 별도 task" 자인). `summary-aggregate.ts` 84 행 · 110~113 행 수식 (57~59 행 가중치 모두 1, 108 행 `Math.log1p`) 의 입력 `EvaluationResult` (`evaluation-result.ts` 54~71 행) 에 `contributionKind` 필드 부재 → 문서 전용 가중치 0. `calculateEvaluationVolume` (`evaluation-volume.ts` 30~42 행) 도 `titleLength` 기반 kind 무관.
  - 코멘트 축 = **marker 접두까지**. `applyNotableContributionAnnotation` (adjust 파일 130~133 · 147~161 · 169~174 행) 이 78 행 `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER = "[중요기여] "` 를 멱등 접두 (문장 생성 아님), 대상이 code 단위 수 기반이라 문서 기여만 많은 인원 제외. 문서 기반 상향은 LLM 경로뿐 — `evaluation-prompt.ts` 109 행 지시 + 170 행 미인식 시 33 행 `DEFAULT_CONTRIBUTION = "low"` 환원 (재실측값).
  - wiring 축 = 실재 (dead code 아님). detection `evaluation-detection-signals-pipeline.ts` 50 · 110 행 → adjustments `evaluation-adjustments-pipeline.ts` 72 · 230~233 행 (5-adjuster 중 5 번째) → 본류 `evaluation-orchestrator.service.ts` 158 · 177 행, summary 집계 `summary-persist.service.ts` 35 · 105 행.
  - 영속 = REQ-020 전용 컬럼 0. `prisma/schema.prisma` 329~349 행 `Contribution` 에 332 `sourceType` · 335 `difficulty` · 336 `contributionScore` · 337 `volume` 만 있고 `contributionKind` 컬럼 부재, 361~368 행 `Summary` 는 366 `narrative` · 367 `metricScore`.
  - 검증 위치 실 근거 = `evaluation-notable-contribution-signal.spec.ts` 19 it · `evaluation-notable-contribution-adjust.spec.ts` 19 it · `summary-aggregate.spec.ts` 15 it (합 53 it). `manual` 축 문서 절차 부재, e2e / smoke 0.
- 표 불변 검증: `wc -l docs/requirements.md` = 97 (편집 전후 동일), `grep -c "^| REQ-"` = 66 (동일), REQ-019 · REQ-020 · REQ-021 의 `|` 필드 수 = 9 로 동일. 상태 문자열에 리터럴 `|` 없음 (1 차 편집에서 grep 패턴의 `\|` 로 필드 수가 11 로 부풀어 즉시 문자열 서술로 교체).
