---
id: T-0251
title: AssessmentCollectionModule 배선 + app.module.ts 등록 (collection slice iv)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-031]
estimatedDiff: 95
estimatedFiles: 3
created: 2026-06-06
plannerNote: P4 collection slice (iv) — GithubCollectionService/ConfluenceCollectionService 를 AssessmentCollectionModule 로 배선(GithubModule/ConfluenceModule import + provider/export) + app.module 등록, module compile spec(순수 DI, 분기 0)
---

# T-0251 — AssessmentCollectionModule 배선 + app.module.ts 등록 (collection slice iv)

## Why

ADR-0029 가 Assessment collection orchestrator 설계를 박제했고, slice (i) Activity 도메인 모델 + mapper(T-0248 merged) → slice (ii) GitHub 수집 service(T-0249 merged) → slice (iii) Confluence 수집 service(T-0250 merged 19cdde2)가 완료됐다. 그러나 `GithubCollectionService` / `ConfluenceCollectionService` 는 아직 어떤 NestJS module 에도 배선되지 않아 DI 로 inject 받을 수 없고 `app.module.ts` 에도 미등록이다. 본 task 는 후속 slice **(iv) = AssessmentCollectionModule 신설**로, ADR-0029 Decision §1(신규 `AssessmentCollectionModule` 신설 — `GithubModule` / `ConfluenceModule` import, collection → adapter 단방향 유지, `app.module.ts` imports 에 추가)을 구현한다. 두 collection service 가 각각 `GithubInstanceClient`(GithubModule export) / `ConfluenceSpaceTraversalService`(ConfluenceModule export)를 생성자 주입받으므로, 본 module 이 두 adapter module 을 import 하고 두 collection service 를 provider 로 등록 + export 하면 DI resolution 이 성립한다. orchestrator entry + Contribution 영속화는 slice (v), since 도출은 slice (vi)로 분리된다. 본 slice 는 **순수 NestJS module 선언 + DI wiring**(분기 로직 0)이라 module compile + provider resolution test 로 검증한다(github.module.spec.ts 패턴 mirror).

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 Decision §1(Module placement — 신규 `AssessmentCollectionModule` 신설, `GithubModule` / `ConfluenceModule` / `PersistenceModule` import 방향 = collection → adapter / persistence 단방향, `app.module.ts` imports 에 추가, modules.md row 9 reconcile 은 별도 doc-sync slice vii — 본 task 밖). LlmModule 은 import 하지 않는다(의존성 표면 최소화).
- `src/assessment-collection/github-collection.service.ts` — `GithubCollectionService` (`@Injectable`, 생성자 `private readonly client: GithubInstanceClient`). 본 module 이 provider 로 등록 + export 할 대상.
- `src/assessment-collection/confluence-collection.service.ts` — `ConfluenceCollectionService` (`@Injectable`, 생성자 `private readonly traversal: ConfluenceSpaceTraversalService`). 본 module 이 provider 로 등록 + export 할 대상.
- `src/github/github.module.ts` — `GithubModule` 이 `GithubInstanceClient` 를 `exports` 에 포함함을 확인(L65). 본 module 이 `imports: [GithubModule]` 하면 `GithubCollectionService` 의 `GithubInstanceClient` 주입이 성립.
- `src/confluence/confluence.module.ts` — `ConfluenceModule` 이 `ConfluenceSpaceTraversalService` 를 `exports` 에 포함함을 확인(L91~95). 본 module 이 `imports: [ConfluenceModule]` 하면 `ConfluenceCollectionService` 의 `ConfluenceSpaceTraversalService` 주입이 성립.
- `src/app.module.ts` — AppModule `imports` 배열(현재 PersistenceModule / UserModule / AuthModule / LlmModule / GithubModule / ConfluenceModule / PermissionDeniedRecordModule). 본 task 가 `AssessmentCollectionModule` 을 이 배열에 추가(adapter module 들 뒤, topological order 상 domain module 위치).
- `src/github/github.module.spec.ts` — module compile + provider resolve + sentinel override + DI resolution 검증 spec 패턴(본 task 의 `assessment-collection.module.spec.ts` 가 mirror 할 템플릿). `Test.createTestingModule({ imports: [...] }).compile()` → `moduleRef.get(Service)` → `toBeInstanceOf` 패턴. PrismaService 는 `@Global()` PersistenceModule 이 export 하므로, 전이 의존(GithubModule/ConfluenceModule → PermissionDeniedRecordModule → PrismaService)을 위해 spec 의 imports 에 PersistenceModule 을 함께 넣고 PrismaService 의 super() 부작용은 `jest.mock("../persistence/prisma.service", ...)` 로 회피하는 패턴 확인.
- `scripts/check-spec-presence.sh` — 신규 production `.ts`(여기선 `assessment-collection.module.ts`)에 동반 `.spec.ts` 가 같이 추가돼야 CI green(R-112 1차 gate). `app.module.ts` 는 수정(M)이라 gate 대상 외.

## Acceptance Criteria

- [ ] `src/assessment-collection/assessment-collection.module.ts` 신설 — `@Module` 데코레이터에 `imports: [GithubModule, ConfluenceModule]`, `providers: [GithubCollectionService, ConfluenceCollectionService]`, `exports: [GithubCollectionService, ConfluenceCollectionService]` 를 선언한 `AssessmentCollectionModule` export. github.module.ts / confluence.module.ts 의 도메인 한국어 주석 스타일을 mirror 해 책임 범위 + 책임 경계(orchestrator entry + 영속화는 slice v, since 도출은 slice vi)를 명시. `PersistenceModule` 은 두 adapter module 이 이미 (전이로) PrismaService 를 끌어오므로 직접 import 불요(ADR-0029 §1 단방향 import 만 유지) — 단 collection service 자체는 Prisma 의존 0 이라 본 slice 에서 PersistenceModule import 는 추가하지 않는다.
- [ ] `src/app.module.ts` 의 AppModule `imports` 배열에 `AssessmentCollectionModule` 추가(GithubModule / ConfluenceModule / PermissionDeniedRecordModule 뒤). 파일 상단 주석에 한 줄 추가(T-0251 — AssessmentCollectionModule 배선, collection service DI 가용화).
- [ ] **module compile / provider resolution test** (순수 DI 배선 — 분기 로직 0 이므로 happy-path 는 module compile + provider resolve 로 충족): `src/assessment-collection/assessment-collection.module.spec.ts` 에서 `Test.createTestingModule({ imports: [PersistenceModule, AssessmentCollectionModule] }).compile()` 후 `moduleRef.get(GithubCollectionService)` / `moduleRef.get(ConfluenceCollectionService)` 가 각각 `toBeInstanceOf` 로 정상 resolve 됨을 검증. PrismaService super() 부작용은 github.module.spec.ts 처럼 `jest.mock` 으로 회피.
- [ ] **error / negative path test**: (1) `GithubInstanceClient` 또는 `ConfluenceSpaceTraversalService` 가 import 누락으로 resolve 불가하면 compile 이 throw 함을 보장하는 회귀 가드 — 예: 두 collection service 가 의존하는 GithubInstanceClient / ConfluenceSpaceTraversalService 가 module 안에서 resolve 되는지 명시 assert(import 누락 시 fail). (2) collection service 를 sentinel 로 `overrideProvider(...).useValue(sentinel)` 한 뒤 `moduleRef.get(...) === sentinel` 로 exports 등록 정합 간접 검증(외부 module 이 inject 가능함의 증명). github.module.spec.ts 의 sentinel override test 를 mirror.
- [ ] **분기 cover**: 본 module 은 순수 DI 선언이라 런타임 분기 0 — 이 항목은 "분기 없음 — 생략" 으로 spec 주석에 명시. 단 위 provider resolve + sentinel override + import-누락 회귀 가드로 wiring 정합의 모든 경로를 cover 한다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). module 선언 파일(`assessment-collection.module.ts`)이 coverage 산정에서 entrypoint 류로 trivial 하더라도 위 compile/resolve test 가 module 을 instantiate 하므로 자연 cover 됨 — 별도 coverage 예외 등록 불요.
- [ ] `scripts/check-spec-presence.sh` 통과(신규 `assessment-collection.module.ts` 에 동반 `assessment-collection.module.spec.ts` 존재).

## Out of Scope

- **orchestrator entry + Contribution 영속화(slice v)** — `collectForPerson(person, since?)` 진입점 / Person 의 instance×org×repo·SPACE enumerate / `Activity` → `Contribution` 영속화(repository 호출)는 본 task 밖. 본 slice 는 두 collection service 를 DI 로 가용화하는 module 배선까지만.
- **incremental since 도출(slice vi)** — 직전 Assessment → since 계산 로직. 본 module 은 그 service 를 배선하지 않는다.
- **modules.md row 9 reconcile doc-sync(slice vii)** — 수집/평가 module 분리의 modules.md 동기 갱신은 별도 direct doc-sync task.
- **LlmModule import / PersistenceModule 직접 import** — ADR-0029 §1 단방향 import(collection → adapter)만. LLM 의존 표면을 늘리지 않는다. collection service 는 Prisma 의존 0 이라 PersistenceModule 직접 import 도 추가하지 않는다(전이 의존만으로 충분).
- **live/credentialed 수집** — Q-0025 대로 UI 이후 deferred. 본 module 의 collection service 는 mock 주입 unit 으로만 검증된 상태이며 본 task 도 실 token / 실 네트워크를 도입하지 않는다.
- 두 collection service 내부 로직 변경 — 이미 T-0249/T-0250 에서 merged. 본 task 는 service 코드를 수정하지 않고 배선만 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
