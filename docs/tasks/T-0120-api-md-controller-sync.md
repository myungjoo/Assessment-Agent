---
id: T-0120
title: api.md §4·§5 를 shipped controller 현실과 동기 (assessments 정정 + contributions/summaries 추가)
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-029, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-05-31
plannerNote: "P3 controller mirror chain 3/3(T-0117/0118/0119) 의 defer 된 api.md row 보강 — doc-only enumerated-section inline-amend × 0.64, living architecture doc(§3.1 direct)."
dependsOn: [T-0117, T-0118, T-0119]
completedAt: 2026-05-31T19:28:00+09:00
committedVia: direct (driver-inline, no PR)
---

# T-0120 — api.md §4·§5 를 shipped controller 현실과 동기

## Why

P3 controller mirror chain 3/3 (AssessmentController T-0117 / ContributionController T-0118 / SummaryController T-0119) 가 모두 머지됐으나, living API contract `docs/architecture/api.md` 가 shipped 현실과 어긋난다. 세 controller task 모두 api.md row 보강을 reviewer MINOR finding + journal 로 defer 했다 (PLAN.md Phase P3 "평가 결과 저장 모델" + L37 api.md living-doc 갱신 책무). 본 task 는 그 deferred follow-up 을 닫아 contract 를 truth source 로 복구한다.

구체 divergence 3 건:

1. **§5 `/api/assessments` 행 (L88-93) 이 stale** — 현재 P2 MVA 시점의 UC-06 batch 연산 (`GET ?sort&filter&window` / `POST /run` manual trigger / `DELETE` bulk-by-dateRange / `POST /reeval` / `POST /reset`) 을 기술하나, T-0117 이 실제 sh: 한 것은 **plain CRUD** (`GET ?personId=&period=` / `GET :id` / `POST` create / `DELETE :id`). UC-06 batch endpoint 는 P5 evaluation pipeline 의존이라 미구현 (assessment.controller.ts L29 명시).
2. **`/api/contributions` 전체 누락** — §4 Resource model 표 + §5 endpoint 표 어디에도 없음. T-0118 이 4 endpoint 박제 (`GET ?assessmentId=` / `GET :id` / `POST` / `DELETE :id`).
3. **`/api/summaries` 전체 누락** — §4 + §5 어디에도 없음. T-0119 이 4 endpoint 박제 (`GET ?personId=&period=` / `GET :id` / `POST` / `DELETE :id`).

## Required Reading

- `C:/Users/myung/Assessment-Agent/docs/architecture/api.md` (§4 Resource model 표 L45-55, §5 endpoint 표 특히 UC-01/02/06 평가 블록 L87-93, §7 cross-reference L130-145, §5 합계 줄 L110)
- `C:/Users/myung/Assessment-Agent/src/user/assessment.controller.ts` (shipped 4 endpoint + Out of Scope 주석 — batch 연산 P5 defer 근거)
- `C:/Users/myung/Assessment-Agent/src/user/contribution.controller.ts` (shipped 4 endpoint + flat `?assessmentId=` query 채택 근거)
- `C:/Users/myung/Assessment-Agent/src/user/summary.controller.ts` (shipped 4 endpoint + period 분기)

## Acceptance Criteria

- [ ] **§5 `/api/assessments` 블록 정정** — shipped CRUD 4 endpoint 만 반영: `GET /api/assessments?personId=&period=` (REQ-038 시계열, findByPerson, personId 누락 시 400) / `GET /api/assessments/:id` (404) / `POST /api/assessments` (201, literal 위반 400 / `@@unique` 중복 409) / `DELETE /api/assessments/:id` (204, 404). **기존의 `POST /run` · bulk `DELETE` · `POST /reeval` · `POST /reset` 행은 "P5 evaluation pipeline 에서 도입 예정 (UC-06 batch)" 으로 명시 deferred 표기** — 삭제하지 말고 미구현임을 한 줄로 박제 (UC-06 §5 cross-reference 보존). 각 행 description 끝에 박제 task ID (T-0117) 표기.
- [ ] **§4 Resource model 표에 `/api/contributions` 행 추가** — 책임 module `UserModule`, 책임 UC `UC-01, UC-02` (Assessment 의 component), 비고: 개별 commit/PR/문서 단위 기여 (REQ-033), immutable (PATCH 부재).
- [ ] **§4 Resource model 표에 `/api/summaries` 행 추가** — 책임 module `UserModule`, 책임 UC `UC-02` (시계열 조회), 비고: 일/주/월 요약 평가 (REQ-034, REQ-035, REQ-038), immutable.
- [ ] **§5 endpoint 표에 `/api/contributions` 4 행 추가** (평가 블록 하위 sub-header 또는 별도 그룹) — `GET /api/contributions?assessmentId=` (findByAssessment, assessmentId 누락 시 400, 매칭 0 시 빈 배열) / `GET /api/contributions/:id` (404) / `POST /api/contributions` (201, literal·FK P2003 위반 400, `@@unique` 부재라 409 분기 없음) / `DELETE /api/contributions/:id` (204, 404). auth tier 는 기존 평가 행과 동일 표기 (GET=User+, POST/DELETE=Admin+) + 박제 task (T-0118) 표기.
- [ ] **§5 endpoint 표에 `/api/summaries` 4 행 추가** — `GET /api/summaries?personId=&period=` (findByPerson, personId 누락 시 400) / `GET /api/summaries/:id` (404) / `POST /api/summaries` (201, period literal·FK P2003 위반 400, 409 분기 없음) / `DELETE /api/summaries/:id` (204, 404). auth tier 동일 + 박제 task (T-0119) 표기.
- [ ] **§5 합계 줄 (L110) 갱신** — endpoint 총개수 + resource prefix 개수 (9 → 11) 를 새 prefix 2 개 반영해 정정.
- [ ] **§7 UC §5 cross-reference 표 보강** (선택, 자연스러우면) — `/api/contributions` · `/api/summaries` 가 UC-01/UC-02 의 어느 step 에서 호명되는지 한 줄. UC sequence 에 직접 호명이 없으면 "P3 controller chain 으로 신설 — UC sequence 직접 호명 0, REQ-033/034/035 backing store" 박제.
- [ ] **§5 Refs 줄 + 문서 하단 Refs 줄 갱신** — T-0117, T-0118, T-0119 task ID 추가.
- [ ] 표 정렬·마크다운 형식 유지 (기존 표 컬럼 수·구분자 정합). 깨진 표 0.
- [ ] (분기 없음 — doc-only 변경이라 R-112 test 항목 미적용. tester 미호출 — direct-mode doc-only commit.)

## Out of Scope

- src/ 코드 변경 0 — 본 task 는 doc-only direct. controller/DTO/service 어느 것도 수정 안 함.
- AuthGuard / RBAC 적용 변경 0 — api.md 의 auth tier 컬럼은 *의도된* tier 를 박제 (User+ / Admin+). 실제 controller 는 아직 guard 미적용 (별도 AuthGuard wiring task). 본 task 는 tier 컬럼을 의도값으로 적되, 미적용 사실을 한 줄 각주로만 (기존 평가 행 정책과 동일하게).
- UC-06 batch endpoint (`/run`, `/reeval`, `/reset`, bulk DELETE) 의 실 구현 — P5 의존. 본 task 는 deferred 표기만.
- 구체 JSON request/response schema · OpenAPI YAML 추가 — api.md §8 Out of scope 정책 유지 (MVA 수준 표만).
- data-model.md / modules.md / components.md 등 다른 architecture doc 동기 — 본 task 는 api.md 단일 파일만. 필요 시 Follow-up.
- 새 ADR 작성 — 아키텍처 결정 변경 0 (기존 endpoint 의 문서화 sync 일 뿐).

## Suggested Sub-agents

`implementer` (단일 doc edit — architect/tester 미호출, doc-only direct commit). executor 가 직접 Edit 으로 처리해도 무방.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
