---
id: T-1810
title: CollectionTargetService 신설 — create / findAll / findById + Prisma error 변환
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-registration
dependsOn: [T-1809]
touchesFiles:
  - src/assessment-collection/collection-target.service.ts
  - src/assessment-collection/collection-target.service.spec.ts
estimatedDiff: 260
estimatedFiles: 2
created: 2026-08-31
plannerNote: P5 / ADR-0059 Follow-up (b) 후반부 1/2 — repository(T-1809) 위 read+create 축 service 변환층만 절단, update/delete·module 배선은 다음 slice
---

# T-1810 — CollectionTargetService 신설 (create / findAll / findById + Prisma error 변환)

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (b)` 는
"repository + service" 를 한 항목으로 묶어 두었고, 전반부인 repository CRUD primitive 5 종은
[T-1809](T-1809-collection-target-repository.md) 로 merge 됐다. 남은 후반부는 그 primitive 위에
`§Decision 5` 오류 계약(`P2002` → 409 · row 부재 → 404)을 얹는 service 변환층인데,
5 메서드 + colocated spec 을 한 diff 에 담으면 cap(≤ 300 LOC)을 구조적으로 초과한다
(선례: `PartService` 183 LOC + spec 639 LOC). 그래서 본 slice 는 **read + create 축
3 메서드** (`create` · `findAll` · `findById`) 만 절단하고, `update` · `delete` 와 module 배선은
다음 slice 로 남긴다.

이 층이 없으면 [PLAN.md](../PLAN.md) `130 행` 오너 지시의 시스템 축(REQ-070 / REQ-072 /
REQ-073)에서 controller 가 forward 할 대상이 존재하지 않아 (c) DTO+controller slice 가 착수
불가다. 본 slice 는 controller · DTO · route 를 만들지 않으므로 실 HTTP 표면 변화는 0 이며,
`origin/main` 실측상 `CollectionTargetService` 는 아직 존재하지 않는다
(`git grep CollectionTarget -- src` 가 repository 2 파일만 hit).

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 2`(credential 미노출) · `§Decision 5`(오류 계약 표 c · d 행) · `§Follow-ups (b)`
- [src/assessment-collection/collection-target.repository.ts](../../src/assessment-collection/collection-target.repository.ts) — 본 service 가 감싸는 primitive 와 `CollectionTargetCreateInput` 타입
- [src/assessment-collection/collection-target.repository.spec.ts](../../src/assessment-collection/collection-target.repository.spec.ts) — mock fixture(`buildTargetFixture`) · `setup()` 패턴, 본 spec 이 mirror 할 스타일
- [src/user/part.service.ts](../../src/user/part.service.ts) — `getPrismaErrorCode` duck-typing helper + `P2002` → `ConflictException` / `P2025` → `NotFoundException` 변환 선례 (본 slice 가 shape 을 mirror)
- [src/user/part.service.spec.ts](../../src/user/part.service.spec.ts) `1~120 행` — repository mock 주입 + error 변환 검증 스타일 (전문 통독 불요)

## Acceptance Criteria

- [ ] `src/assessment-collection/collection-target.service.ts` 신설 — `@Injectable()` + `CollectionTargetRepository` **단독** 주입, public 메서드 정확히 3 개:
  - [ ] `create(input: CollectionTargetCreateInput): Promise<CollectionTarget>` — repository `create` forward, `P2002` 를 잡아 `ConflictException` 으로 변환 (ADR-0059 `§Decision 5` 오류 표 c 행). 그 외 error 는 raw propagate.
  - [ ] `findAll(): Promise<CollectionTarget[]>` — repository `findMany` forward. 0 row 면 빈 배열 그대로 (throw 금지).
  - [ ] `findById(id: string): Promise<CollectionTarget>` — repository `findById` 가 `null` 이면 `NotFoundException` (오류 표 d 행). row 존재 시 그대로 반환.
- [ ] Prisma error code 판정은 `PartService` 와 동형의 duck-typing helper (`instanceof` 의존 금지) 로 하고, 파일 상단 주석에 ADR-0059 `§Decision 5` 표의 어느 행을 집행하는지 명시한다.
- [ ] `src/assessment-collection/collection-target.service.spec.ts` colocated spec 신설 — repository 를 Jest mock 으로 대체해 DB 없이 실행. 다음 4 종을 모두 cover:
  - [ ] **happy path**: 3 메서드 각각 1+ — 올바른 인자 shape 으로 repository 를 호출하고 반환값을 그대로 propagate.
  - [ ] **error path**: `create` 가 `P2002` 를 받으면 `ConflictException`, `findById` 가 `null` 을 받으면 `NotFoundException` 각 1+.
  - [ ] **분기 cover**: `create` 의 (P2002 변환 / 非-P2002 raw propagate / code 없는 일반 Error) 분기, `findById` 의 (row 존재 / null) 분기 각 1+.
  - [ ] **negative cases 충분 cover** — 최소 5 종: ① `findAll` 이 빈 배열이어도 throw 하지 않음, ② `create` 가 받은 `P2025` 같은 다른 Prisma code 를 409 로 오변환하지 않음, ③ `code` 필드가 없는 `Error` 를 삼키지 않고 그대로 reject, ④ 반환 객체에 token / secret / password 계열 key 가 **0 개** (ADR-0059 `§Decision 2` credential 미노출), ⑤ 도메인 검증(`type` 값 허용 여부 · type 별 조건부 필수 필드)을 본 layer 가 수행하지 않고 pass-through (repository 호출 인자 그대로).
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 line · function 100% 목표.

## Out of Scope

- `update` · `delete` 메서드 (다음 slice — ADR-0059 `§Follow-ups (b)` 잔여).
- `AssessmentCollectionModule` provider 배선 (다음 slice 에서 update/delete 와 함께).
- DTO · controller · route · `@Roles` / guard 부착 — `§Follow-ups (c)` 소관.
- e2e 오류 계약 고정 — `§Follow-ups (d)` 소관.
- `resolveGithubInstances` / `resolveConfluenceInstances` union 병합 배선 — `§Follow-ups (g)` 소관. 본 slice 는 기존 수집 경로를 1 LOC 도 건드리지 않는다.
- `prisma/schema.prisma` · migration 변경 (T-1808 에서 완료, 재변경 금지).
- api.md · requirements.md doc-sync 및 REQ status 재판정 — `§Follow-ups (f)` 소관.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
