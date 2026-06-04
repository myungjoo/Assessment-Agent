---
id: T-0220
title: ADR-0024 박제 — User↔instance binding 데이터 모델 + own-instance 필터 계약 (audit 조회 non-Admin 실 필터)
phase: P4
status: IN_PROGRESS
commitMode: pr
prNumber: 192
coversReq: [REQ-016, REQ-044]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-04
plannerNote: P4 Q-0021 option(1) 첫 slice — non-Admin own-instance 실 필터의 User↔instance binding ADR-first(schema+필터 결정만, 구현 0). doc-only new-ADR(pr).
---

# T-0220 — ADR-0024 박제: User↔instance binding 데이터 모델 + own-instance 필터 계약

## Why

사용자가 `STATE.json` `humanQuestions[Q-0021]` 에서 **option (1) audit own-instance 실 필터를 승인**했다(진행 순서 (1) 먼저, 그 다음 (2) milestone-1). 현재 `GET /api/permission-denied-records` 는 Admin 에게는 전체 record 를 반환하지만, non-Admin authenticated 사용자에게는 **항상 빈 배열** 을 반환한다 — 이는 [ADR-0023](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md) §2(b)/§1 fallback 이 명시 채택한 **의도적 placeholder**(User↔instance binding schema 가 부재해 허용 instance 집합이 항상 공집합)다. 본 work 는 그 placeholder 를 **실 own-instance 필터** 로 대체한다 — Q-0020 의 'Admin 전체 + 자기 instance' audience 차등 중 non-Admin 절반을 완성한다.

이 work 는 (i) User↔instance binding 을 어떻게 모델링할지(prisma schema 결정 — §5 DB-schema 게이트, Q-0021 로 승인) + (ii) 사용자 identity → 허용 instance 집합 → record `instanceRef` WHERE 필터 변환 계약(auth-model 결정 — §5 security 게이트, Q-0021 로 승인) 을 요구한다. ADR-0023 §2(b) 가 이미 **server-side User lookup 방향**(JwtPayload 비확장, claim 비대화 회피)을 박제해 뒀으나, binding 의 구체 데이터 모델(join table vs allowed-instances 컬럼 vs group membership 파생)·매핑 규칙·migration 접근은 미결정이다. 사용자가 binding-schema 설계를 **ADR-first 로 위임**(architect 가 ADR 제안 → 사용자가 ADR PR 검토 — milestone-3 동형)했으므로, 본 task 는 **schema 변경/migration/repository/controller 코드 전에 ADR 로 binding 모델 + 필터 계약을 박제**한다(ADR-0021/0022/0023 ADR-first 패턴 mirror). 본 task 는 ADR doc + INDEX 1 row 만 — production code 0 / prisma schema 변경 0 / migration 0.

## Required Reading

- `docs/STATE.json` — `humanQuestions[Q-0021]` decision verbatim(option (1) 먼저 승인 + §5 DB-schema 게이트 충족 + 새 외부 dependency 0(내장 prisma) + R-112 4종 + negative cases + regression + ADR-first 위임). 추가로 `humanQuestions[Q-0020]` decision(RBAC scope = Admin + 자기 instance audience 차등의 single source). 본 ADR 이 그 두 decision 을 단일 motivation 으로 박제.
- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` — 본 ADR 의 직속 선행. 특히 Decision §2(자기 instance 판별 = server-side User lookup, JwtPayload 비확장, exact match, (b) binding source 가 현 schema 부재라 **선행 schema 확장 task** 로 deferred) + Decision §3(own-instance 필터 = service-layer actor-aware 분기, 신규 guard 0) + Decision §1 fallback(binding 부재 → 200 빈 배열) + 후속 task chain 표의 '(선행, 조건부) User↔instance binding schema' row. 본 ADR 이 그 deferred row 를 **구체 데이터 모델 + 매핑 규칙 + migration 접근** 으로 박제(ADR-0023 의 layer/방향 결정은 재결정 0 — binding 의 구체 schema 만 추가).
- `docs/decisions/ADR-0022-permission-denied-record-data-model.md` — Decision §1: `instanceRef` = GitHub configured host(예: `github.sec.samsung.net`) / Confluence 풀 REST base URL(예: `https://acme.atlassian.net/wiki/rest/api`) free-form 문자열 — binding 이 매핑할 대상 식별자의 정확한 shape. 본 ADR 은 그 정의를 재결정하지 않고 binding 의 매핑 대상으로 참조만.
- `docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md` — ADR-first TEMPLATE(Decision enumerated-section / Consequences positive·negative / Alternatives 채택·기각 표 / 후속 task chain 구조). 본 ADR 이 mirror.
- `prisma/schema.prisma` — `User` model(L170~177: `id`/`email @unique`/`hashedPassword`/`role`/timestamps — **instance 연계 컬럼/테이블 부재**) + `PersonGroupMembership` join model(L131~141: join entity + `@@unique` 패턴) + `PermissionDeniedRecord` model(L432~444: `instanceRef` 컬럼 + `@@index([instanceRef, createdAt])`). 본 ADR 이 User↔instance binding 을 어느 schema 구조(User 컬럼 vs 신규 join model)로 박제할지 결정 — 기존 join model(PersonGroupMembership)·`@@unique` 패턴이 reference.
- `src/permission-denied/permission-denied-record.service.ts` — `list(actor, query?)` 의 현 분기(L133~144): Admin bypass(`repository.findMany(query)`) vs non-Admin binding-부재 fallback(빈 배열). `AuditQueryActor`(`sub?`+`role?`, L37~40) + `isAdminBypass`(L47~53). 본 ADR 이 non-Admin 분기에 own-instance 필터를 어떻게 결선할지(사용자 `sub` → 허용 instance 집합 lookup → `instanceRef in (...)` 필터) 계약 박제 — 코드 변경 0.
- `src/permission-denied/permission-denied-record.repository.ts` — `findMany(filter?)` + `PermissionDeniedRecordFilter` shape(instanceRef / provider / httpStatus). 본 ADR 이 own-instance 의 `instanceRef in (...)`(set membership) 필터가 기존 단일 `instanceRef`(exact) 필터와 어떻게 공존/AND 되는지 결정.
- `src/auth/auth.service.ts`(JwtPayload `sub`+`role` 정의) + `src/auth/roles.guard.ts`(`ROLE_HIERARCHY`) — actor identity 의 실 claim 집합 + Admin escalation. 본 ADR 의 `sub` → User lookup → 허용 instance 집합 매핑이 현 claim 만으로 도출 가능함을 확인(JwtPayload 비확장 정합, ADR-0023 §2).
- `docs/architecture/INDEX.md` — ADR 목록 row 추가 대상(본 ADR-0024 row). 기존 ADR row 포맷 mirror.

## Acceptance Criteria

본 task 는 **doc-only new-ADR(production code 0 / prisma schema 변경 0 / migration 0 / `pnpm add` 0)** — R-112 test 4종 블록은 적용 대상이 아니다(코드 symbol 0). 후속 slice(schema migration / repository filter / controller wiring)가 R-112 4종 + negative cases + regression 을 cover(아래 후속 chain 명시). 본 task 의 acceptance 는 다음 ADR 내용 박제 + 정합 검증:

- [ ] `docs/decisions/ADR-0024-<slug>.md` 신설 — frontmatter(id: ADR-0024, status: ACCEPTED (2026-06-04), relatedTask: T-0220, supersedes: null) + 본문(Context / Decision §1~§N / Consequences positive·negative / Alternatives / References). ADR-0021/0022/0023 구조 mirror. **본문은 한국어(§12)**, 식별자/경로/enum 은 영어 유지.
- [ ] **Decision §1 — "instance" 식별자 정의(무엇에 binding 하는가)**: PermissionDeniedRecord 의 어느 필드가 instance 식별자인지(record 의 `instanceRef` — GitHub configured host / Confluence 풀 REST base URL, ADR-0022 §1) 를 binding 의 매핑 대상으로 명시. binding 단위가 record `instanceRef` 와 exact match(ADR-0023 §2 정합)임을 박제 — 새 식별자 개념 도입 0(ADR-0022 instanceRef 재사용).
- [ ] **Decision §2 — User↔instance binding 데이터 모델(어떻게 묶는가)**: 사용자가 읽을 수 있는 instance 집합을 어떻게 영속할지를 **2~3 현실적 option** 으로 제시 + trade-off 후 default 채택 + 사유. 최소 다음 후보를 다룰 것: (a) `User`↔instance join table(예: `UserInstanceAccess` { userId, instanceRef, `@@unique([userId, instanceRef])` } — `PersonGroupMembership` join 패턴 mirror), (b) `User` 에 allowed-instances array/JSON 컬럼(예: `allowedInstances String[]`), (c) 기존 group membership / ServiceIdentity 등에서 파생. 각 option 의 normalize / 다대다 표현력 / migration cost / query(`instanceRef in (...)`) 용이성 / seed(누가 binding 을 채우는가) trade-off 박제 후 1 개 default 채택.
- [ ] **Decision §3 — own-instance 필터 계약(identity → allowlist → WHERE)**: controller/service 가 authenticated non-Admin 사용자의 identity(`@CurrentUser("sub")`/`JwtPayload.sub`)를 → 허용 instance 집합(`instanceRef[]`, Decision §2 source 에서 server-side lookup) → record 의 `instanceRef in (allowlist)` WHERE 필터로 변환하는 경로를 박제. ADR-0023 §3(service-layer actor-aware 분기, 단일 강제 지점, 신규 guard 0) 결정을 그대로 따름을 명시 — 본 ADR 은 그 분기 안의 'binding lookup → set membership 필터' 구체화만. `findMany` 의 `instanceRef in (...)`(set) 필터가 기존 단일 `instanceRef`(exact) 필터와 어떻게 AND/교집합 되는지(사용자 제공 query.instanceRef ∩ allowlist) 결정. Admin bypass(`ROLE_HIERARCHY` escalation → 전체 조회) 재확인.
- [ ] **Decision §4 — 경계(boundaries)**: (i) 미인증 → 401(`JwtAuthGuard`), (ii) authenticated 이나 allowlist 공집합(binding 부재) → 200 빈 배열(403 아님, ADR-0023 §1 fallback 정합), (iii) 타 instance record → 빈-필터(보이지 않음, 403 아님 — ADR-0023 §4 정합), (iv) instance-identifier edge case(case / trailing slash 정규화 / 빈 instanceRef / 중복 binding row)의 처리 규칙을 박제. exact-match 정규화 규칙(ADR-0023 §2 가 "후속 slice 가 source 박제 시 확정" 으로 deferred 한 부분)을 본 ADR 이 명시 채택.
- [ ] **Decision §5 — migration 접근(ADR-0004 migrate-deploy 준수 명시)**: Decision §2 채택 모델의 prisma schema 변경 + migration 이 **후속 slice** 임을 명시(본 ADR 은 schema 변경 0). migration 이 ADR-0004 의 `prisma migrate deploy` 패턴을 따르고 CI 실 PostgreSQL(ADR-0004) 에서 적용됨을 박제. 기존 User row 가 binding 0 으로 시작(빈 allowlist → 빈 배열 fallback, breaking change 0)하는 backfill/seed 경계 명시.
- [ ] **Consequences** — positive(ADR-first reviewer 선행 점검 / dependency-free(내장 prisma) / REQ-016 non-Admin audience 완성 / 단일 강제 지점 유지) + negative·trade-off(예: binding seed 책임 미정 — 누가 User 에 instance 를 부여하는가 / 다대다 모델 복잡도 / exact-match 정규화 정확도 / 기존 User binding 0 시작의 운영 cost) 각 박제.
- [ ] **Alternatives considered** — 최소 3 대안(Decision §2 의 join table vs array 컬럼 vs group 파생 + 필요 시 JwtPayload claim 확장 vs server-side lookup)의 채택·기각 표 + 사유. ADR-0023 §2 server-side lookup 결정과 정합.
- [ ] **후속 task chain** 표 — 각 ≤ 300 LOC / 5 파일로 분할: (1) prisma schema 변경 + migration(Decision §2 채택 모델, ADR-0004 migrate-deploy), (2) binding repository + allowlist lookup(server-side), (3) service `list` non-Admin 분기에 own-instance 필터 결선(ADR-0023 §3 service-layer), (4) controller wiring(필요 시) + R-112 4종 + negative cases(타 instance 차단·non-Admin Admin-route 차단·빈 결과·미인증 401·경계 instance 식별자) + regression(placeholder 빈 배열 → 실 필터 회귀 방어). 본 task 에서 큐잉 0(planner 1-task 원칙 — 나열만).
- [ ] `docs/architecture/INDEX.md` 에 ADR-0024 row 1 줄 추가(기존 ADR row 포맷 mirror).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 확인(R-110 — doc-only 라 코드 변경 0 이지만 tester 가 기존 suite green 유지를 확인). spec 추가 0(코드 symbol 0).

## Out of Scope

- prisma schema 변경(`User`↔instance binding 컬럼/테이블 추가) + migration **구현** — 본 ADR 머지 후 후속 slice(Decision §2 채택 모델, ADR-0004 migrate-deploy). 본 task 는 schema 차원 결정만(schema.prisma 미접촉).
- `PermissionDeniedRecordService.list` non-Admin 분기의 own-instance 필터 **구현** + binding repository/allowlist lookup **구현** — 후속 slice. 본 ADR 은 계약(identity→allowlist→WHERE)만 박제(코드 변경 0).
- controller wiring / R-112 test 블록 — 후속 slice. 본 task 는 코드 symbol 0.
- `JwtPayload` claim 확장 — ADR-0023 §2 가 server-side lookup 채택(claim 비확장)을 이미 박제. 본 ADR 은 그 결정을 재확인만 하고 claim 을 확장하지 않는다(필요성이 새로 발견되면 Alternatives 에서 기각 사유로만 다룸).
- ADR-0023 의 audience/RBAC/응답 경계 재결정 — 본 ADR 은 그 위에 binding 데이터 모델 + 필터 구체화만 추가. ADR-0023 Decision §1/§3/§4 의 layer/방향 결정은 재결정 0.
- ADR-0022 의 record 데이터 모델 재결정 — `instanceRef` 정의 변경 0(매핑 대상으로 참조만).
- milestone-1 live LLM run(Q-0021 option (2)) — Q-0021 가 '(1) 먼저, 그 다음 (2)' 로 순서 박제. 본 chain(option 1) 완료 후 별도 task.
- binding seed/부여 UI/endpoint(누가 User 에 instance 를 부여하는가) — 본 ADR 은 seed 책임 경계를 명시만 하고 구현은 별도 task(필요 시 후속 chain 또는 Follow-up).

## Suggested Sub-agents

`architect → tester` (binding 데이터 모델 + 필터 계약 결정이 본질 — architect 가 ADR 작성. doc-only 라 implementer 불요, tester 는 R-110 충족을 위해 기존 suite green + lint/build 확인).

## Follow-ups

- (ADR-0024 머지 후) **User↔instance binding schema + migration slice** — Decision §2 채택 모델의 prisma schema 변경 + migration(ADR-0004 migrate-deploy, 기존 User binding 0 시작). pr-mode, dependency-free.
- (binding schema 머지 후) **own-instance 필터 결선 slice** — binding repository/allowlist lookup + `PermissionDeniedRecordService.list` non-Admin 분기에 `instanceRef in (allowlist)` 필터 결선(ADR-0023 §3 service-layer) + (필요 시) controller wiring + R-112 4종 + negative cases(타 instance 차단 / non-Admin Admin-route 차단 / 빈 결과 200 / 미인증 401 / 경계 instance 식별자) + **regression test**(현재 non-Admin 항상 빈 배열 placeholder → 실 필터로 전환됐는지 회귀 방어). pr-mode, dependency-free.
- (조건부) **binding 부여 경로 slice** — 누가 User 에 instance 를 부여하는가(seed / Admin endpoint)가 운영상 필요하면 별도 task. ADR-0024 가 seed 책임 경계를 명시한 후 결정.
- (carry-forward residual nit) `test/helpers/db-truncate.spec.ts` L7 docstring "5 테이블" stale(현재 7 테이블) — 본 slice 는 `test/helpers/` 미접촉이라 sweep 안 함. db-truncate 를 만지는 인접 PR 의 nit-in-PR closure 로 정정(CLAUDE.md §3).
