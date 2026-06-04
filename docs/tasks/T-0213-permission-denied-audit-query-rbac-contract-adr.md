---
id: T-0213
title: ADR-0023 박제 — PermissionDeniedRecord audit 조회 RBAC/audience 모델 + instance-scoping 필터 계약
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-04
plannerNote: P4 ADR-0022 후속 chain '조회 endpoint' row — Q-0020 (1) 승인(RBAC=Admin+자기 instance). ADR-first 첫 slice(controller 전 audience 계약 박제), doc-only new-ADR(pr).
---

# T-0213 — ADR-0023 박제: PermissionDeniedRecord audit 조회 RBAC/audience 모델 + instance-scoping 필터 계약

## Why

사용자가 `STATE.json` `humanQuestions[Q-0020]` 에서 **option (1) audit 조회 HTTP endpoint 를 승인**했다 — `GET /api/permission-denied-records`(또는 동등) audit 조회 REST endpoint 추가. RBAC scope = **Admin + 자기 instance**: Admin role 은 전체 record 조회, 일반 운영자(non-Admin authenticated)는 자기 instance(GitHub host / Confluence space 등 record 의 `instanceRef` source 식별자) 범위의 record 만 조회 — REQ-016 의 user/admin audience 분리를 audit 조회 경로에 매핑한다.

이 audience 모델은 **기존 코드에 없는 cross-cutting 계약**이다: (1) `RolesGuard`/`@Roles`(src/auth)는 role tier escalation 만 제공할 뿐 "자기 instance" scoping 개념이 없고, (2) `JwtPayload`(`sub` + `role`)에는 사용자를 어느 instance 에 묶는 binding 이 없으며, (3) `PermissionDeniedRecord.instanceRef` 는 GitHub host / Confluence baseUrl 의 free-form 문자열이라 "사용자 identity → 허용 instance 집합" 매핑 규칙이 미정의다. 따라서 Q-0020 recommendation 대로 **controller 코드보다 먼저 ADR 로 audience/필터 계약을 박제**한다(ADR-0021/ADR-0022 의 ADR-first 패턴 mirror) — reviewer 가 구현 전 계약을 점검하고 후속 controller slice 가 단일 source 를 mirror 하도록. 본 task 는 ADR doc + INDEX 1 row 만 — production code 0.

## Required Reading

- `docs/STATE.json` — `humanQuestions[Q-0020]` decision verbatim(option (1) + RBAC scope = Admin + 자기 instance + dependency 0 / credential 0 + §5 security 게이트 충족). 본 ADR 이 그 decision 을 단일 motivation 으로 박제.
- `docs/decisions/ADR-0022-permission-denied-record-data-model.md` — record 데이터 모델. 특히 Decision §1(`instanceRef` = GitHub configured host / Confluence 풀 REST base URL / `provider` discriminator / `principal` 은 현 단계 항상 null) + Decision §4(query path: instance×기간 / provider×status×기간 + `@@index`) + REQ 외력의 REQ-016(user/admin audience 분리 view) / REQ-044. 본 ADR 은 그 entity 위의 **조회 audience 계약**을 추가 박제(데이터 모델 재결정 0).
- `docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md` — milestone-3 ADR-first TEMPLATE. Decision enumerated-section / Consequences(positive·negative) / Alternatives(채택/기각 표) / 후속 task chain 구조를 본 ADR 이 mirror.
- `src/auth/roles.decorator.ts` + `src/auth/roles.guard.ts` — `@Roles`/`RolesGuard`/`ROLE_HIERARCHY`(SuperAdmin ⊇ Admin ⊇ User) 의 실 escalation 매핑 + 403/401 throw 위상. 본 ADR 의 "Admin bypass(전체 조회) vs non-Admin own-instance 필터" 가 이 guard stack 위에 어떻게 얹히는지 박제(신규 guard 신설 여부 포함).
- `src/auth/current-user.decorator.ts` + `src/auth/auth.service.ts`(JwtPayload 정의) — `@CurrentUser()` 추출 + `JwtPayload`(`sub` + `role`) 의 실 claim 집합. 본 ADR 의 "사용자 identity → 허용 instance 집합" 매핑이 현 JwtPayload 로 도출 가능한지 / claim 확장(별도 ADR)이 필요한지 경계 박제.
- `src/llm/llm-provider-config.controller.ts` — controller RBAC stack mirror 대상(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + service raw forward + 4xx 자동 mapping). 후속 controller slice 가 따를 패턴 — 본 ADR 이 그 위에 own-instance 필터를 어디(controller vs service vs repository where)에 얹을지 결정.
- `src/permission-denied/permission-denied-record.service.ts` + `src/permission-denied/permission-denied-record.repository.ts` — 기존 `list(query?)`/`findMany(filter?)`(instanceRef/provider/httpStatus 필터 + createdAt desc). 본 ADR 이 own-instance scoping 을 이 기존 필터 위에 어떻게 얹는지(추가 인자 vs service 강제 주입) 결정.
- `docs/architecture/INDEX.md` — ADR 목록 row 추가 대상(본 ADR-0023 row). 기존 ADR row 포맷 mirror.

## Acceptance Criteria

본 task 는 **doc-only new-ADR(production code 0 / `pnpm add` 0)** — R-112 test 4종 블록은 적용 대상이 아니다(코드 symbol 0). 후속 controller slice 가 R-112 4종 + negative cases(타 instance 접근 차단 / non-Admin Admin-scope / 빈 결과 / 미인증 / 경계 instance 식별자)를 cover(아래 후속 chain 명시). 본 task 의 acceptance 는 다음 ADR 내용 박제 + 정합 검증:

- [ ] `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` 신설 — frontmatter(id: ADR-0023, status: ACCEPTED (2026-06-04), relatedTask: T-0213, supersedes: null) + 본문(Context / Decision §1~§N / Consequences positive·negative / Alternatives / References). ADR-0021/0022 구조 mirror.
- [ ] **Decision §1 — audience 모델(누가 무엇을 읽는가)**: Admin/SuperAdmin → 전체 record 조회(bypass), non-Admin authenticated(User) → 자기 instance 범위 record 만. 미인증 → 401. authenticated 이나 instance binding 부재 → 정의된 fallback(빈 결과 vs 403 — 둘 중 하나를 명시 채택하고 사유 박제). REQ-016 user/admin audience 분리 매핑 명시.
- [ ] **Decision §2 — "자기 instance" 판별 규칙**: 사용자 identity(`JwtPayload`)를 record `instanceRef`(GitHub host / Confluence baseUrl)에 매핑하는 규칙을 박제. 현 `JwtPayload`(`sub`+`role`)에 instance binding 이 없음을 명시하고, (a) 매핑 데이터 source(예: User entity 의 instance 연계 컬럼 / ServiceIdentity / 별도 claim) 결정 + (b) 그 source 가 현 schema 에 존재하지 않으면 JwtPayload/User claim 확장이 **별도 선행 ADR/migration 인지** 또는 본 slice 범위에서 도출 가능한지 경계를 명확히(불명확하면 후속 chain 에 선행 task 로 박제). free-form `instanceRef` 문자열 매칭의 정확/부정확 경계(exact match vs prefix) 결정.
- [ ] **Decision §3 — Admin bypass 경로**: Admin/SuperAdmin 이 instance 필터를 우회해 전체 조회하는 분기를 박제(`ROLE_HIERARCHY` escalation 재사용). non-Admin 의 own-instance 필터가 어느 layer(controller가 service 에 instance 인자 강제 주입 vs service 가 actor role 로 분기 vs 신규 guard)에 얹히는지 결정 — 기존 `RolesGuard`(role tier 만) 위에 instance scoping 을 추가하는 방식(신규 guard/interceptor 신설 여부 포함, 새 외부 dependency 0).
- [ ] **Decision §4 — 401/403 응답 경계**: 미인증(`JwtAuthGuard` 차단) → 401, authenticated 이나 권한/instance 부적합 시 403 vs 빈 결과(200 빈 배열)의 경계를 박제. "타 instance record 접근" 이 403 인지 빈-필터(보이지 않음) 인지 명시 채택 + 사유(audit 정보 노출 최소화 trade-off).
- [ ] **Decision §5 — endpoint shape**: `GET /api/permission-denied-records`(경로 확정) + query param(instanceRef/provider/httpStatus 필터 — 기존 `PermissionDeniedRecordFilter` 위) + 응답 shape(record view — token/secret 컬럼 부재라 redaction 불요, ADR-0022 §1) + RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles` 적용 방식). dependency 0(기존 NestJS controller + auth stack 재사용) 명시.
- [ ] **Consequences** — positive(ADR-first reviewer 선행 점검 / dependency-free / REQ-016 audience 완성) + negative·trade-off(예: instance binding 미존재 시 선행 확장 cost / own-instance 필터 정확도 / 빈-결과 vs 403 선택의 정보노출 trade-off) 각 박제.
- [ ] **Alternatives considered** — 최소 3 대안(예: Admin-only 단순화 / own-instance 를 guard vs service-layer 에서 처리 / 403 vs 빈-결과)의 채택·기각 표 + 사유.
- [ ] **후속 task chain** 표 — controller slice(R-112 4종 + negative: 타 instance 접근 차단·non-Admin Admin-scope·빈 결과·미인증·경계 instance 식별자) + (필요 시) instance-binding 선행 task 를 나열(본 task 에서 큐잉 0 — planner 1-task 원칙).
- [ ] `docs/architecture/INDEX.md` 에 ADR-0023 row 1 줄 추가(기존 ADR row 포맷 mirror).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 확인(R-110 — doc-only 라 코드 변경 0 이지만 tester 가 기존 suite green 유지를 확인). spec 추가 0(코드 symbol 0).

## Out of Scope

- audit 조회 controller / endpoint **구현** 코드 — 본 ADR 머지 후 후속 slice(R-112 4종 + negative cases). 본 task 는 계약 결정만.
- `PermissionDeniedRecordService.list` / `repository.findMany` 의 own-instance 필터 **구현** — 후속 slice. 본 ADR 은 어느 layer 에 얹을지 결정만(코드 변경 0).
- 신규 guard / interceptor **구현** — 본 ADR 이 신설 여부를 결정만 하고, 실 class 는 후속 slice.
- `JwtPayload` / `User` entity 의 instance-binding claim/컬럼 **추가**(schema migration) — 본 ADR 이 필요성/선행 여부만 경계 박제. 실제 추가가 필요하면 별도 ADR/migration task(§5 DB schema 게이트 재확인 — 본 task 는 그 결정을 명시만).
- retention pruning / TTL job — ADR-0022 §3 영구 보존(TTL 미도입), 본 ADR 범위 밖.
- ADR-0022 의 데이터 모델 재결정 — 본 ADR 은 그 entity 위의 조회 audience 계약만 추가. instanceRef/provider/principal 정의 변경 0.
- principal 식별 보강(이벤트 shape 확장 + ServiceIdentity FK) — ADR-0022 Alternatives §(c), 별도 ADR.

## Suggested Sub-agents

`architect → tester` (audience/RBAC/instance-scoping 계약 결정이 본질 — architect 가 ADR 작성. doc-only라 implementer 불요, tester 는 R-110 충족을 위해 기존 suite green + lint/build 확인).

## Follow-ups

- (ADR-0023 머지 후) **audit 조회 controller slice** — `GET /api/permission-denied-records` controller 신설 + `@UseGuards(JwtAuthGuard, RolesGuard)` + Admin bypass / non-Admin own-instance 필터 결선(ADR-0023 Decision §3 layer 결정 따름) + R-112 4종 + negative cases 충분 cover(타 instance record 접근 차단 / non-Admin Admin-scope 차단 / 빈 결과 / 미인증 401 / 경계 instance 식별자). pr-mode, dependency-free.
- (조건부, ADR-0023 Decision §2 가 instance-binding 확장 필요로 결론 시) **JwtPayload/User instance-binding 선행 task** — claim/컬럼 추가(schema migration 동반 시 §5 게이트 재확인).
- (carry-forward residual nit) `test/helpers/db-truncate.spec.ts` L7 docstring "5 테이블" stale(현재 7 테이블) — 본 slice 는 `test/helpers/` 미접촉이라 sweep 안 함. db-truncate 를 만지는 인접 PR 의 nit-in-PR closure 로 정정(CLAUDE.md §3).
