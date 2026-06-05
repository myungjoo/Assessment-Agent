---
id: T-0239
title: api.md 에 instance-access grant/revoke endpoint 2 row doc-sync
phase: P4
status: DONE
commitMode: direct
completedAt: 2026-06-05T09:50:07+09:00
coversReq: [REQ-016, REQ-044]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-06-05
plannerNote: "P4 ADR-0027 grant chain slice 3 — api.md(기존 docs/architecture/*)에 POST/DELETE /api/users/{id}/instance-access row 추가; doc-only inline-amend direct (T-0143/T-0152/T-0166 precedent)"
---

# T-0239 — api.md 에 instance-access grant/revoke endpoint 2 row doc-sync

## Why

ADR-0027(UserInstanceAccess grant/revoke Admin-only RBAC 계약)의 grant chain 후속 4 slice 중 slice 1(T-0237 DTO+service)·slice 2(T-0238 controller)가 머지돼 `POST`/`DELETE /api/users/:id/instance-access` endpoint 가 실제로 main 에 박제됐다. 그러나 [docs/architecture/api.md](../architecture/api.md) 의 endpoint 인벤토리 표에는 이 두 WRITE endpoint 가 아직 없어(현재 instance-access 관련 row 0, READ 측 `/api/permission-denied-records` 만 own-instance 필터 서술 존재) 문서가 reality 와 drift 상태다. 본 task 는 그 표에 grant/revoke 2 row 를 추가해 ADR-0027 §1/§4 계약(method/path/RBAC/status/idempotency)을 문서에 정합시킨다. README REQ-016(권한 부족 user/admin audience 분리)·REQ-044(instance 별 권한 분리 + 권한 거부 가시화)의 binding WRITE 관리 경로를 문서로 cover.

## Required Reading

- `docs/architecture/api.md` — endpoint 인벤토리 표(특히 L121~124 UC-08 권한 부족 통지 section + `/api/permission-denied-records` row 의 RBAC/status 서술 format). 표 컬럼 = `| method | path | UC ref | description(RBAC·status·task ref) | auth tier |`.
- `docs/decisions/ADR-0027-instance-access-grant-rbac-contract.md` — Decision §1(endpoint surface: grant `POST` / revoke `DELETE` + body) + §3(self-grant 금지 403) + §4(status 계약: grant 201 / revoke 204 / 401 / 403 non-Admin·self / 400 invalid / 404 unknown user / **grant 중복 409** / **revoke 부재 idempotent 204**) — 본 doc-sync 가 mirror 할 단일 source.
- `src/user-instance-access/user-instance-access.controller.ts` — 머지된 controller 의 실제 endpoint shape(`@Controller("api/users/:id/instance-access")` + `@Post()` 201 / `@Delete() @HttpCode(204)` + `@Roles("Admin")`) — 문서가 reality 와 일치하는지 대조 source.

## Acceptance Criteria

- [ ] `docs/architecture/api.md` 의 endpoint 인벤토리 표에 grant endpoint row 1 개 추가: `POST` / `/api/users/{id}/instance-access` / UC ref(UC-08 또는 관련 REQ-016·REQ-044 명시) / description(Admin-only `@Roles("Admin")` + `JwtAuthGuard`+`RolesGuard`, 201 Created, self-grant 403, 중복 binding 409, unknown user 404, invalid instanceRef 400, 미인증 401, T-0237/T-0238 박제 + ADR-0027 §1/§4 링크) / auth tier `Admin+`.
- [ ] revoke endpoint row 1 개 추가: `DELETE` / `/api/users/{id}/instance-access` / UC ref / description(Admin-only, 204 No Content, **부재 binding idempotent 204**, self-revoke 403, unknown user 404, 미인증 401, `instanceRef` 를 body 로 수신, T-0238 박제 + ADR-0027 §1/§4 링크) / auth tier `Admin+`.
- [ ] 추가한 두 row 의 method/path/RBAC/status 가 ADR-0027 Decision §1/§4 + 머지된 controller(`src/user-instance-access/user-instance-access.controller.ts`)와 정확히 일치(특히 grant 409 vs revoke idempotent 204 비대칭, self-grant 403, `DELETE`+body 의 instanceRef 전달).
- [ ] 표 하단 **합계** 줄(endpoint 개수 / resource prefix 개수)이 있으면 신규 prefix `/api/users/{id}/instance-access` 반영해 정합(기존 합계 줄 갱신 — 예: endpoint +2, prefix 신설 시 +1). 합계 갱신이 불요하면 본 항목 생략 사유를 commit body 에 명시.
- [ ] 문서 본문 한국어(§12), endpoint path·method·status token·RBAC 식별자는 영어 유지.
- [ ] 분기 없음(순수 doc 편집, 코드·spec 0) — R-112 happy/error/branch/negative/coverage test 항목은 적용 대상 아님(production code symbol 0). commitMode direct doc-only.

## Out of Scope

- slice 4(e2e/smoke spec — grant→READ 필터 round-trip + 미인증/403/409 negative e2e)는 **별도 task**(commitMode pr). 본 task 에서 test 코드 작성 금지.
- ADR-0027 / controller / service / DTO / repository 코드 수정 금지(전부 머지 완료 — 본 task 는 api.md 문서만).
- 다른 endpoint row 의 정정·재배치·표 구조 변경 금지(grant/revoke 2 row 추가 + 합계 줄 정합만).
- modules.md / data-model.md 등 다른 architecture doc 동시 수정 금지(보이면 Follow-ups 에).

## Suggested Sub-agents

`implementer` (단일 doc 편집 — architect 불요, doc-only 라 tester 불요. commitMode direct 이므로 driver 가 main 직접 commit).

## Follow-ups

- ADR-0027 grant chain **slice 4**(마지막): grant→READ 필터 round-trip e2e(Admin grant → non-Admin 이 그 instance audit 조회 시 보임 / revoke → 안 보임) + 미인증 401 / non-Admin 403 / self-grant 403 / 중복 grant 409 / 부재 revoke 204 negative e2e·smoke spec. commitMode pr, R-112 + regression. 본 slice 4 완료 시 ADR-0027 grant chain 전체(slice 1~4) 종결 → ADR-0024 "safe but useless" 해소가 end-to-end 검증으로 closeout.
