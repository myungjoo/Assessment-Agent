---
id: ADR-0022
title: PermissionDeniedRecord 데이터 모델·영속화 설계 — 권한 거부 이벤트의 audit 영속화 entity (필드 / 영속화 시점 / retention·idempotency / query·index / relation / 이벤트→영속화 흐름)
status: ACCEPTED (2026-06-04)
date: 2026-06-04
relatedTask: T-0207
supersedes: null
---

# ADR-0022 — PermissionDeniedRecord 데이터 모델·영속화 설계 박제

> P4 의 GitHub / Confluence adapter 가 non-2xx(401/403/권한 비가시 404) 시 emit 하는 in-memory `PermissionDeniedEvent` 를 **영속화하는 entity 의 데이터 모델 + 영속화 설계** 를, [ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md)(T-0203) 가 live-test 계약을 코드보다 먼저 박제한 ADR-first 패턴을 mirror 해 **단일 ADR-0022 로 선행 박제**한다. 본 ADR 은 데이터 모델·영속화 **결정** 만 기술하며 production code / prisma schema model / migration 0 — `PermissionDeniedRecord` prisma model + migration / repository / service / wiring / R-112 test 는 후속 task 가 본 ADR 을 단일 source 로 mirror 한다.

## Context

P4 의 GitHub / Confluence adapter 는 권한 거부(401 / 403 / 권한 비가시 404) 를 만나면 `PermissionDeniedEvent` 를 `PermissionDeniedEmitter` port 로 흘려보낸다 ([ADR-0016 Decision §4](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 Decision §4](ADR-0018-confluence-adapter-http-transport-contract.md) 의 4xx → PermissionDeniedEvent emit 경계). 그러나 그 이벤트를 **영속화하는 실 entity 는 아직 없다**:

- GitHub 측 ([src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) L198~225) — `PermissionDeniedEvent { host, path, status }` (configured host / REST path / HTTP status). token 평문 절대 미포함([CLAUDE.md §9](../../CLAUDE.md)).
- Confluence 측 ([src/confluence/confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) L215~230) — `PermissionDeniedEvent { baseUrl, path, status }` (풀 REST API base URL / REST path / HTTP status). GitHub 와 **동형이되 `host` 대신 `baseUrl`** 로 식별(Cloud/Server 비대칭 정합, [ADR-0018 Decision §2](ADR-0018-confluence-adapter-http-transport-contract.md)). adapter 간 직접 import 의존을 피해 Confluence 전용 신규 interface 로 자기충족.
- 두 adapter 모두 default 가 `NO_OP_PERMISSION_DENIED_EMITTER` — 현재는 emit 을 **부수효과 없이 swallow** 하고 도메인 error throw 흐름만 유지한다. 영속화 record 는 아직 deferred 상태로, [prisma/schema.prisma](../../prisma/schema.prisma) 헤더(L39~41)가 `PermissionDeniedRecord` 를 명시적으로 후속 task 의 Out of Scope 로 표기했다.

사용자가 [docs/STATE.json](../STATE.json) `humanQuestions[Q-0019]`(session #51)에서 **PermissionDeniedRecord DB migration 을 승인**했다 — [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트 OPEN, 외부 credential 0(CI 실 PostgreSQL 이미 존재, [ADR-0004](ADR-0004-smoke-e2e-db-mode.md)). 그 decision 은 (i) ADR-first 선행 박제, (ii) [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) migrate-deploy 패턴 준수, (iii) 후속 구현 task 의 R-112 4종 + negative cases 충분 cover + regression test 를 제약으로 명시했다.

milestone-3 이 [ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md) 를 live spec 보다 먼저 박제해 (i) reviewer 가 구현 전 계약을 점검하고, (ii) 후속 slice 가 단일 source 를 mirror 한 패턴이 검증됐으므로, PermissionDeniedRecord 도 동형으로 **데이터 모델 + 영속화 설계를 단일 ADR-0022 로 선행 박제**한다. 이렇게 하면 (i) reviewer 가 prisma schema 변경 전에 데이터 모델·영속화 경계를 점검, (ii) 후속 prisma schema + migration / repository / service / wiring / test slice 가 본 ADR 을 mirror, (iii) REQ-044(instance 별 권한 분리·권한 거부 가시화)의 영속화 측 계약이 코드보다 ADR 에 먼저 외화된다.

### REQ 외력

- **REQ-044** ([README.md](../../README.md) L19~22, L33) — instance / SPACE 별 권한 분리 + 권한 부족 가시화. 본 ADR 의 record 가 그 "가시화" 의 영속화 측(audit trail)을 박제한다. adapter 의 in-memory emit 위상([ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §4](ADR-0018-confluence-adapter-http-transport-contract.md))은 휘발성이라 운영자가 "어느 instance 에서 언제 권한이 거부됐는가" 를 사후 조회할 수 없다 — record 가 그 audit 조회를 가능케 한다.
- **REQ-016** ([README.md](../../README.md) L33) — 권한 부족의 user/admin audience 분리. 본 record 가 그 audience 분리 view 의 data source 다(view-time 분리, 본 ADR 은 entity 만).
- **REQ-059 / [ADR-0006](ADR-0006-assessment-data-model.md)** — raw 미저장 invariant. record 는 권한 거부의 **메타**(host / path / status / 시각)만 보유하고 응답 본문 / token 평문은 저장하지 않는다 — Assessment / Contribution 의 raw-transient 정합.
- **REQ-029** ([README.md](../../README.md) L56) — non-volatile 저장. record 는 [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 의 실 PostgreSQL durability path 위에 영속화된다.

### prisma 컨벤션 (본 ADR 이 따를 source)

[prisma/schema.prisma](../../prisma/schema.prisma) 의 기존 6+ model 이 박제한 컨벤션 — 본 record 의 컬럼·index·관계가 이를 따른다:

- **id** — `id String @id @default(cuid())` (전 model 공통).
- **timestamp** — `createdAt DateTime @default(now())`. **immutable entity(Assessment / Contribution / Summary)는 `updatedAt` 미정의**. mutable entity(Person / Group / Part / User / LlmProviderConfig)만 `updatedAt DateTime @updatedAt`.
- **enum-as-String literal** — `ServiceIdentity.service` / `User.role` / `Assessment.period`·`scope`·`difficulty` / `LlmProviderConfig.provider` 가 모두 String literal 박제(Prisma enum 격상은 별도 ADR). 값 invariant 는 service-layer 책임.
- **`@@unique` / `@@index`** — `Assessment.@@unique([personId, period, scope, periodStart])` + `@@index([personId, period, periodStart])` / `Summary.@@index([personId, period, periodStart])` 가 중복 차단 + 시계열 조회 패턴을 박제.

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0022** — `docs/decisions/` 에 ADR-0001 ~ ADR-0021 점유(ADR-0007 만 미신설). ADR-0020(multi-task-fire) 은 본 ADR 작성 시점 이미 ACCEPTED 실재한다 — [ADR-0016 §ADR cross-reference](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0021 §ADR cross-reference](ADR-0021-github-confluence-live-integration-test-contract.md) 의 "ADR-0020 미신설" 표기는 그 ADR 작성 당시 history 로 현재는 stale. 본 ADR 은 다음 free 번호 ADR-0022 를 사용(T-0207 acceptance 의 번호 정합 명시).
- **[ADR-0016](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md)** — 두 adapter 의 4xx → PermissionDeniedEvent emit 위상. 본 ADR 의 record 가 그 이벤트를 수용하는 영속화 측이다. 두 ADR 은 공히 후속 chain 에서 "PermissionDeniedRecord entity" 를 deferred 했고 본 ADR 이 그 entity 의 데이터 모델을 박제한다. 본 ADR 은 transport / emit 위상을 **재결정하지 않는다**(영속화 측 계약만 추가 박제).
- **[ADR-0006](ADR-0006-assessment-data-model.md)** — raw 미저장 invariant + cascade 정책 source. record 의 메타-only 컬럼 + standalone 결정이 이 invariant 와 정합.
- **[ADR-0004](ADR-0004-smoke-e2e-db-mode.md)** — CI 실 PostgreSQL + `prisma migrate deploy`. 후속 migration task 가 따를 절차 source(Decision §6).
- **[ADR-0012](ADR-0012-cross-cutting-field-policy.md)** — UTC 저장 / mutable-only `updatedAt` / createdBy = AuditLog event-stream cross-cutting field 정책. record 의 `createdAt` UTC + `updatedAt` 미정의(immutable) 결정이 이와 정합.

## Decision

본 ADR 은 다음 6 결정을 박제한다. **본 ADR 은 데이터 모델·영속화 설계를 기술하되 prisma schema model / migration / repository / service / wiring / test 코드는 신설/변경하지 않는다(production code 0 LOC + prisma schema 변경 0 — 후속 task 책임).**

### Decision §1 — 필드 (데이터 모델)

`PermissionDeniedRecord` 는 권한 거부 1 건을 박제하는 **append-only audit row** 다. 보유 컬럼 결정:

| 컬럼 | 타입 (prisma) | 결정 / 사유 |
| --- | --- | --- |
| **`id`** | `String @id @default(cuid())` | 전 model 공통 cuid PK 컨벤션. |
| **`provider`** | `String` | 어느 adapter 의 이벤트인지 식별하는 enum-as-String literal — 허용 집합 `"github"` / `"confluence"`. 두 adapter 의 동형 이벤트를 **단일 record** 로 수용하기 위한 discriminator. `ServiceIdentity.service` / `User.role` 의 String-literal 정공법 정합(Prisma enum 격상은 별도 ADR). 값 invariant 는 service-layer 책임. |
| **`instanceRef`** | `String` | 권한이 거부된 instance 식별자 — adapter/host variant. GitHub 는 configured host(예: `github.sec.samsung.net`), Confluence 는 풀 REST API base URL(예: `https://acme.atlassian.net/wiki/rest/api`) 을 담는다. 두 adapter 의 이벤트가 `host`(GitHub) / `baseUrl`(Confluence) 로 비대칭이므로(Decision §5 흐름 참조), 영속화 record 는 **단일 `instanceRef` 컬럼으로 정규화** 한다 — `provider` discriminator 와 함께 읽으면 의미가 명확. token / 자격증명을 base URL 에 절대 포함하지 않는다([§9](../../CLAUDE.md)). |
| **`resourceRef`** | `String` | 권한이 거부된 대상 REST path(예: GitHub `/repos/{owner}/{repo}/commits` / Confluence `/content`). 이벤트의 `path` 를 그대로 수용. 외부 본문이 아닌 **참조 식별자** 라 raw 미저장 invariant 정합([ADR-0006](ADR-0006-assessment-data-model.md) `Contribution.sourceRef` 와 동형 위상). |
| **`principal`** | `String?` (nullable) | 권한 거부의 **주체**(어느 ServiceIdentity / token 으로 호출했는가). **현 이벤트 shape 에는 principal 정보가 없다**(host / path / status 만) — 따라서 본 컬럼은 **nullable 로 박제하되 현 단계에서는 항상 null**. 이유: (i) token 평문은 절대 저장 불가([§9](../../CLAUDE.md)), (ii) 이벤트가 호출 principal 식별자(예: instance key)를 아직 싣지 않음. principal 을 실제로 채우려면 이벤트 shape 확장 + ServiceIdentity relation 이 선행돼야 하므로 **후속 task 의 책임**(Follow-up). nullable 박제로 schema 차원에서 자리만 예약하고 NOT NULL 전환 cost 를 회피(Person.partId nullable 패턴 정합). |
| **`httpStatus`** | `Int` | 거부를 유발한 HTTP status(`401` / `403` / 권한 비가시 `404`). 이벤트의 `status` 를 그대로 수용. status code 이름은 외부 표준이라 영어/숫자 그대로. |
| **`reason`** | `String?` (nullable) | 거부 분류의 사람-친화 reason(예: `"permission-denied"` / `"not-found-or-hidden"`). 이벤트 shape 에 reason 문자열이 없으므로 service-layer 가 `httpStatus` 로부터 도출해 채우거나 null. token 평문 / 응답 본문은 절대 미포함. |
| **`createdAt`** | `DateTime @default(now())` | 권한 거부 발생(= emit) 시각. UTC 저장([ADR-0012](ADR-0012-cross-cutting-field-policy.md)). |

**`updatedAt` 미정의 (immutable)** — record 는 한 번 기록되면 갱신되지 않는 audit row 다(Assessment / Contribution / Summary 의 immutable 패턴 정합, [ADR-0012](ADR-0012-cross-cutting-field-policy.md) mutable-only `updatedAt`). 정정이 필요하면 새 row.

**token 평문·secret 미포함 invariant ([§9](../../CLAUDE.md)) 를 schema 차원에서 박제** — record schema 는 token / Authorization header / 응답 본문을 담는 컬럼을 **정의하지 않는다**. 이벤트가 이미 식별 메타(host / path / status)만 싣고 token 평문을 배제하므로([github-adapter.service.ts](../../src/github/github-adapter.service.ts) L199~201 주석 invariant), record 도 그 invariant 를 schema 차원(컬럼 부재)으로 보장한다 — schema 에 자리가 없으면 저장 자체가 불가([ADR-0006](ADR-0006-assessment-data-model.md) raw 미저장 schema-level 강제와 동형 기법).

### Decision §2 — 무엇을 / 언제 영속화

- **언제** — adapter 가 `PermissionDeniedEvent` 를 **emit 하는 시점에 1 row** 박제한다. emit 경계는 이미 [ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) / [ADR-0018 §4](ADR-0018-confluence-adapter-http-transport-contract.md) 가 박제했다 — `401` / `403`(및 권한 비가시 `404` 후보) catch 시점. 본 record 는 그 emit 경계를 **재정의하지 않고** 그 시점에 영속화를 얹는다.
- **무엇을** — Decision §1 의 메타(`provider` / `instanceRef` / `resourceRef` / `httpStatus` / `createdAt`)를 1 row 로. 이벤트가 싣지 않는 `principal` / `reason` 은 현 단계 null/도출(Decision §1).
- **어느 host/status 집합** — adapter 의 emit 경계와 **정합** 한다. 즉 record 대상은 adapter 가 PermissionDeniedEvent 를 emit 하는 status(`401` / `403` / 권한 비가시 `404`)에 한정한다. `404`(단순 not-found) / `429`(rate-limited) / `5xx`(upstream) / network reject 는 **권한 거부가 아니므로 emit 되지 않고**([ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) 표) record 대상도 아니다 — record 의 의미가 "권한 거부 audit" 로 cohesive 하게 유지된다. Confluence 의 cap-reached partial-collection 이벤트는 별도 port(`PartialCollectionEvent`)라 record 대상 아님.

### Decision §3 — retention / idempotency

- **retention: 영구 보존 (TTL 미도입)** — record 는 audit trail 이므로 **영구 보존** 한다(TTL / 자동 만료 없음). 사유: (i) 권한 거부는 운영자가 "어느 instance 의 권한이 언제부터 누락됐는가" 를 장기 추적해야 하는 보안/운영 audit 성격, (ii) row 1 건이 작아(메타 only) 장기 누적 비용이 낮음, (iii) 기존 entity(Assessment / Contribution / Summary)도 TTL 없이 영구 보존하는 컨벤션 정합. 대량 누적이 실측 부담이 되면 별도 ADR 로 archival / TTL 정책 도입(Alternatives §(b)).
- **idempotency: 매 emit 새 row (append-only, dedup 미적용)** — 동일 `(provider, instanceRef, resourceRef, httpStatus)` 반복 거부는 **매 emit 마다 새 row** 로 박제한다(upsert / dedup 안 함). 사유: (i) audit 는 **발생 횟수·시점 자체가 신호** — 같은 권한 거부가 100 회 반복되면 그 빈도가 "권한이 계속 누락됐다" 는 운영 정보다. dedup 하면 이 신호를 잃는다, (ii) append-only 가 immutable audit 정합(record 는 갱신 안 됨, Decision §1). 따라서 `@@unique` 제약을 **두지 않는다** — 중복 row 를 의도적으로 허용한다(LlmProviderConfig 의 `@@unique` 미정의 = 다중 row 허용 패턴 정합). 빈도 집계가 필요하면 query-time `GROUP BY (instanceRef, httpStatus)` 로 view 계산(별도 aggregate entity 신설 안 함, [ADR-0006](ADR-0006-assessment-data-model.md) view-time 집계 정합).

### Decision §4 — query path / indexing

운영자의 audit 조회 패턴과 그에 대응하는 `@@index` 후보를 박제한다(기존 `Assessment` / `Summary` 의 `@@index` 패턴 정합 — 조회 컬럼 prefix 순서로 composite index):

| 조회 패턴 | 설명 | index 후보 |
| --- | --- | --- |
| **instance × 기간** | "이 instance 에서 최근 거부 이력" — `instanceRef` 로 필터 + `createdAt` 시계열 정렬 | **`@@index([instanceRef, createdAt])`** |
| **provider × status × 기간** | "github 의 403 거부를 기간별로" — audit dashboard 의 status 분류 조회 | **`@@index([provider, httpStatus, createdAt])`** |
| **전역 시계열** | "최근 전체 거부" — `createdAt` 단독 정렬 | 위 두 composite index 의 leading-edge 로 부분 cover 가능하나, 순수 시계열 전역 조회가 빈번하면 `@@index([createdAt])` 추가 후보 |

구체 index 채택(2 개 composite 충분 vs `createdAt` 단독 추가)은 후속 schema task 가 실 조회 빈도로 확정한다 — 본 ADR 은 "instance 별 / provider×status 별 / 시계열 audit 조회 패턴 + 그에 대응하는 composite `@@index` 후보" 의 **설계 결정** 만 박제(Assessment 의 `@@index([personId, period, periodStart])` 시계열 패턴과 동형 — 필터 컬럼 + `createdAt` prefix).

### Decision §5 — 기존 prisma model 과의 관계

- **standalone (독립) entity — relation 부재** — `PermissionDeniedRecord` 는 Person / User / ServiceIdentity 등 기존 model 과 **relation(FK)을 맺지 않는 standalone entity** 로 박제한다. 사유:
  1. **이벤트가 principal 식별자를 싣지 않음** — 현 `PermissionDeniedEvent` 는 host / path / status 만 담아(Decision §1 `principal` nullable 근거) ServiceIdentity / User 로의 FK 를 도출할 데이터가 없다. 없는 relation 을 schema 에 강제하면 매 row 의 FK 가 null 이라 무의미.
  2. **audit 독립성** — audit row 는 참조 대상(예: ServiceIdentity)이 삭제돼도 거부 이력이 보존돼야 한다. relation + cascade 를 두면 참조 대상 삭제 시 audit 가 동반 삭제될 risk — audit trail 의 영구 보존(Decision §3)과 충돌. standalone 이 audit 독립성을 보장한다.
  3. **instance 식별은 문자열 ref 로 충분** — `instanceRef`(host / baseUrl)는 ServiceIdentity.service 의 host 값과 의미상 연관되나, 영속화 record 는 FK 대신 **문자열 ref** 로 자기충족하게 둔다(adapter 가 ServiceIdentity 를 조회하지 않고 emit 하는 현 위상 정합). 향후 principal relation 이 필요하면 후속 ADR 이 `serviceIdentityId String?` nullable FK 를 추가하는 보강(Alternatives §(c)).
- **cascade 정책: 없음** — relation 부재이므로 cascade(`onDelete`) 대상이 없다. standalone entity 라 다른 entity 의 삭제가 record 에 영향을 주지 않는다(audit 독립성 박제).

### Decision §6 — adapter 이벤트 → 영속화 흐름

- **결정: event-emitter 패턴 (`PermissionDeniedEmitter` port 를 영속화 어댑터로 구현)** — `PermissionDeniedEvent` 가 영속화로 흐르는 경로는, adapter 가 service 를 **직접 호출** 하는 대신 **기존 `PermissionDeniedEmitter` port 의 실 구현체** 로 영속화를 얹는다. 즉 후속 task 가 `NO_OP_PERMISSION_DENIED_EMITTER` 를 **영속화 emitter**(예: `PrismaPermissionDeniedEmitter` — `emit(event)` → repository 호출 → 1 row insert)로 교체하고, GithubModule / ConfluenceModule wiring 에서 그 emitter 를 주입한다. 사유:
  1. **adapter 결합도 0 보존** — adapter 는 이미 `PermissionDeniedEmitter` port 만 의존하고 영속화 구현을 모른다([github-adapter.service.ts](../../src/github/github-adapter.service.ts) L211~217 port + L229~232 `@Optional` 주입 주석). emitter 패턴은 이 port 를 그대로 재사용해 **adapter 코드 변경 0** 으로 영속화를 얹는다 — service 직접 호출은 adapter 에 repository / Prisma 의존을 새로 끌어들여 adapter leaf 경계([ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md) adapter leaf)를 깬다.
  2. **두 adapter 단일 경로** — GitHub / Confluence 가 같은 port 형태를 공유하므로([ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md) Confluence 전용 동형 interface) 영속화 emitter 를 양측에 주입하면 단일 영속화 경로. 단 두 이벤트의 shape 비대칭(`host` vs `baseUrl`)은 영속화 emitter 가 `instanceRef` 로 정규화(Decision §1)하며 흡수한다 — adapter 별 emitter 구현이 자기 이벤트 shape 를 record 로 매핑.
  3. **testability** — emitter 가 작은 함수형 port 라 adapter unit 은 mock emitter 로, 영속화 emitter 는 repository mock 으로 각각 독립 unit-test 가능(skip 본문 미테스트 risk 회피, 현 spec 의 mock emitter 패턴 정합).
- **emit 후 도메인 error throw 흐름 유지** — 영속화 emitter 로 교체해도 adapter 는 emit 후 도메인 error 를 그대로 throw 한다([ADR-0016 §4](ADR-0016-github-adapter-http-transport-contract.md) "emit 후에도 도메인 error throw", `NO_OP` 주석 L219~225 정합) — 영속화는 부가 audit 일 뿐 제어 흐름을 바꾸지 않는다. 영속화 실패(DB 장애)가 adapter 흐름을 깨지 않도록 emitter 내부 error 처리 위상은 후속 구현 task 책임(본 ADR 은 흐름 결정만).

### migration 절차 (후속 task 가 따를 reference)

후속 prisma schema + migration task 는 [ADR-0004](ADR-0004-smoke-e2e-db-mode.md) 의 **`prisma migrate deploy` 패턴** 을 따른다 — `prisma/schema.prisma` 가 schema 의 source of truth 이고, CI 는 test 실행 직전 실 PostgreSQL 16 container 에 `pnpm prisma migrate deploy` 로 migration 을 적용한다([ADR-0004 Decision](ADR-0004-smoke-e2e-db-mode.md) `migration` 항목). 새 `PermissionDeniedRecord` model 의 migration 파일도 이 절차로 생성/적용되며, 외부 credential 0(CI 실 PostgreSQL 이미 존재, Q-0019 제약).

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — PermissionDeniedRecord 의 데이터 모델·영속화 **결정** 만 박제한다. `pnpm add` 0 / prisma schema 변경 0 / 코드 0 — 본 task 는 production code 0 LOC(ADR doc + INDEX 1 row).
- **§5 DB schema 게이트는 이미 OPEN** — Q-0019 가 PermissionDeniedRecord DB migration 을 승인했으므로([STATE.json](../STATE.json) `humanQuestions[Q-0019]` decision), 후속 prisma schema + migration task 는 [CLAUDE.md §5](../../CLAUDE.md) DB schema 게이트를 **재발화하지 않고** 진행 가능하다(승인 1 회로 milestone 전체 OPEN).
- **외부 dependency / credential 0** — record 는 기존 Prisma + 실 PostgreSQL([ADR-0004](ADR-0004-smoke-e2e-db-mode.md)) 위에 entity 1 개 추가일 뿐 — 새 외부 dependency / 외부 credential 0. 후속 task 도 dependency-free 진입.

## Consequences

### 양의 (positive)

1. **ADR-first 로 reviewer 선행 점검** — prisma schema 변경 전에 데이터 모델·영속화 경계(필드 / retention / idempotency / relation / 이벤트 흐름)를 reviewer 가 점검 → 후속 schema slice 가 단일 source 를 mirror, 설계 divergence 0([ADR-0021](ADR-0021-github-confluence-live-integration-test-contract.md) ADR-first 패턴 검증).
2. **두 adapter 단일 record** — GitHub `host` / Confluence `baseUrl` 비대칭을 `provider` discriminator + `instanceRef` 정규화로 단일 entity 에 수용 → 영속화 경로 단일화, record 의 cohesion 유지.
3. **adapter 결합도 0 보존** — Decision §6 의 emitter 패턴이 기존 `PermissionDeniedEmitter` port 를 재사용 → adapter 코드 변경 0 으로 영속화를 얹고 adapter leaf 경계 유지.
4. **secret-at-rest 정합** — Decision §1 의 메타-only schema(token / 본문 컬럼 부재)가 [§9](../../CLAUDE.md) token 평문 미저장 invariant 를 schema 차원에서 강제([ADR-0006](ADR-0006-assessment-data-model.md) raw 미저장 schema-level 기법 정합).
5. **audit 독립성** — Decision §5 standalone(relation 부재)이 참조 대상 삭제와 무관하게 거부 이력 영구 보존 → audit trail 신뢰성.
6. **dependency-free 즉시 착수** — 기존 Prisma + 실 PostgreSQL([ADR-0004](ADR-0004-smoke-e2e-db-mode.md)) 위 entity 1 개 추가라 후속 slice 가 `pnpm add` 0 / 외부 credential 0 으로 진입([§5](../../CLAUDE.md) 게이트 미재발화, Q-0019 승인).

### 음의 (negative) / trade-off

1. **principal 미식별 (현 단계)** — Decision §1 상 `principal` 이 항상 null — 현 이벤트가 호출 주체를 싣지 않아 "누가" 거부됐는지 record 만으로는 알 수 없다(instance / path / status 만). mitigation: 이벤트 shape 확장 + ServiceIdentity nullable FK 를 후속 ADR 이 보강(Alternatives §(c)); 당장은 nullable 자리 예약으로 미래 cost 회피.
2. **중복 row 누적** — Decision §3 의 append-only(dedup 미적용)가 동일 거부 반복 시 row 를 무제한 누적 → 장기적으로 table 비대. mitigation: row 가 메타 only 라 단건 작음 + 빈도 신호 보존 이득이 비용 상회; 실측 부담 시 archival / TTL ADR(향후 재검토).
3. **TTL 부재** — Decision §3 영구 보존이라 자동 정리 없음 → 운영자가 수동 archival 안 하면 영구 누적. mitigation: index(Decision §4)가 조회 성능을 유지 + 비대 시 별도 retention ADR.
4. **standalone 의 join 부재** — Decision §5 relation 부재로 record 를 ServiceIdentity / Person 과 DB-level JOIN 으로 직접 엮을 수 없다(instanceRef 문자열 매칭만). mitigation: audit 조회는 instance ref / status / 기간 필터가 주 패턴이라 join 불요; principal 연계가 필요해지면 nullable FK 보강.

### 후속 task chain

본 ADR(doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md)(ADR + 코드 split) 정합. **본 task 에서 큐잉하지 않음**(planner 1-task 원칙 — Follow-ups 에 나열만):

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **prisma schema + migration** | `prisma/schema.prisma` 에 `PermissionDeniedRecord` model 추가(Decision §1 필드 + Decision §4 `@@index` + Decision §3 `@@unique` 미정의) + `prisma migrate` 생성([ADR-0004](ADR-0004-smoke-e2e-db-mode.md) migrate-deploy 패턴) | 본 ADR-0022 머지 후 | **없음 — §5 DB schema 게이트 Q-0019 로 이미 OPEN, dep 0** |
| **repository + service** | `PermissionDeniedRecord` repository(insert + audit query 경로, Decision §4) + service. R-112 4종 + negative cases 충분 cover(빈/경계/의존성 실패) + regression test(Q-0019 제약) | schema + migration 후 | 없음(entity 로직) |
| **영속화 emitter wiring** | `NO_OP_PERMISSION_DENIED_EMITTER` → 실 영속화 emitter(`PermissionDeniedEmitter` port 구현, Decision §6) 로 교체 + GithubModule / ConfluenceModule wiring. adapter 별 이벤트 shape(`host`/`baseUrl`) → `instanceRef` 정규화 매핑 | repository + service 후 | 없음(wiring) |
| **principal 식별 보강 (선택)** | 이벤트 shape 에 호출 principal(instance key 등) 추가 + record `principal`/`serviceIdentityId` nullable FK 채움 + R-112 | 위 chain 후, 필요 시 | 별도 ADR(Alternatives §(c)) |
| **ADR-0022 status 갱신 (필요 시)** | 본 ADR 은 ACCEPTED 로 시작 — schema 머지 후 별도 status 전이 불요(이미 ACCEPTED). 설계 변경 발생 시에만 amendment | — | 없음 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) 단일 standalone record + `provider` discriminator + `instanceRef` 정규화 + append-only(영구 보존) + emitter 패턴 영속화** (채택) | 두 adapter 비대칭 단일 수용 / adapter 결합도 0(port 재사용) / audit 독립성(relation 부재) / token 미저장 schema-level / dependency-free / ADR-first reviewer 선행 점검 | principal 현 단계 미식별 / 중복 row 누적 / TTL 부재(후속 ADR 여지) | **✓ 채택** (Q-0019 승인 + 현 이벤트 shape 직접 정합) |
| **(b) TTL / archival retention 도입** | 장기 누적 비대 회피 | 권한 거부 **빈도·장기 추적이 audit 의 핵심 신호** — TTL 이 그 신호를 소실 / 운영 추적 단절 / row 가 작아 비대 비용 낮음 | 기각 — 영구 보존이 audit 정합(비대 실측 시 별도 ADR) |
| **(c) Person / ServiceIdentity relation(FK) 부여** | principal 연계 / DB-level join 조회 | 현 이벤트가 principal 식별자 미포함 → FK 항상 null 무의미 / cascade 가 audit 독립성 훼손(참조 삭제 시 audit 동반 삭제) | 기각 — 현 shape 에 relation 도출 데이터 0(이벤트 확장 후 nullable FK 보강으로 재검토) |
| **(d) upsert / dedup (동일 거부 1 row + count 증가)** | row 누적 최소화 | 발생 **시점·횟수 자체가 audit 신호** — dedup 이 시점 정보 소실 / immutable audit 위배(row 갱신) | 기각 — append-only 가 audit 정합(빈도는 query-time GROUP BY) |
| **(e) adapter 가 영속화 service 직접 호출** | 중간 port 불요(직접 명시적) | adapter 에 repository / Prisma 의존 주입 → adapter leaf 경계([ADR-0016 §6](ADR-0016-github-adapter-http-transport-contract.md)) 훼손 / 기존 `PermissionDeniedEmitter` port 무력화 / adapter 코드 대폭 변경 | 기각 — emitter 패턴이 adapter 결합도 0 보존(Decision §6) |
| **(f) GitHub / Confluence 별 record 2 entity 분리** | adapter 별 컬럼(host vs baseUrl) 정확 표현 | 두 이벤트가 동형(path / status 공통)이라 중복 entity / audit 조회가 provider 별로 분기 / 단일 dashboard 구성 복잡 | 기각 — `provider` discriminator + `instanceRef` 정규화로 단일 entity cohesive |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) record 누적이 실측 부담이 되면 archival / TTL 정책 ADR(§(b)). (ii) principal 별 권한 거부 분석이 필요해지면 이벤트 shape 확장 + ServiceIdentity nullable FK 보강 ADR(§(c)). (iii) provider 가 2 종을 넘어 다양해지면 `provider` String-literal 의 enum 격상 ADR.

## References

- [docs/STATE.json](../STATE.json) `humanQuestions[Q-0019]` — PermissionDeniedRecord DB migration 승인(§5 DB schema 게이트 OPEN, 외부 credential 0, ADR-0004 migrate-deploy 준수, R-112 4종 + negative + regression 제약) — 본 ADR 의 직접 motivation
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) L198~225 — GitHub `PermissionDeniedEvent { host, path, status }` + `PermissionDeniedEmitter` port + `NO_OP_PERMISSION_DENIED_EMITTER`(영속화 record 가 mirror 할 이벤트 shape single source, token 평문 미포함 invariant)
- [src/confluence/confluence-adapter.service.ts](../../src/confluence/confluence-adapter.service.ts) L215~247 — Confluence `PermissionDeniedEvent { baseUrl, path, status }`(GitHub 와 동형이되 host 대신 baseUrl) + 동형 port — record 의 `instanceRef` 정규화 근거
- [prisma/schema.prisma](../../prisma/schema.prisma) — prisma 컨벤션 source(cuid PK / `createdAt @default(now())` / immutable entity `updatedAt` 미정의 / enum-as-String literal / `@@unique`·`@@index` 관례) + 헤더 L39~41 의 PermissionDeniedRecord deferral
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](ADR-0004-smoke-e2e-db-mode.md) — CI 실 PostgreSQL + `prisma migrate deploy` 패턴(후속 migration task reference)
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — raw 미저장 invariant(REQ-059) + cascade 정책 + view-time 집계(Decision §1/§3/§5 정합 source)
- [docs/decisions/ADR-0012-cross-cutting-field-policy.md](ADR-0012-cross-cutting-field-policy.md) — UTC 저장 / mutable-only `updatedAt` / immutable createdAt-only(Decision §1 timestamp 정합)
- [docs/decisions/ADR-0016-github-adapter-http-transport-contract.md](ADR-0016-github-adapter-http-transport-contract.md) §4/§6 — GitHub 4xx → PermissionDeniedEvent emit 경계 + adapter leaf 경계(Decision §2/§6 정합)
- [docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md](ADR-0018-confluence-adapter-http-transport-contract.md) §2/§4 — Confluence 풀 base URL + 4xx → PermissionDeniedEvent emit(Decision §1 `instanceRef` 비대칭 source)
- [docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md](ADR-0021-github-confluence-live-integration-test-contract.md) — milestone-3 ADR-first TEMPLATE(Decision enumerated section / Consequences / Alternatives / 후속 task chain 구조 mirror)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상(본 ADR-0022 row)
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다"(본 ADR-first split 정당화) / [§3.1 rule 4](../../CLAUDE.md) 새 ADR = pr-mode / [§5](../../CLAUDE.md) DB schema 게이트(Q-0019 OPEN) / [§9](../../CLAUDE.md) secret·token 미기재(메타 only schema)

Refs: T-0207, Q-0019, ADR-0004, ADR-0006, ADR-0012, ADR-0016, ADR-0018, ADR-0021, REQ-016, REQ-029, REQ-044, REQ-059
