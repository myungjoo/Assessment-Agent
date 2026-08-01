---
id: T-1378
title: requirements.md 22 행 REQ-003 기여 양·질 평가 / 저장 / 표시 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-003]
estimatedDiff: 28
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1378-requirements-evaluate-store-display-status-rejudge.md
plannerNote: "requirements-status-resync 24 번째 slice — T-1377 Out of Scope 가 지목한 상위 REQ-003, 평가/저장/표시 3 축 근거 밀도 최고, doc-only direct"
---

# T-1378 — requirements.md 22 행 REQ-003 기여 양·질 평가 / 저장 / 표시 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 22 행 REQ-003 (README 7 행 — "각 개발자들의 기여 활동의 양과 질을 평가하고 평가 결과를 저장하고 보여주는 시스템이다") 는 아직 상태 컬럼이 `PLANNED` 이지만, 직전 slice T-1377 이 REQ-004 (수치 지표 + 기간 LLM 코멘트) 를 `IN_PROGRESS` 로 재판정하며 그 Out of Scope 에서 **상위 REQ-003 재판정을 별도 slice** 로 명시적으로 넘겼다. REQ-003 는 REQ-004 · REQ-010 의 상위 요구로 (a) 평가 (b) 저장 (c) 표시 3 축을 각각 요구하며, 평가 orchestration · 영속 model · 조회 controller 가 모두 main 에 박제된 현 시점이 근거 밀도가 가장 높다. `requirements-status-resync` stream 의 24 번째 slice 로 3 축을 각각 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 22 행 (REQ-003) 및 표 헤더 (18 행) 의 컬럼 순서, 상태 enum. 인접 REQ-002 (21 행) · REQ-004 (23 행) 의 상태 문자열은 **서술 포맷 참고용** 이며 그 실측값을 본 task 의 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용).
- `docs/tasks/T-1377-requirements-metric-llm-comment-period-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 본 task 는 REQ-003 자기 축을 직접 실측한다.
- `README.md` 7 행 — REQ-003 원문. 축 분해 = (a) **기여 활동의 양과 질을 평가** (b) **평가 결과를 저장** (c) **보여주는** (조회 경로 노출).
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — 평가 축. 평가 진입 메서드 signature · 어떤 입력을 받아 어떤 결과 객체를 산출하는지, `EvaluationScoringService` 를 어디서 호출하는지 파일 · 행 인용으로 확정.
- `src/assessment-evaluation/evaluation-scoring.service.ts` — 평가 축의 "양" 과 "질" 이 각각 어느 심볼로 산출되는지 (등급 분류 / 볼륨 계산) 를 행 인용으로 확정. 추측한 심볼명 · 상수값을 적지 않는다.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` · `src/assessment-evaluation/summary-persist.service.ts` — 저장 축. 평가 결과가 **어느 심볼에서 어느 테이블로** 영속되는지, upsert / insert 여부와 실패 경계를 행 인용으로 확정.
- `prisma/schema.prisma` — 저장 축의 스키마 근거. `model Assessment` (294 행 부근) · `model Contribution` (329 행 부근) · `model Summary` (361 행 부근) 의 필드 중 **양 축 · 질 축 값이 실제로 어느 컬럼에 담기는지** 를 필드명으로 대조한다. 없는 컬럼을 있다고 적지 않는다.
- `src/user/assessment.controller.ts` · `src/user/assessment.repository.ts` — 표시 축 1 (API). route · RBAC decorator · 응답 row 필드 목록을 행 인용. `src/user/contribution.controller.ts` 의 route 와 역할 차이도 한 줄로 구분한다.
- `web/src/views/DashboardView.tsx` — 표시 축 2 (화면). 평가 결과의 양 축 · 질 축 값이 실제 화면 요소로 렌더되는지 실측한다. 렌더 필드명이 backend row 필드명과 일치하는지도 대조하고, 불일치면 불일치라고 그대로 적는다.
- 검증 위치 실 근거용 — `src/assessment-evaluation/evaluation-orchestrator.service.spec.ts` · `src/assessment-evaluation/evaluation-result-persist.service.spec.ts` · `src/user/assessment.controller.spec.ts` 의 파일별 `it(` 개수를 직접 실측. 표의 검증 위치 컬럼이 `unit + smoke` 이므로 smoke spec 존재 여부도 `ls test/smoke/` 로 확인한다.

## Acceptance Criteria

- [ ] **평가 축 (README 7 행 "양과 질을 평가하고")** 을 실측한다 — orchestration 진입 심볼과 scoring 심볼을 파일 · 행 인용으로 확정하고, **양 축 산출 심볼** 과 **질 축 산출 심볼** 을 각각 분리해 적는다. 한쪽 축만 실재하면 그 사실을 그대로 적는다. 추측한 심볼명 · 필드명 · 상수값을 적지 않는다.
- [ ] **저장 축 (README 7 행 "평가 결과를 저장하고")** 을 별도로 판정한다 — persist 심볼 → Prisma model → 컬럼까지의 경로를 파일 · 행으로 인용한다. 양 축 값 · 질 축 값이 각각 **어느 컬럼에 실제로 담기는지** 를 필드명으로 확정하고, 담기지 않는 값이 있으면 그 사실을 적는다.
- [ ] **표시 축 (README 7 행 "보여주는")** 을 (a) API 응답 shape (b) 프런트 렌더 2 항목으로 나눠 각각 실측한다. 프런트가 미충족이거나 필드명이 backend 와 불일치하면 그 사실을 그대로 적고, P6 미완 같은 근거 없는 서술을 덧붙이지 않는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "EvaluationOrchestratorService\|EvaluationResultPersistService" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고 controller → service → repository 호출 chain 을 파일 · 행으로 인용한다. 정의만 있고 호출 0 인 심볼은 `DONE` 근거로 쓰지 않는다.
- [ ] **검증 위치 컬럼의 실 근거** 를 확인한다 — 위 3 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용하고, 표의 `unit + smoke` 중 smoke 가 REQ-003 축을 실제로 cover 하는지 (`ls test/smoke/` 결과 기준) 한 줄로 적는다.
- [ ] REQ-003 (22 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 양/질 중 한 축의 컬럼 부재 · 프런트 필드명 불일치 · smoke 가 cover 하지 않는 축) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-003" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-002 · REQ-004) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- T-1377 Follow-ups 3 건 (기간 종료 경계 입력 도입 · summary batch narrative chain 의 HTTP 진입점 배선 · `DashboardView` 필드명 계약 정합) 의 **구현** — 본 task 는 실측·기록만 하며, 도입 여부 판단은 각각 별도 ADR / 구현 slice.
- 이미 재판정된 REQ-004 · REQ-010 · REQ-011 · REQ-018 · REQ-019 · REQ-020 재서술 — 본 task 는 README 7 행 축만 다루며, 인접 REQ 의 상태 문자열을 근거로 재인용하지 않는다.
- 상위 REQ-002 (21 행) · REQ-001 (20 행) 재판정 — 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-003 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- `model Contribution` (`prisma/schema.prisma` 329~349 행) 에 narrative 컬럼이 없어 단위별 LLM 평가문이 Assessment 303 행 `narrative` 로 join 되어서만 남는다 — 단위별 정성 근거의 개별 조회를 지원할지 여부는 schema 변경 판단이 필요하므로 별도 ADR slice.

## 완료 기록

- 완료 시각: 2026-08-02 (UTC)
- 판정: REQ-003 (22 행) `PLANNED` → `IN_PROGRESS (평가 축 · 저장 축 · 표시 축 API 실재 / 표시 축 프런트 렌더 부재)`.
- 평가 축 실측: `src/assessment-evaluation/evaluation-orchestrator.service.ts` 139~142 행 `evaluateActivities` → 164 행 `scoreUnit` 순차 호출. 양 축 = `evaluation-scoring.service.ts` 107 행 `calculateEvaluationVolume` (정의 `domain/evaluation-volume.ts` 30 행), 질 축 = 99~101 행 `gateway.generate` 의 `narrative` + 104 행 `classifyNarrative` (정의 `domain/evaluation-prompt.ts` 155 행). 두 축 모두 실재.
- 저장 축 실측: `evaluation-result-persist.service.ts` 103 행 `persist` → 108 행 매퍼 → 213 행 `tx.assessment.create` nested create (reset-and-recreate insert, upsert 아님). 양 축 → Contribution 337 행 · Assessment 302 행 `volume Int`, 질 축 → `difficulty` (335 / 300 행) + 수치 변환된 `contributionScore Decimal` (336 / 301 행) + Assessment 303 행 `narrative` 만. Contribution 에는 narrative 컬럼 부재.
- 표시 축 실측: API 는 `src/user/assessment.controller.ts` 93~96 행 → service 99~106 행 → repository 134~148 행 `findMany` (select 절 없음) 로 4 필드 전량 노출. 프런트는 `web/src/views/DashboardView.tsx` 368~369 행이 소비하는 `EvaluationResultRow` (`EvaluationResultTable.tsx` 9~18 행) 가 `id` 외 backend 필드와 0 개 일치, `volume` · `difficulty` 참조 0 → 미충족.
- wiring 축: 전수 참조에서 orchestrator 3 곳 · persist 2 곳 생성자 주입 실재, controller 208~211 행 `@Post("evaluate")` → 220 행 → 243 행 chain 확인 (호출 0 심볼 없음).
- 검증 근거: 행두 `it(` 기준 119 + 18 + 35 = 172 it. smoke 150 파일 중 REQ-003 저장·표시 축 cover 0, 평가 축만 `test/smoke/period-bridge-live.smoke-spec.ts` 2 it (env-gated `describe.skip`).
- 표 불변 확인: `wc -l` 97 행 · `grep -c "^| REQ-"` 66 행 편집 전후 동일, 21~23 행 `|` 필드 수 모두 9 로 동일.
