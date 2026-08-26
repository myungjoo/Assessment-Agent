---
id: T-1726
title: AssessmentDisplayRow 정렬·검색 순수 연산 모듈 assessmentRowOps 신설
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-075]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1724, T-1725]
touchesFiles:
  - web/src/api/assessmentRowOps.ts
  - web/src/api/assessmentRowOps.test.ts
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-27
plannerNote: P6 오너지시 PLAN 131행 ② 분해 slice 3a — DashboardView 배선 전에 새 row 형태의 정렬·검색을 순수 모듈로 선분리(배선은 slice 3b)
---

# T-1726 — AssessmentDisplayRow 정렬·검색 순수 연산 모듈 assessmentRowOps 신설

## Why

[PLAN.md](../PLAN.md) `131 행` 🔴 오너 지시 ② ([requirements.md](../requirements.md) `94 행` REQ-075) 의 분해 slice 3a 다. slice 1 (T-1724) 이 `AssessmentDisplayRow` 매핑 helper 를, slice 2 (T-1725) 가 그 행을 렌더하는 `AssessmentResultTable` 을 박제했으나 **둘을 소비할 컨테이너 배선이 아직 없다**. 배선처인 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 는 769 행이고 그 안의 `sortRows` · `filterRows` 가 **옛 행 계약(`EvaluationResultRow{subjectName,metricLabel,score}`) 전용**이라, 새 행 계약으로 갈아끼우려면 정렬·검색·표 교체를 한 commit 에 몰아야 해 §3 크기 상한 (300 LOC / 5 파일) 을 넘는다.

그래서 배선(slice 3b) 이 얇아지도록, 새 행 형태 전용 정렬·검색 **순수 연산만** 먼저 별도 모듈로 분리한다. 숫자 축 두 개(`contributionScore` · `volume`) 가 `null` 을 가질 수 있어(값 없음 ≠ 0 점, T-1724 의 결정) 옛 `sortRows` 의 단순 뺄셈 비교로는 `null` 이 `0` 으로 위장되거나 `NaN` 비교로 순서가 무너진다 — 이 정책 결정은 표시층·컨테이너 어디에도 아직 박제된 적이 없으므로 본 slice 가 test 로 고정한다.

## Required Reading

- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 9 키 · `ASSESSMENT_DISPLAY_ROW_KEYS` · 숫자 축 `null` 정책 · 순수성 계약(fetch · React import 0, throw 0, 입력 mutation 0).
- [web/src/api/assessmentRow.test.ts](../../web/src/api/assessmentRow.test.ts) — colocated spec 서술 관례 · drift guard test 작성 형태.
- [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `18~30 행` — `AssessmentSortKey` 6 키와 `ASSESSMENT_TABLE_COLUMNS` 선언 순서 (본 모듈의 정렬 가능 키 목록이 이것과 일치해야 한다).
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `285~340 행` — 옛 `filterRows` · `sortRows` 의 시그니처 · 비파괴 정렬 · 빈 검색어 통과 규약 (본 모듈이 승계할 형태).
- [web/src/api/roleAccess.ts](../../web/src/api/roleAccess.ts) — `web/src/api/` 하위 순수 모듈의 주석 · export convention 선례.

## Acceptance Criteria

- [ ] `web/src/api/assessmentRowOps.ts` 신설. 순수 모듈 — `fetch` · React · `useApiResource` · 컴포넌트 파일 import 0, module-level 가변 상태 0, throw 0, 입력 배열/객체 mutation 0. `assessmentRow.ts` 로부터 `AssessmentDisplayRow` **type-only import** 만 허용.
- [ ] named export 3 개 + type export 1 개: `ASSESSMENT_SORTABLE_KEYS` (`period` · `scope` · `periodStart` · `difficulty` · `contributionScore` · `volume` 6 개, 선언 순서 = 표 컬럼 순서), `type AssessmentRowSortKey`, `filterAssessmentRows(rows, searchTerm)`, `sortAssessmentRows(rows, sortKey, sortDirection)`.
- [ ] `filterAssessmentRows` — 검색어 trim 후 빈 문자열이면 입력 순서 그대로 전체 통과. 그 외에는 문자열 축(`period` · `scope` · `periodStart` · `difficulty` · `narrative`) 에 대소문자 무시 부분 일치. 숫자 축은 검색 대상이 아니다(주석으로 사유 명시).
- [ ] `sortAssessmentRows` — 비파괴(새 배열 반환, 입력 배열 순서 불변). 숫자 축은 수치 비교하되 **`null` 은 정렬 방향과 무관하게 항상 마지막**(값 없음이 최고점/최저점으로 위장되지 않도록), 문자열 축은 `localeCompare`.
- [ ] happy-path unit test 1+ — 정렬 함수: 문자열 축 오름/내림차순 각 1+, 숫자 축 오름/내림차순 각 1+. 검색 함수: 부분 일치로 행이 걸러지는 경우 1+.
- [ ] error path unit test 1+ — 두 함수 모두 `null` · `undefined` · 배열 아닌 값(객체 · 문자열 · 숫자) 입력 시 빈 배열 반환 + throw 0 검증.
- [ ] 분기 cover — 정렬: 문자열 축 / 숫자 축 / 미지원 정렬 키 / `asc` / `desc` / 양쪽 `null` / 한쪽 `null` 각 1+ test. 검색: 빈 검색어 / 공백뿐인 검색어 / 일치 / 불일치 / 대소문자 상이 각 1+ test.
- [ ] negative cases 충분 cover — 각 1+ test: (a) `null` 숫자 축이 `0` 앞뒤로 위장되지 않음(0 과 `null` 을 함께 넣어 순서 확인), (b) 미지원 정렬 키 전달 시 입력 순서를 보존한 새 배열 반환, (c) 빈 배열 입력 시 빈 배열, (d) 타입 우회로 들어온 결손 행(키 누락 · `undefined` 값) 이 throw 없이 흡수됨, (e) 정렬·검색 호출 후 원본 배열과 원본 행 객체가 변경되지 않음(`Object.freeze` 된 입력으로 검증), (f) 검색어에 정규식 특수문자(`.` · `*` · `[`) 가 들어와도 리터럴로 취급됨.
- [ ] drift guard test 1+ — `ASSESSMENT_SORTABLE_KEYS` 가 `AssessmentResultTable` 의 `ASSESSMENT_TABLE_COLUMNS` 키 목록과 순서까지 동일함을 검사(spec 에서만 컴포넌트 named export 를 import). 한쪽만 컬럼을 늘리면 fail.
- [ ] `cd web && pnpm test` (vitest) 전량 green, `cd web && pnpm build` 통과.
- [ ] backend `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` diff 0 이라 coverage 불변임을 확인.

## Out of Scope

- [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 수정 — 본 모듈 소비 배선(표 교체 · 정렬 상태 재배선) 은 slice 3b 책임. 본 task 의 diff 0 파일.
- [AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) · [assessmentRow.ts](../../web/src/api/assessmentRow.ts) · [EvaluationResultTable.tsx](../../web/src/components/EvaluationResultTable.tsx) 수정 — 전부 diff 0 파일(spec 에서 read-only import 만).
- 요약 지표(`deriveMetrics`) · 점수 분포(`deriveScoreBuckets`) 를 새 행 형태로 옮기는 작업 — REQ-076 축 스케일 정합과 함께 별도 slice.
- 페이지네이션(`pageRows`) 재작성 — 이미 제네릭이라 새 행 형태에 그대로 쓸 수 있다.
- `src/` · `test/e2e/` · `package.json` · 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 여기에 append)
