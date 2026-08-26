---
id: T-1724
title: backend Assessment 응답 → 대시보드 표시 행 순수 매핑 helper 신설 (표시 계약 고정)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-075]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1723]
touchesFiles:
  - web/src/api/assessmentRow.ts
  - web/src/api/assessmentRow.test.ts
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-27
plannerNote: P6 오너지시 PLAN 131행 ② 분해 slice 1 — 프런트/백엔드 필드 불일치를 순수 매퍼로 흡수, 배선은 다음 slice
---

# T-1724 — backend Assessment 응답 → 대시보드 표시 행 순수 매핑 helper 신설 (표시 계약 고정)

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` 🔴 ② ([requirements.md](../requirements.md) `94 행` REQ-075) 의 분해 slice 1 이다. 직전 chain (T-1722 컴포넌트 → T-1723 배선) 이 REQ-074 의 인원 선택 공백을 메웠으나, **인원을 골라도 표에 실데이터가 렌더되지 않는다** — [DashboardView.tsx](../../web/src/views/DashboardView.tsx) `481~484 행` 이 `GET /api/assessments` 응답을 매핑 없이 그대로 `EvaluationResultRow[]` 로 간주하는데, 그 row 계약은 `subjectName` / `metricLabel` / `score` ([EvaluationResultTable.tsx](../../web/src/components/EvaluationResultTable.tsx) `9~18 행`) 인 반면 backend 응답은 `period` / `scope` / `periodStart` / `difficulty` / `contributionScore` / `volume` / `narrative` ([prisma/schema.prisma](../../prisma/schema.prisma) `model Assessment`) 라 **`id` 외 전 필드가 불일치**한다. 결과적으로 표 · 요약 지표 · 점수 분포가 모두 `undefined` 를 집계한다.

본 slice 는 그 간극을 흡수하는 **순수 매핑 helper 만** 신설한다 — [signupError.ts](../../web/src/api/signupError.ts) (T-1712) 가 helper 를 먼저 박제하고 후속 slice 가 소비지점을 배선한 선례를 그대로 승계한다. 표시 컬럼 재설계와 `DashboardView` · `EvaluationResultTable` 배선은 다음 slice 책임이며, 본 slice 는 **backend 필드명 · 타입(Decimal JSON) 을 표시 행 계약으로 고정하는 test 를 남기는 것** 이 핵심 산출물이다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) `93 행` — `GET /api/assessments` (`?personId=&period=`) 응답 계약 · personId 누락 400 규약
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model Assessment` — 필드 9 개 (`id` / `personId` / `period` / `scope` / `periodStart` / `difficulty` / `contributionScore` **Decimal** / `volume` **Int** / `narrative`) · `@@unique([personId, period, scope, periodStart])`
- [web/src/components/EvaluationResultTable.tsx](../../web/src/components/EvaluationResultTable.tsx) `9~26 행` — 현행 `EvaluationResultRow` (`id` / `subjectName` / `metricLabel` / `score`) 와 `COLUMNS` 매핑 (본 task 는 이 파일을 **수정하지 않는다** — 불일치 사실 확인용)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — `481~484 행` `visibleRows` (응답을 매핑 없이 소비하는 지점) · `deriveScoreBuckets` (`252~285 행` 부근) · `deriveMetrics` (`321~335 행` 부근) 의 `row.score` 의존 (본 task 는 이 파일도 **수정하지 않는다** — 다음 slice 의 소비 계약 파악용)
- [web/src/api/signupError.ts](../../web/src/api/signupError.ts) — 순수 helper 모듈의 named export · JSDoc 한국어 주석 · throw 0 convention 선례 (T-1712)
- [web/src/api/roleAccess.ts](../../web/src/api/roleAccess.ts) — `src/api/` 하위 비-fetch 순수 helper 배치 선례
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) — Decision 1 (presentational 은 fetch 를 모른다) · Decision 3 (컨테이너가 data/loading/error 소유)

## Acceptance Criteria

- [ ] `web/src/api/assessmentRow.ts` 신설 — `fetch` · `useApiResource` · React import **0** 인 순수 모듈. 새 dependency 0, `throw` 신설 0 (모든 비정상 입력을 값으로 흡수).
- [ ] 표시 행 타입 `AssessmentDisplayRow` 를 `export type` 으로 노출 — 필드는 `id: string` / `personId: string` / `period: string` / `scope: string` / `periodStart: string` / `difficulty: string` / `contributionScore: number | null` / `volume: number | null` / `narrative: string`. 숫자 축은 파싱 실패 시 **`0` 으로 위장하지 않고 `null`** (표시 계층이 "—" 로 렌더할 수 있도록).
- [ ] named export 순수 함수 3 개: `parseNumericField(value: unknown): number | null` (Prisma `Decimal` 의 JSON 직렬화가 `"12.5"` 문자열 · `12.5` 숫자 어느 쪽이어도 수용, `NaN` · `Infinity` · 빈 문자열 · 비수치 문자열 · `null` · `undefined` · 객체는 `null`) · `toAssessmentDisplayRow(raw: unknown): AssessmentDisplayRow | null` (비-객체 · `null` · 배열 · `id` 결손(비-string 또는 빈 문자열) 은 `null`, 문자열 필드 결손은 `''` fallback) · `deriveAssessmentDisplayRows(raw: unknown): AssessmentDisplayRow[]` (비배열은 `[]`, 매핑 실패 원소는 제외).
- [ ] colocated spec `web/src/api/assessmentRow.test.ts` 신설 (CLAUDE.md §3.2 R-112 4 종 cover):
  - [ ] **happy-path** — 완전한 backend row 배열이 필드 9 개 전부 보존된 `AssessmentDisplayRow[]` 로 매핑되는 test 1+, 3 함수 각각 happy 1+.
  - [ ] **error path** — `deriveAssessmentDisplayRows(null)` / `(undefined)` / `({})` / `('x')` 가 모두 `[]`, `toAssessmentDisplayRow(null)` 이 `null` 인 test 1+.
  - [ ] **분기 cover** — `contributionScore` 가 문자열 / 숫자 / 비수치 / 결손 4 갈래, `volume` 가 숫자 / 문자열 / 결손 3 갈래, `id` 결손 제외 분기, 문자열 필드 결손 `''` fallback 분기 각 1+ test.
  - [ ] **negative cases 충분 cover** — 어떤 입력에도 throw 0 (`Object.freeze` 된 입력 포함) · 입력 배열/객체 mutation 0 · 결과에 `NaN` 미노출 · `Infinity` / `-Infinity` 가 `null` 로 흡수 · 빈 배열 입력 시 `[]` · 원소 일부만 결손일 때 나머지 원소 보존 각 1+ test.
  - [ ] **계약 drift guard** — `AssessmentDisplayRow` 의 키 집합이 backend `Assessment` 필드명과 정합함을 고정하는 test 1+ (정렬된 `Object.keys` 비교로 필드 추가/삭제 시 fail).
- [ ] `pnpm --dir web test` green (기존 web spec 회귀 0), `pnpm --dir web build` green, `pnpm lint` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` · `test/` · `prisma/` · `.github/workflows/` · `package.json` diff **0 파일** 이라 backend coverage 는 불변임을 확인한다.
- [ ] `web/src/views/DashboardView.tsx` · `web/src/components/EvaluationResultTable.tsx` diff **0 파일** (소비 배선은 다음 slice).

## Out of Scope

- `EvaluationResultTable` 의 컬럼 재설계 · props 계약 변경 (다음 slice — 표시 컬럼 확정 + 정렬 키 재조정).
- `DashboardView` 배선 (`visibleRows` · `deriveMetrics` · `deriveScoreBuckets` · `sortRows` · `filterRows` 의 새 row 계약 전환) — 다음 slice.
- 점수 분포 축의 실 `metricScore` 스케일 정합 (REQ-076, PLAN `131 행` ③).
- 기간(일/주/월 + 시작) 지정 UI 와 `POST /api/assessment-evaluation/period` 호출 경로 (REQ-077, PLAN `131 행` ④).
- `GET /api/contributions` · `GET /api/summaries` 응답의 표시 계약 정합 (`ContributionRow` / `SummaryRow` 축) — 별도 slice.
- backend `src/` 변경 · 응답 shape 변경 · e2e (`test/e2e/`) 추가.
- [requirements.md](../requirements.md) `94 행` REQ-075 상태 갱신 — 배선 완료 후 doc-only `direct` 후속.
- `web/package.json` 의 `coverageThreshold` 도입 (PLAN `127 행` 게이트된 backlog — 새 dependency §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
