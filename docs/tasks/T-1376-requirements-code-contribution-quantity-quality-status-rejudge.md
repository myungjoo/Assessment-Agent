---
id: T-1376
title: requirements.md 29 행 REQ-010 코드 기여 양·질 평가 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-010]
estimatedDiff: 26
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1376-requirements-code-contribution-quantity-quality-status-rejudge.md
plannerNote: "requirements-status-resync 22 번째 slice — REQ-010 (README 24 행 양·질 평가) 은 직전 4 slice 가 훑은 evaluation domain 의 상위 축이라 근거 밀도 최고, doc-only direct"
---

# T-1376 — requirements.md 29 행 REQ-010 코드 기여 양·질 평가 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 29 행 REQ-010 (README 24 행 — "코드 기여의 **양과 질을 모두** 평가하여야 한다") 는 아직 상태 컬럼이 `PLANNED` 이지만, 직전 4 slice (T-1372 REQ-018 · T-1373 REQ-011 · T-1374 REQ-019 · T-1375 REQ-020) 가 모두 같은 `src/assessment-evaluation/domain` 디렉토리를 훑으며 **양 축 (`calculateEvaluationVolume` · `volume`) 과 질 축 (`difficulty` / `contribution` 등급 · quality signal)** 의 실재를 부분적으로 확인했다. REQ-010 은 그 축들의 **상위 요구** 라 재판정 근거 밀도가 가장 높고, 하위 REQ (REQ-011 상향 · REQ-012 abusing · REQ-018 zero-contribution) 가 이미 재판정돼 대조군도 확보돼 있다. `requirements-status-resync` stream 의 22 번째 slice 로 (a) 양 축 (b) 질 축 (c) 두 축의 pipeline wiring (d) 영속·노출 을 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 29 행 (REQ-010) 및 9 행의 상태 enum, 10 행의 검증 위치 enum. 인접 REQ-009 (28 행) · REQ-011 (30 행) 의 상태 문자열은 **서술 포맷 참고용** 이며 그 실측값을 본 task 의 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용).
- `docs/tasks/T-1375-requirements-org-document-contribution-score-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다.
- `README.md` 24 행 — REQ-010 원문. 축 분해 = (a) 코드 기여의 **양** 평가 (b) 코드 기여의 **질** 평가 (c) **둘 모두** 가 실제 산출물에 반영되는지.
- `src/assessment-evaluation/domain/evaluation-volume.ts` — `calculateEvaluationVolume` 의 실 signature · 산출식 · 입력 필드 (무엇을 "양" 으로 세는지) · throw / fallback 경계를 행 인용으로 확정. 추측한 상수명·상수값을 적지 않는다.
- `src/assessment-evaluation/domain/evaluation-quality-signal.ts` · `evaluation-quality-adjust.ts` — 질 축의 신호·보정 심볼 쌍. 판정식 상수 실명·실값과, 보정이 **어떤 필드** 를 바꾸는지 (등급 강등인지 narrative marker 인지) 를 행 인용으로 확정.
- `src/assessment-evaluation/domain/evaluation-prompt.ts` — LLM 이 산출하는 질 축 등급 (`difficulty` / `contribution`) 의 지시문 위치, 파싱 실패 시 default 상수 실명·실값 (33 행 부근) 을 **직접 재실측** 해 인용한다.
- `src/assessment-evaluation/domain/evaluation-result.ts` · `evaluation-result.persist.mapper.ts` — 평가 결과 타입이 양 축 (`volume`) 과 질 축 (`difficulty` / `contribution`) 필드를 **둘 다** 갖는지, 그리고 `contributionLevelToScore` 등 등급→점수 매핑 경로.
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` · `evaluation-adjustments-pipeline.ts` · `src/assessment-evaluation/evaluation-orchestrator.service.ts` — wiring 실측용 (detection 산출 → adjustments 소비 → 본류 호출).
- `prisma/schema.prisma` — `Contribution` model 의 `volume` · `difficulty` · `contributionScore` 컬럼 위치를 `grep -n "volume\|difficulty\|contributionScore" prisma/schema.prisma` 로 실측.
- 검증 위치 실 근거용 spec — `src/assessment-evaluation/domain/evaluation-volume.spec.ts` · `evaluation-quality-signal.spec.ts` · `evaluation-quality-adjust.spec.ts` 의 파일별 `it(` 개수를 직접 실측.

## Acceptance Criteria

- [ ] **양 축 (README 24 행 "양")** 을 실측한다 — `calculateEvaluationVolume` 의 signature · 산출식 · 입력 필드를 파일·행 인용으로 확정하고, 양 평가가 **무엇을 세는지** (단위 수인지 텍스트 길이인지 diff 규모인지) 를 명확히 적는다. diff 라인 수 등 코드 규모 지표를 쓰지 않으면 그 사실을 그대로 적는다. 추측한 심볼명·필드명·상수값을 적지 않는다.
- [ ] **질 축 (README 24 행 "질")** 을 별도로 판정한다 — 질이 (a) LLM 산출 등급 (`difficulty` / `contribution`) 경로와 (b) 결정적 코드 신호 (`computeContributionQualitySignal` 등) 경로 중 어디에 실재하는지를 두 층으로 나눠 파일·행 인용으로 확정한다. 결정적 신호가 강등(floor) 방향만 있고 상향이 없으면 그 비대칭을 그대로 적는다.
- [ ] **"둘 모두" 축을 판정한다** — 하나의 평가 결과 객체·영속 레코드 안에 양 축 값과 질 축 값이 **함께** 남는지를 `evaluation-result.ts` 필드 목록과 `prisma/schema.prisma` 의 `Contribution` 컬럼으로 대조해 확정한다. 두 축이 최종 단일 점수로 합성되는 지점이 있으면 그 수식·가중치를 행 인용하고, 없으면 "합성 없이 병렬 보존" 임을 적는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "calculateEvaluationVolume\|computeContributionQualitySignal\|applyContributionQualityFloor" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고 (a) detection 산출 (b) adjustments 소비 (5-adjuster 중 몇 번째인지 포함) (c) orchestrator 본류 호출 을 파일·행으로 인용한다. 정의만 있고 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [ ] **영속·노출 경로** 를 한 절로 적는다 — `prisma/schema.prisma` 의 `Contribution` 이 양·질 축을 각각 어떤 컬럼으로 보존하는지 행 인용. REQ-010 전용 컬럼·플래그가 없으면 그 사실을 그대로 적는다.
- [ ] **검증 위치 컬럼의 실 근거** 를 확인한다 — 관련 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 검증 위치가 `unit` 인데 본 축을 cover 하는 e2e / smoke 가 있는지도 확인해 유무를 적는다.
- [ ] REQ-010 (29 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 질 축 상향 경로 부재 · 양 축이 코드 규모를 보지 않음 · 두 축 합성 가중치의 calibration 근거 부재 · 오탐 시 사람 개입 경로 부재 · e2e/smoke 유무) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] **옛 번호 체계 잔재 주의** — `src/assessment-collection/domain/page-dedup.ts` 4 행 주석의 `REQ-010` 은 현 표의 REQ-010 (코드 기여 양·질) 이 아니라 중복 제거를 가리키는 옛 번호다. 이를 본 REQ 의 구현 근거로 인용하지 않으며, 발견 사실은 Follow-ups 에만 적는다 (코드 주석 수정 금지).
- [ ] `grep -n "REQ-010" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-009 · REQ-011) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only). `page-dedup.ts` 4 행의 옛 번호 `REQ-010` 주석도 손대지 않는다.
- 질 축 상향 helper · 코드 규모 기반 양 지표 등 신규 구현 — 미충족 판정이 나와도 본 task 에서 구현하지 않는다. 도입 여부 판단은 별도 ADR slice.
- 이미 재판정된 REQ-011 · REQ-012 · REQ-018 · REQ-019 · REQ-020 재서술 — 본 task 는 README 24 행 축만 다루며, 인접 REQ 의 상태 문자열을 근거로 재인용하지 않는다.
- 상위 REQ-003 (7 행) · REQ-004 (9 행) 재판정 — 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-010 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- (실측 후 추가)
