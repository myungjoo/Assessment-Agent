---
id: T-0211
title: GitHub adapter 권한 거부 영속화 emitter wiring (ADR-0022 chain row 3, GitHub 측만)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-016, REQ-059]
estimatedDiff: 185
estimatedFiles: 5
created: 2026-06-04
plannerNote: P4 ADR-0022 chain row3 emitter wiring — GitHub adapter 의 401/403 emit 을 PermissionDeniedRecordService.record 로 영속화. Confluence 는 follow-up. architect 불요(ADR-0022 §6 박제).
---

# T-0211 — GitHub adapter 권한 거부 영속화 emitter wiring (ADR-0022 chain row 3, GitHub 측만)

## Why

PLAN P4 milestone(PermissionDeniedRecord, Q-0019 승인)의 [ADR-0022](../decisions/ADR-0022-permission-denied-record-data-model.md) 후속 chain **row 3 "영속화 emitter wiring"** 을 진행한다. T-0208(schema+migration) / T-0209(repository+service) / T-0210(module DI 등록)으로 `PermissionDeniedRecordService.record(event)` 가 DI 로 inject 가능해졌으나, GitHub/Confluence adapter 가 401/403 시 흘려보내는 `PermissionDeniedEvent` 는 여전히 `NO_OP_PERMISSION_DENIED_EMITTER` 로 swallow 된다(영속화 0). 본 task 는 ADR-0022 §6 의 **event-emitter 패턴** 대로 실 영속화 emitter 를 신설해 **GitHub adapter 한 곳** 의 권한 거부 이벤트를 record 로 영속화한다 — REQ-044(권한 부족 가시화)의 audit trail 영속화 측. Confluence 측은 동형이되 이벤트 shape(`baseUrl`)이 비대칭이라 별도 follow-up 으로 분리(cap 보호).

## Required Reading

- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](../decisions/ADR-0022-permission-denied-record-data-model.md) — 특히 **Decision §1**(`instanceRef`/`resourceRef`/`httpStatus` 정규화 + `provider` discriminator + `principal` nullable + token 평문 미저장 invariant), **Decision §6**(emitter 패턴 = `PermissionDeniedEmitter` port 의 실 구현체로 영속화, adapter 결합도 0 보존, emit 후 도메인 error throw 유지, **§6.3 DB-write 실패 시 adapter 흐름 미파괴 = 본 구현 task 책임**)
- `src/github/github-adapter.service.ts` L198~238(`PermissionDeniedEvent { host, path, status }` shape + `PermissionDeniedEmitter` port + `NO_OP_PERMISSION_DENIED_EMITTER` + `@Optional()` 생성자 주입 emitter param) 및 L394~415(`mapNon2xx` 의 401/403 → `permissionDeniedEmitter.emit({ host, path, status })` 호출 site)
- `src/permission-denied/permission-denied-record.service.ts` — `PermissionDeniedRecordService.record(event: RecordPermissionDeniedInput)` 의 입력 shape(`provider`/`instanceRef`/`resourceRef`/`principal?`/`httpStatus`/`reason?`) + reason 도출 위임 정합
- `src/permission-denied/permission-denied-record.module.ts` — `PermissionDeniedRecordService` 가 `exports` 되어 다른 module 에서 inject 가능함(본 wiring 이 `PermissionDeniedRecordModule` 을 import 해야 함)
- `src/github/github.module.ts` — GithubModule 의 현 providers/exports(GithubAdapter 등). 본 task 가 emitter provider + token + `PermissionDeniedRecordModule` import 를 추가할 대상
- `src/github/github-adapter.service.spec.ts` — adapter 의 mock emitter 단위 테스트 패턴(emitter param 변경 시 영향 범위 확인용, 최소 read)

## Acceptance Criteria

- [ ] ADR-0022 §6 의 emitter 패턴대로 **실 영속화 emitter**(예: `PrismaPermissionDeniedEmitter` 또는 `PersistingPermissionDeniedEmitter`)를 `src/permission-denied/` 에 신설. `PermissionDeniedRecordService` 를 생성자 주입받아 `emit(event)` 에서 GitHub 이벤트의 `{ host, path, status }` 를 `record({ provider: "github", instanceRef: host, resourceRef: path, httpStatus: status })` 로 매핑(ADR-0022 §1 — `host`→`instanceRef`, `path`→`resourceRef` 정규화; `provider` discriminator = `"github"`; `principal`/`reason` 은 service 가 도출/null).
- [ ] emitter port 는 `emit(event): void`(동기 fire-and-forget)인데 `service.record(...)` 는 async(Promise) — **ADR-0022 §6.3 박제대로 영속화 실패(DB 장애 등)가 adapter 제어 흐름을 깨지 않도록** fire-and-forget + reject 흡수(예: `.catch(...)` 로 swallow 후 로깅 자리만, throw 전파 금지)로 구현. 이 위상은 ADR-0022 §6.3 이 본 구현 task 에 위임한 결정 범위 내(새 설계 결정 아님 — architect 불요).
- [ ] GitHub adapter 가 DI 로 실 emitter 를 주입받을 수 있도록 wiring — 현재 emitter 생성자 param 은 `@Optional()` 함수형 default(no-op)이라 DI token 이 없다. **emitter DI token**(예: `PERMISSION_DENIED_EMITTER` / `GITHUB_PERMISSION_DENIED_EMITTER`)을 도입하고 GithubAdapter 생성자 emitter param 을 `@Optional() @Inject(TOKEN)` 으로 바꿔 module 이 override 가능하게 한다. token 미주입(unit/other module) 시 기존 no-op default 동작이 **그대로 유지**되어야 한다(regression 0).
- [ ] `GithubModule` 이 `PermissionDeniedRecordModule` 을 `imports` 하고, emitter token 에 실 emitter 를 `provide`(useClass/useFactory)하도록 wiring. `app.module.ts` 등 상위 등록은 변경 불요(GithubModule 내부 wiring 으로 자기충족).
- [ ] **Happy-path unit test**: 신설 emitter 의 `emit({ host, path, status })` 가 `record(...)` 를 1 회, `provider:"github"` + `instanceRef===host` + `resourceRef===path` + `httpStatus===status` 로 호출함을 mock service 로 검증(1+). GithubAdapter 가 token 으로 실 emitter 주입 시 401/403 경로가 그 emitter 를 호출함을 검증하는 happy-path 1+(adapter spec 또는 module DI resolve spec).
- [ ] **Error path unit test**: `record(...)` 가 reject(DB 장애 모사)할 때 emitter 가 그 reject 를 **흡수**하고 throw 하지 않으며 adapter 흐름(도메인 error throw)이 정상 유지됨을 검증(1+). 의존성 실패(service 주입 부재/호출 실패) 경로 1+.
- [ ] **Flow / branch coverage**: emitter 매핑 분기(예: reason 도출은 service 위임이므로 emitter 측 분기 최소 — 분기 발생 시 각 분기 1+ test). adapter emitter param 의 token 주입 vs no-op default 두 분기 각 1+.
- [ ] **Negative cases 충분 cover**(각 1+): (a) 권한 거부 아닌 status(예: 404 단순 not-found / 429 / 5xx / 2xx)에서는 emitter.emit 이 **호출되지 않아 record 미생성**(ADR-0022 §2 emit 경계 정합), (b) DB write 실패(record reject) 시 adapter 가 crash 하지 않고 도메인 error 만 throw, (c) token 평문이 emit payload / record 입력 어디에도 포함되지 않음(host/path/status 만 — ADR-0022 §1 invariant), (d) emitter token 미주입 시 no-op default 로 안전 통과.
- [ ] colocated spec 위치: 신설 emitter 의 spec 은 `src/permission-denied/<emitter-file>.spec.ts`(colocated). GithubModule DI resolve 검증이 필요하면 `src/github/github.module.spec.ts`(colocated, 신설 또는 기존) 에 추가. 공유 mock 은 기존 패턴 재사용.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- **Confluence adapter 측 emitter wiring** — Confluence 이벤트 shape 는 `{ baseUrl, path, status }` 로 비대칭(`host` 대신 `baseUrl`→`instanceRef`)이라 별도 매핑 + 별도 module wiring 이 필요. cap(300 LOC / 5 파일) 보호 + 별도 관심사라 **follow-up task 로 분리**(GitHub 머지 후).
- **audit 조회 HTTP endpoint / controller / RBAC** — ADR-0022 chain 후속 별도 slice. 본 task 는 영속화(write) 경로만.
- **principal 식별 보강** — 이벤트 shape 에 호출 principal 추가 + `serviceIdentityId` FK 는 별도 ADR(ADR-0022 Alternatives §(c)). 본 task 는 `principal` 을 null 로 둔다.
- **retention / TTL job** — ADR-0022 §3 영구 보존. 도입 안 함.
- **prisma schema / migration 변경** — T-0208 에서 완료. 본 task 는 schema 무변경(emitter wiring 만).
- **ConfluenceSpaceTraversalService 등 다른 emit 주입점** — GitHub adapter 의 mapNon2xx emit site 한 곳만 영속화 결선.

## Suggested Sub-agents

`implementer → tester`

(architect 불요 — ADR-0022 §6 이 emitter 패턴 / `host`→`instanceRef` 정규화 / emit 후 도메인 error throw 유지를 박제했고, §6.3 이 "fire-and-forget + DB-write 실패 흡수" 위상을 본 구현 task 에 명시적으로 위임했다. 새 설계 결정 0.)

## Follow-ups

- (residual nit, 미해결 carry) `test/helpers/db-truncate.spec.ts` L7 docstring "5 테이블 substring 검증" 이 stale(실 테이블 수와 불일치 가능성) — pre-existing nit, 본 task 와 무관하나 다음 관련 PR 에서 cap 내 정리 후보.
- Confluence adapter 권한 거부 영속화 emitter wiring(이벤트 shape `{ baseUrl, path, status }` → `instanceRef:baseUrl` / `provider:"confluence"` 정규화 + ConfluenceModule import + token 주입). 본 GitHub slice 머지 후 동형 패턴으로 진행.
- ConfluenceSpaceTraversalService 의 권한 거부 emit 주입점(있다면)도 동일 emitter 로 결선 검토.
