---
id: T-0561
title: 좌표 → resolved person 변환 ResolvePersonFn 순수 factory (personId lookup callable 주입 + null→failed 흡수용 Error)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-21
hqOrigin: Q-0045
independentStream: unevaluated-fill-run
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/build-resolve-person-fn.ts
  - src/assessment-evaluation/dto/build-resolve-person-fn.spec.ts
plannerNote: "P5 bullet 106 / R-64 — Q-0045 옵션1 run-side chain slice(1') orchestrator 의 person-해석 순수 부분. personId lookup callable 주입 → ResolvePersonFn(T-0560 인자) 조립. DB/@Injectable/module 은 후속. mock-unit, live-LLM 게이트 무관."
---

# T-0561 — 좌표 → resolved person 변환 ResolvePersonFn 순수 factory (lookup callable 주입)

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 Q-0045 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 재개했다. 직전 T-0560 (merge aba0736, PR #475) 이 좌표 배열 → batch-run 요약 순수 loop driver `runUnevaluatedFillBatch(bridges, resolvePerson, options, persist)` 를 닫았다. 그 driver 는 좌표마다 `person = await resolvePerson(bridge)` 로 person 을 해석하지만, **`resolvePerson` callable 자체의 조립은 호출자 책임** 으로 남겼다 (driver 는 `ResolvePersonFn` 을 인자로 받기만 한다).

backlogNote 의 남은 **slice (1') loop-level @Injectable orchestrator** 는 (a) personId → ServiceIdentity DB 조회로 person 을 해석하고, (b) `generateAndPersist` 를 바인딩하고, (c) `runUnevaluatedFillBatch` (T-0560) 를 호출하고, (d) module 에 등록한다. 그러나 그 전체를 한 task 로 묶으면 (`@Injectable` service + DB lookup 바인딩 + persist 바인딩 + driver 호출 + module provider + spec) cap (300 LOC / 5 파일) 을 넘고, T-0556..T-0560 가 지킨 "순수 입력→출력 / mock-unit / build-time dependency-free / live-LLM 게이트 무관" 분리 규율 (ADR-0045 standing 게이트) 도 깨진다.

따라서 그 orchestrator 의 **person-해석 조립 부분만** 먼저 순수 factory 로 박제한다. 본 task 는 `findByIdWithIdentities`-shape lookup callable (좌표 → person row 또는 null 을 돌려주는 callable) 을 받아, T-0560 driver 가 소비하는 `ResolvePersonFn` (= `(bridge: PeriodBridgeDto) => Promise<PeriodBridgePersonInput>`) 을 조립해 반환하는 순수 factory `buildResolvePersonFn(lookup)` 를 추가한다. 반환 resolver 는 좌표마다 (a) `lookup(bridge.personId)` 로 person row 를 조회하고, (b) row 가 null 이면 한국어 `Error` 를 던지며 (T-0560 driver 가 그 reject 를 좌표 단위 failed outcome 으로 흡수 — 한 좌표의 person 부재가 나머지 좌표를 막지 않음, REQ-037 부분 실패 흡수), (c) row 가 있으면 `{ serviceIdentities: row.serviceIdentities }` 로 narrow 한 `PeriodBridgePersonInput` 을 반환한다.

핵심은 **lookup callable → resolver 변환 + null-row→흡수가능 Error + 타입 narrow** 라는 person-해석 glue 를 단일 source 로 박제하는 것이다 — 후속 orchestrator slice 는 좌표마다 lookup + null 검사 + narrow 를 inline 재구현 (null→throw 정책 분산 / serviceIdentities narrow 누락 risk) 하는 대신 본 factory 1 회 호출로 `ResolvePersonFn` 을 얻어 T-0560 driver 에 바로 넘긴다 (`runUnevaluatedFillBatch(bridges, buildResolvePersonFn(lookup), options, persist)`).

**build-time dependency-free 보장**: 본 factory 는 `@Injectable` 이 아니며 `PersonService` / `PersonRepository` / `PrismaService` 인스턴스를 import 하지 않는다. DB 조회를 **lookup callable 인자** 로 받으므로 (personId → person row) DB/DI/module 등록은 전부 호출자 책임으로 남고, 본 factory 의 빌드/unit 은 mock lookup callable 로 완결된다 — lookup 이 내부적으로 DB 를 쓰더라도 본 factory 의 unit test 는 mock callable 라 DB 네트워크 0 이다. live-LLM standing 게이트 (ADR-0045) 와 무관하다.

기존 타입 (`PeriodBridgeDto`, `PeriodBridgePersonInput`, `PersonWithIdentities`) + T-0560 의 `ResolvePersonFn` 타입만 재사용하며 새 persistence/REQ-032/auth/dependency 경계를 도입하지 않으므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다.

## Required Reading

- `docs/tasks/T-0560-run-unevaluated-fill-batch-driver.md` — 직전 loop driver slice 의 책임/방어/colocated spec 패턴 + 그 §Out of Scope 가 본 task (person 해석 조립) 로 넘긴 "person 해석 실배선 / resolvePerson callable 조립" 책임 명시. 본 factory 가 돌려주는 resolver 가 그 driver 의 `resolvePerson` 인자로 들어간다.
- `src/assessment-evaluation/dto/run-unevaluated-fill-batch.ts` (89–91행 부근 `ResolvePersonFn` 타입 + 188–207행 resolver reject 흡수) — 본 factory 가 조립할 `ResolvePersonFn` 타입을 `import type` 재사용 (새 타입 발명 0). driver 가 `resolvePerson` reject 를 좌표 단위 failed outcome 으로 흡수하므로, 본 resolver 는 null-row 시 throw 해도 batch 가 abort 하지 않는다 — 이 흡수 계약을 전제로 throw 정책을 고정한다.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` (49–57행) — 반환 타입 `PeriodBridgePersonInput` (`serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[]`). 본 factory 의 resolver 는 person row 를 이 shape 로 narrow 해 반환한다 (`import type` 재사용).
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 좌표 `PeriodBridgeDto` 의 `personId` 축 (resolver 가 lookup key 로 사용). 좌표를 변형하지 않는다 (`import type`).
- `src/user/person.repository.ts` (30–88행) — lookup callable 의 반환 타입 `PersonWithIdentities` (`Prisma.PersonGetPayload<{ include: { serviceIdentities: true } }>`) 와 `findByIdWithIdentities(id): Promise<PersonWithIdentities | null>` 시그니처 (lookup callable shape 의 출처 — row 부재 시 null 반환). 본 factory 는 이 타입을 `import type` 재사용하되 repository **인스턴스** 는 import 하지 않는다 (callable 만 받는다).
- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts` (59–71행 callable-as-param 타입 정의 + 118–154행 factory 구조) — callable-as-param factory 의 방어 (lookup 비-function fail-fast 한국어 `TypeError`) + lazy 평가 + 비변형 + @Injectable 0 패턴 mirror. 본 factory 도 동형 구조.
- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.spec.ts` — colocated spec 의 happy/error/branch/negative/regression 구조 mirror (async resolver 이므로 async test 형태).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/build-resolve-person-fn.ts` 신설 — `function buildResolvePersonFn(lookup: PersonLookupFn): ResolvePersonFn` export. 여기서 `PersonLookupFn` 은 `(personId: string) => Promise<PersonWithIdentities | null> | (PersonWithIdentities | null)` shape (personId → person row 또는 null 을 돌려주는 callable — 본 파일에 type alias 정의, `findByIdWithIdentities` 시그니처 mirror). `ResolvePersonFn` 은 T-0560 의 export 타입을 `import type` 재사용 (새 타입 발명 0).
  - 반환 resolver 는 좌표 1 개를 받아 순서대로: (a) `row = await lookup(bridge.personId)` 로 person row 조회 (lookup 이 동기/Promise 어느 쪽이든 `await` 로 수렴), (b) row 가 null/undefined 면 personId 를 포함한 한국어 `Error` 를 던진다 (T-0560 driver 가 좌표 단위 failed outcome 으로 흡수 — `reason` 에 그 message 가 담김), (c) row 가 있으면 `{ serviceIdentities: row.serviceIdentities }` 로 narrow 한 `PeriodBridgePersonInput` 을 반환한다.
  - factory 자체는 **인자 조립만** 하고 `lookup` 을 호출하지 않는다 (호출은 반환된 resolver 가 좌표마다 await 될 때 — lazy). factory 호출만으로는 lookup 부수효과 0.
  - 입력 `bridge` 객체·`lookup` 반환 row 를 mutate 하지 않는다 (반환 `PeriodBridgePersonInput` 은 새 객체).
  - `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository **인스턴스** import 0 — 위 타입들만 `import type`, value import 0 (새 외부 dependency 0).
  - 방어 (fail-fast 한국어 `TypeError` — factory 조립 시점): `lookup` 이 함수가 아님 (null/undefined/비-function) → `TypeError` (resolver 가 호출 불가능한 값을 캡슐화하지 않도록 조립 전 차단). resolver 호출 시점의 `bridge` 가 null/undefined 면 `bridge.personId` 접근 전 한국어 `TypeError` (인덱스 없이 좌표 null 메시지).
- [ ] happy-path unit test: (a) lookup 이 serviceIdentities 를 포함한 row 를 반환 → resolver 가 `{ serviceIdentities: [...] }` (그 row 의 serviceIdentities echo) 를 반환 1+; (b) resolver 가 `bridge.personId` 를 정확히 lookup 인자로 1 회 전달 1+; (c) factory 가 lookup 을 즉시 호출하지 않음 (factory 호출 직후 lookup mock call count 0) 1+.
- [ ] error path unit test: `lookup` 이 함수가 아닐 때 (null/undefined/비-function) factory 가 한국어 `TypeError` fail-fast 1+; lookup 이 null/undefined 를 반환할 때 (person row 부재) resolver 가 personId 를 포함한 한국어 `Error` 를 던짐 1+; resolver 호출 시 `bridge` 가 null/undefined 면 한국어 `TypeError` 1+; lookup 자체가 reject 할 때 그 reject 가 resolver 밖으로 전파됨 (driver 가 흡수하도록 — 재포장 없이 또는 명세대로 일관) 1+.
- [ ] flow / branch coverage: factory 방어 분기 (lookup 비-function) 1+; resolver 분기 (bridge null / lookup null-row → Error / lookup row 있음 → narrow 반환) 각 1+ test.
- [ ] negative cases 충분 cover: 비-function lookup (null/undefined/숫자/문자열 각각), lookup null-row 반환 (person 부재), lookup undefined 반환, resolver bridge null/undefined, lookup reject 전파, serviceIdentities 가 빈 배열인 row (narrow 는 성공 — 빈 배열 echo, person 존재하나 식별자 0 은 상위 평가 단계 책임이지 resolver 거부 사유 아님), 입력 비변형 (resolver 호출 후 bridge 객체·lookup 반환 row 의 serviceIdentities 배열 참조/길이 unchanged 단언), 반환 객체가 row 와 별개 객체임 단언 — 예외/경계마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] regression test (hqOrigin Q-0045): person 부재 (lookup null-row) 좌표가 resolver 단계에서 throw 하되, 그 throw 가 T-0560 driver 의 좌표 단위 failed 흡수 계약과 호환됨을 보장하는 test 1+ — 즉 resolver 가 throw 하는 값이 `Error` 인스턴스이고 message 에 personId 가 담겨 driver 의 `reason` 으로 직렬화 가능함을 단언 (driver 흡수가 깨지면 fail). narrow 가 serviceIdentities 외 필드 (id/fullName/email 등) 를 누설하지 않음을 단언하는 test 1+ (`PeriodBridgePersonInput` 계약 무결성 — 과잉 노출 회귀 방지).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/build-resolve-person-fn.spec.ts` (factory 와 같은 디렉토리). describe/it 라벨 한국어 명확화 (§12). `lookup` 은 jest mock 함수 (`jest.fn().mockResolvedValue(...)` / `.mockResolvedValue(null)` / `.mockRejectedValue(...)`), `person row` 는 plain 객체 stub (실 PersonRepository/Prisma/DB 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표).

## Out of Scope

- DB 조회 실배선 (`PersonService.findByIdWithIdentities` / `PersonRepository` / `PrismaService` 호출) — 본 factory 는 `lookup` callable 을 받기만 한다. lookup 의 DB 바인딩은 후속 orchestrator slice 책임.
- `@Injectable` service 화 / DI 등록 / module provider 등록 — 본 factory 는 순수 함수 (callable-as-param). service 화/등록은 후속 orchestrator slice.
- self-only RBAC (personId 동등성) / Admin 임의 personId 허용 — 본 resolver 는 personId 로 lookup 만 한다. RBAC 강제는 후속 controller/guard slice.
- `generateAndPersist` 바인딩 / `runUnevaluatedFillBatch` (T-0560) 호출 / dedup 입력 결합 — 후속 orchestrator slice. 본 task 는 driver 의 `resolvePerson` 인자만 조립한다.
- person row 부재 시의 HTTP status 매핑 (404 NotFound 등) — 본 resolver 는 한국어 `Error` 를 던질 뿐 HTTP 변환은 안 한다. driver 가 좌표 failed 로 흡수하므로 batch 는 abort 하지 않는다 (개별 좌표 404 가 아니라 좌표 outcome 의 failed reason). 전체 batch 의 HTTP status 는 후속 controller slice.
- POST /unevaluated-fill-run controller route / run-request DTO — 후속 slice.
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice (live-LLM 배선검증은 ADR-0045 standing 게이트, LAN 수동 1 회, 만료 2026-06-30). 본 task 의 빌드/unit 은 mock callable 라 DB/LLM 0.
- `EvaluationResult` 타입 직접 import / 평가문 본문 보유 (REQ-032 raw-not-stored 정합) — 0. 본 factory 는 좌표 → person 변환만 다룬다.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append.)

남은 chain slice (참고 — 본 task 완료 후 planner 가 순차 큐잉):
1. loop-level impure orchestrator (`@Injectable` service): `buildResolvePersonFn` (T-0561) 에 실 `PersonService.findByIdWithIdentities` 바인딩 + `generateAndPersist` 바인딩 + 본 driver(T-0560) 호출 + dedup 입력 결합 + module 등록. (live-LLM 배선검증 동반 가능 — 단 빌드/unit 은 mock.)
2. POST /unevaluated-fill-run controller route + RBAC + run-request DTO.
3. e2e (실 PostgreSQL; LLM 은 mock 또는 LAN 수동 1 회 배선검증).
