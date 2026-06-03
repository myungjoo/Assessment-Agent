---
id: T-0209
title: PermissionDeniedRecord repository + service slice
phase: P4
status: DONE
commitMode: pr
prNumber: 183
reviewRounds: 2
mergedAs: 519ee53
completedAt: 2026-06-04T01:40:00+09:00
coversReq: [REQ-044, REQ-016, REQ-029, REQ-059]
estimatedDiff: 270
estimatedFiles: 4
created: 2026-06-04
plannerNote: P4 PLAN L73/L75(PermissionDeniedRecord 병행 entity) — ADR-0022 후속 chain row2(repository+service). schema+migration(T-0208) 위 영속화 layer.
---

# T-0209 — PermissionDeniedRecord repository + service slice

## Why

PLAN.md P4 (L73/L75, hybrid-parallel) 가 PermissionDeniedRecord 를 P4 병행 entity 로 박제했고, T-0207(ADR-0022) → T-0208(prisma model + migration) 이 데이터 모델·schema 를 이미 main 에 안착시켰다. 본 slice 는 그 위에 **권한 거부 record 를 영속(write)·조회(read)하는 repository + service layer** 를 얹는다 — ADR-0022 "후속 task chain" 표의 row 2(repository + service). REQ-044(instance 별 권한 분리·권한 거부 가시화)의 영속화·조회 backbone 이며, append-only audit row 의 insert + audit query 경로(ADR-0022 Decision §3 append-only, §4 query path)를 제공한다.

## Required Reading

- `docs/decisions/ADR-0022-permission-denied-record-data-model.md` — 데이터 모델·영속화 결정 단일 source. 특히 Decision §1(필드: provider/instanceRef/resourceRef/principal/httpStatus/reason/createdAt, updatedAt 미정의), §3(append-only·dedup 미적용·영구 보존), §4(query path: instance×기간 / provider×status×기간), §5(standalone·relation 부재). repository·service 가 이를 mirror.
- `prisma/schema.prisma` — 본 slice 가 wrapping 할 `PermissionDeniedRecord` model(L428~440: 8 필드, `@@index` 2종, `@@unique`/relation/`updatedAt` 미정의)의 실 정의.
- `src/llm/llm-provider-config.repository.ts` — **mirror 대상 repository**(다중 row·`@unique` 미정의 → P2002 분기 부재 패턴이 PermissionDeniedRecord 와 동형). PrismaService delegate 1:1 forward, null-safe findById, P2025 propagate 컨벤션.
- `src/llm/llm-provider-config.service.ts` — **mirror 대상 service**(repository forward + `getPrismaErrorCode` duck-typing). 단 본 record 는 secret redaction 불요(token 평문 컬럼 자체가 schema 에 없음, ADR-0022 §1) — sanitize/cipher 부분은 제외하고 read/write forward 골격만 차용.
- `src/llm/llm-provider-config.repository.spec.ts` — **colocated spec mirror**(PrismaService delegate 를 jest mock 으로 대체, fixture builder, R-112 4 카테고리 구성). 본 slice 의 spec 위치도 colocated(아래 명시).
- `src/persistence/prisma.service.ts` — repository 가 주입받는 PrismaService(delegate `permissionDeniedRecord` 접근). `@Global()` PersistenceModule 이 application-wide export 하므로 본 slice 의 module 은 PersistenceModule 을 imports 에 명시 불요.

## Acceptance Criteria

코드 위치(파일 경로 colocated ordering — CLAUDE.md R-112 hint):

- [ ] `src/permission-denied/permission-denied-record.repository.ts` 신설 — `PermissionDeniedRecordRepository`. PrismaService 의 `permissionDeniedRecord` delegate 를 얇게 wrapping. 최소 메서드:
  - `create(input)` — 1 row insert(append-only, ADR-0022 §3). input shape 는 user-settable 컬럼(provider/instanceRef/resourceRef/principal?/httpStatus/reason?)만 — id/createdAt 은 schema `@default` 가 cover. `@@unique` 부재라 P2002 catch 0(raw forward).
  - `findMany(filter?)` — audit 조회. ADR-0022 §4 query path 정합 — 최소 `createdAt` desc 정렬 + (선택) `instanceRef` / `provider` / `httpStatus` 필터 인자(부재 시 전체). LlmProviderConfigRepository.findMany 패턴 mirror하되 정렬/필터만 추가. delegate reject 는 swallow 없이 propagate.
- [ ] `src/permission-denied/permission-denied-record.service.ts` 신설 — `PermissionDeniedRecordService`. repository forward application service. 최소 메서드:
  - `record(event)` 또는 `create(input)` — 거부 1 건을 영속(repository.create forward). ADR-0022 §1 상 `reason` 이 nullable 이고 이벤트에 reason 문자열이 없으므로, service 가 `httpStatus` 로부터 reason 을 도출(예: 401/403 → "permission-denied", 권한 비가시 404 → "not-found-or-hidden")하거나 호출자 제공값 우선하는 분기를 둔다(ADR-0022 §1 reason 도출 책임 = service-layer).
  - `list(query?)` — audit 조회 forward(repository.findMany). 빈 결과(0 row)는 404 변환 없이 빈 배열 반환(컬렉션 조회 정상 결과 — LlmProviderConfigService.findAll 정합).
- [ ] **Happy-path unit test**: 추가된 모든 public symbol(repository.create / repository.findMany / service.record(create) / service.list)에 happy-path test 1+ — 올바른 delegate 인자 호출 + return propagate 검증.
- [ ] **Error path unit test**: 각 symbol 의 error path 1+ — repository.create / findMany 가 PrismaService reject(DB 장애) 시 swallow 없이 propagate; service.record / list 가 repository reject 를 그대로 전파(404 등으로 잘못 변환 안 함).
- [ ] **Flow / branch coverage**: 분기마다 test branch 분리 — service.record 의 reason 도출 분기(401/403 → "permission-denied" / 404 → "not-found-or-hidden" / 호출자 reason 제공 시 우선), repository.findMany 의 filter 제공 vs 미제공 분기, service.list 의 빈 배열 vs 비-빈 배열 분기 각 1+.
- [ ] **Negative cases 충분 cover**(예외 상황 분기마다 ≥1) — (a) findMany 가 빈 배열 반환(등록 0)도 정상 동작, (b) create 에 principal/reason 부재(nullable) input 도 raw forward, (c) repository reject(의존성 실패) propagate, (d) 미지원/비정상 httpStatus(예: emit 대상 아닌 200/500)가 reason 도출 분기에서 안전 처리(null 또는 fallback — service 가 crash 안 함), (e) service.list 의 비정상 filter 인자(빈 객체) raw forward. 단일 negative 만 작성 금지 — 위 각 1+.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — colocated spec 가 repository + service 의 모든 public 메서드·분기 cover.
- [ ] spec 위치(colocated): `src/permission-denied/permission-denied-record.repository.spec.ts` + `src/permission-denied/permission-denied-record.service.spec.ts`. 각 spec 는 PrismaService 의 `permissionDeniedRecord` delegate 를 jest mock 으로 대체(LlmProviderConfigRepository spec 의 `buildPrismaMock` 패턴 mirror) — PostgreSQL container 불요. 2 spec 가 공유하는 fixture(PermissionDeniedRecord row builder)가 누적되면 helper fallback 고려(본 slice 는 colocated inline 우선, 외화는 Follow-up).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 실행 결과 확인 — R-110).

## Out of Scope

- 영속화 emitter wiring(`NO_OP_PERMISSION_DENIED_EMITTER` → `PrismaPermissionDeniedEmitter` 교체 + GithubModule/ConfluenceModule 주입, ADR-0022 §6) — 다음 slice. 본 slice 는 repository + service 의 영속 primitive 만 제공하고 adapter 와 결선하지 않는다.
- adapter 통합(github-adapter.service.ts / confluence-adapter.service.ts 변경) — 다음 slice. adapter 코드 변경 0.
- HTTP endpoint / controller(audit 조회 REST endpoint + RBAC) — 후속 별도 slice.
- retention pruning / TTL job(ADR-0022 §3 영구 보존 — TTL 미도입) — 도입 안 함.
- NestJS module 파일 신설(`PermissionDeniedRecordModule`) 및 `app.module.ts` 등록 — emitter wiring slice 와 함께 처리(그 slice 가 module 을 GithubModule/ConfluenceModule 에 import). 본 slice 는 repository + service class + colocated spec 2 개(총 4 파일)로 cap 보호. (만약 build/DI 검증을 위해 module 등록이 필요하다고 implementer 가 판단하면 5 파일 cap 안에서 module 1 개까지만 추가 가능 — app.module 등록은 다음 slice 로 미룬다.)
- principal 식별 보강(이벤트 shape 확장 + ServiceIdentity FK) — ADR-0022 Alternatives §(c), 별도 ADR 후속.

## Suggested Sub-agents

`implementer → tester` (ADR-0022 가 설계를 이미 박제 — 신규 architecture 결정 없음, architect 불요).

## Follow-ups

- **다음 slice — 영속화 emitter wiring**: `PrismaPermissionDeniedEmitter`(`PermissionDeniedEmitter` port 구현, ADR-0022 §6) 신설 + `PermissionDeniedRecordModule` 신설 + GithubModule/ConfluenceModule 에서 `NO_OP_PERMISSION_DENIED_EMITTER` → 실 emitter 교체 주입 + adapter 별 이벤트 shape(`host`/`baseUrl`) → `instanceRef` 정규화 매핑. R-112 4종.
- **후속 slice — adapter 통합**: 실 emitter 가 주입된 GithubModule/ConfluenceModule wiring 의 end-to-end(권한 거부 → emit → 1 row insert) round-trip smoke(실 PostgreSQL, db-truncate afterEach 격리 — `PermissionDeniedRecord` 는 이미 TRUNCATE_TABLES 에 등록됨).
- **후속 slice — audit 조회 endpoint**: GET audit endpoint + RBAC(REQ-016 user/admin audience 분리 view).
- **residual nit(pre-existing)**: `test/helpers/db-truncate.spec.ts` L7 docstring 이 "5 테이블 substring 검증" 으로 stale(현재 TRUNCATE_TABLES 는 7 테이블 — Person/ServiceIdentity/Group/Part/PersonGroupMembership/User/PermissionDeniedRecord). 본 slice 는 `test/helpers/` 를 건드리지 않으므로 sweep 하지 않는다 — 별도 doc-sweep slice 또는 db-truncate 를 만지는 다음 slice 에서 한 줄 정정.
