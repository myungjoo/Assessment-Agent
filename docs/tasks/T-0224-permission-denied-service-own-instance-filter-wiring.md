---
id: T-0224
title: PermissionDeniedRecordService own-instance 필터 결선 (non-Admin placeholder → 실 allowlist 필터, ADR-0024 §3 split B)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 180
estimatedFiles: 4
created: 2026-06-04
completedAt: 2026-06-04T14:55:00+09:00
prNumber: 196
mergedAs: 91cc490
reviewRounds: 2
plannerNote: P4 ADR-0024 chain row(3) split B — service non-Admin placeholder 를 allowlist lookup + instanceRefIn(split A) 실 필터로 결선. row(1)T-0221/row(2)T-0222/splitA T-0223 머지 완료.
result: DONE — non-Admin own-instance audit 필터 완성. UserInstanceAccessRepository 주입 + findInstanceRefsByUserId allowlist→instanceRefIn 항상 주입 + query.instanceRef∩allowlist(정규화 parity). Admin bypass 무변경. reviewer 보안 boundary hard-scrutiny APPROVE r1(1 MINOR)+r2(0). MINOR=빈 role test 누락 → nit-closure round2 복원. round2 git add -A 가 harness lock 우발 commit → round3 untrack+gitignore. CI green b7a8bea, 4-gate PASS, squash merge 91cc490. tasksCompleted 221→222. Q-0021 option 1(own-instance 필터) 완결.
---

# T-0224 — PermissionDeniedRecordService own-instance 필터 결선 (ADR-0024 §3 split B)

## Why

ADR-0024 후속 chain 의 row (3) service 결선이자 split B 다. row (1) prisma schema+migration(T-0221), row (2) UserInstanceAccessRepository(T-0222), split A `PermissionDeniedRecordFilter.instanceRefIn` set-membership 필터(T-0223)가 모두 머지됐다. 이제 `PermissionDeniedRecordService.list` 의 non-Admin 분기 — 현재 ADR-0023 §2(b) deferred placeholder 로 **항상 빈 배열** 을 반환 — 를 ADR-0024 §3 의 실 own-instance 필터로 대체한다: `actor.sub` 로 allowlist lookup → `instanceRefIn` 으로 강제 주입 → `query.instanceRef ∩ allowlist` 교집합. 이로써 Q-0020/Q-0021 이 승인한 "Admin 전체 + non-Admin 자기 instance" audience 차등의 non-Admin 절반(REQ-016 user audience / REQ-044 instance 별 권한 분리)이 실 조회로 완성된다.

## Required Reading

- `docs/decisions/ADR-0024-user-instance-binding-data-model.md` — 특히 Decision §3 (identity → allowlist → WHERE, query.instanceRef ∩ allowlist 교집합), §4 (정규화 규칙 + 경계 표), 후속 task chain row (3)/(4)
- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` — §1 (binding 0 → 빈 배열 fallback), §3 (service-layer 단일 강제 지점 / Admin bypass), §4 (응답 경계 401/200-빈배열/빈-필터)
- `src/permission-denied/permission-denied-record.service.ts` — 결선 대상 `list(actor, query?)` 의 non-Admin placeholder (L133~144) + `isAdminBypass` (L47~53) + `AuditQueryActor` (L37~40)
- `src/permission-denied/permission-denied-record.repository.ts` — split A `PermissionDeniedRecordFilter.instanceRefIn` (L47~57) + `findMany` exact∩set AND 합성 (L85~114) — service 가 이 필드로 allowlist 강제 주입
- `src/permission-denied/permission-denied-record.module.ts` — `UserInstanceAccessModule` 을 imports 에 추가해 repository DI 가용화
- `src/user-instance-access/user-instance-access.repository.ts` — `findInstanceRefsByUserId(userId): string[]` allowlist lookup + `normalizeInstanceRef(raw): string` (query.instanceRef 비교 정규화에 재사용)
- `src/user-instance-access/user-instance-access.module.ts` — export 하는 `UserInstanceAccessRepository` (import 대상)
- `src/permission-denied/permission-denied-record.service.spec.ts` — 기존 service spec (colocated — 본 task 의 spec 추가/수정 위치)
- `src/permission-denied/permission-denied-record.module.spec.ts` — 기존 module spec (colocated — DI 등록 검증 위치)

## Acceptance Criteria

결선 (구현):

- [ ] `PermissionDeniedRecordModule` 의 `imports` 에 `UserInstanceAccessModule` 추가 — `UserInstanceAccessRepository` 가 `PermissionDeniedRecordService` 에 DI 주입 가능. (PersistenceModule `@Global` 패턴과 달리 UserInstanceAccessModule 은 일반 module 이라 명시 imports 필요.)
- [ ] `PermissionDeniedRecordService` 생성자에 `UserInstanceAccessRepository` 추가 주입 (기존 `PermissionDeniedRecordRepository` 와 병렬).
- [ ] `list` 의 Admin bypass 분기 **변경 0** — `isAdminBypass(actor?.role)` true 면 `repository.findMany(query)` 전체 forward 그대로 (ADR-0024 §3 / ADR-0023 §3).
- [ ] non-Admin 분기를 placeholder("빈 배열 즉시 반환") → 실 필터로 대체 (ADR-0024 §3):
  1. `actor?.sub` 로 `userInstanceAccessRepository.findInstanceRefsByUserId(...)` 호출해 `allowlist: string[]` 획득. `actor`/`sub` 부재면 빈 allowlist (repository 가 빈 userId 를 빈 배열로 처리 — repo 책임이지만 service 도 `actor?.sub` undefined 방어).
  2. allowlist 공집합이면 → **빈 배열 반환** (repository 미호출, ADR-0024 §4 binding 0 fallback).
  3. allowlist 비어있지 않으면 → `query.instanceRef` ∩ allowlist 교집합 처리 후 `findMany` 에 `instanceRefIn: allowlist` 강제 주입해 forward.
- [ ] `query.instanceRef` (사용자 제공 단일 exact) ∩ allowlist 교집합 (ADR-0024 §3):
  - `query.instanceRef` 부재면 → `findMany({ ...query, instanceRefIn: allowlist })` (allowlist 전체).
  - `query.instanceRef` 가 (정규화 후) allowlist 에 **속하면** → 그 단일 instanceRef 로 좁힘 (`instanceRef` 유지 + `instanceRefIn: allowlist` 둘 다 전달 — repository AND 합성이 교집합 처리, 또는 동등 결과를 보장하는 방식).
  - `query.instanceRef` 가 allowlist 에 **없으면** → **빈 결과** 반환 (타 instance 비노출 — 403 아님, ADR-0024 §4 빈-필터). repository 미호출하거나 매칭 0 보장.
  - 비교 시 `normalizeInstanceRef` 로 양측(query.instanceRef 와 allowlist 원소)을 동일 정규화 후 membership 판정 (ADR-0024 §4 round-trip 일관 — allowlist 는 이미 정규화 저장값이나 query.instanceRef 는 raw 라 정규화 필요).
- [ ] `provider` / `httpStatus` 등 기타 query 필터는 own-instance 필터와 함께 forward (덮어쓰지 않음).

R-112 test (모두 `permission-denied-record.service.spec.ts` colocated 에 추가/수정):

- [ ] happy-path: non-Admin actor + 비어있지 않은 allowlist → `findMany` 가 `instanceRefIn=allowlist` 로 호출되고 해당 record 만 반환 (자기 instance 조회). Admin actor → 전체 forward (bypass) happy-path.
- [ ] error path: non-Admin path 에서 `findInstanceRefsByUserId` reject (DB 장애) → swallow 없이 propagate. Admin path 의 `findMany` reject propagate (기존 유지 확인).
- [ ] flow/branch: Admin bypass vs non-Admin 분기, allowlist 공집합 vs 비어있음 분기, query.instanceRef 부재 vs in-allowlist vs out-of-allowlist 3분기 각 1+ test.
- [ ] negative cases 충분 cover (각 1+): (1) 타 instance record 차단 — query.instanceRef 가 allowlist 밖 → 빈 결과 (findMany 미호출 또는 매칭 0). (2) non-Admin 빈 allowlist → 빈 배열 (repository 미호출). (3) query.instanceRef ∩ allowlist — in-allowlist 는 단일로 좁힘, out-of-allowlist 는 빈 결과. (4) Admin 전체 조회 우회 — Admin 은 allowlist lookup 무시하고 query 전체 forward. (5) 미인증/actor 부재 — `actor` undefined → non-Admin 취급, throw 0, 빈 allowlist → 빈 배열. (6) 경계 instance 식별자 — query.instanceRef 가 case/trailing-slash 변형이어도 정규화 후 allowlist 매칭 (예: `GitHub.SEC.samsung.net` vs allowlist 의 `github.sec.samsung.net`).
- [ ] regression test 1+: 현 non-Admin "항상 빈 배열" placeholder → 실 필터 전환 회귀 방어 — binding 있는 non-Admin 사용자가 자기 record 를 **실제로 받는지** (빈 배열로 회귀하지 않음) 검증.
- [ ] `permission-denied-record.module.spec.ts` 에 `UserInstanceAccessModule` import 후 `PermissionDeniedRecordService` 가 `UserInstanceAccessRepository` 주입과 함께 정상 해소되는지 DI 검증 (Test.createTestingModule compile).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- prisma schema / migration 변경 — row (1) T-0221 에서 완료. 본 task 는 schema.prisma 미접촉.
- `UserInstanceAccessRepository` 의 lookup/normalize 로직 변경 — row (2) T-0222 머지 완료. 본 task 는 import 후 호출만.
- `PermissionDeniedRecordFilter.instanceRefIn` / `findMany` AND 합성 변경 — split A T-0223 머지 완료. 본 task 는 `instanceRefIn` 으로 주입만.
- controller 변경 — `PermissionDeniedRecordController` 는 이미 `@CurrentUser()` 로 actor 를 service 에 forward (변경 불요). 단순 query param 매핑은 그대로.
- binding 부여 경로 (Admin endpoint / seed — 누가 User 에 instance 를 부여하는가, ADR-0024 §5 조건부 row). 별도 task / Follow-up.
- `JwtPayload` 확장 (instance claim) — ADR-0024 §3 / ADR-0023 §2 server-side lookup 채택, claim 비확장.
- 새 guard / interceptor / pagination / 응답 envelope 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
