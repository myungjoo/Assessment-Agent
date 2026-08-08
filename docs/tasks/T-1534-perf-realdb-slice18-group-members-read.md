---
id: T-1534
title: 실 DB perf slice 18 — group membership row 조회 실측
phase: P5
status: DONE
completedAt: 2026-08-08T21:00:13Z
commitSha: b1da3564
prNumber: 1228
commitMode: pr
coversReq: [REQ-048, REQ-028]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-08-08
createdAt: 2026-08-08T19:41:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1533]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~340 LOC (T-1526 274 / T-1528 339 / T-1530 345 / T-1502 287 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/group-members-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 18(GET /api/groups/:id/members). N:M 중간 테이블 raw row 반환 + 조인/비조인 페어 + unique tuple 후행 컬럼 필터. Group 은 기존 도메인이라 도메인 14 불변 · route 26 → 27. pr · 2 파일 약 320 LOC."
---

# T-1534 — 실 DB perf slice 18: group membership row 조회 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB round-trip cutover 를 slice 18 로 한 칸 넓힌다. slice 1~17 은 endpoint 도메인 **14 개**(조회 route 26) 를 실 Postgres 위에서 실측했지만, 그 26 route 의 응답은 예외 없이 **도메인 entity row**(slice 1~10·12·13) · **sanitize view**(11·14) · **파생 view**(15) · **in-process registry 상태**(16) · **stream artifact**(17) 였다. 본 slice 는 `GroupController` 의 `GET /api/groups/:id/members` (REQ-028 N:M 다중 소속) — `GroupService.findMembershipsByGroupId` 가 **N:M 중간 테이블 `PersonGroupMembership` 의 raw row 를 그대로** 돌려주는 route — 를 실 부트스트랩으로 처음 실측한다.

slice 2([`group-read-realdb.perf-spec.ts`](../../test/perf/group-read-realdb.perf-spec.ts))는 같은 controller 의 `GET /api/groups` · `:id` · `:id/persons` 3 route 를 쟀지만 spec 헤더 `⑤ Out of Scope` 가 **`:id/members` 측정을 명시적으로 제외**했고, slice 17(T-1532) 의 Out of Scope · Follow-ups 도 본 route 를 다음 slice 후보로 이월했다. 본 task 가 그 이월을 닫는다.

본 slice 가 주장하는 **새 구조 축 3 개** (README slice 목록에 근거와 함께 그대로 기록할 것):

1. **N:M 중간 테이블 row 자체가 응답 payload 인 첫 실 DB 경로**. `findMembershipsByGroupId` 는 `membershipRepository.findByGroupId` 결과를 **가공 0 으로 그대로** 반환하므로 응답 원소가 `PersonGroupMembership`(`id` / `personId` / `groupId` / `createdAt` 4 컬럼) 이다 ([src/user/group.service.ts](../../src/user/group.service.ts) `findMembershipsByGroupId`). 앞 17 slice 의 응답에는 **join table row 를 직접 노출하는 경로가 없었다** — 도메인 entity 도 파생 view 도 아닌 **관계 자체를 1급 payload 로 내리는** 첫 측정이다. 부수적으로 `updatedAt` 조차 없는 **가장 좁은 row shape** 다.
2. **같은 부모 row 를 조인 경로와 비조인 경로로 나란히 재는 첫 페어**. `:id/persons`(slice 2·3) 는 `findPersonsByGroupId` 가 membership 추출 후 `PersonRepository.findById` 를 loop 호출해 **query 수가 membership 수에 비례(1 + 1 + N)** 하지만, `:id/members` 는 부모 검증 + `findMany` 의 **상수 2 query** 다. 같은 group id · 같은 seed 상태에서 두 route 를 한 spec 안에서 측정해 이 구조 차이를 관측 기록으로 남긴다 (**두 표본의 대소 관계와 규모별 증가율은 wall-clock 비결정성 때문에 단언하지 않는다** — slice 3 선례). "요청당 상수 2 query" 자체는 slice 7(`PartService.findPersonsByPartId`) 과 같아 **새 축으로 주장하지 않고**, 새 축은 **동일 부모·동일 데이터의 두 접근 경로를 페어로 측정**한다는 점이다.
3. **복합 unique tuple 의 후행(non-prefix) 컬럼 단독 필터**. 필터 컬럼은 `groupId` 인데 `PersonGroupMembership` 의 유일한 선언 index 는 `@@unique([personId, groupId])` 이고 `groupId` 는 그 **두 번째 컬럼** 이라 prefix 를 탈 수 없다 ([prisma/schema.prisma](../../prisma/schema.prisma) `model PersonGroupMembership`). slice 5 는 composite unique 의 **prefix** 를 탔고, slice 6 은 unique·index 중복 tuple, slice 7 은 **선언 자체가 0** 인 컬럼이었다 — **선언된 unique index 가 있는데도 필터가 그 prefix 를 못 타는 경로** 는 본 slice 가 처음이다 (slice 7 의 "선언 0 인 유일 실측 필터 컬럼" 서술은 여전히 유효하므로 훼손하지 말 것).

`GroupController` 는 guard 미부착이라 (slice 2 spec 헤더 ② 박제) **401 / 403 분기가 구조적으로 부재** 하다 — slice 4~17 의 인증·인가 negative 를 그대로 복사하면 안 된다. 대신 404 / 빈 배열 / 격리 / cascade 축으로 negative 를 채운다.

**계수 함정 — 반드시 아래 실검산대로 적을 것**:

- `GroupController` 는 slice 2·3 에서 **이미 실측 도메인** 이므로 **실측 endpoint 도메인 14 는 불변** 이고 **조회 route 만 26 → 27** 로 늘어난다 (slice 15·17 과 같은 셈법 — 도메인·route 가 동시에 늘었던 **slice 16 문장을 복사하면 도메인을 잘못 올린다**).
- 본 route 는 **mock perf-spec 짝이 존재하지 않는다** (`test/perf/` 에 `group-members-read.perf-spec.ts` 없음 — 목록은 `group-read` · `group-detail-read` · `group-persons-read` 3 개뿐). 따라서 앞 slice 들의 "mock 짝(`X-read.perf-spec.ts`)과의 경계" 문장을 그대로 복사하면 **없는 파일을 가리키는 거짓 서술** 이 된다. mock 짝 부재 자체를 명시하고 "mock spec 수 변화 0" 만 유지한다. mock 잔존 read perf-spec **30 은 그래도 불변** 이다 (`47 − 17 = 30` — 피감수와 감수가 함께 1 씩 증가).

## Required Reading

- [docs/tasks/T-1532-perf-realdb-slice17-export-download-read.md](T-1532-perf-realdb-slice17-export-download-read.md) — 직전 slice 의 task 구조 · AC · Out of Scope 선례 (본 task 는 그 동형).
- [test/perf/group-read-realdb.perf-spec.ts](../../test/perf/group-read-realdb.perf-spec.ts) — slice 2. 같은 controller 의 `createE2EApp` 부트스트랩 · seed · `afterEach(truncateAll)` · `measure` 구조의 **직접 mirror 대상** (헤더 `⑤ Out of Scope` 의 `:id/members` 제외 문구가 본 task 로 해소됨을 새 spec 헤더에 cross-ref).
- [test/perf/group-persons-scale-realdb.perf-spec.ts](../../test/perf/group-persons-scale-realdb.perf-spec.ts) — slice 3. 규모 두 표본 측정 + **대소 미단언 관찰 기록** 패턴의 선례.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) `@Get(":id/members")` (`120~123 행` 부근) — `findMembers` 가 `service.findMembershipsByGroupId` 로 단일 forward. guard 미부착 · `@UsePipes(ValidationPipe)` 는 body 대상이라 GET 무관.
- [src/user/group.service.ts](../../src/user/group.service.ts) `findPersonsByGroupId` + `findMembershipsByGroupId` 두 메서드 — 부모 존재 검증(`findById` → `NotFoundException`) · membership 0 시 빈 배열 · **Person 조인 유무 차이** 의 정본.
- [src/user/person-group-membership.repository.ts](../../src/user/person-group-membership.repository.ts) `findByGroupId` — `prisma.personGroupMembership.findMany({ where: { groupId } })` 단일 query.
- [prisma/schema.prisma](../../prisma/schema.prisma) `model PersonGroupMembership` (`131~141 행` 부근) — 4 컬럼 + `@@unique([personId, groupId])` + `person` / `group` 양쪽 `onDelete: Cascade`.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의 slice 17 항목(`766 행` 부근) + `- **잔여**` 항목(`798 행` 부근) — 본 slice 항목을 slice 17 뒤에 append 하고 계수를 갱신한다.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll` 의 정리 대상 명단 (`PersonGroupMembership` 은 `Person` / `Group` CASCADE 로 정리되는지 확인, helper 수정 0).
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) — `createE2EApp` 시그니처 (본 controller 는 guard 미부착이라 `createAuthenticatedE2EApp` 불요 — slice 2 와 동일).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) · [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) — `collectLatencySamples` / `assertS2Threshold` / `buildBaselineReport` / `formatBaselineLine` 시그니처.

## Acceptance Criteria

- [ ] 신규 [`test/perf/group-members-read-realdb.perf-spec.ts`](../../test/perf/group-members-read-realdb.perf-spec.ts) 를 추가한다. 파일명에 `read` 를 포함시켜 README 의 read glob 계수 규칙(slice 14~17 선례)을 유지한다. **mock override 0** — `createE2EApp()` 로 AppModule 을 실 부트스트랩하고 `moduleRef.get(PrismaService)` 의 실 client 로 seed 한다 (`overrideProvider` / `overrideGuard` 사용 금지).
- [ ] **happy path** — membership 이 있는 Group 의 `GET /api/groups/:id/members` 를 반복 호출하면 200 이고 `collectLatencySamples` + `assertS2Threshold` 로 p95 **< 3000ms** 를 실측 pass 한다 (test 1+). 응답 배열 길이가 seed 한 membership 수와 일치하고, 각 원소가 `id` · `personId` · `groupId` · `createdAt` 4 키를 가지며 `personId` 집합이 seed 한 Person id 집합과 일치함을 단언한다.
- [ ] **payload shape 단언 (새 축 1)** — 응답 원소에 **Person payload 키가 없음**(`fullName` · `email` 등 부재) 과 중첩 관계 객체 키(`person` / `group`) 부재를 단언해, `:id/persons` 와 달리 **join 0 · 중간 테이블 row 원형** 임을 직접 증거화한다. 아울러 응답의 `id` 값이 `DELETE /api/groups/:id/members/:membershipId` 계약이 요구하는 `PersonGroupMembership.id` 와 같은 값임을(같은 id 로 Prisma 직접 조회 시 동일 row) 단언한다.
- [ ] **페어 측정 (새 축 2)** — **같은 group id · 같은 seed 상태** 에서 `:id/members`(상수 2 query) 와 `:id/persons`(1 + 1 + N) 를 각각 측정해 두 p95 를 **모두 3000ms 미만** 으로 단언하고, 두 값을 `buildBaselineReport` / `formatBaselineLine` 한 줄로 **관찰 기록만** 남긴다. **대소 관계(`persons.p95 > members.p95`)를 assert 하지 않는다** (slice 3 선례 — wall-clock 비결정성).
- [ ] **규모 관찰** — membership 소규모(예: 5 건) 와 상대적 대규모(예: 40~60 건) 두 상태에서 `:id/members` 를 각각 측정해 두 p95 를 모두 3000ms 미만으로 단언한다. **두 값의 대소 관계와 증가율은 단언하지 않고 관찰 기록만** 남긴다.
- [ ] **error path** — 존재하지 않는 group id 로 호출하면 부모 존재 검증(`findById`) 의 `NotFoundException` 이 전파돼 **404** 이고, 표본이 0 · `errorRate` 가 1 임을 단언한다 (test 1+). 응답 body 에 raw stack / Prisma 메시지가 노출되지 않음도 함께 단언한다.
- [ ] **분기 cover** — 분기마다 test 를 둔다: (a) membership **0 건** Group → **404 가 아니라 200 + 빈 배열**, (b) membership 1+ → 전량 반환, (c) 부모 Group 부재 → 404(위 error path 와 공유 가능). 세 분기가 각각 별도 `it` 로 구분돼야 한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 각 1+ test: (a) 다른 Group 의 membership 이 응답에 **혼입되지 않음**(Group 2 개 seed 후 각각 조회 — 격리), (b) 한 Person 이 **2 Group 에 동시 소속**(REQ-028 다중 소속) 일 때 각 group 의 응답에 각각 1 건씩만 나타남, (c) `Person` row 를 삭제하면 `onDelete: Cascade` 로 membership row 가 동반 소멸해 응답 길이가 줄어듦(같은 시점 `:id/persons` 결과와 길이 일치), (d) path 변형(`:id/members/extra` 또는 `:id/member`) 이 200 이 아닌 4xx, (e) 형식이 유효하지 않은 group id(빈 문자열 대체 토큰 · 비-cuid 문자열) 에서도 500 이 아니라 **404** 로 결정론적 분기, (f) 비현실적 임계 주입(`p95MaxMs: 0`) 시 `assertS2Threshold` 가 **실패로 판정** 됨(측정 시간 무의존 fail 분기 — slice 2 선례). **인증·인가(401/403) negative 는 본 controller 에 guard 가 없어 구조적으로 부재하므로 만들지 않는다** — 그 사실을 spec 헤더 주석에 명시한다.
- [ ] **정리 · 격리** — `afterEach` 는 `truncateAll(prisma)` 로 도메인 테이블을 비워 각 test 가 자기 seed 만 보게 한다 (`PersonGroupMembership` 은 `Person` / `Group` CASCADE 로 정리 — [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) **수정 0**). `Person.email` 은 `@unique` 이므로 seed 시 index 접미로 충돌을 회피한다. `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 open handle 0.
- [ ] `DEFAULT_P95_MAX_MS = 3000` (REQ-048) 를 변경하지 않고 baseline 파일을 확정하지 않는다 — `buildBaselineReport` / `formatBaselineLine` 은 관찰 전용 한 줄로만 쓰고 `writeBaselineFile` / `confirmOrCompareBaseline` 은 호출하지 않는다 (디스크 write 0).
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 slice 목록에 `- **slice 18**` 항목을 slice 17 뒤에 append 한다. §Why 의 새 축 3 개를 근거와 함께 기술하고, "새 축으로 주장하지 않는" 항목(상수 2 query 는 slice 7 과 동일 · guard 부재는 slice 2 와 동일)도 명시하며, **mock 짝이 없는 첫 실 DB slice** 임을 밝힌다.
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 `- **잔여**` 항목 계수를 아래 실검산대로 갱신한다 — perf-spec **51 → 52**, read glob **46 → 47**, 실 DB round-trip **17 → 18**(그중 read **16 → 17**), mock 잔존 read perf-spec 은 `47 − 17 = 30` 으로 **불변**, 실측 endpoint 도메인 **14 불변**(Group 은 slice 2·3 에서 이미 도메인), 조회 route **26 → 27**. 실제 `ls test/perf/*.perf-spec.ts | wc -l` 등으로 검산해 어긋나면 문서가 아니라 계수를 고친다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` 변경 0 이므로 기존 수치 유지).
- [ ] 로컬 실 DB 전제(`docker compose up -d postgres` + `DATABASE_URL` export + `pnpm prisma migrate deploy`) 하에 `pnpm test:perf` 로 신규 spec 이 picking 되어 통과. `jest-perf.json` 의 `testRegex` 가 자동 매칭하므로 workflow / config 편집 0. 로컬 Postgres 부재 시 CI 의 postgres service `perf test` step success 로 확정한다.

## Out of Scope

- **doc-sync** — [docs/PLAN.md](../PLAN.md) `142 행` · [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 · [docs/requirements.md](../requirements.md) REQ-048 에 slice 18 실측을 반영하는 작업은 **머지 후 별도 `direct` task** 로 이월한다 (slice 13~17 선례 T-1525 / T-1527 / T-1529 / T-1531 / T-1533 동형 — CLAUDE.md §3.1 rule 3 direct·pr mixed 금지). 본 task 는 `test/` 만 건드린다.
- 같은 controller 의 이미 실측된 route(`GET /api/groups` · `:id` — slice 2, `:id/persons` — slice 2·3) 의 **재측정을 목적으로 하는 확장** — `:id/persons` 는 AC 의 **페어 측정 대조군으로만** 호출하고 별도 규모·분기 축을 새로 만들지 않는다.
- write route(`POST :id/members` · `DELETE :id/members/:membershipId` · `POST` / `PATCH` / `DELETE /api/groups`) 의 latency 측정 — seed 와 삭제는 Prisma 직접 write 로 준비한다 (membershipId 계약 단언도 HTTP DELETE 가 아니라 Prisma 조회로 확인).
- `src/` production code 수정 일체 — 특히 `findPersonsByGroupId` 의 **N+1 최적화 금지**(측정만), `:id/members` 에 `include` 추가 · guard 부착 · pagination 추가 금지.
- `prisma/schema.prisma` 수정(예: `groupId` 단독 `@@index` 추가) — index 추가 판단은 실측 결과를 근거로 하는 **별도 task** 다.
- `test/helpers/*` 수정 · 기존 mock perf-spec 수정 · 임계값(3000ms) 변경 · baseline 파일 확정 · k6 등 부하 발생기 도입 · REQ-047 실 scale 부하 측정.
- 나머지 미측정 read route(`GET /api/admin/import/:id` · `GET /` app root 등) 의 실 DB cutover — route / endpoint 단위 후속 slice.
- `.github/workflows/ci.yml` · `jest-perf.json` · `package.json` 편집.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **doc-sync (direct, 다음 slice 전 필요)** — 본 slice 가 Out of Scope 로 이월한 3 문서 동기: [docs/PLAN.md](../PLAN.md) `142 행` · [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 · [docs/requirements.md](../requirements.md) REQ-048. perf-spec 52 / read glob 47 / 실 DB slice 18(read 17) / **실측 endpoint 도메인 14 불변 · 조회 route 26 → 27** 로 갱신(slice 15·17 과 같은 셈법 — slice 16 문장 복사 금지). slice 17(T-1533) 의 doc-sync task 와 동형.
- **`PersonGroupMembership.groupId` 단독 index 검토 (pr, 별도 task)** — 본 slice 가 `@@unique([personId, groupId])` 의 후행 컬럼 단독 필터를 실측하므로, 그 결과를 근거로 `@@index([groupId])` 추가 여부를 판단한다. schema 변경 + migration 이라 CLAUDE.md §5 DB schema 게이트 대상 — architect 판단 선행.
