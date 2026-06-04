---
id: T-0236
title: ADR-0027 — UserInstanceAccess grant/revoke Admin-only RBAC 계약 박제
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-05
plannerNote: P4 milestone — Q-0023 grant-path 승인. binding-grant RBAC 계약을 ADR-first 로 박제(ADR-0023→controller 패턴 mirror). ADR-only, dependency-free pr.
---

# T-0236 — ADR-0027: UserInstanceAccess grant/revoke Admin-only RBAC 계약 박제

## Why

ADR-0024 가 own-instance audit 필터(T-0220→T-0225, merged)를 박제했지만, binding 을
runtime 에 grant 할 경로가 없어 non-Admin 은 **항상 빈 결과**만 받는다(ADR-0024 가
"safe but useless" 로 자체 기록). 사용자가 Q-0023 으로 **binding-grant path** 를
승인했다 — runtime dynamic grant/revoke 를 `@Roles(Admin)` Admin-only endpoint 로
제공하고 self-grant 는 금지(ADR-0023→controller 패턴과 동형으로 ADR-first). 본 task 는
그 chain 의 **첫 slice** — architect 가 grant/revoke RBAC 계약을 ADR-0027 로 선행 박제해
후속 DTO/service/controller slice 의 설계 risk 를 de-risk 한다. README REQ-016(권한
통지 audience)·REQ-044(권한 거부 가시화)의 binding 관리 기반.

## Required Reading

- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` — audit READ 필터 RBAC 계약(경계 박제 대상)
- `docs/decisions/ADR-0024-user-instance-binding-data-model.md` — binding 데이터 모델 + "safe but useless" 기록(§3 allowlist / §4 정규화)
- `src/user-instance-access/user-instance-access.repository.ts` — `UserInstanceAccessRepository.create()` + `normalizeInstanceRef()` 재사용 대상(둘 다 존재 확인됨)
- `src/user-instance-access/user-instance-access.module.ts` — module providers/exports 현황(controller·DTO 아직 없음)
- `docs/architecture/modules.md` (PermissionDeniedRecordModule row, L37 부근) — RBAC=@Roles 차등 + binding 필터 서술(doc-sync 경계)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0027-instance-access-grant-rbac-contract.md` 신규 생성. 다음 섹션 전부 포함:
  - [ ] **Endpoint surface**: grant `POST /api/users/{id}/instance-access` + revoke(`DELETE`, path shape 는 architect 판단) — 둘 다 `@Roles(Admin)` 제한, self-grant 금지(요청자 == 대상 user 거부).
  - [ ] **Request DTO + validation**: `instanceRef` shape(github host / confluence space identifier) 결정 + class-validator 규칙. **`UserInstanceAccessRepository.create()` + `normalizeInstanceRef()` 재사용**을 명시(중복 정규화/insert 로직 신설 금지).
  - [ ] **Status-code 계약**: 201 grant / 200|204 revoke(택1 박제) / 400 invalid instanceRef / 403 non-Admin(또는 self-grant) / 404 unknown user / 409 duplicate-binding — **idempotent-vs-409 결정**(P2002 → 409 매핑 또는 idempotent 200/204) 명시 + 근거.
  - [ ] **경계 절**: ADR-0023(audit READ 필터)·ADR-0024("safe but useless" binding 모델)와의 책임 경계 — 본 ADR 은 binding WRITE(grant/revoke) 만, READ 필터는 ADR-0023 소관임을 명시.
  - [ ] **Out of scope 절**: live token 통합 / retention·TTL / non-Admin self-service grant 제외 명시.
  - [ ] status: 본 ADR 머지 시점에 ACCEPTED(architect 가 PROPOSED 작성 → 같은 slice 안에서 ACCEPTED flip, ADR-first 자율 승인 패턴 — §5 미발화 dependency-free 결정).
- [ ] modules.md 의 binding 관련 서술이 grant-path ADR 추가로 stale 해지면 1줄 doc-sync(불요 시 생략 명시).
- [ ] `pnpm lint && pnpm build` 통과(ADR/doc 변경이라 코드 0 LOC 예상).
- [ ] **src 코드가 1 LOC 라도 추가되면** R-112 적용: 추가/수정 public symbol happy-path + error path + 분기별 + negative cases 충분 cover unit test, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 현 floor branches/statements 90). **본 slice 는 ADR-only 의도라 코드 0 LOC 가 기대값** — 코드가 들어가면 scope 재검토 후 split.

## Out of Scope

- DTO 클래스 / service grant·revoke 메서드 / controller `@Roles(Admin)` 의 **실제 구현** — 후속 slice(Follow-ups).
- api.md doc-sync, e2e/smoke spec — 후속 slice.
- live GitHub/Confluence token 통합, binding retention·TTL, non-Admin self-service grant — 영구 out of scope(본 chain).
- DB schema 변경 — UserInstanceAccess entity 는 ADR-0024 에서 이미 박제(neue migration 불요).

## Suggested Sub-agents

`architect → tester`(ADR-only — tester 는 `pnpm lint && pnpm build` 검증; src 코드 0 이면 신규 spec 불요).

## Follow-ups

(생성 시 비어있음 — 본 chain 잔여: ① DTO/service grant+revoke 메서드(409 idempotency 분기 + repo.create() 재사용) → ② controller `@Roles(Admin)` + self-grant 거부 → ③ api.md doc-sync → ④ e2e/smoke. architect 가 ADR 확정 후 구체 slice 경계를 여기 append.)
