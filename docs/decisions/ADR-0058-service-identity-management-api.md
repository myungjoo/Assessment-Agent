---
id: ADR-0058
title: 인원별 ServiceIdentity 관리 API 계약 — route shape · primary invariant · PATCH 갱신 축 · RBAC · 오류 계약 · service 허용 값
status: ACCEPTED
date: 2026-08-27
relatedTask: [T-1738]
relatedReq: [REQ-078, REQ-079]
supersedes: null
---

# ADR-0058 — 인원별 ServiceIdentity 관리 API 계약

## Status

**ACCEPTED**. 본 ADR 은 **결정만 박제**하며 코드를 1 LOC 도 만들지 않는다 (본 task 의 diff 는
본 문서 1 개뿐 — `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/`
변경 0). DTO · service · controller · e2e · AdminView 패널은 전부 §Follow-ups 로 이월한다.

**DB schema 변경 0** — `ServiceIdentity` model 은 [prisma/schema.prisma](../../prisma/schema.prisma)
`249~275 행` 에 이미 존재하고 본 결정은 그 컬럼 집합 안에서만 성립한다. 따라서
[CLAUDE.md §5](../../CLAUDE.md) 의 "DB schema 변경 → BLOCKED" 게이트에 닿지 않으며, **새 외부
dependency 도 0** (기존 NestJS · Prisma · class-validator 만으로 성립).

**완료 선언 0** — 본 ADR 은 [PLAN.md](../PLAN.md) `132 행` 을 `[x]` 로 바꾸지 않고, REQ-078 /
REQ-079 의 `PLANNED` status 도 그대로 둔다. 실제 capability 는 §Follow-ups 의 slice 들이
merge 된 뒤에야 생긴다.

## Context

[PLAN.md](../PLAN.md) `132 행` 의 오너 지시(2026-08-26, REQ-078 / REQ-079)는 착수 slice 가
**0** 이다. 실측 근거는 `origin/main` 에서 그대로 재확인된다.

- **데이터 계약은 이미 있다** — [prisma/schema.prisma](../../prisma/schema.prisma) `249~275 행`
  의 `ServiceIdentity` 가 `personId` · `service` · `externalId` · `isPrimary` ·
  `@@unique([personId, service])` · `onDelete: Cascade` 를 박제한다.
- **repository primitive 도 이미 있다** — [service-identity.repository.ts](../../src/user/service-identity.repository.ts)
  가 `findByPersonId` / `create` / `setPrimary` / `delete` 4 종을 제공하고, 그 헤더 주석이
  "invariant 강제는 service layer 책임", "`P2002` / `P2025` 는 catch 하지 않고 propagate" 라는
  책임 경계를 명시한다. **`update` 메서드는 없다.**
- **HTTP surface 만 없다** — `git grep "identities" -- "src/**/*.controller.ts"` 가 **0 건**
  이고, [person.controller.ts](../../src/user/person.controller.ts) `1~50 행` 헤더 주석도
  "ServiceIdentity nested endpoint 미노출" 을 스스로 적어 둔다. 그래서 UI 로 추가한 인원은
  이름 / email 만 갖고 GitHub · Confluence 수집 대상으로 연결되지 않는다.
- **`service` 값은 수집 매칭 키다** — [github-repo-source.ts](../../src/assessment-collection/domain/github-repo-source.ts)
  `74~99 행` 의 `resolveGithubRepoSources` 가 `identity.service` 를 `trim().toUpperCase()`
  정규화 후 **GitHub instance key**(env `GITHUB_INSTANCES` 의 key) 와 비교해 수집 대상을
  고른다. 즉 `service` 는 표시용 라벨이 아니라 **배포 환경과 맞물린 매칭 키**다.

결정이 필요한 축은 서로 얽혀 있다. route shape(nested vs flat)를 정해야 person 소유 검증의
자리가 정해지고, 그 자리가 정해져야 오류 계약(404 를 누가 던지는가)이 정해진다. primary
invariant 를 어느 layer 가 강제하는지가 PATCH 의 갱신 축을 좌우하고, `service` 의 허용 값
정본을 어디에 두는지가 400 검증의 모양을 결정한다. slice 마다 이를 재추론하면 controller ·
service · web 패널이 각자 다른 가정을 갖는다. 오너 지시 본문이 "API 설계는 architect ADR
동반" 이라고 못 박은 이유이며, [CLAUDE.md §1](../../CLAUDE.md) 의 "코드보다 ADR 이 먼저" 를
[ADR-0056](ADR-0056-perf-baseline-checkin-ci.md)(T-1559) 과 동형으로 1 회 집행한다.

## Decision

### 1. route shape — `/api/persons/:personId/identities` nested 채택

flat `/api/service-identities` 를 버리고 **person 하위 nested** 로 간다. 근거: (i) `personId`
가 URL 에 있어 소유 관계가 경로 자체로 표현되고 RBAC · 소유 검증이 한 자리에 모인다, (ii)
[api.md](../architecture/api.md) `86 행` 의 `GET /api/groups/:id/members` 가 이미 nested
sub-resource 선례이며 그 표기 관례를 그대로 승계한다, (iii) 오너 지시 본문의 예시 경로
(`/api/persons/:id/identities`) 와 일치한다.

채택 route 표 — 성공 status 는 [api.md](../architecture/api.md) `166 행`(POST 201 / POST
action 200) · `168 행`(DELETE 204) 관례에 정합한다.

| method | path | 성공 status | 동작 | 권한 |
| --- | --- | --- | --- | --- |
| GET | `/api/persons/:personId/identities` | **200** | 해당 Person 의 ServiceIdentity 전체 목록(body 동반). Person 존재 시 0 row 면 빈 배열 | User+ |
| POST | `/api/persons/:personId/identities` | **201** | identity 1 개 추가(body 동반). 첫 row 면 자동 primary — §Decision 2 | Admin+ |
| PATCH | `/api/persons/:personId/identities/:identityId` | **200** | `externalId` 단일 축 부분 갱신(body 동반) — §Decision 3 | Admin+ |
| DELETE | `/api/persons/:personId/identities/:identityId` | **204** | hard delete, body 없음. 잔여 row 의 primary 재승격 동반 — §Decision 2 | Admin+ |
| POST | `/api/persons/:personId/identities/:identityId/primary` | **200** | primary 지정 전용(action POST, `@HttpCode(200)` 명시). 새 row 를 만들지 않으므로 201 아님 — api.md `166 행` 의 read-only POST 3 종과 동형 | Admin+ |

primary 지정을 PATCH body 축이 아니라 **전용 경로**로 뺀 이유는 §Decision 3 에 있다. 이
경로는 idempotent 하다 — 이미 primary 인 row 에 재요청해도 결과 상태가 같고 200 이다.

### 2. primary invariant 강제 지점 — service layer

REQ-024 "1 인원 1 primary" 는 **service layer(`ServiceIdentityService`)** 가 강제한다.
repository 헤더 주석이 스스로 선언한 책임 경계(“0 row primary 또는 2+ row primary 상태의
검증 책임 없음”)를 그대로 승계하는 결정이며, **repository 의 `setPrimary` transaction 을
재구현하지 않고 그대로 호출**한다(기존 primary unset + 새 primary set 의 atomic 처리는 이미
`$transaction` 으로 되어 있다 — 새 transaction 을 service 에 다시 쓰지 않는다).

**0 primary 의 허용 여부를 다음으로 확정한다** — "미결" 로 남기지 않는다.

- **invariant 정식 서술**: 한 Person 의 identity row 수가 `N ≥ 1` 이면 **정확히 1 row** 가
  `isPrimary=true` 다. `N = 0` 이면 primary 는 존재하지 않으며 이는 정상 상태다(REQ-025 의
  "absent row 로 NULL 표현" — [data-model.md](../architecture/data-model.md) `66 행` 과 정합).
- **첫 identity 추가 시 자동 primary 승격**: POST 로 만든 row 가 그 Person 의 **첫 row 면
  service 가 곧바로 `setPrimary` 를 호출해 primary 로 올린다**. 두 번째 이후 row 는 `false`
  로 남는다(schema `@default(false)`). 근거 — 승격하지 않으면 `N ≥ 1` 인데 primary 0 인
  상태가 만들어지고, 수집이 primary 를 소비하는 시점에 조용히 0 건이 된다.
- **create DTO 는 `isPrimary` 를 받지 않는다**: primary 축은 §Decision 1 의 전용 경로 하나로
  단일화한다. body 에 `isPrimary` 를 넣으면 controller-scope `ValidationPipe` 의
  `forbidNonWhitelisted` 가 400 을 던진다([person.controller.ts](../../src/user/person.controller.ts)
  `1~50 행` 의 기존 pipe 설정을 그대로 승계).
- **마지막 primary 삭제 시 동작**: DELETE 대상이 primary 인 경우 service 는 삭제 후 **잔여
  row 중 `createdAt` 오름차순(동률이면 `id` 오름차순) 첫 row 를 자동 primary 로 승격**한다.
  잔여 row 가 0 이면 승격하지 않고 `N = 0` 상태로 끝난다. 즉 **DELETE 는 어떤 경우에도
  `N ≥ 1` 인데 primary 0 인 상태를 남기지 않는다.** 대상이 primary 가 아니면 승격 동작 없음.

### 3. PATCH 의 갱신 축 — `externalId` 만 허용

축별 결정과 근거는 다음과 같다.

- **`externalId` → 허용.** 실사용 주 사용처가 서비스 계정 ID 의 오타 정정 · 계정 변경이며,
  이 값은 수집의 author 귀속 필터에만 쓰여 다른 invariant 를 건드리지 않는다.
- **`isPrimary` → 금지.** primary 전이는 "기존 primary unset + 새 primary set" 의 2 op
  atomic 연산이라 repository 의 `setPrimary` transaction 이 유일한 안전 경로다. PATCH body
  로 열면 (i) 그 transaction 을 우회하는 단일 `update` 경로가 생기고, (ii) merge patch
  semantic 상 `{"isPrimary": false}` 가 합법이 되어 §Decision 2 가 금지한 "`N ≥ 1` 인데
  primary 0" 상태를 만들 수 있다. 그래서 §Decision 1 의 전용 POST 경로로만 노출한다.
- **`service` → 금지.** `service` 는 `@@unique([personId, service])` 의 구성 요소이자
  §Decision 6 의 수집 매칭 키다. 이를 갱신하면 identity 의 정체성 자체가 바뀌므로(다른
  서비스의 계정이 된다), **DELETE 후 POST** 로 표현한다. 이 편이 `P2002` 충돌 처리와 primary
  재승격을 기존 경로로 자연히 태울 수 있다.

따라서 PATCH body 는 `{ externalId?: string }` 단일 축이다. 부분 갱신 semantic 은 person
PATCH([api.md](../architecture/api.md) `80 행` RFC-7396 JSON Merge Patch)와 정합시킨다 —
**전달된 필드만 적용하고 미전달 필드는 보존**하며, 허용 축이 1 개뿐이므로 `null` 로의 삭제
semantic 은 지원하지 않는다(`null` 전달 시 400).

**repository 확장이 필요하다**: 현재 repository 에는 `update` 메서드가 없어 `externalId`
갱신을 수행할 primitive 가 없다. `ServiceIdentityRepository.update(id, { externalId })`
추가는 §Follow-ups (a) 에 연결한다(그 slice 가 `P2025` propagate 정책도 기존 4 primitive 와
동일하게 유지한다).

### 4. RBAC — 조회 User+ / 편집 Admin+

REQ-073("평가 대상 편집은 Admin 등급만, User 등급은 조회만") 및 [api.md](../architecture/api.md)
`77~81 행` 의 `/api/persons` 권한 컬럼(GET = User+, POST · PATCH · DELETE = Admin+)과 **동일한
tier** 를 적용한다.

- **적용 수단**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`(GET) /
  `@Roles("Admin")`(POST · PATCH · DELETE · primary 지정). `AssessmentController` 가 이미
  production 적용한 guard stack 을 1:1 mirror 하며 **새 auth 결정 0** — `RolesGuard` 의
  기존 escalation 매핑(`ROLE_HIERARCHY`)을 그대로 쓴다.
- 인증 부재(cookie 없음 / invalid JWT) → `JwtAuthGuard` 가 **401**. 권한 미달(User 가 편집
  시도) → `RolesGuard` 가 **403**. 둘 다 guard layer 이므로 아래 §Decision 5 의 도메인 오류
  변환보다 먼저 발생한다.

### 5. 오류 계약 — Prisma error → HTTP 변환표

변환은 **service layer** 가 수행하고 controller 는 추가 변환 0 으로 raw forward 한다
(`AssessmentController` 의 기존 패턴과 동형).

| # | 상황 | 발생 지점 | 변환 | HTTP |
| --- | --- | --- | --- | --- |
| a | 동일 Person 이 같은 `service` 를 재등록 — `@@unique([personId, service])` 위반 `P2002` | repository `create` | `ConflictException` | **409** |
| b | `:identityId` row 부재 — `P2025` | repository `update` · `delete` · `setPrimary` | `NotFoundException` | **404** |
| c | 미존재 `personId` 로의 요청 | service 가 5 route 모두에서 **Person 존재를 선검사**. race 로 FK 위반(`P2003`)이 나면 그것도 같은 예외로 흡수 | `NotFoundException` | **404** |
| d | `service` · `externalId` 값 검증 실패(빈 값 · 형식 위반 · 미정의 필드) | controller-scope `ValidationPipe` | class-validator 기본 응답 | **400** |
| e | `:identityId` 가 다른 Person 소유 | service 의 소유 검사 | `NotFoundException`(403 아님 — 타 Person 의 row 존재 여부를 노출하지 않는다) | **404** |

GET 도 (c) 를 적용한다 — `findByPersonId` 자체는 Person 부재 시에도 빈 배열을 주지만, nested
route 에서 "부재한 상위 resource" 가 200 을 주면 경로 의미가 깨지므로 **선검사 후 404** 로
통일한다.

**응답 body 형태는 NestJS 기본 `HttpException` body(`{ statusCode, message, error }`) 를
유지하고 커스텀 envelope 를 도입하지 않는다** — [signupError.ts](../../web/src/api/signupError.ts)
의 `extractMessages` 가 `message` 를 `string` 과 `string[]` 양쪽으로 소비하도록 이미 작성돼
있어(400 은 class-validator 가 채우는 `string[]`), 본 계약은 그 소비 계약과 충돌하지 않는다.

### 6. `service` 값의 허용 목록 정본 — 자유 문자열 + 형식 검증

`service` 는 schema 에서 `String` 이고 enum 이 아니다. 그 값의 **정본은 서버 코드의 상수가
아니라 배포 환경의 GitHub instance key 집합**(env `GITHUB_INSTANCES`)이다 — §Context 에서
확인한 대로 `resolveGithubRepoSources` 가 `identity.service` 를 instance key 와
`trim().toUpperCase()` 비교로 매칭한다. 따라서 다음을 결정한다.

- **채택: 자유 문자열 + 형식 검증.** DTO 는 `@IsString` · `@IsNotEmpty` · `@MaxLength(64)` ·
  `@Matches(/^[A-Za-z0-9._-]+$/)` 로 **형식만** 막는다(공백 · 제어문자 · 과길이 차단). 값의
  집합을 서버 상수로 하드코딩하지 않는다 — env 로 정의되는 instance key 를 코드에 이중
  박제하면 배포마다 drift 가 생기고, 새 instance 를 추가할 때마다 코드 변경 + 배포가
  필요해진다.
- **비채택: Prisma enum 격상.** 근거 (i) 값 집합이 **배포별로 다르다**(사내 instance key 는
  환경 설정), (ii) enum 추가마다 migration 이 필요해 본 ADR 의 "schema 변경 0" 전제와 충돌,
  (iii) 기존 관례가 **enum-as-String** 이다 — `Assessment` 의 period / scope, `User.role`
  모두 String + DTO 의 `@IsIn` 으로 처리하고 Prisma enum 을 쓰지 않는다. schema 주석
  (`249~275 행`)도 "enum 도입 / lookup table 격상은 별도 ADR 권장" 으로 유보해 두었고, 본
  ADR 이 그 유보를 **비채택으로 종결**한다.
- **오타 위험의 완화는 UI 축으로 민다.** 서버가 값 집합을 모르므로, 편집 UI 가 자유 입력
  대신 **후보 목록 선택**을 제공해야 실질적 오타 방지가 된다. 활성 instance key 를 조회할
  수단(읽기 전용 endpoint 등)의 신설 여부는 §Follow-ups (d) 의 판단으로 넘긴다. 그때까지의
  잔여 위험은 §Consequences (b) 에 명시한다.

## Consequences

### 긍정

- **결정 재추론 종료** — route · invariant · PATCH 축 · RBAC · 오류 · 값 정본 6 축이 한
  문서로 닫혀, 후속 5 slice 는 집행만 한다.
- **primitive 재구현 0** — `setPrimary` transaction 을 그대로 호출하므로 후속 service slice 의
  코드량이 작고 cap(≤ 300 LOC / ≤ 5 파일) 준수가 쉽다. 신규 primitive 는 `update` 1 개뿐이다.
- **기존 관례 승계** — guard stack · `ValidationPipe` 설정 · status 관례 · 오류 변환 위치가
  모두 기존 controller 의 mirror 라 새 auth · 새 envelope · 새 dependency 가 0 이다.
- **web 소비 계약 무손상** — 기본 `HttpException` body 유지로 `signupError.ts` 계열 helper 의
  파싱 가정이 그대로 성립한다.

### 부정 / trade-off

- **(a) nested route 채택으로 endpoint 당 query 1 회 증가** — §Decision 5 (c) 의 Person 존재
  선검사가 5 route 전부에 붙으므로, 조회 1 회로 끝나던 연산이 항상 2 회(person 조회 +
  본 연산)가 된다. GET 목록처럼 원래 1 query 였던 경로에서 비용이 2 배가 되고, 목록 화면이
  인원 수만큼 이 endpoint 를 호출하면 그 배수만큼 누적된다.
- **(b) `service` 자유 문자열의 조용한 실패** — 형식 검증은 오타를 잡지 못한다. `"gihub"`
  같은 오타를 저장해도 400 도 409 도 나지 않고 저장에 성공하며, 수집 시점에 매칭 0 →
  **수집 결과 0 건**이 에러 없이 발생한다. 사용자는 "등록했는데 데이터가 없다" 만 보게 된다.
  §Follow-ups (d) 의 후보 목록 UI 가 이 위험의 종료 조건이지만, 그전까지 위험은 실재한다.
- **(c) 자동 primary 승격이 사용자 의도와 어긋날 수 있음** — §Decision 2 의 DELETE 후
  `createdAt` 최소 row 승격은 결정론적이지만 사용자가 고른 값이 아니다. primary 를 지운
  직후 의도와 다른 identity 가 수집 기준이 될 수 있으며, UI 가 승격 결과를 표시하지 않으면
  변화가 보이지 않는다.
- **(d) `service` 축 PATCH 금지로 정정 동선이 2 회 왕복** — 오타 난 `service` 를 고치려면
  DELETE + POST 를 해야 하고, 그 대상이 primary 였다면 (c) 의 승격이 끼어들어 primary 지정을
  한 번 더 해야 할 수 있다. UI 는 이 3 단계를 사용자에게 숨기는 부담을 진다.

## Alternatives considered

| 대안 | 내용 | 미채택 근거 |
| --- | --- | --- |
| **flat `/api/service-identities`** | person 무관 최상위 collection + body / query 로 `personId` 전달 | `personId` 가 경로에 없어 소유 검증과 RBAC 을 매 endpoint 가 body 파싱 후 재구현해야 하고, 목록 조회에 필터 query 규약이 새로 필요하다. api.md `86 행` 의 `GET /api/groups/:id/members` nested 선례와도 불일치 |
| **person PATCH body 에 identities 배열 replace-all** | `PATCH /api/persons/:id` body 에 identities 전체 배열을 넣어 통째 교체 | RFC-7396 merge patch 의 배열은 **통째 교체**라 동시 편집이 상대 변경을 조용히 덮어쓴다. 부분 실패 semantic(3 개 중 1 개가 `P2002`)이 정의되지 않고, primary 전이를 배열 diff 로 유도해야 해 `setPrimary` transaction 재구현을 부른다 |
| **Prisma enum 격상 (`service` 를 enum 으로)** | schema 에 서비스 enum 신설 | 값 집합이 배포별 env(instance key)라 코드 고정이 불가하고, 값 추가마다 migration 이 필요해 "schema 변경 0" 전제와 충돌. 기존 enum-as-String 관례(period / scope / role)와도 어긋난다 — §Decision 6 |
| **PATCH body 에 `isPrimary` 허용** | 단일 PATCH 로 primary 까지 전이 | `setPrimary` transaction 을 우회하는 두 번째 경로가 생기고, `{"isPrimary": false}` 가 합법이 되어 "`N ≥ 1` 인데 primary 0" 상태를 만든다 — §Decision 3 |
| **DELETE 후 자동 승격 없이 0-primary 허용** | 마지막 primary 를 지우면 primary 없는 상태로 둠 | 수집이 primary 를 소비하므로 조용한 0 건으로 이어진다. 사용자에게 "다시 지정하라" 를 강제하는 화면 상태를 UI 가 추가로 다뤄야 한다 — §Decision 2 |
| **서버 상수 allowlist + `@IsIn`** | 허용 service 문자열을 코드 상수 배열로 고정 | env `GITHUB_INSTANCES` 와 이중 박제라 배포마다 drift 하고, 새 instance 추가가 코드 변경 + 배포를 요구한다. 오타 방지 이득은 UI 후보 목록으로 대체 가능 — §Decision 6 |

## Out of scope

- **DB schema 변경 0** — `prisma/schema.prisma` 를 건드리지 않는다(model 이 이미 존재).
- **수집 파이프라인 변경 0** — [collection-entry.service.ts](../../src/assessment-collection/collection-entry.service.ts)
  및 `resolveGithubRepoSources` 등 매칭 로직은 그대로 둔다. 본 ADR 은 그 소비 계약을 **읽기만**
  했다.
- **web 패널 신설 0** — AdminView · PersonList 수정 없음. REQ-079 UI 는 §Follow-ups (d).
- **api.md 동기 0** — [api.md](../architecture/api.md) 의 endpoint 표에 본 5 route 를 추가하지
  않는다. doc-sync 는 §Follow-ups (e).
- **`docs/requirements.md` · `docs/PLAN.md` 갱신 0** — 완료 표기는 하지 않는다(§Status).
- **코드 1 LOC 0** — DTO · service · controller · repository `update` · spec 신설 전부 후속.
- **새 외부 dependency 0** — 기존 NestJS · Prisma · class-validator 만으로 성립.

## References

- [prisma/schema.prisma](../../prisma/schema.prisma) `249~275 행` — `ServiceIdentity` model
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) — 4 primitive + 책임 경계 주석(`update` 부재)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `1~50 행` — `ValidationPipe` 관례 · nested endpoint 미노출 명시
- [src/assessment-collection/domain/github-repo-source.ts](../../src/assessment-collection/domain/github-repo-source.ts) `74~99 행` — `service` ↔ instance key 매칭
- [docs/architecture/api.md](../architecture/api.md) `76~81 행`(UC-03 권한 컬럼) · `80 행`(person PATCH RFC-7396) · `86 행`(nested sub-resource 선례) · `166 행` · `168 행`(status 관례)
- [docs/architecture/data-model.md](../architecture/data-model.md) `23 행` · `66 행` — REQ-023 / REQ-024 / REQ-025 정본
- [docs/requirements.md](../requirements.md) `92 행`(REQ-073) · `97~98 행`(REQ-078 / REQ-079)
- [ADR-0056](ADR-0056-perf-baseline-checkin-ci.md) — 결정 전용 doc-only ADR 선례(절 구성 mirror 대상)
- [CLAUDE.md](../../CLAUDE.md) §1 코드보다 ADR / §3.1 commit mode / §3.2 R-112 / §5 HITL / §12 언어 정책

## Follow-ups

아래는 **순서가 있는 chain** 이다((a) → (b) → (c) 는 선행 의존, (d) · (e) 는 (c) 이후 병렬
가능). **모든 항목이 diff ≤ 300 LOC / 변경 파일 ≤ 5 개 cap 을 지키고, 코드 변경을 동반하면
[CLAUDE.md §3.2](../../CLAUDE.md) R-112 4 항목(happy-path / error path / 분기 cover /
negative cases 충분 cover)을 준수한다.**

- **(a) DTO + service(invariant 강제)** — `CreateServiceIdentityDto`(§Decision 6 형식 검증) ·
  `UpdateServiceIdentityDto`(`externalId` 단일 축) 와 `ServiceIdentityService`(§Decision 2 의
  자동 승격 · 재승격, §Decision 5 의 Prisma → HttpException 변환), 그리고 §Decision 3 이
  요구하는 `ServiceIdentityRepository.update` 확장. cap ≤ 300 LOC / ≤ 5 파일 · R-112 준수
  (negative 는 최소 `P2002` 409 / `P2025` 404 / person 부재 404 / 타 person 소유 404 4 종).
- **(b) controller + RBAC 배선** — §Decision 1 의 5 route 를 `PersonController` 와 별도
  controller 중 어디에 둘지 결정해 배선하고, §Decision 4 의 guard stack 을 부착한다. cap
  ≤ 300 LOC / ≤ 5 파일 · R-112 준수(401 / 403 분기 각 1+ test).
- **(c) e2e 로 오류 계약 고정** — §Decision 5 의 표 5 행(a ~ e)을 실 HTTP 로 고정한다. 특히
  §Decision 2 의 자동 승격 · 재승격을 DB 상태로 검증한다. cap ≤ 300 LOC / ≤ 5 파일 · R-112
  준수(negative 위주 스위트).
- **(d) AdminView 편집 UI** — REQ-079 의 "이름 / email 만 입력 가능한 상태 금지" 를 해소하는
  인원 추가 · 편집 동선. §Consequences (b) 완화를 위한 **service 후보 목록 제시** 방식(활성
  instance key 조회 수단의 신설 여부 포함)을 이 slice 가 판단한다. cap ≤ 300 LOC / ≤ 5 파일 ·
  R-112 준수(web spec 의 error path · 빈 목록 분기 포함).
- **(e) api.md · requirements.md doc-sync** — §Decision 1 의 5 route 를 api.md UC-03 표에
  추가하고 REQ-078 / REQ-079 status 를 (a) ~ (d) 실측에 맞춰 재판정한다. **본 ADR 만으로는
  어떤 완료 표기도 하지 않는다.** doc-sync 이므로 코드 변경 0 · cap ≤ 300 LOC / ≤ 5 파일.

Refs: T-1738, REQ-078, REQ-079
