---
id: T-1377
title: requirements.md 23 행 REQ-004 수치 지표 + 사용자 지정 기간 LLM 평가 코멘트 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 28
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1377-requirements-metric-llm-comment-period-status-rejudge.md
plannerNote: "requirements-status-resync 23 번째 slice — T-1376 Out of Scope 가 지목한 상위 REQ-004, period-bridge/scoring/narrative 3 축 근거 밀도 높음, doc-only direct"
---

# T-1377 — requirements.md 23 행 REQ-004 수치 지표 + 사용자 지정 기간 LLM 평가 코멘트 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 23 행 REQ-004 (README 9 행 — "질과 양 모든 면에서 각 개발자가 얼마나 기여하는 지 다양한 지표를 통해 수치적으로도 보여주고, 사용자가 지정한 기간동안 어떠한 주요 활동이 있었는지 LLM을 통해 평가 코멘트도 생성하여 보여 주게 된다") 는 아직 상태 컬럼이 `PLANNED` 이지만, 직전 slice T-1376 이 REQ-010 (양·질 평가) 을 `DONE` 으로 재판정하며 그 Out of Scope 에서 **상위 REQ-004 재판정을 별도 slice** 로 명시적으로 넘겼다. REQ-004 는 REQ-010 의 산출값을 (a) 수치 지표로 (b) 사용자 지정 기간 단위로 (c) LLM 평가 코멘트와 함께 (d) 보여주는 상위 요구라, `period` 경로 · scoring 경로 · narrative 경로가 이미 main 에 박제된 현 시점이 근거 밀도가 가장 높다. `requirements-status-resync` stream 의 23 번째 slice 로 4 축을 각각 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 23 행 (REQ-004) 및 9 행의 상태 enum, 10 행의 검증 위치 enum. 인접 REQ-003 (22 행) · REQ-005 (24 행) 의 상태 문자열은 **서술 포맷 참고용** 이며 그 실측값을 본 task 의 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용).
- `docs/tasks/T-1376-requirements-code-contribution-quantity-quality-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 본 task 는 REQ-004 자기 축을 직접 실측한다.
- `README.md` 9 행 — REQ-004 원문. 축 분해 = (a) **다양한 지표를 통한 수치화** (b) **사용자가 지정한 기간** 단위 (c) **LLM 평가 코멘트 생성** (d) **보여주기** (조회 경로 노출).
- `src/assessment-evaluation/evaluation-scoring.service.ts` — 수치 축. `ScoringOptions` (46 행 부근) 과 `EvaluationScoringService` (52 행 부근) 의 실 signature · 산출 메서드명 · 어떤 필드를 수치로 환산하는지를 행 인용으로 확정. "다양한 지표" 가 몇 종인지 (단일 합산 점수인지 축별 병렬 값인지) 를 명확히 적는다. 추측한 심볼명 · 상수값을 적지 않는다.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 기간 축. 사용자 지정 기간 입력 필드명 (시작/종료 표현 방식 · 검증 규칙 · 허용 범위) 을 행 인용으로 확정.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 노출 축 1. `@Controller("api/assessment-evaluation")` (133 행) 아래 `@Post("period")` (339 행 부근) 의 route · RBAC decorator · 응답 shape 를 행 인용. `@Post("evaluate")` (208 행) 와의 역할 차이도 한 줄로 구분한다.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` · `period-bridge-admin-persist.service.ts` — 기간 축의 두 실행 경로 (User 비영속 / Admin 영속). 각각 기간 입력을 어디로 흘려 평가를 산출하는지 파일 · 행 인용.
- `src/assessment-evaluation/summary-narrative.service.ts` · `src/assessment-evaluation/domain/evaluation-prompt.ts` — LLM 코멘트 축. 평가 코멘트 (narrative) 가 **어느 심볼에서 생성** 되고 결과 객체의 **어느 필드** 로 실리는지, LLM 미응답 / 파싱 실패 시 fallback 이 무엇인지 행 인용으로 확정.
- `src/assessment-evaluation/domain/evaluation-result.ts` — 하나의 결과 객체 안에 수치 축 필드와 narrative 축 필드가 **함께** 존재하는지 필드 목록으로 대조.
- `web/src/views/DashboardView.tsx` — 노출 축 2 ("보여주고"). 수치 지표 · 평가 코멘트가 실제 화면 요소로 렌더되는지, 기간 지정 UI 가 있는지를 실측한다. 없으면 없다고 그대로 적는다.
- 검증 위치 실 근거용 — `test/e2e/period-bridge-ephemeral.e2e-spec.ts` · `test/e2e/period-bridge-admin-persist.e2e-spec.ts` · `src/assessment-evaluation/evaluation-scoring.service.spec.ts` · `src/assessment-evaluation/summary-narrative.service.spec.ts` 의 파일별 `it(` 개수를 직접 실측.

## Acceptance Criteria

- [x] **수치 축 (README 9 행 "다양한 지표를 통해 수치적으로")** 을 실측한다 — `EvaluationScoringService` 의 산출 메서드 signature · 입력 필드 · 출력 형태를 파일 · 행 인용으로 확정하고, 지표가 **몇 종인지** (단일 종합 점수 / 축별 병렬 값) 를 명확히 적는다. "다양한" 을 충족하는지에 대한 판단 근거를 지표 개수로 제시한다. 추측한 심볼명 · 필드명 · 상수값을 적지 않는다.
- [x] **기간 축 (README 9 행 "사용자가 지정한 기간동안")** 을 별도로 판정한다 — `period-bridge.dto.ts` 의 기간 입력 필드와 검증 규칙, `@Post("period")` route 의 RBAC, ephemeral / admin-persist 두 경로의 차이를 파일 · 행 인용으로 확정한다. 기간이 임의 범위인지 고정 단위 (일/주/월) 로 제한되는지도 실측해 적는다.
- [x] **LLM 코멘트 축 (README 9 행 "LLM을 통해 평가 코멘트도 생성")** 을 별도로 판정한다 — narrative 생성 심볼과 결과 필드, LLM 실패 시 fallback 경계를 행 인용으로 확정한다. "어떠한 주요 활동이 있었는지" 를 코멘트가 실제로 담는지 (활동 목록 요약인지 등급 문장인지) 를 프롬프트 · 산출 필드 근거로 적는다.
- [x] **노출 축 (README 9 행 "보여주고 ... 보여 주게 된다")** 을 판정한다 — (a) API 응답 shape 에 수치와 코멘트가 함께 실리는지, (b) `web/src/views/DashboardView.tsx` 가 그 둘을 렌더하는지, (c) 기간 지정 UI 가 존재하는지 3 항목을 각각 실측해 유무를 적는다. 프런트엔드가 미충족이면 그 사실을 그대로 적고 P6 미완이라는 서술을 근거 없이 덧붙이지 않는다.
- [x] **wiring 축을 별도로 판정한다** — `grep -rn "PeriodBridgeEphemeralService\|PeriodBridgeAdminPersistService\|EvaluationScoringService" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고 controller → service → domain 호출 chain 을 파일 · 행으로 인용한다. 정의만 있고 호출 0 인 심볼은 `DONE` 근거로 쓰지 않는다.
- [x] **검증 위치 컬럼의 실 근거** 를 확인한다 — 위 4 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 검증 위치가 `unit + e2e` 인데 실제 e2e 가 어느 축까지 cover 하는지 (수치 / 기간 / 코멘트 / 노출) 도 한 줄로 적는다.
- [x] REQ-004 (23 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 지표 종수가 "다양한" 에 미달 · 기간 단위 제약 · LLM 코멘트의 활동 요약 깊이 · 프런트 노출 부재 · e2e 가 cover 하지 않는 축) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-004" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-003 · REQ-005) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- 지표 종수 확대 · 기간 UI 추가 · narrative 프롬프트 개선 등 신규 구현 — 미충족 판정이 나와도 본 task 에서 구현하지 않는다. 도입 여부 판단은 별도 ADR slice.
- 이미 재판정된 REQ-010 · REQ-011 · REQ-018 · REQ-019 · REQ-020 재서술 — 본 task 는 README 9 행 축만 다루며, 인접 REQ 의 상태 문자열을 근거로 재인용하지 않는다.
- 상위 REQ-003 (22 행) · REQ-002 (21 행) 재판정 — 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-004 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- 기간 축의 **종료 경계 입력** 부재 — `PeriodBridgeDto` 는 `periodStart` 만 갖고 두 bridge 가 `{ since }` 만 흘려 `buildCollectionSpec(person, since?)` 로 수집이 open-ended 다. 종료 경계 도입 여부는 ADR slice 로 판단 (본 task 는 구현 금지 — Out of Scope).
- 좌표 종합 코멘트 (`SummaryNarrativeService.generateBatchNarrative` → `SummaryPersistService` → `SummaryAggregateOrchestratorService` → `SummaryBatchOrchestratorService`) 의 **HTTP 진입점 0** — "지정 기간의 주요 활동 요약" 이 API 로 도달하지 않는다. endpoint 배선 slice 후보.
- `web/src/views/DashboardView.tsx` 의 `ContributionRow` 파생 필드명 (`score` / `contribution` / `rationale` / `narrative`) 이 backend `GET /api/contributions` row 필드명 (`contributionScore` / `difficulty` / `volume`, narrative 컬럼 부재) 과 불일치 — 상세 패널이 점수 0 · 근거 undefined 로 수렴한다. 프런트-백엔드 계약 정합 slice 후보.

## 완료 기록

- 완료 시각: 2026-08-02 (UTC)
- 결과: `docs/requirements.md` 23 행 REQ-004 상태를 `PLANNED` → `IN_PROGRESS (수치 축 · 기간 축 · LLM 코멘트 축 · API 노출 축 실재 / 프런트 노출 축 · 기간 종료 경계 · 좌표 종합 코멘트의 HTTP 진입점 부재 ...)` 로 갱신. 표 구조 불변 (`wc -l` 97 행 · `grep -c "^| REQ-"` 66 행 · REQ-003 / REQ-004 / REQ-005 의 `awk -F'|' NF` 모두 9 로 동일, 상태 문자열 안 리터럴 `|` 0).
- 실측 요약:
  - 수치 축 — `evaluation-scoring.service.ts` 90~93 행 `scoreUnit(input, options)` / 46~49 행 `ScoringOptions.modelId` 단일 필드. 지표는 단일 합산이 아니라 **3 종 병렬** (104 행 `classifyNarrative` 의 difficulty · contribution 등급 2 종 + 107 행 `calculateEvaluationVolume` 의 정수 1 종). 좌표 합성은 `domain/summary-aggregate.ts` 84 행 `aggregateMetricScore` 1 종 (57~59 행 가중치 각 1 · 63 행 precision 6 · 86~88 행 빈 입력 0). `volume` 입력 신호는 `domain/evaluation-volume.ts` 30~31 행 `titleLength` 단일.
  - 기간 축 — `dto/period-bridge.dto.ts` 36 행 클래스의 5 키 (`personId` 41~43 / `period` 47~49 / `scope` 53~55 / `periodStart` 61~64 `@IsISO8601` / `reevaluate?` 82~84). route 는 controller 339~342 행 `@Post("period")` + `@Roles("User")`, 352~355 행 role dispatch. 임의 시작 + 고정 granularity (277~287 행 `normalizeKstPeriodStart` snap), **종료 경계 입력 없음** (430~443 / 474~501 행 `{ since }` 만 → `collection-spec.service.ts` 39~42 행). ephemeral 100~123 행 DB write 0 vs admin-persist 130~158 행 157 행 영속화.
  - LLM 코멘트 축 — 단위 차원 scoring service 99~101 행 generate 1 회 → `domain/evaluation-result.ts` 54~70 행 `narrative` 필드. prompt 는 `domain/evaluation-prompt.ts` 91~113 행 (단위 1 건 평가문 + 등급 마커, 활동 목록 요약 아님). 구간 종합은 `summary-narrative.service.ts` 96~112 행 + `domain/summary-batch-prompt.ts` 61 행 요약 지시. fallback = gateway reject 전파 (swallow 0), 빈/malformed narrative 는 155~173 행 `classifyNarrative` 가 medium / low 로 환원 (throw 0).
  - wiring 축 — `scoreUnit` 실 호출부는 `evaluation-orchestrator.service.ts` 164 행 1 곳, bridge 는 controller 439 / 495 행. 반대로 summary batch chain 은 HTTP caller 0 (module provider 등록뿐).
  - 노출 축 — (a) API 병존 ok (`user/assessment.repository.ts` 55~62 행 4 필드 + 134~146 행 `select` 없는 `findMany` → `user/assessment.controller.ts` 71 행), 단 Admin 분기 응답 (controller 505~512 행) 은 좌표 6 키뿐. (b) 프런트 렌더 미충족 (`DashboardView.tsx` 198~218 행 파생 vs `prisma/schema.prisma` 329~349 행 `model Contribution` 필드 불일치). (c) 기간 지정 UI 부재 (`DashboardViewProps` 78~79 행 prop 뿐, `AppShell.tsx` 141 행 무-prop 마운트, `web/src` 의 `assessment-evaluation` 참조 0).
  - 검증 위치 — unit 2 spec 24 it (`evaluation-scoring.service.spec.ts` 14 · `summary-narrative.service.spec.ts` 10) + e2e 2 spec 18 it (`period-bridge-ephemeral.e2e-spec.ts` 9 · `period-bridge-admin-persist.e2e-spec.ts` 9). e2e 는 기간 축 · 노출 축 (HTTP 계약) 만 cover — happy case 결과가 빈 배열이라 수치 값 · 코멘트 본문 미검증.
