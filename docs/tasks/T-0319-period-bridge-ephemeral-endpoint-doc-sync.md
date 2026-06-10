---
id: T-0319
title: period bridge ephemeral endpoint(POST /period) doc-sync — api.md + modules.md 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-06-10
plannerNote: P5 ADR-0037 ephemeral 완결(T-0315~T-0318)으로 shipped된 POST /period 가 api.md 누락·modules.md 'bridge deferred' stale — 정정(direct doc-sync, T-0295/T-0302/T-0311 precedent)
---

# T-0319 — period bridge ephemeral endpoint(POST /period) doc-sync

## Why

ADR-0037 ephemeral 경로가 end-to-end 로 shipped 됐다(T-0315 DTO → T-0316 orchestration → T-0317 controller → T-0318 e2e, main 55c0d77). 이제 `AssessmentEvaluationController` 는 **두 endpoint** 를 노출한다 — `POST /api/assessment-evaluation/evaluate`(Admin) + **신규 `POST /api/assessment-evaluation/period`(User self-only ephemeral, DB-write-0, T-0317)**. 그런데 architecture 문서가 실 시스템을 **mis-describe** 한다: (1) `docs/architecture/api.md` 의 평가 endpoint 표에 `/evaluate` 만 있고 **`/period` 가 누락** — shipped public API 가 surface 문서에 없다. (2) `docs/architecture/modules.md` 의 `AssessmentEvaluationModule` row 가 "**period·personId→수집 bridge 만 여전히 deferred**" 라고 적어 ephemeral bridge 가 미shipped 인 양 서술(stale). 본 task 는 그 두 곳을 실코드(controller L187~190 `@Post("period")` `@Roles("User")`)와 정합한다. T-0295/T-0302/T-0311 doc-sync 와 동일 material class — shipped 변경 후 architecture 문서를 실코드에 맞추는 정합(make-work 아님: 누락된 shipped endpoint·stale "deferred" 서술은 실제 correctness gap).

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 검증 source. **두 endpoint 의 실 계약**: `@Post("evaluate")` `@Roles("Admin")`(L116~119, 기존) + `@Post("period")` `@Roles("User")`(L187~190, 신규 T-0317). `/period` 는 `@CurrentUser("sub")` self-only(`sub == dto.personId`, 불일치 403 fail-closed), `PersonService.findByIdWithIdentities` 404 전파, `PeriodBridgeEphemeralService.generateEphemeral` 위임으로 `EvaluationResult[]` 를 **DB write 0** 으로 반환.
- `src/assessment-evaluation/dto/` 의 period bridge 입력 DTO(T-0315) — `/period` request body 형식(`personId`/`period`/`scope`/`periodStart` 등) 을 api.md row 에 정확히 반영하기 위해 실 DTO 의 validator(@IsISO8601/@IsString/whitelist)를 확인. (정확한 파일명은 `src/assessment-evaluation/dto/` 디렉토리에서 period 관련 DTO 1개.)
- `docs/architecture/api.md` (L100~101) — 평가 manual trigger 표. `/evaluate` row 바로 뒤(또는 별도 sub-heading)에 `/period` ephemeral row 를 추가할 위치.
- `docs/architecture/modules.md` (L41 AssessmentEvaluationModule row) — "period·personId→수집 bridge 만 여전히 deferred" 문장이 stale. ephemeral 경로가 shipped 됐음을 반영하도록 정정(Admin full-persist 는 여전히 §Decision2/3 PROPOSE 의존이므로 "ephemeral 경로 shipped / Admin full-persist 는 §Decision2/3 ADR PR 검토 대기" 로 구분 서술).
- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(User self-only ephemeral)·§Decision4(fresh collect source-of)·§Decision5(dep0/credential0/schema0). 문서 서술의 근거 ADR backref.

## Acceptance Criteria

본 task 는 architecture 문서(`docs/architecture/`) 2 파일만 수정하는 `direct` doc-sync 다. 코드 변경 0.

- [ ] `docs/architecture/api.md` 의 평가 manual trigger 표에 **`POST /api/assessment-evaluation/period` row 추가** — method(POST)·path·관련 UC(있으면 R-9 임의 기간 평가문 / UC backref)·설명(인증 User self-only ephemeral: `@CurrentUser("sub") == dto.personId` 일치 시에만 허용·불일치 403, request body 는 period bridge DTO(실 DTO 의 필드/validator 반영), `PeriodBridgeEphemeralService` 위임으로 fresh collect→evaluate→**DB write 0** in-memory `EvaluationResult[]` 200 반환, error 401/403/404/400)·RBAC(User self-only)·관련 task(T-0315~T-0318)·ADR backref([ADR-0037])를 기존 `/evaluate` row 포맷과 일관되게 기재. **DB-write-0 / self-only / fresh-collect source-of 를 명시**.
- [ ] `docs/architecture/modules.md` 의 `AssessmentEvaluationModule` row 에서 "**period·personId→수집 bridge 만 여전히 deferred**" stale 서술 정정 — ephemeral 경로(`POST /period`, User self-only, DB-write-0, T-0315~T-0318 / ADR-0037 §Decision1·4)가 **shipped** 됐음을 반영하고, **Admin full-persist 경로는 ADR-0037 §Decision2(double-write 경계)/§Decision3(idempotency)가 PROPOSE 상태(사용자 ADR PR 검토 대기)라 미shipped** 임을 구분 서술. ADR-0037 backref 추가.
- [ ] (있으면) `modules.md` 의 Backend API component row(L197 부근, "evaluation manual-trigger" 서술)에 ephemeral period endpoint 가 같은 controller 의 두 번째 endpoint 임을 1줄 반영(과도하게 늘리지 말 것 — 최소 정합).
- [ ] 문서 내 모든 신규 서술이 실코드와 일치(controller 의 실제 `@Roles`·path·self-only·persist 0 과 모순 0). ADR-0037 §Decision 번호 인용 정확.
- [ ] 분기 없음(doc-only) — R-112 test 항목은 본 task 에 미적용(코드 변경 0). `commitMode: direct` 라 tester/PR/CI 게이트 미해당(CLAUDE.md §3.1/§3.2 — direct doc-only commit 은 R-110 면제).
- [ ] §12 언어 정책 — 본문 한국어, 식별자/path/endpoint/enum 영어 유지.

## Out of Scope

- **Admin full-persist 경로 문서화** — §Decision2/3 PROPOSE 의존(미shipped). 본 task 는 ephemeral 경로 shipped 사실만 정합하고 Admin 경로는 "PROPOSE 검토 대기 / 미shipped" 로만 표기. ACCEPTED 후 별도 doc-sync.
- **data-model.md 변경** — ADR-0037 은 schema 변경 0(새 table/컬럼/unique 미동반, §Decision5). period bridge 는 기존 Assessment/Contribution/Summary entity 재사용만이므로 data-model.md 정합 불요. (만약 검토 중 data-model 정합 필요가 보이면 Follow-ups 에 기록만.)
- **코드 변경** — controller/service/DTO 는 T-0315~T-0317 머지 완료. 본 task 는 architecture 문서만. 코드에서 결함 발견 시 즉시 수정 금지 — Follow-ups 에 patch task 후보로 기록.
- **ADR status flip** — ADR-0037 은 PROPOSED 유지(§Decision2/3 사용자 검토 대기). 본 doc-sync 가 ADR status 를 건드리지 않는다.
- **Admin full-persist impl / 동시 idempotency / live-LLM** — 전부 §Decision2/3 또는 §5 credential 게이트 의존. 본 task 밖.

## Suggested Sub-agents

`implementer` 단독(또는 driver 직접 편집 — direct doc-only). 코드 변경 0 이라 tester 불요(direct commitMode, R-110 면제). 2 파일 doc-sync 만.

## Follow-ups

(생성 시 비어 있음. 작업 중 Admin full-persist 경로의 §Decision2/3 PROPOSE 의존을 재확인 — ephemeral 완결 후 남은 ADR-0037 backbone 은 §Decision2/3 사용자 검토 후에만 진행 가능. 본 doc-sync 머지 후 planner 가 Q-0032 escalate 예정.)
