---
id: T-0270
title: ADR-0031 — collection manual-trigger HTTP endpoint 계약 박제
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-031, REQ-038, TBD]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-07
plannerNote: P4 collection 호출처 결선 milestone 첫 slice — ADR-first(manual HTTP POST trigger 계약), dependency-free, impl 0 LOC, doc-only enumerated-section ×1.6
---

# T-0270 — ADR-0031: collection manual-trigger HTTP endpoint 계약 박제

## Why

collection 체인(`src/assessment-collection/`)은 end-to-end 완성됐으나 production caller 가 0이다. `CollectionEntryService.collectForPerson(person, since, assessmentId)` 진입과 `SinceDerivationService.deriveSince(personId)` 도출이 모두 module 배선됐지만, [ADR-0030](../decisions/ADR-0030-assessment-collection-enumerate.md) §5(line 59)가 `assessmentId` 주입 경계를 "호출처(scheduler/manual trigger, P5 평가 진입)가 결정한다"로 deferred 했다. 사용자가 그 호출처를 **manual HTTP endpoint(POST)** 로 박제하기로 결정했다(새 외부 dependency 0, dependency-free 즉시 착수, cron 자동화는 추후 미승인). 본 task 는 이 milestone 의 ADR-first 첫 slice — manual-trigger endpoint 의 계약·orchestration 합성·Assessment row 생성 주체·module 배치·test posture 를 코드보다 먼저 [ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md) 에 결정한다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §5(collectForPerson 진입 계약, line 59 assessmentId 주입 경계 deferral) + §6(testing posture).
- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — §1(수집/평가 분리 — 수집 trigger 는 collection module).
- `src/assessment-collection/collection-entry.service.ts` — `CollectForPersonInput`(serviceIdentities: Pick<ServiceIdentity,"service"|"externalId">[]) + `collectForPerson(person, since, assessmentId): Promise<Contribution[]>` 계약.
- `src/assessment-collection/since-derivation.service.ts` — `deriveSince(personId): Promise<string|undefined>` (빈 배열→undefined=full collection).
- `src/assessment-collection/assessment-collection.module.ts` — 현 providers/exports 구성(controller 배치 결정 근거).
- `src/user/assessment.service.ts` + `src/user/assessment.repository.ts`(L47~ `AssessmentCreateInput` shape: personId/period/scope/periodStart/difficulty/contributionScore/volume/narrative) — Assessment row 생성 계약 + P2002 unique 분기.
- `src/user/person.service.ts` (L87~ `findById(id): Promise<Person>` 404 변환) — Person resolve + serviceIdentities 추출 경로.
- `src/user/assessment.controller.ts` — `@Roles("Admin")` RBAC 패턴(POST/create 류 Admin+ tier) + guard stack 참고.
- `prisma/schema.prisma` — `model Assessment`(`@@unique([personId, period, scope, periodStart])`) 필드/제약(period/scope/periodStart 결정 근거).
- `docs/architecture/modules.md` — AssessmentCollectionModule row(현 9-service 배선) — controller 추가 위상 참고(본 task 에서 수정하지 않음).

## Acceptance Criteria

본 task 는 **doc-only ADR 작성**(impl 0 LOC, src 변경 0)이라 R-112 4종 unit test 의무는 발생하지 않는다 — ADR 은 코드가 아니므로 "분기 없음 — test 항목 생략". 단 commitMode 가 pr(ADR 은 reviewer 검토 대상)이므로 tester 가 `pnpm lint && pnpm build && pnpm test` 가 ADR 추가만으로 깨지지 않음(green 유지)을 확인한다(R-110).

- [ ] `docs/decisions/ADR-0031-collection-manual-trigger.md` 를 status `PROPOSED` 로 신설. Context / Decision / Consequences / Alternatives 4 섹션 한국어 본문(§12).
- [ ] **Decision §1 — Assessment row 생성 주체**: manual-trigger endpoint 가 Assessment row 를 직접 생성하는지(내부에서 `AssessmentService.create` 호출) vs 호출자가 `assessmentId` 를 넘기는지 결정. 결정 시 다음을 명시: (a) period / scope / periodStart(=수집 경계 = deriveSince 결과 또는 그 fallback)를 어떻게 채우는지, (b) difficulty / contributionScore / volume / narrative 같은 평가-산출 필드를 수집 단계에서 어떻게 처리하는지(placeholder vs 후속 P5 평가 채움 — ADR-0029 §1 수집/평가 분리 정합), (c) `@@unique([personId, period, scope, periodStart])` 재수집 중복(REQ-031) 시 P2002 처리(신규 생성 실패 → 기존 row 재사용 vs 에러 반환) 결정.
- [ ] **Decision §2 — manual-trigger endpoint 계약**: route(예 `POST /api/assessment-collection/collect` 또는 `POST /api/persons/:id/collect` 중 택일 + 근거), RBAC(`@Roles("Admin")` 등 tier 결정 + 근거), request body shape(personId(또는 path param) / period / scope / 기타 — 또는 assessmentId 직접 수신), response shape(생성된 `Contribution[]` 전문 vs summary{assessmentId, contributionCount, since} — 택일 + 근거), HTTP status(201 vs 200) 결정.
- [ ] **Decision §3 — orchestration 합성 순서**: (1) Person 을 `PersonService.findById` 로 resolve(404 분기) → (2) serviceIdentities 추출해 `CollectForPersonInput` 조립 → (3) `deriveSince(personId)` 로 since 도출 → (4) Assessment row 생성 시점(§1 결정 반영) → (5) `collectForPerson(input, since, assessmentId)` 호출 → (6) 결과 반환. **Assessment row 생성 시점**(deriveSince 전/후, collectForPerson 전 필수 — assessmentId FK 가 persist 에 필요)을 §1 과 정합되게 명시.
- [ ] **Decision §4 — module 배치**: 이 entry/controller(+ orchestration service / DTO)를 `AssessmentCollectionModule` 에 둘지 별도 module 둘지 결정 — ADR-0029 §1(수집/평가 분리, 수집 trigger 는 collection module) 정합 근거 명시. AssessmentModule 의 `AssessmentService` / UserModule 의 `PersonService` 를 어떻게 import 하는지(module imports / exports 경계) 박제.
- [ ] **Decision §5 — test posture**: mocked unit(R-112 — happy / error / branch / negative cases 충분 cover: Person 404 / 빈 serviceIdentities / deriveSince undefined(full) / P2002 중복 / collectForPerson 실패 전파) + e2e(supertest, mocked collection adapter) 의무 명시. live(실 token + 실 네트워크)는 [Q-0025](../STATE.json) 대로 deferred(§5 credential 게이트) — 본 chain 에서 다루지 않음을 명시.
- [ ] **Alternatives**: (a) cron/scheduler 자동 트리거(미승인 — 추후), (b) assessmentId 를 호출자가 넘기는 안 vs endpoint 가 생성하는 안의 trade-off, (c) route 위치 대안(collection module vs persons sub-resource)을 박제.
- [ ] **Follow-ups(ADR 본문 + 본 task Follow-ups 둘 다)**: 본 ADR 위에서 진행할 impl slice 들(DTO → orchestration service → controller → e2e)을 dependency-first 순서로 명시(각 ≤300 LOC / ≤5 파일 cap 준수, planner 가 차례로 큐잉).
- [ ] `pnpm lint && pnpm build && pnpm test` green 유지(R-110 — ADR 추가만으로 깨지지 않음을 tester 가 확인).

## Out of Scope

- 실제 controller / DTO / orchestration service / e2e spec **코드 작성 금지** — 본 task 는 ADR(결정 박제)만. impl 은 후속 slice.
- `src/assessment-collection/` 기존 service 변경 금지.
- `docs/architecture/modules.md` / `api.md` 수정 금지 — impl slice merge 후 별도 doc-sync task.
- cron/scheduler 자동 트리거 설계 금지(미승인 — Alternatives 에 언급만).
- live(실 GitHub/Confluence token) 통합 설계 금지(Q-0025 deferred — test posture 에 "deferred" 명시만).
- 새 외부 dependency 추가 금지(dependency-free 결정).
- `docs/STATE.json` 의 humanQuestions / lock / blockers 수정 금지(driver 가 Q-0026 별도 처리).

## Suggested Sub-agents

`architect → tester` (architect 가 ADR-0031 작성, impl 0 이라 implementer 불요; tester 는 R-110 green 확인).

## Follow-ups

(생성 시 비어있음 — architect 가 ADR-0031 의 impl slice 분할을 여기에 박제: DTO slice → orchestration service slice → controller slice → e2e slice 순.)
