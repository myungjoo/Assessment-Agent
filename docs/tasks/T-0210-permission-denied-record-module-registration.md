---
id: T-0210
title: PermissionDeniedRecordModule 등록 (repository+service DI wiring)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-016, REQ-029, REQ-059]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-04
plannerNote: P4 ADR-0022 후속 chain row3(emitter wiring)의 DI 선행 — repository+service(T-0209)를 module 로 등록·export 해야 emitter 가 service 를 inject 가능.
---

# T-0210 — PermissionDeniedRecordModule 등록 (repository+service DI wiring)

## Why

PLAN.md P4 가 PermissionDeniedRecord 를 병행 entity 로 박제했고, ADR-0022 "후속 task chain" 표가 schema+migration(T-0208 DONE) → repository+service(T-0209 DONE) → **영속화 emitter wiring**(row 3) 순서를 박제했다. emitter wiring slice 는 `PermissionDeniedRecordService` 를 실 emitter(`PermissionDeniedEmitter` port 구현)가 inject 해 1 row insert 하는 구조(ADR-0022 Decision §6)인데, NestJS service 는 **module 로 DI container 에 등록되기 전까지 inject 불가**다. 따라서 본 slice 는 emitter/adapter 통합의 DI 선행 조건 — `PermissionDeniedRecordModule`(repository+service 를 provide/export) 을 신설하고 app.module.ts 에 1 회 등록한다. LlmModule(T-0135) / GithubModule(T-0178) 의 provider/export 패턴을 mirror 한다. REQ-044(권한 거부 가시화)의 영속화 layer 를 DI 로 가용화하는 wiring slice.

## Required Reading

- `docs/decisions/ADR-0022-permission-denied-record-data-model.md` — 후속 task chain 표(L146~150, "영속화 emitter wiring" row 가 본 module 을 소비) + Decision §6(emitter 패턴 — service 를 emitter 가 inject). 본 module 이 그 emitter 의 DI 선행 조건임을 확인.
- `src/permission-denied/permission-denied-record.repository.ts` — 본 module 이 provide/export 할 `PermissionDeniedRecordRepository`(PrismaService 생성자 주입 — `@Global()` PersistenceModule 이 해결).
- `src/permission-denied/permission-denied-record.service.ts` — 본 module 이 provide/export 할 `PermissionDeniedRecordService`(`PermissionDeniedRecordRepository` 생성자 주입).
- `src/llm/llm.module.ts` — **mirror 대상 module**(repository+service 를 providers+exports 양쪽에 등록, PersistenceModule `@Global` 의존이라 imports 명시 불요). 본 module 은 이 패턴을 단순화해 mirror.
- `src/llm/llm.module.spec.ts` — **colocated module spec mirror**(PrismaService 를 jest.mock 으로 대체 → super() 부작용 회피, `Test.createTestingModule` compile + provider resolve + override sentinel + Reflect paramtypes 의존 검증). 본 slice 의 spec 위치도 colocated(`src/permission-denied/permission-denied-record.module.spec.ts`).
- `src/app.module.ts` — 본 module 을 imports 배열에 1 회 추가할 루트 module(현재 PersistenceModule/UserModule/AuthModule/LlmModule/GithubModule/ConfluenceModule 등록).

## Acceptance Criteria

코드 위치(파일 경로 colocated ordering — CLAUDE.md R-112 hint):

- [ ] `src/permission-denied/permission-denied-record.module.ts` 신설 — `PermissionDeniedRecordModule`. `@Module` 데코레이터에 `PermissionDeniedRecordRepository` + `PermissionDeniedRecordService` 를 **providers 와 exports 양쪽**에 등록(후속 emitter 가 service 를 inject 가능하도록 export). PersistenceModule(`@Global`)이 PrismaService 를 application-wide export 하므로 imports 명시 불요(llm.module.ts 와 동형 — 파일 상단 주석에 그 이유 박제). controllers 0(HTTP endpoint 는 후속 slice).
- [ ] `src/app.module.ts` 의 `imports` 배열에 `PermissionDeniedRecordModule` 을 **정확히 1 회** 추가(중복 등록 금지) + 상단 주석에 본 module 추가 사유 1 줄(T-0210, ADR-0022 영속화 layer DI 가용화).
- [ ] `src/permission-denied/permission-denied-record.module.spec.ts` 신설(colocated) — `Test.createTestingModule({ imports: [PersistenceModule, PermissionDeniedRecordModule] }).compile()` 로 module 이 compile 되고 provider 가 resolve 됨을 검증. llm.module.spec.ts 패턴 mirror(PrismaService 를 jest.mock 으로 대체해 super() 부작용 회피).
- [ ] **Happy-path test 1+**: module compile 후 `moduleRef.get(PermissionDeniedRecordService)` + `moduleRef.get(PermissionDeniedRecordRepository)` 가 각각 정의되고 해당 class instance 임을 검증(두 provider 모두 resolve).
- [ ] **Error/negative path test 1+**: provider override sentinel 패턴(llm.module.spec.ts L55~68 mirror) — `PermissionDeniedRecordService`(또는 repository)를 `.overrideProvider().useValue(sentinel)` 로 교체해도 module 이 compile 되고 sentinel 이 반환됨 → exports 가 정상 등록되어 외부 module 이 inject 가능함의 간접 검증.
- [ ] **Flow / branch coverage**: 본 module 클래스 자체는 분기 없는 선언적 메타데이터 — module 코드에 분기 0(이 경우 항목 생략 가능). spec 은 provider resolve 분기(정상 resolve vs sentinel override)를 각 1 test 로 cover.
- [ ] **Negative cases 충분 cover**: (1) `PermissionDeniedRecordService` 가 `PermissionDeniedRecordRepository` 를 생성자 의존성으로 요구함을 `Reflect.getMetadata("design:paramtypes", PermissionDeniedRecordService)` 로 정적 검증(의존 누락 시 fail — llm.module.spec.ts L73~83 mirror). (2) `PermissionDeniedRecordRepository` 가 PrismaService 를 생성자 의존성으로 요구함을 동일 기법으로 검증(PersistenceModule `@Global` 의존 정합).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제. 신규 module spec 의 colocated 동반으로 `scripts/check-spec-presence.sh` 도 통과.

## Out of Scope

- 영속화 emitter 구현(`NO_OP_PERMISSION_DENIED_EMITTER` → 실 `PermissionDeniedEmitter` port 구현 교체) — ADR-0022 chain row 3 의 **다음** slice. 본 task 는 service/repository 를 DI 로 가용화만 하고 emitter 클래스를 신설하지 않는다.
- GithubModule / ConfluenceModule 의 emitter 주입 변경 — 본 task 는 adapter wiring 을 건드리지 않는다(adapter 코드 0 변경).
- HTTP endpoint / controller(audit 조회 REST + RBAC) — ADR-0022 chain 후속 별도 slice. 본 module 은 controllers 0.
- repository / service 의 동작 로직 변경 — T-0209 가 이미 완결. 본 task 는 그것을 module 로 묶기만 한다(기존 .ts 본문 수정 0).
- principal 식별 보강(이벤트 shape 확장 + nullable FK) — 별도 ADR(ADR-0022 Alternatives §(c)).
- retention / TTL job — 도입 안 함(ADR-0022 §3 영구 보존).

## Follow-ups

- (carry-forward residual nit, T-0209 에서 이월) `test/helpers/db-truncate.spec.ts` L7 docstring "5 테이블 substring 검증" 이 stale — PermissionDeniedRecord migration(T-0208) 이후 truncate 대상 테이블 수가 증가했을 수 있음. spec 본문이 실제 통과 중이면 docstring 한 줄만 현행화하는 사소한 nit(별도 follow-up task 또는 인접 PR 의 nit-in-PR closure 로 처리, 본 slice 의 cap 안에서 처리 가능하면 같은 PR 의 다음 round 에서 정리 — CLAUDE.md §3 Nit-in-PR closure).
- (ADR-0022 chain row 3) 영속화 emitter wiring slice — 본 module 이 export 한 `PermissionDeniedRecordService` 를 inject 하는 `PrismaPermissionDeniedEmitter`(또는 동등) 신설 + Github/Confluence emitter port 교체. 본 task 완료 후 planner 가 큐잉.

## Suggested Sub-agents

implementer → tester
