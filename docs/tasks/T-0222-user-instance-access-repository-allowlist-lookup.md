---
id: T-0222
title: UserInstanceAccess repository — allowlist lookup + 정규화 binding create
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 210
estimatedFiles: 3
created: 2026-06-04
completedAt: 2026-06-04T14:35:00+09:00
prNumber: 194
mergedAs: 6bb94e9
reviewRounds: 2
plannerNote: P4 Q-0021 option(1) chain row(2) — ADR-0024 §3 allowlist lookup + §4 정규화 binding repository. service 결선은 다음 slice.
result: DONE — UserInstanceAccessRepository(findInstanceRefsByUserId allowlist lookup + normalizeInstanceRef + 정규화 binding create) + repository/module spec. CI round 1 spec-presence fail(module.spec 누락) → round 2 module spec 추가로 self-heal. reviewer APPROVE r1+r2, 4-gate PASS, squash merge 6bb94e9. tasksCompleted 219→220.
---

# T-0222 — UserInstanceAccess repository (allowlist lookup + 정규화 binding create)

## Why

[ADR-0024](../decisions/ADR-0024-user-instance-binding-data-model.md) 가 박제한 own-instance 필터 chain 의 **row (2) — binding repository + allowlist lookup** slice 다. 직전 T-0221 이 `UserInstanceAccess` prisma model + migration 을 머지했으나 그 table 은 아직 **어떤 코드도 읽지 않는다** — audit endpoint 의 non-Admin 분기는 여전히 항상 빈 배열을 반환한다([service](../../src/permission-denied/permission-denied-record.service.ts) L137~143 placeholder). 본 task 는 그 binding table 위에 **data-access layer** 를 올린다: `actor.sub`(userId)로 허용 instance allowlist 를 server-side lookup 하는 `findInstanceRefsByUserId` + binding 입력 시 ADR-0024 §4 정규화(host lowercase / trailing-slash 제거)를 적용하는 create. REQ-016(권한 부족 user/admin audience 분리)의 non-Admin 절반 + REQ-044(instance 별 권한 분리)를 조회 측 data layer 로 준비한다.

**스코프 cut 결정 (Why 에 명시 — 본 slice = repository only):** ADR-0024 §후속 chain 은 row(2) repository 와 row(3) service 필터 결선을 **명시적으로 분리**한다. 본 task 는 **row(2) 만** — `UserInstanceAccessRepository`(allowlist lookup + 정규화 create) + 그 colocated spec 까지로 cap 안에 자른다. 사유: service 결선(row 3)은 (i) [`PermissionDeniedRecordFilter`](../../src/permission-denied/permission-denied-record.repository.ts) 를 `instanceRef in (allowlist)` set membership 을 받도록 확장 + (ii) [`PermissionDeniedRecordService.list`](../../src/permission-denied/permission-denied-record.service.ts) non-Admin 분기 교체 + query.instanceRef ∩ allowlist 교집합 + (iii) 두 module 의 spec 갱신을 동시에 요구해 LOC/파일 cap 초과 + concern 혼합(binding module ↔ permission-denied module)을 유발한다. 따라서 본 slice 는 repository + unit test 로 좁히고, **service/controller 결선(non-Admin always-empty placeholder 대체)을 명시적 next Follow-up** 으로 남긴다(아래 §Out of Scope / §Follow-ups).

**정규화 layer 결정:** ADR-0024 §4(v)는 정규화를 **binding 입력 시점(repository create)** 에 적용하라고 박제했다(`@@unique` 가 정규화값 기준 중복을 강제하도록). 따라서 host lowercase + trailing-slash 제거 정규화는 본 repository layer 에 둔다. lookup 측에서 record 의 instanceRef 와 비교할 때의 정규화 적용(query.instanceRef 정규화 등)은 service 결선 slice(Follow-up)에서 동일 정규화 함수를 재사용한다 — 본 slice 는 정규화 helper 를 **export** 해 다음 slice 가 차용할 수 있게 둔다.

## Required Reading

- [docs/decisions/ADR-0024-user-instance-binding-data-model.md](../decisions/ADR-0024-user-instance-binding-data-model.md) — Decision §2(채택 모델 필드/제약), §3(identity→allowlist→WHERE 계약 — 본 slice 는 lookup 까지), §4(경계 + instanceRef 정규화 (i)host lowercase / (ii)trailing-slash 제거 / (iii)path·scheme 그대로 / (iv)빈·null 제외 / (v)입력 시점 정규화)
- [prisma/schema.prisma](../../prisma/schema.prisma) L186~227 — `UserInstanceAccess` model(`id`/`userId`/`instanceRef`/`createdAt` + `@@unique([userId, instanceRef])` + `@@index([userId])` + `onDelete: Cascade`)
- [src/permission-denied/permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) — repository 패턴 source(PrismaService delegate 1:1 forward / reject propagate / 책임 경계 주석 스타일). 본 task 가 mirror.
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) L60~66 — `findUnique`/lookup idiom + null 반환 native 동작 참조
- [src/permission-denied/permission-denied-record.repository.spec.ts](../../src/permission-denied/permission-denied-record.repository.spec.ts) — colocated repository spec 구조 + PrismaService Jest mock 패턴(본 task 의 spec 가 mirror). prisma delegate mock 헬퍼 위치 확인.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 공유 PrismaService mock helper(존재 시 재사용; 없으면 repository.spec 의 inline mock 패턴 차용)

## Acceptance Criteria

신규 파일: `src/user-instance-access/user-instance-access.repository.ts`(+ 필요 시 `src/user-instance-access/user-instance-access.module.ts` — PrismaService provider 묶음, [permission-denied-record.module.ts](../../src/permission-denied/permission-denied-record.module.ts) mirror). colocated spec: `src/user-instance-access/user-instance-access.repository.spec.ts`. (module 디렉토리명·파일 배치는 기존 convention 따라 implementer 가 확정 — 단 spec 은 colocated.)

- [ ] `UserInstanceAccessRepository` 가 PrismaService 를 주입받아 `prisma.userInstanceAccess` delegate 에 forward 한다([permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) 패턴 mirror — raw forward / reject propagate / 값검증은 정규화 한정).
- [ ] **`findInstanceRefsByUserId(userId: string): Promise<string[]>`** — `WHERE userId = ?` 로 binding row 들의 `instanceRef` 만 select 해 `string[]` allowlist 반환(ADR-0024 §3 step 1). row 0 개면 빈 배열. `userId` 가 빈 문자열/undefined 면 lookup 0 → 빈 배열(ADR-0024 §3 step 1 / §4(iv) 경계 — DB 조회 없이 또는 빈 결과). 빈/null `instanceRef` row 는 allowlist 에서 제외(ADR-0024 §4(iv)).
- [ ] **`create(input: { userId; instanceRef }): Promise<...>`** — binding 1 row insert. insert 전 `instanceRef` 에 ADR-0024 §4 정규화 적용: (i) host 부분 lowercase, (ii) Confluence base URL trailing slash 제거, (iii) path·scheme 그대로 유지. 정규화 후 빈 문자열이면 유효 binding 아님(ADR-0024 §4(iv) — create 거부 또는 호출자에 명확한 에러; implementer 가 ADR 정합으로 결정하고 spec 에 박제).
- [ ] **정규화 helper 를 named export** — 함수(예: `normalizeInstanceRef(raw: string): string`)로 분리해 export(다음 service-결선 slice 가 lookup 측 비교에 재사용). 분기 있는 정규화 로직은 helper 안에 모음(R-112 entrypoint-helper 분리 정합).
- [ ] **R-112 happy-path test 1+** — (a) binding 있는 userId 의 `findInstanceRefsByUserId` 가 그 instanceRef 들을 정확히 반환, (b) `create` 가 정규화된 instanceRef 로 delegate 호출.
- [ ] **R-112 error path test 1+** — `findInstanceRefsByUserId` / `create` 의 PrismaService reject(DB 장애)가 swallow 없이 그대로 propagate(`await expect(...).rejects`).
- [ ] **R-112 flow/branch test** — 각 분기 1+: lookup row 0개 → 빈 배열 / lookup row 1+ → 채워진 allowlist / 빈·null userId → 빈 배열 / 정규화 helper 의 분기(host case 차이 / trailing-slash 유무 / 이미 정규화된 값 idempotent).
- [ ] **R-112 negative cases 충분 cover (각 1+)** — (1) 빈 문자열 instanceRef create → ADR-0024 §4(iv) 처리(거부/제외, throw 0 or 명확 에러), (2) 빈·null instanceRef row 가 섞인 lookup 결과에서 그 row 제외, (3) 정규화 edge: 대문자 host(`GitHub.SEC.samsung.net` → `github.sec.samsung.net`), (4) trailing slash(`.../wiki/rest/api/` → `.../wiki/rest/api`), (5) scheme/path 는 정규화 안 함(scheme 다르면 다른 instance — `http://` ≠ `https://`), (6) null/undefined userId → 빈 배열(throw 0).
- [ ] **regression 고려** — 본 slice 는 placeholder 를 아직 대체하지 않으므로(service 미접촉) audit endpoint 동작 변경 0. 그 사실을 spec 또는 PR 본문에 명시(다음 slice 가 placeholder 를 실 필터로 전환할 때 회귀 방어 test 를 추가; 본 slice 의 repository 단위 정규화·lookup 정확성 test 가 그 회귀 방어의 토대).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **service/controller 결선** — [`PermissionDeniedRecordService.list`](../../src/permission-denied/permission-denied-record.service.ts) non-Admin 분기의 always-empty placeholder 를 실 own-instance 필터로 대체하는 작업은 본 slice 가 **하지 않는다**(명시적 next Follow-up). 본 slice 머지 후에도 audit endpoint 는 non-Admin 에게 여전히 빈 배열 — 동작 변경 0.
- **`PermissionDeniedRecordFilter` set membership 확장** — `instanceRef in (allowlist)` 를 받도록 [permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) 필터 shape 를 바꾸는 일은 service 결선 slice(Follow-up) 책임. 본 slice 는 permission-denied module 미접촉.
- **query.instanceRef ∩ allowlist 교집합 로직** — ADR-0024 §3 의 사용자 query ∩ allowlist 합성은 service-layer 결선(Follow-up). 본 slice 는 allowlist lookup 까지만.
- **binding 부여 경로(seed / Admin endpoint)** — ADR-0024 §5 의 "누가 binding 을 채우는가"(POST /api/users/{id}/instance-access 등)는 별도 task(ADR-0024 §후속 chain 조건부 row). 본 slice 는 `create` repository primitive 만 제공하고 HTTP endpoint 를 노출하지 않는다.
- **JwtPayload 확장** — ADR-0024/ADR-0023 §2 server-side lookup 채택, claim 비확장.
- **schema / migration 변경** — T-0221 에서 완료. 본 slice 는 prisma schema 미접촉.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0024 가 데이터 모델·필터·정규화 계약을 이미 박제, 본 slice 는 그 §3 lookup + §4 정규화를 단일 source mirror).

## Follow-ups

- **(next slice — service 결선)** [`PermissionDeniedRecordService.list`](../../src/permission-denied/permission-denied-record.service.ts) non-Admin 분기를 `UserInstanceAccessRepository.findInstanceRefsByUserId(actor.sub)` lookup → allowlist 공집합이면 빈 배열 / 비면 `instanceRef in (allowlist)` 필터 강제 주입으로 교체(ADR-0024 §3). + [`PermissionDeniedRecordFilter`](../../src/permission-denied/permission-denied-record.repository.ts) 에 set membership(예: `instanceRefIn?: string[]`) additive 확장(기존 단일 exact 유지) + query.instanceRef ∩ allowlist 교집합. + R-112 4종 + negative(타 instance 빈-필터 / 미인증 401 / 빈 binding 200 / 경계 정규화) + **regression(placeholder→실 필터 전환: binding 있는 사용자가 자기 record 를 실제로 받는지)**. 본 slice 의 `normalizeInstanceRef` export 를 lookup 측 비교에 재사용.
- (조건부) binding 부여 경로 — ADR-0024 §5 seed 책임(Admin endpoint / seed script). 운영 필요 시 별도 task.
