---
id: T-1811
title: CollectionTargetService update / delete 축 + AssessmentCollectionModule 배선
phase: P5
status: DONE
prNumber: 1423
completedAt: 2026-08-30T18:55:23Z
mergeCommit: 00b0bb5d
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-registration
dependsOn: [T-1810]
touchesFiles:
  - src/assessment-collection/collection-target.service.ts
  - src/assessment-collection/collection-target.service.spec.ts
  - src/assessment-collection/assessment-collection.module.ts
  - src/assessment-collection/assessment-collection.module.spec.ts
estimatedDiff: 230
estimatedFiles: 4
created: 2026-08-31
plannerNote: P5 / ADR-0059 Follow-up (b) 후반부 2/2 — update·delete 변환층 + module provider/export 배선으로 (b) 종결, DTO·controller 는 (c)
---

# T-1811 — CollectionTargetService update / delete 축 + AssessmentCollectionModule 배선

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (b)` 는
"repository + service" 를 한 항목으로 묶었고, 지금까지 repository CRUD primitive 5 종
([T-1809](T-1809-collection-target-repository.md)) 과 service 의 read + create 축 3 메서드
([T-1810](T-1810-collection-target-service-read-create.md)) 가 merge 됐다. 남은 것은
`update` · `delete` 두 메서드의 `P2025` → 404 변환층과, 그 service 를
`AssessmentCollectionModule` 에 provider / export 로 등록하는 DI 배선이다. T-1810 의
Out of Scope 가 이 둘을 "다음 slice 에서 update/delete 와 함께" 로 명시 이월했다.

이 slice 가 닫혀야 `§Follow-ups (c)` DTO + controller + RBAC 배선이 착수 가능하다 —
controller 가 `@Injectable` service 를 생성자 주입하려면 module provider 등록이 선행돼야
하기 때문이다. `origin/main` 실측상 `CollectionTargetService` 는 `create` · `findAll` ·
`findById` 3 메서드뿐이고 (`update` · `delete` 미존재), `assessment-collection.module.ts`
의 `providers` / `exports` 에 `CollectionTargetService` · `CollectionTargetRepository` 가
0 개다 — 본 slice 의 의도는 아직 main 에 안착돼 있지 않다.

본 slice 는 controller · route · DTO 를 만들지 않으므로 실 HTTP 표면 변화는 0 이다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 5` 오류 계약 표 **d 행**(`:id` row 부재 `P2025` → 404) · PATCH 행(정체성 축 `type` · `instanceKey` 제외) · `§Decision 2`(credential 미노출) · `§Follow-ups (b)`
- [src/assessment-collection/collection-target.service.ts](../../src/assessment-collection/collection-target.service.ts) — 본 slice 가 확장할 파일. 기존 3 메서드와 `getPrismaErrorCode` duck-typing helper 를 그대로 재사용한다 (helper 중복 정의 금지).
- [src/assessment-collection/collection-target.repository.ts](../../src/assessment-collection/collection-target.repository.ts) `30~80 행` — `CollectionTargetUpdateInput` 타입과 `update` · `delete` primitive 의 raw propagate 계약
- [src/assessment-collection/collection-target.service.spec.ts](../../src/assessment-collection/collection-target.service.spec.ts) — 본 spec 이 이어 쓸 mock 주입 · `setup()` 패턴 (신규 describe 블록만 추가, 기존 case 수정 금지)
- [src/assessment-collection/assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts) — `providers` / `exports` 배열과 주석 스타일. `CollectionTargetRepository` 의 유일한 의존 `PrismaService` 는 `@Global() PersistenceModule` 이 공급하므로 **새 `imports` 추가는 불요**.
- [src/assessment-collection/assessment-collection.module.spec.ts](../../src/assessment-collection/assessment-collection.module.spec.ts) `1~80 행` — `jest.mock("../persistence/prisma.service")` 의 delegate stub 목록 (여기에 `collectionTarget` delegate 를 추가해야 resolve 가 성립)

## Acceptance Criteria

- [ ] `src/assessment-collection/collection-target.service.ts` 에 public 메서드 **정확히 2 개** 추가 (기존 3 메서드 시그니처 · 동작 변경 0):
  - [ ] `update(id: string, input: CollectionTargetUpdateInput): Promise<CollectionTarget>` — repository `update` forward, `P2025` 를 잡아 `NotFoundException` 으로 변환 (ADR-0059 `§Decision 5` 오류 표 d 행). 그 외 error 는 raw propagate. 정체성 축(`type` · `instanceKey`) 은 타입상 애초에 받지 않으므로 본 layer 에서 별도 제거 로직을 넣지 않는다.
  - [ ] `delete(id: string): Promise<CollectionTarget>` — repository `delete` forward, `P2025` → `NotFoundException`. 그 외 raw propagate.
- [ ] Prisma error code 판정은 기존 `getPrismaErrorCode` duck-typing helper 를 **재사용** 한다 (`instanceof` 의존 금지, helper 재정의 금지). 두 메서드 주석에 ADR-0059 `§Decision 5` 표의 어느 행을 집행하는지 명시.
- [ ] `src/assessment-collection/collection-target.service.spec.ts` 에 두 메서드용 describe 블록 추가 — repository 를 Jest mock 으로 대체해 DB 없이 실행. 다음 4 종을 모두 cover:
  - [ ] **happy path**: `update` · `delete` 각 1+ — 올바른 인자 shape(`id`, `input`) 으로 repository 를 정확히 1 회 호출하고 반환 row 를 그대로 propagate.
  - [ ] **error path**: `update` 가 `P2025` 를 받으면 `NotFoundException`, `delete` 가 `P2025` 를 받으면 `NotFoundException` 각 1+.
  - [ ] **분기 cover**: 두 메서드 각각의 (`P2025` 변환 / 非-`P2025` code raw propagate / `code` 필드 없는 일반 `Error` raw propagate) 3 분기를 각 1+ test 로 cover.
  - [ ] **negative cases 충분 cover** — 최소 5 종: ① `update` 가 빈 객체 `{}` 를 받아도 throw 하지 않고 repository 로 그대로 forward (`@updatedAt` 갱신 semantics 보존), ② `update` 가 받은 `P2002` 를 404 로 오변환하지 않음, ③ `delete` 가 받은 `P2003` 같은 다른 code 를 삼키지 않고 그대로 reject, ④ 반환 객체에 token / secret / password 계열 key 가 **0 개** (ADR-0059 `§Decision 2` credential 미노출), ⑤ 도메인 검증(허용 `type` 값 · type 별 조건부 필수 필드)을 본 layer 가 수행하지 않고 pass-through — repository 호출 인자가 입력과 동일한지 검증.
- [ ] `src/assessment-collection/assessment-collection.module.ts` — `providers` 에 `CollectionTargetRepository` · `CollectionTargetService` 를 추가하고, `exports` 에 `CollectionTargetService` 를 추가한다. `imports` 배열은 **불변** (새 module import 0 — `PrismaService` 는 `@Global() PersistenceModule` 공급). 추가 라인에 왜 새 import 가 불요한지 1~3 줄 주석.
- [ ] `src/assessment-collection/assessment-collection.module.spec.ts` — `jest.mock` 의 mock `PrismaService` 에 `collectionTarget` delegate stub(`create` / `findUnique` / `findMany` / `update` / `delete`) 추가 + `CollectionTargetService` 가 module 에서 resolve 되고 `exports` 에 등록됐음을 검증하는 case 1+ 추가. 기존 case 는 전부 green 유지 (import-누락 회귀 가드 보존).
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `collection-target.service.ts` 는 line · function 100% 유지.

## Out of Scope

- DTO · controller · route · `@Roles` / `RolesGuard` 부착 — `§Follow-ups (c)` 소관. 본 slice 는 `src/assessment-collection/dto/` 를 1 파일도 만들지 않는다.
- e2e 오류 계약 고정 (`§Decision 5` 표 a ~ e 의 실 HTTP 검증) — `§Follow-ups (d)` 소관.
- AdminView 등록 · 편집 패널 등 `web/` 변경 — `§Follow-ups (e)` 소관.
- api.md · requirements.md doc-sync 및 REQ-070 / REQ-072 / REQ-073 status 재판정 — `§Follow-ups (f)` 소관. 본 slice 는 문서를 건드리지 않는다.
- `resolveGithubInstances` / `resolveConfluenceInstances` union 병합 배선 — `§Follow-ups (g)` 소관. 기존 수집 경로를 1 LOC 도 건드리지 않는다.
- `prisma/schema.prisma` · migration 변경 (T-1808 완료분 — 재변경 금지).
- `collection-target.repository.ts` 변경 (T-1809 완료분 — primitive 는 그대로 재사용).
- 기존 3 메서드(`create` · `findAll` · `findById`) 의 시그니처 · 동작 · 기존 spec case 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
