---
id: ADR-0059
title: 평가 대상 시스템(수집 대상) 등록·편집 모델·API 계약 — 저장 위치 · credential 경계 · env 병합 우선순위 · 대상 종류 모델링 · RBAC
status: ACCEPTED
date: 2026-08-30
relatedTask: [T-1807]
relatedReq: [REQ-070, REQ-072, REQ-073]
supersedes: null
---

# ADR-0059 — 평가 대상 시스템(수집 대상) 등록·편집 모델·API 계약

## Status

**ACCEPTED**. 본 ADR 은 **결정만 박제**하며 코드를 1 LOC 도 만들지 않는다 (본 task 의 diff 는
본 문서 1 개뿐 — `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/`
변경 0). Prisma model · migration · repository · service · DTO · controller · e2e · AdminView
패널은 전부 §Follow-ups 로 이월한다 ([ADR-0058](ADR-0058-service-identity-management-api.md) 선례 동형).

**새 외부 dependency 0** — 채택안은 기존 NestJS · Prisma · class-validator 만으로 성립한다
(§Decision 6).

**완료 선언 0** — 본 ADR 은 [PLAN.md](../PLAN.md) `130 행` 을 `[x]` 로 바꾸지 않고,
[requirements.md](../requirements.md) `89 행` REQ-070 · `91 행` REQ-072 · `92 행` REQ-073 의
`PLANNED` status 도 그대로 둔다. 실제 capability 는 §Follow-ups 의 slice 들이 merge 된 뒤에야
생긴다.

## Context

[PLAN.md](../PLAN.md) `130 행` 오너 지시(2026-08-26, R-164~R-168)의 인원 축은 2026-08-30 재판정
으로 5/5 shipped 가 됐고, 잔여는 REQ-070(빈 상태 우산) · REQ-072(시스템 등록·편집) ·
REQ-073(RBAC) 세 row 뿐이다. 세 row 모두 `PLANNED` 이고 착수 slice 가 **0** 이다.

실측 근거(`origin/main` 기준)는 다음과 같다.

- **평가 대상 시스템의 좌표는 지금 env 에만 있다** —
  [github-instance-config.ts](../../src/github/github-instance-config.ts) 의
  `resolveGithubInstances` 가 `GITHUB_INSTANCES` key list 와 per-key `_HOST` / `_ORG` /
  `_REPOS` / `_TOKEN_ENC` 를 읽고,
  [confluence-instance-config.ts](../../src/confluence/confluence-instance-config.ts) 의
  `resolveConfluenceInstances` 가 `CONFLUENCE_INSTANCES` 와 `_BASE_URL` / `_AUTH_USER` /
  `_SPACE_ALLOWLIST` / `_TOKEN_ENC` 를 읽는다. 둘 다 **부수효과 0 순수 함수**이고 필수 변수
  (`_HOST`·`_BASE_URL` + `_TOKEN_ENC`) 부재 시 그 instance 를 reject 하는 fail-fast 계약
  (ADR-0017 §3 · ADR-0018 §2)을 가진다.
- **DB model · API · UI 는 전무하다** — `git grep "CollectionTarget\|collection-target"
  -- src docs` 가 본 task 파일 밖에서 **0 건**이다. 즉 운영자가 화면에서 평가 대상 시스템을
  등록·편집할 수단이 없고, 대상을 늘리려면 배포 환경의 env 를 고쳐 재기동해야 한다.
- **PLAN `130 행` 이 신설을 지시한다** — "시스템 축은 수집 대상 등록 모델·API·UI 가 부재하면
  신설(architect 판단 — ADR 동반). Admin 편집 / User 조회 (RBAC 일관)."

결정 축은 서로 얽혀 있다. 저장 위치를 정해야 credential 을 어디에 두는지가 정해지고, 그 경계가
정해져야 등록된 대상이 어떤 token 을 쓸지 가리키는 방법이 정해진다. env 와 DB 의 우선순위를
정해야 기존 수집 경로의 동작 변화 0 을 보증할 수 있고, 대상 종류 모델링이 정해져야 API 표면과
검증 위치가 결정된다. slice 마다 이를 재추론하면 schema · service · web 패널이 각자 다른 가정을
갖는다. [CLAUDE.md §1](../../CLAUDE.md) 의 "코드보다 ADR 이 먼저" 를 여기서 1 회 집행한다.

## Decision

### 1. 저장 위치 — (a) 신규 Prisma model 신설 채택

등록된 평가 대상 시스템의 **좌표 정본은 DB row**(신규 `CollectionTarget` model)로 둔다.
(b) env-only 유지 + 조회 API 만, (c) env 와 DB 를 둘 다 좌표 정본으로 두는 hybrid 는
§Alternatives 로 내린다. 근거는 다음과 같다.

- **REQ-072 의 문언이 "등록·편집"** 이다. env-only 는 값을 읽어 보여줄 수만 있고 화면에서
  쓰기가 원리적으로 불가능하다 — 프로세스 env 를 런타임에 고치는 것은 재기동 없이는 반영되지
  않고, 컨테이너/배포 파이프라인이 소유한 값을 앱이 쓰는 것은 배포 계약 위반이다. 따라서
  (b) 는 REQ-072 를 만족시킬 수 없다.
- **(c) 이중 정본은 drift 를 구조적으로 보장한다.** 같은 좌표가 두 곳에 쓰기 가능하면 어느
  쪽이 진실인지 매 조회마다 재판정해야 하고, 그 재판정 규칙이 곧 §Decision 3 의 우선순위와
  중복된다. 정본은 하나여야 한다.
- **(a) 는 기존 관례 안에서 성립한다** — cuid PK · `createdAt` / `updatedAt` · `@@unique` 라는
  [schema.prisma](../../prisma/schema.prisma) `55 행` `Person` · `257 행` `ServiceIdentity`
  컨벤션을 그대로 승계하면 되고, 새 dependency 도 0 이다.

**env 는 폐기하지 않는다.** env 는 (i) credential 보관소(§Decision 2)와 (ii) 기존 배포가 이미
정의한 대상의 정본으로 계속 남는다. 둘의 관계는 §Decision 3 이 정한다.

### 2. credential 경계 — 좌표는 DB, credential 은 env, DB 는 참조 key 만

**대상 좌표**(host / org / repo / baseUrl / SPACE)와 **credential**(`_TOKEN_ENC` ·
`_AUTH_USER`)을 분리한다.

- **token 실값도 암호문도 DB 에 넣지 않고 API 응답에도 넣지 않는다.** 등록·수정 요청 body 에도
  받지 않는다 — 받지 않으므로 실수로 저장될 경로 자체가 없다. `_TOKEN_ENC` 의 값은 ADR-0014
  AES-256-GCM envelope 문자열이고, 암호문이라도 DB 로 옮기면 (i) 백업 · export · 로그의 노출
  표면이 늘고 (ii) [CLAUDE.md §9](../../CLAUDE.md) 의 secret 취급 원칙과 ADR-0017 / ADR-0018 의
  "env 존재만 검사, 실값은 코드에 적지 않는다" 계약이 이원화된다.
- **`_AUTH_USER` 도 동일하게 env 에 남긴다.** Confluence Cloud Basic 의 계정명은 token 과 한
  쌍으로만 의미가 있어(ADR-0018 §3 auth scheme 분기 입력) credential 측에 묶는 편이 경계가
  단순하다.
- **DB 는 credential 을 `instanceKey` 문자열 1 개로 가리킨다.** 등록 row 의 `instanceKey` 가
  곧 env instance key 이며, 수집 시점에 `GITHUB_<KEY 대문자>_TOKEN_ENC` /
  `CONFLUENCE_<KEY 대문자>_TOKEN_ENC` 를 조립해 찾는다 — 이름 조립 규칙은 기존
  `githubEnvName` / `confluenceEnvName` 을 재사용하고 새 규칙을 만들지 않는다.
- **API 응답에 노출되는 것은 `instanceKey` 이름뿐**이며 이는 실값이 아니라 식별자다. token
  존재 여부 flag 조차 본 ADR 범위에서는 노출하지 않는다(그 노출 여부 판단은 §Follow-ups (b)).

### 3. env 와 등록 대상의 관계 — union 병합 · 충돌 시 env 우선

- **병합 방식**: 수집 대상 집합 = `resolveGithubInstances` / `resolveConfluenceInstances`
  결과 **∪** `CollectionTarget` 의 `active=true` row (union).
- **충돌 정의**: 같은 `(type, instanceKey)` 가 env 와 DB 양쪽에 존재하는 경우.
- **우선순위**: **env 우선**. 충돌하는 DB row 는 좌표를 덮지 않고 무시되며, 그 사실은 진단
  목록(기존 `rejected` 와 동형)으로 보고한다. 근거 — (i) env 정의는 credential 과 한 묶음이고
  ADR-0017 / ADR-0018 의 fail-fast reject 계약이 env 축에만 있다, (ii) DB 가 env 를 덮으면
  화면 조작 하나로 배포 환경의 수집 대상이 조용히 바뀌어 운영 사고 표면이 커진다, (iii) env
  우선이면 도입 시 기존 경로의 동작 변화가 자명하게 0 이다.
- **기존 수집 경로 동작 변화 0** — 본 ADR 은 결정만 박제하므로
  `resolveGithubInstances` / `resolveConfluenceInstances` 및
  [collection-entry.service.ts](../../src/assessment-collection/collection-entry.service.ts) 는
  1 LOC 도 바뀌지 않으며, union 배선이 shipped 된 뒤에도 DB table 이 비어 있으면 결과 집합이
  env 결과와 **동일**하고 충돌 시에도 env 가 이기므로 기존 대상의 수집 결과는 변하지 않는다
  (배선은 §Follow-ups (b) 이후 slice 책임).

### 4. 대상 종류 모델링 — 단일 model + `type` discriminator

GitHub 와 Confluence 를 **2 model 로 나누지 않고 단일 `CollectionTarget` model + `type`
discriminator** 로 둔다. 근거: (i) 두 종류의 축이 "어디에(endpoint) + 무엇을(하위 범위 목록)"
로 동형이라 컬럼 대부분을 공유한다, (ii) 2 model 이면 route · DTO · service · e2e 가 2 벌이 되어
후속 slice 의 cap(≤ 300 LOC / ≤ 5 파일)을 구조적으로 압박한다, (iii) 목록 조회가 union 없이
1 query 로 끝난다. 대가(type 별 필수성을 DB 제약으로 못 박지 못함)는 §Consequences (c).

| 필드 | 타입 | 필수 | 의미 |
| --- | --- | --- | --- |
| `id` | `String @id @default(cuid())` | 필수 | PK — `Person` · `ServiceIdentity` 컨벤션 승계 |
| `type` | `String` | 필수 | `"GITHUB"` \| `"CONFLUENCE"` (enum-as-String — 아래) |
| `instanceKey` | `String` | 필수 | 좌표 식별 key 이자 credential 참조 key(§Decision 2) |
| `endpoint` | `String` | 필수 | GITHUB 은 host(예: `github.com`), CONFLUENCE 는 풀 REST base URL |
| `orgs` | `String[]` | GITHUB 만 | org 목록. CONFLUENCE 는 빈 배열 |
| `repos` | `String[]` | 선택 | GitHub repo allowlist. 빈 배열이면 org 전체(ADR-0030 모드 A) |
| `spaces` | `String[]` | CONFLUENCE 만 | SPACE allowlist(ADR-0013 §2). GITHUB 은 빈 배열 |
| `active` | `Boolean @default(true)` | 필수 | 수집 대상 활성 — 삭제 없이 제외하는 축 |
| `createdAt` / `updatedAt` | `DateTime` | 필수 | `@default(now())` / `@updatedAt` |

**유일성 제약**: `@@unique([type, instanceKey])` — 한 종류 안에서 instance key 는 유일하다
(env 의 "중복 key → 먼저 등장한 1 개만 활성" 규칙과 같은 의도를 DB 층에서 강제). `endpoint`
단독 unique 는 두지 않는다 — 같은 host 에 서로 다른 org 집합을 별도 대상으로 등록하는 것이
정당한 사용이기 때문이다.

**Prisma enum 격상 여부 — 격상하지 않는다(String + DTO `@IsIn`).** 근거: (i) 기존 3 enum
(`JobStatus` · `ExportScope` · `ImportMode`, [schema.prisma](../../prisma/schema.prisma)
`549~574 행`)은 **코드가 전부 소유하는 job lifecycle 값**인 반면, `type` 은 adapter 추가마다
늘어나는 확장 축이라 성격이 다르다, (ii) 도메인/배포 축 값은 이미 enum-as-String 관례다
(`User.role` `174 행`, `ServiceIdentity.service` `260 행`, `Assessment.period` / `scope`
`297~298 행`), (iii) enum 값 추가마다 migration 이 필요해 확장 비용이 커진다. 이는 ADR-0058
§Decision 6 의 비채택 논리와 동일 계열이다.

**다중 값 컬럼은 Prisma scalar list(`String[]`)로 둔다.** 현 schema 에 `String[]` 선례는 없으나
ADR-0002 의 PostgreSQL 이 native array 를 지원하고 새 dependency 0 이다. `Json` 은 형태 무제약이라
"문자열 배열" 보장을 코드가 다시 해야 하고, comma-separated `String` 은 env 파싱 규칙을 DB 층에
이중 박제하며 원소 단위 질의를 불가능하게 한다.

### 5. API 표면 + RBAC — flat `/api/collection-targets`

상위 소유 resource 가 없는 최상위 개념이므로 flat collection 으로 둔다(ADR-0058 이 nested 를
택한 이유였던 `personId` 소유 관계가 여기엔 없다). 성공 status 는
[api.md](../architecture/api.md) `77 행` 이하의 `/api/persons` 표기 관례(GET 200 / POST 201 /
PATCH 200 / DELETE 204)에 정합시킨다.

| method | path | 성공 status | 동작 | 권한 |
| --- | --- | --- | --- | --- |
| GET | `/api/collection-targets` | **200** | 등록 대상 전체 목록(body 동반). 0 row 면 빈 배열 | User+ |
| GET | `/api/collection-targets/:id` | **200** | 단건 상세 | User+ |
| POST | `/api/collection-targets` | **201** | 신규 등록(body 동반) | Admin+ |
| PATCH | `/api/collection-targets/:id` | **200** | 부분 수정 — RFC-7396 merge patch. `type` · `instanceKey` 는 갱신 축에서 제외(정체성 축 — 변경은 DELETE + POST) | Admin+ |
| DELETE | `/api/collection-targets/:id` | **204** | hard delete, body 없음. 일시 제외는 `active=false` PATCH | Admin+ |

**RBAC — 조회 `User+` / 편집 `Admin+`** 로 REQ-073 과 일관되게 결정한다. 적용 수단은
`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`(GET) / `@Roles("Admin")`(POST ·
PATCH · DELETE) 이며, 기존 `RolesGuard` 의 `ROLE_HIERARCHY` 승격 매핑을 그대로 쓴다 —
**새 auth 결정 0**.

오류 계약:

| # | 상황 | 발생 지점 | 변환 | HTTP |
| --- | --- | --- | --- | --- |
| a | 인증 부재 / invalid JWT | `JwtAuthGuard` | guard 기본 | **401** |
| b | User 등급이 편집 시도 | `RolesGuard` | guard 기본 | **403** |
| c | 동일 `(type, instanceKey)` 재등록 — `@@unique` 위반 `P2002` | repository `create` | `ConflictException` | **409** |
| d | `:id` row 부재 — `P2025` | repository `update` · `delete` · 단건 조회 | `NotFoundException` | **404** |
| e | 형식 검증 실패(빈 값 · 미정의 필드 · `type` 미허용 값 · 과길이) | controller-scope `ValidationPipe` | class-validator 기본 응답 | **400** |

응답 body 는 NestJS 기본 `HttpException` body(`{ statusCode, message, error }`)를 유지하고
커스텀 envelope 를 도입하지 않는다(ADR-0058 §Decision 5 와 동일 — web 의 기존 오류 파싱 helper
계약 무손상).

### 6. §5 새-dep · DB schema 게이트 판정

- **새 외부 dependency 0** — 채택안은 Prisma scalar list · class-validator `@IsIn` /
  `@IsArray` 등 **이미 설치된** 것만 쓴다. `package.json` 변경 0.
- **DB schema — additive 신규 table 로 판정한다.** `CollectionTarget` 은 기존 어떤 model 과도
  relation 을 맺지 않고(back-relation 필드 추가 0), 기존 컬럼을 바꾸지 않으며, 기존 row 를
  읽거나 옮기는 **data migration 이 0** 이다(생성 직후 0 row 에서 시작). 따라서
  [CLAUDE.md §5](../../CLAUDE.md) 의 "DB schema 변경(data migration 필요) → BLOCKED" 게이트의
  전제 조건이 성립하지 않아 owner 게이트를 경유하지 않는다.
- **단, 이 판정은 §Follow-ups (a) 가 실측으로 재확인해야 한다.** 그 slice 에서 additive 가
  아님이 드러나거나 기존 model 변경이 필요해지면 즉시 중단하고 §5 owner 게이트(humanQuestion)를
  경유한다 — 그 의무는 §Follow-ups (a) 에 병기했다.

## Consequences

### 긍정

- **결정 재추론 종료** — 저장 위치 · credential 경계 · env 병합 · 모델링 · API/RBAC · 게이트
  6 축이 한 문서로 닫혀 후속 6 slice 는 집행만 한다.
- **기존 경로 무손상** — §Decision 3 의 env 우선 union 으로 도입 시점 동작 변화가 0 이다.
- **credential 표면 불변** — token 이 env 밖으로 한 발도 나가지 않아 ADR-0014 / ADR-0017 /
  ADR-0018 과 CLAUDE.md §9 의 기존 계약이 그대로 유지된다.

### 부정 / trade-off

- **(a) env ↔ DB 이원화가 남기는 혼동** — 같은 "평가 대상" 개념의 좌표가 배포 env 와 DB 두
  곳에 존재하고, 화면 목록은 둘을 섞어 보여주게 된다. 운영자는 어떤 행이 편집 가능한 DB row 고
  어떤 행이 배포가 소유한 env 정의인지 구분해야 하며, env 정의를 화면에서 고치려다 "저장은
  됐는데 반영이 안 되는"(§Decision 3 의 env 우선) 경험을 할 수 있다. UI 가 출처와 편집
  가능 여부를 명시적으로 표시하지 않으면 이 혼동은 그대로 사용자에게 간다.
- **(b) credential 을 env 에 남겨 생기는 조용한 실패 경로** — 화면에서 새 `instanceKey` 로
  대상을 등록해도 그 key 의 `_TOKEN_ENC` 가 배포 env 에 없으면 등록은 201 로 성공하고,
  수집 시점에 credential 부재로 그 대상이 reject 되어 **수집 결과 0 건**이 된다. 사용자는
  "등록했는데 데이터가 없다" 만 보게 된다. 등록 시점 검증 수단(존재하는 key 목록 제시 또는
  credential 존재 여부 확인)이 §Follow-ups (b) · (e) 에서 붙기 전까지 이 위험은 실재한다.
- **(c) 단일 model 의 type 별 필수성이 DB 제약이 아니다** — `orgs` 는 GITHUB 에만,
  `spaces` 는 CONFLUENCE 에만 의미가 있으나 단일 table 로는 그 조건부 필수성을 강제할 수 없어
  검증이 DTO/service 로 밀린다. 그 검증을 빠뜨린 경로가 생기면 "필드가 비어 있는 대상" 이
  저장될 수 있다.
- **(d) 정체성 축 PATCH 금지로 정정 동선이 2 회 왕복** — `type` · `instanceKey` 오타는
  DELETE + POST 로만 고칠 수 있어 UI 가 그 2 단계를 사용자에게 숨기는 부담을 진다.

## Alternatives considered

| 대안 | 내용 | 미채택 근거 |
| --- | --- | --- |
| **(b) env-only 유지 + 조회 API 만** | 좌표를 계속 env 에 두고 읽기 endpoint 만 신설 | REQ-072 의 "등록·편집" 을 원리적으로 만족 못 한다 — 런타임 env 쓰기는 배포 계약 위반이고 재기동 없이 반영되지 않는다. 빈 상태(REQ-070)도 여전히 배포 담당자를 거쳐야 풀린다 — §Decision 1 |
| **(c) env + DB hybrid 이중 정본** | 같은 좌표를 양쪽에서 모두 쓰기 가능하게 둠 | 정본이 둘이면 drift 가 구조적으로 보장되고, 매 조회마다 진실 판정 규칙이 필요해 §Decision 3 의 우선순위 규칙과 중복된다 — §Decision 1 |
| **2 model 분리(`GithubCollectionTarget` / `ConfluenceCollectionTarget`)** | 종류별 table + 종류별 route | 컬럼 대부분이 동형인데 route · DTO · service · e2e 가 2 벌이 되어 후속 slice 의 cap(≤ 300 LOC / ≤ 5 파일)을 압박하고, 목록 조회가 union 을 요구한다. 이득(type 별 NOT NULL)은 §Consequences (c) 의 DTO 검증으로 대체 가능 — §Decision 4 |
| **`type` 을 Prisma enum 으로 격상** | schema 에 대상 종류 enum 신설 | adapter 추가마다 migration 을 부르고, 도메인/배포 축 값의 기존 관례(`User.role` · `ServiceIdentity.service` · `Assessment.period`)가 enum-as-String 이다 — §Decision 4 |
| **충돌 시 DB 우선** | 등록 row 가 env instance 정의를 덮어씀 | 화면 조작 하나로 배포가 소유한 수집 대상이 조용히 바뀌고, 도입 시점 "동작 변화 0" 보증이 깨진다. env 의 fail-fast reject 계약도 우회된다 — §Decision 3 |
| **좌표를 `Json` 컬럼 1 개로 보관** | type 별 좌표를 `coordinates Json` 에 통째 저장 | 형태 무제약이라 배열/문자열 보장을 코드가 다시 해야 하고 원소 단위 질의·유일성 판단이 불가능하다. 기존 `Json` 사용처(`entitySelector`)는 형태가 본질적으로 가변인 selector 라 성격이 다르다 — §Decision 4 |
| **credential(암호문)까지 DB 로 이관** | `_TOKEN_ENC` envelope 를 row 에 함께 저장 | 백업 · export · 로그로 노출 표면이 늘고 CLAUDE.md §9 및 ADR-0014 / ADR-0017 / ADR-0018 의 env 계약이 이원화된다 — §Decision 2 |

## Out of scope

- **`prisma/schema.prisma` 변경 0 · migration 0** — model 신설은 §Follow-ups (a) 소관.
- **수집 파이프라인 변경 0** —
  [collection-entry.service.ts](../../src/assessment-collection/collection-entry.service.ts) 및
  `resolveGithubInstances` / `resolveConfluenceInstances` 를 건드리지 않는다. 본 ADR 은 그
  소비 계약을 **읽기만** 했다.
- **web 패널 신설 0** — AdminView 수정 없음. 등록·편집 UI 는 §Follow-ups (e).
- **`docs/architecture/api.md` · `docs/architecture/data-model.md` · `docs/requirements.md`
  동기 0** — doc-sync 는 §Follow-ups (f).
- **PLAN `130 행` 마커 변경 0 · REQ-070 / REQ-072 / REQ-073 status 재판정 0** (§Status).
- **코드 1 LOC 0** — `src/` · `web/` · `test/` · `package.json` · `.github/workflows/` 무변경.
- **credential 실값 · PAT · token 을 문서에 적는 일 0** — env 이름만 인용했다(CLAUDE.md §9).

## References

- [docs/PLAN.md](../PLAN.md) `130 행` — 오너 지시(2026-08-26, R-164~R-168) 시스템 축 신설 지시
- [docs/requirements.md](../requirements.md) `89 행` REQ-070 · `91 행` REQ-072 · `92 행` REQ-073
- [src/github/github-instance-config.ts](../../src/github/github-instance-config.ts) — `GITHUB_INSTANCES` · `_HOST` / `_ORG` / `_REPOS` / `_TOKEN_ENC`
- [src/confluence/confluence-instance-config.ts](../../src/confluence/confluence-instance-config.ts) — `CONFLUENCE_INSTANCES` · `_BASE_URL` / `_AUTH_USER` / `_SPACE_ALLOWLIST` / `_TOKEN_ENC`
- [prisma/schema.prisma](../../prisma/schema.prisma) `55 행` `Person` · `257 행` `ServiceIdentity` · `549~574 행` 기존 3 enum · `614 행` `ExportJob`
- [docs/architecture/api.md](../architecture/api.md) `77 행` 이하 — 권한 컬럼 표기와 status 관례
- [ADR-0058](ADR-0058-service-identity-management-api.md) — 결정 전용 doc-only ADR 형식 선례
- [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) · [ADR-0017](ADR-0017-github-instance-config-source.md) · [ADR-0018](ADR-0018-confluence-adapter-http-transport-contract.md) — env credential 계약
- [CLAUDE.md](../../CLAUDE.md) §1 코드보다 ADR / §3.2 R-112 / §5 HITL 게이트 / §9 secret / §12 언어 정책

## Follow-ups

아래는 **순서가 있는 chain** 이다((a) → (b) → (c) → (d) 는 선행 의존, (e) · (f) 는 (d) 이후
병렬 가능). **모든 항목이 diff ≤ 300 LOC / 변경 파일 ≤ 5 개 cap 을 지키고, 코드 변경을 동반하면
[CLAUDE.md §3.2](../../CLAUDE.md) R-112 4 항목(happy-path / error path / 분기 cover /
negative cases 충분 cover)을 준수한다.**

- **(a) schema + migration slice** — §Decision 4 의 필드 표와 `@@unique([type, instanceKey])`
  를 `prisma/schema.prisma` 에 additive 로 추가하고 migration 을 생성한다. **§Decision 6 의
  additive 판정을 실측으로 재확인하는 것이 이 slice 의 첫 의무이며, additive 가 아니거나 기존
  model 변경이 필요하다는 결론이 나오면 즉시 중단하고 CLAUDE.md §5 owner 게이트(humanQuestion)
  를 경유한다.** cap ≤ 300 LOC / ≤ 5 파일.
- **(b) repository + service** — CRUD primitive 와 §Decision 5 의 Prisma → HttpException
  변환(`P2002` → 409, `P2025` → 404), §Decision 2 의 credential 미노출 보장(응답 매핑에 token
  계열 필드 부재). cap ≤ 300 LOC / ≤ 5 파일 · R-112 준수(negative 는 최소 중복 409 · 부재 404 ·
  type 별 필수 필드 누락 3 종).
- **(c) DTO + controller + RBAC 배선** — `Create` / `Update` DTO(§Decision 4 의 `type`
  `@IsIn`, §Decision 5 의 정체성 축 제외)와 5 route, `@Roles` + `RolesGuard` stack 부착.
  cap ≤ 300 LOC / ≤ 5 파일 · R-112 준수(401 / 403 분기 각 1+ test).
- **(d) e2e 로 오류 계약 고정** — §Decision 5 오류 표 5 행(a ~ e)을 실 HTTP 로 고정한다.
  cap ≤ 300 LOC / ≤ 5 파일 · R-112 준수(negative 위주 스위트).
- **(e) AdminView 등록·편집 패널** — REQ-070 / REQ-072 의 화면 축. §Consequences (a) 의 출처
  표시(env 유래 vs DB row)와 (b) 완화를 위한 `instanceKey` 후보 제시 방식을 이 slice 가
  판단한다. cap ≤ 300 LOC / ≤ 5 파일 · R-112 준수(web spec 의 error path · 빈 목록 분기 포함).
- **(f) api.md · requirements.md doc-sync** — §Decision 5 의 5 route 를 api.md 표에 추가하고
  REQ-070 / REQ-072 / REQ-073 status 를 (a) ~ (e) 실측에 맞춰 재판정한다. **본 ADR 만으로는
  어떤 완료 표기도 하지 않는다.** doc-sync 이므로 코드 변경 0 · cap ≤ 300 LOC / ≤ 5 파일.
- **(g, 선택) env 병합 배선** — §Decision 3 의 union + env 우선을 실제 수집 경로에 배선한다.
  (b) 이후 언제든 착수 가능하나 (e) 보다 먼저 하면 화면 없이 검증이 어렵다. cap ≤ 300 LOC /
  ≤ 5 파일 · R-112 준수(충돌 시 env 우선 분기 · DB 빈 table 분기 각 1+ test).

Refs: T-1807, REQ-070, REQ-072, REQ-073
