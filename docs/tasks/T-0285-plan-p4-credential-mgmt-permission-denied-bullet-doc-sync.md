---
id: T-0285
title: PLAN P4 자격증명 관리 + 권한 부족 감지·통지 bullet (L88) doc-sync
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-020, REQ-033]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-06-08
completedAt: 2026-06-08T17:35:00+09:00
plannerNote: P4 doc-sync 마지막 slice — L88 자격증명관리+권한부족 감지·통지 bullet [ ]→[x] flip; main reality(PermissionDeniedRecord chain + UserInstanceAccess + ADR-0022~0024/0027) grep 검증 완료, doc-only inline-amend ×0.64
---

# T-0285 — PLAN P4 자격증명 관리 + 권한 부족 감지·통지 bullet (L88) doc-sync

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 의 L88 bullet (`자격증명 관리 + 권한 부족 감지·통지 (사용자 + 관리자 모두 인식 가능, R-20·33)`) 은 아직 `[ ]` stale 이며 완료 마커가 없다. 그러나 main 코드 대조 결과 해당 기능이 이미 end-to-end 박제됐다 — 권한 부족 감지·통지는 `src/permission-denied/` 의 PermissionDeniedRecord chain (controller / service / repository / module + GitHub·Confluence persisting emitter) 으로, GitHub/Confluence adapter 의 4xx → `PermissionDeniedEvent` emit → 영속 → `GET /api/permission-denied-records` 조회로 완결된다. R-33 의 "사용자 + 관리자 모두 인식 가능" 은 controller 의 `@Roles("User")` + service-layer audience 차등 (Admin 전체 조회 / non-Admin binding-scoped) 으로 충족(ADR-0023). 자격증명 관리는 `src/user-instance-access/` 의 UserInstanceAccess binding (ADR-0024) + instance-keyed `_TOKEN_ENC` (ADR-0014 JIT decrypt) 으로 박제. 즉 PLAN bullet 의 `[ ]` 박스와 완료 마커 부재가 reality 와 drift 한 순수 문서 결손이다. T-0279~T-0283 (Group B/C) 동형의 stale-checkbox doc-sync 로 정합한다.

## Required Reading

- `docs/PLAN.md` (L88 — Phase P4 의 자격증명 관리 + 권한 부족 감지·통지 bullet 한 줄. L82/L89/L90 등 다른 P4 bullet 은 본 task 범위 아님)

## Acceptance Criteria

- [ ] `docs/PLAN.md` L88 의 bullet 체크박스를 `- [ ]` → `- [x]` 로 flip.
- [ ] 같은 bullet 본문 끝에 main reality 인용 한 줄 추가: 권한 부족 감지·통지는 `src/permission-denied/` 의 PermissionDeniedRecord chain (controller / service / repository / module + GitHub·Confluence persisting emitter, ADR-0022 data-model + ADR-0023 audit query RBAC) 으로 adapter 4xx → `PermissionDeniedEvent` emit → 영속 → `GET /api/permission-denied-records` 조회 박제. R-33 "사용자 + 관리자 모두 인식 가능" 은 `@Roles("User")` + service-layer audience 차등 (Admin 전체 / non-Admin binding-scoped) 으로 충족. 자격증명 관리는 `src/user-instance-access/` UserInstanceAccess binding (ADR-0024 data-model + ADR-0027 grant RBAC) + instance-keyed `_TOKEN_ENC` JIT decrypt (ADR-0014) 박제. `**(완료)**` 마커 부착(L89/L83/L84 동형 포맷).
- [ ] 변경 파일은 `docs/PLAN.md` 단 1개. diff ≤ ~5 LOC.
- [ ] 인용한 사실(PermissionDeniedRecord chain 존재, emitter, controller `@Roles("User")`, UserInstanceAccess binding, ADR-0022~0024/0027)이 실제 main 코드와 일치(이미 본 task Why 에서 grep 검증됨 — 허위 인용 0).

## Out of Scope

- L82 (`GitHub Issue 평가 + self-follow-up 제외`) — grep 0 의 진짜 미구현 backlog (self-follow-up 제외 로직·issue 평가 모두 부재), doc-sync 부적합. 후속 planner survey 가 product-decision 으로 escalate 가능.
- L89/L90 등 이미 처리된 P4 bullet 재변경 금지 (T-0282/T-0283 에서 flip 완료).
- `src/`, `prisma/`, `docs/architecture/`, ADR 등 코드/설계 문서 변경 일절 금지 (순수 PLAN 체크박스 정합).
- 새 RBAC/emitter/binding 로직 변경 — 이미 main 에 박제됨, 본 task 는 문서만.

## Suggested Sub-agents

없음 — driver 직접 Edit (direct doc-only, commitMode=direct 라 reviewer/PR/tester 호출 0, R-110/R-112 면제, 분기 없음).

## Follow-ups

(생성 시점 비어있음)
