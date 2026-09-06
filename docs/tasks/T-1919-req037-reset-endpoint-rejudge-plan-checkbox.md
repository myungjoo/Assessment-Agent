---
id: T-1919
title: REQ-037 재판정 1 회 — 명시적 Reset endpoint 안착 반영 + PLAN 106 행 checkbox 판정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-037]
estimatedDiff: 60
estimatedFiles: 3
created: 2026-09-06
independentStream: req-037-explicit-reset-endpoint
dependsOn: [T-1915, T-1916, T-1917, T-1918]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
  - docs/tasks/T-1919-req037-reset-endpoint-rejudge-plan-checkbox.md
plannerNote: "T-1918 Follow-up (a) — reset chain 전량 머지 후 REQ-037 재판정 1 회 (CLAUDE.md §3.1 · PLAN 183 행 왕복 제거)"
---

# T-1919 — REQ-037 재판정 1 회 (명시적 Reset endpoint 안착 반영 + PLAN 106 행 checkbox 판정)

## Why

[T-1918](T-1918-reset-route-e2e-seeded-delete-roundtrip.md) `Follow-ups (a)` 가 "REQ-037 재판정 1 회 — 본 slice 머지 후 `docs/requirements.md` `56 행` 상태 문자열 · PLAN `106 행` checkbox 를 **한 번에** 재판정(중간 재판정 금지)" 로 명시했고, 그 선행 조건인 reset chain 4 slice 가 전량 머지됐다. [CLAUDE.md](../../CLAUDE.md) `§3.1` 의 "REQ 재판정은 구현 slice 머지 뒤 REQ 당 1 회" 와 [docs/PLAN.md](../PLAN.md) `183 행` 오너 지시(재판정 왕복 제거)가 요구하는 **바로 그 1 회**가 본 task 다 — chain 중간(T-1915·T-1916·T-1917)에서는 재판정하지 않았고, 이제 마지막 slice 가 닫혔으므로 지금이 유일한 판정 시점이다. 경쟁 축은 자율 집행 불가다: PLAN `157 행` R-91 은 배포기기 자격증명 주입이 필요해 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트이고, `158 행` R-92 는 오너가 신규 per-route slice 큐잉을 금지한다.

**issue-still-relevant pre-check (planner 실측, origin/main `eb235375`).** ① **문서 쪽은 아직 미정정**이다 — `git show origin/main:docs/requirements.md` 의 `56 행` REQ-037 이 여전히 `IN_PROGRESS (... / 디버깅용 명시적 Reset endpoint 부재 ...)` 이고, 같은 행의 `한계 —` 문장이 "`resetByPeriod` 두 심볼의 참조는 자기 service 와 자기 spec 뿐이라 **controller wiring 이 0**", "spec cover 는 `summary-persist.service.spec.ts` `367 행` unit 3 it 뿐, **e2e 0**" 이라고 단언한다. `git show origin/main:docs/PLAN.md | sed -n '106p'` 도 `- [ ]` 로 미판정이다. ② **구현 쪽은 안착 완료**다 — `git grep -n 'Post("reset")' origin/main -- 'src/**/*.controller.ts'` 가 `assessment-evaluation.controller.ts:739` 1 건 hit 하고, 그 handler 가 `ResetByPeriodRequestDto` 를 받아 두 persist service 의 `resetByPeriod` 를 순차 위임한 뒤 4 필드(`personId` · `period` · `deletedAssessments` · `deletedSummaries`)로 응답한다. DTO 는 `src/assessment-evaluation/dto/reset-by-period-request.dto.ts`(+ colocated spec)로 실재하고, e2e 는 `test/e2e/assessment-evaluation-reset.e2e-spec.ts` 가 **501 행 · `it` 17 개**(T-1917 의 10 + T-1918 의 7)로 자랐다. 즉 옛 상태 문자열의 두 미충족 근거(controller wiring 0 · e2e 0)가 **모두 무효**다. 머지 좌표는 `d6de8f5c`(T-1915 DTO) · `dc2dd9d0`(T-1916 route, PR #1504) · `069e274a`(T-1917 e2e 1/2, PR #1505) · `347c2794`(T-1918 e2e 2/2, PR #1506). 따라서 본 task 는 재큐잉이 아니며, 같은 REQ 를 두 번 판정하는 왕복도 아니다.

**cap · 소비처 판정.** `docs/` 만 건드리는 doc-only 라 [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정은 `direct` 이고, 소비처 동반 의무(§3)는 helper 신설 0 이라 해당 없다. estimate 는 planner estimate model 의 doc-only enumerated-section(× 1.6) × inline-amend sub(× 0.4) = effective × 0.64 를 적용해 ~60 LOC(선례 T-1913 · T-1914 동형).

## Required Reading

- [docs/tasks/T-1918-reset-route-e2e-seeded-delete-roundtrip.md](T-1918-reset-route-e2e-seeded-delete-roundtrip.md) `Follow-ups` 절 — 본 task 가 이행하는 (a) 의 명세(요구사항 행 + PLAN checkbox 를 **한 commit 에서 한 번에**)와, 남겨야 할 (b) Contribution cascade e2e.
- [docs/requirements.md](../requirements.md) `56 행` (REQ-037 단일 행 전체, 약 3,200 자) + 표 헤더 `18 행` ~ `19 행`(컬럼 순서) + `9 행`(상태 enum 정의). 인접 `55 행` · `57 행` 은 `|` 필드 수 대조용으로만.
- [docs/PLAN.md](../PLAN.md) `106 행`(R-64 bullet 전체 — checkbox · "**checkbox `[ ]` 유지**" 사유 문장 · `bullet 107` 상호참조) 과 `107 행` · `108 행`(현재 두 bullet 이 각각 무엇인지 확인 — `106 행` 의 "overwrite/reset 잔여는 bullet 107" 참조가 현행 배치와 맞는지 판정하기 위함).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `739 행` ~ `760 행` — `@Post("reset")` + `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 스택과 두 service 순차 위임 · 4 필드 응답. **인용할 행 번호는 파일에서 직접 재확인**한다.
- `src/assessment-evaluation/dto/reset-by-period-request.dto.ts` 및 colocated `reset-by-period-request.dto.spec.ts` — 요청 계약(필드 · 검증)과 unit cover.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` `140 행` ~ `152 행` 및 `src/assessment-evaluation/summary-persist.service.ts` `140 행` ~ `150 행` — `deleteMany({ where: { personId, period } })` 가 **scope · periodStart 를 조건에 넣지 않는다**는 계약(재판정 서술이 과장 없이 적어야 할 범위).
- `test/e2e/assessment-evaluation-reset.e2e-spec.ts` — 파일 머리 주석의 책임 목록과 `it` 목록. 인용할 `it` 개수 · 행 수는 실측으로 확인한다.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` · `evaluation-result-persist.service.spec.ts` · `summary-persist.service.spec.ts` 안의 `resetByPeriod` describe 블록 — unit cover 좌표(옛 서술의 "`367 행` unit 3 it 뿐" 을 대체할 실측값).
- [docs/tasks/T-1914-requirements-req003-frontend-render-drift-rejudge.md](T-1914-requirements-req003-frontend-render-drift-rejudge.md) `Acceptance Criteria` — 상태 문자열 포맷(`DONE (implemented-on-main — <근거>)` · `한계 —` 부기)과 표 무결성 검증 절차의 선례. **실측값은 복사하지 말고 직접 재확인**한다.

## Acceptance Criteria

- [ ] **REQ-037 상태 문자열 재작성 (`docs/requirements.md` `56 행`)** — 옛 서술 중 이제 무효인 두 근거를 실측 기반으로 교체한다: (1) "`resetByPeriod` ... controller wiring 이 0" → `@Post("reset")` route 의 실제 행 번호 · RBAC 스택(`@Roles("Admin")`) · 응답 4 필드 · 위임 순서, (2) "spec cover 는 ... unit 3 it 뿐, e2e 0" → 현행 e2e spec 파일 경로 · `it` 개수와 unit spec 좌표. 인용하는 행 번호 · 개수는 **본 task 실행 시점에 파일에서 재확인한 값**이어야 한다.
- [ ] **상태 enum 판정** — 일괄 평가 축 · Reeval 축 · 명시적 Reset 축 3 축이 모두 충족이면 `DONE (implemented-on-main — ...)` 로 전이한다. 어느 한 축이라도 실측에서 미충족이면 `DONE` 으로 올리지 말고 `IN_PROGRESS (<충족 축> / <미충족 축>)` 를 유지하되 사유를 실측으로 갱신한다(과장 금지 — 검증 수단 열이 `e2e` 이므로 e2e 실측이 판정의 근거여야 한다).
- [ ] **한계 부기 유지 · 갱신** — 옛 행이 남긴 미확인 항목 중 **여전히 유효한 것**을 `한계 —` 절에 보존한다: (a) reset 의 운영 범위가 `personId` + `period` 단위이고 **광역(전체) 초기화 경로는 없다**, (b) `deleteMany` where 에 `scope` · `periodStart` 가 없어 같은 period 의 모든 scope 좌표가 함께 지워진다, (c) Admin UI(web) 노출 0, (d) 허용 외 period 요청이 400 이 아니라 500 으로 표면화된다(있는 그대로). 이미 해소된 항목(controller wiring 0 · e2e 0)은 남기지 않는다.
- [ ] **나머지 축 서술 보존** — 일괄 평가 축(`unevaluated-fill-plan` / `-run`)과 Reeval 축(`mode === "reeval"` · `dto.reevaluate` · `persistInTransaction` reset-and-recreate) 문단은 **재서술하지 않는다**. 본 task 는 Reset 축 문단과 그로 인해 무효가 된 문장(상태 prefix 의 `명시적 Reset endpoint 부재` 표현 포함)만 최소 수정한다.
- [ ] **표 무결성 검증** — 편집 후 `awk 'NR==56' docs/requirements.md | grep -o "|" | wc -l` 이 `8` 로 인접 `55 행` · `57 행` 과 동일하고, 상태 문자열 안에 리터럴 `|` 문자가 없으며(T-1370 · T-1375 사고 재발 방지), `wc -l docs/requirements.md` = `121` 과 `grep -c "^| REQ-" docs/requirements.md` = `84` 가 편집 전후 불변임을 확인한다.
- [ ] **PLAN `106 행` checkbox 판정** — R-64 의 두 축("재실행" = unevaluated-fill-run 사슬, "부분 reset" = 본 chain)이 모두 닫혔는지 실측 후 판정한다. 닫혔으면 `- [ ]` → `- [x]` 로 바꾸고 bullet 안의 "**checkbox `[ ]` 유지**" 사유 문장을 T-1915~T-1918 chain 머지 근거(각 task ID + commit/PR 좌표)로 교체한다. 미충족 축이 남으면 `[ ]` 를 유지하되 사유 문장을 현행 실측으로 갱신한다(근거 없는 승격 금지).
- [ ] **stale 상호참조 정정** — `106 행` 의 "overwrite/reset 잔여는 bullet 107(DEFERRED, Q-0032 first-write-wins 유지)이 별도" 문장이 현행 `107 행` · `108 행` 배치와 맞는지 확인하고, 어긋나면 실제 bullet 번호(또는 bullet 제목 인용)로 정정한다. 확인 결과 맞으면 그대로 둔다.
- [ ] **PLAN 행 수 불변** — 편집 후 `wc -l docs/PLAN.md` 가 `196` 으로 유지된다(행 추가 · 삭제 없이 기존 두 행의 in-place 수정만).
- [ ] `docs/` 밖 파일 변경 0 — `git status --short` 에 `src/` · `test/` · `web/` 경로가 나타나지 않는다.
- [ ] 본 task 파일의 frontmatter `status` 를 `DONE` 으로 바꾸고 본문 끝에 완료 시각 · 실측 요약(인용한 행 번호 · `it` 개수 포함)을 1~3 줄로 추가한다.

## Out of Scope

- `src/` · `test/` · `web/` **코드 수정 일체** — 본 task 는 `commitMode: direct` doc-only 다. 허용 외 period 의 500 을 400 으로 바꾸는 등 결함 교정은 `Follow-ups` 에만 적는다.
- **다른 REQ 행 재판정** — REQ-036 · REQ-038 등 인접 행이나, reset chain 이 간접적으로 건드린 다른 REQ 의 상태 재실측. 두 행을 한 commit 에 넣으면 실측 부담이 겹쳐 검증이 흐려진다(선례 T-1914 Out of Scope 동형).
- **PLAN `106 행` 외 bullet 의 checkbox 변경** — `107 행` · `108 행` 은 상호참조 정합 확인 대상일 뿐 판정 대상이 아니다. `157 행` R-91 · `158 행` R-92 · `183 행` 오너 지시 bullet 은 손대지 않는다.
- **새 ADR 작성 · 기존 ADR 결정 변경** — 본 task 는 새 결정을 만들지 않는다(reset 의 광역 초기화 정책 · UI 노출 여부는 결정이 필요한 별도 범위).
- **Contribution cascade e2e** (T-1918 `Follow-ups (b)`) 및 Admin UI reset 노출 · dry-run · 삭제 감사 로그 — 별도 slice.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 등 과거 audit snapshot 의 `IN_PROGRESS` 문자열 **소급 치환** — 그것은 당시 실측의 기록이다([CLAUDE.md](../../CLAUDE.md) `§12` 소급 치환 금지).
- `docs/architecture/*` · `modules.md` 갱신 — 필요해 보이면 `Follow-ups` 에.

## Suggested Sub-agents

`implementer` (doc-only — architect · tester 불요, R-110 은 direct doc-only commit 면제)

## Follow-ups
