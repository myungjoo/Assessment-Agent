---
id: T-1914
title: requirements.md 22 행 REQ-003 의 "표시 축 프런트 렌더 미충족" stale drift 정정
phase: P8
status: PENDING
commitMode: direct
coversReq: [REQ-003]
estimatedDiff: 35
estimatedFiles: 2
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1914-requirements-req003-frontend-render-drift-rejudge.md
created: 2026-09-06
plannerNote: "T-1913 Follow-up (a) / T-1912 Follow-up (c) — REQ-003 표시 축 (b) 서술이 T-1724~T-1731 배선 arc 반영 0 인 stale drift"
---

# T-1914 — requirements.md 22 행 REQ-003 의 "표시 축 프런트 렌더 미충족" stale drift 정정

## Why

[docs/requirements.md](../requirements.md) `22 행` REQ-003 (README `7 행` — 개발자 기여 양·질 평가 / 저장 / 표시) 의 상태 문자열은 `IN_PROGRESS (평가 축 · 저장 축 · 표시 축 API 실재 / 표시 축 프런트 렌더 부재: ...)` 이고, 그 안의 **표시 축 (b)** 문단이 지목한 유일한 미충족 근거는 "`DashboardView` 가 `EvaluationResultRow` (`subjectName` · `metricLabel` · `score`) 를 소비해 backend row 필드명과 `id` 외 한 개도 일치하지 않는다 / `volume` · `difficulty` 참조가 655 행 전수에서 0" 이다. 그 서술은 **이미 main 에서 무효**다. [T-1912](T-1912-dependency-consistency-ci-gate.md) Follow-ups (c) · [T-1913](T-1913-requirements-req056-ci-axis-status-rejudge.md) Follow-ups (a) 가 승계해 온 항목이며, CLAUDE.md `§3.1` 의 "REQ 당 1 회" 제약은 **구현 arc 와 무관한 drift 정정 예외** 에 해당한다 (본 task 는 새 구현 slice 의 반영이 아니라 이미 오래전 머지된 배선 arc 가 문서에 0 건 반영된 lag 를 닫는다).

**issue-still-relevant pre-check (planner 실측, head `968b3eb6`)** — ① 문서 쪽은 **아직 미정정**이다: `awk 'NR==22' docs/requirements.md` 에 `표시 축 (b) 프런트 렌더는 미충족` 문자열이 그대로 살아 있고 상태 enum 도 `IN_PROGRESS` 다. ② 구현 쪽은 **안착 완료**다: `web/src/views/DashboardView.tsx` `27 행` ~ `34 행` 이 `AssessmentResultTable` · `ASSESSMENT_TABLE_COLUMNS` · `deriveAssessmentDisplayRows` · `AssessmentDisplayRow` · `filterAssessmentRows` / `sortAssessmentRows` 를 import 하고, `635 행` 이 `filterAssessmentRows(deriveAssessmentDisplayRows(data), searchTerm)` 로 backend row 를 표시 행으로 변환하며, `861 행` `<AssessmentResultTable rows={pagedRows} ... />` 로 렌더한다. 그 표의 `ASSESSMENT_TABLE_COLUMNS` (`web/src/components/AssessmentResultTable.tsx` `25 행` ~ `32 행`) 는 `period` · `scope` · `periodStart` · `difficulty` · `contributionScore` · `volume` 6 컬럼이라 옛 서술이 "참조 0" 이라 단언한 **양 축 `volume` 과 난이도 `difficulty` 가 실제 렌더 컬럼**이다 (`web/src/api/assessmentRow.ts` `22 행` `difficulty` · `26 행` `volume` · `98 행` · `100 행` 매핑). 배선 arc 는 `41c6263c` (T-1724 매핑 helper) · `e1843e80` (T-1725 표 컴포넌트) · `4cd854d4` (T-1726 정렬·검색 모듈) 이후 T-1727 배선까지 이미 main 이다. 또 `DashboardView.tsx` 는 옛 서술의 `655 행` 이 아니라 현재 **984 행**이라 인용 좌표 자체가 stale 이다.

## Required Reading

- [docs/requirements.md](../requirements.md) `22 행` (REQ-003 행 전체 — 8,316 자 단일 행) + 표 헤더 `18 행` ~ `19 행` (컬럼 순서) + `9 행` (상태 enum 정의). 인접 `21 행` REQ-002 · `23 행` REQ-004 는 `|` 필드 수 대조용으로만 읽는다.
- [docs/tasks/T-1913-requirements-req056-ci-axis-status-rejudge.md](T-1913-requirements-req056-ci-axis-status-rejudge.md) — 직전 재판정의 상태 문자열 포맷 (`DONE (implemented-on-main — <근거>)` · `한계 —` 부기) 과 표 무결성 검증 절차의 선례. **실측값을 복사하지 말고 직접 재확인**한다.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `27 행` ~ `34 행` (import) · `632 행` ~ `637 행` (`visibleRows` 파생) · `861 행` ~ `867 행` (`<AssessmentResultTable>` 마운트). 인용 시 실제 행 번호를 파일에서 재확인해 적는다.
- [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `22 행` ~ `32 행` (`AssessmentSortKey` 6 키 + `ASSESSMENT_TABLE_COLUMNS` 한국어 라벨) + 파일 상단 주석의 제외 3 키 (`id` · `personId` · `narrative`) 사유.
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 필드 정의와 backend row → 표시 행 매핑 (`difficulty` · `contributionScore` · `volume` 축).
- [README.md](../../README.md) `7 행` — REQ-003 원문. 상태 문자열이 원문 3 요소 (양·질 평가 / 저장 / 표시) 를 모두 다루는지 대조용.

## Acceptance Criteria

- [ ] **표시 축 (b) 문단 재작성** — `22 행` 안의 `**표시 축 (b) 프런트 렌더는 미충족** 이다 — ...` 문단을 실측 기반 충족 서술로 교체한다. 근거에 (1) `DashboardView.tsx` 의 import 행 · 파생 행 · 마운트 행 번호, (2) `AssessmentResultTable` 의 실제 렌더 컬럼 6 종, (3) 양 축 `volume` · 질 축 `difficulty` · `contributionScore` 가 실제 컬럼임을 각각 명시한다. **행 번호는 파일에서 직접 재확인한 값**이어야 하고, 옛 서술의 `655 행` · `EvaluationResultRow` · `240 행 deriveScoreBuckets` 등 무효 좌표는 남기지 않는다.
- [ ] **narrative 컬럼 제외 사실 보존** — 표가 `narrative` 를 표시 컬럼에서 제외한다는 점 (`AssessmentResultTable.tsx` 상단 주석의 제외 3 키) 을 충족 서술 안에 사실대로 적는다. 렌더 충족을 과장해 "모든 필드가 표에 노출된다" 로 적지 않는다.
- [ ] **상태 enum 판정** — 위 재실측 결과 평가 축 · 저장 축 · 표시 축 (API) · 표시 축 (프런트 렌더) 4 축이 모두 충족이면 상태를 `DONE (implemented-on-main — ...)` 로 전이한다. 어느 한 축이라도 실측에서 미충족으로 나오면 `DONE` 으로 올리지 말고 `IN_PROGRESS (<충족 축> / <미충족 축>)` 를 유지하되 사유 문구를 실측으로 갱신한다.
- [ ] **나머지 축 서술 보존** — 평가 축 · 저장 축 · 표시 축 (a) API · wiring 축 문단은 **재서술하지 않는다**. 본 task 는 (b) 문단과 그로 인해 무효가 된 문장 (상태 prefix 의 `표시 축 프런트 렌더 부재` 표현, `한계 —` 절의 `프런트는 필드명 계약이 backend 와 어긋나 ... 실렌더되지 않고` 문장) 만 최소 수정한다.
- [ ] **한계 부기 유지** — `한계 —` 절에 (a) 단위 평가문이 `Contribution` 에 컬럼 없이 `Assessment.narrative` 로 join 되어 단위별 정성 근거 개별 조회 경로가 없다, (b) smoke 가 저장 축 · 표시 축을 0 건 cover 한다 (`검증 위치` 컬럼은 `unit + smoke`) 2 가지를 남긴다. (b) 는 `grep -rln "api/assessments" test/smoke` 로 재확인한 결과를 근거로 삼는다.
- [ ] **표 무결성 검증** — 편집 후 `awk 'NR==22' docs/requirements.md | grep -o "|" | wc -l` 이 `8` 로 인접 `21 행` · `23 행` 과 동일하고, 상태 문자열 안에 리터럴 `|` 문자가 없으며 (T-1370 · T-1375 사고 재발 방지), `wc -l docs/requirements.md` = `121` 과 `grep -c "^| REQ-" docs/requirements.md` = `84` 가 편집 전후 불변임을 확인한다.
- [ ] 본 task 파일의 frontmatter `status` 를 `DONE` 으로 바꾸고 본문 끝에 완료 시각 · 실측 요약 (인용한 행 번호 포함) 을 1~3 줄로 추가한다.

## Out of Scope

- `web/` · `src/` · `test/` **코드 수정 일체** — 본 task 는 `commitMode: direct` doc-only 다. 결함을 발견하면 Follow-ups 에만 적는다.
- REQ-004 `23 행` 의 프런트 노출 축 (`deriveContributionMetrics` 필드 불일치 · 기간 지정 UI 부재) 재판정 — 별도 slice (Follow-ups (a)). 두 행을 한 commit 에 넣으면 실측 부담이 겹쳐 검증이 흐려진다.
- REQ-003 행의 **상태 외 컬럼** (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정. `검증 위치` 의 `smoke` 표기 정정이 필요해 보여도 본 task 는 `한계 —` 부기로만 남긴다.
- 평가 축 · 저장 축 · wiring 축의 심볼 좌표 전수 재실측 (행 번호 refresh 포함) — 무효가 된 (b) 문단 외의 stale 좌표는 발견 시 Follow-ups 에 적는다.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 등에 인용된 과거 audit snapshot 의 `IN_PROGRESS` 문자열 **소급 치환** — 그것은 당시 실측의 기록이다 (CLAUDE.md `§12` 소급 치환 금지 동형).
- PLAN.md · CLAUDE.md · ADR 갱신.

## Suggested Sub-agents

`implementer` (doc-only — architect · tester 불요, R-110 은 direct doc-only commit 면제)

## Follow-ups

- (a) [docs/requirements.md](../requirements.md) REQ-004 `23 행` 의 프런트 노출 축 서술 재실측 (`direct`) — `deriveContributionMetrics` 필드 불일치 · 기간 지정 UI 부재 2 항목이 여전히 유효한지 실측 후 판정.
- (b) transitive dependency 복수 version 판정 (lockfile 분석) 의 필요성 · 도구 유무 검토 — 새 도구가 필요하면 ADR + 사람 승인 선행 (T-1913 Follow-ups (b) 승계).
