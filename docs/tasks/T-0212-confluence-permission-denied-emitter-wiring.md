---
id: T-0212
title: Confluence adapter 권한 거부 영속화 emitter wiring (ADR-0022 chain row3, Confluence 측)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-016, REQ-029]
estimatedDiff: 170
estimatedFiles: 4
created: 2026-06-04
plannerNote: P4 milestone-3 PermissionDeniedRecord chain — Confluence emitter wiring(T-0211 GitHub mirror). ADR-0022 §1/§6 박제로 architect 불요, §5 미발화.
---

# T-0212 — Confluence adapter 권한 거부 영속화 emitter wiring

## Why

T-0211(PR #185)이 GitHub adapter 의 401/403 `PermissionDeniedEvent` 를 `PermissionDeniedRecordService.record` 로 영속화하는 emitter wiring 을 완결했다. 본 task 는 그 패턴을 **Confluence adapter 측에 mirror** 해 "두 adapter 모두 권한 거부를 실 DB 영속화" 라는 ADR-0022 chain row3 의 목표를 마무리한다. REQ-044(권한 거부 가시화의 audit 영속화 측) 를 Confluence instance 까지 확장한다. 설계는 [ADR-0022](../decisions/ADR-0022-permission-denied-record-data-model.md) Decision §1(필드·`instanceRef` 정규화)·§2(emit 시점)·§6(emitter 패턴, adapter 결합도 0)이 이미 박제했으므로 architect 불요.

핵심 비대칭 2 가지 — 본 task 가 반드시 honor:
1. **이벤트 shape** — Confluence `PermissionDeniedEvent` 는 GitHub 의 `host` 대신 **`baseUrl`** 로 instance 를 식별한다(`{ baseUrl, path, status }`, ADR-0018 §2 / ADR-0022 §1). 따라서 영속화 emitter 는 `baseUrl → instanceRef`, `path → resourceRef`, `provider:"confluence"` 로 정규화한다(GitHub 의 `host → instanceRef` 와 동일 record 컬럼, 다른 source 필드).
2. **DI 주입 방식** — GitHub adapter 는 `@Inject(PERMISSION_DENIED_EMITTER)` string token 으로 emitter 를 주입받는다([github-adapter.service.ts](../../src/github/github-adapter.service.ts) L227~250). 그러나 **Confluence adapter 는 emitter 를 token 없이 positional `@Optional()` 생성자 param(index 1)** 으로 받는다([confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) L287~291). NestJS 는 token 없는 positional param 에 class instance 를 주입할 수 없으므로, 본 task 는 GitHub 과 동형으로 **Confluence 측 DI token 을 도입**(예: `CONFLUENCE_PERMISSION_DENIED_EMITTER` string token + adapter 생성자 param 에 `@Inject`)해 `ConfluenceModule` 이 실 영속화 emitter 를 override 할 수 있게 한다. 이는 ADR-0022 §6 emitter 패턴 안의 wiring 세부일 뿐 새 설계 결정이 아니다(architect 불요).

## Required Reading

- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](../decisions/ADR-0022-permission-denied-record-data-model.md) — Decision §1(`provider`/`instanceRef`/`resourceRef`/`httpStatus` 정규화 + `baseUrl` 비대칭 흡수)·§2(emit 시점)·§6(emitter 패턴 + emit 후 throw 흐름 유지 + 영속화 실패가 adapter 흐름 미파괴)
- [src/permission-denied/persisting-permission-denied-emitter.ts](../../src/permission-denied/persisting-permission-denied-emitter.ts) — T-0211 GitHub emitter 의 **mirror 대상 reference**(fire-and-forget `void recordService.record(...).catch(...)` + warn 로그 swallow). Confluence 판은 이 구조를 그대로 따르되 import 하는 이벤트 타입과 `provider`/source 필드만 다르다
- [src/permission-denied/persisting-permission-denied-emitter.spec.ts](../../src/permission-denied/persisting-permission-denied-emitter.spec.ts) — GitHub emitter 의 colocated spec — Confluence 판 colocated spec(`persisting-confluence-permission-denied-emitter.spec.ts`)이 mirror 할 test 패턴(happy/error/swallow)
- [src/confluence/confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) L215~296·L474~491 — Confluence `PermissionDeniedEvent { baseUrl, path, status }` + `PermissionDeniedEmitter` port + `NO_OP_PERMISSION_DENIED_EMITTER` + 생성자 positional 주입(token 도입 대상)
- [src/confluence/confluence.module.ts](../../src/confluence/confluence.module.ts) — 본 module 에 `PermissionDeniedRecordModule` import + 실 emitter provider/token wiring 을 추가할 대상(github.module.ts L44~67 패턴 mirror)
- [src/github/github.module.ts](../../src/github/github.module.ts) L44~67 — emitter token provide + `PermissionDeniedRecordModule` import 의 **mirror 대상 wiring reference**
- [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts) L34~99 — `record(RecordPermissionDeniedInput)` 입력 shape(`provider`/`instanceRef`/`resourceRef`/`httpStatus` 필수, `reason`/`principal` 생략 가능)

## Acceptance Criteria

- [ ] `src/permission-denied/persisting-confluence-permission-denied-emitter.ts` 신설 — Confluence `PermissionDeniedEmitter` port 를 구현하는 `@Injectable` 실 emitter. `emit({ baseUrl, path, status })` → `void this.recordService.record({ provider: "confluence", instanceRef: baseUrl, resourceRef: path, httpStatus: status }).catch(...)`. T-0211 GitHub emitter 의 fire-and-forget + warn 로그 swallow(ADR-0022 §6.3) 위상을 그대로 mirror — `emit` 동기 void 시그니처 유지, `record` reject 는 `.catch` 로 흡수해 throw 전파 0(unhandled rejection 0). `reason`/`principal` 미매핑(service 위임/null).
- [ ] `ConfluenceAdapter` 의 emitter 주입에 DI token 도입 — `CONFLUENCE_PERMISSION_DENIED_EMITTER` string token 을 colocate 정의하고 생성자 param 을 `@Optional() @Inject(CONFLUENCE_PERMISSION_DENIED_EMITTER)` 로 변경(GitHub `PERMISSION_DENIED_EMITTER` 패턴 mirror). default 는 `NO_OP_PERMISSION_DENIED_EMITTER` 유지 — token 미provide 시 fallback 으로 기존 unit/다른 module 의 regression 0. **`ConfluenceSpaceTraversalService` 의 emitter param 은 본 task 밖**(Follow-up — 별도 emit source, 아래 Out of Scope 참조).
- [ ] `ConfluenceModule` 에 `PermissionDeniedRecordModule` import + `PersistingConfluencePermissionDeniedEmitter` provider 등록 + `{ provide: CONFLUENCE_PERMISSION_DENIED_EMITTER, useClass: PersistingConfluencePermissionDeniedEmitter }` token 바인딩(github.module.ts mirror). `AppModule` 무변경(module 자기충족 wiring) 확인.
- [ ] Happy-path unit test 1+ — `PersistingConfluencePermissionDeniedEmitter.emit` 이 401/403 이벤트를 받아 `recordService.record` 를 `{ provider:"confluence", instanceRef:<baseUrl>, resourceRef:<path>, httpStatus:<status> }` 로 정확히 1 회 호출함을 mock service 로 검증(colocated `persisting-confluence-permission-denied-emitter.spec.ts`).
- [ ] Error path unit test 1+ — `record` 가 reject(DB 장애 mock)해도 `emit` 이 throw 하지 않고(동기 void 반환) reject 를 swallow 하며 경고 로그를 남김을 검증(unhandled rejection 미발생). adapter 의 emit→throw 도메인 error 흐름이 영속화 실패에 영향받지 않음(ADR-0022 §6.3).
- [ ] Flow / branch 분기 cover — emit 의 정규화 매핑(baseUrl→instanceRef 등)은 분기 없음이나, `record` resolve 경로 vs reject 경로 2 분기를 각각 test. ConfluenceAdapter 의 token 주입은 분기 추가 없음(default fallback 동작은 기존 confluence-adapter.service.spec.ts 가 cover — token 미주입 시 no-op default 유지 regression 0 을 1 test 로 확인).
- [ ] Negative cases 충분 cover — (a) `record` reject swallow(위), (b) 비-401/403 status(예: 404/429)가 emit 으로 흘러와도 emitter 는 받은 값을 그대로 정규화 forward 하고 crash 하지 않음(emit 경계 판정은 adapter 책임, emitter 는 방어적 forward), (c) `record` 가 동기적으로 throw(Promise 가 아닌 즉시 예외) 하는 비정상 mock 에서도 `emit` 이 throw 를 전파하지 않음 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80% — `coverageThreshold.global` 강제). 신설 emitter + 변경 adapter token wiring 이 coverage floor 미달 유발 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. CI(unit + smoke + e2e + approval-verify) green — tester 가 결과 확인(R-110/R-113).

## Out of Scope

- **조회/read HTTP endpoint(GET audit list)** — ADR-0022 chain 후속 별도 slice. RBAC(누가 audit 을 읽을 수 있는가) 결정이 §5 보안 게이트라 사람 결정 필요 — 본 task 에서 다루지 않음.
- **`ConfluenceSpaceTraversalService` 의 emitter wiring** — traversal service 도 `@Optional()` `PermissionDeniedEmitter` 를 받지만(confluence.module.ts L65~68 no-op default), 본 task 는 **ConfluenceAdapter** 의 emit source 만 실 영속화로 결선한다. traversal service emit source 의 wiring 은 Follow-up(별도 emit 경로 — 본 task cap 보호).
- **GitHub 측 재변경** — T-0211 에서 완결, 본 task 무관.
- **principal 식별 보강** — 이벤트 shape 에 호출 principal 추가는 별도 ADR(ADR-0022 Alternatives §(c)). `principal` 은 현 단계 null 유지.
- **retention / TTL pruning job** — ADR-0022 §3 영구 보존. 도입 안 함.
- **`prisma/schema.prisma` 변경 / migration** — record entity 는 이미 존재(T-0208). 본 task 는 wiring 만.

## Suggested Sub-agents

`implementer → tester`

(architect 불요 — ADR-0022 §1/§6 가 데이터 모델·emitter 패턴·`baseUrl→instanceRef` 정규화를 이미 박제. DI token 도입은 GitHub `PERMISSION_DENIED_EMITTER` 패턴의 mechanical mirror 라 새 설계 결정 0.)

## Follow-ups

- (carry, residual nit) `test/helpers/db-truncate.spec.ts` L7 docstring 의 "5 테이블" 표기가 stale(현행 테이블 수 불일치, T-0208 PermissionDeniedRecord 추가 등으로 변동) — pre-existing nit. 본 task cap 안에서 닿으면 cleanup, 아니면 별도 doc-fix follow-up.
- `ConfluenceSpaceTraversalService` 의 `PermissionDeniedEmitter` 실 영속화 wiring(본 task Out of Scope) — traversal-level emit source 도 record 영속화로 결선할지 검토.
- 권한 거부 audit 조회 HTTP endpoint + RBAC(§5 게이트 — 사람 결정 필요) — ADR-0022 chain 후속.
