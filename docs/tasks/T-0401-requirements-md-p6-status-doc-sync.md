---
id: T-0401
title: requirements.md P6 frontend REQ 상태 컬럼 doc-sync (PLANNED → DONE/IN_PROGRESS)
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-038, REQ-042, REQ-044, REQ-045, REQ-046, REQ-049, REQ-002]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-14
independentStream: p6-frontend-doc-sync
dependsOn: []
touchesFiles: [docs/requirements.md]
plannerNote: "P6 — requirements.md 추적표가 P6 wiring(①~⑥, T-0378~T-0394) 완결에도 P6 REQ 상태 PLANNED 로 stale; doc-only direct 동기"
---

# T-0401 — requirements.md P6 frontend REQ 상태 컬럼 doc-sync

## Why

`docs/requirements.md` 는 README → REQ-NNN 의 **단일 source of truth** 추적표이며 각 REQ 의 `상태` 컬럼(PLANNED / IN_PROGRESS / DONE / BLOCKED / SUPERSEDED)을 1:1 로 박제한다. 그러나 이 표는 마지막으로 `06504fe`(P6 frontend 진입 한참 전)에 갱신됐고, P6 composition-wiring chain ①~⑥(T-0378~T-0394) + presentational 분해(T-0361~T-0375)가 **완결**됐음에도 P6 frontend REQ row 들이 여전히 `PLANNED` 로 남아있다(genuine stale). 본 task 는 [PLAN.md](../PLAN.md) P6 섹션(115~121행)의 shipped/deferred 경계를 그대로 반영해 P6 REQ 상태 컬럼만 정합화한다 — T-0395~T-0400 P6-closure doc-sync 가족과 동형(아키텍처 doc 대신 requirements 추적표 대상).

## Required Reading

- `C:\Users\myung\Assessment-Agent\docs\requirements.md` (특히 §운영 룰의 상태 enum 정의 9행 + 매핑 표 18~75행의 P6 관련 row)
- `C:\Users\myung\Assessment-Agent\docs\PLAN.md` (Phase P6 섹션 113~121행 — shipped(①~⑥) vs deferred(ReEval/Schedule/auto-polling/GroupMember mutation/import 상세) 경계 + T-0355 게이트)

## Acceptance Criteria

각 항목은 `docs/requirements.md` 의 해당 row 를 inspect 해 검증한다. **PLAN.md P6 섹션의 shipped/deferred 경계를 초과 확대 해석하지 말 것** — 아래 상태값은 PLAN.md 가 박제한 현실에 정확히 대응한다.

- [ ] REQ-038 (UI 조회/sort/filter/시계열, P6) 상태 `PLANNED` → `DONE` — DashboardView(③a~③b-3) + presentational(필터바·시계열·분포·페이지네이션) 조립 완료(PLAN P6 116행).
- [ ] REQ-042 (평가 진행 중 시각화 보호 R-78, P6) 상태 `PLANNED` → `DONE` — EvaluationGuardBanner DashboardView 배선(⑤, T-0393) 완료. 단 자동 polling 은 backend status 계약 미shipped 로 defer(PLAN P6 118행) — 상태 셀 옆 또는 비고에 "배선 완료(자동 polling defer)" 한 줄 부기 권장.
- [ ] REQ-044 (첫 로그인 SuperAdmin / 3 등급 / 승급, P3+P6) 상태 `PLANNED` → `DONE` — AuthGate(②, T-0379) + SuperAdminSetupForm 배선(⑥, T-0394) 조립 완료(PLAN P6 115행). P3 backend(RBAC chain)는 이미 완결.
- [ ] REQ-045 (Admin 권한 패널 — 재작성/Reset/Import/Export/인원편집/Group편집, P6) 상태 `PLANNED` → `IN_PROGRESS` — AdminView(④a~④h) 로 GroupMemberList 조회·DifficultyModelSelector·export/import·scope·RBAC gating 조립 완료이나 **재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel) 미마운트 + GroupMember add/remove mutation·import 결과 상세 deferred**(PLAN P6 117·120행) — 부분 완료라 DONE 아닌 IN_PROGRESS.
- [ ] REQ-046 (User read-only 조회/sort/filter, P6) 상태 `PLANNED` → `DONE` — DashboardView 조회 + AdminView RBAC gating(④h, Admin+ 만 변이 패널 노출, User+ 는 조회만)으로 read-only 경계 배선 완료.
- [ ] REQ-049 (Admin 이 LLM 모델 지정, P4+P6) 상태 `PLANNED` → `DONE` — P4 backend(GET/POST/PATCH/DELETE /api/llm/providers) 완결 + P6 DifficultyModelSelector onAssign PATCH 배선(④b·④c, T-0386/T-0387) 완료.
- [ ] REQ-002 (Web Interface 를 제공하는 Agent System, P6/P3) 상태 `PLANNED` → `IN_PROGRESS` — P6 frontend SPA 가 shipped(AppShell + 인증 게이트 + Dashboard/Admin view)이나 backend-게이트 잔여(ReEval/Schedule/auto-polling) + perf 검증(P7) 미완이라 부분 완료.
- [ ] backend-게이트 deferred 잔여는 requirements.md 에 **중복 박제하지 말 것** — PLAN P6 120행이 이미 단일 박제. 상태 셀의 IN_PROGRESS 표기로 충분하며 필요 시 modules.md/PLAN.md 링크 참조만.
- [ ] 위 7 row **외의** REQ 행(P5 / P7 / P4 backend 등) 상태값은 **변경하지 말 것** — 본 task 범위는 P6 frontend REQ 상태 동기에 국한.
- [ ] doc-only direct commit 이므로 tester 면제(§3.2) — 코드/test 변경 0, `pnpm` 명령 불요. 변경 후 표가 GitHub Markdown 으로 정상 렌더(컬럼 정렬·`|` 구분자 보존)되는지 육안 확인.

## Out of Scope

- README.md 본문 / PLAN.md / 아키텍처 doc(modules.md·components.md·directory.md·deployment.md·INDEX.md) 수정 — 전부 T-0395~T-0400 에서 이미 동기 완료.
- 상태 컬럼 외 다른 컬럼(요약·kind·구현 위치·검증 위치) 수정 — 본 task 는 P6 frontend REQ 의 `상태` 셀 동기에 국한(구현 위치 컬럼에 이미 P6 가 박제돼 있어 추가 불요; 부정확하면 별도 follow-up).
- P5(평가 파이프라인) / P7(스케줄러·perf) / P4 backend REQ 상태 변경 — shipped 여부 별도 판단 필요, 본 task 범위 밖.
- backend 계약 미shipped 항목(ReEvaluationTriggerPanel·SchedulePanel·auto-polling·GroupMember mutation·import 상세)을 DONE 으로 표기 — 의도적 defer 이므로 IN_PROGRESS 까지만.
- 새 REQ row 추가 / REQ 재번호 / 표 schema 변경.

## Suggested Sub-agents

`implementer` (doc-only 단일파일 edit — architect/tester 불요; direct doc-only 라 §3.2 tester 면제). executor 가 direct commit 분기로 main 직접 push.

## Follow-ups

(없음 — 생성 시점)

## 결과 (DONE 2026-06-14)

direct doc-only, main `eae6900` (loop@vb707106 t2). requirements.md 추적표 P6 frontend REQ 7행 상태 동기(+7/-7): REQ-038/044/046/049 → DONE, REQ-042 → DONE(배너 배선 완료, 자동 polling defer 부기), REQ-045/002 → IN_PROGRESS(부분 완료). executor 가 코드/PR/ADR 증거(AppShell/AdminView/DashboardView wiring + ADR-0040/0041 ACCEPTED + PR #309~#325)로 실 shipped 상태를 독립 검증 — task 제안 매핑과 현실 100% 일치(불일치 0). P5/P7/P4-backend REQ 행 불변, 표 컬럼 포맷 보존. tester 면제(§3.2). 메인 checkout staged 검증. **이 task 로 P6-closure doc-sync 가족(T-0395~T-0401) 완결 + dependency-free 작업 소진 → /loop wind-down.**
