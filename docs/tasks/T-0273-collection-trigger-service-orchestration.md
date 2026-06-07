---
id: T-0273
title: CollectionTriggerService orchestration 6단계 합성 (ADR-0031 §3) + colocated spec
phase: P4
status: DONE
completedAt: 2026-06-07T21:38:00+09:00
prNumber: 234
mergeCommit: 4eec185
result: "CollectionTriggerService.triggerCollection §3 6단계 orchestration 신설(findByIdWithIdentities→serviceIdentities map→deriveSince→create[placeholder, ISO→Date, P2002→409]→collectForPerson→summary) + CollectionTriggerSummary export. PR-234 squash 4eec185, reviewer r1 APPROVE 0/0/1 MINOR(cap 348>300 spec-driven, acceptable), CI green(approval-gate race → rerun --failed), collection-trigger.service.ts 100% cov, 188 suite/3538 test green."
commitMode: pr
coversReq: [REQ-029, REQ-031, REQ-040]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-07
plannerNote: "P4 ADR-0031 Follow-up #2 후속(2b) — CollectionTriggerService(§3 6단계 orchestration) + spec(§5 a~f+happy). R-112 backbone ×1.5. module 배선은 #3 controller slice 로 defer."
---

# T-0273 — CollectionTriggerService orchestration 6단계 합성 + colocated spec

## Why

[ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md) 은 머지만 돼 있고 production caller 가 0 이던 collection backbone 의 호출처를 manual HTTP endpoint 로 박제했다. 그 Follow-up #2(orchestration service slice)는 (2a) `PersonService.findByIdWithIdentities`(serviceIdentities include read, T-0272 DONE) 와 (2b) `CollectionTriggerService`(§3 6단계 orchestration) 로 분할됐다. 본 task 는 그 **2b** — 4 service(PersonService / SinceDerivationService / AssessmentService / CollectionEntryService)를 ADR-0031 §3 순서로 조립해 한 Person 을 "지금 수집" 하는 orchestration service 를 박제한다(REQ-029 영속 / REQ-031 incremental 재수집 / REQ-040 manual trigger). controller(#3) 가 이 service 를 호출한다.

## Required Reading

- `docs/decisions/ADR-0031-collection-manual-trigger.md` — §1(Assessment row 생성·placeholder 평가필드), §3(6단계 합성 순서), §5(test posture a~f). 본 task 의 계약 원천.
- `src/assessment-collection/collection-entry.service.ts` — `CollectionEntryService.collectForPerson(person: CollectForPersonInput, since: string | undefined, assessmentId: string): Promise<Contribution[]>` 시그니처 + `CollectForPersonInput`(`serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[]`). 본 service 가 호출.
- `src/assessment-collection/since-derivation.service.ts` — `SinceDerivationService.deriveSince(personId: string): Promise<string | undefined>`(직전 periodStart→ISO, 신규 인원→undefined=full).
- `src/user/assessment.service.ts` — `AssessmentService.create(input: AssessmentCreateInput): Promise<Assessment>`(P2002 → `ConflictException` 변환). literal 위반 → `BadRequestException`.
- `src/user/assessment.repository.ts` — `AssessmentCreateInput` 8 필드(personId/period/scope/`periodStart: Date`/difficulty/contributionScore/volume/narrative). **주의: `periodStart` 는 `Date` 타입** — orchestration 이 ISO string ↔ Date 변환을 책임진다.
- `src/user/person.service.ts` (L99~109) — `PersonService.findByIdWithIdentities(id): Promise<PersonWithIdentities>`(null → `NotFoundException` 404). T-0272 신설.
- `src/user/person.repository.ts` (L30~36) — `PersonWithIdentities = Prisma.PersonGetPayload<{ include: { serviceIdentities: true } }>`. `.serviceIdentities` 배열에 `service` / `externalId` 보유.
- `src/assessment-collection/since-derivation.service.spec.ts` — 같은 module 의 colocated spec 패턴(mock 주입 스타일) 참고용.
- `CollectTriggerDto` (`src/assessment-collection/dto/collect-trigger.dto.ts`, T-0271 DONE) — 입력 contract `{ personId; period; scope; periodStart? }`. import 해 service 시그니처에 사용.

## Acceptance Criteria

구현 (`src/assessment-collection/collection-trigger.service.ts`):

- [ ] `@Injectable() CollectionTriggerService` 신설. 생성자 주입: `PersonService`, `SinceDerivationService`, `AssessmentService`, `CollectionEntryService`(전부 기존 — 새 import 0).
- [ ] 메서드 `async triggerCollection(dto: CollectTriggerDto): Promise<<summary>>` (또는 명확한 동등 시그니처) 가 ADR-0031 §3 6단계를 정확히 수행:
  1. `this.personService.findByIdWithIdentities(dto.personId)` → Person resolve(부재 → `NotFoundException` 404 **그대로 전파**, 잡지 않음).
  2. `person.serviceIdentities.map(si => ({ service: si.service, externalId: si.externalId }))` → `CollectForPersonInput.serviceIdentities`.
  3. `this.sinceDerivationService.deriveSince(dto.personId)` → `since: string | undefined`.
  4. `this.assessmentService.create({ personId: dto.personId, period: dto.period, scope: dto.scope, periodStart: <Date>, difficulty: "medium", contributionScore: 0, volume: 0, narrative: "" })` → Assessment → `assessmentId`. P2002 → `ConflictException` 그대로 전파. **collectForPerson 전 필수**(persist FK 가 이 row 요구).
  5. `this.collectionEntryService.collectForPerson({ serviceIdentities }, since, assessmentId)` → `Contribution[]`(reject 그대로 전파).
  6. summary `{ assessmentId, personId, since: since ?? null, period, scope, periodStart: <ISO string>, contributionCount: contributions.length }` 반환.
- [ ] **now() 처리(ADR-0031 §1)**: `periodStart` 결정 = `dto.periodStart` 명시 제공 시 그 ISO string, 미제공 시 서버 현재시각(`new Date().toISOString()`). `AssessmentService.create` 는 `Date` 를 요구하므로 ISO string → `new Date(...)` 변환. summary 의 `periodStart` 는 ISO string 형태로 반환(create 에 넘긴 경계와 동일 값).
- [ ] summary 의 반환 shape 를 명확한 interface/type 으로 export(예: `CollectionTriggerSummary`) — controller(#3)·spec 가 재사용.
- [ ] 한국어 주석으로 책임 경계(orchestration 만, building block 재구현 0, module 배선은 #3, throw 전파 fail-fast) 명시.

테스트 (`src/assessment-collection/collection-trigger.service.spec.ts`, colocated — R-112 ADR-0031 §5):

- [ ] **happy-path** — 4 의존성 mock 정상 동작 시 정상 summary 반환(assessmentId·personId·since·period·scope·periodStart·contributionCount 모두 기대값) + create 가 placeholder 평가필드(difficulty="medium", contributionScore=0, volume=0, narrative="")로 호출됨 검증 + collectForPerson 이 (serviceIdentities, since, assessmentId) 순서로 호출됨 검증.
- [ ] (a) **Person 404 전파** — `findByIdWithIdentities` 가 `NotFoundException` reject 시 그대로 전파, 후속 단계(deriveSince/create/collectForPerson) 미호출 검증.
- [ ] (b) **빈 serviceIdentities** — `serviceIdentities: []` 인 Person 일 때 collectForPerson 이 빈 input 으로 호출되고(collectForPerson mock 은 `[]` 반환), summary.contributionCount === 0. Assessment 는 그대로 생성됨(create 호출됨) 검증.
- [ ] (c) **deriveSince undefined → since null(full collection)** — `deriveSince` 가 `undefined` 반환 시 collectForPerson 에 `undefined` 가 전달되고 summary.since === `null`.
- [ ] (d) **AssessmentService.create P2002 → ConflictException 전파** — create 가 `ConflictException`(409) reject 시 그대로 전파, collectForPerson 미호출 검증.
- [ ] (e) **collectForPerson reject 전파** — collectForPerson reject 시 그대로 전파.
- [ ] (f) **의존성 reject 전파** — `findByIdWithIdentities` happy 후 `deriveSince` reject 전파 1 test + (404 외) 일반 reject 전파를 cover.
- [ ] **now() 결정론** — dto.periodStart 명시 제공 시 그 값이 create 와 summary 에 그대로 사용됨 검증(결정론). dto.periodStart 미제공 분기는 1 test 에서 결과 periodStart 가 유효한 ISO-8601 string 임만 검증(시각 자체 비교 금지 — `new Date(result.periodStart).toISOString() === result.periodStart` 또는 정규식).
- [ ] flow/branch: since undefined vs 존재 분기, periodStart 제공 vs 미제공 분기 각 1+ test(위 (c)·now() 항목으로 cover).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 service 는 100% 목표).

## Out of Scope

- **module provider 배선 금지** — `assessment-collection.module.ts` 에 `CollectionTriggerService` 등록은 **#3 controller slice** 가 담당(controller·AuthModule import·module.spec 회귀와 함께 배선이 자연스럽고, 본 task spec 은 service 를 직접 인스턴스화(mock 주입)로 검증하므로 module 배선 불요 — diff 를 service+spec 2파일로 작게 유지). 본 task 는 `assessment-collection.module.ts` 를 건드리지 않는다.
- **controller 신설 금지** — `AssessmentCollectionController`(POST /collect, RBAC, ValidationPipe)는 Follow-up #3.
- **e2e 금지** — `test/e2e/assessment-collection-trigger.e2e-spec.ts`(201/401/403/404/400)는 Follow-up #4.
- **doc-sync 금지** — modules.md / api.md 정합은 Follow-up #5(direct).
- **building block 재구현 금지** — collectForPerson / deriveSince / create / findByIdWithIdentities 는 호출만(이미 머지된 service, 시그니처 불변).
- **cron/scheduler 자동화 금지** — ADR-0031 Alternatives (a), 미승인.
- **live/credentialed 수집 금지** — Q-0025 deferred(§5 credential 게이트). 실 DB·실 token·실 네트워크 0, 4 의존성 전부 jest mock.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (#3) controller slice — `AssessmentCollectionController`(POST /api/assessment-collection/collect, RBAC Admin, ValidationPipe) + `CollectionTriggerService` module provider 배선 + `AuthModule` import + module.spec 회귀 + colocated spec(ADR-0031 §2/§4).
- (#4) e2e slice — `test/e2e/assessment-collection-trigger.e2e-spec.ts`(201 happy + 401/403/404/400, mocked adapter).
- (#5) doc-sync slice(direct) — modules.md(AssessmentCollectionModule row 에 controller/trigger) + api.md(POST /api/assessment-collection/collect 계약).
