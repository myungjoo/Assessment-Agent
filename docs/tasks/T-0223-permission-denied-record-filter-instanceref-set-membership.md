---
id: T-0223
title: PermissionDeniedRecordFilter 에 instanceRefIn set-membership 필터 추가 (ADR-0024 §3 chain row 3 slice A)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 105
estimatedFiles: 2
created: 2026-06-04
completedAt: 2026-06-04T14:35:00+09:00
prNumber: 195
mergedAs: e2cb7cd
reviewRounds: 1
plannerNote: P4 ADR-0024 own-instance 필터 결선 chain row(3) split A — repository set-membership 필터만(service 결선은 row B). R-112 backbone ×1.5.
result: DONE — PermissionDeniedRecordFilter 에 additive instanceRefIn?: string[] set-membership 필터 + findMany exact∩set AND 교집합. 신규 9 spec(빈 배열 in:[] 보안 케이스 포함). CI 1회 green, reviewer APPROVE r1 0 findings, 4-gate PASS, squash merge e2cb7cd. tasksCompleted 220→221.
---

# T-0223 — PermissionDeniedRecordFilter 에 instanceRefIn set-membership 필터 추가

## Why

[ADR-0024](../decisions/ADR-0024-user-instance-binding-data-model.md) §3 은 non-Admin audit 조회를 own-instance 범위로 좁히기 위해 `instanceRef in (allowlist)` set-membership 필터를 service 가 repository 에 강제 주입한다고 박제했다. 그러나 현 [`PermissionDeniedRecordFilter`](../../src/permission-denied/permission-denied-record.repository.ts) 는 단일 exact `instanceRef?: string` 만 보유한다(ADR-0024 §3 마지막 bullet + Consequences 음의 #3 — set 필터 표현 확장 필요). 본 task 는 그 확장만 — repository 에 `instanceRefIn?: string[]` set-membership 필터를 additive 로 추가한다. service 결선(non-Admin placeholder 대체 + query.instanceRef ∩ allowlist 교집합)은 의존 후속 slice(row B)다. ADR-0024 후속 chain row (3) 을 cap(≤300 LOC / 5 파일) 안에서 2 slice 로 split 한 첫 slice — 본 slice 머지 후에도 audit endpoint 의 동작 변경 0(service 가 아직 set 필터를 쓰지 않음).

## Required Reading

- [docs/decisions/ADR-0024-user-instance-binding-data-model.md](../decisions/ADR-0024-user-instance-binding-data-model.md) — §3(필터 계약: identity→allowlist→`instanceRef in (...)` set membership + query.instanceRef ∩ allowlist 교집합 = AND) + §4(경계/정규화) + Consequences 음의 #3(set 필터 additive 확장, 기존 단일 exact 유지) + 후속 chain 표 row (3)
- [src/permission-denied/permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts) — `PermissionDeniedRecordFilter`(L47~51 단일 `instanceRef` exact) + `findMany`(L70~87 where 구성, createdAt desc 고정) — 본 task 변경 대상
- [src/permission-denied/permission-denied-record.repository.spec.ts](../../src/permission-denied/permission-denied-record.repository.spec.ts) — colocated spec(본 task 가 확장할 spec, R-112 buildPrismaMock 패턴) — **신규 test 는 본 colocated spec 에 추가**
- [src/llm/llm-provider-config.repository.spec.ts](../../src/llm/llm-provider-config.repository.spec.ts) — buildPrismaMock mirror source(참고만)

## Acceptance Criteria

- [ ] `PermissionDeniedRecordFilter` 에 `instanceRefIn?: string[]` 필드 추가(기존 `instanceRef?: string` / `provider?` / `httpStatus?` 는 그대로 유지 — additive). 주석으로 "set-membership(`instanceRef in (...)`) own-instance 필터, ADR-0024 §3" + "단일 `instanceRef`(exact) 와 AND 공존(교집합)" 명시.
- [ ] `findMany` 가 `filter.instanceRefIn` 이 정의되어 있으면 Prisma where 에 `instanceRef: { in: filter.instanceRefIn }` 를 주입(undefined 면 omit — 기존 분기 패턴 정합). 단일 `instanceRef`(exact) 와 `instanceRefIn`(set) 이 **둘 다** 주어지면 둘 다 where 에 얹혀 AND(교집합)로 동작하도록 — 단일 exact 는 `where.instanceRef = ...`, set 은 `where.instanceRef = { in: [...] }` 가 충돌하므로 결합 규칙을 ADR-0024 §3 교집합 의미에 맞게 구현(예: 단일 exact 가 set 에 속하면 단일로 좁히고, 속하지 않으면 매칭 0 — 또는 Prisma `AND` 절 합성). 구현 방식은 implementer 판단이되 ADR-0024 §3 의 "교집합(AND)" + "사용자가 own-instance 범위를 query param 으로 넓힐 수 없다(allowlist 가 상한)" 의미를 honor.
- [ ] **Happy-path unit test 1+** (colocated spec): `instanceRefIn: ["a", "b"]` 제공 시 `findMany` 가 Prisma `findMany` 를 `where: { instanceRef: { in: ["a","b"] } }`(또는 동등 합성) + `orderBy: { createdAt: "desc" }` 로 호출.
- [ ] **Error path test 1+**: `instanceRefIn` 제공 상태에서 PrismaService delegate reject(DB 장애) 가 swallow 없이 그대로 propagate(rejects).
- [ ] **Branch / flow test**: `instanceRefIn` 분기마다 cover — (a) `instanceRefIn` 만 제공, (b) `instanceRef`(단일 exact) 만 제공(기존 동작 회귀 방어), (c) 단일 exact + set 둘 다 제공(AND/교집합), (d) 둘 다 부재(전체 조회 where 무필터) 각 1+.
- [ ] **Negative cases 충분 cover** (각 1+): (1) `instanceRefIn: []`(빈 배열) — own-instance 공집합 의미를 where 가 어떻게 표현하는지 검증(매칭 0 의미 — `{ in: [] }` 또는 호출자 책임 경계 명시; ADR-0024 §4 빈 allowlist=빈 결과 정합), (2) 단일 exact 가 set 에 **없는** 경우 → 매칭 0(타 instance 비노출, ADR-0024 §3/§4 빈-필터), (3) 단일 exact 가 set 에 **있는** 경우 → 그 단일로 좁힘, (4) `instanceRefIn` undefined + 다른 필터(provider) 만 → set 필터 미적용.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (tester 가 확인 — R-110).

## Out of Scope

- **service own-instance 필터 결선** — `PermissionDeniedRecordService.list` non-Admin placeholder(현 "항상 빈 배열") 대체 + `UserInstanceAccessRepository.findInstanceRefsByUserId` allowlist lookup + query.instanceRef ∩ allowlist 교집합 합성은 **본 task 밖**. ADR-0024 chain row (3) slice B(의존 후속 task) — 본 task 가 그 set-membership 필터 표현을 선제공한다.
- **module wiring** — `PermissionDeniedRecordModule` 에 `UserInstanceAccessModule` import 추가는 slice B(service 가 repository 를 inject 할 때 필요).
- **controller 변경** — query param 처리 / RBAC 변경 0. 본 task 는 repository layer 단일 변경 + colocated spec.
- **prisma schema / migration** — 변경 0(`PermissionDeniedRecord` schema 미접촉).
- **정규화 적용** — 본 task 는 set 필터 표현만. instanceRef 정규화(ADR-0024 §4)는 binding 입력/비교 시점(repository UserInstanceAccess + slice B) 책임 — 본 repository 는 받은 값 그대로 where 에 forward.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어있음)
