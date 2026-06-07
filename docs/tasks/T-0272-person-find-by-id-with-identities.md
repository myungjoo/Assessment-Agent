---
id: T-0272
title: PersonService.findByIdWithIdentities 신설 — serviceIdentities include read 경로 추가
phase: P4
status: DONE
completedAt: 2026-06-07T21:20:00+09:00
prNumber: 233
mergeCommit: 293b20f
result: "PersonService/Repository.findByIdWithIdentities 신설(serviceIdentities include read, null-safe→404, PersonWithIdentities 타입 export) — ADR-0031 §3 #2, 기존 findById 불변. impl slice #2a. PR-233 squash 293b20f, reviewer r1 APPROVE 0/0/0, CI green, person.repository/service.ts 100% cov, 187 suite/3529 test green."
commitMode: pr
coversReq: [REQ-040, REQ-029, REQ-023]
estimatedDiff: 130
estimatedFiles: 4
created: 2026-06-07
plannerNote: "P4 호출처 결선 impl slice #2a (ADR-0031 Follow-up #2 split 선행) — orchestration 의 serviceIdentities read 경로를 micro-slice 로 분리, R-112 backbone ×1.5"
---

# T-0272 — PersonService.findByIdWithIdentities 신설 — serviceIdentities include read 경로 추가

## Why

[ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md) 가 caller 0 이던 collection backbone 의 호출처를 manual HTTP endpoint(`POST /api/assessment-collection/collect`)로 박제하고, impl 을 dependency-first 5 slice 로 분할했다 (#1 DTO[T-0271 DONE] → #2 orchestration service → #3 controller → #4 e2e → #5 doc-sync).

원래 Follow-up #2 (orchestration service slice) 는 `CollectionTriggerService`(§3 6단계) + `PersonService.findByIdWithIdentities`(serviceIdentities include read) 를 한 task 로 묶었으나, 두 변경을 합치면 production 2 파일 + 양쪽 colocated spec + repository 변경 = 6 파일 / ~335 LOC 으로 **cap (≤300 LOC / ≤5 파일) 초과**가 명확하다. 따라서 #2 를 **선행 micro-slice (본 T-0272) + 후속 orchestration (T-0273)** 으로 split 한다.

본 T-0272 는 그 선행 micro-slice — ADR-0031 §3 #2 가 명시한 "`findById` 가 serviceIdentities 를 include 하지 않으므로(person.repository 의 findById 에 include 없음) orchestration 이 `CollectForPersonInput.serviceIdentities` 를 확보하려면 별도 read 경로가 필요하다 → 권장: `PersonService` 에 serviceIdentities-포함 조회(`findByIdWithIdentities(id)`)를 추가(단일 round-trip, 404 분기 재사용, 기존 `findById` 시그니처 불변)" 를 구현한다. T-0273 의 `CollectionTriggerService` 가 본 메서드를 소비한다.

## Required Reading

- `docs/decisions/ADR-0031-collection-manual-trigger.md` — 특히 **§3 #2** (serviceIdentities 확보 — `findById` 가 include 안 함 → `findByIdWithIdentities(id)` 추가, 단일 round-trip, **404 분기 재사용, 기존 `findById` 시그니처 불변**, UserModule export 확인) 와 §1/§3 의 `CollectForPersonInput.serviceIdentities = serviceIdentities.map(si => ({ service: si.service, externalId: si.externalId }))` 매핑 의도(본 task 는 raw row+relation 반환까지 — map 변환은 T-0273 의 orchestration 책임).
- `src/user/person.repository.ts` — 특히 `findById(id): Promise<Person | null>` (L65, `this.prisma.person.findUnique({ where: { id } })`). 본 task 가 추가할 `findByIdWithIdentities` 는 동일 delegate 에 `include: { serviceIdentities: true }` 만 더한 sibling 메서드 (1:1 forwarding, null-safe API 유지 — row 부재 시 null 반환).
- `src/user/person.repository.spec.ts` — 특히 L41~53 (`personMock = { findUnique: jest.fn() }`, `prisma = { person: personMock } as unknown as PrismaService`) 와 L122~140 (findById happy: findUnique 결과 반환 + 호출 인자 검증 / findById null 반환) — 본 task 의 repository spec 이 mirror 할 mock 패턴.
- `src/user/person.service.ts` — 특히 constructor(L53~58: `repository: PersonRepository`, `prisma: PrismaService`) 와 `findById(id): Promise<Person>` (L88~95, null → `NotFoundException("person not found: ${id}")` 변환). 본 task 의 `findByIdWithIdentities` 는 이 404 분기를 동일하게 재사용한다.
- `src/user/person.service.spec.ts` — findById 의 happy/404 test 패턴 (mirror 대상). PersonRepository mock 주입 패턴 확인.
- `prisma/schema.prisma` — `model ServiceIdentity` (필드: `id`/`personId`/`service`/`externalId`/`isPrimary`/`createdAt`/`updatedAt`, `@@unique([personId, service])`) 와 `model Person` 의 `serviceIdentities ServiceIdentity[]` relation (L67). 반환 타입 정의에 참조.

## Acceptance Criteria

- [ ] `src/user/person.repository.ts` 에 `findByIdWithIdentities(id: string)` 메서드를 신설한다:
  - `this.prisma.person.findUnique({ where: { id }, include: { serviceIdentities: true } })` 를 1:1 forwarding. 기존 `findById` 와 동일하게 row 부재 시 `null` 반환(null-safe API 유지, throw 안 함).
  - 반환 타입은 serviceIdentities relation 을 포함하는 타입으로 명시한다. Prisma 생성 타입(예: `Prisma.PersonGetPayload<{ include: { serviceIdentities: true } }>`) 또는 그와 동등한 명시 타입을 export 해 service 가 import 가능하게 한다 (T-0273 가 `CollectForPersonInput.serviceIdentities` 매핑에 사용). 한국어 책임-경계 주석 1~2줄 (기존 `findById` 시그니처는 불변임을 명시).
- [ ] 기존 `findById(id): Promise<Person | null>` 시그니처/동작을 **변경하지 않는다** (ADR-0031 §3 #2 "기존 findById 시그니처 불변"). 새 메서드는 sibling 으로 추가만.
- [ ] `src/user/person.service.ts` 에 `findByIdWithIdentities(id: string)` 메서드를 신설한다:
  - `this.repository.findByIdWithIdentities(id)` 호출 → `null` 이면 `NotFoundException("person not found: ${id}")` throw (기존 `findById` 의 404 분기 재사용/동형), 아니면 그대로 반환.
  - 반환 타입은 repository 의 serviceIdentities-포함 타입. 한국어 책임-경계 주석 1~2줄.
- [ ] **Happy-path unit test (R-112 #1)**:
  - `person.repository.spec.ts` — `findByIdWithIdentities`: row(serviceIdentities 포함 fixture) 존재 시 findUnique 결과를 그대로 반환 + `findUnique` 가 `{ where: { id }, include: { serviceIdentities: true } }` 인자로 호출됨을 검증.
  - `person.service.spec.ts` — `findByIdWithIdentities`: repository 가 row(serviceIdentities 포함) 반환 시 그 row 를 그대로 반환.
- [ ] **Error path unit test (R-112 #2)**:
  - `person.repository.spec.ts` — `findByIdWithIdentities`: findUnique 가 `null` 반환 시 본 메서드도 `null` 반환(throw 안 함 — null-safe API).
  - `person.service.spec.ts` — `findByIdWithIdentities`: repository 가 `null` 반환 시 `NotFoundException` throw (message `person not found: ${id}` 포함).
- [ ] **Flow / branch coverage (R-112 #3)**: service 의 null → NotFoundException 분기 vs row 반환 분기를 각 1+ test 로 분리 cover. repository 는 분기 없음(forwarding) — 본 항목은 service 의 404 분기로 충족.
- [ ] **Negative cases 충분 cover (R-112 #4)** — 예외 상황 분기마다 1+ test:
  - 존재하지 않는 id → service 404 (위 error path 와 동일 케이스 가능).
  - findUnique 가 빈 serviceIdentities(`serviceIdentities: []`) 인 row 반환 → service 가 그 row 를 정상 반환(serviceIdentities 빈 배열도 유효 — T-0273 의 contributionCount=0 경로 선결). repository/service 각 1.
  - (분기 없음 항목 — repository forwarding 의 추가 분기는 없음을 본 task 본문에 명시하고 해당 R-112 항목 생략 가능.)
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (tester 가 R-110 따라 실행 확인).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `coverageThreshold.global` 강제). 신규 2 메서드의 happy + null + 빈-relation 경로가 cover 되어야 함.
- [ ] `scripts/check-spec-presence.sh` 통과 (수정한 production `.ts` 의 colocated spec 동반 — repository/service 모두 기존 colocated spec 존재, 신규 메서드 test 만 추가).
- [ ] `src/user/user.module.ts` 의 `exports` 에 `PersonService` 가 이미 포함됨을 확인(변경 0 — 이미 export, T-0273 의 DI 가 닫힘). module.ts 수정이 필요하면 cap·파일 수 재평가 후 진행하되 본 task 의 기대값은 module.ts 변경 0.

## Out of Scope

- **`CollectionTriggerService` orchestration (ADR-0031 §3 6단계)** — Follow-up #2 후속 slice (T-0273). 본 task 는 PersonService/Repository read 경로만.
- **`CollectForPersonInput.serviceIdentities` 로의 `map(si => ({ service, externalId }))` 변환** — T-0273 의 orchestration 책임. 본 task 는 serviceIdentities relation 을 포함한 raw row(또는 null/404) 반환까지.
- **`AssessmentService.create` placeholder 평가필드 Assessment row 생성** — T-0273 책임.
- **`AssessmentCollectionController` (POST /collect, RBAC)** — Follow-up #3 slice.
- **`AuthModule` import / assessment-collection.module.ts 배선** — Follow-up #3 slice.
- **e2e spec (`test/e2e/`)** — Follow-up #4 slice.
- **modules.md / api.md doc-sync** — Follow-up #5 slice (direct).
- 기존 `findById` / 다른 PersonService 메서드 동작 변경 — 본 task 는 sibling 메서드 add-only.
- `person.repository.ts` 의 다른 메서드(`findByPartId`/`findByGroupId` 등) 에 include 추가 — 본 task 는 `findByIdWithIdentities` 단일 신설.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0031 §3 #2 가 read 경로 설계를 이미 박제, 기존 `findById` + repository forwarding 패턴 mirror).

## Follow-ups

- (ADR-0031 chain 잔여) #2 후속 — `CollectionTriggerService`(§3 6단계: PersonService.findByIdWithIdentities resolve → serviceIdentities map → deriveSince → AssessmentService.create placeholder Assessment → collectForPerson → summary 반환) + colocated spec (R-112 §5 a~f: Person 404 / 빈 serviceIdentities contributionCount=0 / deriveSince undefined full / AssessmentService.create P2002→409 / collectForPerson reject 전파 / 의존성 reject 전파). 본 T-0272 의 `findByIdWithIdentities` 를 소비. (planner 가 T-0273 으로 큐잉 예정.)
- (ADR-0031 chain 잔여) #3 controller slice — `AssessmentCollectionController`(POST /collect, RBAC, ValidationPipe) + `AuthModule` import + module.spec 회귀.
- (ADR-0031 chain 잔여) #4 e2e slice — `test/e2e/assessment-collection-trigger.e2e-spec.ts` (201/401/403/404/400, mocked adapter).
- (ADR-0031 chain 잔여) #5 doc-sync slice (direct) — modules.md + api.md.
