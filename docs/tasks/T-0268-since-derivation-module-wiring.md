---
id: T-0268
title: ADR-0029 §5 slice vi-wiring — SinceDerivationService 를 AssessmentCollectionModule 에 배선
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-031, REQ-005, REQ-006, REQ-007, REQ-008, REQ-015]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0029 §5 slice vi-wiring — T-0267 신설 SinceDerivationService 를 AssessmentCollectionModule provider/export 배선 + module.spec 회귀. AssessmentService 는 기존 UserModule import+export 로 닫힘(새 import/ADR 불요). pr ~70 LOC/2파일, T-0265 wiring 패턴 mirror."
---

# T-0268 — ADR-0029 §5 slice vi-wiring — SinceDerivationService 를 AssessmentCollectionModule 에 배선

## Why

T-0267(PR-229, squash 1a5a890)이 `SinceDerivationService.deriveSince(personId)`(직전 Assessment 최신 `periodStart` → ISO since, 빈 배열 → `undefined` = full collection)를 read-only derivation service 로 신설했다. 그러나 T-0267 의 Out of Scope 가 명시한 대로 그 service 는 아직 **어떤 module 에도 provider 로 등록되지 않아** DI 로 inject 받을 수 없다 — T-0267 의 spec 은 직접 인스턴스화 + `AssessmentService` mock 주입으로만 검증했다. `assessment-collection.module.ts` 의 주석도 "incremental since 도출(slice vi) — 직전 Assessment → since 계산 service 의 배선" 을 후속 task 로 명시해 둔 상태다.

본 task 는 그 배선 micro-slice 다 — `SinceDerivationService` 를 `AssessmentCollectionModule` 의 provider/export 로 등록해, 후속 호출처(scheduler/manual trigger)가 `deriveSince(personId)` 로 since 를 산출해 `CollectionEntryService.collectForPerson(person, since, assessmentId)` 에 주입할 수 있게 DI 표면을 연다.

main 대조(issue-still-relevant pre-check 통과): `assessment-collection.module.ts` 의 `providers`/`exports` 배열에 `SinceDerivationService` 가 **아직 없다**. `SinceDerivationService` 의 유일한 생성자 의존 `AssessmentService` 는 `UserModule` 이 이미 export 하고(user.module.ts L174), 본 module 의 `imports` 에 `UserModule` 이 이미 포함돼 있어(현 imports: `[GithubModule, ConfluenceModule, UserModule]`) **새 import 0 / 새 dependency 0 / 새 schema 0 / 새 credential 0** 으로 닫힌다. CLAUDE.md §5 게이트 미발화. README REQ-031(재수집 중복 방지 + incremental)의 application-layer 배선 + REQ-005~008/REQ-015(수집 since query)를 cover 한다.

## Required Reading

- `docs/tasks/T-0267-since-derivation-service.md` — 본 task 가 배선할 `SinceDerivationService` 의 책임/시그니처(`deriveSince(personId): Promise<string | undefined>`, 생성자 `AssessmentService` 1개 주입) + Out of Scope 의 "module provider 배선은 별도 후속 micro-slice" 분리 경계 + Follow-ups #1.
- `src/assessment-collection/since-derivation.service.ts` — 배선 대상 service. `@Injectable()` `SinceDerivationService`, 생성자 `constructor(private readonly assessmentService: AssessmentService)`, import `{ AssessmentService } from "../user/assessment.service"`. 본 task 는 이 파일을 **변경하지 않는다**(읽기만).
- `src/assessment-collection/assessment-collection.module.ts` — **본 task 의 1차 변경 대상**. 현 `imports: [GithubModule, ConfluenceModule, UserModule]` / `providers`(8개) / `exports`(5개) 배열 + slice vi 배선을 후속으로 명시한 주석. `UserModule` import 가 이미 있어 `AssessmentService` 가 DI 로 resolve 됨을 확인할 것(user.module.ts L174 export).
- `src/assessment-collection/assessment-collection.module.spec.ts` — **본 task 의 2차 변경 대상**. `Test.createTestingModule({ imports: [AssessmentCollectionModule] }).compile()` 후 `moduleRef.get(...)` provider resolve happy-path + `.overrideProvider(...).useValue(sentinel)` exports 정합 + `imports: []` 만의 negative(provider 미등록 throw) 패턴. 본 task 는 `SinceDerivationService` 케이스를 이 3 패턴에 동형으로 추가한다.
- `src/user/user.module.ts` (exports 블록, L155~ + L174 `AssessmentService`) — `AssessmentService` 가 이미 export 됨을 확인용(변경 0). 본 module 의 `UserModule` import 가 이 export 를 통해 `SinceDerivationService` 생성자 주입을 닫는 근거.
- `docs/tasks/T-0265-collection-chain-module-wiring.md` — 직전 module-wiring slice(4 service 를 동일 module 에 배선 + module.spec 회귀). 본 task 가 mirror 할 패턴(provider/export 추가 + spec 3 패턴 cover) 참고.

## Acceptance Criteria

본 task 의 산출물은 module 파일 1개(provider/export 추가 + 주석 정합) + 그 colocated module spec 1개(`SinceDerivationService` resolve 회귀 추가) = 2 파일이다. `since-derivation.service.ts` 자체는 변경하지 않는다.

- [ ] **provider 등록**: `assessment-collection.module.ts` 의 `providers` 배열에 `SinceDerivationService` 를 추가하고, 파일 상단에 `import { SinceDerivationService } from "./since-derivation.service";` 를 추가한다(기존 collection service import 패턴 mirror).
- [ ] **export 등록**: `exports` 배열에도 `SinceDerivationService` 를 추가한다 — 후속 호출처(scheduler/manual trigger, 별도 module)가 본 service 를 inject 받아 since 를 산출하기 위함.
- [ ] **새 import 0(AssessmentService 닫힘 검증)**: `imports` 배열은 변경하지 않는다. `SinceDerivationService` 의 생성자 의존 `AssessmentService` 는 기존 `UserModule` import(이미 `AssessmentService` export, user.module.ts L174)로 DI 가 resolve 됨을 module spec 의 compile/resolve test 로 증명한다(새 module import 추가 시 그것이 redundant 임을 인지).
- [ ] **주석 정합**: module 파일 주석의 "incremental since 도출(slice vi) — 직전 Assessment → since 계산 service 의 배선" 후속 표기를, 본 task 로 배선 완료됨을 반영하도록 갱신한다(slice vi 배선 완료 + `SinceDerivationService` 의 `AssessmentService` 의존이 `UserModule` import 로 닫힘을 1~2줄로 박제). §12 한국어 주석.
- [ ] happy-path test 1+ (provider resolve): `Test.createTestingModule({ imports: [AssessmentCollectionModule] }).compile()` 후 `moduleRef.get(SinceDerivationService)` 가 `SinceDerivationService` 인스턴스로 resolve 됨을 검증(기존 happy-path test 에 case 추가 또는 신규 `it`). DI wiring 정합 — `AssessmentService` 주입이 `UserModule` import 로 닫혔음을 간접 증명.
- [ ] error/negative path test 1+ **각 분기**(기존 spec 패턴 mirror): (a) **exports 정합** — `.overrideProvider(SinceDerivationService).useValue(sentinel)` 후 `moduleRef.get(SinceDerivationService) === sentinel` 검증(export 등록 증명, 후속 enumerate/호출처가 inject 가능). (b) **provider 미등록 가드(negative)** — `imports: []`(또는 module 미import) 만으로 `moduleRef.get(SinceDerivationService)` 가 throw 함을 검증(본 module 없이는 resolve 불가 — provider 등록이 본 module 책임임을 회귀 가드).
- [ ] flow/branch cover: provider resolve(happy) / sentinel override(exports 정합) / 미등록 throw(negative) 각 1+ test. 본 변경은 순수 DI 선언이라 module 파일 자체에 분기 로직 0 — 분기 cover 는 위 3 패턴(resolve / override / throw)으로 충족(module 코드 내부 분기 없음 — 이 항목은 module compile/resolve 경로 cover 로 대체).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110). 전체 suite 회귀 없음(특히 `assessment-collection.module.spec.ts` + 기존 `since-derivation.service.spec.ts` green 유지).
- [ ] colocated spec 위치: `src/assessment-collection/assessment-collection.module.spec.ts`(기존 colocated module spec 에 `SinceDerivationService` 케이스 추가). 신규 spec 파일 생성 불요 — 기존 module spec 의 3 패턴(resolve / override / 미등록 throw)에 동형 추가.

## Out of Scope

- **`SinceDerivationService` / `AssessmentService` / `CollectionEntryService` 의 코드 변경** — 전부 기존 시그니처 재사용. 본 task 는 `since-derivation.service.ts` / `assessment.service.ts` / `collection-entry.service.ts` 를 수정하지 않는다(읽기만). module 배선만.
- **호출처 결선(P5/P7 경계, ADR-worthy)** — scheduler/manual trigger 가 `deriveSince(personId)` 로 since 를 산출해 `collectForPerson(person, since, assessmentId)` 에 주입하는 진입점 wiring 은 본 task 밖(`Assessment` row 생성 주체 결정 필요). 본 task 는 `SinceDerivationService` 의 **DI 표면(provider/export)만** 연다.
- **새 module import / 새 dependency / 새 schema / 새 credential** — 0. `imports` 배열 변경 0(`AssessmentService` 는 기존 `UserModule` import 로 닫힘). DB schema/migration 0.
- **1 주 재수집 window / timezone 정책(REQ-058)** — ADR-0029 §5 가 deferred 한 incremental window 보정은 P5/P7. 본 task 는 배선만 — derivation 로직 보정 0.
- **modules.md doc-sync** — `SinceDerivationService` 배선을 `docs/architecture/modules.md` 의 collection chain enumerate 에 반영하는 doc-sync 는 별도 direct doc-sync micro-slice(T-0266 패턴). 본 task 는 pr-mode 코드 배선만.
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. module spec 는 실 DB·실 token 0(compile + DI resolve 검증만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- modules.md doc-sync(별도 direct micro-slice, T-0266 패턴): `SinceDerivationService` 배선 + `deriveSince` since 도출을 collection chain 도식/row 에 반영.
- 호출처 결선(P5/P7 경계, ADR-worthy): scheduler/manual trigger 가 `deriveSince` → `collectForPerson` 으로 since 를 잇는 진입점 + `assessmentId`(Assessment row) 생성 주체 결정.
- 1 주 재수집 window / timezone 보정(P5/P7, REQ-058): incremental window 정책 — 직전 `periodStart` 에서 1 주를 빼는 등 재수집 보호 보정.
